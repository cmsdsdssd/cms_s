"use client";

import { Sheet } from "@/components/ui/sheet";
import type { PricingSnapshotExplainRow } from "@/types/pricingSnapshot";

const fmt = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-";

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${fmt(Math.abs(v))}`;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PricingSnapshotExplainRow | null;
  loading: boolean;
  errorMessage: string | null;
};

export function PricingSnapshotDrawer({
  open,
  onOpenChange,
  row,
  loading,
  errorMessage,
}: Props) {
  const computedAt = row?.computed_at ? new Date(row.computed_at).toLocaleString() : "-";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="스냅샷 계산식 설명" side="right">
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--hairline)] px-4 py-3">
          <div className="text-sm font-semibold">스냅샷 계산식 설명</div>
          <div className="text-xs text-[var(--muted)]">핀된 compute_request_id 기준 설명</div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
          {loading ? <div className="text-[var(--muted)]">불러오는 중...</div> : null}
          {errorMessage ? <div className="text-red-600">{errorMessage}</div> : null}
          {!loading && !errorMessage && !row ? <div className="text-[var(--muted)]">표시할 스냅샷 데이터가 없습니다.</div> : null}

          {row ? (
            <>
              <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">A. 원래 마스터가 -&gt; 마진 곱 -&gt; 기본 보정</div>
                <div>{fmt(row.master_base_price_krw)} x {row.shop_margin_multiplier.toFixed(4)} = {fmt(row.price_after_margin_krw)}</div>
                <div className="mt-1">기본 보정 Δ {signed(row.base_adjust_krw)}</div>
              </section>

              <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">B. 축별 delta</div>
                <div className="grid grid-cols-2 gap-1">
                  <div>소재</div><div className="text-right">{signed(row.delta_material_krw)}</div>
                  <div>사이즈</div><div className="text-right">{signed(row.delta_size_krw)}</div>
                  <div>색상/도금</div><div className="text-right">{signed(row.delta_color_krw)}</div>
                  <div>장식</div><div className="text-right">{signed(row.delta_decor_krw)}</div>
                  <div>기타</div><div className="text-right">{signed(row.delta_other_krw)}</div>
                  <div className="font-semibold">합계</div><div className="text-right font-semibold">{signed(row.delta_total_krw)}</div>
                </div>
              </section>

              <section className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                <div className="mb-2 text-xs text-[var(--muted)]">C. 최종 방정식</div>
                <div>
                  {fmt(row.price_after_margin_krw)} {row.base_adjust_krw >= 0 ? "+" : "-"} {fmt(Math.abs(row.base_adjust_krw))}
                  {" + "}{fmt(row.delta_total_krw)} = {fmt(row.final_target_price_krw)}
                </div>
              </section>

              <section className="rounded border border-[var(--hairline)] bg-[var(--background)] p-3 text-xs">
                <div>D. 메타데이터</div>
                <div className="mt-1 text-[var(--muted)]">compute_request_id: {row.compute_request_id}</div>
                <div className="text-[var(--muted)]">computed_at: {computedAt}</div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
