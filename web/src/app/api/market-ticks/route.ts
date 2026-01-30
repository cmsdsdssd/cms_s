import { NextResponse } from "next/server";
import { getSchemaClient } from "@/lib/supabase/client";

type CsMeta = {
    cs_no_corr_krw_per_g?: number;
};

export async function GET() {
    try {
        const supabase = getSchemaClient();

        // Use the gold_silver view which provides both prices in one row
        const { data, error } = await supabase
            .from("cms_v_market_tick_latest_gold_silver_v1")
            .select("gold_price_krw_per_g, silver_price_krw_per_g")
            .single();

        if (error) {
            console.error("Market ticks fetch error:", error);
            return NextResponse.json(
                { error: "Failed to fetch market ticks" },
                { status: 500 }
            );
        }

        const goldPrice = Number(data?.gold_price_krw_per_g ?? 0);
        const silverBasePrice = Number(data?.silver_price_krw_per_g ?? 0);
        const silverPrice = silverBasePrice * 1.2 * 0.925;

        // CN Silver (CS) tick (optional)
        const { data: csRow } = await supabase
            .from("cms_v_market_tick_latest_by_symbol_v1")
            .select("price_krw_per_g, meta")
            .eq("symbol", "SILVER_CN_KRW_PER_G")
            .maybeSingle();

        const csPriceRaw = (csRow as any)?.price_krw_per_g ?? null;
        const csPrice = csPriceRaw === null || csPriceRaw === undefined ? null : Number(csPriceRaw);
        const csMeta = ((csRow as any)?.meta ?? null) as CsMeta | null;
        const csNoCorrRaw = (csMeta as any)?.cs_no_corr_krw_per_g ?? null;
        const csNoCorr = csNoCorrRaw === null || csNoCorrRaw === undefined ? null : Number(csNoCorrRaw);

        // Backward compatible keys (gold/silver) + new keys (kg/ks/cs)
        return NextResponse.json({
            data: {
                // legacy
                gold: goldPrice,
                silver: silverPrice,
                silverOriginal: silverBasePrice,
                // new (requested)
                kg: goldPrice,
                ks: silverPrice,
                ksOriginal: silverBasePrice,
                cs: csPrice,
                csOriginal: csNoCorr,
            },
        });
    } catch (error) {
        console.error("Market ticks API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch market ticks" },
            { status: 500 }
        );
    }
}
