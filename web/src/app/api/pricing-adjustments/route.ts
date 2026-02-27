import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const channelProductId = (searchParams.get("channel_product_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  let q = sb
    .from("pricing_adjustment")
    .select("adjustment_id, channel_id, channel_product_id, master_item_id, apply_to, stage, amount_type, amount_value, priority, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });

  if (channelId) q = q.eq("channel_id", channelId);
  if (channelProductId) q = q.eq("channel_product_id", channelProductId);
  if (masterItemId) q = q.eq("master_item_id", masterItemId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "adjustment 조회 실패", 500);
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
    channel_product_id: typeof body.channel_product_id === "string" ? body.channel_product_id.trim() : null,
    master_item_id: typeof body.master_item_id === "string" ? body.master_item_id.trim() : null,
    apply_to: String(body.apply_to ?? "LABOR").toUpperCase(),
    stage: String(body.stage ?? "PRE_MARGIN").toUpperCase(),
    amount_type: String(body.amount_type ?? "ABSOLUTE_KRW").toUpperCase(),
    amount_value: Number(body.amount_value ?? 0),
    priority: Number(body.priority ?? 100),
    reason: typeof body.reason === "string" ? body.reason.trim() : null,
    valid_from: typeof body.valid_from === "string" ? body.valid_from : null,
    valid_to: typeof body.valid_to === "string" ? body.valid_to : null,
    is_active: body.is_active === false ? false : true,
  };

  if (!payload.channel_id) return jsonError("channel_id is required", 400);
  if (!payload.channel_product_id && !payload.master_item_id) return jsonError("channel_product_id or master_item_id is required", 400);
  if (!["LABOR", "TOTAL"].includes(payload.apply_to)) return jsonError("apply_to must be LABOR/TOTAL", 400);
  if (!["PRE_MARGIN", "POST_MARGIN"].includes(payload.stage)) return jsonError("stage must be PRE_MARGIN/POST_MARGIN", 400);
  if (!["ABSOLUTE_KRW", "PERCENT"].includes(payload.amount_type)) return jsonError("amount_type must be ABSOLUTE_KRW/PERCENT", 400);
  if (!Number.isFinite(payload.amount_value)) return jsonError("amount_value must be a number", 400);

  const { data, error } = await sb
    .from("pricing_adjustment")
    .insert(payload)
    .select("adjustment_id, channel_id, channel_product_id, master_item_id, apply_to, stage, amount_type, amount_value, priority, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "adjustment 생성 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
