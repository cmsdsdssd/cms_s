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
    .select("policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, material_factor_set_id, is_active, created_at, updated_at")
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

  const payload = {
    channel_id: String(body.channel_id ?? "").trim(),
    policy_name: String(body.policy_name ?? "DEFAULT_POLICY").trim(),
    margin_multiplier: Number(body.margin_multiplier ?? 1),
    rounding_unit: Number(body.rounding_unit ?? 1000),
    rounding_mode: String(body.rounding_mode ?? "CEIL").toUpperCase(),
    material_factor_set_id: typeof body.material_factor_set_id === "string" ? body.material_factor_set_id : null,
    is_active: body.is_active === false ? false : true,
  };

  if (!payload.channel_id) return jsonError("channel_id is required", 400);
  if (!payload.policy_name) return jsonError("policy_name is required", 400);
  if (!Number.isFinite(payload.margin_multiplier) || payload.margin_multiplier < 0) return jsonError("margin_multiplier must be >= 0", 400);
  if (!Number.isFinite(payload.rounding_unit) || payload.rounding_unit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(payload.rounding_mode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  const { data, error } = await sb
    .from("pricing_policy")
    .insert(payload)
    .select("policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, material_factor_set_id, is_active, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "정책 생성 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
