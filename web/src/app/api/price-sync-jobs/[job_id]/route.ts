import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ job_id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { job_id } = await params;
  const jobId = String(job_id ?? "").trim();
  if (!jobId) return jsonError("job_id is required", 400);

  const [jobRes, itemRes] = await Promise.all([
    sb
      .from("price_sync_job")
      .select("job_id, channel_id, run_type, status, requested_by, request_payload, success_count, failed_count, skipped_count, started_at, finished_at, created_at")
      .eq("job_id", jobId)
      .maybeSingle(),
    sb
      .from("price_sync_job_item")
      .select("job_item_id, job_id, channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, before_price_krw, target_price_krw, after_price_krw, status, http_status, error_code, error_message, raw_response_json, updated_at, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
  ]);

  if (jobRes.error) return jsonError(jobRes.error.message ?? "작업 헤더 조회 실패", 500);
  if (!jobRes.data) return jsonError("작업을 찾을 수 없습니다", 404);
  if (itemRes.error) return jsonError(itemRes.error.message ?? "작업 아이템 조회 실패", 500);

  return NextResponse.json({
    data: {
      job: jobRes.data,
      items: itemRes.data ?? [],
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
