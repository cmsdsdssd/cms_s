import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  let query = sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (channelId) query = query.eq("channel_id", channelId);
  if (masterItemId) query = query.eq("master_item_id", masterItemId);

  const { data, error } = await query;
  if (error) return jsonError(error.message ?? "매핑 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

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
  const optionColorCode = typeof body.option_color_code === "string" ? body.option_color_code.trim().toUpperCase() || null : null;
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

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);
  if (materialMultiplierOverride !== null && (!Number.isFinite(materialMultiplierOverride) || materialMultiplierOverride <= 0)) {
    return jsonError("material_multiplier_override must be > 0", 400);
  }
  if (sizeWeightDeltaG !== null && (!Number.isFinite(sizeWeightDeltaG) || sizeWeightDeltaG < -100 || sizeWeightDeltaG > 100)) {
    return jsonError("size_weight_delta_g must be between -100 and 100", 400);
  }
  if (optionPriceDeltaKrw !== null && (!Number.isFinite(optionPriceDeltaKrw) || optionPriceDeltaKrw < -100000000 || optionPriceDeltaKrw > 100000000)) {
    return jsonError("option_price_delta_krw must be between -100000000 and 100000000", 400);
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

  const payload = {
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
    mapping_source: ["MANUAL", "CSV", "AUTO"].includes(mappingSource) ? mappingSource : "MANUAL",
    is_active: isActive,
  };

  const { data, error } = await sb
    .from("sales_channel_product")
    .upsert(payload, { onConflict: "channel_id,external_product_no,external_variant_code" })
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "매핑 저장 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
