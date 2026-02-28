import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL";
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
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
  const optionColorCode = typeof body.option_color_code === "string" ? body.option_color_code.trim().toUpperCase() || null : null;
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

  if (
    materialMultiplierOverride !== null
    && (!Number.isFinite(materialMultiplierOverride) || materialMultiplierOverride <= 0)
  ) {
    return { ok: false, error: "material_multiplier_override must be > 0" };
  }
  if (sizeWeightDeltaG !== null && (!Number.isFinite(sizeWeightDeltaG) || sizeWeightDeltaG < -100 || sizeWeightDeltaG > 100)) {
    return { ok: false, error: "size_weight_delta_g must be between -100 and 100" };
  }
  if (optionPriceDeltaKrw !== null && (!Number.isFinite(optionPriceDeltaKrw) || optionPriceDeltaKrw < -100000000 || optionPriceDeltaKrw > 100000000)) {
    return { ok: false, error: "option_price_delta_krw must be between -100000000 and 100000000" };
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
      option_price_delta_krw: optionPriceDeltaKrw,
      option_price_mode: optionPriceMode,
      option_manual_target_krw: optionManualTargetKrw,
      include_master_plating_labor: includeMasterPlatingLabor,
      sync_rule_material_enabled: syncRuleMaterialEnabled,
      sync_rule_weight_enabled: syncRuleWeightEnabled,
      sync_rule_plating_enabled: syncRulePlatingEnabled,
      sync_rule_decoration_enabled: syncRuleDecorationEnabled,
      sync_rule_margin_rounding_enabled: syncRuleMarginRoundingEnabled,
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
  const rows = Array.from(dedup.values());

  const { data, error } = await sb
    .from("sales_channel_product")
    .upsert(rows, { onConflict: "channel_id,external_product_no,external_variant_code" })
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at");

  if (error) return jsonError(error.message ?? "일괄 매핑 저장 실패", 400);

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
