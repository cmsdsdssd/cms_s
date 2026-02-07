"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type StoneSource } from "@/lib/stone-source";

type StoneRole = "CENTER" | "SUB1" | "SUB2";

type EvidenceStoneRowInput = {
  role: StoneRole;
  supply: StoneSource | null;
  qtyReceipt?: number | null;
  qtyMaster?: number | null;
  unitCostReceipt?: number | null;
  marginPerUnit?: number | null;
};

type EvidenceItem = {
  type?: string;
  label?: string;
  amount?: number | string | null;
  meta?: Record<string, unknown> | null;
  [key: string]: unknown;
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
  shipmentBaseLaborKrw?: number | null;
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

const evidenceSectionLabel = (key: string) => {
  if (key === "COST_BASIS") return "원가 근거";
  if (key === "RULE_MARKUP") return "규칙 마진";
  if (key === "MASTER_ADDON_MARGIN") return "마스터 추가마진";
  if (key === "WARN") return "주의";
  if (key === "CENTER") return "중심공임";
  if (key === "SUB1") return "보조1공임";
  if (key === "SUB2") return "보조2공임";
  if (key === "PLATING") return "도금";
  if (key === "OTHER") return "기타";
  return key;
};

const evidenceItemLabel = (item: EvidenceItem) => {
  const label = String(item.label ?? "").trim();
  if (label) return label;
  return evidenceSectionLabel(String(item.type ?? "기타"));
};

const normalizeItems = (value: unknown): EvidenceItem[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is EvidenceItem => typeof item === "object" && item !== null);
};

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // no-op
  }
};

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
  extraLaborItems,
  shipmentBaseLaborKrw,
}: ShipmentPricingEvidencePanelProps) {
  const normalizedItems = useMemo(() => normalizeItems(extraLaborItems), [extraLaborItems]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, EvidenceItem[]> = {
      COST_BASIS: [],
      RULE_MARKUP: [],
      MASTER_ADDON_MARGIN: [],
      WARN: [],
      OTHER: [],
    };
    normalizedItems.forEach((item) => {
      const type = String(item.type ?? "").trim();
      if (type in groups) {
        groups[type].push(item);
      } else {
        groups.OTHER.push(item);
      }
    });
    return groups;
  }, [normalizedItems]);

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

  const masterExtraMarginTotal = useMemo(() => {
    if (extraLaborSellKrw === null || extraLaborSellKrw === undefined) return null;
    return extraLaborSellKrw - receiptExtraCostTotal;
  }, [extraLaborSellKrw, receiptExtraCostTotal]);

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
            <div className="overflow-x-auto">
              <div className="min-w-[520px] rounded border border-[var(--panel-border)] bg-[var(--surface)] px-2 py-1 text-xs">
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-x-2">
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">총결과(출고기본공임)</span>
                    <span className="ml-1 font-semibold tabular-nums">{formatKrw(displayedBaseSell)}</span>
                  </div>
                  <span className="text-[var(--muted)]">|</span>
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">영수증/매칭 원가({sourceLabel(baseCostSource)})</span>
                    <span className="ml-1 font-semibold tabular-nums">{formatKrw(factoryBasicCostKrw)}</span>
                  </div>
                  <span className="text-[var(--muted)]">|</span>
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">마스터마진(기본공임 판매 - 기본공임 원가)</span>
                    <span className="ml-1 font-semibold tabular-nums">
                      {formatKrw(computedBaseMargin)} ({formatKrw(masterBaseSellKrw)} - {formatKrw(masterBaseCostKrw)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="py-2 px-3 border-b border-[var(--panel-border)]">
            <span className="text-xs font-semibold">보석/기타공임 계산근거 (v3 evidence)</span>
          </CardHeader>
          <CardBody className="p-3 space-y-3 min-w-0">
            <div className="overflow-x-auto">
              <div className="min-w-[520px] rounded border border-[var(--panel-border)] bg-[var(--surface)] px-2 py-1 text-xs">
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-x-2">
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">총결과(보석/기타공임)</span>
                    <span className="ml-1 font-semibold tabular-nums">{formatKrw(extraLaborSellKrw ?? null)}</span>
                  </div>
                  <span className="text-[var(--muted)]">|</span>
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">영수증 원가(기타원가+알공임)</span>
                    <span className="ml-1 font-semibold tabular-nums">{formatKrw(receiptExtraCostTotal)}</span>
                  </div>
                  <span className="text-[var(--muted)]">|</span>
                  <div className="min-w-0">
                    <span className="text-[var(--muted)]">마스터마진</span>
                    <span className="ml-1 font-semibold tabular-nums">{formatKrw(masterExtraMarginTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-[var(--panel-border)]">
              <table className="min-w-[680px] w-full text-xs">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-2 py-1 text-left">보석</th>
                    <th className="px-2 py-1 text-left">공급구분</th>
                    <th className="px-2 py-1 text-left">수량(영수증/마스터)</th>
                    <th className="px-2 py-1 text-left">단가(영수증)</th>
                  </tr>
                </thead>
                <tbody>
                  {stoneRows.map((stone) => (
                    <tr key={stone.role} className="border-t border-[var(--panel-border)]">
                      <td className="px-2 py-1">{stone.role}</td>
                      <td className="px-2 py-1">{stoneSourceLabel(stone.supply)}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {stone.qtyReceipt ?? "-"} / {stone.qtyMaster ?? "-"}
                      </td>
                      <td className="px-2 py-1 tabular-nums">{formatKrw(stone.unitCostReceipt ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-2 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[10px]">
                {[
                  { key: "COST_BASIS", title: "COST_BASIS" },
                  { key: "RULE_MARKUP", title: "RULE_MARKUP" },
                  { key: "MASTER_ADDON_MARGIN", title: "MASTER_ADDON_MARGIN" },
                  { key: "WARN", title: "WARN" },
                  { key: "OTHER", title: "OTHER" },
                ].map((section) => (
                  <div key={section.key} className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1">
                    <span className="font-semibold">{evidenceSectionLabel(section.title)}</span>
                    <span className="ml-1 tabular-nums text-[var(--muted)]">{(groupedItems[section.key] ?? []).length}</span>
                  </div>
                ))}
                <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 md:col-span-1 col-span-2">
                  <span className="font-semibold">기타공임</span>
                  <span className="ml-1 tabular-nums">{formatKrw(extraLaborSellKrw ?? null)}</span>
                </div>
              </div>

              <div className="space-y-1">
                {[
                  { key: "COST_BASIS", title: "COST_BASIS" },
                  { key: "RULE_MARKUP", title: "RULE_MARKUP" },
                  { key: "MASTER_ADDON_MARGIN", title: "MASTER_ADDON_MARGIN" },
                  { key: "WARN", title: "WARN" },
                  { key: "OTHER", title: "OTHER" },
                ].map((section) => (
                  <div key={`${section.key}-rows`} className="text-[10px] min-w-0">
                    {(groupedItems[section.key] ?? []).map((item, idx) => {
                      const ruleId =
                        typeof item.rule_id === "string"
                          ? item.rule_id
                          : typeof item.meta === "object" && item.meta && "rule_id" in item.meta
                            ? String((item.meta as Record<string, unknown>).rule_id ?? "")
                            : "";
                      return (
                        <div key={`${section.key}-${idx}`} className="flex items-center gap-2 min-w-0">
                          <span className="text-[var(--muted)] shrink-0">[{evidenceSectionLabel(section.title)}]</span>
                          <span className="truncate">{evidenceItemLabel(item)}</span>
                          <span className="tabular-nums shrink-0">{formatKrw(Number(item.amount ?? 0))}</span>
                          {ruleId ? (
                            <Button size="sm" variant="secondary" className="h-5 px-2 text-[10px] shrink-0" onClick={() => void copyText(ruleId)}>
                              규칙복사
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
