export function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function roundUpToUnit(value: number, unit: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(unit) || unit <= 0) return Math.ceil(value);
  return Math.ceil(value / unit) * unit;
}

export function formatNumberInput(value: string) {
  const cleaned = value.replaceAll(",", "").trim();
  if (!cleaned) return "";
  if (cleaned === "-" || cleaned === "+") return cleaned;
  if (cleaned === ".") return ".";
  if (cleaned === "-.") return "-.";
  if (cleaned === "+.") return "+.";
  const sign = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/[^0-9.]/g, "");
  const parts = unsigned.split(".");
  const intDigits = parts[0] ?? "";
  const decimalDigits = parts[1] ?? "";
  const intFormatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (unsigned.includes(".")) {
    return `${sign}${intFormatted || "0"}.${decimalDigits}`;
  }
  return `${sign}${intFormatted || "0"}`;
}

export function splitNumberPrefix(value?: number | null) {
  const formatted = formatNumber(value);
  const commaIndex = formatted.indexOf(",");
  if (commaIndex === -1) return { prefix: formatted, rest: "" };
  return { prefix: formatted.slice(0, commaIndex), rest: formatted.slice(commaIndex) };
}

export function splitFormattedNumberParts(value: string) {
  const [intPart, decimalPart] = value.split(".");
  const base = intPart ?? "";
  const lastCommaIndex = base.lastIndexOf(",");
  const prefix = lastCommaIndex === -1 ? base : base.slice(0, lastCommaIndex);
  const rest = lastCommaIndex === -1 ? "" : base.slice(lastCommaIndex);
  const decimal = decimalPart !== undefined ? `.${decimalPart}` : "";
  return { prefix, rest, decimal };
}
