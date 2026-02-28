import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import {
  buildMaterialPurityMap,
  getMaterialPurityFromMap,
  isRangeMatched,
  isSilverMaterial,
  parseOptionRangeExpr,
  roundByRule,
  toNum,
  type SyncRuleR1Row,
  type SyncRuleR2Row,
  type SyncRuleR3Row,
} from "@/lib/shop/sync-rules";
import { normalizeMaterialCode } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelProductId = String(id ?? "").trim();
  if (!channelProductId) return jsonError("channel product id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};

  if (body.master_item_id !== undefined) patch.master_item_id = String(body.master_item_id ?? "").trim();
  if (body.external_product_no !== undefined) patch.external_product_no = String(body.external_product_no ?? "").trim();
  if (body.external_variant_code !== undefined) patch.external_variant_code = String(body.external_variant_code ?? "").trim();
  if (body.sync_rule_set_id !== undefined) patch.sync_rule_set_id = typeof body.sync_rule_set_id === "string" ? body.sync_rule_set_id.trim() || null : null;
  if (body.option_material_code !== undefined) patch.option_material_code = typeof body.option_material_code === "string" ? normalizeMaterialCode(body.option_material_code) || null : null;
  if (body.option_color_code !== undefined) patch.option_color_code = typeof body.option_color_code === "string" ? body.option_color_code.trim().toUpperCase() || null : null;
  if (body.option_decoration_code !== undefined) patch.option_decoration_code = typeof body.option_decoration_code === "string" ? body.option_decoration_code.trim().toUpperCase() || null : null;
  if (body.option_size_value !== undefined) {
    patch.option_size_value =
      body.option_size_value === null || body.option_size_value === ""
        ? null
        : Number(body.option_size_value);
  }
  if (body.mapping_source !== undefined) patch.mapping_source = String(body.mapping_source ?? "MANUAL").trim().toUpperCase();
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;
  if (body.include_master_plating_labor !== undefined) patch.include_master_plating_labor = body.include_master_plating_labor === true;
  if (body.sync_rule_material_enabled !== undefined) patch.sync_rule_material_enabled = body.sync_rule_material_enabled === true;
  if (body.sync_rule_weight_enabled !== undefined) patch.sync_rule_weight_enabled = body.sync_rule_weight_enabled === true;
  if (body.sync_rule_plating_enabled !== undefined) patch.sync_rule_plating_enabled = body.sync_rule_plating_enabled === true;
  if (body.sync_rule_decoration_enabled !== undefined) patch.sync_rule_decoration_enabled = body.sync_rule_decoration_enabled === true;
  if (body.sync_rule_margin_rounding_enabled !== undefined) patch.sync_rule_margin_rounding_enabled = body.sync_rule_margin_rounding_enabled === true;

  if (body.material_multiplier_override !== undefined) {
    patch.material_multiplier_override =
      body.material_multiplier_override === null || body.material_multiplier_override === ""
        ? null
        : Number(body.material_multiplier_override);
  }
  if (body.size_weight_delta_g !== undefined) {
    patch.size_weight_delta_g =
      body.size_weight_delta_g === null || body.size_weight_delta_g === ""
        ? null
        : Number(body.size_weight_delta_g);
  }
  if (body.option_price_delta_krw !== undefined) {
    patch.option_price_delta_krw =
      body.option_price_delta_krw === null || body.option_price_delta_krw === ""
        ? null
        : Number(body.option_price_delta_krw);
  }
  if (body.option_price_mode !== undefined) patch.option_price_mode = String(body.option_price_mode ?? "SYNC").trim().toUpperCase();
  if (body.option_manual_target_krw !== undefined) {
    patch.option_manual_target_krw =
      body.option_manual_target_krw === null || body.option_manual_target_krw === ""
        ? null
        : Number(body.option_manual_target_krw);
  }

  const materialMultiplierOverride = patch.material_multiplier_override as number | null | undefined;
  if (materialMultiplierOverride !== undefined && materialMultiplierOverride !== null && (!Number.isFinite(materialMultiplierOverride) || materialMultiplierOverride <= 0)) {
    return jsonError("material_multiplier_override must be > 0", 400);
  }
  const sizeWeightDeltaG = patch.size_weight_delta_g as number | null | undefined;
  if (sizeWeightDeltaG !== undefined && sizeWeightDeltaG !== null && (!Number.isFinite(sizeWeightDeltaG) || sizeWeightDeltaG < -100 || sizeWeightDeltaG > 100)) {
    return jsonError("size_weight_delta_g must be between -100 and 100", 400);
  }
  const optionPriceDeltaKrw = patch.option_price_delta_krw as number | null | undefined;
  if (optionPriceDeltaKrw !== undefined && optionPriceDeltaKrw !== null && (!Number.isFinite(optionPriceDeltaKrw) || optionPriceDeltaKrw < -100000000 || optionPriceDeltaKrw > 100000000)) {
    return jsonError("option_price_delta_krw must be between -100000000 and 100000000", 400);
  }
  const optionPriceMode = patch.option_price_mode as string | undefined;
  if (optionPriceMode !== undefined && !["SYNC", "MANUAL"].includes(optionPriceMode)) {
    return jsonError("option_price_mode must be SYNC or MANUAL", 400);
  }
  const optionManualTargetKrw = patch.option_manual_target_krw as number | null | undefined;
  if (optionManualTargetKrw !== undefined && optionManualTargetKrw !== null && (!Number.isFinite(optionManualTargetKrw) || optionManualTargetKrw < 0 || optionManualTargetKrw > 1000000000)) {
    return jsonError("option_manual_target_krw must be between 0 and 1000000000", 400);
  }
  if (optionPriceMode === "MANUAL" && (optionManualTargetKrw === null || optionManualTargetKrw === undefined)) {
    return jsonError("option_manual_target_krw is required when option_price_mode is MANUAL", 400);
  }
  const optionSizeValue = patch.option_size_value as number | null | undefined;
  if (optionSizeValue !== undefined && optionSizeValue !== null && (!Number.isFinite(optionSizeValue) || optionSizeValue < 0)) {
    return jsonError("option_size_value must be >= 0", 400);
  }
  const syncRuleSetId = patch.sync_rule_set_id as string | null | undefined;
  if (optionPriceMode === "SYNC" && (syncRuleSetId === null || syncRuleSetId === undefined || syncRuleSetId === "")) {
    return jsonError("sync_rule_set_id is required when option_price_mode is SYNC", 400);
  }

  if (optionPriceMode === "SYNC") {
    const currentRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id, channel_id, master_item_id, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, size_weight_delta_g, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled")
      .eq("channel_product_id", channelProductId)
      .maybeSingle();
    if (currentRes.error) return jsonError(currentRes.error.message ?? "기존 옵션 조회 실패", 500);
    const current = currentRes.data;
    if (!current) return jsonError("channel product not found", 404);

    const effectiveRuleSetId = String((syncRuleSetId ?? current.sync_rule_set_id ?? "")).trim();
    const requestedMaterial = normalizeMaterialCode(String((patch.option_material_code ?? current.option_material_code ?? "")));
    const effectiveColor = String((patch.option_color_code ?? current.option_color_code ?? "")).trim().toUpperCase();
    const effectiveSizeRaw = patch.option_size_value ?? current.option_size_value;
    const effectiveSize = effectiveSizeRaw === null || effectiveSizeRaw === undefined || effectiveSizeRaw === "" ? null : Number(effectiveSizeRaw);

    const enableR1 = (patch.sync_rule_material_enabled ?? current.sync_rule_material_enabled) !== false;
    const enableR2 = (patch.sync_rule_weight_enabled ?? current.sync_rule_weight_enabled) !== false;
    const enableR3 = (patch.sync_rule_plating_enabled ?? current.sync_rule_plating_enabled) !== false;

    if (!effectiveRuleSetId) return jsonError("SYNC 모드에서는 룰셋이 필요합니다", 400);

    const effectiveSizeWeightDeltaRaw = patch.size_weight_delta_g ?? current.size_weight_delta_g;
    const effectiveSizeWeightDelta = effectiveSizeWeightDeltaRaw === null || effectiveSizeWeightDeltaRaw === undefined
      ? 0
      : Number(effectiveSizeWeightDeltaRaw);

    const masterRes = await sb
      .from("cms_master_item")
      .select("master_item_id, material_code_default, category_code, weight_default_g, deduction_weight_default_g")
      .eq("master_item_id", String(current.master_item_id))
      .maybeSingle();
    if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 조회 실패", 500);
    const master = masterRes.data;
    if (!master) return jsonError("master item not found", 404);

    const [policyRes, materialCfgRes, tickRes] = await Promise.all([
      sb
        .from("pricing_policy")
        .select("option_18k_weight_multiplier")
        .eq("channel_id", String(current.channel_id ?? ""))
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("cms_material_factor_config")
        .select("material_code, purity_rate, material_adjust_factor, price_basis"),
      sb
        .from("cms_v_market_tick_latest_gold_silver_ops_v1")
        .select("gold_price_krw_per_g, silver_price_krw_per_g")
        .maybeSingle(),
    ]);
    if (policyRes.error) return jsonError(policyRes.error.message ?? "정책 조회 실패", 500);
    if (materialCfgRes.error) return jsonError(materialCfgRes.error.message ?? "소재 설정 조회 실패", 500);
    if (tickRes.error) return jsonError(tickRes.error.message ?? "시세 조회 실패", 500);

    const purityMap = buildMaterialPurityMap(
      (materialCfgRes.data ?? []).map((r) => ({
        material_code: normalizeMaterialCode(String(r.material_code ?? "")),
        purity_rate: Number(r.purity_rate ?? 0),
        material_adjust_factor: Number(r.material_adjust_factor ?? Number.NaN),
        gold_adjust_factor: Number(r.material_adjust_factor ?? Number.NaN),
      })),
    );
    const materialAdjustMap = new Map<string, number>();
    const materialBasisMap = new Map<string, "GOLD" | "SILVER" | "NONE">();
    for (const row of materialCfgRes.data ?? []) {
      const code = normalizeMaterialCode(String(row.material_code ?? ""));
      if (!code) continue;
      const adjust = Number(row.material_adjust_factor ?? Number.NaN);
      materialAdjustMap.set(code, Number.isFinite(adjust) && adjust > 0 ? adjust : 1);
      const basisRaw = String(row.price_basis ?? "").toUpperCase();
      const basis = basisRaw === "SILVER" ? "SILVER" : basisRaw === "NONE" ? "NONE" : "GOLD";
      materialBasisMap.set(code, basis);
    }
    const goldTick = toNum(tickRes.data?.gold_price_krw_per_g, 0);
    const silverTick = toNum(tickRes.data?.silver_price_krw_per_g, 0);
    const tickByMaterialCode = (materialCodeRaw: string) => {
      const code = normalizeMaterialCode(materialCodeRaw);
      const basis = materialBasisMap.get(code);
      if (basis === "NONE") return 0;
      if (basis === "SILVER") return silverTick;
      if (basis === "GOLD") return goldTick;
      return isSilverMaterial(code) ? silverTick : goldTick;
    };

    const defaultNetWeight = Math.max(Number(master.weight_default_g ?? 0) - Number(master.deduction_weight_default_g ?? 0), 0);
    const netWeight = Math.max(defaultNetWeight + (Number.isFinite(effectiveSizeWeightDelta) ? effectiveSizeWeightDelta : 0), 0);
    const baseMaterial = normalizeMaterialCode(String(master.material_code_default ?? ""));
    const category = String(master.category_code ?? "").trim();
    const candidateMaterial = requestedMaterial || baseMaterial;

    const [r1Res, r2Res, r3Res, r4Res] = await Promise.all([
      sb.from("sync_rule_r1_material_delta").select("rule_id, source_material_code, target_material_code, match_category_code, weight_min_g, weight_max_g, priority, is_active").eq("rule_set_id", effectiveRuleSetId).eq("is_active", true).order("priority", { ascending: true }),
      sb.from("sync_rule_r2_size_weight").select("rule_id, linked_r1_rule_id, match_material_code, match_category_code, weight_min_g, weight_max_g, option_range_expr, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active").eq("rule_set_id", effectiveRuleSetId).eq("is_active", true).order("priority", { ascending: true }),
      sb.from("sync_rule_r3_color_margin").select("rule_id, color_code, margin_min_krw, margin_max_krw, priority, is_active").eq("rule_set_id", effectiveRuleSetId).eq("is_active", true).order("priority", { ascending: true }),
      sb.from("sync_rule_r4_decoration").select("rule_id, linked_r1_rule_id, match_decoration_code, match_material_code, match_color_code, match_category_code, priority, is_active").eq("rule_set_id", effectiveRuleSetId).eq("is_active", true).order("priority", { ascending: true }),
    ]);

    if (r1Res.error) return jsonError(r1Res.error.message ?? "R1 룰 조회 실패", 500);
    if (r2Res.error) return jsonError(r2Res.error.message ?? "R2 룰 조회 실패", 500);
    if (r3Res.error) return jsonError(r3Res.error.message ?? "R3 룰 조회 실패", 500);
    if (r4Res.error) return jsonError(r4Res.error.message ?? "R4 룰 조회 실패", 500);

    let hitR1RuleId: string | null = null;
    let effectiveMaterialCode = candidateMaterial;
    let r1Delta = 0;
    let r2Delta = 0;

    const basePurity = getMaterialPurityFromMap(purityMap, baseMaterial, 0);
    const targetPurity = getMaterialPurityFromMap(purityMap, candidateMaterial, 0);
    const baseAdjust = materialAdjustMap.get(baseMaterial) ?? 1;
    const targetAdjust = materialAdjustMap.get(candidateMaterial) ?? 1;
    const default18kMul = Math.max(toNum(policyRes.data?.option_18k_weight_multiplier, 1.2), 0.000001);

    const hasR1Match = !enableR1 || (r1Res.data ?? []).some((rule) => {
      const r = rule as SyncRuleR1Row;
      const src = normalizeMaterialCode(String(r.source_material_code ?? ""));
      const tgt = normalizeMaterialCode(String(r.target_material_code ?? ""));
      const cat = String(r.match_category_code ?? "").trim();
      if (src && src !== baseMaterial) return false;
      if (tgt && tgt !== candidateMaterial) return false;
      if (cat && cat !== category) return false;
      const matched = isRangeMatched(r.weight_min_g, r.weight_max_g, netWeight);
      if (matched) {
        const mul = Math.max(toNum(r.option_weight_multiplier, default18kMul), 0.000001);
        const sourceTick = tickByMaterialCode(baseMaterial);
        const targetTick = tickByMaterialCode(candidateMaterial);
        const sourceWeight = defaultNetWeight;
        const targetWeight = defaultNetWeight * mul;
        const baseMaterialPrice = basePurity * baseAdjust * sourceWeight * sourceTick;
        const targetMaterialPrice = targetPurity * targetAdjust * targetWeight * targetTick;
        r1Delta = roundByRule(targetMaterialPrice - baseMaterialPrice, r.rounding_unit, r.rounding_mode);
        hitR1RuleId = r.rule_id;
        effectiveMaterialCode = tgt || candidateMaterial;
      }
      return matched;
    });

    const hasR2Match = !enableR2 || (r2Res.data ?? []).some((rule) => {
      const r = rule as SyncRuleR2Row;
      if (r.linked_r1_rule_id && hitR1RuleId !== r.linked_r1_rule_id) return false;
      const mat = normalizeMaterialCode(String(r.match_material_code ?? ""));
      const cat = String(r.match_category_code ?? "").trim();
      if (mat && mat !== effectiveMaterialCode) return false;
      if (cat && cat !== category) return false;
      if (netWeight < Number(r.weight_min_g) || netWeight > Number(r.weight_max_g)) return false;
      const hasMarginBand = r.margin_min_krw !== null && r.margin_max_krw !== null;
      const matched = hasMarginBand
        ? (r1Delta >= Number(r.margin_min_krw) && r1Delta <= Number(r.margin_max_krw))
        : parseOptionRangeExpr(r.option_range_expr)(effectiveSize);
      if (matched) {
        r2Delta = roundByRule(Number(r.delta_krw ?? 0), r.rounding_unit, r.rounding_mode);
      }
      return matched;
    });

    const hasR3Match = !enableR3 || (r3Res.data ?? []).some((rule) => {
      const r = rule as SyncRuleR3Row;
      const cc = String(r.color_code ?? "").trim().toUpperCase();
      if (cc && cc !== effectiveColor) return false;
      const preR3Margin = r1Delta + r2Delta;
      return preR3Margin >= Number(r.margin_min_krw) && preR3Margin <= Number(r.margin_max_krw);
    });

    const effectiveDecoration = String((patch.option_decoration_code ?? current.option_decoration_code ?? "")).trim().toUpperCase();
    const enableR4 = (patch.sync_rule_decoration_enabled ?? current.sync_rule_decoration_enabled) !== false;

    const hasR4Match = !enableR4 || (r4Res.data ?? []).some((rule) => {
      const linkedR1 = String((rule as { linked_r1_rule_id?: string | null }).linked_r1_rule_id ?? "").trim();
      if (linkedR1 && hitR1RuleId !== linkedR1) return false;
      const decoration = String((rule as { match_decoration_code?: string | null }).match_decoration_code ?? "").trim().toUpperCase();
      const mat = normalizeMaterialCode(String((rule as { match_material_code?: string | null }).match_material_code ?? ""));
      const clr = String((rule as { match_color_code?: string | null }).match_color_code ?? "").trim().toUpperCase();
      const cat = String((rule as { match_category_code?: string | null }).match_category_code ?? "").trim();
      if (decoration && decoration !== effectiveDecoration) return false;
      if (mat && mat !== effectiveMaterialCode) return false;
      if (clr && clr !== effectiveColor) return false;
      if (cat && cat !== category) return false;
      return true;
    });

    const missing: string[] = [];
    if (!hasR1Match) missing.push("R1");
    if (!hasR2Match) missing.push("R2");
    if (!hasR3Match) missing.push("R3");
    if (!hasR4Match) missing.push("R4");
    if (!hasR1Match) {
      return jsonError("R1 룰이 등록/매칭되지 않아 동기화할 수 없습니다", 422, { code: "SYNC_RULE_R1_REQUIRED", missing_rules: missing });
    }
    if (!hasR2Match || !hasR3Match || !hasR4Match) {
      return jsonError("등록된 룰이 없어 동기화할 수 없습니다", 422, { code: "SYNC_RULE_OUT_OF_RANGE", missing_rules: missing });
    }
  }

  const mappingSource = patch.mapping_source as string | undefined;
  if (mappingSource !== undefined && !["MANUAL", "CSV", "AUTO"].includes(mappingSource)) {
    return jsonError("mapping_source must be MANUAL/CSV/AUTO", 400);
  }
  if (Object.keys(patch).length === 0) return jsonError("update fields are required", 400);

  const { data, error } = await sb
    .from("sales_channel_product")
    .update(patch)
    .eq("channel_product_id", channelProductId)
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled, mapping_source, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "매핑 수정 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelProductId = String(id ?? "").trim();
  if (!channelProductId) return jsonError("channel product id is required", 400);

  const { error } = await sb
    .from("sales_channel_product")
    .delete()
    .eq("channel_product_id", channelProductId);

  if (error) return jsonError(error.message ?? "매핑 삭제 실패", 400);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
