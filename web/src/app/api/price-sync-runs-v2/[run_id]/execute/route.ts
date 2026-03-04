import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { POST as pushPost } from "@/app/api/channel-prices/push/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ run_id: string }> };

const mkJsonRequest = (path: string, payload: Record<string, unknown>): Request =>
  new Request(`https://internal.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const TERMINAL_INTENT_STATES = new Set(["SUCCEEDED", "SKIPPED", "FAILED"]);
const DEFAULT_EXECUTE_INTENT_BATCH_SIZE = 300;
const DEFAULT_PUSH_CHANNEL_PRODUCT_CHUNK_SIZE = 150;

const toPositiveInt = (value: unknown, fallback: number, max = 5000): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

type IntentRow = {
  intent_id: string;
  channel_product_id: string;
  master_item_id: string;
  external_variant_code: string;
  compute_request_id: string;
  state: string;
};

const logicalTargetKey = (computeRequestId: string, masterItemId: string, externalVariantCode: string) =>
  `${computeRequestId}:${masterItemId}:${externalVariantCode || "BASE"}`;

function deriveRunStatus(success: number, failed: number, skipped: number): "SUCCESS" | "PARTIAL" | "FAILED" {
  if (failed === 0) return "SUCCESS";
  if (success > 0 || skipped > 0) return "PARTIAL";
  return "FAILED";
}

export async function POST(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { run_id } = await params;
  const runId = String(run_id ?? "").trim();
  if (!runId) return jsonError("run_id is required", 400);

  const rawBody = await _request.json().catch(() => null);
  const body = parseJsonObject(rawBody) ?? {};
  const executeIntentBatchSize = toPositiveInt(
    body.intent_batch_size ?? process.env.SHOP_SYNC_EXECUTE_INTENT_BATCH_SIZE,
    DEFAULT_EXECUTE_INTENT_BATCH_SIZE,
    5000,
  );
  const pushChunkSize = toPositiveInt(
    body.push_chunk_size ?? process.env.SHOP_SYNC_PUSH_CHUNK_SIZE,
    DEFAULT_PUSH_CHANNEL_PRODUCT_CHUNK_SIZE,
    1000,
  );

  const runRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, channel_id, status")
    .eq("run_id", runId)
    .maybeSingle();
  if (runRes.error) return jsonError(runRes.error.message ?? "run 조회 실패", 500);
  if (!runRes.data) return jsonError("run not found", 404);

  const channelId = String(runRes.data.channel_id ?? "").trim();
  if (!channelId) return jsonError("run.channel_id is missing", 500);

  const intentRes = await sb
    .from("price_sync_intent_v2")
    .select("intent_id, channel_product_id, master_item_id, external_variant_code, compute_request_id, state")
    .eq("run_id", runId)
    .in("state", ["PENDING", "FAILED"]);
  if (intentRes.error) return jsonError(intentRes.error.message ?? "intent 조회 실패", 500);

  const intents: IntentRow[] = (intentRes.data ?? [])
    .map((row) => ({
      intent_id: String(row.intent_id ?? "").trim(),
      channel_product_id: String(row.channel_product_id ?? "").trim(),
      master_item_id: String(row.master_item_id ?? "").trim(),
      external_variant_code: String(row.external_variant_code ?? "").trim(),
      compute_request_id: String(row.compute_request_id ?? "").trim(),
      state: String(row.state ?? "").trim().toUpperCase(),
    }))
    .filter((row) => row.intent_id && row.channel_product_id && row.master_item_id && row.compute_request_id);

  const pendingIntents = intents.slice(0, executeIntentBatchSize);

  const pendingIntentIds = pendingIntents.map((row) => row.intent_id);
  const taskAttemptByIntent = new Map<string, number>();
  if (pendingIntentIds.length > 0) {
    const taskRes = await sb
      .from("price_sync_push_task_v2")
      .select("intent_id, attempt_count")
      .in("intent_id", pendingIntentIds);
    if (taskRes.error) return jsonError(taskRes.error.message ?? "push task 조회 실패", 500);
    for (const row of taskRes.data ?? []) {
      const intentId = String(row.intent_id ?? "").trim();
      if (!intentId) continue;
      const attemptCount = Math.max(0, Math.round(Number(row.attempt_count ?? 0)));
      taskAttemptByIntent.set(intentId, attemptCount);
    }
  }

  if (pendingIntents.length === 0) {
    const success = intents.filter((row) => row.state === "SUCCEEDED").length;
    const skipped = intents.filter((row) => row.state === "SKIPPED").length;
    const failed = intents.filter((row) => row.state === "FAILED").length;
    const status = deriveRunStatus(success, failed, skipped);
    await sb
      .from("price_sync_run_v2")
      .update({ status, success_count: success, failed_count: failed, skipped_count: skipped, finished_at: new Date().toISOString() })
      .eq("run_id", runId);
    return NextResponse.json({ ok: true, run_id: runId, status, reason: "NO_PENDING_INTENTS" }, { headers: { "Cache-Control": "no-store" } });
  }

  const intentIdsByLogical = new Map<string, string[]>();
  const logicalByComputeAndChannelProduct = new Map<string, string>();
  const logicalKeysByCompute = new Map<string, Set<string>>();
  for (const row of pendingIntents) {
    const logical = logicalTargetKey(row.compute_request_id, row.master_item_id, row.external_variant_code);
    const prev = intentIdsByLogical.get(logical) ?? [];
    prev.push(row.intent_id);
    intentIdsByLogical.set(logical, prev);
    logicalByComputeAndChannelProduct.set(`${row.compute_request_id}:${row.channel_product_id}`, logical);
    const logicalSet = logicalKeysByCompute.get(row.compute_request_id) ?? new Set<string>();
    logicalSet.add(logical);
    logicalKeysByCompute.set(row.compute_request_id, logicalSet);
  }

  const byCompute = new Map<string, string[]>();
  for (const row of pendingIntents) {
    const prev = byCompute.get(row.compute_request_id) ?? [];
    prev.push(row.channel_product_id);
    byCompute.set(row.compute_request_id, prev);
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const jobIds: string[] = [];

  const updateIntentAndTask = async (
    intentIds: string[],
    nextState: "SUCCEEDED" | "SKIPPED" | "FAILED",
    httpStatus: number | null,
    errorMessage: string | null,
    rawResponseJson: unknown,
  ) => {
    if (intentIds.length === 0) return;
    const nowIso = new Date().toISOString();

    await sb
      .from("price_sync_intent_v2")
      .update({ state: nextState, updated_at: nowIso })
      .in("intent_id", intentIds);

    for (const intentId of intentIds) {
      const attemptCount = (taskAttemptByIntent.get(intentId) ?? 0) + 1;
      taskAttemptByIntent.set(intentId, attemptCount);
      await sb
        .from("price_sync_push_task_v2")
        .update({
          state: nextState,
          attempt_count: attemptCount,
          http_status: httpStatus,
          last_error: errorMessage,
          raw_response_json: rawResponseJson ?? null,
          updated_at: nowIso,
        })
        .eq("intent_id", intentId);
    }
  };

  for (const [computeRequestId, channelProductIds] of byCompute.entries()) {
    const toPush = Array.from(new Set(channelProductIds));
    if (toPush.length === 0) continue;

    const seenLogicalTargets = new Set<string>();
    for (const productChunk of chunkArray(toPush, pushChunkSize)) {
      const chunkLogicalTargets = new Set<string>();
      for (const channelProductId of productChunk) {
        const logical = logicalByComputeAndChannelProduct.get(`${computeRequestId}:${channelProductId}`);
        if (logical) chunkLogicalTargets.add(logical);
      }

      const pushRes = await pushPost(
        mkJsonRequest("/api/channel-prices/push", {
          channel_id: channelId,
          channel_product_ids: productChunk,
          compute_request_id: computeRequestId,
          run_type: "AUTO",
          dry_run: false,
        }),
      );
      const pushJson = await pushRes.json().catch(() => ({}));
      const jobId = String((pushJson as { job_id?: unknown }).job_id ?? "").trim();
      if (jobId) jobIds.push(jobId);

      if (!pushRes.ok || !jobId) {
        const pushError = String((pushJson as { error?: unknown }).error ?? (pushJson as { detail?: unknown }).detail ?? "PUSH_FAILED").trim() || "PUSH_FAILED";
        for (const logical of chunkLogicalTargets) {
          const intentIds = intentIdsByLogical.get(logical) ?? [];
          if (intentIds.length === 0) continue;
          failed += intentIds.length;
          await updateIntentAndTask(intentIds, "FAILED", null, pushError, pushJson ?? null);
          seenLogicalTargets.add(logical);
        }
        continue;
      }

      const itemRes = await sb
        .from("price_sync_job_item")
        .select("channel_product_id, master_item_id, external_variant_code, status, http_status, error_code, error_message, raw_response_json")
        .eq("job_id", jobId);
      if (itemRes.error) return jsonError(itemRes.error.message ?? "push item 조회 실패", 500);

      const pushItems = itemRes.data ?? [];
      const unresolvedChannelProducts = Array.from(
        new Set(
          pushItems
            .map((item) => String(item.channel_product_id ?? "").trim())
            .filter((id) => id.length > 0 && !logicalByComputeAndChannelProduct.has(`${computeRequestId}:${id}`)),
        ),
      );

      const logicalByChannelProductFromDb = new Map<string, string>();
      for (const unresolvedChunk of chunkArray(unresolvedChannelProducts, 500)) {
        if (unresolvedChunk.length === 0) continue;
        const cpMapRes = await sb
          .from("sales_channel_product")
          .select("channel_product_id, master_item_id, external_variant_code")
          .in("channel_product_id", unresolvedChunk);
        if (cpMapRes.error) return jsonError(cpMapRes.error.message ?? "push item 매핑 조회 실패", 500);
        for (const row of cpMapRes.data ?? []) {
          const cpId = String(row.channel_product_id ?? "").trim();
          const masterId = String(row.master_item_id ?? "").trim();
          const variantCode = String(row.external_variant_code ?? "").trim();
          if (!cpId || !masterId) continue;
          logicalByChannelProductFromDb.set(cpId, logicalTargetKey(computeRequestId, masterId, variantCode));
        }
      }

      for (const item of pushItems) {
        const channelProductId = String(item.channel_product_id ?? "").trim();
        const itemMasterId = String(item.master_item_id ?? "").trim();
        const itemVariantCode = String(item.external_variant_code ?? "").trim();
        const logical = logicalByComputeAndChannelProduct.get(`${computeRequestId}:${channelProductId}`)
          ?? logicalByChannelProductFromDb.get(channelProductId)
          ?? (itemMasterId ? logicalTargetKey(computeRequestId, itemMasterId, itemVariantCode) : null)
          ?? null;
        if (!logical) continue;
        if (seenLogicalTargets.has(logical)) continue;
        seenLogicalTargets.add(logical);

        const intentIds = intentIdsByLogical.get(logical) ?? [];
        if (intentIds.length === 0) continue;

        const status = String(item.status ?? "").trim().toUpperCase();
        const itemErrorCode = String(item.error_code ?? "").trim().toUpperCase();
        const itemErrorMessage = String(item.error_message ?? "").trim();
        const itemReason = itemErrorCode || itemErrorMessage || null;
        const nextState = status === "SUCCESS" ? "SUCCEEDED" : "FAILED";
        if (nextState === "SUCCEEDED") success += intentIds.length;
        else failed += intentIds.length;

        await updateIntentAndTask(
          intentIds,
          nextState,
          item.http_status ?? null,
          itemReason,
          {
            ...(item.raw_response_json && typeof item.raw_response_json === "object" ? (item.raw_response_json as Record<string, unknown>) : { raw: item.raw_response_json ?? null }),
            ...(itemErrorCode ? { error_code: itemErrorCode } : {}),
          },
        );
      }
    }

    for (const logical of logicalKeysByCompute.get(computeRequestId) ?? new Set<string>()) {
      if (seenLogicalTargets.has(logical)) continue;
      const intentIds = intentIdsByLogical.get(logical) ?? [];
      if (intentIds.length === 0) continue;
      await updateIntentAndTask(intentIds, "FAILED", null, "PUSH_RESULT_FILTERED_OR_MISSING", null);
      failed += intentIds.length;
    }
  }

  const finalIntentRes = await sb
    .from("price_sync_intent_v2")
    .select("state")
    .eq("run_id", runId);
  if (finalIntentRes.error) return jsonError(finalIntentRes.error.message ?? "최종 intent 조회 실패", 500);

  const finalStates = (finalIntentRes.data ?? []).map((row) => String(row.state ?? "").trim().toUpperCase());
  const finalSuccess = finalStates.filter((s) => s === "SUCCEEDED").length;
  const finalSkipped = finalStates.filter((s) => s === "SKIPPED").length;
  const finalFailed = finalStates.filter((s) => s === "FAILED").length;
  const pendingCount = finalStates.filter((s) => !TERMINAL_INTENT_STATES.has(s)).length;

  if (pendingCount > 0) {
    await sb
      .from("price_sync_run_v2")
      .update({
        status: "RUNNING",
        success_count: finalSuccess,
        failed_count: finalFailed,
        skipped_count: finalSkipped,
      })
      .eq("run_id", runId);

    return NextResponse.json(
      {
        ok: true,
        run_id: runId,
        status: "RUNNING",
        success: finalSuccess,
        failed: finalFailed,
        skipped: finalSkipped,
        pending: pendingCount,
        processed_pending_batch: pendingIntents.length,
        execute_intent_batch_size: executeIntentBatchSize,
        push_chunk_size: pushChunkSize,
        job_ids: jobIds,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const status = deriveRunStatus(finalSuccess, finalFailed, finalSkipped);
  await sb
    .from("price_sync_run_v2")
    .update({
      status,
      success_count: finalSuccess,
      failed_count: finalFailed,
      skipped_count: finalSkipped,
      finished_at: new Date().toISOString(),
    })
    .eq("run_id", runId);

  return NextResponse.json(
    {
      ok: true,
      run_id: runId,
      status,
      success: finalSuccess,
      failed: finalFailed,
      skipped: finalSkipped,
      processed_pending_batch: pendingIntents.length,
      execute_intent_batch_size: executeIntentBatchSize,
      push_chunk_size: pushChunkSize,
      job_ids: jobIds,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
