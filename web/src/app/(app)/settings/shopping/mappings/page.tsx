"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { OptionEntryWorkbench, type WorkbenchEditorGroup, type WorkbenchEditorRow } from "@/components/shopping/OptionEntryWorkbench";
import { DetailedPriceBreakdownPanel } from "@/components/shopping/DetailedPriceBreakdownPanel";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import {
  buildCurrentProductSyncProfileIndex,
  DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
  formatCurrentProductSyncProfileLabel,
  resolveCurrentProductSyncProfile,
  type CurrentProductSyncProfile,
} from "@/lib/shop/current-product-sync-profile";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";
import { normalizeOptionEntryMappingPayload, sanitizeOptionEntryMappingPayload } from "@/lib/shop/option-entry-mapping";
import type { GalleryDetailSummary } from "@/lib/shop/channel-products-gallery-detail";
import {
  inferMappingOptionSelection,
  type MappingOptionAllowlist,
  type MappingOptionAxis,
  type MappingOptionSelection,
  type SavedOptionCategoryRow,
} from "@/lib/shop/mapping-option-details";

type Channel = {
  channel_id: string;
  channel_code: string;
  channel_name: string;
};

type Mapping = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  current_product_sync_profile?: CurrentProductSyncProfile | null;
  sync_rule_set_id?: string | null;
  option_price_mode?: "SYNC" | "MANUAL" | null;
  option_material_code?: string | null;
  option_color_code?: string | null;
  option_decoration_code?: string | null;
  option_size_value?: number | null;
  material_multiplier_override?: number | null;
  size_weight_delta_g?: number | null;
  option_price_delta_krw?: number | null;
  option_manual_target_krw?: number | null;
  include_master_plating_labor?: boolean | null;
  sync_rule_material_enabled?: boolean | null;
  sync_rule_weight_enabled?: boolean | null;
  sync_rule_plating_enabled?: boolean | null;
  sync_rule_decoration_enabled?: boolean | null;
  sync_rule_margin_rounding_enabled?: boolean | null;
  mapping_source: string;
  is_active: boolean;
  updated_at: string;
};

type PricingPolicy = {
  policy_id: string;
  channel_id: string;
  policy_name: string;
  is_active: boolean;
};

type GalleryCardSummary = {
  card_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  model_name: string | null;
  thumbnail_url: string | null;
  variant_count: number;
  base_count: number;
  active_count: number;
  mapping_count: number;
  has_unresolved: boolean;
  publish_status: 'PUBLISHED' | 'UNPUBLISHED' | 'UNRESOLVED';
  published_base_price_krw: number | null;
  published_min_price_krw: number | null;
  published_max_price_krw: number | null;
  updated_at: string | null;
};

type GalleryCardsResponse = {
  data: GalleryCardSummary[];
};

type MasterSuggest = {
  master_item_id: string;
  model_name: string;
};

type VariantOption = {
  name: string;
  value: string;
};

type VariantCandidate = {
  variant_code: string;
  custom_variant_code: string | null;
  options: VariantOption[];
  option_label: string;
  additional_amount: number | null;
};

type VariantLookupResponse = {
  data: {
    channel_id: string;
    requested_product_no: string;
    resolved_product_no: string;
    canonical_external_product_no: string;
    total: number;
    variants: VariantCandidate[];
    option_detail_allowlist: MappingOptionAllowlist;
    saved_option_categories: SavedOptionCategoryRow[];
  };
};

type BulkMappingResponse = {
  data: Mapping[];
  requested: number;
  deduplicated: number;
  saved: number;
};

type RecomputeResponse = {
  ok: boolean;
  inserted: number;
  skipped: number;
  reason?: string;
  blocked_by_missing_rules_count?: number;
  compute_request_id?: string;
  publish_version?: string;
};


type PushResponse = {
  ok: boolean;
  job_id: string;
  publish_version?: string | null;
  compute_request_id?: string | null;
  total: number;
  success: number;
  failed: number;
  skipped: number;
};

type SaveWorkbenchResponse = {
  savedRows: Array<Record<string, unknown>>;
  recompute: RecomputeResponse;
  push: PushResponse;
};

type VariantOptionDraft = MappingOptionSelection & {
  option_size_value_text: string;
};

type WorkbenchDetailResponse = {
  data: {
    card: {
      channel_id: string;
      master_item_id: string;
      external_product_no: string;
      model_name: string | null;
      image_url: string | null;
    };
    detail: GalleryDetailSummary;
    explicit_mappings: Array<Record<string, unknown>>;
    central_registries: {
      materials: Array<{ material_code: string; material_label: string }>;
      color_buckets: Array<{ color_bucket_id: string; bucket_label: string; sell_delta_krw: number }>;
      addon_masters: Array<Record<string, unknown>>;
      notice_codes: Array<Record<string, unknown>>;
      other_reason_codes: Array<Record<string, unknown>>;
    };
    shared_size_choices: Array<{ value: string; label: string; delta_krw?: number | null }>;
    shared_size_choices_by_material: Record<string, Array<{ value: string; label: string; delta_krw?: number | null }>>;
  };
};

type LoadVariantsInput = {
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
  focusVariantCode?: string;
  toastOnSuccess?: boolean;
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
  option_price_delta_krw: number | null;
  current_product_sync_profile: CurrentProductSyncProfile;
  option_price_mode: "SYNC" | "MANUAL";
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
  mapping_source: "MANUAL";
  is_active: true;
};

const EMPTY_OPTION_ALLOWLIST: MappingOptionAllowlist = {
  materials: [],
  colors: [],
  decors: [],
  sizes_by_material: {},
  is_empty: true,
};

const DELTA_OPTIONS = Array.from({ length: 81 }, (_, index) => (index - 40) * 1000);

const normalizeVariantCode = (value: string | null | undefined): string => String(value ?? "").trim();

const parseOptionalNumber = (raw: string): number | null => {
  const trimmed = raw.split(",").join("").trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatOptionSizeValue = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toFixed(2);
};

const formatMoney = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} KRW`;
};

const formatWhen = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
};

const describeError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return "Request failed.";
};

const toVariantOptionDraft = (selection: Partial<MappingOptionSelection> | null | undefined): VariantOptionDraft => ({
  option_material_code: typeof selection?.option_material_code === "string" ? selection.option_material_code : null,
  option_color_code: typeof selection?.option_color_code === "string" ? selection.option_color_code : null,
  option_decoration_code: typeof selection?.option_decoration_code === "string" ? selection.option_decoration_code : null,
  option_size_value: selection?.option_size_value == null ? null : Number(selection.option_size_value),
  option_size_value_text: formatOptionSizeValue(selection?.option_size_value),
});

const variantAxesOf = (variant: VariantCandidate) =>
  (variant.options ?? []).map((option) => ({
    name: String(option.name ?? "").trim(),
    value: String(option.value ?? "").trim(),
  }));

const summarizeAxes = (variant: VariantCandidate): string => {
  const axes = variantAxesOf(variant);
  if (axes.length === 0) return "No option axes";
  return axes.map((axis) => `${axis.name}: ${axis.value}`).join(" / ");
};

const withLegacyChoice = <T extends { value: string; label: string }>(choices: T[], legacyValue: string | null | undefined): T[] => {
  const value = String(legacyValue ?? "").trim();
  if (!value || choices.some((choice) => choice.value === value)) return choices;
  return [{ ...(choices[0] ?? { value, label: value }), value, label: `${value} (legacy)` } as T, ...choices];
};

const optionDraftWithLegacy = (
  draft: VariantOptionDraft,
  existing: Partial<MappingOptionSelection> | null | undefined,
): VariantOptionDraft => {
  const next = { ...draft };
  const existingSizeText = formatOptionSizeValue(existing?.option_size_value);
  if (!next.option_material_code && existing?.option_material_code) next.option_material_code = existing.option_material_code;
  if (!next.option_color_code && existing?.option_color_code) next.option_color_code = existing.option_color_code;
  if (!next.option_decoration_code && existing?.option_decoration_code) next.option_decoration_code = existing.option_decoration_code;
  if (!next.option_size_value_text && existingSizeText) {
    next.option_size_value = Number(existingSizeText);
    next.option_size_value_text = existingSizeText;
  }
  return next;
};

const candidateVariantCodes = (variant: VariantCandidate): string[] => {
  const codes = [normalizeVariantCode(variant.variant_code), normalizeVariantCode(variant.custom_variant_code)];
  return Array.from(new Set(codes.filter(Boolean)));
};

const optionSummary = (mapping: Partial<MappingOptionSelection>): string => {
  const parts = [
    mapping.option_material_code ? `material ${mapping.option_material_code}` : null,
    mapping.option_size_value != null ? `size ${formatOptionSizeValue(mapping.option_size_value)}g` : null,
    mapping.option_color_code ? `color ${mapping.option_color_code}` : null,
    mapping.option_decoration_code ? `decor ${mapping.option_decoration_code}` : null,
  ].filter(Boolean);
  return parts.join(" / ") || "-";
};

const normalizeChoiceKey = (value: string | null | undefined): string =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

const inferDecorMasterId = (
  optionValue: string,
  choices: Array<{ value: string; label: string }>,
): string | null => {
  const normalizedValue = normalizeChoiceKey(optionValue);
  const match = choices.find((choice) => {
    const label = normalizeChoiceKey(choice.label);
    const value = normalizeChoiceKey(choice.value);
    return normalizedValue && (normalizedValue === label || normalizedValue === value || label.includes(normalizedValue) || normalizedValue.includes(label));
  });
  if (match?.value) return match.value;
  return choices.length === 1 ? choices[0]?.value ?? null : null;
};

const inferAddonMaster = (
  optionValue: string,
  choices: Array<{ value: string; label: string; delta_krw?: number | null }>,
): { addon_master_id: string | null; delta_krw: number | null } => {
  const normalizedValue = normalizeChoiceKey(optionValue);
  const match = choices.find((choice) => {
    const label = normalizeChoiceKey(choice.label);
    const value = normalizeChoiceKey(choice.value);
    return normalizedValue && (normalizedValue === label || normalizedValue === value || label.includes(normalizedValue) || normalizedValue.includes(label));
  });
  return {
    addon_master_id: match?.value ?? null,
    delta_krw: match?.delta_krw == null ? null : Math.round(Number(match.delta_krw)),
  };
};

const axisCellText = (axis: MappingOptionAxis | null | undefined): string => {
  if (!axis) return "-";
  const name = String(axis.name ?? "").trim();
  const value = String(axis.value ?? "").trim();
  if (!name && !value) return "-";
  if (!name) return value || "-";
  if (!value) return name;
  return `${name}: ${value}`;
};

export default function ShoppingMappingsPage() {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = useMemo(() => channelsQuery.data?.data ?? [], [channelsQuery.data?.data]);

  const [channelId, setChannelId] = useState("");

  const effectiveChannelId = channelId || channels[0]?.channel_id || "";

  const mappingsQuery = useQuery({
    queryKey: ["shop-mappings", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: Mapping[] }>(`/api/channel-products?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });
  const mappings = useMemo(() => mappingsQuery.data?.data ?? [], [mappingsQuery.data?.data]);

  const galleryQuery = useQuery({
    queryKey: ["shop-gallery-products", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<GalleryCardsResponse>(`/api/channel-products/gallery?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });
  const galleryCards = galleryQuery.data?.data ?? [];

  const pricingPoliciesQuery = useQuery({
    queryKey: ["shop-pricing-policies", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: PricingPolicy[] }>(
        "/api/pricing-policies?channel_id=" + encodeURIComponent(effectiveChannelId),
      ),
  });
  const pricingPolicies = pricingPoliciesQuery.data?.data ?? [];


  const [masterItemId, setMasterItemId] = useState("");
  const [masterQuery, setMasterQuery] = useState("");
  const [masterQueryDebounced, setMasterQueryDebounced] = useState("");
  const [masterLabel, setMasterLabel] = useState("");
  const [externalProductNo, setExternalProductNo] = useState("");
  const [loadedVariants, setLoadedVariants] = useState<VariantCandidate[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});
  const [variantOptionDraftsByCode, setVariantOptionDraftsByCode] = useState<Record<string, VariantOptionDraft>>({});
  const [loadedOptionAllowlist, setLoadedOptionAllowlist] = useState<MappingOptionAllowlist>(EMPTY_OPTION_ALLOWLIST);
  const [savedOptionCategories, setSavedOptionCategories] = useState<SavedOptionCategoryRow[]>([]);
  const [resolvedProductNo, setResolvedProductNo] = useState("");
  const [canonicalProductNo, setCanonicalProductNo] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [focusedVariantCode, setFocusedVariantCode] = useState("");
  const [workbenchDraftsByKey, setWorkbenchDraftsByKey] = useState<Record<string, WorkbenchEditorRow>>({});
  const [currentProductSyncProfileDraft, setCurrentProductSyncProfileDraft] = useState<CurrentProductSyncProfile>(DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [selectedGalleryCardId, setSelectedGalleryCardId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMasterQueryDebounced(masterQuery.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [masterQuery]);

  const masterSuggestQuery = useQuery({
    queryKey: ["shop-master-suggest", masterQueryDebounced],
    enabled: masterQueryDebounced.trim().length >= 1,
    queryFn: () =>
      shopApiSend<{ data: MasterSuggest[] }>(
        "/api/new-receipt-workbench/model-name-suggest",
        "POST",
        { q: masterQueryDebounced.trim(), limit: 20 },
      ),
  });
  const masterSuggestions = masterSuggestQuery.data?.data ?? [];

    
  const resetVariantState = () => {
    setLoadedVariants([]);
    setSelectedVariants({});
    setVariantOptionDraftsByCode({});
    setLoadedOptionAllowlist(EMPTY_OPTION_ALLOWLIST);
    setSavedOptionCategories([]);
    setResolvedProductNo("");
    setCanonicalProductNo("");
    setFocusedVariantCode("");
  };

  const resetEditor = () => {
    setEditingRowId(null);
    setIsDetailOpen(false);
    setIsWorkbenchOpen(false);
    setSelectedGalleryCardId(null);
    setCurrentProductSyncProfileDraft(DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE);
    setMasterItemId("");
    setMasterQuery("");
    setMasterLabel("");
    setExternalProductNo("");
    resetVariantState();
  };

  const productCandidates = useMemo(() => {
    return Array.from(
      new Set([externalProductNo.trim(), resolvedProductNo.trim(), canonicalProductNo.trim()].filter(Boolean)),
    );
  }, [canonicalProductNo, externalProductNo, resolvedProductNo]);

  const activeProductNo = canonicalProductNo || resolvedProductNo || externalProductNo.trim();

  const workbenchDetailQuery = useQuery({
    queryKey: ["shop-workbench-detail", effectiveChannelId, masterItemId.trim(), activeProductNo],
    enabled: Boolean(effectiveChannelId && masterItemId.trim() && activeProductNo),
    queryFn: () => shopApiGet<WorkbenchDetailResponse>(`/api/channel-products/gallery-detail?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(masterItemId.trim())}&external_product_no=${encodeURIComponent(activeProductNo)}`),
  });
  const workbenchDetail = workbenchDetailQuery.data?.data ?? null;
  const hasEditorScope = Boolean(masterItemId.trim() || productCandidates.length > 0);

  const editorMappings = useMemo(() => {
    return mappings.filter((row) => {
      if (masterItemId.trim() && row.master_item_id !== masterItemId.trim()) return false;
      if (productCandidates.length > 0 && !productCandidates.includes(row.external_product_no.trim())) return false;
      return true;
    });
  }, [mappings, masterItemId, productCandidates]);

  const editorMappingIndex = useMemo(() => {
    const index = new Map<string, Mapping>();
    for (const row of editorMappings) {
      const code = normalizeVariantCode(row.external_variant_code);
      if (code && !index.has(code)) index.set(code, row);
    }
    return index;
  }, [editorMappings]);
  const hasSavedEditorMappings = useMemo(
    () => editorMappings.some((row) => row.is_active),
    [editorMappings],
  );
  const resolveScopedCurrentProductSyncProfile = (nextMasterItemId: string, nextExternalProductNo: string) => {
    return resolveCurrentProductSyncProfile(
      mappings.filter((row) => row.master_item_id === nextMasterItemId && row.external_product_no.trim() === nextExternalProductNo.trim()),
    );
  };
  const activePricingPolicy = useMemo(
    () => pricingPolicies.find((policy) => policy.is_active) ?? null,
    [pricingPolicies],
  );
  const hasActivePricingPolicy = Boolean(activePricingPolicy);
  const statusScopeMappings = useMemo(
    () => (hasEditorScope ? editorMappings : mappings),
    [editorMappings, hasEditorScope, mappings],
  );
  const statusBaseRowCount = useMemo(
    () => statusScopeMappings.filter((row) => !normalizeVariantCode(row.external_variant_code)).length,
    [statusScopeMappings],
  );
  const statusVariantRowCount = useMemo(
    () => statusScopeMappings.filter((row) => Boolean(normalizeVariantCode(row.external_variant_code))).length,
    [statusScopeMappings],
  );
  const inferredSyncRuleSetId = useMemo(() => {
    const ids = Array.from(new Set(
      editorMappings
        .filter((row) => String(row.option_price_mode ?? "SYNC").toUpperCase() === "SYNC")
        .map((row) => String(row.sync_rule_set_id ?? "").trim())
        .filter(Boolean),
    ));
    return ids.length === 1 ? ids[0] : "";
  }, [editorMappings]);
  const scopedCurrentProductSyncProfile = useMemo(
    () => resolveCurrentProductSyncProfile(editorMappings, DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE),
    [editorMappings],
  );
  const galleryCardSyncProfileIndex = useMemo(
    () => buildCurrentProductSyncProfileIndex(mappings, (row) => `${row.master_item_id}::${row.external_product_no.trim()}`),
    [mappings],
  );

  useEffect(() => {
    setCurrentProductSyncProfileDraft(scopedCurrentProductSyncProfile);
  }, [scopedCurrentProductSyncProfile]);


  const findExistingRowForVariant = (variant: VariantCandidate): Mapping | null => {
    for (const code of candidateVariantCodes(variant)) {
      const row = editorMappingIndex.get(code);
      if (row) return row;
    }
    return null;
  };

  const visibleMappings = useMemo(() => {
    if (hasEditorScope) return editorMappings;
    return mappings.slice(0, 80);
  }, [editorMappings, hasEditorScope, mappings]);

  const updateVariantOptionDraft = (variantCode: string, updater: (draft: VariantOptionDraft) => VariantOptionDraft) => {
    setVariantOptionDraftsByCode((prev) => {
      const current = prev[variantCode] ?? toVariantOptionDraft(null);
      return { ...prev, [variantCode]: updater(current) };
    });
  };

  const loadVariants = useMutation({
    mutationFn: ({ channelId: nextChannelId, masterItemId: nextMasterItemId, externalProductNo: nextProductNo }: LoadVariantsInput) =>
      shopApiGet<VariantLookupResponse>(
        `/api/channel-products/variants?channel_id=${encodeURIComponent(nextChannelId)}&master_item_id=${encodeURIComponent(nextMasterItemId)}&external_product_no=${encodeURIComponent(nextProductNo)}`,
      ),
    onSuccess: (response, variables) => {
      const data = response.data;
      const scopedProductNos = Array.from(
        new Set([
          variables.externalProductNo.trim(),
          String(data.resolved_product_no ?? "").trim(),
          String(data.canonical_external_product_no ?? "").trim(),
        ].filter(Boolean)),
      );

      const scopedMappings = mappings.filter((row) => {
        if (row.master_item_id !== variables.masterItemId.trim()) return false;
        return scopedProductNos.includes(row.external_product_no.trim());
      });

      const scopedIndex = new Map<string, Mapping>();
      for (const row of scopedMappings) {
        const code = normalizeVariantCode(row.external_variant_code);
        if (code && !scopedIndex.has(code)) scopedIndex.set(code, row);
      }

      const nextDrafts: Record<string, VariantOptionDraft> = {};
      const nextDeltas: Record<string, string> = {};
      const nextSelected: Record<string, boolean> = {};

      for (const variant of data.variants ?? []) {
        const variantCode = normalizeVariantCode(variant.variant_code);
        const existing = candidateVariantCodes(variant)
          .map((code) => scopedIndex.get(code) ?? null)
          .find((row): row is Mapping => row !== null) ?? null;

        const inferred = inferMappingOptionSelection({
          allowlist: data.option_detail_allowlist,
          axes: variantAxesOf(variant),
          existing,
          categoryRows: data.saved_option_categories,
        });

        nextDrafts[variantCode] = optionDraftWithLegacy(toVariantOptionDraft(inferred), existing);
        if (existing) nextSelected[variantCode] = true;
      }

      if (variables.focusVariantCode) {
        nextSelected[variables.focusVariantCode] = true;
        setFocusedVariantCode(variables.focusVariantCode);
      } else {
        setFocusedVariantCode(normalizeVariantCode(data.variants[0]?.variant_code));
      }

      setLoadedVariants(data.variants ?? []);
      setSelectedVariants(nextSelected);
      setVariantOptionDraftsByCode(nextDrafts);
      setLoadedOptionAllowlist(data.option_detail_allowlist ?? EMPTY_OPTION_ALLOWLIST);
      setSavedOptionCategories(data.saved_option_categories ?? []);
      setResolvedProductNo(String(data.resolved_product_no ?? "").trim());
      setCanonicalProductNo(String(data.canonical_external_product_no ?? "").trim());

      if (variables.toastOnSuccess !== false) {
        toast.success(`Loaded ${data.total} variants.`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestVariantLoad = (overrides?: Partial<LoadVariantsInput>) => {
    const nextChannelId = overrides?.channelId ?? effectiveChannelId;
    const nextMasterItemId = overrides?.masterItemId ?? masterItemId.trim();
    const nextExternalProductNo = overrides?.externalProductNo ?? externalProductNo.trim();

    if (!nextChannelId) {
      toast.error("Select a channel first.");
      return;
    }
    if (!nextMasterItemId) {
      toast.error("Enter or choose master_item_id first.");
      return;
    }
    if (!nextExternalProductNo) {
      toast.error("Enter external_product_no first.");
      return;
    }

    loadVariants.mutate({
      channelId: nextChannelId,
      masterItemId: nextMasterItemId,
      externalProductNo: nextExternalProductNo,
      focusVariantCode: overrides?.focusVariantCode,
      toastOnSuccess: overrides?.toastOnSuccess,
    });
  };

  const chooseMasterSuggestion = (suggestion: MasterSuggest) => {
    setMasterItemId(suggestion.master_item_id);
    setMasterQuery(suggestion.model_name);
    setMasterLabel(suggestion.model_name);
  };

  const buildVariantPayload = (variant: VariantCandidate): MappingWritePayload => {
    const variantCode = normalizeVariantCode(variant.variant_code);
    const draft = variantOptionDraftsByCode[variantCode] ?? toVariantOptionDraft(null);
    const optionSizeValue = parseOptionalNumber(draft.option_size_value_text);

    if (!effectiveChannelId) throw new Error("channel_id is required");
    if (!masterItemId.trim()) throw new Error("master_item_id is required");
    if (!activeProductNo) throw new Error("external_product_no is required");
    if (!variantCode) throw new Error("external_variant_code is required");

    return {
      channel_id: effectiveChannelId,
      master_item_id: masterItemId.trim(),
      external_product_no: activeProductNo,
      external_variant_code: variantCode,
      sync_rule_set_id: null,
      option_material_code: draft.option_material_code,
      option_color_code: draft.option_color_code,
      option_decoration_code: draft.option_decoration_code,
      option_size_value: optionSizeValue,
      option_price_delta_krw: null,
      current_product_sync_profile: currentProductSyncProfileDraft,
      option_price_mode: "SYNC",
      option_manual_target_krw: null,
      include_master_plating_labor: true,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: true,
      sync_rule_margin_rounding_enabled: true,
      mapping_source: "MANUAL",
      is_active: true,
    };
  };

  const saveVariant = useMutation({
    mutationFn: async (variant: VariantCandidate) => {
      const payload = buildVariantPayload(variant);
      return shopApiSend<{ data: Mapping }>("/api/channel-products", "POST", payload);
    },
    onSuccess: async (response, variant) => {
      const variantCode = normalizeVariantCode(variant.variant_code);
      setEditingRowId(response.data.channel_product_id);
      setSelectedVariants((prev) => ({ ...prev, [variantCode]: true }));
      setFocusedVariantCode(variantCode);
      toast.success(`매핑 저장 완료: ${variantCode}. 신규 매핑이면 상단의 최초 계산을 바로 실행하세요.`);
      await queryClient.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkSave = useMutation({
    mutationFn: (variants: VariantCandidate[]) => {
      if (variants.length === 0) throw new Error("Select at least one variant.");
      return shopApiSend<BulkMappingResponse>("/api/channel-products/bulk", "POST", {
        rows: variants.map((variant) => buildVariantPayload(variant)),
      });
    },
    onSuccess: async (response) => {
      toast.success(`일괄 저장 완료: ${response.saved}건. 신규 매핑이 포함됐다면 상단의 최초 계산을 이어서 실행하세요.`);
      await queryClient.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveWorkbenchRows = useMutation({
    mutationFn: async (): Promise<SaveWorkbenchResponse> => {
      if (!effectiveChannelId) throw new Error('channel_id is required');
      if (!activeProductNo) throw new Error('external_product_no is required');
      if (!masterItemId.trim()) throw new Error('master_item_id is required');
      await shopApiSend<{ ok: boolean }>("/api/channel-products/current-product-sync-profile", "POST", {
        channel_id: effectiveChannelId,
        master_item_id: masterItemId.trim(),
        current_product_sync_profile: currentProductSyncProfileDraft,
      });
      if (!hasActivePricingPolicy) {
        throw new Error('옵션행 저장 후 storefront 반영을 위해 활성 가격 정책이 필요합니다. 정책 및 팩터를 먼저 저장하세요.');
      }
      const channelProductIds = mappings
        .filter((row) => row.channel_id === effectiveChannelId && row.master_item_id === masterItemId.trim() && row.external_product_no === activeProductNo && row.is_active)
        .map((row) => row.channel_product_id)
        .filter(Boolean);
      if (channelProductIds.length === 0) {
        throw new Error('storefront 반영 대상 활성 매핑이 없습니다. 먼저 매핑을 저장하세요.');
      }
      const rows = Object.values(workbenchDraftsByKey).map((row) => sanitizeOptionEntryMappingPayload(normalizeOptionEntryMappingPayload({
        channel_id: effectiveChannelId,
        external_product_no: activeProductNo,
        option_name: row.option_name,
        option_value: row.option_value,
        category_key: row.category_key,
        material_registry_code: row.material_registry_code,
        weight_g: row.weight_g,
        combo_code: row.combo_code,
        color_bucket_id: row.color_bucket_id,
        decor_master_id: row.decor_master_id,
        addon_master_id: row.addon_master_id,
        other_reason_code: row.other_reason_code,
        explicit_delta_krw: row.explicit_delta_krw,
        notice_code: row.notice_code,
        label_snapshot: row.option_value,
        is_active: true,
      })));
      const saved = await shopApiSend<{ data: Array<Record<string, unknown>> }>("/api/channel-option-entry-mappings", "POST", { rows });
      const recompute = await shopApiSend<RecomputeResponse>("/api/pricing/recompute", "POST", {
        channel_id: effectiveChannelId,
        master_item_ids: [masterItemId.trim()],
        pricing_algo_version: 'REVERSE_FEE_V2',
        external_product_no: activeProductNo,
      });
      if (!recompute.publish_version) {
        throw new Error('recompute 결과에 publish_version이 없어 storefront push를 진행할 수 없습니다.');
      }
      const push = await shopApiSend<PushResponse>("/api/channel-prices/push", "POST", {
        channel_id: effectiveChannelId,
        channel_product_ids: channelProductIds,
        publish_version: recompute.publish_version,
        run_type: 'MANUAL',
      });
      return {
        savedRows: saved.data ?? [],
        recompute,
        push,
      };
    },
    onSuccess: async (result) => {
      toast.success(`옵션 행 저장 완료 · publish ${result.recompute.publish_version ?? '-'} · storefront push ${result.push.success}/${result.push.total}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shop-workbench-detail", effectiveChannelId, masterItemId.trim(), activeProductNo] }),
        queryClient.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] }),
        queryClient.invalidateQueries({ queryKey: ["shop-gallery-products", effectiveChannelId] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recomputeInitialPricing = useMutation({
    mutationFn: async () => {
      const nextMasterItemId = masterItemId.trim();
      if (!effectiveChannelId) throw new Error("channel_id is required");
      if (!nextMasterItemId) throw new Error("master_item_id is required");
      if (!hasActivePricingPolicy) {
        throw new Error("최초 계산 전에 정책 및 팩터에서 활성 가격 정책을 먼저 저장하세요.");
      }
      return shopApiSend<RecomputeResponse>("/api/pricing/recompute", "POST", {
        channel_id: effectiveChannelId,
        master_item_ids: [nextMasterItemId],
        pricing_algo_version: "REVERSE_FEE_V2",
        external_product_no: activeProductNo,
      });
    },
    onSuccess: (response) => {
      const targetLabel = activeProductNo || externalProductNo.trim() || masterItemId.trim();
      if ((response.inserted ?? 0) > 0) {
        toast.success(`최초 계산 완료: ${targetLabel} 기준 ${response.inserted}건을 생성했습니다.`);
        return;
      }

      if (response.reason === "BLOCKED_BY_MISSING_RULES") {
        toast.error(`최초 계산이 막혔습니다. 필요한 룰이 없어 ${response.blocked_by_missing_rules_count ?? 0}건을 계산하지 못했습니다.`);
        return;
      }

      if (response.reason === "NO_MAPPINGS") {
        toast.error("저장된 활성 매핑이 없습니다. 매핑을 먼저 저장한 뒤 최초 계산을 실행하세요.");
        return;
      }

      toast.error(`최초 계산 결과가 없습니다${response.reason ? ` (${response.reason})` : ""}. 매핑과 룰 상태를 확인하세요.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMapping = useMutation({
    mutationFn: (row: Mapping) => shopApiSend<{ ok: boolean }>(`/api/channel-products/${row.channel_product_id}`, "DELETE"),
    onSuccess: async (_, row) => {
      if (editingRowId === row.channel_product_id) setEditingRowId(null);
      toast.success("Mapping deleted.");
      await queryClient.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openGalleryCard = (card: GalleryCardSummary) => {
    setSelectedGalleryCardId(card.card_id);
    const targetRow = mappings.find((row) => row.master_item_id === card.master_item_id && row.external_product_no === card.external_product_no && !String(row.external_variant_code ?? '').trim())
      ?? mappings.find((row) => row.master_item_id === card.master_item_id && row.external_product_no === card.external_product_no)
      ?? null;
    if (!targetRow) {
      setCurrentProductSyncProfileDraft(resolveScopedCurrentProductSyncProfile(card.master_item_id, card.external_product_no));
      setMasterItemId(card.master_item_id);
      setMasterQuery(card.model_name ?? card.master_item_id);
      setMasterLabel(card.model_name ?? card.master_item_id);
      setExternalProductNo(card.external_product_no);
      requestVariantLoad({ masterItemId: card.master_item_id, externalProductNo: card.external_product_no, toastOnSuccess: false });
      setIsDetailOpen(true);
      return;
    }
    startEdit(targetRow);
    setIsDetailOpen(true);
  };

  const startEdit = (row: Mapping) => {
    const variantCode = normalizeVariantCode(row.external_variant_code);
    setCurrentProductSyncProfileDraft(resolveScopedCurrentProductSyncProfile(row.master_item_id, row.external_product_no));
    setEditingRowId(row.channel_product_id);
    setMasterItemId(row.master_item_id);
    setMasterQuery(row.master_item_id);
    setMasterLabel(row.master_item_id);
    setExternalProductNo(row.external_product_no);
    requestVariantLoad({
      masterItemId: row.master_item_id,
      externalProductNo: row.external_product_no,
      focusVariantCode: variantCode,
      toastOnSuccess: false,
    });
  };

  const selectedVariantList = useMemo(() => {
    return loadedVariants.filter((variant) => selectedVariants[normalizeVariantCode(variant.variant_code)]);
  }, [loadedVariants, selectedVariants]);

  const focusedVariant = useMemo(
    () => loadedVariants.find((variant) => normalizeVariantCode(variant.variant_code) === focusedVariantCode) ?? null,
    [focusedVariantCode, loadedVariants],
  );

  const focusedExistingMapping = useMemo(
    () => (focusedVariant ? findExistingRowForVariant(focusedVariant) : null),
    [focusedVariant, editorMappingIndex],
  );

  const focusedDraft = focusedVariant ? (variantOptionDraftsByCode[focusedVariantCode] ?? toVariantOptionDraft(null)) : null;
  const focusedMaterialChoices = focusedDraft
    ? withLegacyChoice(loadedOptionAllowlist.materials, focusedDraft.option_material_code)
    : [];
  const focusedColorChoices = focusedDraft
    ? withLegacyChoice(loadedOptionAllowlist.colors, focusedDraft.option_color_code)
    : [];
  const focusedDecorChoices = focusedDraft
    ? withLegacyChoice(loadedOptionAllowlist.decors, focusedDraft.option_decoration_code)
    : [];
  const focusedSizeChoices = focusedDraft
    ? (() => {
        const baseChoices = loadedOptionAllowlist.sizes_by_material[focusedDraft.option_material_code ?? ""] ?? [];
        return baseChoices.length > 0
          ? withLegacyChoice(baseChoices, focusedDraft.option_size_value_text)
          : [];
      })()
    : [];
  const variantAxisCount = useMemo(
    () => loadedVariants.reduce((max, variant) => Math.max(max, variant.options?.length ?? 0), 0),
    [loadedVariants],
  );

  const toggleAllVariants = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const variant of loadedVariants) {
      next[normalizeVariantCode(variant.variant_code)] = checked;
    }
    setSelectedVariants(next);
  };

  const selectUnmappedVariants = () => {
    const next: Record<string, boolean> = {};
    for (const variant of loadedVariants) {
      const variantCode = normalizeVariantCode(variant.variant_code);
      if (!findExistingRowForVariant(variant)) next[variantCode] = true;
    }
    setSelectedVariants(next);
  };

  const activeChannelName = channels.find((channel) => channel.channel_id === effectiveChannelId)?.channel_name ?? "None";

  useEffect(() => {
    const rows = workbenchDetail?.detail?.editor_rows ?? [];
    const decorChoices = loadedOptionAllowlist.decors.map((choice) => ({ value: choice.decoration_master_id ?? choice.value, label: choice.label }));
    const addonChoices = ((workbenchDetail?.central_registries?.addon_masters ?? []) as Array<{ addon_master_id?: string; addon_name?: string; addon_code?: string; base_amount_krw?: number; extra_delta_krw?: number }>).map((row) => ({
      value: row.addon_master_id ?? "",
      label: row.addon_name ?? row.addon_code ?? row.addon_master_id ?? "-",
      delta_krw: Math.round(Number(row.base_amount_krw ?? 0)) + Math.round(Number(row.extra_delta_krw ?? 0)),
    }));
    setWorkbenchDraftsByKey(Object.fromEntries(rows.map((row: WorkbenchEditorRow) => {
      const normalizedCategoryKey = row.option_name === "장식" && row.category_key === "MATERIAL"
        ? "DECOR"
        : row.category_key;
      const normalizedRow = { ...row, category_key: normalizedCategoryKey };
      if (normalizedCategoryKey === "DECOR" && !normalizedRow.decor_master_id) {
        const inferredDecorMasterId = inferDecorMasterId(normalizedRow.option_value, decorChoices);
        return [normalizedRow.entry_key, { ...normalizedRow, decor_master_id: inferredDecorMasterId }];
      }
      if (normalizedCategoryKey === "ADDON" && !normalizedRow.addon_master_id) {
        const inferredAddon = inferAddonMaster(normalizedRow.option_value, addonChoices);
        return [normalizedRow.entry_key, { ...normalizedRow, addon_master_id: inferredAddon.addon_master_id, resolved_delta_krw: inferredAddon.delta_krw ?? normalizedRow.resolved_delta_krw }];
      }
      return [normalizedRow.entry_key, normalizedRow];
    })));
  }, [loadedOptionAllowlist.decors, workbenchDetail]);

  const activeWorkbenchMaterialCode = useMemo(() => {
    const explicitMaterial = Object.values(workbenchDraftsByKey).find((row) => row.category_key === "MATERIAL" && row.material_registry_code)?.material_registry_code;
    return explicitMaterial ?? workbenchDetail?.detail?.master_material_code ?? null;
  }, [workbenchDraftsByKey, workbenchDetail]);

  const selectedVariantCount = selectedVariantList.length;
  const selectedGalleryCard = useMemo(
    () => galleryCards.find((card) => card.card_id === selectedGalleryCardId) ?? null,
    [galleryCards, selectedGalleryCardId],
  );
  const selectedGalleryCardSyncProfile = useMemo(() => {
    if (!selectedGalleryCard) return DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE;
    return galleryCardSyncProfileIndex.get(`${selectedGalleryCard.master_item_id}::${selectedGalleryCard.external_product_no.trim()}`) ?? DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE;
  }, [galleryCardSyncProfileIndex, selectedGalleryCard]);
  const focusedVariantPriceRow = useMemo(() => {
    if (!focusedVariant) return null;
    const focusedCode = normalizeVariantCode(focusedVariant.variant_code);
    return (workbenchDetail?.detail?.variant_rows ?? [])
      .find((row) => normalizeVariantCode(row.variantCode) === focusedCode) ?? null;
  }, [focusedVariant, workbenchDetail]);
  const detailBaseBreakdown = workbenchDetail?.detail?.base_breakdown ?? null;
  const effectiveFocusedVariant = focusedVariant ?? loadedVariants[0] ?? null;
  const effectiveFocusedVariantCode = effectiveFocusedVariant ? normalizeVariantCode(effectiveFocusedVariant.variant_code) : "";
  const effectiveFocusedVariantPriceRow = useMemo(() => {
    if (!effectiveFocusedVariant) return null;
    const focusedCode = normalizeVariantCode(effectiveFocusedVariant.variant_code);
    return (workbenchDetail?.detail?.variant_rows ?? [])
      .find((row) => normalizeVariantCode(row.variantCode) === focusedCode) ?? null;
  }, [effectiveFocusedVariant, workbenchDetail]);
  const focusedVariantCurrentAdditionalKrw = useMemo(() => {
    if (!effectiveFocusedVariant) return null;
    return (effectiveFocusedVariant.options ?? []).reduce((sum, axis) => {
      const optionName = String(axis.name ?? '').trim();
      const optionValue = String(axis.value ?? '').trim();
      const row = Object.values(workbenchDraftsByKey).find((candidate) => candidate.option_name === optionName && candidate.option_value === optionValue)
        ?? (workbenchDetail?.detail?.editor_rows ?? []).find((candidate: WorkbenchEditorRow) => candidate.option_name === optionName && candidate.option_value === optionValue)
        ?? null;
      return sum + Math.round(Number(row?.resolved_delta_krw ?? 0));
    }, 0);
  }, [effectiveFocusedVariant, workbenchDraftsByKey, workbenchDetail]);
  const focusedVariantCurrentFinalKrw = useMemo(() => {
    if (focusedVariantCurrentAdditionalKrw == null) return null;
    return Math.max(0, Math.round(Number(workbenchDetail?.detail?.base_price_krw ?? 0)) + focusedVariantCurrentAdditionalKrw);
  }, [focusedVariantCurrentAdditionalKrw, workbenchDetail]);
  const focusedVariantStorefrontFinalKrw = effectiveFocusedVariantPriceRow?.finalPriceKrw ?? null;
  const focusedVariantIsMatch = focusedVariantCurrentFinalKrw != null
    && focusedVariantStorefrontFinalKrw != null
    && focusedVariantCurrentFinalKrw === focusedVariantStorefrontFinalKrw;
  const focusedStorefrontAxisEntryKeys = useMemo(
    () => new Set(
      (effectiveFocusedVariant?.options ?? [])
        .map((axis) => `${String(axis.name ?? '').trim()}::${String(axis.value ?? '').trim()}`)
        .filter((entryKey) => entryKey !== '::'),
    ),
    [effectiveFocusedVariant],
  );

  return (
    <div className="space-y-4">
      <ActionBar
        title="쇼핑 매핑"
        subtitle="채널 variant를 불러와 옵션 구조를 매핑하고 variant별 또는 일괄 저장합니다."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => requestVariantLoad()}
              disabled={loadVariants.isPending || !effectiveChannelId || !masterItemId.trim() || !externalProductNo.trim()}
            >
              {loadVariants.isPending ? "불러오는 중..." : "variant 불러오기"}
            </Button>
            <Button
              size="sm"
              onClick={() => recomputeInitialPricing.mutate()}
              disabled={
                recomputeInitialPricing.isPending
                || !effectiveChannelId
                || !masterItemId.trim()
                || !activeProductNo
                || !hasSavedEditorMappings
                || !hasActivePricingPolicy
              }
            >
              {recomputeInitialPricing.isPending ? "계산 중..." : "최초 계산"}
            </Button>
            <Button size="sm" variant="secondary" onClick={resetEditor}>
              편집기 초기화
            </Button>
          </>
        }
      />

      <ShoppingPageHeader
        purpose="채널 상품과 variant의 옵션 구조 매핑을 관리합니다."
        status={[
          { label: "채널", value: activeChannelName, tone: effectiveChannelId ? "good" : "warn" },
          {
            label: "활성 가격 정책",
            value: activePricingPolicy?.policy_name ?? "없음",
            tone: hasActivePricingPolicy ? "good" : "warn",
          },
          { label: "기본가 row", value: `${statusBaseRowCount}`, tone: statusBaseRowCount > 0 ? "good" : "neutral" },
          { label: "옵션 row", value: `${statusVariantRowCount}`, tone: statusVariantRowCount > 0 ? "good" : "neutral" },
          { label: "불러온 variant 수", value: `${loadedVariants.length}`, tone: loadedVariants.length > 0 ? "good" : "neutral" },
        ]}
        nextActions={[
          { label: "옵션 규칙", href: "/settings/shopping/rules" },
          { label: "정책 및 팩터", href: "/settings/shopping/factors" },
          { label: "자동 가격", href: "/settings/shopping/auto-price" },
        ]}
      />

      <div className="space-y-4">
        <Card className="hidden">
          <CardHeader title="편집기" description={editingRowId ? `수정 중 ${editingRowId}` : "채널, 마스터, 상품번호를 선택하세요."} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">채널</div>
                <Select
                  value={effectiveChannelId}
                  onChange={(event) => {
                    setChannelId(event.target.value);
                    resetEditor();
                  }}
                >
                  <option value="">채널 선택</option>
                  {channels.map((channel) => (
                    <option key={channel.channel_id} value={channel.channel_id}>
                      {channel.channel_name} ({channel.channel_code})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.9fr_0.8fr]">
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">마스터 검색</div>
                <Input value={masterQuery} onChange={(event) => setMasterQuery(event.target.value)} placeholder="모델명 검색" />
                {masterSuggestions.length > 0 ? (
                  <div className="max-h-48 overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                    {masterSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.master_item_id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 border-t border-[var(--hairline)] px-3 py-2 text-left first:border-t-0 hover:bg-[var(--panel)]"
                        onClick={() => chooseMasterSuggestion(suggestion)}
                      >
                        <span className="min-w-0 text-sm text-[var(--foreground)]">{suggestion.model_name}</span>
                        <span className="shrink-0 text-xs text-[var(--muted)]">{suggestion.master_item_id}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">마스터 상품 ID</div>
                <Input value={masterItemId} onChange={(event) => setMasterItemId(event.target.value)} placeholder="master_item_id" />
                <div className="text-xs text-[var(--muted)]">{masterLabel || "검색에서 고르거나 직접 입력하세요."}</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">쇼핑몰 상품번호</div>
                <Input
                  value={externalProductNo}
                  onChange={(event) => setExternalProductNo(event.target.value)}
                  placeholder="쇼핑몰 상품번호"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3 text-sm md:grid-cols-4">
              <div>
                <div className="text-[11px] text-[var(--muted)]">요청값</div>
                <div>{externalProductNo.trim() || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">해석된 상품번호</div>
                <div>{resolvedProductNo || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">기준 상품번호</div>
                <div>{canonicalProductNo || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">설정 상태</div>
                <div>
                  {loadedOptionAllowlist.materials.length} materials / {loadedOptionAllowlist.colors.length} colors / {loadedOptionAllowlist.decors.length} decors
                </div>
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
              {hasActivePricingPolicy
                ? "새 매핑을 저장한 뒤에는 기본가 row를 따로 선택할 필요 없고, 현재 마스터 전체를 이 화면의 `최초 계산`으로 먼저 계산하세요. 5분 cron은 그 다음 자동 run/push 단계에서 타는 흐름입니다."
                : "`최초 계산` 전에 `정책 및 팩터`에서 활성 가격 정책을 먼저 저장하세요. 활성 정책이 없으면 현재 마스터의 기본가 row와 옵션 row 계산을 시작할 수 없습니다."}
            </div>

            {(channelsQuery.error || mappingsQuery.error || pricingPoliciesQuery.error) ? (
              <div className="rounded-[var(--radius)] border border-red-300 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {describeError(channelsQuery.error ?? mappingsQuery.error ?? pricingPoliciesQuery.error)}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
          <Card>
            <CardHeader
              title="쇼핑 갤러리"
              description="카드가 이 화면의 시작점입니다. 제품 카드를 열면 우측 요약과 아래 option-entry 워크벤치가 같은 범위로 이어집니다."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[11px] text-[var(--muted)]">갤러리 카드</div>
                  <div className="mt-1 text-base font-semibold">{galleryCards.length}</div>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[11px] text-[var(--muted)]">현재 범위 row</div>
                  <div className="mt-1 text-base font-semibold">{visibleMappings.length}</div>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[11px] text-[var(--muted)]">불러온 variant</div>
                  <div className="mt-1 text-base font-semibold">{loadedVariants.length}</div>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2">
                  <div className="text-[11px] text-[var(--muted)]">워크벤치 행</div>
                  <div className="mt-1 text-base font-semibold">{(workbenchDetail?.detail?.editor_rows ?? []).length}</div>
                </div>
              </div>

              {galleryCards.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline)] bg-[var(--background)] px-3 py-10 text-center text-sm text-[var(--muted)]">
                  표시할 갤러리 카드가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  {galleryCards.map((card) => {
                    const isActive = masterItemId.trim() === card.master_item_id && productCandidates.includes(card.external_product_no.trim());
                    const syncProfile = galleryCardSyncProfileIndex.get(`${card.master_item_id}::${card.external_product_no.trim()}`) ?? DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE;
                    const isMarketLinkedCard = syncProfile === "MARKET_LINKED";
                    return (
                      <div
                        key={card.card_id}
                        role="button"
                        tabIndex={0}
                        className={[
                          "cursor-pointer rounded-[var(--radius-lg)] border p-3 text-left transition-[transform,border-color,box-shadow,background-color] duration-200",
                          isMarketLinkedCard
                            ? isActive
                              ? "border-[var(--warning)] bg-[linear-gradient(180deg,var(--warning-soft),var(--panel)_42%)] shadow-[var(--shadow)]"
                              : "border-[var(--warning-soft)] bg-[linear-gradient(180deg,var(--warning-soft),var(--panel)_48%)] hover:-translate-y-0.5 hover:bg-[linear-gradient(180deg,var(--warning-soft),var(--background)_70%)] hover:shadow-[var(--shadow-sm)]"
                            : isActive
                              ? "border-[var(--primary)] bg-[var(--panel)] shadow-[var(--shadow)]"
                              : "border-[var(--hairline)] bg-[var(--panel)] hover:-translate-y-0.5 hover:bg-[var(--background)] hover:shadow-[var(--shadow-sm)]",
                        ].join(" ")}
                        onClick={() => openGalleryCard(card)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openGalleryCard(card);
                          }
                        }}
                      >
                        <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-[var(--background)]">
                          {card.thumbnail_url ? (
                            <img src={card.thumbnail_url} alt={card.model_name ?? card.external_product_no} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,var(--primary-soft),transparent_62%),linear-gradient(180deg,var(--panel),var(--background))] text-xs text-[var(--muted)]">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--foreground)]">{card.model_name || card.external_product_no}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">{card.master_item_id} / {card.external_product_no}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                            {isMarketLinkedCard ? (
                              <div className="rounded-full border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--warning)]">
                                {formatCurrentProductSyncProfileLabel(syncProfile)}
                              </div>
                            ) : null}
                            <div className={`rounded-full border px-2 py-1 text-[10px] ${card.publish_status === "UNRESOLVED" ? "border-[var(--warning-soft)] bg-[var(--warning-soft)] text-[var(--warning)]" : card.publish_status === "PUBLISHED" ? "border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--hairline)] bg-[var(--background)] text-[var(--muted)]"}`}>
                              {card.publish_status}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted-strong)]">
                          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-2">base {formatMoney(card.published_base_price_krw)}</div>
                          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-2">range {formatMoney(card.published_min_price_krw)} - {formatMoney(card.published_max_price_krw)}</div>
                          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-2">variants {card.variant_count}</div>
                          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-2">rows {card.mapping_count}</div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); openGalleryCard(card); }}>
                            열기
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card className="hidden">
              <CardHeader
                title="선택 제품 요약"
                description="갤러리에서 연 제품의 가격/상태/option row 범위를 compact하게 확인합니다."
              />
              <CardBody className="space-y-4">
                {selectedGalleryCard ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="h-20 w-20 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] shrink-0">
                        {selectedGalleryCard.thumbnail_url ? (
                          <img src={selectedGalleryCard.thumbnail_url} alt={selectedGalleryCard.model_name ?? selectedGalleryCard.external_product_no} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--muted)]">NO IMAGE</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{selectedGalleryCard.model_name || selectedGalleryCard.external_product_no}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{selectedGalleryCard.master_item_id}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{selectedGalleryCard.external_product_no}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">게시 기준가</div>
                        <div className="mt-1 font-semibold">{formatMoney(selectedGalleryCard.published_base_price_krw)}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">게시 가격 범위</div>
                        <div className="mt-1 font-semibold">{formatMoney(selectedGalleryCard.published_min_price_krw)} - {formatMoney(selectedGalleryCard.published_max_price_krw)}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">variant / active row</div>
                        <div className="mt-1 font-semibold">{selectedGalleryCard.variant_count} / {selectedGalleryCard.active_count}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">저장된 option entry</div>
                        <div className="mt-1 font-semibold">{workbenchDetail?.detail?.mapping_count ?? selectedGalleryCard.mapping_count}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3 text-xs sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-[var(--muted)]">요청 / 해석 / 기준 상품번호</div>
                        <div className="mt-1 text-[var(--foreground)]">{externalProductNo.trim() || "-"} / {resolvedProductNo || "-"} / {canonicalProductNo || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[var(--muted)]">설정 상태</div>
                        <div className="mt-1 text-[var(--foreground)]">{savedOptionCategories.length} saved categories / {loadedOptionAllowlist.materials.length} materials / {loadedOptionAllowlist.colors.length} colors</div>
                      </div>
                    </div>

                    {selectedGalleryCard.has_unresolved || workbenchDetail?.detail?.unresolved ? (
                      <div className="rounded-[var(--radius)] border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                        <div className="font-medium">미해결 상태가 있습니다.</div>
                        <div className="mt-1 text-xs text-[var(--muted-strong)]">
                          {(workbenchDetail?.detail?.unresolved_reasons ?? []).join(" / ") || "갤러리 카드 또는 워크벤치 상태를 확인하세요."}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="text-xs font-semibold tracking-wide text-[var(--muted)]">OPTION ROW SUMMARY</div>
                      {(workbenchDetail?.detail?.option_rows ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {((workbenchDetail?.detail?.option_rows ?? []) as Array<{ option_axis_index: number; option_name: string; option_value: string; published_delta_krw: number }>).slice(0, 6).map((row) => (
                            <div key={`${row.option_axis_index}-${row.option_name}-${row.option_value}`} className="rounded-full border border-[var(--hairline)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--foreground)]">
                              Axis {row.option_axis_index} · {row.option_name} / {row.option_value}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-4 text-sm text-[var(--muted)]">
                          아직 option row summary가 없습니다.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] bg-[var(--background)] px-3 py-10 text-center text-sm text-[var(--muted)]">
                    갤러리 카드 하나를 열면 이곳에 제품 요약이 붙습니다.
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="hidden">
              <CardHeader
                title="variant 요약"
                description="선택한 variant의 저장 상태와 옵션 draft를 compact하게 다룹니다."
              />
              <CardBody className="space-y-4">
                {focusedVariant && focusedDraft ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">{focusedVariant.option_label || normalizeVariantCode(focusedVariant.variant_code) || "variant"}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{normalizeVariantCode(focusedVariant.variant_code) || "variant_code 없음"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`rounded-full border px-2 py-1 ${focusedExistingMapping ? "border-[var(--success-soft)] bg-[var(--success-soft)] text-[var(--success)]" : "border-[var(--warning-soft)] bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                          {focusedExistingMapping ? "저장됨" : "미저장"}
                        </span>
                        <span className={`rounded-full border px-2 py-1 ${selectedVariants[focusedVariantCode] ? "border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--hairline)] bg-[var(--panel)] text-[var(--muted)]"}`}>
                          {selectedVariants[focusedVariantCode] ? "저장 목록 포함" : "저장 목록 제외"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">채널 추가금</div>
                        <div className="mt-1 font-semibold">{formatMoney(focusedVariant.additional_amount)}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">예상 최종가</div>
                        <div className="mt-1 font-semibold">{formatMoney(focusedVariantPriceRow?.finalPriceKrw ?? null)}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">매핑 요약</div>
                        <div className="mt-1 font-semibold">{optionSummary(focusedDraft)}</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">선택한 저장 대상</div>
                        <div className="mt-1 font-semibold">{selectedVariantCount}</div>
                      </div>
                    </div>

                    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-3">
                      <div className="text-[11px] text-[var(--muted)]">옵션 축</div>
                      <div className="mt-2 space-y-2">
                        {(focusedVariant.options ?? []).map((axis, index) => (
                          <div key={`${axis.name}-${axis.value}-${index}`} className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]">
                            {axisCellText(axis)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--muted)]">소재</div>
                        <Select
                          value={focusedDraft.option_material_code ?? ""}
                          onChange={(event) => updateVariantOptionDraft(focusedVariantCode, (current) => ({ ...current, option_material_code: event.target.value || null }))}
                        >
                          <option value="">선택 안함</option>
                          {focusedMaterialChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--muted)]">사이즈</div>
                        <Select
                          value={focusedDraft.option_size_value_text}
                          onChange={(event) => updateVariantOptionDraft(focusedVariantCode, (current) => ({ ...current, option_size_value_text: event.target.value, option_size_value: parseOptionalNumber(event.target.value) }))}
                        >
                          <option value="">선택 안함</option>
                          {focusedSizeChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--muted)]">색상</div>
                        <Select
                          value={focusedDraft.option_color_code ?? ""}
                          onChange={(event) => updateVariantOptionDraft(focusedVariantCode, (current) => ({ ...current, option_color_code: event.target.value || null }))}
                        >
                          <option value="">선택 안함</option>
                          {focusedColorChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-[var(--muted)]">장식</div>
                        <Select
                          value={focusedDraft.option_decoration_code ?? ""}
                          onChange={(event) => updateVariantOptionDraft(focusedVariantCode, (current) => ({ ...current, option_decoration_code: event.target.value || null }))}
                        >
                          <option value="">선택 안함</option>
                          {focusedDecorChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const variantCode = normalizeVariantCode(focusedVariant.variant_code);
                          setSelectedVariants((prev) => ({ ...prev, [variantCode]: !prev[variantCode] }));
                        }}
                      >
                        {selectedVariants[focusedVariantCode] ? "저장 목록에서 제거" : "저장 목록에 추가"}
                      </Button>
                      <Button size="sm" onClick={() => saveVariant.mutate(focusedVariant)} disabled={saveVariant.isPending}>
                        {saveVariant.isPending ? "저장 중..." : "현재 variant 저장"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => bulkSave.mutate(selectedVariantList)}
                        disabled={bulkSave.isPending || selectedVariantCount === 0}
                      >
                        {bulkSave.isPending ? "일괄 저장 중..." : `선택 ${selectedVariantCount}건 일괄 저장`}
                      </Button>
                      {focusedExistingMapping ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const ok = window.confirm(`Delete mapping ${focusedExistingMapping.external_product_no} / ${focusedExistingMapping.external_variant_code || "기본가"}?`);
                            if (ok) deleteMapping.mutate(focusedExistingMapping);
                          }}
                          disabled={deleteMapping.isPending}
                        >
                          현재 저장 삭제
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] bg-[var(--background)] px-3 py-10 text-center text-sm text-[var(--muted)]">
                    갤러리에서 제품을 열면 variant 요약과 저장 액션이 이곳에 표시됩니다.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Card className="hidden">
        <CardHeader
          title="option-entry 워크벤치"
          description="선택한 제품과 variant 범위를 유지한 채 option entry를 정리합니다. 기존 목록 표 대신 워크벤치가 바로 이어집니다."
        />
        <CardBody className="space-y-4">
          <OptionEntryWorkbench
            basePriceText={formatMoney(workbenchDetail?.detail?.base_price_krw)}
            groups={(workbenchDetail?.detail?.editor_groups ?? []) as WorkbenchEditorGroup[]}
            draftsByKey={workbenchDraftsByKey}
            currentProductSyncProfile={currentProductSyncProfileDraft}
            compact
            materialReadonly
            categoryChoices={[{ value: "MATERIAL", label: "MATERIAL" }, { value: "SIZE", label: "SIZE" }, { value: "COLOR_PLATING", label: "COLOR_PLATING" }, { value: "DECOR", label: "DECOR" }, { value: "ADDON", label: "ADDON" }, { value: "OTHER", label: "OTHER" }, { value: "NOTICE", label: "NOTICE" }]}
            materialChoices={((workbenchDetail?.central_registries?.materials ?? []) as Array<{ material_code: string; material_label: string }>).map((row) => ({ value: row.material_code, label: row.material_label }))}
            colorChoices={loadedOptionAllowlist.colors}
            sizeChoicesByMaterial={(workbenchDetail?.shared_size_choices_by_material ?? {})}
            activeMaterialCode={activeWorkbenchMaterialCode}
            colorBucketChoices={((workbenchDetail?.central_registries?.color_buckets ?? []) as Array<{ color_bucket_id: string; bucket_label: string; sell_delta_krw: number }>)}
            decorChoices={loadedOptionAllowlist.decors.map((choice) => ({ value: choice.decoration_master_id ?? choice.value, label: choice.label, delta_krw: choice.delta_krw ?? null }))}
            addonChoices={((workbenchDetail?.central_registries?.addon_masters ?? []) as Array<{ addon_master_id?: string; addon_name?: string; addon_code?: string; base_amount_krw?: number; extra_delta_krw?: number }>).map((row) => ({ value: row.addon_master_id ?? "", label: row.addon_name ?? row.addon_code ?? row.addon_master_id ?? "-", delta_krw: Math.round(Number(row.base_amount_krw ?? 0)) + Math.round(Number(row.extra_delta_krw ?? 0)) }))}
            onChangeCurrentProductSyncProfile={setCurrentProductSyncProfileDraft}
            onChangeRow={(entryKey, updater) => {
              setWorkbenchDraftsByKey((prev) => ({
                ...prev,
                [entryKey]: updater(prev[entryKey] ?? (workbenchDetail?.detail?.editor_rows ?? []).find((row: WorkbenchEditorRow) => row.entry_key === entryKey)!),
              }));
            }}
            onChangeGroup={(group, updater) => {
              setWorkbenchDraftsByKey((prev) => {
                const next = { ...prev };
                for (const row of group.rows) {
                  const current = prev[row.entry_key] ?? (workbenchDetail?.detail?.editor_rows ?? []).find((candidate: WorkbenchEditorRow) => candidate.entry_key === row.entry_key)!;
                  next[row.entry_key] = updater(current);
                }
                return next;
              });
            }}
            onSave={() => saveWorkbenchRows.mutate()}
            savePending={saveWorkbenchRows.isPending}
          />
        </CardBody>
      </Card>


      <Sheet
        open={isDetailOpen && Boolean(selectedGalleryCard)}
        onOpenChange={setIsDetailOpen}
        title="상품 상세"
        description="게시 가격과 옵션 구성, variant 결과를 확인합니다."
        side="right"
        className="w-full lg:w-[1460px] xl:w-[1560px]"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">{selectedGalleryCard?.model_name || selectedGalleryCard?.external_product_no}</div>
                  {selectedGalleryCardSyncProfile === "MARKET_LINKED" ? (
                    <div className="rounded-full border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--warning)]">
                      {formatCurrentProductSyncProfileLabel(selectedGalleryCardSyncProfile)}
                    </div>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">{selectedGalleryCard?.master_item_id} / {selectedGalleryCard?.external_product_no}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setIsWorkbenchOpen(true)} disabled={!workbenchDetail?.detail?.editor_rows?.length}>옵션수정</Button>
                <Button size="sm" onClick={() => recomputeInitialPricing.mutate()} disabled={recomputeInitialPricing.isPending || !activeProductNo || !masterItemId.trim() || !hasActivePricingPolicy}>{recomputeInitialPricing.isPending ? '계산 중...' : '최초 계산'}</Button>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <div className="space-y-3">
                <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-[var(--panel)]">
                  {selectedGalleryCard?.thumbnail_url ? <img src={selectedGalleryCard.thumbnail_url} alt={selectedGalleryCard.model_name ?? selectedGalleryCard.external_product_no} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">이미지 없음</div>}
                </div>
                <div className={`rounded-[var(--radius)] border p-3 text-sm ${selectedGalleryCardSyncProfile === "MARKET_LINKED" ? "border-[var(--warning-soft)] bg-[linear-gradient(180deg,var(--warning-soft),var(--panel)_58%)]" : "border-[var(--hairline)] bg-[var(--panel)]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-[var(--muted)]">게시 base 가격</div>
                    {selectedGalleryCardSyncProfile === "MARKET_LINKED" ? (
                      <div className="rounded-full border border-[var(--warning-soft)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--warning)]">
                        {formatCurrentProductSyncProfileLabel(selectedGalleryCardSyncProfile)}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1 font-medium">{formatMoney(workbenchDetail?.detail?.base_price_krw)}</div>
                  <div className="mt-3 text-[11px] text-[var(--muted)]">master 소재</div>
                  <div className="mt-1 font-medium">{workbenchDetail?.detail?.master_material_code || '-'}</div>
                  <div className="mt-3 text-[11px] text-[var(--muted)]">옵션 행 수</div>
                  <div className="mt-1 font-medium">{workbenchDetail?.detail?.editor_rows?.length ?? 0}</div>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">선택 조합 비교</div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] ${focusedVariantIsMatch ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-700'}`}>
                      {focusedVariantIsMatch ? '일치' : '비교중'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-[11px] text-[var(--muted)]">조합 선택</div>
                      <Select value={effectiveFocusedVariantCode} onChange={(event) => setFocusedVariantCode(event.target.value)}>
                        {loadedVariants.map((variant) => {
                          const code = normalizeVariantCode(variant.variant_code);
                          return <option key={code} value={code}>{variant.option_label || code}</option>;
                        })}
                      </Select>
                    </div>
                    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                      <div className="text-[11px] text-[var(--muted)]">선택 조합</div>
                      <div className="mt-1 text-xs text-[var(--foreground)]">{effectiveFocusedVariant ? summarizeAxes(effectiveFocusedVariant) : '-'}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">현재 계산 최종값</div>
                        <div className="mt-1 font-semibold">{formatMoney(focusedVariantCurrentFinalKrw)}</div>
                        <div className="mt-1 text-[11px] text-[var(--muted)]">base + 현재 row delta 합</div>
                      </div>
                      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
                        <div className="text-[11px] text-[var(--muted)]">storefront 저장값</div>
                        <div className="mt-1 font-semibold">{formatMoney(focusedVariantStorefrontFinalKrw)}</div>
                        <div className="mt-1 text-[11px] text-[var(--muted)]">현재 publish/storefront final</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <DetailedPriceBreakdownPanel
                  baseBreakdown={detailBaseBreakdown}
                  publishedMinPriceKrw={selectedGalleryCard?.published_min_price_krw}
                  publishedMaxPriceKrw={selectedGalleryCard?.published_max_price_krw}
                />
              </div>
            </div>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={isWorkbenchOpen}
        onOpenChange={setIsWorkbenchOpen}
        title="옵션 수정"
        description="각 옵션별로 카테고리와 매핑을 수정합니다."
        side="left"
        className="w-full lg:w-[1500px] xl:w-[1620px]"
      >
        <div className="flex h-full min-h-0 flex-col px-5 py-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <OptionEntryWorkbench
            basePriceText={formatMoney(workbenchDetail?.detail?.base_price_krw)}
            groups={(workbenchDetail?.detail?.editor_groups ?? []) as WorkbenchEditorGroup[]}
            draftsByKey={workbenchDraftsByKey}
            currentProductSyncProfile={currentProductSyncProfileDraft}
            compact
            materialReadonly
            categoryChoices={[{ value: "MATERIAL", label: "MATERIAL" }, { value: "SIZE", label: "SIZE" }, { value: "COLOR_PLATING", label: "COLOR_PLATING" }, { value: "DECOR", label: "DECOR" }, { value: "ADDON", label: "ADDON" }, { value: "OTHER", label: "OTHER" }, { value: "NOTICE", label: "NOTICE" }]}
            materialChoices={((workbenchDetail?.central_registries?.materials ?? []) as Array<{ material_code: string; material_label: string }>).map((row) => ({ value: row.material_code, label: row.material_label }))}
            colorChoices={loadedOptionAllowlist.colors}
            sizeChoicesByMaterial={(workbenchDetail?.shared_size_choices_by_material ?? {})}
            activeMaterialCode={activeWorkbenchMaterialCode}
            colorBucketChoices={((workbenchDetail?.central_registries?.color_buckets ?? []) as Array<{ color_bucket_id: string; bucket_label: string; sell_delta_krw: number }>)}
            decorChoices={loadedOptionAllowlist.decors.map((choice) => ({ value: choice.decoration_master_id ?? choice.value, label: choice.label, delta_krw: choice.delta_krw ?? null }))}
            addonChoices={((workbenchDetail?.central_registries?.addon_masters ?? []) as Array<{ addon_master_id?: string; addon_name?: string; addon_code?: string; base_amount_krw?: number; extra_delta_krw?: number }>).map((row) => ({ value: row.addon_master_id ?? "", label: row.addon_name ?? row.addon_code ?? row.addon_master_id ?? "-", delta_krw: Math.round(Number(row.base_amount_krw ?? 0)) + Math.round(Number(row.extra_delta_krw ?? 0)) }))}
            onChangeCurrentProductSyncProfile={setCurrentProductSyncProfileDraft}
            onChangeRow={(entryKey, updater) => {
              setWorkbenchDraftsByKey((prev) => ({
                ...prev,
                [entryKey]: updater(prev[entryKey] ?? (workbenchDetail?.detail?.editor_rows ?? []).find((row: WorkbenchEditorRow) => row.entry_key === entryKey)!),
              }));
            }}
            onChangeGroup={(group, updater) => {
              setWorkbenchDraftsByKey((prev) => {
                const next = { ...prev };
                for (const row of group.rows) {
                  const current = prev[row.entry_key] ?? (workbenchDetail?.detail?.editor_rows ?? []).find((candidate: WorkbenchEditorRow) => candidate.entry_key === row.entry_key)!;
                  next[row.entry_key] = updater(current);
                }
                return next;
              });
            }}
            onSave={() => saveWorkbenchRows.mutate()}
            savePending={saveWorkbenchRows.isPending}
          />
          </div>
        </div>
      </Sheet>

    </div>
  );
}

