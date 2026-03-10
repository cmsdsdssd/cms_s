import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingSchemaObjectError, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";
import {
  buildMappingOptionAllowlist,
  resolveCanonicalExternalProductNo,
  validateMappingOptionSelection,
} from "@/lib/shop/mapping-option-details";
import { normalizePlatingComboCode } from "@/lib/shop/sync-rules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isThousandStep = (value: number): boolean => Number.isInteger(value) && value % 1000 === 0;
const toTrimmed = (value: unknown): string => String(value ?? "").trim();

const mergeColorChoices = (allowlist: ReturnType<typeof buildMappingOptionAllowlist>, rows: Array<{ combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null }>) => {
  const merged = new Map(
    (allowlist.colors ?? []).map((choice) => [String(choice.value ?? "").trim(), choice] as const),
  );
  for (const row of rows) {
    const comboKey = String(row.combo_key ?? "").trim();
    if (!comboKey || merged.has(comboKey)) continue;
    merged.set(comboKey, {
      value: comboKey,
      label: String(row.display_name ?? "").trim() || comboKey,
      delta_krw: Math.max(0, Math.round(Number(row.base_delta_krw ?? 0))),
    });
  }
  return {
    ...allowlist,
    colors: Array.from(merged.values()),
  };
};

type BulkRow = {
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
  current_product_sync_profile: "GENERAL" | "MARKET_LINKED" | null;
  mapping_source: "MANUAL" | "CSV" | "AUTO";
  is_active: boolean;
};

function normalizeRow(raw: unknown): { ok: true; row: BulkRow } | { ok: false; error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { ok: false, error: "row must be object" };

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const externalVariantCode = String(body.external_variant_code ?? "").trim();

  const materialMultiplierOverride =
    body.material_multiplier_override === null
    || body.material_multiplier_override === undefined
    || body.material_multiplier_override === ""
      ? null
      : Number(body.material_multiplier_override);
  const sizeWeightDeltaG =
    body.size_weight_delta_g === null
    || body.size_weight_delta_g === undefined
    || body.size_weight_delta_g === ""
      ? null
      : Number(body.size_weight_delta_g);
  const sizePriceOverrideEnabled = body.size_price_override_enabled === true;
  const sizePriceOverrideKrw =
    body.size_price_override_krw === null
    || body.size_price_override_krw === undefined
    || body.size_price_override_krw === ""
      ? null
      : Number(body.size_price_override_krw);
  const optionPriceDeltaKrw =
    body.option_price_delta_krw === null
    || body.option_price_delta_krw === undefined
    || body.option_price_delta_krw === ""
      ? null
      : Number(body.option_price_delta_krw);
  const optionPriceModeRaw = String(body.option_price_mode ?? "SYNC").trim().toUpperCase();
  const optionPriceMode: "SYNC" | "MANUAL" = optionPriceModeRaw === "MANUAL" ? "MANUAL" : "SYNC";
  const syncRuleSetId = typeof body.sync_rule_set_id === "string" ? body.sync_rule_set_id.trim() || null : null;
  const optionMaterialCode = typeof body.option_material_code === "string" ? normalizeMaterialCode(body.option_material_code) || null : null;
  const optionColorCode = typeof body.option_color_code === "string" ? normalizePlatingComboCode(body.option_color_code) || null : null;
  const optionDecorationCode = typeof body.option_decoration_code === "string" ? body.option_decoration_code.trim().toUpperCase() || null : null;
  const optionSizeValue =
    body.option_size_value === null
    || body.option_size_value === undefined
    || body.option_size_value === ""
      ? null
      : Number(body.option_size_value);
  const optionManualTargetKrw =
    body.option_manual_target_krw === null
    || body.option_manual_target_krw === undefined
    || body.option_manual_target_krw === ""
      ? null
      : Number(body.option_manual_target_krw);
  const currentProductSyncProfileRaw = String(body.current_product_sync_profile ?? "").trim().toUpperCase();
  const currentProductSyncProfile = currentProductSyncProfileRaw === "MARKET_LINKED"
    ? "MARKET_LINKED"
    : currentProductSyncProfileRaw === "GENERAL"
      ? "GENERAL"
      : null;

  const mappingSourceRaw = String(body.mapping_source ?? "AUTO").trim().toUpperCase();
  const mappingSource: "MANUAL" | "CSV" | "AUTO" = ["MANUAL", "CSV", "AUTO"].includes(mappingSourceRaw)
    ? (mappingSourceRaw as "MANUAL" | "CSV" | "AUTO")
    : "AUTO";
  const isActive = body.is_active === false ? false : true;
  const includeMasterPlatingLabor = body.include_master_plating_labor === false ? false : true;
  const syncRuleMaterialEnabled = body.sync_rule_material_enabled === false ? false : true;
  const syncRuleWeightEnabled = body.sync_rule_weight_enabled === false ? false : true;
  const syncRulePlatingEnabled = body.sync_rule_plating_enabled === false ? false : true;
  const syncRuleDecorationEnabled = body.sync_rule_decoration_enabled === false ? false : true;
  const syncRuleMarginRoundingEnabled = body.sync_rule_margin_rounding_enabled === false ? false : true;

  if (!channelId) return { ok: false, error: "channel_id is required" };
  if (!masterItemId) return { ok: false, error: "master_item_id is required" };
  if (!externalProductNo) return { ok: false, error: "external_product_no is required" };
  if (!externalVariantCode) return { ok: false, error: "external_variant_code is required" };
  if (!isActive) return { ok: false, error: "?쒖꽦 留ㅽ븨留??덉슜?⑸땲??(is_active must be true)" };

  if (
    materialMultiplierOverride !== null
    && (!Number.isFinite(materialMultiplierOverride) || materialMultiplierOverride <= 0)
  ) {
    return { ok: false, error: "material_multiplier_override must be > 0" };
  }
  if (sizeWeightDeltaG !== null && (!Number.isFinite(sizeWeightDeltaG) || sizeWeightDeltaG < -100 || sizeWeightDeltaG > 100)) {
    return { ok: false, error: "size_weight_delta_g must be between -100 and 100" };
  }
  if (sizePriceOverrideKrw !== null && (!Number.isFinite(sizePriceOverrideKrw) || sizePriceOverrideKrw < -100000000 || sizePriceOverrideKrw > 100000000)) {
    return { ok: false, error: "size_price_override_krw must be between -100000000 and 100000000" };
  }
  if (sizePriceOverrideKrw !== null && Math.round(sizePriceOverrideKrw) % 100 !== 0) {
    return { ok: false, error: "size_price_override_krw must be 100 KRW step" };
  }
  if (sizePriceOverrideEnabled && sizePriceOverrideKrw === null) {
    return { ok: false, error: "size_price_override_krw is required when size_price_override_enabled is true" };
  }
  if (optionPriceDeltaKrw !== null && (!Number.isFinite(optionPriceDeltaKrw) || optionPriceDeltaKrw < -100000000 || optionPriceDeltaKrw > 100000000)) {
    return { ok: false, error: "option_price_delta_krw must be between -100000000 and 100000000" };
  }
  if (optionPriceDeltaKrw !== null && !isThousandStep(Math.round(optionPriceDeltaKrw))) {
    return { ok: false, error: "option_price_delta_krw must be 1000 KRW step" };
  }
  if (optionManualTargetKrw !== null && (!Number.isFinite(optionManualTargetKrw) || optionManualTargetKrw < 0 || optionManualTargetKrw > 1000000000)) {
    return { ok: false, error: "option_manual_target_krw must be between 0 and 1000000000" };
  }
  if (optionPriceMode === "MANUAL" && optionManualTargetKrw === null) {
    return { ok: false, error: "option_manual_target_krw is required when option_price_mode is MANUAL" };
  }
  if (optionPriceMode === "SYNC" && !syncRuleSetId) {
    return { ok: false, error: "sync_rule_set_id is required when option_price_mode is SYNC" };
  }
  if (optionSizeValue !== null && (!Number.isFinite(optionSizeValue) || optionSizeValue < 0)) {
    return { ok: false, error: "option_size_value must be >= 0" };
  }

  return {
    ok: true,
    row: {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: externalProductNo,
      external_variant_code: externalVariantCode,
      sync_rule_set_id: syncRuleSetId,
      option_material_code: optionMaterialCode,
      option_color_code: optionColorCode,
      option_decoration_code: optionDecorationCode,
      option_size_value: optionSizeValue,
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
      current_product_sync_profile: currentProductSyncProfile,
      mapping_source: mappingSource,
      is_active: isActive,
    },
  };
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

  const inputRows = Array.isArray(body.rows) ? body.rows : [];
  if (inputRows.length === 0) return jsonError("rows is required", 400);

  const normalized: BulkRow[] = [];
  for (let i = 0; i < inputRows.length; i += 1) {
    const result = normalizeRow(inputRows[i]);
    if (!result.ok) return jsonError(`rows[${i}]: ${result.error}`, 400);
    normalized.push(result.row);
  }

  const dedup = new Map<string, BulkRow>();
  for (const row of normalized) {
    const key = `${row.channel_id}::${row.external_product_no}::${row.external_variant_code}`;
    dedup.set(key, row);
  }
  let rows = Array.from(dedup.values());

  const affectedPairSet = new Set(rows.map((row) => `${row.channel_id}::${row.master_item_id}`));
  const affectedChannelIds = Array.from(new Set(rows.map((row) => row.channel_id)));
  const affectedMasterIds = Array.from(new Set(rows.map((row) => row.master_item_id)));
  const [existingRes, activeProductRes, optionRuleRes, colorComboRes] = await Promise.all([
    sb
      .from('sales_channel_product')
      .select('channel_id, master_item_id, external_product_no, external_variant_code, option_material_code, option_color_code, option_decoration_code, option_size_value, option_price_mode, sync_rule_set_id, current_product_sync_profile, is_active')
      .in('channel_id', affectedChannelIds)
      .in('master_item_id', affectedMasterIds),
    sb
      .from('sales_channel_product')
      .select('channel_id, master_item_id, external_product_no')
      .in('channel_id', affectedChannelIds)
      .in('master_item_id', affectedMasterIds)
      .eq('is_active', true),
    sb
      .from('channel_option_labor_rule_v1')
      .select('rule_id, channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, plating_enabled, color_code, decoration_master_id, decoration_model_name, base_labor_cost_krw, additive_delta_krw, is_active, note')
      .in('channel_id', affectedChannelIds)
      .in('master_item_id', affectedMasterIds)
      .eq('is_active', true),
    sb
      .from("channel_color_combo_catalog_v1")
      .select("channel_id, combo_key, display_name, base_delta_krw")
      .in("channel_id", affectedChannelIds)
      .eq("is_active", true),
  ]);
  if (existingRes.error) return jsonError(existingRes.error.message ?? '기존 옵션 조회 실패', 500);
  if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? '활성 상품번호 조회 실패', 500);
  if (optionRuleRes.error) return jsonError(optionRuleRes.error.message ?? '옵션 상세 규칙 조회 실패', 500);
  if (colorComboRes.error && !isMissingSchemaObjectError(colorComboRes.error, "channel_color_combo_catalog_v1")) {
    return jsonError(colorComboRes.error.message ?? "색상 중앙금액 조회 실패", 500);
  }

  const activeProductNosByPair = new Map<string, string[]>();
  for (const row of (activeProductRes.data ?? []) as Array<{ channel_id: string; master_item_id: string; external_product_no: string | null }>) {
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const prev = activeProductNosByPair.get(pairKey) ?? [];
    const productNo = String(row.external_product_no ?? '').trim();
    if (!productNo || prev.includes(productNo)) continue;
    prev.push(productNo);
    activeProductNosByPair.set(pairKey, prev);
  }

  const existingRows = (existingRes.data ?? []) as Array<{
    channel_id: string;
    master_item_id: string;
    external_product_no: string;
    external_variant_code: string;
    option_material_code: string | null;
    option_color_code: string | null;
    option_decoration_code: string | null;
    option_size_value: number | null;
    option_price_mode: 'SYNC' | 'MANUAL' | null;
    sync_rule_set_id: string | null;
    current_product_sync_profile: string | null;
    is_active: boolean | null;
  }>;
  const existingOptionByKey = new Map(
    existingRows.map((row) => {
      const pairKey = `${row.channel_id}::${row.master_item_id}`;
      const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
        activeProductNosByPair.get(pairKey) ?? [],
        row.external_product_no,
      );
      return [
        `${row.channel_id}::${canonicalExternalProductNo}::${row.external_variant_code}`,
        row,
      ];
    }),
  );

  const ruleRowsByContext = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (optionRuleRes.data ?? []) as Array<Record<string, unknown>>) {
    const contextKey = `${String(row.channel_id ?? '').trim()}::${String(row.master_item_id ?? '').trim()}::${String(row.external_product_no ?? '').trim()}`;
    const prev = ruleRowsByContext.get(contextKey) ?? [];
    prev.push(row);
    ruleRowsByContext.set(contextKey, prev);
  }
  const colorComboRowsByChannel = new Map<string, Array<{ combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null }>>();
  for (const row of (colorComboRes.data ?? []) as Array<{ channel_id?: string | null; combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null }>) {
    const channelId = String(row.channel_id ?? "").trim();
    if (!channelId) continue;
    const bucket = colorComboRowsByChannel.get(channelId) ?? [];
    bucket.push(row);
    colorComboRowsByChannel.set(channelId, bucket);
  }

  const resolutionTraceLogs: Array<Record<string, unknown>> = [];
  const aliasHistoryCandidates: Array<{ channel_id: string; master_item_id: string; alias_external_product_no: string; canonical_external_product_no: string; external_variant_code: string }> = [];
  try {
    const validatedRows = rows.map((row) => {
      const pairKey = `${row.channel_id}::${row.master_item_id}`;
      const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
        activeProductNosByPair.get(pairKey) ?? [],
        row.external_product_no,
      );
      const contextKey = `${pairKey}::${canonicalExternalProductNo}`;
      const allowlist = mergeColorChoices(
        buildMappingOptionAllowlist(ruleRowsByContext.get(contextKey) ?? []),
        colorComboRowsByChannel.get(row.channel_id) ?? [],
      );
      const optionValidation = validateMappingOptionSelection({
        allowlist,
        current: row,
        previous: existingOptionByKey.get(`${row.channel_id}::${canonicalExternalProductNo}::${row.external_variant_code}`) ?? null,
      });
      if (!optionValidation.ok) {
        return jsonError(optionValidation.errors[0] ?? '옵션 상세 값이 저장된 설정 허용값과 일치하지 않습니다', 422, {
          code: 'OPTION_DETAIL_NOT_ALLOWED',
          errors: optionValidation.errors,
          channel_id: row.channel_id,
          master_item_id: row.master_item_id,
          external_product_no: canonicalExternalProductNo,
          external_variant_code: row.external_variant_code,
        });
      }
      const previous = existingOptionByKey.get(`${row.channel_id}::${canonicalExternalProductNo}::${row.external_variant_code}`) ?? null;
      if (canonicalExternalProductNo !== row.external_product_no) {
        aliasHistoryCandidates.push({
          channel_id: row.channel_id,
          master_item_id: row.master_item_id,
          alias_external_product_no: row.external_product_no,
          canonical_external_product_no: canonicalExternalProductNo,
          external_variant_code: row.external_variant_code,
        });
      }
      resolutionTraceLogs.push({
        policy_id: null,
        channel_id: row.channel_id,
        master_item_id: row.master_item_id,
        axis_key: "RESOLUTION_TRACE",
        axis_value: `${canonicalExternalProductNo}::${row.external_variant_code}`,
        action_type: previous ? "UPDATE" : "CREATE",
        old_row: previous,
        new_row: {
          requested_external_product_no: row.external_product_no,
          canonical_external_product_no: canonicalExternalProductNo,
          external_variant_code: row.external_variant_code,
          allowlist_counts: {
            materials: allowlist.materials.length,
            sizes_material_keys: Object.keys(allowlist.sizes_by_material ?? {}).length,
            colors: allowlist.colors.length,
            decors: allowlist.decors.length,
          },
          resolved_selection: optionValidation.value,
          option_price_mode: row.option_price_mode,
          sync_rule_set_id: row.sync_rule_set_id,
        },
        change_reason: changeReason || "BULK_MAPPING_SAVE",
        changed_by: changedBy,
      });
      return {
        ...row,
        external_product_no: canonicalExternalProductNo,
        current_product_sync_profile: row.current_product_sync_profile ?? (typeof previous?.current_product_sync_profile === "string" ? previous.current_product_sync_profile : null),
        option_material_code: optionValidation.value.option_material_code,
        option_color_code: optionValidation.value.option_color_code,
        option_decoration_code: optionValidation.value.option_decoration_code,
        option_size_value: optionValidation.value.option_size_value,
      };
    });

    for (const validatedRow of validatedRows) {
      if (validatedRow instanceof Response) return validatedRow;
    }
    rows = Array.from(new Map(
      validatedRows
        .filter((row): row is BulkRow => !(row instanceof Response))
        .map((row) => [`${row.channel_id}::${row.external_product_no}::${row.external_variant_code}`, row]),
    ).values());
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '옵션 상세 검증 실패', 500);
  }
  const projectedByKey = new Map<string, {
    channel_id: string;
    master_item_id: string;
    external_product_no: string;
    external_variant_code: string;
    option_price_mode: "SYNC" | "MANUAL";
    sync_rule_set_id: string | null;
    is_active: boolean;
  }>();
  for (const row of existingRows) {
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    if (!affectedPairSet.has(pairKey)) continue;
    const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
      activeProductNosByPair.get(pairKey) ?? [],
      row.external_product_no,
    );
    const key = `${row.channel_id}::${canonicalExternalProductNo}::${row.external_variant_code}`;
    projectedByKey.set(key, {
      channel_id: row.channel_id,
      master_item_id: row.master_item_id,
      external_product_no: canonicalExternalProductNo,
      external_variant_code: row.external_variant_code,
      option_price_mode: String(row.option_price_mode ?? "SYNC").toUpperCase() === "MANUAL" ? "MANUAL" : "SYNC",
      sync_rule_set_id: row.sync_rule_set_id,
      is_active: row.is_active !== false,
    });
  }
  for (const row of rows) {
    const key = `${row.channel_id}::${row.external_product_no}::${row.external_variant_code}`;
    projectedByKey.set(key, {
      channel_id: row.channel_id,
      master_item_id: row.master_item_id,
      external_product_no: row.external_product_no,
      external_variant_code: row.external_variant_code,
      option_price_mode: row.option_price_mode,
      sync_rule_set_id: row.sync_rule_set_id,
      is_active: row.is_active,
    });
  }

  const candidateRuleSetIdsByPair = new Map<string, Set<string>>();
  for (const row of projectedByKey.values()) {
    if (!row.is_active) continue;
    if (row.option_price_mode !== "SYNC") continue;
    const ruleSetId = String(row.sync_rule_set_id ?? "").trim();
    if (!ruleSetId) continue;
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const set = candidateRuleSetIdsByPair.get(pairKey) ?? new Set<string>();
    set.add(ruleSetId);
    candidateRuleSetIdsByPair.set(pairKey, set);
  }

  rows = rows.map((row) => {
    if (row.option_price_mode !== "SYNC") return row;
    const current = String(row.sync_rule_set_id ?? "").trim();
    if (current) return row;
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const candidates = candidateRuleSetIdsByPair.get(pairKey);
    if (!candidates || candidates.size !== 1) return row;
    const inferred = Array.from(candidates)[0] ?? "";
    return {
      ...row,
      sync_rule_set_id: inferred || null,
    };
  });

  for (const row of rows) {
    const key = `${row.channel_id}::${row.external_product_no}::${row.external_variant_code}`;
    projectedByKey.set(key, {
      channel_id: row.channel_id,
      master_item_id: row.master_item_id,
      external_product_no: row.external_product_no,
      external_variant_code: row.external_variant_code,
      option_price_mode: row.option_price_mode,
      sync_rule_set_id: row.sync_rule_set_id,
      is_active: row.is_active,
    });
  }

  for (const pairKey of affectedPairSet) {
    const [channelId, masterItemId] = pairKey.split("::");
    const syncRows = Array.from(projectedByKey.values()).filter((row) =>
      row.channel_id === channelId
      && row.master_item_id === masterItemId
      && row.is_active
      && row.option_price_mode === "SYNC",
    );
    const missingRuleSetRows = syncRows.filter((row) => !String(row.sync_rule_set_id ?? "").trim());
    if (missingRuleSetRows.length > 0) {
      return jsonError('SYNC 모드 매핑에 sync_rule_set_id가 필요합니다', 422, {
        code: "SOT_SYNC_RULESET_REQUIRED",
        channel_id: channelId,
        master_item_id: masterItemId,
        count: missingRuleSetRows.length,
      });
    }
    const syncRuleSetIds = new Set(syncRows.map((row) => String(row.sync_rule_set_id ?? "").trim()).filter(Boolean));
    if (syncRuleSetIds.size > 1) {
      return jsonError('동일 master_item_id의 SYNC 매핑은 sync_rule_set_id가 단일값이어야 합니다', 422, {
        code: "SOT_RULESET_INCONSISTENT",
        channel_id: channelId,
        master_item_id: masterItemId,
        sync_rule_set_ids: Array.from(syncRuleSetIds),
      });
    }
  }

  const { data, error } = await sb
    .from("sales_channel_product")
    .upsert(rows, { onConflict: "channel_id,external_product_no,external_variant_code" })
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, size_price_override_enabled, size_price_override_krw, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at");

  if (error) return jsonError(error.message ?? '일괄 매핑 저장 실패', 400);

  if (aliasHistoryCandidates.length > 0 && (data ?? []).length > 0) {
    const channelProductIdByCanonicalKey = new Map((data ?? []).map((row) => [
      `${String(row.channel_id ?? '').trim()}::${String(row.master_item_id ?? '').trim()}::${String(row.external_product_no ?? '').trim()}::${String(row.external_variant_code ?? '').trim()}`,
      String(row.channel_product_id ?? '').trim(),
    ]));
    const aliasRows = aliasHistoryCandidates.map((row) => ({
      channel_id: row.channel_id,
      canonical_channel_product_id: channelProductIdByCanonicalKey.get(`${row.channel_id}::${row.master_item_id}::${row.canonical_external_product_no}::${row.external_variant_code}`) || null,
      master_item_id: row.master_item_id,
      canonical_external_product_no: row.canonical_external_product_no,
      alias_external_product_no: row.alias_external_product_no,
      external_variant_code: row.external_variant_code,
      reason: 'BULK_MAPPING_CANONICALIZED',
    }));
    const aliasRes = await sb.from("sales_channel_product_alias_history").insert(aliasRows);
    if (aliasRes.error) {
      return jsonError(aliasRes.error.message ?? '별칭 이력 저장 실패', 500);
    }
  }

  if (resolutionTraceLogs.length > 0) {
    const traceLogRes = await sb.from("channel_option_value_policy_log").insert(resolutionTraceLogs);
    if (traceLogRes.error) {
      return jsonError(traceLogRes.error.message ?? "옵션 매핑 trace 로그 저장 실패", 500);
    }
  }

  return NextResponse.json(
    {
      data: data ?? [],
      requested: inputRows.length,
      deduplicated: rows.length,
      saved: (data ?? []).length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}



