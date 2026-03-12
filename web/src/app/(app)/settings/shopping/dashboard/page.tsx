"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { PricingSnapshotDrawer } from "@/components/shop/PricingSnapshotDrawer";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";
import { normalizePlatingComboCode, roundByRule } from "@/lib/shop/sync-rules";
import { normalizeMaterialCode } from "@/lib/material-factors";
import type { PricingSnapshotExplainResponse } from "@/types/pricingSnapshot";

type Channel = { channel_id: string; channel_name: string; channel_code: string };

type DashboardRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  external_variant_code: string | null;
  category_code: string | null;
  material_code: string | null;
  net_weight_g: number | null;
  labor_raw_krw: number | null;
  option_price_delta_krw: number | null;
  final_target_price_krw: number | null;
  current_channel_price_krw: number | null;
  diff_krw: number | null;
  diff_pct: number | null;
  price_state: "OK" | "OUT_OF_SYNC" | "ERROR" | "UNMAPPED";
  active_adjustment_count: number;
  active_override_id: string | null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL" | null;
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
  mapping_source: "MANUAL" | "CSV" | "AUTO";
  is_active: boolean;
  updated_at?: string | null;
};

type BaseAdjustmentLog = {
  adjustment_log_id: string;
  channel_id: string;
  master_item_id: string;
  delta_krw: number;
  reason: string;
  created_at: string;
};

type SummaryData = {
  channel_id: string;
  counts: {
    total: number;
    ok: number;
    out_of_sync: number;
    error: number;
    override: number;
    adjustment: number;
  };
};

type MasterRow = {
  master_item_id: string;
  model_name: string | null;
  category_code: string | null;
  material_code: string | null;
  product_no: string;
  base_current_krw: number | null;
  base_target_krw: number | null;
  base_diff_krw: number | null;
  margin_pct: number | null;
  total_weight_g: number | null;
  total_labor_krw: number | null;
  final_price_krw: number | null;
  master_original_krw: number | null;
  price_state: DashboardRow["price_state"];
  include_master_plating_labor: boolean;
  option_count: number;
  latest_updated_at: string | null;
};

type MasterMetaRow = {
  master_id?: string | null;
  master_item_id?: string | null;
  image_url: string | null;
  material_code_default?: string | null;
};

type VariantMetaRow = {
  variant_code: string;
  option_label: string;
  options?: Array<{ name: string; value: string }>;
};

type OptionEditDraft = {
  option_price_mode: "SYNC" | "MANUAL";
  sync_rule_set_id: string;
  option_material_code: string;
  option_color_code: string;
  option_decoration_code: string;
  option_size_value: string;
  option_price_delta_krw: string;
  option_manual_target_krw: string;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
};

type OptionRuleCategory = "SIZE_RULE" | "PLATING_RULE" | "DECORATION_RULE" | "MISC_OVERRIDE";

type OptionValueItem = {
  axis: string;
  value: string;
  variant_codes: string[];
};

type OptionAxisGroup = {
  axis: string;
  values: OptionValueItem[];
};

type OptionValuePolicyRow = {
  policy_id: string;
  channel_id: string;
  master_item_id: string;
  axis_key: string;
  axis_value: string;
  axis_mode: "SYNC" | "OVERRIDE";
  rule_type: SyncRuleType;
  value_mode: CategoryValueMode;
  sync_rule_set_id: string | null;
  selected_rule_id: string | null;
  manual_delta_krw: number;
  created_at: string;
  updated_at: string;
};

type CategoryValueMode = "BASE" | "SYNC";

type AxisValueDraft = {
  mode: CategoryValueMode;
  ruleId: string;
  deltaKrw: string;
};

type AxisPolicyDraft = {
  mode: "OVERRIDE" | "SYNC";
  ruleType: SyncRuleType;
  values: Record<string, AxisValueDraft>;
};

type SyncPreviewResult = {
  total_candidates: number;
  affected: number;
  blocked: number;
  matched_sample_count: number;
  unmatched_sample_count: number;
  matched_samples: Array<{
    channel_product_id: string;
    total_delta_krw: number;
    r1_delta_krw: number;
    r2_delta_krw: number;
    r3_delta_krw: number;
    r4_delta_krw?: number;
  }>;
  unmatched_samples: Array<{
    channel_product_id: string;
    missing_rules: string[];
    total_delta_krw?: number;
    r1_delta_krw?: number;
    r2_delta_krw?: number;
    r3_delta_krw?: number;
    r4_delta_krw?: number;
  }>;
};

type SyncRuleType = "R1" | "R2" | "R3" | "R4";

type R1RuleRow = { rule_id: string; target_material_code: string; source_material_code?: string | null };
type R2RuleRow = {
  rule_id: string;
  option_range_expr: string;
  match_material_code?: string | null;
  match_category_code?: string | null;
  weight_min_g: number;
  weight_max_g: number;
  margin_min_krw?: number | null;
  margin_max_krw?: number | null;
  delta_krw?: number | null;
  rounding_unit?: number | null;
  rounding_mode?: "CEIL" | "ROUND" | "FLOOR" | null;
};
type R3RuleRow = {
  rule_id: string;
  color_code: string;
  margin_min_krw: number;
  margin_max_krw: number;
  delta_krw?: number | null;
  rounding_unit?: number | null;
  rounding_mode?: "CEIL" | "ROUND" | "FLOOR" | null;
};
type R4RuleRow = {
  rule_id: string;
  match_decoration_code: string;
  delta_krw?: number | null;
  rounding_unit?: number | null;
  rounding_mode?: "CEIL" | "ROUND" | "FLOOR" | null;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");
const signedFmt = (amount: number) => `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${fmt(Math.abs(amount))}`;
const roundToThousand = (v: number) => Math.round(v / 1000) * 1000;
const thousandDeltaOptions = (() => {
  const positives: number[] = [];
  const negatives: number[] = [];
  for (let v = 1000; v <= 1000000; v += 1000) positives.push(v);
  for (let v = -1000; v >= -1000000; v -= 1000) negatives.push(v);
  return [0, ...positives, ...negatives];
})();
const deltaOptionLabel = (value: number) => (value === 0 ? "0원" : `${value.toLocaleString()}원`);

const getOptionRuleCategory = (draft: OptionEditDraft): OptionRuleCategory => {
  if (draft.option_price_mode === "MANUAL") return "MISC_OVERRIDE";
  if (draft.sync_rule_weight_enabled && !draft.sync_rule_plating_enabled && !draft.sync_rule_decoration_enabled) return "SIZE_RULE";
  if (!draft.sync_rule_weight_enabled && draft.sync_rule_plating_enabled && !draft.sync_rule_decoration_enabled) return "PLATING_RULE";
  if (!draft.sync_rule_weight_enabled && !draft.sync_rule_plating_enabled && draft.sync_rule_decoration_enabled) return "DECORATION_RULE";
  return "MISC_OVERRIDE";
};

const applyOptionRuleCategory = (draft: OptionEditDraft, category: OptionRuleCategory): OptionEditDraft => {
  if (category === "SIZE_RULE") {
    return {
      ...draft,
      option_price_mode: "SYNC",
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: false,
    };
  }
  if (category === "PLATING_RULE") {
    return {
      ...draft,
      option_price_mode: "SYNC",
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: false,
    };
  }
  if (category === "DECORATION_RULE") {
    return {
      ...draft,
      option_price_mode: "SYNC",
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: true,
    };
  }
  return {
    ...draft,
    option_price_mode: "MANUAL",
    sync_rule_weight_enabled: false,
    sync_rule_plating_enabled: false,
    sync_rule_decoration_enabled: false,
  };
};
const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "-";
  return new Date(t).toLocaleString();
};

const roundingModeKo = (mode: "CEIL" | "ROUND" | "FLOOR" | null | undefined) => {
  if (mode === "CEIL") return "올림";
  if (mode === "FLOOR") return "내림";
  return "반올림";
};

const guessRuleByAxis = (axis: string): "R1" | "R2" | "R3" | "R4" => {
  const axisName = axis.toLowerCase();
  if (axisName.includes("소재") || axisName.includes("material")) return "R1";
  if (axisName.includes("사이즈") || axisName.includes("size")) return "R2";
  if (axisName.includes("색") || axisName.includes("color")) return "R3";
  if (axisName.includes("장식") || axisName.includes("decoration")) return "R4";
  return "R2";
};

const isMaterialAxisName = (axis: string) => {
  const name = axis.toLowerCase();
  return name.includes("소재") || name.includes("material") || name.includes("골드") || name.includes("gold") || name.includes("karat");
};

const isSizeAxisName = (axis: string) => {
  const name = axis.toLowerCase();
  return name.includes("사이즈") || name.includes("size") || name.includes("중량") || name.includes("weight");
};

const isColorAxisName = (axis: string) => {
  const name = axis.toLowerCase();
  return name.includes("색") || name.includes("color") || name.includes("도금") || name.includes("plating");
};

const isDecorationAxisName = (axis: string) => {
  const name = axis.toLowerCase();
  return name.includes("장식") || name.includes("decoration");
};

const stripPriceDeltaSuffix = (text: string) =>
  String(text ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

const normalizeOptionDisplayValue = (axis: string, value: string): string => {
  const base = stripPriceDeltaSuffix(value);
  if (!base) return "";
  if (isMaterialAxisName(axis)) {
    const code = normalizeMaterialCode(base);
    return code || base;
  }
  if (isColorAxisName(axis)) {
    const code = normalizePlatingComboCode(base);
    return code || base;
  }
  if (isSizeAxisName(axis)) {
    const numeric = Number(base.replace(/[^0-9.+-]/g, ""));
    if (Number.isFinite(numeric)) return Number.isInteger(numeric) ? String(numeric) : String(numeric);
    return base;
  }
  if (isDecorationAxisName(axis)) {
    return base.toUpperCase();
  }
  return base;
};

const allowedRuleTypesForAxis = (axis: string): SyncRuleType[] => {
  if (isMaterialAxisName(axis)) return ["R2", "R3", "R4"];
  if (isSizeAxisName(axis)) return ["R2", "R3", "R4"];
  if (isColorAxisName(axis)) return ["R2", "R3", "R4"];
  if (isDecorationAxisName(axis)) return ["R2", "R3", "R4"];
  return ["R2", "R3", "R4"];
};

const normalizeRuleTypeForAxis = (axis: string, ruleType: SyncRuleType): SyncRuleType => {
  const allowed = allowedRuleTypesForAxis(axis);
  return allowed.includes(ruleType) ? ruleType : allowed[0] ?? "R2";
};

const ruleTypeLabel = (ruleType: SyncRuleType) => {
  if (ruleType === "R1") return "R1(비활성)";
  if (ruleType === "R2") return "R2 사이즈/중량";
  if (ruleType === "R3") return "R3 색상도금마진";
  return "R4 장식";
};

const normalizeMaterialToken = (value: string) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/K/g, "");

const resolveR1RuleForValue = (
  rules: R1RuleRow[],
  optionValue: string,
  baseValue?: string,
) => {
  const target = normalizeMaterialToken(optionValue);
  if (!target) return null;
  const base = normalizeMaterialToken(baseValue ?? "");
  if (!base) return null;
  const strict = rules.find((r) => {
    const src = normalizeMaterialToken(String(r.source_material_code ?? ""));
    const tgt = normalizeMaterialToken(String(r.target_material_code ?? ""));
    return Boolean(src) && src === base && tgt === target;
  });
  return strict ?? null;
};

const optionStrategyLabel = (m: MappingRow): string => {
  if (m.option_price_mode === "MANUAL") return "Override";
  const activeRules: string[] = [];
  if (m.sync_rule_weight_enabled) activeRules.push("R2");
  if (m.sync_rule_plating_enabled) activeRules.push("R3");
  if (m.sync_rule_decoration_enabled) activeRules.push("R4");
  return activeRules.length > 0 ? `Sync(${activeRules.join("/")})` : "Sync(룰없음)";
};

const toStateKo = (value: DashboardRow["price_state"]) => {
  if (value === "OK") return "정상";
  if (value === "OUT_OF_SYNC") return "불일치";
  if (value === "ERROR") return "오류";
  return "미매핑";
};

export default function ShoppingDashboardPage() {
  const qc = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  const activeChannelId = channelId || channels[0]?.channel_id || "";

  const [priceState, setPriceState] = useState("");
  const [modelName, setModelName] = useState("");
  const [selectedMasters, setSelectedMasters] = useState<Record<string, boolean>>({});
  const [detailMasterId, setDetailMasterId] = useState("");
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [baseDeltaAmount, setBaseDeltaAmount] = useState("");
  const [baseDeltaReason, setBaseDeltaReason] = useState("");
  const [editingBaseLogId, setEditingBaseLogId] = useState<string | null>(null);
  const [editingBaseLogDelta, setEditingBaseLogDelta] = useState("");
  const [editingBaseLogReason, setEditingBaseLogReason] = useState("");
  const [editingChannelProductId, setEditingChannelProductId] = useState<string | null>(null);
  const [optionEditDraft, setOptionEditDraft] = useState<OptionEditDraft | null>(null);
  const [optionEditOriginalDelta, setOptionEditOriginalDelta] = useState<number>(0);
  const [isBulkPolicyDrawerOpen, setIsBulkPolicyDrawerOpen] = useState(false);
  const [dashboardViewTab, setDashboardViewTab] = useState<"MASTER_GALLERY" | "OPTION_GROUPS">("MASTER_GALLERY");
  const [optionGroupFilterMode, setOptionGroupFilterMode] = useState<"SINGLE" | "AND" | "OR">("SINGLE");
  const [optionGroupPriceBasis, setOptionGroupPriceBasis] = useState<"TOTAL" | "RULE">("RULE");
  const [optionGroupSelections, setOptionGroupSelections] = useState<Record<string, string[]>>({});
  const [optionGroupSelectedBuckets, setOptionGroupSelectedBuckets] = useState<number[]>([]);
  const [optionGroupSearch, setOptionGroupSearch] = useState("");
  const [bulkGlobalRuleSetId, setBulkGlobalRuleSetId] = useState("");
  const [axisPolicyDrafts, setAxisPolicyDrafts] = useState<Record<string, AxisPolicyDraft>>({});
  const [syncPreview, setSyncPreview] = useState<SyncPreviewResult | null>(null);
  const [pinnedComputeRequestId, setPinnedComputeRequestId] = useState("");
  const [isSnapshotDrawerOpen, setIsSnapshotDrawerOpen] = useState(false);
  const [selectedMasterIdForDrawer, setSelectedMasterIdForDrawer] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["shop-dashboard", activeChannelId, priceState, modelName, pinnedComputeRequestId],
    enabled: Boolean(activeChannelId),
    placeholderData: (prev) => prev,
    queryFn: () => {
      const query = new URLSearchParams();
      query.set("channel_id", activeChannelId);
      query.set("include_unmapped", "false");
      query.set("limit", "1000");
      if (pinnedComputeRequestId) query.set("compute_request_id", pinnedComputeRequestId);
      if (priceState) query.set("price_state", priceState);
      if (modelName.trim()) query.set("model_name", modelName.trim());
      return shopApiGet<{ data: DashboardRow[] }>(`/api/channel-price-dashboard?${query.toString()}`);
    },
  });

  const mappingQuery = useQuery({
    queryKey: ["shop-mappings", activeChannelId],
    enabled: Boolean(activeChannelId),
    placeholderData: (prev) => prev,
    queryFn: () => shopApiGet<{ data: MappingRow[] }>(`/api/channel-products?channel_id=${encodeURIComponent(activeChannelId)}`),
  });

  const syncRuleSetQuery = useQuery({
    queryKey: ["shop-sync-rule-sets", activeChannelId],
    enabled: Boolean(activeChannelId),
    queryFn: () => shopApiGet<{ data: Array<{ rule_set_id: string; name: string }> }>(`/api/sync-rule-sets?channel_id=${encodeURIComponent(activeChannelId)}&only_active=true`),
  });

  const r1RulesQuery = useQuery({
    queryKey: ["sync-r1-rules", bulkGlobalRuleSetId],
    enabled: Boolean(bulkGlobalRuleSetId),
    queryFn: () => shopApiGet<{ data: R1RuleRow[] }>(`/api/sync-rules/r1?rule_set_id=${encodeURIComponent(bulkGlobalRuleSetId)}`),
  });
  const r2RulesQuery = useQuery({
    queryKey: ["sync-r2-rules", bulkGlobalRuleSetId],
    enabled: Boolean(bulkGlobalRuleSetId),
    queryFn: () => shopApiGet<{ data: R2RuleRow[] }>(`/api/sync-rules/r2?rule_set_id=${encodeURIComponent(bulkGlobalRuleSetId)}`),
  });
  const r3RulesQuery = useQuery({
    queryKey: ["sync-r3-rules", bulkGlobalRuleSetId],
    enabled: Boolean(bulkGlobalRuleSetId),
    queryFn: () => shopApiGet<{ data: R3RuleRow[] }>(`/api/sync-rules/r3?rule_set_id=${encodeURIComponent(bulkGlobalRuleSetId)}`),
  });
  const r4RulesQuery = useQuery({
    queryKey: ["sync-r4-rules", bulkGlobalRuleSetId],
    enabled: Boolean(bulkGlobalRuleSetId),
    queryFn: () => shopApiGet<{ data: R4RuleRow[] }>(`/api/sync-rules/r4?rule_set_id=${encodeURIComponent(bulkGlobalRuleSetId)}`),
  });

  const summaryQuery = useQuery({
    queryKey: ["shop-dashboard-summary", activeChannelId],
    enabled: Boolean(activeChannelId),
    queryFn: () => shopApiGet<{ data: SummaryData }>(`/api/channel-price-summary?channel_id=${encodeURIComponent(activeChannelId)}`),
  });

  const baseAdjustAllQuery = useQuery({
    queryKey: ["shop-base-adjust-all", activeChannelId],
    enabled: Boolean(activeChannelId),
    queryFn: () =>
      shopApiGet<{ data: BaseAdjustmentLog[] }>(
        `/api/channel-base-price-adjustments?channel_id=${encodeURIComponent(activeChannelId)}&limit=500`,
      ),
  });

  const rows = dashboardQuery.data?.data ?? [];
  const mappings = mappingQuery.data?.data ?? [];
  const baseAdjustLogsAll = baseAdjustAllQuery.data?.data ?? [];

  const baseDeltaByMaster = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of baseAdjustLogsAll) {
      const masterId = String(row.master_item_id ?? "").trim();
      if (!masterId) continue;
      const prev = map.get(masterId) ?? 0;
      map.set(masterId, prev + Number(row.delta_krw ?? 0));
    }
    return map;
  }, [baseAdjustLogsAll]);

  const rowsByChannelProduct = useMemo(() => {
    const map = new Map<string, DashboardRow>();
    for (const row of rows) map.set(row.channel_product_id, row);
    return map;
  }, [rows]);

  const masterRows = useMemo<MasterRow[]>(() => {
    const grouped = new Map<string, MappingRow[]>();
    for (const m of mappings) {
      const key = m.master_item_id;
      const prev = grouped.get(key) ?? [];
      prev.push(m);
      grouped.set(key, prev);
    }

    const out: MasterRow[] = [];
    for (const [masterId, group] of grouped.entries()) {
      const rowsForMaster = group
        .map((m) => rowsByChannelProduct.get(m.channel_product_id))
        .filter((r): r is DashboardRow => Boolean(r));
      const optionRows = rowsForMaster.filter((r) => String(r.external_variant_code ?? "").trim().length > 0);
      const baseCandidate = rowsForMaster.find((r) => !String(r.external_variant_code ?? "").trim());
      const firstWithTarget = rowsForMaster.find((r) => typeof r.final_target_price_krw === "number" && Number.isFinite(r.final_target_price_krw));
      const baseRow = baseCandidate ?? firstWithTarget ?? rowsForMaster[0] ?? null;
      if (!baseRow) continue;

      const marginPct =
        typeof baseRow.current_channel_price_krw === "number"
        && baseRow.current_channel_price_krw > 0
        && typeof baseRow.final_target_price_krw === "number"
        && baseRow.final_target_price_krw > 0
        ? (baseRow.current_channel_price_krw / baseRow.final_target_price_krw) * 100
        : null;

      let latestUpdatedAt: string | null = null;
      let latestTime = -1;
      for (const mapping of group) {
        const raw = mapping.updated_at ?? null;
        if (!raw) continue;
        const t = Date.parse(raw);
        if (Number.isFinite(t) && t > latestTime) {
          latestTime = t;
          latestUpdatedAt = raw;
        }
      }

      out.push({
        master_item_id: masterId,
        model_name: baseRow.model_name,
        category_code: baseRow.category_code,
        material_code: baseRow.material_code,
        product_no: baseRow.external_product_no,
        base_current_krw: baseRow.current_channel_price_krw,
        base_target_krw: baseRow.final_target_price_krw,
        base_diff_krw: baseRow.diff_krw,
        margin_pct: marginPct,
        total_weight_g: baseRow.net_weight_g,
        total_labor_krw: baseRow.labor_raw_krw,
        final_price_krw: baseRow.final_target_price_krw,
        master_original_krw:
          typeof baseRow.final_target_price_krw === "number"
            ? baseRow.final_target_price_krw - (baseDeltaByMaster.get(masterId) ?? 0)
            : null,
        price_state: baseRow.price_state,
        include_master_plating_labor: group.every((m) => m.include_master_plating_labor !== false),
        option_count: optionRows.length,
        latest_updated_at: latestUpdatedAt,
      });
    }

    const dedupByProductNo = new Map<string, MasterRow>();
    for (const row of out) {
      const key = String(row.product_no ?? "").trim() || `__master__${row.master_item_id}`;
      const prev = dedupByProductNo.get(key);
      if (!prev) {
        dedupByProductNo.set(key, row);
        continue;
      }
      const prevTime = Date.parse(String(prev.latest_updated_at ?? ""));
      const rowTime = Date.parse(String(row.latest_updated_at ?? ""));
      const prevScore = (Number.isFinite(prevTime) ? prevTime : -1) + (prev.option_count * 1000);
      const rowScore = (Number.isFinite(rowTime) ? rowTime : -1) + (row.option_count * 1000);
      if (rowScore > prevScore) dedupByProductNo.set(key, row);
    }

    return Array.from(dedupByProductNo.values()).sort((a, b) => {
      const am = a.model_name ?? "";
      const bm = b.model_name ?? "";
      return am.localeCompare(bm) || a.master_item_id.localeCompare(b.master_item_id);
    });
  }, [mappings, rowsByChannelProduct, baseDeltaByMaster]);

  const effectiveDetailMasterId = useMemo(() => {
    if (detailMasterId && masterRows.some((m) => m.master_item_id === detailMasterId)) return detailMasterId;
    return masterRows[0]?.master_item_id ?? "";
  }, [detailMasterId, masterRows]);

  const detailMappings = useMemo(
    () => mappings.filter((m) => m.master_item_id === effectiveDetailMasterId),
    [mappings, effectiveDetailMasterId],
  );

  const detailMasterRow = useMemo(
    () => masterRows.find((m) => m.master_item_id === effectiveDetailMasterId) ?? null,
    [masterRows, effectiveDetailMasterId],
  );

  const selectedMasterIds = useMemo(
    () => masterRows.filter((r) => selectedMasters[r.master_item_id]).map((r) => r.master_item_id),
    [masterRows, selectedMasters],
  );

  const detailBaseDeltaTotal = useMemo(() => {
    if (!effectiveDetailMasterId) return 0;
    return baseDeltaByMaster.get(effectiveDetailMasterId) ?? 0;
  }, [baseDeltaByMaster, effectiveDetailMasterId]);

  const detailMasterOriginal = detailMasterRow?.master_original_krw ?? null;
  const detailFinalTarget = detailMasterRow?.final_price_krw ?? null;
  const detailOptionBaseTargetKrw = useMemo(() => {
    const base = Number(detailMasterRow?.base_target_krw ?? detailMasterRow?.final_price_krw ?? 0);
    return Number.isFinite(base) ? Math.round(base) : 0;
  }, [detailMasterRow?.base_target_krw, detailMasterRow?.final_price_krw]);
  const detailTitle = detailMasterRow?.model_name || `마스터 ${effectiveDetailMasterId || "-"}`;

  const selectedChannelProductIds = useMemo(() => {
    if (selectedMasterIds.length === 0) return [] as string[];
    const idSet = new Set(selectedMasterIds);
    return mappings
      .filter((m) => idSet.has(m.master_item_id))
      .map((m) => m.channel_product_id);
  }, [mappings, selectedMasterIds]);

  const masterMetaQuery = useQuery({
    queryKey: ["shop-dashboard-master-meta", activeChannelId, masterRows.map((m) => m.master_item_id).join(",")],
    enabled: Boolean(activeChannelId && masterRows.length > 0),
    queryFn: () => {
      const ids = masterRows.map((m) => m.master_item_id).filter(Boolean).join(",");
      return shopApiGet<{ data: MasterMetaRow[] }>(`/api/master-items?master_ids=${encodeURIComponent(ids)}`);
    },
  });

  const masterImageById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of masterMetaQuery.data?.data ?? []) {
      const key = String(row.master_item_id ?? row.master_id ?? "").trim();
      if (!key) continue;
      map.set(key, row.image_url ?? null);
    }
    return map;
  }, [masterMetaQuery.data?.data]);

  const masterMaterialCodeById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of masterMetaQuery.data?.data ?? []) {
      const key = String(row.master_item_id ?? row.master_id ?? "").trim();
      if (!key) continue;
      map.set(key, row.material_code_default ?? null);
    }
    return map;
  }, [masterMetaQuery.data?.data]);

  const detailImageUrl = effectiveDetailMasterId ? (masterImageById.get(effectiveDetailMasterId) ?? null) : null;
  const detailMasterMaterialCode = useMemo(() => {
    if (!effectiveDetailMasterId) return null;
    return detailMasterRow?.material_code ?? masterMaterialCodeById.get(effectiveDetailMasterId) ?? null;
  }, [detailMasterRow?.material_code, effectiveDetailMasterId, masterMaterialCodeById]);

  const detailProductNo = useMemo(() => {
    const fromMaster = String(masterRows.find((m) => m.master_item_id === effectiveDetailMasterId)?.product_no ?? "").trim();
    if (fromMaster) return fromMaster;
    const fromMapping = String(detailMappings[0]?.external_product_no ?? "").trim();
    return fromMapping;
  }, [detailMappings, effectiveDetailMasterId, masterRows]);

  const detailOptionMappings = useMemo(() => {
    const pickBetter = (prev: MappingRow | undefined, next: MappingRow): MappingRow => {
      if (!prev) return next;
      const score = (row: MappingRow): number => {
        const productNo = String(row.external_product_no ?? "").trim();
        const hasOptionIdentity = Boolean(
          (row.option_material_code && String(row.option_material_code).trim())
          || (row.option_color_code && String(row.option_color_code).trim())
          || (row.option_decoration_code && String(row.option_decoration_code).trim())
          || (row.option_size_value !== null && row.option_size_value !== undefined),
        );
        const allOptionIdentityMissing = !hasOptionIdentity;
        const looksCanonicalCode = /^P/i.test(productNo);
        const looksNumericOnly = /^\d+$/.test(productNo);
        let s = 0;
        if (detailProductNo && productNo === detailProductNo) s += 100;
        if (looksCanonicalCode) s += 50;
        if (hasOptionIdentity) s += 20;
        if (allOptionIdentityMissing) s -= 20;
        if (looksNumericOnly) s -= 10;
        const updated = Date.parse(String(row.updated_at ?? ""));
        if (Number.isFinite(updated)) s += Math.floor(updated / 10000000);
        return s;
      };
      const nextScore = score(next);
      const prevScore = score(prev);
      if (nextScore > prevScore) return next;
      if (prevScore > nextScore) return prev;
      const prevUpdated = Date.parse(String(prev.updated_at ?? ""));
      const nextUpdated = Date.parse(String(next.updated_at ?? ""));
      if (Number.isFinite(prevUpdated) && Number.isFinite(nextUpdated)) {
        return nextUpdated >= prevUpdated ? next : prev;
      }
      return next;
    };

    const out = new Map<string, MappingRow>();
    for (const row of detailMappings) {
      const variantCode = String(row.external_variant_code ?? "").trim();
      if (!variantCode) continue;
      const prev = out.get(variantCode);
      out.set(variantCode, pickBetter(prev, row));
    }
    return Array.from(out.values()).sort((a, b) => String(a.external_variant_code ?? "").localeCompare(String(b.external_variant_code ?? "")));
  }, [detailMappings, detailProductNo]);

  const optionRulePreviewRuleSetId = useMemo(() => (
    String(bulkGlobalRuleSetId ?? "").trim()
    || detailOptionMappings.find((m) => String(m.sync_rule_set_id ?? "").trim())?.sync_rule_set_id
    || syncRuleSetQuery.data?.data?.[0]?.rule_set_id
    || ""
  ), [bulkGlobalRuleSetId, detailOptionMappings, syncRuleSetQuery.data?.data]);

  const optionRuleBreakdownQuery = useQuery({
    queryKey: [
      "shop-sync-rule-breakdown",
      activeChannelId,
      effectiveDetailMasterId,
      optionRulePreviewRuleSetId,
      detailOptionMappings.map((m) => String(m.channel_product_id ?? "")).join("|"),
    ],
    enabled: Boolean(activeChannelId && effectiveDetailMasterId && detailOptionMappings.length > 0),
    queryFn: async () => {
      const out = new Map<string, { total_delta_krw: number; r1_delta_krw: number; r2_delta_krw: number; r3_delta_krw: number; r4_delta_krw: number }>();
      await Promise.all(detailOptionMappings.map(async (m) => {
        const channelProductId = String(m.channel_product_id ?? "").trim();
        const ruleSetId = String(
          m.sync_rule_set_id
          || optionRulePreviewRuleSetId
          || "",
        ).trim();
        if (!channelProductId || !ruleSetId) return;
        try {
          const res = await shopApiSend<{ data: SyncPreviewResult }>("/api/sync-rules/preview", "POST", {
            channel_id: activeChannelId,
            rule_set_id: ruleSetId,
            channel_product_id: channelProductId,
            sample_limit: 1,
          });
          const sample =
            res.data.matched_samples.find((s) => s.channel_product_id === channelProductId)
            ?? res.data.unmatched_samples.find((s) => s.channel_product_id === channelProductId);
          if (!sample) return;
          out.set(channelProductId, {
            total_delta_krw: Math.round(Number(sample.total_delta_krw ?? 0)),
            r1_delta_krw: Math.round(Number(sample.r1_delta_krw ?? 0)),
            r2_delta_krw: Math.round(Number(sample.r2_delta_krw ?? 0)),
            r3_delta_krw: Math.round(Number(sample.r3_delta_krw ?? 0)),
            r4_delta_krw: Math.round(Number(sample.r4_delta_krw ?? 0)),
          });
        } catch {
          // Keep UI resilient when partial preview calls fail.
        }
      }));
      return out;
    },
  });
  const optionRuleBreakdownByProduct = optionRuleBreakdownQuery.data ?? new Map<string, {
    total_delta_krw: number;
    r1_delta_krw: number;
    r2_delta_krw: number;
    r3_delta_krw: number;
    r4_delta_krw: number;
  }>();

  const optionGroupPoliciesQuery = useQuery({
    queryKey: ["shop-option-value-policies", activeChannelId, effectiveDetailMasterId],
    enabled: Boolean(activeChannelId && effectiveDetailMasterId),
    queryFn: () =>
      shopApiGet<{ data: OptionValuePolicyRow[] }>(
        `/api/channel-option-value-policies?channel_id=${encodeURIComponent(activeChannelId)}&master_item_id=${encodeURIComponent(effectiveDetailMasterId)}`,
      ),
  });

  const optionGroupPersistedPolicies = optionGroupPoliciesQuery.data?.data ?? [];
  const snapshotDrawerMasterId = selectedMasterIdForDrawer || effectiveDetailMasterId;
  const snapshotDrawerMasterRow = useMemo(
    () => masterRows.find((m) => m.master_item_id === snapshotDrawerMasterId) ?? null,
    [masterRows, snapshotDrawerMasterId],
  );
  const snapshotDrawerMappings = useMemo(
    () => mappings.filter((m) => m.master_item_id === snapshotDrawerMasterId),
    [mappings, snapshotDrawerMasterId],
  );
  const snapshotDrawerChannelProductId = useMemo(() => {
    const base = snapshotDrawerMappings.find((m) => !String(m.external_variant_code ?? "").trim());
    return String((base ?? snapshotDrawerMappings[0])?.channel_product_id ?? "").trim();
  }, [snapshotDrawerMappings]);
  const snapshotCurrentChannelPriceKrw = snapshotDrawerMasterRow?.base_current_krw ?? null;
  const snapshotExplainQuery = useQuery({
    queryKey: ["shop-snapshot-explain", activeChannelId, snapshotDrawerMasterId, snapshotDrawerChannelProductId, isSnapshotDrawerOpen],
    enabled: Boolean(
      isSnapshotDrawerOpen
      && activeChannelId
      && snapshotDrawerMasterId,
    ),
    queryFn: () => {
      const query = new URLSearchParams();
      query.set("channel_id", activeChannelId);
      query.set("master_item_id", snapshotDrawerMasterId);
      if (snapshotDrawerChannelProductId) query.set("channel_product_id", snapshotDrawerChannelProductId);
      return shopApiGet<PricingSnapshotExplainResponse>(`/api/channel-price-snapshot-explain?${query.toString()}`);
    },
  });
  const optionGroupRuleSetId = useMemo(() => {
    const fromPolicy = optionGroupPersistedPolicies.find((p) => String(p.sync_rule_set_id ?? "").trim())?.sync_rule_set_id ?? "";
    return (
      fromPolicy
      || detailOptionMappings.find((m) => String(m.sync_rule_set_id ?? "").trim())?.sync_rule_set_id
      || syncRuleSetQuery.data?.data?.[0]?.rule_set_id
      || ""
    );
  }, [detailOptionMappings, optionGroupPersistedPolicies, syncRuleSetQuery.data?.data]);

  const optionGroupR2RulesQuery = useQuery({
    queryKey: ["sync-r2-rules", optionGroupRuleSetId, "option-groups"],
    enabled: Boolean(optionGroupRuleSetId),
    queryFn: () => shopApiGet<{ data: R2RuleRow[] }>(`/api/sync-rules/r2?rule_set_id=${encodeURIComponent(optionGroupRuleSetId)}`),
  });
  const optionGroupR3RulesQuery = useQuery({
    queryKey: ["sync-r3-rules", optionGroupRuleSetId, "option-groups"],
    enabled: Boolean(optionGroupRuleSetId),
    queryFn: () => shopApiGet<{ data: R3RuleRow[] }>(`/api/sync-rules/r3?rule_set_id=${encodeURIComponent(optionGroupRuleSetId)}`),
  });
  const optionGroupR4RulesQuery = useQuery({
    queryKey: ["sync-r4-rules", optionGroupRuleSetId, "option-groups"],
    enabled: Boolean(optionGroupRuleSetId),
    queryFn: () => shopApiGet<{ data: R4RuleRow[] }>(`/api/sync-rules/r4?rule_set_id=${encodeURIComponent(optionGroupRuleSetId)}`),
  });

  const variantMetaQuery = useQuery({
    queryKey: ["shop-dashboard-variant-meta", activeChannelId, effectiveDetailMasterId, detailProductNo],
    enabled: Boolean(activeChannelId && effectiveDetailMasterId && detailProductNo),
    queryFn: () =>
      shopApiGet<{ data: { variants: VariantMetaRow[] } }>(
        `/api/channel-products/variants?channel_id=${encodeURIComponent(activeChannelId)}&external_product_no=${encodeURIComponent(detailProductNo)}`,
      ),
  });

  const variantOptionsByCode = useMemo(() => {
    const map = new Map<string, Array<{ name: string; value: string }>>();
    for (const v of variantMetaQuery.data?.data?.variants ?? []) {
      const code = String(v.variant_code ?? "").trim();
      if (!code) continue;
      const opts = Array.isArray(v.options) ? v.options : [];
      const normalized = opts
        .map((o) => {
          const name = String(o.name ?? "").trim();
          const value = stripPriceDeltaSuffix(String(o.value ?? "").trim());
          return { name, value };
        })
        .filter((o) => o.name && o.value);
      map.set(code, Array.from(new Map(normalized.map((o) => [`${o.name}::${o.value}`, o])).values()));
    }
    return map;
  }, [variantMetaQuery.data?.data?.variants]);

  const detailMappingByVariantCode = useMemo(() => {
    const out = new Map<string, MappingRow>();
    for (const m of detailOptionMappings) {
      const variantCode = String(m.external_variant_code ?? "").trim();
      if (!variantCode) continue;
      out.set(variantCode, m);
    }
    return out;
  }, [detailOptionMappings]);

  const detailVariantRowsForTable = useMemo(() => {
    const codes = new Set<string>();
    for (const v of variantMetaQuery.data?.data?.variants ?? []) {
      const code = String(v.variant_code ?? "").trim();
      if (code) codes.add(code);
    }
    for (const m of detailOptionMappings) {
      const code = String(m.external_variant_code ?? "").trim();
      if (code) codes.add(code);
    }
    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((variantCode) => {
        const mapping = detailMappingByVariantCode.get(variantCode) ?? null;
        const row = mapping ? rowsByChannelProduct.get(mapping.channel_product_id) : undefined;
        const useRuleBreakdown = Boolean(
          mapping
          && (
            mapping.sync_rule_weight_enabled === true
            || mapping.sync_rule_plating_enabled === true
            || mapping.sync_rule_decoration_enabled === true
          ),
        );
        const breakdown = useRuleBreakdown && mapping
          ? optionRuleBreakdownByProduct.get(String(mapping.channel_product_id))
          : undefined;
        return { variantCode, mapping, row, breakdown };
      });
  }, [detailMappingByVariantCode, detailOptionMappings, optionRuleBreakdownByProduct, rowsByChannelProduct, variantMetaQuery.data?.data?.variants]);

  const optionValueItems = useMemo<OptionValueItem[]>(() => {
    const toSizeLabel = (sizeValue: number | null): string => {
      if (sizeValue == null || !Number.isFinite(sizeValue)) return "";
      const n = Number(sizeValue);
      return Number.isInteger(n) ? String(n) : String(n);
    };

    const fallbackOptions = (m: MappingRow): Array<{ name: string; value: string }> => {
      const options: Array<{ name: string; value: string }> = [];
      const materialRaw = String(m.option_material_code ?? "").trim();
      const colorRaw = String(m.option_color_code ?? "").trim();
      const decorationRaw = String(m.option_decoration_code ?? "").trim();
      const sizeRaw = toSizeLabel(m.option_size_value ?? null).trim();
      const material = normalizeOptionDisplayValue("소재", materialRaw);
      const color = normalizeOptionDisplayValue("색상/도금", colorRaw);
      const decoration = normalizeOptionDisplayValue("장식", decorationRaw);
      const size = normalizeOptionDisplayValue("사이즈", sizeRaw);
      if (material) options.push({ name: "소재", value: material });
      if (color) options.push({ name: "색상/도금", value: color });
      if (decoration) options.push({ name: "장식", value: decoration });
      if (size) options.push({ name: "사이즈", value: size });
      return options;
    };

    const axisMap = new Map<string, Map<string, Set<string>>>();
    for (const m of detailOptionMappings) {
      const variantCode = String(m.external_variant_code ?? "").trim();
      if (!variantCode) continue;
      const fromVariantMeta = variantOptionsByCode.get(variantCode) ?? [];
      const fromMapping = fallbackOptions(m);
      const opts = fromVariantMeta.length > 0 ? fromVariantMeta : fromMapping;
      for (const o of opts) {
        if (!axisMap.has(o.name)) axisMap.set(o.name, new Map());
        const valueMap = axisMap.get(o.name)!;
        if (!valueMap.has(o.value)) valueMap.set(o.value, new Set());
        valueMap.get(o.value)!.add(variantCode);
      }
    }
    const out: OptionValueItem[] = [];
    for (const [axis, valueMap] of axisMap.entries()) {
      for (const [value, codes] of valueMap.entries()) {
        out.push({ axis, value, variant_codes: Array.from(codes).sort() });
      }
    }
    return out.sort((a, b) => a.axis.localeCompare(b.axis) || a.value.localeCompare(b.value));
  }, [detailOptionMappings, variantOptionsByCode]);

  const optionAxisGroups = useMemo<OptionAxisGroup[]>(() => {
    const grouped = new Map<string, OptionValueItem[]>();
    for (const item of optionValueItems) {
      const prev = grouped.get(item.axis) ?? [];
      prev.push(item);
      grouped.set(item.axis, prev);
    }
    return Array.from(grouped.entries())
      .map(([axis, values]) => ({ axis, values: values.sort((a, b) => a.value.localeCompare(b.value)) }))
      .sort((a, b) => a.axis.localeCompare(b.axis));
  }, [optionValueItems]);

  const optionValueMappingsByKey = useMemo(() => {
    const map = new Map<string, MappingRow[]>();
    for (const item of optionValueItems) {
      const key = `${item.axis}::${item.value}`;
      const rows = detailMappings.filter((m) => item.variant_codes.includes(String(m.external_variant_code ?? "").trim()));
      map.set(key, rows);
    }
    return map;
  }, [detailMappings, optionValueItems]);

  const optionGroupOptionsByChannelProduct = useMemo(() => {
    const out = new Map<string, Array<{ name: string; value: string }>>();
    const toSizeLabel = (sizeValue: number | null): string => {
      if (sizeValue == null || !Number.isFinite(sizeValue)) return "";
      const n = Number(sizeValue);
      return Number.isInteger(n) ? String(n) : String(n);
    };
    const fallbackOptions = (m: MappingRow): Array<{ name: string; value: string }> => {
      const options: Array<{ name: string; value: string }> = [];
      const material = normalizeOptionDisplayValue("소재", String(m.option_material_code ?? "").trim());
      const color = normalizeOptionDisplayValue("색상/도금", String(m.option_color_code ?? "").trim());
      const decoration = normalizeOptionDisplayValue("장식", String(m.option_decoration_code ?? "").trim());
      const size = normalizeOptionDisplayValue("사이즈", toSizeLabel(m.option_size_value ?? null).trim());
      if (material) options.push({ name: "소재", value: material });
      if (color) options.push({ name: "색상/도금", value: color });
      if (decoration) options.push({ name: "장식", value: decoration });
      if (size) options.push({ name: "사이즈", value: size });
      return options;
    };

    for (const m of mappings) {
      const channelProductId = String(m.channel_product_id ?? "").trim();
      if (!channelProductId) continue;
      const variantCode = String(m.external_variant_code ?? "").trim();
      const fromVariantMeta = variantCode ? (variantOptionsByCode.get(variantCode) ?? []) : [];
      const fromMapping = fallbackOptions(m);
      const options = fromVariantMeta.length > 0 ? fromVariantMeta : fromMapping;
      out.set(channelProductId, options);
    }

    return out;
  }, [mappings, variantOptionsByCode]);

  const selectedOptionPairs = useMemo(
    () => Object.entries(optionGroupSelections).flatMap(([axis, values]) => values.map((value) => ({ axis, value }))),
    [optionGroupSelections],
  );

  const optionGroupRuleDeltaByVariant = useMemo(() => {
    const policyByPair = new Map<string, OptionValuePolicyRow>();
    for (const policy of optionGroupPersistedPolicies) {
      const key = `${String(policy.axis_key ?? "").trim()}::${String(policy.axis_value ?? "").trim()}`;
      if (!key || key === "::") continue;
      const prev = policyByPair.get(key);
      if (!prev) {
        policyByPair.set(key, policy);
        continue;
      }
      const prevTime = Date.parse(String(prev.updated_at ?? ""));
      const nextTime = Date.parse(String(policy.updated_at ?? ""));
      if (!Number.isFinite(prevTime) || (Number.isFinite(nextTime) && nextTime >= prevTime)) {
        policyByPair.set(key, policy);
      }
    }

    const r2ById = new Map((optionGroupR2RulesQuery.data?.data ?? []).map((r) => [r.rule_id, r]));
    const r3ById = new Map((optionGroupR3RulesQuery.data?.data ?? []).map((r) => [r.rule_id, r]));
    const r4ById = new Map((optionGroupR4RulesQuery.data?.data ?? []).map((r) => [r.rule_id, r]));
    const getRuleDelta = (ruleType: SyncRuleType, ruleId: string): number | null => {
      if (!ruleId) return null;
      if (ruleType === "R2") {
        const rule = r2ById.get(ruleId);
        if (!rule) return null;
        const deltaRaw = Number(rule.delta_krw ?? 0);
        const singleMarginMode = rule.margin_min_krw !== null && rule.margin_max_krw !== null && Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
        return singleMarginMode && deltaRaw === 0 ? Number(rule.margin_min_krw ?? 0) : deltaRaw;
      }
      if (ruleType === "R3") {
        const rule = r3ById.get(ruleId);
        if (!rule) return null;
        const deltaRaw = Number(rule.delta_krw ?? 0);
        const singleMarginMode = Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
        return singleMarginMode && deltaRaw === 0 ? Number(rule.margin_min_krw ?? 0) : deltaRaw;
      }
      if (ruleType === "R4") {
        const rule = r4ById.get(ruleId);
        return rule ? Number(rule.delta_krw ?? 0) : null;
      }
      return null;
    };

    const out = new Map<string, number | null>();
    for (const [variantCode, opts] of variantOptionsByCode.entries()) {
      let sum = 0;
      let matched = false;
      for (const opt of opts) {
        const key = `${String(opt.name ?? "").trim()}::${String(opt.value ?? "").trim()}`;
        const policy = policyByPair.get(key);
        if (!policy) continue;
        if (policy.axis_mode !== "SYNC" || policy.value_mode !== "SYNC") continue;
        const ruleId = String(policy.selected_rule_id ?? "").trim();
        if (!ruleId) continue;
        const delta = getRuleDelta(policy.rule_type, ruleId);
        if (delta == null) continue;
        matched = true;
        sum += Math.round(delta);
      }
      out.set(variantCode, matched ? sum : null);
    }
    return out;
  }, [
    optionGroupPersistedPolicies,
    optionGroupR2RulesQuery.data?.data,
    optionGroupR3RulesQuery.data?.data,
    optionGroupR4RulesQuery.data?.data,
    variantOptionsByCode,
  ]);

  const optionGroupedGalleryItems = useMemo(() => {
    const q = optionGroupSearch.trim().toLowerCase();
    const matchesSelection = (options: Array<{ name: string; value: string }>): boolean => {
      if (selectedOptionPairs.length === 0) return true;
      const hasPair = (axis: string, value: string) =>
        options.some((o) => String(o.name) === axis && String(o.value) === value);
      if (optionGroupFilterMode === "AND") {
        return selectedOptionPairs.every((p) => hasPair(p.axis, p.value));
      }
      return selectedOptionPairs.some((p) => hasPair(p.axis, p.value));
    };

    const items = Array.from(
      new Map(
        mappings.map((m) => [
          String(m.channel_product_id),
          {
            channelProductId: String(m.channel_product_id),
            mapping: m,
            row: rowsByChannelProduct.get(m.channel_product_id),
            variantCode: String(m.external_variant_code ?? "").trim() || "-",
            productNo: String(m.external_product_no ?? "").trim() || "-",
            options: optionGroupOptionsByChannelProduct.get(String(m.channel_product_id)) ?? [],
          },
        ]),
      ).values(),
    )
      .filter((item) => item.variantCode !== "-")
      .filter((item) => item.row)
      .filter((item) => matchesSelection(item.options))
      .filter((item) => {
        if (!q) return true;
        const optionsText = item.options
          .map((o) => `${o.name}:${o.value}`)
          .join(" ")
          .toLowerCase();
        const blob = `${item.productNo} ${item.variantCode} ${item.row?.model_name ?? ""} ${optionsText}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        const p = a.productNo.localeCompare(b.productNo);
        if (p !== 0) return p;
        return a.variantCode.localeCompare(b.variantCode);
      });

    return items;
  }, [mappings, optionGroupFilterMode, optionGroupOptionsByChannelProduct, optionGroupSearch, rowsByChannelProduct, selectedOptionPairs]);

  const optionGroupFacetGroups = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>();
    for (const item of optionGroupedGalleryItems) {
      for (const opt of item.options) {
        if (!grouped.has(opt.name)) grouped.set(opt.name, new Map());
        const values = grouped.get(opt.name)!;
        values.set(opt.value, (values.get(opt.value) ?? 0) + 1);
      }
    }
    return Array.from(grouped.entries())
      .map(([axis, values]) => ({
        axis,
        values: Array.from(values.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => a.value.localeCompare(b.value)),
      }))
      .sort((a, b) => a.axis.localeCompare(b.axis));
  }, [optionGroupedGalleryItems]);

  const optionGroupFacetChips = useMemo(() =>
    optionGroupFacetGroups.flatMap((group) =>
      group.values.map((v) => ({ axis: group.axis, value: v.value, count: v.count }))),
  [optionGroupFacetGroups]);

  const optionGroupedByTotal = useMemo(() => {
    const grouped = new Map<number, Array<typeof optionGroupedGalleryItems[number] & {
      totalOptionDelta: number;
      manualOptionDelta: number;
      ruleOptionDelta: number;
      ruleDeltaSource: "POLICY" | "INFERRED";
    }>>();
    for (const item of optionGroupedGalleryItems) {
      const total = Math.round(Number(item.mapping.option_price_delta_krw ?? 0));
      const manual = total;
      const hasRuleFlags = Boolean(
        item.mapping.sync_rule_weight_enabled
        || item.mapping.sync_rule_plating_enabled
        || item.mapping.sync_rule_decoration_enabled,
      );
      const policyRuleDelta = hasRuleFlags ? (optionGroupRuleDeltaByVariant.get(item.variantCode) ?? null) : 0;
      const ruleDelta = policyRuleDelta == null ? 0 : policyRuleDelta;
      const bucketValue = optionGroupPriceBasis === "RULE" ? ruleDelta : total;
      const prev = grouped.get(bucketValue) ?? [];
      prev.push({
        ...item,
        totalOptionDelta: total,
        manualOptionDelta: manual,
        ruleOptionDelta: ruleDelta,
        ruleDeltaSource: policyRuleDelta == null ? "INFERRED" : "POLICY",
      });
      grouped.set(bucketValue, prev);
    }
    return Array.from(grouped.entries())
      .map(([bucket, items]) => ({ bucket, items: items.sort((a, b) => a.variantCode.localeCompare(b.variantCode)) }))
      .sort((a, b) => b.bucket - a.bucket);
  }, [optionGroupedGalleryItems, optionGroupPriceBasis, optionGroupRuleDeltaByVariant]);

  const optionGroupBucketChips = useMemo(
    () => optionGroupedByTotal.map((bucket) => ({ bucket: bucket.bucket, count: bucket.items.length })),
    [optionGroupedByTotal],
  );

  const optionGroupedBySelectedBuckets = useMemo(() => {
    if (optionGroupSelectedBuckets.length === 0) return optionGroupedByTotal;
    const selected = new Set(optionGroupSelectedBuckets);
    return optionGroupedByTotal.filter((bucket) => selected.has(bucket.bucket));
  }, [optionGroupedByTotal, optionGroupSelectedBuckets]);

  const optionAxisNames = useMemo(() => {
    const axes = new Set<string>();
    for (const opts of variantOptionsByCode.values()) {
      for (const o of opts) axes.add(o.name);
    }
    return Array.from(axes);
  }, [variantOptionsByCode]);

  const baseLogsQuery = useQuery({
    queryKey: ["shop-base-adjust-logs", activeChannelId, effectiveDetailMasterId],
    enabled: Boolean(activeChannelId && effectiveDetailMasterId),
    queryFn: () =>
      shopApiGet<{ data: BaseAdjustmentLog[] }>(
        `/api/channel-base-price-adjustments?channel_id=${encodeURIComponent(activeChannelId)}&master_item_id=${encodeURIComponent(effectiveDetailMasterId)}&limit=50`,
      ),
  });

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["shop-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["shop-mappings"] }),
      qc.invalidateQueries({ queryKey: ["shop-dashboard-summary"] }),
      qc.invalidateQueries({ queryKey: ["shop-base-adjust-logs"] }),
      qc.invalidateQueries({ queryKey: ["shop-base-adjust-all"] }),
      qc.invalidateQueries({ queryKey: ["shop-dashboard-variant-meta"] }),
      qc.invalidateQueries({ queryKey: ["shop-sync-rule-breakdown"] }),
      qc.invalidateQueries({ queryKey: ["shop-option-value-policies"] }),
      qc.invalidateQueries({ queryKey: ["shop-sync-jobs"] }),
    ]);
  };

  const recomputeByMaster = async (masterItemIds?: string[]) => {
    const normalizedMasterIds = (masterItemIds ?? []).map((v) => String(v ?? "").trim()).filter(Boolean);
    const recompute = await shopApiSend<{ ok: boolean; inserted: number; compute_request_id?: string }>("/api/pricing/recompute", "POST", {
      channel_id: activeChannelId,
      master_item_ids: normalizedMasterIds.length > 0 ? normalizedMasterIds : undefined,
    });
    const computeRequestId = String(recompute.compute_request_id ?? "").trim();
    if (!computeRequestId) {
      throw new Error("재계산 버전 식별자(compute_request_id)를 받지 못했습니다");
    }
    setPinnedComputeRequestId(computeRequestId);
    return recompute;
  };

  const doRecompute = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number; compute_request_id?: string }>("/api/pricing/recompute", "POST", {
        channel_id: activeChannelId,
        master_item_ids: selectedMasterIds.length > 0 ? selectedMasterIds : undefined,
      }),
    onSuccess: async (res) => {
      const computeRequestId = String(res.compute_request_id ?? "").trim();
      if (computeRequestId) setPinnedComputeRequestId(computeRequestId);
      toast.success(`재계산 완료: ${res.inserted}건`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPull = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number; success: number; failed: number }>("/api/channel-prices/pull", "POST", {
        channel_id: activeChannelId,
        channel_product_ids: selectedChannelProductIds.length > 0 ? selectedChannelProductIds : undefined,
      }),
    onSuccess: async (res) => {
      if ((res.failed ?? 0) > 0) toast.error(`기본가격 pull 부분 실패: 성공 ${res.success} / 실패 ${res.failed}`);
      else toast.success(`기본가격 pull 완료: ${res.inserted}건`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPush = useMutation({
    mutationFn: async () => {
      const recompute = await shopApiSend<{ ok: boolean; inserted: number; compute_request_id?: string }>("/api/pricing/recompute", "POST", {
        channel_id: activeChannelId,
        master_item_ids: selectedMasterIds.length > 0 ? selectedMasterIds : undefined,
      });
      const computeRequestId = String(recompute.compute_request_id ?? "").trim();
      if (!computeRequestId) {
        throw new Error("재계산 버전 식별자(compute_request_id)를 받지 못했습니다");
      }
      return shopApiSend<{ ok: boolean; job_id: string; success: number; failed: number; skipped: number; label_sync?: { failed?: number } }>("/api/channel-prices/push", "POST", {
        channel_id: activeChannelId,
        compute_request_id: computeRequestId,
        sync_option_labels: false,
      });
    },
    onSuccess: async (res) => {
      if ((res.failed ?? 0) > 0) toast.error(`push 완료(실패 있음): 성공 ${res.success} / 실패 ${res.failed}`);
      else if ((res.label_sync?.failed ?? 0) > 0) toast.error(`push 완료, 옵션명 동기화 일부 실패: ${res.label_sync?.failed ?? 0}건`);
      else toast.success(`push 완료: 성공 ${res.success} / 건너뜀 ${res.skipped}`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePlating = useMutation({
    mutationFn: (payload: { master_item_id: string; include_master_plating_labor: boolean }) =>
      shopApiSend<{ ok: boolean }>("/api/channel-products/master-toggle", "POST", {
        channel_id: activeChannelId,
        master_item_id: payload.master_item_id,
        include_master_plating_labor: payload.include_master_plating_labor,
      }),
    onSuccess: async () => {
      toast.success("도금공임 포함 설정 저장 완료");
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addBaseAdjustment = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const amount = Number(baseDeltaAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("조정 금액은 0보다 커야 합니다");
      if (!baseDeltaReason.trim()) throw new Error("사유를 입력하세요");
      return shopApiSend<{ data: BaseAdjustmentLog }>("/api/channel-base-price-adjustments", "POST", {
        channel_id: activeChannelId,
        master_item_id: effectiveDetailMasterId,
        delta_krw: Math.round(amount) * sign,
        reason: baseDeltaReason.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("기본가격 조정 로그 저장 완료");
      setBaseDeltaAmount("");
      setBaseDeltaReason("");
      await doRecompute.mutateAsync();
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateBaseAdjustment = useMutation({
    mutationFn: async () => {
      if (!editingBaseLogId) throw new Error("수정할 로그가 없습니다");
      const delta = Number(editingBaseLogDelta);
      if (!Number.isFinite(delta) || delta === 0) throw new Error("delta는 0이 아닌 숫자여야 합니다");
      if (Math.round(delta) % 100 !== 0) throw new Error("delta는 100원 단위여야 합니다");
      if (!editingBaseLogReason.trim()) throw new Error("사유를 입력하세요");
      return shopApiSend<{ data: BaseAdjustmentLog }>("/api/channel-base-price-adjustments", "PUT", {
        adjustment_log_id: editingBaseLogId,
        delta_krw: Math.round(delta),
        reason: editingBaseLogReason.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("기본값 조정 이력 수정 완료");
      setEditingBaseLogId(null);
      setEditingBaseLogDelta("");
      setEditingBaseLogReason("");
      await doRecompute.mutateAsync();
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBaseAdjustment = useMutation({
    mutationFn: async (adjustmentLogId: string) =>
      shopApiSend<{ ok: boolean }>("/api/channel-base-price-adjustments", "DELETE", {
        adjustment_log_id: adjustmentLogId,
      }),
    onSuccess: async () => {
      toast.success("기본값 조정 이력 삭제 완료");
      if (editingBaseLogId) {
        setEditingBaseLogId(null);
        setEditingBaseLogDelta("");
        setEditingBaseLogReason("");
      }
      await doRecompute.mutateAsync();
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearBaseAdjustmentsForMaster = useMutation({
    mutationFn: async () => {
      if (!activeChannelId || !effectiveDetailMasterId) throw new Error("마스터 선택 정보가 없습니다");
      return shopApiSend<{ ok: boolean }>(
        `/api/channel-base-price-adjustments?channel_id=${encodeURIComponent(activeChannelId)}&master_item_id=${encodeURIComponent(effectiveDetailMasterId)}`,
        "DELETE",
      );
    },
    onSuccess: async () => {
      toast.success("기준보정 로그를 0으로 초기화했습니다");
      setBaseDeltaAmount("");
      setBaseDeltaReason("");
      await doRecompute.mutateAsync();
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveOptionEdit = useMutation({
    mutationFn: async () => {
      if (!editingChannelProductId || !optionEditDraft) throw new Error("수정할 옵션이 없습니다");

      const toNullableNumber = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        if (!Number.isFinite(num)) throw new Error("숫자 형식이 올바르지 않습니다");
        return num;
      };

      if (optionEditDraft.option_price_mode === "MANUAL" && !optionEditDraft.option_manual_target_krw.trim()) {
        throw new Error("직접작성 모드에서는 수동 목표가가 필수입니다");
      }
      if (
        optionEditDraft.option_price_mode === "SYNC"
        && !optionEditDraft.sync_rule_set_id.trim()
      ) {
        throw new Error("SYNC 모드에서는 룰셋 선택이 필수입니다");
      }

      const parsedDelta = toNullableNumber(optionEditDraft.option_price_delta_krw);
      const normalizedDelta = parsedDelta == null ? null : roundToThousand(parsedDelta);

      if (optionEditDraft.option_price_mode === "SYNC") {
        const precheck = await shopApiSend<{ data: SyncPreviewResult }>("/api/sync-rules/preview", "POST", {
          channel_id: activeChannelId,
          rule_set_id: optionEditDraft.sync_rule_set_id,
          channel_product_id: editingChannelProductId,
          sample_limit: 1,
        });
        const missing = precheck.data.unmatched_samples?.[0]?.missing_rules ?? [];
        if (precheck.data.blocked > 0 || missing.length > 0) {
          throw new Error(`등록된 룰이 없어 동기화할 수 없습니다: ${missing.join(", ") || "R2/R3/R4"}`);
        }
      }

      await shopApiSend(`/api/channel-products/${encodeURIComponent(editingChannelProductId)}`, "PUT", {
        option_price_mode: optionEditDraft.option_price_mode,
        sync_rule_set_id: optionEditDraft.sync_rule_set_id || null,
        option_material_code: optionEditDraft.option_material_code || null,
        option_color_code: optionEditDraft.option_color_code || null,
        option_decoration_code: optionEditDraft.option_decoration_code || null,
        option_size_value: toNullableNumber(optionEditDraft.option_size_value),
        option_price_delta_krw: normalizedDelta,
        option_delta_reason: null,
        option_manual_target_krw: toNullableNumber(optionEditDraft.option_manual_target_krw),
        sync_rule_material_enabled: optionEditDraft.sync_rule_material_enabled,
        sync_rule_weight_enabled: optionEditDraft.sync_rule_weight_enabled,
        sync_rule_plating_enabled: optionEditDraft.sync_rule_plating_enabled,
        sync_rule_decoration_enabled: optionEditDraft.sync_rule_decoration_enabled,
      });

      await recomputeByMaster(effectiveDetailMasterId ? [effectiveDetailMasterId] : []);
    },
    onSuccess: async () => {
      toast.success("옵션 저장 및 재계산 완료");
      setEditingChannelProductId(null);
      setOptionEditDraft(null);
      setOptionEditOriginalDelta(0);
      await refreshAll();
      if (isBulkPolicyDrawerOpen) {
        await loadBulkPolicyDrafts();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewSyncRule = useMutation({
    mutationFn: async ({ ruleSetId, channelProductId }: { ruleSetId: string; channelProductId?: string }) => {
      if (!ruleSetId.trim()) throw new Error("룰셋을 선택하세요");
      const res = await shopApiSend<{ data: SyncPreviewResult }>("/api/sync-rules/preview", "POST", {
        channel_id: activeChannelId,
        rule_set_id: ruleSetId,
        channel_product_id: channelProductId,
        sample_limit: 5,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSyncPreview(data);
      if (data.blocked > 0) {
        const missing = data.unmatched_samples[0]?.missing_rules?.join(", ") ?? "룰"
        toast.error(`미등록/미매칭 룰이 있습니다: ${missing}`);
      } else {
        toast.success(`미리보기 완료: 영향 ${data.affected}/${data.total_candidates}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const applyAxisPolicyMutationFn = async ({
      axis,
      axisMode,
      values,
      ruleSetId,
      ruleType,
      skipRecompute,
    }: {
      axis: string;
      axisMode: "OVERRIDE" | "SYNC";
      values: Record<string, AxisValueDraft>;
      ruleSetId?: string;
      ruleType?: SyncRuleType;
      skipRecompute?: boolean;
    }) => {
      const group = optionAxisGroups.find((g) => g.axis === axis);
      if (!group) throw new Error("옵션 카테고리를 찾지 못했습니다");

      const normalizedValues: Record<string, AxisValueDraft> = {};
      for (const item of group.values) {
        const raw = values[item.value];
        const parsedDelta = Number(raw?.deltaKrw ?? "0");
        if (!Number.isFinite(parsedDelta)) {
          throw new Error(`${axis} / ${item.value}: 추가금액은 숫자여야 합니다`);
        }
        const nextMode: "BASE" | "SYNC" = "SYNC";
        normalizedValues[item.value] = {
          mode: nextMode,
          ruleId: String(raw?.ruleId ?? "").trim(),
          deltaKrw: String(roundToThousand(parsedDelta)),
        };
      }

      const hasSyncValue = axisMode === "SYNC" && group.values.some((item) => normalizedValues[item.value].mode === "SYNC");

      const effectiveAxisDrafts: Record<string, AxisPolicyDraft> = {
        ...axisPolicyDrafts,
        [axis]: {
          mode: axisMode,
          ruleType: normalizeRuleTypeForAxis(axis, (ruleType ?? guessRuleByAxis(axis))),
          values: normalizedValues,
        },
      };

      const parseSizeStrict = (value: string) => {
        const onlyNumber = value.replace(/[^0-9.+-]/g, "");
        if (!onlyNumber) return null;
        const n = Number(onlyNumber);
        return Number.isFinite(n) ? n : null;
      };

      const axisDeltaByRowKey = new Map<string, number>();
      const findAffectedMappings = (axisName: string, axisValue: string): MappingRow[] => {
        const directKey = `${axisName}::${axisValue}`;
        const mergedByRowKey = new Map<string, MappingRow>();
        const addRows = (rows: MappingRow[]) => {
          for (const row of rows) {
            const rowKey = `${row.channel_id}::${row.external_product_no}::${String(row.external_variant_code ?? "")}`;
            if (!mergedByRowKey.has(rowKey)) mergedByRowKey.set(rowKey, row);
          }
        };

        addRows(optionValueMappingsByKey.get(directKey) ?? []);

        const materialCode = normalizeMaterialCode(axisValue);
        if (materialCode) {
          addRows(detailOptionMappings.filter((m) => normalizeMaterialCode(String(m.option_material_code ?? "")) === materialCode));
        }

        const colorCode = normalizePlatingComboCode(axisValue);
        if (colorCode) {
          addRows(detailOptionMappings.filter((m) => normalizePlatingComboCode(String(m.option_color_code ?? "")) === colorCode));
        }

        const sizeValue = parseSizeStrict(axisValue);
        if (sizeValue != null) {
          addRows(detailOptionMappings.filter((m) => Number(m.option_size_value ?? Number.NaN) === sizeValue));
        }

        const decorCode = String(axisValue ?? "").trim().toUpperCase();
        if (decorCode) {
          addRows(detailOptionMappings.filter((m) => String(m.option_decoration_code ?? "").trim().toUpperCase() === decorCode));
        }

        return Array.from(mergedByRowKey.values());
      };

      for (const axisGroup of optionAxisGroups) {
        const axisDraft = effectiveAxisDrafts[axisGroup.axis] ?? {
          mode: "SYNC" as const,
          ruleType: guessRuleByAxis(axisGroup.axis),
          values: Object.fromEntries(axisGroup.values.map((v) => [v.value, { mode: "SYNC", ruleId: "", deltaKrw: "0" }])) as Record<string, AxisValueDraft>,
        };
        const isMaterialGroup = isMaterialAxisName(axisGroup.axis);
        for (const axisValue of axisGroup.values) {
          const vDraft = axisDraft.values[axisValue.value] ?? { mode: "SYNC", ruleId: "", deltaKrw: "0" };
          const isSyncValue = axisDraft.mode === "SYNC" && vDraft.mode === "SYNC";
          const raw = Number(vDraft.deltaKrw ?? "0");
          const rounded = Number.isFinite(raw) ? roundToThousand(raw) : 0;
          const contribution = isSyncValue ? (isMaterialGroup ? 0 : rounded) : 0;
          const matchedRows = findAffectedMappings(axisValue.axis, axisValue.value);
          for (const row of matchedRows) {
            const rowKey = `${row.channel_id}::${row.external_product_no}::${String(row.external_variant_code ?? "")}`;
            axisDeltaByRowKey.set(rowKey, (axisDeltaByRowKey.get(rowKey) ?? 0) + contribution);
          }
        }
      }

      const selectedRuleTypeRaw = (ruleType ?? guessRuleByAxis(axis));
      const selectedRuleType = normalizeRuleTypeForAxis(axis, selectedRuleTypeRaw);
      const selectedRuleSetId = (ruleSetId ?? "").trim() || "";
      const fallbackRuleSetId = selectedRuleSetId || syncRuleSetQuery.data?.data?.[0]?.rule_set_id || "";
      const requiresRuleSet = hasSyncValue && selectedRuleType === "R4";
      if (requiresRuleSet && !selectedRuleSetId) {
        throw new Error("SYNC 적용을 위한 룰셋을 선택하세요");
      }
      if (axisMode === "SYNC" && selectedRuleTypeRaw !== selectedRuleType) {
        throw new Error(`${axis}: ${ruleTypeLabel(selectedRuleTypeRaw)}는 이 옵션축에 적용할 수 없습니다. (${allowedRuleTypesForAxis(axis).map(ruleTypeLabel).join(", ")}만 가능)`);
      }

      const isMaterialAxis = isMaterialAxisName(axis);
      const isSizeAxisRule = isSizeAxisName(axis);
      const isDecorationAxisRule = isDecorationAxisName(axis);
      const axisUsesRuleEngine = isDecorationAxisRule;



      const rowsMap = new Map<string, {
        channel_id: string;
        master_item_id: string;
        external_product_no: string;
        external_variant_code: string;
        option_price_mode: "SYNC" | "MANUAL";
        sync_rule_set_id: string | null;
        option_material_code: string | null;
        option_color_code: string | null;
        option_decoration_code: string | null;
        option_size_value: number | null;
        option_price_delta_krw: number | null;
        option_manual_target_krw: number | null;
        include_master_plating_labor: boolean;
        sync_rule_material_enabled: boolean;
        sync_rule_weight_enabled: boolean;
        sync_rule_plating_enabled: boolean;
        sync_rule_decoration_enabled: boolean;
        mapping_source: "MANUAL" | "CSV" | "AUTO";
        is_active: boolean;
      }>();
      const baseValueForR1 = group.values[0]?.value;
      const r1Rules = r1RulesQuery.data?.data ?? [];

      for (const item of group.values) {
        const affectedMappings = findAffectedMappings(item.axis, item.value);
        const valueDraft = normalizedValues[item.value];
        const valueMode = valueDraft.mode;

        const selectedR1 = (r1RulesQuery.data?.data ?? []).find((r) => r.rule_id === valueDraft.ruleId);
        const selectedR4 = (r4RulesQuery.data?.data ?? []).find((r) => r.rule_id === valueDraft.ruleId);
        const resolvedR1 =
          selectedRuleType === "R1"
            ? (selectedR1 ?? resolveR1RuleForValue(r1Rules, item.value, baseValueForR1))
            : null;

        if (axisMode === "SYNC" && valueMode === "SYNC") {
          if (selectedRuleType === "R1" && !resolvedR1) throw new Error(`${axis} / ${item.value}: 선택한/매칭된 R1 룰을 찾을 수 없습니다`);
          if (selectedRuleType === "R4" && valueDraft.ruleId && !selectedR4) throw new Error(`${axis} / ${item.value}: 선택한 R4 룰을 찾을 수 없습니다`);
        }
        for (const m of affectedMappings) {
          const useSync = axisMode === "SYNC" && valueMode === "SYNC";
          const hasExplicitRuleSelection = String(valueDraft.ruleId ?? "").trim().length > 0;
          const useRuleSyncForValue = useSync && (axisUsesRuleEngine ? hasExplicitRuleSelection : true);
          const enforcedRuleSetId = selectedRuleSetId || m.sync_rule_set_id || fallbackRuleSetId;
          if (!enforcedRuleSetId) {
            throw new Error("적용 가능한 Sync 룰셋이 없습니다. 먼저 룰셋을 생성/선택해주세요.");
          }
          const axisMaterialCode = normalizeMaterialCode(item.value);
          const nextMaterial = isMaterialAxis
            ? (axisMaterialCode || m.option_material_code)
            : (selectedRuleType === "R1"
              ? (
                useSync
                  ? (resolvedR1?.target_material_code ?? axisMaterialCode ?? m.option_material_code)
                  : (axisMaterialCode ?? m.option_material_code)
              )
              : m.option_material_code);
          const nextColor = m.option_color_code;
          const nextDecoration = selectedRuleType === "R4" && useRuleSyncForValue
            ? (selectedR4?.match_decoration_code ?? m.option_decoration_code)
            : m.option_decoration_code;
          const parsedSize = isSizeAxisRule ? parseSizeStrict(item.value) : null;
          if (isSizeAxisRule && axisUsesRuleEngine && useRuleSyncForValue && parsedSize == null) {
            throw new Error(`${axis} / ${item.value}: 사이즈 숫자 파싱에 실패했습니다 (예: 12, 12.5)`);
          }
          const nextSize = isSizeAxisRule && axisUsesRuleEngine && useRuleSyncForValue
            ? parsedSize
            : m.option_size_value;

          const rowKey = `${m.channel_id}::${m.external_product_no}::${String(m.external_variant_code ?? "")}`;
          const nextTotal = Math.round(axisDeltaByRowKey.get(rowKey) ?? 0);
          rowsMap.set(rowKey, {
            channel_id: m.channel_id,
            master_item_id: m.master_item_id,
            external_product_no: m.external_product_no,
            external_variant_code: String(m.external_variant_code ?? ""),
            option_price_mode: "SYNC",
            sync_rule_set_id: enforcedRuleSetId,
            option_material_code: nextMaterial,
            option_color_code: nextColor,
            option_decoration_code: nextDecoration,
            option_size_value: nextSize,
            option_price_delta_krw: nextTotal,
            option_manual_target_krw: null,
            include_master_plating_labor: m.include_master_plating_labor,
            sync_rule_material_enabled: false,
            sync_rule_weight_enabled: false,
            sync_rule_plating_enabled: false,
            sync_rule_decoration_enabled: axisUsesRuleEngine && useRuleSyncForValue && selectedRuleType === "R4",
            mapping_source: m.mapping_source ?? "MANUAL",
            is_active: m.is_active !== false,
          });
        }
      }

      const rows = Array.from(rowsMap.values());
      if (rows.length === 0) throw new Error("적용 대상 옵션이 없습니다");

      const policyRows = group.values.map((item) => {
        const valueDraft = normalizedValues[item.value];
        const hasExplicitRuleSelection = String(valueDraft.ruleId ?? "").trim().length > 0;
        const isSyncValue = axisMode === "SYNC" && valueDraft.mode === "SYNC";
        const persistedRuleId = axisUsesRuleEngine && hasExplicitRuleSelection ? valueDraft.ruleId : null;
        const persistedManualDelta = isSyncValue
          ? (isMaterialAxis ? 0 : Number(valueDraft.deltaKrw))
          : 0;
        return {
          channel_id: activeChannelId,
          master_item_id: effectiveDetailMasterId,
          axis_key: axis,
          axis_value: item.value,
          axis_mode: axisMode,
          rule_type: selectedRuleType,
          value_mode: valueDraft.mode,
          sync_rule_set_id: isSyncValue ? (selectedRuleSetId || fallbackRuleSetId || null) : null,
          selected_rule_id: isSyncValue ? persistedRuleId : null,
          manual_delta_krw: persistedManualDelta,
        };
      });

      if (!effectiveDetailMasterId) {
        throw new Error("마스터 선택 정보가 없습니다");
      }

      await shopApiSend("/api/channel-products/bulk", "POST", { rows });
      await shopApiSend("/api/channel-option-value-policies", "POST", {
        rows: policyRows,
        change_reason: "dashboard-axis-policy-apply",
      });
      if (!skipRecompute) {
        await recomputeByMaster(effectiveDetailMasterId ? [effectiveDetailMasterId] : []);
      }
    };

  const applyCategoryPolicy = useMutation({
    mutationFn: applyAxisPolicyMutationFn,
    onSuccess: async () => {
      toast.success("옵션 카테고리 정책 저장 및 재계산 완료");
      await refreshAll();
      if (isBulkPolicyDrawerOpen) {
        await loadBulkPolicyDrafts();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const applyAllCategoryPolicies = useMutation({
    mutationFn: async () => {
      const enforcedGlobalRuleSetId = String(
        bulkGlobalRuleSetId
        || detailOptionMappings.find((m) => String(m.sync_rule_set_id ?? "").trim())?.sync_rule_set_id
        || syncRuleSetQuery.data?.data?.[0]?.rule_set_id
        || "",
      ).trim();
      if (!enforcedGlobalRuleSetId) {
        throw new Error("전체 옵션 저장 전에 Sync 룰셋을 먼저 선택하세요");
      }

      const missingRuleSetRows = detailOptionMappings
        .filter((m) => (m.is_active !== false) && String(m.option_price_mode ?? "SYNC").toUpperCase() === "SYNC" && !String(m.sync_rule_set_id ?? "").trim())
        .map((m) => ({
          channel_id: m.channel_id,
          master_item_id: m.master_item_id,
          external_product_no: m.external_product_no,
          external_variant_code: String(m.external_variant_code ?? ""),
          option_price_mode: "SYNC" as const,
          sync_rule_set_id: enforcedGlobalRuleSetId,
          option_material_code: m.option_material_code,
          option_color_code: m.option_color_code,
          option_decoration_code: m.option_decoration_code,
          option_size_value: m.option_size_value,
          option_price_delta_krw: m.option_price_delta_krw == null ? 0 : Math.round(Number(m.option_price_delta_krw ?? 0)),
          option_manual_target_krw: null,
          include_master_plating_labor: m.include_master_plating_labor,
          sync_rule_material_enabled: m.sync_rule_material_enabled !== false,
          sync_rule_weight_enabled: m.sync_rule_weight_enabled !== false,
          sync_rule_plating_enabled: m.sync_rule_plating_enabled !== false,
          sync_rule_decoration_enabled: m.sync_rule_decoration_enabled !== false,
          mapping_source: m.mapping_source ?? "MANUAL",
          is_active: m.is_active !== false,
        }));
      if (missingRuleSetRows.length > 0) {
        await shopApiSend("/api/channel-products/bulk", "POST", { rows: missingRuleSetRows });
      }

      const targets = optionAxisGroups.map((group) => {
        const fallbackValues = Object.fromEntries(
          group.values.map((v) => [
            v.value,
            { mode: "SYNC", ruleId: "", deltaKrw: "0" } satisfies AxisValueDraft,
          ]),
        ) as Record<string, AxisValueDraft>;
        const draft = axisPolicyDrafts[group.axis] ?? {
          mode: "SYNC" as const,
          ruleType: guessRuleByAxis(group.axis),
          values: fallbackValues,
        };
        return {
          axis: group.axis,
          axisMode: draft.mode,
          values: draft.values,
          ruleSetId: enforcedGlobalRuleSetId,
          ruleType: draft.ruleType,
        };
      });
      if (targets.length === 0) throw new Error("적용할 옵션축이 없습니다");
      for (const target of targets) {
        await applyAxisPolicyMutationFn({ ...target, skipRecompute: true });
      }
      await recomputeByMaster(effectiveDetailMasterId ? [effectiveDetailMasterId] : []);
    },
    onSuccess: async () => {
      toast.success("전체 옵션 저장 및 재계산 완료");
      await refreshAll();
      if (isBulkPolicyDrawerOpen) {
        await loadBulkPolicyDrafts();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startOptionEdit = (m: MappingRow) => {
    setEditingChannelProductId(m.channel_product_id);
    setOptionEditOriginalDelta(Math.round(Number(m.option_price_delta_krw ?? 0)));
    setOptionEditDraft({
      option_price_mode: m.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC",
      sync_rule_set_id: m.sync_rule_set_id ?? "",
      option_material_code: m.option_material_code ?? "",
      option_color_code: m.option_color_code ?? "",
      option_decoration_code: m.option_decoration_code ?? "",
      option_size_value: m.option_size_value == null ? "" : String(m.option_size_value),
      option_price_delta_krw: m.option_price_delta_krw == null ? "" : String(roundToThousand(Number(m.option_price_delta_krw ?? 0))),
      option_manual_target_krw: m.option_manual_target_krw == null ? "" : String(m.option_manual_target_krw),
      sync_rule_material_enabled: false,
      sync_rule_weight_enabled: m.sync_rule_weight_enabled !== false,
      sync_rule_plating_enabled: m.sync_rule_plating_enabled !== false,
      sync_rule_decoration_enabled: m.sync_rule_decoration_enabled !== false,
    });
  };

  const cancelOptionEdit = () => {
    setEditingChannelProductId(null);
    setOptionEditDraft(null);
    setSyncPreview(null);
  };

  const hasAnySyncFlag = (m: MappingRow) =>
    m.sync_rule_material_enabled || m.sync_rule_weight_enabled || m.sync_rule_plating_enabled || m.sync_rule_decoration_enabled;

  const inferRuleTypeFromRows = (rows: MappingRow[], axis: string): SyncRuleType => {
    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    let r4 = 0;
    for (const m of rows) {
      if (m.sync_rule_material_enabled) r1 += 1;
      if (m.sync_rule_weight_enabled) r2 += 1;
      if (m.sync_rule_plating_enabled) r3 += 1;
      if (m.sync_rule_decoration_enabled) r4 += 1;
    }
    const max = Math.max(r1, r2, r3, r4);
    if (max <= 0) return guessRuleByAxis(axis);
    if (max === r1) return "R1";
    if (max === r2) return "R2";
    if (max === r3) return "R3";
    return "R4";
  };

  const buildAxisPolicyDrafts = (
    persistedPolicies: OptionValuePolicyRow[],
    r1Rules: R1RuleRow[],
    r3Rules: R3RuleRow[],
  ) => {
    const persistedByAxisValue = new Map<string, OptionValuePolicyRow>();
    for (const p of persistedPolicies) {
      const k = `${p.axis_key}::${p.axis_value}`;
      if (!persistedByAxisValue.has(k)) persistedByAxisValue.set(k, p);
    }

    const next: Record<string, AxisPolicyDraft> = {};
    for (const group of optionAxisGroups) {
      const axisRows = group.values.flatMap((item) => optionValueMappingsByKey.get(`${item.axis}::${item.value}`) ?? []);
      const inferredRuleType = inferRuleTypeFromRows(axisRows, group.axis);
      const inferredMode: AxisPolicyDraft["mode"] = axisRows.length > 0 && axisRows.every((m) => !hasAnySyncFlag(m))
        ? "OVERRIDE"
        : "SYNC";

      const axisPersisted = group.values
        .map((item) => persistedByAxisValue.get(`${item.axis}::${item.value}`))
        .filter((v): v is OptionValuePolicyRow => Boolean(v));
      const persistedAxisMode = axisPersisted[0]?.axis_mode;
      const persistedRuleType = axisPersisted[0]?.rule_type;
      const axisRuleType = normalizeRuleTypeForAxis(group.axis, (persistedRuleType ?? inferredRuleType));

      const values: Record<string, AxisValueDraft> = {};
      for (const item of group.values) {
        const key = `${item.axis}::${item.value}`;
        const valueRows = optionValueMappingsByKey.get(key) ?? [];
        const persisted = persistedByAxisValue.get(key);
        const persistedDelta = Number(persisted?.manual_delta_krw ?? 0);
        const normalizedPersistedDelta = Number.isFinite(persistedDelta) ? roundToThousand(persistedDelta) : 0;
        values[item.value] = {
          mode: "SYNC",
          ruleId: persisted?.selected_rule_id ?? "",
          deltaKrw: String(normalizedPersistedDelta),
        };
      }

      const nextAxisRuleType = axisRuleType;
      const nextAxisMode: AxisPolicyDraft["mode"] = persistedAxisMode ?? inferredMode;
      if (nextAxisRuleType === "R1") {
        const baseValueForR1 = group.values.find((item) => (values[item.value]?.mode ?? "SYNC") === "BASE")?.value;
        for (const item of group.values) {
          const key = `${item.axis}::${item.value}`;
          if (persistedByAxisValue.has(key)) continue;
          const draftValue = values[item.value];
          if (!draftValue || draftValue.mode !== "SYNC" || draftValue.ruleId) continue;
          const resolved = resolveR1RuleForValue(r1Rules, item.value, baseValueForR1);
          if (resolved?.rule_id) values[item.value] = { ...draftValue, ruleId: resolved.rule_id };
        }
      }
      if (nextAxisRuleType === "R3") {
        for (const item of group.values) {
          const key = `${item.axis}::${item.value}`;
          if (persistedByAxisValue.has(key)) continue;
          const draftValue = values[item.value];
          if (!draftValue || draftValue.mode !== "SYNC" || draftValue.ruleId) continue;
          const valueRows = optionValueMappingsByKey.get(key) ?? [];
          const mappedCode = Array.from(
            new Set(valueRows.map((row) => String(row.option_color_code ?? "").trim().toUpperCase()).filter(Boolean)),
          )[0] ?? "";
          if (!mappedCode) continue;
          const matched = r3Rules.find((rule) => String(rule.color_code ?? "").trim().toUpperCase() === mappedCode);
          if (matched?.rule_id) {
            values[item.value] = { ...draftValue, ruleId: matched.rule_id };
          }
        }
      }

      next[group.axis] = {
        mode: nextAxisMode,
        ruleType: normalizeRuleTypeForAxis(group.axis, nextAxisRuleType),
        values,
      };
    }
    return next;
  };

  const resolveMappedRuleSetId = (persistedPolicies: OptionValuePolicyRow[]) => {
    const persistedRuleSetId = persistedPolicies.find((p) => String(p.sync_rule_set_id ?? "").trim())?.sync_rule_set_id ?? "";
    return (
      persistedRuleSetId
      || detailOptionMappings.find((m) => String(m.sync_rule_set_id ?? "").trim())?.sync_rule_set_id
      || syncRuleSetQuery.data?.data?.[0]?.rule_set_id
      || ""
    );
  };

  const loadBulkPolicyDrafts = async () => {
    const policiesResp = await qc.fetchQuery({
      queryKey: ["shop-option-value-policies", activeChannelId, effectiveDetailMasterId],
      queryFn: () =>
        shopApiGet<{ data: OptionValuePolicyRow[] }>(
          `/api/channel-option-value-policies?channel_id=${encodeURIComponent(activeChannelId)}&master_item_id=${encodeURIComponent(effectiveDetailMasterId)}`,
        ),
    });
    const persistedPolicies = policiesResp.data ?? [];
    const mappedRuleSetId = resolveMappedRuleSetId(persistedPolicies);
    const r1Rules = mappedRuleSetId
      ? ((await qc.fetchQuery({
          queryKey: ["sync-r1-rules", mappedRuleSetId],
          queryFn: () => shopApiGet<{ data: R1RuleRow[] }>(`/api/sync-rules/r1?rule_set_id=${encodeURIComponent(mappedRuleSetId)}`),
        })).data ?? [])
      : [];
    const r3Rules = mappedRuleSetId
      ? ((await qc.fetchQuery({
          queryKey: ["sync-r3-rules", mappedRuleSetId],
          queryFn: () => shopApiGet<{ data: R3RuleRow[] }>(`/api/sync-rules/r3?rule_set_id=${encodeURIComponent(mappedRuleSetId)}`),
        })).data ?? [])
      : [];

    setAxisPolicyDrafts(buildAxisPolicyDrafts(persistedPolicies, r1Rules, r3Rules));
    setBulkGlobalRuleSetId(mappedRuleSetId);
  };

  const openBulkPolicyDrawer = async () => {
    try {
      await loadBulkPolicyDrafts();
      setIsBulkPolicyDrawerOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "옵션 정책 불러오기 실패";
      toast.error(message);
    }
  };

  const updateAxisDraft = (axis: string, patch: Partial<AxisPolicyDraft>) => {
    setAxisPolicyDrafts((prev) => {
      const base = prev[axis] ?? {
        mode: "SYNC" as const,
        ruleType: guessRuleByAxis(axis),
        values: {},
      };
      const merged = { ...base, ...patch };
      const normalizedRuleType = normalizeRuleTypeForAxis(axis, merged.ruleType);
      return { ...prev, [axis]: { ...merged, ruleType: normalizedRuleType } };
    });
  };

  const editingDashboardRow = useMemo(() => {
    if (!editingChannelProductId) return null;
    return rowsByChannelProduct.get(editingChannelProductId) ?? null;
  }, [editingChannelProductId, rowsByChannelProduct]);

  const editingMappingRow = useMemo(() => {
    if (!editingChannelProductId) return null;
    return detailOptionMappings.find((m) => m.channel_product_id === editingChannelProductId) ?? null;
  }, [detailOptionMappings, editingChannelProductId]);

  const manualDraftTarget = useMemo(() => {
    if (!optionEditDraft || optionEditDraft.option_price_mode !== "MANUAL") return null;
    const n = Number(optionEditDraft.option_manual_target_krw);
    return Number.isFinite(n) ? Math.max(Math.round(n), 0) : null;
  }, [optionEditDraft]);

  const syncPreviewDeltaForEditing = useMemo(() => {
    if (!editingChannelProductId || !syncPreview) return null;
    const sample = syncPreview.matched_samples.find((s) => s.channel_product_id === editingChannelProductId);
    if (!sample) return null;
    return Number(sample.total_delta_krw ?? 0);
  }, [editingChannelProductId, syncPreview]);

  const expectedTargetPrice = useMemo(() => {
    const currentTarget = Number(editingDashboardRow?.final_target_price_krw ?? 0);
    const currentOptionTotal = Number(editingDashboardRow?.option_price_delta_krw ?? 0);
    const baseWithoutOption = currentTarget - currentOptionTotal;
    const draftExtra = Number(optionEditDraft?.option_price_delta_krw ?? 0);
    const normalizedDraftExtra = Number.isFinite(draftExtra) ? Math.round(draftExtra) : 0;
    if (!optionEditDraft) return editingDashboardRow?.final_target_price_krw ?? null;
    if (optionEditDraft.option_price_mode === "MANUAL") return manualDraftTarget;
    const syncRuleDelta = syncPreviewDeltaForEditing == null ? (currentOptionTotal - Number(editingMappingRow?.option_price_delta_krw ?? 0)) : syncPreviewDeltaForEditing;
    const nextOptionTotal = syncRuleDelta + normalizedDraftExtra;
    return Math.max(Math.round(baseWithoutOption + nextOptionTotal), 0);
  }, [editingDashboardRow, editingMappingRow, manualDraftTarget, optionEditDraft, syncPreviewDeltaForEditing]);

  const totalCategoryValueCount = useMemo(
    () => optionAxisGroups.reduce((acc, group) => acc + group.values.length, 0),
    [optionAxisGroups],
  );

  const masterMaterialInfo = useMemo(() => {
    const masterMaterial = String(detailMasterMaterialCode ?? "").trim();
    return { masterMaterial };
  }, [detailMasterMaterialCode]);

  const axisAffectedCountByAxis = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of optionAxisGroups) {
      const count = group.values.reduce(
        (acc, item) => acc + (optionValueMappingsByKey.get(`${item.axis}::${item.value}`)?.length ?? 0),
        0,
      );
      map.set(group.axis, count);
    }
    return map;
  }, [optionAxisGroups, optionValueMappingsByKey]);

  const getRuleOptions = (ruleType: SyncRuleType) => {
    if (ruleType === "R1") return (r1RulesQuery.data?.data ?? []).map((r) => ({ id: r.rule_id, label: `${r.target_material_code}${r.source_material_code ? ` (from ${r.source_material_code})` : ""}` }));
    if (ruleType === "R2") {
      return (r2RulesQuery.data?.data ?? []).map((r) => {
        const deltaRaw = Number(r.delta_krw ?? 0);
        const singleMarginMode = r.margin_min_krw !== null && r.margin_max_krw !== null && Number(r.margin_min_krw) === Number(r.margin_max_krw);
        const effectiveDelta = singleMarginMode && deltaRaw === 0 ? Number(r.margin_min_krw ?? 0) : deltaRaw;
        return {
          id: r.rule_id,
          label: `Δ ${effectiveDelta > 0 ? "+" : effectiveDelta < 0 ? "-" : ""}${fmt(Math.abs(effectiveDelta))} / ${r.option_range_expr} / ${fmt(r.weight_min_g)}~${fmt(r.weight_max_g)}g`,
        };
      });
    }
    if (ruleType === "R3") {
      return (r3RulesQuery.data?.data ?? []).map((r) => {
        const deltaRaw = Number(r.delta_krw ?? 0);
        const singleMarginMode = Number(r.margin_min_krw) === Number(r.margin_max_krw);
        const effectiveDelta = singleMarginMode && deltaRaw === 0 ? Number(r.margin_min_krw ?? 0) : deltaRaw;
        return { id: r.rule_id, label: `${r.color_code} / Δ ${effectiveDelta > 0 ? "+" : effectiveDelta < 0 ? "-" : ""}${fmt(Math.abs(effectiveDelta))}` };
      });
    }
    return (r4RulesQuery.data?.data ?? []).map((r) => ({ id: r.rule_id, label: r.match_decoration_code }));
  };

  const getRuleRoundingLabel = (ruleType: SyncRuleType, ruleId: string) => {
    if (!ruleId) return "-";
    if (ruleType === "R2") {
      const rule = (r2RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return "-";
      return `${fmt(rule.rounding_unit ?? 100)} / ${roundingModeKo(rule.rounding_mode)}`;
    }
    if (ruleType === "R3") {
      const rule = (r3RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return "-";
      return `${fmt(rule.rounding_unit ?? 100)} / ${roundingModeKo(rule.rounding_mode)}`;
    }
    if (ruleType === "R4") {
      const rule = (r4RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return "-";
      return `${fmt(rule.rounding_unit ?? 100)} / ${roundingModeKo(rule.rounding_mode)}`;
    }
    return "룰 고정";
  };

  const getRuleRoundingSpec = (ruleType: SyncRuleType, ruleId: string): { unit: number; mode: "CEIL" | "ROUND" | "FLOOR" } | null => {
    if (!ruleId) return null;
    if (ruleType === "R2") {
      const rule = (r2RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return null;
      return {
        unit: Number(rule.rounding_unit ?? 100),
        mode: (String(rule.rounding_mode ?? "ROUND").toUpperCase() as "CEIL" | "ROUND" | "FLOOR"),
      };
    }
    if (ruleType === "R3") {
      const rule = (r3RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return null;
      return {
        unit: Number(rule.rounding_unit ?? 100),
        mode: (String(rule.rounding_mode ?? "ROUND").toUpperCase() as "CEIL" | "ROUND" | "FLOOR"),
      };
    }
    if (ruleType === "R4") {
      const rule = (r4RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return null;
      return {
        unit: Number(rule.rounding_unit ?? 100),
        mode: (String(rule.rounding_mode ?? "ROUND").toUpperCase() as "CEIL" | "ROUND" | "FLOOR"),
      };
    }
    return null;
  };

  const getRuleDeltaBySelection = (ruleType: SyncRuleType, ruleId: string): number | null => {
    if (!ruleId) return null;
    if (ruleType === "R2") {
      const rule = (r2RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return null;
      const deltaRaw = Number(rule.delta_krw ?? 0);
      const singleMarginMode = rule.margin_min_krw !== null && rule.margin_max_krw !== null && Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
      return singleMarginMode && deltaRaw === 0 ? Number(rule.margin_min_krw ?? 0) : deltaRaw;
    }
    if (ruleType === "R3") {
      const rule = (r3RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      if (!rule) return null;
      const deltaRaw = Number(rule.delta_krw ?? 0);
      const singleMarginMode = Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
      return singleMarginMode && deltaRaw === 0 ? Number(rule.margin_min_krw ?? 0) : deltaRaw;
    }
    if (ruleType === "R4") {
      const rule = (r4RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
      return rule ? Number(rule.delta_krw ?? 0) : null;
    }
    return null;
  };

  const getR2ClassificationBreadcrumb = (
    ruleId: string,
    representativeRow: DashboardRow | undefined,
    representativeVariantCode: string,
  ) => {
    if (!ruleId) return "소재 -> 카테고리 -> 중량범위 (룰 선택 필요)";
    const rule = (r2RulesQuery.data?.data ?? []).find((r) => r.rule_id === ruleId);
    if (!rule) return "소재 -> 카테고리 -> 중량범위 (룰 없음)";

    const variantOptions = variantOptionsByCode.get(representativeVariantCode) ?? [];
    const materialOpt = variantOptions.find((o) => {
      const n = o.name.toLowerCase();
      return n.includes("소재") || n.includes("material");
    });

    const material = materialOpt?.value ?? representativeRow?.material_code ?? rule.match_material_code ?? "*";
    const category = representativeRow?.category_code ?? rule.match_category_code ?? "*";
    const weight = representativeRow?.net_weight_g;
    const range = `${fmt(rule.weight_min_g)}~${fmt(rule.weight_max_g)}g`;
    const weightInfo = typeof weight === "number" && Number.isFinite(weight) ? `${fmt(weight)}g` : "-";
    const delta = Number(rule.delta_krw ?? 0);
    const deltaLabel = `Δ ${delta > 0 ? "+" : delta < 0 ? "-" : ""}${fmt(Math.abs(delta))}`;
    const optionRange = String(rule.option_range_expr ?? "").trim() || "-";
    const ruleShort = rule.rule_id.slice(0, 8);

    return `${ruleShort} / ${deltaLabel} / ${material} -> ${category} -> ${range} / 옵션구간 ${optionRange} (현재중량 ${weightInfo})`;
  };

  const canApplyAxisPolicy = (axis: string) => {
    const draft = axisPolicyDrafts[axis];
    if (!draft) return false;
    const group = optionAxisGroups.find((g) => g.axis === axis);
    if (!group || group.values.length === 0) return false;
    if (draft.mode === "OVERRIDE") {
      return group.values.every((v) => {
        const n = Number(draft.values[v.value]?.deltaKrw ?? "0");
        return Number.isFinite(n);
      });
    }
    const hasSyncValue = group.values.some((v) => (draft.values[v.value]?.mode ?? "SYNC") === "SYNC");
    if (draft.mode === "SYNC" && !allowedRuleTypesForAxis(axis).includes(draft.ruleType)) {
      return false;
    }
    if (!hasSyncValue) return true;
    if (!bulkGlobalRuleSetId) return false;
    return group.values
      .filter((v) => (draft.values[v.value]?.mode ?? "SYNC") === "SYNC")
      .every((v) => Boolean(draft.values[v.value]?.ruleId));
  };

  const isColorAxis = (axis: string) => {
    return isColorAxisName(axis);
  };

  const isMaterialAxis = (axis: string) => {
    return isMaterialAxisName(axis);
  };

  const getEffectiveRuleDeltaForValue = (
    axisDraft: AxisPolicyDraft,
    valueDraft: AxisValueDraft,
  ) => {
    if (axisDraft.mode !== "SYNC" || valueDraft.mode !== "SYNC") return 0;
    const selectedRuleDelta = getRuleDeltaBySelection(axisDraft.ruleType, valueDraft.ruleId);
    if (selectedRuleDelta != null) return selectedRuleDelta;
    return 0;
  };

  const alignAxisValueAmounts = (axis: string) => {
    const group = optionAxisGroups.find((g) => g.axis === axis);
    const draft = axisPolicyDrafts[axis];
    if (!group || !draft || group.values.length === 0) {
      toast.error("정렬할 옵션축 정보가 없습니다");
      return;
    }

    const computeCombined = (value: string) => {
      const key = `${axis}::${value}`;
      const affectedRows = optionValueMappingsByKey.get(key) ?? [];
      const currentDeltaAvg =
        affectedRows.length > 0
          ? affectedRows.reduce((sum, r) => sum + Number(r.option_price_delta_krw ?? 0), 0) / affectedRows.length
          : 0;
      const currentOptionTotalAvg =
        affectedRows.length > 0
          ? affectedRows.reduce((sum, r) => {
              const optionTotal = Number(rowsByChannelProduct.get(r.channel_product_id)?.option_price_delta_krw ?? 0);
              return sum + (Number.isFinite(optionTotal) ? optionTotal : 0);
            }, 0) / affectedRows.length
          : 0;
      const valueDraft = draft.values[value] ?? { mode: "SYNC", ruleId: "", deltaKrw: "0" };
      const draftDelta = Number(valueDraft.deltaKrw);
      const normalizedDraftDelta = Number.isFinite(draftDelta) ? Math.round(draftDelta) : 0;
      const effectiveRuleDelta = getEffectiveRuleDeltaForValue(draft, valueDraft);
      return {
        combined: normalizedDraftDelta + effectiveRuleDelta,
        effectiveRuleDelta,
        valueDraft,
      };
    };

    const baseline = computeCombined(group.values[0].value);
    const targetCombined = baseline.combined;

    const nextValues: Record<string, AxisValueDraft> = { ...draft.values };
    for (const item of group.values) {
      const calc = computeCombined(item.value);
      const nextDelta = Math.round(targetCombined - calc.effectiveRuleDelta);
      nextValues[item.value] = {
        ...calc.valueDraft,
        deltaKrw: String(nextDelta),
      };
    }

    updateAxisDraft(axis, { values: nextValues });
    toast.success(`${axis} 옵션금액을 동일 기준으로 정렬했습니다`);
  };

  const setOptionGroupMode = (mode: "SINGLE" | "AND" | "OR") => {
    setOptionGroupFilterMode(mode);
    if (mode !== "SINGLE") return;
    const first = selectedOptionPairs[0];
    if (!first) {
      setOptionGroupSelections({});
      return;
    }
    setOptionGroupSelections({ [first.axis]: [first.value] });
  };

  const toggleOptionGroupSelection = (axis: string, value: string) => {
    setOptionGroupSelections((prev) => {
      if (optionGroupFilterMode === "SINGLE") {
        const current = prev[axis] ?? [];
        if (current.length === 1 && current[0] === value && Object.keys(prev).length === 1) {
          return {};
        }
        return { [axis]: [value] };
      }

      const current = prev[axis] ?? [];
      const has = current.includes(value);
      const nextAxisValues = has ? current.filter((v) => v !== value) : [...current, value];
      const next = { ...prev };
      if (nextAxisValues.length === 0) {
        delete next[axis];
      } else {
        next[axis] = nextAxisValues;
      }
      return next;
    });
  };

  const toggleOptionGroupBucket = (bucket: number) => {
    setOptionGroupSelectedBuckets((prev) => {
      if (prev.includes(bucket)) return prev.filter((v) => v !== bucket);
      return [...prev, bucket].sort((a, b) => b - a);
    });
  };

  return (
    <div className="space-y-4">
      <ActionBar
        title="가격 대시보드"
        subtitle="마스터 1행 + 상세 옵션 관리"
        actions={(
          <>
            <Button variant="secondary" onClick={() => doPull.mutate()} disabled={!activeChannelId || doPull.isPending}>
              {doPull.isPending ? "불러오는 중..." : "현재가 불러오기(기본가)"}
            </Button>
            <Button variant="secondary" onClick={() => doRecompute.mutate()} disabled={!activeChannelId || doRecompute.isPending}>
              {doRecompute.isPending ? "재계산 중..." : "재계산"}
            </Button>
            <Button onClick={() => doPush.mutate()} disabled={!activeChannelId || doPush.isPending}>
              {doPush.isPending ? "반영 중..." : "선택 마스터 전체 push"}
            </Button>
          </>
        )}
      />

      <ShoppingPageHeader
        purpose="채널 현재가를 기준가와 비교하고, 옵션/룰 조정 후 재계산-반영까지 한 번에 운영합니다."
        status={[
          { label: "전체", value: `${fmt(summaryQuery.data?.data.counts.total)}` },
          { label: "불일치", value: `${fmt(summaryQuery.data?.data.counts.out_of_sync)}`, tone: (summaryQuery.data?.data.counts.out_of_sync ?? 0) > 0 ? "warn" : "good" },
          { label: "오류", value: `${fmt(summaryQuery.data?.data.counts.error)}`, tone: (summaryQuery.data?.data.counts.error ?? 0) > 0 ? "warn" : "good" },
        ]}
        nextActions={[
          { label: "옵션 룰 설정", href: "/settings/shopping/rules" },
          { label: "동기화 로그 확인", href: "/settings/shopping/sync-jobs" },
        ]}
      />

      <Card>
        <CardHeader title="요약" description={`전체 ${fmt(summaryQuery.data?.data.counts.total)} / 불일치 ${fmt(summaryQuery.data?.data.counts.out_of_sync)} / 오류 ${fmt(summaryQuery.data?.data.counts.error)}`} />
        <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Select value={activeChannelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">채널 선택</option>
            {channels.map((ch) => (
              <option key={ch.channel_id} value={ch.channel_id}>{ch.channel_name}</option>
            ))}
          </Select>
          <Select value={priceState} onChange={(e) => setPriceState(e.target.value)}>
            <option value="">상태 전체</option>
            <option value="OK">정상</option>
            <option value="OUT_OF_SYNC">불일치</option>
            <option value="ERROR">오류</option>
          </Select>
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="모델명 검색" />
          <Button
            variant="secondary"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const row of masterRows) next[row.master_item_id] = true;
              setSelectedMasters(next);
            }}
          >
            마스터 전체 선택
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="마스터 갤러리" description={`마스터 ${masterRows.length}건 / 선택 ${selectedMasterIds.length}건`} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={dashboardViewTab === "MASTER_GALLERY" ? "primary" : "secondary"} onClick={() => setDashboardViewTab("MASTER_GALLERY")}>가격 대시보드 갤러리</Button>
            <Button variant={dashboardViewTab === "OPTION_GROUPS" ? "primary" : "secondary"} onClick={() => setDashboardViewTab("OPTION_GROUPS")}>옵션별 묶어보기</Button>
          </div>

          {dashboardViewTab === "MASTER_GALLERY" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    for (const row of masterRows) next[row.master_item_id] = true;
                    setSelectedMasters(next);
                  }}
                >
                  전체 선택
                </Button>
                <Button variant="secondary" onClick={() => setSelectedMasters({})}>선택 해제</Button>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {masterRows.map((row) => {
                  const imageUrl = masterImageById.get(row.master_item_id) ?? null;
                  const isSelected = selectedMasters[row.master_item_id] ?? false;
                  return (
                    <div
                      key={row.master_item_id}
                      className={`relative overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] transition hover:border-[var(--primary)] ${effectiveDetailMasterId === row.master_item_id ? "ring-2 ring-[var(--primary)]" : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setDetailMasterId(row.master_item_id);
                          setIsDetailDrawerOpen(true);
                        }}
                      >
                        <div className="relative aspect-square bg-[var(--subtle-bg)]">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt={row.model_name ?? row.product_no} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">이미지 없음</div>
                          )}
                          <div className="absolute right-2 top-2 rounded-full bg-[var(--panel)]/90 px-2 py-1 text-xs">
                            {toStateKo(row.price_state)}
                          </div>
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="truncate text-sm font-semibold">{row.model_name ?? "-"}</div>
                          <div className="text-xs text-[var(--muted)]">{row.product_no} / 옵션 {row.option_count}개</div>
                          <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-2 text-xs">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                              <div>
                                <div className="text-[var(--muted)]">실몰 가격(live)</div>
                                <div className="font-semibold">{fmt(row.base_current_krw)}</div>
                              </div>
                              <div>
                                <div className="text-[var(--muted)]">게시 기준 원본가</div>
                                <div className="font-semibold">{fmt(row.master_original_krw ?? row.final_price_krw)}</div>
                              </div>
                              <div>
                                <div className="text-[var(--muted)]">마진</div>
                                <div className="font-semibold">{row.margin_pct == null ? "-" : `${row.margin_pct.toFixed(1)}%`}</div>
                              </div>
                              <div>
                                <div className="text-[var(--muted)]">갱신 시각</div>
                                <div className="font-semibold">{fmtDateTime(row.latest_updated_at)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-[var(--hairline)] pt-2 text-xs font-semibold text-[var(--muted-strong)]">
                            상세보기
                          </div>
                        </div>
                      </button>
                      <label className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[var(--panel)]/90 px-2 py-1 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedMasters((prev) => ({ ...prev, [row.master_item_id]: e.target.checked }))}
                        />
                        선택
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded border border-[var(--hairline)] bg-[var(--background)] p-3">
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                  <span className="text-sm font-medium">조건</span>
                  <Button size="sm" variant={optionGroupFilterMode === "SINGLE" ? "primary" : "secondary"} onClick={() => setOptionGroupMode("SINGLE")}>단일</Button>
                  <Button size="sm" variant={optionGroupFilterMode === "AND" ? "primary" : "secondary"} onClick={() => setOptionGroupMode("AND")}>AND</Button>
                  <Button size="sm" variant={optionGroupFilterMode === "OR" ? "primary" : "secondary"} onClick={() => setOptionGroupMode("OR")}>OR</Button>
                  <Button
                    size="sm"
                    variant={optionGroupPriceBasis === "RULE" ? "primary" : "secondary"}
                    onClick={() => {
                      setOptionGroupPriceBasis("RULE");
                      setOptionGroupSelectedBuckets([]);
                    }}
                  >
                    룰기여금 기준
                  </Button>
                  <Button
                    size="sm"
                    variant={optionGroupPriceBasis === "TOTAL" ? "primary" : "secondary"}
                    onClick={() => {
                      setOptionGroupPriceBasis("TOTAL");
                      setOptionGroupSelectedBuckets([]);
                    }}
                  >
                    SoT 기준
                  </Button>
                  {optionGroupBucketChips.map((chip) => {
                    const active = optionGroupSelectedBuckets.includes(chip.bucket);
                    return (
                      <Button
                        key={`bucket-chip-${chip.bucket}`}
                        size="sm"
                        variant={active ? "primary" : "secondary"}
                        onClick={() => toggleOptionGroupBucket(chip.bucket)}
                      >
                        {signedFmt(chip.bucket)} ({chip.count})
                      </Button>
                    );
                  })}
                  {optionGroupFacetChips.map((chip) => {
                    const isActive = (optionGroupSelections[chip.axis] ?? []).includes(chip.value);
                    return (
                      <Button
                        key={`${chip.axis}-${chip.value}`}
                        size="sm"
                        variant={isActive ? "primary" : "secondary"}
                        onClick={() => toggleOptionGroupSelection(chip.axis, chip.value)}
                      >
                        {chip.axis}:{chip.value} ({chip.count})
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOptionGroupSelections({});
                      setOptionGroupSelectedBuckets([]);
                    }}
                  >
                    초기화
                  </Button>
                  <Input
                    value={optionGroupSearch}
                    onChange={(e) => setOptionGroupSearch(e.target.value)}
                    placeholder="검색"
                    className="w-56"
                  />
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  검색 결과 {optionGroupedGalleryItems.length}개 / 버킷 {optionGroupedBySelectedBuckets.length}개
                </div>
              </div>

              <div className="space-y-3">
                {optionGroupedBySelectedBuckets.length === 0 ? (
                  <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-6 text-center text-sm text-[var(--muted)]">
                    선택한 조건에 해당하는 옵션 버킷이 없습니다.
                  </div>
                ) : null}
                {optionGroupedBySelectedBuckets.map((bucket) => (
                  <div key={`bucket-${bucket.bucket}`} className="rounded border border-[var(--hairline)] bg-[var(--background)] p-2 space-y-2">
                    <div className="text-sm font-semibold">
                      {optionGroupPriceBasis === "RULE" ? "룰기여금" : "게시 기준 추가금"} {signedFmt(bucket.bucket)} ({bucket.items.length}개)
                    </div>
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                      {bucket.items.map((item) => {
                        const imageUrl = detailImageUrl;
                        const options = variantOptionsByCode.get(item.variantCode) ?? [];
                        const optionName = options.length > 0
                          ? options.map((o) => `${o.name}:${o.value}`).join(" / ")
                          : item.variantCode;
                        return (
                          <div key={item.channelProductId} className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] overflow-hidden">
                            <div className="relative aspect-square bg-[var(--subtle-bg)]">
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageUrl} alt={item.variantCode} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">이미지 없음</div>
                              )}
                            </div>
                            <div className="space-y-1 p-3 text-xs">
                              <div className="font-semibold">{optionName}</div>
                              <div className="text-[10px] text-[var(--muted)] font-mono">{item.productNo} / {item.variantCode}</div>
                              <div className="text-[var(--muted)]">{item.row?.model_name ?? detailTitle}</div>
                              <div className="text-[var(--muted)]">{optionStrategyLabel(item.mapping)}</div>
                              <div>
                                룰기여금 {signedFmt(item.ruleOptionDelta)}
                                <span className="ml-1 text-[10px] text-[var(--muted)]">({item.ruleDeltaSource === "POLICY" ? "정책" : "역산"})</span>
                              </div>
                              <div>게시 기준 추가금 {signedFmt(item.totalOptionDelta)}</div>
                              <div>수동 저장 추가금 {signedFmt(item.manualOptionDelta)}</div>
                              <div>목표 {fmt(item.row?.final_target_price_krw)}</div>
                              <div className="rounded border border-[var(--hairline)] bg-[var(--background)] p-1">
                                {options.length === 0 ? (
                                  <div className="text-[var(--muted)]">옵션 정보 없음</div>
                                ) : (
                                  options.map((o) => (
                                    <div key={`${item.channelProductId}-${o.name}-${o.value}`} className="text-[11px] text-[var(--muted)]">{o.name}: {o.value}</div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Sheet
        open={Boolean(effectiveDetailMasterId) && isDetailDrawerOpen}
        onOpenChange={(open) => {
          setIsDetailDrawerOpen(open);
        }}
        title="마스터 상세"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="text-sm font-semibold">옵션 상세</div>
            <div className="text-xs text-[var(--muted)]">master_item_id: {effectiveDetailMasterId || "-"}</div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {effectiveDetailMasterId ? (
              <>
                <section className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="relative aspect-square overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--subtle-bg)]">
                        {detailImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={detailImageUrl} alt={detailTitle} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">이미지 없음</div>
                        )}
                        <div className="absolute left-2 top-2 rounded bg-[var(--panel)]/90 px-2 py-1 text-xs">{toStateKo(detailMasterRow?.price_state ?? "UNMAPPED")}</div>
                      </div>
                      <div className="flex items-center gap-2 rounded border border-[var(--hairline)] bg-[var(--background)] p-2">
                        <div className="h-14 w-14 overflow-hidden rounded border border-[var(--hairline)] bg-[var(--subtle-bg)]">
                          {detailImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={detailImageUrl} alt={`${detailTitle} thumb`} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="text-xs text-[var(--muted)]">대표 이미지 미리보기</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="border-b border-[var(--hairline)] pb-3">
                        <div className="text-xs text-[var(--muted)]">홈 / 쇼핑몰 대시보드 / 마스터 상세</div>
                        <h3 className="mt-2 text-2xl font-semibold leading-tight">{detailTitle}</h3>
                        <div className="mt-1 text-xs text-[var(--muted)]">상품번호 {detailMasterRow?.product_no || "-"} / 옵션 {detailMasterRow?.option_count ?? 0}개</div>
                      </div>

                      <div className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                        <div className="text-[var(--muted)]">실몰 가격(live)</div>
                        <div className="text-lg font-semibold">{fmt(detailMasterRow?.base_current_krw ?? null)}원</div>
                        <div className="text-[var(--muted)]">게시 기준 원본가</div>
                        <div>{fmt(detailMasterOriginal)}원</div>
                        <div className="text-[var(--muted)]">게시 기준 목표가</div>
                        <div>{fmt(detailFinalTarget)}원</div>
                        <div className="text-[var(--muted)]">마진</div>
                        <div>{detailMasterRow?.margin_pct == null ? "-" : `${detailMasterRow.margin_pct.toFixed(1)}%`}</div>
                        <div className="text-[var(--muted)]">갱신 시각</div>
                        <div>{fmtDateTime(detailMasterRow?.latest_updated_at)}</div>
                      </div>

                      <div className="rounded border border-[var(--hairline)] bg-[var(--background)] p-3 text-sm">
                        <div className="text-xs text-[var(--muted)]">가격 구성식</div>
                        <div className="mt-1 font-semibold">{fmt(detailMasterOriginal)} {detailBaseDeltaTotal >= 0 ? "+" : "-"} {fmt(Math.abs(detailBaseDeltaTotal))} = {fmt(detailFinalTarget)}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">(마스터 원본가 +/- 조정 누적 = 운영 목표가)</div>
                        <div className="mt-2 rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-xs">
                          <span className="text-[var(--muted)]">게시 버전:</span>{" "}
                          <span className="font-semibold">{pinnedComputeRequestId || "-"}</span>
                        </div>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedMasterIdForDrawer(effectiveDetailMasterId);
                              setIsSnapshotDrawerOpen(true);
                            }}
                            disabled={!activeChannelId || !effectiveDetailMasterId}
                          >
                            V2 계산 근거
                          </Button>
                          <div className="mt-1 text-[11px] text-[var(--muted)]">이 버튼은 게시 기준 계산 근거를 여는 debug 화면입니다.</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto]">
                        <Input value={baseDeltaAmount} onChange={(e) => setBaseDeltaAmount(e.target.value)} placeholder="조정금액" />
                        <Input value={baseDeltaReason} onChange={(e) => setBaseDeltaReason(e.target.value)} placeholder="사유(필수)" />
                        <Button variant="secondary" onClick={() => addBaseAdjustment.mutate(1)} disabled={addBaseAdjustment.isPending}>+ 적용</Button>
                        <Button variant="secondary" onClick={() => addBaseAdjustment.mutate(-1)} disabled={addBaseAdjustment.isPending}>- 적용</Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (!window.confirm("현재 마스터의 기준보정 로그를 모두 삭제하고 0으로 초기화하시겠습니까?")) return;
                            clearBaseAdjustmentsForMaster.mutate();
                          }}
                          disabled={clearBaseAdjustmentsForMaster.isPending}
                        >
                          {clearBaseAdjustmentsForMaster.isPending ? "초기화 중..." : "보정 0 초기화"}
                        </Button>
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        기준보정Δ는 옵션룰(R1~R4)이 아니라 기본값 조정 누적입니다. 0으로 초기화하면 옵션에서 지정한 값만 반영됩니다.
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={detailMappings.every((m) => m.include_master_plating_labor !== false)}
                          onChange={(e) =>
                            togglePlating.mutate({
                              master_item_id: effectiveDetailMasterId,
                              include_master_plating_labor: e.target.checked,
                            })
                          }
                        />
                        마스터 도금공임 포함
                      </label>
                    </div>
                  </div>
                </section>

                <div className="text-xs text-[var(--muted)]">R2=사이즈/중량구간, R3=색상도금마진, R4=장식</div>
                <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-sm">
                  <span className="text-[var(--muted)]">마스터 등록 소재:</span>{" "}
                  <span className="font-semibold">{detailMasterRow?.material_code ?? "-"}</span>
                </div>

                <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                  <div className="mb-2 text-sm font-semibold">옵션 카테고리 일괄 수정 ({totalCategoryValueCount}개)</div>
                  <div className="mb-3 text-xs text-[var(--muted)]">일괄수정 버튼을 누르면 좌측 드로어에서 카테고리값을 고르고, Sync 선택 시 R1~R4 룰과 세부 룰 항목을 고른 뒤 적용할 수 있습니다.</div>
                  <div className="mb-3 rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs">
                    마스터 소재 <span className="font-semibold">{masterMaterialInfo.masterMaterial || "-"}</span>
                  </div>
                  <Button variant="secondary" onClick={openBulkPolicyDrawer} disabled={optionAxisGroups.length === 0}>일괄수정 열기</Button>
                </div>

                <div className="max-h-[320px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        {optionAxisNames.map((axis) => (
                          <th key={axis} className="px-3 py-2 whitespace-nowrap">{axis}</th>
                        ))}
                        <th className="px-3 py-2 whitespace-nowrap">수동Δ</th>
                        <th className="px-3 py-2 whitespace-nowrap">R2Δ(사이즈)</th>
                        <th className="px-3 py-2 whitespace-nowrap">R3Δ(색상)</th>
                        <th className="px-3 py-2 whitespace-nowrap">룰합Δ(R2~R4)</th>
                        <th className="px-3 py-2 whitespace-nowrap">총옵션Δ(수동+룰)</th>
                        <th className="px-3 py-2 whitespace-nowrap">기준보정Δ</th>
                        <th className="px-3 py-2 whitespace-nowrap">실몰 현재가</th>
                        <th className="px-3 py-2 whitespace-nowrap">게시 기준 최종가</th>
                        <th className="px-3 py-2 whitespace-nowrap">게시-실몰 차이</th>
                        <th className="px-3 py-2 whitespace-nowrap">적용 방식</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailVariantRowsForTable.map((item) => {
                        const variantCode = item.variantCode;
                        const m = item.mapping;
                        const row = item.row;
                        const breakdown = item.breakdown;
                        const manualDelta = Math.round(Number(m?.option_price_delta_krw ?? 0));
                        const currentPriceNum = Number(row?.current_channel_price_krw ?? Number.NaN);
                        const finalPriceNum = Number(row?.final_target_price_krw ?? Number.NaN);
                        const impliedOptionDeltaFromBase = Number.isFinite(finalPriceNum)
                          ? Math.round(finalPriceNum - detailOptionBaseTargetKrw)
                          : null;
                        const syncGapDelta = Number.isFinite(currentPriceNum) && Number.isFinite(finalPriceNum)
                          ? Math.round(finalPriceNum - currentPriceNum)
                          : null;
                        const ruleDelta = breakdown
                          ? Math.round(Number(breakdown.total_delta_krw ?? 0))
                          : impliedOptionDeltaFromBase != null
                            ? Math.round(impliedOptionDeltaFromBase - manualDelta)
                            : Math.round(Number((row?.option_price_delta_krw ?? 0) - manualDelta));
                        const r2Delta = breakdown ? Math.round(Number(breakdown.r2_delta_krw ?? 0)) : null;
                        const colorRuleDelta = breakdown ? Math.round(Number(breakdown.r3_delta_krw ?? 0)) : null;
                        const pureOptionDelta = manualDelta + ruleDelta;
                        const baseAdjustmentDelta = Math.round(detailBaseDeltaTotal);
                        const opts = variantOptionsByCode.get(variantCode) ?? [];
                        return (
                          <tr key={`detail-variant-${variantCode}`} className="border-t border-[var(--hairline)]">
                            {optionAxisNames.map((axis) => {
                              const found = opts.find((o) => o.name === axis);
                              const value = found?.value ?? "-";
                              return <td key={`${variantCode}-${axis}`} className="px-3 py-2 whitespace-nowrap">{value}</td>;
                            })}
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(manualDelta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r2Delta == null ? "-" : fmt(r2Delta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{colorRuleDelta == null ? "-" : fmt(colorRuleDelta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(ruleDelta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(pureOptionDelta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(baseAdjustmentDelta)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(row?.current_channel_price_krw ?? null)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmt(row?.final_target_price_krw ?? null)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{syncGapDelta == null ? "-" : fmt(syncGapDelta)}</td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              {m ? optionStrategyLabel(m) : (row ? "가격미수집" : "미매핑")}
                              {breakdown && m ? (
                                <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                                  R2 {signedFmt(Math.round(Number(breakdown.r2_delta_krw ?? 0)))} / R3 {signedFmt(Math.round(Number(breakdown.r3_delta_krw ?? 0)))} / R4 {signedFmt(Math.round(Number(breakdown.r4_delta_krw ?? 0)))}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {optionEditDraft && editingChannelProductId ? (
                  <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                    <div className="mb-2 text-sm font-semibold">옵션 상세 수정</div>
                    <div className="mb-3 text-xs text-[var(--muted)]">옵션 분류를 직접 고르고(사이즈/도금/장식/기타), 추가금은 1000원 단위로 지정합니다.</div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                      <Select
                        value={getOptionRuleCategory(optionEditDraft)}
                        onChange={(e) =>
                          setOptionEditDraft((prev) =>
                            prev ? applyOptionRuleCategory(prev, e.target.value as OptionRuleCategory) : prev,
                          )
                        }
                      >
                        <option value="SIZE_RULE">1) 사이즈룰</option>
                        <option value="PLATING_RULE">2) 도금룰</option>
                        <option value="DECORATION_RULE">3) 장식룰</option>
                        <option value="MISC_OVERRIDE">4) 기타(수동)</option>
                      </Select>

                      <Select
                        value={optionEditDraft.sync_rule_set_id}
                        onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, sync_rule_set_id: e.target.value } : prev))}
                        disabled={optionEditDraft.option_price_mode !== "SYNC"}
                      >
                        <option value="">룰셋 선택</option>
                        {(syncRuleSetQuery.data?.data ?? []).map((rs) => (
                          <option key={rs.rule_set_id} value={rs.rule_set_id}>{rs.name}</option>
                        ))}
                      </Select>

                      <Select
                        value={optionEditDraft.option_price_delta_krw}
                        onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_price_delta_krw: e.target.value } : prev))}
                      >
                        <option value="">기존값 유지</option>
                        {thousandDeltaOptions.map((value) => (
                          <option key={value} value={String(value)}>{deltaOptionLabel(value)}</option>
                        ))}
                      </Select>

                      <Input
                        value={optionEditDraft.option_manual_target_krw}
                        onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_manual_target_krw: e.target.value } : prev))}
                        placeholder="수동 목표가"
                        disabled={getOptionRuleCategory(optionEditDraft) !== "MISC_OVERRIDE"}
                      />

                      <Button
                        variant="secondary"
                        onClick={() => previewSyncRule.mutate({ ruleSetId: optionEditDraft.sync_rule_set_id, channelProductId: editingChannelProductId })}
                        disabled={optionEditDraft.option_price_mode !== "SYNC" || !optionEditDraft.sync_rule_set_id}
                      >
                        Sync 미리보기
                      </Button>
                    </div>

                    <div className="mt-2 rounded border border-[var(--hairline)] bg-[var(--background)] p-2 text-xs">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div>
                          <div className="text-[var(--muted)]">현재 목표가</div>
                          <div className="font-semibold">{fmt(editingDashboardRow?.final_target_price_krw ?? null)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--muted)]">예상 반영값</div>
                          <div className="font-semibold">{fmt(expectedTargetPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--muted)]">계산 근거</div>
                          <div className="font-semibold">
                            {getOptionRuleCategory(optionEditDraft) === "MISC_OVERRIDE"
                              ? `Override 목표가 ${fmt(manualDraftTarget)}`
                              : syncPreviewDeltaForEditing == null
                                ? `현재 룰추가금 + 수동추가금 ${fmt(Number(optionEditDraft.option_price_delta_krw || 0))}`
                                : `Sync ${fmt(syncPreviewDeltaForEditing)} + 수동추가금 ${fmt(Number(optionEditDraft.option_price_delta_krw || 0))}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-[var(--muted)]">
                      변경 전: {fmt(optionEditOriginalDelta)} / 변경 후: {fmt(Number(optionEditDraft.option_price_delta_krw || 0))}
                    </div>

                    <div className="mt-2 rounded border border-[var(--hairline)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
                      마스터 등록 소재: <span className="font-medium text-[var(--text)]">{detailMasterMaterialCode ?? "-"}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                      <Input value={optionEditDraft.option_material_code} onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_material_code: e.target.value } : prev))} placeholder="소재 코드" />
                      <Input value={optionEditDraft.option_color_code} onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_color_code: e.target.value } : prev))} placeholder="색상 코드" />
                      <Input value={optionEditDraft.option_decoration_code} onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_decoration_code: e.target.value } : prev))} placeholder="장식 코드" />
                      <Input value={optionEditDraft.option_size_value} onChange={(e) => setOptionEditDraft((prev) => (prev ? { ...prev, option_size_value: e.target.value } : prev))} placeholder="사이즈 값" />
                    </div>

                    <div className="mt-2 text-xs text-[var(--muted)]">
                      선택 분류 기준으로 룰이 적용됩니다: 사이즈룰=R2, 도금룰=R3, 장식룰=R4, 기타=Override
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => saveOptionEdit.mutate()} disabled={saveOptionEdit.isPending}>{saveOptionEdit.isPending ? "저장 중..." : "옵션 저장"}</Button>
                      <Button variant="secondary" onClick={cancelOptionEdit}>취소</Button>
                    </div>
                  </div>
                ) : null}

                <div className="max-h-[200px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">시각</th>
                        <th className="px-3 py-2 whitespace-nowrap">delta</th>
                        <th className="px-3 py-2 whitespace-nowrap">사유</th>
                        <th className="px-3 py-2 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(baseLogsQuery.data?.data ?? []).map((log) => {
                        const isEditing = editingBaseLogId === log.adjustment_log_id;
                        return (
                          <tr key={log.adjustment_log_id} className="border-t border-[var(--hairline)]">
                            <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {isEditing ? (
                                <Input
                                  value={editingBaseLogDelta}
                                  onChange={(e) => setEditingBaseLogDelta(e.target.value)}
                                  className="w-28"
                                />
                              ) : fmt(log.delta_krw)}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Input
                                  value={editingBaseLogReason}
                                  onChange={(e) => setEditingBaseLogReason(e.target.value)}
                                />
                              ) : log.reason}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <Button size="sm" onClick={() => updateBaseAdjustment.mutate()} disabled={updateBaseAdjustment.isPending}>
                                    {updateBaseAdjustment.isPending ? "저장중" : "저장"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setEditingBaseLogId(null);
                                      setEditingBaseLogDelta("");
                                      setEditingBaseLogReason("");
                                    }}
                                  >
                                    취소
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setEditingBaseLogId(log.adjustment_log_id);
                                      setEditingBaseLogDelta(String(Math.round(Number(log.delta_krw ?? 0))));
                                      setEditingBaseLogReason(String(log.reason ?? ""));
                                    }}
                                  >
                                    수정
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      if (!window.confirm("해당 조정 이력을 삭제하시겠습니까?")) return;
                                      deleteBaseAdjustment.mutate(log.adjustment_log_id);
                                    }}
                                    disabled={deleteBaseAdjustment.isPending}
                                  >
                                    삭제
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--muted)]">마스터를 선택하면 옵션 상세가 표시됩니다.</div>
            )}
          </div>
        </div>
      </Sheet>

      <PricingSnapshotDrawer
        open={isSnapshotDrawerOpen}
        onOpenChange={setIsSnapshotDrawerOpen}
        row={snapshotExplainQuery.data?.data ?? null}
        loading={snapshotExplainQuery.isFetching}
        errorMessage={snapshotExplainQuery.error instanceof Error ? snapshotExplainQuery.error.message : null}
        currentChannelPriceKrw={snapshotCurrentChannelPriceKrw}
      />

      <Sheet
        open={isBulkPolicyDrawerOpen}
        onOpenChange={(open) => {
          setIsBulkPolicyDrawerOpen(open);
          if (!open) {
            setSyncPreview(null);
          }
        }}
        title="옵션 카테고리 일괄수정"
        side="left"
        className="lg:w-[1320px]"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="text-sm font-semibold">옵션 카테고리 일괄수정</div>
            <div className="text-xs text-[var(--muted)]">옵션축(소재/색상 등) 정책을 먼저 정하고, Sync면 룰을 연결합니다.</div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => applyAllCategoryPolicies.mutate()}
                disabled={applyAllCategoryPolicies.isPending || applyCategoryPolicy.isPending}
              >
                {applyAllCategoryPolicies.isPending ? "전체 저장 중..." : "전체 옵션 저장"}
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            <div className="space-y-3">
              {optionAxisGroups.map((group) => {
                const rawDraft = axisPolicyDrafts[group.axis] ?? {
                  mode: "SYNC" as const,
                  ruleType: guessRuleByAxis(group.axis),
                  values: Object.fromEntries(
                    group.values.map((v) => [
                      v.value,
                      { mode: "SYNC", ruleId: "", deltaKrw: "0" } satisfies AxisValueDraft,
                    ]),
                  ) as Record<string, AxisValueDraft>,
                };
                const draft: AxisPolicyDraft = {
                  ...rawDraft,
                  ruleType: normalizeRuleTypeForAxis(group.axis, rawDraft.ruleType),
                };
                const allowedRuleTypes = allowedRuleTypesForAxis(group.axis);
                const isRuleTypeIncompatible = draft.mode === "SYNC" && !allowedRuleTypes.includes(rawDraft.ruleType);
                const ruleOptions = getRuleOptions(draft.ruleType);
                const canApply = canApplyAxisPolicy(group.axis);
                const affectedCount = axisAffectedCountByAxis.get(group.axis) ?? 0;
                const hasSyncValue = draft.mode === "SYNC" && group.values.some((item) => (draft.values[item.value]?.mode ?? "SYNC") === "SYNC");
                const deltaOptionsForGroup = isMaterialAxisName(group.axis)
                  ? [0]
                  : thousandDeltaOptions;
                const computeCombinedOptionDelta = (item: OptionValueItem, valueDraft: AxisValueDraft) => {
                  const key = `${item.axis}::${item.value}`;
                  const affectedRows = optionValueMappingsByKey.get(key) ?? [];
                  const currentManualAvg =
                    affectedRows.length > 0
                      ? affectedRows.reduce((sum, r) => sum + Number(r.option_price_delta_krw ?? 0), 0) / affectedRows.length
                      : 0;
                  const currentOptionTotalAvg =
                    affectedRows.length > 0
                      ? affectedRows.reduce((sum, r) => {
                          const optionTotal = Number(rowsByChannelProduct.get(r.channel_product_id)?.option_price_delta_krw ?? 0);
                          return sum + (Number.isFinite(optionTotal) ? optionTotal : 0);
                        }, 0) / affectedRows.length
                      : 0;
                  const currentRuleAvg = currentOptionTotalAvg - currentManualAvg;
                  const draftDelta = Number(valueDraft.deltaKrw);
                  const normalizedDraftDelta = Number.isFinite(draftDelta) ? Math.round(draftDelta) : 0;
                  const selectedRuleDeltaRaw =
                    draft.mode === "SYNC" && valueDraft.mode === "SYNC"
                      ? getRuleDeltaBySelection(draft.ruleType, valueDraft.ruleId)
                      : 0;
                  const selectedRuleDelta =
                    selectedRuleDeltaRaw == null
                      ? null
                      : (() => {
                          const spec = getRuleRoundingSpec(draft.ruleType, valueDraft.ruleId);
                          if (!spec) return Math.round(selectedRuleDeltaRaw);
                          return Math.round(roundByRule(selectedRuleDeltaRaw, spec.unit, spec.mode));
                        })();
                  const previewRuleDeltaAvg =
                    affectedRows.length > 0
                      ? (() => {
                          let sum = 0;
                          let count = 0;
                          for (const r of affectedRows) {
                            const b = optionRuleBreakdownByProduct.get(String(r.channel_product_id));
                            if (!b) continue;
                            const component =
                              draft.ruleType === "R1"
                                ? Number(b.r1_delta_krw ?? 0)
                                : draft.ruleType === "R2"
                                  ? Number(b.r2_delta_krw ?? 0)
                                  : draft.ruleType === "R3"
                                    ? Number(b.r3_delta_krw ?? 0)
                                    : Number(b.r4_delta_krw ?? 0);
                            sum += component;
                            count += 1;
                          }
                          return count > 0 ? Math.round(sum / count) : null;
                        })()
                      : null;
                  const fallbackRuleDeltaAtPoint = currentRuleAvg;
                  const hasExplicitRuleSelection = String(valueDraft.ruleId ?? "").trim().length > 0;
                  const shouldApplyRuleDelta = draft.ruleType === "R1" ? true : hasExplicitRuleSelection;
                  const effectiveRuleDelta =
                    draft.mode === "SYNC" && valueDraft.mode === "SYNC"
                      ? (shouldApplyRuleDelta ? (selectedRuleDelta ?? previewRuleDeltaAvg ?? fallbackRuleDeltaAtPoint) : 0)
                      : 0;
                  const ruleSource =
                    !shouldApplyRuleDelta
                      ? "DIRECT"
                      :
                    selectedRuleDelta != null
                      ? "RULE"
                      : previewRuleDeltaAvg != null
                        ? "PREVIEW"
                        : "FALLBACK";
                  return {
                    total: normalizedDraftDelta + Math.round(effectiveRuleDelta),
                    rule: Math.round(effectiveRuleDelta),
                    manual: normalizedDraftDelta,
                    ruleSource,
                  };
                };

                const baseValueItem = group.values.find((item) => (draft.values[item.value]?.mode ?? "SYNC") === "BASE") ?? null;
                const baseValueDraft = baseValueItem ? (draft.values[baseValueItem.value] ?? { mode: "SYNC", ruleId: "", deltaKrw: "0" }) : null;
                const baseCombinedOptionDelta =
                  baseValueItem && baseValueDraft
                    ? computeCombinedOptionDelta(baseValueItem, baseValueDraft)
                    : { total: 0, rule: 0, manual: 0 };

                const computeExpectedFinalFor = (item: OptionValueItem, combinedOptionDelta: number) => {
                  const key = `${item.axis}::${item.value}`;
                  const affectedRows = optionValueMappingsByKey.get(key) ?? [];
                  const currentOptionTotalAvg =
                    affectedRows.length > 0
                      ? affectedRows.reduce((sum, r) => {
                          const optionTotal = Number(rowsByChannelProduct.get(r.channel_product_id)?.option_price_delta_krw ?? 0);
                          return sum + (Number.isFinite(optionTotal) ? optionTotal : 0);
                        }, 0) / affectedRows.length
                      : 0;
                  const currentFinalAvg =
                    affectedRows.length > 0
                      ? affectedRows.reduce((sum, r) => {
                          const target = Number(rowsByChannelProduct.get(r.channel_product_id)?.final_target_price_krw ?? 0);
                          return sum + (Number.isFinite(target) ? target : 0);
                        }, 0) / affectedRows.length
                      : 0;
                  return affectedRows.length > 0
                    ? Math.round(currentFinalAvg - currentOptionTotalAvg + combinedOptionDelta)
                    : null;
                };

                const baseExpectedFinalApprox =
                  baseValueItem
                    ? computeExpectedFinalFor(baseValueItem, baseCombinedOptionDelta.total)
                    : null;

                return (
                  <div key={group.axis} className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3 space-y-2">
                    <div className="text-base font-semibold">{group.axis}</div>
                    <div className="text-sm text-[var(--muted)]">적용 대상 옵션 수: {fmt(affectedCount)}</div>
                    {isColorAxis(group.axis) ? (
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => alignAxisValueAmounts(group.axis)}
                        >
                          색상 동일금액 맞춤
                        </Button>
                      </div>
                    ) : null}

                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs text-[var(--muted)]">1열: 정책 모드</div>
                        <Select
                          value={draft.mode}
                          onChange={(e) => {
                            updateAxisDraft(group.axis, {
                              mode: e.target.value === "SYNC" ? "SYNC" : "OVERRIDE",
                            });
                            setSyncPreview(null);
                          }}
                        >
                          <option value="SYNC">Sync</option>
                          <option value="OVERRIDE">Override</option>
                        </Select>
                      </div>

                      <div>
                        <div className="mb-1 text-xs text-[var(--muted)]">2열: 연결 룰 타입</div>
                        <Select
                          value={draft.ruleType}
                          onChange={(e) => {
                            const nextRuleTypeRaw = e.target.value as SyncRuleType;
                            const nextRuleType = normalizeRuleTypeForAxis(group.axis, nextRuleTypeRaw);
                            if (nextRuleTypeRaw !== nextRuleType) {
                              toast.error(`${group.axis}: ${ruleTypeLabel(nextRuleTypeRaw)}는 적용할 수 없습니다. (${allowedRuleTypes.map(ruleTypeLabel).join(", ")}만 가능)`);
                            }
                            const r1Rules = r1RulesQuery.data?.data ?? [];
                            const baseValueForR1 = group.values.find((item) => (draft.values[item.value]?.mode ?? "SYNC") === "BASE")?.value;
                            const nextValues: Record<string, AxisValueDraft> = {};
                            for (const [valueKey, valueDraft] of Object.entries(draft.values)) {
                              const nextDraft: AxisValueDraft = { ...valueDraft, ruleId: "" };
                              if (nextRuleType === "R1" && draft.mode === "SYNC" && nextDraft.mode === "SYNC") {
                                const resolved = resolveR1RuleForValue(r1Rules, valueKey, baseValueForR1);
                                if (resolved?.rule_id) nextDraft.ruleId = resolved.rule_id;
                              }
                              nextValues[valueKey] = nextDraft;
                            }
                            updateAxisDraft(group.axis, { ruleType: nextRuleType, values: nextValues });
                            setSyncPreview(null);
                          }}
                          disabled={draft.mode !== "SYNC" || isMaterialAxisName(group.axis)}
                        >
                          <option value="R2" disabled={!allowedRuleTypes.includes("R2")}>R2 사이즈/중량</option>
                          <option value="R3" disabled={!allowedRuleTypes.includes("R3")}>R3 색상도금마진</option>
                          <option value="R4" disabled={!allowedRuleTypes.includes("R4")}>R4 장식</option>
                        </Select>
                        {isMaterialAxisName(group.axis) ? (
                          <div className="mt-1 text-[10px] text-[var(--muted)]">소재축은 표시용(추가금 0원 고정)</div>
                        ) : null}
                      </div>
                    </div>

                    {isRuleTypeIncompatible ? (
                      <div className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
                        이 옵션축은 {ruleTypeLabel(rawDraft.ruleType)}와 호환되지 않습니다. 가능한 룰 타입: {allowedRuleTypes.map(ruleTypeLabel).join(", ")}.
                      </div>
                    ) : null}

                    <div className="text-xs text-[var(--muted)]">
                      {draft.mode === "SYNC" ? "Sync 모드: 값별 전략/룰항목을 지정하고 추가금(+/-)을 더해 최종 옵션금액을 만듭니다." : "Override 모드: 값별 추가금(+/-)만 직접 관리합니다."}
                    </div>


                    <div className="rounded border border-[var(--hairline)] bg-[var(--background)] p-2">
                      <div className="mb-2 text-sm font-medium text-[var(--muted)]">옵션-규칙 작업 테이블</div>
                      <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--panel)] text-left">
                            <tr>
                              <th className="px-2 py-1">값</th>
                              <th className="px-2 py-1">적용 방식</th>
                              <th className="px-2 py-1">룰항목</th>
                              <th className="px-2 py-1">룰추가</th>
                              <th className="px-2 py-1">추가금(1000원)</th>
                              <th className="px-2 py-1">라운딩</th>
                              <th className="px-2 py-1">예상 옵션금액</th>
                              <th className="px-2 py-1">예상 최종금액</th>
                            </tr>
                          </thead>
                            <tbody>
                              {group.values.map((item) => {
                              const valueDraft = draft.values[item.value] ?? { mode: "SYNC", ruleId: "", deltaKrw: "0" };
                              const combinedOptionDelta = computeCombinedOptionDelta(item, valueDraft);
                              const ruleDeltaAbsolute = combinedOptionDelta.rule;
                              const manualDeltaAbsolute = combinedOptionDelta.manual;
                              const ruleDeltaVsBase = baseValueItem ? (combinedOptionDelta.rule - baseCombinedOptionDelta.rule) : combinedOptionDelta.rule;
                              const manualDeltaVsBase = baseValueItem ? (combinedOptionDelta.manual - baseCombinedOptionDelta.manual) : combinedOptionDelta.manual;
                              const optionAmountForDisplay = ruleDeltaVsBase + manualDeltaVsBase;
                              const expectedFinalApprox =
                                baseExpectedFinalApprox == null
                                  ? computeExpectedFinalFor(item, combinedOptionDelta.total)
                                  : Math.round(baseExpectedFinalApprox + optionAmountForDisplay);
                              const finalDiffVsBase =
                                expectedFinalApprox != null && baseExpectedFinalApprox != null
                                  ? expectedFinalApprox - baseExpectedFinalApprox
                                  : null;
                              const expectedOptionAmountLabel = baseValueItem
                                ? `${signedFmt(optionAmountForDisplay)} (기준대비 룰 ${signedFmt(ruleDeltaVsBase)} + 수동 ${signedFmt(manualDeltaVsBase)})`
                                : `${signedFmt(optionAmountForDisplay)} (룰 ${signedFmt(ruleDeltaVsBase)} + 수동 ${signedFmt(manualDeltaVsBase)})`;
                              const roundingLabel =
                                draft.mode === "SYNC" && valueDraft.mode === "SYNC"
                                  ? getRuleRoundingLabel(draft.ruleType, valueDraft.ruleId)
                                  : "-";

                              return (
                                <tr key={`${group.axis}-${item.value}`} className="border-t border-[var(--hairline)]">
                                  <td className="px-2 py-1 font-medium">{item.value}</td>
                                  <td className="px-2 py-1 text-xs">Sync</td>
                                  <td className="px-2 py-1">
                                    {draft.ruleType === "R2" || draft.ruleType === "R3" ? (
                                      <span className="text-xs text-[var(--muted)]">직접설정</span>
                                    ) : (
                                      <Select
                                        value={valueDraft.ruleId}
                                        onChange={(e) => {
                                          updateAxisDraft(group.axis, {
                                            values: {
                                              ...draft.values,
                                              [item.value]: {
                                                ...valueDraft,
                                                ruleId: e.target.value,
                                              },
                                            },
                                          });
                                          setSyncPreview(null);
                                        }}
                                        disabled={!bulkGlobalRuleSetId || draft.mode !== "SYNC" || valueDraft.mode !== "SYNC"}
                                      >
                                        <option value="">룰 항목 선택</option>
                                        {ruleOptions.map((rule) => (
                                          <option key={rule.id} value={rule.id}>{rule.label}</option>
                                        ))}
                                      </Select>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-xs">
                                    {signedFmt(ruleDeltaAbsolute)}
                                    {draft.mode === "SYNC" && valueDraft.mode === "SYNC" ? (
                                      <span className="ml-1 text-[10px] text-[var(--muted)]">
                                        ({combinedOptionDelta.ruleSource === "RULE" ? "룰" : combinedOptionDelta.ruleSource === "PREVIEW" ? "미리보기" : "잔차"})
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-2 py-1">
                                    <Select
                                      value={String(isMaterialAxisName(group.axis) ? 0 : roundToThousand(manualDeltaAbsolute))}
                                      onChange={(e) => {
                                        updateAxisDraft(group.axis, {
                                          values: {
                                            ...draft.values,
                                            [item.value]: {
                                              ...valueDraft,
                                              deltaKrw: isMaterialAxisName(group.axis) ? "0" : e.target.value,
                                            },
                                          },
                                        });
                                      }}
                                    >
                                      {deltaOptionsForGroup.map((value) => (
                                        <option key={value} value={String(value)}>{deltaOptionLabel(value)}</option>
                                      ))}
                                    </Select>
                                  </td>
                                  <td className="px-2 py-1 text-xs">{roundingLabel}</td>
                                  <td className="px-2 py-1 text-xs">{expectedOptionAmountLabel}</td>
                                  <td className="px-2 py-1 text-xs">
                                    {expectedFinalApprox == null
                                      ? "-"
                                      : `~ ${fmt(expectedFinalApprox)}${finalDiffVsBase == null ? "" : ` (기본값 대비 ${signedFmt(finalDiffVsBase)})`}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {hasSyncValue ? <div className="text-xs text-[var(--muted)]">Sync인 값만 룰 항목 선택이 활성화됩니다.</div> : null}

                    <div className="flex gap-2">
                    {hasSyncValue ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                          if (!bulkGlobalRuleSetId) {
                            toast.error("룰셋을 먼저 선택하세요");
                            return;
                            }
                            previewSyncRule.mutate({ ruleSetId: bulkGlobalRuleSetId });
                          }}
                          disabled={!bulkGlobalRuleSetId}
                        >
                          미리보기
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        onClick={() => {
                          applyCategoryPolicy.mutate({
                            axis: group.axis,
                            axisMode: draft.mode,
                            values: draft.values,
                            ruleSetId: bulkGlobalRuleSetId,
                            ruleType: draft.ruleType,
                          });
                        }}
                        disabled={!canApply || applyCategoryPolicy.isPending}
                      >
                        {applyCategoryPolicy.isPending ? "적용 중..." : `${group.axis} 적용`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
