import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const onlyActive = searchParams.get("only_active") !== "false";

  let q = sb
    .from("sync_rule_set")
    .select("rule_set_id, channel_id, name, description, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (channelId) q = q.eq("channel_id", channelId);
  if (onlyActive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "룰셋 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const name = String(body.name ?? "").trim();
  const description = toNullableText(body.description);
  const isActive = body.is_active === false ? false : true;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!name) return jsonError("name is required", 400);

  const { data, error } = await sb
    .from("sync_rule_set")
    .insert({
      channel_id: channelId,
      name,
      description,
      is_active: isActive,
    })
    .select("rule_set_id, channel_id, name, description, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "룰셋 생성 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
