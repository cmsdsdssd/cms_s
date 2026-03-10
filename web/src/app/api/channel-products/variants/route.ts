import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
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
import { createPersistedSizeGridLookup, loadPersistedSizeGridRowsForScope } from "@/lib/shop/weight-grid-store.js";
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

const pickStableMaterialCode = (candidates: Array<unknown>): string | null => {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const normalized = normalizeMaterialCode(String(candidate ?? "").trim());
    if (!normalized || normalized === "00") continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return sorted[0]?.[0] ?? null;
};

const pickPreferredGridProductNo = (values: Array<unknown>): string | null => {
  const normalized = normalizeProductNoCandidates(values);
  return normalized.find((value) => /^P/i.test(value)) ?? normalized[0] ?? null;
};

const hasMaterialSignal = (
  variants: Array<{ options?: Array<{ name?: string | null; value?: string | null }> | null }>,
  savedCategoryRows: Array<{ category_key?: string | null }> = [],
): boolean => {
  if (savedCategoryRows.some((row) => String(row.category_key ?? "").trim().toUpperCase() === "MATERIAL")) return true;
  return variants.some((variant) =>
    (variant.options ?? []).some((option) =>
      /(재질|소재|material|금종|함량|14k|18k|24k|925|999)/iu.test(String(option?.name ?? ""))
      || /(14k|18k|24k|925|999)/iu.test(String(option?.value ?? "")),
    ),
  );
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
  let sizeMarketContext: {
    goldTickKrwPerG?: number | null;
    silverTickKrwPerG?: number | null;
    materialFactors?: Record<string, unknown> | null;
  } | null = null;

  if (masterItemId) {
    const [activeProductRes, optionRuleRes, categoryRes, masterRes, otherReasonLogRes, materialFactorRes, tickRes, currentStateRes, latestSnapshotRes] = await Promise.all([
      sb
        .from("sales_channel_product")
        .select("external_product_no, option_material_code")
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
        .select("external_product_no, option_name, option_value, category_key, sync_delta_krw")
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
      sb
        .from("cms_v_market_tick_latest_gold_silver_ops_v1")
        .select("gold_price_krw_per_g, silver_price_krw_per_g")
        .maybeSingle(),
      sb
        .from("channel_option_current_state_v1")
        .select("external_product_no, external_variant_code, material_code")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .order("updated_at", { ascending: false })
        .limit(5000),
      sb
        .from("pricing_snapshot")
        .select("material_code_effective")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .order("computed_at", { ascending: false })
        .limit(20),
    ]);

    if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);
    if (optionRuleRes.error) return jsonError(optionRuleRes.error.message ?? "옵션 상세 규칙 조회 실패", 500);
    if (categoryRes.error) return jsonError(categoryRes.error.message ?? "옵션 카테고리 조회 실패", 500);
    if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 소재 조회 실패", 500);
    if (otherReasonLogRes.error) return jsonError(otherReasonLogRes.error.message ?? "기타 사유 로그 조회 실패", 500);
    if (materialFactorRes.error) return jsonError(materialFactorRes.error.message ?? "소재 팩터 조회 실패", 500);
    if (tickRes.error) return jsonError(tickRes.error.message ?? "시세 조회 실패", 500);
    if (currentStateRes.error) return jsonError(currentStateRes.error.message ?? "현재 옵션 상태 소재 조회 실패", 500);
    if (latestSnapshotRes.error) return jsonError(latestSnapshotRes.error.message ?? "최근 스냅샷 소재 조회 실패", 500);

    const canonicalPreferredProductNos = normalizeProductNoCandidates([externalProductNo, resolvedProductNo]);
    const activeRows = (activeProductRes.data ?? []) as Array<{ external_product_no?: string | null; option_material_code?: string | null }>;
    const productScopedActiveRows = activeRows.filter((row) => canonicalPreferredProductNos.includes(String(row.external_product_no ?? "").trim()));
    const currentStateRows = (currentStateRes.data ?? []) as Array<{ external_product_no?: string | null; material_code?: string | null }>;
    const productScopedCurrentStateRows = currentStateRows.filter((row) => canonicalPreferredProductNos.includes(String(row.external_product_no ?? "").trim()));
    const preferredProductNos = normalizeProductNoCandidates([externalProductNo, resolvedProductNo]);
    const hasCentralRowsForProductNo = (productNo: string) => {
      if (!productNo) return false;
      return (categoryRes.data ?? []).some((row) => String(row.external_product_no ?? "").trim() === productNo)
        || (optionRuleRes.data ?? []).some((row) => String(row.external_product_no ?? "").trim() === productNo);
    };
    const scopedCentralProductNo = preferredProductNos.find((productNo) => hasCentralRowsForProductNo(productNo)) ?? "";
    canonicalExternalProductNo = scopedCentralProductNo
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
    const filteredSavedOptionCategories = (categoryRes.data ?? [])
      .filter((row) => String(row.external_product_no ?? "").trim() === canonicalExternalProductNo)
      .map((row) => ({
        option_name: String(row.option_name ?? "").trim(),
        option_value: String(row.option_value ?? "").trim(),
        category_key: normalizeSavedCategoryKey(row.category_key),
        sync_delta_krw: row.sync_delta_krw == null ? null : Math.round(Number(row.sync_delta_krw)),
      }))
      .filter((row) => {
        if (row.option_name.length === 0 || row.option_value.length === 0) return false;
        const allowedValues = validOptionValuesByName.get(row.option_name);
        return Boolean(allowedValues && allowedValues.has(row.option_value));
      });
    const materialSignalExists = hasMaterialSignal(
      result.variants.map((variant) => ({
        options: variant.options.map((option) => ({ name: option.name, value: option.value })),
      })),
      filteredSavedOptionCategories,
    );
    const mappedMaterialCode = materialSignalExists
      ? (pickStableMaterialCode(productScopedActiveRows.map((row) => row.option_material_code))
        || pickStableMaterialCode(activeRows.map((row) => row.option_material_code)))
      : null;
    const currentStateMaterialCode = materialSignalExists
      ? (pickStableMaterialCode(productScopedCurrentStateRows.map((row) => row.material_code))
        || pickStableMaterialCode(currentStateRows.map((row) => row.material_code)))
      : null;
    const snapshotMaterialCode = materialSignalExists
      ? pickStableMaterialCode((latestSnapshotRes.data ?? []).map((row) => (row as { material_code_effective?: string | null }).material_code_effective))
      : null;
    masterMaterialCode =
      String(masterRes.data?.material_code_default ?? "").trim()
      || mappedMaterialCode
      || currentStateMaterialCode
      || snapshotMaterialCode
      || null;
    sizeMarketContext = {
      goldTickKrwPerG: Math.round(Number(tickRes.data?.gold_price_krw_per_g ?? 0)),
      silverTickKrwPerG: Math.round(Number(tickRes.data?.silver_price_krw_per_g ?? 0)),
      materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
    };
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
    optionDetailAllowlist = {
      ...baseAllowlist,
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
    const validEntryKeys = new Set(
      (result.variants ?? []).flatMap((variant) =>
        (variant.options ?? []).map((option) => mappingOptionEntryKey(String(option?.name ?? "").trim(), String(option?.value ?? "").trim())),
      ).filter(Boolean),
    );
    const axisPrefixes = [canonicalExternalProductNo].filter(Boolean).map((productNo) => `${productNo}::`);
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
    const fallbackMaterialCode = String(masterRes.data?.material_code_default ?? "").trim();
    const allowedMaterialCodes = new Set(
      optionDetailAllowlist.materials
        .map((choice) => String(choice.value ?? "").trim())
        .filter(Boolean),
    );
    const allowedColorCodesByMaterial = new Map<string, Set<string>>();
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
        const allowedColors = allowedColorCodesByMaterial.get(effectiveMaterialCode) ?? null;
        if (effectiveMaterialCode && (!allowedColors || !allowedColors.has(selectedAxis2Value))) {
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
    });
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
