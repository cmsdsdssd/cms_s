import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MasterRow = {
  master_item_id: string;
  material_code_default: string | null;
  weight_default_g: number | null;
  deduction_weight_default_g: number | null;
  labor_base_sell: number | null;
  labor_center_sell: number | null;
  labor_sub1_sell: number | null;
  labor_sub2_sell: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
  model_name: string | null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
};

const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const roundByRule = (value: number, unit: number, mode: string): number => {
  const u = unit > 0 ? unit : 1000;
  const ratio = value / u;
  if (mode === "FLOOR") return Math.floor(ratio) * u;
  if (mode === "ROUND") return Math.round(ratio) * u;
  return Math.ceil(ratio) * u;
};

const isSilverMaterial = (materialCode: string | null): boolean => {
  return materialCode === "925" || materialCode === "999";
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemIds = parseUuidArray(body.master_item_ids);
  const factorSetOverride = typeof body.factor_set_id === "string" ? body.factor_set_id.trim() : null;
  if (!channelId) return jsonError("channel_id is required", 400);

  const policyRes = await sb
    .from("pricing_policy")
    .select("policy_id, margin_multiplier, rounding_unit, rounding_mode, material_factor_set_id")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (policyRes.error) return jsonError(policyRes.error.message ?? "정책 조회 실패", 500);
  const policy = policyRes.data;
  if (!policy) return jsonError("활성 정책이 없습니다", 422);

  const selectedFactorSetId = factorSetOverride || policy.material_factor_set_id || null;

  const mapQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (masterItemIds && masterItemIds.length > 0) mapQuery.in("master_item_id", masterItemIds);

  const mappingRes = await mapQuery;
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);
  const mappings = (mappingRes.data ?? []) as MappingRow[];
  if (mappings.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: 0, reason: "NO_MAPPINGS" }, { headers: { "Cache-Control": "no-store" } });
  }

  const uniqueMasterIds = [...new Set(mappings.map((m) => m.master_item_id))];
  const masterRes = await sb
    .from("cms_master_item")
    .select("master_item_id, material_code_default, weight_default_g, deduction_weight_default_g, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, center_qty_default, sub1_qty_default, sub2_qty_default, model_name")
    .in("master_item_id", uniqueMasterIds);
  if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 조회 실패", 500);
  const masterMap = new Map((masterRes.data ?? []).map((row) => [String((row as MasterRow).master_item_id), row as MasterRow]));

  const tickRes = await sb
    .from("cms_v_market_tick_latest_gold_silver_ops_v1")
    .select("gold_price_krw_per_g, silver_price_krw_per_g")
    .maybeSingle();
  if (tickRes.error) return jsonError(tickRes.error.message ?? "시세 조회 실패", 500);
  const goldTick = toNum(tickRes.data?.gold_price_krw_per_g, 0);
  const silverTick = toNum(tickRes.data?.silver_price_krw_per_g, 0);

  let factorMap = new Map<string, number>();
  if (selectedFactorSetId) {
    const factorRes = await sb
      .from("material_factor")
      .select("material_code, multiplier")
      .eq("factor_set_id", selectedFactorSetId);
    if (factorRes.error) return jsonError(factorRes.error.message ?? "팩터 조회 실패", 500);
    factorMap = new Map((factorRes.data ?? []).map((r) => [String(r.material_code), toNum(r.multiplier, 1)]));
  }

  const nowIso = new Date().toISOString();
  const adjRes = await sb
    .from("pricing_adjustment")
    .select("adjustment_id, channel_product_id, master_item_id, apply_to, stage, amount_type, amount_value, is_active, valid_from, valid_to")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .or(`valid_from.is.null,valid_from.lte.${nowIso}`)
    .or(`valid_to.is.null,valid_to.gte.${nowIso}`);
  if (adjRes.error) return jsonError(adjRes.error.message ?? "조정 조회 실패", 500);
  const adjustments = adjRes.data ?? [];

  const ovrRes = await sb
    .from("pricing_override")
    .select("override_id, master_item_id, override_price_krw, reason, valid_from, valid_to, is_active")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .or(`valid_from.is.null,valid_from.lte.${nowIso}`)
    .or(`valid_to.is.null,valid_to.gte.${nowIso}`);
  if (ovrRes.error) return jsonError(ovrRes.error.message ?? "오버라이드 조회 실패", 500);
  const overrideMap = new Map((ovrRes.data ?? []).map((o) => [String(o.master_item_id), o]));

  const rows = mappings.flatMap((m) => {
    const master = masterMap.get(m.master_item_id);
    if (!master) return [];

    const materialCode = master.material_code_default;
    const weight = toNum(master.weight_default_g, 0);
    const deduction = toNum(master.deduction_weight_default_g, 0);
    const netWeight = Math.max(weight - deduction, 0);

    const tick = materialCode === "00" ? 0 : isSilverMaterial(materialCode) ? silverTick : goldTick;
    const materialRaw = netWeight * tick;
    const factor = factorMap.get(materialCode ?? "") ?? 1;
    const materialFinal = materialRaw * factor;

    const centerQty = toNum(master.center_qty_default, 0);
    const sub1Qty = toNum(master.sub1_qty_default, 0);
    const sub2Qty = toNum(master.sub2_qty_default, 0);
    const laborRaw = toNum(master.labor_base_sell, 0)
      + centerQty * toNum(master.labor_center_sell, 0)
      + sub1Qty * toNum(master.labor_sub1_sell, 0)
      + sub2Qty * toNum(master.labor_sub2_sell, 0);

    const adjForLine = adjustments.filter((a) =>
      (a.channel_product_id && String(a.channel_product_id) === m.channel_product_id)
      || (a.master_item_id && String(a.master_item_id) === m.master_item_id),
    );

    const toAdjKrw = (amountType: unknown, amountValue: unknown, base: number): number => {
      const v = toNum(amountValue, 0);
      if (String(amountType) === "PERCENT") return (base * v) / 100;
      return v;
    };

    const laborPre = adjForLine
      .filter((a) => a.apply_to === "LABOR" && a.stage === "PRE_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, laborRaw), 0);

    const laborPost = adjForLine
      .filter((a) => a.apply_to === "LABOR" && a.stage === "POST_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, laborRaw), 0);

    const laborPreFinal = laborRaw + laborPre;

    const totalPre = adjForLine
      .filter((a) => a.apply_to === "TOTAL" && a.stage === "PRE_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, materialFinal + laborPreFinal), 0);

    const basePre = materialFinal + laborPreFinal + totalPre;
    const marginMultiplier = toNum(policy.margin_multiplier, 1);
    const afterMargin = basePre * marginMultiplier;

    const totalPost = adjForLine
      .filter((a) => a.apply_to === "TOTAL" && a.stage === "POST_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, afterMargin), 0);

    const targetRaw = afterMargin + laborPost + totalPost;
    const roundingUnit = Number(policy.rounding_unit ?? 1000);
    const roundingMode = String(policy.rounding_mode ?? "CEIL");
    const rounded = roundByRule(targetRaw, roundingUnit, roundingMode);

    const override = overrideMap.get(m.master_item_id);
    const finalTarget = override ? toNum(override.override_price_krw, rounded) : rounded;

    return [{
      channel_id: m.channel_id,
      master_item_id: m.master_item_id,
      channel_product_id: m.channel_product_id,
      computed_at: new Date().toISOString(),
      tick_as_of: new Date().toISOString(),
      tick_source: "cms_v_market_tick_latest_gold_silver_ops_v1",
      tick_gold_krw_g: goldTick,
      tick_silver_krw_g: silverTick,
      net_weight_g: netWeight,
      material_raw_krw: materialRaw,
      factor_set_id_used: selectedFactorSetId,
      material_factor_multiplier_used: factor,
      material_final_krw: materialFinal,
      labor_raw_krw: laborRaw,
      labor_pre_margin_adj_krw: laborPre,
      labor_post_margin_adj_krw: laborPost,
      total_pre_margin_adj_krw: totalPre,
      total_post_margin_adj_krw: totalPost,
      base_total_pre_margin_krw: basePre,
      margin_multiplier_used: marginMultiplier,
      total_after_margin_krw: afterMargin,
      target_price_raw_krw: targetRaw,
      rounding_unit_used: roundingUnit,
      rounding_mode_used: roundingMode,
      rounded_target_price_krw: rounded,
      override_price_krw: override ? toNum(override.override_price_krw, rounded) : null,
      final_target_price_krw: finalTarget,
      applied_adjustment_ids: adjForLine.map((a) => a.adjustment_id),
      breakdown_json: {
        model_name: master.model_name,
        material_code: materialCode,
        channel_product_id: m.channel_product_id,
      },
      compute_request_id: crypto.randomUUID(),
    }];
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: mappings.length, reason: "NO_MASTER_ROWS" }, { headers: { "Cache-Control": "no-store" } });
  }

  const insertRes = await sb.from("pricing_snapshot").insert(rows).select("snapshot_id");
  if (insertRes.error) return jsonError(insertRes.error.message ?? "스냅샷 저장 실패", 500);

  return NextResponse.json({
    ok: true,
    inserted: insertRes.data?.length ?? 0,
    skipped: mappings.length - (insertRes.data?.length ?? 0),
    channel_id: channelId,
    factor_set_id_used: selectedFactorSetId,
  }, { headers: { "Cache-Control": "no-store" } });
}
