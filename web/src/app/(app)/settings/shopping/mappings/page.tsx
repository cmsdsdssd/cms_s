"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";
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

type SyncRuleSet = {
  rule_set_id: string;
  channel_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type PricingPolicy = {
  policy_id: string;
  channel_id: string;
  policy_name: string;
  is_active: boolean;
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

type VariantOptionDraft = MappingOptionSelection & {
  option_size_value_text: string;
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

  const pricingPoliciesQuery = useQuery({
    queryKey: ["shop-pricing-policies", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: PricingPolicy[] }>(
        "/api/pricing-policies?channel_id=" + encodeURIComponent(effectiveChannelId),
      ),
  });
  const pricingPolicies = pricingPoliciesQuery.data?.data ?? [];


  const syncRuleSetsQuery = useQuery({
    queryKey: ["shop-sync-rule-sets", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: SyncRuleSet[] }>(
        `/api/sync-rule-sets?channel_id=${encodeURIComponent(effectiveChannelId)}&only_active=true`,
      ),
  });
  const syncRuleSets = syncRuleSetsQuery.data?.data ?? [];

  const [masterItemId, setMasterItemId] = useState("");
  const [masterQuery, setMasterQuery] = useState("");
  const [masterQueryDebounced, setMasterQueryDebounced] = useState("");
  const [masterLabel, setMasterLabel] = useState("");
  const [externalProductNo, setExternalProductNo] = useState("");
  const [loadedVariants, setLoadedVariants] = useState<VariantCandidate[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});
  const [variantDeltaByCode, setVariantDeltaByCode] = useState<Record<string, string>>({});
  const [variantOptionDraftsByCode, setVariantOptionDraftsByCode] = useState<Record<string, VariantOptionDraft>>({});
  const [loadedOptionAllowlist, setLoadedOptionAllowlist] = useState<MappingOptionAllowlist>(EMPTY_OPTION_ALLOWLIST);
  const [savedOptionCategories, setSavedOptionCategories] = useState<SavedOptionCategoryRow[]>([]);
  const [resolvedProductNo, setResolvedProductNo] = useState("");
  const [canonicalProductNo, setCanonicalProductNo] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [focusedVariantCode, setFocusedVariantCode] = useState("");

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

  const effectiveSyncRuleSetId = syncRuleSets[0]?.rule_set_id || "";
  const activeSyncRuleSetName = syncRuleSets[0]?.name || "-";

  const resetVariantState = () => {
    setLoadedVariants([]);
    setSelectedVariants({});
    setVariantDeltaByCode({});
    setVariantOptionDraftsByCode({});
    setLoadedOptionAllowlist(EMPTY_OPTION_ALLOWLIST);
    setSavedOptionCategories([]);
    setResolvedProductNo("");
    setCanonicalProductNo("");
    setFocusedVariantCode("");
  };

  const resetEditor = () => {
    setEditingRowId(null);
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
        nextDeltas[variantCode] = existing?.option_price_delta_krw != null ? String(existing.option_price_delta_krw) : "";
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
      setVariantDeltaByCode(nextDeltas);
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
    const existing = findExistingRowForVariant(variant);
    const draft = variantOptionDraftsByCode[variantCode] ?? toVariantOptionDraft(null);
    const delta = parseOptionalNumber(variantDeltaByCode[variantCode] ?? "");
    const optionSizeValue = parseOptionalNumber(draft.option_size_value_text);
    const optionPriceMode: "SYNC" | "MANUAL" = existing?.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC";
    const syncRuleSet = optionPriceMode === "SYNC"
      ? effectiveSyncRuleSetId
        || existing?.sync_rule_set_id
        || inferredSyncRuleSetId
      : "";

    if (!effectiveChannelId) throw new Error("channel_id is required");
    if (!masterItemId.trim()) throw new Error("master_item_id is required");
    if (!activeProductNo) throw new Error("external_product_no is required");
    if (!variantCode) throw new Error("external_variant_code is required");
    if (delta != null && (!Number.isInteger(delta) || delta % 1000 !== 0)) throw new Error("option_price_delta_krw must be 1000 KRW step");

    return {
      channel_id: effectiveChannelId,
      master_item_id: masterItemId.trim(),
      external_product_no: activeProductNo,
      external_variant_code: variantCode,
      sync_rule_set_id: syncRuleSet || null,
      option_material_code: draft.option_material_code,
      option_color_code: draft.option_color_code,
      option_decoration_code: draft.option_decoration_code,
      option_size_value: optionSizeValue,
      option_price_delta_krw: delta,
      option_price_mode: optionPriceMode,
      option_manual_target_krw: optionPriceMode === "MANUAL" ? existing?.option_manual_target_krw ?? null : null,
      include_master_plating_labor: existing?.include_master_plating_labor !== false,
      sync_rule_material_enabled: existing?.sync_rule_material_enabled !== false,
      sync_rule_weight_enabled: existing?.sync_rule_weight_enabled !== false,
      sync_rule_plating_enabled: existing?.sync_rule_plating_enabled !== false,
      sync_rule_decoration_enabled: existing?.sync_rule_decoration_enabled !== false,
      sync_rule_margin_rounding_enabled: existing?.sync_rule_margin_rounding_enabled !== false,
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

  const startEdit = (row: Mapping) => {
    const variantCode = normalizeVariantCode(row.external_variant_code);
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
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
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">채널 기본 룰세트</div>
                <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] px-3 py-2 text-sm">
                  {activeSyncRuleSetName}
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  SYNC 저장은 이 채널의 활성 룰세트를 자동으로 사용합니다.
                </div>
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

            {(channelsQuery.error || mappingsQuery.error || pricingPoliciesQuery.error || syncRuleSetsQuery.error) ? (
              <div className="rounded-[var(--radius)] border border-red-300 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {describeError(channelsQuery.error ?? mappingsQuery.error ?? pricingPoliciesQuery.error ?? syncRuleSetsQuery.error)}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="기존 매핑"
            description={hasEditorScope ? "현재 편집 대상 기준으로 필터링했습니다." : "최신 row를 보여줍니다."}
          />
          <CardBody className="space-y-3">
            <div className="text-xs text-[var(--muted)]">표시 {visibleMappings.length} / 전체 {mappings.length} / 기본가 {statusBaseRowCount} / 옵션 {statusVariantRowCount}</div>

            {visibleMappings.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-8 text-center text-sm text-[var(--muted)]">
                표시할 매핑이 없습니다.
              </div>
            ) : (
              <div className="max-h-[36rem] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--panel)] text-left">
                    <tr>
                      <th className="px-3 py-2">상품</th>
                      <th className="px-3 py-2">마스터</th>
                      <th className="px-3 py-2">상세</th>
                      <th className="px-3 py-2">추가금</th>
                      <th className="px-3 py-2">수정 시각</th>
                      <th className="px-3 py-2">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMappings.map((row) => (
                      <tr
                        key={row.channel_product_id}
                        className={`border-t border-[var(--hairline)] ${editingRowId === row.channel_product_id ? "bg-[var(--panel)]" : ""}`}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">{row.external_product_no}</div>
                          <div className="text-xs text-[var(--muted)]">{row.external_variant_code || "기본가"}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div>{row.master_item_id}</div>
                          <div className="text-xs text-[var(--muted)]">{row.option_price_mode || "SYNC"}</div>
                        </td>
                        <td className="px-3 py-2 align-top">{optionSummary(row)}</td>
                        <td className="px-3 py-2 align-top">{formatMoney(row.option_price_delta_krw)}</td>
                        <td className="px-3 py-2 align-top text-xs text-[var(--muted)]">{formatWhen(row.updated_at)}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => startEdit(row)} disabled={loadVariants.isPending}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                const ok = window.confirm(`Delete mapping ${row.external_product_no} / ${row.external_variant_code || "기본가"}?`);
                                if (ok) deleteMapping.mutate(row);
                              }}
                              disabled={deleteMapping.isPending}
                            >
                              Delete
                            </Button>
                          </div>
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

      <Card>
        <CardHeader
          title="variant 옵션 상세 매핑"
          description="원본 옵션축을 기준으로 소재, 사이즈, 색상, 장식, variant 추가금을 매핑합니다."
        />
        <CardBody className="space-y-4">
          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">선택 variant 편집</div>
                <div className="text-xs text-[var(--muted)]">
                  {focusedVariant ? `${focusedVariantCode} / ${focusedVariant.option_label || "-"}` : "variant를 선택해 편집하고 저장하세요."}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (focusedVariant) saveVariant.mutate(focusedVariant);
                }}
                disabled={!focusedVariant || saveVariant.isPending}
              >
                {saveVariant.isPending && focusedVariant ? "저장 중..." : "선택 variant 저장"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">선택 variant</div>
                <Select value={focusedVariantCode} onChange={(event) => setFocusedVariantCode(event.target.value)}>
                  <option value="">variant 선택</option>
                  {loadedVariants.map((variant) => {
                    const code = normalizeVariantCode(variant.variant_code);
                    return (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    );
                  })}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">소재</div>
                <Select
                  value={focusedDraft?.option_material_code ?? ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    const nextMaterial = event.target.value || null;
                    updateVariantOptionDraft(focusedVariantCode, (current) => {
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
                  }}
                  disabled={!focusedDraft}
                >
                  <option value="">선택 안함</option>
                  {focusedMaterialChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">사이즈</div>
                <Select
                  value={focusedDraft?.option_size_value_text ?? ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    const nextSizeText = event.target.value;
                    updateVariantOptionDraft(focusedVariantCode, (current) => ({
                      ...current,
                      option_size_value: nextSizeText ? Number(nextSizeText) : null,
                      option_size_value_text: nextSizeText,
                    }));
                  }}
                  disabled={!focusedDraft}
                >
                  <option value="">선택 안함</option>
                  {focusedSizeChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">색상</div>
                <Select
                  value={focusedDraft?.option_color_code ?? ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    updateVariantOptionDraft(focusedVariantCode, (current) => ({
                      ...current,
                      option_color_code: event.target.value || null,
                    }));
                  }}
                  disabled={!focusedDraft}
                >
                  <option value="">선택 안함</option>
                  {focusedColorChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">장식</div>
                <Select
                  value={focusedDraft?.option_decoration_code ?? ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    updateVariantOptionDraft(focusedVariantCode, (current) => ({
                      ...current,
                      option_decoration_code: event.target.value || null,
                    }));
                  }}
                  disabled={!focusedDraft}
                >
                  <option value="">선택 안함</option>
                  {focusedDecorChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">선택 variant 추가금</div>
                <Input
                  value={focusedVariantCode ? (variantDeltaByCode[focusedVariantCode] ?? "") : ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    setVariantDeltaByCode((prev) => ({ ...prev, [focusedVariantCode]: event.target.value }));
                  }}
                  placeholder="예: 3000"
                  inputMode="numeric"
                  disabled={!focusedVariantCode}
                />
                <div className="text-[11px] text-[var(--muted)]">{optionSummary(focusedExistingMapping ?? {})}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => toggleAllVariants(true)} disabled={loadedVariants.length === 0}>
              Select all
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toggleAllVariants(false)} disabled={loadedVariants.length === 0}>
              Clear all
            </Button>
            <Button size="sm" variant="secondary" onClick={selectUnmappedVariants} disabled={loadedVariants.length === 0}>
              Select unmapped
            </Button>
            <Button size="sm" onClick={() => bulkSave.mutate(selectedVariantList)} disabled={bulkSave.isPending || selectedVariantList.length === 0}>
              {bulkSave.isPending ? "저장 중..." : `일괄 저장 ${selectedVariantList.length}`}
            </Button>
            <div className="text-xs text-[var(--muted)]">
              저장된 카테고리 {savedOptionCategories.length} / allowlist 비어있음 {loadedOptionAllowlist.is_empty ? "예" : "아니오"}
            </div>
          </div>

          {loadedVariants.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-10 text-center text-sm text-[var(--muted)]">
              variant를 불러오면 옵션 매핑을 시작할 수 있습니다.
            </div>
          ) : (
            <div className="overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">선택</th>
                    <th className="px-3 py-2">variant</th>
                    <th className="px-3 py-2">상태</th>
                    {Array.from({ length: variantAxisCount }).map((_, index) => (
                      <th key={`axis-column-${index + 1}`} className="px-3 py-2">{`Axis ${index + 1}`}</th>
                    ))}
                    <th className="px-3 py-2">소재</th>
                    <th className="px-3 py-2">사이즈</th>
                    <th className="px-3 py-2">색상</th>
                    <th className="px-3 py-2">장식</th>
                    <th className="px-3 py-2">추가금</th>
                    <th className="px-3 py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
              {loadedVariants.map((variant) => {
                const variantCode = normalizeVariantCode(variant.variant_code);
                const existing = findExistingRowForVariant(variant);
                const draft = variantOptionDraftsByCode[variantCode] ?? toVariantOptionDraft(null);
                const materialChoices = withLegacyChoice(loadedOptionAllowlist.materials, draft.option_material_code);
                const colorChoices = withLegacyChoice(loadedOptionAllowlist.colors, draft.option_color_code);
                const decorChoices = withLegacyChoice(loadedOptionAllowlist.decors, draft.option_decoration_code);
                const sizeChoicesBase = loadedOptionAllowlist.sizes_by_material[draft.option_material_code ?? ""] ?? [];
                const sizeChoices = sizeChoicesBase.length > 0
                  ? withLegacyChoice(sizeChoicesBase, draft.option_size_value_text)
                  : [];

                return (
                  <tr key={variantCode} className={`border-t border-[var(--hairline)] align-top ${focusedVariantCode === variantCode ? "bg-[var(--panel)]" : ""}`}>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                          <input
                            type="checkbox"
                            checked={selectedVariants[variantCode] === true}
                            onChange={(event) => setSelectedVariants((prev) => ({ ...prev, [variantCode]: event.target.checked }))}
                          />
                          bulk
                        </label>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{variantCode}</div>
                      {variant.custom_variant_code ? <div className="text-xs text-[var(--muted)]">커스텀 {variant.custom_variant_code}</div> : null}
                      <div className="text-xs text-[var(--muted)]">{variant.option_label || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className={`inline-flex rounded-full px-2 py-0.5 ${existing ? "bg-emerald-500/15 text-emerald-700" : "bg-[var(--panel)] text-[var(--muted)]"}`}>
                        {existing ? "저장됨" : "신규"}
                      </div>
                      <div className="mt-2 text-[var(--muted)]">실몰 {formatMoney(variant.additional_amount)}</div>
                      <div className="text-[var(--muted)]">매핑 {optionSummary(existing ?? {})}</div>
                    </td>
                    {Array.from({ length: variantAxisCount }).map((_, index) => (
                      <td key={`${variantCode}-axis-${index + 1}`} className="px-3 py-2 text-xs text-[var(--foreground)]">
                        {axisCellText(variant.options[index])}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                        <Select
                          value={draft.option_material_code ?? ""}
                          onChange={(event) => {
                            const nextMaterial = event.target.value || null;
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
                          }}
                        >
                          <option value="">선택 안함</option>
                          {materialChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </Select>
                    </td>
                    <td className="px-3 py-2">
                        <Select
                          value={draft.option_size_value_text}
                          onChange={(event) => {
                            const nextSizeText = event.target.value;
                            updateVariantOptionDraft(variantCode, (current) => ({
                              ...current,
                              option_size_value: nextSizeText ? Number(nextSizeText) : null,
                              option_size_value_text: nextSizeText,
                            }));
                          }}
                        >
                          <option value="">선택 안함</option>
                          {sizeChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </Select>
                    </td>
                    <td className="px-3 py-2">
                        <Select
                          value={draft.option_color_code ?? ""}
                          onChange={(event) => updateVariantOptionDraft(variantCode, (current) => ({
                            ...current,
                            option_color_code: event.target.value || null,
                          }))}
                        >
                          <option value="">선택 안함</option>
                          {colorChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </Select>
                    </td>
                    <td className="px-3 py-2">
                        <Select
                          value={draft.option_decoration_code ?? ""}
                          onChange={(event) => updateVariantOptionDraft(variantCode, (current) => ({
                            ...current,
                            option_decoration_code: event.target.value || null,
                          }))}
                        >
                          <option value="">선택 안함</option>
                          {decorChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </Select>
                    </td>
                    <td className="px-3 py-2">
                        <Input
                          value={variantDeltaByCode[variantCode] ?? ""}
                          onChange={(event) => setVariantDeltaByCode((prev) => ({ ...prev, [variantCode]: event.target.value }))}
                          list={`delta-options-${variantCode}`}
                          placeholder="예: 3000"
                          inputMode="numeric"
                        />
                        <datalist id={`delta-options-${variantCode}`}>
                          {DELTA_OPTIONS.map((amount) => (
                            <option key={amount} value={String(amount)} />
                          ))}
                        </datalist>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setFocusedVariantCode(variantCode)}>
                          Focus
                        </Button>
                        <Button size="sm" onClick={() => saveVariant.mutate(variant)} disabled={saveVariant.isPending}>
                          {saveVariant.isPending && focusedVariantCode === variantCode ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

