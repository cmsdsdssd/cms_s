import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

  let q = sb
    .from("price_sync_job")
    .select("job_id, channel_id, run_type, status, requested_by, success_count, failed_count, skipped_count, started_at, finished_at, created_at")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (channelId) q = q.eq("channel_id", channelId);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "동기화 작업 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
