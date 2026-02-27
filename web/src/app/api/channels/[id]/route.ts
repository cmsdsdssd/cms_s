import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelId = String(id ?? "").trim();
  if (!channelId) return jsonError("channel id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (body.channel_code !== undefined) {
    const channelCode = String(body.channel_code ?? "").trim();
    if (!channelCode) return jsonError("channel_code is required", 400);
    patch.channel_code = channelCode;
  }
  if (body.channel_name !== undefined) {
    const channelName = String(body.channel_name ?? "").trim();
    if (!channelName) return jsonError("channel_name is required", 400);
    patch.channel_name = channelName;
  }
  if (body.is_active !== undefined) {
    patch.is_active = Boolean(body.is_active);
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("No update fields provided", 400);
  }

  const { data, error } = await sb
    .from("sales_channel")
    .update(patch)
    .eq("channel_id", channelId)
    .select("channel_id, channel_type, channel_code, channel_name, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "채널 수정 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelId = String(id ?? "").trim();
  if (!channelId) return jsonError("channel id is required", 400);

  const { error } = await sb.from("sales_channel").delete().eq("channel_id", channelId);
  if (error) return jsonError(error.message ?? "채널 삭제 실패", 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
