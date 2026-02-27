import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const scope = (searchParams.get("scope") ?? "").trim().toUpperCase();
  const channelId = (searchParams.get("channel_id") ?? "").trim();

  let q = sb
    .from("material_factor_set")
    .select("factor_set_id, scope, channel_id, name, description, is_active, is_global_default, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (scope) q = q.eq("scope", scope);
  if (channelId) q = q.eq("channel_id", channelId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "factor set 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const scope = String(body.scope ?? "GLOBAL").toUpperCase();
  const channelId = typeof body.channel_id === "string" ? body.channel_id.trim() : null;
  const name = String(body.name ?? "").trim();
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const isActive = body.is_active === false ? false : true;
  const isGlobalDefault = body.is_global_default === true;

  if (!name) return jsonError("name is required", 400);
  if (!["GLOBAL", "CHANNEL"].includes(scope)) return jsonError("scope must be GLOBAL/CHANNEL", 400);
  if (scope === "CHANNEL" && !channelId) return jsonError("channel_id is required for CHANNEL scope", 400);

  const payload = {
    scope,
    channel_id: scope === "CHANNEL" ? channelId : null,
    name,
    description,
    is_active: isActive,
    is_global_default: scope === "GLOBAL" ? isGlobalDefault : false,
  };

  if (scope === "GLOBAL" && isGlobalDefault) {
    const clearRes = await sb
      .from("material_factor_set")
      .update({ is_global_default: false })
      .eq("scope", "GLOBAL")
      .eq("is_global_default", true);
    if (clearRes.error) return jsonError(clearRes.error.message ?? "기본 factor set 정리 실패", 400);
  }

  const { data, error } = await sb
    .from("material_factor_set")
    .insert(payload)
    .select("factor_set_id, scope, channel_id, name, description, is_active, is_global_default, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "factor set 생성 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
