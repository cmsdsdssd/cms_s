import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

export type ReceiptAmounts = {
  gold: number;
  silver: number;
  labor: number;
  total: number;
};

export type ReceiptLineItem = {
  shipment_line_id?: string;
  model_name?: string | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  net_weight_g?: number | null;
  total_amount_sell_krw?: number | null;
  labor_total_sell_krw?: number | null;
  material_amount_sell_krw?: number | null;
  repair_fee_krw?: number | null;
  gold_tick_krw_per_g?: number | null;
  silver_tick_krw_per_g?: number | null;
  silver_adjust_factor?: number | null;
  is_unit_pricing?: boolean | null;
  is_return?: boolean | null;
  is_repair?: boolean | null;
};

export type ReceiptSummaryRow = {
  label: string;
  value: ReceiptAmounts;
};

export type ReceiptPrintWriteoffRow = {
  atLabel: string;
  amountKrw: number;
  memo?: string | null;
};

export type ReceiptPrintEvidenceRow = {
  atLabel: string;
  amountKrw: number;
  goldG?: number;
  silverG?: number;
  paidGoldKrw?: number;
  paidSilverKrw?: number;
  cashKrw?: number;
  allocLaborKrw?: number;
  allocMaterialKrw?: number;
  paidGoldG?: number;
  paidSilverG?: number;
  cashMaterialGoldG?: number;
  cashMaterialSilverG?: number;
  cashMaterialGoldKrw?: number;
  cashMaterialSilverKrw?: number;
  paymentId?: string | null;
  memo?: string | null;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatWeight = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)}g`;
};

const formatWeightCell = (value?: number | null) => {
  if (value === null || value === undefined) return "";
  return formatWeight(value);
};

const formatBreakdownKrw = (value: ReceiptAmounts) => {
  const hasCommodityOrLaborResidual =
    Math.abs(value.gold) > 0 || Math.abs(value.silver) > 0 || Math.abs(value.labor) > 0;
  if (Math.abs(value.total) <= 0 && hasCommodityOrLaborResidual) {
    return "-";
  }
  return formatKrw(value.total);
};

const addAmounts = (a: ReceiptAmounts, b: ReceiptAmounts): ReceiptAmounts => ({
  gold: a.gold + b.gold,
  silver: a.silver + b.silver,
  labor: a.labor + b.labor,
  total: a.total + b.total,
});

const formatNumber3 = (value?: number | null) => {
  if (value === null || value === undefined) return "0.000";
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
};

type ReceiptPrintHalfProps = {
  partyName: string;
  dateLabel: string;
  lines: ReceiptLineItem[];
  summaryRows: ReceiptSummaryRow[];
  goldPriceRange?: { min: number; max: number } | null;
  silverPriceRange?: { min: number; max: number } | null;
  goldPrice?: number | null;
  silverPrice?: number | null;
  printWriteoffs?: {
    totalKrw: number;
    count: number;
    rows: ReceiptPrintWriteoffRow[];
    extraCount: number;
  } | null;
  printMode?: "settlement" | "evidence";
  evidencePayments?: {
    totalKrw: number;
    rows: ReceiptPrintEvidenceRow[];
  } | null;
  evidenceWriteoffs?: {
    totalKrw: number;
    rows: ReceiptPrintEvidenceRow[];
  } | null;
  printCategoryBreakdown?: {
    shipment: ReceiptAmounts;
    return: ReceiptAmounts;
    payment: ReceiptAmounts;
    adjust: ReceiptAmounts;
    offset: ReceiptAmounts;
    other: ReceiptAmounts;
  } | null;
  isFullyPaid?: boolean;
};

const buildAppliedPriceText = (lines: ReceiptLineItem[], kind: "gold" | "silver") => {
  const priceToLineNumbers = new Map<number, number[]>();
  lines.forEach((line, index) => {
    if (line.is_unit_pricing) return;
    const netWeight = Number(line.net_weight_g ?? 0);
    if (Math.abs(netWeight) <= 0.000001) return;
    const code = (line.material_code ?? "").trim();
    const isSilverMaterial = code === "925" || code === "999";
    const isGoldMaterial = code === "14" || code === "18" || code === "24";
    if (kind === "gold" && !isGoldMaterial) return;
    if (kind === "silver" && !isSilverMaterial) return;
    const price = kind === "gold" ? line.gold_tick_krw_per_g : line.silver_tick_krw_per_g;
    if (price === null || price === undefined) return;
    const normalizedPrice = Number(price);
    const lineNumbers = priceToLineNumbers.get(normalizedPrice) ?? [];
    lineNumbers.push(index + 1);
    priceToLineNumbers.set(normalizedPrice, lineNumbers);
  });

  if (priceToLineNumbers.size === 0) return null;

  const notes = Array.from(priceToLineNumbers.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([price, lineNumbers]) => {
      const refs = lineNumbers.map((n) => `[${n}]`).join(", ");
      return `${formatKrw(price)}/g ${refs}`;
    });

  return notes.join(" · ");
};

export const ReceiptPrintHalf = ({
  partyName,
  dateLabel,
  lines,
  summaryRows,
  printWriteoffs,
  printMode = "settlement",
  evidencePayments,
  evidenceWriteoffs,
  printCategoryBreakdown,
  isFullyPaid = false,
}: ReceiptPrintHalfProps) => {
  const paddedLines = useMemo(() => {
    const next = [...lines];
    while (next.length < 6) next.push({});
    return next;
  }, [lines]);
  const appliedGoldPriceText = useMemo(() => buildAppliedPriceText(lines, "gold"), [lines]);
  const appliedSilverPriceText = useMemo(() => buildAppliedPriceText(lines, "silver"), [lines]);
  const appliedPriceParts = useMemo(() => {
    const parts: string[] = [];
    if (appliedGoldPriceText) parts.push(`순금시세 ${appliedGoldPriceText}`);
    if (appliedSilverPriceText) parts.push(`순은시세 ${appliedSilverPriceText}`);
    return parts;
  }, [appliedGoldPriceText, appliedSilverPriceText]);
  const hasReturnInBreakdown = useMemo(() => {
    if (!printCategoryBreakdown) return false;
    const returns = printCategoryBreakdown.return;
    return (
      Math.abs(returns.gold) > 0 ||
      Math.abs(returns.silver) > 0 ||
      Math.abs(returns.labor) > 0 ||
      Math.abs(returns.total) > 0
    );
  }, [printCategoryBreakdown]);

  return (
    <div className="flex h-full flex-col gap-4 text-[11px] text-black">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-black">{partyName}</div>
          {isFullyPaid && (
            <span className="mt-1 inline-flex items-center rounded-full border border-emerald-300 bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.02em] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              완불
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">MS</div>
          <div className="text-[10px] text-neutral-600">{dateLabel}</div>
          <div className="text-[10px] text-neutral-600">거래명세/영수증</div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="text-xs font-semibold">당일 출고 내역</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">모델명</th>
              <th className="py-1 text-left font-medium">소재</th>
              <th className="py-1 text-left font-medium">색상</th>
              <th className="py-1 text-left font-medium">사이즈</th>
              <th className="py-1 text-right font-medium">금중량</th>
              <th className="py-1 text-right font-medium">은중량</th>
              <th className="py-1 text-right font-medium">총공임</th>
              <th className="py-1 text-right font-medium">총가격</th>
            </tr>
          </thead>
          <tbody>
            {paddedLines.map((line, index) => {
              const isUnitPricing = Boolean(line.is_unit_pricing);
              const isSilver = line.material_code === "925" || line.material_code === "999";
              const isReturn = Boolean(line.is_return) || (line.total_amount_sell_krw ?? 0) < 0;
              const isRepair = Boolean(line.is_repair);
              const isRepairWithMaterial =
                isRepair && Number(line.material_amount_sell_krw ?? 0) > 0 && Number(line.net_weight_g ?? 0) > 0;
              const hasContent = Boolean(
                line.model_name || line.material_code || line.color || line.size || line.net_weight_g
              );
              const modelName = (line.model_name ?? "").toString();
              const modelWithReturnPrefix = isReturn && modelName && !modelName.trim().startsWith("-")
                ? `-${modelName}`
                : modelName;
              const typeLabel = isRepair ? "[수리]" : isReturn ? "[반품]" : "";
              const modelLabel = hasContent
                ? `${index + 1}. ${typeLabel} ${modelWithReturnPrefix}`.trim()
                : "";
              const total = Number(line.total_amount_sell_krw ?? 0);
              const labor =
                line.labor_total_sell_krw !== null && line.labor_total_sell_krw !== undefined
                  ? Number(line.labor_total_sell_krw)
                  : line.repair_fee_krw !== null && line.repair_fee_krw !== undefined
                    ? Number(line.repair_fee_krw)
                    : 0;
              const unitPricingLabor =
                line.labor_total_sell_krw !== null && line.labor_total_sell_krw !== undefined
                  ? Number(line.labor_total_sell_krw)
                  : total;
              const buildPriceFormula = () => {
                if (!hasContent) return { materialExpr: "", labor, total, isUnitPricing };
                const code = (line.material_code ?? "").trim();
                const weight = Number(line.net_weight_g ?? 0);
                const goldPrice = Number(line.gold_tick_krw_per_g ?? 0);
                const silverPrice = Number(line.silver_tick_krw_per_g ?? 0);
                const silverFactor = Number(line.silver_adjust_factor ?? 1);
                const materialSell = Number(line.material_amount_sell_krw ?? 0);
                if (isUnitPricing) {
                  return { materialExpr: "", labor: unitPricingLabor, total, isUnitPricing: true };
                }

                let pureWeight = 0;
                if (code === "14") pureWeight = weight * 0.6435;
                else if (code === "18") pureWeight = weight * 0.825;
                else if (code === "24") pureWeight = weight;
                else if (code === "925") pureWeight = weight * silverFactor * 0.925;
                else if (code === "999") pureWeight = weight * silverFactor;

                const explicitRate =
                  code === "925" || code === "999"
                    ? silverPrice > 0
                      ? silverPrice
                      : 0
                    : goldPrice > 0
                      ? goldPrice
                      : 0;

                const inferredRate = pureWeight > 0 && Math.abs(materialSell) > 0 ? materialSell / pureWeight : 0;
                const appliedRate = explicitRate > 0 ? explicitRate : inferredRate;

                let materialExpr = `소재가격(환산중량 ${formatNumber3(pureWeight)}g x 적용시세 ${formatKrw(appliedRate)}/g)=${formatKrw(materialSell)}`;
                if (!(isRepair && !isRepairWithMaterial)) {
                  if (pureWeight <= 0) {
                    materialExpr = `소재가격(환산중량 0.000g x 적용시세 0/g)=${formatKrw(materialSell)}`;
                  }
                }

                return { materialExpr, labor, total, isUnitPricing: false };
              };
              const priceFormula = buildPriceFormula();
              return (
                <Fragment key={`${line.shipment_line_id ?? `row-${index}`}-pair`}>
                  <tr className="border-b border-neutral-200">
                    <td className="py-1 pr-2 align-middle">
                      <div className="flex items-center gap-1">
                        {hasContent && isUnitPricing && (
                          <span className="rounded border border-neutral-400 px-1 text-[9px] font-semibold text-black">단가제</span>
                        )}
                        <span>{modelLabel}</span>
                      </div>
                    </td>
                    <td className="py-1 text-left tabular-nums">{line.material_code ?? ""}</td>
                    <td className="py-1 text-left tabular-nums">{line.color ?? ""}</td>
                    <td className="py-1 text-left tabular-nums">{line.size ?? ""}</td>
                    <td className="py-1 text-right tabular-nums">
                      {hasContent && isUnitPricing
                        ? "-"
                        : isRepair
                          ? isRepairWithMaterial
                            ? isSilver
                              ? ""
                              : formatWeightCell(line.net_weight_g)
                            : "-"
                          : isSilver
                            ? ""
                            : formatWeightCell(line.net_weight_g)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {hasContent && isUnitPricing
                        ? "-"
                        : isRepair
                          ? isRepairWithMaterial
                            ? isSilver
                              ? formatWeightCell(line.net_weight_g)
                              : ""
                            : "-"
                          : isSilver
                            ? formatWeightCell(line.net_weight_g)
                            : ""}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {hasContent && isUnitPricing
                        ? formatKrw(unitPricingLabor)
                        : isRepair
                          ? (() => {
                            const repairCash = line.repair_fee_krw;
                            if (repairCash !== null && repairCash !== undefined) return formatKrw(repairCash);
                            if (line.labor_total_sell_krw !== null && line.labor_total_sell_krw !== undefined) {
                              return formatKrw(line.labor_total_sell_krw);
                            }
                            return "";
                          })()
                          : line.labor_total_sell_krw === null || line.labor_total_sell_krw === undefined
                            ? ""
                            : formatKrw(line.labor_total_sell_krw)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {line.total_amount_sell_krw === null || line.total_amount_sell_krw === undefined
                        ? ""
                        : formatKrw(line.total_amount_sell_krw)}
                    </td>
                  </tr>
                  <tr className="border-b border-neutral-200">
                    <td colSpan={6} className="py-1 text-[10px] tabular-nums text-neutral-600">
                      {priceFormula.materialExpr}
                    </td>
                    <td className="py-1 text-right text-[10px] tabular-nums text-neutral-600">
                      {hasContent ? `+ ${formatKrw(priceFormula.labor)}` : ""}
                    </td>
                    <td className="py-1 text-right text-[10px] tabular-nums text-neutral-600">
                      {hasContent ? (priceFormula.isUnitPricing ? formatKrw(priceFormula.total) : `= ${formatKrw(priceFormula.total)}`) : ""}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto space-y-2 border-t border-neutral-300 pt-2">
        <div className="space-y-1 text-[10px] text-neutral-700">
          {appliedPriceParts.length > 0 && <div>적용 시세: {appliedPriceParts.join(" · ")}</div>}
        </div>
        <div className="text-xs font-semibold">미수 내역 (요약)</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="py-1 text-left font-medium">구분</th>
              <th className="py-1 text-right font-medium">순금</th>
              <th className="py-1 text-right font-medium">순은</th>
              <th className="py-1 text-right font-medium">공임</th>
              <th className="py-1 text-right font-medium">총금액</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((row) => {
              const isCoreSummaryRow =
                row.label === "합계" ||
                row.label.includes("이전 미수") ||
                row.label === "당일 출고" ||
                row.label === "당일 결제" ||
                row.label === "반품/조정/상계";
              const isTodaySummaryRow = row.label === "반품/조정/상계";

              return (
              <tr key={row.label} className={cn("border-b border-neutral-200", isTodaySummaryRow && "border-b-2 border-neutral-400")}>
                <td className={cn("py-1 font-medium", isCoreSummaryRow && "font-semibold")}>
                  {row.label === "당일 반품" ? <span className="text-blue-600">{row.label}</span> : row.label}
                </td>
                <td className={cn("py-1 text-right tabular-nums", isCoreSummaryRow && "font-semibold", row.label === "당일 반품" && "text-blue-600")}>
                  {formatWeight(row.value.gold)}
                </td>
                <td className={cn("py-1 text-right tabular-nums", isCoreSummaryRow && "font-semibold", row.label === "당일 반품" && "text-blue-600")}>
                  {formatWeight(row.value.silver)}
                </td>
                <td className={cn("py-1 text-right tabular-nums", isCoreSummaryRow && "font-semibold", row.label === "당일 반품" && "text-blue-600")}>
                  {formatKrw(row.value.labor)}
                </td>
                <td className={cn("py-1 text-right tabular-nums", isCoreSummaryRow && "font-semibold", row.label === "당일 반품" && "text-blue-600")}>
                  {formatKrw(row.value.total)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {printCategoryBreakdown && (
          <div className="mt-2 space-y-1 border-t border-neutral-200 pt-2 text-[10px]">
            <div className="font-semibold">당일 변동 요약</div>
            {(() => {
              const sales = addAmounts(printCategoryBreakdown.shipment, printCategoryBreakdown.return);
              const payment = printCategoryBreakdown.payment;
              const misc = addAmounts(printCategoryBreakdown.adjust, addAmounts(printCategoryBreakdown.offset, printCategoryBreakdown.other));
              const net = addAmounts(addAmounts(sales, payment), misc);
              const showMisc =
                Math.abs(misc.gold) > 0 ||
                Math.abs(misc.silver) > 0 ||
                Math.abs(misc.labor) > 0 ||
                Math.abs(misc.total) > 0;
              const rows: Array<[string, ReceiptAmounts]> = [
                ["오늘 판매(출고+반품)", sales],
                ["오늘 결제", payment],
              ];
              if (showMisc) rows.push(["기타(조정+상계+정정)", misc]);
              rows.push(["당일 미수 변화", net]);
              return (
                <table className="w-full border-collapse text-[10px] tabular-nums">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="py-1 text-left font-medium">구분</th>
                      <th className="py-1 text-right font-medium">순금</th>
                      <th className="py-1 text-right font-medium">순은</th>
                      <th className="py-1 text-right font-medium">공임</th>
                      <th className="py-1 text-right font-medium">총금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, value]) => (
                      <tr key={label} className="border-b border-neutral-100">
                        <td className={cn("py-1", label === "당일 미수 변화" && "font-semibold")}>{label}</td>
                        <td className="py-1 text-right">{formatWeight((value as ReceiptAmounts).gold)}</td>
                        <td className="py-1 text-right">{formatWeight((value as ReceiptAmounts).silver)}</td>
                        <td className="py-1 text-right">{formatKrw((value as ReceiptAmounts).labor)}</td>
                        <td className="py-1 text-right">{formatBreakdownKrw(value as ReceiptAmounts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            {hasReturnInBreakdown && (
              <div className="text-[10px] text-neutral-600">※ 금/은 반품분은 당시 시세로 계산되어 총금액에 반영됩니다.</div>
            )}
          </div>
        )}

        {printMode === "evidence" && evidencePayments && (
          <div className="mt-2 border-t border-neutral-200 pt-2 text-[10px]">
            <div className="flex items-center justify-between gap-2 tabular-nums font-semibold">
              <div>최근 결제 내역(증빙)</div>
              <div>{formatKrw(evidencePayments.totalKrw)}</div>
            </div>
            <table className="mt-1 w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-1 text-left font-medium">구분</th>
                  <th className="py-1 text-right font-medium">순금</th>
                  <th className="py-1 text-right font-medium">순은</th>
                  <th className="py-1 text-right font-medium">공임</th>
                  <th className="py-1 text-right font-medium">총금액</th>
                </tr>
              </thead>
              <tbody>
                {evidencePayments.rows.map((row, idx) => (
                  <tr key={`${row.paymentId ?? "pay"}-${idx}`} className="border-b border-neutral-100">
                    <td className="py-1">
                      <div className="truncate">총결제 · {row.atLabel} · 배분합계 {formatKrw(row.amountKrw)}</div>
                      <div className="text-[9px] text-neutral-600 tabular-nums">
                        소재 중량 금 {formatWeight(row.goldG ?? 0)} · 은 {formatWeight(row.silverG ?? 0)} · 현금 {formatKrw(row.cashKrw ?? 0)}
                        {Math.abs(Number(row.paidSilverG ?? 0)) > 0 ? ` · 은결제 ${formatWeight(row.paidSilverG ?? 0)}` : ""}
                      </div>
                      {(Math.abs(Number(row.paidGoldG ?? 0)) > 0 || Math.abs(Number(row.cashMaterialGoldG ?? 0)) > 0) && (
                        <div className="text-[9px] text-neutral-700 tabular-nums">
                          금 처리: 금결제 {formatWeight(row.paidGoldG ?? 0)}({formatKrw(row.paidGoldKrw ?? 0)}) + 현금소재충당 {formatWeight(row.cashMaterialGoldG ?? 0)} ({formatKrw(row.cashMaterialGoldKrw ?? 0)})
                        </div>
                      )}
                      {(Math.abs(Number(row.paidSilverG ?? 0)) > 0 || Math.abs(Number(row.cashMaterialSilverG ?? 0)) > 0) && (
                        <div className="text-[9px] text-neutral-700 tabular-nums">
                          은 처리: 은결제 {formatWeight(row.paidSilverG ?? 0)}({formatKrw(row.paidSilverKrw ?? 0)}) + 현금소재충당 {formatWeight(row.cashMaterialSilverG ?? 0)} ({formatKrw(row.cashMaterialSilverKrw ?? 0)})
                        </div>
                      )}
                      {Math.abs(Number(row.allocMaterialKrw ?? 0)) > 0 && (
                        <div className="text-[9px] text-neutral-700 tabular-nums">
                          현금 소재충당 {formatKrw(row.allocMaterialKrw ?? 0)}
                        </div>
                      )}
                      {(Math.abs(Number(row.allocMaterialKrw ?? 0)) > 0 || Math.abs(Number(row.allocLaborKrw ?? 0)) > 0) && (
                        <div className="text-[9px] text-neutral-600 tabular-nums">
                          충당구분: 소재 {formatKrw(row.allocMaterialKrw ?? 0)} · 공임 {formatKrw(row.allocLaborKrw ?? 0)}
                        </div>
                      )}
                    </td>
                    <td className="py-1 text-right">{formatWeight(row.goldG ?? 0)}</td>
                    <td className="py-1 text-right">{formatWeight(row.silverG ?? 0)}</td>
                    <td className="py-1 text-right">{formatKrw(row.allocLaborKrw ?? 0)}</td>
                    <td className="py-1 text-right">{formatKrw(row.amountKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printMode === "evidence" && evidenceWriteoffs && evidenceWriteoffs.rows.length > 0 && (
          <div className="mt-2 border-t border-neutral-200 pt-2 text-[10px]">
            <div className="flex items-center justify-between gap-2 tabular-nums font-semibold">
              <div>서비스 완불처리(증빙)</div>
              <div>{formatKrw(evidenceWriteoffs.totalKrw)}</div>
            </div>
            <table className="mt-1 w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="py-1 text-left font-medium">구분</th>
                  <th className="py-1 text-right font-medium">순금</th>
                  <th className="py-1 text-right font-medium">순은</th>
                  <th className="py-1 text-right font-medium">공임</th>
                  <th className="py-1 text-right font-medium">총금액</th>
                </tr>
              </thead>
              <tbody>
                {evidenceWriteoffs.rows.map((row, idx) => (
                  <tr key={`${row.atLabel}-${idx}`} className="border-b border-neutral-100">
                    <td className="py-1 truncate">완불 · {row.atLabel}</td>
                    <td className="py-1 text-right">{formatWeight(row.goldG ?? 0)}</td>
                    <td className="py-1 text-right">{formatWeight(row.silverG ?? 0)}</td>
                    <td className="py-1 text-right">{formatKrw(row.cashKrw ?? 0)}</td>
                    <td className="py-1 text-right">{formatKrw(row.amountKrw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {printWriteoffs && (
          <div className="mt-2 border-t border-neutral-200 pt-2 text-[10px]">
            <div className="flex items-center justify-between gap-2 tabular-nums">
              <div className="truncate">
                <span className="font-semibold">서비스 완불처리</span>: {printWriteoffs.count}건(실결제 아님)
              </div>
              <div className="text-right">{formatKrw(printWriteoffs.totalKrw)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
