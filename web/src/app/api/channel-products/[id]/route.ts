import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelProductId = String(id ?? "").trim();
  if (!channelProductId) return jsonError("channel product id is required", 400);

  const { error } = await sb
    .from("sales_channel_product")
    .delete()
    .eq("channel_product_id", channelProductId);

  if (error) return jsonError(error.message ?? "매핑 삭제 실패", 400);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
