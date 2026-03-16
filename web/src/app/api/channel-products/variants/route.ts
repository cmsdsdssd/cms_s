import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingSchemaObjectError, jsonError } from "@/lib/shop/admin";
import {
  buildCanonicalOptionRows,
  buildMappingOptionAllowlist,
  buildObservedOptionValuePool,
  deriveRuleOnlyCanonicalInputs,
  mappingOptionEntryKey,
  resolveCanonicalExternalProductNo,
  type SavedOptionCategoryRowWithDelta,
  type MappingOptionAllowlist,
} from "@/lib/shop/mapping-option-details";
import { buildMaterialFactorMap, normalizeMaterialCode } from "@/lib/material-factors";
import { resolveCanonicalProductNo } from "@/lib/shop/canonical-mapping";
import { loadEffectiveMarketTicks } from "@/lib/shop/effective-market-ticks.js";
import { loadPublishedPriceStateByChannelProducts } from "@/lib/shop/publish-price-state";
import { createPersistedSizeGridLookup } from "@/lib/shop/weight-grid-store.js";
import { ensureSharedSizeGridRowsForChannel } from "@/lib/shop/shared-size-grid-runtime";
import { buildPlatingComboChoices, normalizePlatingCatalogComboKey } from "@/lib/shop/rule-utils";
import { buildCanonicalInputsFromExplicitOptionEntries } from "@/lib/shop/explicit-option-entry-canonical-inputs";
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
  let persistedSizeLookup: ReturnType<typeof createPersistedSizeGridLookup> | null = null;
  let colorBaseDeltaByCode: Record<string, number> = {};
  let sizeMarketContext: {
    goldTickKrwPerG?: number | null;
    silverTickKrwPerG?: number | null;
    materialFactors?: Record<string, unknown> | null;
  } | null = null;

  if (masterItemId) {
    const [activeProductRes, optionRuleRes, masterRes, materialFactorRes, effectiveTicks, colorComboRes, colorBucketRes, addonMasterRes] = await Promise.all([
      sb
        .from("sales_channel_product")
        .select("channel_product_id, external_product_no, external_variant_code")
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
        .from("cms_master_item")
        .select("master_item_id, material_code_default")
        .eq("master_item_id", masterItemId)
        .limit(1)
        .maybeSingle(),
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
      sb
        .from("channel_option_color_bucket_v1")
        .select("color_bucket_id, sell_delta_krw")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .limit(5000),
      sb
        .from("channel_option_addon_master_v1")
        .select("addon_master_id, base_amount_krw, extra_delta_krw")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .limit(5000),
    ]);

    if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);
    if (optionRuleRes.error) return jsonError(optionRuleRes.error.message ?? "옵션 상세 규칙 조회 실패", 500);
    if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 소재 조회 실패", 500);
    if (materialFactorRes.error) return jsonError(materialFactorRes.error.message ?? "소재 팩터 조회 실패", 500);
    if (colorComboRes.error && !isMissingSchemaObjectError(colorComboRes.error, "channel_color_combo_catalog_v1")) {
      return jsonError(colorComboRes.error.message ?? "색상 중앙금액 조회 실패", 500);
    }
    if (colorBucketRes.error && !isMissingSchemaObjectError(colorBucketRes.error, "channel_option_color_bucket_v1")) {
      return jsonError(colorBucketRes.error.message ?? "색상 버킷 조회 실패", 500);
    }
    if (addonMasterRes.error && !isMissingSchemaObjectError(addonMasterRes.error, "channel_option_addon_master_v1")) {
      return jsonError(addonMasterRes.error.message ?? "부가옵션 마스터 조회 실패", 500);
    }
    const activeRows = (activeProductRes.data ?? []) as Array<{
      channel_product_id?: string | null;
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
      return (optionRuleRes.data ?? []).some((row) => String(row.external_product_no ?? "").trim() === productNo);
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
    const explicitEntryMappingsRes = await sb
      .from("channel_product_option_entry_mapping_v1")
      .select("option_name, option_value, category_key, material_registry_code, weight_g, combo_code, color_bucket_id, decor_master_id, addon_master_id, other_reason_code, explicit_delta_krw, notice_code, is_active")
      .eq("channel_id", channelId)
      .in("external_product_no", Array.from(categoryProductNosForRead))
      .eq("is_active", true);
    if (explicitEntryMappingsRes.error && !isMissingSchemaObjectError(explicitEntryMappingsRes.error, "channel_product_option_entry_mapping_v1")) {
      return jsonError(explicitEntryMappingsRes.error.message ?? "explicit option entry mapping lookup failed", 500);
    }
    const explicitEntryMappings = (explicitEntryMappingsRes.data ?? []) as Array<Record<string, unknown>>;
    let filteredSavedOptionCategories: SavedOptionCategoryRowWithDelta[] = [];
    let publishedOptionEntries: Array<{
      option_axis_index: number;
      option_name: string;
      option_value: string;
      published_delta_krw: number;
    }> = [];
    const canonicalBaseMapping = activeRows.find((row) => {
      return String(row.external_product_no ?? "").trim() === canonicalExternalProductNo
        && String(row.external_variant_code ?? "").trim().length === 0;
    }) ?? null;
    const canonicalBaseChannelProductId = String(canonicalBaseMapping?.channel_product_id ?? "").trim();
    if (canonicalBaseChannelProductId) {
      try {
        const latestPublishRes = await loadPublishedPriceStateByChannelProducts({
          sb,
          channelId,
          channelProductIds: [canonicalBaseChannelProductId],
        });
        const latestBase = latestPublishRes.available
          ? (latestPublishRes.rowsByChannelProduct.get(canonicalBaseChannelProductId) ?? null)
          : null;
        const latestPublishVersion = String(latestBase?.publishVersion ?? "").trim();
        if (latestPublishVersion) {
          const optionEntryRes = await sb
            .from("product_price_publish_option_entry_v1")
            .select("option_axis_index, option_name, option_value, published_delta_krw")
            .eq("channel_id", channelId)
            .eq("master_item_id", masterItemId)
            .eq("external_product_no", canonicalExternalProductNo)
            .eq("publish_version", latestPublishVersion)
            .order("option_axis_index", { ascending: true })
            .order("option_name", { ascending: true })
            .order("option_value", { ascending: true });
          if (!optionEntryRes.error) {
            publishedOptionEntries = (optionEntryRes.data ?? [])
              .map((row) => ({
                option_axis_index: Number(row.option_axis_index ?? Number.NaN),
                option_name: String(row.option_name ?? "").trim(),
                option_value: String(row.option_value ?? "").trim(),
                published_delta_krw: Math.round(Number(row.published_delta_krw ?? Number.NaN)),
              }))
              .filter((row) => Number.isFinite(row.option_axis_index) && row.option_name && row.option_value && Number.isFinite(row.published_delta_krw));
          } else if (!isMissingSchemaObjectError(optionEntryRes.error, "product_price_publish_option_entry_v1")) {
            return jsonError(optionEntryRes.error.message ?? "published option entries lookup failed", 500);
          }
        }
      } catch {
        publishedOptionEntries = [];
      }
    }
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
    const colorBucketDeltaById = Object.fromEntries(
      ((colorBucketRes.data ?? []) as Array<{ color_bucket_id?: string | null; sell_delta_krw?: number | null }>)
        .map((row) => [String(row.color_bucket_id ?? '').trim(), Math.max(0, Math.round(Number(row.sell_delta_krw ?? 0)))])
        .filter(([key]) => Boolean(key)),
    );
    const addonAmountById = Object.fromEntries(
      ((addonMasterRes.data ?? []) as Array<{ addon_master_id?: string | null; base_amount_krw?: number | null; extra_delta_krw?: number | null }>)
        .map((row) => [
          String(row.addon_master_id ?? '').trim(),
          Math.max(0, Math.round(Number(row.base_amount_krw ?? 0)) + Math.round(Number(row.extra_delta_krw ?? 0))),
        ])
        .filter(([key]) => Boolean(key)),
    );
    sizeMarketContext = {
      goldTickKrwPerG: Math.round(Number(effectiveTicks.goldTickKrwPerG ?? 0)),
      silverTickKrwPerG: Math.round(Number(effectiveTicks.silverTickKrwPerG ?? 0)),
      materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
    };
    try {
      const sharedSizeRows = await ensureSharedSizeGridRowsForChannel({ sb, channelId });
      persistedSizeLookup = createPersistedSizeGridLookup(sharedSizeRows);
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
    const ruleOnlyCanonicalInputs = explicitEntryMappings.length > 0
      ? buildCanonicalInputsFromExplicitOptionEntries({
          rows: explicitEntryMappings.map((row) => ({
            option_name: String(row.option_name ?? ''),
            option_value: String(row.option_value ?? ''),
            category_key: String(row.category_key ?? '').trim().toUpperCase() as 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'ADDON' | 'OTHER' | 'NOTICE',
            material_registry_code: String(row.material_registry_code ?? '').trim() || null,
            weight_g: row.weight_g == null ? null : Number(row.weight_g),
            combo_code: String(row.combo_code ?? '').trim() || null,
            color_bucket_id: String(row.color_bucket_id ?? '').trim() || null,
            decor_master_id: String(row.decor_master_id ?? '').trim() || null,
            addon_master_id: String(row.addon_master_id ?? '').trim() || null,
            other_reason_code: String(row.other_reason_code ?? '').trim() || null,
            explicit_delta_krw: row.explicit_delta_krw == null ? null : Number(row.explicit_delta_krw),
            notice_code: String(row.notice_code ?? '').trim() || null,
          })),
          colorBucketDeltaById,
          addonAmountById,
        })
      : deriveRuleOnlyCanonicalInputs({
          variants: result.variants.map((variant) => ({
            variantCode: String(variant.variantCode ?? ''),
            options: variant.options,
          })),
          mappings: activeRows.filter((row) => categoryProductNosForRead.has(String(row.external_product_no ?? '').trim())),
          rules: filteredRuleRows,
          masterMaterialCode,
        });
    filteredSavedOptionCategories = ruleOnlyCanonicalInputs.savedOptionCategories;
    const otherReasonByEntryKey = ruleOnlyCanonicalInputs.otherReasonByEntryKey;
    const categoryOverrideByEntryKey = ruleOnlyCanonicalInputs.categoryOverrideByEntryKey;
    const axisSelectionByEntryKey = ruleOnlyCanonicalInputs.axisSelectionByEntryKey;
    const savedCategoryByEntryKey = new Map(
      filteredSavedOptionCategories
        .map((row) => [mappingOptionEntryKey(row.option_name, row.option_value), row.category_key] as const)
        .filter(([entryKey]) => entryKey.length > 0),
    );
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
          // Preserve saved selection so canonical resolution can surface legacy/unresolved instead of silently dropping it.
        }
      }
      if (categoryKey === "COLOR_PLATING" && selectedAxis2Value) {
        const allowedColors = allowedColorCodesByMaterial.get(effectiveMaterialCode);
        const isAllowed = allowedColors
          ? allowedColors.has(selectedAxis2Value)
          : globallyAllowedColorCodes.has(selectedAxis2Value);
        if (effectiveMaterialCode && !isAllowed) {
          // Preserve saved selection so canonical resolution can surface legacy/unresolved instead of silently dropping it.
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
          published_option_entries: publishedOptionEntries,
          canonical_external_product_no: canonicalExternalProductNo,
          master_material_code: masterMaterialCode,
          size_market_context: sizeMarketContext,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
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
        published_option_entries: [],
        canonical_external_product_no: canonicalExternalProductNo,
        master_material_code: masterMaterialCode,
        size_market_context: sizeMarketContext,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
