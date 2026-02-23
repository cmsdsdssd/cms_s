export const formatKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

export const formatSignedKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}₩${new Intl.NumberFormat("ko-KR").format(Math.round(abs))}`;
};

export const formatPercent = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
};

export const toNumber = (value: unknown, fallback = 0) => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replaceAll(",", ""))
        : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const getKstYmd = () => {
  const now = new Date();
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("/", "-");
};

export const getKstYmdOffset = (days: number) => {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("/", "-");
  const base = new Date(`${ymd}T00:00:00+09:00`);
  base.setDate(base.getDate() + days);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(base)
    .replaceAll("/", "-");
};

export const clampLimit = (value: number, min = 1, max = 1000) =>
  Math.max(min, Math.min(max, value));

export const diffDaysInclusive = (fromYmd: string, toYmd: string) => {
  const from = new Date(`${fromYmd}T00:00:00+09:00`);
  const to = new Date(`${toYmd}T00:00:00+09:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diff = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
};

export const toCsv = (rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(raw)) {
      return `"${raw.replaceAll('"', '""')}"`;
    }
    return raw;
  };
  const body = rows
    .map((row) => headers.map((h) => escape(row[h])).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}`;
};

export const downloadCsv = (filename: string, csvText: string) => {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
