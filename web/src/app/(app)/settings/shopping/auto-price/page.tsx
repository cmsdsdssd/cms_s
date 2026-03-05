"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";
import type { PricingSnapshotExplainResponse } from "@/types/pricingSnapshot";

type Channel = { channel_id: string; channel_name: string; channel_code: string };
type FloorGuard = {
  guard_id: string;
  master_item_id: string;
  floor_price_krw: number;
  updated_at: string;
};
type PricingPolicy = {
  policy_id: string;
  channel_id: string;
  policy_name: string;
  margin_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
  option_18k_weight_multiplier: number;
  material_factor_set_id: string | null;
  is_active: boolean;
};
type FactorSet = {
  factor_set_id: string;
  scope: "GLOBAL" | "CHANNEL";
  channel_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  is_global_default: boolean;
};
type SyncRun = {
  run_id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "CANCELLED";
  success_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string;
  error_message?: string | null;
};
type SyncIntent = {
  intent_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  master_item_id?: string | null;
  desired_price_krw: number;
  floor_price_krw: number;
  floor_applied: boolean;
  state: string;
  reason_code?: string | null;
  reason_label?: string | null;
  reason_category?: string | null;
  applied_target_price_krw?: number | null;
  applied_after_price_krw?: number | null;
  updated_at?: string | null;
};
type SyncRunDetail = {
  run: {
    run_id: string;
    pinned_compute_request_id?: string | null;
    started_at?: string | null;
  };
  intents: SyncIntent[];
};
type ReasonSummaryRow = {
  status: "FAILED" | "SKIPPED";
  reason_code: string;
  reason_label: string;
  reason_category: string;
  count: number;
};
type DashboardGalleryRow = {
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  external_variant_code: string | null;
  final_target_price_krw: number | null;
  current_channel_price_krw: number | null;
  price_state: "OK" | "OUT_OF_SYNC" | "ERROR" | "UNMAPPED";
  computed_at: string | null;
};
type MasterMetaRow = {
  master_item_id?: string | null;
  master_id?: string | null;
  image_url?: string | null;
};
type PricingOverrideRow = {
  override_id: string;
  channel_id: string;
  master_item_id: string;
  override_price_krw: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  updated_at: string;
};

type MappingSummary = {
  active_mapping_rows: number;
  mapped_master_count: number;
  total_master_count: number;
  unmapped_master_count: number;
  mapped_masters: Array<{
    master_item_id: string;
    product_nos: string[];
    variant_count: number;
    base_row_count: number;
    base_row_count_raw?: number;
    base_product_no?: string | null;
  }>;
};

type ProductEditorPreview = {
  productNo: string;
  productName: string;
  master_item_id?: string | null;
  price: number | null;
  retailPrice: number | null;
  selling: string | null;
  display: string | null;
  imageUrl: string | null;
  floor_price_krw?: number | null;
  exclude_plating_labor?: boolean;
  plating_labor_sell_krw?: number | null;
  total_labor_sell_krw?: number | null;
  tick_gold_krw_per_g?: number | null;
  tick_silver_krw_per_g?: number | null;
  options: Array<{ option_name: string; option_value: Array<{ option_text: string }> }>;
  variants: Array<{
    variantCode: string;
    customVariantCode?: string | null;
    options: Array<{ name: string; value: string }>;
    additionalAmount: number | null;
    savedTargetAdditionalAmount?: number | null;
    selling: string | null;
    display: string | null;
  }>;
};

type OptionCategoryRow = {
  option_name: string;
  option_value: string;
  category_key: "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";
  sync_delta_krw?: number;
};

type EditorPostApplySync = {
  requested: boolean;
  ok: boolean;
  stage: string;
  compute_request_id?: string | null;
  job_id?: string | null;
  success?: number;
  failed?: number;
  skipped?: number;
  error?: string | null;
};

const CATEGORY_OPTIONS = [
  { key: "MATERIAL", label: "소재" },
  { key: "SIZE", label: "사이즈" },
  { key: "COLOR_PLATING", label: "색상(도금포함)" },
  { key: "DECOR", label: "장식" },
  { key: "OTHER", label: "기타" },
] as const;

const SYNC_DELTA_OPTIONS = Array.from({ length: 2001 }, (_, idx) => (idx - 1000) * 1000);

const guessCategoryByOptionName = (name: string): OptionCategoryRow["category_key"] => {
  const n = String(name ?? "").trim().toLowerCase();
  if (!n) return "OTHER";
  if (/(소재|material|재질|금속|14k|18k)/i.test(n)) return "MATERIAL";
  if (/(사이즈|size|호수|치수)/i.test(n)) return "SIZE";
  if (/(색상|도금|color|plating|칼라|옐로우|화이트|로즈)/i.test(n)) return "COLOR_PLATING";
  if (/(장식|decor|세팅|스톤|참|펜던트)/i.test(n)) return "DECOR";
  return "OTHER";
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");
const fmtKrw = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v).toLocaleString() + "원" : "-";
const fmtSignedKrw = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  const rounded = Math.round(v);
  const sign = rounded > 0 ? "+" : "";
  return sign + rounded.toLocaleString() + "원";
};
const fmtMultiplier = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  const text = v
    .toFixed(3)
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1")
    .replace(/\.$/u, "");
  return "x" + text;
};
const toRoundedNumber = (value: unknown): number | null => {
  const n = Number(value ?? Number.NaN);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const normalizeOptionValue = (value: string) => String(value ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();
const optionEntryKey = (optionName: string, optionValue: string) => `${String(optionName ?? "").trim()}::${normalizeOptionValue(optionValue)}`;
const parseNumericInput = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "").replaceAll(",", "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const roundByMode = (value: number, unit: number, mode: "CEIL" | "ROUND" | "FLOOR") => {
  if (!Number.isFinite(value)) return 0;
  const safeUnit = Number.isFinite(unit) && unit > 0 ? unit : 1;
  const q = value / safeUnit;
  if (mode === "FLOOR") return Math.floor(q) * safeUnit;
  if (mode === "ROUND") return Math.round(q) * safeUnit;
  return Math.ceil(q) * safeUnit;
};
const fmtTs = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR");
};
const pad2 = (value: number) => String(value).padStart(2, "0");
const fmtTsCompact = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  const yy = pad2(d.getFullYear() % 100);
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yy}.${mm}.${dd}-${hh}:${mi}:${ss}`;
};

const toRunKo = (value: string) => {
  if (value === "RUNNING") return "진행중";
  if (value === "SUCCESS") return "성공";
  if (value === "PARTIAL") return "부분성공";
  if (value === "FAILED") return "실패";
  return value;
};

export default function ShoppingAutoPricePage() {
  const qc = useQueryClient();
  const [channelId, setChannelId] = useState("");
  const [masterItemId, setMasterItemId] = useState("");
  const [floorPrice, setFloorPrice] = useState("0");
  const [marginMultiplier, setMarginMultiplier] = useState("1");
  const [roundingUnit, setRoundingUnit] = useState("1000");
  const [roundingMode, setRoundingMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");
  const [option18kWeightMultiplier, setOption18kWeightMultiplier] = useState("1.2");
  const [policyFactorSetId, setPolicyFactorSetId] = useState("");
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runMasterIds, setRunMasterIds] = useState("");
  const [editorProductNo, setEditorProductNo] = useState("");
  const [gallerySearch, setGallerySearch] = useState("");
  const [editorPreview, setEditorPreview] = useState<ProductEditorPreview | null>(null);
  const [editorPrice, setEditorPrice] = useState("");
  const [editorRetailPrice, setEditorRetailPrice] = useState("");
  const [editorSelling, setEditorSelling] = useState("T");
  const [editorDisplay, setEditorDisplay] = useState("T");
  const [sellingPriceOverrideLocked, setSellingPriceOverrideLocked] = useState(false);
  const [editorFloorPrice, setEditorFloorPrice] = useState("0");
  const [editorExcludePlatingLabor, setEditorExcludePlatingLabor] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [, setVariantDrafts] = useState<Record<string, string>>({});
  const [optionCategoryDrafts, setOptionCategoryDrafts] = useState<Record<string, OptionCategoryRow["category_key"]>>({});
  const [optionSyncDeltaDrafts, setOptionSyncDeltaDrafts] = useState<Record<string, number>>({});
  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];
  const effectiveChannelId = channelId || channels[0]?.channel_id || "";

  const policiesQuery = useQuery({
    queryKey: ["shop-policies", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: PricingPolicy[] }>(`/api/pricing-policies?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });
  const activePolicy = useMemo(
    () => (policiesQuery.data?.data ?? []).find((p) => p.is_active) ?? null,
    [policiesQuery.data?.data],
  );

  const factorSetsQuery = useQuery({
    queryKey: ["shop-factor-sets", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: async () => {
      const [globalRes, channelRes] = await Promise.all([
        shopApiGet<{ data: FactorSet[] }>("/api/material-factor-sets?scope=GLOBAL"),
        shopApiGet<{ data: FactorSet[] }>(`/api/material-factor-sets?scope=CHANNEL&channel_id=${encodeURIComponent(effectiveChannelId)}`),
      ]);
      return [...globalRes.data, ...channelRes.data];
    },
  });

  useEffect(() => {
    setMarginMultiplier(String(activePolicy?.margin_multiplier ?? 1));
    setRoundingUnit(String(activePolicy?.rounding_unit ?? 1000));
    setRoundingMode((activePolicy?.rounding_mode ?? "CEIL") as "CEIL" | "ROUND" | "FLOOR");
    setOption18kWeightMultiplier(String(activePolicy?.option_18k_weight_multiplier ?? 1.2));
    setPolicyFactorSetId(activePolicy?.material_factor_set_id ?? "");
  }, [activePolicy?.policy_id]);

  const summaryQuery = useQuery({
    queryKey: ["shop-summary", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: { counts: { out_of_sync: number; error: number; total: number } } }>(`/api/channel-price-summary?channel_id=${encodeURIComponent(effectiveChannelId)}`),
    refetchInterval: 15_000,
  });

  const mappingSummaryQuery = useQuery({
    queryKey: ["channel-mapping-summary", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: MappingSummary }>(`/api/channel-mapping-summary?channel_id=${encodeURIComponent(effectiveChannelId)}`),
    refetchInterval: 15_000,
  });

  const guardsQuery = useQuery({
    queryKey: ["floor-guards", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: FloorGuard[] }>(`/api/channel-floor-guards?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });

  const runsQuery = useQuery({
    queryKey: ["price-sync-runs-v2", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: SyncRun[] }>(`/api/price-sync-runs-v2?channel_id=${encodeURIComponent(effectiveChannelId)}&limit=100`),
    refetchInterval: 10_000,
  });
  const effectiveRunId = selectedRunId || runsQuery.data?.data?.[0]?.run_id || "";

  const runDetailQuery = useQuery({
    queryKey: ["price-sync-run-v2", effectiveRunId],
    enabled: Boolean(effectiveRunId),
    queryFn: () => shopApiGet<{ data: { intents: SyncIntent[]; summary?: { reasons: ReasonSummaryRow[]; skipped_reasons: ReasonSummaryRow[]; failed_reasons: ReasonSummaryRow[] } } }>(`/api/price-sync-runs-v2/${effectiveRunId}`),
    refetchInterval: 10_000,
  });

  const runSkippedReasons = runDetailQuery.data?.data.summary?.skipped_reasons ?? [];
  const runFailedReasons = runDetailQuery.data?.data.summary?.failed_reasons ?? [];

  const editorMasterItemId = useMemo(() => {
    if (!editorPreview) return "";
    const fromPreview = String(editorPreview.master_item_id ?? "").trim();
    if (fromPreview) return fromPreview;
    const productNoCandidates = new Set([
      String(editorProductNo ?? "").trim(),
      String(editorPreview.productNo ?? "").trim(),
    ].filter(Boolean));
    const found = (mappingSummaryQuery.data?.data.mapped_masters ?? []).find((row) =>
      (row.product_nos ?? []).some((productNo) => productNoCandidates.has(String(productNo ?? "").trim())),
    );
    return found?.master_item_id ?? "";
  }, [editorPreview, editorProductNo, mappingSummaryQuery.data]);

  const recentRunIds = useMemo(
    () => (runsQuery.data?.data ?? [])
      .filter((row) => !String(row.error_message ?? "").trim().toUpperCase().startsWith("CRON_TICK:"))
      .slice(0, 20)
      .map((row) => String(row.run_id ?? "").trim())
      .filter(Boolean),
    [runsQuery.data?.data],
  );

  const recentRunDetailQueries = useQueries({
    queries: recentRunIds.map((runId) => ({
      queryKey: ["price-sync-run-v2", "preview", runId],
      enabled: Boolean(effectiveChannelId && runId),
      queryFn: () => shopApiGet<{ data: SyncRunDetail }>("/api/price-sync-runs-v2/" + runId),
      staleTime: 20_000,
      refetchInterval: 15_000,
    })),
  });

  const latestComputeRequestIdForPreview = useMemo(() => {
    for (const query of recentRunDetailQueries) {
      const computeRequestId = String(query.data?.data?.run?.pinned_compute_request_id ?? "").trim();
      if (computeRequestId) return computeRequestId;
    }
    return "";
  }, [recentRunDetailQueries]);

  const recentRunExplainTargets = useMemo(
    () =>
      recentRunDetailQueries
        .map((query) => {
          const runId = String(query.data?.data?.run?.run_id ?? "").trim();
          const computeRequestId = String(query.data?.data?.run?.pinned_compute_request_id ?? "").trim();
          return { runId, computeRequestId };
        })
        .filter((row) => row.runId && row.computeRequestId),
    [recentRunDetailQueries],
  );

  const snapshotExplainQuery = useQuery({
    queryKey: ["pricing-snapshot-explain", effectiveChannelId, editorMasterItemId, latestComputeRequestIdForPreview],
    enabled: Boolean(effectiveChannelId && editorMasterItemId && latestComputeRequestIdForPreview),
    queryFn: () => shopApiGet<PricingSnapshotExplainResponse>(
      "/api/channel-price-snapshot-explain?channel_id="
      + encodeURIComponent(effectiveChannelId)
      + "&master_item_id="
      + encodeURIComponent(editorMasterItemId)
      + "&compute_request_id="
      + encodeURIComponent(latestComputeRequestIdForPreview),
    ),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const snapshotExplainRow = snapshotExplainQuery.data?.data ?? null;

  const previewEffectiveFloor = useMemo(() => {
    const floorRaw = Math.max(0, Math.round(Number(editorPreview?.floor_price_krw ?? 0)));
    const margin = Number(activePolicy?.margin_multiplier ?? 1);
    const unit = Math.max(1, Math.round(Number(activePolicy?.rounding_unit ?? 1000)));
    const mode = String(activePolicy?.rounding_mode ?? "CEIL").toUpperCase() as "CEIL" | "ROUND" | "FLOOR";
    if (!Number.isFinite(margin) || margin <= 0) return floorRaw;
    const floorWithMargin = roundByMode(floorRaw * margin, unit, mode);
    return Math.max(floorRaw, floorWithMargin);
  }, [editorPreview?.floor_price_krw, activePolicy?.margin_multiplier, activePolicy?.rounding_unit, activePolicy?.rounding_mode]);


  const recentRunSnapshotQueries = useQueries({
    queries: recentRunExplainTargets.map((target) => ({
      queryKey: [
        "pricing-snapshot-explain",
        "history",
        effectiveChannelId,
        editorMasterItemId,
        target.runId,
        target.computeRequestId,
      ],
      enabled: Boolean(effectiveChannelId && editorMasterItemId && target.computeRequestId),
      queryFn: () =>
        shopApiGet<PricingSnapshotExplainResponse>(
          "/api/channel-price-snapshot-explain?channel_id="
            + encodeURIComponent(effectiveChannelId)
            + "&master_item_id="
            + encodeURIComponent(editorMasterItemId)
            + "&compute_request_id="
            + encodeURIComponent(target.computeRequestId),
        ),
      staleTime: 30_000,
      refetchInterval: 30_000,
    })),
  });

  const runSnapshotByRunId = useMemo(() => {
    const map = new Map<string, PricingSnapshotExplainResponse["data"]>();
    recentRunExplainTargets.forEach((target, index) => {
      const row = recentRunSnapshotQueries[index]?.data?.data;
      if (target.runId && row) map.set(target.runId, row);
    });
    return map;
  }, [recentRunExplainTargets, recentRunSnapshotQueries]);

  const previewSelected = useMemo(() => {
    const base = toRoundedNumber(snapshotExplainRow?.final_target_price_krw);
    const floor = toRoundedNumber(previewEffectiveFloor);
    if (base == null || floor == null) {
      return {
        selected: null as number | null,
        reason: "-" as "TARGET" | "FLOOR" | "OVERRIDE" | "-",
        floorDelta: null as number | null,
      };
    }
    const selected = Math.max(base, floor);
    const hasOverride = toRoundedNumber(snapshotExplainRow?.override_price_krw) != null;
    const floorClamped = snapshotExplainRow?.floor_clamped === true;
    const reason: "TARGET" | "FLOOR" | "OVERRIDE" = floorClamped
      ? "FLOOR"
      : hasOverride
        ? "OVERRIDE"
        : "TARGET";
    return { selected, reason, floorDelta: selected - floor };
  }, [snapshotExplainRow?.final_target_price_krw, snapshotExplainRow?.override_price_krw, snapshotExplainRow?.floor_clamped, previewEffectiveFloor]);

  const previewCompositionRows = useMemo(() => {
    if (!snapshotExplainRow) return [] as Array<{ key: string; label: string; valueText: string }>;

    const materialRaw = toRoundedNumber(snapshotExplainRow.material_raw_krw);
    const materialFinal = toRoundedNumber(snapshotExplainRow.material_final_krw);
    const laborRaw = toRoundedNumber(snapshotExplainRow.labor_raw_krw);
    const laborSellTotal = toRoundedNumber(snapshotExplainRow.labor_sell_total_krw);
    const laborSellMaster = toRoundedNumber(snapshotExplainRow.labor_sell_master_krw);
    const laborSellDecor = toRoundedNumber(snapshotExplainRow.labor_sell_decor_krw);
    const afterGap = (() => {
      const finalTarget = toRoundedNumber(snapshotExplainRow.final_target_price_krw);
      const afterMargin = toRoundedNumber(snapshotExplainRow.price_after_margin_krw);
      if (finalTarget == null || afterMargin == null) return null;
      return finalTarget - afterMargin;
    })();

    return [
      { key: "base", label: "기준가", valueText: fmtKrw(snapshotExplainRow.master_base_price_krw) },
      { key: "mul", label: "마진", valueText: fmtMultiplier(snapshotExplainRow.shop_margin_multiplier) },
      { key: "material-raw", label: "소재원가", valueText: fmtKrw(materialRaw) },
      { key: "material-final", label: "소재환산", valueText: fmtKrw(materialFinal) },
      { key: "labor-raw", label: "공임원가", valueText: fmtKrw(laborRaw) },
      { key: "labor-sell-total", label: "총공임(판매)", valueText: fmtKrw(laborSellTotal) },
      { key: "labor-sell-master", label: "마스터공임", valueText: fmtKrw(laborSellMaster) },
      { key: "labor-sell-decor", label: "장식공임", valueText: fmtKrw(laborSellDecor) },
      { key: "master-labor-profile-sell", label: "마스터공임합(판매)", valueText: fmtKrw(snapshotExplainRow.master_labor_sell_profile_krw) },
      { key: "master-labor-profile-cost", label: "마스터공임합(원가)", valueText: fmtKrw(snapshotExplainRow.master_labor_cost_profile_krw) },
      { key: "master-labor-base-sell", label: "기본공임(판매)", valueText: fmtKrw(snapshotExplainRow.master_labor_base_sell_krw) },
      { key: "master-labor-center-sell", label: "센터공임(판매)", valueText: fmtKrw(snapshotExplainRow.master_labor_center_sell_krw) },
      { key: "master-labor-sub1-sell", label: "보조1공임(판매)", valueText: fmtKrw(snapshotExplainRow.master_labor_sub1_sell_krw) },
      { key: "master-labor-sub2-sell", label: "보조2공임(판매)", valueText: fmtKrw(snapshotExplainRow.master_labor_sub2_sell_krw) },
      { key: "master-plating-sell", label: "도금공임(판매)", valueText: fmtKrw(snapshotExplainRow.master_plating_sell_krw) },
      { key: "master-labor-base-cost", label: "기본공임(원가)", valueText: fmtKrw(snapshotExplainRow.master_labor_base_cost_krw) },
      { key: "master-labor-center-cost", label: "센터공임(원가)", valueText: fmtKrw(snapshotExplainRow.master_labor_center_cost_krw) },
      { key: "master-labor-sub1-cost", label: "보조1공임(원가)", valueText: fmtKrw(snapshotExplainRow.master_labor_sub1_cost_krw) },
      { key: "master-labor-sub2-cost", label: "보조2공임(원가)", valueText: fmtKrw(snapshotExplainRow.master_labor_sub2_cost_krw) },
      { key: "master-plating-cost", label: "도금공임(원가)", valueText: fmtKrw(snapshotExplainRow.master_plating_cost_krw) },
      { key: "master-center-qty", label: "센터수량", valueText: fmt(snapshotExplainRow.master_center_qty) },
      { key: "master-sub1-qty", label: "보조1수량", valueText: fmt(snapshotExplainRow.master_sub1_qty) },
      { key: "master-sub2-qty", label: "보조2수량", valueText: fmt(snapshotExplainRow.master_sub2_qty) },
      { key: "absorb-total", label: "흡수공임합", valueText: fmtKrw(snapshotExplainRow.absorb_total_krw) },
      { key: "absorb-base", label: "흡수-기본", valueText: fmtKrw(snapshotExplainRow.absorb_base_labor_krw) },
      { key: "absorb-stone", label: "흡수-석", valueText: fmtKrw(snapshotExplainRow.absorb_stone_labor_krw) },
      { key: "absorb-plating", label: "흡수-도금", valueText: fmtKrw(snapshotExplainRow.absorb_plating_krw) },
      { key: "absorb-etc", label: "흡수-기타", valueText: fmtKrw(snapshotExplainRow.absorb_etc_krw) },
      { key: "absorb-general", label: "흡수-일반", valueText: fmtKrw(snapshotExplainRow.absorb_general_class_krw) },
      { key: "absorb-material", label: "흡수-소재", valueText: fmtKrw(snapshotExplainRow.absorb_material_class_krw) },
      { key: "absorb-count", label: "흡수항목수", valueText: fmt(snapshotExplainRow.absorb_item_count) },
      { key: "after", label: "마진후", valueText: fmtKrw(snapshotExplainRow.price_after_margin_krw) },
      { key: "delta", label: "옵션합", valueText: fmtSignedKrw(snapshotExplainRow.delta_total_krw) },
      { key: "rounded", label: "반올림", valueText: fmtKrw(snapshotExplainRow.rounded_target_price_krw) },
      { key: "override", label: "오버라이드", valueText: fmtKrw(snapshotExplainRow.override_price_krw) },
      { key: "floor", label: "바닥가", valueText: fmtKrw(previewEffectiveFloor) },
      { key: "selected", label: "선택가", valueText: fmtKrw(previewSelected.selected) },
      { key: "after-gap", label: "마진후대비", valueText: fmtSignedKrw(afterGap) },
      { key: "floor-gap", label: "Floor 대비", valueText: previewSelected.floorDelta == null ? "-" : fmtSignedKrw(previewSelected.floorDelta) },
      { key: "clamp", label: "클램프", valueText: snapshotExplainRow.floor_clamped ? "Y" : "N" },
      { key: "reason", label: "선택근거", valueText: previewSelected.reason },
    ];
  }, [previewEffectiveFloor, previewSelected.floorDelta, previewSelected.reason, previewSelected.selected, snapshotExplainRow]);

  const previewHistoryRows = useMemo(() => {
    if (!editorPreview) return [] as Array<{
      runId: string;
      at: string;
      basePrice: number | null;
      floorPrice: number | null;
      selectedPrice: number | null;
      reason: "TARGET" | "FLOOR" | "-";
      variantAvg: number | null;
    }>;

    const productNoSet = new Set([
      String(editorPreview.productNo ?? "").trim(),
      String(editorProductNo ?? "").trim(),
    ].filter(Boolean));
    const variantCodeSet = new Set(
      (editorPreview.variants ?? [])
        .flatMap((variant) => [
          String(variant.variantCode ?? "").trim(),
          String(variant.customVariantCode ?? "").trim(),
        ])
        .filter(Boolean),
    );

    const rows = recentRunDetailQueries
      .map((query) => query.data?.data)
      .filter((data): data is SyncRunDetail => Boolean(data))
      .map((data) => {
        const runId = String(data.run?.run_id ?? "").trim();
        const at = String(data.run?.started_at ?? "").trim();
        const snapshotFallback = runSnapshotByRunId.get(runId) ?? null;
        const intents = (data.intents ?? []).filter((intent) => {
          const masterMatched = editorMasterItemId && String(intent.master_item_id ?? "").trim() === editorMasterItemId;
          if (masterMatched) return true;
          const productNo = String(intent.external_product_no ?? "").trim();
          if (productNo && productNoSet.has(productNo)) return true;
          const variantCode = String(intent.external_variant_code ?? "").trim();
          return Boolean(variantCode && variantCodeSet.has(variantCode));
        });
        if (!runId) return null;
        if (intents.length === 0 && !snapshotFallback) return null;

        const pickSelectedPrice = (intent: SyncIntent): number | null => {
          const candidates = [intent.applied_after_price_krw, intent.applied_target_price_krw, intent.desired_price_krw];
          for (const candidate of candidates) {
            const n = toRoundedNumber(candidate);
            if (n != null) return n;
          }
          return null;
        };

        const pickBasePrice = (intent: SyncIntent): number | null => {
          const candidates = [intent.desired_price_krw, intent.applied_target_price_krw, intent.applied_after_price_krw];
          for (const candidate of candidates) {
            const n = toRoundedNumber(candidate);
            if (n != null) return n;
          }
          return null;
        };

        const baseIntent = intents.find((intent) => !String(intent.external_variant_code ?? "").trim());
        const basePriceFromIntent = baseIntent ? pickBasePrice(baseIntent) : null;
        const basePrice = basePriceFromIntent ?? toRoundedNumber(snapshotFallback?.final_target_price_krw);
        const floorPrice = toRoundedNumber(
          baseIntent?.floor_price_krw
            ?? intents.find((intent) => toRoundedNumber(intent.floor_price_krw) != null)?.floor_price_krw
            ?? snapshotFallback?.floor_price_krw
            ?? null,
        );
        const selectedFromBase = baseIntent ? pickSelectedPrice(baseIntent) : null;
        const variantPrices = intents
          .filter((intent) => String(intent.external_variant_code ?? "").trim())
          .map(pickSelectedPrice)
          .filter((v): v is number => typeof v === "number");

        const variantAvg = variantPrices.length > 0
          ? Math.round(variantPrices.reduce((sum, value) => sum + value, 0) / variantPrices.length)
          : null;

        const selectedPrice = selectedFromBase
          ?? (basePrice != null && floorPrice != null ? Math.max(basePrice, floorPrice) : basePrice);

        const reasonFromIntent: "TARGET" | "FLOOR" | null = baseIntent
          ? (baseIntent.floor_applied ? "FLOOR" : "TARGET")
          : null;
        const reasonFromPrices: "TARGET" | "FLOOR" | "-" =
          selectedPrice == null || basePrice == null
            ? "-"
            : selectedPrice > basePrice
              ? "FLOOR"
                            : "TARGET";
        const reasonFromSnapshot: "TARGET" | "FLOOR" | null = !baseIntent && snapshotFallback
          ? (snapshotFallback.floor_clamped ? "FLOOR" : "TARGET")
          : null;
        const reason: "TARGET" | "FLOOR" | "-" = reasonFromIntent ?? reasonFromSnapshot ?? reasonFromPrices;

        return { runId, at, basePrice, floorPrice, selectedPrice, reason, variantAvg };
      })
      .filter((row): row is {
        runId: string;
        at: string;
        basePrice: number | null;
        floorPrice: number | null;
        selectedPrice: number | null;
        reason: "TARGET" | "FLOOR" | "-";
        variantAvg: number | null;
      } => Boolean(row))
      .sort((a, b) => b.at.localeCompare(a.at));

    return rows.slice(0, 8);
  }, [editorPreview, editorMasterItemId, editorProductNo, recentRunDetailQueries, runSnapshotByRunId]);

  const latestHistory = previewHistoryRows[0] ?? null;
  const previousHistory = previewHistoryRows[1] ?? null;
  const historyTrendDelta =
    latestHistory?.selectedPrice != null && previousHistory?.selectedPrice != null
      ? latestHistory.selectedPrice - previousHistory.selectedPrice
      : null;

  const previewTrend = useMemo(() => {
    const prices = previewHistoryRows
      .map((row) => row.selectedPrice)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const latest = prices[0] ?? null;
    const oldest = prices[prices.length - 1] ?? null;
    const netDelta = latest != null && oldest != null ? latest - oldest : null;
    const min = prices.length > 0 ? Math.min(...prices) : null;
    const max = prices.length > 0 ? Math.max(...prices) : null;
    return { count: prices.length, latest, oldest, netDelta, min, max };
  }, [previewHistoryRows]);

  const dashboardGalleryQuery = useQuery({
    queryKey: ["shop-dashboard-gallery", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: DashboardGalleryRow[] }>(
        `/api/channel-price-dashboard?channel_id=${encodeURIComponent(effectiveChannelId)}&include_unmapped=false&limit=1000`,
      ),
    refetchInterval: 15_000,
  });

  const galleryMasterIds = useMemo(() => {
    return Array.from(
      new Set(
        (dashboardGalleryQuery.data?.data ?? [])
          .map((row) => String(row.master_item_id ?? "").trim())
          .filter(Boolean),
      ),
    ).slice(0, 300);
  }, [dashboardGalleryQuery.data?.data]);

  const galleryMasterMetaQuery = useQuery({
    queryKey: ["shop-auto-price-gallery-master-meta", effectiveChannelId, galleryMasterIds.join(",")],
    enabled: Boolean(effectiveChannelId && galleryMasterIds.length > 0),
    queryFn: () =>
      shopApiGet<{ data: MasterMetaRow[] }>(
        `/api/master-items?master_ids=${encodeURIComponent(galleryMasterIds.join(","))}`,
      ),
    staleTime: 60_000,
  });

  const galleryImageByMasterId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of galleryMasterMetaQuery.data?.data ?? []) {
      const key = String(row.master_item_id ?? row.master_id ?? "").trim();
      if (!key) continue;
      map.set(key, row.image_url ?? null);
    }
    return map;
  }, [galleryMasterMetaQuery.data?.data]);

  const galleryItems = useMemo(() => {
    const grouped = new Map<
      string,
      {
        groupKey: string;
        productNo: string;
        productNos: Set<string>;
        modelNames: Set<string>;
        variantCodes: Set<string>;
        outOfSyncVariantCodes: Set<string>;
        latestComputedAt: string | null;
        sampleTargetPrice: number | null;
        primaryMasterId: string;
      }
    >();
    for (const row of dashboardGalleryQuery.data?.data ?? []) {
      const productNo = String(row.external_product_no ?? "").trim();
      const masterItemId = String(row.master_item_id ?? "").trim();
      const groupKey = masterItemId || productNo;
      if (!groupKey || !productNo || productNo === "-") continue;

      const item = grouped.get(groupKey) ?? {
        groupKey,
        productNo,
        productNos: new Set<string>(),
        modelNames: new Set<string>(),
        variantCodes: new Set<string>(),
        outOfSyncVariantCodes: new Set<string>(),
        latestComputedAt: null,
        sampleTargetPrice: null,
        primaryMasterId: "",
      };
      if (!item.primaryMasterId) {
        if (masterItemId) item.primaryMasterId = masterItemId;
      }
      item.productNos.add(productNo);
      const isCurrentPCode = /^P/i.test(item.productNo);
      const isIncomingPCode = /^P/i.test(productNo);
      if (!isCurrentPCode && isIncomingPCode) {
        item.productNo = productNo;
      }
      const modelName = String(row.model_name ?? "").trim();
      if (modelName) item.modelNames.add(modelName);
      const variantCode = String(row.external_variant_code ?? "").trim();
      if (variantCode) {
        item.variantCodes.add(variantCode);
        if (row.price_state === "OUT_OF_SYNC") item.outOfSyncVariantCodes.add(variantCode);
      }
      if (!item.latestComputedAt || (row.computed_at && row.computed_at > item.latestComputedAt)) {
        item.latestComputedAt = row.computed_at ?? item.latestComputedAt;
      }
      if (item.sampleTargetPrice == null && Number.isFinite(Number(row.final_target_price_krw))) {
        item.sampleTargetPrice = Math.round(Number(row.final_target_price_krw));
      }
      grouped.set(groupKey, item);
    }

    const q = gallerySearch.trim().toLowerCase();
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        variantCount: item.variantCodes.size,
        outOfSyncCount: item.outOfSyncVariantCodes.size,
        modelNameText: Array.from(item.modelNames.values()).join(" / "),
        productAliasText: Array.from(item.productNos.values()).sort((a, b) => a.localeCompare(b)).join(" / "),
        imageUrl: item.primaryMasterId ? (galleryImageByMasterId.get(item.primaryMasterId) ?? null) : null,
      }))
      .filter((item) => {
        if (!q) return true;
        return (
          item.productNo.toLowerCase().includes(q)
          || item.productAliasText.toLowerCase().includes(q)
          || item.modelNameText.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const tA = a.latestComputedAt ?? "";
        const tB = b.latestComputedAt ?? "";
        if (tA !== tB) return tB.localeCompare(tA);
        return a.productNo.localeCompare(b.productNo);
      });
  }, [dashboardGalleryQuery.data?.data, gallerySearch, galleryImageByMasterId]);


  const optionEntries = useMemo(() => {
    if (!editorPreview) return [] as Array<{ option_name: string; option_value: string }>;
    const map = new Map<string, { option_name: string; option_value: string }>();

    for (const group of editorPreview.options ?? []) {
      const name = String(group.option_name ?? "").trim();
      if (!name) continue;
      for (const valueRow of group.option_value ?? []) {
        const value = normalizeOptionValue(String(valueRow.option_text ?? "").trim());
        if (!value) continue;
        map.set(`${name}::${value}`, { option_name: name, option_value: value });
      }
    }

    for (const variant of editorPreview.variants ?? []) {
      for (const option of variant.options ?? []) {
        const name = String(option.name ?? "").trim();
        const value = normalizeOptionValue(String(option.value ?? "").trim());
        if (!name || !value) continue;
        map.set(`${name}::${value}`, { option_name: name, option_value: value });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.option_name !== b.option_name) return a.option_name.localeCompare(b.option_name);
      return a.option_value.localeCompare(b.option_value);
    });
  }, [editorPreview]);

  const variantOptionColumnNames = useMemo(() => {
    if (!editorPreview) return [] as string[];
    const set = new Set<string>();
    for (const variant of editorPreview.variants ?? []) {
      for (const option of variant.options ?? []) {
        const name = String(option.name ?? "").trim();
        if (name) set.add(name);
      }
    }
    return Array.from(set.values());
  }, [editorPreview]);

  const optionCategoriesQuery = useQuery({
    queryKey: ["option-categories", effectiveChannelId, editorMasterItemId, editorPreview?.productNo ?? ""],
    enabled: Boolean(effectiveChannelId && editorPreview?.productNo),
    queryFn: () =>
      shopApiGet<{ data: OptionCategoryRow[] }>(
        `/api/channel-option-categories?channel_id=${encodeURIComponent(effectiveChannelId)}&external_product_no=${encodeURIComponent(String(editorPreview?.productNo ?? ""))}${editorMasterItemId ? `&master_item_id=${encodeURIComponent(editorMasterItemId)}` : ""}`,
      ),
  });

  const pricingOverridesQuery = useQuery({
    queryKey: ["pricing-overrides", effectiveChannelId, editorMasterItemId],
    enabled: Boolean(effectiveChannelId && editorMasterItemId),
    queryFn: () =>
      shopApiGet<{ data: PricingOverrideRow[] }>(
        `/api/pricing-overrides?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}`,
      ),
  });

  const activePricingOverrides = useMemo(
    () => (pricingOverridesQuery.data?.data ?? []).filter((row) => row.is_active === true),
    [pricingOverridesQuery.data?.data],
  );

  useEffect(() => {
    if (!editorMasterItemId) {
      setSellingPriceOverrideLocked(false);
      return;
    }
    setSellingPriceOverrideLocked(activePricingOverrides.length > 0);
  }, [editorMasterItemId, activePricingOverrides.length]);

  const saveFloorMutation = useMutation({
    mutationFn: () => shopApiSend<{ ok: boolean }>("/api/channel-floor-guards", "POST", {
      channel_id: effectiveChannelId,
      master_item_id: masterItemId.trim(),
      floor_price_krw: parseNumericInput(floorPrice) ?? 0,
      floor_source: "MANUAL",
      actor: "AUTO_PRICE_PAGE",
    }),
    onSuccess: async () => {
      setMasterItemId("");
      await qc.invalidateQueries({ queryKey: ["floor-guards", effectiveChannelId] });
    },
  });

  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        margin_multiplier: parseNumericInput(marginMultiplier) ?? 1,
        rounding_unit: Math.max(1, Math.round(parseNumericInput(roundingUnit) ?? 1000)),
        rounding_mode: roundingMode,
        option_18k_weight_multiplier: parseNumericInput(option18kWeightMultiplier) ?? 1.2,
        material_factor_set_id: policyFactorSetId || null,
        is_active: true,
      };

      if (activePolicy) {
        return shopApiSend<{ data: PricingPolicy }>(`/api/pricing-policies/${activePolicy.policy_id}`, "PUT", payload);
      }

      return shopApiSend<{ data: PricingPolicy }>("/api/pricing-policies", "POST", {
        channel_id: effectiveChannelId,
        policy_name: "DEFAULT_POLICY",
        ...payload,
      });
    },
    onSuccess: async () => {
      setPolicySaveError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-policies", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["shop-summary", effectiveChannelId] }),
      ]);
    },
    onError: (err: Error) => {
      setPolicySaveError(err.message);
    },
  });

  const createRunMutation = useMutation({
    mutationFn: () => {
      const ids = runMasterIds.split(/[\s,\n]+/).map((v) => v.trim()).filter(Boolean);
      return shopApiSend<{ run_id: string }>("/api/price-sync-runs-v2", "POST", {
        channel_id: effectiveChannelId,
        interval_minutes: Number(intervalMinutes),
        trigger_type: "AUTO",
        master_item_ids: ids.length > 0 ? ids : undefined,
      });
    },
    onSuccess: async (res) => {
      if (res.run_id) setSelectedRunId(res.run_id);
      await qc.invalidateQueries({ queryKey: ["price-sync-runs-v2", effectiveChannelId] });
    },
  });

  const executeRunMutation = useMutation({
    mutationFn: () => shopApiSend<{ ok: boolean }>(`/api/price-sync-runs-v2/${effectiveRunId}/execute`, "POST"),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["price-sync-runs-v2", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["price-sync-run-v2", effectiveRunId] }),
      ]);
    },
  });

  const loadPreviewMutation = useMutation({
    mutationFn: (productNo?: string) => {
      const resolvedProductNo = String(productNo ?? editorProductNo).trim();
      return shopApiGet<{ data: ProductEditorPreview }>(
        `/api/channel-products/editor?channel_id=${encodeURIComponent(effectiveChannelId)}&external_product_no=${encodeURIComponent(resolvedProductNo)}`,
      );
    },
    onSuccess: (res) => {
      const data = res.data;
      setEditorPreview(data);
      setEditorPrice(data.price != null ? String(data.price) : "");
      setEditorRetailPrice(data.retailPrice != null ? String(data.retailPrice) : "");
      setEditorSelling((data.selling || "T").toUpperCase());
      setEditorDisplay((data.display || "T").toUpperCase());
      setEditorFloorPrice(String(Math.max(0, Math.round(Number(data.floor_price_krw ?? 0)))));
      setEditorExcludePlatingLabor(Boolean(data.exclude_plating_labor));
      const nextDrafts: Record<string, string> = {};
      for (const variant of data.variants) {
        nextDrafts[variant.variantCode] = variant.additionalAmount != null ? String(variant.additionalAmount) : "0";
      }
      setVariantDrafts(nextDrafts);
      setOptionCategoryDrafts({});
      setOptionSyncDeltaDrafts({});
      setIsEditDrawerOpen(false);
      setIsPreviewDrawerOpen(true);
    },
  });

  const loadMasterComputedMutation = useMutation({
    mutationFn: async () => {
      const resolvedMasterItemId = String(editorMasterItemId ?? "").trim();
      if (!resolvedMasterItemId) throw new Error("master_item_id가 없어 계산값을 조회할 수 없습니다");
      const resolvedProductNo = String(editorPreview?.productNo ?? editorProductNo).trim();
      if (!resolvedProductNo) throw new Error("product_no가 필요합니다");
      const candidateProductNos = Array.from(new Set([
        String(editorPreview?.productNo ?? "").trim(),
        String(editorProductNo ?? "").trim(),
      ].filter(Boolean)));

      const res = await shopApiGet<{ data: DashboardGalleryRow[] }>(
        `/api/channel-price-dashboard?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(resolvedMasterItemId)}&include_unmapped=false&limit=1000`,
      );

      const allRows = (res.data ?? []).filter((row) => Number.isFinite(Number(row.final_target_price_krw ?? Number.NaN)));
      const rowsForProduct = allRows.filter((row) => {
        const productNo = String(row.external_product_no ?? "").trim();
        return candidateProductNos.includes(productNo);
      });
      const pickPreferred = (rows: DashboardGalleryRow[]) =>
        rows.find((row) => String(row.external_variant_code ?? "").trim().length === 0)
        ?? rows.find((row) => Number.isFinite(Number(row.final_target_price_krw ?? Number.NaN)))
        ?? rows[0]
        ?? null;

      const pCodeRows = allRows.filter((row) => /^P/i.test(String(row.external_product_no ?? "").trim()));

      const picked = pickPreferred(rowsForProduct) ?? pickPreferred(pCodeRows) ?? pickPreferred(allRows);
      const computed = Number(picked?.final_target_price_krw ?? Number.NaN);
      if (!Number.isFinite(computed)) {
        throw new Error("해당 상품의 마스터 계산값(final_target_price_krw)을 찾지 못했습니다");
      }

      return { price: Math.round(computed) };
    },
    onSuccess: ({ price }) => {
      setEditorPrice(String(price));
      setApplyError(null);
    },
    onError: (err: Error) => {
      setApplyError(err.message);
    },
  });

  const applyEditorMutation = useMutation({
    onMutate: async () => {
      const previousPreview = editorPreview;
      if (editorPreview) {
        const optimisticVariants = (editorPreview.variants ?? []).map((variant) => ({
          ...variant,
          additionalAmount: Number(computedVariantAdditionalByCode.get(variant.variantCode) ?? variant.additionalAmount ?? 0),
        }));
        setEditorPreview({ ...editorPreview, variants: optimisticVariants });
      }
      return { previousPreview };
    },
    mutationFn: async () => {
      setApplyError(null);
      if (editorPreview && editorMasterItemId) {
        if (optionEntries.length > 0) {
          const rows = optionEntries.map((entry) => {
            const categoryKey = optionCategoryDrafts[entry.option_name] ?? effectiveCategoryByKey.get(entry.option_name) ?? guessCategoryByOptionName(entry.option_name);
            return {
              option_name: entry.option_name,
              option_value: entry.option_value,
              category_key: categoryKey,
              sync_delta_krw: Math.round(Number(effectiveOptionSyncDeltaByEntryKey.get(optionEntryKey(entry.option_name, entry.option_value)) ?? 0)),
            };
          });

          await shopApiSend<{ ok: boolean }>("/api/channel-option-categories", "POST", {
            channel_id: effectiveChannelId,
            master_item_id: editorMasterItemId,
            external_product_no: editorPreview.productNo,
            actor: "AUTO_PRICE_PAGE_APPLY",
            rows,
          });
        }

      }

      const variants = (editorPreview?.variants ?? [])
        .map((variant) => ({
          variant_code: variant.variantCode,
          additional_amount: Number(computedVariantAdditionalByCode.get(variant.variantCode) ?? 0),
        }))
        .filter((row) => Number.isFinite(row.additional_amount));

      if (editorMasterItemId) {
        const activeOverrides = [...activePricingOverrides];
        if (sellingPriceOverrideLocked) {
          const overridePrice = parseNumericInput(editorPrice);
          if (overridePrice == null || overridePrice < 0) {
            throw new Error("덮어쓰기 고정 사용 시 판매가는 0 이상 숫자여야 합니다");
          }

          const primary = activeOverrides[0] ?? null;
          if (primary) {
            await shopApiSend(`/api/pricing-overrides/${encodeURIComponent(primary.override_id)}`, "PUT", {
              override_price_krw: Math.round(overridePrice),
              is_active: true,
              reason: "AUTO_PRICE_LOCKED_PRICE",
            });
            for (const extra of activeOverrides.slice(1)) {
              await shopApiSend(`/api/pricing-overrides/${encodeURIComponent(extra.override_id)}`, "PUT", { is_active: false });
            }
          } else {
            await shopApiSend("/api/pricing-overrides", "POST", {
              channel_id: effectiveChannelId,
              master_item_id: editorMasterItemId,
              override_price_krw: Math.round(overridePrice),
              reason: "AUTO_PRICE_LOCKED_PRICE",
              is_active: true,
            });
          }
        } else {
          for (const row of activeOverrides) {
            await shopApiSend(`/api/pricing-overrides/${encodeURIComponent(row.override_id)}`, "PUT", { is_active: false });
          }
        }
      }

      return shopApiSend<{
        ok: boolean;
        message?: string;
        data: ProductEditorPreview | null;
        variant_patch_failed: number;
        variant_verify_failed?: number;
        post_apply_sync?: EditorPostApplySync;
      }>(
        "/api/channel-products/editor",
        "POST",
        {
          channel_id: effectiveChannelId,
          external_product_no: editorPreview?.productNo ?? editorProductNo.trim(),
          master_item_id: editorMasterItemId || undefined,
          product: {
            price: parseNumericInput(editorPrice),
            retail_price: parseNumericInput(editorRetailPrice),
            selling: editorSelling,
            display: editorDisplay,
          },
          floor_price_krw: parseNumericInput(editorFloorPrice),
          exclude_plating_labor: editorExcludePlatingLabor,
          variants,
        },
      );
    },
    onSuccess: async (res) => {
      if (res.data) {
        setEditorPreview(res.data);
        setEditorFloorPrice(String(Math.max(0, Math.round(Number(res.data.floor_price_krw ?? 0)))));
        setEditorExcludePlatingLabor(Boolean(res.data.exclude_plating_labor));
      }
      const sync = res.post_apply_sync;
      if (sync?.requested && sync.ok === false) {
        const reason = String(sync.error ?? "").trim() || `재계산/동기화 단계(${sync.stage}) 실패`;
        setApplyError(reason);
      } else if (res.ok === false) {
        const reason = String(res.message ?? "").trim() || "일부 옵션 반영 실패(미리보기는 최신값으로 유지)";
        setApplyError(reason);
      } else {
        setApplyError(null);
      }
      setIsEditDrawerOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-summary", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["pricing-overrides", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["shop-dashboard-gallery", effectiveChannelId] }),
      ]);
    },
    onError: (e, _vars, context) => {
      if (context?.previousPreview) {
        setEditorPreview(context.previousPreview);
      }
      setApplyError(e instanceof Error ? e.message : "상세수정 반영 실패");
    },
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: () => {
      if (!editorPreview) throw new Error("상품 미리보기가 필요합니다");
      setVariantDrafts((prev) => {
        const next = { ...prev };
        for (const [variantCode, amount] of computedVariantAdditionalByCode.entries()) {
          next[variantCode] = String(amount);
        }
        return next;
      });
      const rows = optionEntries.map((entry) => ({
        option_name: entry.option_name,
        option_value: entry.option_value,
        category_key: optionCategoryDrafts[entry.option_name] ?? effectiveCategoryByKey.get(entry.option_name) ?? guessCategoryByOptionName(entry.option_name),
      })).map((row) => ({
        ...row,
        sync_delta_krw: Math.round(Number(effectiveOptionSyncDeltaByEntryKey.get(optionEntryKey(row.option_name, row.option_value)) ?? 0)),
      }));

      return shopApiSend<{ ok: boolean }>("/api/channel-option-categories", "POST", {
        channel_id: effectiveChannelId,
        master_item_id: editorMasterItemId || undefined,
        external_product_no: editorPreview.productNo,
        actor: "AUTO_PRICE_PAGE",
        rows,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["option-categories", effectiveChannelId, editorMasterItemId, editorPreview?.productNo ?? ""] });
      setVariantDrafts((prev) => {
        const next = { ...prev };
        for (const [variantCode, amount] of computedVariantAdditionalByCode.entries()) {
          next[variantCode] = String(amount);
        }
        return next;
      });
      if (effectiveChannelId && editorMasterItemId) {
        await shopApiSend<{ ok: boolean; inserted: number; compute_request_id?: string }>(
          "/api/pricing/recompute",
          "POST",
          { channel_id: effectiveChannelId, master_item_ids: [editorMasterItemId] },
        );
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-summary", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["channel-mapping-summary", effectiveChannelId] }),
      ]);
    },
  });

  const effectiveCategoryByKey = useMemo(() => {
    const map = new Map<string, OptionCategoryRow["category_key"]>();
    const freqByName = new Map<string, Map<OptionCategoryRow["category_key"], number>>();
    for (const row of optionCategoriesQuery.data?.data ?? []) {
      const name = String(row.option_name ?? "").trim();
      if (!name) continue;
      const bucket = freqByName.get(name) ?? new Map<OptionCategoryRow["category_key"], number>();
      bucket.set(row.category_key, (bucket.get(row.category_key) ?? 0) + 1);
      freqByName.set(name, bucket);
    }
    for (const [name, freq] of freqByName.entries()) {
      const selected = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? guessCategoryByOptionName(name);
      map.set(name, selected);
    }
    for (const [name, value] of Object.entries(optionCategoryDrafts)) {
      map.set(name, value);
    }
    return map;
  }, [optionCategoriesQuery.data, optionCategoryDrafts]);

  const persistedOptionSyncDeltaByEntryKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of optionCategoriesQuery.data?.data ?? []) {
      const entryKey = optionEntryKey(row.option_name, row.option_value);
      if (!entryKey) continue;
      map.set(entryKey, Math.round(Number(row.sync_delta_krw ?? 0)));
    }
    return map;
  }, [optionCategoriesQuery.data?.data]);

  const effectiveOptionSyncDeltaByEntryKey = useMemo(() => {
    const map = new Map<string, number>(persistedOptionSyncDeltaByEntryKey.entries());
    for (const [key, value] of Object.entries(optionSyncDeltaDrafts)) {
      const rounded = Math.round(Number(value ?? 0));
      if (Number.isFinite(rounded)) map.set(key, rounded);
    }
    for (const entry of optionEntries) {
      const entryKey = optionEntryKey(entry.option_name, entry.option_value);
      if (!map.has(entryKey)) map.set(entryKey, 0);
    }
    return map;
  }, [persistedOptionSyncDeltaByEntryKey, optionSyncDeltaDrafts, optionEntries]);

  const optionNames = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const entry of optionEntries) {
      const name = String(entry.option_name ?? "").trim();
      const value = String(entry.option_value ?? "").trim();
      if (!name || !value) continue;
      const set = map.get(name) ?? new Set<string>();
      set.add(value);
      map.set(name, set);
    }
    return Array.from(map.entries())
      .map(([option_name, values]) => ({ option_name, sample_values: Array.from(values.values()).slice(0, 6) }))
      .sort((a, b) => a.option_name.localeCompare(b.option_name));
  }, [optionEntries]);

  const computedVariantAdditionalByCode = useMemo(() => {
    const map = new Map<string, number>();
    if (!editorPreview) return map;
    for (const variant of editorPreview.variants ?? []) {
      let total = 0;
      for (const option of variant.options ?? []) {
        const optionName = String(option.name ?? "").trim();
        const optionValue = normalizeOptionValue(String(option.value ?? "").trim());
        if (!optionName || !optionValue) continue;
        total += Number(effectiveOptionSyncDeltaByEntryKey.get(optionEntryKey(optionName, optionValue)) ?? 0);
      }
      map.set(variant.variantCode, total);
    }
    return map;
  }, [editorPreview, effectiveOptionSyncDeltaByEntryKey]);

  const persistedVariantAdditionalByCode = useMemo(() => {
    const map = new Map<string, number>();
    if (!editorPreview) return map;
    for (const variant of editorPreview.variants ?? []) {
      let total = 0;
      for (const option of variant.options ?? []) {
        const optionName = String(option.name ?? "").trim();
        const optionValue = normalizeOptionValue(String(option.value ?? "").trim());
        if (!optionName || !optionValue) continue;
        total += Number(persistedOptionSyncDeltaByEntryKey.get(optionEntryKey(optionName, optionValue)) ?? 0);
      }
      map.set(variant.variantCode, total);
    }
    return map;
  }, [editorPreview, persistedOptionSyncDeltaByEntryKey]);

  const statusItems = useMemo(() => {
    const counts = summaryQuery.data?.data.counts;
    return [
      { label: "전체 상품", value: `${counts?.total ?? 0}건` },
      { label: "불일치", value: `${counts?.out_of_sync ?? 0}건`, tone: (counts?.out_of_sync ?? 0) > 0 ? "warn" as const : "good" as const },
      { label: "오류", value: `${counts?.error ?? 0}건`, tone: (counts?.error ?? 0) > 0 ? "warn" as const : "good" as const },
    ];
  }, [summaryQuery.data]);

  return (
    <div className="space-y-4">
      <ActionBar title="자동 가격 반영" subtitle="신규 v2 파이프라인: floor guard + pinned compute + intent/outbox" />

      <ShoppingPageHeader
        purpose="저장된 계산 스냅샷(compute_request_id)을 기준으로 자동 반영하며, 바닥가격 아래로는 절대 반영하지 않습니다."
        status={statusItems}
        nextActions={[
          { label: "동기화 로그", href: "/settings/shopping/sync-jobs" },
          { label: "채널 설정", href: "/settings/shopping/channels" },
        ]}
      />

      <Card>
        <CardHeader title="연동 상태(가시화)" description="마스터 ↔ 자사몰 product_no ↔ variant_code 연결 현황" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-sm">활성 매핑 행: <span className="font-semibold">{mappingSummaryQuery.data?.data.active_mapping_rows ?? 0}</span></div>
            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-sm">연동된 마스터: <span className="font-semibold">{mappingSummaryQuery.data?.data.mapped_master_count ?? 0}</span></div>
            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-sm">전체 마스터: <span className="font-semibold">{mappingSummaryQuery.data?.data.total_master_count ?? 0}</span></div>
            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-sm">미연동 마스터: <span className="font-semibold">{mappingSummaryQuery.data?.data.unmapped_master_count ?? 0}</span></div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">master_item_id</th>
                  <th className="px-3 py-2">대표 base product_no</th>
                  <th className="px-3 py-2">variant 수</th>
                  <th className="px-3 py-2">base 행 수</th>
                </tr>
              </thead>
              <tbody>
                {(mappingSummaryQuery.data?.data.mapped_masters ?? []).slice(0, 100).map((row) => (
                  <tr key={row.master_item_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{row.master_item_id}</td>
                    <td className="px-3 py-2">{row.base_product_no ?? row.product_nos[0] ?? "-"}</td>
                    <td className="px-3 py-2">{row.variant_count}</td>
                    <td className="px-3 py-2">{row.base_row_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="쇼핑몰 미리보기 + 상세수정" description="소비자가/판매가/진열상태/옵션가격(additional_amount) 조회·수정" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input value={editorProductNo} onChange={(e) => setEditorProductNo(e.target.value)} placeholder="product_no 또는 product_code" />
            <Button onClick={() => loadPreviewMutation.mutate(editorProductNo.trim())} disabled={!effectiveChannelId || !editorProductNo.trim() || loadPreviewMutation.isPending}>
              상품 미리보기 불러오기
            </Button>
            <div className="text-xs text-[var(--muted)] md:col-span-2">불러오면 우측 드로어에서 쇼핑몰형 미리보기/상세수정을 진행합니다.</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">쇼핑몰 미리보기 + 상세보기</div>
              <Input
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                placeholder="master 이름 / 쇼핑몰 제품번호 검색"
                className="max-w-[360px]"
              />
            </div>
            <div className="text-xs text-[var(--muted)]">
              검색된 카드 클릭 시 기존과 동일하게 미리보기/상세수정이 열립니다.
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
              {galleryItems.map((item) => (
                <button
                  key={item.groupKey}
                  type="button"
                  className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-2 text-left hover:border-[var(--primary)]"
                  onClick={() => {
                    setEditorProductNo(item.productNo);
                    setApplyError(null);
                    loadPreviewMutation.mutate(item.productNo);
                  }}
                  disabled={loadPreviewMutation.isPending}
                >
                  <div className="mb-2 aspect-square w-full overflow-hidden rounded border border-[var(--hairline)] bg-[var(--bg)]">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.modelNameText || item.productNo} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-[var(--muted)]">이미지 없음</div>
                    )}
                  </div>
                  <div className="text-xs font-semibold">{item.productNo}</div>
                  <div className="mt-1 line-clamp-1 text-[10px] text-[var(--muted)]">{item.productAliasText}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">{item.modelNameText || "-"}</div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                    <span>옵션 {item.variantCount}개</span>
                    <span>불일치 {item.outOfSyncCount}개</span>
                    <span>기준 {fmt(item.sampleTargetPrice)}</span>
                  </div>
                </button>
              ))}
            </div>
            {galleryItems.length === 0 ? (
              <div className="rounded border border-[var(--hairline)] p-3 text-sm text-[var(--muted)]">
                검색 결과가 없습니다.
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Sheet
        open={isPreviewDrawerOpen}
        onOpenChange={setIsPreviewDrawerOpen}
        title="쇼핑몰 미리보기"
        side="right"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="text-sm font-semibold">쇼핑몰 미리보기</div>
            <div className="text-xs text-[var(--muted)]">이미지/가격/진열상태 확인 후 상세수정</div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {!editorPreview ? (
              <div className="text-sm text-[var(--muted)]">불러온 상품이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <div className="text-base font-semibold">{editorPreview.productName}</div>
                      <div className="text-xs text-[var(--muted)]">product_no: {editorPreview.productNo}</div>
                      <div className="aspect-square w-full overflow-hidden rounded border border-[var(--hairline)] bg-[var(--panel)]">
                        {editorPreview.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={editorPreview.imageUrl} alt={editorPreview.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-[var(--muted)]">이미지 없음</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)]">
                      <div className="flex min-h-[560px] flex-col">
                        <div className="border-b border-[var(--hairline)] px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold">가격 분석</div>
                              <div className="text-[11px] text-[var(--muted)]">snapshot explain + 최근 run history</div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setIsEditDrawerOpen(true)}>
                              상세수정
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-3">
                          <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                              <div className="text-[11px] font-semibold">구성(스냅샷)</div>
                              <div className="text-[10px] text-[var(--muted)] tabular-nums">
                                {snapshotExplainRow
                                  ? `Au ${fmtKrw(snapshotExplainRow.tick_gold_krw_g)} / Ag ${fmtKrw(snapshotExplainRow.tick_silver_krw_g)} · ${fmtTsCompact(snapshotExplainRow.computed_at)}`
                                  : snapshotExplainQuery.isFetching
                                    ? "불러오는 중"
                                    : "-"}
                              </div>
                            </div>

                            {snapshotExplainRow ? (
                              <div className="overflow-auto rounded border border-[var(--hairline)]">
                                <table className="w-max min-w-full text-[11px]">
                                  <thead className="bg-[var(--panel)]">
                                    <tr>
                                      {previewCompositionRows.map((row) => (
                                        <th key={`head-${row.key}`} className="whitespace-nowrap border-r border-[var(--hairline)] px-2 py-1 text-left font-medium text-[var(--muted)] last:border-r-0">
                                          {row.label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {previewCompositionRows.map((row) => (
                                        <td key={`value-${row.key}`} className="whitespace-nowrap border-r border-t border-[var(--hairline)] px-2 py-1 text-right font-semibold tabular-nums last:border-r-0">
                                          {row.valueText}
                                        </td>
                                      ))}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[var(--muted)]">
                                pinned compute_request_id 기반 스냅샷이 없습니다.
                              </div>
                            )}

                            {snapshotExplainRow ? (
                              <div className="mt-2 truncate text-[10px] text-[var(--muted)] tabular-nums">
                                compute_request_id: {snapshotExplainRow.compute_request_id}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                            <div className="mb-2 flex items-baseline justify-between gap-2">
                              <div className="text-[11px] font-semibold">히스토리(최근 run)</div>
                              <div className="text-[10px] text-[var(--muted)]">최대 8건</div>
                            </div>

                            {previewHistoryRows.length === 0 ? (
                              <div className="text-[11px] text-[var(--muted)]">최근 run에서 해당 상품 intent를 찾지 못했습니다.</div>
                            ) : (
                              <div className="max-h-[180px] overflow-auto rounded border border-[var(--hairline)]">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-[var(--panel)] text-left">
                                    <tr>
                                      <th className="px-2 py-1">일시</th>
                                      <th className="px-2 py-1 text-right tabular-nums">기준</th>
                                      <th className="px-2 py-1 text-right tabular-nums">바닥</th>
                                      <th className="px-2 py-1 text-right tabular-nums">선택</th>
                                      <th className="px-2 py-1 text-center">근거</th>
                                      <th className="px-2 py-1 text-right tabular-nums">옵션평균</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewHistoryRows.map((row) => (
                                      <tr key={row.runId} className="border-t border-[var(--hairline)]">
                                        <td className="px-2 py-1 whitespace-nowrap tabular-nums">{fmtTsCompact(row.at)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.basePrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.floorPrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.selectedPrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">{row.reason}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.variantAvg)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                            <div className="mb-2 text-[11px] font-semibold">추세</div>
                            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                              <div className="text-[var(--muted)]">최근 변화(1회)</div>
                              <div className="whitespace-nowrap text-right font-medium tabular-nums">
                                {historyTrendDelta == null ? "-" : fmtSignedKrw(historyTrendDelta)}
                              </div>
                              <div className="text-[var(--muted)]">최근 {previewTrend.count}회 범위</div>
                              <div className="whitespace-nowrap text-right font-medium tabular-nums">
                                {previewTrend.count > 0 ? `${fmtKrw(previewTrend.min)} ~ ${fmtKrw(previewTrend.max)}` : "-"}
                              </div>
                              <div className="text-[var(--muted)]">순변화(최근 {previewTrend.count}회)</div>
                              <div className="whitespace-nowrap text-right font-medium tabular-nums">
                                {previewTrend.netDelta == null ? "-" : fmtSignedKrw(previewTrend.netDelta)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-auto rounded border border-[var(--hairline)] bg-[var(--bg)] p-3">
                            <div className="text-[10px] text-[var(--muted)]">판매가(쇼핑몰)</div>
                            <div className="mt-1 flex items-end justify-between gap-2">
                              <div className="text-2xl font-semibold tabular-nums">{fmtKrw(editorPreview.price)}</div>
                              <div className="text-right text-[11px] text-[var(--muted)] tabular-nums">
                                유효바닥가 {fmtKrw(previewEffectiveFloor)}
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                              <div className="text-[var(--muted)]">소비자가</div>
                              <div className="whitespace-nowrap text-right tabular-nums">{fmtKrw(editorPreview.retailPrice)}</div>
                              <div className="text-[var(--muted)]">display / selling</div>
                              <div className="whitespace-nowrap text-right tabular-nums">{editorPreview.display ?? "-"} / {editorPreview.selling ?? "-"}</div>
                              <div className="text-[var(--muted)]">스냅샷 최종 타겟</div>
                              <div className="whitespace-nowrap text-right tabular-nums">{snapshotExplainRow ? fmtKrw(snapshotExplainRow.final_target_price_krw) : "-"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                    옵션표는 옵션명별 컬럼으로 표시됩니다. 각 행은 variant_code 1건입니다.
                  </div>

                  <div className="max-h-[320px] overflow-auto rounded border border-[var(--hairline)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--panel)] text-left">
                        <tr>
                          <th className="px-2 py-1">variant</th>
                          {variantOptionColumnNames.map((name) => (
                            <th key={name} className="px-2 py-1">{name}</th>
                          ))}
                          <th className="px-2 py-1 text-right tabular-nums">옵션가</th>
                          <th className="px-2 py-1 text-right tabular-nums">최종가(max(판매가+옵션가, 유효바닥가))</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editorPreview.variants.map((variant) => {
                          const valueByName = new Map(
                            (variant.options ?? []).map((o) => [String(o.name ?? "").trim(), String(o.value ?? "").trim()]),
                          );
                          return (
                            <tr key={variant.variantCode} className="border-t border-[var(--hairline)]">
                              <td className="px-2 py-1">{variant.variantCode}</td>
                              {variantOptionColumnNames.map((name) => (
                                <td key={`${variant.variantCode}::${name}`} className="px-2 py-1">{valueByName.get(name) || "-"}</td>
                              ))}
                              <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmt(variant.additionalAmount)}</td>
                              <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">
                                {editorPreview.price == null || variant.additionalAmount == null
                                  ? "-"
                                  : fmt(Math.max(
                                    Math.round(Number(editorPreview.price) + Number(variant.additionalAmount)),
                                    previewEffectiveFloor,
                                  ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={isEditDrawerOpen}
        onOpenChange={setIsEditDrawerOpen}
        title="상세수정"
        side="left"
        className="lg:w-[calc(100vw-1100px)]"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="text-sm font-semibold">상세수정</div>
            <div className="text-xs text-[var(--muted)]">소비자가/판매가/옵션가 및 카테고리/옵션값 금액 수정</div>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {!editorPreview ? (
              <div className="text-sm text-[var(--muted)]">먼저 상품 미리보기를 불러오세요.</div>
            ) : (
              <>
                <div className="rounded border border-[var(--hairline)] p-2">
                  <div className="mb-2 text-xs text-[var(--muted)]">옵션명은 카테고리를 1개만 가지며, 옵션값별 금액을 직접 설정합니다.</div>
                  <div className="mb-2 rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-2 text-xs text-[var(--muted)]">
                    예: 카테고리 A 옵션값 2개 + 카테고리 B 옵션값 3개면 총 5개 금액만 설정하고, 조합 옵션가는 선택된 값들의 합으로 계산됩니다.
                  </div>
                  <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--panel)] text-left">
                        <tr>
                          <th className="px-2 py-1">옵션명</th>
                          <th className="px-2 py-1">대표 옵션값</th>
                          <th className="px-2 py-1">카테고리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionNames.map((entry) => {
                          const key = entry.option_name;
                          const selectedCategory = effectiveCategoryByKey.get(key) ?? guessCategoryByOptionName(entry.option_name);
                          return (
                            <tr key={key} className="border-t border-[var(--hairline)]">
                              <td className="px-2 py-1">{entry.option_name}</td>
                              <td className="px-2 py-1">{entry.sample_values.join(" / ") || "-"}</td>
                              <td className="px-2 py-1">
                                <Select
                                  value={selectedCategory}
                                  onChange={(e) =>
                                    setOptionCategoryDrafts((prev) => ({
                                      ...prev,
                                      [key]: e.target.value as OptionCategoryRow["category_key"],
                                    }))
                                  }
                                >
                                  {CATEGORY_OPTIONS.map((opt) => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                  ))}
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--panel)] text-left">
                        <tr>
                          <th className="px-2 py-1">옵션명</th>
                          <th className="px-2 py-1">옵션값</th>
                          <th className="px-2 py-1">카테고리</th>
                          <th className="px-2 py-1">동기화 금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionEntries.map((entry) => {
                          const key = optionEntryKey(entry.option_name, entry.option_value);
                          const selectedCategory = effectiveCategoryByKey.get(entry.option_name) ?? guessCategoryByOptionName(entry.option_name);
                          const selectedSyncDelta = effectiveOptionSyncDeltaByEntryKey.get(key) ?? 0;
                          return (
                            <tr key={key} className="border-t border-[var(--hairline)]">
                              <td className="px-2 py-1">{entry.option_name}</td>
                              <td className="px-2 py-1">{entry.option_value}</td>
                              <td className="px-2 py-1">{CATEGORY_OPTIONS.find((c) => c.key === selectedCategory)?.label ?? selectedCategory}</td>
                              <td className="px-2 py-1">
                                <Select
                                  value={String(selectedSyncDelta)}
                                  onChange={(e) => {
                                    const next = Math.round(Number(e.target.value ?? 0));
                                    setOptionSyncDeltaDrafts((prev) => ({
                                      ...prev,
                                      [key]: Number.isFinite(next) ? next : 0,
                                    }));
                                  }}
                                >
                                  {SYNC_DELTA_OPTIONS.map((delta) => (
                                    <option key={`${key}-${delta}`} value={delta}>{delta >= 0 ? "+" : ""}{delta.toLocaleString()}원</option>
                                  ))}
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => saveCategoriesMutation.mutate()} disabled={saveCategoriesMutation.isPending || !editorPreview}>
                      옵션 카테고리/금액 저장
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">소비자가</div>
                    <Input value={editorRetailPrice} onChange={(e) => setEditorRetailPrice(e.target.value)} type="number" placeholder="retail_price" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">판매가</div>
                    <Input value={editorPrice} onChange={(e) => setEditorPrice(e.target.value)} type="number" placeholder="price" />
                    <label className="mt-1 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={sellingPriceOverrideLocked}
                        onChange={(e) => setSellingPriceOverrideLocked(e.target.checked)}
                        disabled={!editorMasterItemId}
                      />
                      판매가 덮어쓰기 고정 (체크 시 현재 판매가 유지)
                    </label>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">바닥가</div>
                    <Input value={editorFloorPrice} onChange={(e) => setEditorFloorPrice(e.target.value)} type="number" placeholder="floor_price_krw" min={0} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">진열상태</div>
                    <Select value={editorDisplay} onChange={(e) => setEditorDisplay(e.target.value)}>
                      <option value="T">진열</option>
                      <option value="F">진열안함</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">판매상태</div>
                    <Select value={editorSelling} onChange={(e) => setEditorSelling(e.target.value)}>
                      <option value="T">판매</option>
                      <option value="F">판매안함</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted)]">도금공임 제외</div>
                    <label className="flex h-10 items-center gap-2 rounded border border-[var(--hairline)] px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={editorExcludePlatingLabor}
                        onChange={(e) => setEditorExcludePlatingLabor(e.target.checked)}
                      />
                      적용
                    </label>
                  </div>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  {sellingPriceOverrideLocked
                    ? "덮어쓰기 고정 ON: 재계산/자동동기화에서도 이 판매가를 우선 적용합니다."
                    : "덮어쓰기 고정 OFF: 재계산값(금/은 시세 반영)을 사용하며, 최종 동기화 가격은 바닥가 이상으로 보정됩니다."}
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => loadMasterComputedMutation.mutate()}
                    disabled={!effectiveChannelId || !editorMasterItemId || !editorPreview?.productNo || loadMasterComputedMutation.isPending}
                  >
                    마스터 계산값 불러오기
                  </Button>
                </div>

                <div className="max-h-[320px] overflow-auto rounded border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        <th className="px-2 py-1">variant_code</th>
                        {variantOptionColumnNames.map((name) => (
                          <th key={name} className="px-2 py-1">{name}</th>
                        ))}
                        <th className="px-2 py-1">저장기반 옵션가</th>
                        <th className="px-2 py-1">동기화 계산 옵션가</th>
                        <th className="px-2 py-1">쇼핑몰 옵션가</th>
                        <th className="px-2 py-1">base 판매가</th>
                        <th className="px-2 py-1">옵션가격(additional)</th>
                        <th className="px-2 py-1">쇼핑몰반영</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editorPreview.variants.map((variant) => {
                        const valueByName = new Map(
                          (variant.options ?? []).map((o) => [String(o.name ?? "").trim(), String(o.value ?? "").trim()]),
                        );
                        const savedTargetAdditionalAmount = variant.savedTargetAdditionalAmount == null
                          ? null
                          : Math.round(Number(variant.savedTargetAdditionalAmount));
                        const storefrontAdditionalAmount = variant.additionalAmount == null
                          ? null
                          : Math.round(Number(variant.additionalAmount));
                        const computedAdditionalAmount = Math.round(Number(computedVariantAdditionalByCode.get(variant.variantCode) ?? 0));

                        let syncState = "확인필요";
                        if (savedTargetAdditionalAmount == null) {
                          syncState = "저장값없음";
                        } else if (storefrontAdditionalAmount == null) {
                          syncState = "확인필요";
                        } else if (storefrontAdditionalAmount === savedTargetAdditionalAmount) {
                          syncState = "일치";
                        } else {
                          syncState = "불일치";
                        }

                        return (
                          <tr key={variant.variantCode} className="border-t border-[var(--hairline)]">
                            <td className="px-2 py-1">{variant.variantCode}</td>
                            {variantOptionColumnNames.map((name) => (
                              <td key={`${variant.variantCode}::${name}`} className="px-2 py-1">{valueByName.get(name) || "-"}</td>
                            ))}
                            <td className="px-2 py-1">{fmt(savedTargetAdditionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(computedAdditionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(variant.additionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(editorPreview.price)}</td>
                            <td className="px-2 py-1">
                              <Input value={String(savedTargetAdditionalAmount ?? computedAdditionalAmount)} type="number" readOnly />
                            </td>
                            <td className="px-2 py-1">{syncState}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => applyEditorMutation.mutate()} disabled={applyEditorMutation.isPending || !editorPreview}>
                    상세수정 반영
                  </Button>
                </div>
                {applyError ? (
                  <div className="text-xs text-red-500">{applyError}</div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Sheet>

      <Card>
        <CardHeader title="기본 설정" description="채널, 바닥가격, 실행 주기" />
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={effectiveChannelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">채널 선택</option>
            {channels.map((ch) => (
              <option key={ch.channel_id} value={ch.channel_id}>{ch.channel_name} ({ch.channel_code})</option>
            ))}
          </Select>
          <Input value={masterItemId} onChange={(e) => setMasterItemId(e.target.value)} placeholder="master_item_id" />
          <Input value={floorPrice} onChange={(e) => setFloorPrice(e.target.value)} type="number" placeholder="floor_price_krw" min={0} />
          <Button onClick={() => saveFloorMutation.mutate()} disabled={!effectiveChannelId || !masterItemId.trim() || saveFloorMutation.isPending}>
            바닥가격 저장
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="가격 정책(마진/반올림)" description="재계산(recompute) 시 적용되는 기준값" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <Input value={marginMultiplier} onChange={(e) => setMarginMultiplier(e.target.value)} type="number" placeholder="margin_multiplier" />
            <Input value={roundingUnit} onChange={(e) => setRoundingUnit(e.target.value)} type="number" placeholder="rounding_unit" />
            <Select value={roundingMode} onChange={(e) => setRoundingMode(e.target.value as "CEIL" | "ROUND" | "FLOOR")}>
              <option value="CEIL">올림(CEIL)</option>
              <option value="ROUND">반올림(ROUND)</option>
              <option value="FLOOR">내림(FLOOR)</option>
            </Select>
            <Input
              value={option18kWeightMultiplier}
              onChange={(e) => setOption18kWeightMultiplier(e.target.value)}
              type="number"
              placeholder="option_18k_weight_multiplier"
            />
            <Select value={policyFactorSetId} onChange={(e) => setPolicyFactorSetId(e.target.value)}>
              <option value="">팩터 세트 선택</option>
              {(factorSetsQuery.data ?? []).map((fs) => (
                <option key={fs.factor_set_id} value={fs.factor_set_id}>{fs.name}</option>
              ))}
            </Select>
            <Button onClick={() => savePolicyMutation.mutate()} disabled={!effectiveChannelId || savePolicyMutation.isPending}>
              정책 저장
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            상세수정 반영은 즉시값을 직접 반영하고, 여기 값은 재계산/동기화 파이프라인에서 적용됩니다.
          </p>
          {policySaveError ? <p className="text-xs text-red-500">{policySaveError}</p> : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="활성 바닥가격 목록" description={`${guardsQuery.data?.data.length ?? 0}건`} />
          <CardBody>
            <div className="max-h-[300px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">master_item_id</th>
                    <th className="px-3 py-2">floor_price_krw</th>
                    <th className="px-3 py-2">updated_at</th>
                  </tr>
                </thead>
                <tbody>
                  {(guardsQuery.data?.data ?? []).map((row) => (
                    <tr key={row.guard_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{row.master_item_id}</td>
                      <td className="px-3 py-2">{fmt(row.floor_price_krw)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtTs(row.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="자동동기화 Run 생성" description="생성 후 실행 버튼으로 push" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)}>
                <option value="5">5분</option>
                <option value="10">10분</option>
                <option value="20">20분</option>
                <option value="60">60분</option>
              </Select>
              <Input value={runMasterIds} onChange={(e) => setRunMasterIds(e.target.value)} placeholder="master_item_id 쉼표 구분(비우면 전체)" />
              <Button onClick={() => createRunMutation.mutate()} disabled={!effectiveChannelId || createRunMutation.isPending}>
                Run 생성
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">Run 생성 시 floor 미설정 master가 있으면 실패합니다.</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Run 목록" description={`${runsQuery.data?.data.length ?? 0}건`} />
          <CardBody>
            <div className="max-h-[420px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">run_id</th>
                    <th className="px-3 py-2">시작</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">성공/실패/건너뜀</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQuery.data?.data ?? []).map((run) => (
                    <tr
                      key={run.run_id}
                      className={`cursor-pointer border-t border-[var(--hairline)] ${effectiveRunId === run.run_id ? "bg-[var(--panel)]" : ""}`}
                      onClick={() => setSelectedRunId(run.run_id)}
                    >
                      <td className="px-3 py-2">{run.run_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtTs(run.started_at)}</td>
                      <td className="px-3 py-2">{toRunKo(run.status)}</td>
                      <td className="px-3 py-2">{run.success_count}/{run.failed_count}/{run.skipped_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => executeRunMutation.mutate()} disabled={!effectiveRunId || executeRunMutation.isPending}>
                선택 Run 실행
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Run Intent 상세" description={`${runDetailQuery.data?.data.intents.length ?? 0}건`} />
          <CardBody>
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <div className="mb-2 text-sm font-medium">건너뜀 사유</div>
                {runSkippedReasons.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">없음</div>
                ) : (
                  <div className="space-y-1 text-xs">
                    {runSkippedReasons.map((row) => (
                      <div key={`run-skip-${row.reason_code}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.reason_label} ({row.reason_code})</span>
                        <span className="shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <div className="mb-2 text-sm font-medium">실패 사유</div>
                {runFailedReasons.length === 0 ? (
                  <div className="text-xs text-[var(--muted)]">없음</div>
                ) : (
                  <div className="space-y-1 text-xs">
                    {runFailedReasons.map((row) => (
                      <div key={`run-fail-${row.reason_code}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.reason_label} ({row.reason_code})</span>
                        <span className="shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">product_no</th>
                    <th className="px-3 py-2">variant_code</th>
                    <th className="px-3 py-2">desired</th>
                    <th className="px-3 py-2">바닥</th>
                    <th className="px-3 py-2">clamp</th>
                    <th className="px-3 py-2">state</th>
                    <th className="px-3 py-2">reason_code</th>
                  </tr>
                </thead>
                <tbody>
                  {(runDetailQuery.data?.data.intents ?? []).map((it) => (
                    <tr key={it.intent_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{it.external_product_no}</td>
                      <td className="px-3 py-2">{it.external_variant_code || "-"}</td>
                      <td className="px-3 py-2">{fmt(it.desired_price_krw)}</td>
                      <td className="px-3 py-2">{fmt(it.floor_price_krw)}</td>
                      <td className="px-3 py-2">{it.floor_applied ? "Y" : "N"}</td>
                      <td className="px-3 py-2">{it.state}</td>
                      <td className="px-3 py-2 text-xs">{it.reason_code ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
