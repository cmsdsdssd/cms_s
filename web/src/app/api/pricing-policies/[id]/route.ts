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
  if (body.margin_multiplier !== undefined) patch.margin_multiplier = Number(body.margin_multiplier);
  if (body.rounding_unit !== undefined) patch.rounding_unit = Number(body.rounding_unit);
  if (typeof body.rounding_mode === "string") patch.rounding_mode = body.rounding_mode.toUpperCase();
  if (body.material_factor_set_id !== undefined) patch.material_factor_set_id = body.material_factor_set_id || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  const { data, error } = await sb
    .from("pricing_policy")
    .update(patch)
    .eq("policy_id", policyId)
    .select("policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, material_factor_set_id, is_active, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "정책 수정 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
