import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AutoSyncThresholdProfile = "GENERAL" | "MARKET_LINKED";
const PRICING_POLICY_SELECT_BASE =
  "policy_id, channel_id, policy_name, margin_multiplier, gm_material, gm_labor, gm_fixed, fixed_cost_krw, rounding_unit, rounding_mode, option_rounding_unit, option_rounding_mode, option_18k_weight_multiplier, material_factor_set_id, fee_rate, min_margin_rate_total, auto_sync_force_full, auto_sync_min_change_krw, auto_sync_min_change_rate, option_sync_force_full, option_sync_min_change_krw, option_sync_min_change_rate, is_active, created_at, updated_at";
const PRICING_POLICY_SELECT_COLS = `${PRICING_POLICY_SELECT_BASE}, auto_sync_threshold_profile`;
const PRICING_POLICY_SELECT_LEGACY = "policy_id, channel_id, policy_name, margin_multiplier, gm_material, gm_labor, gm_fixed, fixed_cost_krw, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, fee_rate, min_margin_rate_total, auto_sync_force_full, auto_sync_min_change_krw, auto_sync_min_change_rate, option_sync_force_full, option_sync_min_change_krw, option_sync_min_change_rate, is_active, created_at, updated_at";

function parseAutoSyncThresholdProfile(value: unknown): AutoSyncThresholdProfile {
  const profile = String(value ?? "GENERAL").trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("auto_sync_threshold_profile must be GENERAL/MARKET_LINKED");
}


export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();

  const buildQuery = (includeThresholdProfile: boolean) => {
    let q = sb
      .from("pricing_policy")
      .select(includeThresholdProfile ? PRICING_POLICY_SELECT_COLS : PRICING_POLICY_SELECT_BASE)
      .order("updated_at", { ascending: false });
    if (channelId) q = q.eq("channel_id", channelId);
    return q;
  };

  const { data, error: initialError } = await buildQuery(true);
  let responseData: Array<Record<string, unknown>> = ((data ?? []) as unknown as Array<Record<string, unknown>>);
  let error = initialError;
  if (error && (isMissingColumnError(error, "pricing_policy.auto_sync_threshold_profile") || isMissingColumnError(error, "pricing_policy.option_rounding_unit") || isMissingColumnError(error, "pricing_policy.option_rounding_mode"))) {
    const legacyQuery = sb
      .from("pricing_policy")
      .select(PRICING_POLICY_SELECT_LEGACY)
      .order("updated_at", { ascending: false });
    const legacyRes = channelId ? await legacyQuery.eq("channel_id", channelId) : await legacyQuery;
    responseData = ((legacyRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      option_rounding_unit: 500,
      option_rounding_mode: "CEIL",
      auto_sync_threshold_profile: "GENERAL",
    }));
    error = legacyRes.error;
  }
  if (error) return jsonError(error.message ?? "정책 조회 실패", 500);
  return NextResponse.json({ data: responseData }, { headers: { "Cache-Control": "no-store" } });
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
  const hasOptionRoundingUnit = Object.prototype.hasOwnProperty.call(body, "option_rounding_unit");
  const hasOptionRoundingMode = Object.prototype.hasOwnProperty.call(body, "option_rounding_mode");
  const hasOption18k = Object.prototype.hasOwnProperty.call(body, "option_18k_weight_multiplier");
  const hasFeeRate = Object.prototype.hasOwnProperty.call(body, "fee_rate");
  const hasMinMarginRateTotal = Object.prototype.hasOwnProperty.call(body, "min_margin_rate_total");
  const hasGmMaterial = Object.prototype.hasOwnProperty.call(body, "gm_material");
  const hasGmLabor = Object.prototype.hasOwnProperty.call(body, "gm_labor");
  const hasGmFixed = Object.prototype.hasOwnProperty.call(body, "gm_fixed");
  const hasFixedCostKrw = Object.prototype.hasOwnProperty.call(body, "fixed_cost_krw");
  const hasAutoSyncForceFull = Object.prototype.hasOwnProperty.call(body, "auto_sync_force_full");
  const hasAutoSyncMinChangeKrw = Object.prototype.hasOwnProperty.call(body, "auto_sync_min_change_krw");
  const hasAutoSyncMinChangeRate = Object.prototype.hasOwnProperty.call(body, "auto_sync_min_change_rate");
  const hasOptionSyncForceFull = Object.prototype.hasOwnProperty.call(body, "option_sync_force_full");
  const hasOptionSyncMinChangeKrw = Object.prototype.hasOwnProperty.call(body, "option_sync_min_change_krw");
  const hasOptionSyncMinChangeRate = Object.prototype.hasOwnProperty.call(body, "option_sync_min_change_rate");

  const marginMultiplier = hasMargin ? Number(body.margin_multiplier) : 1;
  const roundingUnit = hasRoundingUnit ? Number(body.rounding_unit) : 1000;
  const roundingMode = String(hasRoundingMode ? body.rounding_mode : "CEIL").toUpperCase();
  const option18kWeightMultiplier = hasOption18k ? Number(body.option_18k_weight_multiplier) : 1.2;
  const optionRoundingUnit = hasOptionRoundingUnit ? Number(body.option_rounding_unit) : 500;
  const optionRoundingMode = String(hasOptionRoundingMode ? body.option_rounding_mode : "CEIL").toUpperCase();
  const feeRate = hasFeeRate ? Number(body.fee_rate) : 0;
  const minMarginRateTotal = hasMinMarginRateTotal ? Number(body.min_margin_rate_total) : 0;
  const gmMaterial = hasGmMaterial ? Number(body.gm_material) : 0;
  const gmLabor = hasGmLabor ? Number(body.gm_labor) : 0;
  const gmFixed = hasGmFixed ? Number(body.gm_fixed) : 0;
  const fixedCostKrw = hasFixedCostKrw ? Number(body.fixed_cost_krw) : 0;
  const autoSyncForceFull = hasAutoSyncForceFull ? body.auto_sync_force_full === true : false;
  const autoSyncMinChangeKrw = hasAutoSyncMinChangeKrw ? Number(body.auto_sync_min_change_krw) : 5000;
  const autoSyncMinChangeRate = hasAutoSyncMinChangeRate ? Number(body.auto_sync_min_change_rate) : 0.01;
  const optionSyncForceFull = hasOptionSyncForceFull ? body.option_sync_force_full === true : false;
  const optionSyncMinChangeKrw = hasOptionSyncMinChangeKrw ? Number(body.option_sync_min_change_krw) : 1000;
  const optionSyncMinChangeRate = hasOptionSyncMinChangeRate ? Number(body.option_sync_min_change_rate) : 0.01;

  let autoSyncThresholdProfile: AutoSyncThresholdProfile;
  try {
    autoSyncThresholdProfile = parseAutoSyncThresholdProfile(body.auto_sync_threshold_profile);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Invalid auto_sync_threshold_profile", 400);
  }

  const basePayload = {
    channel_id: String(body.channel_id ?? "").trim(),
    policy_name: policyName,
    margin_multiplier: marginMultiplier,
    rounding_unit: roundingUnit,
    rounding_mode: roundingMode,
    option_rounding_unit: optionRoundingUnit,
    option_rounding_mode: optionRoundingMode,
    option_18k_weight_multiplier: option18kWeightMultiplier,
    gm_material: gmMaterial,
    gm_labor: gmLabor,
    gm_fixed: gmFixed,
    fixed_cost_krw: Math.max(0, Math.round(fixedCostKrw)),
    material_factor_set_id: typeof body.material_factor_set_id === "string" ? body.material_factor_set_id : null,
    fee_rate: feeRate,
    min_margin_rate_total: minMarginRateTotal,
    auto_sync_force_full: autoSyncForceFull,
    auto_sync_min_change_krw: Math.max(0, Math.round(autoSyncMinChangeKrw)),
    auto_sync_min_change_rate: autoSyncMinChangeRate,
    option_sync_force_full: optionSyncForceFull,
    option_sync_min_change_krw: Math.max(0, Math.round(optionSyncMinChangeKrw)),
    option_sync_min_change_rate: optionSyncMinChangeRate,
    auto_sync_threshold_profile: autoSyncThresholdProfile,
    is_active: body.is_active === false ? false : true,
  };

  if (!basePayload.channel_id) return jsonError("channel_id is required", 400);
  if (!basePayload.policy_name) return jsonError("policy_name is required", 400);
  if (!Number.isFinite(basePayload.margin_multiplier) || basePayload.margin_multiplier < 0) return jsonError("margin_multiplier must be >= 0", 400);
  if (!Number.isFinite(basePayload.rounding_unit) || basePayload.rounding_unit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!Number.isFinite(basePayload.option_rounding_unit) || Number(basePayload.option_rounding_unit) <= 0) return jsonError("option_rounding_unit must be > 0", 400);
  if (!Number.isFinite(basePayload.option_18k_weight_multiplier) || basePayload.option_18k_weight_multiplier <= 0) return jsonError("option_18k_weight_multiplier must be > 0", 400);
  if (!Number.isFinite(basePayload.gm_material) || basePayload.gm_material < 0) return jsonError("gm_material must be >= 0", 400);
  if (!Number.isFinite(basePayload.gm_labor) || basePayload.gm_labor < 0) return jsonError("gm_labor must be >= 0", 400);
  if (!Number.isFinite(basePayload.gm_fixed) || basePayload.gm_fixed < 0) return jsonError("gm_fixed must be >= 0", 400);
  if (!Number.isFinite(basePayload.fixed_cost_krw) || basePayload.fixed_cost_krw < 0) return jsonError("fixed_cost_krw must be >= 0", 400);
  if (!Number.isFinite(basePayload.fee_rate) || basePayload.fee_rate < 0) return jsonError("fee_rate must be >= 0", 400);
  if (!Number.isFinite(basePayload.min_margin_rate_total) || basePayload.min_margin_rate_total < 0) return jsonError("min_margin_rate_total must be >= 0", 400);
  if (!Number.isFinite(basePayload.auto_sync_min_change_krw) || basePayload.auto_sync_min_change_krw < 0) return jsonError("auto_sync_min_change_krw must be >= 0", 400);
  if (!Number.isFinite(basePayload.auto_sync_min_change_rate) || basePayload.auto_sync_min_change_rate < 0 || basePayload.auto_sync_min_change_rate > 1) return jsonError("auto_sync_min_change_rate must be between 0 and 1", 400);
  if (!Number.isFinite(basePayload.option_sync_min_change_krw) || basePayload.option_sync_min_change_krw < 0) return jsonError("option_sync_min_change_krw must be >= 0", 400);
  if (!Number.isFinite(basePayload.option_sync_min_change_rate) || basePayload.option_sync_min_change_rate < 0 || basePayload.option_sync_min_change_rate > 1) return jsonError("option_sync_min_change_rate must be between 0 and 1", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(basePayload.rounding_mode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(String(basePayload.option_rounding_mode))) return jsonError("option_rounding_mode must be CEIL/ROUND/FLOOR", 400);
  const deactivateOtherPolicies = async (savedPolicyId: string) => {
    if (!basePayload.is_active) return;
    await sb
      .from("pricing_policy")
      .update({ is_active: false })
      .eq("channel_id", basePayload.channel_id)
      .neq("policy_id", savedPolicyId)
      .eq("is_active", true);
  };

  const firstTry = await sb.from("pricing_policy").insert(basePayload).select(PRICING_POLICY_SELECT_COLS).single();
  if (!firstTry.error) {
    await deactivateOtherPolicies(String(firstTry.data.policy_id));
    return NextResponse.json({ data: firstTry.data }, { headers: { "Cache-Control": "no-store" } });
  }

  if (firstTry.error && (isMissingColumnError(firstTry.error, "pricing_policy.option_rounding_unit") || isMissingColumnError(firstTry.error, "pricing_policy.option_rounding_mode"))) {
    const fallbackPayload: Record<string, unknown> = { ...basePayload };
    delete fallbackPayload.option_rounding_unit;
    delete fallbackPayload.option_rounding_mode;
    const fallbackTry = await sb.from("pricing_policy").insert(fallbackPayload).select(PRICING_POLICY_SELECT_LEGACY).single();
    if (!fallbackTry.error) {
      await deactivateOtherPolicies(String(fallbackTry.data.policy_id));
      return NextResponse.json({ data: { ...fallbackTry.data, option_rounding_unit: 500, option_rounding_mode: "CEIL", auto_sync_threshold_profile: autoSyncThresholdProfile } }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const firstMsg = firstTry.error.message ?? "정책 생성 실패";
  if (!firstMsg.includes("column \"code\"")) return jsonError(firstMsg, 400);

  const fallbackCode = `POL_${basePayload.channel_id.replace(/-/g, "").slice(0, 8)}_${Date.now().toString().slice(-6)}`;
  const secondTry = await sb
    .from("pricing_policy")
    .insert({ ...basePayload, code: fallbackCode })
    .select(PRICING_POLICY_SELECT_COLS)
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
    .select(PRICING_POLICY_SELECT_COLS)
    .single();
  if (thirdTry.error) return jsonError(thirdTry.error.message ?? "정책 생성 실패", 400);

  await deactivateOtherPolicies(String(thirdTry.data.policy_id));
  return NextResponse.json({ data: thirdTry.data }, { headers: { "Cache-Control": "no-store" } });
}
