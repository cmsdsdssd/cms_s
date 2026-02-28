import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const includeMasterPlatingLabor = body.include_master_plating_labor === true;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  const { data, error } = await sb
    .from("sales_channel_product")
    .update({ include_master_plating_labor: includeMasterPlatingLabor })
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .select("channel_product_id");

  if (error) return jsonError(error.message ?? "도금공임 포함 설정 저장 실패", 400);

  return NextResponse.json(
    {
      ok: true,
      updated: data?.length ?? 0,
      channel_id: channelId,
      master_item_id: masterItemId,
      include_master_plating_labor: includeMasterPlatingLabor,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
