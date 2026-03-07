import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { POST as pushPost } from "@/app/api/channel-prices/push/route";
import {
  buildAutoSyncPressureStateRow,
  buildAutoSyncPressureSuccessPatch,
  normalizeAutoSyncPressurePolicyConfig,
  resolveAutoSyncPressurePolicyConfig,
} from "@/lib/shop/price-sync-pressure-policy";

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
  desired_price_krw: number | null;
  state: string;
};

type SuccessfulPushItem = {
  channelProductId: string;
  masterItemId: string;
  externalVariantCode: string;
  beforePriceKrw: number;
  targetPriceKrw: number;
};

type ChangeEventType = "PRICE_CHANGED" | "PUSH_FAILED" | "FORCE_SYNC_APPLIED";

type ChangeEventRow = {
  channel_id: string;
  run_id: string;
  job_id?: string | null;
  job_item_id?: string | null;
  channel_product_id: string;
  master_item_id?: string | null;
  external_product_no?: string | null;
  external_variant_code?: string | null;
  compute_request_id?: string | null;
  trigger_type?: string | null;
  event_type: ChangeEventType;
  before_price_krw?: number | null;
  target_price_krw?: number | null;
  after_price_krw?: number | null;
  diff_krw?: number | null;
  http_status?: number | null;
  reason_code?: string | null;
  reason_detail: Record<string, unknown>;
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
    .select("run_id, channel_id, status, trigger_type, request_payload")
    .eq("run_id", runId)
    .maybeSingle();
  if (runRes.error) return jsonError(runRes.error.message ?? "run 조회 실패", 500);
  if (!runRes.data) return jsonError("run not found", 404);

  const channelId = String(runRes.data.channel_id ?? "").trim();
  if (!channelId) return jsonError("run.channel_id is missing", 500);

  const triggerType = String(runRes.data.trigger_type ?? "AUTO").trim().toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
  const runTriggerType = triggerType;
  const runRequestPayload = parseJsonObject(runRes.data.request_payload) ?? {};
  const forceFullSync = runRequestPayload.force_full_sync === true;

  const intentRes = await sb
    .from("price_sync_intent_v2")
    .select("intent_id, channel_product_id, master_item_id, external_variant_code, compute_request_id, desired_price_krw, state")
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
      desired_price_krw: row.desired_price_krw == null ? null : Number(row.desired_price_krw),
      state: String(row.state ?? "").trim().toUpperCase(),
    }))
    .filter((row) => row.intent_id && row.channel_product_id && row.master_item_id && row.compute_request_id);

  const pendingIntents = intents.slice(0, executeIntentBatchSize);
  const changeEventRows: ChangeEventRow[] = [];
  const CHANGE_EVENT_INSERT_CHUNK_SIZE = 500;

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
  const intentMetaByLogical = new Map<string, IntentRow>();
  const logicalByComputeAndChannelProduct = new Map<string, string>();
  const logicalKeysByCompute = new Map<string, Set<string>>();
  for (const row of pendingIntents) {
    const logical = logicalTargetKey(row.compute_request_id, row.master_item_id, row.external_variant_code);
    const prev = intentIdsByLogical.get(logical) ?? [];
    prev.push(row.intent_id);
    intentIdsByLogical.set(logical, prev);
    if (!intentMetaByLogical.has(logical)) intentMetaByLogical.set(logical, row);
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

  const jobIds: string[] = [];
  const successfulPushItemsByChannelProduct = new Map<string, SuccessfulPushItem>();

  const persistChangeEvents = async (): Promise<string | null> => {
    if (changeEventRows.length === 0) return null;
    for (const chunk of chunkArray(changeEventRows, CHANGE_EVENT_INSERT_CHUNK_SIZE)) {
      if (chunk.length === 0) continue;
      const insertRes = await sb.from("price_sync_change_event").insert(chunk);
      if (insertRes.error) return insertRes.error.message ?? "CHANGE_EVENT_INSERT_FAILED";
    }
    return null;
  };

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

      const desiredTargetByChannelProduct: Record<string, number> = {};
      for (const row of pendingIntents) {
        if (row.compute_request_id !== computeRequestId) continue;
        if (!productChunk.includes(row.channel_product_id)) continue;
        const desired = Number(row.desired_price_krw ?? Number.NaN);
        if (!Number.isFinite(desired) || desired <= 0) continue;
        desiredTargetByChannelProduct[row.channel_product_id] = Math.round(desired);
      }

      const pushRes = await pushPost(
        mkJsonRequest("/api/channel-prices/push", {
          channel_id: channelId,
          channel_product_ids: productChunk,
          compute_request_id: computeRequestId,
          run_type: "AUTO",
          dry_run: false,
          desired_target_price_by_channel_product: desiredTargetByChannelProduct,
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
          const meta = intentMetaByLogical.get(logical);
          if (meta) {
            changeEventRows.push({
              channel_id: channelId,
              run_id: runId,
              job_id: null,
              job_item_id: null,
              channel_product_id: meta.channel_product_id,
              master_item_id: meta.master_item_id || null,
              external_product_no: null,
              external_variant_code: meta.external_variant_code || null,
              compute_request_id: meta.compute_request_id || null,
              trigger_type: runTriggerType,
              event_type: "PUSH_FAILED",
              before_price_krw: null,
              target_price_krw: meta.desired_price_krw,
              after_price_krw: null,
              diff_krw: null,
              http_status: pushRes.status || null,
              reason_code: "PUSH_REQUEST_FAILED",
              reason_detail: {
                force_full_sync: forceFullSync,
                push_error: pushError,
                response: pushJson ?? null,
              },
            });
          }
              await updateIntentAndTask(intentIds, "FAILED", null, pushError, pushJson ?? null);
          seenLogicalTargets.add(logical);
        }
        continue;
      }

      const itemRes = await sb
        .from("price_sync_job_item")
        .select("job_item_id, channel_product_id, master_item_id, external_product_no, external_variant_code, before_price_krw, target_price_krw, after_price_krw, status, http_status, error_code, error_message, raw_response_json")
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
        const externalProductNo = String(item.external_product_no ?? "").trim() || null;
        const beforePriceKrw = Math.round(Number(item.before_price_krw ?? 0));
        const targetPriceKrw = Math.round(Number(item.target_price_krw ?? 0));
        const afterPriceRaw = Number(item.after_price_krw ?? Number.NaN);
        const afterPriceKrw = Number.isFinite(afterPriceRaw) ? Math.round(afterPriceRaw) : null;
        if (nextState === "SUCCEEDED") {
          successfulPushItemsByChannelProduct.set(channelProductId, {
            channelProductId,
            masterItemId: itemMasterId,
            externalVariantCode: itemVariantCode,
            beforePriceKrw,
            targetPriceKrw,
          });
        }

        if (nextState === "FAILED") {
          changeEventRows.push({
            channel_id: channelId,
            run_id: runId,
            job_id: jobId,
            job_item_id: String(item.job_item_id ?? "").trim() || null,
            channel_product_id: channelProductId,
            master_item_id: itemMasterId || null,
            external_product_no: externalProductNo,
            external_variant_code: itemVariantCode || null,
            compute_request_id: computeRequestId,
            trigger_type: runTriggerType,
            event_type: "PUSH_FAILED",
            before_price_krw: beforePriceKrw,
            target_price_krw: targetPriceKrw,
            after_price_krw: afterPriceKrw,
            diff_krw: afterPriceKrw === null ? null : afterPriceKrw - beforePriceKrw,
            http_status: item.http_status == null ? null : Number(item.http_status),
            reason_code: itemErrorCode || null,
            reason_detail: {
              force_full_sync: forceFullSync,
              error_message: itemErrorMessage || null,
              raw_response_json: item.raw_response_json ?? null,
            },
          });
        } else if (afterPriceKrw !== null && afterPriceKrw !== beforePriceKrw) {
          changeEventRows.push({
            channel_id: channelId,
            run_id: runId,
            job_id: jobId,
            job_item_id: String(item.job_item_id ?? "").trim() || null,
            channel_product_id: channelProductId,
            master_item_id: itemMasterId || null,
            external_product_no: externalProductNo,
            external_variant_code: itemVariantCode || null,
            compute_request_id: computeRequestId,
            trigger_type: runTriggerType,
            event_type: forceFullSync ? "FORCE_SYNC_APPLIED" : "PRICE_CHANGED",
            before_price_krw: beforePriceKrw,
            target_price_krw: targetPriceKrw,
            after_price_krw: afterPriceKrw,
            diff_krw: afterPriceKrw - beforePriceKrw,
            http_status: item.http_status == null ? null : Number(item.http_status),
            reason_code: null,
            reason_detail: {
              force_full_sync: forceFullSync,
              raw_response_json: item.raw_response_json ?? null,
            },
          });
        }

        await updateIntentAndTask(
          intentIds,
          nextState,
          item.http_status ?? null,
          itemReason,
          {
            ...(item.raw_response_json && typeof item.raw_response_json === "object" ? (item.raw_response_json as Record<string, unknown>) : { raw: item.raw_response_json ?? null }),
            ...(itemErrorCode ? { error_code: itemErrorCode } : {}),
            sync_job_id: jobId,
            applied_before_price_krw: beforePriceKrw,
            applied_target_price_krw: targetPriceKrw,
            applied_after_price_krw: item.after_price_krw,
          },
        );
      }
    }

    for (const logical of logicalKeysByCompute.get(computeRequestId) ?? new Set<string>()) {
      if (seenLogicalTargets.has(logical)) continue;
      const intentIds = intentIdsByLogical.get(logical) ?? [];
      if (intentIds.length === 0) continue;
      const meta = intentMetaByLogical.get(logical);
      if (meta) {
        changeEventRows.push({
          channel_id: channelId,
          run_id: runId,
          job_id: null,
          job_item_id: null,
          channel_product_id: meta.channel_product_id,
          master_item_id: meta.master_item_id || null,
          external_product_no: null,
          external_variant_code: meta.external_variant_code || null,
          compute_request_id: meta.compute_request_id || null,
          trigger_type: runTriggerType,
          event_type: "PUSH_FAILED",
          before_price_krw: null,
          target_price_krw: meta.desired_price_krw,
          after_price_krw: null,
          diff_krw: null,
          http_status: null,
          reason_code: "PUSH_RESULT_FILTERED_OR_MISSING",
          reason_detail: {
            force_full_sync: forceFullSync,
          },
        });
      }
      await updateIntentAndTask(intentIds, "FAILED", null, "PUSH_RESULT_FILTERED_OR_MISSING", null);
    }
  }

  const successfulPushItems = Array.from(successfulPushItemsByChannelProduct.values());
  if (runTriggerType === "AUTO" && successfulPushItems.length > 0) {
    const successfulChannelProductIds = successfulPushItems.map((item) => item.channelProductId);
    const previousStateByChannelProduct = new Map<string, Record<string, unknown>>();
    const productMetaByChannelProduct = new Map<string, { masterItemId: string; externalProductNo: string | null; externalVariantCode: string }>();
    const nowIso = new Date().toISOString();
    const pressurePolicyConfig = runRequestPayload.auto_downsync_pressure_policy
      ? normalizeAutoSyncPressurePolicyConfig(runRequestPayload.auto_downsync_pressure_policy)
      : resolveAutoSyncPressurePolicyConfig();

    for (const channelProductChunk of chunkArray(successfulChannelProductIds, 500)) {
      const [stateRes, productRes] = await Promise.all([
        sb
          .from("price_sync_auto_state_v1")
          .select("channel_product_id, pressure_units, last_gap_units, last_seen_target_krw, last_seen_current_krw, last_auto_sync_at, last_upsync_at, last_downsync_at, cooldown_until")
          .eq("channel_id", channelId)
          .in("channel_product_id", channelProductChunk),
        sb
          .from("sales_channel_product")
          .select("channel_product_id, master_item_id, external_product_no, external_variant_code")
          .in("channel_product_id", channelProductChunk),
      ]);
      if (stateRes.error) return jsonError(stateRes.error.message ?? "auto state 조회 실패", 500);
      if (productRes.error) return jsonError(productRes.error.message ?? "channel product 조회 실패", 500);

      for (const row of stateRes.data ?? []) {
        const channelProductId = String(row.channel_product_id ?? "").trim();
        if (!channelProductId) continue;
        previousStateByChannelProduct.set(channelProductId, row as Record<string, unknown>);
      }

      for (const row of productRes.data ?? []) {
        const channelProductId = String(row.channel_product_id ?? "").trim();
        if (!channelProductId) continue;
        productMetaByChannelProduct.set(channelProductId, {
          masterItemId: String(row.master_item_id ?? "").trim(),
          externalProductNo: row.external_product_no == null ? null : String(row.external_product_no ?? "").trim() || null,
          externalVariantCode: String(row.external_variant_code ?? "").trim(),
        });
      }
    }

    const autoStateRows = successfulPushItems.map((item) => {
      const previousState = previousStateByChannelProduct.get(item.channelProductId);
      const productMeta = productMetaByChannelProduct.get(item.channelProductId);
      const nextState = buildAutoSyncPressureSuccessPatch({
        previousState,
        beforePriceKrw: item.beforePriceKrw,
        targetPriceKrw: item.targetPriceKrw,
        now: nowIso,
        config: pressurePolicyConfig,
      });

      return buildAutoSyncPressureStateRow({
        channelId,
        channelProductId: item.channelProductId,
        masterItemId: item.masterItemId || productMeta?.masterItemId || null,
        externalProductNo: productMeta?.externalProductNo ?? "",
        externalVariantCode: item.externalVariantCode || productMeta?.externalVariantCode || null,
        nextState,
        now: nowIso,
      });
    });

    for (const rowChunk of chunkArray(autoStateRows, 500)) {
      const upsertRes = await sb
        .from("price_sync_auto_state_v1")
        .upsert(rowChunk, { onConflict: "channel_id,channel_product_id" });
      if (upsertRes.error) return jsonError(upsertRes.error.message ?? "auto state 저장 실패", 500);
    }
  }

  const changeEventPersistError = await persistChangeEvents();

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
        change_event_logged: changeEventRows.length,
        change_event_error: changeEventPersistError,
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
      change_event_logged: changeEventRows.length,
      change_event_error: changeEventPersistError,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
