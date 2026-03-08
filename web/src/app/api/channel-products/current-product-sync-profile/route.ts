import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const normalizeCurrentProductSyncProfile = (value: unknown): "GENERAL" | "MARKET_LINKED" => {
  return String(value ?? "").trim().toUpperCase() === "MARKET_LINKED" ? "MARKET_LINKED" : "GENERAL";
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const hasCurrentProductSyncProfile = Object.prototype.hasOwnProperty.call(body, "current_product_sync_profile");
  if (!hasCurrentProductSyncProfile) return jsonError("current_product_sync_profile is required", 400);
  const currentProductSyncProfile = normalizeCurrentProductSyncProfile(body.current_product_sync_profile);

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  const updateRes = await sb
    .from("sales_channel_product")
    .update({ current_product_sync_profile: currentProductSyncProfile })
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .select("channel_product_id");

  if (updateRes.error) return jsonError(updateRes.error.message ?? "현재 상품 프로필 저장 실패", 400);
  if ((updateRes.data?.length ?? 0) === 0) {
    return jsonError("현재 상품 프로필을 저장할 활성 매핑이 없습니다", 422, {
      channel_id: channelId,
      master_item_id: masterItemId,
      current_product_sync_profile: currentProductSyncProfile,
      updated: 0,
    });
  }

  return NextResponse.json({
    ok: true,
    channel_id: channelId,
    master_item_id: masterItemId,
    current_product_sync_profile: currentProductSyncProfile,
    updated: updateRes.data?.length ?? 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
