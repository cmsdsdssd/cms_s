"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type StoneSource } from "@/lib/stone-source";

type StoneRole = "CENTER" | "SUB1" | "SUB2";

type EvidenceStoneRowInput = {
  role: StoneRole;
  supply: StoneSource | null;
  qtyReceipt?: number | null;
  qtyUsed?: number | null;
  qtySource?: "RECEIPT" | "INVENTORY" | "ORDER" | null;
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
  isInventorySource?: boolean;
  absorbBaseLaborKrw?: number | null;
  absorbStoneCenterKrw?: number | null;
  absorbStoneSub1Krw?: number | null;
  absorbStoneSub2Krw?: number | null;
  absorbPlatingKrw?: number | null;
  absorbEtcKrw?: number | null;
  absorbDecorKrw?: number | null;
  absorbOtherKrw?: number | null;
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

const stoneRoleLabel = (role: StoneRole) => {
  if (role === "CENTER") return "메인";
  if (role === "SUB1") return "보조1";
  return "보조2";
};

const deltaToneClass = (value: number) => {
  if (value > 0) return "text-amber-700";
  if (value < 0) return "text-sky-700";
  return "text-[var(--muted)]";
};

function ThreeColumnEvidenceRow({
  total,
  sourceCost,
  masterSellCost,
  sourceSub,
  masterSub,
  sourceLabel,
}: {
  total: string;
  sourceCost: string;
  masterSellCost: string;
  sourceSub?: string;
  masterSub?: string;
  sourceLabel: string;
}) {
  return (
    <div>
      <table className="w-full text-xs rounded border border-[var(--panel-border)] bg-[var(--surface)]">
        <thead className="text-[var(--muted)] bg-[var(--panel)]">
          <tr>
            <th className="px-3 py-2 text-left">총액</th>
            <th className="px-3 py-2 text-left">{sourceLabel} 원가</th>
            <th className="px-3 py-2 text-left">마스터 판매가/원가</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--panel-border)]">
            <td className="px-3 py-2 font-semibold tabular-nums">{total}</td>
            <td className="px-3 py-2">
              <div className="font-semibold tabular-nums">{sourceCost}</div>
              {sourceSub ? <div className="text-[10px] text-[var(--muted)]">{sourceSub}</div> : null}
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
  finalStoneSellKrw,
  stoneAdjustmentKrw,
  isInventorySource = false,
  absorbBaseLaborKrw,
  absorbStoneCenterKrw,
  absorbStoneSub1Krw,
  absorbStoneSub2Krw,
  absorbPlatingKrw,
  absorbEtcKrw,
  absorbDecorKrw,
  absorbOtherKrw,
}: ShipmentPricingEvidencePanelProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isStoneDetailOpen, setIsStoneDetailOpen] = useState(false);

  const absorbBase = Math.max(Number(absorbBaseLaborKrw ?? 0), 0);
  const absorbStoneCenter = Math.max(Number(absorbStoneCenterKrw ?? 0), 0);
  const absorbStoneSub1 = Math.max(Number(absorbStoneSub1Krw ?? 0), 0);
  const absorbStoneSub2 = Math.max(Number(absorbStoneSub2Krw ?? 0), 0);
  const absorbPlating = Math.max(Number(absorbPlatingKrw ?? 0), 0);
  const absorbEtc = Math.max(Number(absorbEtcKrw ?? 0), 0);
  const absorbDecor = Math.max(Number(absorbDecorKrw ?? 0), 0);
  const absorbOther = Math.max(Number(absorbOtherKrw ?? 0), 0);

  const computedBaseMarginRaw =
    masterBaseSellKrw !== null &&
    masterBaseSellKrw !== undefined &&
    masterBaseCostKrw !== null &&
    masterBaseCostKrw !== undefined
      ? masterBaseSellKrw - masterBaseCostKrw
      : (masterBaseMarginKrw ?? null);

  const computedBaseMargin =
    computedBaseMarginRaw === null || computedBaseMarginRaw === undefined
      ? null
      : computedBaseMarginRaw + absorbBase;

  const masterBaseSellWithAbsorb =
    masterBaseSellKrw === null || masterBaseSellKrw === undefined
      ? (absorbBase > 0 ? absorbBase : null)
      : masterBaseSellKrw + absorbBase;

  const displayedBaseSell = baseLaborSellKrw ?? shipmentBaseLaborKrw ?? null;
  const qtyBasisLabel = isInventorySource ? "재고" : "영수증";

  const receiptStoneCostTotal = useMemo(
    () =>
      stoneRows.reduce((sum, row) => {
        const qty = row.qtyReceipt ?? 0;
        const unit = row.unitCostReceipt ?? 0;
        return sum + Math.max(qty, 0) * Math.max(unit, 0);
      }, 0),
    [stoneRows]
  );

  const masterStoneSellTotal = useMemo(
    () => stoneRows.reduce((sum, row) => sum + Math.max(row.qtyMaster ?? 0, 0) * Math.max(row.unitSell ?? 0, 0), 0),
    [stoneRows]
  );

  const masterStoneSellTotalWithAbsorb =
    masterStoneSellTotal + absorbStoneCenter + absorbStoneSub1 + absorbStoneSub2;

  const masterStoneCostTotal = useMemo(
    () => stoneRows.reduce((sum, row) => sum + Math.max(row.qtyMaster ?? 0, 0) * Math.max(row.unitCostMaster ?? 0, 0), 0),
    [stoneRows]
  );

  const recommendedByReceiptQtyTotal = useMemo(
    () => stoneRows.reduce((sum, row) => sum + Math.max(row.qtyReceipt ?? 0, 0) * Math.max(row.unitSell ?? 0, 0), 0),
    [stoneRows]
  );

  const stoneDeltaFromReceiptCost =
    finalStoneSellKrw === null || finalStoneSellKrw === undefined
      ? null
      : finalStoneSellKrw - receiptStoneCostTotal;

  const baseCostMismatch =
    factoryBasicCostKrw !== null &&
    factoryBasicCostKrw !== undefined &&
    masterBaseCostKrw !== null &&
    masterBaseCostKrw !== undefined &&
    Math.round(factoryBasicCostKrw) !== Math.round(masterBaseCostKrw);

  const extraCostMismatch = Math.round(receiptStoneCostTotal) !== Math.round(masterStoneCostTotal);

  const receiptSellMargin =
    finalStoneSellKrw === null || finalStoneSellKrw === undefined
      ? null
      : finalStoneSellKrw - receiptStoneCostTotal;

  const masterSellMargin = masterStoneSellTotalWithAbsorb - masterStoneCostTotal;

  const pricingJustificationRows = useMemo(
    () =>
      stoneRows.map((stone) => {
        const qtyReceipt = Math.max(stone.qtyReceipt ?? 0, 0);
        const qtyMaster = Math.max(stone.qtyMaster ?? 0, 0);
        const unitSell = Math.max(stone.unitSell ?? 0, 0);
        return {
          role: stone.role,
          supply: stone.supply,
          qtyReceipt,
          qtyMaster,
          qtyDelta: qtyReceipt - qtyMaster,
          unitSell,
          sellByReceiptQty: qtyReceipt * unitSell,
          sellByMasterQty: qtyMaster * unitSell,
          expectedSellDelta: (qtyReceipt - qtyMaster) * unitSell,
          actualSellDelta: qtyReceipt * unitSell - qtyMaster * unitSell,
        };
      }),
    [stoneRows]
  );

  const costComparisonRows = useMemo(
    () =>
      stoneRows.map((stone) => {
        const qtyReceipt = Math.max(stone.qtyReceipt ?? 0, 0);
        const qtyMaster = Math.max(stone.qtyMaster ?? 0, 0);
        const masterUnitCost = Math.max(stone.unitCostMaster ?? 0, 0);
        const receiptUnitCost = Math.max(stone.unitCostReceipt ?? 0, 0);
        const masterCostSubtotal = qtyMaster * masterUnitCost;
        const receiptCostSubtotal = qtyReceipt * receiptUnitCost;
        const unitEffect = (receiptUnitCost - masterUnitCost) * qtyMaster;
        const qtyEffect = (qtyReceipt - qtyMaster) * receiptUnitCost;
        return {
          role: stone.role,
          masterUnitCost,
          receiptUnitCost,
          unitDelta: receiptUnitCost - masterUnitCost,
          qtyMaster,
          qtyReceipt,
          masterCostSubtotal,
          receiptCostSubtotal,
          costDelta: receiptCostSubtotal - masterCostSubtotal,
          unitEffect,
          qtyEffect,
          expectedCostDelta: unitEffect + qtyEffect,
        };
      }),
    [stoneRows]
  );

  const totalQtyDelta = useMemo(
    () => pricingJustificationRows.reduce((sum, row) => sum + row.qtyDelta, 0),
    [pricingJustificationRows]
  );

  const totalCostDelta = useMemo(
    () => costComparisonRows.reduce((sum, row) => sum + row.costDelta, 0),
    [costComparisonRows]
  );

  const totalExpectedCostDelta = useMemo(
    () => costComparisonRows.reduce((sum, row) => sum + row.expectedCostDelta, 0),
    [costComparisonRows]
  );

  const totalValidationError = totalCostDelta - totalExpectedCostDelta;

  const extraCostJustifiedByQty =
    Math.round(totalValidationError) === 0 &&
    costComparisonRows.every((row) => row.unitEffect <= 0 || (row.qtyMaster === 0 && row.qtyReceipt === 0));

  const baseJudgement = (masterBaseCostKrw ?? 0) < (factoryBasicCostKrw ?? 0) ? "경고" : "정상";
  const extraJudgement = !extraCostMismatch
    ? "정상"
    : extraCostJustifiedByQty
      ? "정상(개수차)"
      : "경고";

  const judgementTone = (value: string): "active" | "warning" | "danger" => {
    if (value === "경고") return "danger";
    if (value === "정상(개수차)") return "warning";
    return "active";
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 min-w-0">
        <Card>
          <CardHeader className="py-2 px-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">기본공임 계산근거</span>
                <Badge tone={judgementTone(baseJudgement)} className="text-[10px]">판정 {baseJudgement}</Badge>
              </div>
              {isBaseOverridden ? <Badge tone="warning" className="text-[10px]">오버라이드</Badge> : null}
            </div>
          </CardHeader>
          <CardBody className="p-3">
            <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-xs">
              <table className="w-full table-fixed">
                <tbody>
                  <tr className="text-[var(--muted)]">
                    <td className="px-2 py-1">총액</td>
                    <td className="px-2 py-1">영수증원가/마스터마진</td>
                    <td className="px-2 py-1">마스터판매가/원가</td>
                    <td className="px-2 py-1">원가차(영수증-마스터)</td>
                    <td className="px-2 py-1">판정</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 font-semibold tabular-nums">{formatKrw(displayedBaseSell)}</td>
                    <td className="px-2 py-1 font-semibold tabular-nums">{formatKrw(factoryBasicCostKrw)} / {formatKrw(computedBaseMargin)}</td>
                    <td className="px-2 py-1 font-semibold tabular-nums text-[var(--muted)]">{formatKrw(masterBaseSellWithAbsorb)} / {formatKrw(masterBaseCostKrw)}</td>
                    <td className={`px-2 py-1 font-semibold tabular-nums ${deltaToneClass((factoryBasicCostKrw ?? 0) - (masterBaseCostKrw ?? 0))}`}>
                      {formatKrw((factoryBasicCostKrw ?? 0) - (masterBaseCostKrw ?? 0))}
                    </td>
                    <td className="px-2 py-1">
                      {(masterBaseCostKrw ?? 0) < (factoryBasicCostKrw ?? 0) ? (
                        <Badge tone="danger" className="text-[10px]">경고</Badge>
                      ) : (
                        <Badge tone="active" className="text-[10px]">정상</Badge>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3 border-b border-[var(--panel-border)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">알공임 계산근거</span>
                <Badge tone={judgementTone(extraJudgement)} className="text-[10px]">판정 {extraJudgement}</Badge>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setIsEvidenceOpen((prev) => !prev)}>
                {isEvidenceOpen ? "닫기" : "열기"}
              </Button>
            </div>
          </CardHeader>
          {isEvidenceOpen ? (
          <CardBody className="p-3 space-y-3 min-w-0">
            <ThreeColumnEvidenceRow
              total={formatKrw(finalStoneSellKrw ?? extraLaborSellKrw ?? null)}
              sourceCost={`${formatKrw(finalStoneSellKrw ?? null)} / ${formatKrw(receiptStoneCostTotal)}`}
              masterSellCost={`${formatKrw(masterStoneSellTotalWithAbsorb)} / ${formatKrw(masterStoneCostTotal)}`}
              sourceSub={`마진(판매가-${qtyBasisLabel}원가): ${formatKrw(receiptSellMargin)}`}
              masterSub={`마진(마스터판매가-마스터원가): ${formatKrw(masterSellMargin)}`}
              sourceLabel={qtyBasisLabel}
            />

            {(absorbBase > 0 || absorbStoneCenter > 0 || absorbStoneSub1 > 0 || absorbStoneSub2 > 0 || absorbPlating > 0 || absorbEtc > 0) ? (
              <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-[11px]">
                <div className="text-[var(--muted)] mb-1">흡수공임 반영</div>
                <div className="flex flex-wrap gap-2">
                  {absorbBase > 0 ? <Badge tone="active" className="text-[10px]">기본 +{formatKrw(absorbBase)}</Badge> : null}
                  {absorbStoneCenter > 0 ? <Badge tone="active" className="text-[10px]">알(메인) +{formatKrw(absorbStoneCenter)}</Badge> : null}
                  {absorbStoneSub1 > 0 ? <Badge tone="active" className="text-[10px]">알(보조1) +{formatKrw(absorbStoneSub1)}</Badge> : null}
                  {absorbStoneSub2 > 0 ? <Badge tone="active" className="text-[10px]">알(보조2) +{formatKrw(absorbStoneSub2)}</Badge> : null}
                  {absorbPlating > 0 ? <Badge tone="active" className="text-[10px]">도금 +{formatKrw(absorbPlating)}</Badge> : null}
                  {absorbDecor > 0 ? <Badge tone="active" className="text-[10px]">기타(장식) +{formatKrw(absorbDecor)}</Badge> : null}
                  {absorbOther > 0 ? <Badge tone="active" className="text-[10px]">기타 +{formatKrw(absorbOther)}</Badge> : null}
                  {absorbEtc > 0 ? <Badge tone="warning" className="text-[10px]">기타합계 +{formatKrw(absorbEtc)}</Badge> : null}
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <div className="text-[var(--muted)]">추천판매가({qtyBasisLabel}개수x마스터판매단가)</div>
                  <div className="font-semibold tabular-nums">{formatKrw(recommendedByReceiptQtyTotal)}</div>
                </div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <div className="text-[var(--muted)]">최종판매가</div>
                  <div className="font-semibold tabular-nums">{formatKrw(finalStoneSellKrw ?? null)}</div>
                </div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <div className="text-[var(--muted)]">판매가 조정(±)</div>
                  <div className="font-semibold tabular-nums">{formatKrw(stoneAdjustmentKrw ?? null)}</div>
                </div>
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                  <div className="text-[var(--muted)]">최종마진(최종판매가-{qtyBasisLabel}원가)</div>
                  <div className="font-semibold tabular-nums">{formatKrw(stoneDeltaFromReceiptCost)}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button size="sm" variant="secondary" onClick={() => setIsStoneDetailOpen((prev) => !prev)}>
                {isStoneDetailOpen ? "세부 가격 닫기" : "세부 가격 열기"}
              </Button>
            </div>

            {isStoneDetailOpen ? (
            <>
            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2">
              <div className="text-[11px] font-semibold mb-2">판매가 정당성 (개수 영향)</div>
            <div className="rounded-md border border-[var(--panel-border)]">
              <table className="w-full text-xs table-fixed">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-1 text-left">보석</th>
                    <th className="px-2 py-1 text-left">공급구분</th>
                    <th className="px-2 py-1 text-left">수량({qtyBasisLabel}/마스터)</th>
                    <th className="px-2 py-1 text-right">Δ개수({qtyBasisLabel}-마스터)</th>
                    <th className="px-2 py-1 text-right">마스터판매단가</th>
                    <th className="px-2 py-1 text-right">판매가({qtyBasisLabel}개수)</th>
                    <th className="px-2 py-1 text-right">판매가(마스터개수)</th>
                    <th className="px-2 py-1 text-right">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingJustificationRows.map((row) => (
                    <tr key={row.role} className="border-t border-[var(--panel-border)]">
                      <td className="px-2 py-1">{stoneRoleLabel(row.role)}</td>
                      <td className="px-2 py-1">{stoneSourceLabel(row.supply)}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {row.qtyReceipt} / {row.qtyMaster}
                      </td>
                      <td className="px-2 py-1 tabular-nums text-right">{row.qtyDelta}</td>
                      <td className="px-2 py-1 tabular-nums text-right">{formatKrw(row.unitSell)}</td>
                      <td className="px-2 py-1 tabular-nums text-right font-semibold">{formatKrw(row.sellByReceiptQty)}</td>
                      <td className="px-2 py-1 tabular-nums text-right">{formatKrw(row.sellByMasterQty)}</td>
                      <td className="px-2 py-1 text-right">
                        {row.qtyDelta === 0 ? (
                          <Badge tone="active" className="text-[9px]">정상</Badge>
                        ) : (
                          <Badge tone="active" className="text-[9px]">정상(개수차)</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--panel-border)] bg-[var(--panel)]">
                    <td className="px-2 py-1 text-[var(--muted)]" colSpan={5}>합계</td>
                    <td className="px-2 py-1 tabular-nums text-right font-semibold">{formatKrw(recommendedByReceiptQtyTotal)}</td>
                    <td className="px-2 py-1 tabular-nums text-right">{formatKrw(masterStoneSellTotal)}</td>
                    <td className="px-2 py-1 text-right">
                      {pricingJustificationRows.some((row) => row.qtyDelta !== 0) ? (
                        <Badge tone="active" className="text-[9px]">정상(개수차)</Badge>
                      ) : (
                        <Badge tone="active" className="text-[9px]">정상</Badge>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>

            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2">
              <div className="text-[11px] font-semibold mb-2">원가 차이 ({qtyBasisLabel} vs 마스터)</div>
            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)]">
              <table className="w-full table-fixed text-[11px]">
                <thead className="text-[var(--muted)] border-b border-[var(--panel-border)]">
                  <tr>
                    <th className="px-2 py-1 text-left">보석</th>
                    <th className="px-2 py-1 text-right">개당단가차({qtyBasisLabel}-마스터원가)</th>
                    <th className="px-2 py-1 text-right">원가(마스터개수)</th>
                    <th className="px-2 py-1 text-right">원가({qtyBasisLabel}개수)</th>
                    <th className="px-2 py-1 text-right">Δ원가({qtyBasisLabel}-마스터)</th>
                    <th className="px-2 py-1 text-right">검산오차</th>
                    <th className="px-2 py-1 text-right">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {costComparisonRows.map((row) => (
                    <tr key={row.role} className="border-b border-[var(--panel-border)] last:border-b-0">
                      <td className="px-2 py-1">{stoneRoleLabel(row.role)}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${deltaToneClass(row.unitDelta)}`}>{formatKrw(row.unitDelta)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatKrw(row.masterCostSubtotal)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatKrw(row.receiptCostSubtotal)}</td>
                      <td className={`px-2 py-1 text-right tabular-nums font-semibold ${deltaToneClass(row.costDelta)}`}>{formatKrw(row.costDelta)}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${deltaToneClass(row.costDelta - row.expectedCostDelta)}`}>{formatKrw(row.costDelta - row.expectedCostDelta)}</td>
                      <td className="px-2 py-1 text-right">
                        {row.qtyMaster === 0 && row.qtyReceipt === 0 ? (
                          <Badge tone="neutral" className="text-[9px]">데이터없음</Badge>
                        ) : Math.round(row.costDelta - row.expectedCostDelta) === 0 ? (
                          row.unitEffect > 0 ? (
                            <Badge tone="danger" className="text-[9px]">원가상승 확인</Badge>
                          ) : row.qtyEffect !== 0 ? (
                            <Badge tone="active" className="text-[9px]">정상(개수차)</Badge>
                          ) : (
                            <Badge tone="active" className="text-[9px]">정상</Badge>
                          )
                        ) : (
                          <Badge tone="warning" className="text-[9px]">확인필요</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--panel-border)]">
                    <td className="px-2 py-1 text-[var(--muted)]" colSpan={2}>합계</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatKrw(masterStoneCostTotal)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatKrw(receiptStoneCostTotal)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-semibold ${deltaToneClass(receiptStoneCostTotal - masterStoneCostTotal)}`}>{formatKrw(receiptStoneCostTotal - masterStoneCostTotal)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${deltaToneClass(totalValidationError)}`}>{formatKrw(totalValidationError)}</td>
                    <td className="px-2 py-1 text-right">
                      {costComparisonRows.length > 0 && costComparisonRows.every((row) => {
                        if (row.qtyMaster === 0 && row.qtyReceipt === 0) return true;
                        if (Math.round(row.costDelta - row.expectedCostDelta) !== 0) return false;
                        return row.unitEffect <= 0;
                      }) ? (
                        costComparisonRows.some((row) => row.qtyEffect !== 0) ? (
                          <Badge tone="active" className="text-[9px]">정상(개수차)</Badge>
                        ) : (
                          <Badge tone="active" className="text-[9px]">정상</Badge>
                        )
                      ) : totalCostDelta < 0 ? (
                        <Badge tone="danger" className="text-[9px]">원가상승 확인</Badge>
                      ) : Math.round(totalValidationError) === 0 ? (
                        <Badge tone="active" className="text-[9px]">정상</Badge>
                      ) : (
                        <Badge tone="warning" className="text-[9px]">확인필요</Badge>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
            </>
            ) : (
              <div className="text-xs text-[var(--muted)]">세부 가격 표가 접혀 있습니다.</div>
            )}
          </CardBody>
          ) : (
            <CardBody className="p-3 text-xs text-[var(--muted)]">계산근거가 접혀 있습니다.</CardBody>
          )}
        </Card>
      </div>
    </div>
  );
}
