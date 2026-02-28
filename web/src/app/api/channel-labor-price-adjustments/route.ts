import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isHundredStep = (value: number): boolean => Number.isInteger(value) && value % 100 === 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  if (!channelId) return jsonError("channel_id is required", 400);

  let q = sb
    .from("channel_labor_price_adjustment_log")
    .select("adjustment_log_id, channel_id, master_item_id, delta_krw, reason, created_by, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (masterItemId) q = q.eq("master_item_id", masterItemId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "공임 조정 로그 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const deltaKrw = Number(body.delta_krw ?? 0);
  const reason = String(body.reason ?? "").trim();

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!Number.isFinite(deltaKrw) || deltaKrw === 0) return jsonError("delta_krw must be non-zero number", 400);
  if (!isHundredStep(Math.round(deltaKrw))) return jsonError("delta_krw must be 100 KRW step", 400);
  if (!reason) return jsonError("reason is required", 400);

  const payload = {
    channel_id: channelId,
    master_item_id: masterItemId,
    delta_krw: Math.round(deltaKrw),
    reason,
  };

  const { data, error } = await sb
    .from("channel_labor_price_adjustment_log")
    .insert(payload)
    .select("adjustment_log_id, channel_id, master_item_id, delta_krw, reason, created_by, created_at")
    .single();

  if (error) return jsonError(error.message ?? "공임 조정 로그 저장 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
