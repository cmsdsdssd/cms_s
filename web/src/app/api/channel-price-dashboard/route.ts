import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const priceState = (searchParams.get("price_state") ?? "").trim();
  const modelName = (searchParams.get("model_name") ?? "").trim();
  const onlyOverrides = searchParams.get("only_overrides") === "true";
  const onlyAdjustments = searchParams.get("only_adjustments") === "true";
  const limitRaw = Number(searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;

  let q = sb
    .from("v_channel_price_dashboard")
    .select("*")
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (channelId) q = q.eq("channel_id", channelId);
  if (priceState) q = q.eq("price_state", priceState);
  if (modelName) q = q.ilike("model_name", `%${modelName}%`);
  if (onlyOverrides) q = q.not("active_override_id", "is", null);
  if (onlyAdjustments) q = q.gt("active_adjustment_count", 0);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "대시보드 조회 실패", 500);

  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
