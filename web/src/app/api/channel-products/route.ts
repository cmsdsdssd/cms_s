import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";
import {
  buildMappingOptionAllowlist,
  resolveCanonicalExternalProductNo,
  validateMappingOptionSelection,
} from "@/lib/shop/mapping-option-details";
import { resolveCurrentProductSyncProfileForWrite } from "@/lib/shop/current-product-sync-profile.js";
import { normalizePlatingComboCode } from "@/lib/shop/sync-rules";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CHANNEL_PRODUCT_SELECT_BASE = "channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, size_price_override_enabled, size_price_override_krw, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at";
const CHANNEL_PRODUCT_SELECT_WITH_PROFILE = `${CHANNEL_PRODUCT_SELECT_BASE},current_product_sync_profile`;

const isThousandStep = (value: number): boolean => Number.isInteger(value) && value % 1000 === 0;
const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const CURRENT_PRODUCT_SYNC_PROFILES = ["GENERAL", "MARKET_LINKED"] as const;

const parseCurrentProductSyncProfile = (value: unknown) => {
  const profile = String(value ?? "GENERAL").trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("current_product_sync_profile must be GENERAL/MARKET_LINKED");
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  const buildQuery = (includeCurrentProductSyncProfile: boolean) => {
    let query = sb
      .from("sales_channel_product")
      .select(includeCurrentProductSyncProfile ? CHANNEL_PRODUCT_SELECT_WITH_PROFILE : CHANNEL_PRODUCT_SELECT_BASE)
      .order("updated_at", { ascending: false });

    if (channelId) query = query.eq("channel_id", channelId);
    if (masterItemId) query = query.eq("master_item_id", masterItemId);
    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && isMissingColumnError(error, "sales_channel_product.current_product_sync_profile")) {
    ({ data, error } = await buildQuery(false));
  }
  if (error) return jsonError(error.message ?? "매핑 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);
  const changeReason = typeof body.change_reason === "string" ? toTrimmed(body.change_reason) : "";
  const changedBy =
    toTrimmed(request.headers.get("x-user-email"))
    || toTrimmed(request.headers.get("x-user-id"))
    || toTrimmed(request.headers.get("x-user"))
    || null;

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const externalVariantCode = typeof body.external_variant_code === "string" ? body.external_variant_code.trim() : "";
  const materialMultiplierOverride =
    body.material_multiplier_override === null || body.material_multiplier_override === undefined || body.material_multiplier_override === ""
      ? null
      : Number(body.material_multiplier_override);
  const sizeWeightDeltaG =
    body.size_weight_delta_g === null || body.size_weight_delta_g === undefined || body.size_weight_delta_g === ""
      ? null
      : Number(body.size_weight_delta_g);
  const sizePriceOverrideEnabled = body.size_price_override_enabled === true;
  const sizePriceOverrideKrw =
    body.size_price_override_krw === null || body.size_price_override_krw === undefined || body.size_price_override_krw === ""
      ? null
      : Number(body.size_price_override_krw);
  const optionPriceDeltaKrw =
    body.option_price_delta_krw === null || body.option_price_delta_krw === undefined || body.option_price_delta_krw === ""
      ? null
      : Number(body.option_price_delta_krw);
  const optionPriceMode = String(body.option_price_mode ?? "SYNC").trim().toUpperCase();
  const optionManualTargetKrw =
    body.option_manual_target_krw === null || body.option_manual_target_krw === undefined || body.option_manual_target_krw === ""
      ? null
      : Number(body.option_manual_target_krw);
  const mappingSource = String(body.mapping_source ?? "MANUAL").trim().toUpperCase();
  const syncRuleSetId = typeof body.sync_rule_set_id === "string" ? body.sync_rule_set_id.trim() || null : null;
  const optionMaterialCode = typeof body.option_material_code === "string" ? normalizeMaterialCode(body.option_material_code) || null : null;
  const optionColorCode = typeof body.option_color_code === "string" ? normalizePlatingComboCode(body.option_color_code) || null : null;
  const optionDecorationCode = typeof body.option_decoration_code === "string" ? body.option_decoration_code.trim().toUpperCase() || null : null;
  const optionSizeValue =
    body.option_size_value === null || body.option_size_value === undefined || body.option_size_value === ""
      ? null
      : Number(body.option_size_value);
  const isActive = body.is_active === false ? false : true;
  const includeMasterPlatingLabor = body.include_master_plating_labor === false ? false : true;
  const syncRuleMaterialEnabled = body.sync_rule_material_enabled === false ? false : true;
  const syncRuleWeightEnabled = body.sync_rule_weight_enabled === false ? false : true;
  const syncRulePlatingEnabled = body.sync_rule_plating_enabled === false ? false : true;
  const syncRuleDecorationEnabled = body.sync_rule_decoration_enabled === false ? false : true;
  const syncRuleMarginRoundingEnabled = body.sync_rule_margin_rounding_enabled === false ? false : true;
  const hasCurrentProductSyncProfile = Object.prototype.hasOwnProperty.call(body, "current_product_sync_profile");
  let currentProductSyncProfile: (typeof CURRENT_PRODUCT_SYNC_PROFILES)[number] | null = null;

  if (hasCurrentProductSyncProfile) {
    try {
      currentProductSyncProfile = parseCurrentProductSyncProfile(body.current_product_sync_profile);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid current_product_sync_profile", 400);
    }
  }

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);
  if (!isActive) return jsonError("활성 매핑만 허용됩니다 (is_active must be true)", 422);
  if (materialMultiplierOverride !== null && (!Number.isFinite(materialMultiplierOverride) || materialMultiplierOverride <= 0)) {
    return jsonError("material_multiplier_override must be > 0", 400);
  }
  if (sizeWeightDeltaG !== null && (!Number.isFinite(sizeWeightDeltaG) || sizeWeightDeltaG < -100 || sizeWeightDeltaG > 100)) {
    return jsonError("size_weight_delta_g must be between -100 and 100", 400);
  }
  if (sizePriceOverrideKrw !== null && (!Number.isFinite(sizePriceOverrideKrw) || sizePriceOverrideKrw < -100000000 || sizePriceOverrideKrw > 100000000)) {
    return jsonError("size_price_override_krw must be between -100000000 and 100000000", 400);
  }
  if (sizePriceOverrideKrw !== null && Math.round(sizePriceOverrideKrw) % 100 !== 0) {
    return jsonError("size_price_override_krw must be 100 KRW step", 400);
  }
  if (sizePriceOverrideEnabled && sizePriceOverrideKrw === null) {
    return jsonError("size_price_override_krw is required when size_price_override_enabled is true", 400);
  }
  if (optionPriceDeltaKrw !== null && (!Number.isFinite(optionPriceDeltaKrw) || optionPriceDeltaKrw < -100000000 || optionPriceDeltaKrw > 100000000)) {
    return jsonError("option_price_delta_krw must be between -100000000 and 100000000", 400);
  }
  if (optionPriceDeltaKrw !== null && !isThousandStep(Math.round(optionPriceDeltaKrw))) {
    return jsonError("option_price_delta_krw must be 1000 KRW step", 400);
  }
  if (!["SYNC", "MANUAL"].includes(optionPriceMode)) {
    return jsonError("option_price_mode must be SYNC or MANUAL", 400);
  }
  if (optionManualTargetKrw !== null && (!Number.isFinite(optionManualTargetKrw) || optionManualTargetKrw < 0 || optionManualTargetKrw > 1000000000)) {
    return jsonError("option_manual_target_krw must be between 0 and 1000000000", 400);
  }
  if (optionPriceMode === "MANUAL" && optionManualTargetKrw === null) {
    return jsonError("option_manual_target_krw is required when option_price_mode is MANUAL", 400);
  }
  if (optionSizeValue !== null && (!Number.isFinite(optionSizeValue) || optionSizeValue < 0)) {
    return jsonError("option_size_value must be >= 0", 400);
  }
  if (optionPriceMode === "SYNC" && !syncRuleSetId) {
    return jsonError("sync_rule_set_id is required when option_price_mode is SYNC", 400);
  }

  const activeProductRes = await sb
    .from("sales_channel_product")
    .select("external_product_no")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);

  const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
    (activeProductRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim()),
    externalProductNo,
  );
  const existingMappingCandidates = Array.from(new Set([externalProductNo, canonicalExternalProductNo].filter(Boolean)));
  let existingMappingQuery = sb
    .from("sales_channel_product")
    .select("option_material_code, option_color_code, option_decoration_code, option_size_value, external_product_no")
    .eq("channel_id", channelId)
    .eq("external_variant_code", externalVariantCode)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingMappingCandidates.length === 1) {
    existingMappingQuery = existingMappingQuery.eq("external_product_no", existingMappingCandidates[0]);
  } else {
    existingMappingQuery = existingMappingQuery.in("external_product_no", existingMappingCandidates);
  }
  const existingMappingRes = await existingMappingQuery.maybeSingle();
  if (existingMappingRes.error) return jsonError(existingMappingRes.error.message ?? "기존 옵션 상세 조회 실패", 500);
  const optionRuleRes = await sb
    .from("channel_option_labor_rule_v1")
    .select("rule_id, channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, size_price_mode, formula_multiplier, formula_offset_krw, rounding_unit_krw, rounding_mode, fixed_delta_krw, plating_enabled, color_code, decoration_master_id, decoration_model_name, base_labor_cost_krw, additive_delta_krw, is_active, note")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true);
  if (optionRuleRes.error) return jsonError(optionRuleRes.error.message ?? "옵션 상세 규칙 조회 실패", 500);

  const optionValidation = validateMappingOptionSelection({
    allowlist: buildMappingOptionAllowlist(optionRuleRes.data ?? []),
    current: {
      option_material_code: optionMaterialCode,
      option_color_code: optionColorCode,
      option_decoration_code: optionDecorationCode,
      option_size_value: optionSizeValue,
    },
    previous: existingMappingRes.data
      ? {
          option_material_code: existingMappingRes.data.option_material_code,
          option_color_code: existingMappingRes.data.option_color_code,
          option_decoration_code: existingMappingRes.data.option_decoration_code,
          option_size_value: existingMappingRes.data.option_size_value,
        }
      : null,
  });
  if (!optionValidation.ok) {
    return jsonError(optionValidation.errors[0] ?? "옵션 상세 값이 저장된 설정 허용값과 일치하지 않습니다", 422, {
      code: "OPTION_DETAIL_NOT_ALLOWED",
      errors: optionValidation.errors,
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: canonicalExternalProductNo,
      external_variant_code: externalVariantCode || null,
    });
  }

  const buildSiblingQuery = (includeCurrentProductSyncProfile: boolean) => sb
    .from("sales_channel_product")
    .select(includeCurrentProductSyncProfile
      ? "channel_product_id, option_price_mode, sync_rule_set_id, is_active, current_product_sync_profile"
      : "channel_product_id, option_price_mode, sync_rule_set_id, is_active")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId);

  let siblingRes = await buildSiblingQuery(true);
  if (siblingRes.error && isMissingColumnError(siblingRes.error, "sales_channel_product.current_product_sync_profile")) {
    siblingRes = await buildSiblingQuery(false);
  }
  if (siblingRes.error) return jsonError(siblingRes.error.message ?? "동일 마스터 옵션 조회 실패", 500);

  const siblingRowsRaw = Array.isArray(siblingRes.data) ? (siblingRes.data as unknown[]) : [];
  const siblingRows = siblingRowsRaw.map((row) => {
    const record = row && typeof row === "object"
      ? row as {
        option_price_mode?: string | null;
        sync_rule_set_id?: string | null;
        is_active?: boolean | null;
        current_product_sync_profile?: string | null;
      }
      : {};
    return {
      option_price_mode: String(record.option_price_mode ?? "SYNC").toUpperCase() === "MANUAL" ? "MANUAL" : "SYNC",
      sync_rule_set_id: typeof record.sync_rule_set_id === "string" ? record.sync_rule_set_id : null,
      is_active: record.is_active !== false,
      current_product_sync_profile: typeof record.current_product_sync_profile === "string" ? record.current_product_sync_profile : null,
    };
  });

  const projectedRows = [
    ...siblingRows.map((row) => ({
      option_price_mode: row.option_price_mode,
      sync_rule_set_id: row.sync_rule_set_id,
      is_active: row.is_active,
    })),
    {
      option_price_mode: optionPriceMode as "SYNC" | "MANUAL",
      sync_rule_set_id: syncRuleSetId,
      is_active: isActive,
    },
  ];
  const syncRuleSetIds = new Set(
    projectedRows
      .filter((row) => row.is_active && row.option_price_mode === "SYNC")
      .map((row) => String(row.sync_rule_set_id ?? "").trim())
      .filter(Boolean),
  );
  if (syncRuleSetIds.size > 1) {
    return jsonError("동일 master_item_id의 SYNC 매핑은 sync_rule_set_id가 단일값이어야 합니다", 422, {
      code: "SOT_RULESET_INCONSISTENT",
      channel_id: channelId,
      master_item_id: masterItemId,
      sync_rule_set_ids: Array.from(syncRuleSetIds),
    });
  }

  const activeSiblingRows = siblingRows.filter((row) => row.is_active);

  const resolvedCurrentProductSyncProfile = resolveCurrentProductSyncProfileForWrite({
    incomingProfile: currentProductSyncProfile,
    hasIncomingProfile: hasCurrentProductSyncProfile,
    existingRows: activeSiblingRows,
  });

  const payloadBase = {
    channel_id: channelId,
    master_item_id: masterItemId,
    external_product_no: canonicalExternalProductNo,
    external_variant_code: externalVariantCode,
    sync_rule_set_id: syncRuleSetId,
    option_material_code: optionValidation.value.option_material_code,
    option_color_code: optionValidation.value.option_color_code,
    option_decoration_code: optionValidation.value.option_decoration_code,
    option_size_value: optionValidation.value.option_size_value,
    material_multiplier_override: materialMultiplierOverride,
    size_weight_delta_g: sizeWeightDeltaG,
    size_price_override_enabled: sizePriceOverrideEnabled,
    size_price_override_krw: sizePriceOverrideEnabled ? Math.round(sizePriceOverrideKrw ?? 0) : null,
    option_price_delta_krw: optionPriceDeltaKrw,
    option_price_mode: optionPriceMode,
    option_manual_target_krw: optionManualTargetKrw,
    include_master_plating_labor: includeMasterPlatingLabor,
    sync_rule_material_enabled: syncRuleMaterialEnabled,
    sync_rule_weight_enabled: syncRuleWeightEnabled,
    sync_rule_plating_enabled: syncRulePlatingEnabled,
    sync_rule_decoration_enabled: syncRuleDecorationEnabled,
    sync_rule_margin_rounding_enabled: syncRuleMarginRoundingEnabled,
    mapping_source: ["MANUAL", "CSV", "AUTO"].includes(mappingSource) ? mappingSource : "MANUAL",
    is_active: isActive,
  };
  const payloadWithProfile = {
    ...payloadBase,
    current_product_sync_profile: resolvedCurrentProductSyncProfile,
  };

  const executeUpsert = (payload: typeof payloadBase | typeof payloadWithProfile) => sb
    .from("sales_channel_product")
    .upsert(payload, { onConflict: "channel_id,external_product_no,external_variant_code" })
    .select(CHANNEL_PRODUCT_SELECT_BASE)
    .single();

  let { data, error } = await executeUpsert(payloadWithProfile);
  if (error && isMissingColumnError(error, "sales_channel_product.current_product_sync_profile")) {
    ({ data, error } = await executeUpsert(payloadBase));
  }

  if (error) return jsonError(error.message ?? "매핑 저장 실패", 400);
  const responseData = data
    ? {
        ...data,
        current_product_sync_profile: resolvedCurrentProductSyncProfile,
      }
    : data;

  if (canonicalExternalProductNo !== externalProductNo) {
    const aliasHistoryRes = await sb
      .from("sales_channel_product_alias_history")
      .insert([{
        channel_id: channelId,
        canonical_channel_product_id: String(data?.channel_product_id ?? "").trim() || null,
        master_item_id: masterItemId,
        canonical_external_product_no: canonicalExternalProductNo,
        alias_external_product_no: externalProductNo,
        external_variant_code: externalVariantCode,
        reason: "SINGLE_MAPPING_CANONICALIZED",
      }]);
    if (aliasHistoryRes.error) return jsonError(aliasHistoryRes.error.message ?? "별칭 이력 저장 실패", 500);
  }

  const traceLogRes = await sb
    .from("channel_option_value_policy_log")
    .insert([{
      policy_id: null,
      channel_id: channelId,
      master_item_id: masterItemId,
      axis_key: "RESOLUTION_TRACE",
      axis_value: `${canonicalExternalProductNo}::${externalVariantCode || "-"}`,
      action_type: existingMappingRes.data ? "UPDATE" : "CREATE",
      old_row: existingMappingRes.data
        ? {
            option_material_code: existingMappingRes.data.option_material_code,
            option_color_code: existingMappingRes.data.option_color_code,
            option_decoration_code: existingMappingRes.data.option_decoration_code,
            option_size_value: existingMappingRes.data.option_size_value,
          }
        : null,
      new_row: {
        requested_external_product_no: externalProductNo,
        canonical_external_product_no: canonicalExternalProductNo,
        external_variant_code: externalVariantCode || null,
        resolved_selection: optionValidation.value,
        option_price_mode: optionPriceMode,
        sync_rule_set_id: syncRuleSetId,
      },
      change_reason: changeReason || "SINGLE_MAPPING_SAVE",
      changed_by: changedBy,
    }]);
  if (traceLogRes.error) return jsonError(traceLogRes.error.message ?? "옵션 매핑 trace 로그 저장 실패", 500);

  return NextResponse.json({ data: responseData }, { headers: { "Cache-Control": "no-store" } });
}
