import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingSchemaObjectError, jsonError } from "@/lib/shop/admin";
import {
  buildCanonicalOptionRows,
  buildMappingOptionAllowlist,
  buildObservedOptionValuePool,
  mappingOptionEntryKey,
  resolveCanonicalExternalProductNo,
  type SavedOptionCategoryRowWithDelta,
  type MappingOptionAllowlist,
} from "@/lib/shop/mapping-option-details";
import { buildMaterialFactorMap, normalizeMaterialCode } from "@/lib/material-factors";
import { resolveCanonicalProductNo } from "@/lib/shop/canonical-mapping";
import { loadEffectiveMarketTicks } from "@/lib/shop/effective-market-ticks.js";
import { createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope, rebuildAndLoadPersistedSizeGridForScope } from "@/lib/shop/weight-grid-store.js";
import { buildPlatingComboChoices, normalizePlatingCatalogComboKey } from "@/lib/shop/sync-rules";
import {
  cafe24ListProductVariants,
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const normalizeSavedCategoryKey = (value: unknown): SavedOptionCategoryRowWithDelta["category_key"] => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MATERIAL" || normalized === "SIZE" || normalized === "COLOR_PLATING" || normalized === "DECOR" || normalized === "NOTICE") {
    return normalized;
  }
  return "OTHER";
};

const parseSavedCategoryKey = (value: unknown): SavedOptionCategoryRowWithDelta["category_key"] | null => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MATERIAL" || normalized === "SIZE" || normalized === "COLOR_PLATING" || normalized === "DECOR" || normalized === "OTHER" || normalized === "NOTICE") {
    return normalized;
  }
  return null;
};

const toRoundedOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeProductNoCandidates = (values: Array<unknown>): string[] => {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
};

const pickPreferredGridProductNo = (values: Array<unknown>): string | null => {
  const normalized = normalizeProductNoCandidates(values);
  return normalized.find((value) => /^P/i.test(value)) ?? normalized[0] ?? null;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const externalProductNo = String(searchParams.get("external_product_no") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("채널 계정이 없습니다", 422);

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "카페24 토큰 확인 실패", 422);
  }

  let result = await cafe24ListProductVariants(account, accessToken, externalProductNo);
  if (!result.ok && result.status === 401) {
    try {
      accessToken = await ensureValidCafe24AccessToken(sb, account);
      result = await cafe24ListProductVariants(account, accessToken, externalProductNo);
    } catch {
      // keep original 401 result
    }
  }

  if (!result.ok) {
    return jsonError(result.error ?? "옵션 목록 조회 실패", result.status || 502, {
      error_code: `HTTP_${result.status || 502}`,
    });
  }

  const rows = result.variants.map((v) => ({
    variant_code: v.variantCode,
    custom_variant_code: v.customVariantCode,
    options: v.options,
    option_label: v.options.map((o) => `${o.name}:${o.value}`).join(" / "),
    additional_amount: v.additionalAmount,
  }));

  const resolvedProductNo = result.resolvedProductNo ?? externalProductNo;
  let canonicalExternalProductNo = resolvedProductNo;
  let optionDetailAllowlist: MappingOptionAllowlist = buildMappingOptionAllowlist([]);
  let savedOptionCategories: Array<{ option_name: string; option_value: string; category_key: string }> = [];
  let canonicalOptionRows: ReturnType<typeof buildCanonicalOptionRows> = [];
  let masterMaterialCode: string | null = null;
  let persistedSizeLookup: unknown = null;
  let colorBaseDeltaByCode: Record<string, number> = {};
  let sizeMarketContext: {
    goldTickKrwPerG?: number | null;
    silverTickKrwPerG?: number | null;
    materialFactors?: Record<string, unknown> | null;
  } | null = null;

  if (masterItemId) {
    const [activeProductRes, optionRuleRes, categoryRes, masterRes, otherReasonLogRes, materialFactorRes, effectiveTicks, colorComboRes] = await Promise.all([
      sb
        .from("sales_channel_product")
        .select("external_product_no, external_variant_code, option_material_code, option_color_code, option_decoration_code, option_size_value")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false }),
      sb
        .from("channel_option_labor_rule_v1")
        .select("rule_id, channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, size_price_mode, formula_multiplier, formula_offset_krw, rounding_unit_krw, rounding_mode, fixed_delta_krw, plating_enabled, color_code, decoration_master_id, decoration_model_name, base_labor_cost_krw, additive_delta_krw, is_active, note")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .eq("is_active", true),
      sb
        .from("channel_option_category_v2")
        .select("external_product_no, option_name, option_value, category_key, sync_delta_krw, updated_at")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .order("updated_at", { ascending: false })
        .order("option_name", { ascending: true })
        .order("option_value", { ascending: true }),
      sb
        .from("cms_master_item")
        .select("master_item_id, material_code_default")
        .eq("master_item_id", masterItemId)
        .limit(1)
        .maybeSingle(),
      sb
        .from("channel_option_value_policy_log")
        .select("axis_key, axis_value, new_row, created_at")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .in("axis_key", ["OTHER_REASON", "OPTION_CATEGORY", "OPTION_AXIS_SELECTION"])
        .order("created_at", { ascending: false })
        .limit(5000),
      sb
        .from("cms_material_factor_config")
        .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis"),
      loadEffectiveMarketTicks(sb),
      sb
        .from("channel_color_combo_catalog_v1")
        .select("combo_key, display_name, base_delta_krw, sort_order")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .limit(5000),
    ]);

    if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);
    if (optionRuleRes.error) return jsonError(optionRuleRes.error.message ?? "옵션 상세 규칙 조회 실패", 500);
    if (categoryRes.error) return jsonError(categoryRes.error.message ?? "옵션 카테고리 조회 실패", 500);
    if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 소재 조회 실패", 500);
    if (otherReasonLogRes.error) return jsonError(otherReasonLogRes.error.message ?? "기타 사유 로그 조회 실패", 500);
    if (materialFactorRes.error) return jsonError(materialFactorRes.error.message ?? "소재 팩터 조회 실패", 500);
    if (colorComboRes.error && !isMissingSchemaObjectError(colorComboRes.error, "channel_color_combo_catalog_v1")) {
      return jsonError(colorComboRes.error.message ?? "색상 중앙금액 조회 실패", 500);
    }
    const activeRows = (activeProductRes.data ?? []) as Array<{
      external_product_no?: string | null;
      external_variant_code?: string | null;
      option_material_code?: string | null;
      option_color_code?: string | null;
      option_decoration_code?: string | null;
      option_size_value?: number | null;
    }>;
    const preferredProductNos = normalizeProductNoCandidates([externalProductNo, resolvedProductNo]);
    const activeCanonicalProductNo = resolveCanonicalProductNo(
      activeRows.map((row) => String(row.external_product_no ?? "").trim()),
      String(resolvedProductNo ?? externalProductNo ?? "").trim(),
    );
    const hasCentralRowsForProductNo = (productNo: string) => {
      if (!productNo) return false;
      return (categoryRes.data ?? []).some((row) => String(row.external_product_no ?? "").trim() === productNo)
        || (optionRuleRes.data ?? []).some((row) => String(row.external_product_no ?? "").trim() === productNo);
    };
    const scopedCentralProductNo = preferredProductNos.find((productNo) => hasCentralRowsForProductNo(productNo)) ?? "";
    canonicalExternalProductNo = activeCanonicalProductNo
      || scopedCentralProductNo
      || resolveCanonicalExternalProductNo(
        (activeProductRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim()),
        String(resolvedProductNo ?? externalProductNo ?? "").trim(),
      );
    // Option labor rules (SIZE/COLOR/DECOR/OTHER) are managed per master_item_id and shared
    // across all product_nos. Do NOT filter by external_product_no here - a rule registered
    // under any product_no for this master item should apply to all product variants.
    const filteredRuleRows = optionRuleRes.data ?? [];
    const validOptionValuesByName = new Map<string, Set<string>>();
    for (const variant of result.variants ?? []) {
      for (const option of variant.options ?? []) {
        const optionName = String(option?.name ?? "").trim();
        const optionValue = String(option?.value ?? "").trim();
        if (!optionName || !optionValue) continue;
        const bucket = validOptionValuesByName.get(optionName) ?? new Set<string>();
        bucket.add(optionValue);
        validOptionValuesByName.set(optionName, bucket);
      }
    }
    const categoryProductNosForRead = new Set(
      normalizeProductNoCandidates([
        canonicalExternalProductNo,
        activeCanonicalProductNo,
        scopedCentralProductNo,
        externalProductNo,
        resolvedProductNo,
      ]),
    );
    const preferredCategoryRows = (() => {
      const allRows = (categoryRes.data ?? []) as Array<{
        external_product_no?: string | null;
        option_name?: string | null;
        option_value?: string | null;
        category_key?: string | null;
        sync_delta_krw?: number | null;
        updated_at?: string | null;
      }>;
      const canonicalRows = allRows.filter((row) => String(row.external_product_no ?? "").trim() === canonicalExternalProductNo);
      const scopedRows = canonicalRows.length > 0
        ? canonicalRows
        : allRows.filter((row) => categoryProductNosForRead.has(String(row.external_product_no ?? "").trim()));
      return scopedRows
        .slice()
        .sort((left, right) => {
          const leftNo = String(left.external_product_no ?? "").trim();
          const rightNo = String(right.external_product_no ?? "").trim();
          if (leftNo === canonicalExternalProductNo && rightNo !== canonicalExternalProductNo) return -1;
          if (rightNo === canonicalExternalProductNo && leftNo !== canonicalExternalProductNo) return 1;
          return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
        });
    })();
    const filteredSavedOptionCategories = preferredCategoryRows
      .map((row) => ({
        external_product_no: String(row.external_product_no ?? "").trim(),
        option_name: String(row.option_name ?? "").trim(),
        option_value: String(row.option_value ?? "").trim(),
        category_key: normalizeSavedCategoryKey(row.category_key),
        sync_delta_krw: row.sync_delta_krw == null ? null : Math.round(Number(row.sync_delta_krw)),
      }))
      .filter((row) => {
        if (row.option_name.length === 0 || row.option_value.length === 0) return false;
        const allowedValues = validOptionValuesByName.get(row.option_name);
        return Boolean(allowedValues && allowedValues.has(row.option_value));
      })
      .reduce<Array<{
        external_product_no: string;
        option_name: string;
        option_value: string;
        category_key: SavedOptionCategoryRowWithDelta["category_key"];
        sync_delta_krw: number | null;
      }>>((acc, row) => {
        if (acc.some((existing) => existing.option_name === row.option_name && existing.option_value === row.option_value)) return acc;
        acc.push(row);
        return acc;
      }, [])
      .map(({ external_product_no: _externalProductNo, ...row }) => row);
    masterMaterialCode = normalizeMaterialCode(String(masterRes.data?.material_code_default ?? "").trim()) || null;
    colorBaseDeltaByCode = Object.fromEntries(
      buildPlatingComboChoices({
        catalogRows: (colorComboRes.data ?? []) as Array<{ combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null; sort_order?: number | null }>,
        includeStandard: false,
      }).map((choice) => [
        normalizePlatingCatalogComboKey(choice.value),
        Math.max(0, Math.round(Number(choice.delta_krw ?? 0))),
      ]),
    );
    sizeMarketContext = {
      goldTickKrwPerG: Math.round(Number(effectiveTicks.goldTickKrwPerG ?? 0)),
      silverTickKrwPerG: Math.round(Number(effectiveTicks.silverTickKrwPerG ?? 0)),
      materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
    };
    const activeSizeRuleRows = ((optionRuleRes.data ?? []) as Array<{ category_key?: string | null; is_active?: boolean | null }>)
      .filter((row) => row.is_active !== false && String(row.category_key ?? "").trim().toUpperCase() === "SIZE");
    try {
      const preferredGridProductNos = Array.from(new Set([
        canonicalExternalProductNo,
        pickPreferredGridProductNo((activeProductRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim())),
      ].filter(Boolean)));
      for (const gridProductNo of preferredGridProductNos) {
        const persistedSizeRows = await loadPersistedSizeGridRowsForScope({
          sb,
          channelId,
          masterItemId,
          externalProductNo: gridProductNo,
        });
        if ((persistedSizeRows?.length ?? 0) > 0) {
          persistedSizeLookup = createPersistedSizeGridLookup(persistedSizeRows);
          break;
        }
        if (activeSizeRuleRows.length === 0) continue;
        persistedSizeLookup = await rebuildAndLoadPersistedSizeGridForScope({
          sb,
          channelId,
          masterItemId,
          externalProductNo: gridProductNo,
          rules: optionRuleRes.data ?? [],
          marketContext: sizeMarketContext,
        });
        if (persistedSizeLookup) break;
      }
    } catch {
      persistedSizeLookup = null;
    }

    const observedOptionValues = buildObservedOptionValuePool({
      variants: result.variants.map((variant) => ({
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
      })),
      savedOptionCategories: filteredSavedOptionCategories,
    });
    const baseAllowlist = buildMappingOptionAllowlist(filteredRuleRows, {
      masterItemId,
      externalProductNo: canonicalExternalProductNo,
      persistedSizeLookup,
      sizeMarketContext,
      observedOptionValues,
    });
    const mergedColorChoices = buildPlatingComboChoices({
      catalogRows: (colorComboRes.data ?? []) as Array<{ combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null; sort_order?: number | null }>,
      fallbackValues: [
        ...(baseAllowlist.colors ?? []).map((choice) => String(choice.value ?? "").trim()),
        ...activeRows.map((row) => String(row.option_color_code ?? "").trim()),
      ],
      includeStandard: true,
    }).map((choice) => ({
      value: choice.value,
      label: choice.label,
      delta_krw: choice.delta_krw,
    }));
    const mergedDecorChoices = new Map(
      (baseAllowlist.decors ?? []).map((choice) => [String(choice.decoration_master_id ?? choice.value ?? "").trim(), choice] as const),
    );
    for (const row of filteredRuleRows) {
      if (String(row.category_key ?? "").trim().toUpperCase() !== "DECOR") continue;
      const masterId = String(row.decoration_master_id ?? "").trim();
      const label = String(row.decoration_model_name ?? "").trim();
      const value = label.toUpperCase();
      const key = masterId || value;
      if (!key || !label || mergedDecorChoices.has(key)) continue;
      mergedDecorChoices.set(key, {
        value,
        label,
        decoration_master_id: masterId || null,
        decoration_model_name: label,
        delta_krw: Math.round(Number(row.base_labor_cost_krw ?? 0)) + Math.round(Number(row.additive_delta_krw ?? 0)),
      });
    }
    optionDetailAllowlist = {
      ...baseAllowlist,
      colors: mergedColorChoices,
      decors: Array.from(mergedDecorChoices.values()).sort((left, right) => String(left.label ?? "").localeCompare(String(right.label ?? ""))),
      sizes_by_material: baseAllowlist.sizes_by_material ?? {},
    };
    optionDetailAllowlist = {
      ...optionDetailAllowlist,
      is_empty:
        optionDetailAllowlist.materials.length === 0
        && optionDetailAllowlist.colors.length === 0
        && optionDetailAllowlist.decors.length === 0
        && Object.values(optionDetailAllowlist.sizes_by_material ?? {}).every((choices) => (choices?.length ?? 0) === 0),
    };
    const otherReasonByEntryKey: Record<string, string> = {};
    const categoryOverrideByEntryKey: Record<string, SavedOptionCategoryRowWithDelta["category_key"]> = {};
    const axisSelectionByEntryKey: Record<string, {
      axis1_value?: string | null;
      axis2_value?: string | null;
      axis3_value?: string | null;
      decor_master_item_id?: string | null;
      decor_extra_delta_krw?: number | null;
      decor_final_amount_krw?: number | null;
    }> = {};
    const otherReasonRankByEntryKey: Record<string, number> = {};
    const categoryOverrideRankByEntryKey: Record<string, number> = {};
    const axisSelectionRankByEntryKey: Record<string, number> = {};
    const savedCategoryEntryKeys = new Set(
      filteredSavedOptionCategories
        .map((row) => mappingOptionEntryKey(row.option_name, row.option_value))
        .filter(Boolean),
    );
    const validEntryKeys = new Set(
      (result.variants ?? []).flatMap((variant) =>
        (variant.options ?? []).map((option) => mappingOptionEntryKey(String(option?.name ?? "").trim(), String(option?.value ?? "").trim())),
      ).filter(Boolean),
    );
    const axisPrefixes = Array.from(categoryProductNosForRead)
      .filter(Boolean)
      .sort((left, right) => {
        if (left === canonicalExternalProductNo) return -1;
        if (right === canonicalExternalProductNo) return 1;
        return left.localeCompare(right);
      })
      .map((productNo) => `${productNo}::`);
    const axisPrefixRank = new Map(axisPrefixes.map((prefix, index) => [prefix, index]));
    for (const row of (otherReasonLogRes.data ?? []) as Array<{ axis_key?: string | null; axis_value: string | null; new_row: unknown }>) {
      const axisValue = String(row.axis_value ?? "").trim();
      const matchedPrefix = axisPrefixes.find((prefix) => axisValue.startsWith(prefix));
      if (!matchedPrefix) continue;
      const prefixRank = axisPrefixRank.get(matchedPrefix) ?? Number.MAX_SAFE_INTEGER;
      const entryKey = axisValue.slice(matchedPrefix.length).trim();
      if (!entryKey || !validEntryKeys.has(entryKey)) continue;
      const axisKey = String(row.axis_key ?? "").trim().toUpperCase();
      const nextRow = row.new_row && typeof row.new_row === "object" ? (row.new_row as Record<string, unknown>) : null;
      if (axisKey === "OTHER_REASON") {
        const currentRank = otherReasonRankByEntryKey[entryKey];
        if (currentRank != null && currentRank <= prefixRank) continue;
        const reason = String(nextRow?.other_reason ?? "").trim();
        if (reason) {
          otherReasonByEntryKey[entryKey] = reason;
          otherReasonRankByEntryKey[entryKey] = prefixRank;
        }
        continue;
      }
      if (axisKey === "OPTION_CATEGORY") {
        if (savedCategoryEntryKeys.has(entryKey)) continue;
        const currentRank = categoryOverrideRankByEntryKey[entryKey];
        if (currentRank != null && currentRank <= prefixRank) continue;
        const categoryKey = parseSavedCategoryKey(nextRow?.category_key);
        if (categoryKey) {
          categoryOverrideByEntryKey[entryKey] = categoryKey;
          categoryOverrideRankByEntryKey[entryKey] = prefixRank;
        }
        continue;
      }
      if (axisKey === "OPTION_AXIS_SELECTION") {
        const currentRank = axisSelectionRankByEntryKey[entryKey];
        if (currentRank != null && currentRank <= prefixRank) continue;
        axisSelectionByEntryKey[entryKey] = {
          axis1_value: String(nextRow?.axis1_value ?? "").trim() || null,
          axis2_value: String(nextRow?.axis2_value ?? "").trim() || null,
          axis3_value: String(nextRow?.axis3_value ?? "").trim() || null,
          decor_master_item_id: String(nextRow?.decor_master_item_id ?? "").trim() || null,
          decor_extra_delta_krw: toRoundedOrNull(nextRow?.decor_extra_delta_krw),
          decor_final_amount_krw: toRoundedOrNull(nextRow?.decor_final_amount_krw),
        };
        axisSelectionRankByEntryKey[entryKey] = prefixRank;
      }
    }
    const savedCategoryByEntryKey = new Map(
      filteredSavedOptionCategories
        .map((row) => [mappingOptionEntryKey(row.option_name, row.option_value), row.category_key] as const)
        .filter(([entryKey]) => entryKey.length > 0 && validEntryKeys.has(entryKey)),
    );
    const mappingByVariantCode = new Map<string, typeof activeRows[number]>();
    for (const row of activeRows) {
      const productNo = String(row.external_product_no ?? "").trim();
      const variantCode = String(row.external_variant_code ?? "").trim();
      if (!variantCode || (productNo && productNo !== canonicalExternalProductNo)) continue;
      if (!mappingByVariantCode.has(variantCode)) mappingByVariantCode.set(variantCode, row);
    }
    const inferredSelectionByEntryKey = new Map<string, {
      materialCode: string | null;
      colorCode: string | null;
      sizeValue: string | null;
      decorCode: string | null;
    }>();
    for (const variant of result.variants ?? []) {
      const mapping = mappingByVariantCode.get(String(variant.variantCode ?? "").trim());
      if (!mapping) continue;
      for (const option of variant.options ?? []) {
        const inferredKey = mappingOptionEntryKey(String(option?.name ?? "").trim(), String(option?.value ?? "").trim());
        if (!inferredKey || !validEntryKeys.has(inferredKey) || inferredSelectionByEntryKey.has(inferredKey)) continue;
        inferredSelectionByEntryKey.set(inferredKey, {
          materialCode: normalizeMaterialCode(String(mapping.option_material_code ?? "").trim()) || null,
          colorCode: String(mapping.option_color_code ?? "").trim() || null,
          sizeValue: Number.isFinite(Number(mapping.option_size_value)) ? Number(mapping.option_size_value).toFixed(2) : null,
          decorCode: String(mapping.option_decoration_code ?? "").trim() || null,
        });
      }
    }
    for (const entryKey of validEntryKeys) {
      const inferred = inferredSelectionByEntryKey.get(entryKey);
      if (!inferred) continue;
      const categoryKey = categoryOverrideByEntryKey[entryKey] ?? savedCategoryByEntryKey.get(entryKey) ?? null;
      const current = axisSelectionByEntryKey[entryKey] ?? {};
      if (categoryKey === "SIZE") {
        axisSelectionByEntryKey[entryKey] = {
          ...current,
          axis1_value: inferred.materialCode || String(current.axis1_value ?? "").trim() || null,
          axis2_value: inferred.sizeValue || String(current.axis2_value ?? "").trim() || null,
        };
        continue;
      }
      if (categoryKey === "COLOR_PLATING") {
        axisSelectionByEntryKey[entryKey] = {
          ...current,
          axis1_value: inferred.materialCode || String(current.axis1_value ?? "").trim() || null,
          axis2_value: inferred.colorCode || String(current.axis2_value ?? "").trim() || null,
        };
        continue;
      }
      if (categoryKey === "DECOR") {
        axisSelectionByEntryKey[entryKey] = {
          ...current,
          axis1_value: inferred.materialCode || String(current.axis1_value ?? "").trim() || null,
          axis2_value: inferred.decorCode || String(current.axis2_value ?? "").trim() || null,
        };
      }
    }
    const fallbackMaterialCode = String(masterRes.data?.material_code_default ?? "").trim();
    const allowedMaterialCodes = new Set(
      optionDetailAllowlist.materials
        .map((choice) => String(choice.value ?? "").trim())
        .filter(Boolean),
    );
    const allowedColorCodesByMaterial = new Map<string, Set<string>>();
    const globallyAllowedColorCodes = new Set(
      optionDetailAllowlist.colors
        .map((choice) => String(choice.value ?? "").trim())
        .filter(Boolean),
    );
    for (const row of filteredRuleRows) {
      if (String(row.category_key ?? "").trim().toUpperCase() !== "COLOR_PLATING") continue;
      const materialCode = String(row.scope_material_code ?? "").trim();
      const colorCode = String(row.color_code ?? "").trim();
      if (!materialCode || !colorCode) continue;
      const bucket = allowedColorCodesByMaterial.get(materialCode) ?? new Set<string>();
      bucket.add(colorCode);
      allowedColorCodesByMaterial.set(materialCode, bucket);
    }
    for (const [entryKey, selection] of Object.entries(axisSelectionByEntryKey)) {
      const categoryKey = categoryOverrideByEntryKey[entryKey] ?? savedCategoryByEntryKey.get(entryKey) ?? null;
      const selectedMaterialCode = String(selection.axis1_value ?? "").trim();
      if ((categoryKey === "SIZE" || categoryKey === "COLOR_PLATING" || categoryKey === "OTHER") && selectedMaterialCode && !allowedMaterialCodes.has(selectedMaterialCode)) {
        selection.axis1_value = null;
      }
      const effectiveMaterialCode = String(selection.axis1_value ?? fallbackMaterialCode).trim();
      const selectedAxis2Value = String(selection.axis2_value ?? "").trim();
      if (categoryKey === "SIZE" && selectedAxis2Value) {
        const allowedSizeValues = new Set(
          (optionDetailAllowlist.sizes_by_material[effectiveMaterialCode] ?? [])
            .map((choice) => String(choice.value ?? "").trim())
            .filter(Boolean),
        );
        if (effectiveMaterialCode && !allowedSizeValues.has(selectedAxis2Value)) {
          selection.axis2_value = null;
          selection.axis3_value = null;
        }
      }
      if (categoryKey === "COLOR_PLATING" && selectedAxis2Value) {
        const allowedColors = allowedColorCodesByMaterial.get(effectiveMaterialCode);
        const isAllowed = allowedColors
          ? allowedColors.has(selectedAxis2Value)
          : globallyAllowedColorCodes.has(selectedAxis2Value);
        if (effectiveMaterialCode && !isAllowed) {
          selection.axis2_value = null;
          selection.axis3_value = null;
        }
      }
    }
    savedOptionCategories = filteredSavedOptionCategories;
    canonicalOptionRows = buildCanonicalOptionRows({
      masterItemId,
      externalProductNo: canonicalExternalProductNo,
      persistedSizeLookup,
      sizeMarketContext,
      variants: result.variants.map((variant) => ({
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
      })),
      savedOptionCategories: filteredSavedOptionCategories,
      rules: filteredRuleRows,
      masterMaterialCode: masterMaterialCode,
      masterMaterialLabel: masterMaterialCode,
      otherReasonByEntryKey,
      categoryOverrideByEntryKey,
      axisSelectionByEntryKey,
      colorBaseDeltaByCode,
    });
    for (const row of canonicalOptionRows) {
      if (String(row.category_key ?? "").trim().toUpperCase() !== "SIZE") continue;
      const inferred = inferredSelectionByEntryKey.get(String(row.entry_key ?? "").trim());
      const inferredSizeValue = Number(inferred?.sizeValue ?? Number.NaN);
      if (!Number.isFinite(inferredSizeValue) || inferredSizeValue <= 0) continue;
      const currentSizeValue = Number(row.size_weight_g_selected ?? Number.NaN);
      if (Number.isFinite(currentSizeValue) && currentSizeValue > 0) continue;
      row.size_weight_g_selected = Number(inferredSizeValue.toFixed(2));
      const materialCode = String(row.material_code_resolved ?? inferred?.materialCode ?? masterMaterialCode ?? "").trim();
      const normalizedWeight = inferredSizeValue.toFixed(2);
      const resolvedChoice = (optionDetailAllowlist.sizes_by_material?.[materialCode] ?? [])
        .find((choice) => String(choice.value ?? "").trim() === normalizedWeight);
      if (resolvedChoice && Number.isFinite(Number(resolvedChoice.delta_krw ?? Number.NaN))) {
        row.resolved_delta_krw = Math.round(Number(resolvedChoice.delta_krw));
      }
    }
  }

  return NextResponse.json(
    {
      data: {
        channel_id: channelId,
        requested_product_no: externalProductNo,
        resolved_product_no: resolvedProductNo,
        total: rows.length,
        variants: rows,
        option_detail_allowlist: optionDetailAllowlist,
        saved_option_categories: savedOptionCategories,
        canonical_option_rows: canonicalOptionRows,
        canonical_external_product_no: canonicalExternalProductNo,
        master_material_code: masterMaterialCode,
        size_market_context: sizeMarketContext,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
