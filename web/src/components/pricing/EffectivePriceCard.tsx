"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EffectivePriceResponse = {
  pricing_method?: string | null;
  ok?: boolean | null;
  error_message?: string | null;
  unit_total_sell_krw?: number | null;
  unit_total_cost_krw?: number | null;
  total_total_sell_krw?: number | null;
  total_total_cost_krw?: number | null;
  breakdown?: Array<Record<string, unknown>> | null;
};

type EffectivePriceCardProps = {
  masterId: string;
  qty?: number;
  variantKey?: string | null;
  title?: string;
  showBreakdown?: boolean;
  compact?: boolean;
  onDataChange?: (data: EffectivePriceResponse | null) => void;
  onStateChange?: (state: {
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
  }) => void;
};

const KRW = new Intl.NumberFormat("ko-KR");

function formatKrw(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${KRW.format(Math.round(value))}`;
}

function formatG(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 3 })} g`;
}

function toLabel(key: string) {
  const labelMap: Record<string, string> = {
    component_ref_type: "타입",
    component_master_model_name: "마스터",
    component_part_name: "파트",
    qty_per_product_unit: "단위수량",
    qty_per_unit: "수량",
    qty: "수량",
    unit: "단위",
    unit_sell_krw: "단가(판매)",
    unit_cost_krw: "단가(원가)",
    total_sell_krw: "합계(판매)",
    total_cost_krw: "합계(원가)",
    depth: "깊이",
    path: "경로",
  };
  return labelMap[key] ?? key;
}

function renderValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    if (key.includes("_krw")) return formatKrw(value);
    if (key.endsWith("_g")) return formatG(value);
    return value.toLocaleString("ko-KR");
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function EffectivePriceCard({
  masterId,
  qty = 1,
  variantKey = null,
  title = "유효가격",
  showBreakdown = true,
  compact = false,
  onDataChange,
  onStateChange,
}: EffectivePriceCardProps) {
  const effectivePriceQuery = useQuery({
    queryKey: ["effective-price", masterId, qty, variantKey],
    enabled: Boolean(masterId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("master_id", masterId);
      params.set("qty", String(qty));
      if (variantKey) params.set("variant_key", variantKey);

      const response = await fetch(`/api/master-effective-price?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | EffectivePriceResponse
        | EffectivePriceResponse[]
        | { error?: string };
      const normalized = Array.isArray(payload) ? (payload[0] ?? null) : payload;
      if (!response.ok) {
        throw new Error((normalized as { error?: string } | null)?.error ?? "유효가격 조회 실패");
      }
      return (normalized ?? null) as EffectivePriceResponse | null;
    },
  });

  useEffect(() => {
    onDataChange?.(effectivePriceQuery.data ?? null);
  }, [effectivePriceQuery.data, onDataChange]);

  useEffect(() => {
    onStateChange?.({
      isLoading: effectivePriceQuery.isLoading,
      isError: effectivePriceQuery.isError,
      errorMessage: effectivePriceQuery.isError
        ? ((effectivePriceQuery.error as Error)?.message ?? "유효가격 조회 실패")
        : null,
    });
  }, [effectivePriceQuery.error, effectivePriceQuery.isError, effectivePriceQuery.isLoading, onStateChange]);

  const breakdownRows = useMemo(() => {
    const rows = effectivePriceQuery.data?.breakdown;
    if (!Array.isArray(rows)) return [];
    return rows;
  }, [effectivePriceQuery.data?.breakdown]);

  const breakdownColumns = useMemo(() => {
    if (breakdownRows.length === 0) return [] as string[];
    const preferredOrder = [
      "component_ref_type",
      "component_master_model_name",
      "component_part_name",
      "qty_per_product_unit",
      "qty_per_unit",
      "qty",
      "unit",
      "unit_sell_krw",
      "unit_cost_krw",
      "total_sell_krw",
      "total_cost_krw",
      "depth",
      "path",
    ];
    const allKeys = new Set<string>();
    breakdownRows.forEach((row) => Object.keys(row).forEach((key) => allKeys.add(key)));
    const preferredColumns = preferredOrder.filter((key) => allKeys.has(key));
    if (preferredColumns.length > 0) return preferredColumns;
    return Array.from(allKeys.values());
  }, [breakdownRows]);

  const data = effectivePriceQuery.data;
  const isBundleRollup = data?.pricing_method === "BUNDLE_ROLLUP";

  return (
    <Card>
      <CardHeader className={cn("flex items-center justify-between", compact && "px-4 py-3")}>
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          {data?.pricing_method ? <Badge tone="neutral">{data.pricing_method}</Badge> : null}
          {data?.ok === false ? (
            <Badge tone="danger">BOM 오류</Badge>
          ) : data?.ok === true ? (
            <Badge tone="active">정상</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody className={cn("space-y-3", compact && "px-4 py-4")}>
        {effectivePriceQuery.isLoading ? (
          <div className="text-sm text-[var(--muted)]">유효가격 계산 중...</div>
        ) : effectivePriceQuery.isError ? (
          <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {(effectivePriceQuery.error as Error)?.message ?? "유효가격 조회 실패"}
          </div>
        ) : !data ? (
          <div className="text-sm text-[var(--muted)]">유효가격 데이터가 없습니다.</div>
        ) : (
          <>
            {data.ok === false ? (
              <div className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {data.error_message ?? "BOM 계산 오류"}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                <div className="text-[10px] text-[var(--muted)]">단위 판매가</div>
                <div className="text-sm font-semibold tabular-nums">{formatKrw(data.unit_total_sell_krw)}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                <div className="text-[10px] text-[var(--muted)]">단위 원가</div>
                <div className="text-sm font-semibold tabular-nums">{formatKrw(data.unit_total_cost_krw)}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                <div className="text-[10px] text-[var(--muted)]">총 판매가</div>
                <div className="text-sm font-semibold tabular-nums">{formatKrw(data.total_total_sell_krw)}</div>
              </div>
              <div className="rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                <div className="text-[10px] text-[var(--muted)]">총 원가</div>
                <div className="text-sm font-semibold tabular-nums">{formatKrw(data.total_total_cost_krw)}</div>
              </div>
            </div>

            {showBreakdown && isBundleRollup ? (
              breakdownRows.length === 0 ? (
                <div className="text-xs text-[var(--muted)]">breakdown 데이터가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto rounded-[10px] border border-[var(--panel-border)]">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-[var(--subtle-bg)] text-[var(--muted)]">
                      <tr>
                        {breakdownColumns.map((column) => (
                          <th key={column} className="px-3 py-2 font-semibold">
                            {toLabel(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownRows.map((row, idx) => (
                        <tr key={`breakdown-${idx}`} className="border-t border-[var(--panel-border)]">
                          {breakdownColumns.map((column) => (
                            <td key={`${idx}-${column}`} className="px-3 py-2 whitespace-nowrap">
                              {renderValue(column, row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
