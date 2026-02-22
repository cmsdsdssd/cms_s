"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
            "shipment_line_id, shipment_id, order_line_id, model_name, suffix, color, size, qty, measured_weight_g, deduction_weight_g, net_weight_g, base_labor_krw, extra_labor_krw, labor_total_sell_krw, material_amount_sell_krw, total_amount_sell_krw, created_at"
          )
          .in("shipment_id", ids)
          .order("created_at", { ascending: false });

        if (lineError) throw lineError;
        lines.push(...((lineData ?? []) as ShipmentHistoryLineRow[]));
      }

      const shipmentLineIds = lines
        .map((line) => String(line.shipment_line_id ?? "").trim())
        .filter(Boolean);
      const invoices: ShipmentHistoryInvoiceRow[] = [];
      for (const lineIds of chunk(shipmentLineIds, 500)) {
        const { data: invoiceData, error: invoiceError } = await schemaClient
          .from(CONTRACTS.views.arInvoicePosition)
          .select("shipment_line_id, commodity_due_g, commodity_price_snapshot_krw_per_g, labor_cash_due_krw, material_cash_due_krw, total_cash_due_krw")
          .in("shipment_line_id", lineIds);
        if (invoiceError) throw invoiceError;
        invoices.push(...((invoiceData ?? []) as ShipmentHistoryInvoiceRow[]));
      }

      return {
        rows: combineShipmentRows(filteredHeaders, lines, invoices),
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
      lineWeightG: toNumber(selectedLineInvoice?.commodity_due_g, toNumber(selectedDetailRow?.net_weight_g, 0)),
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
                          <th className="px-4 py-3 whitespace-nowrap">모델</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">수량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">중량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">환산중량</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">적용시세</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">공임</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">소재</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">합계</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">구분</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {selectedGroup.rows.map((row) => (
                          <tr
                            key={row.shipment_line_id}
                            className="cursor-pointer hover:bg-[var(--panel-hover)]"
                            onClick={() => setSelectedDetailRow(row)}
                          >
                            <td className="px-4 py-3 tabular-nums">{row.ship_date}</td>
                            <td className="px-4 py-3 text-center">
                              {row.labor_consistent ? <Badge tone="active">일치</Badge> : <Badge tone="danger">불일치</Badge>}
                            </td>
                            <td className="px-4 py-3">{row.customer_name}</td>
                            <td className="px-4 py-3">{row.model_display}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.qty}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatGram(row.net_weight_g)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.commodity_due_g === null ? "-" : formatGram(row.commodity_due_g)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{row.commodity_price_snapshot_krw_per_g === null ? "-" : `${formatKrw(row.commodity_price_snapshot_krw_per_g)}/g`}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatKrw(row.labor_total_sell_krw)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatKrw(row.material_amount_sell_krw)}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKrw(row.total_amount_sell_krw)}</td>
                            <td className="px-4 py-3 text-center">
                              {row.is_store_pickup ? <Badge tone="warning">매장출고</Badge> : <Badge tone="neutral">일반</Badge>}
                            </td>
                          </tr>
                        ))}
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
                        <tr className="bg-[var(--chip)]/40">
                          <td className="px-4 py-3 font-semibold">기본공임</td>
                          <td className="px-4 py-3 text-right tabular-nums">{laborBreakdownTotals.lineQty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums">-</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatKrw(laborBreakdownTotals.baseSell)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">라인 기본공임 스냅샷(base_labor_krw)</td>
                        </tr>

                        {displayedLaborBreakdownRows.map((item) => (
                          <tr key={item.id} className="hover:bg-[var(--panel-hover)]">
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
                        ))}

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

                  {displayedLaborBreakdownRows.length === 0 ? (
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
