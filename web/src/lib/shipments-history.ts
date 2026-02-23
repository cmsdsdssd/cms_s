export type ShipmentHistoryHeaderRow = {
  shipment_id?: string | null;
  ship_date?: string | null;
  status?: string | null;
  customer_party_id?: string | null;
  is_store_pickup?: boolean | null;
  customer?: { name?: string | null } | null;
};

export type ShipmentHistoryLineRow = {
  shipment_line_id?: string | null;
  shipment_id?: string | null;
  order_line_id?: string | null;
  master_id?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  size?: string | null;
  material_code?: string | null;
  qty?: number | null;
  measured_weight_g?: number | null;
  deduction_weight_g?: number | null;
  net_weight_g?: number | null;
  base_labor_krw?: number | null;
  extra_labor_krw?: number | null;
  labor_total_sell_krw?: number | null;
  material_amount_sell_krw?: number | null;
  total_amount_sell_krw?: number | null;
  created_at?: string | null;
};

export type ShipmentHistoryInvoiceRow = {
  shipment_line_id?: string | null;
  commodity_due_g?: number | null;
  commodity_price_snapshot_krw_per_g?: number | null;
  labor_cash_due_krw?: number | null;
  material_cash_due_krw?: number | null;
  total_cash_due_krw?: number | null;
};

export type ShipmentHistoryRow = {
  shipment_id: string;
  shipment_line_id: string;
  order_line_id: string;
  master_id: string;
  ship_date: string;
  status: string;
  customer_party_id: string;
  customer_name: string;
  model_name: string;
  suffix: string;
  color: string;
  size: string;
  model_display: string;
  material_code: string;
  is_unit_pricing: boolean;
  qty: number;
  net_weight_g: number;
  commodity_due_g: number | null;
  commodity_price_snapshot_krw_per_g: number | null;
  labor_total_sell_krw: number;
  labor_breakdown_sum_krw: number | null;
  labor_consistent: boolean;
  material_amount_sell_krw: number;
  total_amount_sell_krw: number;
  created_at: string;
  is_store_pickup: boolean;
};

export type GroupByKey = "date" | "customer" | "model";

export type ShipmentHistoryGroup = {
  key: string;
  label: string;
  rows: ShipmentHistoryRow[];
  count: number;
  sumQty: number;
  sumTotalKrw: number;
};

export type ShipmentHistoryFilterState = {
  searchText: string;
  selectedCustomerId: string;
  selectedModel: string;
};

export const toSafeText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replaceAll(",", ""))
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatKrw = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

export const formatGram = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(value)}g`;
};

export const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getKstYmd = () => {
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return text.replaceAll("/", "-");
};

export const getKstYmdOffset = (days: number) => {
  const base = new Date(`${getKstYmd()}T00:00:00+09:00`);
  base.setDate(base.getDate() + days);
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
  return text.replaceAll("/", "-");
};

const buildModelDisplay = (line: ShipmentHistoryLineRow) => {
  const model = toSafeText(line.model_name, "-");
  const details = [line.suffix, line.color, line.size]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" / ");
  return details ? `${model} / ${details}` : model;
};

export const combineShipmentRows = (
  headers: ShipmentHistoryHeaderRow[],
  lines: ShipmentHistoryLineRow[],
  invoices: ShipmentHistoryInvoiceRow[] = [],
  unitPricingMasterIds: Set<string> = new Set<string>(),
  unitPricingModelNames: Set<string> = new Set<string>()
): ShipmentHistoryRow[] => {
  const headerByShipmentId = new Map<string, ShipmentHistoryHeaderRow>();
  const invoiceByShipmentLineId = new Map<string, ShipmentHistoryInvoiceRow>();

  headers.forEach((header) => {
    const shipmentId = String(header.shipment_id ?? "").trim();
    if (!shipmentId) return;
    headerByShipmentId.set(shipmentId, header);
  });

  invoices.forEach((invoice) => {
    const shipmentLineId = String(invoice.shipment_line_id ?? "").trim();
    if (!shipmentLineId) return;
    invoiceByShipmentLineId.set(shipmentLineId, invoice);
  });

  return lines
    .map((line) => {
      const shipmentId = String(line.shipment_id ?? "").trim();
      const shipmentLineId = String(line.shipment_line_id ?? "").trim();
      if (!shipmentId || !shipmentLineId) return null;

      const header = headerByShipmentId.get(shipmentId);
      if (!header) return null;
      const masterId = String(line.master_id ?? "").trim();
      const modelNameKey = String(line.model_name ?? "").trim();

      const shipDate = String(header.ship_date ?? "").trim();
      const status = toSafeText(header.status, "-");
      const customerPartyId = String(header.customer_party_id ?? "").trim();
      const customerName = toSafeText(header.customer?.name, "(미지정)");
      const createdAt = String(line.created_at ?? "").trim() || `${shipDate}T00:00:00+09:00`;
      const invoice = invoiceByShipmentLineId.get(shipmentLineId);

      const measuredWeight = toFiniteNumber(line.measured_weight_g, Number.NaN);
      const deductionWeight = toFiniteNumber(line.deduction_weight_g, Number.NaN);
      const directNetWeight = toFiniteNumber(line.net_weight_g, Number.NaN);
      const derivedNetWeight =
        Number.isFinite(measuredWeight) && Number.isFinite(deductionWeight)
          ? measuredWeight - deductionWeight
          : Number.NaN;
      const invoiceCommodityG = toFiniteNumber(invoice?.commodity_due_g, Number.NaN);
      const effectiveProductWeight = Number.isFinite(directNetWeight)
        ? directNetWeight
        : Number.isFinite(derivedNetWeight)
          ? derivedNetWeight
          : Number.isFinite(measuredWeight)
            ? measuredWeight
            : 0;

      const lineLabor = toFiniteNumber(line.labor_total_sell_krw, Number.NaN);
      const lineBaseLabor = toFiniteNumber(line.base_labor_krw, Number.NaN);
      const lineExtraLabor = toFiniteNumber(line.extra_labor_krw, Number.NaN);
      const lineMaterial = toFiniteNumber(line.material_amount_sell_krw, Number.NaN);
      const lineTotal = toFiniteNumber(line.total_amount_sell_krw, Number.NaN);

      const invoiceLabor = toFiniteNumber(invoice?.labor_cash_due_krw, Number.NaN);
      const invoiceMaterial = toFiniteNumber(invoice?.material_cash_due_krw, Number.NaN);
      const invoiceTotal = toFiniteNumber(invoice?.total_cash_due_krw, Number.NaN);
      const invoicePricePerG = toFiniteNumber(invoice?.commodity_price_snapshot_krw_per_g, Number.NaN);

      const isUnitPricing =
        (masterId ? unitPricingMasterIds.has(masterId) : false) ||
        (modelNameKey ? unitPricingModelNames.has(modelNameKey) : false);
      const effectiveLabor = Number.isFinite(invoiceLabor) ? invoiceLabor : Number.isFinite(lineLabor) ? lineLabor : 0;
      const laborBreakdownSum =
        Number.isFinite(lineBaseLabor) && Number.isFinite(lineExtraLabor)
          ? lineBaseLabor + lineExtraLabor
          : null;

      const effectiveMaterial = Number.isFinite(invoiceMaterial)
        ? invoiceMaterial
        : Number.isFinite(lineMaterial)
          ? lineMaterial
          : 0;
      const effectiveTotal = Number.isFinite(invoiceTotal)
        ? invoiceTotal
        : Number.isFinite(lineTotal)
          ? lineTotal
          : effectiveLabor + effectiveMaterial;

      const sourceLineTotal = Number.isFinite(lineTotal)
        ? lineTotal
        : Number.isFinite(lineLabor) && Number.isFinite(lineMaterial)
          ? lineLabor + lineMaterial
          : effectiveTotal;
      const laborSplitConsistent =
        laborBreakdownSum === null ? false : Math.abs(laborBreakdownSum - effectiveLabor) <= 0.5;
      const totalConsistent = Math.abs(effectiveTotal - sourceLineTotal) <= 1;
      const laborConsistent = laborSplitConsistent || totalConsistent;

      const effectiveCommodityDueG = Number.isFinite(invoiceCommodityG)
        ? invoiceCommodityG
        : isUnitPricing && effectiveProductWeight > 0
          ? effectiveProductWeight
          : null;
      const effectivePricePerG = Number.isFinite(invoicePricePerG)
        ? invoicePricePerG
        : isUnitPricing && effectiveCommodityDueG !== null && effectiveCommodityDueG > 0
          ? effectiveMaterial / effectiveCommodityDueG
          : null;

      return {
        shipment_id: shipmentId,
        shipment_line_id: shipmentLineId,
        order_line_id: String(line.order_line_id ?? "").trim(),
        master_id: masterId,
        ship_date: shipDate,
        status,
        customer_party_id: customerPartyId,
        customer_name: customerName,
        model_name: toSafeText(line.model_name, "-"),
        suffix: toSafeText(line.suffix, ""),
        color: toSafeText(line.color, ""),
        size: toSafeText(line.size, ""),
        model_display: buildModelDisplay(line),
        material_code: toSafeText(line.material_code, "-"),
        is_unit_pricing: isUnitPricing,
        qty: Math.max(toFiniteNumber(line.qty, 0), 0),
        net_weight_g: effectiveProductWeight,
        commodity_due_g: effectiveCommodityDueG,
        commodity_price_snapshot_krw_per_g: effectivePricePerG,
        labor_total_sell_krw: effectiveLabor,
        labor_breakdown_sum_krw: laborBreakdownSum,
        labor_consistent: laborConsistent,
        material_amount_sell_krw: effectiveMaterial,
        total_amount_sell_krw: effectiveTotal,
        created_at: createdAt,
        is_store_pickup: header.is_store_pickup === true,
      } satisfies ShipmentHistoryRow;
    })
    .filter((row): row is ShipmentHistoryRow => row !== null);
};

export const filterShipmentRows = (rows: ShipmentHistoryRow[], filters: ShipmentHistoryFilterState) => {
  const search = filters.searchText.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.selectedCustomerId !== "ALL" && row.customer_party_id !== filters.selectedCustomerId) {
      return false;
    }
    if (filters.selectedModel !== "ALL" && row.model_name !== filters.selectedModel) {
      return false;
    }
    if (!search) return true;
    return [row.customer_name, row.model_display, row.ship_date]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
};

const buildGroupKey = (row: ShipmentHistoryRow, groupBy: GroupByKey) => {
  if (groupBy === "date") return `date:${row.ship_date}`;
  if (groupBy === "customer") return `customer:${row.customer_party_id || "unknown"}`;
  return `model:${row.model_name}`;
};

const buildGroupLabel = (row: ShipmentHistoryRow, groupBy: GroupByKey) => {
  if (groupBy === "date") return row.ship_date;
  if (groupBy === "customer") return row.customer_name;
  return row.model_name;
};

export const groupShipmentRows = (rows: ShipmentHistoryRow[], groupBy: GroupByKey): ShipmentHistoryGroup[] => {
  const grouped = new Map<string, ShipmentHistoryGroup>();
  rows.forEach((row) => {
    const key = buildGroupKey(row, groupBy);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        key,
        label: buildGroupLabel(row, groupBy),
        rows: [row],
        count: 1,
        sumQty: row.qty,
        sumTotalKrw: row.total_amount_sell_krw,
      });
      return;
    }
    existing.rows.push(row);
    existing.count += 1;
    existing.sumQty += row.qty;
    existing.sumTotalKrw += row.total_amount_sell_krw;
  });

  const groups = Array.from(grouped.values());
  groups.forEach((group) => {
    group.rows.sort((a, b) => {
      if (a.ship_date !== b.ship_date) return a.ship_date < b.ship_date ? 1 : -1;
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
      return a.shipment_line_id.localeCompare(b.shipment_line_id, "ko-KR");
    });
  });

  groups.sort((a, b) => {
    if (groupBy === "date") return a.label < b.label ? 1 : -1;
    const labelCompare = a.label.localeCompare(b.label, "ko-KR");
    if (labelCompare !== 0) return labelCompare;
    return b.count - a.count;
  });

  return groups;
};
