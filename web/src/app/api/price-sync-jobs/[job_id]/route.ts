import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { buildSyncReasonSummary, inferSyncReasonCode, syncReasonMeta } from "@/lib/shop/sync-reasons";

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

  const items = (itemRes.data ?? []).map((row) => {
    const status = String(row.status ?? "").trim().toUpperCase() as "SUCCESS" | "FAILED" | "SKIPPED";
    const reasonCode = inferSyncReasonCode({
      status,
      error_code: String(row.error_code ?? "").trim() || null,
      error_message: String(row.error_message ?? "").trim() || null,
      raw_response_json: row.raw_response_json,
    });
    const meta = syncReasonMeta(reasonCode);
    return {
      ...row,
      reason_code: reasonCode,
      reason_label: meta.label,
      reason_category: meta.category,
    };
  });

  const reasonSummary = buildSyncReasonSummary(items.map((row) => ({
    status: String(row.status ?? "").trim().toUpperCase() as "SUCCESS" | "FAILED" | "SKIPPED",
    error_code: String((row as { error_code?: unknown }).error_code ?? "").trim() || null,
    error_message: String((row as { error_message?: unknown }).error_message ?? "").trim() || null,
    raw_response_json: (row as { raw_response_json?: unknown }).raw_response_json,
  })));

  const statusSummary = {
    success: items.filter((row) => String(row.status ?? "").toUpperCase() === "SUCCESS").length,
    failed: items.filter((row) => String(row.status ?? "").toUpperCase() === "FAILED").length,
    skipped: items.filter((row) => String(row.status ?? "").toUpperCase() === "SKIPPED").length,
  };

  return NextResponse.json({
    data: {
      job: jobRes.data,
      items,
      summary: {
        status: statusSummary,
        reasons: reasonSummary,
        skipped_reasons: reasonSummary.filter((row) => row.status === "SKIPPED"),
        failed_reasons: reasonSummary.filter((row) => row.status === "FAILED"),
      },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
