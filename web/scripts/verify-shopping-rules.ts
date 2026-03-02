import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { POST as recomputePost } from "../src/app/api/pricing/recompute/route";
import { POST as previewPost } from "../src/app/api/sync-rules/preview/route";
import { buildMaterialPurityMap, getMaterialPurityFromMap, isSilverMaterial, roundByRule } from "../src/lib/shop/sync-rules";
import { normalizeMaterialCode } from "../src/lib/material-factors";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !key) {
  throw new Error("Missing Supabase env");
}

const sb = createClient(url, key);

const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const fetchLatestSnapshot = async (channelProductId: string) => {
  const res = await sb
    .from("pricing_snapshot")
    .select("snapshot_id, channel_product_id, computed_at, breakdown_json")
    .eq("channel_product_id", channelProductId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw new Error(`snapshot query failed: ${res.error.message}`);
  return res.data;
};

const recompute = async (channelId: string, masterItemId: string) => {
  const req = new Request("http://local/api/pricing/recompute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel_id: channelId, master_item_ids: [masterItemId] }),
  });
  const res = await recomputePost(req);
  const json = await res.json();
  if (!res.ok) throw new Error(`recompute failed: ${JSON.stringify(json)}`);
  return json as { ok: boolean; blocked_by_missing_rules_count?: number; blocked_by_missing_rules?: unknown[] };
};

const preview = async (channelId: string, ruleSetId: string, channelProductId: string) => {
  const req = new Request("http://local/api/sync-rules/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel_id: channelId, rule_set_id: ruleSetId, channel_product_id: channelProductId, sample_limit: 1 }),
  });
  const res = await previewPost(req);
  const json = await res.json();
  return { ok: res.ok, status: res.status, body: json as Record<string, unknown> };
};

const updateMapping = async (channelProductId: string, patch: Record<string, unknown>) => {
  const res = await sb
    .from("sales_channel_product")
    .update(patch)
    .eq("channel_product_id", channelProductId)
    .select("channel_product_id")
    .single();
  if (res.error) throw new Error(`mapping update failed: ${res.error.message}`);
};

const main = async () => {
  const channelRes = await sb
    .from("sales_channel")
    .select("channel_id, channel_name")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (channelRes.error) throw new Error(channelRes.error.message);
  const channelId = channelRes.data.channel_id as string;

  const masterRes = await sb
    .from("v_cms_master_item_lookup")
    .select("master_item_id, model_name, material_code_default, category_code, weight_default_g, deduction_weight_default_g")
    .eq("model_name", "MS-553유색-R")
    .limit(1)
    .single();
  if (masterRes.error) throw new Error(masterRes.error.message);
  const masterItemId = masterRes.data.master_item_id as string;

  const cpRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (cpRes.error) throw new Error(cpRes.error.message);
  const channelProductId = cpRes.data.channel_product_id as string;

  const policyRes = await sb
    .from("pricing_policy")
    .select("option_18k_weight_multiplier")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policyRes.error) throw new Error(policyRes.error.message);
  const option18kMul = Math.max(toNum(policyRes.data?.option_18k_weight_multiplier, 1.2), 0.000001);

  const suffix = String(Date.now());
  const rs1Name = `VERIFY-MSR553-${suffix}`;
  const rs2Name = `VERIFY-R2RANGE-${suffix}`;

  const rs1Res = await sb
    .from("sync_rule_set")
    .insert({ channel_id: channelId, name: rs1Name, description: "verification material/plating/decoration", is_active: true })
    .select("rule_set_id")
    .single();
  if (rs1Res.error) throw new Error(rs1Res.error.message);
  const rs1 = rs1Res.data.rule_set_id as string;

  const rs2Res = await sb
    .from("sync_rule_set")
    .insert({ channel_id: channelId, name: rs2Name, description: "verification size range", is_active: true })
    .select("rule_set_id")
    .single();
  if (rs2Res.error) throw new Error(rs2Res.error.message);
  const rs2 = rs2Res.data.rule_set_id as string;

  // Ruleset 1: R1(14->18), R3(W +4000), R4(decoration +3300)
  const r1Res = await sb
    .from("sync_rule_r1_material_delta")
    .insert({
      rule_set_id: rs1,
      source_material_code: "14",
      target_material_code: "18",
      match_category_code: null,
      weight_min_g: 0,
      weight_max_g: 999999,
      option_weight_multiplier: 1,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    })
    .select("rule_id")
    .single();
  if (r1Res.error) throw new Error(r1Res.error.message);

  const r3Res = await sb
    .from("sync_rule_r3_color_margin")
    .insert({
      rule_set_id: rs1,
      color_code: "W",
      margin_min_krw: 0,
      margin_max_krw: 0,
      delta_krw: 4000,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    })
    .select("rule_id")
    .single();
  if (r3Res.error) throw new Error(r3Res.error.message);

  const r4Res = await sb
    .from("sync_rule_r4_decoration")
    .insert({
      rule_set_id: rs1,
      linked_r1_rule_id: null,
      match_decoration_code: "MS-553유색-R",
      match_material_code: null,
      match_color_code: null,
      match_category_code: null,
      delta_krw: 3300,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    })
    .select("rule_id")
    .single();
  if (r4Res.error) throw new Error(r4Res.error.message);

  // Ruleset 2: requested R2 rule (14K RING, 0.1~0.3g, margin 1000)
  const tickRes = await sb
    .from("cms_v_market_tick_latest_gold_silver_ops_v1")
    .select("gold_price_krw_per_g, silver_price_krw_per_g")
    .single();
  if (tickRes.error) throw new Error(tickRes.error.message);
  const goldTick = toNum(tickRes.data.gold_price_krw_per_g, 0);
  const silverTick = toNum(tickRes.data.silver_price_krw_per_g, 0);

  const materialConfigRes = await sb
    .from("cms_material_factor_config")
    .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis");
  if (materialConfigRes.error) throw new Error(materialConfigRes.error.message);
  const purityMap = buildMaterialPurityMap(
    (materialConfigRes.data ?? []).map((r) => ({
      material_code: normalizeMaterialCode(String(r.material_code ?? "")),
      purity_rate: Number(r.purity_rate ?? 0),
      material_adjust_factor: Number(r.material_adjust_factor ?? Number.NaN),
      gold_adjust_factor: Number(r.gold_adjust_factor ?? Number.NaN),
    })),
  );
  const basisMap = new Map<string, "GOLD" | "SILVER" | "NONE">();
  const adjustMap = new Map<string, number>();
  for (const row of materialConfigRes.data ?? []) {
    const code = normalizeMaterialCode(String(row.material_code ?? ""));
    if (!code) continue;
    const basisRaw = String(row.price_basis ?? "").toUpperCase();
    basisMap.set(code, basisRaw === "SILVER" ? "SILVER" : basisRaw === "NONE" ? "NONE" : "GOLD");
    const adjust = Number(row.material_adjust_factor ?? Number.NaN);
    adjustMap.set(code, Number.isFinite(adjust) && adjust > 0 ? adjust : 1);
  }
  const tickByMaterial = (codeRaw: string): number => {
    const c = normalizeMaterialCode(codeRaw);
    const basis = basisMap.get(c);
    if (basis === "NONE") return 0;
    if (basis === "SILVER") return silverTick;
    if (basis === "GOLD") return goldTick;
    return isSilverMaterial(c) ? silverTick : goldTick;
  };

  const testNetWeight = 0.2;
  const srcCode = "14";
  const tgtCode = "18";
  const srcPurity = getMaterialPurityFromMap(purityMap, srcCode, 0);
  const tgtPurity = getMaterialPurityFromMap(purityMap, tgtCode, 0);
  const srcAdjust = adjustMap.get(srcCode) ?? 1;
  const tgtAdjust = adjustMap.get(tgtCode) ?? 1;
  const srcTick = tickByMaterial(srcCode);
  const tgtTick = tickByMaterial(tgtCode);
  const targetDelta = 1000;
  const mFor1000 = (srcPurity * srcAdjust * testNetWeight * srcTick + targetDelta) / (tgtPurity * tgtAdjust * testNetWeight * tgtTick * option18kMul);

  const rs2r1Res = await sb
    .from("sync_rule_r1_material_delta")
    .insert({
      rule_set_id: rs2,
      source_material_code: "14",
      target_material_code: "18",
      match_category_code: null,
      weight_min_g: 0,
      weight_max_g: 999999,
      option_weight_multiplier: mFor1000,
      rounding_unit: 100,
      rounding_mode: "ROUND",
      priority: 100,
      is_active: true,
    })
    .select("rule_id")
    .single();
  if (rs2r1Res.error) throw new Error(rs2r1Res.error.message);

  const rs2r2Res = await sb
    .from("sync_rule_r2_size_weight")
    .insert({
      rule_set_id: rs2,
      linked_r1_rule_id: null,
      match_material_code: "18",
      match_category_code: "RING",
      weight_min_g: 0.1,
      weight_max_g: 0.3,
      option_range_expr: "*",
      margin_min_krw: 1000,
      margin_max_krw: 1000,
      delta_krw: 0,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    })
    .select("rule_id")
    .single();
  if (rs2r2Res.error) throw new Error(rs2r2Res.error.message);

  // Case A: Material verification on MS-553 model (R1 only)
  await updateMapping(channelProductId, {
      sync_rule_set_id: rs1,
      option_price_mode: "SYNC",
      option_material_code: "18",
      option_color_code: null,
      option_decoration_code: null,
      option_size_value: null,
      size_weight_delta_g: 0,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: false,
    });

  const rA = await recompute(channelId, masterItemId);
  const snapA = await fetchLatestSnapshot(channelProductId);
  const deltaA = toNum((snapA?.breakdown_json as Record<string, unknown> | null)?.option_price_delta_krw, 0);

  const baseNetWeight = Math.max(toNum(masterRes.data.weight_default_g, 0) - toNum(masterRes.data.deduction_weight_default_g, 0), 0);
  const basePrice = srcPurity * srcAdjust * baseNetWeight * srcTick;
  const targetPrice = tgtPurity * tgtAdjust * (baseNetWeight * option18kMul) * tgtTick;
  const expectedMaterialDelta = roundByRule(targetPrice - basePrice, 100, "CEIL");

  // Case B: Plating verification (R3 W +4000)
  await updateMapping(channelProductId, {
      sync_rule_set_id: rs1,
      option_price_mode: "SYNC",
      option_material_code: "14",
      option_color_code: "W",
      option_decoration_code: null,
      size_weight_delta_g: 0,
      sync_rule_material_enabled: false,
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: false,
    });

  const rB = await recompute(channelId, masterItemId);
  const snapB = await fetchLatestSnapshot(channelProductId);
  const deltaB = toNum((snapB?.breakdown_json as Record<string, unknown> | null)?.option_price_delta_krw, 0);

  // Case C: Decoration verification (R4 +3300)
  await updateMapping(channelProductId, {
      sync_rule_set_id: rs1,
      option_price_mode: "SYNC",
      option_material_code: "14",
      option_color_code: null,
      option_decoration_code: "MS-553유색-R",
      size_weight_delta_g: 0,
      sync_rule_material_enabled: false,
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: true,
    });

  const previewC = await preview(channelId, rs1, channelProductId);

  const rC = await recompute(channelId, masterItemId);
  const snapC = await fetchLatestSnapshot(channelProductId);
  const deltaC = toNum((snapC?.breakdown_json as Record<string, unknown> | null)?.option_price_delta_krw, 0);

  // Case D: Size rule verification (0.1~0.3g, margin 1000) using synthetic net weight via size_weight_delta
  const sizeDeltaForPoint2 = 0.2 - baseNetWeight;
  await updateMapping(channelProductId, {
      sync_rule_set_id: rs2,
      option_price_mode: "SYNC",
      option_material_code: "18",
      option_color_code: null,
      option_decoration_code: null,
      option_size_value: 12,
      size_weight_delta_g: sizeDeltaForPoint2,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: false,
    });

  const rD = await recompute(channelId, masterItemId);
  const snapD = await fetchLatestSnapshot(channelProductId);
  const breakdownD = (snapD?.breakdown_json as Record<string, unknown> | null) ?? {};
  const deltaD = toNum(breakdownD.option_price_delta_krw, 0);
  const hitTraceD = Array.isArray(breakdownD.rule_hit_trace) ? breakdownD.rule_hit_trace : [];

  const summary = {
    channel_id: channelId,
    master_item_id: masterItemId,
    channel_product_id: channelProductId,
    rulesets: { rs1, rs2 },
    requested_rules_added: {
      r1_global_14_to_18: true,
      r2_range_0_1_to_0_3_margin_1000: true,
      r3_w_4000: true,
      r4_decoration_3300: true,
    },
    checks: {
      material_r1: {
        recompute: rA,
        expected_delta: Math.round(expectedMaterialDelta),
        actual_delta: Math.round(deltaA),
        pass: Math.round(expectedMaterialDelta) === Math.round(deltaA),
      },
      plating_r3_w_4000: {
        recompute: rB,
        actual_delta: Math.round(deltaB),
        pass: Math.round(deltaB) === 4000,
      },
      decoration_r4_3300: {
        recompute: rC,
        preview: previewC,
        actual_delta: Math.round(deltaC),
        pass: Math.round(deltaC) === 3300,
      },
      size_r2_range_margin: {
        recompute: rD,
        actual_delta: Math.round(deltaD),
        rule_hit_trace: hitTraceD,
        pass: hitTraceD.some((h) => String((h as { rule_type?: string }).rule_type ?? "") === "R2"),
      },
    },
  };

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
