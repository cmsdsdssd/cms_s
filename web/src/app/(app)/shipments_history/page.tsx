"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { ActionBar } from "@/components/layout/action-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchemaClient } from "@/lib/supabase/client";
import { CONTRACTS } from "@/lib/contracts";
import {
  materializeSnapshotPolicyItems,
  normalizeExtraLaborItemsWithStableIds,
} from "@/lib/shipments-prefill-snapshot";
import {
  isAdjustmentTypeValue,
  isCoreVisibleEtcItem,
} from "@/lib/shipments-labor-rules";
import { cn } from "@/lib/utils";
import { ShipmentsMobileTabs } from "@/components/layout/shipments-mobile-tabs";
import {
  buildMaterialFactorMap,
  calcCommodityDueG,
  calcMaterialAmountSellKrw,
  normalizeMaterialCode,
  type MaterialFactorConfigRow,
} from "@/lib/material-factors";
import {
  combineShipmentRows,
  filterShipmentRows,
  formatGram,
  formatKrw,
  getKstYmd,
  getKstYmdOffset,
  groupShipmentRows,
  isValidYmd,
  type GroupByKey,
  type ShipmentHistoryHeaderRow,
  type ShipmentHistoryInvoiceRow,
  type ShipmentHistoryLineRow,
  type ShipmentHistoryRow,
} from "@/lib/shipments-history";

type ShipmentLineDetailRow = ShipmentHistoryLineRow & {
  master_id?: string | null;
  material_code?: string | null;
  base_labor_krw?: number | null;
  extra_labor_krw?: number | null;
  extra_labor_items?: unknown;
};

type InvoicePositionDetailRow = {
  shipment_line_id?: string | null;
  commodity_due_g?: number | null;
  labor_cash_due_krw?: number | null;
  material_cash_due_krw?: number | null;
  total_cash_due_krw?: number | null;
};

type ReceiptMatchPolicyRow = {
  pricing_policy_meta?: unknown;
  selected_factory_labor_basic_cost_krw?: number | null;
  selected_factory_labor_other_cost_krw?: number | null;
  selected_factory_total_cost_krw?: number | null;
};

type EffectivePriceResponse = {
  unit_total_sell_krw?: number | null;
  unit_total_cost_krw?: number | null;
  total_total_sell_krw?: number | null;
  total_total_cost_krw?: number | null;
  breakdown?: Array<Record<string, unknown>> | null;
};

type MasterCatalogRow = {
  master_id?: string | null;
  model_name?: string | null;
  material_code_default?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
  material_price?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  labor_base_sell?: number | null;
  labor_center_sell?: number | null;
  labor_sub1_sell?: number | null;
  labor_sub2_sell?: number | null;
  plating_price_sell_default?: number | null;
};

type MarketTicksResponse = {
  data?: {
    gold?: number | null;
    silverOriginal?: number | null;
  } | null;
};

type MasterLookupCandidate = {
  master_id?: string | null;
  model_name?: string | null;
  material_code_default?: string | null;
};

type AbsorbLaborBucket = "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
type AbsorbLaborClass = "GENERAL" | "MATERIAL";
type AbsorbStoneRole = "CENTER" | "SUB1" | "SUB2";

type MasterAbsorbLaborItem = {
  absorb_item_id?: string;
  master_id?: string;
  bucket: AbsorbLaborBucket;
  reason: string;
  amount_krw: number;
  is_per_piece: boolean;
  is_active: boolean;
  note?: string | null;
  labor_class?: AbsorbLaborClass | null;
  material_qty_per_unit?: number | null;
};

type BomDecorLineLite = {
  product_master_id: string;
  component_master_id: string;
  qty_per_unit: number;
};

type ShipmentPrefillSnapshotData = {
  pricing_policy_meta?: unknown;
  selected_factory_labor_other_cost_krw?: number | null;
  receipt_labor_other_cost_krw?: number | null;
  labor_prefill_snapshot?: {
    extra_labor_items?: unknown;
    extra_labor_sell_krw?: number | null;
    extra_labor_cost_krw?: number | null;
    policy_absorb_decor_total_krw?: number | null;
    absorb_decor_total_krw?: number | null;
    plating_sell_krw?: number | null;
    plating_cost_krw?: number | null;
  } | null;
};

type OrderLineMasterBridgeRow = {
  order_line_id?: string | null;
  matched_master_id?: string | null;
  model_name?: string | null;
};

type ExtraLaborBreakdownRow = {
  id: string;
  type: string;
  label: string;
  qtyApplied: number | null;
  sellKrw: number;
  costKrw: number | null;
  marginKrw: number | null;
  source: string;
  reason: string;
};

type LaborDetailCategory = "BASE" | "STONE" | "PLATING" | "DECOR" | "ETC";

const AUTO_REMAINDER_ADJUSTMENT_SOURCE = "REMAINDER_BRIDGE";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replaceAll(",", "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const roundUpDisplayHundred = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / 100) * 100;
};

const formatMaterialCode = (value: string | null | undefined) => {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) return "-";
  if (code === "14" || code === "18" || code === "24") return `${code}K`;
  return code;
};

const normalizeModelKey = (value: string | null | undefined) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[\s\-_/]+/g, "")
    .trim();

const BOM_DECOR_NOTE_PREFIX = "BOM_DECOR_LINE:";
const BOM_MATERIAL_NOTE_PREFIX = "BOM_MATERIAL_LINE:";
const BOM_DECOR_REASON_PREFIX = "장식:";
const BOM_MATERIAL_REASON_PREFIX = "기타-소재:";
const ACCESSORY_BASE_REASON = "ACCESSORY_LABOR";
const LEGACY_BOM_AUTO_REASON = "BOM_AUTO_TOTAL";
const ACCESSORY_ETC_REASON_KEYWORD = "부속공임";
const ABSORB_AUTO_EXCLUDED_REASONS = new Set([LEGACY_BOM_AUTO_REASON, ACCESSORY_BASE_REASON]);
const ABSORB_STONE_ROLE_PREFIX = "STONE_ROLE:";

const shouldExcludeEtcAbsorbItem = (item: MasterAbsorbLaborItem) => {
  const normalizedReason = String(item.reason ?? "").trim().toUpperCase();
  if (ABSORB_AUTO_EXCLUDED_REASONS.has(normalizedReason)) return true;
  if (item.bucket !== "ETC") return false;
  const rawReason = String(item.reason ?? "").trim();
  const rawNote = String(item.note ?? "").trim();
  if (rawNote.startsWith(BOM_DECOR_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_DECOR_REASON_PREFIX)) return true;
  if (rawNote.startsWith(BOM_MATERIAL_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_MATERIAL_REASON_PREFIX)) return true;
  return rawReason.includes(ACCESSORY_ETC_REASON_KEYWORD);
};

const parseAbsorbStoneRole = (note: string | null | undefined): AbsorbStoneRole | null => {
  const text = String(note ?? "").trim().toUpperCase();
  if (!text.startsWith(ABSORB_STONE_ROLE_PREFIX)) return null;
  const value = text.slice(ABSORB_STONE_ROLE_PREFIX.length);
  if (value === "CENTER" || value === "SUB1" || value === "SUB2") return value;
  return null;
};

const normalizeAbsorbLaborClass = (value: unknown): AbsorbLaborClass =>
  String(value ?? "GENERAL").trim().toUpperCase() === "MATERIAL" ? "MATERIAL" : "GENERAL";

const isMaterialAbsorbItem = (item: MasterAbsorbLaborItem) =>
  item.bucket === "ETC" && normalizeAbsorbLaborClass(item.labor_class) === "MATERIAL";

type AbsorbImpactSummary = {
  baseLaborUnit: number;
  stoneCenterUnit: number;
  stoneSub1Unit: number;
  stoneSub2Unit: number;
  platingUnit: number;
  etc: number;
};

const computeAbsorbImpactSummary = (
  items: MasterAbsorbLaborItem[],
  centerQty: number,
  sub1Qty: number,
  sub2Qty: number
): AbsorbImpactSummary => {
  const centerQtySafe = Math.max(Number(centerQty || 0), 0);
  const sub1QtySafe = Math.max(Number(sub1Qty || 0), 0);
  const sub2QtySafe = Math.max(Number(sub2Qty || 0), 0);
  const summary: AbsorbImpactSummary = {
    baseLaborUnit: 0,
    stoneCenterUnit: 0,
    stoneSub1Unit: 0,
    stoneSub2Unit: 0,
    platingUnit: 0,
    etc: 0,
  };

  items.forEach((item) => {
    if (item.is_active === false) return;
    const baseAmount = Number(item.amount_krw ?? 0);
    if (!Number.isFinite(baseAmount) || baseAmount === 0) return;

    let applied = baseAmount;
    const role = parseAbsorbStoneRole(item.note);
    if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") applied = baseAmount * Math.max(sub1QtySafe, 1);
      else if (role === "SUB2") applied = baseAmount * Math.max(sub2QtySafe, 1);
      else applied = baseAmount * Math.max(centerQtySafe, 1);
    }

    if (item.bucket === "BASE_LABOR") {
      summary.baseLaborUnit += baseAmount;
      return;
    }
    if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") summary.stoneSub1Unit += baseAmount;
      else if (role === "SUB2") summary.stoneSub2Unit += baseAmount;
      else summary.stoneCenterUnit += baseAmount;
      return;
    }
    if (item.bucket === "PLATING") {
      summary.platingUnit += baseAmount;
      return;
    }

    if (isMaterialAbsorbItem(item)) {
      const qtyPerUnit = Math.max(Number(item.material_qty_per_unit ?? 1), 0);
      summary.etc += applied * qtyPerUnit;
      return;
    }
    summary.etc += applied;
  });

  return summary;
};

const computeMasterLaborSellPerUnitWithAbsorb = (
  masterRow: MasterCatalogRow | undefined,
  absorbItems: MasterAbsorbLaborItem[]
) => {
  if (!masterRow) return 0;
  const centerQty = Math.max(toNumber(masterRow.center_qty_default, 0), 0);
  const sub1Qty = Math.max(toNumber(masterRow.sub1_qty_default, 0), 0);
  const sub2Qty = Math.max(toNumber(masterRow.sub2_qty_default, 0), 0);

  const baseSell =
    Math.max(toNumber(masterRow.labor_base_sell, 0), 0) +
    Math.max(toNumber(masterRow.labor_center_sell, 0), 0) * centerQty +
    Math.max(toNumber(masterRow.labor_sub1_sell, 0), 0) * sub1Qty +
    Math.max(toNumber(masterRow.labor_sub2_sell, 0), 0) * sub2Qty +
    Math.max(toNumber(masterRow.plating_price_sell_default, 0), 0);

  const activeAbsorb = absorbItems.filter((item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item));
  const absorb = computeAbsorbImpactSummary(activeAbsorb, centerQty, sub1Qty, sub2Qty);

  return (
    baseSell +
    absorb.baseLaborUnit +
    absorb.stoneCenterUnit * centerQty +
    absorb.stoneSub1Unit * sub1Qty +
    absorb.stoneSub2Unit * sub2Qty +
    absorb.platingUnit +
    absorb.etc
  );
};

const pickBestMasterCandidate = (modelName: string, candidates: MasterLookupCandidate[]) => {
  if (candidates.length === 0) return null;
  const normalizedTarget = normalizeModelKey(modelName);
  const normalizedMatched = candidates.filter(
    (candidate) => normalizeModelKey(candidate.model_name) === normalizedTarget
  );
  if (normalizedMatched.length === 1) return normalizedMatched[0] ?? null;
  if (normalizedMatched.length > 1) {
    return [...normalizedMatched].sort((a, b) => String(a.master_id ?? "").localeCompare(String(b.master_id ?? "")))[0] ?? null;
  }

  const loweredTarget = String(modelName ?? "").trim().toLowerCase();
  const lowerMatched = candidates.filter(
    (candidate) => String(candidate.model_name ?? "").trim().toLowerCase() === loweredTarget
  );
  if (lowerMatched.length === 1) return lowerMatched[0] ?? null;
  if (lowerMatched.length > 1) {
    return [...lowerMatched].sort((a, b) => String(a.master_id ?? "").localeCompare(String(b.master_id ?? "")))[0] ?? null;
  }

  return null;
};

const readBreakdownSell = (data: EffectivePriceResponse | null, target: "MATERIAL" | "LABOR") => {
  const rows = data?.breakdown;
  if (!Array.isArray(rows)) return null;
  let sum = 0;
  let found = false;
  rows.forEach((row) => {
    const type = String(row.component_ref_type ?? "").toUpperCase();
    const amount = toNumber(row.total_sell_krw, Number.NaN);
    if (!Number.isFinite(amount)) return;
    if (target === "MATERIAL" && type.includes("MATERIAL")) {
      sum += amount;
      found = true;
      return;
    }
    if (target === "LABOR" && (type.includes("LABOR") || type.includes("PLATING") || type.includes("ETC"))) {
      sum += amount;
      found = true;
    }
  });
  return found ? sum : null;
};

const normalizeExtraLaborBreakdown = (value: unknown): ExtraLaborBreakdownRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const meta =
        record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
          ? (record.meta as Record<string, unknown>)
          : null;

      const type = String(record.type ?? "").trim();
      const normalizedType = type.toUpperCase();
      const rawLabel = String(record.label ?? "").trim() || "기타";
      const source = String(meta?.source ?? "").trim();
      const sourceUpper = source.toUpperCase();
      const itemLabel = String(meta?.item_label ?? "").trim();

      const label = (() => {
        if (normalizedType === "PLATING_MASTER") return "도금-마스터";

        const isMaterialMaster =
          normalizedType.startsWith("MATERIAL_MASTER:") || sourceUpper === "MASTER_MATERIAL_LABOR";
        if (isMaterialMaster) {
          const decorated = itemLabel || rawLabel;
          const normalizedDecor = decorated
            .replace("기타-소재:", "")
            .replace("기타-장식:", "")
            .trim();
          return normalizedDecor ? `[장식] ${normalizedDecor}` : "[장식]";
        }

        if (rawLabel.includes("기타-소재:")) {
          const normalizedDecor = rawLabel.replace("기타-소재:", "").trim();
          return normalizedDecor ? `[장식] ${normalizedDecor}` : "[장식]";
        }

        if (rawLabel.includes("기타-장식:")) {
          const normalizedDecor = rawLabel.replace("기타-장식:", "").trim();
          return normalizedDecor ? `[장식] ${normalizedDecor}` : "[장식]";
        }

        return rawLabel;
      })();
      const sellKrwFromAmount = toNumber(record.amount, Number.NaN);
      const sellKrwFromMeta = toNumber(meta?.sell_krw, Number.NaN);
      const unitSellKrw = toNumber(meta?.unit_amount_krw, Number.NaN);
      const qtyAppliedForUnit = toNumber(meta?.qty_applied, Number.NaN);
      const sellKrwFromUnit =
        Number.isFinite(unitSellKrw) && Number.isFinite(qtyAppliedForUnit)
          ? unitSellKrw * qtyAppliedForUnit
          : Number.NaN;
      const sellKrw = Number.isFinite(sellKrwFromMeta)
        ? sellKrwFromMeta
        : Number.isFinite(sellKrwFromAmount)
          ? sellKrwFromAmount
          : Number.isFinite(sellKrwFromUnit)
            ? sellKrwFromUnit
            : 0;

      const qtyAppliedRaw = toNumber(meta?.qty_applied, Number.NaN);
      const qtyApplied = Number.isFinite(qtyAppliedRaw) && qtyAppliedRaw > 0 ? qtyAppliedRaw : null;

      const costRaw = toNumber(meta?.cost_krw ?? meta?.material_cost_krw, Number.NaN);
      const marginRaw = toNumber(meta?.margin_krw, Number.NaN);
      const costKrw = Number.isFinite(costRaw) ? costRaw : null;
      const marginKrw = Number.isFinite(marginRaw) ? marginRaw : null;

      const reasonParts = [
        String(meta?.item_type ?? "").trim(),
        String(meta?.item_label ?? "")
          .trim()
          .replace("기타-소재:", "[장식] ")
          .replace("기타-장식:", "[장식] "),
        String(meta?.reason_note ?? "").trim(),
      ].filter(Boolean);

      return {
        id: String(record.id ?? `${type || "item"}-${index}`),
        type: normalizedType || "OTHER",
        label,
        qtyApplied,
        sellKrw,
        costKrw,
        marginKrw,
        source,
        reason: reasonParts.join(" / "),
      } satisfies ExtraLaborBreakdownRow;
    })
    .filter((item) => Number.isFinite(item.sellKrw));
};

export default function ShipmentsHistoryPage() {
  const schemaClient = getSchemaClient();

  const today = useMemo(() => getKstYmd(), []);
  const [fromYmd, setFromYmd] = useState(() => getKstYmdOffset(-30));
  const [toYmd, setToYmd] = useState(() => today);
  const [groupBy, setGroupBy] = useState<GroupByKey>("date");
  const [searchText, setSearchText] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("ALL");
  const [selectedModel, setSelectedModel] = useState("ALL");
  const [includeStorePickup, setIncludeStorePickup] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [selectedDetailRow, setSelectedDetailRow] = useState<ShipmentHistoryRow | null>(null);

  const range = useMemo(() => {
    if (fromYmd <= toYmd) return { from: fromYmd, to: toYmd };
    return { from: toYmd, to: fromYmd };
  }, [fromYmd, toYmd]);

  const historyQuery = useQuery({
    queryKey: ["shipments-history", "sot-v2", range.from, range.to, includeStorePickup],
    enabled: Boolean(schemaClient) && isValidYmd(range.from) && isValidYmd(range.to),
    staleTime: 60_000,
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");

      const { data: headerData, error: headerError } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, ship_date, status, customer_party_id, is_store_pickup, customer:cms_party(name)")
        .eq("status", "CONFIRMED")
        .gte("ship_date", range.from)
        .lte("ship_date", range.to)
        .order("ship_date", { ascending: false });

      if (headerError) throw headerError;

      const headers = (headerData ?? []) as ShipmentHistoryHeaderRow[];
      const filteredHeaders = includeStorePickup
        ? headers
        : headers.filter((header) => header.is_store_pickup !== true);

      const shipmentIds = filteredHeaders
        .map((header) => String(header.shipment_id ?? "").trim())
        .filter(Boolean);

      if (shipmentIds.length === 0) {
        return {
          rows: combineShipmentRows(filteredHeaders, []),
        };
      }

      const lines: ShipmentHistoryLineRow[] = [];
      for (const ids of chunk(shipmentIds, 300)) {
        const { data: lineData, error: lineError } = await schemaClient
          .from("cms_shipment_line")
          .select(
            "shipment_line_id, shipment_id, order_line_id, master_id, model_name, suffix, color, size, qty, material_code, measured_weight_g, deduction_weight_g, net_weight_g, base_labor_krw, extra_labor_krw, labor_total_sell_krw, material_amount_sell_krw, total_amount_sell_krw, created_at"
          )
          .in("shipment_id", ids)
          .order("created_at", { ascending: false });

        if (lineError) throw lineError;
        lines.push(...((lineData ?? []) as ShipmentHistoryLineRow[]));
      }

      const orderLineIds = Array.from(
        new Set(
          lines
            .map((line) => String(line.order_line_id ?? "").trim())
            .filter(Boolean)
        )
      );
      const orderLineMasterBridge = new Map<string, { matched_master_id: string; model_name: string }>();
      for (const ids of chunk(orderLineIds, 500)) {
        const { data: orderLineData, error: orderLineError } = await schemaClient
          .from("cms_order_line")
          .select("order_line_id, matched_master_id, model_name")
          .in("order_line_id", ids);
        if (orderLineError) throw orderLineError;
        ((orderLineData ?? []) as OrderLineMasterBridgeRow[]).forEach((row) => {
          const orderLineId = String(row.order_line_id ?? "").trim();
          if (!orderLineId) return;
          orderLineMasterBridge.set(orderLineId, {
            matched_master_id: String(row.matched_master_id ?? "").trim(),
            model_name: String(row.model_name ?? "").trim(),
          });
        });
      }

      const normalizedLines = lines.map((line) => {
        const orderLineId = String(line.order_line_id ?? "").trim();
        const bridge = orderLineId ? orderLineMasterBridge.get(orderLineId) : undefined;
        const currentMasterId = String(line.master_id ?? "").trim();
        const currentModelName = String(line.model_name ?? "").trim();
        return {
          ...line,
          master_id: currentMasterId || bridge?.matched_master_id || null,
          model_name: currentModelName || bridge?.model_name || null,
        } satisfies ShipmentHistoryLineRow;
      });

      const shipmentLineIds = normalizedLines
        .map((line) => String(line.shipment_line_id ?? "").trim())
        .filter(Boolean);
      const masterIds = Array.from(
        new Set(
          normalizedLines
            .map((line) => String(line.master_id ?? "").trim())
            .filter(Boolean)
        )
      );
      const modelNames = Array.from(
        new Set(
          normalizedLines
            .map((line) => String(line.model_name ?? "").trim())
            .filter(Boolean)
        )
      );
      const invoices: ShipmentHistoryInvoiceRow[] = [];
      for (const lineIds of chunk(shipmentLineIds, 500)) {
        const { data: invoiceData, error: invoiceError } = await schemaClient
          .from(CONTRACTS.views.arInvoicePosition)
          .select("shipment_line_id, commodity_due_g, commodity_price_snapshot_krw_per_g, labor_cash_due_krw, material_cash_due_krw, total_cash_due_krw")
          .in("shipment_line_id", lineIds);
        if (invoiceError) throw invoiceError;
        invoices.push(...((invoiceData ?? []) as ShipmentHistoryInvoiceRow[]));
      }

      const unitPricingMasterIds = new Set<string>();
      const unitPricingModelNames = new Set<string>();
      for (const ids of chunk(masterIds, 500)) {
        const { data: masterData, error: masterError } = await schemaClient
          .from("cms_master_item")
          .select("master_id, is_unit_pricing")
          .in("master_id", ids)
          .eq("is_unit_pricing", true);
        if (masterError) throw masterError;
        ((masterData ?? []) as Array<{ master_id?: string | null }>).forEach((row) => {
          const masterId = String(row.master_id ?? "").trim();
          if (masterId) unitPricingMasterIds.add(masterId);
        });
      }
      for (const names of chunk(modelNames, 500)) {
        const { data: modelData, error: modelError } = await schemaClient
          .from("cms_master_item")
          .select("model_name, is_unit_pricing")
          .in("model_name", names)
          .eq("is_unit_pricing", true);
        if (modelError) throw modelError;
        ((modelData ?? []) as Array<{ model_name?: string | null }>).forEach((row) => {
          const modelName = String(row.model_name ?? "").trim();
          if (modelName) unitPricingModelNames.add(modelName);
        });
      }

      return {
        rows: combineShipmentRows(filteredHeaders, normalizedLines, invoices, unitPricingMasterIds, unitPricingModelNames),
      };
    },
  });

  const sourceRows = useMemo(() => historyQuery.data?.rows ?? [], [historyQuery.data?.rows]);

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    sourceRows.forEach((row) => {
      if (!row.customer_party_id) return;
      if (!map.has(row.customer_party_id)) map.set(row.customer_party_id, row.customer_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  }, [sourceRows]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    sourceRows.forEach((row) => {
      if (!row.model_name) return;
      set.add(row.model_name);
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [sourceRows]);

  const visibleRows = useMemo(
    () =>
      filterShipmentRows(sourceRows, {
        searchText,
        selectedCustomerId,
        selectedModel,
      }),
    [searchText, selectedCustomerId, selectedModel, sourceRows]
  );

  const groups = useMemo(() => groupShipmentRows(visibleRows, groupBy), [visibleRows, groupBy]);

  useEffect(() => {
    if (groups.length === 0) {
      if (selectedGroupKey !== "") setSelectedGroupKey("");
      return;
    }
    const exists = groups.some((group) => group.key === selectedGroupKey);
    if (!exists) setSelectedGroupKey(groups[0].key);
  }, [groups, selectedGroupKey]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.key === selectedGroupKey) ?? null,
    [groups, selectedGroupKey]
  );

  const selectedGroupRows = selectedGroup?.rows ?? [];
  const selectedGroupMasterIds = useMemo(
    () => Array.from(new Set(selectedGroupRows.map((row) => String(row.master_id ?? "").trim()).filter(Boolean))),
    [selectedGroupRows]
  );
  const selectedGroupModelNames = useMemo(
    () => Array.from(new Set(selectedGroupRows.map((row) => String(row.model_name ?? "").trim()).filter(Boolean))),
    [selectedGroupRows]
  );

  const modelLookupNames = useMemo(
    () =>
      Array.from(
        new Set(
          selectedGroupRows
            .map((row) => String(row.model_name ?? "").trim())
            .filter(Boolean)
        )
      ),
    [selectedGroupRows]
  );

  const unresolvedModelLookupQueries = useQueries({
    queries: modelLookupNames.map((modelName) => ({
      queryKey: ["shipments-history-master-model-lookup", modelName],
      staleTime: 60_000,
      queryFn: async () => {
        const response = await fetch(`/api/master-items?model=${encodeURIComponent(modelName)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: MasterLookupCandidate[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "마스터 모델 조회 실패");
        return payload.data ?? [];
      },
    })),
  });

  const resolvedMasterIdByModelName = useMemo(() => {
    const map = new Map<string, string>();
    modelLookupNames.forEach((modelName, index) => {
      const candidates = (unresolvedModelLookupQueries[index]?.data ?? []) as MasterLookupCandidate[];
      const best = pickBestMasterCandidate(modelName, candidates);
      const masterId = String(best?.master_id ?? "").trim();
      if (masterId) map.set(modelName, masterId);
    });
    return map;
  }, [modelLookupNames, unresolvedModelLookupQueries]);

  const resolvedMasterIdByNormalizedModelName = useMemo(() => {
    const map = new Map<string, string>();
    modelLookupNames.forEach((modelName) => {
      const key = normalizeModelKey(modelName);
      const masterId = String(resolvedMasterIdByModelName.get(modelName) ?? "").trim();
      if (key && masterId && !map.has(key)) map.set(key, masterId);
    });
    return map;
  }, [modelLookupNames, resolvedMasterIdByModelName]);

  const modelLookupStateByName = useMemo(() => {
    const map = new Map<string, { isLoading: boolean; isError: boolean; message: string | null }>();
    modelLookupNames.forEach((modelName, index) => {
      const query = unresolvedModelLookupQueries[index];
      map.set(modelName, {
        isLoading: Boolean(query?.isLoading),
        isError: Boolean(query?.isError),
        message: query?.isError ? ((query.error as Error | undefined)?.message ?? "모델 마스터 조회 실패") : null,
      });
    });
    return map;
  }, [modelLookupNames, unresolvedModelLookupQueries]);

  const selectedGroupResolvedMasterIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...selectedGroupMasterIds,
          ...Array.from(resolvedMasterIdByModelName.values()),
        ])
      ),
    [resolvedMasterIdByModelName, selectedGroupMasterIds]
  );

  const masterCatalogQuery = useQuery({
    queryKey: ["shipments-history-master-catalog", selectedGroupResolvedMasterIds.join("|"), selectedGroupModelNames.join("|")],
    enabled: selectedGroupResolvedMasterIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (selectedGroupResolvedMasterIds.length === 0) return [] as MasterCatalogRow[];
      const rows: MasterCatalogRow[] = [];
      for (const ids of chunk(selectedGroupResolvedMasterIds, 500)) {
        const response = await fetch(`/api/master-items?master_ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: MasterCatalogRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "마스터 상세 조회 실패");
        rows.push(...(payload.data ?? []));
      }
      return rows;
    },
  });

  const masterCatalogById = useMemo(() => {
    const map = new Map<string, MasterCatalogRow>();
    (masterCatalogQuery.data ?? []).forEach((row) => {
      const id = String(row.master_id ?? "").trim();
      if (id) map.set(id, row);
    });
    return map;
  }, [masterCatalogQuery.data]);
  const masterCatalogByModelName = useMemo(() => {
    const map = new Map<string, MasterCatalogRow>();
    (masterCatalogQuery.data ?? []).forEach((row) => {
      const key = String(row.model_name ?? "").trim();
      if (key && !map.has(key)) map.set(key, row);
    });
    return map;
  }, [masterCatalogQuery.data]);
  const masterCatalogByNormalizedModel = useMemo(() => {
    const map = new Map<string, MasterCatalogRow>();
    (masterCatalogQuery.data ?? []).forEach((row) => {
      const key = normalizeModelKey(row.model_name);
      if (key && !map.has(key)) map.set(key, row);
    });
    return map;
  }, [masterCatalogQuery.data]);

  const resolvedMasterIdByLineId = useMemo(() => {
    const map = new Map<string, string>();
    selectedGroupRows.forEach((row) => {
      const lineId = String(row.shipment_line_id ?? "").trim();
      if (!lineId) return;
      const directMasterId = String(row.master_id ?? "").trim();
      if (directMasterId && masterCatalogById.has(directMasterId)) {
        map.set(lineId, directMasterId);
        return;
      }
      const modelKey = String(row.model_name ?? "").trim();
      const resolvedFromLookup = modelKey
        ? String(
            resolvedMasterIdByModelName.get(modelKey) ??
              resolvedMasterIdByNormalizedModelName.get(normalizeModelKey(modelKey)) ??
              ""
          ).trim()
        : "";
      if (resolvedFromLookup) {
        map.set(lineId, resolvedFromLookup);
        return;
      }
      const resolvedMaster = modelKey
        ? masterCatalogByModelName.get(modelKey) ??
          masterCatalogByModelName.get(modelKey.toLowerCase()) ??
          masterCatalogByNormalizedModel.get(normalizeModelKey(modelKey))
        : undefined;
      const resolvedMasterId = String(resolvedMaster?.master_id ?? "").trim();
      if (resolvedMasterId) {
        map.set(lineId, resolvedMasterId);
        return;
      }
      if (directMasterId) map.set(lineId, directMasterId);
    });
    return map;
  }, [masterCatalogById, masterCatalogByModelName, masterCatalogByNormalizedModel, resolvedMasterIdByModelName, resolvedMasterIdByNormalizedModelName, selectedGroupRows]);

  const marketTicksQuery = useQuery({
    queryKey: ["shipments-history-market-ticks"],
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch("/api/market-ticks", { cache: "no-store" });
      const payload = (await response.json()) as MarketTicksResponse | { error?: string };
      if (!response.ok) throw new Error((payload as { error?: string }).error ?? "시세 조회 실패");
      return payload as MarketTicksResponse;
    },
  });

  const materialFactorQuery = useQuery({
    queryKey: ["shipments-history-material-factors"],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/material-factor-config", { cache: "no-store" });
      const payload = (await response.json()) as { data?: MaterialFactorConfigRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "소재 팩터 조회 실패");
      return payload.data ?? [];
    },
  });
  const materialFactorMap = useMemo(() => buildMaterialFactorMap(materialFactorQuery.data ?? []), [materialFactorQuery.data]);

  const masterEffectivePriceQueries = useQueries({
    queries: selectedGroupResolvedMasterIds.map((masterId) => ({
      queryKey: ["shipments-history-master-effective-price", masterId, 1],
      enabled: Boolean(masterId),
      staleTime: 60_000,
      queryFn: async () => {
        if (!masterId) return null;
        const params = new URLSearchParams();
        params.set("master_id", masterId);
        params.set("qty", "1");

        const response = await fetch(`/api/master-effective-price?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as EffectivePriceResponse | { error?: string } | null;
        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error ?? "마스터 가격 조회 실패");
        }
        return payload as EffectivePriceResponse;
      },
    })),
  });

  const masterEffectivePriceByMasterId = useMemo(() => {
    const map = new Map<string, EffectivePriceResponse | null>();
    selectedGroupResolvedMasterIds.forEach((masterId, index) => {
      map.set(masterId, (masterEffectivePriceQueries[index]?.data ?? null) as EffectivePriceResponse | null);
    });
    return map;
  }, [masterEffectivePriceQueries, selectedGroupResolvedMasterIds]);

  const masterEffectivePriceStateByMasterId = useMemo(() => {
    const map = new Map<string, { isLoading: boolean; isError: boolean; message: string | null }>();
    selectedGroupResolvedMasterIds.forEach((masterId, index) => {
      const query = masterEffectivePriceQueries[index];
      map.set(masterId, {
        isLoading: Boolean(query?.isLoading),
        isError: Boolean(query?.isError),
        message: query?.isError ? ((query.error as Error | undefined)?.message ?? "마스터 가격 조회 실패") : null,
      });
    });
    return map;
  }, [masterEffectivePriceQueries, selectedGroupResolvedMasterIds]);

  const masterAbsorbItemsQuery = useQuery({
    queryKey: ["shipments-history-master-absorb-items", selectedGroupResolvedMasterIds.join("|")],
    enabled: selectedGroupResolvedMasterIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (selectedGroupResolvedMasterIds.length === 0) return [] as MasterAbsorbLaborItem[];
      const out: MasterAbsorbLaborItem[] = [];
      for (const ids of chunk(selectedGroupResolvedMasterIds, 300)) {
        const response = await fetch(`/api/master-absorb-labor-items?master_ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "흡수공임 조회 실패");
        out.push(...(payload.data ?? []));
      }
      return out;
    },
  });

  const masterAbsorbItemsByMasterId = useMemo(() => {
    const map = new Map<string, MasterAbsorbLaborItem[]>();
    (masterAbsorbItemsQuery.data ?? []).forEach((item) => {
      const masterId = String(item.master_id ?? "").trim();
      if (!masterId) return;
      const list = map.get(masterId) ?? [];
      list.push(item);
      map.set(masterId, list);
    });
    return map;
  }, [masterAbsorbItemsQuery.data]);

  const bomDecorLinesQuery = useQuery({
    queryKey: ["shipments-history-bom-decor-lines", selectedGroupResolvedMasterIds.join("|")],
    enabled: selectedGroupResolvedMasterIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (selectedGroupResolvedMasterIds.length === 0) return [] as BomDecorLineLite[];
      const out: BomDecorLineLite[] = [];
      for (const ids of chunk(selectedGroupResolvedMasterIds, 60)) {
        const response = await fetch(`/api/bom-decor-lines?product_master_ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: BomDecorLineLite[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "장식 라인 조회 실패");
        out.push(...(payload.data ?? []));
      }
      return out;
    },
  });

  const decorLinesByProductMasterId = useMemo(() => {
    const map = new Map<string, BomDecorLineLite[]>();
    (bomDecorLinesQuery.data ?? []).forEach((line) => {
      const productMasterId = String(line.product_master_id ?? "").trim();
      if (!productMasterId) return;
      const list = map.get(productMasterId) ?? [];
      list.push(line);
      map.set(productMasterId, list);
    });
    return map;
  }, [bomDecorLinesQuery.data]);

  const decorComponentMasterIds = useMemo(
    () =>
      Array.from(
        new Set(
          (bomDecorLinesQuery.data ?? [])
            .map((line) => String(line.component_master_id ?? "").trim())
            .filter(Boolean)
        )
      ),
    [bomDecorLinesQuery.data]
  );

  const decorComponentCatalogQuery = useQuery({
    queryKey: ["shipments-history-decor-component-catalog", decorComponentMasterIds.join("|")],
    enabled: decorComponentMasterIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (decorComponentMasterIds.length === 0) return [] as MasterCatalogRow[];
      const rows: MasterCatalogRow[] = [];
      for (const ids of chunk(decorComponentMasterIds, 500)) {
        const response = await fetch(`/api/master-items?master_ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: MasterCatalogRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "장식 컴포넌트 마스터 조회 실패");
        rows.push(...(payload.data ?? []));
      }
      return rows;
    },
  });

  const decorComponentCatalogByMasterId = useMemo(() => {
    const map = new Map<string, MasterCatalogRow>();
    (decorComponentCatalogQuery.data ?? []).forEach((row) => {
      const masterId = String(row.master_id ?? "").trim();
      if (!masterId) return;
      map.set(masterId, row);
    });
    return map;
  }, [decorComponentCatalogQuery.data]);

  const decorComponentAbsorbItemsQuery = useQuery({
    queryKey: ["shipments-history-decor-component-absorb", decorComponentMasterIds.join("|")],
    enabled: decorComponentMasterIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      if (decorComponentMasterIds.length === 0) return [] as MasterAbsorbLaborItem[];
      const out: MasterAbsorbLaborItem[] = [];
      for (const ids of chunk(decorComponentMasterIds, 300)) {
        const response = await fetch(`/api/master-absorb-labor-items?master_ids=${encodeURIComponent(ids.join(","))}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: MasterAbsorbLaborItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "장식 컴포넌트 흡수공임 조회 실패");
        out.push(...(payload.data ?? []));
      }
      return out;
    },
  });

  const decorComponentAbsorbByMasterId = useMemo(() => {
    const map = new Map<string, MasterAbsorbLaborItem[]>();
    (decorComponentAbsorbItemsQuery.data ?? []).forEach((item) => {
      const masterId = String(item.master_id ?? "").trim();
      if (!masterId) return;
      const list = map.get(masterId) ?? [];
      list.push(item);
      map.set(masterId, list);
    });
    return map;
  }, [decorComponentAbsorbItemsQuery.data]);

  const decorLaborSellByProductMasterId = useMemo(() => {
    const map = new Map<string, number>();
    decorLinesByProductMasterId.forEach((lines, productMasterId) => {
      const sum = lines.reduce((acc, line) => {
        const componentMasterId = String(line.component_master_id ?? "").trim();
        if (!componentMasterId) return acc;
        const qtyPerUnit = Math.max(toNumber(line.qty_per_unit, 0), 0);
        if (!Number.isFinite(qtyPerUnit) || qtyPerUnit <= 0) return acc;
        const componentMasterRow =
          masterCatalogById.get(componentMasterId) ?? decorComponentCatalogByMasterId.get(componentMasterId);
        const componentAbsorb =
          masterAbsorbItemsByMasterId.get(componentMasterId) ??
          decorComponentAbsorbByMasterId.get(componentMasterId) ??
          [];
        const componentLaborSell = computeMasterLaborSellPerUnitWithAbsorb(componentMasterRow, componentAbsorb);
        if (!Number.isFinite(componentLaborSell)) return acc;
        return acc + componentLaborSell * qtyPerUnit;
      }, 0);
      map.set(productMasterId, sum);
    });
    return map;
  }, [
    decorComponentAbsorbByMasterId,
    decorComponentCatalogByMasterId,
    decorLinesByProductMasterId,
    masterAbsorbItemsByMasterId,
    masterCatalogById,
  ]);

  const catalogDerivedByLineId = useMemo(() => {
    const map = new Map<
      string,
      {
        modelName: string;
        materialCode: string;
        qty: number;
        totalWeightG: number | null;
        convertedWeightG: number | null;
        appliedTickKrwPerG: number | null;
        laborSellKrw: number | null;
        materialSellKrw: number | null;
        totalSellKrw: number | null;
        state: "loading" | "ready" | "error";
        message: string | null;
      }
    >();

    selectedGroupRows.forEach((row) => {
      const lineId = String(row.shipment_line_id ?? "").trim();
      if (!lineId) return;

      const resolvedMasterId = resolvedMasterIdByLineId.get(lineId) ?? "";
      const masterCatalog = resolvedMasterId
        ? masterCatalogById.get(resolvedMasterId)
        : masterCatalogByModelName.get(String(row.model_name ?? "").trim()) ??
          masterCatalogByNormalizedModel.get(normalizeModelKey(row.model_name));
      const masterPrice = resolvedMasterId ? masterEffectivePriceByMasterId.get(resolvedMasterId) ?? null : null;
      const masterPriceState = resolvedMasterId ? masterEffectivePriceStateByMasterId.get(resolvedMasterId) ?? {
        isLoading: false,
        isError: false,
        message: null,
      } : {
        isLoading: false,
        isError: false,
        message: null,
      };

      const lineMaterialCodeRaw = String(row.material_code ?? "").trim();
      const masterMaterialCodeRaw = String(masterCatalog?.material_code_default ?? "").trim();
      const normalizedLineMaterialCode = normalizeMaterialCode(lineMaterialCodeRaw);
      const normalizedMasterMaterialCode = normalizeMaterialCode(masterMaterialCodeRaw);
      const normalizedMaterialCode =
        normalizedLineMaterialCode && normalizedLineMaterialCode !== "00"
          ? normalizedLineMaterialCode
          : normalizedMasterMaterialCode;
      const rawMaterialCode = lineMaterialCodeRaw || masterMaterialCodeRaw;
      const is14To18Converted = normalizedMasterMaterialCode === "14" && normalizedMaterialCode === "18";

      const weightDefault = toNumber(masterCatalog?.weight_default_g, Number.NaN);
      const deductionDefault = toNumber(masterCatalog?.deduction_weight_default_g, 0);
      const grossWeightForMaterial = Number.isFinite(weightDefault)
        ? is14To18Converted
          ? weightDefault * 1.2
          : weightDefault
        : Number.NaN;
      const totalWeightG = Number.isFinite(grossWeightForMaterial)
        ? Math.max(grossWeightForMaterial - Math.max(deductionDefault, 0), 0)
        : null;
      const netWeightG = Number.isFinite(grossWeightForMaterial)
        ? Math.max(grossWeightForMaterial - Math.max(deductionDefault, 0), 0)
        : Number.NaN;

      const convertedWeightRaw = Number.isFinite(netWeightG)
        ? calcCommodityDueG({
            netWeightG,
            materialCode: normalizedMaterialCode,
            factors: materialFactorMap,
          })
        : Number.NaN;
      const convertedWeightG = Number.isFinite(convertedWeightRaw) && convertedWeightRaw > 0
        ? convertedWeightRaw
        : null;

      const ticks = marketTicksQuery.data?.data;
      const isSilver = normalizedMaterialCode === "925" || normalizedMaterialCode === "999";
      const tickRaw = isSilver
        ? Number(ticks?.silverOriginal ?? Number.NaN)
        : Number(ticks?.gold ?? Number.NaN);
      const appliedTickKrwPerG = Number.isFinite(tickRaw)
        ? Math.ceil(tickRaw)
        : 0;

      const tickForMaterialCalc =
        typeof appliedTickKrwPerG === "number" && Number.isFinite(appliedTickKrwPerG)
          ? appliedTickKrwPerG
          : 0;
      const materialFromBreakdown = readBreakdownSell(masterPrice, "MATERIAL");
      const laborFromBreakdown = readBreakdownSell(masterPrice, "LABOR");
      const centerQtyDefault = Math.max(toNumber(masterCatalog?.center_qty_default, 0), 0);
      const sub1QtyDefault = Math.max(toNumber(masterCatalog?.sub1_qty_default, 0), 0);
      const sub2QtyDefault = Math.max(toNumber(masterCatalog?.sub2_qty_default, 0), 0);
      const absorbItemsRaw = resolvedMasterId ? (masterAbsorbItemsByMasterId.get(resolvedMasterId) ?? []) : [];
      const manualAbsorbItems = absorbItemsRaw.filter((item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item));
      const absorbImpactSummary = computeAbsorbImpactSummary(
        manualAbsorbItems,
        centerQtyDefault,
        sub1QtyDefault,
        sub2QtyDefault
      );
      const decorLaborSellTotal = resolvedMasterId ? (decorLaborSellByProductMasterId.get(resolvedMasterId) ?? 0) : 0;
      const laborSellByCatalog =
        (Math.max(toNumber(masterCatalog?.labor_base_sell, 0), 0) + absorbImpactSummary.baseLaborUnit) +
        (Math.max(toNumber(masterCatalog?.labor_center_sell, 0), 0) + absorbImpactSummary.stoneCenterUnit) * centerQtyDefault +
        (Math.max(toNumber(masterCatalog?.labor_sub1_sell, 0), 0) + absorbImpactSummary.stoneSub1Unit) * sub1QtyDefault +
        (Math.max(toNumber(masterCatalog?.labor_sub2_sell, 0), 0) + absorbImpactSummary.stoneSub2Unit) * sub2QtyDefault +
        (Math.max(toNumber(masterCatalog?.plating_price_sell_default, 0), 0) + absorbImpactSummary.platingUnit) +
        absorbImpactSummary.etc +
        decorLaborSellTotal;
      const materialDerivedRaw = calcMaterialAmountSellKrw({
        netWeightG: Number.isFinite(netWeightG) ? netWeightG : 0,
        tickPriceKrwPerG: tickForMaterialCalc,
        materialCode: normalizedMaterialCode,
        factors: materialFactorMap,
      });
      const materialSellKrw = Number.isFinite(materialDerivedRaw)
        ? materialDerivedRaw
        : null;
      const shouldPreferDerivedMaterial =
        Boolean(masterCatalog) &&
        Boolean(normalizedMaterialCode) &&
        Boolean(normalizedMasterMaterialCode) &&
        normalizedMaterialCode !== normalizedMasterMaterialCode;
      const materialSellResolved = shouldPreferDerivedMaterial
        ? materialSellKrw
        : materialFromBreakdown !== null
          ? materialFromBreakdown
          : materialSellKrw;
      const hasMaterialSellKrw = typeof materialSellResolved === "number" && Number.isFinite(materialSellResolved);

      const totalFromPrice = Number.isFinite(masterPrice?.total_total_sell_krw)
        ? Number(masterPrice?.total_total_sell_krw)
        : Number.isFinite(masterPrice?.unit_total_sell_krw)
          ? Number(masterPrice?.unit_total_sell_krw)
          : Number.NaN;

      const hasCatalogLabor = Number.isFinite(laborSellByCatalog) && Boolean(masterCatalog);
      const laborSellKrw = hasCatalogLabor
        ? laborSellByCatalog
        : laborFromBreakdown !== null
          ? laborFromBreakdown
          : Number.isFinite(totalFromPrice) && hasMaterialSellKrw
            ? Math.max(totalFromPrice - materialSellResolved, 0)
            : null;
      const hasLaborSellKrw = typeof laborSellKrw === "number" && Number.isFinite(laborSellKrw);
      const totalSellRaw = hasMaterialSellKrw && hasLaborSellKrw ? materialSellResolved + laborSellKrw : Number.NaN;
      const totalSellKrw = Number.isFinite(totalFromPrice)
        ? totalFromPrice
        : Number.isFinite(totalSellRaw)
          ? roundUpDisplayHundred(totalSellRaw)
          : null;

      const modelLookupState = modelLookupStateByName.get(String(row.model_name ?? "").trim()) ?? {
        isLoading: false,
        isError: false,
        message: null,
      };
      const decorErrorMessage = bomDecorLinesQuery.isError
        ? (bomDecorLinesQuery.error as Error | undefined)?.message ?? "장식 라인 조회 실패"
        : null;
      const decorComponentErrorMessage = decorComponentCatalogQuery.isError
        ? (decorComponentCatalogQuery.error as Error | undefined)?.message ?? "장식 컴포넌트 마스터 조회 실패"
        : decorComponentAbsorbItemsQuery.isError
          ? (decorComponentAbsorbItemsQuery.error as Error | undefined)?.message ?? "장식 컴포넌트 흡수공임 조회 실패"
          : null;

      const message =
        !resolvedMasterId
          ? modelLookupState.isLoading
            ? "모델명으로 마스터 조회중"
            : modelLookupState.isError
              ? modelLookupState.message ?? "모델 마스터 조회 실패"
              : "마스터 매핑 없음"
          : !masterCatalog
            ? "마스터 상세 없음"
            : masterAbsorbItemsQuery.isError
              ? (masterAbsorbItemsQuery.error as Error | undefined)?.message ?? "흡수공임 조회 실패"
              : decorErrorMessage
                ? decorErrorMessage
                : decorComponentErrorMessage
                  ? decorComponentErrorMessage
                  : null;

      map.set(lineId, {
        modelName: String(masterCatalog?.model_name ?? row.model_display),
        materialCode: rawMaterialCode,
        qty: 1,
        totalWeightG,
        convertedWeightG,
        appliedTickKrwPerG,
        laborSellKrw,
        materialSellKrw: materialSellResolved,
        totalSellKrw,
        state:
          masterPriceState.isLoading ||
          modelLookupState.isLoading ||
          masterAbsorbItemsQuery.isLoading ||
          bomDecorLinesQuery.isLoading ||
          decorComponentCatalogQuery.isLoading ||
          decorComponentAbsorbItemsQuery.isLoading
            ? "loading"
            : message
              ? "error"
              : "ready",
        message,
      });
    });

    return map;
  }, [
    bomDecorLinesQuery.error,
    bomDecorLinesQuery.isError,
    bomDecorLinesQuery.isLoading,
    decorComponentAbsorbItemsQuery.error,
    decorComponentAbsorbItemsQuery.isError,
    decorComponentAbsorbItemsQuery.isLoading,
    decorComponentCatalogQuery.error,
    decorComponentCatalogQuery.isError,
    decorComponentCatalogQuery.isLoading,
    decorLaborSellByProductMasterId,
    masterAbsorbItemsByMasterId,
    masterAbsorbItemsQuery.error,
    masterAbsorbItemsQuery.isError,
    masterAbsorbItemsQuery.isLoading,
    masterCatalogById,
    masterCatalogByModelName,
    masterCatalogByNormalizedModel,
    masterEffectivePriceByMasterId,
    masterEffectivePriceStateByMasterId,
    marketTicksQuery.data,
    materialFactorMap,
    modelLookupStateByName,
    resolvedMasterIdByLineId,
    selectedGroupRows,
  ]);

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.qty += row.qty;
        acc.total += row.total_amount_sell_krw;
        return acc;
      },
      { count: 0, qty: 0, total: 0 }
    );
  }, [visibleRows]);

  const subtitle = `기간: ${range.from} ~ ${range.to} · 기준: 출고 확정 · 라인 ${totals.count}건`;

  const selectedLineDetailQuery = useQuery({
    queryKey: ["shipment-line-detail-breakdown", "sot-v4", selectedDetailRow?.shipment_line_id ?? ""],
    enabled: Boolean(schemaClient) && Boolean(selectedDetailRow?.shipment_line_id),
    queryFn: async () => {
      if (!schemaClient || !selectedDetailRow?.shipment_line_id) {
        return {
          line: null as ShipmentLineDetailRow | null,
          invoice: null as InvoicePositionDetailRow | null,
        };
      }

      const lineId = selectedDetailRow.shipment_line_id;
      const { data: lineData, error: lineError } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, order_line_id, master_id, model_name, suffix, color, size, qty, material_code, measured_weight_g, deduction_weight_g, net_weight_g, base_labor_krw, extra_labor_krw, extra_labor_items, labor_total_sell_krw, material_amount_sell_krw, total_amount_sell_krw, created_at"
        )
        .eq("shipment_line_id", lineId)
        .maybeSingle();
      if (lineError) throw lineError;

      const { data: invoiceData, error: invoiceError } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select("shipment_line_id, commodity_due_g, labor_cash_due_krw, material_cash_due_krw, total_cash_due_krw")
        .eq("shipment_line_id", lineId)
        .maybeSingle();
      if (invoiceError) throw invoiceError;

      let matchData: ReceiptMatchPolicyRow | null = null;
      try {
        const policyRes = await fetch(`/api/shipment-line-policy-meta?shipment_line_id=${encodeURIComponent(lineId)}`, {
          cache: "no-store",
        });
        if (policyRes.ok) {
          const payload = (await policyRes.json()) as { data?: ReceiptMatchPolicyRow | null };
          matchData = payload.data ?? null;
        }
      } catch {
        matchData = null;
      }

      let prefillData: ShipmentPrefillSnapshotData | null = null;
      const orderLineId = String((lineData as ShipmentLineDetailRow | null)?.order_line_id ?? "").trim();
      if (orderLineId) {
        try {
          const prefillRes = await fetch(
            `/api/shipment-receipt-prefill?order_line_id=${encodeURIComponent(orderLineId)}`,
            { cache: "no-store" }
          );
          if (prefillRes.ok) {
            const payload = (await prefillRes.json()) as { data?: ShipmentPrefillSnapshotData | null };
            prefillData = payload.data ?? null;
          }
        } catch {
          prefillData = null;
        }
      }

      return {
        line: (lineData ?? null) as ShipmentLineDetailRow | null,
        invoice: (invoiceData ?? null) as InvoicePositionDetailRow | null,
        match: matchData,
        prefill: prefillData,
      };
    },
  });

  const selectedLineDetail = useMemo(() => selectedLineDetailQuery.data?.line ?? null, [selectedLineDetailQuery.data]);
  const selectedLineInvoice = useMemo(() => selectedLineDetailQuery.data?.invoice ?? null, [selectedLineDetailQuery.data]);
  const selectedLineMatch = useMemo(() => selectedLineDetailQuery.data?.match ?? null, [selectedLineDetailQuery.data]);
  const selectedLinePrefill = useMemo(
    () => (selectedLineDetailQuery.data?.prefill ?? null) as ShipmentPrefillSnapshotData | null,
    [selectedLineDetailQuery.data]
  );

  const selectedLineUnitPricingQuery = useQuery({
    queryKey: ["shipments-history-selected-line-unit-pricing", selectedLineDetail?.master_id ?? ""],
    enabled: Boolean(schemaClient && selectedLineDetail?.master_id),
    queryFn: async () => {
      if (!schemaClient || !selectedLineDetail?.master_id) return null;
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("is_unit_pricing")
        .eq("master_id", String(selectedLineDetail.master_id))
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as { is_unit_pricing?: boolean | null } | null;
    },
  });

  const laborBreakdownRows = useMemo(() => {
    const prefillSnapshot =
      selectedLinePrefill?.labor_prefill_snapshot &&
        typeof selectedLinePrefill.labor_prefill_snapshot === "object" &&
        !Array.isArray(selectedLinePrefill.labor_prefill_snapshot)
        ? (selectedLinePrefill.labor_prefill_snapshot as Record<string, unknown>)
        : null;
    const extraItemsSource = prefillSnapshot?.extra_labor_items ?? selectedLineDetail?.extra_labor_items;
    const normalized = normalizeExtraLaborItemsWithStableIds(extraItemsSource) as Array<Record<string, unknown>>;
    const sanitized = normalized.filter((item: Record<string, unknown>) => {
      const type = String(item?.type ?? "").trim().toUpperCase();
      const label = String(item?.label ?? "").trim();
      const meta = item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta)
        ? (item.meta as Record<string, unknown>)
        : null;
      const className = String(meta?.class ?? "").trim().toUpperCase();
      const source = String(meta?.source ?? "").trim().toUpperCase();
      const itemLabel = String(meta?.item_label ?? "").trim();
      const isDecorLike =
        label.includes("장식") ||
        label.includes("[장식]") ||
        itemLabel.includes("장식") ||
        itemLabel.includes("[장식]");

      // shipments 페이지와 동일하게 material_master 계열은 기본 제거하되,
      // 장식 계열로 분류된 항목은 표시를 위해 유지한다.
      if (type.startsWith("MATERIAL_MASTER") && !isDecorLike) return false;
      if (className === "MATERIAL_MASTER" && !isDecorLike) return false;
      if (source === "MASTER_MATERIAL_LABOR" && !isDecorLike) return false;
      return true;
    });

    const materialized = materializeSnapshotPolicyItems({
      items: sanitized,
      policyMeta: prefillSnapshot ?? selectedLineMatch?.pricing_policy_meta ?? selectedLinePrefill?.pricing_policy_meta ?? null,
    });

    const rows = normalizeExtraLaborBreakdown(materialized);
    const policyMeta =
      prefillSnapshot ??
      (selectedLineMatch?.pricing_policy_meta &&
        typeof selectedLineMatch.pricing_policy_meta === "object" &&
        !Array.isArray(selectedLineMatch.pricing_policy_meta)
        ? (selectedLineMatch.pricing_policy_meta as Record<string, unknown>)
        : selectedLinePrefill?.pricing_policy_meta &&
          typeof selectedLinePrefill.pricing_policy_meta === "object" &&
          !Array.isArray(selectedLinePrefill.pricing_policy_meta)
          ? (selectedLinePrefill.pricing_policy_meta as Record<string, unknown>)
          : null);
    const policyDecorAmount = Math.max(
      toNumber(policyMeta?.policy_absorb_decor_total_krw ?? policyMeta?.absorb_decor_total_krw, 0),
      0
    );
    const hasDecorItem = rows.some((item) => {
      const type = String(item.type ?? "").trim().toUpperCase();
      const label = String(item.label ?? "");
      return type.startsWith("DECOR:") || type.startsWith("ABSORB:") || label.includes("[장식]") || label.includes("장식");
    });

    const decorSellSum = rows.reduce((sum, item) => {
      const type = String(item.type ?? "").trim().toUpperCase();
      const label = String(item.label ?? "");
      const isDecorLike =
        type.startsWith("DECOR:") || type.startsWith("ABSORB:") || label.includes("[장식]") || label.includes("장식");
      if (!isDecorLike) return sum;
      return sum + toNumber(item.sellKrw, 0);
    }, 0);

    if (!hasDecorItem && policyDecorAmount > 0) {
      rows.push({
        id: "decor-policy-absorb",
        type: "DECOR:POLICY_ABSORB",
        label: "[장식] 정책 흡수공임",
        qtyApplied: null,
        sellKrw: policyDecorAmount,
        costKrw: 0,
        marginKrw: policyDecorAmount,
        source: "PRICING_POLICY_META",
        reason: "policy_absorb_decor_total_krw",
      });
    } else if (hasDecorItem && policyDecorAmount - decorSellSum > 0.5) {
      rows.push({
        id: "decor-policy-absorb-delta",
        type: "DECOR:POLICY_ABSORB_DELTA",
        label: "[장식] 정책 흡수공임 보정",
        qtyApplied: null,
        sellKrw: Math.max(policyDecorAmount - decorSellSum, 0),
        costKrw: 0,
        marginKrw: Math.max(policyDecorAmount - decorSellSum, 0),
        source: "PRICING_POLICY_META",
        reason: "policy_absorb_decor_total_krw_delta",
      });
    }

    return rows;
  }, [
    selectedLineDetail?.extra_labor_items,
    selectedLineDetail?.extra_labor_krw,
    selectedLineMatch?.pricing_policy_meta,
    selectedLineMatch?.selected_factory_labor_other_cost_krw,
    selectedLinePrefill,
  ]);

  const displayedLaborBreakdownRows = useMemo(
    () => {
      const baseRows = laborBreakdownRows.filter((item) => {
        const isAutoRemainderAdjustment =
          isAdjustmentTypeValue(item.type) &&
          String(item.source ?? "").trim().toUpperCase() === AUTO_REMAINDER_ADJUSTMENT_SOURCE;
        const isStoneLabor = String(item.type ?? "").trim().toUpperCase() === "STONE_LABOR";
        return (isCoreVisibleEtcItem({ type: item.type, label: item.label }) || isStoneLabor) && !isAutoRemainderAdjustment;
      });

      const snapshotExtraSellRaw =
        toNumber(selectedLinePrefill?.labor_prefill_snapshot?.extra_labor_sell_krw, Number.NaN) ||
        toNumber(selectedLineDetail?.extra_labor_krw, Number.NaN);
      const snapshotExtraSell = Number.isFinite(snapshotExtraSellRaw) ? snapshotExtraSellRaw : 0;
      const snapshotExtraCostRaw =
        toNumber(selectedLinePrefill?.labor_prefill_snapshot?.extra_labor_cost_krw, Number.NaN) ||
        toNumber(selectedLinePrefill?.selected_factory_labor_other_cost_krw, Number.NaN) ||
        toNumber(selectedLinePrefill?.receipt_labor_other_cost_krw, Number.NaN) ||
        toNumber(selectedLineMatch?.selected_factory_labor_other_cost_krw, Number.NaN);
      const snapshotExtraCost = Number.isFinite(snapshotExtraCostRaw) ? Math.max(snapshotExtraCostRaw, 0) : null;

      const displayedSellSum = baseRows.reduce((sum, row) => sum + toNumber(row.sellKrw, 0), 0);
      const displayedCostSum = baseRows.reduce((sum, row) => sum + toNumber(row.costKrw, 0), 0);
      const sellGap = snapshotExtraSell - displayedSellSum;
      const costGap = snapshotExtraCost === null ? null : snapshotExtraCost - displayedCostSum;

      if (Math.abs(sellGap) > 0.5 || (costGap !== null && Math.abs(costGap) > 0.5)) {
        const reconcileSell = sellGap;
        const reconcileCost = costGap;
        baseRows.push({
          id: "extra-labor-snapshot-reconcile",
          type: "DECOR:SNAPSHOT_RECONCILE",
          label: "[장식] 스냅샷 보정",
          qtyApplied: null,
          sellKrw: reconcileSell,
          costKrw: reconcileCost,
          marginKrw: reconcileCost === null ? null : reconcileSell - reconcileCost,
          source: "SHIPMENT_SNAPSHOT",
          reason: "extra_labor_sell/cost_snapshot_gap",
        });
      }

      return baseRows;
    },
    [laborBreakdownRows, selectedLineDetail?.extra_labor_krw, selectedLineMatch?.selected_factory_labor_other_cost_krw, selectedLinePrefill]
  );

  const classifyLaborDetailCategory = (item: ExtraLaborBreakdownRow): LaborDetailCategory => {
    const type = String(item.type ?? "").trim().toUpperCase();
    const label = String(item.label ?? "").trim();
    const source = String(item.source ?? "").trim().toUpperCase();
    const isDecorLike =
      type.startsWith("DECOR:") ||
      type.startsWith("ABSORB:") ||
      label.includes("[장식]") ||
      label.includes("장식") ||
      source.includes("DECOR");

    if (type === "BASE_LABOR" || label.includes("기본공임")) return "BASE";
    if (type === "STONE_LABOR" || label.includes("알공임") || label.includes("중심공임") || label.includes("보조")) return "STONE";
    if (type.includes("PLATING") || label.includes("도금")) return "PLATING";
    if (isDecorLike) return "DECOR";
    return "ETC";
  };

  const orderedLaborBreakdownRows = useMemo(() => {
    const order: Record<LaborDetailCategory, number> = {
      BASE: 0,
      STONE: 1,
      PLATING: 2,
      DECOR: 3,
      ETC: 4,
    };
    return displayedLaborBreakdownRows
      .map((item, index) => ({ item, index, category: classifyLaborDetailCategory(item) }))
      .sort((a, b) => {
        const byCategory = order[a.category] - order[b.category];
        if (byCategory !== 0) return byCategory;
        const byLabel = String(a.item.label ?? "").localeCompare(String(b.item.label ?? ""), "ko-KR");
        if (byLabel !== 0) return byLabel;
        return a.index - b.index;
      })
      .map((row) => row.item);
  }, [displayedLaborBreakdownRows]);

  const laborBreakdownTotals = useMemo(() => {
    const extraSell = displayedLaborBreakdownRows.reduce((sum, row) => sum + row.sellKrw, 0);
    const extraCost = displayedLaborBreakdownRows.reduce((sum, row) => sum + (row.costKrw ?? 0), 0);
    const extraMargin = displayedLaborBreakdownRows.reduce((sum, row) => sum + (row.marginKrw ?? 0), 0);
    const extraCostSnapshot =
      toNumber(selectedLinePrefill?.labor_prefill_snapshot?.extra_labor_cost_krw, Number.NaN) ||
      toNumber(selectedLinePrefill?.selected_factory_labor_other_cost_krw, Number.NaN) ||
      toNumber(selectedLinePrefill?.receipt_labor_other_cost_krw, Number.NaN) ||
      toNumber(selectedLineMatch?.selected_factory_labor_other_cost_krw, Number.NaN);

    const baseSell = toNumber(selectedLineDetail?.base_labor_krw, 0);
    const extraSellSnapshotRaw =
      toNumber(selectedLinePrefill?.labor_prefill_snapshot?.extra_labor_sell_krw, Number.NaN) ||
      toNumber(selectedLineDetail?.extra_labor_krw, Number.NaN);
    const extraSellSnapshot = Number.isFinite(extraSellSnapshotRaw) ? extraSellSnapshotRaw : 0;
    const laborSellSot = toNumber(selectedLineInvoice?.labor_cash_due_krw, toNumber(selectedDetailRow?.labor_total_sell_krw, 0));
    const lineTotalSell = toNumber(selectedLineDetail?.total_amount_sell_krw, toNumber(selectedDetailRow?.total_amount_sell_krw, 0));

    return {
      baseSell,
      extraSell,
      extraSellSnapshot,
      extraCost,
      extraCostSnapshot: Number.isFinite(extraCostSnapshot) ? extraCostSnapshot : null,
      extraCostDelta:
        Number.isFinite(extraCostSnapshot) ? extraCostSnapshot - extraCost : null,
      extraMargin,
      laborSellSot,
      lineTotalSell,
      extraDelta: extraSellSnapshot - extraSell,
      lineQty: toNumber(selectedLineDetail?.qty, toNumber(selectedDetailRow?.qty, 0)),
      lineWeightG: toNumber(
        selectedLineDetail?.net_weight_g,
        toNumber(
          selectedLineDetail?.measured_weight_g, toNumber(selectedDetailRow?.net_weight_g, 0)
        )
      ),
      materialSot: toNumber(selectedLineInvoice?.material_cash_due_krw, toNumber(selectedDetailRow?.material_amount_sell_krw, 0)),
      totalSot: toNumber(selectedLineInvoice?.total_cash_due_krw, toNumber(selectedDetailRow?.total_amount_sell_krw, 0)),
    };
  }, [displayedLaborBreakdownRows, selectedDetailRow, selectedLineDetail, selectedLineInvoice, selectedLinePrefill, selectedLineMatch]);

  const isSelectedLineUnitPricing = Boolean(selectedLineUnitPricingQuery.data?.is_unit_pricing);
  const compareTargetValue = isSelectedLineUnitPricing
    ? laborBreakdownTotals.lineTotalSell
    : laborBreakdownTotals.baseSell + laborBreakdownTotals.extraSell;
  const compareSotValue = isSelectedLineUnitPricing
    ? laborBreakdownTotals.totalSot
    : laborBreakdownTotals.laborSellSot;
  const compareDiff = compareTargetValue - compareSotValue;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 모바일 세그먼트: 출고대기 | 출고완료 — lg:hidden */}
      <ShipmentsMobileTabs />
      <div className="border-b border-[var(--panel-border)] bg-[var(--background)]/80 px-6 py-4 backdrop-blur">
        <ActionBar
          title="출고 확인"
          subtitle={subtitle}
          actions={
            <Button variant="secondary" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching}>
              {historyQuery.isFetching ? "갱신 중..." : "새로고침"}
            </Button>
          }
        />
      </div>

      <div className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Card className="w-full lg:w-[380px] lg:shrink-0">
            <CardHeader className="px-4 py-3">
              <div className="text-sm font-semibold">그룹/필터</div>
            </CardHeader>
            <CardBody className="px-4 py-4">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--muted)]">그룹 기준</div>
                  <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupByKey)}>
                    <option value="date">날짜별</option>
                    <option value="customer">고객별</option>
                    <option value="model">모델명별</option>
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--muted)]">검색</div>
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="고객/모델/날짜 검색"
                    autoFormat={false}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-[var(--muted)]">시작일</div>
                    <Input type="date" value={fromYmd} onChange={(event) => setFromYmd(event.target.value)} autoFormat={false} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-[var(--muted)]">종료일</div>
                    <Input type="date" value={toYmd} onChange={(event) => setToYmd(event.target.value)} autoFormat={false} />
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--muted)]">고객</div>
                  <Select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                    <option value="ALL">전체</option>
                    {customerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-[var(--muted)]">모델</div>
                  <Select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                    <option value="ALL">전체</option>
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                </div>

                <label className="flex items-center gap-2 rounded border border-[var(--panel-border)] bg-[var(--chip)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeStorePickup}
                    onChange={(event) => setIncludeStorePickup(event.target.checked)}
                    className="h-4 w-4"
                  />
                  매장출고 포함
                </label>

                <div className="rounded border border-[var(--panel-border)]">
                  <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] px-3 py-2 text-xs font-medium text-[var(--muted)]">
                    그룹 목록 ({groups.length})
                  </div>

                  <div className="max-h-[420px] overflow-y-auto">
                    {historyQuery.isLoading ? (
                      <div className="space-y-2 p-3">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="p-6 text-center text-sm text-[var(--muted)]">조건에 맞는 그룹이 없습니다.</div>
                    ) : (
                      <div className="p-2">
                        {groups.map((group) => {
                          const active = group.key === selectedGroupKey;
                          return (
                            <button
                              key={group.key}
                              type="button"
                              onClick={() => setSelectedGroupKey(group.key)}
                              className={cn(
                                "mb-2 w-full rounded-lg border p-3 text-left transition-colors",
                                active
                                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                                  : "border-[var(--panel-border)] hover:bg-[var(--panel-hover)]"
                              )}
                            >
                              <div className="truncate text-sm font-semibold">{group.label || "-"}</div>
                              <div className="mt-1 flex items-center justify-between text-xs text-[var(--muted)]">
                                <span>라인 {group.count}건</span>
                                <span>{formatKrw(group.sumTotalKrw)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card>
                <CardBody className="px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">필터 기준 라인수</div>
                  <div className="text-xl font-bold">{totals.count}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">수량 합계</div>
                  <div className="text-xl font-bold">{totals.qty}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="px-4 py-3">
                  <div className="text-xs text-[var(--muted)]">금액 합계</div>
                  <div className="text-xl font-bold">{formatKrw(totals.total)}</div>
                </CardBody>
              </Card>
            </div>

            <Card className="min-h-[540px]">
              <CardHeader className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{selectedGroup?.label ?? "출고 내역"}</div>
                  {selectedGroup ? (
                    <Badge tone="primary">
                      {selectedGroup.count}건 / {formatKrw(selectedGroup.sumTotalKrw)}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardBody className="px-0 py-0">
                {historyQuery.isLoading ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : historyQuery.error ? (
                  <div className="p-6 text-sm text-[var(--danger)]">
                    데이터를 불러오지 못했습니다: {String((historyQuery.error as Error)?.message ?? historyQuery.error)}
                  </div>
                ) : !selectedGroup ? (
                  <div className="p-12 text-center text-[var(--muted)]">좌측에서 그룹을 선택해 주세요.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[var(--panel-border)] bg-[var(--chip)] text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-3 whitespace-nowrap">출고일</th>
                          <th className="px-4 py-3 whitespace-nowrap">공임일치</th>
                          <th className="px-4 py-3 whitespace-nowrap">고객</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">단가제</th>
                          <th className="px-4 py-3 whitespace-nowrap">모델</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">소재</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">수량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">중량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">환산중량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">적용시세</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">총공임</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">소재금액</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">합계</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {selectedGroup.rows.map((row) => {
                          const catalogDerived = catalogDerivedByLineId.get(row.shipment_line_id) ?? null;
                          const derived = catalogDerived ?? {
                            modelName: row.model_display,
                            materialCode: row.material_code,
                            qty: 1,
                            totalWeightG: null,
                            convertedWeightG: null,
                            appliedTickKrwPerG: null,
                            laborSellKrw: null,
                            materialSellKrw: null,
                            totalSellKrw: null,
                            state: "error" as const,
                            message: "마스터 계산 준비중",
                          };
                          return (
                            <Fragment key={row.shipment_line_id}>
                              <tr
                                className="cursor-pointer hover:bg-[var(--panel-hover)]"
                                onClick={() => setSelectedDetailRow(row)}
                              >
                                <td className="px-4 py-3 tabular-nums">{row.ship_date}</td>
                                <td className="px-4 py-3 text-center">
                                  {row.labor_consistent ? <Badge tone="active">일치</Badge> : <Badge tone="danger">불일치</Badge>}
                                </td>
                                <td className="px-4 py-3">{row.customer_name}</td>
                                <td className="px-4 py-3 text-center">
                                  {row.is_unit_pricing ? <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800">단가제</Badge> : "-"}
                                </td>
                                <td className="px-4 py-3">{row.model_display}</td>
                                <td className="px-4 py-3 text-center">{formatMaterialCode(row.material_code)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.qty}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatGram(row.net_weight_g)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.commodity_due_g === null ? "-" : formatGram(row.commodity_due_g)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.commodity_price_snapshot_krw_per_g === null ? "-" : `${formatKrw(row.commodity_price_snapshot_krw_per_g)}/g`}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatKrw(row.labor_total_sell_krw)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatKrw(row.material_amount_sell_krw)}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKrw(row.total_amount_sell_krw)}</td>
                              </tr>
                              <tr className="bg-[var(--chip)]/35 text-[11px] text-[var(--muted)]">
                                <td className="px-4 py-2">마스터</td>
                                <td className="px-4 py-2">-</td>
                                <td className="px-4 py-2">-</td>
                                <td className="px-4 py-2">-</td>
                                {derived.state === "loading" ? (
                                  <td className="px-4 py-2" colSpan={9}>불러오는 중...</td>
                                ) : derived.state === "error" ? (
                                  <td className="px-4 py-2 text-[var(--danger)]" colSpan={9}>{derived.message ?? "마스터 매핑 실패"}</td>
                                ) : (
                                  <>
                                    <td className="px-4 py-2 text-[var(--foreground)]">{derived.modelName}</td>
                                    <td className="px-4 py-2 text-center text-[var(--foreground)]">{formatMaterialCode(derived.materialCode)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">1</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">{derived.totalWeightG === null ? "-" : formatGram(derived.totalWeightG)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">{derived.convertedWeightG === null ? "-" : formatGram(derived.convertedWeightG)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">{derived.appliedTickKrwPerG === null ? "-" : `${formatKrw(derived.appliedTickKrwPerG)}/g`}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">{derived.laborSellKrw === null ? "-" : formatKrw(derived.laborSellKrw)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums text-[var(--foreground)]">{derived.materialSellKrw === null ? "-" : formatKrw(derived.materialSellKrw)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-[var(--foreground)]">{derived.totalSellKrw === null ? "-" : formatKrw(derived.totalSellKrw)}</td>
                                  </>
                                )}
                              </tr>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selectedDetailRow)}
        onClose={() => setSelectedDetailRow(null)}
        title={selectedDetailRow ? `${selectedDetailRow.model_display} 출고 상세` : "출고 상세"}
        className="w-[min(980px,100vw)] !bg-white"
      >
        <div className="min-h-full space-y-4 bg-white p-4">
          {selectedDetailRow ? (
            <Card className="bg-white">
              <CardBody className="px-4 py-3">
                <div className="grid grid-cols-1 gap-3 text-xs text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <div>선택 라인</div>
                    <div className="mt-1 font-mono text-[var(--foreground)]">{selectedDetailRow.shipment_line_id}</div>
                  </div>
                  <div>
                    <div>제품</div>
                    <div className="mt-1 font-semibold text-[var(--foreground)]">{selectedDetailRow.model_display}</div>
                  </div>
                  <div>
                    <div>현재 출고일</div>
                    <div className="mt-1 text-[var(--foreground)]">{selectedDetailRow.ship_date}</div>
                  </div>
                  <div>
                    <div>공임 일치</div>
                    <div className="mt-1">
                      {selectedDetailRow.labor_consistent ? <Badge tone="active">일치</Badge> : <Badge tone="danger">불일치</Badge>}
                    </div>
                  </div>
                  <div>
                    <div>현재 고객</div>
                    <div className="mt-1 text-[var(--foreground)]">{selectedDetailRow.customer_name}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card className="bg-white">
              <CardBody className="px-4 py-3">
                <div className="text-xs text-[var(--muted)]">선택 라인 수량/중량</div>
                <div className="text-lg font-bold">
                  {laborBreakdownTotals.lineQty} / {formatGram(laborBreakdownTotals.lineWeightG)}
                </div>
              </CardBody>
            </Card>
            <Card className="bg-white">
              <CardBody className="px-4 py-3">
                <div className="text-xs text-[var(--muted)]">공임 SOT (원장)</div>
                <div className="text-lg font-bold">
                  {formatKrw(laborBreakdownTotals.laborSellSot)}
                </div>
              </CardBody>
            </Card>
            <Card className="col-span-2 bg-white md:col-span-1">
              <CardBody className="px-4 py-3">
                <div className="text-xs text-[var(--muted)]">소재/합계 SOT</div>
                <div className="text-sm font-bold">
                  {formatKrw(laborBreakdownTotals.materialSot)} / {formatKrw(laborBreakdownTotals.totalSot)}
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="bg-white">
            <CardHeader className="px-4 py-3">
              <div className="text-sm font-semibold">선택 라인 공임 항목 상세</div>
            </CardHeader>
            <CardBody className="px-0 py-0">
              {selectedLineDetailQuery.isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : selectedLineDetailQuery.error ? (
                <div className="p-6 text-sm text-[var(--danger)]">
                  상세 데이터를 불러오지 못했습니다: {String((selectedLineDetailQuery.error as Error)?.message ?? selectedLineDetailQuery.error)}
                </div>
              ) : !selectedLineDetail ? (
                <div className="p-8 text-center text-sm text-[var(--muted)]">선택 라인 상세를 찾을 수 없습니다.</div>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="rounded border border-[var(--panel-border)] bg-[var(--chip)]/50 p-3 text-xs text-[var(--muted)]">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span>라인ID: <span className="font-mono text-[var(--foreground)]">{selectedLineDetail.shipment_line_id ?? "-"}</span></span>
                      <span>소재코드: <span className="text-[var(--foreground)]">{String(selectedLineDetail.material_code ?? "-")}</span></span>
                      <span>기본공임: <span className="font-semibold text-[var(--foreground)]">{formatKrw(laborBreakdownTotals.baseSell)}</span></span>
                      <span>추가공임(스냅샷): <span className="font-semibold text-[var(--foreground)]">{formatKrw(laborBreakdownTotals.extraSellSnapshot)}</span></span>
                      <span>추가공임원가(스냅샷): <span className="font-semibold text-[var(--foreground)]">{laborBreakdownTotals.extraCostSnapshot === null ? "-" : formatKrw(laborBreakdownTotals.extraCostSnapshot)}</span></span>
                    </div>
                  </div>

                  <div className="max-h-[52vh] overflow-auto rounded border border-[var(--panel-border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-[var(--panel-border)] bg-[var(--chip)] text-[var(--muted)]">
                        <tr>
                          <th className="px-4 py-3 whitespace-nowrap">항목</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">수량기준</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">원가</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">마진</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">판매금액</th>
                          <th className="px-4 py-3 whitespace-nowrap">근거/메모</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        <tr className="bg-lime-50">
                          <td className="px-4 py-3 font-semibold">기본공임</td>
                          <td className="px-4 py-3 text-right tabular-nums">{laborBreakdownTotals.lineQty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKrw(laborBreakdownTotals.baseSell)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">라인 기본공임 스냅샷(base_labor_krw)</td>
                        </tr>

                        {orderedLaborBreakdownRows.map((item) => {
                          const category = classifyLaborDetailCategory(item);
                          const rowClassName =
                            category === "STONE"
                              ? "bg-green-50 hover:bg-green-100/70"
                              : "hover:bg-[var(--panel-hover)]";
                          return (
                          <tr key={item.id} className={rowClassName}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{item.label}</div>
                              <div className="text-[10px] text-[var(--muted)]">{item.type}</div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{item.qtyApplied ?? "-"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{item.costKrw === null ? "-" : formatKrw(item.costKrw)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{item.marginKrw === null ? "-" : formatKrw(item.marginKrw)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKrw(item.sellKrw)}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">{[item.source, item.reason].filter(Boolean).join(" | ") || "-"}</td>
                          </tr>
                          );
                        })}

                        <tr className="border-t-2 border-[var(--panel-border)] bg-[var(--chip)]/60 font-semibold">
                          <td className="px-4 py-3">추가공임 합계</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatKrw(laborBreakdownTotals.extraCost)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatKrw(laborBreakdownTotals.extraMargin)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatKrw(laborBreakdownTotals.extraSell)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">extra_labor_items 합산 / 원가스냅샷 {laborBreakdownTotals.extraCostSnapshot === null ? "-" : formatKrw(laborBreakdownTotals.extraCostSnapshot)}{laborBreakdownTotals.extraCostDelta === null ? "" : ` (차이 ${formatKrw(laborBreakdownTotals.extraCostDelta)})`}</td>
                        </tr>

                        <tr className="bg-[var(--primary)]/8 font-semibold">
                          <td className="px-4 py-3">{isSelectedLineUnitPricing ? "총금액 비교 (단가제)" : "공임 총계 비교"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatKrw(compareTargetValue)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {isSelectedLineUnitPricing ? "총금액 기준 / SOT 총액" : "분해합 / SOT"}: {formatKrw(compareSotValue)}
                            {Math.abs(compareDiff) > 0.5 ? ` (차이 ${formatKrw(compareDiff)})` : " (일치)"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {orderedLaborBreakdownRows.length === 0 ? (
                    <div className="rounded border border-[var(--panel-border)] bg-[var(--chip)]/40 p-3 text-xs text-[var(--muted)]">
                      추가공임 항목(extra_labor_items)이 없습니다. 기본공임과 SOT 공임 총계만 표시합니다.
                    </div>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </Drawer>
    </div>
  );
}
