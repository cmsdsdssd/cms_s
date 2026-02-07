"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type StoneSource } from "@/lib/stone-source";

type StoneRole = "CENTER" | "SUB1" | "SUB2";

type EvidenceStoneRowInput = {
  role: StoneRole;
  supply: StoneSource | null;
  qtyReceipt?: number | null;
  qtyUsed?: number | null;
  qtySource?: "RECEIPT" | "ORDER" | null;
  qtyMaster?: number | null;
  unitSell?: number | null;
  unitCostMaster?: number | null;
  subtotalSell?: number | null;
  unitCostReceipt?: number | null;
  marginPerUnit?: number | null;
};

type ShipmentPricingEvidencePanelProps = {
  className?: string;
  baseLaborSellKrw?: number | null;
  factoryBasicCostKrw?: number | null;
  masterBaseSellKrw?: number | null;
  masterBaseCostKrw?: number | null;
  masterBaseMarginKrw?: number | null;
  baseCostSource: "receipt" | "match" | "none";
  baseMarginSource: "master" | "none";
  isBaseOverridden?: boolean;
  extraLaborSellKrw?: number | null;
  factoryOtherCostBaseKrw?: number | null;
  stoneRows: EvidenceStoneRowInput[];
  expectedBaseLaborSellKrw?: number | null;
  expectedExtraLaborSellKrw?: number | null;
  shipmentBaseLaborKrw?: number | null;
  receiptStoneOtherCostKrw?: number | null;
  recommendedStoneSellKrw?: number | null;
  finalStoneSellKrw?: number | null;
  stoneAdjustmentKrw?: number | null;
  stoneQtyDeltaTotal?: number | null;
  isVariationMode?: boolean;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const sourceLabel = (source: "receipt" | "match" | "none") => {
  if (source === "receipt") return "영수증";
  if (source === "match") return "매칭";
  return "-";
};

const stoneSourceLabel = (source: StoneSource | null) => {
  if (source === "SELF") return "자입";
  if (source === "PROVIDED") return "타입";
  if (source === "FACTORY") return "공입";
  return "-";
};

function ThreeColumnEvidenceRow({
  total,
  receiptCost,
  masterSellCost,
  receiptSub,
  masterSub,
}: {
  total: string;
  receiptCost: string;
  masterSellCost: string;
  receiptSub?: string;
  masterSub?: string;
}) {
  return (
    <div>
      <table className="w-full text-xs rounded border border-[var(--panel-border)] bg-[var(--surface)]">
        <thead className="text-[var(--muted)] bg-[var(--panel)]">
          <tr>
            <th className="px-3 py-2 text-left">총액</th>
            <th className="px-3 py-2 text-left">영수증 원가</th>
            <th className="px-3 py-2 text-left">마스터 판매가/원가</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--panel-border)]">
            <td className="px-3 py-2 font-semibold tabular-nums">{total}</td>
            <td className="px-3 py-2">
              <div className="font-semibold tabular-nums">{receiptCost}</div>
              {receiptSub ? <div className="text-[10px] text-[var(--muted)]">{receiptSub}</div> : null}
            </td>
            <td className="px-3 py-2">
              <div className="font-semibold tabular-nums">{masterSellCost}</div>
              {masterSub ? <div className="text-[10px] text-[var(--muted)]">{masterSub}</div> : null}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ShipmentPricingEvidencePanel({
  className,
  baseLaborSellKrw,
  factoryBasicCostKrw,
  masterBaseSellKrw,
  masterBaseCostKrw,
  masterBaseMarginKrw,
  baseCostSource,
  isBaseOverridden,
  extraLaborSellKrw,
  factoryOtherCostBaseKrw,
  stoneRows,
  shipmentBaseLaborKrw,
  receiptStoneOtherCostKrw,
  recommendedStoneSellKrw,
  finalStoneSellKrw,
  stoneAdjustmentKrw,
  stoneQtyDeltaTotal,
  isVariationMode,
}: ShipmentPricingEvidencePanelProps) {
  const computedBaseMargin =
    masterBaseSellKrw !== null &&
    masterBaseSellKrw !== undefined &&
    masterBaseCostKrw !== null &&
    masterBaseCostKrw !== undefined
      ? masterBaseSellKrw - masterBaseCostKrw
      : (masterBaseMarginKrw ?? null);

  const displayedBaseSell = baseLaborSellKrw ?? shipmentBaseLaborKrw ?? null;

  const receiptStoneCostTotal = useMemo(
    () =>
      stoneRows.reduce((sum, row) => {
        const qty = row.qtyReceipt ?? 0;
        const unit = row.unitCostReceipt ?? 0;
        return sum + Math.max(qty, 0) * Math.max(unit, 0);
      }, 0),
    [stoneRows]
  );

  const receiptExtraCostTotal = Math.max(factoryOtherCostBaseKrw ?? 0, 0) + Math.max(receiptStoneCostTotal, 0);

  const masterStoneSellTotal = useMemo(
    () => stoneRows.reduce((sum, row) => sum + Math.max(row.qtyMaster ?? 0, 0) * Math.max(row.unitSell ?? 0, 0), 0),
    [stoneRows]
  );

  const masterStoneCostTotal = useMemo(
    () => stoneRows.reduce((sum, row) => sum + Math.max(row.qtyMaster ?? 0, 0) * Math.max(row.unitCostMaster ?? 0, 0), 0),
    [stoneRows]
  );

  const masterExtraMarginTotal = useMemo(() => {
    if (extraLaborSellKrw === null || extraLaborSellKrw === undefined) return null;
    return extraLaborSellKrw - receiptExtraCostTotal;
  }, [extraLaborSellKrw, receiptExtraCostTotal]);

  const stoneDeltaFromRecommended =
    finalStoneSellKrw === null || finalStoneSellKrw === undefined || recommendedStoneSellKrw === null || recommendedStoneSellKrw === undefined
      ? null
      : finalStoneSellKrw - recommendedStoneSellKrw;

  const stoneDeltaFromReceiptCost =
    finalStoneSellKrw === null || finalStoneSellKrw === undefined
      ? null
      : finalStoneSellKrw - receiptStoneCostTotal;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 min-w-0">
        <Card>
          <CardHeader className="py-2 px-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">기본공임 계산근거</span>
              {isBaseOverridden ? (
                <Badge tone="warning" className="text-[10px]">오버라이드</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardBody className="p-3">
            <ThreeColumnEvidenceRow
              total={formatKrw(displayedBaseSell)}
              receiptCost={formatKrw(factoryBasicCostKrw)}
              masterSellCost={`${formatKrw(masterBaseSellKrw)} / ${formatKrw(masterBaseCostKrw)}`}
              receiptSub={`소스: ${sourceLabel(baseCostSource)}`}
              masterSub={`마스터마진: ${formatKrw(computedBaseMargin)}`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3 border-b border-[var(--panel-border)]">
            <span className="text-xs font-semibold">보석/기타공임 계산근거 (v3 evidence)</span>
          </CardHeader>
          <CardBody className="p-3 space-y-3 min-w-0">
            <ThreeColumnEvidenceRow
              total={formatKrw(extraLaborSellKrw ?? null)}
              receiptCost={formatKrw(receiptStoneCostTotal)}
              masterSellCost={`${formatKrw(masterStoneSellTotal)} / ${formatKrw(masterStoneCostTotal)}`}
              receiptSub="영수증 원가(각 스톤 개수 x 영수증단가)"
              masterSub={`추천기준 마진(참고): ${formatKrw(masterExtraMarginTotal)}`}
            />

            <div className="rounded-md border border-[var(--panel-border)]">
              <table className="w-full text-xs table-fixed">
                <colgroup>
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "48%" }} />
                </colgroup>
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-1 text-left">보석</th>
                    <th className="px-2 py-1 text-left">공급구분</th>
                    <th className="px-2 py-1 text-left">수량(마스터/영수증)</th>
                    <th className="px-2 py-1 text-left">소계(추천/마스터판매/원가/영수증)</th>
                    <th className="px-2 py-1 text-left">단가(마스터판매/원가/영수증)</th>
                  </tr>
                </thead>
                <tbody>
                  {stoneRows.map((stone) => (
                    <tr key={stone.role} className="border-t border-[var(--panel-border)]">
                      <td className="px-2 py-1">{stone.role}</td>
                      <td className="px-2 py-1">{stoneSourceLabel(stone.supply)}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {stone.qtyMaster ?? "-"} / {stone.qtyReceipt ?? "-"}
                      </td>
                      <td className="px-2 py-1 tabular-nums text-right whitespace-nowrap">
                        <span className="font-extrabold text-[var(--foreground)]">{formatKrw(stone.subtotalSell ?? null)}</span>
                        <span className="px-1 text-[var(--muted)]"> | </span>
                        <span>{formatKrw((stone.qtyMaster ?? 0) * (stone.unitSell ?? 0))}</span>
                        <span className="px-1 text-[var(--muted)]"> | </span>
                        <span>{formatKrw((stone.qtyMaster ?? 0) * (stone.unitCostMaster ?? 0))}</span>
                        <span className="px-1 text-[var(--muted)]"> | </span>
                        <span>{formatKrw((stone.qtyReceipt ?? 0) * (stone.unitCostReceipt ?? 0))}</span>
                      </td>
                      <td className="px-2 py-1 tabular-nums text-right whitespace-nowrap">
                        <span>{formatKrw(stone.unitSell ?? null)}</span>
                        <span className="px-1 text-[var(--muted)]"> | </span>
                        <span>{formatKrw(stone.unitCostMaster ?? null)}</span>
                        <span className="px-1 text-[var(--muted)]"> | </span>
                        <span>{formatKrw(stone.unitCostReceipt ?? null)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">출고영수증 원가(비교용)</span>
                <span className="font-semibold tabular-nums">{formatKrw(receiptStoneCostTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">마스터 판매가 합계(기준개수)</span>
                <span className="font-semibold tabular-nums">{formatKrw(masterStoneSellTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">마스터 원가 합계(기준개수)</span>
                <span className="font-semibold tabular-nums">{formatKrw(masterStoneCostTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">추천 알공임(마스터 기준)</span>
                <span className="font-semibold tabular-nums">{formatKrw(recommendedStoneSellKrw ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">최종 알공임</span>
                <span className="font-semibold tabular-nums">{formatKrw(finalStoneSellKrw ?? null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">추천 대비 Δ</span>
                <span className="font-semibold tabular-nums">{formatKrw(stoneDeltaFromRecommended)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">영수증 원가 대비 Δ</span>
                <span className="font-semibold tabular-nums">{formatKrw(stoneDeltaFromReceiptCost)}</span>
              </div>
              {stoneAdjustmentKrw !== null && stoneAdjustmentKrw !== undefined ? (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">조정(±)</span>
                  <span className="font-semibold tabular-nums">{formatKrw(stoneAdjustmentKrw)}</span>
                </div>
              ) : null}
              {stoneQtyDeltaTotal !== null && stoneQtyDeltaTotal !== undefined && stoneQtyDeltaTotal !== 0 ? (
                <div className="text-amber-700">
                  마스터 개수와 영수증 개수가 다릅니다 (Δ {stoneQtyDeltaTotal}).
                  {isVariationMode ? " 변형이므로 자동추천 비활성." : " 공장 오차/사이즈 차이 가능."}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
