import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

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
  if (body.material_factor_set_id !== undefined) patch.material_factor_set_id = body.material_factor_set_id || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  const { data, error } = await sb
    .from("pricing_policy")
    .update(patch)
    .eq("policy_id", policyId)
    .select("policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, is_active, created_at, updated_at")
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
