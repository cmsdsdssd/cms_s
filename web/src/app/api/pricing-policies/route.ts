import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();

  let q = sb
    .from("pricing_policy")
    .select("policy_id, channel_id, policy_name, margin_multiplier, gm_material, gm_labor, gm_fixed, fixed_cost_krw, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, fee_rate, min_margin_rate_total, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (channelId) q = q.eq("channel_id", channelId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "정책 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const policyName = String(body.policy_name ?? "DEFAULT_POLICY").trim();
  const hasMargin = Object.prototype.hasOwnProperty.call(body, "margin_multiplier");
  const hasRoundingUnit = Object.prototype.hasOwnProperty.call(body, "rounding_unit");
  const hasRoundingMode = Object.prototype.hasOwnProperty.call(body, "rounding_mode");
  const hasOption18k = Object.prototype.hasOwnProperty.call(body, "option_18k_weight_multiplier");
  const hasFeeRate = Object.prototype.hasOwnProperty.call(body, "fee_rate");
  const hasMinMarginRateTotal = Object.prototype.hasOwnProperty.call(body, "min_margin_rate_total");
  const hasGmMaterial = Object.prototype.hasOwnProperty.call(body, "gm_material");
  const hasGmLabor = Object.prototype.hasOwnProperty.call(body, "gm_labor");
  const hasGmFixed = Object.prototype.hasOwnProperty.call(body, "gm_fixed");
  const hasFixedCostKrw = Object.prototype.hasOwnProperty.call(body, "fixed_cost_krw");

  const marginMultiplier = hasMargin ? Number(body.margin_multiplier) : 1;
  const roundingUnit = hasRoundingUnit ? Number(body.rounding_unit) : 1000;
  const roundingMode = String(hasRoundingMode ? body.rounding_mode : "CEIL").toUpperCase();
  const option18kWeightMultiplier = hasOption18k ? Number(body.option_18k_weight_multiplier) : 1.2;
  const feeRate = hasFeeRate ? Number(body.fee_rate) : 0;
  const minMarginRateTotal = hasMinMarginRateTotal ? Number(body.min_margin_rate_total) : 0;
  const gmMaterial = hasGmMaterial ? Number(body.gm_material) : 0;
  const gmLabor = hasGmLabor ? Number(body.gm_labor) : 0;
  const gmFixed = hasGmFixed ? Number(body.gm_fixed) : 0;
  const fixedCostKrw = hasFixedCostKrw ? Number(body.fixed_cost_krw) : 0;

  const basePayload = {
    channel_id: String(body.channel_id ?? "").trim(),
    policy_name: policyName,
    margin_multiplier: marginMultiplier,
    rounding_unit: roundingUnit,
    rounding_mode: roundingMode,
    option_18k_weight_multiplier: option18kWeightMultiplier,
    gm_material: gmMaterial,
    gm_labor: gmLabor,
    gm_fixed: gmFixed,
    fixed_cost_krw: Math.max(0, Math.round(fixedCostKrw)),
    material_factor_set_id: typeof body.material_factor_set_id === "string" ? body.material_factor_set_id : null,
    fee_rate: feeRate,
    min_margin_rate_total: minMarginRateTotal,
    is_active: body.is_active === false ? false : true,
  };

  if (!basePayload.channel_id) return jsonError("channel_id is required", 400);
  if (!basePayload.policy_name) return jsonError("policy_name is required", 400);
  if (!Number.isFinite(basePayload.margin_multiplier) || basePayload.margin_multiplier < 0) return jsonError("margin_multiplier must be >= 0", 400);
  if (!Number.isFinite(basePayload.rounding_unit) || basePayload.rounding_unit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!Number.isFinite(basePayload.option_18k_weight_multiplier) || basePayload.option_18k_weight_multiplier <= 0) return jsonError("option_18k_weight_multiplier must be > 0", 400);
  if (!Number.isFinite(basePayload.gm_material) || basePayload.gm_material < 0) return jsonError("gm_material must be >= 0", 400);
  if (!Number.isFinite(basePayload.gm_labor) || basePayload.gm_labor < 0) return jsonError("gm_labor must be >= 0", 400);
  if (!Number.isFinite(basePayload.gm_fixed) || basePayload.gm_fixed < 0) return jsonError("gm_fixed must be >= 0", 400);
  if (!Number.isFinite(basePayload.fixed_cost_krw) || basePayload.fixed_cost_krw < 0) return jsonError("fixed_cost_krw must be >= 0", 400);
  if (!Number.isFinite(basePayload.fee_rate) || basePayload.fee_rate < 0) return jsonError("fee_rate must be >= 0", 400);
  if (!Number.isFinite(basePayload.min_margin_rate_total) || basePayload.min_margin_rate_total < 0) return jsonError("min_margin_rate_total must be >= 0", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(basePayload.rounding_mode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  const selectCols = "policy_id, channel_id, policy_name, margin_multiplier, gm_material, gm_labor, gm_fixed, fixed_cost_krw, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, fee_rate, min_margin_rate_total, is_active, created_at, updated_at";

  const deactivateOtherPolicies = async (savedPolicyId: string) => {
    if (!basePayload.is_active) return;
    await sb
      .from("pricing_policy")
      .update({ is_active: false })
      .eq("channel_id", basePayload.channel_id)
      .neq("policy_id", savedPolicyId)
      .eq("is_active", true);
  };

  const firstTry = await sb.from("pricing_policy").insert(basePayload).select(selectCols).single();
  if (!firstTry.error) {
    await deactivateOtherPolicies(String(firstTry.data.policy_id));
    return NextResponse.json({ data: firstTry.data }, { headers: { "Cache-Control": "no-store" } });
  }

  const firstMsg = firstTry.error.message ?? "정책 생성 실패";
  if (!firstMsg.includes("column \"code\"")) return jsonError(firstMsg, 400);

  const fallbackCode = `POL_${basePayload.channel_id.replace(/-/g, "").slice(0, 8)}_${Date.now().toString().slice(-6)}`;
  const secondTry = await sb
    .from("pricing_policy")
    .insert({ ...basePayload, code: fallbackCode })
    .select(selectCols)
    .single();
  if (!secondTry.error) {
    await deactivateOtherPolicies(String(secondTry.data.policy_id));
    return NextResponse.json({ data: secondTry.data }, { headers: { "Cache-Control": "no-store" } });
  }

  const secondMsg = secondTry.error.message ?? "정책 생성 실패";
  if (!secondMsg.includes("column \"name\"")) return jsonError(secondMsg, 400);

  const thirdTry = await sb
    .from("pricing_policy")
    .insert({ ...basePayload, code: fallbackCode, name: policyName })
    .select(selectCols)
    .single();
  if (thirdTry.error) return jsonError(thirdTry.error.message ?? "정책 생성 실패", 400);

  await deactivateOtherPolicies(String(thirdTry.data.policy_id));
  return NextResponse.json({ data: thirdTry.data }, { headers: { "Cache-Control": "no-store" } });
}
