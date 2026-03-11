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
import {
  buildCanonicalOptionRows,
  buildMappingOptionEntries,
  inferMappingOptionSelection,
  mappingOptionEntryKey,
  type MappingCanonicalOptionRow,
  type MappingOptionAllowlist,
  type MappingOptionSelection,
  type SavedOptionCategoryRow as MappingSavedOptionCategoryRow,
} from "@/lib/shop/mapping-option-details";
import {
  computeOptionLaborRuleBuckets,
  hasAnyActiveOptionLaborRule,
  type OptionLaborRuleRow,
} from "@/lib/shop/option-labor-rules";
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
  auto_sync_force_full?: boolean;
  auto_sync_min_change_krw?: number | null;
  auto_sync_min_change_rate?: number | null;
  auto_sync_threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
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
const isRuleDrivenCategory = (categoryKey: string): boolean => categoryKey == "SIZE" || categoryKey == "COLOR_PLATING";

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
type PreviewCompositionRow = { key: string; label: string; valueText: string };
type PreviewCompositionSection = { key: string; title: string; summary: string; groups: PreviewCompositionRow[][]; defaultOpen?: boolean; layout?: "full" | "third" };
type SyncRunCreateResponse = {
  run_id: string;
  total_count?: number;
  reason?: string;
  threshold_min_change_krw?: number;
  threshold_min_change_rate?: number;
  sync_policy_mode?: "RULE_BASED" | "ALWAYS";
  threshold_evaluated_count?: number;
  threshold_filtered_count?: number;
  market_gap_forced_count?: number;
  downsync_suppressed_count?: number;
  pressure_downsync_release_count?: number;
  large_downsync_release_count?: number;
  cooldown_block_count?: number;
  staleness_release_count?: number;
  pressure_decay_count?: number;
  force_full_sync?: boolean;
  force_full_sync_source?: string | null;
} & MissingMappingSummary;
type SyncIntent = {
  intent_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  master_item_id?: string | null;
  desired_price_krw: number;
  floor_price_krw: number;
  floor_applied: boolean;
  pricing_override_price_krw?: number | null;
  threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  decision_context?: {
    floor_applied?: boolean | null;
    threshold_profile?: "GENERAL" | "MARKET_LINKED" | null;
  } | null;
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
        threshold_min_change_rate?: number;
        sync_policy_mode?: "RULE_BASED" | "ALWAYS";
        threshold_evaluated_count?: number;
        threshold_filtered_count?: number;
        market_gap_forced_count?: number;
        downsync_suppressed_count?: number;
        pressure_downsync_release_count?: number;
        large_downsync_release_count?: number;
        cooldown_block_count?: number;
        staleness_release_count?: number;
        pressure_decay_count?: number;
        force_full_sync?: boolean;
        force_full_sync_source?: string | null;
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
  current_product_sync_profile?: CurrentProductSyncProfile | null;
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
  current_product_sync_profile?: CurrentProductSyncProfile | null;
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

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  sync_rule_set_id?: string | null;
  option_price_mode?: "SYNC" | "MANUAL" | null;
  option_material_code?: string | null;
  option_color_code?: string | null;
  option_decoration_code?: string | null;
  option_size_value?: number | null;
  material_multiplier_override?: number | null;
  size_weight_delta_g?: number | null;
  size_price_override_enabled?: boolean | null;
  size_price_override_krw?: number | null;
  option_price_delta_krw?: number | null;
  option_manual_target_krw?: number | null;
  include_master_plating_labor?: boolean | null;
  sync_rule_material_enabled?: boolean | null;
  sync_rule_weight_enabled?: boolean | null;
  sync_rule_plating_enabled?: boolean | null;
  sync_rule_decoration_enabled?: boolean | null;
  sync_rule_margin_rounding_enabled?: boolean | null;
  current_product_sync_profile?: CurrentProductSyncProfile | null;
  mapping_source?: string;
  is_active?: boolean;
};

type VariantLookupResponse = {
  data: {
    channel_id: string;
    requested_product_no: string;
    resolved_product_no: string;
    canonical_external_product_no: string;
    master_material_code: string | null;
    size_market_context?: {
      goldTickKrwPerG?: number | null;
      silverTickKrwPerG?: number | null;
      materialFactors?: Record<string, unknown> | null;
    } | null;
    total: number;
    variants: Array<{
      variant_code: string;
      custom_variant_code: string | null;
      options: Array<{ name: string; value: string }>;
      option_label: string;
      additional_amount: number | null;
    }>;
    option_detail_allowlist: MappingOptionAllowlist;
    saved_option_categories: MappingSavedOptionCategoryRow[];
    canonical_option_rows: MappingCanonicalOptionRow[];
  };
};

type VariantLookupVariant = VariantLookupResponse["data"]["variants"][number];

type OptionLaborRulePoolsResponse = {
  data: {
    decoration_masters?: Array<{
      master_item_id: string;
      model_name: string | null;
      total_labor_cost_krw?: number | null;
    }>;
  };
};

type BulkMappingResponse = {
  data: MappingRow[];
  requested: number;
  deduplicated: number;
  saved: number;
};

type MappingWritePayload = {
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
  size_price_override_enabled: boolean;
  size_price_override_krw: number | null;
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL";
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
  current_product_sync_profile: CurrentProductSyncProfile;
  mapping_source: "MANUAL";
  is_active: true;
};

type PreviewVariant = ProductEditorPreview["variants"][number];


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

type DraftSlot<T> = {
  resetKey: string;
  value: T;
};

type PolicyDraft = {
  marginMultiplier: string;
  roundingUnit: string;
  roundingMode: "CEIL" | "ROUND" | "FLOOR";
  policyFactorSetId: string;
  autoSyncThresholdProfile: "GENERAL" | "MARKET_LINKED";
  autoSyncForceFull: boolean;
  autoSyncMinChangeKrw: string;
  autoSyncMinChangeRatePct: string;
};

type NumberMap = Record<string, number>;
type StringMap = Record<string, string>;

type CurrentProductSyncProfile = "GENERAL" | "MARKET_LINKED";
type VariantOptionDraft = MappingOptionSelection & {
  option_size_value_text: string;
  size_price_override_enabled: boolean;
  size_price_override_krw_text: string;
};
type OptionEntryRow = {
  optionName: string;
  optionValue: string;
  axisIndex: number;
  entryKey: string;
};
type CompactOptionRow = OptionEntryRow & {
  categoryKey: OptionCategoryKey;
  syncDeltaKrw: number;
  resolvedDeltaKrw: number;
  legacyStatus: "VALID" | "LEGACY_OUT_OF_RANGE" | "UNRESOLVED";
  warnings: string[];
  sourceRuleEntryIds: string[];
  otherReason: string;
  axis1: string;
  axis2: string;
  axis3: string;
  selectedMaterialCode: string;
  selectedColorCode: string;
  selectedSizeWeightText: string;
  selectedDecorMasterId: string;
  decorExtraDeltaKrw: number;
  decorFinalAmountKrw: number;
  noticeValue: string;
};

type PreviewHistorySelectedItem = "가격덮어쓰기" | "예외바닥가" | "목표가격";
const AUTO_SYNC_THRESHOLD_PROFILE_OPTIONS = [
  {
    value: 'GENERAL' as const,
    label: '일반',
    ruleText: 'max(5,000원, 현재 판매가의 2%)',
  },
  {
    value: 'MARKET_LINKED' as const,
    label: '시장연동',
    ruleText: 'max(500원, 현재 판매가의 0.5%)',
  },
];

const normalizeCurrentProductSyncProfile = (value: unknown): CurrentProductSyncProfile => {
  return String(value == null ? 'GENERAL' : value).trim().toUpperCase() === 'MARKET_LINKED' ? 'MARKET_LINKED' : 'GENERAL';
};
const resolveCurrentProductSyncProfileRows = (
  rows: Array<{ current_product_sync_profile?: string | null }>,
  fallback: CurrentProductSyncProfile = "GENERAL",
): CurrentProductSyncProfile => {
  const normalizedFallback = normalizeCurrentProductSyncProfile(fallback);
  let resolvedProfile: CurrentProductSyncProfile | null = null;
  for (const row of rows) {
    const rawProfile = row?.current_product_sync_profile;
    if (rawProfile == null || String(rawProfile).trim() === "") continue;
    const normalizedProfile = normalizeCurrentProductSyncProfile(rawProfile);
    if (resolvedProfile === null) {
      resolvedProfile = normalizedProfile;
      continue;
    }
    if (resolvedProfile !== normalizedProfile) return normalizedFallback;
  }
  return resolvedProfile ?? normalizedFallback;
};
const currentProductSyncProfileLabelOf = (value: CurrentProductSyncProfile) => {
  return value === 'MARKET_LINKED' ? '시장연동' : '일반';
};
const currentProductSyncProfileBadgeClassOf = (value: CurrentProductSyncProfile) => {
  if (value === 'MARKET_LINKED') {
    return 'inline-flex rounded-full border border-amber-400/80 bg-amber-300/90 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]';
  }
  return 'inline-flex rounded-full border border-[var(--hairline)] bg-[var(--panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]';
};
const currentProductSyncProfilePanelClassOf = (value: CurrentProductSyncProfile) => {
  if (value === 'MARKET_LINKED') {
    return 'border-amber-400/80 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(245,158,11,0.08))]';
  }
  return 'border-[var(--hairline)] bg-[var(--bg)]';
};
type OptionCategoryRow = MappingSavedOptionCategoryRow & {
  sync_delta_krw?: number | null;
};
type OptionCategoryKey = OptionCategoryRow["category_key"];
const CATEGORY_OPTIONS: Array<{ key: OptionCategoryKey; label: string }> = [
  { key: "MATERIAL", label: "재질" },
  { key: "SIZE", label: "사이즈" },
  { key: "COLOR_PLATING", label: "색상/도금" },
  { key: "DECOR", label: "장식" },
  { key: "OTHER", label: "기타" },
  { key: "NOTICE", label: "공지" },
];
const guessCategoryByOptionName = (value: unknown): OptionCategoryKey => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "OTHER";
  if (/(재질|소재|material|금종|함량)/u.test(normalized)) return "MATERIAL";
  if (/(사이즈|size|호수|중량|weight|폭|길이)/u.test(normalized)) return "SIZE";
  if (/(색상|color|컬러|도금|plating)/u.test(normalized)) return "COLOR_PLATING";
  if (/(장식|decor|스톤|보석|팬던트|참)/u.test(normalized)) return "DECOR";
  if (/(공지|notice|안내|배송|유의)/u.test(normalized)) return "NOTICE";
  return "OTHER";
};
const resolvePreferredCategoryForOptionName = (
  optionName: unknown,
  ...candidates: Array<OptionCategoryKey | null | undefined>
): OptionCategoryKey => {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return guessCategoryByOptionName(optionName);
};
const normalizeOptionValue = (value: unknown): string =>
  String(value ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();
const optionEntryKey = (optionName: unknown, optionValue: unknown): string => {
  return mappingOptionEntryKey(String(optionName ?? "").trim(), normalizeOptionValue(optionValue));
};
const categoryLabelOf = (value: OptionCategoryKey): string => {
  return CATEGORY_OPTIONS.find((option) => option.key === value)?.label ?? value;
};
const legacyStatusLabelOf = (value: "VALID" | "LEGACY_OUT_OF_RANGE" | "UNRESOLVED"): string => {
  if (value === "LEGACY_OUT_OF_RANGE") return "규칙 불일치";
  if (value === "UNRESOLVED") return "확인 필요";
  return "정상";
};
const NOTICE_VALUE_OPTIONS = ["배송안내", "주문안내", "교환반품안내", "맞춤제작안내", "기타공지"];
const COLOR_AMOUNT_OPTIONS = Array.from({ length: 201 }, (_, index) => String(index * 1000));


const currentProductSyncProfileCardClassOf = (value: CurrentProductSyncProfile) => {
  if (value === 'MARKET_LINKED') {
    return 'border-amber-400/80 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(245,158,11,0.08))] shadow-[0_10px_24px_rgba(217,119,6,0.12)] hover:border-amber-500';
  }
  return 'border-[var(--hairline)] bg-[var(--panel)] hover:border-[var(--primary)]';
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
const describeError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return "요청 실패";
};
const toRoundedNumber = (value: unknown): number | null => {
  const n = Number(value ?? Number.NaN);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const EMPTY_OPTION_ALLOWLIST: MappingOptionAllowlist = {
  materials: [],
  colors: [],
  decors: [],
  sizes_by_material: {},
  is_empty: true,
};
const normalizeVariantCode = (value: string | null | undefined): string => String(value ?? "").trim();
const candidateVariantCodes = (variant: {
  variantCode?: string | null;
  customVariantCode?: string | null;
  variant_code?: string | null;
  custom_variant_code?: string | null;
}): string[] => {
  const codes = [
    normalizeVariantCode(variant.variantCode),
    normalizeVariantCode(variant.customVariantCode),
    normalizeVariantCode(variant.variant_code),
    normalizeVariantCode(variant.custom_variant_code),
  ];
  return Array.from(new Set(codes.filter(Boolean)));
};
const variantAxesOf = (variant: {
  options?: Array<{ name?: string | null; value?: string | null }>;
} | null | undefined) =>
  (variant?.options ?? []).map((option) => ({
    name: String(option.name ?? "").trim(),
    value: String(option.value ?? "").trim(),
  }));
const formatOptionSizeValue = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toFixed(2);
};
const normalizeSizeSelectionParts = (valueLike: string | null | undefined): { major: string; detail: string } => {
  const raw = String(valueLike ?? "").trim();
  if (!raw) return { major: "", detail: "" };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return { major: "", detail: "" };
  const centigram = Math.round(parsed * 100);
  return {
    major: String(Math.floor(centigram / 100)),
    detail: String(centigram % 100).padStart(2, "0"),
  };
};
const buildRuleBackedSizeMajorOptions = (choices: Array<{ value: string; label: string }>): Array<{ value: string; label: string }> => {
  const next = new Map<string, { value: string; label: string }>();
  for (const choice of choices ?? []) {
    const parts = normalizeSizeSelectionParts(choice.value);
    if (!parts.major) continue;
    if (!next.has(parts.major)) next.set(parts.major, { value: parts.major, label: `${parts.major}g` });
  }
  return Array.from(next.values()).sort((left, right) => Number(left.value) - Number(right.value));
};
const buildRuleBackedSizeDetailOptions = (choices: Array<{ value: string; label: string }>, majorValue: string): Array<{ value: string; label: string }> => {
  return (choices ?? [])
    .map((choice) => ({ ...choice, parts: normalizeSizeSelectionParts(choice.value) }))
    .filter((choice) => choice.parts.major === String(majorValue ?? "").trim())
    .map((choice) => ({ value: choice.parts.detail, label: `.${choice.parts.detail}g` }))
    .sort((left, right) => Number(left.value) - Number(right.value));
};
const combineSizeSelectionParts = (majorValue: string, detailValue: string): string => {
  const major = String(majorValue ?? "").trim();
  const detail = String(detailValue ?? "").trim();
  if (!major || !detail) return "";
  return `${major}.${detail.padStart(2, "0")}`;
};
const toVariantOptionDraft = (selection: Partial<MappingOptionSelection> | null | undefined): VariantOptionDraft => ({
  option_material_code: typeof selection?.option_material_code === "string" ? selection.option_material_code : null,
  option_color_code: typeof selection?.option_color_code === "string" ? selection.option_color_code : null,
  option_decoration_code: typeof selection?.option_decoration_code === "string" ? selection.option_decoration_code : null,
  option_size_value: selection?.option_size_value == null ? null : Number(selection.option_size_value),
  option_size_value_text: formatOptionSizeValue(selection?.option_size_value),
  size_price_override_enabled: (selection as { size_price_override_enabled?: boolean | null } | null | undefined)?.size_price_override_enabled === true,
  size_price_override_krw_text: (() => {
    const value = (selection as { size_price_override_krw?: number | null } | null | undefined)?.size_price_override_krw;
    return value == null || !Number.isFinite(Number(value)) ? "" : String(Math.round(Number(value)));
  })(),
});
const withResolvedChoice = <T extends { value: string; label: string }>(
  choices: T[],
  valueLike: string | null | undefined,
  isLegacy: boolean,
  labelOverride?: string | null | undefined,
): T[] => {
  const value = String(valueLike ?? "").trim();
  if (!value || choices.some((choice) => choice.value === value)) return choices;
  const label = String(labelOverride ?? value).trim() || value;
  return [{ ...(choices[0] ?? { value, label }), value, label } as T, ...choices];
};
const optionDraftWithLegacy = (
  draft: VariantOptionDraft,
  existing: Partial<MappingOptionSelection> | null | undefined,
): VariantOptionDraft => {
  const next = { ...draft };
  const existingSizeText = formatOptionSizeValue(existing?.option_size_value);
  const existingSizeOverrideEnabled = (existing as { size_price_override_enabled?: boolean | null } | null | undefined)?.size_price_override_enabled === true;
  const existingSizeOverrideKrw = (existing as { size_price_override_krw?: number | null } | null | undefined)?.size_price_override_krw;
  if (!next.option_material_code && existing?.option_material_code) next.option_material_code = existing.option_material_code;
  if (!next.option_color_code && existing?.option_color_code) next.option_color_code = existing.option_color_code;
  if (!next.option_decoration_code && existing?.option_decoration_code) next.option_decoration_code = existing.option_decoration_code;
  if (!next.option_size_value_text && existingSizeText) {
    next.option_size_value = Number(existingSizeText);
    next.option_size_value_text = existingSizeText;
  }
  if (!next.size_price_override_enabled && existingSizeOverrideEnabled) next.size_price_override_enabled = true;
  if (!next.size_price_override_krw_text && existingSizeOverrideKrw != null && Number.isFinite(Number(existingSizeOverrideKrw))) {
    next.size_price_override_krw_text = String(Math.round(Number(existingSizeOverrideKrw)));
  }
  return next;
};
const optionSummary = (mapping: Partial<MappingOptionSelection>): string => {
  const parts = [
    mapping.option_material_code ? `material ${mapping.option_material_code}` : null,
    mapping.option_size_value != null ? `size ${formatOptionSizeValue(mapping.option_size_value)}g` : null,
    mapping.option_color_code ? `color ${mapping.option_color_code}` : null,
    mapping.option_decoration_code ? `decor ${mapping.option_decoration_code}` : null,
    (mapping as { size_price_override_enabled?: boolean | null; size_price_override_krw?: number | null }).size_price_override_enabled === true
      ? `size override ${fmtKrw((mapping as { size_price_override_krw?: number | null }).size_price_override_krw ?? 0)}`
      : null,
  ].filter(Boolean);
  return parts.join(" / ") || "-";
};
const axisCellText = (axis: { name?: string | null; value?: string | null } | null | undefined): string => {
  if (!axis) return "-";
  const name = String(axis.name ?? "").trim();
  const value = String(axis.value ?? "").trim();
  if (!name && !value) return "-";
  if (!name) return value || "-";
  if (!value) return name;
  return `${name}: ${value}`;
};
const DECORATION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const formatRatePctText = (value: number | null | undefined) =>
  String((Number(value ?? 0.02) * 100).toFixed(2).replace(/\.00$/u, "").replace(/(\.\d*[1-9])0+$/u, "$1"));
const createPolicyDraft = (policy: PricingPolicy | null | undefined): PolicyDraft => ({
  marginMultiplier: String(policy?.margin_multiplier ?? 1),
  roundingUnit: String(policy?.rounding_unit ?? 1000),
  roundingMode: (policy?.rounding_mode ?? "CEIL") as "CEIL" | "ROUND" | "FLOOR",
  policyFactorSetId: policy?.material_factor_set_id ?? "",
  autoSyncThresholdProfile: policy?.auto_sync_threshold_profile === "MARKET_LINKED" ? "MARKET_LINKED" : "GENERAL",
  autoSyncForceFull: policy?.auto_sync_force_full === true,
  autoSyncMinChangeKrw: String(Math.max(0, Math.round(Number(policy?.auto_sync_min_change_krw ?? 5000)))),
  autoSyncMinChangeRatePct: formatRatePctText(policy?.auto_sync_min_change_rate),
});
const parseNumericInput = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value ?? "").replaceAll(",", "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const parseOptionalNumber = (raw: string): number | null => {
  const trimmed = raw.split(",").join("").trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
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

const resolveHistorySelectedItem = (intent: SyncIntent): PreviewHistorySelectedItem => {
  if (toRoundedNumber(intent.pricing_override_price_krw) != null) return "가격덮어쓰기";
  if (intent.decision_context?.floor_applied === true || intent.floor_applied) return "예외바닥가";
  return "목표가격";
};

const SNAPSHOT_RATE_KEYS = new Set([
  "labor-margin-rate",
  "material-margin-rate",
  "fixed-margin-rate",
  "policy-fee-rate",
  "guardrail-rate",
]);

const SNAPSHOT_PRE_RATE_PRICE_KEYS = new Set([
  "labor-cost-basis",
  "material-total",
  "fixed-cost-setting",
  "cost-sum-basis",
  "total-pre-fee-base",
]);

const SNAPSHOT_POST_RATE_PRICE_KEYS = new Set([
  "labor-pre-fee",
  "material-pre-fee",
  "fixed-pre-fee",
  "total-pre-fee",
  "target-price",
  "labor-pre-fee-sum",
  "material-pre-fee-sum",
  "fixed-pre-fee-sum",
  "target-price-compare",
]);

const SNAPSHOT_RAINBOW_STAGE_KEYS: Record<string, string> = {};

const snapshotCellToneClass = (key: string, groupIndex: number) => {
  if (key === "final-price") return "bg-violet-100";
  if (SNAPSHOT_RATE_KEYS.has(key)) return "bg-violet-100";
  if (SNAPSHOT_POST_RATE_PRICE_KEYS.has(key)) return "bg-rose-100";
  if (SNAPSHOT_PRE_RATE_PRICE_KEYS.has(key)) return "bg-white";
  if (groupIndex === 0) return "bg-white";
  return "bg-white";
};

const parseCronTickReason = (errorMessage: string | null | undefined): string | null => {
  const raw = String(errorMessage ?? "").trim();
  if (!raw.toUpperCase().startsWith("CRON_TICK:")) return null;
  const reason = raw.slice("CRON_TICK:".length).trim();
  return reason || null;
};
const cronTickReasonLabelOf = (reason: string | null | undefined): string => {
  const key = String(reason ?? "").trim().toUpperCase();
  if (key === "CREATE_RUN_FAILED") return "RUN 생성 실패";
  if (key === "EXECUTE_RUN_FAILED") return "RUN 실행 실패";
  if (key === "RECOMPUTE_FAILED") return "재계산 실패";
  if (key === "PULL_FAILED") return "가격 수집 실패";
  if (key === "INTERVAL_NOT_ELAPSED") return "실행 간격 미도달";
  if (key === "OVERLAP_RUNNING") return "기존 RUN 진행중";
  return key || "-";
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
  const [policyDraftSlot, setPolicyDraftSlot] = useState<DraftSlot<PolicyDraft>>({
    resetKey: "",
    value: createPolicyDraft(null),
  });
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runMasterIds, setRunMasterIds] = useState("");
  const [editorProductNo, setEditorProductNo] = useState("");
  const [editorReloadNonce, setEditorReloadNonce] = useState(0);
  const [gallerySearch, setGallerySearch] = useState("");
  const [editorPreview, setEditorPreview] = useState<ProductEditorPreview | null>(null);
  const [variantLookupFallbackData, setVariantLookupFallbackData] = useState<VariantLookupResponse["data"] | null>(null);
  const [editorMasterItemIdHint, setEditorMasterItemIdHint] = useState("");
  const [editorPrice, setEditorPrice] = useState("");
  const [editorRetailPrice, setEditorRetailPrice] = useState("");
  const [editorSelling, setEditorSelling] = useState("T");
  const [editorDisplay, setEditorDisplay] = useState("T");
  const [sellingPriceOverrideLockedSlot, setSellingPriceOverrideLockedSlot] = useState<DraftSlot<boolean>>({
    resetKey: "",
    value: false,
  });
  const [editorFloorPrice, setEditorFloorPrice] = useState("0");
  const [editorExcludePlatingLabor, setEditorExcludePlatingLabor] = useState(false);
  const [editorCurrentProductSyncProfile, setEditorCurrentProductSyncProfile] = useState<CurrentProductSyncProfile>('GENERAL');
  const [currentProductSyncProfileSaveError, setCurrentProductSyncProfileSaveError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [mappingSaveError, setMappingSaveError] = useState<string | null>(null);
  const [optionCategorySaveError, setOptionCategorySaveError] = useState<string | null>(null);
  const [variantOptionDraftSlot, setVariantOptionDraftSlot] = useState<DraftSlot<Record<string, VariantOptionDraft>>>({
    resetKey: "",
    value: {},
  });
  const [optionCategoryDraftSlot, setOptionCategoryDraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionSyncDeltaDraftSlot, setOptionSyncDeltaDraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionOtherReasonDraftSlot, setOptionOtherReasonDraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionDecorSelectionDraftSlot, setOptionDecorSelectionDraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionNoticeSelectionDraftSlot, setOptionNoticeSelectionDraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionAxis1DraftSlot, setOptionAxis1DraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionAxis2DraftSlot, setOptionAxis2DraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [optionAxis3DraftSlot, setOptionAxis3DraftSlot] = useState<DraftSlot<StringMap>>({
    resetKey: "",
    value: {},
  });
  const [focusedVariantCode, setFocusedVariantCode] = useState("");
  const [showAdvancedVariantMapping, setShowAdvancedVariantMapping] = useState(false);
  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);


  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = useMemo(() => channelsQuery.data?.data ?? [], [channelsQuery.data?.data]);
  const effectiveChannelId = channelId || channels[0]?.channel_id || "";

  const policiesQuery = useQuery({
    queryKey: ["shop-policies", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: PricingPolicy[] }>(`/api/pricing-policies?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });
  const policyRows = useMemo(() => policiesQuery.data?.data ?? [], [policiesQuery.data?.data]);
  const activePolicy = useMemo(() => policyRows.find((p) => p.is_active) ?? null, [policyRows]);
  const policyDraftResetKey = activePolicy?.policy_id ?? "__default_policy__";
  const defaultPolicyDraft = createPolicyDraft(activePolicy);
  const policyDraft = policyDraftSlot.resetKey === policyDraftResetKey ? policyDraftSlot.value : defaultPolicyDraft;
  const setPolicyDraft = (next: PolicyDraft | ((current: PolicyDraft) => PolicyDraft)) => {
    const current = policyDraftSlot.resetKey === policyDraftResetKey ? policyDraftSlot.value : defaultPolicyDraft;
    const value = typeof next === "function" ? next(current) : next;
    setPolicyDraftSlot({ resetKey: policyDraftResetKey, value });
  };
  const marginMultiplier = policyDraft.marginMultiplier;
  const roundingUnit = policyDraft.roundingUnit;
  const roundingMode = policyDraft.roundingMode;
  const policyFactorSetId = policyDraft.policyFactorSetId;
  const autoSyncThresholdProfile = policyDraft.autoSyncThresholdProfile;
  const autoSyncForceFull = policyDraft.autoSyncForceFull;
  const autoSyncMinChangeKrw = policyDraft.autoSyncMinChangeKrw;
  const autoSyncMinChangeRatePct = policyDraft.autoSyncMinChangeRatePct;
  const setMarginMultiplier = (value: string) => setPolicyDraft((current: PolicyDraft) => ({ ...current, marginMultiplier: value }));
  const setRoundingUnit = (value: string) => setPolicyDraft((current: PolicyDraft) => ({ ...current, roundingUnit: value }));
  const setRoundingMode = (value: "CEIL" | "ROUND" | "FLOOR") => setPolicyDraft((current: PolicyDraft) => ({ ...current, roundingMode: value }));
  const setPolicyFactorSetId = (value: string) => setPolicyDraft((current: PolicyDraft) => ({ ...current, policyFactorSetId: value }));
  const setAutoSyncThresholdProfile = (value: "GENERAL" | "MARKET_LINKED") => setPolicyDraft((current: PolicyDraft) => ({ ...current, autoSyncThresholdProfile: value }));
  const setAutoSyncForceFull = (value: boolean) => setPolicyDraft((current: PolicyDraft) => ({ ...current, autoSyncForceFull: value }));
  const setAutoSyncMinChangeKrw = (value: string) => setPolicyDraft((current: PolicyDraft) => ({ ...current, autoSyncMinChangeKrw: value }));
  const setAutoSyncMinChangeRatePct = (value: string) => setPolicyDraft((current: PolicyDraft) => ({ ...current, autoSyncMinChangeRatePct: value }));
  const selectedThresholdProfile = AUTO_SYNC_THRESHOLD_PROFILE_OPTIONS.find((option) => option.value === autoSyncThresholdProfile)
    ?? AUTO_SYNC_THRESHOLD_PROFILE_OPTIONS[0];

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
  const runRows = useMemo(() => runsQuery.data?.data ?? [], [runsQuery.data?.data]);
  const effectiveRunId = selectedRunId || runRows[0]?.run_id || "";

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
  const activeRunSyncPolicyMode = activeRunMissingMappingSummary?.sync_policy_mode ?? "RULE_BASED";
  const activeRunThresholdMinChangeKrw = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.threshold_min_change_krw ?? 0)));
  const activeRunThresholdMinChangeRatePct = Number.isFinite(Number(activeRunMissingMappingSummary?.threshold_min_change_rate ?? Number.NaN))
    ? `${(Number(activeRunMissingMappingSummary?.threshold_min_change_rate) * 100).toFixed(2).replace(/\.00$/u, "").replace(/(\.\d*[1-9])0+$/u, "$1")}%`
    : "-";
  const activeRunForceFullSyncSource = String(activeRunMissingMappingSummary?.force_full_sync_source ?? "").trim() || "-";
  const activeRunThresholdEvaluatedCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.threshold_evaluated_count ?? 0)));
  const activeRunThresholdFilteredCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.threshold_filtered_count ?? 0)));
  const activeRunMarketGapForcedCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.market_gap_forced_count ?? 0)));
  const activeRunDownsyncSuppressedCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.downsync_suppressed_count ?? 0)));
  const activeRunPressureDownsyncReleaseCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.pressure_downsync_release_count ?? 0)));
  const activeRunLargeDownsyncReleaseCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.large_downsync_release_count ?? 0)));
  const activeRunCooldownBlockCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.cooldown_block_count ?? 0)));
  const activeRunStalenessReleaseCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.staleness_release_count ?? 0)));
  const activeRunPressureDecayCount = Math.max(0, Math.round(Number(activeRunMissingMappingSummary?.pressure_decay_count ?? 0)));

  const mappedMasters = useMemo(() => mappingSummaryQuery.data?.data.mapped_masters ?? [], [mappingSummaryQuery.data?.data.mapped_masters]);
  const masterIdByProductNo = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of mappedMasters) {
      const masterId = String(row.master_item_id ?? "").trim();
      if (!masterId) continue;
      for (const productNo of row.product_nos ?? []) {
        const key = String(productNo ?? "").trim();
        if (!key || map.has(key)) continue;
        map.set(key, masterId);
      }
    }
    return map;
  }, [mappedMasters]);

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
    () => runRows
      .filter((row) => !String(row.error_message ?? "").trim().toUpperCase().startsWith("CRON_TICK:"))
      .slice(0, 20)
      .map((row) => String(row.run_id ?? "").trim())
      .filter(Boolean),
    [runRows],
  );

  const latestCronTick = (() => {
    for (const row of runRows) {
      const reason = parseCronTickReason(row.error_message ?? null);
      if (!reason) continue;
      return {
        at: String(row.started_at ?? "").trim(),
        reason,
      };
    }
    return null;
  })();

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
    const previewProductNo = String(editorPreview?.productNo ?? "").trim();
    if (previewProductNo) return previewProductNo;
    return String(editorProductNo ?? "").trim();
  }, [editorPreview?.productNo, editorProductNo]);

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
    const guardrailRateValueText = Number.isFinite(policyMinMarginRate) && Number.isFinite(policyFeeRate)
      ? `${policyMinMarginRate.toFixed(2)}+${policyFeeRate.toFixed(2)}`
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
    const laborCostAppliedDisplayRaw = [
      componentAmount("BASE_LABOR", "labor_cost_krw"),
      componentAmount("STONE_LABOR", "labor_cost_krw"),
      componentAmount("ETC", "labor_cost_krw"),
      componentAmount("PLATING", "labor_cost_krw"),
      componentAmount("DECOR", "labor_cost_krw"),
    ].reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const laborCostAppliedDisplay = laborCostAppliedDisplayRaw > 0
      ? laborCostAppliedDisplayRaw
      : toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw);
    const laborCostPlusAbsorbDisplayRaw = [
      componentAmount("BASE_LABOR", "labor_cost_plus_absorb_krw"),
      componentAmount("STONE_LABOR", "labor_cost_plus_absorb_krw"),
      componentAmount("ETC", "labor_cost_plus_absorb_krw"),
      componentAmount("PLATING", "labor_cost_plus_absorb_krw"),
      componentAmount("DECOR", "labor_cost_plus_absorb_krw"),
    ].reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const laborCostPlusAbsorbDisplay = laborCostPlusAbsorbDisplayRaw > 0
      ? laborCostPlusAbsorbDisplayRaw
      : toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw) != null && toRoundedNumber(snapshotExplainRow.absorb_total_applied_krw) != null
        ? (toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw) ?? 0) + (toRoundedNumber(snapshotExplainRow.absorb_total_applied_krw) ?? 0)
        : null;
    const laborSellPlusAbsorbDisplayRaw = [
      toRoundedNumber(snapshotExplainRow.labor_component_json?.BASE_LABOR?.labor_sell_plus_absorb_krw),
      toRoundedNumber(snapshotExplainRow.labor_component_json?.STONE_LABOR?.labor_sell_plus_absorb_krw),
      toRoundedNumber(snapshotExplainRow.labor_component_json?.ETC?.labor_sell_plus_absorb_krw),
      toRoundedNumber(snapshotExplainRow.labor_component_json?.PLATING?.labor_sell_plus_absorb_krw),
      toRoundedNumber(snapshotExplainRow.labor_component_json?.DECOR?.labor_sell_plus_absorb_krw),
    ].reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const laborSellPlusAbsorbDisplay = laborSellPlusAbsorbDisplayRaw > 0
      ? laborSellPlusAbsorbDisplayRaw
      : toRoundedNumber(snapshotExplainRow.labor_sell_total_plus_absorb_krw);
  
    const topRow: PreviewCompositionRow[] = [
      { key: "material-code", label: "소재코드", valueText: String(snapshotExplainRow.material_code_effective ?? "-") },
      { key: "weight", label: "순중량", valueText: fmt(snapshotExplainRow.net_weight_g) },
      { key: "material-basis", label: "소재기준", valueText: String(snapshotExplainRow.material_basis_resolved ?? "-") },
      { key: "purity-adjust", label: "함량x보정", valueText: purityAdjusted == null ? "-" : purityAdjusted.toFixed(4) },
      { key: "purity", label: "함량", valueText: snapshotExplainRow.material_purity_rate_resolved == null ? "-" : snapshotExplainRow.material_purity_rate_resolved.toFixed(4) },
      { key: "adjust", label: "보정계수", valueText: snapshotExplainRow.material_adjust_factor_resolved == null ? "-" : snapshotExplainRow.material_adjust_factor_resolved.toFixed(4) },
    ];
  
    const priceRow: PreviewCompositionRow[] = [
      { key: "labor-cost-total", label: "공임합(원가)", valueText: fmtKrw(laborCostAppliedDisplay) },
      { key: "labor-cost-base", label: "기본(원가)", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_cost_krw")) },
      { key: "labor-cost-stone", label: "알(원가)", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_cost_krw")) },
      { key: "labor-cost-etc", label: "기타(원가)", valueText: fmtKrw(componentAmount("ETC", "labor_cost_krw")) },
      { key: "labor-cost-plating", label: "도금(원가)", valueText: fmtKrw(componentAmount("PLATING", "labor_cost_krw")) },
      { key: "labor-cost-decor", label: "장식(원가)", valueText: fmtKrw(componentAmount("DECOR", "labor_cost_krw")) },
    ];
  
    const policyRow: PreviewCompositionRow[] = [
      { key: "absorb-total", label: "흡수공임합(원가)", valueText: fmtKrw(snapshotExplainRow.absorb_total_applied_krw) },
      { key: "absorb-base", label: "기본(흡수)", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_absorb_applied_krw")) },
      { key: "absorb-stone", label: "알(흡수)", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_absorb_applied_krw")) },
      { key: "absorb-etc", label: "기타(흡수)", valueText: fmtKrw(componentAmount("ETC", "labor_absorb_applied_krw")) },
      { key: "absorb-plating", label: "도금(흡수)", valueText: fmtKrw(componentAmount("PLATING", "labor_absorb_applied_krw")) },
      { key: "absorb-decor", label: "장식(흡수)", valueText: fmtKrw(componentAmount("DECOR", "labor_absorb_applied_krw")) },
    ];
  
    const laborRollupRow: PreviewCompositionRow[] = [
      { key: "total-labor-cost", label: "총공임합(원가)", valueText: fmtKrw(laborCostPlusAbsorbDisplay) },
      { key: "total-base", label: "총기본", valueText: fmtKrw(componentAmount("BASE_LABOR", "labor_cost_plus_absorb_krw")) },
      { key: "total-stone", label: "총알", valueText: fmtKrw(componentAmount("STONE_LABOR", "labor_cost_plus_absorb_krw")) },
      { key: "total-etc", label: "총기타", valueText: fmtKrw(componentAmount("ETC", "labor_cost_plus_absorb_krw")) },
      { key: "total-plating", label: "총도금", valueText: fmtKrw(componentAmount("PLATING", "labor_cost_plus_absorb_krw")) },
      { key: "total-decor", label: "총장식", valueText: fmtKrw(componentAmount("DECOR", "labor_cost_plus_absorb_krw")) },
    ];

    const laborReverseRow: PreviewCompositionRow[] = [
      { key: "labor-cost-basis", label: "총공임합(원가)", valueText: fmtKrw(laborCostPlusAbsorbDisplay) },
      { key: "labor-margin-rate", label: `공임 GM (${gmLaborRateText})`, valueText: gmLaborRateText },
      { key: "labor-pre-fee", label: "공임 역산", valueText: fmtKrw(laborPreFee) },
    ];

    const materialReverseRow: PreviewCompositionRow[] = [
      { key: "material-total", label: "총소재가격", valueText: fmtKrw(snapshotExplainRow.material_final_krw) },
      { key: "material-margin-rate", label: `소재 GM (${gmMaterialRateText})`, valueText: gmMaterialRateText },
      { key: "material-pre-fee", label: "소재 역산", valueText: fmtKrw(materialPreFee) },
    ];

    const fixedReverseRow: PreviewCompositionRow[] = [
      { key: "fixed-cost-setting", label: "고정 설정", valueText: fmtKrw(fixedCostSetting) },
      { key: "fixed-margin-rate", label: `고정 GM (${gmFixedRateText})`, valueText: gmFixedRateText },
      { key: "fixed-pre-fee", label: "고정 역산", valueText: fmtKrw(fixedPreFee) },
    ];

    const candidateSumRow: PreviewCompositionRow[] = [
      { key: "material-labor-pre-fee", label: `공임+소재 합`, valueText: fmtKrw(materialLaborCombinedPreFee) },
      { key: "total-pre-fee-input", label: `+ 고정 역산`, valueText: fmtKrw(fixedPreFee) },
      { key: "total-pre-fee", label: "후보합", valueText: fmtKrw(totalPreFee) },
    ];

    const candidatePriceRow: PreviewCompositionRow[] = [
      { key: "total-pre-fee", label: "후보합", valueText: fmtKrw(totalPreFee) },
      { key: "policy-fee-rate", label: `수수료 (${policyFeeRateText})`, valueText: policyFeeRateText },
      { key: "target-price", label: "후보가격", valueText: fmtKrw(snapshotExplainRow.candidate_price_krw) },
    ];

    const minMarginRow: PreviewCompositionRow[] = [
      { key: "cost-sum-basis", label: "총원가합", valueText: fmtKrw(snapshotExplainRow.cost_sum_krw) },
      { key: "guardrail-rate", label: "가드레일", valueText: guardrailRateValueText },
      { key: "min-margin-price-compare", label: "최소마진가", valueText: fmtKrw(snapshotExplainRow.min_margin_price_krw) },
    ];

    const resultTopRow: PreviewCompositionRow[] = [
      { key: "final-price", label: "최종가격", valueText: fmtKrw(finalTarget) },
      { key: "selected-item-final", label: "채택항목", valueText: selectedLabel },
      { key: "selected-value-compare", label: "채택값", valueText: fmtKrw(selectedBase) },
    ];

    const resultBottomRow: PreviewCompositionRow[] = [
      { key: "current-price", label: "현재가", valueText: fmtKrw(currentPrice) },
      { key: "price-diff-krw", label: "가격차", valueText: diffKrw == null ? "-" : fmtSignedKrw(diffKrw) },
      { key: "price-diff-pct", label: "차이율", valueText: diffPctText },
    ];

    return [
      topRow,
      priceRow,
      policyRow,
      laborRollupRow,
      laborReverseRow,
      materialReverseRow,
      fixedReverseRow,
      candidateSumRow,
      candidatePriceRow,
      minMarginRow,
      resultTopRow,
      resultBottomRow,
    ];
  }, [activePolicy?.margin_multiplier, activePolicy?.fee_rate, activePolicy?.min_margin_rate_total, activePolicy?.gm_material, activePolicy?.gm_labor, activePolicy?.gm_fixed, activePolicy?.fixed_cost_krw, snapshotExplainRow]);
  
  const previewCompositionSections = useMemo(() => {
    if (!previewCompositionRowGroups.length) return [] as PreviewCompositionSection[];
    const section = (key: string, title: string, summary: string, indexes: number[], defaultOpen = false, layout: "full" | "third" = "full"): PreviewCompositionSection => ({
      key,
      title,
      summary,
      groups: indexes.map((index) => previewCompositionRowGroups[index]).filter((group): group is PreviewCompositionRow[] => Array.isArray(group) && group.length > 0),
      defaultOpen,
      layout,
    });

    return [
      section("cost-rollup", "원가 합산", previewCompositionRowGroups[3]?.[0]?.valueText ?? "-", [0, 1, 2, 3], true),
      section("labor-reverse", "공임 역산", previewCompositionRowGroups[4]?.[2]?.valueText ?? "-", [4], false, "third"),
      section("material-reverse", "소재 역산", previewCompositionRowGroups[5]?.[2]?.valueText ?? "-", [5], false, "third"),
      section("fixed-reverse", "고정 역산", previewCompositionRowGroups[6]?.[2]?.valueText ?? "-", [6], false, "third"),
      section("candidate-price", "후보가격 계산", previewCompositionRowGroups[8]?.[2]?.valueText ?? "-", [7, 8], false, "third"),
      section("guardrail", "최소마진 비교", previewCompositionRowGroups[9]?.[2]?.valueText ?? "-", [9], false, "third"),
      section("result", "결과 비교", previewCompositionRowGroups[10]?.[0]?.valueText ?? "-", [10, 11], false, "third"),
    ];
  }, [previewCompositionRowGroups]);

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
    const laborCostAppliedDisplayRaw = [
      snapshotExplainRow.labor_component_json?.BASE_LABOR?.labor_cost_krw,
      snapshotExplainRow.labor_component_json?.STONE_LABOR?.labor_cost_krw,
      snapshotExplainRow.labor_component_json?.ETC?.labor_cost_krw,
      snapshotExplainRow.labor_component_json?.PLATING?.labor_cost_krw,
      snapshotExplainRow.labor_component_json?.DECOR?.labor_cost_krw,
    ].reduce<number>((sum, value) => sum + (toRoundedNumber(value) ?? 0), 0);
    const laborCostAppliedDisplay = laborCostAppliedDisplayRaw > 0
      ? laborCostAppliedDisplayRaw
      : toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw);
    const laborCostPlusAbsorbDisplayRaw = [
      snapshotExplainRow.labor_component_json?.BASE_LABOR?.labor_cost_plus_absorb_krw,
      snapshotExplainRow.labor_component_json?.STONE_LABOR?.labor_cost_plus_absorb_krw,
      snapshotExplainRow.labor_component_json?.ETC?.labor_cost_plus_absorb_krw,
      snapshotExplainRow.labor_component_json?.PLATING?.labor_cost_plus_absorb_krw,
      snapshotExplainRow.labor_component_json?.DECOR?.labor_cost_plus_absorb_krw,
    ].reduce<number>((sum, value) => sum + (toRoundedNumber(value) ?? 0), 0);
    const laborCostPlusAbsorbDisplay = laborCostPlusAbsorbDisplayRaw > 0
      ? laborCostPlusAbsorbDisplayRaw
      : toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw) != null && toRoundedNumber(snapshotExplainRow.absorb_total_applied_krw) != null
        ? (toRoundedNumber(snapshotExplainRow.labor_cost_applied_krw) ?? 0) + (toRoundedNumber(snapshotExplainRow.absorb_total_applied_krw) ?? 0)
        : null;
  
    const line1 = `소재가격: ${fmtKrw(snapshotExplainRow.material_final_krw)} (유효틱 ${fmt(snapshotExplainRow.effective_tick_krw_g)}원/g × 순중량 ${fmt(snapshotExplainRow.net_weight_g)} × 함량*보정계수 ${purityAdjusted == null ? "-" : purityAdjusted.toFixed(4)} -> 소재원가 ${fmtKrw(snapshotExplainRow.material_raw_krw)} -> 환산 ${fmtKrw(snapshotExplainRow.material_final_krw)})`;
    const line2 = `총공임(판매 기준): ${fmtKrw(snapshotExplainRow.labor_sell_total_plus_absorb_krw)} (공임합(원가, 흡수 제외) ${fmtKrw(laborCostAppliedDisplay)} + 흡수공임 ${fmtKrw(snapshotExplainRow.absorb_total_applied_krw)} = 총공임합(원가) ${fmtKrw(laborCostPlusAbsorbDisplay)} -> 판매 기준 공임 ${fmtKrw(snapshotExplainRow.labor_sell_total_plus_absorb_krw)} -> 공임 수수료 반영 전 ${fmtKrw(snapshotExplainRow.labor_pre_fee_krw)})`;
    const line3 = `총가격 후보(목표가격): ${fmtKrw(snapshotExplainRow.candidate_price_krw)} (수수료 반영 전 후보합 ${fmtKrw(snapshotExplainRow.candidate_pre_fee_krw)} = 소재 ${fmtKrw(snapshotExplainRow.material_pre_fee_krw)} + 공임 ${fmtKrw(snapshotExplainRow.labor_pre_fee_krw)} + 고정 ${fmtKrw(snapshotExplainRow.fixed_pre_fee_krw)}, 수수료율 ${policyFeeRateText} 반영)`;
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
      selectedItem: PreviewHistorySelectedItem;
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
        intent.pricing_override_price_krw,
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

    const pickFirstIntentValue = (intents: SyncIntent[], picker: (intent: SyncIntent) => number | null): number | null => {
      for (const intent of intents) {
        const value = picker(intent);
        if (value != null) return value;
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

        const preferredProductNo = resolvedPreviewProductNo;
        const primaryIntents = preferredProductNo
          ? intents.filter((intent) => String(intent.external_product_no ?? "").trim() === preferredProductNo)
          : [];
        const primaryPool = primaryIntents.length > 0 ? primaryIntents : intents;
        const baseIntent = primaryPool.find((intent) => !String(intent.external_variant_code ?? "").trim()) ?? primaryPool[0] ?? intents[0];
        const pickBaseThenAnyIntentValue = (picker: (intent: SyncIntent) => number | null): number | null => {
          const baseValue = picker(baseIntent);
          if (baseValue != null) return baseValue;
          const primaryValue = pickFirstIntentValue(primaryPool, picker);
          return primaryValue != null ? primaryValue : pickFirstIntentValue(intents, picker);
        };
        const snapshotPrice = pickBaseThenAnyIntentValue(pickSnapshotPrice);
        const pushTargetPrice = pickBaseThenAnyIntentValue((intent) => toRoundedNumber(intent.applied_target_price_krw))
          ?? pickBaseThenAnyIntentValue(pickSelectedPrice);
        const pushBeforePrice = pickBaseThenAnyIntentValue((intent) => toRoundedNumber(intent.applied_before_price_krw));
        const pushAfterPrice = pickBaseThenAnyIntentValue((intent) => toRoundedNumber(intent.applied_after_price_krw));
        const overridePrice = pickBaseThenAnyIntentValue((intent) => toRoundedNumber(intent.pricing_override_price_krw));
        const candidatePrice = pushTargetPrice ?? pushAfterPrice ?? snapshotPrice;
        const selectedItem = resolveHistorySelectedItem(baseIntent);
        const selectedPrice = selectedItem === "가격덮어쓰기"
          ? overridePrice ?? pushAfterPrice ?? pushTargetPrice ?? candidatePrice
          : pushAfterPrice ?? pushTargetPrice ?? candidatePrice;

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
        selectedItem: PreviewHistorySelectedItem;
        selectedPrice: number | null;
        variantAvg: number | null;
      } => Boolean(row))
      .sort((a, b) => b.at.localeCompare(a.at));

    return rows.slice(0, 20);
  }, [editorPreview, editorMasterItemId, editorProductNo, recentRunDetailQueries, resolvedPreviewProductNo]);

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
        firstAt: null as string | null,
        lastAt: null as string | null,
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
    const displayPoints = normalized.filter((point, index) => (
      index === 0 || index === normalized.length - 1 || point.turning
    ));

    return {
      width,
      height,
      points: displayPoints,
      polyline: displayPoints.map((point) => `${point.x},${point.y}`).join(" "),
      min,
      max,
      turningCount: turningPoints.length,
      firstTurning: turningPoints.length > 0
        ? {
          at: turningPoints[0].at,
          value: turningPoints[0].value,
        }
        : null,
      firstAt: points[0]?.at ?? null,
      lastAt: points[points.length - 1]?.at ?? null,
    };
  }, [previewHistoryRows]);

  const snapshotExplainStatusText = useMemo(() => {
    if (!editorPreview) return "미리보기를 먼저 불러오면 구성(스냅샷)을 확인할 수 있습니다.";
    if (!effectiveChannelId) return "channel_id가 없어 구성(스냅샷) 조회를 시작하지 못했습니다.";
    if (!editorMasterItemId) return "이 상품의 master_item_id를 아직 찾지 못해 구성(스냅샷)이 비어 있습니다.";
    if (snapshotExplainQuery.isFetching && !snapshotExplainRow) return "구성(스냅샷)을 불러오는 중입니다.";
    if (snapshotExplainQuery.isError) {
      const message = describeError(snapshotExplainQuery.error);
      if (/No V2 snapshot row found in view/i.test(message)) {
        return "V2 스냅샷 뷰에 이 상품 행이 없어 비어 있습니다. 배포 문제가 아니라 현재 계산 뷰 데이터가 없는 상태입니다.";
      }
      return `구성(스냅샷) 조회 실패: ${message}`;
    }
    if (!snapshotExplainRow) return "V2 스냅샷 뷰에서 이 상품 행을 찾지 못했습니다.";
    return null;
  }, [editorMasterItemId, editorPreview, effectiveChannelId, snapshotExplainQuery.error, snapshotExplainQuery.isError, snapshotExplainQuery.isFetching, snapshotExplainRow]);

  const previewHistoryEmptyText = useMemo(() => {
    if (!editorPreview) return "미리보기를 먼저 불러오면 최근 run 히스토리를 확인할 수 있습니다.";
    if (recentRunIds.length === 0) {
      return latestCronTick
        ? "최근 일반 run이 없어 히스토리가 비어 있습니다. 현재는 크론 체크 기록만 보입니다."
        : "최근 일반 run이 아직 없어 히스토리가 비어 있습니다.";
    }
    if (recentRunDetailQueries.some((query) => query.isFetching && !query.data)) {
      return "최근 run 상세를 불러오는 중입니다.";
    }
    if (recentRunDetailQueries.some((query) => query.isError)) {
      return "최근 run 상세 조회 중 일부가 실패해 히스토리를 채우지 못했습니다.";
    }
    if (recentRunDetailQueries.every((query) => !query.data)) {
      return "최근 run 상세를 아직 불러오지 못했습니다.";
    }
    return "최근 20개 일반 run 안에 이 상품과 매칭되는 intent가 없어 히스토리가 비어 있습니다.";
  }, [editorPreview, latestCronTick, recentRunDetailQueries, recentRunIds.length]);
  const dashboardGalleryQuery = useQuery({
    queryKey: ["shop-dashboard-gallery", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: DashboardGalleryRow[] }>(
        `/api/channel-price-dashboard?channel_id=${encodeURIComponent(effectiveChannelId)}&include_unmapped=false&limit=1000`,
      ),
    refetchInterval: 15_000,
  });

  const galleryMappingsQuery = useQuery({
    queryKey: ["auto-price-gallery-mappings", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: MappingRow[] }>(
        `/api/channel-products?channel_id=${encodeURIComponent(effectiveChannelId)}`,
      ),
    staleTime: 60_000,
  });

  const galleryCurrentProductSyncProfileByMaster = useMemo(() => {
    const rowsByMaster = new Map<string, Array<{ current_product_sync_profile?: string | null }>>();
    for (const row of galleryMappingsQuery.data?.data ?? []) {
      if (row.is_active === false) continue;
      const masterItemId = String(row.master_item_id ?? "").trim();
      if (!masterItemId) continue;
      const bucket = rowsByMaster.get(masterItemId) ?? [];
      bucket.push({ current_product_sync_profile: row.current_product_sync_profile });
      rowsByMaster.set(masterItemId, bucket);
    }
    const map = new Map<string, CurrentProductSyncProfile>();
    for (const [masterItemId, rows] of rowsByMaster.entries()) {
      map.set(masterItemId, resolveCurrentProductSyncProfileRows(rows));
    }
    return map;
  }, [galleryMappingsQuery.data?.data]);

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
        currentProductSyncProfile: CurrentProductSyncProfile;
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
        primaryMasterId: '',
        currentProductSyncProfile: 'GENERAL',
      };
      if (!item.primaryMasterId) {
        if (masterItemId) item.primaryMasterId = masterItemId;
      }
      item.productNos.add(productNo);
      const currentIsNumeric = /^\d+$/u.test(item.productNo);
      const incomingIsNumeric = /^\d+$/u.test(productNo);
      if ((!currentIsNumeric && incomingIsNumeric) || (!item.productNo && productNo)) {
        item.productNo = productNo;
      }
      const modelName = String(row.model_name ?? "").trim();
      if (modelName) item.modelNames.add(modelName);
      const rowCurrentProductSyncProfile = normalizeCurrentProductSyncProfile(
        (masterItemId ? galleryCurrentProductSyncProfileByMaster.get(masterItemId) : null) ?? row.current_product_sync_profile,
      );
      if (rowCurrentProductSyncProfile === 'MARKET_LINKED') item.currentProductSyncProfile = rowCurrentProductSyncProfile;
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
        currentProductSyncProfile: item.currentProductSyncProfile,
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
  }, [dashboardGalleryQuery.data?.data, galleryCurrentProductSyncProfileByMaster, gallerySearch, galleryImageByMasterId]);



  const variantLookupQuery = useQuery({
    queryKey: ["auto-price-variant-lookup", effectiveChannelId, editorMasterItemId, editorProductNo || editorPreview?.productNo || "", editorReloadNonce],
    enabled: Boolean(effectiveChannelId && editorMasterItemId && (editorProductNo || editorPreview?.productNo)),
    queryFn: () =>
      shopApiGet<VariantLookupResponse>(
        `/api/channel-products/variants?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}&external_product_no=${encodeURIComponent(String(editorProductNo || editorPreview?.productNo || ""))}&_ts=${encodeURIComponent(String(editorReloadNonce))}`,
      ),
  });
  useEffect(() => {
    const productNo = String(editorProductNo || editorPreview?.productNo || "").trim();
    if (!effectiveChannelId || !editorMasterItemId || !productNo) {
      setVariantLookupFallbackData(null);
      return;
    }
    let cancelled = false;
    shopApiGet<VariantLookupResponse>(
      `/api/channel-products/variants?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}&external_product_no=${encodeURIComponent(productNo)}&_ts=${encodeURIComponent(String(Date.now()))}`,
    )
      .then((response) => {
        if (!cancelled) setVariantLookupFallbackData(response.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setVariantLookupFallbackData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [editorMasterItemId, editorPreview?.productNo, editorProductNo, effectiveChannelId, editorReloadNonce]);
  const variantLookupData = variantLookupQuery.data?.data ?? variantLookupFallbackData;
  const ensureVariantLookupData = async (): Promise<VariantLookupResponse["data"] | null> => {
    const existing = variantLookupQuery.data?.data ?? variantLookupFallbackData;
    if (existing) return existing;
    const productNo = String(editorProductNo || editorPreview?.productNo || "").trim();
    if (!effectiveChannelId || !editorMasterItemId || !productNo) return null;
    const response = await shopApiGet<VariantLookupResponse>(
      `/api/channel-products/variants?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}&external_product_no=${encodeURIComponent(productNo)}&_ts=${encodeURIComponent(String(Date.now()))}`,
    );
    setVariantLookupFallbackData(response.data ?? null);
    return response.data ?? null;
  };
  const loadedVariants = useMemo(() => variantLookupData?.variants ?? [], [variantLookupData?.variants]);
  const loadedOptionAllowlist = useMemo(
    () => variantLookupData?.option_detail_allowlist ?? EMPTY_OPTION_ALLOWLIST,
    [variantLookupData?.option_detail_allowlist],
  );
  const savedOptionCategories = useMemo(
    () => variantLookupData?.saved_option_categories ?? [],
    [variantLookupData?.saved_option_categories],
  );
  const canonicalOptionRows = useMemo(
    () => variantLookupData?.canonical_option_rows ?? [],
    [variantLookupData?.canonical_option_rows],
  );
  const canonicalOptionRowByEntryKey = useMemo(() => {
    const next = new Map<string, MappingCanonicalOptionRow>();
    for (const row of canonicalOptionRows) {
      if (!row.entry_key || next.has(row.entry_key)) continue;
      next.set(row.entry_key, row);
    }
    return next;
  }, [canonicalOptionRows]);
  const resolvedMasterMaterialCode = useMemo(
    () => String(variantLookupData?.master_material_code ?? "").trim()
      || canonicalOptionRows.find((row) => String(row.material_code_resolved ?? "").trim())?.material_code_resolved
      || null,
    [canonicalOptionRows, variantLookupData?.master_material_code],
  );
  const fallbackSizeMaterialCode = useMemo(
    () => String(variantLookupData?.master_material_code ?? "").trim()
      || resolvedMasterMaterialCode
      || Object.keys(loadedOptionAllowlist.sizes_by_material ?? {}).find((key) => String(key ?? "").trim())
      || null,
    [loadedOptionAllowlist.sizes_by_material, resolvedMasterMaterialCode, variantLookupData?.master_material_code],
  );
  const resolvedMasterMaterialLabel = useMemo(
    () => canonicalOptionRows.find((row) => String(row.material_label_resolved ?? "").trim())?.material_label_resolved
      ?? canonicalOptionRows.find((row) => String(row.material_code_resolved ?? "").trim())?.material_code_resolved
      ?? null,
    [canonicalOptionRows],
  );
  const requestedEditorProductNo = String(editorProductNo || editorPreview?.productNo || "").trim();
  const resolvedEditorProductNo = String(variantLookupData?.resolved_product_no ?? requestedEditorProductNo).trim();
  const canonicalEditorProductNo = String(
    variantLookupData?.canonical_external_product_no
      ?? variantLookupData?.resolved_product_no
      ?? requestedEditorProductNo
      ?? "",
  ).trim();
  const optionLaborRuleProductNo = String(requestedEditorProductNo || resolvedEditorProductNo || canonicalEditorProductNo || "").trim();
  const optionEntries = useMemo(() => {
    const baseEntries = buildMappingOptionEntries({
      productOptions: (editorPreview?.options ?? []).map((option) => ({
        option_name: option.option_name,
        option_value: (option.option_value ?? []).map((value) => ({ option_text: value?.option_text })),
      })),
      variants: (editorPreview?.variants ?? []).map((variant) => ({
        options: (variant.options ?? []).map((option) => ({ name: option.name, value: option.value })),
      })),
    }).map((entry) => ({
      optionName: entry.option_name,
      optionValue: entry.option_value,
      axisIndex: entry.axis_index,
      entryKey: entry.entry_key,
    }));
    const existingKeys = new Set(baseEntries.map((entry) => entry.entryKey));
    const syntheticEntries = canonicalOptionRows
      .filter((row) => row.entry_key && !existingKeys.has(row.entry_key))
      .map((row) => ({
        optionName: row.option_name,
        optionValue: row.option_value,
        axisIndex: row.axis_index,
        entryKey: row.entry_key,
      }));
    return [...baseEntries, ...syntheticEntries];
  }, [canonicalOptionRows, editorPreview]);
  const savedOptionCategoryByName = useMemo(() => {
    const next = new Map<string, OptionCategoryKey>();
    for (const row of savedOptionCategories) {
      const optionName = String(row.option_name ?? "").trim();
      if (!optionName || next.has(optionName)) continue;
      next.set(optionName, row.category_key);
    }
    return next;
  }, [savedOptionCategories]);
  const savedOptionCategoryByEntryKey = useMemo(() => {
    const next = new Map<string, OptionCategoryRow>();
    for (const row of savedOptionCategories) {
      const key = optionEntryKey(row.option_name, row.option_value);
      if (!key || next.has(key)) continue;
      next.set(key, row);
    }
    return next;
  }, [savedOptionCategories]);

  const editorMappingsQuery = useQuery({
    queryKey: ["auto-price-editor-mappings", effectiveChannelId, editorMasterItemId],
    enabled: Boolean(effectiveChannelId && editorMasterItemId),
    queryFn: () =>
      shopApiGet<{ data: MappingRow[] }>(
        `/api/channel-products?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}`,
      ),
  });
  const siblingMappings = useMemo(() => editorMappingsQuery.data?.data ?? [], [editorMappingsQuery.data?.data]);
  const editorProductNos = useMemo(
    () => Array.from(new Set([requestedEditorProductNo, String(editorPreview?.productNo ?? "").trim(), resolvedEditorProductNo, canonicalEditorProductNo].filter(Boolean))),
    [canonicalEditorProductNo, editorPreview?.productNo, requestedEditorProductNo, resolvedEditorProductNo],
  );
  const editorMappings = useMemo(() => {
    if (editorProductNos.length === 0) return siblingMappings;
    return siblingMappings.filter((row) => editorProductNos.includes(String(row.external_product_no ?? "").trim()));
  }, [editorProductNos, siblingMappings]);
  const editorMappingIndex = useMemo(() => {
    const index = new Map<string, MappingRow>();
    for (const row of editorMappings) {
      const variantCode = normalizeVariantCode(row.external_variant_code);
      if (variantCode && !index.has(variantCode)) index.set(variantCode, row);
    }
    return index;
  }, [editorMappings]);
  const siblingSyncRuleSetId = useMemo(() => {
    const values = Array.from(
      new Set(
        siblingMappings
          .filter((row) => row.is_active !== false && (row.option_price_mode ?? "SYNC") === "SYNC")
          .map((row) => String(row.sync_rule_set_id ?? "").trim())
          .filter(Boolean),
      ),
    );
    return values.length === 1 ? (values[0] ?? "") : "";
  }, [siblingMappings]);

  const optionLaborRulesQuery = useQuery({
    queryKey: ["auto-price-option-labor-rules", effectiveChannelId, editorMasterItemId, optionLaborRuleProductNo, editorReloadNonce],
    enabled: Boolean(effectiveChannelId && editorMasterItemId && optionLaborRuleProductNo),
    queryFn: () =>
      shopApiGet<{ data: OptionLaborRuleRow[] }>(
        `/api/option-labor-rules?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}&external_product_no=${encodeURIComponent(optionLaborRuleProductNo)}&_ts=${encodeURIComponent(String(editorReloadNonce))}`,
      ),
  });
  const optionLaborRuleRows = useMemo(
    () => (optionLaborRulesQuery.data?.data ?? []).filter((row) => row.is_active !== false),
    [optionLaborRulesQuery.data?.data],
  );
  const optionLaborRulePoolsQuery = useQuery({
    queryKey: ["auto-price-option-labor-rule-pools", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<OptionLaborRulePoolsResponse>(
        `/api/option-labor-rule-pools?channel_id=${encodeURIComponent(effectiveChannelId)}`,
      ),
  });
  const pooledDecorChoices = useMemo(() => {
    return (optionLaborRulePoolsQuery.data?.data?.decoration_masters ?? [])
      .map((master) => ({
        value: String(master.model_name ?? master.master_item_id).trim(),
        label: String(master.model_name ?? master.master_item_id).trim(),
        decoration_master_id: master.master_item_id,
        decoration_model_name: String(master.model_name ?? master.master_item_id).trim(),
        total_labor_cost_krw: Math.round(Number(master.total_labor_cost_krw ?? 0)),
        total_labor_sell_krw: Math.round(Number((master as { total_labor_sell_krw?: number | null }).total_labor_sell_krw ?? 0)),
      }))
      .filter((choice) => choice.value && choice.decoration_master_id);
  }, [optionLaborRulePoolsQuery.data?.data?.decoration_masters]);
  const pooledDecorCostByMasterId = useMemo(() => {
    const next = new Map<string, { totalLaborCostKrw: number; totalLaborSellKrw: number }>();
    for (const choice of pooledDecorChoices) {
      const masterId = String(choice.decoration_master_id ?? "").trim();
      if (!masterId || next.has(masterId)) continue;
      next.set(masterId, {
        totalLaborCostKrw: Math.round(Number(choice.total_labor_cost_krw ?? 0)),
        totalLaborSellKrw: Math.round(Number(choice.total_labor_sell_krw ?? 0)),
      });
    }
    return next;
  }, [pooledDecorChoices]);
  const sizeRuleMarketContext = useMemo(() => {
    const factors = variantLookupData?.size_market_context?.materialFactors;
    return {
      goldTickKrwPerG: Math.round(Number(variantLookupData?.size_market_context?.goldTickKrwPerG ?? editorPreview?.tick_gold_krw_per_g ?? 0)),
      silverTickKrwPerG: Math.round(Number(variantLookupData?.size_market_context?.silverTickKrwPerG ?? editorPreview?.tick_silver_krw_per_g ?? 0)),
      materialFactors: factors && typeof factors === "object" ? factors : null,
    };
  }, [
    editorPreview?.tick_gold_krw_per_g,
    editorPreview?.tick_silver_krw_per_g,
    variantLookupData?.size_market_context?.goldTickKrwPerG,
    variantLookupData?.size_market_context?.materialFactors,
    variantLookupData?.size_market_context?.silverTickKrwPerG,
  ]);
  const sizeRuleRows = useMemo(
    () => optionLaborRuleRows.filter((row) => row.category_key === "SIZE"),
    [optionLaborRuleRows],
  );
  const colorRuleRows = useMemo(
    () => optionLaborRuleRows.filter((row) => row.category_key === "COLOR_PLATING"),
    [optionLaborRuleRows],
  );
  const colorCodesByMaterial = useMemo(() => {
    const next = new Map<string, string[]>();
    for (const row of colorRuleRows) {
      const materialCode = String(row.scope_material_code ?? "").trim();
      const colorCode = String(row.color_code ?? "").trim();
      if (!materialCode || !colorCode) continue;
      const bucket = next.get(materialCode) ?? [];
      if (!bucket.includes(colorCode)) bucket.push(colorCode);
      next.set(materialCode, bucket);
    }
    for (const [materialCode, bucket] of next.entries()) {
      next.set(materialCode, bucket.sort((a, b) => a.localeCompare(b)));
    }
    return next;
  }, [colorRuleRows]);
  const colorAmountChoicesByMaterialColor = useMemo(() => {
    const next = new Map<string, number[]>();
    for (const row of colorRuleRows) {
      const materialCode = String(row.scope_material_code ?? "").trim();
      const colorCode = String(row.color_code ?? "").trim();
      if (!materialCode || !colorCode) continue;
      const amount = Math.round(Number(row.additive_delta_krw ?? 0));
      const key = `${materialCode}::${colorCode}`;
      const bucket = next.get(key) ?? [];
      if (!bucket.includes(amount)) bucket.push(amount);
      next.set(key, bucket);
    }
    for (const [key, bucket] of next.entries()) {
      next.set(key, bucket.sort((a, b) => a - b));
    }
    return next;
  }, [colorRuleRows]);
  const colorLabelByCode = useMemo(() => {
    const next = new Map<string, string>();
    for (const choice of loadedOptionAllowlist.colors) {
      const value = String(choice.value ?? "").trim();
      if (!value || next.has(value)) continue;
      next.set(value, choice.label || value);
    }
    return next;
  }, [loadedOptionAllowlist.colors]);
  const materialChoicePool = useMemo(() => {
    const next = new Map<string, { value: string; label: string }>();
    for (const choice of loadedOptionAllowlist.materials) {
      const value = String(choice.value ?? "").trim();
      if (!value || next.has(value)) continue;
      next.set(value, { value, label: choice.label || value });
    }
    for (const row of optionLaborRuleRows) {
      const value = String(row.scope_material_code ?? "").trim();
      if (!value || next.has(value)) continue;
      next.set(value, { value, label: value });
    }
    return Array.from(next.values()).sort((left, right) => left.value.localeCompare(right.value));
  }, [loadedOptionAllowlist.materials, optionLaborRuleRows]);
  const hasChoiceValue = (choices: Array<{ value: string }>, value: string | null | undefined): boolean => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return false;
    return choices.some((choice) => String(choice.value ?? '').trim() === normalized);
  };
  const decorRuleByMasterId = useMemo(() => {
    const next = new Map<string, OptionLaborRuleRow>();
    for (const row of optionLaborRuleRows) {
      if (row.category_key !== "DECOR") continue;
      const key = String(row.decoration_master_id ?? "").trim();
      if (!key || next.has(key)) continue;
      next.set(key, row);
    }
    return next;
  }, [optionLaborRuleRows]);
  const allowedDecorChoices = useMemo(() => {
    return loadedOptionAllowlist.decors.filter((choice) => String(choice.decoration_master_id ?? "").trim().length > 0);
  }, [loadedOptionAllowlist.decors]);
  const decorChoiceByMasterId = useMemo(() => {
    const next = new Map<string, MappingOptionAllowlist["decors"][number]>();
    for (const choice of allowedDecorChoices) {
      const masterId = String(choice.decoration_master_id ?? "").trim();
      if (!masterId || next.has(masterId)) continue;
      next.set(masterId, choice);
    }
    return next;
  }, [allowedDecorChoices]);
  const optionLaborRuleEngineActive = hasAnyActiveOptionLaborRule(optionLaborRuleRows);

  const findExistingRowForVariant = (variant: {
    variantCode?: string | null;
    customVariantCode?: string | null;
    variant_code?: string | null;
    custom_variant_code?: string | null;
  }): MappingRow | null => {
    for (const candidateCode of candidateVariantCodes(variant)) {
      const existing = editorMappingIndex.get(candidateCode);
      if (existing) return existing;
    }
    return null;
  };

  const variantLookupIndex = useMemo(() => {
    const index = new Map<string, VariantLookupVariant>();
    for (const variant of loadedVariants) {
      for (const candidateCode of candidateVariantCodes(variant)) {
        if (candidateCode && !index.has(candidateCode)) index.set(candidateCode, variant);
      }
    }
    return index;
  }, [loadedVariants]);

  const variantDraftResetKey = useMemo(
    () => [
      effectiveChannelId,
      editorMasterItemId,
      optionLaborRuleProductNo || canonicalEditorProductNo || resolvedEditorProductNo || String(editorPreview?.productNo ?? "").trim(),
      String(editorReloadNonce || 0),
    ].join("|"),
    [canonicalEditorProductNo, editorMasterItemId, editorPreview?.productNo, editorReloadNonce, effectiveChannelId, optionLaborRuleProductNo, resolvedEditorProductNo],
  );
  const defaultOptionCategoryDrafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      if (!next[entry.optionName]) {
        next[entry.optionName] = resolvePreferredCategoryForOptionName(
          entry.optionName,
          canonicalOptionRowByEntryKey.get(entry.entryKey)?.category_key,
          savedOptionCategoryByName.get(entry.optionName),
        );
      }
    }
    return next;
  }, [canonicalOptionRowByEntryKey, optionEntries, savedOptionCategoryByName]);
  const optionCategoryDrafts =
    optionCategoryDraftSlot.resetKey === variantDraftResetKey ? optionCategoryDraftSlot.value : defaultOptionCategoryDrafts;
  const setOptionCategoryDrafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionCategoryDraftSlot.resetKey === variantDraftResetKey ? optionCategoryDraftSlot.value : defaultOptionCategoryDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionCategoryDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const defaultOptionSyncDeltaDrafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      const savedRow = savedOptionCategoryByEntryKey.get(entry.entryKey);
      next[entry.entryKey] = String(Math.round(Number(canonicalRow?.sync_delta_krw_legacy ?? savedRow?.sync_delta_krw ?? 0)));
    }
    return next;
  }, [canonicalOptionRowByEntryKey, optionEntries, savedOptionCategoryByEntryKey]);
  const optionSyncDeltaDrafts =
    optionSyncDeltaDraftSlot.resetKey === variantDraftResetKey ? optionSyncDeltaDraftSlot.value : defaultOptionSyncDeltaDrafts;
  const setOptionSyncDeltaDrafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionSyncDeltaDraftSlot.resetKey === variantDraftResetKey ? optionSyncDeltaDraftSlot.value : defaultOptionSyncDeltaDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionSyncDeltaDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const defaultOptionOtherReasonDrafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      next[entry.entryKey] = String(canonicalRow?.other_reason ?? "").trim();
    }
    return next;
  }, [canonicalOptionRowByEntryKey, optionEntries]);
  const optionOtherReasonDrafts =
    optionOtherReasonDraftSlot.resetKey === variantDraftResetKey ? optionOtherReasonDraftSlot.value : defaultOptionOtherReasonDrafts;
  const setOptionOtherReasonDrafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionOtherReasonDraftSlot.resetKey === variantDraftResetKey ? optionOtherReasonDraftSlot.value : defaultOptionOtherReasonDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionOtherReasonDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const effectiveOptionOtherReasonByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const raw = optionOtherReasonDrafts[entry.entryKey] ?? defaultOptionOtherReasonDrafts[entry.entryKey] ?? "";
      next.set(entry.entryKey, String(raw).trim());
    }
    return next;
  }, [defaultOptionOtherReasonDrafts, optionEntries, optionOtherReasonDrafts]);
  const defaultOptionDecorSelectionDrafts = useMemo(() => {
    const next: StringMap = {};
    const fallbackDecorMasterId = String(allowedDecorChoices[0]?.decoration_master_id ?? "").trim();
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      const categoryKey = resolvePreferredCategoryForOptionName(entry.optionName, canonicalRow?.category_key);
      const currentValue = String(canonicalRow?.decor_master_item_id_selected ?? "").trim();
      next[entry.entryKey] = categoryKey === "DECOR"
        ? (currentValue || fallbackDecorMasterId)
        : currentValue;
    }
    return next;
  }, [allowedDecorChoices, canonicalOptionRowByEntryKey, optionEntries]);
  const optionDecorSelectionDrafts =
    optionDecorSelectionDraftSlot.resetKey === variantDraftResetKey ? optionDecorSelectionDraftSlot.value : defaultOptionDecorSelectionDrafts;
  const setOptionDecorSelectionDrafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionDecorSelectionDraftSlot.resetKey === variantDraftResetKey ? optionDecorSelectionDraftSlot.value : defaultOptionDecorSelectionDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionDecorSelectionDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const effectiveOptionDecorSelectionByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const raw = optionDecorSelectionDrafts[entry.entryKey] ?? defaultOptionDecorSelectionDrafts[entry.entryKey] ?? "";
      next.set(entry.entryKey, String(raw).trim());
    }
    return next;
  }, [defaultOptionDecorSelectionDrafts, optionDecorSelectionDrafts, optionEntries]);

  const defaultOptionNoticeSelectionDrafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      next[entry.entryKey] = String(canonicalRow?.notice_value_selected ?? entry.optionValue ?? "").trim();
    }
    return next;
  }, [canonicalOptionRowByEntryKey, optionEntries]);
  const optionNoticeSelectionDrafts =
    optionNoticeSelectionDraftSlot.resetKey === variantDraftResetKey ? optionNoticeSelectionDraftSlot.value : defaultOptionNoticeSelectionDrafts;
  const setOptionNoticeSelectionDrafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionNoticeSelectionDraftSlot.resetKey === variantDraftResetKey ? optionNoticeSelectionDraftSlot.value : defaultOptionNoticeSelectionDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionNoticeSelectionDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const effectiveOptionNoticeSelectionByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const raw = optionNoticeSelectionDrafts[entry.entryKey] ?? defaultOptionNoticeSelectionDrafts[entry.entryKey] ?? "";
      next.set(entry.entryKey, String(raw).trim());
    }
    return next;
  }, [defaultOptionNoticeSelectionDrafts, optionEntries, optionNoticeSelectionDrafts]);
  const defaultOptionAxis1Drafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      const draftCategoryKey = String(optionCategoryDrafts[entry.optionName] ?? "").trim() as OptionCategoryKey;
      const categoryKey = CATEGORY_OPTIONS.some((option) => option.key === draftCategoryKey)
        ? draftCategoryKey
        : resolvePreferredCategoryForOptionName(entry.optionName, canonicalRow?.category_key);
      const resolvedMaterialCode = String(canonicalRow?.material_code_resolved ?? "").trim();
      if (categoryKey === "SIZE") {
        next[entry.entryKey] = String(fallbackSizeMaterialCode || resolvedMasterMaterialCode || resolvedMaterialCode || "").trim();
      } else if (categoryKey === "COLOR_PLATING" || categoryKey === "OTHER") {
        next[entry.entryKey] = hasChoiceValue(materialChoicePool, resolvedMaterialCode) ? resolvedMaterialCode : "";
      } else if (categoryKey === "DECOR") {
        next[entry.entryKey] = String(
          canonicalRow?.decor_material_code_snapshot
          ?? canonicalRow?.material_code_resolved
          ?? resolvedMasterMaterialCode
          ?? resolvedMaterialCode
          ?? "",
        ).trim();
      } else {
        next[entry.entryKey] = "";
      }
    }
    return next;
  }, [canonicalOptionRowByEntryKey, fallbackSizeMaterialCode, materialChoicePool, optionCategoryDrafts, optionEntries]);
  const optionAxis1Drafts =
    optionAxis1DraftSlot.resetKey === variantDraftResetKey ? optionAxis1DraftSlot.value : defaultOptionAxis1Drafts;
  const setOptionAxis1Drafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionAxis1DraftSlot.resetKey === variantDraftResetKey ? optionAxis1DraftSlot.value : defaultOptionAxis1Drafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionAxis1DraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const defaultOptionAxis2Drafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      const draftCategoryKey = String(optionCategoryDrafts[entry.optionName] ?? "").trim() as OptionCategoryKey;
      const categoryKey = CATEGORY_OPTIONS.some((option) => option.key === draftCategoryKey)
        ? draftCategoryKey
        : resolvePreferredCategoryForOptionName(entry.optionName, canonicalRow?.category_key);
      const resolvedMaterialCode = String(canonicalRow?.material_code_resolved ?? "").trim();
      if (categoryKey === "SIZE") {
        const sizeMaterialCode = String(fallbackSizeMaterialCode || resolvedMasterMaterialCode || resolvedMaterialCode || "").trim();
        const sizeValue = canonicalRow?.size_weight_g_selected == null ? "" : formatOptionSizeValue(canonicalRow.size_weight_g_selected);
        const sizeChoices = loadedOptionAllowlist.sizes_by_material[sizeMaterialCode] ?? [];
        next[entry.entryKey] = hasChoiceValue(sizeChoices, sizeValue) ? sizeValue : "";
      } else if (categoryKey === "COLOR_PLATING") {
        const colorValue = String(canonicalRow?.color_code_selected ?? "").trim();
        const scopedChoices = (colorCodesByMaterial.get(resolvedMaterialCode) ?? []).map((value) => ({ value }));
        const fallbackChoices = loadedOptionAllowlist.colors.map((choice) => ({ value: String(choice.value ?? "").trim() })).filter((choice) => choice.value);
        const colorChoices = scopedChoices.length > 0 ? scopedChoices : fallbackChoices;
        next[entry.entryKey] = hasChoiceValue(colorChoices, colorValue) ? colorValue : "";
      } else if (categoryKey === "DECOR") {
        next[entry.entryKey] = String(canonicalRow?.decor_model_name_selected ?? "").trim();
      } else if (categoryKey === "OTHER") {
        next[entry.entryKey] = String(canonicalRow?.other_reason ?? "").trim();
      } else {
        next[entry.entryKey] = "";
      }
    }
    return next;
  }, [canonicalOptionRowByEntryKey, colorCodesByMaterial, fallbackSizeMaterialCode, loadedOptionAllowlist.colors, loadedOptionAllowlist.sizes_by_material, optionCategoryDrafts, optionEntries, resolvedMasterMaterialCode]);
  const optionAxis2Drafts =
    optionAxis2DraftSlot.resetKey === variantDraftResetKey ? optionAxis2DraftSlot.value : defaultOptionAxis2Drafts;
  const setOptionAxis2Drafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionAxis2DraftSlot.resetKey === variantDraftResetKey ? optionAxis2DraftSlot.value : defaultOptionAxis2Drafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionAxis2DraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const defaultOptionAxis3Drafts = useMemo(() => {
    const next: StringMap = {};
    for (const entry of optionEntries) {
      const canonicalRow = canonicalOptionRowByEntryKey.get(entry.entryKey);
      const categoryKey = resolvePreferredCategoryForOptionName(entry.optionName, canonicalRow?.category_key);
      if (categoryKey === "DECOR") {
        next[entry.entryKey] = String(Math.round(Number(canonicalRow?.decor_final_amount_krw ?? 0)));
      } else if (categoryKey === "COLOR_PLATING" || categoryKey === "SIZE") {
        next[entry.entryKey] = String(Math.round(Number(canonicalRow?.resolved_delta_krw ?? canonicalRow?.sync_delta_krw_legacy ?? 0)));
      } else {
        next[entry.entryKey] = "";
      }
    }
    return next;
  }, [canonicalOptionRowByEntryKey, optionEntries]);
  const optionAxis3Drafts =
    optionAxis3DraftSlot.resetKey === variantDraftResetKey ? optionAxis3DraftSlot.value : defaultOptionAxis3Drafts;
  const setOptionAxis3Drafts = (next: StringMap | ((current: StringMap) => StringMap)) => {
    const current = optionAxis3DraftSlot.resetKey === variantDraftResetKey ? optionAxis3DraftSlot.value : defaultOptionAxis3Drafts;
    const value = typeof next === "function" ? next(current) : next;
    setOptionAxis3DraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const effectiveOptionAxis1ByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const draftValue = String(optionAxis1Drafts[entry.entryKey] ?? "").trim();
      const defaultValue = String(defaultOptionAxis1Drafts[entry.entryKey] ?? "").trim();
      const draftCategoryKey = String(optionCategoryDrafts[entry.optionName] ?? "").trim() as OptionCategoryKey;
      const categoryKey = CATEGORY_OPTIONS.some((option) => option.key === draftCategoryKey)
        ? draftCategoryKey
        : resolvePreferredCategoryForOptionName(entry.optionName, canonicalOptionRowByEntryKey.get(entry.entryKey)?.category_key);
      const raw = categoryKey === "SIZE"
        ? (draftValue || defaultValue)
        : (draftValue || defaultValue);
      next.set(entry.entryKey, raw);
    }
    return next;
  }, [canonicalOptionRowByEntryKey, defaultOptionAxis1Drafts, optionAxis1Drafts, optionCategoryDrafts, optionEntries]);
  const effectiveOptionAxis2ByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const draftValue = String(optionAxis2Drafts[entry.entryKey] ?? "").trim();
      const defaultValue = String(defaultOptionAxis2Drafts[entry.entryKey] ?? "").trim();
      const draftCategoryKey = String(optionCategoryDrafts[entry.optionName] ?? "").trim() as OptionCategoryKey;
      const categoryKey = CATEGORY_OPTIONS.some((option) => option.key === draftCategoryKey)
        ? draftCategoryKey
        : resolvePreferredCategoryForOptionName(entry.optionName, canonicalOptionRowByEntryKey.get(entry.entryKey)?.category_key);
      const raw = categoryKey === "SIZE"
        ? (draftValue || defaultValue)
        : (draftValue || defaultValue);
      next.set(entry.entryKey, raw);
    }
    return next;
  }, [canonicalOptionRowByEntryKey, defaultOptionAxis2Drafts, optionAxis2Drafts, optionCategoryDrafts, optionEntries]);
  const effectiveOptionAxis3ByEntryKey = useMemo(() => {
    const next = new Map<string, string>();
    for (const entry of optionEntries) {
      const raw = optionAxis3Drafts[entry.entryKey] ?? defaultOptionAxis3Drafts[entry.entryKey] ?? "";
      next.set(entry.entryKey, String(raw).trim());
    }
    return next;
  }, [defaultOptionAxis3Drafts, optionAxis3Drafts, optionEntries]);
  const effectiveCategoryByOptionName = useMemo(() => {
    const next = new Map<string, OptionCategoryKey>();
    for (const entry of optionEntries) {
      const draftValue = String(optionCategoryDrafts[entry.optionName] ?? "").trim() as OptionCategoryKey;
      next.set(
        entry.optionName,
        CATEGORY_OPTIONS.some((option) => option.key === draftValue)
          ? draftValue
          : resolvePreferredCategoryForOptionName(entry.optionName, savedOptionCategoryByName.get(entry.optionName)),
      );
    }
    return next;
  }, [optionCategoryDrafts, optionEntries, savedOptionCategoryByName]);
  useEffect(() => {
    const sizeMaterialCode = String(fallbackSizeMaterialCode || "").trim();
    if (!sizeMaterialCode) return;
    setOptionAxis1Drafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of optionEntries) {
        const categoryKey = effectiveCategoryByOptionName.get(entry.optionName)
          ?? resolvePreferredCategoryForOptionName(entry.optionName, canonicalOptionRowByEntryKey.get(entry.entryKey)?.category_key);
        if (categoryKey !== "SIZE") continue;
        const currentValue = String(next[entry.entryKey] ?? "").trim();
        if (currentValue) continue;
        next[entry.entryKey] = sizeMaterialCode;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [canonicalOptionRowByEntryKey, effectiveCategoryByOptionName, fallbackSizeMaterialCode, optionEntries]);
  const effectiveOptionSyncDeltaByEntryKey = useMemo(() => {
    const next = new Map<string, number>();
    for (const entry of optionEntries) {
      const raw = optionSyncDeltaDrafts[entry.entryKey] ?? defaultOptionSyncDeltaDrafts[entry.entryKey] ?? "0";
      next.set(entry.entryKey, Math.round(parseNumericInput(raw) ?? 0));
    }
    return next;
  }, [defaultOptionSyncDeltaDrafts, optionEntries, optionSyncDeltaDrafts]);
  const handleOptionCategoryChange = (optionName: string, nextCategoryKey: OptionCategoryKey) => {
    setOptionCategoryDrafts((prev) => ({ ...prev, [optionName]: nextCategoryKey }));
    const targetEntries = optionEntries.filter((entry) => entry.optionName === optionName);
    if (targetEntries.length === 0) return;
    if (nextCategoryKey === "SIZE") {
      void ensureVariantLookupData().then((data) => {
        const sizeMaterialCode = String(data?.master_material_code ?? "").trim()
          || Object.keys(data?.option_detail_allowlist?.sizes_by_material ?? {}).find((key) => String(key ?? "").trim())
          || "";
        if (!sizeMaterialCode) return;
        setOptionAxis1Drafts((prev) => {
          const next = { ...prev };
          for (const entry of targetEntries) next[entry.entryKey] = sizeMaterialCode;
          return next;
        });
      }).catch(() => {});
    }

    setOptionAxis1Drafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        if (nextCategoryKey === "SIZE") {
          delete next[entry.entryKey];
        } else {
          next[entry.entryKey] = "";
        }
      }
      return next;
    });
    setOptionAxis2Drafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        if (nextCategoryKey === "SIZE") delete next[entry.entryKey];
        else next[entry.entryKey] = "";
      }
      return next;
    });
    setOptionAxis3Drafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        if (nextCategoryKey === "SIZE") delete next[entry.entryKey];
        else next[entry.entryKey] = "";
      }
      return next;
    });
    setOptionDecorSelectionDrafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        next[entry.entryKey] = nextCategoryKey === "DECOR"
          ? String(allowedDecorChoices[0]?.decoration_master_id ?? "").trim()
          : "";
      }
      return next;
    });
    setOptionOtherReasonDrafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        next[entry.entryKey] = "";
      }
      return next;
    });
    setOptionNoticeSelectionDrafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        next[entry.entryKey] = nextCategoryKey === "NOTICE" ? String(entry.optionValue ?? "").trim() : "";
      }
      return next;
    });
    setOptionSyncDeltaDrafts((prev) => {
      const next = { ...prev };
      for (const entry of targetEntries) {
        next[entry.entryKey] = "0";
      }
      return next;
    });
  };

  const categoryOverrideByEntryKey = useMemo(() => {
    const next: Record<string, OptionCategoryKey> = {};
    for (const entry of optionEntries) {
      next[entry.entryKey] = effectiveCategoryByOptionName.get(entry.optionName)
        ?? canonicalOptionRowByEntryKey.get(entry.entryKey)?.category_key
        ?? guessCategoryByOptionName(entry.optionName);
    }
    return next;
  }, [canonicalOptionRowByEntryKey, effectiveCategoryByOptionName, optionEntries]);
  const axisSelectionByEntryKey = useMemo(() => {
    const next: Record<string, {
      axis1_value?: string | null;
      axis2_value?: string | null;
      axis3_value?: string | null;
      decor_master_item_id?: string | null;
      decor_extra_delta_krw?: number | null;
      decor_final_amount_krw?: number | null;
    }> = {};
    for (const entry of optionEntries) {
      const categoryKey = categoryOverrideByEntryKey[entry.entryKey] ?? guessCategoryByOptionName(entry.optionName);
      const axis1Value = effectiveOptionAxis1ByEntryKey.get(entry.entryKey) ?? "";
      const axis2Value = effectiveOptionAxis2ByEntryKey.get(entry.entryKey) ?? "";
      const axis3Value = effectiveOptionAxis3ByEntryKey.get(entry.entryKey) ?? "";
      const noticeValue = effectiveOptionNoticeSelectionByEntryKey.get(entry.entryKey) ?? "";
      const otherReason = effectiveOptionOtherReasonByEntryKey.get(entry.entryKey) ?? "";
      const decorMasterItemId = String(effectiveOptionDecorSelectionByEntryKey.get(entry.entryKey) ?? "").trim();

      if (categoryKey === "SIZE") {
        const sizeMaterialCode = String(fallbackSizeMaterialCode || resolvedMasterMaterialCode || axis1Value || "").trim();
        next[entry.entryKey] = {
          axis1_value: sizeMaterialCode || null,
          axis2_value: axis2Value || null,
          axis3_value: axis3Value || null,
          decor_master_item_id: null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        };
        continue;
      }

      if (categoryKey === "COLOR_PLATING") {
        next[entry.entryKey] = {
          axis1_value: axis1Value || null,
          axis2_value: axis2Value || null,
          axis3_value: axis3Value || null,
          decor_master_item_id: null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        };
        continue;
      }

      if (categoryKey === "DECOR") {
        next[entry.entryKey] = {
          axis1_value: null,
          axis2_value: axis2Value || null,
          axis3_value: null,
          decor_master_item_id: decorMasterItemId || null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        };
        continue;
      }

      if (categoryKey === "OTHER") {
        next[entry.entryKey] = {
          axis1_value: axis1Value || null,
          axis2_value: axis2Value || otherReason || null,
          axis3_value: axis3Value || null,
          decor_master_item_id: null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        };
        continue;
      }

      if (categoryKey === "NOTICE") {
        next[entry.entryKey] = {
          axis1_value: noticeValue || null,
          axis2_value: null,
          axis3_value: null,
          decor_master_item_id: null,
          decor_extra_delta_krw: null,
          decor_final_amount_krw: null,
        };
      }
    }
    return next;
  }, [
    categoryOverrideByEntryKey,
    effectiveOptionAxis1ByEntryKey,
    effectiveOptionAxis2ByEntryKey,
    effectiveOptionAxis3ByEntryKey,
    fallbackSizeMaterialCode,
    resolvedMasterMaterialCode,
    effectiveOptionDecorSelectionByEntryKey,
    effectiveOptionNoticeSelectionByEntryKey,
    effectiveOptionOtherReasonByEntryKey,
    optionEntries,
  ]);
  const evaluatedOptionRows = useMemo(() => buildCanonicalOptionRows({
    productOptions: (editorPreview?.options ?? []).map((option) => ({
      option_name: option.option_name,
      option_value: (option.option_value ?? []).map((value) => ({ option_text: value?.option_text })),
    })),
    variants: (editorPreview?.variants ?? []).map((variant) => ({
      options: (variant.options ?? []).map((option) => ({ name: option.name, value: option.value })),
    })),
    savedOptionCategories,
    rules: optionLaborRuleRows,
    masterMaterialCode: resolvedMasterMaterialCode,
    masterMaterialLabel: resolvedMasterMaterialLabel,
    otherReasonByEntryKey: Object.fromEntries(effectiveOptionOtherReasonByEntryKey.entries()),
    categoryOverrideByEntryKey,
    axisSelectionByEntryKey,
  }), [
    axisSelectionByEntryKey,
    categoryOverrideByEntryKey,
    editorPreview?.options,
    editorPreview?.variants,
    effectiveOptionOtherReasonByEntryKey,
    optionLaborRuleRows,
    resolvedMasterMaterialCode,
    resolvedMasterMaterialLabel,
    savedOptionCategories,
  ]);
  const evaluatedOptionRowByEntryKey = useMemo(() => {
    const next = new Map<string, MappingCanonicalOptionRow>();
    for (const row of evaluatedOptionRows) {
      if (!row.entry_key || next.has(row.entry_key)) continue;
      next.set(row.entry_key, row);
    }
    return next;
  }, [evaluatedOptionRows]);
  const resolveSizeRuleDeltaKrw = (materialCodeLike: string, weightTextLike: string): number | null => {
    const materialCode = String(materialCodeLike ?? "").trim();
    const weightValue = parseNumericInput(weightTextLike);
    if (!materialCode || weightValue == null) return null;
    const buckets = computeOptionLaborRuleBuckets(optionLaborRuleRows, {
      materialCode,
      additionalWeightG: weightValue,
      platingEnabled: false,
      colorCode: null,
      decorationCode: null,
      decorationMasterId: null,
    }, {
      masterItemId: editorMasterItemId,
      externalProductNo: optionLaborRuleProductNo,
      marketContext: sizeRuleMarketContext,
    });
    return Number.isFinite(Number(buckets.size)) ? Math.round(Number(buckets.size)) : null;
  };
  const compactOptionRows = useMemo<CompactOptionRow[]>(() => {
    return optionEntries.map((entry) => {
      const canonicalRow = evaluatedOptionRowByEntryKey.get(entry.entryKey)
        ?? canonicalOptionRowByEntryKey.get(entry.entryKey);
      const draftSyncDelta = effectiveOptionSyncDeltaByEntryKey.get(entry.entryKey) ?? 0;
      const categoryKey = categoryOverrideByEntryKey[entry.entryKey] ?? canonicalRow?.category_key ?? guessCategoryByOptionName(entry.optionName);
      const axis1DraftValue = effectiveOptionAxis1ByEntryKey.get(entry.entryKey);
      const axis2DraftValue = effectiveOptionAxis2ByEntryKey.get(entry.entryKey);
      const selectedMaterialCode = categoryKey === "SIZE"
        ? String(fallbackSizeMaterialCode || resolvedMasterMaterialCode || canonicalRow?.material_code_resolved || axis1DraftValue || "").trim()
        : String(axis1DraftValue ?? canonicalRow?.material_code_resolved ?? resolvedMasterMaterialCode ?? "").trim();
      const selectedColorCode = categoryKey === "COLOR_PLATING"
        ? String(axis2DraftValue ?? canonicalRow?.color_code_selected ?? "").trim()
        : String(canonicalRow?.color_code_selected ?? "").trim();
      const selectedSizeWeightText = categoryKey === "SIZE"
        ? String(axis2DraftValue ?? (canonicalRow?.size_weight_g_selected == null ? "" : formatOptionSizeValue(canonicalRow.size_weight_g_selected))).trim()
        : (canonicalRow?.size_weight_g_selected == null ? "" : formatOptionSizeValue(canonicalRow.size_weight_g_selected));
      const selectedDecorMasterId = categoryKey === "DECOR"
        ? String(
          effectiveOptionDecorSelectionByEntryKey.get(entry.entryKey)
          ?? canonicalRow?.decor_master_item_id_selected
          ?? allowedDecorChoices[0]?.decoration_master_id
          ?? "",
        ).trim()
        : String(canonicalRow?.decor_master_item_id_selected ?? "").trim();
      const selectedDecorChoice = selectedDecorMasterId
        ? (decorChoiceByMasterId.get(selectedDecorMasterId) ?? null)
        : null;
      const selectedDecorRule = selectedDecorMasterId
        ? (decorRuleByMasterId.get(selectedDecorMasterId) ?? null)
        : null;
      const pooledDecorCost = selectedDecorMasterId
        ? (pooledDecorCostByMasterId.get(selectedDecorMasterId) ?? null)
        : null;
      const canonicalDecorBaseLaborRaw = Number(canonicalRow?.decor_total_labor_cost_snapshot ?? Number.NaN);
      const canonicalDecorBaseLaborKrw = Number.isFinite(canonicalDecorBaseLaborRaw) && canonicalDecorBaseLaborRaw > 0
        ? Math.round(canonicalDecorBaseLaborRaw)
        : null;
      const decorBaseLaborKrw = Math.round(Number(
        selectedDecorRule?.base_labor_cost_krw
        ?? canonicalDecorBaseLaborKrw
        ?? selectedDecorChoice?.delta_krw
        ?? pooledDecorCost?.totalLaborCostKrw
        ?? 0,
      ));
      const decorExtraDeltaKrw = Math.round(Number(
        selectedDecorRule?.additive_delta_krw
        ?? canonicalRow?.decor_extra_delta_krw
        ?? 0,
      ));
      const decorFinalAmountKrw = Math.round(Number(
        (selectedDecorMasterId
          ? (decorBaseLaborKrw + decorExtraDeltaKrw)
          : canonicalRow?.decor_final_amount_krw)
        ?? 0,
      ));
      const otherReason = categoryKey === "OTHER"
        ? String(effectiveOptionOtherReasonByEntryKey.get(entry.entryKey) ?? canonicalRow?.other_reason ?? "").trim()
        : "";
      const noticeValue = categoryKey === "NOTICE"
        ? String(effectiveOptionNoticeSelectionByEntryKey.get(entry.entryKey) ?? canonicalRow?.notice_value_selected ?? entry.optionValue ?? "").trim()
        : String(canonicalRow?.notice_value_selected ?? entry.optionValue ?? "").trim();
      const rawAxisColumns = ["", "", ""];
      if (entry.axisIndex >= 0 && entry.axisIndex < rawAxisColumns.length) rawAxisColumns[entry.axisIndex] = entry.optionValue;
      const axisColumns = [...rawAxisColumns];
      const materialText = String(canonicalRow?.material_label_resolved ?? canonicalRow?.material_code_resolved ?? "").trim();
      const colorText = selectedColorCode || String(canonicalRow?.color_code_selected ?? "").trim();
      const decorMaterialText = String(selectedMaterialCode || canonicalRow?.decor_material_code_snapshot || materialText || "").trim();
      const decorModelText = String(
        selectedDecorChoice?.label
        ?? selectedDecorRule?.decoration_model_name
        ?? canonicalRow?.decor_model_name_selected
        ?? "",
      ).trim();
      const sizeWeightText = selectedSizeWeightText ? `${selectedSizeWeightText}g` : "";
      const decorReferenceText = [
        canonicalRow?.decor_weight_g_snapshot == null ? "" : `중량 ${Number(canonicalRow.decor_weight_g_snapshot)}g`,
        (selectedDecorRule?.base_labor_cost_krw
          ?? canonicalDecorBaseLaborKrw
          ?? selectedDecorChoice?.delta_krw
          ?? pooledDecorCost?.totalLaborCostKrw) == null
          ? ""
          : `공임 ${Math.round(Number(
            selectedDecorRule?.base_labor_cost_krw
            ?? canonicalDecorBaseLaborKrw
            ?? selectedDecorChoice?.delta_krw
            ?? pooledDecorCost?.totalLaborCostKrw
            ?? 0,
          ))}원`,
      ].filter(Boolean).join(" | ");

      if (categoryKey === "MATERIAL") {
        axisColumns[0] = materialText || entry.optionValue;
        axisColumns[1] = "";
        axisColumns[2] = "";
      } else if (categoryKey === "COLOR_PLATING") {
        axisColumns[0] = selectedMaterialCode || materialText || axisColumns[0];
        axisColumns[1] = colorText || entry.optionValue;
        axisColumns[2] = fmtKrw(canonicalRow?.resolved_delta_krw ?? draftSyncDelta);
      } else if (categoryKey === "SIZE") {
        axisColumns[0] = selectedMaterialCode || materialText || axisColumns[0];
        axisColumns[1] = sizeWeightText || entry.optionValue;
        axisColumns[2] = fmtKrw(canonicalRow?.resolved_delta_krw ?? draftSyncDelta);
      } else if (categoryKey === "DECOR") {
        axisColumns[0] = decorMaterialText || selectedMaterialCode || materialText || "";
        axisColumns[1] = decorModelText || entry.optionValue;
        axisColumns[2] = decorReferenceText;
      } else if (categoryKey === "NOTICE") {
        axisColumns[0] = noticeValue || entry.optionValue;
        axisColumns[1] = "";
        axisColumns[2] = "";
      } else if (categoryKey === "OTHER") {
        axisColumns[2] = otherReason || axisColumns[2];
      }

      const sizeResolvedDelta = categoryKey === "SIZE"
        ? resolveSizeRuleDeltaKrw(selectedMaterialCode, selectedSizeWeightText)
        : null;
      const sizeWarnings = categoryKey === "SIZE"
        ? (!selectedMaterialCode
          ? ["소재를 선택해야 합니다."]
          : !selectedSizeWeightText
            ? ["중량을 선택해야 합니다."]
            : sizeResolvedDelta == null
              ? ["현재 선택한 추가중량이 중앙 허용 범위 밖입니다."]
              : [])
        : [];
      const resolvedDeltaKrw = categoryKey === "NOTICE"
        ? 0
        : categoryKey === "SIZE"
          ? Math.round(Number(sizeResolvedDelta ?? 0))
          : categoryKey === "DECOR"
            ? decorFinalAmountKrw
          : Math.round(Number(canonicalRow?.resolved_delta_krw ?? draftSyncDelta));
      const syncDeltaKrw = categoryKey === "NOTICE"
        ? 0
        : categoryKey === "DECOR"
          ? decorFinalAmountKrw
          : categoryKey === "SIZE" || categoryKey === "COLOR_PLATING"
            ? resolvedDeltaKrw
            : draftSyncDelta;
      const legacyStatus = categoryKey === "SIZE"
        ? (sizeWarnings.length === 0 ? "VALID" : "UNRESOLVED")
        : categoryKey === "DECOR"
          ? (selectedDecorMasterId ? "VALID" : "UNRESOLVED")
        : (canonicalRow?.legacy_status ?? "VALID");
      const warnings = categoryKey === "SIZE"
        ? sizeWarnings
        : categoryKey === "DECOR"
          ? (selectedDecorMasterId ? [] : ["장식 마스터를 선택해야 합니다."])
        : (canonicalRow?.warnings ?? []);
      const sourceRuleEntryIds = categoryKey === "SIZE"
        ? (sizeResolvedDelta == null ? [] : (canonicalRow?.source_rule_entry_ids ?? []))
        : (canonicalRow?.source_rule_entry_ids ?? []);

      return {
        ...entry,
        categoryKey,
        syncDeltaKrw,
        resolvedDeltaKrw,
        legacyStatus,
        warnings,
        sourceRuleEntryIds,
        otherReason,
        axis1: axisColumns[0] ?? "",
        axis2: axisColumns[1] ?? "",
        axis3: axisColumns[2] ?? "",
        selectedMaterialCode,
        selectedColorCode,
        selectedSizeWeightText,
        selectedDecorMasterId,
        decorExtraDeltaKrw,
        decorFinalAmountKrw,
        noticeValue,
      };
    });
  }, [
    allowedDecorChoices,
    decorChoiceByMasterId,
    decorRuleByMasterId,
    categoryOverrideByEntryKey,
    canonicalOptionRowByEntryKey,
    effectiveOptionAxis1ByEntryKey,
    effectiveOptionAxis2ByEntryKey,
    effectiveOptionSyncDeltaByEntryKey,
    evaluatedOptionRowByEntryKey,
    optionEntries,
    fallbackSizeMaterialCode,
    editorMasterItemId,
    optionLaborRuleProductNo,
    optionLaborRuleRows,
    pooledDecorCostByMasterId,
    resolvedMasterMaterialCode,
    sizeRuleMarketContext,
  ]);
  const compactOptionRowByEntryKey = useMemo(() => {
    const next = new Map<string, CompactOptionRow>();
    for (const row of compactOptionRows) {
      next.set(row.entryKey, row);
    }
    return next;
  }, [compactOptionRows]);
  const blockingOptionRows = useMemo(
    () => compactOptionRows.filter((row) => row.legacyStatus !== "VALID" || row.warnings.length > 0),
    [compactOptionRows],
  );
  const colorAmountChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, number[]>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "COLOR_PLATING") continue;
      const materialCode = String(row.selectedMaterialCode ?? "").trim();
      const colorCode = String(row.selectedColorCode ?? "").trim();
      const key = materialCode && colorCode ? `${materialCode}::${colorCode}` : "";
      const choices = key ? (colorAmountChoicesByMaterialColor.get(key) ?? []) : [];
      next.set(row.entryKey, choices);
    }
    return next;
  }, [colorAmountChoicesByMaterialColor, compactOptionRows]);
  const materialChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "SIZE" && row.categoryKey !== "COLOR_PLATING" && row.categoryKey !== "OTHER") continue;
      next.set(row.entryKey, withResolvedChoice(materialChoicePool, row.selectedMaterialCode, row.legacyStatus !== "VALID", row.selectedMaterialCode));
    }
    return next;
  }, [compactOptionRows, materialChoicePool]);
  const sizeChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "SIZE") continue;
      const sizeMaterialCode = String(row.selectedMaterialCode || fallbackSizeMaterialCode || "").trim();
      const base = loadedOptionAllowlist.sizes_by_material[sizeMaterialCode] ?? [];
      next.set(row.entryKey, withResolvedChoice(base, row.selectedSizeWeightText, row.legacyStatus !== "VALID", row.selectedSizeWeightText ? `${row.selectedSizeWeightText}g` : row.selectedSizeWeightText));
    }
    return next;
  }, [compactOptionRows, fallbackSizeMaterialCode, loadedOptionAllowlist.sizes_by_material]);
  const sizeSelectionPartsByEntryKey = useMemo(() => {
    const next = new Map<string, { major: string; detail: string }>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "SIZE") continue;
      next.set(row.entryKey, normalizeSizeSelectionParts(row.selectedSizeWeightText));
    }
    return next;
  }, [compactOptionRows]);
  const sizeMajorChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "SIZE") continue;
      next.set(row.entryKey, buildRuleBackedSizeMajorOptions(sizeChoicesByEntryKey.get(row.entryKey) ?? []));
    }
    return next;
  }, [compactOptionRows, sizeChoicesByEntryKey]);
  const sizeDetailChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "SIZE") continue;
      const parts = sizeSelectionPartsByEntryKey.get(row.entryKey) ?? { major: "", detail: "" };
      next.set(row.entryKey, buildRuleBackedSizeDetailOptions(sizeChoicesByEntryKey.get(row.entryKey) ?? [], parts.major));
    }
    return next;
  }, [compactOptionRows, sizeChoicesByEntryKey, sizeSelectionPartsByEntryKey]);
  const hasAnySizeRuleChoices = useMemo(() => Object.values(loadedOptionAllowlist.sizes_by_material ?? {}).some((choices) => (choices?.length ?? 0) > 0), [loadedOptionAllowlist.sizes_by_material]);
  const hasAnySizeCompactRows = useMemo(() => compactOptionRows.some((row) => row.categoryKey === "SIZE"), [compactOptionRows]);

  const colorChoicesByEntryKey = useMemo(() => {
    const next = new Map<string, Array<{ value: string; label: string }>>();
    for (const row of compactOptionRows) {
      if (row.categoryKey !== "COLOR_PLATING") continue;
      const scopedColorCodes = colorCodesByMaterial.get(row.selectedMaterialCode) ?? [];
      const scopedChoices = scopedColorCodes.map((code) => ({ value: code, label: colorLabelByCode.get(code) ?? code }));
      const fallbackChoices = loadedOptionAllowlist.colors.map((choice) => ({
        value: String(choice.value ?? "").trim(),
        label: String(choice.label ?? choice.value ?? "").trim() || String(choice.value ?? "").trim(),
      })).filter((choice) => choice.value);
      const base = scopedChoices.length > 0 ? scopedChoices : fallbackChoices;
      next.set(row.entryKey, withResolvedChoice(base, row.selectedColorCode, row.legacyStatus !== "VALID", colorLabelByCode.get(row.selectedColorCode) ?? row.selectedColorCode));
    }
    return next;
  }, [colorCodesByMaterial, colorLabelByCode, compactOptionRows, loadedOptionAllowlist.colors]);
  const axisColumnHeaders = ["1차분류", "2차분류", "3차분류"] as const;
  const hasUnsavedCompactOptionChanges = useMemo(() => {
    return optionEntries.some((entry) => {
      const savedCategory = defaultOptionCategoryDrafts[entry.optionName] ?? "OTHER";
      const draftCategory = optionCategoryDrafts[entry.optionName] ?? savedCategory;
      if (draftCategory !== savedCategory) return true;
      if (!isRuleDrivenCategory(draftCategory)) {
        const savedDelta = defaultOptionSyncDeltaDrafts[entry.entryKey] ?? "0";
        const draftDelta = optionSyncDeltaDrafts[entry.entryKey] ?? savedDelta;
        if (String(draftDelta).trim() !== String(savedDelta).trim()) return true;
      }
      const savedAxis1 = defaultOptionAxis1Drafts[entry.entryKey] ?? "";
      const draftAxis1 = optionAxis1Drafts[entry.entryKey] ?? savedAxis1;
      if (String(draftAxis1).trim() !== String(savedAxis1).trim()) return true;
      const savedAxis2 = defaultOptionAxis2Drafts[entry.entryKey] ?? "";
      const draftAxis2 = optionAxis2Drafts[entry.entryKey] ?? savedAxis2;
      if (String(draftAxis2).trim() !== String(savedAxis2).trim()) return true;
      if (!isRuleDrivenCategory(draftCategory)) {
        const savedAxis3 = defaultOptionAxis3Drafts[entry.entryKey] ?? "";
        const draftAxis3 = optionAxis3Drafts[entry.entryKey] ?? savedAxis3;
        if (String(draftAxis3).trim() !== String(savedAxis3).trim()) return true;
      }
      if (draftCategory === "OTHER") {
        const savedReason = defaultOptionOtherReasonDrafts[entry.entryKey] ?? "";
        const draftReason = optionOtherReasonDrafts[entry.entryKey] ?? savedReason;
        if (String(draftReason).trim() !== String(savedReason).trim()) return true;
      }
      if (draftCategory === "DECOR") {
        const savedDecor = defaultOptionDecorSelectionDrafts[entry.entryKey] ?? "";
        const draftDecor = optionDecorSelectionDrafts[entry.entryKey] ?? savedDecor;
        if (String(draftDecor).trim() !== String(savedDecor).trim()) return true;
      }
      if (draftCategory === "NOTICE") {
        const savedNotice = defaultOptionNoticeSelectionDrafts[entry.entryKey] ?? "";
        const draftNotice = optionNoticeSelectionDrafts[entry.entryKey] ?? savedNotice;
        if (String(draftNotice).trim() !== String(savedNotice).trim()) return true;
      }
      return false;
    });
  }, [defaultOptionAxis1Drafts, defaultOptionAxis2Drafts, defaultOptionAxis3Drafts, defaultOptionCategoryDrafts, defaultOptionDecorSelectionDrafts, defaultOptionNoticeSelectionDrafts, defaultOptionOtherReasonDrafts, defaultOptionSyncDeltaDrafts, optionAxis1Drafts, optionAxis2Drafts, optionAxis3Drafts, optionCategoryDrafts, optionDecorSelectionDrafts, optionEntries, optionNoticeSelectionDrafts, optionOtherReasonDrafts, optionSyncDeltaDrafts]);
  const hasCompactOptionPricingDraft = useMemo(() => {
    if (savedOptionCategories.length > 0) return true;
    return hasUnsavedCompactOptionChanges;
  }, [hasUnsavedCompactOptionChanges, savedOptionCategories.length]);
  const defaultVariantOptionDrafts = useMemo(() => {
    if (!editorPreview) return {} as Record<string, VariantOptionDraft>;
    const next: Record<string, VariantOptionDraft> = {};
    for (const variant of editorPreview.variants ?? []) {
      const variantCode = normalizeVariantCode(variant.variantCode);
      if (!variantCode) continue;
      const lookupVariant = candidateVariantCodes(variant)
        .map((candidateCode) => variantLookupIndex.get(candidateCode) ?? null)
        .find((row): row is VariantLookupVariant => row !== null) ?? null;
      const existing = candidateVariantCodes(variant)
        .map((candidateCode) => editorMappingIndex.get(candidateCode) ?? null)
        .find((row): row is MappingRow => row !== null) ?? null;
      const inferred = inferMappingOptionSelection({
        allowlist: loadedOptionAllowlist,
        axes: variantAxesOf(lookupVariant ?? variant),
        existing,
        categoryRows: savedOptionCategories,
      });
      next[variantCode] = optionDraftWithLegacy(toVariantOptionDraft(inferred), existing);
    }
    return next;
  }, [editorMappingIndex, editorPreview, loadedOptionAllowlist, savedOptionCategories, variantLookupIndex]);
  const variantOptionDraftsByCode =
    variantOptionDraftSlot.resetKey === variantDraftResetKey ? variantOptionDraftSlot.value : defaultVariantOptionDrafts;
  const setVariantOptionDraftsByCode = (
    next:
      | Record<string, VariantOptionDraft>
      | ((current: Record<string, VariantOptionDraft>) => Record<string, VariantOptionDraft>),
  ) => {
    const current = variantOptionDraftSlot.resetKey === variantDraftResetKey ? variantOptionDraftSlot.value : defaultVariantOptionDrafts;
    const value = typeof next === "function" ? next(current) : next;
    setVariantOptionDraftSlot({ resetKey: variantDraftResetKey, value });
  };
  const updateVariantOptionDraft = (variantCode: string, updater: (draft: VariantOptionDraft) => VariantOptionDraft) => {
    setVariantOptionDraftsByCode((prev) => {
      const current = prev[variantCode] ?? defaultVariantOptionDrafts[variantCode] ?? toVariantOptionDraft(null);
      return { ...prev, [variantCode]: updater(current) };
    });
  };
  const applyVariantMaterialDraft = (variantCode: string, nextMaterial: string | null) => {
    updateVariantOptionDraft(variantCode, (current) => {
      const nextSizePool = loadedOptionAllowlist.sizes_by_material[nextMaterial ?? ""] ?? [];
      const keepCurrentSize = current.option_size_value_text
        ? nextSizePool.some((choice) => choice.value === current.option_size_value_text)
        : false;
      return {
        ...current,
        option_material_code: nextMaterial,
        option_size_value: keepCurrentSize ? current.option_size_value : null,
        option_size_value_text: keepCurrentSize ? current.option_size_value_text : "",
      };
    });
  };
  const editorVariantCodes = useMemo(
    () => (editorPreview?.variants ?? []).map((variant) => normalizeVariantCode(variant.variantCode)).filter(Boolean),
    [editorPreview],
  );
  useEffect(() => {
    if (editorVariantCodes.length === 0) {
      if (focusedVariantCode) setFocusedVariantCode("");
      return;
    }
    if (!focusedVariantCode || !editorVariantCodes.includes(focusedVariantCode)) {
      setFocusedVariantCode(editorVariantCodes[0] ?? "");
    }
  }, [editorVariantCodes, focusedVariantCode]);

  const focusedVariant = useMemo(
    () => (editorPreview?.variants ?? []).find((variant) => normalizeVariantCode(variant.variantCode) === focusedVariantCode) ?? null,
    [editorPreview, focusedVariantCode],
  );
  const focusedDraft = focusedVariantCode ? (variantOptionDraftsByCode[focusedVariantCode] ?? defaultVariantOptionDrafts[focusedVariantCode] ?? toVariantOptionDraft(null)) : null;
  const shouldMarkFocusedChoiceAsLegacy = !loadedOptionAllowlist.is_empty;
  const focusedMaterialChoices = focusedDraft
    ? withResolvedChoice(loadedOptionAllowlist.materials, focusedDraft.option_material_code, shouldMarkFocusedChoiceAsLegacy, focusedDraft.option_material_code)
    : [];
  const focusedColorChoices = focusedDraft
    ? withResolvedChoice(loadedOptionAllowlist.colors, focusedDraft.option_color_code, shouldMarkFocusedChoiceAsLegacy, focusedDraft.option_color_code)
    : [];
  const focusedDecorChoices = focusedDraft
    ? withResolvedChoice(allowedDecorChoices, focusedDraft.option_decoration_code, shouldMarkFocusedChoiceAsLegacy, focusedDraft.option_decoration_code)
    : [];
  const focusedSizeChoices = focusedDraft
    ? withResolvedChoice(
        loadedOptionAllowlist.sizes_by_material[focusedDraft.option_material_code ?? ""] ?? [],
        focusedDraft.option_size_value_text,
        shouldMarkFocusedChoiceAsLegacy,
        focusedDraft.option_size_value_text ? `${focusedDraft.option_size_value_text}g` : focusedDraft.option_size_value_text,
      )
    : [];
  const variantAxisCount = useMemo(
    () => loadedVariants.reduce((max, variant) => Math.max(max, variant.options?.length ?? 0), 0),
    [loadedVariants],
  );
  const decorationMasterIdByCode = useMemo(() => {
    const next = new Map<string, string | null>();
    for (const choice of loadedOptionAllowlist.decors) {
      next.set(choice.value, choice.decoration_master_id ?? null);
    }
    return next;
  }, [loadedOptionAllowlist.decors]);
  const buildVariantOptionDraftFromCompactRows = (variant: PreviewVariant, baseDraft: VariantOptionDraft): VariantOptionDraft => {
    const next: VariantOptionDraft = { ...baseDraft };
    for (const option of variant.options ?? []) {
      const entryKey = optionEntryKey(option.name, option.value);
      const compactRow = compactOptionRowByEntryKey.get(entryKey);
      if (!compactRow) continue;
      if ((compactRow.categoryKey === "MATERIAL" || compactRow.categoryKey === "SIZE" || compactRow.categoryKey === "COLOR_PLATING" || compactRow.categoryKey === "OTHER") && compactRow.selectedMaterialCode) {
        next.option_material_code = compactRow.selectedMaterialCode;
      }
      if (compactRow.categoryKey === "SIZE" && compactRow.selectedSizeWeightText) {
        next.option_size_value = parseNumericInput(compactRow.selectedSizeWeightText);
        next.option_size_value_text = compactRow.selectedSizeWeightText;
      }
      if (compactRow.categoryKey === "COLOR_PLATING" && compactRow.selectedColorCode) {
        next.option_color_code = compactRow.selectedColorCode;
      }
      if (compactRow.categoryKey === "DECOR") {
        const selectedDecorCode = compactRow.selectedDecorMasterId
          ? decorChoiceByMasterId.get(compactRow.selectedDecorMasterId)?.value ?? null
          : null;
        if (selectedDecorCode) next.option_decoration_code = selectedDecorCode;
      }
    }
    return next;
  };
  const computeDraftAdditionalAmount = (variant: PreviewVariant): number => {
    const variantCode = normalizeVariantCode(variant.variantCode);
    const existing = findExistingRowForVariant(variant);
    const baseDraft = variantOptionDraftsByCode[variantCode] ?? defaultVariantOptionDrafts[variantCode] ?? toVariantOptionDraft(null);
    const draft = hasCompactOptionPricingDraft
      ? buildVariantOptionDraftFromCompactRows(variant, baseDraft)
      : baseDraft;
    if ((existing?.option_price_mode ?? "SYNC") === "MANUAL") {
      return Math.round(Number(variant.savedTargetAdditionalAmount ?? existing?.option_manual_target_krw ?? variant.additionalAmount ?? 0));
    }
    const optionPriceDelta = Math.round(Number(existing?.option_price_delta_krw ?? 0));
    if (!optionLaborRuleEngineActive) {
      return Math.round(Number(variant.savedTargetAdditionalAmount ?? optionPriceDelta ?? variant.additionalAmount ?? 0));
    }
    const decorationCode = String(draft.option_decoration_code ?? "").trim();
    const decorationMasterId = decorationMasterIdByCode.get(decorationCode)
      ?? (DECORATION_UUID_RE.test(decorationCode) ? decorationCode : null);
    const buckets = computeOptionLaborRuleBuckets(optionLaborRuleRows, {
      materialCode: String(draft.option_material_code ?? "").trim() || null,
      additionalWeightG: parseNumericInput(draft.option_size_value_text),
      platingEnabled: String(draft.option_color_code ?? "").trim().length > 0,
      colorCode: String(draft.option_color_code ?? "").trim() || null,
      decorationCode: decorationCode || null,
      decorationMasterId,
    }, {
      masterItemId: editorMasterItemId,
      externalProductNo: optionLaborRuleProductNo,
      marketContext: sizeRuleMarketContext,
    });
    const sizePriceOverrideEnabled = draft.size_price_override_enabled === true;
    const sizePriceOverrideKrw = sizePriceOverrideEnabled
      ? Math.round(parseNumericInput(draft.size_price_override_krw_text) ?? 0)
      : 0;
    const sizeBucket = sizePriceOverrideEnabled
      ? sizePriceOverrideKrw
      : (existing?.sync_rule_weight_enabled !== false ? buckets.size : 0);
    const total = (existing?.sync_rule_material_enabled !== false ? buckets.material : 0)
      + sizeBucket
      + (existing?.sync_rule_plating_enabled !== false ? buckets.colorPlating : 0)
      + (existing?.sync_rule_decoration_enabled !== false ? buckets.decor : 0)
      + buckets.other
      + optionPriceDelta;
    return Math.round(total);
  };
  const computedVariantAdditionalByCode = useMemo(() => {
    const next: NumberMap = {};
    for (const variant of editorPreview?.variants ?? []) {
      const existing = findExistingRowForVariant(variant);
      if ((existing?.option_price_mode ?? "SYNC") === "MANUAL") {
        next[variant.variantCode] = Math.round(Number(variant.savedTargetAdditionalAmount ?? existing?.option_manual_target_krw ?? variant.additionalAmount ?? 0));
        continue;
      }
      const variantLevelDelta = Math.round(Number(existing?.option_price_delta_krw ?? 0));
      if (hasCompactOptionPricingDraft) {
        let sizeContribution = 0;
        const optionValueDelta = (variant.options ?? []).reduce((sum, option) => {
          const entryKey = optionEntryKey(option.name, option.value);
          const compactRow = compactOptionRowByEntryKey.get(entryKey);
          const compactResolvedDelta = compactRow?.resolvedDeltaKrw;
          const resolved = Math.round(Number(compactResolvedDelta ?? 0));
          if (compactRow?.categoryKey === "SIZE") sizeContribution += resolved;
          return sum + resolved;
        }, 0);
        const draft = variantOptionDraftsByCode[variant.variantCode] ?? defaultVariantOptionDrafts[variant.variantCode] ?? toVariantOptionDraft(null);
        const sizePriceOverrideEnabled = draft.size_price_override_enabled === true;
        const sizePriceOverrideKrw = sizePriceOverrideEnabled
          ? Math.round(parseNumericInput(draft.size_price_override_krw_text) ?? 0)
          : 0;
        const total = sizePriceOverrideEnabled
          ? optionValueDelta - sizeContribution + sizePriceOverrideKrw + variantLevelDelta
          : optionValueDelta + variantLevelDelta;
        next[variant.variantCode] = Math.round(total);
        continue;
      }
      next[variant.variantCode] = computeDraftAdditionalAmount(variant);
    }
    return next;
  }, [
    compactOptionRowByEntryKey,
    decorationMasterIdByCode,
    decorChoiceByMasterId,
    defaultVariantOptionDrafts,
    editorPreview,
    effectiveOptionSyncDeltaByEntryKey,
    hasCompactOptionPricingDraft,
    optionLaborRuleEngineActive,
    optionLaborRuleRows,
    variantOptionDraftsByCode,
  ]);
  const buildVariantMappingPayload = (variant: PreviewVariant): MappingWritePayload => {
    const variantCode = normalizeVariantCode(variant.variantCode);
    const existing = findExistingRowForVariant(variant);
    const baseDraft = variantOptionDraftsByCode[variantCode] ?? defaultVariantOptionDrafts[variantCode] ?? toVariantOptionDraft(null);
    const draft = hasCompactOptionPricingDraft
      ? buildVariantOptionDraftFromCompactRows(variant, baseDraft)
      : baseDraft;
    const optionPriceMode: "SYNC" | "MANUAL" = existing?.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC";
    const syncRuleSetId = optionPriceMode === "SYNC" ? (siblingSyncRuleSetId || String(existing?.sync_rule_set_id ?? "").trim()) : "";
    const externalProductNo = requestedEditorProductNo || canonicalEditorProductNo || resolvedEditorProductNo || String(editorPreview?.productNo ?? "").trim();
    const allowedMaterialCodes = new Set(loadedOptionAllowlist.materials.map((choice) => choice.value));
    const resolvedMaterialCode = draft.option_material_code && allowedMaterialCodes.has(draft.option_material_code)
      ? draft.option_material_code
      : (existing?.option_material_code ?? null);
    const allowedSizeValues = new Set(
      (loadedOptionAllowlist.sizes_by_material[resolvedMaterialCode ?? ""] ?? [])
        .map((choice) => parseNumericInput(choice.value))
        .filter((value): value is number => value != null),
    );
    const draftSizeValue = parseNumericInput(draft.option_size_value_text);
    const resolvedSizeValue = draftSizeValue != null
      ? draftSizeValue
      : (existing?.option_size_value ?? null);
    const sizePriceOverrideEnabled = draft.size_price_override_enabled === true;
    const sizePriceOverrideKrw = sizePriceOverrideEnabled
      ? Math.round(parseNumericInput(draft.size_price_override_krw_text) ?? Number.NaN)
      : null;
    if (!effectiveChannelId) throw new Error("channel_id가 필요합니다");
    if (!editorMasterItemId) throw new Error("master_item_id가 필요합니다");
    if (!externalProductNo) throw new Error("external_product_no가 필요합니다");
    if (!variantCode) throw new Error("external_variant_code가 필요합니다");
    if (optionPriceMode === "SYNC" && !syncRuleSetId) throw new Error("sync_rule_set_id를 확인할 수 없습니다");
    if (sizePriceOverrideEnabled && (!Number.isFinite(sizePriceOverrideKrw) || sizePriceOverrideKrw == null || sizePriceOverrideKrw % 100 !== 0)) {
      throw new Error("SIZE override 금액은 100원 단위 숫자여야 합니다");
    }
    return {
      channel_id: effectiveChannelId,
      master_item_id: editorMasterItemId,
      external_product_no: externalProductNo,
      external_variant_code: variantCode,
      sync_rule_set_id: syncRuleSetId || null,
      option_material_code: resolvedMaterialCode,
      option_color_code: draft.option_color_code,
      option_decoration_code: draft.option_decoration_code,
      option_size_value: resolvedSizeValue,
      material_multiplier_override: existing?.material_multiplier_override ?? null,
      size_weight_delta_g: existing?.size_weight_delta_g ?? null,
      size_price_override_enabled: sizePriceOverrideEnabled,
      size_price_override_krw: sizePriceOverrideEnabled ? sizePriceOverrideKrw : null,
      option_price_delta_krw: existing?.option_price_delta_krw ?? null,
      option_price_mode: optionPriceMode,
      option_manual_target_krw: optionPriceMode === "MANUAL" ? existing?.option_manual_target_krw ?? null : null,
      include_master_plating_labor: !editorExcludePlatingLabor,
      sync_rule_material_enabled: existing?.sync_rule_material_enabled !== false,
      sync_rule_weight_enabled: existing?.sync_rule_weight_enabled !== false,
      sync_rule_plating_enabled: existing?.sync_rule_plating_enabled !== false,
      sync_rule_decoration_enabled: existing?.sync_rule_decoration_enabled !== false,
      sync_rule_margin_rounding_enabled: existing?.sync_rule_margin_rounding_enabled !== false,
      current_product_sync_profile: editorCurrentProductSyncProfile,
      mapping_source: "MANUAL",
      is_active: true,
    };
  };
  const persistEditorVariantMappings = async (): Promise<BulkMappingResponse> => {
    if (!editorPreview || !editorMasterItemId) {
      return { data: [], requested: 0, deduplicated: 0, saved: 0 };
    }
    const rows = (editorPreview.variants ?? []).map((variant) => buildVariantMappingPayload(variant));
    if (rows.length === 0) {
      return { data: [], requested: 0, deduplicated: 0, saved: 0 };
    }
    return shopApiSend<BulkMappingResponse>("/api/channel-products/bulk", "POST", { rows });
  };
  const applyComputedMappingPreview = () => {
    setEditorPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: (current.variants ?? []).map((variant) => ({
          ...variant,
          savedTargetAdditionalAmount: Math.round(Number(computedVariantAdditionalByCode[variant.variantCode] ?? variant.savedTargetAdditionalAmount ?? 0)),
        })),
      };
    });
  };
  const saveCategoriesMutation = useMutation({
    mutationFn: async (_args?: { skipApply?: boolean }) => {
      if (!effectiveChannelId) throw new Error("channel_id가 필요합니다");
      if (!editorMasterItemId) throw new Error("master_item_id가 필요합니다");
      const externalProductNo = requestedEditorProductNo || canonicalEditorProductNo || resolvedEditorProductNo || String(editorPreview?.productNo ?? "").trim();
      if (!externalProductNo) throw new Error("external_product_no가 필요합니다");
      if (optionEntries.length === 0) return { ok: true, data: [] as OptionCategoryRow[] };
      if (blockingOptionRows.length > 0) {
        throw new Error(`규칙 불일치/미해결 옵션값 ${blockingOptionRows.length}개를 먼저 해결한 뒤 저장하세요`);
      }
      const rows = optionEntries.flatMap((entry) => {
        const compactRow = compactOptionRowByEntryKey.get(entry.entryKey);
        const categoryKey = compactRow?.categoryKey ?? effectiveCategoryByOptionName.get(entry.optionName) ?? guessCategoryByOptionName(entry.optionName);
        if (categoryKey === "NOTICE") return [];
        const syncDelta = categoryKey === "DECOR"
          ? Math.round(Number(compactRow?.decorFinalAmountKrw ?? 0))
          : categoryKey === "COLOR_PLATING"
            ? Math.round(parseNumericInput(optionSyncDeltaDrafts[entry.entryKey] ?? defaultOptionSyncDeltaDrafts[entry.entryKey] ?? String(compactRow?.syncDeltaKrw ?? 0)) ?? 0)
            : isRuleDrivenCategory(categoryKey)
            ? Math.round(Number(compactRow?.resolvedDeltaKrw ?? compactRow?.syncDeltaKrw ?? 0))
            : Math.round(parseNumericInput(optionSyncDeltaDrafts[entry.entryKey] ?? defaultOptionSyncDeltaDrafts[entry.entryKey] ?? "0") ?? 0);
        if ((categoryKey === "COLOR_PLATING" || (!isRuleDrivenCategory(categoryKey) && categoryKey !== "DECOR")) && syncDelta % 1000 !== 0) {
          throw new Error(`${entry.optionName} ${entry.optionValue} 가격은 1000원 단위로 입력해야 합니다`);
        }
        if (categoryKey === "DECOR") {
          const selectedDecorMasterId = String(compactRow?.selectedDecorMasterId ?? "").trim();
          if (!selectedDecorMasterId || !decorChoiceByMasterId.has(selectedDecorMasterId)) {
            throw new Error(`${entry.optionName} ${entry.optionValue} 장식은 등록된 allowlist 항목만 선택할 수 있습니다`);
          }
        }
        return [{
          option_name: entry.optionName,
          option_value: entry.optionValue,
          category_key: categoryKey,
          sync_delta_krw: syncDelta,
        }];
      });
      const otherReasonRows = optionEntries
        .map((entry) => {
          const categoryKey = effectiveCategoryByOptionName.get(entry.optionName) ?? guessCategoryByOptionName(entry.optionName);
          if (categoryKey !== "OTHER") return null;
          const reason = String(optionOtherReasonDrafts[entry.entryKey] ?? defaultOptionOtherReasonDrafts[entry.entryKey] ?? "").trim();
          if (!reason) {
            throw new Error(`${entry.optionName} ${entry.optionValue} 기타 카테고리는 사유를 입력해야 합니다`);
          }
          return {
            entry_key: entry.entryKey,
            other_reason: reason,
            resolved_delta_krw: Math.round(parseNumericInput(optionSyncDeltaDrafts[entry.entryKey] ?? defaultOptionSyncDeltaDrafts[entry.entryKey] ?? "0") ?? 0),
            category_key: "OTHER",
          };
        })
        .filter((row): row is { entry_key: string; other_reason: string; resolved_delta_krw: number; category_key: "OTHER" } => Boolean(row));

      const noticeCategoryRows = optionEntries
        .map((entry) => {
          const compactRow = compactOptionRowByEntryKey.get(entry.entryKey);
          const categoryKey = compactRow?.categoryKey ?? effectiveCategoryByOptionName.get(entry.optionName) ?? guessCategoryByOptionName(entry.optionName);
          if (categoryKey !== "NOTICE") return null;
          const noticeValue = String(compactRow?.noticeValue ?? "").trim();
          if (!noticeValue) {
            throw new Error(`${entry.optionName} ${entry.optionValue} 공지 카테고리는 1차 값을 선택해야 합니다`);
          }
          return {
            axis_key: "OPTION_CATEGORY",
            entry_key: entry.entryKey,
            category_key: "NOTICE",
          };
        })
        .filter((row): row is { axis_key: "OPTION_CATEGORY"; entry_key: string; category_key: "NOTICE" } => Boolean(row));
      const optionAxisSelectionRows = optionEntries
        .map((entry) => {
          const compactRow = compactOptionRowByEntryKey.get(entry.entryKey);
          const canonicalRow = evaluatedOptionRowByEntryKey.get(entry.entryKey)
            ?? canonicalOptionRowByEntryKey.get(entry.entryKey);
          const categoryKey = compactRow?.categoryKey ?? effectiveCategoryByOptionName.get(entry.optionName) ?? guessCategoryByOptionName(entry.optionName);
          if (categoryKey === "MATERIAL") return null;
          if (categoryKey === "DECOR") {
            const selectedDecorMasterId = String(compactRow?.selectedDecorMasterId ?? "").trim();
            const selectedDecorChoice = selectedDecorMasterId ? (decorChoiceByMasterId.get(selectedDecorMasterId) ?? null) : null;
            if (!selectedDecorMasterId || !selectedDecorChoice) {
              throw new Error(`${entry.optionName} ${entry.optionValue} 장식은 등록된 allowlist 항목만 선택할 수 있습니다`);
            }
            return {
              axis_key: "OPTION_AXIS_SELECTION" as const,
              entry_key: entry.entryKey,
              category_key: "DECOR" as const,
              axis1_value: String(compactRow?.axis1 ?? canonicalRow?.decor_material_code_snapshot ?? "").trim() || null,
              axis2_value: selectedDecorChoice.label,
              axis3_value: String(compactRow?.axis3 ?? "").trim() || null,
              decor_master_item_id: selectedDecorMasterId,
              decor_extra_delta_krw: Math.round(Number(compactRow?.decorExtraDeltaKrw ?? 0)),
              decor_final_amount_krw: Math.round(Number(compactRow?.decorFinalAmountKrw ?? 0)),
            };
          }
          if (categoryKey === "NOTICE") {
            const noticeValue = String(compactRow?.noticeValue ?? "").trim();
            if (!noticeValue) {
              throw new Error(`${entry.optionName} ${entry.optionValue} 공지 카테고리는 1차 값을 선택해야 합니다`);
            }
            return {
              axis_key: "OPTION_AXIS_SELECTION" as const,
              entry_key: entry.entryKey,
              category_key: "NOTICE" as const,
              axis1_value: noticeValue,
              axis2_value: null,
              axis3_value: null,
              decor_master_item_id: null,
              decor_extra_delta_krw: null,
              decor_final_amount_krw: null,
            };
          }
          if (categoryKey === "SIZE") {
            const materialCode = String(fallbackSizeMaterialCode || resolvedMasterMaterialCode || compactRow?.selectedMaterialCode || "").trim();
            const sizeWeight = String(compactRow?.selectedSizeWeightText ?? "").trim();
            return {
              axis_key: "OPTION_AXIS_SELECTION" as const,
              entry_key: entry.entryKey,
              category_key: "SIZE" as const,
              axis1_value: materialCode || null,
              axis2_value: sizeWeight || null,
              axis3_value: null,
              decor_master_item_id: null,
              decor_extra_delta_krw: null,
              decor_final_amount_krw: null,
            };
          }
          if (categoryKey === "COLOR_PLATING") {
            const materialCode = String(compactRow?.selectedMaterialCode ?? "").trim();
            const colorCode = String(compactRow?.selectedColorCode ?? "").trim();
            return {
              axis_key: "OPTION_AXIS_SELECTION" as const,
              entry_key: entry.entryKey,
              category_key: "COLOR_PLATING" as const,
              axis1_value: materialCode || null,
              axis2_value: colorCode || null,
              axis3_value: String(Math.round(parseNumericInput(optionSyncDeltaDrafts[entry.entryKey] ?? defaultOptionSyncDeltaDrafts[entry.entryKey] ?? String(compactRow?.syncDeltaKrw ?? 0)) ?? 0)),
              decor_master_item_id: null,
              decor_extra_delta_krw: null,
              decor_final_amount_krw: null,
            };
          }
          if (categoryKey === "OTHER") {
            const materialCode = String(compactRow?.selectedMaterialCode ?? "").trim();
            const reason = String(compactRow?.otherReason ?? "").trim();
            return {
              axis_key: "OPTION_AXIS_SELECTION" as const,
              entry_key: entry.entryKey,
              category_key: "OTHER" as const,
              axis1_value: materialCode || null,
              axis2_value: reason || null,
              axis3_value: String(Math.round(Number(compactRow?.syncDeltaKrw ?? 0))),
              decor_master_item_id: null,
              decor_extra_delta_krw: null,
              decor_final_amount_krw: null,
            };
          }
          return null;
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      const categorySaveRes = rows.length > 0
        ? await shopApiSend<{ ok: boolean; data: OptionCategoryRow[] }>("/api/channel-option-categories", "POST", {
            channel_id: effectiveChannelId,
            master_item_id: editorMasterItemId,
            external_product_no: externalProductNo,
            actor: "AUTO_PRICE_PAGE",
            rows,
          })
        : { ok: true, data: [] as OptionCategoryRow[] };

      const colorRuleTargets = new Map<string, {
        materialCode: string;
        colorCode: string;
        additiveDeltaKrw: number;
      }>();
      for (const entry of optionEntries) {
        const compactRow = compactOptionRowByEntryKey.get(entry.entryKey);
        const categoryKey = compactRow?.categoryKey ?? effectiveCategoryByOptionName.get(entry.optionName) ?? guessCategoryByOptionName(entry.optionName);
        if (categoryKey !== "COLOR_PLATING") continue;
        const materialCode = String(compactRow?.selectedMaterialCode ?? "").trim();
        const colorCode = String(compactRow?.selectedColorCode ?? "").trim();
        if (!materialCode || !colorCode) continue;
        const additiveDeltaKrw = Math.round(parseNumericInput(
          optionSyncDeltaDrafts[entry.entryKey]
          ?? defaultOptionSyncDeltaDrafts[entry.entryKey]
          ?? String(compactRow?.syncDeltaKrw ?? 0),
        ) ?? 0);
        const key = `${materialCode}::${colorCode}`;
        const existing = colorRuleTargets.get(key);
        if (existing && existing.additiveDeltaKrw !== additiveDeltaKrw) {
          throw new Error(`${entry.optionName} 색상 ${colorCode}의 금액이 서로 다르게 입력되어 저장할 수 없습니다`);
        }
        colorRuleTargets.set(key, { materialCode, colorCode, additiveDeltaKrw });
      }

      for (const target of colorRuleTargets.values()) {
        const existingRule = colorRuleRows.find((row) =>
          String(row.scope_material_code ?? "").trim() === target.materialCode
          && String(row.color_code ?? "").trim() === target.colorCode,
        );
        try {
          if (existingRule?.rule_id) {
            await shopApiSend("/api/option-labor-rules", "PUT", {
              rule_id: existingRule.rule_id,
              additive_delta_krw: target.additiveDeltaKrw,
              updated_by: "AUTO_PRICE_PAGE",
            });
            continue;
          }
          await shopApiSend("/api/option-labor-rules", "POST", {
            channel_id: effectiveChannelId,
            master_item_id: editorMasterItemId,
            external_product_no: optionLaborRuleProductNo || externalProductNo,
            category_key: "COLOR_PLATING",
            scope_material_code: target.materialCode,
            color_code: target.colorCode,
            plating_enabled: String(target.colorCode).trim().startsWith("[도]"),
            additive_delta_krw: target.additiveDeltaKrw,
            base_labor_cost_krw: 0,
            is_active: true,
            note: null,
          });
        } catch {
          // Cron recompute now reads COLOR_PLATING axis logs directly.
          // Keep rule sync as best-effort so UI save is not blocked by legacy DB constraints.
        }
      }

      if (otherReasonRows.length > 0) {
        await shopApiSend<{ data: Array<{ policy_log_id: string }>; saved: number }>("/api/channel-product-option-mappings-v2-logs", "POST", {
          channel_id: effectiveChannelId,
          master_item_id: editorMasterItemId,
          external_product_no: externalProductNo,
          change_reason: "AUTO_PRICE_OTHER_REASON_SAVE",
          rows: otherReasonRows,
        });
      }
      if (noticeCategoryRows.length > 0) {
        await shopApiSend<{ data: Array<{ policy_log_id: string }>; saved: number }>("/api/channel-product-option-mappings-v2-logs", "POST", {
          channel_id: effectiveChannelId,
          master_item_id: editorMasterItemId,
          external_product_no: externalProductNo,
          change_reason: "AUTO_PRICE_NOTICE_CATEGORY_SAVE",
          rows: noticeCategoryRows,
        });
      }
      if (optionAxisSelectionRows.length > 0) {
        await shopApiSend<{ data: Array<{ policy_log_id: string }>; saved: number }>("/api/channel-product-option-mappings-v2-logs", "POST", {
          channel_id: effectiveChannelId,
          master_item_id: editorMasterItemId,
          external_product_no: externalProductNo,
          change_reason: "AUTO_PRICE_OPTION_AXIS_SELECTION_SAVE",
          rows: optionAxisSelectionRows,
        });
      }

      return categorySaveRes;
    },
    onSuccess: async (_res, args) => {
      setOptionCategorySaveError(null);
      applyComputedMappingPreview();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auto-price-variant-lookup", effectiveChannelId, editorMasterItemId, canonicalEditorProductNo] }),
        qc.invalidateQueries({ queryKey: ["auto-price-option-labor-rules", effectiveChannelId, editorMasterItemId, optionLaborRuleProductNo] }),
        qc.invalidateQueries({ queryKey: ["pricing-snapshot-explain", effectiveChannelId, editorMasterItemId] }),
      ]);
      if (!args?.skipApply && editorPreview && !applyEditorMutation.isPending) {
        await applyEditorMutation.mutateAsync();
      }
    },
    onError: (error) => {
      setOptionCategorySaveError(describeError(error));
    },
  });
  const saveMappingsMutation = useMutation({
    mutationFn: persistEditorVariantMappings,
    onSuccess: async () => {
      setMappingSaveError(null);
      applyComputedMappingPreview();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auto-price-editor-mappings", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["auto-price-gallery-mappings", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["auto-price-variant-lookup", effectiveChannelId, editorMasterItemId, editorPreview?.productNo ?? ""] }),
        qc.invalidateQueries({ queryKey: ["auto-price-option-labor-rules", effectiveChannelId, editorMasterItemId, optionLaborRuleProductNo] }),
      ]);
    },
    onError: (error) => {
      setMappingSaveError(describeError(error));
    },
  });

  const pricingOverridesQuery = useQuery({
    queryKey: ["pricing-overrides", effectiveChannelId, editorMasterItemId],
    enabled: Boolean(effectiveChannelId && editorMasterItemId),
    queryFn: () =>
      shopApiGet<{ data: PricingOverrideRow[] }>(
        `/api/pricing-overrides?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(editorMasterItemId)}`,
      ),
  });

  const pricingOverrideRows = useMemo(() => pricingOverridesQuery.data?.data ?? [], [pricingOverridesQuery.data?.data]);
  const activePricingOverrides = useMemo(
    () => pricingOverrideRows.filter((row) => row.is_active === true),
    [pricingOverrideRows],
  );
  const sellingPriceOverrideLockResetKey = useMemo(
    () => [editorMasterItemId, ...activePricingOverrides.map((row) => row.override_id).sort((a, b) => a.localeCompare(b))].join("|"),
    [activePricingOverrides, editorMasterItemId],
  );
  const defaultSellingPriceOverrideLocked = Boolean(editorMasterItemId && activePricingOverrides.length > 0);
  const sellingPriceOverrideLocked =
    sellingPriceOverrideLockedSlot.resetKey === sellingPriceOverrideLockResetKey
      ? sellingPriceOverrideLockedSlot.value
      : defaultSellingPriceOverrideLocked;
  const setSellingPriceOverrideLocked = (next: boolean | ((current: boolean) => boolean)) => {
    const current =
      sellingPriceOverrideLockedSlot.resetKey === sellingPriceOverrideLockResetKey
        ? sellingPriceOverrideLockedSlot.value
        : defaultSellingPriceOverrideLocked;
    const value = typeof next === "function" ? next(current) : next;
    setSellingPriceOverrideLockedSlot({ resetKey: sellingPriceOverrideLockResetKey, value });
  };

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
        auto_sync_threshold_profile: autoSyncThresholdProfile,
        auto_sync_force_full: autoSyncForceFull,
        auto_sync_min_change_krw: Math.max(0, Math.round(parseNumericInput(autoSyncMinChangeKrw) ?? 5000)),
        auto_sync_min_change_rate: Math.max(0, Math.min(1, (parseNumericInput(autoSyncMinChangeRatePct) ?? 2) / 100)),
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
    onMutate: async (productNo?: string) => {
      const resolvedProductNo = String(productNo ?? editorProductNo).trim();
      setEditorReloadNonce(Date.now());
      setEditorPreview(null);
      setVariantOptionDraftSlot({ resetKey: '', value: {} });
      setOptionCategoryDraftSlot({ resetKey: '', value: {} });
      setOptionSyncDeltaDraftSlot({ resetKey: '', value: {} });
      setOptionOtherReasonDraftSlot({ resetKey: '', value: {} });
      setOptionDecorSelectionDraftSlot({ resetKey: '', value: {} });
      setOptionNoticeSelectionDraftSlot({ resetKey: '', value: {} });
      setOptionAxis1DraftSlot({ resetKey: '', value: {} });
      setOptionAxis2DraftSlot({ resetKey: '', value: {} });
      setOptionAxis3DraftSlot({ resetKey: '', value: {} });
      if (!resolvedProductNo) return;
      await Promise.all([
        qc.cancelQueries({ queryKey: ['auto-price-variant-lookup', effectiveChannelId, editorMasterItemId, resolvedProductNo] }),
        qc.cancelQueries({ queryKey: ['auto-price-option-labor-rules', effectiveChannelId, editorMasterItemId, resolvedProductNo] }),
      ]);
      qc.removeQueries({ queryKey: ['auto-price-variant-lookup', effectiveChannelId, editorMasterItemId, resolvedProductNo] });
      qc.removeQueries({ queryKey: ['auto-price-option-labor-rules', effectiveChannelId, editorMasterItemId, resolvedProductNo] });
    },
    mutationFn: (productNo?: string) => {
      const resolvedProductNo = String(productNo ?? editorProductNo).trim();
      return shopApiGet<{ data: ProductEditorPreview }>(
        `/api/channel-products/editor?channel_id=${encodeURIComponent(effectiveChannelId)}&external_product_no=${encodeURIComponent(resolvedProductNo)}&_ts=${encodeURIComponent(String(editorReloadNonce || Date.now()))}`,
      );
    },
    onSuccess: (res) => {
      const data = res.data;
      setEditorPreview(data);
      {
        const previewMasterId = String(data.master_item_id ?? '').trim();
        if (previewMasterId) setEditorMasterItemIdHint(previewMasterId);
      }
      setEditorPrice(data.price != null ? String(data.price) : '');
      setEditorRetailPrice(data.retailPrice != null ? String(data.retailPrice) : '');
      setEditorSelling((data.selling || 'T').toUpperCase());
      setEditorDisplay((data.display || 'T').toUpperCase());
      setEditorFloorPrice(String(Math.max(0, Math.round(Number(data.floor_price_krw ?? 0)))));
      setEditorExcludePlatingLabor(Boolean(data.exclude_plating_labor));
      setEditorCurrentProductSyncProfile(normalizeCurrentProductSyncProfile(data.current_product_sync_profile));
      setCurrentProductSyncProfileSaveError(null);
      setVariantOptionDraftSlot({ resetKey: '', value: {} });
      setOptionCategoryDraftSlot({ resetKey: '', value: {} });
      setOptionSyncDeltaDraftSlot({ resetKey: '', value: {} });
      setOptionOtherReasonDraftSlot({ resetKey: '', value: {} });
      setOptionDecorSelectionDraftSlot({ resetKey: '', value: {} });
      setOptionNoticeSelectionDraftSlot({ resetKey: '', value: {} });
      setOptionAxis1DraftSlot({ resetKey: '', value: {} });
      setOptionAxis2DraftSlot({ resetKey: '', value: {} });
      setOptionAxis3DraftSlot({ resetKey: '', value: {} });
      setFocusedVariantCode('');
      setShowAdvancedVariantMapping(false);
      setMappingSaveError(null);
      setOptionCategorySaveError(null);
      setApplyError(null);
      setIsEditDrawerOpen(false);
      setIsPreviewDrawerOpen(true);
    },
  });

  const updateCurrentProductSyncProfileInGallery = (masterItemId: string, profile: CurrentProductSyncProfile) => {
    if (!masterItemId) return;
    qc.setQueryData<{ data: DashboardGalleryRow[] }>(['shop-dashboard-gallery', effectiveChannelId], (current) => {
      if (!current) return current;
      return {
        ...current,
        data: current.data.map((row) => (String(row.master_item_id ?? '').trim() === masterItemId
          ? { ...row, current_product_sync_profile: profile }
          : row)),
      };
    });
    qc.setQueryData<{ data: MappingRow[] }>(['auto-price-gallery-mappings', effectiveChannelId], (current) => {
      if (!current) return current;
      return {
        ...current,
        data: current.data.map((row) => (String(row.master_item_id ?? '').trim() === masterItemId && row.is_active !== false
          ? { ...row, current_product_sync_profile: profile }
          : row)),
      };
    });
  };

  const saveCurrentProductSyncProfileMutation = useMutation({
    mutationFn: async (profile: CurrentProductSyncProfile) => {
      const resolvedMasterItemId = String(editorMasterItemId ?? '').trim();
      if (!effectiveChannelId) throw new Error('channel_id가 필요합니다');
      if (!resolvedMasterItemId) throw new Error('master_item_id가 없어 현재 상품 프로필을 저장할 수 없습니다');
      return shopApiSend<{ ok: boolean; current_product_sync_profile?: CurrentProductSyncProfile | null }>(
        '/api/channel-products/current-product-sync-profile',
        'POST',
        {
          channel_id: effectiveChannelId,
          master_item_id: resolvedMasterItemId,
          current_product_sync_profile: profile,
        },
      );
    },
    onMutate: async (profile) => {
      const resolvedMasterItemId = String(editorMasterItemId ?? '').trim();
      const previousPreview = editorPreview;
      const previousProfile = editorCurrentProductSyncProfile;
      const previousGallery = qc.getQueryData<{ data: DashboardGalleryRow[] }>(['shop-dashboard-gallery', effectiveChannelId]);
      const previousGalleryMappings = qc.getQueryData<{ data: MappingRow[] }>(['auto-price-gallery-mappings', effectiveChannelId]);
      setCurrentProductSyncProfileSaveError(null);
      setEditorCurrentProductSyncProfile(profile);
      setEditorPreview((current) => (current ? { ...current, current_product_sync_profile: profile } : current));
      updateCurrentProductSyncProfileInGallery(resolvedMasterItemId, profile);
      return { previousPreview, previousProfile, previousGallery, previousGalleryMappings };
    },
    onSuccess: async (res, profile) => {
      const savedProfile = normalizeCurrentProductSyncProfile(res.current_product_sync_profile ?? profile);
      const resolvedMasterItemId = String(editorMasterItemId ?? '').trim();
      setEditorCurrentProductSyncProfile(savedProfile);
      setEditorPreview((current) => (current ? { ...current, current_product_sync_profile: savedProfile } : current));
      updateCurrentProductSyncProfileInGallery(resolvedMasterItemId, savedProfile);
      setCurrentProductSyncProfileSaveError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['shop-dashboard-gallery', effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ['auto-price-gallery-mappings', effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ['shop-summary', effectiveChannelId] }),
      ]);
    },
    onError: (error, _profile, context) => {
      setEditorCurrentProductSyncProfile(context?.previousProfile ?? 'GENERAL');
      if (context?.previousPreview !== undefined) setEditorPreview(context.previousPreview ?? null);
      if (context?.previousGallery !== undefined) {
        qc.setQueryData(['shop-dashboard-gallery', effectiveChannelId], context.previousGallery);
      }
      if (context?.previousGalleryMappings !== undefined) {
        qc.setQueryData(['auto-price-gallery-mappings', effectiveChannelId], context.previousGalleryMappings);
      }
      setCurrentProductSyncProfileSaveError(error instanceof Error ? error.message : '현재 상품 프로필 저장 실패');
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
          additionalAmount: Number(computedVariantAdditionalByCode[variant.variantCode] ?? variant.additionalAmount ?? 0),
        }));
        setEditorPreview({ ...editorPreview, variants: optimisticVariants });
      }
      return { previousPreview };
    },
    mutationFn: async () => {
      setApplyError(null);
      if (editorPreview && editorMasterItemId) {
        if (hasUnsavedCompactOptionChanges) {
          await saveCategoriesMutation.mutateAsync({ skipApply: true });
        }
        await persistEditorVariantMappings();
        setMappingSaveError(null);
      }

      const variants = (editorPreview?.variants ?? [])
        .map((variant) => ({
          variant_code: variant.variantCode,
          additional_amount: Number(computedVariantAdditionalByCode[variant.variantCode] ?? 0),
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
          external_product_no: canonicalEditorProductNo || requestedEditorProductNo,
          master_item_id: editorMasterItemId || undefined,
          product: {
            price: parseNumericInput(editorPrice),
            retail_price: parseNumericInput(editorRetailPrice),
            selling: editorSelling,
            display: editorDisplay,
          },
          floor_price_krw: parseNumericInput(editorFloorPrice),
          exclude_plating_labor: editorExcludePlatingLabor,
          current_product_sync_profile: editorCurrentProductSyncProfile,
          variants,
        },
      );
    },
    onSuccess: async (res) => {
      if (res.data) {
        setEditorPreview(res.data);
        setEditorFloorPrice(String(Math.max(0, Math.round(Number(res.data.floor_price_krw ?? 0)))));
        setEditorExcludePlatingLabor(Boolean(res.data.exclude_plating_labor));
        setEditorCurrentProductSyncProfile(normalizeCurrentProductSyncProfile(res.data.current_product_sync_profile));
        {
          const savedMasterItemId = String(res.data.master_item_id ?? editorMasterItemId).trim();
          if (savedMasterItemId) {
            updateCurrentProductSyncProfileInGallery(
              savedMasterItemId,
              normalizeCurrentProductSyncProfile(res.data.current_product_sync_profile),
            );
          }
        }
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
      setCurrentProductSyncProfileSaveError(null);
      applyComputedMappingPreview();
      setIsEditDrawerOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["shop-summary", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["pricing-overrides", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["auto-price-editor-mappings", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["auto-price-variant-lookup", effectiveChannelId, editorMasterItemId, editorPreview?.productNo ?? ""] }),
        qc.invalidateQueries({ queryKey: ["auto-price-option-labor-rules", effectiveChannelId, editorMasterItemId, canonicalEditorProductNo] }),
        qc.invalidateQueries({ queryKey: ["pricing-snapshot-explain", effectiveChannelId, editorMasterItemId] }),
        qc.invalidateQueries({ queryKey: ["shop-dashboard-gallery", effectiveChannelId] }),
        qc.invalidateQueries({ queryKey: ["auto-price-gallery-mappings", effectiveChannelId] }),
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
            <Button onClick={() => { const productNo = editorProductNo.trim(); setEditorReloadNonce(Date.now()); setEditorMasterItemIdHint(masterIdByProductNo.get(productNo) ?? ""); loadPreviewMutation.mutate(productNo); }} disabled={!effectiveChannelId || !editorProductNo.trim() || loadPreviewMutation.isPending}>
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
                  type='button'
                  className={`rounded border p-2 text-left transition-colors ${currentProductSyncProfileCardClassOf(item.currentProductSyncProfile)}`}
                  onClick={() => {
                    setEditorReloadNonce(Date.now());
                    setEditorProductNo(item.productNo);
                    setEditorMasterItemIdHint(String(item.primaryMasterId ?? "").trim() || masterIdByProductNo.get(String(item.productNo ?? "").trim()) || "");
                    setApplyError(null);
                    loadPreviewMutation.mutate(item.productNo);
                  }}
                  disabled={loadPreviewMutation.isPending}
                >
                  <div className={`mb-2 aspect-square w-full overflow-hidden rounded border ${item.currentProductSyncProfile === 'MARKET_LINKED' ? 'border-amber-400/80 bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(245,158,11,0.08))]' : 'border-[var(--hairline)] bg-[var(--bg)]'}`}>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.modelNameText || item.productNo} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-[var(--muted)]">이미지 없음</div>
                    )}
                  </div>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='text-xs font-semibold'>{item.modelNameText || item.productNo}</div>
                    {item.currentProductSyncProfile === 'MARKET_LINKED' ? (
                      <span className={currentProductSyncProfileBadgeClassOf(item.currentProductSyncProfile)}>시장연동</span>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-1 text-[10px] text-[var(--muted)]">{item.productNo}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">{item.productAliasText}</div>
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
                      <div className='flex items-center gap-2 text-xs text-[var(--muted)]'>
                        <span>product_no: {editorPreview.productNo}</span>
                        <span className={currentProductSyncProfileBadgeClassOf(editorCurrentProductSyncProfile)}>
                          {currentProductSyncProfileLabelOf(editorCurrentProductSyncProfile)}
                        </span>
                      </div>
                      <div className={`aspect-square w-full overflow-hidden rounded border ${currentProductSyncProfilePanelClassOf(editorCurrentProductSyncProfile)}`}>
                        {editorPreview.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={editorPreview.imageUrl} alt={editorPreview.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-[var(--muted)]">이미지 없음</div>
                        )}
                      </div>

                      <div className={`rounded border p-2 ${currentProductSyncProfilePanelClassOf(editorCurrentProductSyncProfile)}`}>
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

                      <div className={`rounded border p-3 ${currentProductSyncProfilePanelClassOf(editorCurrentProductSyncProfile)}`}>
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
                              <line
                                x1={previewTrendChart.points[0]?.x ?? 0}
                                y1={previewTrendChart.points[0]?.y ?? 0}
                                x2={previewTrendChart.points[0]?.x ?? 0}
                                y2={previewTrendChart.height - 4}
                                stroke="var(--hairline)"
                                strokeWidth="1"
                              />
                              <line
                                x1={previewTrendChart.points[0]?.x ?? 0}
                                y1={previewTrendChart.height - 4}
                                x2={previewTrendChart.points[previewTrendChart.points.length - 1]?.x ?? previewTrendChart.width}
                                y2={previewTrendChart.height - 4}
                                stroke="var(--hairline)"
                                strokeWidth="1"
                              />
                              <line
                                x1={previewTrendChart.points[0]?.x ?? 0}
                                y1={8}
                                x2={previewTrendChart.points[previewTrendChart.points.length - 1]?.x ?? previewTrendChart.width}
                                y2={8}
                                stroke="var(--hairline)"
                                strokeWidth="1"
                                strokeDasharray="2 3"
                              />
                              <line
                                x1={previewTrendChart.points[0]?.x ?? 0}
                                y1={previewTrendChart.height - 12}
                                x2={previewTrendChart.points[previewTrendChart.points.length - 1]?.x ?? previewTrendChart.width}
                                y2={previewTrendChart.height - 12}
                                stroke="var(--hairline)"
                                strokeWidth="1"
                                strokeDasharray="2 3"
                              />
                              {previewTrendChart.points.filter((point) => point.turning).map((point) => (
                                <line
                                  key={`${point.runId}::guide`}
                                  x1={point.x}
                                  y1={8}
                                  x2={point.x}
                                  y2={previewTrendChart.height - 4}
                                  stroke="var(--primary)"
                                  strokeOpacity={0.18}
                                  strokeWidth="1"
                                  strokeDasharray="2 3"
                                />
                              ))}
                              <text
                                x={2}
                                y={11}
                                fontSize="8"
                                fill="var(--muted)"
                              >
                                {fmtKrw(previewTrendChart.max)}
                              </text>
                              <text
                                x={2}
                                y={previewTrendChart.height - 14}
                                fontSize="8"
                                fill="var(--muted)"
                              >
                                {fmtKrw(previewTrendChart.min)}
                              </text>
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
                            : `변곡점 기준 · 최저 ${fmtKrw(previewTrendChart.min)} · 최고 ${fmtKrw(previewTrendChart.max)}`}
                        </div>
                        {previewTrendChart.firstAt || previewTrendChart.firstTurning || previewTrendChart.lastAt ? (
                          <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-[var(--muted)] tabular-nums">
                            <div className="truncate">
                              {previewTrendChart.firstAt ? `시작 ${fmtTsCompact(previewTrendChart.firstAt)}` : ""}
                            </div>
                            <div className="truncate text-center">
                              {previewTrendChart.firstTurning ? `첫 변곡 ${fmtTsCompact(previewTrendChart.firstTurning.at)}` : "변곡 없음"}
                            </div>
                            <div className="truncate text-right">
                              {previewTrendChart.lastAt ? `최근 ${fmtTsCompact(previewTrendChart.lastAt)}` : ""}
                            </div>
                          </div>
                        ) : null}
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
                              <div className="flex items-center gap-3">
                                <div className="text-[11px] font-semibold">구성(스냅샷)</div>
                                <div className={`flex items-center gap-2 rounded border px-2 py-1.5 ${editorExcludePlatingLabor ? "border-slate-300 bg-slate-50" : "border-emerald-300 bg-emerald-50"}`}>
                                  <div className={`text-[10px] font-semibold ${editorExcludePlatingLabor ? "text-slate-700" : "text-emerald-900"}`}>도금공임(판매)</div>
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${editorExcludePlatingLabor ? "bg-slate-200 text-slate-700" : "bg-emerald-200 text-emerald-900"}`}>
                                    {editorExcludePlatingLabor ? "제외" : "포함"}
                                  </span>
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${editorExcludePlatingLabor ? "bg-white text-slate-700" : "bg-white text-emerald-900"}`}>
                                    {fmtKrw(Math.max(0, Math.round(Number(snapshotExplainRow?.master_plating_sell_krw ?? editorPreview?.plating_labor_sell_krw ?? 0))))}
                                  </span>
                                </div>
                                <div className={`flex items-center gap-2 rounded border px-2 py-1.5 ${currentProductSyncProfilePanelClassOf(editorCurrentProductSyncProfile)}`}>
                                  <div className="text-[10px] font-semibold text-amber-950">현재 상품 프로필</div>
                                  <span className={currentProductSyncProfileBadgeClassOf(editorCurrentProductSyncProfile)}>
                                    {currentProductSyncProfileLabelOf(editorCurrentProductSyncProfile)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-[10px] text-black tabular-nums">
                                {snapshotExplainRow
                                  ? `유효틱 ${fmt(snapshotExplainRow.effective_tick_krw_g)}원/g · ${fmtTsCompact(snapshotExplainRow.computed_at)}`
                                  : snapshotExplainQuery.isFetching
                                    ? "불러오는 중"
                                    : "-"}
                              </div>
                            </div>
                            {currentProductSyncProfileSaveError ? (
                              <div className="text-[10px] text-amber-900">{currentProductSyncProfileSaveError}</div>
                            ) : saveCurrentProductSyncProfileMutation.isPending ? (
                              <div className="text-[10px] text-amber-900/80">현재 상품 프로필 저장중</div>
                            ) : null}

                            {snapshotExplainRow ? (
                              <details open className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                                <summary className="cursor-pointer text-[11px] font-medium text-[var(--muted)]">상세 계산식 보기</summary>
                                <div className="mt-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {[
                                    { key: "summary-final", label: "최종가격", value: fmtKrw(snapshotExplainRow.final_target_price_v2_krw ?? snapshotExplainRow.final_target_price_krw), tone: "bg-violet-100" },
                                    { key: "summary-candidate", label: "후보가격", value: fmtKrw(snapshotExplainRow.candidate_price_krw), tone: "bg-rose-100" },
                                    { key: "summary-min-margin", label: "최소마진가", value: fmtKrw(snapshotExplainRow.min_margin_price_krw), tone: "bg-white" },
                                    { key: "summary-selected", label: "채택항목", value: snapshotExplainRow.guardrail_reason_code === "MIN_MARGIN_WIN" ? "최소마진가격" : snapshotExplainRow.guardrail_reason_code === "COMPONENT_CANDIDATE_WIN" ? "목표가격" : String(snapshotExplainRow.guardrail_reason_code ?? "-"), tone: "bg-white" },
                                  ].map((card) => (
                                    <div key={card.key} className={`${card.tone} rounded border border-black px-2 py-2`}>
                                      <div className="text-[10px] font-medium text-slate-700">{card.label}</div>
                                      <div className="mt-1 text-right text-[12px] font-semibold tabular-nums text-slate-950">{card.value}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-[11px] text-[var(--muted)]">
                                  상단에는 핵심 결과를 모아두고, 아래 계산은 섹션 카드마다 열이 보이도록 정리해 계산 흐름이 바로 읽히게 했습니다.
                                </div>
                                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                                  {previewCompositionSections.map((section) => (
                                    <details key={section.key} open={section.key !== "cost-rollup"} className={`rounded border border-[var(--hairline)] bg-[var(--bg)] p-2 ${section.layout === "third" ? "" : "lg:col-span-3"}`}>
                                      <summary className="mb-2 flex cursor-pointer items-center justify-between gap-2 text-[11px] font-medium text-[var(--muted)]">
                                        <span>{section.title}</span>
                                        <span className="tabular-nums text-slate-900">{section.summary}</span>
                                      </summary>
                                      <div className="overflow-hidden rounded border-2 border-black">
                                        <table className="w-full table-fixed text-[11px]">
                                          <tbody>
                                            {section.groups.map((group, groupIndex) => {
                                              const firstKey = group[0]?.key;
                                              const topBorderClass = firstKey === "final-price"
                                                ? "border-t-4"
                                                : (firstKey === "labor-cost-total" || firstKey === "labor-total")
                                                  ? "border-t-4"
                                                  : "border-t-2";
                                              return (
                                                <Fragment key={`${section.key}-group-${groupIndex}`}>
                                                  <tr className={`${topBorderClass} border-black`}>
                                                    {group.map((row) => (
                                                      <th key={`${section.key}-head-${groupIndex}-${row.key}`} className={`${snapshotCellToneClass(row.key, groupIndex)} whitespace-nowrap border-r border-black px-2 py-1 text-left text-[10px] font-medium text-slate-900 last:border-r-0`}>
                                                        {row.label}
                                                      </th>
                                                    ))}
                                                    {Array.from({ length: Math.max(0, 3 - group.length) }).map((_, emptyIdx) => (
                                                      <th key={`${section.key}-head-${groupIndex}-empty-${emptyIdx}`} className="border-r border-black bg-white px-2 py-1 last:border-r-0" />
                                                    ))}
                                                  </tr>
                                                  <tr>
                                                    {group.map((row) => (
                                                      <td key={`${section.key}-value-${groupIndex}-${row.key}`} className={`${snapshotCellToneClass(row.key, groupIndex)} border-r border-t-2 border-black px-2 py-1 text-right font-semibold tabular-nums text-slate-900 last:border-r-0`}>
                                                        {row.valueText}
                                                      </td>
                                                    ))}
                                                    {Array.from({ length: Math.max(0, 3 - group.length) }).map((_, emptyIdx) => (
                                                      <td key={`${section.key}-value-${groupIndex}-empty-${emptyIdx}`} className="border-r border-t-2 border-black bg-white px-2 py-1 last:border-r-0" />
                                                    ))}
                                                  </tr>
                                                </Fragment>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                                <details className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-[11px] tabular-nums">
                                  <summary className="cursor-pointer text-[10px] font-medium text-[var(--muted)]">계산 흐름</summary>
                                  <div className="mt-1 space-y-0.5">
                                    {previewCompositionFlowLines.map((line, idx) => (
                                      <div key={`flow-${idx}`} className="leading-5">{line}</div>
                                    ))}
                                  </div>
                                </details>
                                </div>
                              </details>
                            ) : (
                              <div className="text-[11px] text-[var(--muted)]">
                                {snapshotExplainStatusText}
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
                                  <div className="tabular-nums">최근 크론체크: {fmtTsCompact(latestCronTick.at)} ({cronTickReasonLabelOf(latestCronTick.reason)})</div>
                                ) : null}
                              </div>
                            </div>

                            {previewHistoryRows.length === 0 ? (
                              <div className="text-[11px] text-[var(--muted)]">{previewHistoryEmptyText}</div>
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

                  <div className="overflow-auto rounded border border-[var(--hairline)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[var(--panel)] text-left">
                        <tr>
                          <th className="px-2 py-1">옵션이름</th>
                          <th className="px-2 py-1">카테고리</th>
                          <th className="px-2 py-1">{axisColumnHeaders[0]}</th>
                          <th className="px-2 py-1">{axisColumnHeaders[1]}</th>
                          <th className="px-2 py-1">{axisColumnHeaders[2]}</th>
                          <th className="px-2 py-1 text-right">가격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compactOptionRows.map((row) => (
                          <tr key={`preview-compact-row-${row.entryKey}`} className="border-t border-[var(--hairline)]">
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{`${row.optionName}: ${row.optionValue}`}</span>
                                <span className="text-[10px] text-[var(--muted)]">{legacyStatusLabelOf(row.legacyStatus)}{row.sourceRuleEntryIds.length > 0 ? ` / rule ${row.sourceRuleEntryIds.length}` : ""}{row.categoryKey === "OTHER" && row.otherReason ? ` / 사유:${row.otherReason}` : ""}</span>
                              </div>
                              {row.warnings[0] ? <div className="text-[10px] text-amber-600">{row.warnings[0]}</div> : null}
                            </td>
                            <td className="px-2 py-1">{categoryLabelOf(row.categoryKey)}</td>
                            <td className="px-2 py-1">{row.axis1 || "-"}</td>
                            <td className="px-2 py-1">{row.axis2 || "-"}</td>
                            <td className="px-2 py-1">{row.axis3 || "-"}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmtKrw(row.resolvedDeltaKrw)}</td>
                          </tr>
                        ))}
                        {compactOptionRows.length === 0 ? (
                          <tr>
                            <td className="px-2 py-2 text-[var(--muted)]" colSpan={6}>옵션값 행이 없습니다.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  {blockingOptionRows.length > 0 ? (
                    <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                      저장/동기화 차단: 규칙 불일치 또는 미해결 옵션값 {blockingOptionRows.length}개를 먼저 해결해야 합니다.
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setIsEditDrawerOpen(true)}>
                      상세수정 열기
                    </Button>
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
            <div className="text-xs text-[var(--muted)]">소비자가/판매가/옵션가와 variant 매핑을 함께 수정합니다.</div>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {!editorPreview ? (
              <div className="text-sm text-[var(--muted)]">먼저 상품 미리보기를 불러오세요.</div>
            ) : (
              <>
                <div className="rounded border border-[var(--hairline)] p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold">옵션값 빠른 편집</div>
                      <div className="text-xs text-[var(--muted)]">2x3 옵션이면 조합 6개 대신 고유 옵션값 5행만 수정하면 모든 variant 가격에 자동 합산됩니다.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => saveCategoriesMutation.mutate(undefined)} disabled={saveCategoriesMutation.isPending || compactOptionRows.length === 0 || blockingOptionRows.length > 0}>
                        옵션값 저장
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAdvancedVariantMapping((current) => !current)}>{showAdvancedVariantMapping ? "고급 variant 접기" : "고급 variant 열기"}</Button>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--muted)]">현재 편집 행 {compactOptionRows.length}개 · SIZE/COLOR_PLATING 가격은 rules SOT를 따르고, 이 화면에서는 축 선택만 저장됩니다. 규칙 불일치/미해결 행이 남아 있으면 저장과 sync가 차단됩니다.</div>
                  {blockingOptionRows.length > 0 ? (
                    <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                      현재 편집 기준으로 규칙 불일치 또는 미해결 옵션값 {blockingOptionRows.length}개가 있어 저장할 수 없습니다.
                    </div>
                  ) : null}
                  {hasAnySizeCompactRows && !hasAnySizeRuleChoices ? (
                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                      이 상품에는 아직 가격이 설정된 SIZE 구간이 없어 Size 드롭다운을 표시하지 않습니다. 가격이 연결된 구간만 후보에 노출됩니다.
                    </div>
                  ) : null}
                  {compactOptionRows.length === 0 ? (
                    <div className="mt-3 text-[11px] text-[var(--muted)]">이 상품에서 읽어온 옵션값이 없습니다.</div>
                  ) : (
                    <div className="mt-3 overflow-auto rounded border border-[var(--hairline)]">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[var(--panel)] text-left">
                          <tr>
                            <th className="px-2 py-1">옵션이름</th>
                            <th className="px-2 py-1">카테고리</th>
                            <th className="px-2 py-1">{axisColumnHeaders[0]}</th>
                            <th className="px-2 py-1">{axisColumnHeaders[1]}</th>
                            <th className="px-2 py-1">{axisColumnHeaders[2]}</th>
                            <th className="px-2 py-1 text-right">가격</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compactOptionRows.map((row) => (
                            <tr key={row.entryKey} className="border-t border-[var(--hairline)]">
                              <td className="px-2 py-1">
                                <div className="font-medium">{`${row.optionName}: ${row.optionValue}`}</div>
                                <div className="mt-1 text-[10px] text-[var(--muted)]">{legacyStatusLabelOf(row.legacyStatus)}{row.sourceRuleEntryIds.length > 0 ? ` / rule ${row.sourceRuleEntryIds.length}` : ""}</div>
                                {row.warnings[0] ? <div className="mt-1 text-[10px] text-amber-600">{row.warnings[0]}</div> : null}
                              </td>
                              <td className="px-2 py-1">
                                <Select
                                  value={row.categoryKey}
                                  onChange={(e) => handleOptionCategoryChange(row.optionName, e.target.value as OptionCategoryKey)}
                                  disabled={saveCategoriesMutation.isPending}
                                  className="h-8 min-w-[120px] border-slate-300 bg-white pr-8 text-[11px] font-medium text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                >
                                  {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.key} value={option.key}>{option.label}</option>
                                  ))}
                                </Select>
                              </td>
                              <td className="px-2 py-1">
                                {row.categoryKey === 'DECOR' ? (
                                  <Input
                                    value={row.axis1 || ''}
                                    disabled
                                    readOnly
                                    className={'h-8 min-w-[150px] cursor-not-allowed bg-slate-50 text-[11px] text-slate-500'}
                                  />
                                ) : row.categoryKey === 'NOTICE' ? (
                                  <Select
                                    value={row.noticeValue}
                                    onChange={(e) => setOptionNoticeSelectionDrafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    disabled={saveCategoriesMutation.isPending}
                                    className="h-8 min-w-[150px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                  >
                                    {Array.from(new Set([...(row.noticeValue ? [row.noticeValue] : []), ...NOTICE_VALUE_OPTIONS])).map((optionValue) => (
                                      <option key={`quick-notice-${row.entryKey}-${optionValue}`} value={optionValue}>{optionValue}</option>
                                    ))}
                                  </Select>
                                ) : row.categoryKey === "SIZE" ? (
                                  <Input
                                    value={row.selectedMaterialCode || fallbackSizeMaterialCode || resolvedMasterMaterialCode || ""}
                                    disabled
                                    readOnly
                                    className="h-8 min-w-[150px] cursor-not-allowed bg-slate-50 text-[11px] text-slate-500"
                                  />
                                ) : row.categoryKey === "COLOR_PLATING" || row.categoryKey === "OTHER" ? (
                                  <Select
                                    value={row.selectedMaterialCode}
                                    onChange={(e) => setOptionAxis1Drafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    disabled={saveCategoriesMutation.isPending}
                                    className="h-8 min-w-[150px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                  >
                                    <option value="">소재 선택</option>
                                    {(materialChoicesByEntryKey.get(row.entryKey) ?? []).map((choice) => (
                                      <option key={`quick-axis1-${row.entryKey}-${choice.value}`} value={choice.value}>{choice.label}</option>
                                    ))}
                                  </Select>
                                ) : (
                                  row.axis1 || "-"
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {row.categoryKey === "NOTICE" ? (
                                  <Input
                                    value=""
                                    placeholder="사용 안함"
                                    disabled
                                    readOnly
                                    className="h-8 min-w-[120px] cursor-not-allowed bg-slate-50 text-[11px] text-slate-500"
                                  />
                                ) : row.categoryKey === "SIZE" ? (
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={(sizeSelectionPartsByEntryKey.get(row.entryKey)?.major ?? "")}
                                      onChange={(e) => {
                                        const nextMajor = e.target.value;
                                        const currentParts = sizeSelectionPartsByEntryKey.get(row.entryKey) ?? { major: "", detail: "" };
                                        const nextValue = nextMajor ? combineSizeSelectionParts(nextMajor, currentParts.detail || "00") : "";
                                        setOptionAxis2Drafts((prev) => ({ ...prev, [row.entryKey]: nextValue }));
                                      }}
                                      disabled={saveCategoriesMutation.isPending}
                                      className="h-8 min-w-[100px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                    >
                                      <option value="">g 선택</option>
                                      {(sizeMajorChoicesByEntryKey.get(row.entryKey) ?? []).map((choice) => (
                                        <option key={`quick-axis2-size-major-${row.entryKey}-${choice.value}`} value={choice.value}>{choice.label}</option>
                                      ))}
                                    </Select>
                                    <Select
                                      value={(sizeSelectionPartsByEntryKey.get(row.entryKey)?.detail ?? "")}
                                      onChange={(e) => {
                                        const currentParts = sizeSelectionPartsByEntryKey.get(row.entryKey) ?? { major: "", detail: "" };
                                        const nextValue = currentParts.major ? combineSizeSelectionParts(currentParts.major, e.target.value) : "";
                                        setOptionAxis2Drafts((prev) => ({ ...prev, [row.entryKey]: nextValue }));
                                      }}
                                      disabled={saveCategoriesMutation.isPending || !(sizeSelectionPartsByEntryKey.get(row.entryKey)?.major ?? "")}
                                      className="h-8 min-w-[110px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                    >
                                      <option value="">0.01g 선택</option>
                                      {(sizeDetailChoicesByEntryKey.get(row.entryKey) ?? []).map((choice) => (
                                        <option key={`quick-axis2-size-detail-${row.entryKey}-${choice.value}`} value={choice.value}>{choice.label}</option>
                                      ))}
                                    </Select>
                                  </div>
                                ) : row.categoryKey === 'DECOR' ? (
                                  <Select
                                    value={row.selectedDecorMasterId}
                                    onChange={(e) => setOptionDecorSelectionDrafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    disabled={saveCategoriesMutation.isPending}
                                    className={'h-8 min-w-[150px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'}
                                  >
                                    <option value={''}>장식 선택</option>
                                    {allowedDecorChoices.map((choice) => {
                                      const masterId = String(choice.decoration_master_id ?? '').trim();
                                      return <option key={`quick-decor-axis2-${row.entryKey}-${masterId}`} value={masterId}>{choice.label}</option>;
                                    })}
                                  </Select>
                                ) : row.categoryKey === 'COLOR_PLATING' ? (
                                  <Select
                                    value={row.selectedColorCode}
                                    onChange={(e) => setOptionAxis2Drafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    disabled={saveCategoriesMutation.isPending}
                                    className={'h-8 min-w-[140px] border-slate-300 bg-white pr-8 text-[11px] text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'}
                                  >
                                    <option value="">색상 선택</option>
                                    {(colorChoicesByEntryKey.get(row.entryKey) ?? []).map((choice) => (
                                      <option key={`quick-axis2-color-${row.entryKey}-${choice.value}`} value={choice.value}>{choice.label}</option>
                                    ))}
                                  </Select>
                                ) : (
                                  row.axis2 || "-"
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {row.categoryKey === "NOTICE" ? (
                                  <Input
                                    value=""
                                    placeholder="사용 안함"
                                    disabled
                                    readOnly
                                    className="h-8 min-w-[120px] cursor-not-allowed bg-slate-50 text-[11px] text-slate-500"
                                  />
                                ) : row.categoryKey === 'DECOR' ? (
                                  <Input
                                    value={row.axis3 || ''}
                                    disabled
                                    readOnly
                                    className={'h-8 min-w-[160px] cursor-not-allowed bg-slate-50 text-[11px] text-slate-500'}
                                  />
                                ) : row.categoryKey === 'COLOR_PLATING' ? (
                                  <span className="text-[11px] text-[var(--muted)]">색상룰 기준</span>
                                ) : row.categoryKey === 'SIZE' ? (
                                  <span className="text-[11px] text-[var(--muted)]">구간룰 기준</span>
                                ) : (
                                  row.axis3 || "-"
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {row.categoryKey === "DECOR" ? (
                                  <Input
                                    value={String(row.decorFinalAmountKrw)}
                                    type="number"
                                    disabled
                                    readOnly
                                    className="h-8 min-w-[92px] cursor-not-allowed bg-slate-50 text-right text-[11px] text-slate-500"
                                  />
                                ) : row.categoryKey === "NOTICE" ? (
                                  <Input
                                    value="0"
                                    type="number"
                                    disabled
                                    readOnly
                                    className="h-8 min-w-[92px] cursor-not-allowed bg-slate-50 text-right text-[11px] text-slate-500"
                                  />
                                ) : row.categoryKey === "COLOR_PLATING" ? (
                                  <Select
                                    value={String(optionSyncDeltaDrafts[row.entryKey] ?? defaultOptionSyncDeltaDrafts[row.entryKey] ?? String(row.syncDeltaKrw))}
                                    onChange={(e) => setOptionSyncDeltaDrafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    className="h-8 min-w-[120px] bg-white pr-8 text-right text-[11px] text-slate-900"
                                  >
                                    {COLOR_AMOUNT_OPTIONS.map((amount) => (
                                      <option key={`quick-color-amount-${row.entryKey}-${amount}`} value={amount}>
                                        {fmt(Math.round(Number(amount)))}
                                      </option>
                                    ))}
                                  </Select>
                                ) : row.categoryKey === "SIZE" ? (
                                  <div>
                                    <Input
                                      value={String(row.syncDeltaKrw)}
                                      type="number"
                                      disabled
                                      readOnly
                                      className="h-8 min-w-[92px] cursor-not-allowed bg-slate-50 text-right text-[11px] text-slate-500"
                                    />
                                    <div className="mt-1 text-[10px] text-[var(--muted)]">가격 수정은 rules &gt; 중량에서만 가능합니다.</div>
                                  </div>
                                ) : (
                                  <Input
                                    value={String(row.syncDeltaKrw)}
                                    onChange={(e) => setOptionSyncDeltaDrafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    type="number"
                                    className="h-8 min-w-[92px] text-right text-[11px]"
                                  />
                                )}
                                {row.categoryKey === "OTHER" ? (
                                  <Input
                                    value={String(optionOtherReasonDrafts[row.entryKey] ?? row.otherReason ?? "")}
                                    onChange={(e) => setOptionOtherReasonDrafts((prev) => ({ ...prev, [row.entryKey]: e.target.value }))}
                                    placeholder="기타 사유 필수"
                                    className="mt-1 h-8 min-w-[160px] text-[11px]"
                                  />
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {optionCategorySaveError ? <div className="mt-2 text-xs text-red-500">{optionCategorySaveError}</div> : null}
                </div>

                <div className="rounded border border-[var(--hairline)] p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold">고급 variant 보정</div>
                      <div className="text-xs text-[var(--muted)]">보통은 위 옵션값 표만 수정하면 충분하고, variant별 예외 보정이 필요할 때만 사용합니다.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => saveMappingsMutation.mutate()} disabled={saveMappingsMutation.isPending || !editorPreview || !showAdvancedVariantMapping}>
                        고급 매핑 저장
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAdvancedVariantMapping((current) => !current)}>
                        {showAdvancedVariantMapping ? "고급 variant 접기" : "고급 variant 펼치기"}
                      </Button>
                    </div>
                  </div>
                  {showAdvancedVariantMapping ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-2">
                      <div className="mb-2 text-[11px] font-medium text-[var(--muted)]">편집 대상 variant</div>
                      <div className="space-y-2">
                        <Select value={focusedVariantCode} onChange={(e) => setFocusedVariantCode(e.target.value)} disabled={editorVariantCodes.length === 0} className="bg-white pr-8 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20">
                          {editorVariantCodes.length === 0 ? <option value="">variant 없음</option> : null}
                          {editorVariantCodes.map((variantCode) => (
                            <option key={`focused-variant-${variantCode}`} value={variantCode}>{variantCode}</option>
                          ))}
                        </Select>
                        <div className="max-h-[220px] space-y-1 overflow-auto">
                          {editorPreview.variants.map((variant) => {
                            const variantCode = normalizeVariantCode(variant.variantCode);
                            const isFocused = variantCode === focusedVariantCode;
                            const draft = variantOptionDraftsByCode[variantCode] ?? defaultVariantOptionDrafts[variantCode] ?? toVariantOptionDraft(null);
                            return (
                              <button
                                key={`variant-focus-${variantCode}`}
                                type="button"
                                className={`w-full rounded border px-2 py-2 text-left text-xs transition-colors ${isFocused ? "border-[var(--primary)] bg-[var(--panel)]" : "border-[var(--hairline)] bg-transparent hover:border-[var(--primary)]"}`}
                                onClick={() => setFocusedVariantCode(variantCode)}
                              >
                                <div className="font-medium">{variantCode || "-"}</div>
                                <div className="mt-1 text-[10px] text-[var(--muted)]">{loadedOptionAllowlist.is_empty ? "매핑 미확정(allowlist 없음)" : optionSummary(draft)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="rounded border border-[var(--hairline)] bg-[var(--bg)] p-3">
                      {!focusedVariant || !focusedDraft ? (
                        <div className="text-sm text-[var(--muted)]">편집할 variant를 선택하세요.</div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">variant_code</div>
                              <div className="mt-1 font-medium">{focusedVariantCode}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">현재 매핑</div>
                              <div className="mt-1 font-medium">{loadedOptionAllowlist.is_empty ? "매핑 미확정(allowlist 없음)" : optionSummary(focusedDraft)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">계산 옵션가</div>
                              <div className="mt-1 font-medium tabular-nums">{fmt(computedVariantAdditionalByCode[focusedVariantCode] ?? 0)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">allowlist</div>
                              <div className="mt-1 font-medium">{loadedOptionAllowlist.is_empty ? "empty" : `${focusedMaterialChoices.length} material / ${focusedSizeChoices.length} size / ${focusedColorChoices.length} color / ${focusedDecorChoices.length} decor`}</div>
                            </div>
                          </div>
                          <div className="rounded border border-[var(--hairline)] p-3">
                            <div className="mb-2 text-xs font-medium text-[var(--muted)]">원본 옵션 축</div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {(focusedVariant.options ?? []).map((option, index) => (
                                <span key={`focused-axis-${focusedVariantCode}-${index}`} className="rounded-full border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1">{axisCellText(option)}</span>
                              ))}
                              {(focusedVariant.options ?? []).length === 0 ? <span className="text-[var(--muted)]">옵션 축 없음</span> : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">material</div>
                              <Select
                                value={focusedDraft.option_material_code ?? ""}
                                className="bg-white pr-8 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                onChange={(e) => {
                                  const nextMaterialCode = e.target.value || null;
                                  applyVariantMaterialDraft(focusedVariantCode, nextMaterialCode);
                                }}
                              >
                                <option value="">선택 안함</option>
                                {focusedMaterialChoices.map((choice) => (
                                  <option key={`focused-material-${choice.value}`} value={choice.value}>{choice.label}</option>
                                ))}
                              </Select>
                              <div className="text-[10px] text-[var(--muted)]">가격은 rules &gt; 중량 구간룰에서 계산됩니다.</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">size (구간 선택)</div>
                              <Input
                                value={focusedDraft.option_size_value_text}
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="예: 1.25"
                                className="bg-white text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                onChange={(e) => {
                                  const nextText = e.target.value;
                                  updateVariantOptionDraft(focusedVariantCode, (draft) => ({
                                    ...draft,
                                    option_size_value_text: nextText,
                                    option_size_value: parseNumericInput(nextText),
                                  }));
                                }}
                              />
                              <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-[11px]">
                                <label className="flex items-center gap-2 text-[var(--fg)]">
                                  <input
                                    type="checkbox"
                                    checked={focusedDraft.size_price_override_enabled}
                                    onChange={(e) => updateVariantOptionDraft(focusedVariantCode, (draft) => ({
                                      ...draft,
                                      size_price_override_enabled: e.target.checked,
                                    }))}
                                  />
                                  <span>SIZE override</span>
                                </label>
                                <div className="mt-2">
                                  <Input
                                    value={focusedDraft.size_price_override_krw_text}
                                    type="number"
                                    min={0}
                                    step="100"
                                    disabled={!focusedDraft.size_price_override_enabled}
                                    placeholder="override 금액(100원 단위)"
                                    className={!focusedDraft.size_price_override_enabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}
                                    onChange={(e) => updateVariantOptionDraft(focusedVariantCode, (draft) => ({
                                      ...draft,
                                      size_price_override_krw_text: e.target.value,
                                    }))}
                                  />
                                </div>
                                <div className="mt-2 text-[10px] text-[var(--muted)]">
                                  체크 ON이면 SIZE는 시세연동 대신 이 금액을 계속 사용합니다. 체크를 끌 때까지 유지됩니다.
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">color / plating</div>
                              <Select className="bg-white pr-8 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20" value={focusedDraft.option_color_code ?? ""} onChange={(e) => updateVariantOptionDraft(focusedVariantCode, (draft) => ({ ...draft, option_color_code: e.target.value || null }))}>
                                <option value="">선택 안함</option>
                                {focusedColorChoices.map((choice) => (
                                  <option key={`focused-color-${choice.value}`} value={choice.value}>{choice.label}</option>
                                ))}
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">decor</div>
                              <Select className="bg-white pr-8 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20" value={focusedDraft.option_decoration_code ?? ""} onChange={(e) => updateVariantOptionDraft(focusedVariantCode, (draft) => ({ ...draft, option_decoration_code: e.target.value || null }))}>
                                <option value="">선택 안함</option>
                                {focusedDecorChoices.map((choice) => (
                                  <option key={`focused-decor-${choice.value}`} value={choice.value}>{choice.label}</option>
                                ))}
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">저장값</div>
                              <div className="mt-1 font-medium tabular-nums">{fmt(focusedVariant.savedTargetAdditionalAmount)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">스토어 옵션가</div>
                              <div className="mt-1 font-medium tabular-nums">{fmt(focusedVariant.additionalAmount)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">base 판매가</div>
                              <div className="mt-1 font-medium tabular-nums">{fmt(editorPreview.price)}</div>
                            </div>
                            <div className="rounded border border-[var(--hairline)] px-3 py-2 text-xs">
                              <div className="text-[var(--muted)]">최종 판매가 미리보기</div>
                              <div className="mt-1 font-medium tabular-nums">{editorPreview.price == null ? "-" : fmt(Math.max(Math.round(Number(editorPreview.price) + Number(computedVariantAdditionalByCode[focusedVariantCode] ?? 0)), previewEffectiveFloor))}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-[var(--muted)]">고유 옵션값 표만으로 대부분 수정할 수 있습니다. variant별 수동 보정이 필요할 때만 펼치세요.</div>
                  )}
                  {showAdvancedVariantMapping && mappingSaveError ? <div className="mt-2 text-xs text-red-500">{mappingSaveError}</div> : null}
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
                    <div className="text-[11px] text-[var(--muted)]">최종 판매가 KRW 기준 하한입니다.</div>
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

                <div className={`rounded border p-3 ${currentProductSyncProfilePanelClassOf(editorCurrentProductSyncProfile)}`}>
                  <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                    <div>
                      <div className='text-xs font-semibold text-amber-950'>현재 상품 프로필</div>
                      <div className='text-[11px] text-amber-950/80'>상세수정 반영 시 함께 저장됩니다.</div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Select
                        value={editorCurrentProductSyncProfile}
                        onChange={(e) => {
                          const nextProfile = e.target.value as CurrentProductSyncProfile;
                          setEditorCurrentProductSyncProfile(nextProfile);
                          setEditorPreview((current) => (current ? { ...current, current_product_sync_profile: nextProfile } : current));
                        }}
                        disabled={!editorMasterItemId}
                        className='min-w-[132px] border-amber-400/70 bg-white/90 text-sm font-medium text-amber-950'
                      >
                        {AUTO_SYNC_THRESHOLD_PROFILE_OPTIONS.map((option) => (
                          <option key={`detail-sync-profile-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <span className={currentProductSyncProfileBadgeClassOf(editorCurrentProductSyncProfile)}>
                        {currentProductSyncProfileLabelOf(editorCurrentProductSyncProfile)}
                      </span>
                    </div>
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

                {showAdvancedVariantMapping ? (
                  <div className="max-h-[320px] overflow-auto rounded border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        <th className="px-2 py-1">variant_code</th>
                        {Array.from({ length: variantAxisCount }).map((_, index) => (
                          <th key={`detail-axis-${index + 1}`} className="px-2 py-1">{`axis ${index + 1}`}</th>
                        ))}
                        <th className="px-2 py-1">매핑</th>
                        <th className="px-2 py-1">저장기반 옵션가</th>
                        <th className="px-2 py-1">동기화 계산 옵션가</th>
                        <th className="px-2 py-1">쇼핑몰 옵션가</th>
                        <th className="px-2 py-1">base 판매가</th>
                        <th className="px-2 py-1">최종 판매가 미리보기</th>
                        <th className="px-2 py-1">상태</th>
                        <th className="px-2 py-1">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editorPreview.variants.map((variant) => {
                        const variantCode = normalizeVariantCode(variant.variantCode);
                        const draft = variantOptionDraftsByCode[variantCode] ?? defaultVariantOptionDrafts[variantCode] ?? toVariantOptionDraft(null);
                        const savedTargetAdditionalAmount = variant.savedTargetAdditionalAmount == null ? null : Math.round(Number(variant.savedTargetAdditionalAmount));
                        const storefrontAdditionalAmount = variant.additionalAmount == null ? null : Math.round(Number(variant.additionalAmount));
                        const computedAdditionalAmount = Math.round(Number(computedVariantAdditionalByCode[variantCode] ?? 0));
                        let syncState = "확인필요";
                        if (savedTargetAdditionalAmount == null) syncState = "저장값없음";
                        else if (storefrontAdditionalAmount === savedTargetAdditionalAmount) syncState = "일치";
                        else if (storefrontAdditionalAmount != null) syncState = "불일치";
                        return (
                          <tr key={variant.variantCode} className={`border-t border-[var(--hairline)] ${variantCode === focusedVariantCode ? "bg-[var(--panel)]" : ""}`}>
                            <td className="px-2 py-1">
                              <div className="font-medium">{variant.variantCode}</div>
                              {variant.customVariantCode ? <div className="text-[11px] text-[var(--muted)]">custom {variant.customVariantCode}</div> : null}
                            </td>
                            {Array.from({ length: variantAxisCount }).map((_, index) => (
                              <td key={`${variantCode}-axis-${index + 1}`} className="px-2 py-1">{axisCellText(variant.options[index])}</td>
                            ))}
                            <td className="px-2 py-1">{optionSummary(draft)}</td>
                            <td className="px-2 py-1">{fmt(savedTargetAdditionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(computedAdditionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(variant.additionalAmount)}</td>
                            <td className="px-2 py-1">{fmt(editorPreview.price)}</td>
                            <td className="px-2 py-1">{editorPreview.price == null ? "-" : fmt(Math.max(Math.round(Number(editorPreview.price) + computedAdditionalAmount), previewEffectiveFloor))}</td>
                            <td className="px-2 py-1">{syncState}</td>
                            <td className="px-2 py-1">
                              <Button size="sm" variant={variantCode === focusedVariantCode ? "secondary" : "ghost"} onClick={() => setFocusedVariantCode(variantCode)}>
                                Focus
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-[var(--hairline)] px-3 py-2 text-[11px] text-[var(--muted)]">고급 variant 비교표는 접혀 있습니다. 위에서 고급 variant 펼치기를 누르면 variant별 매핑과 계산 결과를 볼 수 있습니다.</div>
                )}
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
        <div className="px-6 pb-6 text-xs text-[var(--muted)]">바닥가격은 최종 판매가 KRW 기준으로 적용됩니다.</div>
      </Card>

      <Card>
        <CardHeader title="가격 정책(마진/반올림)" description="재계산(recompute) 시 적용되는 기준값" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
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
            <Select value={autoSyncThresholdProfile} onChange={(e) => setAutoSyncThresholdProfile(e.target.value as "GENERAL" | "MARKET_LINKED")}>
              {AUTO_SYNC_THRESHOLD_PROFILE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Input value={autoSyncMinChangeKrw} onChange={(e) => setAutoSyncMinChangeKrw(e.target.value)} type="number" min={0} placeholder="최소 변동금액(원)" />
            <Input value={autoSyncMinChangeRatePct} onChange={(e) => setAutoSyncMinChangeRatePct(e.target.value)} type="number" min={0} step="0.01" placeholder="최소 변동률(%)" />
            <label className="flex h-10 items-center gap-2 rounded border border-[var(--hairline)] px-3 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={autoSyncForceFull}
                onChange={(e) => setAutoSyncForceFull(e.target.checked)}
              />
              <span>전체 자동동기화 무조건 실행</span>
            </label>
            <Button onClick={() => savePolicyMutation.mutate()} disabled={!effectiveChannelId || savePolicyMutation.isPending}>
              정책 저장
            </Button>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
            선택 프로필: <span className="font-medium text-[var(--fg)]">{selectedThresholdProfile.label}</span> · 적용 룰: <span className="font-medium text-[var(--fg)]">{selectedThresholdProfile.ruleText}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            상세수정 반영은 즉시값을 직접 반영하고, 여기 값은 재계산/동기화 파이프라인에서 적용됩니다. 룰 기반 자동동기화는 기본적으로 재계산으로 확정된 최종 목표가격(`max(목표가격, 최소마진가격)` 이후 값)과 현재 쇼핑몰 판매가를 비교해 `max(최소 변동금액, 현재가 x 최소 변동률)` 이상 차이날 때만 즉시 push 대상을 생성합니다. AUTO 실행에서 시장가 보정값이 더 크면 그 보정값까지 포함한 상향 목표가격을 기준으로 비교할 수 있습니다. 하향은 같은 기준을 threshold 단위로 누적해 압력이 충분히 쌓였을 때만 반영하며, 큰 하락은 즉시 반영될 수 있고 반영 후에는 일정 시간 추가 하향을 제한합니다.
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
            <div className="mb-3 rounded-[var(--radius)] border border-[var(--hairline)] p-3 text-xs text-[var(--muted)]">
              <div>현재 run 정책: {activeRunSyncPolicyMode === "ALWAYS" ? "무조건 동기화" : "룰 기반 동기화"} · 최소 변동금액 {fmtKrw(activeRunThresholdMinChangeKrw)} · 최소 변동률 {activeRunThresholdMinChangeRatePct} · 강제 동기화 소스 {activeRunForceFullSyncSource}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-[var(--muted)] md:grid-cols-5">
                <div>threshold 평가 {activeRunThresholdEvaluatedCount}건</div>
                <div>threshold 제외 {activeRunThresholdFilteredCount}건</div>
                <div>시장가 보정 {activeRunMarketGapForcedCount}건</div>
                <div>하향 억제 {activeRunDownsyncSuppressedCount}건</div>
                <div>압력 감쇠 {activeRunPressureDecayCount}건</div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-[var(--muted)] md:grid-cols-4">
                <div>압력 해제 {activeRunPressureDownsyncReleaseCount}건</div>
                <div>대형 하락 즉시반영 {activeRunLargeDownsyncReleaseCount}건</div>
                <div>쿨다운 차단 {activeRunCooldownBlockCount}건</div>
                <div>정체 해제 {activeRunStalenessReleaseCount}건</div>
              </div>
            </div>
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


