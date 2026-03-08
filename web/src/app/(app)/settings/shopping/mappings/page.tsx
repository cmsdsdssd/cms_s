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
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
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
  const [syncRuleSetId, setSyncRuleSetId] = useState("");
  const [externalProductNo, setExternalProductNo] = useState("");
  const [materialMultiplierOverride, setMaterialMultiplierOverride] = useState("");
  const [sizeWeightDeltaG, setSizeWeightDeltaG] = useState("");
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

  const effectiveSyncRuleSetId = syncRuleSetId || syncRuleSets[0]?.rule_set_id || "";

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
    setSyncRuleSetId("");
    setExternalProductNo("");
    setMaterialMultiplierOverride("");
    setSizeWeightDeltaG("");
    resetVariantState();
  };

  const productCandidates = useMemo(() => {
    return Array.from(
      new Set([externalProductNo.trim(), resolvedProductNo.trim(), canonicalProductNo.trim()].filter(Boolean)),
    );
  }, [canonicalProductNo, externalProductNo, resolvedProductNo]);

  const activeProductNo = canonicalProductNo || resolvedProductNo || externalProductNo.trim();

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

  const findExistingRowForVariant = (variant: VariantCandidate): Mapping | null => {
    for (const code of candidateVariantCodes(variant)) {
      const row = editorMappingIndex.get(code);
      if (row) return row;
    }
    return null;
  };

  const visibleMappings = useMemo(() => {
    if (masterItemId.trim() || productCandidates.length > 0) return editorMappings;
    return mappings.slice(0, 80);
  }, [editorMappings, mappings, masterItemId, productCandidates.length]);

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
    const materialMultiplier = parseOptionalNumber(materialMultiplierOverride);
    const sizeWeightDelta = parseOptionalNumber(sizeWeightDeltaG);
    const optionSizeValue = parseOptionalNumber(draft.option_size_value_text);
    const optionPriceMode: "SYNC" | "MANUAL" = existing?.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC";
    const syncRuleSet = optionPriceMode === "SYNC" ? effectiveSyncRuleSetId || existing?.sync_rule_set_id || "" : "";

    if (!effectiveChannelId) throw new Error("channel_id is required");
    if (!masterItemId.trim()) throw new Error("master_item_id is required");
    if (!activeProductNo) throw new Error("external_product_no is required");
    if (!variantCode) throw new Error("external_variant_code is required");
    if (materialMultiplier != null && materialMultiplier <= 0) throw new Error("material_multiplier_override must be > 0");
    if (sizeWeightDelta != null && (sizeWeightDelta < -100 || sizeWeightDelta > 100)) throw new Error("size_weight_delta_g must be between -100 and 100");
    if (delta != null && (!Number.isInteger(delta) || delta % 1000 !== 0)) throw new Error("option_price_delta_krw must be 1000 KRW step");
    if (optionPriceMode === "SYNC" && !syncRuleSet) throw new Error("sync_rule_set_id is required for SYNC mode");

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
      material_multiplier_override: materialMultiplier,
      size_weight_delta_g: sizeWeightDelta,
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
      toast.success(`Saved ${variantCode}`);
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
      toast.success(`Bulk saved ${response.saved} rows.`);
      await queryClient.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
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
    setSyncRuleSetId(row.sync_rule_set_id ?? "");
    setExternalProductNo(row.external_product_no);
    setMaterialMultiplierOverride(row.material_multiplier_override != null ? String(row.material_multiplier_override) : "");
    setSizeWeightDeltaG(row.size_weight_delta_g != null ? String(row.size_weight_delta_g) : "");
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
    ? withLegacyChoice(
        loadedOptionAllowlist.sizes_by_material[focusedDraft.option_material_code ?? ""] ?? [],
        focusedDraft.option_size_value_text,
      )
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
        title="Shopping Mappings"
        subtitle="Load channel variants, infer option details from settings, and save per variant or in bulk."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => requestVariantLoad()}
              disabled={loadVariants.isPending || !effectiveChannelId || !masterItemId.trim() || !externalProductNo.trim()}
            >
              {loadVariants.isPending ? "Loading..." : "Load variants"}
            </Button>
            <Button size="sm" variant="secondary" onClick={resetEditor}>
              Reset editor
            </Button>
          </>
        }
      />

      <ShoppingPageHeader
        purpose="This page restores the settings-driven option detail mapping workflow for channel products and variants."
        status={[
          { label: "Channel", value: activeChannelName, tone: effectiveChannelId ? "good" : "warn" },
          { label: "Mappings", value: `${mappings.length}`, tone: mappings.length > 0 ? "good" : "neutral" },
          { label: "Loaded variants", value: `${loadedVariants.length}`, tone: loadedVariants.length > 0 ? "good" : "neutral" },
        ]}
        nextActions={[
          { label: "Option rules", href: "/settings/shopping/rules" },
          { label: "Auto price", href: "/settings/shopping/auto-price" },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Editor" description={editingRowId ? `Editing ${editingRowId}` : "Choose channel, master, and product."} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">Channel</div>
                <Select
                  value={effectiveChannelId}
                  onChange={(event) => {
                    setChannelId(event.target.value);
                    resetEditor();
                  }}
                >
                  <option value="">Select channel</option>
                  {channels.map((channel) => (
                    <option key={channel.channel_id} value={channel.channel_id}>
                      {channel.channel_name} ({channel.channel_code})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">Sync rule set</div>
                <Select value={syncRuleSetId} onChange={(event) => setSyncRuleSetId(event.target.value)}>
                  <option value="">Use default active rule set</option>
                  {syncRuleSets.map((ruleSet) => (
                    <option key={ruleSet.rule_set_id} value={ruleSet.rule_set_id}>
                      {ruleSet.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_0.9fr_0.8fr]">
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">Master search</div>
                <Input value={masterQuery} onChange={(event) => setMasterQuery(event.target.value)} placeholder="Search model name" />
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
                <div className="text-xs text-[var(--muted)]">Master item id</div>
                <Input value={masterItemId} onChange={(event) => setMasterItemId(event.target.value)} placeholder="master_item_id" />
                <div className="text-xs text-[var(--muted)]">{masterLabel || "Choose from search or enter directly."}</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">External product no</div>
                <Input
                  value={externalProductNo}
                  onChange={(event) => setExternalProductNo(event.target.value)}
                  placeholder="external_product_no"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">Material multiplier override</div>
                <Input
                  value={materialMultiplierOverride}
                  onChange={(event) => setMaterialMultiplierOverride(event.target.value)}
                  placeholder="Example 1.05"
                  inputMode="decimal"
                  autoFormat={false}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-[var(--muted)]">Size weight delta g</div>
                <Input
                  value={sizeWeightDeltaG}
                  onChange={(event) => setSizeWeightDeltaG(event.target.value)}
                  placeholder="-100 to 100"
                  inputMode="decimal"
                  autoFormat={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3 text-sm md:grid-cols-4">
              <div>
                <div className="text-[11px] text-[var(--muted)]">Requested</div>
                <div>{externalProductNo.trim() || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">Resolved</div>
                <div>{resolvedProductNo || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">Canonical</div>
                <div>{canonicalProductNo || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)]">Settings</div>
                <div>
                  {loadedOptionAllowlist.materials.length} materials / {loadedOptionAllowlist.colors.length} colors / {loadedOptionAllowlist.decors.length} decors
                </div>
              </div>
            </div>

            {(channelsQuery.error || mappingsQuery.error || syncRuleSetsQuery.error) ? (
              <div className="rounded-[var(--radius)] border border-red-300 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {describeError(channelsQuery.error ?? mappingsQuery.error ?? syncRuleSetsQuery.error)}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Existing mappings"
            description={masterItemId.trim() || productCandidates.length > 0 ? "Filtered to current editor context." : "Showing latest rows."}
          />
          <CardBody className="space-y-3">
            <div className="text-xs text-[var(--muted)]">Showing {visibleMappings.length} of {mappings.length}</div>

            {visibleMappings.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-8 text-center text-sm text-[var(--muted)]">
                No mappings to show.
              </div>
            ) : (
              <div className="max-h-[36rem] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--panel)] text-left">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Master</th>
                      <th className="px-3 py-2">Details</th>
                      <th className="px-3 py-2">Delta</th>
                      <th className="px-3 py-2">Updated</th>
                      <th className="px-3 py-2">Actions</th>
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
                          <div className="text-xs text-[var(--muted)]">{row.external_variant_code || "BASE"}</div>
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
                                const ok = window.confirm(`Delete mapping ${row.external_product_no} / ${row.external_variant_code || "BASE"}?`);
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
          title="Variant option detail mapping"
          description="Original axes are shown first, then settings-driven material, size, color, decor, and per-variant delta fields."
        />
        <CardBody className="space-y-4">
          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Focused variant manual controls</div>
                <div className="text-xs text-[var(--muted)]">
                  {focusedVariant ? `${focusedVariantCode} / ${focusedVariant.option_label || "-"}` : "Focus a variant row to edit and save from the top form."}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (focusedVariant) saveVariant.mutate(focusedVariant);
                }}
                disabled={!focusedVariant || saveVariant.isPending}
              >
                {saveVariant.isPending && focusedVariant ? "Saving..." : "Save focused variant"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">Focused variant</div>
                <Select value={focusedVariantCode} onChange={(event) => setFocusedVariantCode(event.target.value)}>
                  <option value="">Choose variant</option>
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
                <div className="text-[11px] text-[var(--muted)]">Material</div>
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
                  <option value="">None</option>
                  {focusedMaterialChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">Size</div>
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
                  <option value="">None</option>
                  {focusedSizeChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">Color</div>
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
                  <option value="">None</option>
                  {focusedColorChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">Decor</div>
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
                  <option value="">None</option>
                  {focusedDecorChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[var(--muted)]">Focused delta / saved</div>
                <Input
                  value={focusedVariantCode ? (variantDeltaByCode[focusedVariantCode] ?? "") : ""}
                  onChange={(event) => {
                    if (!focusedVariantCode) return;
                    setVariantDeltaByCode((prev) => ({ ...prev, [focusedVariantCode]: event.target.value }));
                  }}
                  placeholder="Example 3000"
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
              {bulkSave.isPending ? "Saving..." : `Bulk save ${selectedVariantList.length}`}
            </Button>
            <div className="text-xs text-[var(--muted)]">
              saved categories {savedOptionCategories.length} / allowlist empty {loadedOptionAllowlist.is_empty ? "yes" : "no"}
            </div>
          </div>

          {loadedVariants.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] px-3 py-10 text-center text-sm text-[var(--muted)]">
              Load variants to start mapping option details.
            </div>
          ) : (
            <div className="overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Variant</th>
                    <th className="px-3 py-2">Status</th>
                    {Array.from({ length: variantAxisCount }).map((_, index) => (
                      <th key={`axis-column-${index + 1}`} className="px-3 py-2">{`Axis ${index + 1}`}</th>
                    ))}
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Color</th>
                    <th className="px-3 py-2">Decor</th>
                    <th className="px-3 py-2">Delta</th>
                    <th className="px-3 py-2">Actions</th>
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
                const sizeChoices = withLegacyChoice(
                  loadedOptionAllowlist.sizes_by_material[draft.option_material_code ?? ""] ?? [],
                  draft.option_size_value_text,
                );

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
                      {variant.custom_variant_code ? <div className="text-xs text-[var(--muted)]">custom {variant.custom_variant_code}</div> : null}
                      <div className="text-xs text-[var(--muted)]">{variant.option_label || "-"}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className={`inline-flex rounded-full px-2 py-0.5 ${existing ? "bg-emerald-500/15 text-emerald-700" : "bg-[var(--panel)] text-[var(--muted)]"}`}>
                        {existing ? "saved" : "new"}
                      </div>
                      <div className="mt-2 text-[var(--muted)]">cafe24 {formatMoney(variant.additional_amount)}</div>
                      <div className="text-[var(--muted)]">mapped {optionSummary(existing ?? {})}</div>
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
                          <option value="">None</option>
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
                          <option value="">None</option>
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
                          <option value="">None</option>
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
                          <option value="">None</option>
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
                          placeholder="Example 3000"
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
                          {saveVariant.isPending && focusedVariantCode === variantCode ? "Saving..." : "Save"}
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

