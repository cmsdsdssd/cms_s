import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";
import { getMaterialFactor } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 10_000;

let marketTicksCache: { expiresAt: number; payload: unknown } | null = null;

type MarketTickConfigRow = {
    fx_markup: number;
    cs_correction_factor: number;
    silver_kr_correction_factor: number;
};

type RoleRow = { role_code: "GOLD" | "SILVER"; symbol: string };
type LatestBySymbolRow = { symbol: string; price_krw_per_g: number | null; meta: Record<string, unknown> | null };

const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const readMetaNumber = (meta: Record<string, unknown> | null, key: string): number | null => {
    if (!meta) return null;
    return toNum(meta[key]);
};

export async function GET() {
    try {
        const now = Date.now();
        if (marketTicksCache && marketTicksCache.expiresAt > now) {
            return NextResponse.json(marketTicksCache.payload, {
                headers: {
                    "Cache-Control": "private, max-age=10, stale-while-revalidate=10",
                },
            });
        }

        const sb = getSchemaClient();
        if (!sb) {
            return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
        }

        const [cfgResult, roleResult] = await Promise.all([
            sb
                .from("cms_market_tick_config")
                .select("fx_markup, cs_correction_factor, silver_kr_correction_factor")
                .eq("config_key", "DEFAULT")
                .maybeSingle(),
            sb
                .from("cms_market_symbol_role")
                .select("role_code, symbol")
                .in("role_code", ["GOLD", "SILVER"])
                .eq("is_active", true),
        ]);

        if (cfgResult.error) {
            console.error("Market tick config fetch error:", cfgResult.error);
            return NextResponse.json({ error: "Failed to fetch market tick config" }, { status: 500 });
        }

        const cfgRow = (cfgResult.data ?? {
            fx_markup: 1.03,
            cs_correction_factor: 1.2,
            silver_kr_correction_factor: 1.2,
        }) as MarketTickConfigRow;

        const fxMarkup = Number(cfgRow.fx_markup ?? 1.03);
        const csFactor = Number(cfgRow.cs_correction_factor ?? 1.2);
        const silverKrFactor = Number(cfgRow.silver_kr_correction_factor ?? 1.2);

        if (roleResult.error) {
            console.error("Market symbol role fetch error:", roleResult.error);
            return NextResponse.json({ error: "Failed to fetch market symbol roles" }, { status: 500 });
        }

        const roleRows = (roleResult.data ?? []) as RoleRow[];
        const goldSymbol = roleRows.find((r) => r.role_code === "GOLD")?.symbol ?? null;
        const silverSymbol = roleRows.find((r) => r.role_code === "SILVER")?.symbol ?? null;

        const [goldResult, silverResult, csResult, cnyResult] = await Promise.all([
            sb
                .from("cms_v_market_tick_latest_by_symbol_ops_v1")
                .select("symbol, price_krw_per_g, meta")
                .eq("symbol", goldSymbol ?? "__MISSING__")
                .maybeSingle(),
            sb
                .from("cms_v_market_tick_latest_by_symbol_ops_v1")
                .select("symbol, price_krw_per_g, meta")
                .eq("symbol", silverSymbol ?? "__MISSING__")
                .maybeSingle(),
            sb
                .from("cms_v_market_tick_latest_by_symbol_ops_v1")
                .select("price_krw_per_g, meta")
                .eq("symbol", "SILVER_CN_KRW_PER_G")
                .maybeSingle(),
            sb
                .from("cms_v_market_tick_latest_by_symbol_ops_v1")
                .select("price_krw_per_g")
                .eq("symbol", "CNY_KRW_PER_1_ADJ")
                .maybeSingle(),
        ]);

        if (goldResult.error) {
            console.error("Gold tick fetch error:", goldResult.error);
            return NextResponse.json({ error: "Failed to fetch gold tick" }, { status: 500 });
        }

        if (silverResult.error) {
            console.error("Silver tick fetch error:", silverResult.error);
            return NextResponse.json({ error: "Failed to fetch silver tick" }, { status: 500 });
        }

        const goldPrice = toNum((goldResult.data as LatestBySymbolRow | null)?.price_krw_per_g) ?? 0;

        // SILVER는 “원래 은시세(보정 전)”를 복원할 수 있으면 복원(메타에 factor가 있으면 나눠서 복원)
        const silverRowData = silverResult.data as LatestBySymbolRow | null;
        const silverPriceMaybe = toNum(silverRowData?.price_krw_per_g);
        const silverMeta = silverRowData?.meta ?? null;
        const silverFactorInMeta =
            readMetaNumber(silverMeta, "silver_kr_correction_factor") ??
            readMetaNumber(silverMeta, "krx_correction_factor");

        const silverBasePrice =
            silverPriceMaybe === null
                ? null
                : silverFactorInMeta && silverFactorInMeta > 0
                    ? silverPriceMaybe / silverFactorInMeta
                    : silverPriceMaybe;

        // ✅ KS 계산: Settings 값(silver_kr_correction_factor)에 연동
        const ks = silverBasePrice === null ? null : Number(silverBasePrice) * silverKrFactor;
        const silver925Purity = getMaterialFactor({ materialCode: "925" }).purityRate;
        const ks925 = ks === null ? null : ks * silver925Purity; // ✅ 표시용만

        const csRowData = csResult.data as LatestBySymbolRow | null;
        const csPriceRaw = toNum(csRowData?.price_krw_per_g);
        const csMeta = csRowData?.meta ?? null;

        const csNoCorrStrict = readMetaNumber(csMeta, "silver_cn_krw_per_g_no_corr");

        const csNoCorr =
            csNoCorrStrict ??
            readMetaNumber(csMeta, "cs_no_corr_krw_per_g") ??        // ✅ 기존 키(호환)
            (() => {
                const f = readMetaNumber(csMeta, "cs_correction_factor");
                return csPriceRaw !== null && f && f > 0 ? csPriceRaw / f : null;
            })();


        // ✅ CS도 Settings 값(cs_correction_factor)에 “연동”(원시세가 있으면 config로 재계산)
        const cs = csNoCorr === null ? csPriceRaw : csNoCorr * csFactor;

        const cnyAd = toNum((cnyResult.data as { price_krw_per_g?: number | null } | null)?.price_krw_per_g);

        const payload = {
            data: {
                fxAsOf: new Date().toISOString(),
                // legacy (catalog/page.tsx 등에서 사용)
                gold: goldPrice,
                silver: ks,
                silverOriginal: silverBasePrice,
                // new (MarketTicker에서 사용)
                kg: goldPrice,
                ks,
                ks925,
                ksOriginal: silverBasePrice,
                cs,
                csTick: csPriceRaw,
                csOriginal: csNoCorr,
                csOriginalStrict: csNoCorrStrict,
                cnyAd,
                // 디버깅/가시성용(원하면 유지, 싫으면 삭제 가능)
                _config: { fxMarkup, csFactor, silverKrFactor },
            },
        };

        marketTicksCache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "private, max-age=10, stale-while-revalidate=10",
            },
        });
    } catch (error) {
        console.error("Market ticks API error:", error);
        return NextResponse.json({ error: "Failed to fetch market ticks" }, { status: 500 });
    }
}
