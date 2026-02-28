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
  type SyncRuleR4Row,
} from "@/lib/shop/sync-rules";
import { normalizeMaterialCode } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MappingRow = {
  channel_product_id: string;
  master_item_id: string;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
};

type CandidatePreview = {
  channel_product_id: string;
  master_item_id: string;
  option_material_code: string;
  effective_material_code: string;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  r1_delta_krw: number;
  r2_delta_krw: number;
  r3_delta_krw: number;
  r4_delta_krw: number;
  total_delta_krw: number;
  hit_r1_rule_id: string | null;
  hit_r2_rule_id: string | null;
  hit_r3_rule_id: string | null;
  hit_r4_rule_id: string | null;
  missing_rules: string[];
};

type MasterRow = {
  master_item_id: string;
  material_code_default: string | null;
  category_code: string | null;
  weight_default_g: number | null;
  deduction_weight_default_g: number | null;
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const ruleSetId = String(body.rule_set_id ?? "").trim();
  const channelProductId = typeof body.channel_product_id === "string" ? body.channel_product_id.trim() : "";
  const sampleLimitRaw = Number(body.sample_limit ?? 10);
  const sampleLimit = Number.isFinite(sampleLimitRaw) ? Math.max(1, Math.min(100, Math.floor(sampleLimitRaw))) : 10;
  if (!channelId) return jsonError("channel_id is required", 400);
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const mappingQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .eq("sync_rule_set_id", ruleSetId);
  if (channelProductId) mappingQuery.eq("channel_product_id", channelProductId);

  const [mapRes, masterRes, tickRes, policyRes, purityRes, r1Res, r2Res, r3Res, r4Res] = await Promise.all([
    mappingQuery,
    sb.from("cms_master_item").select("master_item_id, material_code_default, category_code, weight_default_g, deduction_weight_default_g"),
    sb.from("cms_v_market_tick_latest_gold_silver_ops_v1").select("gold_price_krw_per_g, silver_price_krw_per_g").maybeSingle(),
    sb.from("pricing_policy").select("option_18k_weight_multiplier").eq("channel_id", channelId).eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("cms_material_factor_config").select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis"),
    sb.from("sync_rule_r1_material_delta").select("rule_id, rule_set_id, source_material_code, target_material_code, match_category_code, weight_min_g, weight_max_g, option_weight_multiplier, rounding_unit, rounding_mode, priority, is_active").eq("rule_set_id", ruleSetId).eq("is_active", true).order("priority", { ascending: true }),
    sb.from("sync_rule_r2_size_weight").select("rule_id, rule_set_id, linked_r1_rule_id, match_material_code, match_category_code, weight_min_g, weight_max_g, option_range_expr, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active").eq("rule_set_id", ruleSetId).eq("is_active", true).order("priority", { ascending: true }),
    sb.from("sync_rule_r3_color_margin").select("rule_id, rule_set_id, color_code, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active").eq("rule_set_id", ruleSetId).eq("is_active", true).order("priority", { ascending: true }),
    sb.from("sync_rule_r4_decoration").select("rule_id, rule_set_id, linked_r1_rule_id, match_decoration_code, match_material_code, match_color_code, match_category_code, delta_krw, rounding_unit, rounding_mode, priority, is_active").eq("rule_set_id", ruleSetId).eq("is_active", true).order("priority", { ascending: true }),
  ]);

  for (const r of [mapRes, masterRes, tickRes, policyRes, purityRes, r1Res, r2Res, r3Res, r4Res]) {
    if (r.error) return jsonError(r.error.message ?? "preview 조회 실패", 500);
  }

  const mappings = (mapRes.data ?? []) as MappingRow[];
  const masterMap = new Map((masterRes.data ?? []).map((r) => [String((r as MasterRow).master_item_id), r as MasterRow]));
  const purityMap = buildMaterialPurityMap((purityRes.data ?? []).map((r) => ({
    material_code: normalizeMaterialCode(String(r.material_code ?? "")),
    purity_rate: Number(r.purity_rate ?? 0),
    material_adjust_factor: Number(r.material_adjust_factor ?? Number.NaN),
    gold_adjust_factor: Number(r.gold_adjust_factor ?? Number.NaN),
  })));
  const materialAdjustMap = new Map<string, number>();
  const materialBasisMap = new Map<string, "GOLD" | "SILVER" | "NONE">();
  for (const row of purityRes.data ?? []) {
    const code = normalizeMaterialCode(String(row.material_code ?? ""));
    if (!code) continue;
    const adjust = Number(row.material_adjust_factor ?? Number.NaN);
    materialAdjustMap.set(code, Number.isFinite(adjust) && adjust > 0 ? adjust : 1);
    const basisRaw = String(row.price_basis ?? "").toUpperCase();
    const basis = basisRaw === "SILVER" ? "SILVER" : basisRaw === "NONE" ? "NONE" : "GOLD";
    materialBasisMap.set(code, basis);
  }
  const tickByMaterialCode = (materialCodeRaw: string): number => {
    const code = normalizeMaterialCode(materialCodeRaw);
    const basis = materialBasisMap.get(code);
    if (basis === "NONE") return 0;
    if (basis === "SILVER") return silverTick;
    if (basis === "GOLD") return goldTick;
    return isSilverMaterial(code) ? silverTick : goldTick;
  };

  const goldTick = toNum(tickRes.data?.gold_price_krw_per_g, 0);
  const silverTick = toNum(tickRes.data?.silver_price_krw_per_g, 0);
  const default18kMul = Math.max(toNum(policyRes.data?.option_18k_weight_multiplier, 1.2), 0.000001);

  const r1Rules = (r1Res.data ?? []) as SyncRuleR1Row[];
  const r2Rules = (r2Res.data ?? []) as SyncRuleR2Row[];
  const r3Rules = (r3Res.data ?? []) as SyncRuleR3Row[];
  const r4Rules = (r4Res.data ?? []) as SyncRuleR4Row[];

  const matchedSamples: CandidatePreview[] = [];
  const unmatchedSamples: CandidatePreview[] = [];
  let affected = 0;
  let blocked = 0;

  for (const m of mappings) {
    const master = masterMap.get(m.master_item_id);
    if (!master) continue;

    const baseMaterial = normalizeMaterialCode(String(master.material_code_default ?? ""));
    const targetMaterial = normalizeMaterialCode(String(m.option_material_code ?? master.material_code_default ?? ""));
    const categoryCode = String(master.category_code ?? "").trim();
    const netWeight = Math.max(toNum(master.weight_default_g, 0) - toNum(master.deduction_weight_default_g, 0), 0);
    const sizeValue = m.option_size_value == null ? null : Number(m.option_size_value);
    const colorCode = String(m.option_color_code ?? "").trim().toUpperCase();
    const decorationCode = String(m.option_decoration_code ?? "").trim().toUpperCase();

    const basePurity = getMaterialPurityFromMap(purityMap, baseMaterial, 0);
    const targetPurity = getMaterialPurityFromMap(purityMap, targetMaterial, 0);
    const baseAdjust = materialAdjustMap.get(baseMaterial) ?? 1;
    const targetAdjust = materialAdjustMap.get(targetMaterial) ?? 1;

    let r1Delta = 0;
    let r2Delta = 0;
    let r3Delta = 0;
    let r4Delta = 0;
    let effectiveMaterialCode = targetMaterial || baseMaterial;
    let hitR1: string | null = null;
    let hitR2: string | null = null;
    let hitR3: string | null = null;
    let hitR4: string | null = null;

    for (const rule of r1Rules) {
      const src = normalizeMaterialCode(String(rule.source_material_code ?? ""));
      const tgt = normalizeMaterialCode(String(rule.target_material_code ?? ""));
      const cat = String(rule.match_category_code ?? "").trim();
      if (src && src !== baseMaterial) continue;
      if (tgt && tgt !== targetMaterial) continue;
      if (cat && cat !== categoryCode) continue;
      if (!isRangeMatched(rule.weight_min_g, rule.weight_max_g, netWeight)) continue;

      const mul = Math.max(toNum(rule.option_weight_multiplier, default18kMul), 0.000001);
      const sourceTick = tickByMaterialCode(baseMaterial);
      const targetTick = tickByMaterialCode(targetMaterial);
      const baseMaterialPrice = basePurity * baseAdjust * netWeight * sourceTick;
      const targetMaterialPrice = targetPurity * targetAdjust * (netWeight * mul) * targetTick;
      r1Delta = roundByRule(targetMaterialPrice - baseMaterialPrice, rule.rounding_unit, rule.rounding_mode);
      hitR1 = rule.rule_id;
      effectiveMaterialCode = tgt || targetMaterial || baseMaterial;
      break;
    }

    for (const rule of r2Rules) {
      if (rule.linked_r1_rule_id && hitR1 !== rule.linked_r1_rule_id) continue;
      const mat = normalizeMaterialCode(String(rule.match_material_code ?? ""));
      const cat = String(rule.match_category_code ?? "").trim();
      if (mat && mat !== effectiveMaterialCode) continue;
      if (cat && cat !== categoryCode) continue;
      if (netWeight < Number(rule.weight_min_g) || netWeight > Number(rule.weight_max_g)) continue;
      const hasMarginBand = rule.margin_min_krw !== null && rule.margin_max_krw !== null;
      if (hasMarginBand) {
        if (r1Delta < Number(rule.margin_min_krw) || r1Delta > Number(rule.margin_max_krw)) continue;
      } else {
        const matcher = parseOptionRangeExpr(rule.option_range_expr);
        if (!matcher(sizeValue)) continue;
      }

      r2Delta = roundByRule(Number(rule.delta_krw ?? 0), rule.rounding_unit, rule.rounding_mode);
      hitR2 = rule.rule_id;
      break;
    }

    const preR3Margin = r1Delta + r2Delta;
    for (const rule of r3Rules) {
      const cc = String(rule.color_code ?? "").trim().toUpperCase();
      if (cc && cc !== colorCode) continue;
      if (preR3Margin < Number(rule.margin_min_krw) || preR3Margin > Number(rule.margin_max_krw)) continue;

      r3Delta = roundByRule(Number(rule.delta_krw ?? 0), rule.rounding_unit, rule.rounding_mode);
      hitR3 = rule.rule_id;
      break;
    }

    for (const rule of r4Rules) {
      if (rule.linked_r1_rule_id && hitR1 !== rule.linked_r1_rule_id) continue;
      const deco = String(rule.match_decoration_code ?? "").trim().toUpperCase();
      const mat = normalizeMaterialCode(String(rule.match_material_code ?? ""));
      const clr = String(rule.match_color_code ?? "").trim().toUpperCase();
      const cat = String(rule.match_category_code ?? "").trim();
      if (deco && deco !== decorationCode) continue;
      if (mat && mat !== effectiveMaterialCode) continue;
      if (clr && clr !== colorCode) continue;
      if (cat && cat !== categoryCode) continue;

      r4Delta = roundByRule(Number(rule.delta_krw ?? 0), rule.rounding_unit, rule.rounding_mode);
      hitR4 = rule.rule_id;
      break;
    }

    const total = r1Delta + r2Delta + r3Delta + r4Delta;
    const missingRules: string[] = [];
    if (!hitR1) missingRules.push("R1");
    if (!hitR2) missingRules.push("R2");
    if (!hitR3) missingRules.push("R3");
    if (!hitR4) missingRules.push("R4");

    const candidate: CandidatePreview = {
      channel_product_id: m.channel_product_id,
      master_item_id: m.master_item_id,
      option_material_code: targetMaterial,
      effective_material_code: effectiveMaterialCode,
      option_color_code: colorCode || null,
      option_decoration_code: decorationCode || null,
      option_size_value: sizeValue,
      r1_delta_krw: r1Delta,
      r2_delta_krw: r2Delta,
      r3_delta_krw: r3Delta,
      r4_delta_krw: r4Delta,
      total_delta_krw: total,
      hit_r1_rule_id: hitR1,
      hit_r2_rule_id: hitR2,
      hit_r3_rule_id: hitR3,
      hit_r4_rule_id: hitR4,
      missing_rules: missingRules,
    };

    if (missingRules.length === 0) {
      affected += 1;
      if (matchedSamples.length < sampleLimit) matchedSamples.push(candidate);
    } else {
      blocked += 1;
      if (unmatchedSamples.length < sampleLimit) unmatchedSamples.push(candidate);
    }
  }

  return NextResponse.json({
    data: {
      channel_id: channelId,
      rule_set_id: ruleSetId,
      total_candidates: mappings.length,
      affected,
      blocked,
      matched_sample_count: matchedSamples.length,
      unmatched_sample_count: unmatchedSamples.length,
      matched_samples: matchedSamples,
      unmatched_samples: unmatchedSamples,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
