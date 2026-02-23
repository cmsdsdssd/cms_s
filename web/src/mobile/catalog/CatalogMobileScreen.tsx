"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { NumberText } from "@/components/ui/number-text";
import { Sheet } from "@/components/ui/sheet";
import { MobilePage } from "@/mobile/shared/MobilePage";
import { cn } from "@/lib/utils";

type CatalogRow = {
  master_id?: string;
  model_name?: string;
  image_url?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  material_price?: number | null;
  weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  labor_total_sell?: number | null;
  labor_base_sell?: number | null;
  labor_center_sell?: number | null;
  labor_sub1_sell?: number | null;
  labor_sub2_sell?: number | null;
  plating_price_sell_default?: number | null;
  deduction_weight_default_g?: number | null;
};

type MasterAbsorbLaborItem = {
  absorb_item_id?: string;
  bucket?: "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
  reason?: string | null;
  amount_krw?: number | null;
  is_active?: boolean | null;
};

type MarketTicksPayload = {
  data?: {
    gold?: number | null;
    silver?: number | null;
  };
};

const PAGE_SIZE = 20;

const CATEGORY_LABEL_MAP: Record<string, string> = {
  RING: "반지",
  NECKLACE: "목걸이",
  BRACELET: "팔찌",
  EARRING: "귀걸이",
  PENDANT: "펜던트",
  BROOCH: "브로치",
};

function getPurityRate(materialCode: string) {
  if (materialCode === "14") return 0.585;
  if (materialCode === "18") return 0.75;
  if (materialCode === "24") return 0.999;
  if (materialCode === "925") return 0.925;
  if (materialCode === "999") return 0.999;
  return 1;
}

function getMaterialBgColor(materialCode: string) {
  if (materialCode === "925") return "bg-gradient-to-br from-[var(--panel)] to-[var(--panel-hover)]";
  if (materialCode === "14" || materialCode === "18") return "bg-gradient-to-br from-[var(--danger-soft)] to-[var(--panel)]";
  if (materialCode === "24") return "bg-gradient-to-br from-[var(--warning-soft)] to-[var(--panel)]";
  return "bg-[var(--panel)]";
}

function getMaterialChipColorClass(materialCode: string) {
  if (materialCode === "925") return "bg-slate-200 text-slate-800";
  if (materialCode === "14") return "bg-amber-100 text-amber-900";
  if (materialCode === "18") return "bg-yellow-100 text-yellow-900";
  if (materialCode === "24") return "bg-orange-100 text-orange-900";
  return "bg-[var(--chip)] text-[var(--muted)]";
}

export function CatalogMobileScreen() {
  const [keyword, setKeyword] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const query = useQuery({
    queryKey: ["cms", "catalog_mobile"],
    queryFn: async () => {
      const response = await fetch("/api/master-items", { cache: "no-store" });
      const json = (await response.json()) as { data?: CatalogRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "카탈로그 조회 실패");
      return json.data ?? [];
    },
  });

  const marketTicksQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_market_ticks"],
    queryFn: async () => {
      const response = await fetch("/api/market-ticks", { cache: "no-store" });
      const json = (await response.json()) as MarketTicksPayload & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "시세 조회 실패");
      return json.data ?? {};
    },
  });

  const absorbLaborItemsQuery = useQuery({
    queryKey: ["cms", "catalog_mobile_absorb_labor", selected?.master_id ?? ""],
    enabled: Boolean(selected?.master_id),
    queryFn: async () => {
      const targetMasterId = String(selected?.master_id ?? "").trim();
      if (!targetMasterId) return [] as MasterAbsorbLaborItem[];
      const response = await fetch(`/api/master-absorb-labor-items?master_id=${encodeURIComponent(targetMasterId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "공임항목 조회 실패");
      return json.data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    const base = query.data ?? [];
    if (!k) return base;
    return base.filter((row) => String(row.model_name ?? "").toLowerCase().includes(k));
  }, [query.data, keyword]);

  const pageItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const detailSummary = useMemo(() => {
    if (!selected) {
      return {
        totalSell: 0,
        laborTotalSell: 0,
        netWeight: 0,
        materialPrice: 0,
        marketPrice: 0,
      };
    }

    const materialCode = String(selected.material_code_default ?? "").trim();
    const isSilver = materialCode === "925" || materialCode === "999";
    const marketPrice = Math.ceil(
      Number(isSilver ? marketTicksQuery.data?.silver : marketTicksQuery.data?.gold) || 0
    );
    const grossWeight = Number(selected.weight_default_g ?? 0);
    const deductionWeight = Number(selected.deduction_weight_default_g ?? 0);
    const netWeight = Math.max(0, grossWeight - deductionWeight);
    const purityRate = materialCode === "14"
      ? 0.585
      : materialCode === "18"
        ? 0.75
        : materialCode === "24"
          ? 0.999
          : materialCode === "925"
            ? 0.925
            : materialCode === "999"
              ? 0.999
              : 1;

    const computedMaterialPrice = Math.ceil(netWeight * marketPrice * purityRate);
    const materialPrice = Number(selected.material_price ?? 0) > 0
      ? Number(selected.material_price ?? 0)
      : computedMaterialPrice;

    const baseLabor = Number(selected.labor_base_sell ?? 0);
    const centerLabor = Number(selected.labor_center_sell ?? 0) * Number(selected.center_qty_default ?? 0);
    const sub1Labor = Number(selected.labor_sub1_sell ?? 0) * Number(selected.sub1_qty_default ?? 0);
    const sub2Labor = Number(selected.labor_sub2_sell ?? 0) * Number(selected.sub2_qty_default ?? 0);
    const platingLabor = Number(selected.plating_price_sell_default ?? 0);

    const absorbEtc = (absorbLaborItemsQuery.data ?? [])
      .filter((item) => item.is_active !== false)
      .reduce((sum, item) => sum + Number(item.amount_krw ?? 0), 0);

    const laborTotalSell = Number(selected.labor_total_sell ?? 0) > 0
      ? Number(selected.labor_total_sell ?? 0)
      : baseLabor + centerLabor + sub1Labor + sub2Labor + platingLabor + absorbEtc;

    return {
      totalSell: materialPrice + laborTotalSell,
      laborTotalSell,
      netWeight,
      materialPrice,
      marketPrice,
    };
  }, [selected, marketTicksQuery.data, absorbLaborItemsQuery.data]);

  const detailLaborRows = useMemo(() => {
    if (!selected) return [] as Array<{ key: string; label: string; amount: number }>;

    const rows: Array<{ key: string; label: string; amount: number }> = [
      { key: "base", label: "기본공임", amount: Number(selected.labor_base_sell ?? 0) },
      {
        key: "center",
        label: "중심공임",
        amount: Number(selected.labor_center_sell ?? 0) * Number(selected.center_qty_default ?? 0),
      },
      {
        key: "sub1",
        label: "보조1공임",
        amount: Number(selected.labor_sub1_sell ?? 0) * Number(selected.sub1_qty_default ?? 0),
      },
      {
        key: "sub2",
        label: "보조2공임",
        amount: Number(selected.labor_sub2_sell ?? 0) * Number(selected.sub2_qty_default ?? 0),
      },
      { key: "plating", label: "도금공임", amount: Number(selected.plating_price_sell_default ?? 0) },
    ];

    (absorbLaborItemsQuery.data ?? [])
      .filter((item) => item.is_active !== false)
      .forEach((item) => {
        const reason = String(item.reason ?? "").trim();
        const bucket = String(item.bucket ?? "ETC").trim();
        const label = reason || `${bucket} 항목`;
        rows.push({
          key: String(item.absorb_item_id ?? `${bucket}-${label}`),
          label,
          amount: Number(item.amount_krw ?? 0),
        });
      });

    return rows.filter((row) => row.amount !== 0);
  }, [selected, absorbLaborItemsQuery.data]);

  return (
    <MobilePage title="카탈로그" subtitle="웹 갤러리 스타일 · 2열 고정">
      <Input
        placeholder="모델명 검색"
        value={keyword}
        onChange={(event) => {
          setKeyword(event.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        {pageItems.map((item, index) => (
          (() => {
            const materialCode = String(item.material_code_default ?? "").trim() || "00";
            const categoryCode = String(item.category_code ?? "").trim().toUpperCase();
            const categoryLabel = CATEGORY_LABEL_MAP[categoryCode] ?? (categoryCode || "기타");
            const materialLabel = materialCode || "-";
            const grossWeight = Number(item.weight_default_g ?? 0);
            const deductionWeight = Number(item.deduction_weight_default_g ?? 0);
            const netWeight = Math.max(0, grossWeight - deductionWeight);
            const isSilver = materialCode === "925" || materialCode === "999";
            const marketPrice = Math.ceil(Number(isSilver ? marketTicksQuery.data?.silver : marketTicksQuery.data?.gold) || 0);
            const materialPriceComputed = Math.ceil(netWeight * marketPrice * getPurityRate(materialCode));
            const materialPrice = Number(item.material_price ?? 0) > 0 ? Number(item.material_price ?? 0) : materialPriceComputed;
            const laborSell = Number(item.labor_total_sell ?? item.labor_base_sell ?? 0);
            const totalSell = materialPrice + laborSell;

            return (
              <button
                key={String(item.master_id ?? item.model_name ?? `row-${index}`)}
                type="button"
                className={cn(
                  "group relative overflow-hidden rounded-[16px] border border-[var(--panel-border)] bg-[var(--panel)] text-left transition-all hover:ring-2 hover:ring-[var(--primary)]",
                  getMaterialBgColor(materialCode)
                )}
                onClick={() => setSelected(item)}
              >
                <div className="relative aspect-square w-full bg-[var(--white)] dark:bg-[var(--black)]">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.model_name ?? "catalog-item"}
                      className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--subtle-bg)] text-[var(--muted)]">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--panel-border)] bg-[var(--panel)] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-semibold text-[var(--foreground)]">{item.model_name ?? "-"}</div>
                    <div className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted)]">
                      <span className={cn("rounded px-1.5 py-0.5", getMaterialChipColorClass(materialCode))}>{materialLabel}</span>
                      <span className="rounded bg-[var(--chip)] px-1.5 py-0.5">{categoryLabel}</span>
                    </div>
                  </div>

                  <div className="mt-1 space-y-1 text-[11px] text-[var(--foreground)]" style={{ fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
                    <div className="rounded border border-green-400 bg-[var(--primary-soft)] px-2 py-1.5">
                      <div className="text-[10px] text-[var(--muted)]">총가격(판매)</div>
                      <div className="text-right text-sm font-extrabold tabular-nums">
                        <NumberText value={totalSell} /> 원
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-1">
                        <div className="text-[10px] font-semibold text-[var(--muted)]">총공임(판매)</div>
                        <div className="text-right font-bold tabular-nums">
                          <NumberText value={laborSell} /> 원
                        </div>
                      </div>
                      <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)] px-2 py-1">
                        <div className="text-[10px] font-semibold text-[var(--muted)]">총중량</div>
                        <div className="text-right font-bold tabular-nums">
                          <NumberText value={netWeight} /> g
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })()
        ))}
      </div>

      {visibleCount < filtered.length ? (
        <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
          더보기 ({filtered.length - visibleCount})
        </Button>
      ) : null}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title="상품 상세">
        <div className="flex h-full flex-col p-4">
          {selected ? (
            <>
              <div className="aspect-square w-full overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[var(--subtle-bg)]">
                {selected.image_url ? (
                  <img src={selected.image_url} alt={selected.model_name ?? "catalog-item"} className="h-full w-full object-contain" />
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-xs text-[var(--muted)]">총가격(판매)</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-[var(--foreground)]">
                    <NumberText value={detailSummary.totalSell} />원
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">총공임(판매)</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.laborTotalSell} />원
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">총중량</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.netWeight} />g
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">소재가격</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.materialPrice} />원
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                    <div className="text-xs text-[var(--muted)]">시세</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      <NumberText value={detailSummary.marketPrice} />원/g
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                  <div className="mb-2 text-xs font-semibold text-[var(--muted)]">공임항목</div>
                  <div className="space-y-1.5">
                    {detailLaborRows.length === 0 ? (
                      <div className="text-xs text-[var(--muted)]">표시할 공임항목이 없습니다.</div>
                    ) : (
                      detailLaborRows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between rounded-md bg-[var(--chip)] px-2 py-1.5 text-xs">
                          <span className="text-[var(--foreground)]">{row.label}</span>
                          <span className="tabular-nums font-semibold text-[var(--foreground)]">
                            <NumberText value={row.amount} />원
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <Button variant="secondary" onClick={() => setSelected(null)}>닫기</Button>
                <Link href="/catalog">
                  <Button className="w-full">상세 편집 이동</Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </MobilePage>
  );
}
