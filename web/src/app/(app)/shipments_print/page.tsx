"use client";

import { useMemo, useState, Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { ReceiptPrintHalf, type ReceiptAmounts, type ReceiptLineItem } from "@/components/receipt/receipt-print";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentHeaderRow = {
  shipment_id?: string;
  ship_date?: string | null;
  confirmed_at?: string | null;
  is_store_pickup?: boolean | null;
  memo?: string | null;
  customer_party_id?: string | null;
  customer?: { name?: string | null } | null;
  cms_shipment_line?: Array<{
    shipment_line_id?: string | null;
    repair_line_id?: string | null;
    model_name?: string | null;
    qty?: number | null;
    material_code?: string | null;
    net_weight_g?: number | null;
    color?: string | null;
    size?: string | null;
    labor_total_sell_krw?: number | null;
    material_amount_sell_krw?: number | null;
    repair_fee_krw?: number | null;
    total_amount_sell_krw?: number | null;
    gold_tick_krw_per_g?: number | null;
    silver_tick_krw_per_g?: number | null;
    silver_adjust_factor?: number | null;
  }> | null;
};

type ReturnLineRow = {
  return_line_id?: string | null;
  occurred_at?: string | null;
  return_qty?: number | null;
  final_return_amount_krw?: number | null;
  cms_shipment_line?: {
    shipment_line_id?: string | null;
    repair_line_id?: string | null;
    model_name?: string | null;
    qty?: number | null;
    material_code?: string | null;
    net_weight_g?: number | null;
    color?: string | null;
    size?: string | null;
    labor_total_sell_krw?: number | null;
    material_amount_sell_krw?: number | null;
    repair_fee_krw?: number | null;
    total_amount_sell_krw?: number | null;
    gold_tick_krw_per_g?: number | null;
    silver_tick_krw_per_g?: number | null;
    silver_adjust_factor?: number | null;
    shipment_header?: {
      customer_party_id?: string | null;
      is_store_pickup?: boolean | null;
      customer?: { name?: string | null } | null;
    } | null;
  } | null;
};

type ReceiptLine = ReceiptLineItem & {
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
    is_store_pickup?: boolean | null;
    customer?: { name?: string | null } | null;
  } | null;
};

type Amounts = ReceiptAmounts;

type ArPositionRow = {
  party_id?: string | null;
  receivable_krw?: number | null;
  labor_cash_outstanding_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
};

type ArPositionAsOfRow = {
  party_id?: string | null;
  receivable_krw?: number | null;
  labor_cash_outstanding_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
};

type ArPaymentAllocTodayRow = {
  shipment_line_id?: string | null;
  alloc_labor_krw?: number | null;
  alloc_material_krw?: number | null;
  alloc_gold_g?: number | null;
  alloc_silver_g?: number | null;
};

type ArInvoiceRatioRow = {
  shipment_line_id?: string | null;
  labor_cash_due_krw?: number | null;
  material_cash_due_krw?: number | null;
  total_cash_due_krw?: number | null;
};

type MasterItemRow = {
  model_name?: string | null;
  is_unit_pricing?: boolean | null;
};


type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ReceiptLine[];
  totals: Amounts;
  today: Amounts;
  todaySales: Amounts;
  todayReturns: Amounts;
  todayAdjustments: Amounts;
  previous: Amounts;
  previousLabel?: string;
};

const hasReturnAmounts = (amounts: Amounts) => {
  const epsilon = 0.000001;
  return (
    Math.abs(amounts.gold) > epsilon ||
    Math.abs(amounts.silver) > epsilon ||
    Math.abs(amounts.labor) > epsilon ||
    Math.abs(amounts.total) > epsilon
  );
};

const hasVisibleKrwDelta = (amounts: Amounts) => {
  const roundedTotal = Math.round(Number(amounts.total ?? 0));
  const roundedLabor = Math.round(Number(amounts.labor ?? 0));
  const roundedGold = Math.round(Number(amounts.gold ?? 0) * 1000) / 1000;
  const roundedSilver = Math.round(Number(amounts.silver ?? 0) * 1000) / 1000;
  return roundedTotal !== 0 || roundedLabor !== 0 || roundedGold !== 0 || roundedSilver !== 0;
};

const isSameRoundedAmounts = (a: Amounts, b: Amounts) => {
  const round3 = (v: number) => Math.round(v * 1000) / 1000;
  return (
    Math.round(Number(a.total ?? 0)) === Math.round(Number(b.total ?? 0)) &&
    Math.round(Number(a.labor ?? 0)) === Math.round(Number(b.labor ?? 0)) &&
    round3(Number(a.gold ?? 0)) === round3(Number(b.gold ?? 0)) &&
    round3(Number(a.silver ?? 0)) === round3(Number(b.silver ?? 0))
  );
};

const buildSummaryRows = (page: PartyReceiptPage) => {
  const rows = [
    { label: "합계", value: page.totals },
    { label: page.previousLabel ?? "이전 미수", value: page.previous },
    { label: "당일 출고", value: page.todaySales },
  ];
  if (hasReturnAmounts(page.todayReturns)) {
    rows.push({ label: "당일 반품", value: page.todayReturns });
  }
  if (hasVisibleKrwDelta(page.todayAdjustments)) {
    rows.push({ label: "당일 결제/조정", value: page.todayAdjustments });
  }
  const hasMeaningfulDiffFromSales = !isSameRoundedAmounts(page.today, page.todaySales);
  if (hasMeaningfulDiffFromSales) {
    rows.push({ label: "당일 순증감", value: page.today });
  }
  return rows;
};

type ShipmentRow = {
  shipmentId: string;
  customerPartyId: string; // ✅ 추가
  customerName: string;
  shipDate: string | null;
  confirmedAt: string | null;
  memo: string | null;
  totalQty: number;
  totalLabor: number;
  totalAmount: number;
  models: string[];
};


const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

const getKstStartIso = (ymd: string) => `${ymd}T00:00:00+09:00`;

const getKstNextStartIso = (ymd: string) => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
};

const toKstPrintTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value).replace(" ", "-");

const normalizePrintedAt = (raw: string) => {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return toKstPrintTimestamp(parsed);
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const shiftYmd = (ymd: string, delta: number) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + delta * 86400000));


const zeroAmounts: Amounts = { gold: 0, silver: 0, labor: 0, total: 0 };

const addAmounts = (base: Amounts, add: Amounts) => ({
  gold: base.gold + add.gold,
  silver: base.silver + add.silver,
  labor: base.labor + add.labor,
  total: base.total + add.total,
});

const subtractAmounts = (base: Amounts, sub: Amounts) => ({
  gold: base.gold - sub.gold,
  silver: base.silver - sub.silver,
  labor: base.labor - sub.labor,
  total: base.total - sub.total,
});

const getMaterialBucket = (code?: string | null) => {
  const material = (code ?? "").trim();
  if (!material || material === "00") return { kind: "none" as const, factor: 0 };
  if (material === "14") return { kind: "gold" as const, factor: 0.6435 };
  if (material === "18") return { kind: "gold" as const, factor: 0.825 };
  if (material === "24") return { kind: "gold" as const, factor: 1 };
  if (material === "925") return { kind: "silver" as const, factor: 0.925 };
  if (material === "999") return { kind: "silver" as const, factor: 1 };
  return { kind: "none" as const, factor: 0 };
};

const hasRepairMaterialReceivable = (line: ReceiptLine) => {
  if (!line.is_repair) return true;
  const materialAmount = Number(line.material_amount_sell_krw ?? 0);
  const netWeight = Number(line.net_weight_g ?? 0);
  return materialAmount > 0 && netWeight > 0;
};

const toLineAmounts = (line: ReceiptLine): Amounts => {
  if (line.is_repair && !hasRepairMaterialReceivable(line)) {
    const repairLabor = Number(line.repair_fee_krw ?? 0);
    const total = Number(line.total_amount_sell_krw ?? 0);
    return { gold: 0, silver: 0, labor: repairLabor, total };
  }
  const netWeight = Number(line.net_weight_g ?? 0);
  const labor = Number(line.labor_total_sell_krw ?? 0);
  const total = Number(line.total_amount_sell_krw ?? 0);
  if (line.is_unit_pricing) {
    return { gold: 0, silver: 0, labor: 0, total };
  }
  const bucket = getMaterialBucket(line.material_code ?? null);
  if (bucket.kind === "none") {
    return { gold: 0, silver: 0, labor, total };
  }
  const silverAdjustFactor = Number(line.silver_adjust_factor ?? 1.2);
  const silverWeightFactor = (line.material_code ?? "").trim() === "925" ? silverAdjustFactor : 1;
  const weighted = netWeight * bucket.factor * (bucket.kind === "silver" ? silverWeightFactor : 1);
  return {
    gold: bucket.kind === "gold" ? weighted : 0,
    silver: bucket.kind === "silver" ? weighted : 0,
    labor,
    total,
  };
};

const toLineAmountsArAligned = (line: ReceiptLine): Amounts => {
  if (line.is_repair) {
    const repairLabor = Number(line.repair_fee_krw ?? 0);
    const total = Number(line.total_amount_sell_krw ?? 0);
    return { gold: 0, silver: 0, labor: repairLabor, total };
  }
  if (line.is_unit_pricing) {
    const total = Number(line.total_amount_sell_krw ?? 0);
    return { gold: 0, silver: 0, labor: total, total };
  }
  return toLineAmounts(line);
};


const chunkLines = (lines: ReceiptLine[], size: number) => {
  const chunks: ReceiptLine[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
};

const sumLineAmountsByParty = (
  lines: ReceiptLine[],
  toAmounts: (line: ReceiptLine) => Amounts = toLineAmounts
) => {
  const map = new Map<string, Amounts>();
  lines.forEach((line) => {
    const partyId = line.shipment_header?.customer_party_id ?? "";
    if (!partyId) return;
    const current = map.get(partyId) ?? { ...zeroAmounts };
    map.set(partyId, addAmounts(current, toAmounts(line)));
  });
  return map;
};

function ShipmentsPrintContent() {
  const schemaClient = getSchemaClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [targetShipmentId, setTargetShipmentId] = useState<string | null>(null);

  const mode = searchParams.get("mode") ?? "";
  const summaryParam = (searchParams.get("summary") ?? "").trim().toLowerCase();
  const summaryMode = summaryParam === "v1" ? "v1" : "v2";
  const isStorePickupMode = mode === "store_pickup";
  const filterPartyId = (searchParams.get("party_id") ?? "").trim();

  const dateParam = (searchParams.get("date") ?? "").trim();
  const printedAtParam = (searchParams.get("printed_at") ?? "").trim();
  const today = useMemo(() => (isValidYmd(dateParam) ? dateParam : getKstYmd()), [dateParam]);
  const printedAtLabel = useMemo(() => {
    const normalized = normalizePrintedAt(printedAtParam);
    if (normalized) return normalized;
    return `${today}-00:00:00`;
  }, [printedAtParam, today]);
  const activePartyId = filterPartyId || null;
  const todayStartIso = useMemo(() => getKstStartIso(today), [today]);
  const todayEndIso = useMemo(() => getKstNextStartIso(today), [today]);

  const updateQuery = useCallback(
    (next: { date?: string; mode?: "store_pickup" | ""; partyId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.date) {
        params.set("date", next.date);
      }
      if (next.mode === "store_pickup") {
        params.set("mode", "store_pickup");
      } else if (next.mode !== undefined) {
        params.delete("mode");
      }
      if (next.partyId) {
        params.set("party_id", next.partyId);
      } else if (next.partyId === null) {
        params.delete("party_id");
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [searchParams, router, pathname]
  );

  const shipmentsQuery = useQuery({
    queryKey: ["shipments-print", today, mode, filterPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, ship_date, confirmed_at, is_store_pickup, memo, customer_party_id, customer:cms_party(name), cms_shipment_line(shipment_line_id, repair_line_id, model_name, qty, material_code, net_weight_g, color, size, labor_total_sell_krw, material_amount_sell_krw, repair_fee_krw, total_amount_sell_krw, gold_tick_krw_per_g, silver_tick_krw_per_g, silver_adjust_factor)"
        )
        .eq("status", "CONFIRMED");

      if (isStorePickupMode) {
        const dateFilter = `ship_date.eq.${today},and(ship_date.is.null,confirmed_at.gte.${todayStartIso},confirmed_at.lt.${todayEndIso})`;
        query = query.eq("is_store_pickup", true).or(dateFilter);
        if (filterPartyId) {
          query = query.eq("customer_party_id", filterPartyId);
        }
      } else {
        const nonStorePickup = "or(is_store_pickup.is.null,is_store_pickup.eq.false)";
        const dateFilter = `and(${nonStorePickup},ship_date.eq.${today}),and(${nonStorePickup},confirmed_at.gte.${todayStartIso},confirmed_at.lt.${todayEndIso})`;
        query = query.or(dateFilter);
        if (filterPartyId) {
          query = query.eq("customer_party_id", filterPartyId);
        }
      }

      const { data, error } = await query.order("confirmed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShipmentHeaderRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const returnsQuery = useQuery({
    queryKey: ["shipments-print-returns", today, mode, filterPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      let query = schemaClient
        .from("cms_return_line")
        .select(
          "return_line_id, occurred_at, return_qty, final_return_amount_krw, cms_shipment_line!inner(shipment_line_id, repair_line_id, model_name, qty, material_code, net_weight_g, color, size, labor_total_sell_krw, material_amount_sell_krw, repair_fee_krw, total_amount_sell_krw, gold_tick_krw_per_g, silver_tick_krw_per_g, silver_adjust_factor, shipment_header:cms_shipment_header(customer_party_id, is_store_pickup, customer:cms_party(name)))"
        )
        .gte("occurred_at", todayStartIso)
        .lt("occurred_at", todayEndIso)
        .order("occurred_at", { ascending: true });

      if (filterPartyId) {
        query = query.eq("cms_shipment_line.shipment_header.customer_party_id", filterPartyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReturnLineRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const returnShipmentLineIds = useMemo(() => {
    const ids = new Set<string>();
    (returnsQuery.data ?? []).forEach((row) => {
      const id = row.cms_shipment_line?.shipment_line_id ?? "";
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [returnsQuery.data]);

  const returnInvoiceRatiosQuery = useQuery({
    queryKey: ["shipments-print-return-invoice-ratios", returnShipmentLineIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (returnShipmentLineIds.length === 0) return [] as ArInvoiceRatioRow[];
      const { data, error } = await schemaClient
        .from("cms_v_ar_invoice_position_v1")
        .select("shipment_line_id, labor_cash_due_krw, material_cash_due_krw, total_cash_due_krw")
        .in("shipment_line_id", returnShipmentLineIds);
      if (error) throw error;
      return (data ?? []) as ArInvoiceRatioRow[];
    },
    enabled: Boolean(schemaClient) && returnShipmentLineIds.length > 0,
  });

  const returnInvoiceRatioMap = useMemo(() => {
    const map = new Map<string, { laborRatio: number; materialRatio: number }>();
    (returnInvoiceRatiosQuery.data ?? []).forEach((row) => {
      const lineId = row.shipment_line_id ?? "";
      if (!lineId || map.has(lineId)) return;
      const totalDue = Math.max(Number(row.total_cash_due_krw ?? 0), 0);
      const laborDue = Math.max(Number(row.labor_cash_due_krw ?? 0), 0);
      const materialDue = Math.max(Number(row.material_cash_due_krw ?? 0), 0);
      if (totalDue <= 0) {
        map.set(lineId, { laborRatio: 0, materialRatio: 0 });
        return;
      }
      map.set(lineId, {
        laborRatio: laborDue / totalDue,
        materialRatio: materialDue / totalDue,
      });
    });
    return map;
  }, [returnInvoiceRatiosQuery.data]);

  const modelNames = useMemo(() => {
    const names = new Set<string>();
    (shipmentsQuery.data ?? []).forEach((row) => {
      (row.cms_shipment_line ?? []).forEach((line) => {
        const name = (line.model_name ?? "").trim();
        if (name) names.add(name);
      });
    });
    (returnsQuery.data ?? []).forEach((row) => {
      const name = (row.cms_shipment_line?.model_name ?? "").trim();
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [shipmentsQuery.data, returnsQuery.data]);

  const masterItemsQuery = useQuery({
    queryKey: ["shipments-print-master-items", modelNames.join("|")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (modelNames.length === 0) return [] as MasterItemRow[];
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("model_name, is_unit_pricing")
        .in("model_name", modelNames);
      if (error) throw error;
      return (data ?? []) as MasterItemRow[];
    },
    enabled: Boolean(schemaClient) && modelNames.length > 0,
  });

  const unitPricingMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (masterItemsQuery.data ?? []).forEach((row) => {
      const name = (row.model_name ?? "").trim();
      if (!name) return;
      map.set(name, Boolean(row.is_unit_pricing));
    });
    return map;
  }, [masterItemsQuery.data]);

  const shipments = useMemo<ShipmentRow[]>(() => {
    return (shipmentsQuery.data ?? [])
      .filter((row) => (isStorePickupMode ? row.is_store_pickup : !row.is_store_pickup))
      .map((row) => {
        const lines = row.cms_shipment_line ?? [];
        const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
        const totalLabor = lines.reduce((sum, line) => sum + Number(line.labor_total_sell_krw ?? 0), 0);
        const totalAmount = lines.reduce((sum, line) => sum + Number(line.total_amount_sell_krw ?? 0), 0);
        const models = lines
          .map((line) => (line.model_name ?? "-").trim())
          .filter(Boolean);

        return {
          shipmentId: row.shipment_id ?? "",
          customerPartyId: row.customer_party_id ?? "", // ✅ 추가
          customerName: row.customer?.name ?? "-",
          shipDate: row.ship_date ?? null,
          confirmedAt: row.confirmed_at ?? null,
          memo: row.memo ?? null,
          totalQty,
          totalLabor,
          totalAmount,
          models,
        };
      })
      .filter((row) => Boolean(row.shipmentId));
  }, [shipmentsQuery.data, isStorePickupMode]);
  const resetTargets = useMemo(() => {
    if (!activePartyId) return shipments;
    return shipments.filter((s) => s.customerPartyId === activePartyId);
  }, [shipments, activePartyId]);

  const todaySalesLines = useMemo<ReceiptLine[]>(() => {
    return (shipmentsQuery.data ?? [])
      .filter((row) => (isStorePickupMode ? row.is_store_pickup : !row.is_store_pickup))
      .flatMap((row) => {
        const header = {
          ship_date: row.ship_date ?? null,
          status: "CONFIRMED",
          customer_party_id: row.customer_party_id ?? null,
          is_store_pickup: row.is_store_pickup ?? null,
          customer: row.customer ?? null,
        };
        return (row.cms_shipment_line ?? []).map((line) => ({
          is_unit_pricing: unitPricingMap.get((line.model_name ?? "").trim()) ?? false,
          is_repair: Boolean(line.repair_line_id),
          shipment_line_id: line.shipment_line_id ?? undefined,
          model_name: line.model_name ?? null,
          qty: line.qty ?? null,
          material_code: line.material_code ?? null,
          net_weight_g: line.net_weight_g ?? null,
          color: line.color ?? null,
          size: line.size ?? null,
          labor_total_sell_krw: line.labor_total_sell_krw ?? null,
          material_amount_sell_krw: line.material_amount_sell_krw ?? null,
          repair_fee_krw: line.repair_fee_krw ?? null,
          total_amount_sell_krw: line.total_amount_sell_krw ?? null,
          gold_tick_krw_per_g: line.gold_tick_krw_per_g ?? null,
          silver_tick_krw_per_g: line.silver_tick_krw_per_g ?? null,
          silver_adjust_factor: line.silver_adjust_factor ?? null,
          shipment_header: header,
        }));
      });
  }, [shipmentsQuery.data, isStorePickupMode, unitPricingMap]);

  const todayReturnLines = useMemo<ReceiptLine[]>(() => {
    return (returnsQuery.data ?? [])
      .filter((row) => {
        const isStorePickup = Boolean(row.cms_shipment_line?.shipment_header?.is_store_pickup);
        return isStorePickupMode ? isStorePickup : !isStorePickup;
      })
      .map((row) => {
        const source = row.cms_shipment_line;
        const modelName = (source?.model_name ?? "").trim();
        const isUnitPricing = unitPricingMap.get(modelName) ?? false;
        const returnQty = Math.max(Number(row.return_qty ?? 0), 0);
        const sourceLineId = source?.shipment_line_id ?? "";
        const sourceQty = Math.max(Number(source?.qty ?? 0), 1);
        const netWeight = Number(source?.net_weight_g ?? 0);
        const labor = Number(source?.labor_total_sell_krw ?? 0);
        const material = Number(source?.material_amount_sell_krw ?? 0);
        const total = Number(source?.total_amount_sell_krw ?? 0);
        const unitNetWeight = netWeight / sourceQty;
        const unitTotal = total / sourceQty;
        const overrideTotal = row.final_return_amount_krw;
        const estimatedReturnTotal = Math.abs(unitTotal * returnQty);
        const returnTotal =
          overrideTotal === null || overrideTotal === undefined
            ? estimatedReturnTotal
            : Math.abs(Number(overrideTotal));
        const ratioFromInvoice = returnInvoiceRatioMap.get(sourceLineId);
        const sourceTotalAbs = Math.abs(total);
        const laborRatio =
          ratioFromInvoice?.laborRatio ?? (sourceTotalAbs > 0 ? Math.abs(labor) / sourceTotalAbs : 0);
        const materialRatio =
          ratioFromInvoice?.materialRatio ?? (sourceTotalAbs > 0 ? Math.abs(material) / sourceTotalAbs : 0);
        const ratioSum = laborRatio + materialRatio;
        const normalizedLaborRatio = ratioSum > 0 ? laborRatio / ratioSum : 0;
        const normalizedMaterialRatio = ratioSum > 0 ? materialRatio / ratioSum : 0;
        return {
          is_return: true,
          is_repair: Boolean(source?.repair_line_id),
          is_unit_pricing: isUnitPricing,
          shipment_line_id: row.return_line_id ?? source?.shipment_line_id ?? undefined,
          model_name: source?.model_name ?? null,
          qty: returnQty,
          material_code: source?.material_code ?? null,
          net_weight_g: isUnitPricing ? 0 : -Math.abs(unitNetWeight * returnQty),
          color: source?.color ?? null,
          size: source?.size ?? null,
          labor_total_sell_krw: isUnitPricing ? 0 : -Math.abs(returnTotal * normalizedLaborRatio),
          material_amount_sell_krw: isUnitPricing ? 0 : -Math.abs(returnTotal * normalizedMaterialRatio),
          repair_fee_krw: 0,
          total_amount_sell_krw: -Math.abs(returnTotal),
          gold_tick_krw_per_g: source?.gold_tick_krw_per_g ?? null,
          silver_tick_krw_per_g: source?.silver_tick_krw_per_g ?? null,
          silver_adjust_factor: source?.silver_adjust_factor ?? null,
          shipment_header: {
            ship_date: null,
            status: "RETURNED",
            customer_party_id: source?.shipment_header?.customer_party_id ?? null,
            is_store_pickup: source?.shipment_header?.is_store_pickup ?? null,
            customer: source?.shipment_header?.customer ?? null,
          },
        };
      })
      .filter((line) => (line.shipment_header?.customer_party_id ?? "").length > 0 && Number(line.qty ?? 0) > 0);
  }, [returnsQuery.data, isStorePickupMode, unitPricingMap, returnInvoiceRatioMap]);

  const todayLines = useMemo<ReceiptLine[]>(() => {
    return [...todaySalesLines, ...todayReturnLines];
  }, [todaySalesLines, todayReturnLines]);

  const partyGroups = useMemo(() => {
    const map = new Map<string, { partyId: string; partyName: string; lines: ReceiptLine[] }>();
    todayLines.forEach((line) => {
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!partyId) return;
      const partyName = line.shipment_header?.customer?.name ?? "-";
      const entry = map.get(partyId) ?? { partyId, partyName, lines: [] };
      entry.lines.push(line);
      map.set(partyId, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.partyName.localeCompare(b.partyName, "ko-KR"));
  }, [todayLines]);

  const partyIds = useMemo(() => partyGroups.map((group) => group.partyId), [partyGroups]);

  const arPositionsQuery = useQuery({
    queryKey: ["shipments-print-ar", partyIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ArPositionRow[];
      const { data, error } = await schemaClient
        .from("cms_v_ar_position_by_party_v2")
        .select("party_id, receivable_krw, labor_cash_outstanding_krw, gold_outstanding_g, silver_outstanding_g")
        .in("party_id", partyIds);
      if (error) throw error;
      return (data ?? []) as ArPositionRow[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0,
  });

  const arAsOfPositionsQuery = useQuery({
    queryKey: ["shipments-print-ar-asof", partyIds.join(","), todayStartIso, summaryMode],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (partyIds.length === 0) return [] as ArPositionAsOfRow[];
      const { data, error } = await schemaClient.rpc("cms_fn_ar_position_asof_v1", {
        p_party_ids: partyIds,
        p_asof: todayStartIso,
      });
      if (error) throw error;
      return (data ?? []) as ArPositionAsOfRow[];
    },
    enabled: Boolean(schemaClient) && partyIds.length > 0 && summaryMode === "v2",
    retry: false,
  });

  const todayShipmentLinePartyMap = useMemo(() => {
    const map = new Map<string, string>();
    todaySalesLines.forEach((line) => {
      const shipmentLineId = line.shipment_line_id ?? "";
      const partyId = line.shipment_header?.customer_party_id ?? "";
      if (!shipmentLineId || !partyId) return;
      map.set(shipmentLineId, partyId);
    });
    return map;
  }, [todaySalesLines]);

  const todayShipmentLineIds = useMemo(
    () => Array.from(todayShipmentLinePartyMap.keys()),
    [todayShipmentLinePartyMap]
  );

  const arTodayPaymentAllocQuery = useQuery({
    queryKey: ["shipments-print-ar-payment-alloc-today", todayShipmentLineIds.join(","), todayStartIso, todayEndIso],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (todayShipmentLineIds.length === 0) return [] as ArPaymentAllocTodayRow[];
      const { data, error } = await schemaClient
        .from("cms_v_ar_payment_alloc_detail_v1")
        .select("shipment_line_id, alloc_labor_krw, alloc_material_krw, alloc_gold_g, alloc_silver_g")
        .gte("paid_at", todayStartIso)
        .lt("paid_at", todayEndIso)
        .in("shipment_line_id", todayShipmentLineIds);
      if (error) throw error;
      return (data ?? []) as ArPaymentAllocTodayRow[];
    },
    enabled: Boolean(schemaClient) && todayShipmentLineIds.length > 0,
  });


  const arTotalsMap = useMemo(() => {
    return new Map(
      (arPositionsQuery.data ?? []).map((row) => [
        row.party_id ?? "",
        {
          gold: Number(row.gold_outstanding_g ?? 0),
          silver: Number(row.silver_outstanding_g ?? 0),
          labor: Number(row.labor_cash_outstanding_krw ?? 0),
          total: Number(row.receivable_krw ?? 0),
        },
      ])
    );
  }, [arPositionsQuery.data]);

  const arAsOfTotalsMap = useMemo(() => {
    return new Map(
      (arAsOfPositionsQuery.data ?? []).map((row) => [
        row.party_id ?? "",
        {
          gold: Number(row.gold_outstanding_g ?? 0),
          silver: Number(row.silver_outstanding_g ?? 0),
          labor: Number(row.labor_cash_outstanding_krw ?? 0),
          total: Number(row.receivable_krw ?? 0),
        },
      ])
    );
  }, [arAsOfPositionsQuery.data]);

  const todayAdjustmentsByParty = useMemo(() => {
    const map = new Map<string, Amounts>();
    (arTodayPaymentAllocQuery.data ?? []).forEach((row) => {
      const shipmentLineId = row.shipment_line_id ?? "";
      const partyId = todayShipmentLinePartyMap.get(shipmentLineId) ?? "";
      if (!partyId) return;
      const labor = Number(row.alloc_labor_krw ?? 0);
      const material = Number(row.alloc_material_krw ?? 0);
      const gold = Number(row.alloc_gold_g ?? 0);
      const silver = Number(row.alloc_silver_g ?? 0);
      const current = map.get(partyId) ?? { ...zeroAmounts };
      map.set(partyId, {
        gold: current.gold - gold,
        silver: current.silver - silver,
        labor: current.labor - labor,
        total: current.total - (labor + material),
      });
    });
    return map;
  }, [arTodayPaymentAllocQuery.data, todayShipmentLinePartyMap]);


  const todayByParty = useMemo(() => sumLineAmountsByParty(todayLines), [todayLines]);
  const todaySalesArByParty = useMemo(
    () => sumLineAmountsByParty(todaySalesLines, toLineAmountsArAligned),
    [todaySalesLines]
  );
  const todayReturnsArByParty = useMemo(
    () => sumLineAmountsByParty(todayReturnLines, toLineAmountsArAligned),
    [todayReturnLines]
  );

  const receiptPages = useMemo(() => {
    const result: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const chunks = chunkLines(group.lines, 15);
      const totals = arTotalsMap.get(group.partyId) ?? { ...zeroAmounts };

      const todaySalesAr = todaySalesArByParty.get(group.partyId) ?? { ...zeroAmounts };
      const todayReturnsAr = todayReturnsArByParty.get(group.partyId) ?? { ...zeroAmounts };
      const todayNetAr = addAmounts(todaySalesAr, todayReturnsAr);

      const previousSummaryLegacy = subtractAmounts(totals, todayNetAr);
      const previousSummaryAsOf = arAsOfTotalsMap.get(group.partyId) ?? null;
      const useAsOfSummary = summaryMode === "v2" && previousSummaryAsOf !== null;
      const previousSummary = useAsOfSummary ? previousSummaryAsOf : previousSummaryLegacy;
      const totalsSummary = totals;
      const todayAdjustments = todayAdjustmentsByParty.get(group.partyId) ?? { ...zeroAmounts };
      const todaySummary = addAmounts(todayNetAr, todayAdjustments);
      chunks.forEach((chunk) => {
        result.push({
          partyId: group.partyId,
          partyName: group.partyName,
          lines: chunk,
          totals: totalsSummary,
          today: todaySummary,
          todaySales: todaySalesAr,
          todayReturns: todayReturnsAr,
          todayAdjustments,
          previous: previousSummary,
          previousLabel: useAsOfSummary ? "이전 미수(기준시점)" : "이전 미수(역산)",
        });
      });
    });

    if (result.length === 0) {
      result.push({
        partyId: "empty",
        partyName: "-",
        lines: [],
        totals: { ...zeroAmounts },
        today: { ...zeroAmounts },
        todaySales: { ...zeroAmounts },
        todayReturns: { ...zeroAmounts },
        todayAdjustments: { ...zeroAmounts },
        previous: { ...zeroAmounts },
        previousLabel: summaryMode === "v2" ? "이전 미수(기준시점)" : "이전 미수(역산)",
      });
    }

    return result;
  }, [
    partyGroups,
    arTotalsMap,
    todaySalesArByParty,
    todayReturnsArByParty,
    arAsOfTotalsMap,
    todayAdjustmentsByParty,
    summaryMode,
  ]);

  const visiblePages = useMemo(() => {
    if (!activePartyId) return receiptPages;
    const activeParty = partyGroups.find((group) => group.partyId === activePartyId) ?? null;
    if (!activeParty) return [] as PartyReceiptPage[];
    return receiptPages.filter((page) => page.partyId === activeParty.partyId);
  }, [receiptPages, partyGroups, activePartyId]);

  const unconfirmShipmentMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentUnconfirm,
    successMessage: "출고 초기화 완료",
    onSuccess: () => {
      setReasonModalOpen(false);
      setReasonText("");
      setTargetShipmentId(null);
      shipmentsQuery.refetch();
    },
  });

  const handleOpenReason = (shipmentId: string) => {
    setTargetShipmentId(shipmentId);
    setReasonText("");
    setReasonModalOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!targetShipmentId) return;
    const reason = reasonText.trim();
    if (!reason) return;
    await unconfirmShipmentMutation.mutateAsync({
      p_shipment_id: targetShipmentId,
      p_reason: reason,
      p_note: "unconfirm from shipments_print",
    });
  };

  const totalCount = shipments.length;
  const totalLabor = shipments.reduce((sum, row) => sum + row.totalLabor, 0);
  const totalAmount = shipments.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions no-print px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title={isStorePickupMode ? "출고 영수증(매장출고)" : "출고 영수증(통상)"}
          subtitle={`기준일: ${today} · ${isStorePickupMode ? "매장출고만" : "매장출고 제외"} · 출고확정됨`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(today, -1) })}>
                  ◀
                </Button>
                <Input
                  type="date"
                  value={today}
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    if (!isValidYmd(next)) return;
                    updateQuery({ date: next });
                  }}
                  className="h-8 w-[140px]"
                />
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(today, 1) })}>
                  ▶
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant={isStorePickupMode ? "secondary" : "primary"} onClick={() => updateQuery({ mode: "" })}>
                  통상
                </Button>
                <Button
                  variant={isStorePickupMode ? "primary" : "secondary"}
                  onClick={() => updateQuery({ mode: "store_pickup" })}
                >
                  매장출고
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    shipmentsQuery.refetch();
                    returnsQuery.refetch();
                  }}
                >
                  새로고침
                </Button>
                <Button variant="primary" onClick={() => window.print()}>
                  영수증 출력
                </Button>
              </div>
            </div>
          }
        />
      </div>

      <div className="shipments-print-stage px-6 py-6 space-y-6">
        <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">출고 건수</div>
              <div className="text-xl font-semibold tabular-nums">{totalCount}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 공임</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalLabor)}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 금액</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalAmount)}</div>
            </CardBody>
          </Card>
        </div>

        <div className="no-print shipments-print-main grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="border-[var(--panel-border)] h-fit">
            <CardHeader className="border-b border-[var(--panel-border)] py-3">
              <div className="text-sm font-semibold">거래처 선택</div>
            </CardHeader>
            <CardBody className="p-0">
              {shipmentsQuery.isLoading ? (
                <div className="p-6 text-sm text-[var(--muted)]">로딩 중...</div>
              ) : partyGroups.length === 0 ? (
                <div className="p-6 text-sm text-[var(--muted)]">대상 없음</div>
              ) : (
                <div className="divide-y divide-[var(--panel-border)]">
                  <button
                    type="button"
                    onClick={() => updateQuery({ partyId: null })}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors",
                      activePartyId ? "hover:bg-[var(--panel-hover)]" : "bg-[var(--panel-hover)]"
                    )}
                  >
                    <div className="text-sm font-semibold">전체 보기</div>
                    <div className="text-xs text-[var(--muted)] tabular-nums">
                      {partyGroups.reduce((sum, group) => sum + group.lines.length, 0)}건
                    </div>
                  </button>
                  {partyGroups.map((group) => {
                    const isActive = group.partyId === activePartyId;
                    const todaySum = todayByParty.get(group.partyId) ?? { ...zeroAmounts };
                    return (
                      <button
                        key={group.partyId}
                        type="button"
                        onClick={() => updateQuery({ partyId: group.partyId })}
                        className={cn(
                          "w-full text-left px-4 py-3 transition-colors",
                          isActive ? "bg-[var(--panel-hover)]" : "hover:bg-[var(--panel-hover)]"
                        )}
                      >
                        <div className="text-sm font-semibold truncate">{group.partyName}</div>
                        <div className="text-xs text-[var(--muted)] tabular-nums">
                          {group.lines.length}건 · 공임 {formatKrw(todaySum.labor)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card className="border-[var(--panel-border)]">
              <CardHeader className="border-b border-[var(--panel-border)] py-3">
                <div className="text-sm font-semibold">출고 초기화</div>
                <div className="text-xs text-[var(--muted)]">
                  선택된 거래처(또는 전체)의 확정된 출고를 초기화합니다. (미수/결제상계/반품 자동 롤백)
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {shipmentsQuery.isLoading ? (
                  <div className="p-4 text-sm text-[var(--muted)]">로딩 중...</div>
                ) : resetTargets.length === 0 ? (
                  <div className="p-4 text-sm text-[var(--muted)]">초기화할 출고가 없습니다.</div>
                ) : (
                  <div className="divide-y divide-[var(--panel-border)]">
                    {resetTargets.slice(0, 30).map((s) => (
                      <div key={s.shipmentId} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{s.customerName}</div>
                          <div className="text-xs text-[var(--muted)] tabular-nums">
                            {s.totalQty}건 · {formatKrw(s.totalAmount)} · {formatDateTimeKst(s.confirmedAt)}
                          </div>
                        </div>
                        <Button variant="secondary" onClick={() => handleOpenReason(s.shipmentId)}>
                          초기화
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="receipt-print-root shipments-print-root print-only space-y-6">
          {shipmentsQuery.isLoading || returnsQuery.isLoading ? (
            <div className="no-print text-sm text-[var(--muted)]">로딩 중...</div>
          ) : visiblePages.length === 0 ? (
            <div className="no-print text-sm text-[var(--muted)]">미리볼 거래처를 선택하세요.</div>
          ) : (
            <div className="space-y-6">
              {visiblePages.map((page, index) => (
                <div
                  key={`${page.partyId}-${index}`}
                  className={cn(
                    "receipt-print-page print-sheet shipments-print-sheet mx-auto bg-white p-[10mm] text-black shadow-sm",
                    "border border-neutral-200"
                  )}
                  style={{ width: "297mm", height: "210mm" }}
                >
                  <div className="grid h-full grid-cols-2 gap-4">
                    <div className="h-full border-r border-dashed border-neutral-300 pr-4">
                      <ReceiptPrintHalf
                        partyName={page.partyName}
                        dateLabel={printedAtLabel}
                        lines={page.lines}
                        summaryRows={buildSummaryRows(page)}
                      />
                    </div>
                    <div className="h-full pl-4">
                      <ReceiptPrintHalf
                        partyName={page.partyName}
                        dateLabel={printedAtLabel}
                        lines={page.lines}
                        summaryRows={buildSummaryRows(page)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        title="출고 초기화 사유"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">사유</label>
            <Textarea
              placeholder="예: 당일 발송 불가"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className={cn("text-xs", reasonText.trim() ? "text-[var(--muted)]" : "text-[var(--danger)]")}>
              사유를 입력해야 삭제됩니다.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReasonModalOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmClear}
                disabled={!reasonText.trim() || unconfirmShipmentMutation.isPending}
              >
                {unconfirmShipmentMutation.isPending ? "처리 중..." : "초기화"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ShipmentsPrintPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--muted)]">
          Loading...
        </div>
      )}
    >
      <ShipmentsPrintContent />
    </Suspense>
  );
}
