import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { data, error } = await sb
    .from("sales_channel")
    .select("channel_id, channel_type, channel_code, channel_name, is_active, created_at, updated_at")
    .order("channel_name", { ascending: true });

  if (error) return jsonError(error.message ?? "채널 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelCode = String(body.channel_code ?? "").trim();
  const channelName = String(body.channel_name ?? "").trim();
  const channelType = String(body.channel_type ?? "CAFE24").trim().toUpperCase();
  const isActive = body.is_active === false ? false : true;

  if (!channelCode) return jsonError("channel_code is required", 400);
  if (!channelName) return jsonError("channel_name is required", 400);
  if (channelType !== "CAFE24") return jsonError("channel_type must be CAFE24", 400);

  const payload = {
    channel_type: channelType,
    channel_code: channelCode,
    channel_name: channelName,
    is_active: isActive,
  };

  const { data, error } = await sb
    .from("sales_channel")
    .upsert(payload, { onConflict: "channel_code" })
    .select("channel_id, channel_type, channel_code, channel_name, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "채널 저장 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
