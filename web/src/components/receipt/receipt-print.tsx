import { useMemo } from "react";

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
  gold_tick_krw_per_g?: number | null;
  silver_tick_krw_per_g?: number | null;
};

export type ReceiptSummaryRow = {
  label: string;
  value: ReceiptAmounts;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatWeight = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}g`;
};

const formatWeightCell = (value?: number | null) => {
  if (value === null || value === undefined) return "";
  return formatWeight(value);
};

type ReceiptPrintHalfProps = {
  partyName: string;
  dateLabel: string;
  lines: ReceiptLineItem[];
  summaryRows: ReceiptSummaryRow[];
  goldPrice: number | null;
  silverPrice: number | null;
};

export const ReceiptPrintHalf = ({
  partyName,
  dateLabel,
  lines,
  summaryRows,
  goldPrice,
  silverPrice,
}: ReceiptPrintHalfProps) => {
  const paddedLines = useMemo(() => {
    const next = [...lines];
    while (next.length < 15) next.push({});
    return next;
  }, [lines]);

  return (
    <div className="flex h-full flex-col gap-4 text-[11px] text-black">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold">MS</div>
          <div className="text-[10px] text-neutral-600">거래명세/영수증</div>
        </div>
        <div className="text-right text-[10px] text-neutral-600">
          <div>{dateLabel}</div>
          <div className="font-medium text-black">{partyName}</div>
          <div className="mt-1">
            금시세 {goldPrice === null || goldPrice === undefined ? "-" : formatKrw(goldPrice)}/g · 은시세 {silverPrice === null || silverPrice === undefined ? "-" : formatKrw(silverPrice)}/g
          </div>
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
              const isSilver = line.material_code === "925" || line.material_code === "999";
              const hasContent = Boolean(
                line.model_name || line.material_code || line.color || line.size || line.net_weight_g
              );
              const modelLabel = hasContent
                ? `${index + 1}. ${(line.model_name ?? "").toString()}`.trim()
                : "";
              return (
                <tr key={line.shipment_line_id ?? `row-${index}`} className="border-b border-neutral-200">
                  <td className="py-1 pr-2 align-middle">{modelLabel}</td>
                  <td className="py-1 text-left tabular-nums">{line.material_code ?? ""}</td>
                  <td className="py-1 text-left tabular-nums">{line.color ?? ""}</td>
                  <td className="py-1 text-left tabular-nums">{line.size ?? ""}</td>
                  <td className="py-1 text-right tabular-nums">
                    {isSilver ? "" : formatWeightCell(line.net_weight_g)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {isSilver ? formatWeightCell(line.net_weight_g) : ""}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {line.labor_total_sell_krw === null || line.labor_total_sell_krw === undefined
                      ? ""
                      : formatKrw(line.labor_total_sell_krw)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {line.total_amount_sell_krw === null || line.total_amount_sell_krw === undefined
                      ? ""
                      : formatKrw(line.total_amount_sell_krw)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-auto space-y-2 border-t border-neutral-300 pt-2">
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
            {summaryRows.map((row) => (
              <tr key={row.label} className="border-b border-neutral-200">
                <td className="py-1 font-medium">{row.label}</td>
                <td className="py-1 text-right tabular-nums">{formatWeight(row.value.gold)}</td>
                <td className="py-1 text-right tabular-nums">{formatWeight(row.value.silver)}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.labor)}</td>
                <td className="py-1 text-right tabular-nums">{formatKrw(row.value.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
