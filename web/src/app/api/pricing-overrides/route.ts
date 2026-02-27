import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  let q = sb
    .from("pricing_override")
    .select("override_id, channel_id, master_item_id, override_price_krw, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (channelId) q = q.eq("channel_id", channelId);
  if (masterItemId) q = q.eq("master_item_id", masterItemId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "override 조회 실패", 500);
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
    master_item_id: String(body.master_item_id ?? "").trim(),
    override_price_krw: Number(body.override_price_krw ?? 0),
    reason: typeof body.reason === "string" ? body.reason.trim() : null,
    valid_from: typeof body.valid_from === "string" ? body.valid_from : null,
    valid_to: typeof body.valid_to === "string" ? body.valid_to : null,
    is_active: body.is_active === false ? false : true,
  };

  if (!payload.channel_id) return jsonError("channel_id is required", 400);
  if (!payload.master_item_id) return jsonError("master_item_id is required", 400);
  if (!Number.isFinite(payload.override_price_krw) || payload.override_price_krw < 0) {
    return jsonError("override_price_krw must be >= 0", 400);
  }
  if (payload.valid_from && payload.valid_to) {
    if (Date.parse(payload.valid_to) < Date.parse(payload.valid_from)) {
      return jsonError("valid_to must be >= valid_from", 400);
    }
  }

  const { data, error } = await sb
    .from("pricing_override")
    .insert(payload)
    .select("override_id, channel_id, master_item_id, override_price_krw, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "override 생성 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
