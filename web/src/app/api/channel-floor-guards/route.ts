import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const masterItemIds = parseUuidArray(searchParams.getAll("master_item_id"));

  let q = sb
    .from("product_price_guard_v2")
    .select("guard_id, channel_id, master_item_id, floor_price_krw, floor_source, is_active, effective_from, effective_to, created_at, updated_at")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (masterItemIds && masterItemIds.length > 0) q = q.in("master_item_id", masterItemIds);

  const res = await q;
  if (res.error) return jsonError(res.error.message ?? "바닥가격 조회 실패", 500);
  return NextResponse.json({ data: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const floorPriceRaw = Number(body.floor_price_krw ?? Number.NaN);
  const floorSource = String(body.floor_source ?? "MANUAL").trim().toUpperCase() || "MANUAL";
  const actor = String(body.actor ?? "SYSTEM").trim() || "SYSTEM";

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!Number.isFinite(floorPriceRaw) || floorPriceRaw < 0) {
    return jsonError("floor_price_krw must be a non-negative number", 400);
  }

  const floorPrice = Math.round(floorPriceRaw);
  const nowIso = new Date().toISOString();

  const deactivateRes = await sb
    .from("product_price_guard_v2")
    .update({ is_active: false, effective_to: nowIso, updated_at: nowIso, updated_by: actor })
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true);

  if (deactivateRes.error) return jsonError(deactivateRes.error.message ?? "기존 바닥가격 비활성화 실패", 500);

  const insertRes = await sb
    .from("product_price_guard_v2")
    .insert({
      channel_id: channelId,
      master_item_id: masterItemId,
      floor_price_krw: floorPrice,
      floor_source: floorSource,
      is_active: true,
      effective_from: nowIso,
      created_by: actor,
      updated_by: actor,
    })
    .select("guard_id, channel_id, master_item_id, floor_price_krw, floor_source, is_active, effective_from, effective_to, created_at, updated_at")
    .single();

  if (insertRes.error) return jsonError(insertRes.error.message ?? "바닥가격 저장 실패", 500);

  return NextResponse.json({ ok: true, data: insertRes.data }, { headers: { "Cache-Control": "no-store" } });
}
