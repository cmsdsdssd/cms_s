"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  gm_material?: number | null;
  gm_labor?: number | null;
  gm_fixed?: number | null;
  fixed_cost_krw?: number | null;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
  option_18k_weight_multiplier: number;
  material_factor_set_id: string | null;
  fee_rate?: number | null;
  min_margin_rate_total?: number | null;
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
type MissingMappingSummary = {
  snapshot_rows_with_channel_product_count?: number;
  missing_active_mapping_row_count?: number;
  missing_active_mapping_product_count?: number;
  missing_active_mapping_master_count?: number;
  missing_active_mapping_samples?: Array<{
    channel_product_id: string;
    master_item_id: string | null;
    compute_request_id: string | null;
  }>;
};
type SyncRunCreateResponse = {
  run_id: string;
  total_count?: number;
  reason?: string;
  threshold_min_change_krw?: number;
  threshold_evaluated_count?: number;
  threshold_filtered_count?: number;
  market_gap_forced_count?: number;
  downsync_suppressed_count?: number;
  force_full_sync?: boolean;
} & MissingMappingSummary;
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
  applied_before_price_krw?: number | null;
  applied_target_price_krw?: number | null;
  applied_after_price_krw?: number | null;
  snapshot_desired_price_krw?: number | null;
  effective_desired_price_krw?: number | null;
  updated_at?: string | null;
};
type SyncRunDetail = {
  run: {
    run_id: string;
    status?: string | null;
    pinned_compute_request_id?: string | null;
    started_at?: string | null;
    request_payload?: {
      summary?: MissingMappingSummary & {
        threshold_min_change_krw?: number;
        threshold_evaluated_count?: number;
        threshold_filtered_count?: number;
        market_gap_forced_count?: number;
        downsync_suppressed_count?: number;
        force_full_sync?: boolean;
      };
    } | null;
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
const toDisplayKo = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "T" ? "진열" : normalized === "F" ? "미진열" : "-";
};
const toSellingKo = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "T" ? "판매" : normalized === "F" ? "미판매" : "-";
};
const fmtSignedKrw = (v: number | null | undefined) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  const rounded = Math.round(v);
  const sign = rounded > 0 ? "+" : "";
  return sign + rounded.toLocaleString() + "원";
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

const SNAPSHOT_BLUE_KEYS = new Set([
  "material-total",
  "labor-total",
  "final-price",
]);

const snapshotCellToneClass = (key: string) => {
  if (SNAPSHOT_BLUE_KEYS.has(key)) return "bg-sky-100";
  return "bg-white";
};

const parseCronTickReason = (errorMessage: string | null | undefined): string | null => {
  const raw = String(errorMessage ?? "").trim();
  if (!raw.toUpperCase().startsWith("CRON_TICK:")) return null;
  const reason = raw.slice("CRON_TICK:".length).trim();
  return reason || null;
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
  const [policyFactorSetId, setPolicyFactorSetId] = useState("");
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runMasterIds, setRunMasterIds] = useState("");
  const [editorProductNo, setEditorProductNo] = useState("");
  const [gallerySearch, setGallerySearch] = useState("");
  const [editorPreview, setEditorPreview] = useState<ProductEditorPreview | null>(null);
  const [editorMasterItemIdHint, setEditorMasterItemIdHint] = useState("");
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
    queryFn: () => shopApiGet<{ data: { run: SyncRunDetail["run"]; intents: SyncIntent[]; summary?: { reasons: ReasonSummaryRow[]; skipped_reasons: ReasonSummaryRow[]; failed_reasons: ReasonSummaryRow[] } } }>(`/api/price-sync-runs-v2/${effectiveRunId}`),
    refetchInterval: 10_000,
  });

  const runSkippedReasons = runDetailQuery.data?.data.summary?.skipped_reasons ?? [];
  const runFailedReasons = runDetailQuery.data?.data.summary?.failed_reasons ?? [];
  const activeRunMissingMappingSummary = runDetailQuery.data?.data.run?.request_payload?.summary ?? null;
  const activeRunMissingProductCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.missing_active_mapping_product_count ?? 0)));
  const activeRunMissingRowCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.missing_active_mapping_row_count ?? 0)));
  const activeRunSnapshotRowsWithChannelProductCount = Math.max(
    0,
    Math.round(Number(activeRunMissingMappingSummary?.snapshot_rows_with_channel_product_count ?? 0)),
  );
  const activeRunMissingSamples = (activeRunMissingMappingSummary?.missing_active_mapping_samples ?? []).slice(0, 10);

  const masterIdByProductNo = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of mappingSummaryQuery.data?.data.mapped_masters ?? []) {
      const masterId = String(row.master_item_id ?? "").trim();
      if (!masterId) continue;
      for (const productNo of row.product_nos ?? []) {
        const key = String(productNo ?? "").trim();
        if (!key || map.has(key)) continue;
        map.set(key, masterId);
      }
    }
    return map;
  }, [mappingSummaryQuery.data?.data.mapped_masters]);

  const editorMasterItemId = useMemo(() => {
    if (editorPreview) {
      const fromPreview = String(editorPreview.master_item_id ?? "").trim();
      if (fromPreview) return fromPreview;
    }
    if (editorMasterItemIdHint) return editorMasterItemIdHint;

    const productNoCandidates = [
      String(editorProductNo ?? "").trim(),
      String(editorPreview?.productNo ?? "").trim(),
    ].filter(Boolean);

    for (const productNo of productNoCandidates) {
      const mappedMasterId = masterIdByProductNo.get(productNo);
      if (mappedMasterId) return mappedMasterId;
    }

    return "";
  }, [editorPreview, editorProductNo, editorMasterItemIdHint, masterIdByProductNo]);

  const recentRunIds = useMemo(
    () => (runsQuery.data?.data ?? [])
      .filter((row) => !String(row.error_message ?? "").trim().toUpperCase().startsWith("CRON_TICK:"))
      .slice(0, 20)
      .map((row) => String(row.run_id ?? "").trim())
      .filter(Boolean),
    [runsQuery.data?.data],
  );

  const latestCronTick = useMemo(() => {
    const rows = runsQuery.data?.data ?? [];
    for (const row of rows) {
      const reason = parseCronTickReason(row.error_message ?? null);
      if (!reason) continue;
      return {
        at: String(row.started_at ?? "").trim(),
        reason,
      };
    }
    return null;
  }, [runsQuery.data?.data]);

  const recentRunDetailQueries = useQueries({
    queries: recentRunIds.map((runId) => ({
      queryKey: ["price-sync-run-v2", "preview", runId],
      enabled: Boolean(effectiveChannelId && runId),
      queryFn: () => shopApiGet<{ data: SyncRunDetail }>("/api/price-sync-runs-v2/" + runId),
      staleTime: 20_000,
      refetchInterval: 15_000,
    })),
  });

  const resolvedPreviewProductNo = useMemo(() => {
    const candidates = Array.from(
      new Set([
        String(editorProductNo ?? "").trim(),
        String(editorPreview?.productNo ?? "").trim(),
      ].filter(Boolean)),
    );
    if (candidates.length === 0) return "";
    const canonical = candidates.find((value) => /^P/i.test(value));
    return canonical ?? candidates[0] ?? "";
  }, [editorProductNo, editorPreview?.productNo]);

  const latestComputeRequestIdForPreview = useMemo(() => {
    for (const query of recentRunDetailQueries) {
      const computeRequestId = String(query.data?.data?.run?.pinned_compute_request_id ?? "").trim();
      if (computeRequestId) return computeRequestId;
    }
    return "";
  }, [recentRunDetailQueries]);

  const snapshotExplainQuery = useQuery({
    queryKey: ["pricing-snapshot-explain", effectiveChannelId, editorMasterItemId, resolvedPreviewProductNo, latestComputeRequestIdForPreview],
    enabled: Boolean(effectiveChannelId && editorMasterItemId),
    queryFn: () =>
      shopApiGet<PricingSnapshotExplainResponse>(
        "/api/channel-price-snapshot-explain?channel_id="
          + encodeURIComponent(effectiveChannelId)
          + "&master_item_id="
          + encodeURIComponent(editorMasterItemId)
          + (latestComputeRequestIdForPreview
            ? `&compute_request_id=${encodeURIComponent(latestComputeRequestIdForPreview)}`
            : "")
          + (resolvedPreviewProductNo
            ? `&external_product_no=${encodeURIComponent(resolvedPreviewProductNo)}`
            : ""),
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


  const previewCompositionRowGroups = useMemo(() => {
    if (!snapshotExplainRow) return [] as Array<Array<{ key: string; label: string; valueText: string }>>;

    const finalTarget = toRoundedNumber(snapshotExplainRow.final_target_price_v2_krw ?? snapshotExplainRow.final_target_price_krw);
    const currentPrice = toRoundedNumber(snapshotExplainRow.current_channel_price_krw);
    const diffKrw = toRoundedNumber(
      snapshotExplainRow.diff_krw
        ?? (finalTarget != null && currentPrice != null ? finalTarget - currentPrice : null),
    );
    const diffPctRatio = Number(snapshotExplainRow.diff_pct ?? Number.NaN);
    const diffPctText = Number.isFinite(diffPctRatio) ? `${(diffPctRatio * 100).toFixed(2)}%` : "-";

    const policyMarginMultiplier = Number(activePolicy?.margin_multiplier ?? Number.NaN);
    const policyMarginMultiplierText = Number.isFinite(policyMarginMultiplier)
      ? `x${policyMarginMultiplier.toFixed(3).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1")}`
      : "-";
    const policyMarginRateText = Number.isFinite(policyMarginMultiplier)
      ? `${((policyMarginMultiplier - 1) * 100).toFixed(2)}%`
      : "-";
    const policyFeeRate = Number(activePolicy?.fee_rate ?? Number.NaN);
    const policyFeeRateText = Number.isFinite(policyFeeRate)
      ? `${(policyFeeRate * 100).toFixed(2)}%`
      : "-";
    const policyMinMarginRate = Number(activePolicy?.min_margin_rate_total ?? Number.NaN);
    const policyMinMarginRateText = Number.isFinite(policyMinMarginRate)
      ? `${(policyMinMarginRate * 100).toFixed(2)}%`
      : "-";
    const gmMaterialRate = Number(activePolicy?.gm_material ?? Number.NaN);
    const gmMaterialRateText = Number.isFinite(gmMaterialRate) ? `${(gmMaterialRate * 100).toFixed(2)}%` : "-";
    const gmLaborRate = Number(activePolicy?.gm_labor ?? Number.NaN);
    const gmLaborRateText = Number.isFinite(gmLaborRate) ? `${(gmLaborRate * 100).toFixed(2)}%` : "-";
    const gmFixedRate = Number(activePolicy?.gm_fixed ?? Number.NaN);
    const gmFixedRateText = Number.isFinite(gmFixedRate) ? `${(gmFixedRate * 100).toFixed(2)}%` : "-";
    const materialPreFee = toRoundedNumber(snapshotExplainRow.material_pre_fee_krw);
    const laborPreFee = toRoundedNumber(snapshotExplainRow.labor_pre_fee_krw);
    const fixedPreFee = toRoundedNumber(snapshotExplainRow.fixed_pre_fee_krw);
    const materialLaborCombinedPreFee = materialPreFee != null && laborPreFee != null
      ? materialPreFee + laborPreFee
      : null;
    const totalPreFee = toRoundedNumber(snapshotExplainRow.candidate_pre_fee_krw);
    const fixedCostSetting = toRoundedNumber(activePolicy?.fixed_cost_krw ?? null);
    const toPctText = (ratio: number | null | undefined): string | null => {
      const n = Number(ratio);
      if (!Number.isFinite(n)) return null;
      if (Math.abs(n) < 1e-12) return "0%";
      return `${(n * 100).toFixed(2)}%`;
    };
    const minMarginPct = toPctText(policyMinMarginRate);
    const feePct = toPctText(policyFeeRate);
    const guardrailPct = toPctText(
      Number.isFinite(policyMinMarginRate) && Number.isFinite(policyFeeRate)
        ? policyMinMarginRate + policyFeeRate
        : Number.NaN,
    );
    const guardrailRateText = guardrailPct != null && minMarginPct != null && feePct != null
      ? `${guardrailPct}(${minMarginPct}+${feePct})`
      : "-";

    const selectedLabel = snapshotExplainRow.guardrail_reason_code === "MIN_MARGIN_WIN"
      ? "최소마진가격"
      : snapshotExplainRow.guardrail_reason_code === "COMPONENT_CANDIDATE_WIN"
        ? "목표가격"
        : snapshotExplainRow.guardrail_reason_code ?? "-";
    const selectedBase = toRoundedNumber(snapshotExplainRow.guardrail_price_krw ?? finalTarget);
    const selectedPreFee = selectedBase != null && Number.isFinite(policyFeeRate)
      ? Math.round(selectedBase * (1 - policyFeeRate))
      : toRoundedNumber(snapshotExplainRow.candidate_pre_fee_krw);
    const marginWithoutFee = selectedPreFee != null && snapshotExplainRow.cost_sum_krw != null
      ? selectedPreFee - (toRoundedNumber(snapshotExplainRow.cost_sum_krw) ?? 0)
      : null;
    const feeAmount = selectedBase != null && selectedPreFee != null ? selectedBase - selectedPreFee : null;
    const purityAdjusted = snapshotExplainRow.material_purity_rate_resolved != null && snapshotExplainRow.material_adjust_factor_resolved != null
      ? snapshotExplainRow.material_purity_rate_resolved * snapshotExplainRow.material_adjust_factor_resolved
      : null;
    const componentAmount = (
      componentKey: string,
      field: "labor_cost_krw" | "labor_absorb_applied_krw" | "labor_cost_plus_absorb_krw",
    ): number | null => toRoundedNumber(snapshotExplainRow.labor_component_json?.[componentKey]?.[field] ?? null);

    const topRow = [
      { key: "material-code", label: "소재코드", valueText: String(snapshotExplainRow.material_code_effective ?? "-") },
      { key: "weight", label: "순중량", valueText: fmt(snapshotExplainRow.net_weight_g) },
      { key: "material-basis", label: "소재기준", valueText: String(snapshotExplainRow.material_basis_resolved ?? "-") },
      { key: "purity-adjust", label: "함량*보정계수", valueText: purityAdjusted == null ? "-" : purityAdjusted.toFixed(4) },
      { key: "purity", label: "함량", valueText: snapshotExplainRow.material_purity_rate_resolved == null ? "-" : snapshotExplainRow.material_purity_rate_resolved.toFixed(4) },
      { key: "adjust", label: "보정계수", valueText: snapshotExplainRow.material_adjust_factor_resolved == null ? "-" : snapshotExplainRow.material_adjust_factor_resolved.toFixed(4) },
    ];

    const priceRow = [
      { key: "labor-cost-total", label: "공임합(원가)", valueText: fmtKrw(snapshotExplainRow.labor_cost_applied_krw) },
      { key: "labor-cost-base", label: "기본공임(원가)", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_cost_krw")) },
      { key: "labor-cost-stone", label: "알공임(원가)", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_cost_krw")) },
      { key: "labor-cost-etc", label: "기타공임(원가)", valueText: fmtKrw(componentAmount("ETC", "labor_cost_krw")) },
      { key: "labor-cost-plating", label: "도금공임(원가)", valueText: fmtKrw(componentAmount("PLATING", "labor_cost_krw")) },
      { key: "labor-cost-decor", label: "장식공임(원가)", valueText: fmtKrw(componentAmount("DECOR", "labor_cost_krw")) },
    ];

    const policyRow = [
      { key: "absorb-total", label: "흡수공임합(원가)", valueText: fmtKrw(snapshotExplainRow.absorb_total_applied_krw) },
      { key: "absorb-base", label: "기본공임(흡수공임)", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_absorb_applied_krw")) },
      { key: "absorb-stone", label: "알공임(흡수공임)", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_absorb_applied_krw")) },
      { key: "absorb-etc", label: "기타공임(흡수공임)", valueText: fmtKrw(componentAmount("ETC", "labor_absorb_applied_krw")) },
      { key: "absorb-plating", label: "도금공임(흡수공임)", valueText: fmtKrw(componentAmount("PLATING", "labor_absorb_applied_krw")) },
      { key: "absorb-decor", label: "장식공임(흡수공임)", valueText: fmtKrw(componentAmount("DECOR", "labor_absorb_applied_krw")) },
    ];

    const detailRows = [
      { key: "total-labor-cost", label: "총공임합(원가)", valueText: fmtKrw(snapshotExplainRow.labor_cost_applied_krw) },
      { key: "total-base", label: "총기본공임(원가)", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_cost_plus_absorb_krw")) },
      { key: "total-stone", label: "총알공임(원가)", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_cost_plus_absorb_krw")) },
      { key: "total-etc", label: "총기타공임(원가)", valueText: fmtKrw(componentAmount("ETC", "labor_cost_plus_absorb_krw")) },
      { key: "total-plating", label: "총도금공임(원가)", valueText: fmtKrw(componentAmount("PLATING", "labor_cost_plus_absorb_krw")) },
      { key: "total-decor", label: "총장식공임(원가)", valueText: fmtKrw(componentAmount("DECOR", "labor_cost_plus_absorb_krw")) },

      { key: "labor-total", label: "총공임", valueText: fmtKrw(snapshotExplainRow.labor_cost_applied_krw) },
      { key: "material-total", label: "총소재가격", valueText: fmtKrw(snapshotExplainRow.material_final_krw) },
      { key: "pre-fee-total", label: "총합계", valueText: fmtKrw(totalPreFee) },
      { key: "material-margin-rate", label: "소재마진율", valueText: gmMaterialRateText },
      { key: "labor-margin-rate", label: "공임마진율", valueText: gmLaborRateText },
      { key: "fixed-margin-rate", label: "고정마진율", valueText: gmFixedRateText },

      { key: "labor-reverse-gm", label: "공임 역산(gm)", valueText: `${fmtKrw(laborPreFee)} (${gmLaborRateText})` },
      { key: "material-reverse-gm", label: "소재 역산(gm)", valueText: `${fmtKrw(materialPreFee)} (${gmMaterialRateText})` },
      { key: "total-reverse-gm", label: "총합계역산(gm)", valueText: fmtKrw(totalPreFee) },
      { key: "target-margin-rate", label: "목표마진율", valueText: `${policyMarginRateText} (${policyMarginMultiplierText})` },
      { key: "guardrail-rate", label: "가드레일율(최소마진+수수료)", valueText: guardrailRateText },
      { key: "fixed-cost-setting", label: "고정가격 설정", valueText: fmtKrw(fixedCostSetting) },

      { key: "final-price", label: "최종가격", valueText: fmtKrw(finalTarget) },
      { key: "selected-item", label: "선택항목", valueText: selectedLabel },
      { key: "target-price", label: "목표가격", valueText: fmtKrw(snapshotExplainRow.candidate_price_krw) },
      { key: "min-margin-price", label: "최소마진가격", valueText: fmtKrw(snapshotExplainRow.min_margin_price_krw) },
      { key: "margin-no-fee", label: "마진(수수료 제외)", valueText: marginWithoutFee == null ? "-" : fmtSignedKrw(marginWithoutFee) },
      { key: "fee-amount", label: "수수료", valueText: feeAmount == null ? "-" : fmtKrw(feeAmount) },
    ];

    const groups = [topRow, priceRow, policyRow] as Array<Array<{ key: string; label: string; valueText: string }>>;
    for (let i = 0; i < detailRows.length; i += 6) {
      groups.push(detailRows.slice(i, i + 6));
    }
    return groups;
  }, [activePolicy?.margin_multiplier, activePolicy?.fee_rate, activePolicy?.min_margin_rate_total, activePolicy?.gm_material, activePolicy?.gm_labor, activePolicy?.gm_fixed, activePolicy?.fixed_cost_krw, snapshotExplainRow]);

  const previewCompositionFlowLines = useMemo(() => {
    if (!snapshotExplainRow) return [] as string[];

    const finalTarget = toRoundedNumber(snapshotExplainRow.final_target_price_v2_krw ?? snapshotExplainRow.final_target_price_krw);
    const policyFeeRate = Number(activePolicy?.fee_rate ?? Number.NaN);
    const policyFeeRateText = Number.isFinite(policyFeeRate) ? `${(policyFeeRate * 100).toFixed(2)}%` : "-";
    const policyMinMarginRate = Number(activePolicy?.min_margin_rate_total ?? Number.NaN);
    const policyMinMarginRateText = Number.isFinite(policyMinMarginRate) ? `${(policyMinMarginRate * 100).toFixed(2)}%` : "-";
    const purityAdjusted = snapshotExplainRow.material_purity_rate_resolved != null && snapshotExplainRow.material_adjust_factor_resolved != null
      ? snapshotExplainRow.material_purity_rate_resolved * snapshotExplainRow.material_adjust_factor_resolved
      : null;

    const line1 = `소재가격: ${fmtKrw(snapshotExplainRow.material_final_krw)} (유효틱 ${fmt(snapshotExplainRow.effective_tick_krw_g)}원/g × 순중량 ${fmt(snapshotExplainRow.net_weight_g)} × 함량*보정계수 ${purityAdjusted == null ? "-" : purityAdjusted.toFixed(4)} -> 소재원가 ${fmtKrw(snapshotExplainRow.material_raw_krw)} -> 환산 ${fmtKrw(snapshotExplainRow.material_final_krw)})`;

    const line2 = `총공임: ${fmtKrw(snapshotExplainRow.labor_cost_applied_krw)} (공임원가(흡수반영) ${fmtKrw(snapshotExplainRow.labor_cost_applied_krw)} + 흡수공임(적용) ${fmtKrw(snapshotExplainRow.absorb_total_applied_krw)} -> 공임판매합(흡수포함) ${fmtKrw(snapshotExplainRow.labor_sell_total_plus_absorb_krw)} -> GM 역산(수수료전) ${fmtKrw(snapshotExplainRow.labor_pre_fee_krw)})`;

    const line3 = `총가격 후보(목표가격): ${fmtKrw(snapshotExplainRow.candidate_price_krw)} (수수료반영전 후보합 ${fmtKrw(snapshotExplainRow.candidate_pre_fee_krw)} = 소재 ${fmtKrw(snapshotExplainRow.material_pre_fee_krw)} + 공임 ${fmtKrw(snapshotExplainRow.labor_pre_fee_krw)} + 고정 ${fmtKrw(snapshotExplainRow.fixed_pre_fee_krw)}, 수수료율 ${policyFeeRateText} 역산 반영)`;

    const line4 = `총가격 후보(최소마진): ${fmtKrw(snapshotExplainRow.min_margin_price_krw)} (원가합계 ${fmtKrw(snapshotExplainRow.cost_sum_krw)}와 정책최소마진율 ${policyMinMarginRateText} 기준)`;

    const line5 = `선택된 가격: max(목표가격 ${fmtKrw(snapshotExplainRow.candidate_price_krw)}, 최소마진가격 ${fmtKrw(snapshotExplainRow.min_margin_price_krw)}) = ${fmtKrw(snapshotExplainRow.guardrail_price_krw)} -> 최종가격 ${fmtKrw(finalTarget)}`;

    return [line1, line2, line3, line4, line5];
  }, [activePolicy?.fee_rate, activePolicy?.min_margin_rate_total, snapshotExplainRow]);

  const previewHistoryRows = useMemo(() => {
    if (!editorPreview) return [] as Array<{
      runId: string;
      at: string;
      snapshotPrice: number | null;
      pushTargetPrice: number | null;
      pushBeforePrice: number | null;
      candidatePrice: number | null;
      selectedItem: "목표가격" | "최소마진가격";
      selectedPrice: number | null;
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

    const pickSnapshotPrice = (intent: SyncIntent): number | null => {
      const candidates = [
        intent.snapshot_desired_price_krw,
        intent.desired_price_krw,
      ];
      for (const candidate of candidates) {
        const n = toRoundedNumber(candidate);
        if (n != null) return n;
      }
      return null;
    };

    const pickSelectedPrice = (intent: SyncIntent): number | null => {
      const candidates = [
        intent.applied_after_price_krw,
        intent.applied_target_price_krw,
        intent.snapshot_desired_price_krw,
        intent.desired_price_krw,
      ];
      for (const candidate of candidates) {
        const n = toRoundedNumber(candidate);
        if (n != null) return n;
      }
      return null;
    };

    const rows = recentRunDetailQueries
      .map((query) => query.data?.data)
      .filter((data): data is SyncRunDetail => Boolean(data))
      .map((data) => {
        const runId = String(data.run?.run_id ?? "").trim();
        const at = String(data.run?.started_at ?? "").trim();
        const intents = (data.intents ?? []).filter((intent) => {
          const masterMatched = editorMasterItemId && String(intent.master_item_id ?? "").trim() === editorMasterItemId;
          if (masterMatched) return true;
          const productNo = String(intent.external_product_no ?? "").trim();
          if (productNo && productNoSet.has(productNo)) return true;
          const variantCode = String(intent.external_variant_code ?? "").trim();
          return Boolean(variantCode && variantCodeSet.has(variantCode));
        });

        if (!runId || intents.length === 0) return null;

        const baseIntent = intents.find((intent) => !String(intent.external_variant_code ?? "").trim()) ?? intents[0];
        const snapshotPrice = pickSnapshotPrice(baseIntent);
        const pushTargetPrice = toRoundedNumber(baseIntent.applied_target_price_krw);
        const pushBeforePrice = toRoundedNumber(baseIntent.applied_before_price_krw);
        const pushAfterPrice = toRoundedNumber(baseIntent.applied_after_price_krw);
        const candidatePrice = pushTargetPrice ?? pushAfterPrice ?? snapshotPrice;
        const selectedPrice = pushAfterPrice ?? candidatePrice;
        const selectedItem: "목표가격" | "최소마진가격" = baseIntent.floor_applied ? "최소마진가격" : "목표가격";

        const variantPrices = intents
          .filter((intent) => String(intent.external_variant_code ?? "").trim())
          .map((intent) => pickSelectedPrice(intent))
          .filter((v): v is number => typeof v === "number");
        const variantAvg = variantPrices.length > 0
          ? Math.round(variantPrices.reduce((sum, value) => sum + value, 0) / variantPrices.length)
          : null;

        return {
          runId,
          at,
          snapshotPrice,
          pushTargetPrice,
          pushBeforePrice,
          candidatePrice,
          selectedItem,
          selectedPrice,
          variantAvg,
        };
      })
      .filter((row): row is {
        runId: string;
        at: string;
        snapshotPrice: number | null;
        pushTargetPrice: number | null;
        pushBeforePrice: number | null;
        candidatePrice: number | null;
        selectedItem: "목표가격" | "최소마진가격";
        selectedPrice: number | null;
        variantAvg: number | null;
      } => Boolean(row))
      .sort((a, b) => b.at.localeCompare(a.at));

    return rows.slice(0, 20);
  }, [editorPreview, editorMasterItemId, editorProductNo, recentRunDetailQueries]);

  const latestHistory = previewHistoryRows[0] ?? null;
  const previousHistory = previewHistoryRows[1] ?? null;
  const historyTrendDelta =
    latestHistory?.candidatePrice != null && previousHistory?.candidatePrice != null
      ? latestHistory.candidatePrice - previousHistory.candidatePrice
      : null;

  const previewTrend = useMemo(() => {
    const prices = previewHistoryRows
      .map((row) => row.candidatePrice)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const latest = prices[0] ?? null;
    const oldest = prices[prices.length - 1] ?? null;
    const netDelta = latest != null && oldest != null ? latest - oldest : null;
    const min = prices.length > 0 ? Math.min(...prices) : null;
    const max = prices.length > 0 ? Math.max(...prices) : null;
    return { count: prices.length, latest, oldest, netDelta, min, max };
  }, [previewHistoryRows]);

  const previewTrendChart = useMemo(() => {
    const rows = [...previewHistoryRows].reverse();
    const points = rows
      .map((row) => ({
        runId: row.runId,
        at: row.at,
        value: row.candidatePrice,
      }))
      .filter((row): row is { runId: string; at: string; value: number } => typeof row.value === "number" && Number.isFinite(row.value));

    const width = 560;
    const height = 72;

    if (points.length === 0) {
      return {
        width,
        height,
        points: [] as Array<{ runId: string; at: string; value: number; x: number; y: number; turning: boolean }>,
        polyline: "",
        min: null as number | null,
        max: null as number | null,
        turningCount: 0,
        firstTurning: null as { at: string; value: number } | null,
      };
    }
    const padLeft = 10;
    const padRight = 10;
    const padTop = 8;
    const padBottom = 8;
    const innerWidth = Math.max(1, width - padLeft - padRight);
    const innerHeight = Math.max(1, height - padTop - padBottom);

    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const span = Math.max(1, max - min);

    const normalized = points.map((point, index) => {
      const x = points.length <= 1
        ? padLeft + innerWidth / 2
        : padLeft + (innerWidth * index) / (points.length - 1);
      const y = padTop + ((max - point.value) / span) * innerHeight;
      return { ...point, x, y, turning: false };
    });

    const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

    for (let i = 1; i < normalized.length - 1; i += 1) {
      let prevSign = 0;
      for (let left = i - 1; left >= 0; left -= 1) {
        const delta = normalized[left + 1].value - normalized[left].value;
        const s = sign(delta);
        if (s !== 0) {
          prevSign = s;
          break;
        }
      }

      let nextSign = 0;
      for (let right = i; right < normalized.length - 1; right += 1) {
        const delta = normalized[right + 1].value - normalized[right].value;
        const s = sign(delta);
        if (s !== 0) {
          nextSign = s;
          break;
        }
      }

      if (prevSign !== 0 && nextSign !== 0 && prevSign !== nextSign) {
        normalized[i].turning = true;
      }
    }

    const turningPoints = normalized.filter((point) => point.turning);

    return {
      width,
      height,
      points: normalized,
      polyline: normalized.map((point) => `${point.x},${point.y}`).join(" "),
      min,
      max,
      turningCount: turningPoints.length,
      firstTurning: turningPoints.length > 0
        ? {
          at: turningPoints[0].at,
          value: turningPoints[0].value,
        }
        : null,
    };
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
      return shopApiSend<SyncRunCreateResponse>("/api/price-sync-runs-v2", "POST", {
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

  const latestCreateMissingProductCount = Math.max(0, Math.round(Number(createRunMutation.data?.missing_active_mapping_product_count ?? 0)));
  const latestCreateMissingRowCount = Math.max(0, Math.round(Number(createRunMutation.data?.missing_active_mapping_row_count ?? 0)));
  const latestCreateSnapshotRowsWithChannelProductCount = Math.max(
    0,
    Math.round(Number(createRunMutation.data?.snapshot_rows_with_channel_product_count ?? 0)),
  );
  const latestCreateMissingSamples = (createRunMutation.data?.missing_active_mapping_samples ?? []).slice(0, 10);

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
      {
        const previewMasterId = String(data.master_item_id ?? "").trim();
        if (previewMasterId) setEditorMasterItemIdHint(previewMasterId);
      }
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

  const togglePlatingLaborMutation = useMutation({
    mutationFn: async (includeMasterPlatingLabor: boolean) => {
      const resolvedMasterItemId = String(editorMasterItemId ?? "").trim();
      if (!effectiveChannelId) throw new Error("channel_id가 필요합니다");
      if (!resolvedMasterItemId) throw new Error("master_item_id가 없어 도금공임 설정을 저장할 수 없습니다");

      await shopApiSend<{ ok: boolean; updated?: number }>(
        "/api/channel-products/master-toggle",
        "POST",
        {
          channel_id: effectiveChannelId,
          master_item_id: resolvedMasterItemId,
          include_master_plating_labor: includeMasterPlatingLabor,
        },
      );

      const recompute = await shopApiSend<{ ok: boolean; inserted: number; compute_request_id?: string }>(
        "/api/pricing/recompute",
        "POST",
        {
          channel_id: effectiveChannelId,
          master_item_ids: [resolvedMasterItemId],
        },
      );

      const runCreatePayload: {
        channel_id: string;
        interval_minutes: number;
        trigger_type: "MANUAL";
        master_item_ids: string[];
        compute_request_id?: string;
        force_full_sync: true;
      } = {
        channel_id: effectiveChannelId,
        interval_minutes: 5,
        trigger_type: "MANUAL",
        master_item_ids: [resolvedMasterItemId],
        force_full_sync: true,
      };
      if (recompute.compute_request_id) {
        runCreatePayload.compute_request_id = recompute.compute_request_id;
      }

      const run = await shopApiSend<SyncRunCreateResponse>("/api/price-sync-runs-v2", "POST", runCreatePayload);
      const runId = String(run.run_id ?? "").trim();
      if (!runId) {
        throw new Error("Run 생성 응답에 run_id가 없습니다. 잠시 후 다시 시도해주세요");
      }

      const terminalIntentStates = new Set(["SUCCESS", "FAILED", "SKIPPED", "CANCELLED", "PARTIAL"]);
      for (let round = 0; round < 6; round += 1) {
        await shopApiSend<{ ok: boolean }>(`/api/price-sync-runs-v2/${encodeURIComponent(runId)}/execute`, "POST");
        const detail = await shopApiGet<{ data: SyncRunDetail }>(`/api/price-sync-runs-v2/${encodeURIComponent(runId)}`);
        const runStatus = String(detail.data?.run?.status ?? "").trim().toUpperCase();
        const pendingCount = (detail.data?.intents ?? []).reduce((count, intent) => {
          const state = String(intent.state ?? "").trim().toUpperCase();
          return terminalIntentStates.has(state) ? count : count + 1;
        }, 0);
        if ((runStatus && runStatus !== "RUNNING") || pendingCount <= 0) break;
      }

      return { includeMasterPlatingLabor, runId };
    },
    onSuccess: async ({ includeMasterPlatingLabor, runId }) => {
      const excludePlatingLabor = !includeMasterPlatingLabor;
      setEditorExcludePlatingLabor(excludePlatingLabor);
      setEditorPreview((prev) => (prev ? { ...prev, exclude_plating_labor: excludePlatingLabor } : prev));
      if (runId) {
        setSelectedRunId(runId);
      }
      setApplyError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pricing-snapshot-explain", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["price-sync-runs-v2", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["price-sync-run-v2"] }),
        qc.invalidateQueries({ queryKey: ["shop-dashboard-gallery", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["shop-summary", effectiveChannelId] }),
      ]);
    },
    onError: (e) => {
      const reason = e instanceof Error ? e.message : "알 수 없는 오류";
      setApplyError(`도금공임 포함 설정 반영 중 실패했습니다. ${reason}. 잠시 후 다시 시도하거나 Run 목록에서 상태를 확인해주세요.`);
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
            <Input value={editorProductNo} onChange={(e) => { const next = e.target.value; setEditorProductNo(next); setEditorMasterItemIdHint(masterIdByProductNo.get(next.trim()) ?? ""); }} placeholder="product_no 또는 product_code" />
            <Button onClick={() => { const productNo = editorProductNo.trim(); setEditorMasterItemIdHint(masterIdByProductNo.get(productNo) ?? ""); loadPreviewMutation.mutate(productNo); }} disabled={!effectiveChannelId || !editorProductNo.trim() || loadPreviewMutation.isPending}>
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {galleryItems.map((item) => (
                <button
                  key={item.groupKey}
                  type="button"
                  className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-2 text-left hover:border-[var(--primary)]"
                  onClick={() => {
                    setEditorProductNo(item.productNo);
                    setEditorMasterItemIdHint(String(item.primaryMasterId ?? "").trim() || masterIdByProductNo.get(String(item.productNo ?? "").trim()) || "");
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
        className="lg:w-[1280px] 2xl:w-[1440px]"
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

                      <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-3">
                        <div className="text-[10px] text-[var(--muted)]">판매가(쇼핑몰)</div>
                        <div className="mt-1">
                          <div className="whitespace-nowrap text-2xl font-semibold leading-none tabular-nums">{fmtKrw(editorPreview.price)}</div>
                          <div className="mt-1 grid grid-cols-1 gap-1 text-[11px] text-[var(--muted)] tabular-nums sm:grid-cols-2">
                            <div className="rounded border border-[var(--hairline)] px-2 py-1">
                              <div className="text-[10px] text-[var(--muted)]">최근 후보가격 #1</div>
                              <div className="whitespace-nowrap text-right font-medium">{fmtKrw(latestHistory?.candidatePrice)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] px-2 py-1">
                              <div className="text-[10px] text-[var(--muted)]">최근 후보가격 #2</div>
                              <div className="whitespace-nowrap text-right font-medium">{fmtKrw(previousHistory?.candidatePrice)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px]">
                          <div className="text-[var(--muted)]">소비자가</div>
                          <div className="whitespace-nowrap text-right tabular-nums">{fmtKrw(editorPreview.retailPrice)}</div>
                          <div className="text-[var(--muted)]">상태</div>
                          <div className="whitespace-nowrap text-right">{`${toDisplayKo(editorPreview.display)} / ${toSellingKo(editorPreview.selling)}`}</div>
                          <div className="text-[var(--muted)]">스냅샷 최종 타겟</div>
                          <div className="whitespace-nowrap text-right tabular-nums">{snapshotExplainRow ? fmtKrw(snapshotExplainRow.final_target_price_v2_krw ?? snapshotExplainRow.final_target_price_krw) : "-"}</div>
                        </div>
                      </div>

                      <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                        <div className="h-[72px] w-full">
                          {previewTrendChart.points.length === 0 ? (
                            <div className="grid h-full place-items-center text-[11px] text-[var(--muted)]">히스토리 없음</div>
                          ) : (
                            <svg
                              viewBox={`0 0 ${previewTrendChart.width} ${previewTrendChart.height}`}
                              className="h-full w-full"
                              role="img"
                              aria-label="가격 추이"
                            >
                              <polyline
                                points={previewTrendChart.polyline}
                                fill="none"
                                stroke="var(--primary)"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                              />
                              {previewTrendChart.points.map((point) => (
                                <circle
                                  key={point.runId}
                                  cx={point.x}
                                  cy={point.y}
                                  r={2}
                                  fill="var(--bg)"
                                  stroke="var(--primary)"
                                  strokeWidth={1}
                                />
                              ))}
                              {previewTrendChart.points.filter((point) => point.turning).map((point) => (
                                <circle
                                  key={`${point.runId}::turning`}
                                  cx={point.x}
                                  cy={point.y}
                                  r={3.5}
                                  fill="var(--primary)"
                                  stroke="white"
                                  strokeWidth={1}
                                />
                              ))}
                            </svg>
                          )}
                        </div>
                        <div className="mt-1 whitespace-nowrap text-[10px] text-[var(--muted)] tabular-nums">
                          {previewTrendChart.points.length === 0
                            ? "최저 - · 최고 -"
                            : `최저 ${fmtKrw(previewTrendChart.min)} · 최고 ${fmtKrw(previewTrendChart.max)}`}
                        </div>
                        {previewTrendChart.firstTurning ? (
                          <div className="mt-1 whitespace-nowrap text-[10px] text-[var(--muted)] tabular-nums">
                            {`첫 변곡점 ${fmtTsCompact(previewTrendChart.firstTurning.at)} · ${fmtKrw(previewTrendChart.firstTurning.value)}`}
                          </div>
                        ) : null}
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
                              <div className="flex items-center gap-2">
                                <div className="text-[11px] font-semibold">구성(스냅샷)</div>
                                <label className="flex items-center gap-1 text-[10px] font-medium text-[var(--muted)]">
                                  <input
                                    type="checkbox"
                                    className="h-3 w-3 accent-[var(--primary)]"
                                    checked={!editorExcludePlatingLabor}
                                    onChange={(e) => togglePlatingLaborMutation.mutate(e.target.checked)}
                                    disabled={!effectiveChannelId || !editorMasterItemId || togglePlatingLaborMutation.isPending}
                                  />
                                  <span className="select-none">도금공임 포함</span>
                                </label>
                              </div>
                              <div className="text-[10px] text-black tabular-nums">
                                {snapshotExplainRow
                                  ? `유효틱 ${fmt(snapshotExplainRow.effective_tick_krw_g)}원/g · ${fmtTsCompact(snapshotExplainRow.computed_at)}`
                                  : snapshotExplainQuery.isFetching
                                    ? "불러오는 중"
                                    : "-"}
                              </div>
                              </div>

                            {snapshotExplainRow ? (
                              <div className="space-y-2 rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                                <div className="overflow-hidden rounded border-2 border-black">
                                  <table className="w-full table-fixed text-[11px]">
                                    <tbody>
                                      {previewCompositionRowGroups.map((group, groupIndex) => (
                                        <Fragment key={`group-${groupIndex}`}>
                                          <tr key={`head-${groupIndex}`} className={`${group[0]?.key === "final-price" ? "border-t-4" : (group[0]?.key === "labor-cost-total" || group[0]?.key === "labor-total") ? "border-t-4" : "border-t-2"} border-black`}>
                                            {group.map((row) => (
                                              <th key={`head-${groupIndex}-${row.key}`} className={`${snapshotCellToneClass(row.key)} border-r border-black px-2 py-1 text-left font-medium text-slate-900 last:border-r-0`}>
                                                {row.label}
                                              </th>
                                            ))}
                                            {Array.from({ length: Math.max(0, 6 - group.length) }).map((_, emptyIdx) => (
                                              <th key={`head-${groupIndex}-empty-${emptyIdx}`} className="border-r border-black bg-white px-2 py-1 last:border-r-0" />
                                            ))}
                                          </tr>
                                          <tr key={`value-${groupIndex}`}>
                                            {group.map((row) => (
                                              <td key={`value-${groupIndex}-${row.key}`} className={`${snapshotCellToneClass(row.key)} border-r border-t-2 border-black px-2 py-1 text-right font-semibold tabular-nums text-slate-900 last:border-r-0`}>
                                                {row.valueText}
                                              </td>
                                            ))}
                                            {Array.from({ length: Math.max(0, 6 - group.length) }).map((_, emptyIdx) => (
                                              <td key={`value-${groupIndex}-empty-${emptyIdx}`} className="border-r border-t-2 border-black bg-white px-2 py-1 last:border-r-0" />
                                            ))}
                                          </tr>
                                        </Fragment>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-[11px] tabular-nums">
                                  <div className="mb-1 text-[10px] font-medium text-[var(--muted)]">계산 흐름</div>
                                  <div className="space-y-0.5">
                                    {previewCompositionFlowLines.map((line, idx) => (
                                      <div key={`flow-${idx}`} className="leading-5">{line}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[var(--muted)]">
                                V2 뷰에서 해당 상품 스냅샷을 찾지 못했습니다.
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
                              <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-right text-[10px] text-[var(--muted)]">
                                <div>최대 20건</div>
                                {latestCronTick ? (
                                  <div className="tabular-nums">최근 크론체크: {fmtTsCompact(latestCronTick.at)} ({latestCronTick.reason})</div>
                                ) : null}
                              </div>
                            </div>

                            {previewHistoryRows.length === 0 ? (
                              <div className="text-[11px] text-[var(--muted)]">최근 run에서 해당 상품 intent를 찾지 못했습니다.</div>
                            ) : (
                              <div className="max-h-[180px] overflow-auto rounded border border-[var(--hairline)]">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-[var(--panel)] text-left">
                                    <tr>
                                      <th className="px-2 py-1">일시</th>
                                      <th className="px-2 py-1 text-right tabular-nums">기준(스냅샷)</th>
                                      <th className="px-2 py-1 text-right tabular-nums">Push 목표</th>
                                      <th className="px-2 py-1 text-right tabular-nums">Push 전</th>
                                      <th className="px-2 py-1 text-center">선택항목</th>
                                      <th className="px-2 py-1 text-right tabular-nums">옵션평균</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewHistoryRows.map((row) => (
                                      <tr key={row.runId} className="border-t border-[var(--hairline)]">
                                        <td className="px-2 py-1 whitespace-nowrap tabular-nums">{fmtTsCompact(row.at)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.snapshotPrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.pushTargetPrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.pushBeforePrice)}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-center">{row.selectedItem}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{fmtKrw(row.variantAvg)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input value={marginMultiplier} onChange={(e) => setMarginMultiplier(e.target.value)} type="number" placeholder="margin_multiplier" />
            <Input value={roundingUnit} onChange={(e) => setRoundingUnit(e.target.value)} type="number" placeholder="rounding_unit" />
            <Select value={roundingMode} onChange={(e) => setRoundingMode(e.target.value as "CEIL" | "ROUND" | "FLOOR")}>
              <option value="CEIL">올림(CEIL)</option>
              <option value="ROUND">반올림(ROUND)</option>
              <option value="FLOOR">내림(FLOOR)</option>
            </Select>
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
            {latestCreateMissingProductCount > 0 ? (
              <div className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div>
                  최근 생성 run에서 활성 매핑 누락이 감지되었습니다: product {latestCreateMissingProductCount}건, snapshot row {latestCreateMissingRowCount}건 / 기준 row {latestCreateSnapshotRowsWithChannelProductCount}건.
                  sales_channel_product 활성 매핑을 보강한 뒤 재실행하세요.
                </div>
                {latestCreateMissingSamples.length > 0 ? (
                  <div className="mt-2 max-h-32 overflow-auto rounded border border-amber-500/40 bg-black/20 p-2 text-[11px]">
                    {latestCreateMissingSamples.map((sample) => (
                      <div key={`${sample.channel_product_id}:${sample.compute_request_id ?? "-"}`} className="truncate">
                        cp={sample.channel_product_id} / master={sample.master_item_id ?? "-"} / compute={sample.compute_request_id ?? "-"}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
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
            {activeRunMissingProductCount > 0 ? (
              <div className="mb-3 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div>
                  선택 run에서 활성 매핑 누락 감지: product {activeRunMissingProductCount}건, snapshot row {activeRunMissingRowCount}건 / 기준 row {activeRunSnapshotRowsWithChannelProductCount}건.
                </div>
                {activeRunMissingSamples.length > 0 ? (
                  <div className="mt-2 max-h-32 overflow-auto rounded border border-amber-500/40 bg-black/20 p-2 text-[11px]">
                    {activeRunMissingSamples.map((sample) => (
                      <div key={`${sample.channel_product_id}:${sample.compute_request_id ?? "-"}`} className="truncate">
                        cp={sample.channel_product_id} / master={sample.master_item_id ?? "-"} / compute={sample.compute_request_id ?? "-"}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
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
