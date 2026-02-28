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
    .select("policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, is_active, created_at, updated_at")
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
  const basePayload = {
    channel_id: String(body.channel_id ?? "").trim(),
    policy_name: policyName,
    margin_multiplier: Number(body.margin_multiplier ?? 1),
    rounding_unit: Number(body.rounding_unit ?? 1000),
    rounding_mode: String(body.rounding_mode ?? "CEIL").toUpperCase(),
    option_18k_weight_multiplier: Number(body.option_18k_weight_multiplier ?? 1.2),
    material_factor_set_id: typeof body.material_factor_set_id === "string" ? body.material_factor_set_id : null,
    is_active: body.is_active === false ? false : true,
  };

  if (!basePayload.channel_id) return jsonError("channel_id is required", 400);
  if (!basePayload.policy_name) return jsonError("policy_name is required", 400);
  if (!Number.isFinite(basePayload.margin_multiplier) || basePayload.margin_multiplier < 0) return jsonError("margin_multiplier must be >= 0", 400);
  if (!Number.isFinite(basePayload.rounding_unit) || basePayload.rounding_unit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!Number.isFinite(basePayload.option_18k_weight_multiplier) || basePayload.option_18k_weight_multiplier <= 0) return jsonError("option_18k_weight_multiplier must be > 0", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(basePayload.rounding_mode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  const selectCols = "policy_id, channel_id, policy_name, margin_multiplier, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id, is_active, created_at, updated_at";

  const firstTry = await sb.from("pricing_policy").insert(basePayload).select(selectCols).single();
  if (!firstTry.error) {
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

  return NextResponse.json({ data: thirdTry.data }, { headers: { "Cache-Control": "no-store" } });
}
