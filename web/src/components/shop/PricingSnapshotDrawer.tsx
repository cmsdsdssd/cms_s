"use client";

import { Sheet } from "@/components/ui/sheet";
import type { PricingSnapshotExplainRow } from "@/types/pricingSnapshot";

const fmt = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-";

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v))}`;

const REASON_CODE_LABELS: Record<string, string> = {
  COMPONENT_CANDIDATE_WIN: "후보가 경로 우선",
  MIN_MARGIN_WIN: "최소마진보장가 경로 우선",
  INVALID_PARAM_CLAMPED: "입력값 보정 후 가드레일 적용",
  UNKNOWN: "알 수 없음",
};

const LABOR_COMPONENT_ORDER = ["BASE_LABOR", "STONE_LABOR", "PLATING", "ETC", "DECOR"] as const;

const reasonCodeLabel = (code: string | null | undefined) => {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!normalized) return "미적용";
  return REASON_CODE_LABELS[normalized] ?? `UNKNOWN(${normalized})`;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PricingSnapshotExplainRow | null;
  loading: boolean;
  errorMessage: string | null;
  currentChannelPriceKrw?: number | null;
};

export function PricingSnapshotDrawer({
  open,
  onOpenChange,
  row,
  loading,
  errorMessage,
  currentChannelPriceKrw = null,
}: Props) {
  const computedAt = row?.computed_at ? new Date(row.computed_at).toLocaleString() : "-";
  const algoVersion = String(row?.pricing_algo_version ?? "V2").trim() || "V2";
  const isV2 = algoVersion.toUpperCase().includes("V2");
  const hasV2Trace = Boolean(
    row
    && (
      typeof row.candidate_price_krw === "number"
      || typeof row.min_margin_price_krw === "number"
      || typeof row.guardrail_price_krw === "number"
      || typeof row.final_target_price_v2_krw === "number"
    ),
  );

  const candidate = row?.candidate_price_krw ?? null;
  const minMargin = row?.min_margin_price_krw ?? null;
  const guardrail = row?.guardrail_price_krw ?? null;
  const finalV2 = row?.final_target_price_v2_krw ?? null;
  const finalLegacy = row?.final_target_price_krw ?? null;
  const finalShown = (isV2 && finalV2 != null) ? finalV2 : finalLegacy;
  const currentGap =
    typeof currentChannelPriceKrw === "number" && Number.isFinite(currentChannelPriceKrw)
    && typeof finalShown === "number" && Number.isFinite(finalShown)
      ? Math.round(finalShown - currentChannelPriceKrw)
      : null;

  const bindingPrice =
    typeof candidate === "number" && typeof minMargin === "number"
      ? Math.max(candidate, minMargin)
      : null;
  const bindingSource =
    typeof candidate === "number" && typeof minMargin === "number"
      ? (candidate >= minMargin ? "candidate" : "min_margin")
      : null;
  const laborComponents = LABOR_COMPONENT_ORDER
    .map((key) => ({ key, value: row?.labor_component_json?.[key] ?? null }))
    .filter((entry) => entry.value != null);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="게시 기준 계산 근거"
      side="right"
      className="w-full lg:w-[1380px]"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <div className="text-sm font-semibold">게시 기준 계산 근거</div>
        <div className="text-xs text-[var(--muted)]">이 화면은 게시 기준 가격의 계산 근거를 설명하는 디버그 뷰입니다. 운영 기준값은 publish/live 비교를 우선 보세요.</div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
          {loading ? <div className="text-[var(--muted)]">불러오는 중...</div> : null}
          {errorMessage ? <div className="text-red-600">{errorMessage}</div> : null}
          {!loading && !errorMessage && !row ? <div className="text-[var(--muted)]">표시할 스냅샷 데이터가 없습니다.</div> : null}

          {row ? (
            <>
              <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">Publish vs Live</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
                  <div>
                    <div className="text-[11px] text-[var(--muted)]">실몰 현재가(live)</div>
                    <div className="font-semibold">{fmt(currentChannelPriceKrw)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--muted)]">게시 목표가(publish)</div>
                    <div className="font-semibold">{fmt(finalShown)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--muted)]">게시-실몰 Δ</div>
                    <div className="font-semibold">{currentGap == null ? "-" : signed(currentGap)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--muted)]">알고리즘</div>
                    <div className="font-semibold">{algoVersion}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  debug: calc_version {row.calc_version ?? "-"} / guardrail 정책 max(후보가, 최소마진보장가) / floor 미사용
                </div>
              </section>

              <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">계산 trace (debug)</div>
                {isV2 && hasV2Trace ? (
                  <div className="grid grid-cols-[180px_1fr] gap-y-2">
                    <div className="text-[var(--muted)]">후보가</div>
                    <div className="font-semibold">
                      {fmt(candidate)}
                      <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">(수수료/마진 경로, pre-fee {fmt(row.candidate_pre_fee_krw)})</span>
                    </div>

                    <div className="text-[var(--muted)]">최소마진보장가</div>
                    <div className="font-semibold">{fmt(minMargin)} <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">(수수료+최소마진 조건)</span></div>

                    <div className="text-[var(--muted)]">가드레일 공식</div>
                    <div className="font-semibold">
                      max(후보가, 최소마진보장가) = {fmt(guardrail)}
                      <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">
                        ({bindingSource === "candidate" ? "후보가 선택" : bindingSource === "min_margin" ? "최소마진보장가 선택" : "-"})
                      </span>
                    </div>

                    <div className="text-[var(--muted)]">가드레일 사유</div>
                    <div className="font-semibold">{reasonCodeLabel(row.guardrail_reason_code)}</div>

                    <div className="text-[var(--muted)]">최종가</div>
                    <div className="font-semibold">{fmt(finalV2 ?? finalLegacy)} <span className="ml-2 text-[11px] font-normal text-[var(--muted)]">(V2 no-floor, guardrail 결과 반영)</span></div>
                  </div>
                ) : isV2 ? (
                  <div className="text-xs text-amber-700">
                    V2 알고리즘 스냅샷이지만 결정 trace 필드가 누락되어 guardrail 경로를 표시할 수 없습니다.
                  </div>
                ) : (
                  <div className="text-xs text-[var(--muted)]">
                    V2 trace 필드가 비어 있습니다.
                  </div>
                )}
                <div className="mt-2 text-xs text-[var(--muted)]">
                  guardrail check: max({fmt(candidate)}, {fmt(minMargin)}) = {fmt(bindingPrice)}
                </div>
              </section>

              {isV2 && laborComponents.length > 0 ? (
                <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                  <div className="mb-2 text-xs text-[var(--muted)]">노무 컴포넌트 상세 (debug)</div>
                  <div className="mb-2 grid grid-cols-2 gap-1 text-xs lg:grid-cols-4">
                    <div>총 absorb(applied)</div><div className="text-right font-semibold">{fmt(row.absorb_total_applied_krw)}</div>
                    <div>총 absorb(raw)</div><div className="text-right font-semibold">{fmt(row.absorb_total_raw_krw)}</div>
                    <div>총 labor_cost_applied</div><div className="text-right font-semibold">{fmt(row.labor_cost_applied_krw)}</div>
                    <div>총 labor_sell_plus_absorb</div><div className="text-right font-semibold">{fmt(row.labor_sell_total_plus_absorb_krw)}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--hairline)] text-[var(--muted)]">
                          <th className="px-2 py-1 text-left">컴포넌트</th>
                          <th className="px-2 py-1 text-right">labor_cost_krw</th>
                          <th className="px-2 py-1 text-right">labor_absorb_applied_krw</th>
                          <th className="px-2 py-1 text-right">labor_sell_plus_absorb_krw</th>
                        </tr>
                      </thead>
                      <tbody>
                        {laborComponents.map((entry) => (
                          <tr key={entry.key} className="border-b border-[var(--hairline)] last:border-0">
                            <td className="px-2 py-1 font-medium">{entry.key}</td>
                            <td className="px-2 py-1 text-right">{fmt(entry.value?.labor_cost_krw)}</td>
                            <td className="px-2 py-1 text-right">{fmt(entry.value?.labor_absorb_applied_krw)}</td>
                            <td className="px-2 py-1 text-right">{fmt(entry.value?.labor_sell_plus_absorb_krw)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <details className="rounded border border-[var(--hairline)] bg-[var(--background)] p-3" open>
                <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">Inputs (debug)</summary>
                <div className="mt-3 grid grid-cols-2 gap-1 lg:grid-cols-3">
                  <div>material_pre_fee</div><div className="text-right">{fmt(row.material_pre_fee_krw)}</div>
                  <div>labor_pre_fee</div><div className="text-right">{fmt(row.labor_pre_fee_krw)}</div>
                  <div>fixed_pre_fee</div><div className="text-right">{fmt(row.fixed_pre_fee_krw)}</div>
                  <div>cost_sum</div><div className="text-right">{fmt(row.cost_sum_krw)}</div>
                  <div>labor_cost_applied</div><div className="text-right">{fmt(row.labor_cost_applied_krw)}</div>
                  <div>labor_plus_absorb</div><div className="text-right">{fmt(row.labor_sell_total_plus_absorb_krw)}</div>
                  <div>material_basis</div><div className="text-right">{row.material_basis_resolved ?? "-"}</div>
                  <div>material_code</div><div className="text-right">{row.material_code_effective ?? "-"}</div>
                  <div>purity_rate</div><div className="text-right">{row.material_purity_rate_resolved == null ? "-" : row.material_purity_rate_resolved.toFixed(4)}</div>
                  <div>adjust_factor</div><div className="text-right">{row.material_adjust_factor_resolved == null ? "-" : row.material_adjust_factor_resolved.toFixed(4)}</div>
                  <div>effective_tick</div><div className="text-right">{fmt(row.effective_tick_krw_g)}</div>
                </div>
              </details>

              <section className="rounded border border-[var(--hairline)] bg-[var(--background)] p-3 text-xs">
                <div>Metadata (debug)</div>
                <div className="mt-1 text-[var(--muted)]">debug algo_version: {algoVersion}</div>
                <div className="text-[var(--muted)]">master_item_id: {row.master_item_id}</div>
                <div className="text-[var(--muted)]">channel_product_id: {row.channel_product_id}</div>
                <div className="text-[var(--muted)]">external_variant_code: {row.external_variant_code ?? "-"}</div>
                <div className="mt-1 text-[var(--muted)]">publish_version alias: {row.compute_request_id}</div>
                <div className="text-[var(--muted)]">computed_at: {computedAt}</div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
