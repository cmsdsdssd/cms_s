import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type StoneSource } from "@/lib/stone-source";

type StoneRole = "CENTER" | "SUB1" | "SUB2";

type EvidenceStoneRowInput = {
  role: StoneRole;
  supply: StoneSource | null;
  qtyReceipt?: number | null;
  qtyOrder?: number | null;
  qtyMaster?: number | null;
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
  extraLaborItems?: unknown;
  expectedBaseLaborSellKrw?: number | null;
  expectedExtraLaborSellKrw?: number | null;
};

type ParsedExtraLaborItem = {
  id: string;
  type: string;
  label: string;
  amount: number;
  meta: Record<string, unknown> | null;
};

type StoneEvidenceRow = {
  role: StoneRole;
  roleLabel: string;
  supply: StoneSource | null;
  qty: number | null;
  qtySource: "receipt" | "order" | "master" | "none";
  unitCost: number | null;
  unitCostSource: "receipt" | "none";
  includedCost: number | null;
  marginPerUnit: number | null;
  marginTotal: number | null;
  recognizedStoneMargin: number | null;
  qtyTimesUnitPlusMargin: number | null;
  warnings: string[];
};

const roleLabelMap: Record<StoneRole, string> = {
  CENTER: "CENTER",
  SUB1: "SUB1",
  SUB2: "SUB2",
};

const sourceToneMap = {
  receipt: "active",
  match: "active",
  order: "primary",
  master: "neutral",
  none: "neutral",
} as const;

const sourceLabelMap = {
  receipt: "영수증/매칭",
  match: "영수증/매칭",
  order: "주문",
  master: "마스터",
  none: "출처 없음",
} as const;

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatQty = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
};

const parseExtraLaborItems = (items?: unknown): ParsedExtraLaborItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const record = item as {
        id?: string;
        type?: string;
        label?: string;
        amount?: number | string | null;
        meta?: unknown;
      };
      const amount = Number(record.amount ?? 0);
      const meta =
        record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
          ? (record.meta as Record<string, unknown>)
          : null;
      return {
        id: String(record.id ?? `extra-${index}`),
        type: String(record.type ?? ""),
        label: String(record.label ?? "기타").trim() || "기타",
        amount: Number.isFinite(amount) ? amount : 0,
        meta,
      };
    })
    .filter((item) => item.label.length > 0);
};

const pickQty = (qtyReceipt?: number | null, qtyOrder?: number | null, qtyMaster?: number | null) => {
  if (qtyReceipt !== null && qtyReceipt !== undefined) return { qty: qtyReceipt, source: "receipt" as const };
  if (qtyOrder !== null && qtyOrder !== undefined) return { qty: qtyOrder, source: "order" as const };
  if (qtyMaster !== null && qtyMaster !== undefined) return { qty: qtyMaster, source: "master" as const };
  return { qty: null, source: "none" as const };
};

export function ShipmentPricingEvidencePanel({
  className,
  baseLaborSellKrw,
  factoryBasicCostKrw,
  masterBaseSellKrw,
  masterBaseCostKrw,
  masterBaseMarginKrw,
  baseCostSource,
  baseMarginSource,
  isBaseOverridden,
  extraLaborSellKrw,
  factoryOtherCostBaseKrw,
  stoneRows,
  extraLaborItems,
  expectedBaseLaborSellKrw,
  expectedExtraLaborSellKrw,
}: ShipmentPricingEvidencePanelProps) {
  const parsedExtraLaborItems = useMemo(() => parseExtraLaborItems(extraLaborItems), [extraLaborItems]);

  const normalizedRows = useMemo<StoneEvidenceRow[]>(() => {
    return stoneRows.map((row) => {
      const pickedQty = pickQty(row.qtyReceipt, row.qtyOrder, row.qtyMaster);
      const unitCost = row.unitCostReceipt ?? null;
      const appliedUnitCost = row.supply === "PROVIDED" ? 0 : unitCost;
      const includedCost =
        row.supply === "SELF" && pickedQty.qty !== null && appliedUnitCost !== null
          ? pickedQty.qty * appliedUnitCost
          : row.supply === "PROVIDED"
            ? 0
            : null;
      const marginPerUnit = row.marginPerUnit ?? null;
      const marginTotal =
        marginPerUnit !== null && pickedQty.qty !== null ? pickedQty.qty * marginPerUnit : null;
      const recognizedStoneMargin = row.supply === "SELF" ? marginTotal : null;
      const qtyTimesUnitPlusMargin =
        pickedQty.qty !== null && appliedUnitCost !== null && marginPerUnit !== null
          ? pickedQty.qty * (appliedUnitCost + marginPerUnit)
          : null;

      const warnings: string[] = [];
      if (row.supply === "SELF" && (unitCost === null || unitCost === 0)) warnings.push("자입 단가 0");
      if (row.supply === "PROVIDED" && unitCost !== null && unitCost > 0) warnings.push("타입이라 단가 무시");
      if (
        row.qtyReceipt !== null &&
        row.qtyReceipt !== undefined &&
        row.qtyOrder !== null &&
        row.qtyOrder !== undefined &&
        row.qtyReceipt !== row.qtyOrder
      ) {
        warnings.push("수량 불일치");
      }

      return {
        role: row.role,
        roleLabel: roleLabelMap[row.role],
        supply: row.supply,
        qty: pickedQty.qty,
        qtySource: pickedQty.source,
        unitCost,
        unitCostSource: unitCost !== null ? "receipt" : "none",
        includedCost,
        marginPerUnit,
        marginTotal,
        recognizedStoneMargin,
        qtyTimesUnitPlusMargin,
        warnings,
      };
    });
  }, [stoneRows]);

  const warningBadges = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((row) => row.warnings.forEach((warning) => set.add(warning)));
    if ((factoryBasicCostKrw ?? null) === 0 && (baseLaborSellKrw ?? 0) > 0) {
      set.add("기본공임 원가 0");
    }
    return Array.from(set);
  }, [normalizedRows, factoryBasicCostKrw, baseLaborSellKrw]);

  const selfStoneCost = useMemo(
    () => normalizedRows.reduce((sum, row) => sum + (row.includedCost ?? 0), 0),
    [normalizedRows]
  );
  const stoneMarginTotal = useMemo(
    () => normalizedRows.reduce((sum, row) => sum + (row.recognizedStoneMargin ?? 0), 0),
    [normalizedRows]
  );

  const baseSell = baseLaborSellKrw ?? 0;
  const baseCost = factoryBasicCostKrw ?? 0;
  const baseMargin =
    masterBaseSellKrw !== null &&
    masterBaseSellKrw !== undefined &&
    masterBaseCostKrw !== null &&
    masterBaseCostKrw !== undefined
      ? masterBaseSellKrw - masterBaseCostKrw
      : masterBaseMarginKrw ?? null;

  const extraSell = extraLaborSellKrw ?? 0;
  const otherCostBase = factoryOtherCostBaseKrw ?? 0;
  const extraCost = otherCostBase + selfStoneCost;
  const totalExtraMargin = extraSell - otherCostBase;
  const beadEtcMargin = totalExtraMargin - stoneMarginTotal;

  const isBaseMismatch =
    expectedBaseLaborSellKrw !== null &&
    expectedBaseLaborSellKrw !== undefined &&
    Math.round(expectedBaseLaborSellKrw) !== Math.round(baseSell);
  const isExtraMismatch =
    expectedExtraLaborSellKrw !== null &&
    expectedExtraLaborSellKrw !== undefined &&
    Math.round(expectedExtraLaborSellKrw) !== Math.round(extraSell);
  const hasMismatch = isBaseMismatch || isExtraMismatch;

  return (
    <div className={className} style={{ minWidth: 0 }}>
      <Card>
        <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--surface)] p-3">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-[var(--foreground)]">계산 근거</h3>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">기본공임 + 보석/기타공임 근거</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {hasMismatch ? (
                <Badge tone="danger" className="text-[10px] px-1.5 py-0">
                  표시값 불일치(데이터 확인)
                </Badge>
              ) : null}
              {warningBadges.map((warning) => (
                <Badge key={warning} tone="warning" className="text-[10px] px-1.5 py-0">
                  {warning}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-2 p-3 min-w-0">
          <div className="overflow-x-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)]">
            <table className="min-w-[820px] text-xs w-full">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">구분</th>
                  <th className="px-2 py-1.5 text-left font-semibold">판매가</th>
                  <th className="px-2 py-1.5 text-left font-semibold">원가</th>
                  <th className="px-2 py-1.5 text-left font-semibold">마진</th>
                  <th className="px-2 py-1.5 text-left font-semibold">근거식</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--panel-border)] align-top">
                  <td className="px-2 py-1.5 font-semibold">기본공임</td>
                  <td className="px-2 py-1.5 tabular-nums font-semibold">{formatKrw(baseSell)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatKrw(baseCost)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatKrw(baseMargin)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-[var(--muted)]">
                    {formatKrw(baseSell)} = {formatKrw(baseCost)} + {formatKrw(baseMargin)}
                  </td>
                </tr>
                <tr className="border-t border-[var(--panel-border)] align-top">
                  <td className="px-2 py-1.5 font-semibold">보석/기타공임</td>
                  <td className="px-2 py-1.5 tabular-nums font-semibold">{formatKrw(extraSell)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatKrw(otherCostBase)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatKrw(totalExtraMargin)}</td>
                  <td className="px-2 py-1.5 tabular-nums text-[var(--muted)]">
                    총마진 = {formatKrw(extraSell)} - {formatKrw(otherCostBase)} (석마진은 자입석만 반영)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <details className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)]">
            <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]">
              기본공임 계산근거
            </summary>
            <div className="space-y-2 border-t border-[var(--panel-border)] p-2 max-h-[320px] overflow-auto text-xs">
              <div className="overflow-x-auto rounded-md border border-[var(--panel-border)] bg-[var(--panel)]">
                <table className="min-w-[680px] text-xs w-full">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">항목</th>
                      <th className="px-2 py-1.5 text-left font-semibold">금액</th>
                      <th className="px-2 py-1.5 text-left font-semibold">출처</th>
                      <th className="px-2 py-1.5 text-left font-semibold">설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[var(--panel-border)] align-top">
                      <td className="px-2 py-1.5">공장 기본공임(원가)</td>
                      <td className="px-2 py-1.5 tabular-nums font-semibold">{formatKrw(baseCost)}</td>
                      <td className="px-2 py-1.5">
                        <Badge tone={sourceToneMap[baseCostSource]} className="text-[10px] px-1 py-0">
                          {sourceLabelMap[baseCostSource]}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-[var(--muted)]">영수증/매칭 기본공임 원가</td>
                    </tr>
                    <tr className="border-t border-[var(--panel-border)] align-top">
                      <td className="px-2 py-1.5">마스터 기본공임 마진</td>
                      <td className="px-2 py-1.5 tabular-nums font-semibold">{formatKrw(baseMargin)}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <Badge tone={sourceToneMap[baseMarginSource]} className="text-[10px] px-1 py-0">
                            {sourceLabelMap[baseMarginSource]}
                          </Badge>
                          {isBaseOverridden ? (
                            <Badge tone="warning" className="text-[10px] px-1 py-0">오버라이드</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-[var(--muted)]">
                        {formatKrw(masterBaseSellKrw ?? null)} - {formatKrw(masterBaseCostKrw ?? null)}
                      </td>
                    </tr>
                    <tr className="border-t border-[var(--panel-border)] align-top">
                      <td className="px-2 py-1.5">기본공임 판매가</td>
                      <td className="px-2 py-1.5 tabular-nums font-semibold">{formatKrw(baseSell)}</td>
                      <td className="px-2 py-1.5 text-[var(--muted)]">출고 표시값</td>
                      <td className="px-2 py-1.5 text-[var(--muted)] tabular-nums">
                        {formatKrw(baseCost)} + {formatKrw(baseMargin)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)]">
            <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]">
              보석/기타공임 계산근거
            </summary>
            <div className="space-y-2 border-t border-[var(--panel-border)] p-2 max-h-[320px] overflow-auto text-xs">
              <div className="grid grid-cols-1 gap-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                <div className="tabular-nums">총 기타공임 마진 = {formatKrw(extraSell)} - {formatKrw(otherCostBase)} = {formatKrw(totalExtraMargin)}</div>
                <div className="tabular-nums">석마진(자입석만) = {formatKrw(stoneMarginTotal)} (타입석은 N/A)</div>
                <div className="tabular-nums">bead/기타 마진 = {formatKrw(totalExtraMargin)} - {formatKrw(stoneMarginTotal)} = {formatKrw(beadEtcMargin)}</div>
                <div className="tabular-nums text-[var(--muted)]">참고: 자입석 원가 포함액 = {formatKrw(selfStoneCost)} / 기타공임 원가총액 = {formatKrw(extraCost)}</div>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-md border border-[var(--panel-border)]">
                <table className="hidden min-w-[820px] text-xs md:table">
                  <thead className="bg-[var(--panel)] text-[var(--muted)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">역할</th>
                      <th className="px-2 py-1.5 text-left font-semibold">자입/타입</th>
                      <th className="px-2 py-1.5 text-left font-semibold">qty</th>
                      <th className="px-2 py-1.5 text-left font-semibold">unit_cost</th>
                      <th className="px-2 py-1.5 text-left font-semibold">원가 포함액</th>
                      <th className="px-2 py-1.5 text-left font-semibold">마진/개</th>
                      <th className="px-2 py-1.5 text-left font-semibold">마진합</th>
                      <th className="px-2 py-1.5 text-left font-semibold">qty×(unit+마진)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.map((row) => (
                      <tr key={row.role} className="border-t border-[var(--panel-border)] align-top">
                        <td className="px-2 py-1.5">{row.roleLabel}</td>
                        <td className="px-2 py-1.5">
                          <Badge tone={row.supply === "SELF" ? "primary" : "neutral"} className="text-[10px] px-1 py-0">
                            {row.supply ?? "-"}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {formatQty(row.qty)}
                          <div className="mt-1">
                            <Badge tone={sourceToneMap[row.qtySource]} className="text-[10px] px-1 py-0">
                              {sourceLabelMap[row.qtySource]}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {formatKrw(row.unitCost)}
                          <div className="mt-1">
                            <Badge tone={sourceToneMap[row.unitCostSource]} className="text-[10px] px-1 py-0">
                              {sourceLabelMap[row.unitCostSource]}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {formatKrw(row.includedCost)}
                          {row.supply === "PROVIDED" ? (
                            <div className="mt-1">
                              <Badge tone="warning" className="text-[10px] px-1 py-0">단가 무시</Badge>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{formatKrw(row.marginPerUnit)}</td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {row.supply === "SELF" ? formatKrw(row.marginTotal) : "N/A"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{formatKrw(row.qtyTimesUnitPlusMargin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-2 p-2 md:hidden">
                  {normalizedRows.map((row) => (
                    <div key={`${row.role}-mobile`} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{row.roleLabel}</span>
                        <Badge tone={row.supply === "SELF" ? "primary" : "neutral"} className="text-[10px] px-1 py-0">
                          {row.supply ?? "-"}
                        </Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <div>qty: {formatQty(row.qty)}</div>
                        <div>unit_cost: {formatKrw(row.unitCost)}</div>
                        <div>원가포함: {formatKrw(row.includedCost)}</div>
                        <div>마진합: {row.supply === "SELF" ? formatKrw(row.marginTotal) : "N/A"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
                <div className="text-xs font-semibold">extra_labor_items</div>
                {parsedExtraLaborItems.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">-</div>
                ) : (
                  parsedExtraLaborItems.map((item) => (
                    <div key={item.id} className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="tabular-nums font-semibold">{formatKrw(item.amount)}</span>
                      </div>
                      {item.meta ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-[var(--muted)]">meta 펼치기</summary>
                          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-[var(--muted)]">
                            {Object.entries(item.meta).map(([key, value]) => (
                              <div key={`${item.id}-${key}`} className="truncate">
                                {key}: {String(value)}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </details>

          {hasMismatch ? (
            <details className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-2 text-xs">
              <summary className="cursor-pointer text-[var(--danger)] font-semibold">불일치 디버그 정보</summary>
              <div className="mt-2 space-y-1 text-[var(--danger)] tabular-nums">
                <div>expectedBaseLaborSell: {formatKrw(expectedBaseLaborSellKrw ?? null)}</div>
                <div>displayedBaseLaborSell: {formatKrw(baseSell)}</div>
                <div>expectedExtraLaborSell: {formatKrw(expectedExtraLaborSellKrw ?? null)}</div>
                <div>displayedExtraLaborSell: {formatKrw(extraSell)}</div>
              </div>
            </details>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
