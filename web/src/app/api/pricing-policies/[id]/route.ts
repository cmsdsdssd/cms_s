import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

const PRICING_POLICY_SELECT_COLS =
  "policy_id, channel_id, policy_name, margin_multiplier, gm_material, gm_labor, gm_fixed, fixed_cost_krw, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, fee_rate, min_margin_rate_total, auto_sync_force_full, auto_sync_min_change_krw, auto_sync_min_change_rate, option_sync_force_full, option_sync_min_change_krw, option_sync_min_change_rate, auto_sync_threshold_profile, is_active, created_at, updated_at";

function parseAutoSyncThresholdProfile(value: unknown): "GENERAL" | "MARKET_LINKED" {
  const profile = String(value ?? "GENERAL").trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("auto_sync_threshold_profile must be GENERAL/MARKET_LINKED");
}

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const policyId = String(id ?? "").trim();
  if (!policyId) return jsonError("policy id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.policy_name === "string") patch.policy_name = body.policy_name.trim();
  if (body.margin_multiplier !== undefined) {
    const margin = Number(body.margin_multiplier);
    if (!Number.isFinite(margin) || margin < 0) return jsonError("margin_multiplier must be >= 0", 400);
    patch.margin_multiplier = margin;
  }
  if (body.rounding_unit !== undefined) {
    const unit = Number(body.rounding_unit);
    if (!Number.isFinite(unit) || unit <= 0) return jsonError("rounding_unit must be > 0", 400);
    patch.rounding_unit = Math.max(1, Math.round(unit));
  }
  if (typeof body.rounding_mode === "string") {
    const mode = body.rounding_mode.toUpperCase();
    if (!["CEIL", "ROUND", "FLOOR"].includes(mode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);
    patch.rounding_mode = mode;
  }
  if (body.option_18k_weight_multiplier !== undefined) {
    const option18k = Number(body.option_18k_weight_multiplier);
    if (!Number.isFinite(option18k) || option18k <= 0) return jsonError("option_18k_weight_multiplier must be > 0", 400);
    patch.option_18k_weight_multiplier = option18k;
  }
  if (body.gm_material !== undefined) {
    const gmMaterial = Number(body.gm_material);
    if (!Number.isFinite(gmMaterial) || gmMaterial < 0) return jsonError("gm_material must be >= 0", 400);
    patch.gm_material = gmMaterial;
  }
  if (body.gm_labor !== undefined) {
    const gmLabor = Number(body.gm_labor);
    if (!Number.isFinite(gmLabor) || gmLabor < 0) return jsonError("gm_labor must be >= 0", 400);
    patch.gm_labor = gmLabor;
  }
  if (body.gm_fixed !== undefined) {
    const gmFixed = Number(body.gm_fixed);
    if (!Number.isFinite(gmFixed) || gmFixed < 0) return jsonError("gm_fixed must be >= 0", 400);
    patch.gm_fixed = gmFixed;
  }
  if (body.fixed_cost_krw !== undefined) {
    const fixedCostKrw = Number(body.fixed_cost_krw);
    if (!Number.isFinite(fixedCostKrw) || fixedCostKrw < 0) return jsonError("fixed_cost_krw must be >= 0", 400);
    patch.fixed_cost_krw = Math.max(0, Math.round(fixedCostKrw));
  }
  if (body.fee_rate !== undefined) {
    const feeRate = Number(body.fee_rate);
    if (!Number.isFinite(feeRate) || feeRate < 0) return jsonError("fee_rate must be >= 0", 400);
    patch.fee_rate = feeRate;
  }
  if (body.min_margin_rate_total !== undefined) {
    const minMarginRateTotal = Number(body.min_margin_rate_total);
    if (!Number.isFinite(minMarginRateTotal) || minMarginRateTotal < 0) return jsonError("min_margin_rate_total must be >= 0", 400);
    patch.min_margin_rate_total = minMarginRateTotal;
  }
  if (body.auto_sync_force_full !== undefined) patch.auto_sync_force_full = body.auto_sync_force_full === true;
  if (body.auto_sync_min_change_krw !== undefined) {
    const autoSyncMinChangeKrw = Number(body.auto_sync_min_change_krw);
    if (!Number.isFinite(autoSyncMinChangeKrw) || autoSyncMinChangeKrw < 0) return jsonError("auto_sync_min_change_krw must be >= 0", 400);
    patch.auto_sync_min_change_krw = Math.max(0, Math.round(autoSyncMinChangeKrw));
  }
  if (body.auto_sync_min_change_rate !== undefined) {
    const autoSyncMinChangeRate = Number(body.auto_sync_min_change_rate);
    if (!Number.isFinite(autoSyncMinChangeRate) || autoSyncMinChangeRate < 0 || autoSyncMinChangeRate > 1) {
      return jsonError("auto_sync_min_change_rate must be between 0 and 1", 400);
    }
    patch.auto_sync_min_change_rate = autoSyncMinChangeRate;
  }
  if (body.option_sync_force_full !== undefined) patch.option_sync_force_full = body.option_sync_force_full === true;
  if (body.option_sync_min_change_krw !== undefined) {
    const optionSyncMinChangeKrw = Number(body.option_sync_min_change_krw);
    if (!Number.isFinite(optionSyncMinChangeKrw) || optionSyncMinChangeKrw < 0) return jsonError("option_sync_min_change_krw must be >= 0", 400);
    patch.option_sync_min_change_krw = Math.max(0, Math.round(optionSyncMinChangeKrw));
  }
  if (body.option_sync_min_change_rate !== undefined) {
    const optionSyncMinChangeRate = Number(body.option_sync_min_change_rate);
    if (!Number.isFinite(optionSyncMinChangeRate) || optionSyncMinChangeRate < 0 || optionSyncMinChangeRate > 1) {
      return jsonError("option_sync_min_change_rate must be between 0 and 1", 400);
    }
    patch.option_sync_min_change_rate = optionSyncMinChangeRate;
  }
  if (body.auto_sync_threshold_profile !== undefined) {
    try {
      patch.auto_sync_threshold_profile = parseAutoSyncThresholdProfile(body.auto_sync_threshold_profile);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid auto_sync_threshold_profile", 400);
    }
  }
  if (body.material_factor_set_id !== undefined) patch.material_factor_set_id = body.material_factor_set_id || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  const { data, error } = await sb
    .from("pricing_policy")
    .update(patch)
    .eq("policy_id", policyId)
    .select(PRICING_POLICY_SELECT_COLS)
    .single();
  if (error) return jsonError(error.message ?? "정책 수정 실패", 400);

  if (data?.is_active === true) {
    await sb
      .from("pricing_policy")
      .update({ is_active: false })
      .eq("channel_id", String(data.channel_id ?? "").trim())
      .neq("policy_id", String(data.policy_id ?? "").trim())
      .eq("is_active", true);
  }

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
