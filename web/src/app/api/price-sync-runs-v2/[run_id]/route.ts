import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { buildSyncReasonSummary, inferSyncReasonCode, syncReasonMeta } from "@/lib/shop/sync-reasons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ run_id: string }> };

const toNullableNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export async function GET(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { run_id } = await params;
  const runId = String(run_id ?? "").trim();
  if (!runId) return jsonError("run_id is required", 400);

  const [runRes, intentRes] = await Promise.all([
    sb
      .from("price_sync_run_v2")
      .select("run_id, channel_id, pinned_compute_request_id, interval_minutes, trigger_type, status, total_count, success_count, failed_count, skipped_count, started_at, finished_at, error_message, request_payload, created_at")
      .eq("run_id", runId)
      .maybeSingle(),
    sb
      .from("price_sync_intent_v2")
      .select("intent_id, run_id, channel_product_id, master_item_id, external_product_no, external_variant_code, compute_request_id, desired_price_krw, floor_price_krw, floor_applied, state, updated_at, created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true }),
  ]);

  if (runRes.error) return jsonError(runRes.error.message ?? "run 조회 실패", 500);
  if (!runRes.data) return jsonError("run not found", 404);
  if (intentRes.error) return jsonError(intentRes.error.message ?? "intent 조회 실패", 500);

  const intents = intentRes.data ?? [];
  const intentIds = intents
    .map((row) => String(row.intent_id ?? "").trim())
    .filter(Boolean);

  let taskByIntentId = new Map<string, {
    state: string;
    last_error: string | null;
    raw_response_json: unknown;
    http_status: number | null;
    sync_job_id: string | null;
    applied_before_price_krw: number | null;
    applied_target_price_krw: number | null;
    applied_after_price_krw: number | null;
  }>();
  if (intentIds.length > 0) {
    const taskRes = await sb
      .from("price_sync_push_task_v2")
      .select("intent_id, state, last_error, raw_response_json, http_status, updated_at")
      .in("intent_id", intentIds)
      .order("updated_at", { ascending: false });
    if (taskRes.error) return jsonError(taskRes.error.message ?? "run task 조회 실패", 500);

    for (const row of taskRes.data ?? []) {
      const intentId = String(row.intent_id ?? "").trim();
      if (!intentId || taskByIntentId.has(intentId)) continue;
      const raw = row.raw_response_json && typeof row.raw_response_json === "object"
        ? (row.raw_response_json as Record<string, unknown>)
        : null;
      taskByIntentId.set(intentId, {
        state: String(row.state ?? "").trim().toUpperCase(),
        last_error: String(row.last_error ?? "").trim() || null,
        raw_response_json: row.raw_response_json,
        http_status: row.http_status == null ? null : Number(row.http_status),
        sync_job_id: raw ? String(raw.sync_job_id ?? "").trim() || null : null,
        applied_before_price_krw: toNullableNumber(raw?.applied_before_price_krw),
        applied_target_price_krw: toNullableNumber(raw?.applied_target_price_krw),
        applied_after_price_krw: toNullableNumber(raw?.applied_after_price_krw),
      });
    }
  }

  const enrichedIntents = intents.map((row) => {
    const rawState = String(row.state ?? "").trim().toUpperCase();
    const status: "SUCCESS" | "FAILED" | "SKIPPED" = rawState === "FAILED"
      ? "FAILED"
      : rawState === "SKIPPED"
        ? "SKIPPED"
        : "SUCCESS";
    const task = taskByIntentId.get(String(row.intent_id ?? "").trim());
    const reasonCode = (status === "FAILED" || status === "SKIPPED")
      ? inferSyncReasonCode({
        status,
        error_code: null,
        error_message: task?.last_error ?? null,
        raw_response_json: task?.raw_response_json,
        last_error: task?.last_error ?? null,
      })
      : null;
    const reasonMeta = reasonCode ? syncReasonMeta(reasonCode) : null;

    return {
      ...row,
      reason_code: reasonCode,
      reason_label: reasonMeta?.label ?? null,
      reason_category: reasonMeta?.category ?? null,
      task_http_status: task?.http_status ?? null,
      task_last_error: task?.last_error ?? null,
      task_sync_job_id: task?.sync_job_id ?? null,
      applied_before_price_krw: task?.applied_before_price_krw ?? null,
      applied_target_price_krw: task?.applied_target_price_krw ?? null,
      applied_after_price_krw: task?.applied_after_price_krw ?? null,
    };
  });

  const reasonSummary = buildSyncReasonSummary(
    enrichedIntents.map((row) => ({
      status: (() => {
        const rawState = String(row.state ?? "").trim().toUpperCase();
        if (rawState === "FAILED") return "FAILED" as const;
        if (rawState === "SKIPPED") return "SKIPPED" as const;
        return "SUCCESS" as const;
      })(),
      error_code: row.reason_code,
      error_message: row.task_last_error,
      raw_response_json: null,
    })),
  );

  return NextResponse.json(
    {
      data: {
        run: runRes.data,
        intents: enrichedIntents,
        summary: {
          reasons: reasonSummary,
          skipped_reasons: reasonSummary.filter((row) => row.status === "SKIPPED"),
          failed_reasons: reasonSummary.filter((row) => row.status === "FAILED"),
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
