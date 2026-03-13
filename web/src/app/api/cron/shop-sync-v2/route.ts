import { NextResponse } from "next/server";
import { POST as pullPost } from "@/app/api/channel-prices/pull/route";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as createRunPost } from "@/app/api/price-sync-runs-v2/route";
import { POST as executeRunPost } from "@/app/api/price-sync-runs-v2/[run_id]/execute/route";
import { getShopAdminClient } from "@/lib/shop/admin";
import { isAuthorizedCronRequest, resolveAllowedCronSecrets } from "@/lib/shop/cron-auth";
import { buildCurrentProductSyncProfileByMaster } from "@/lib/shop/current-product-sync-profile";
import { CRON_TICK_ERROR_PREFIX, isCronTickError } from "@/lib/shop/price-sync-guards";
import { buildFinalizedScheduleRows, buildScopedSyncPlan } from "@/lib/shop/sync-scheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const bad = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });

const mkJsonRequest = (path: string, payload: Record<string, unknown>) =>
  new Request(`https://internal.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const toPositiveInt = (value: unknown, fallback: number, max = 10000): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
};

const toIntInRange = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const resolveRunningStaleWindowMs = (): number => {
  const staleMinutes = toPositiveInt(process.env.SHOP_SYNC_RUNNING_STALE_MINUTES, 360, 7 * 24 * 60);
  return staleMinutes * 60 * 1000;
};

const resolveIntervalEarlyGraceMs = (): number => {
  const graceSeconds = toPositiveInt(process.env.SHOP_SYNC_INTERVAL_EARLY_GRACE_SECONDS, 30, 300);
  return graceSeconds * 1000;
};

const resolveDefaultIntervalMinutes = (): number => {
  return toPositiveInt(process.env.SHOP_SYNC_DEFAULT_INTERVAL_MINUTES, 5, 60);
};

const resolveForcedIntervalMinutes = (): number => {
  return 5;
};

const resolveSchedulerLeaseSeconds = (): number => {
  return toPositiveInt(process.env.SHOP_SYNC_SCHEDULER_LEASE_SECONDS, 20 * 60, 24 * 60 * 60);
};

const resolvePolicyTimezone = (): string => {
  const raw = String(process.env.SHOP_SYNC_POLICY_TIMEZONE ?? "").trim();
  return raw || "Asia/Seoul";
};

const resolveDailyFullSyncHour = (): number => {
  return toIntInRange(process.env.SHOP_SYNC_DAILY_FULL_SYNC_HOUR, 0, 0, 23);
};

const resolveDailyFullSyncWindowMinutes = (): number => {
  return toPositiveInt(process.env.SHOP_SYNC_DAILY_FULL_SYNC_WINDOW_MINUTES, 15, 180);
};

const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "y" || normalized === "yes";
};

const getLocalTimeParts = (date: Date, timeZone: string): { dateKey: string; hour: number; minute: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = String(byType.get("year") ?? "").trim();
  const month = String(byType.get("month") ?? "").trim();
  const day = String(byType.get("day") ?? "").trim();
  const hour = Number(byType.get("hour") ?? Number.NaN);
  const minute = Number(byType.get("minute") ?? Number.NaN);

  if (year && month && day && Number.isFinite(hour) && Number.isFinite(minute)) {
    return {
      dateKey: `${year}-${month}-${day}`,
      hour: Math.max(0, Math.min(23, Math.floor(hour))),
      minute: Math.max(0, Math.min(59, Math.floor(minute))),
    };
  }

  return {
    dateKey: date.toISOString().slice(0, 10),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
};

const toMs = (value: unknown): number | null => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const toDetailSnippet = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length <= 600) return trimmed;
    return `${trimmed.slice(0, 600)}...`;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const sample = value.slice(0, 3).map((item) => (depth >= 1 ? String(item ?? "") : toDetailSnippet(item, depth + 1)));
    return { type: "array", length: value.length, sample };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    const limited = entries.slice(0, 15);
    const out: Record<string, unknown> = {};
    for (const [key, val] of limited) {
      if (depth >= 1) {
        if (val && typeof val === "object") out[key] = "[object]";
        else out[key] = val as unknown;
      } else {
        out[key] = toDetailSnippet(val, depth + 1);
      }
    }
    if (entries.length > limited.length) out.__truncated_keys = entries.length - limited.length;
    return out;
  }
  return String(value);
};

type ShopAdminClient = NonNullable<ReturnType<typeof getShopAdminClient>>;

type ActiveSchedulerMappingRow = {
  channel_product_id?: string | null;
  master_item_id?: string | null;
  current_product_sync_profile?: string | null;
};

type SchedulerStateRow = {
  master_item_id?: string | null;
  effective_sync_profile?: string | null;
  cadence_minutes?: number | null;
  next_due_at?: string | null;
  last_evaluated_at?: string | null;
  last_evaluated_run_id?: string | null;
  last_evaluated_compute_request_id?: string | null;
  last_evaluated_reason?: string | null;
};

const parseMasterItemIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

const isMissingRpcSchemaCacheError = (message: string): boolean => {
  const normalized = String(message ?? "").toLowerCase();
  return normalized.includes("schema cache") || normalized.includes("could not find the function");
};

async function claimSchedulerLeaseFallback(
  sb: ShopAdminClient,
  channelId: string,
  ownerToken: string,
  leaseSeconds: number,
) {
  const nowIso = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + (leaseSeconds * 1000)).toISOString();
  const existingRes = await sb
    .from("price_sync_scheduler_lease_v1")
    .select("channel_id, owner_token, lease_expires_at")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (existingRes.error) throw new Error(existingRes.error.message ?? "scheduler lease fallback lookup failed");

  const existing = existingRes.data ?? null;
  if (!existing) {
    const insertRes = await sb.from("price_sync_scheduler_lease_v1").insert({
      channel_id: channelId,
      owner_token: ownerToken,
      lease_expires_at: leaseExpiresAt,
      last_tick_started_at: nowIso,
      last_tick_status: "RUNNING",
      last_tick_error: null,
    });
    if (insertRes.error) return false;
    return true;
  }

  const existingExpiresMs = toMs(existing.lease_expires_at);
  const expired = existingExpiresMs === null || existingExpiresMs <= Date.now();
  const sameOwner = String(existing.owner_token ?? "").trim() === ownerToken;
  if (!expired && !sameOwner) return false;

  const updateRes = await sb
    .from("price_sync_scheduler_lease_v1")
    .update({
      owner_token: ownerToken,
      lease_expires_at: leaseExpiresAt,
      last_tick_started_at: nowIso,
      last_tick_finished_at: null,
      last_tick_status: "RUNNING",
      last_tick_error: null,
    })
    .eq("channel_id", channelId);
  if (updateRes.error) throw new Error(updateRes.error.message ?? "scheduler lease fallback update failed");
  return true;
};

async function claimSchedulerLease(
  sb: ShopAdminClient,
  channelId: string,
  ownerToken: string,
  leaseSeconds: number,
) {
  const leaseRes = await sb.rpc("claim_price_sync_scheduler_lease_v1", {
    p_channel_id: channelId,
    p_owner_token: ownerToken,
    p_lease_seconds: leaseSeconds,
  });
  if (leaseRes.error) {
    const message = leaseRes.error.message ?? "scheduler lease claim failed";
    if (isMissingRpcSchemaCacheError(message)) {
      try {
        return await claimSchedulerLeaseFallback(sb, channelId, ownerToken, leaseSeconds);
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "scheduler lease fallback failed";
        if (isMissingRpcSchemaCacheError(fallbackMessage)) return true;
        throw fallbackError;
      }
    }
    throw new Error(message);
  }
  const data = typeof leaseRes.data === "object" && leaseRes.data && !Array.isArray(leaseRes.data)
    ? leaseRes.data as Record<string, unknown>
    : {};
  return Boolean(data.ok === true);
}

async function releaseSchedulerLease(
  sb: ShopAdminClient,
  channelId: string,
  ownerToken: string,
  status: "SUCCESS" | "FAILED" | "SKIPPED",
  errorMessage: string | null,
) {
  const releaseRes = await sb.rpc("release_price_sync_scheduler_lease_v1", {
    p_channel_id: channelId,
    p_owner_token: ownerToken,
    p_status: status,
    p_error: errorMessage,
  });
  if (!releaseRes.error) return;
  const message = releaseRes.error.message ?? "scheduler lease release failed";
  if (!isMissingRpcSchemaCacheError(message)) throw new Error(message);
  const nowIso = new Date().toISOString();
  const updateRes = await sb
    .from("price_sync_scheduler_lease_v1")
    .update({
      lease_expires_at: nowIso,
      last_tick_finished_at: nowIso,
      last_tick_status: status,
      last_tick_error: errorMessage,
    })
    .eq("channel_id", channelId)
    .eq("owner_token", ownerToken);
  if (updateRes.error) {
    const fallbackMessage = updateRes.error.message ?? "scheduler lease fallback release failed";
    if (isMissingRpcSchemaCacheError(fallbackMessage)) return;
    throw new Error(fallbackMessage);
  }
}

async function loadScopedSchedulerState(
  sb: ShopAdminClient,
  channelId: string,
  masterItemIds: string[],
): Promise<SchedulerStateRow[]> {
  const rows: SchedulerStateRow[] = [];
  for (let index = 0; index < masterItemIds.length; index += 500) {
    const chunk = masterItemIds.slice(index, index + 500);
    if (chunk.length === 0) continue;
    const res = await sb
      .from("price_sync_master_schedule_v1")
      .select("master_item_id, effective_sync_profile, cadence_minutes, next_due_at, last_evaluated_at, last_evaluated_run_id, last_evaluated_compute_request_id, last_evaluated_reason")
      .eq("channel_id", channelId)
      .in("master_item_id", chunk);
    if (res.error) {
      const message = res.error.message ?? "price_sync_master_schedule_v1 lookup failed";
      if (isMissingRpcSchemaCacheError(message)) return [];
      throw new Error(message);
    }
    rows.push(...((res.data ?? []) as SchedulerStateRow[]));
  }
  return rows;
}

async function upsertSchedulerRows(
  sb: ShopAdminClient,
  rows: Array<Record<string, unknown>>,
) {
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    if (chunk.length === 0) continue;
    const res = await sb
      .from("price_sync_master_schedule_v1")
      .upsert(chunk, { onConflict: "channel_id,master_item_id" });
    if (res.error) throw new Error(res.error.message ?? "price_sync_master_schedule_v1 upsert failed");
  }
}

async function recordCronTickRun(
  sb: ShopAdminClient,
  args: {
    channelId: string;
    intervalMinutes: number;
    reason: string;
    relatedRunId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const nowIso = new Date().toISOString();
  const reason = String(args.reason ?? "").trim() || "UNKNOWN";
  const payload: Record<string, unknown> = {
    cron_tick: true,
    reason,
  };
  const relatedRunId = String(args.relatedRunId ?? "").trim();
  if (relatedRunId) payload.related_run_id = relatedRunId;
  if (args.detail && Object.keys(args.detail).length > 0) payload.detail = args.detail;

  const insertRes = await sb.from("price_sync_run_v2").insert({
    channel_id: args.channelId,
    pinned_compute_request_id: null,
    interval_minutes: args.intervalMinutes,
    trigger_type: "AUTO",
    status: "CANCELLED",
    total_count: 0,
    success_count: 0,
    failed_count: 0,
    skipped_count: 0,
    request_payload: payload,
    error_message: `${CRON_TICK_ERROR_PREFIX}${reason}`,
    started_at: nowIso,
    finished_at: nowIso,
  });
  if (insertRes.error) {
    console.error("recordCronTickRun failed", insertRes.error.message);
  }
}

function parseInput(request: Request, bodyObj: Record<string, unknown>) {
  const allowedSecrets = resolveAllowedCronSecrets({
    shopSyncCronSecret: process.env.SHOP_SYNC_CRON_SECRET,
    cronSecret: process.env.CRON_SECRET,
  });
  if (allowedSecrets.length === 0) throw new Error("SHOP_SYNC_CRON_SECRET or CRON_SECRET env is required");

  if (!isAuthorizedCronRequest(request, bodyObj, {
    shopSyncCronSecret: process.env.SHOP_SYNC_CRON_SECRET,
    cronSecret: process.env.CRON_SECRET,
  })) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelId = String(
    bodyObj.channel_id
    ?? searchParams.get("channel_id")
    ?? process.env.SHOP_SYNC_CHANNEL_ID
    ?? "",
  ).trim();
  if (!channelId) throw Object.assign(new Error("channel_id is required"), { status: 400 });

  const intervalRaw = Number(
    bodyObj.interval_minutes
    ?? searchParams.get("interval_minutes")
    ?? resolveDefaultIntervalMinutes(),
  );
  const requestedIntervalMinutes = Number.isFinite(intervalRaw)
    ? Math.max(1, Math.min(60, Math.floor(intervalRaw)))
    : resolveDefaultIntervalMinutes();
  const intervalMinutes = resolveForcedIntervalMinutes();

  const forceFullSyncRequested = toBool(
    bodyObj.force_full_sync
    ?? searchParams.get("force_full_sync")
    ?? false,
  );

  return { channelId, intervalMinutes, requestedIntervalMinutes, forceFullSyncRequested };
}

async function runCron(request: Request) {
  const body = await request.json().catch(() => ({}));
  const bodyObj = typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  let input: { channelId: string; intervalMinutes: number; requestedIntervalMinutes: number; forceFullSyncRequested: boolean };
  try {
    input = parseInput(request, bodyObj);
  } catch (err) {
    const status = Number((err as { status?: number }).status ?? 500);
    return bad(err instanceof Error ? err.message : "invalid request", status);
  }

  const { channelId, intervalMinutes, requestedIntervalMinutes, forceFullSyncRequested } = input;
  const runningStaleWindowMs = resolveRunningStaleWindowMs();
  const schedulerLeaseSeconds = resolveSchedulerLeaseSeconds();
  const executeRoundLimit = toPositiveInt(process.env.SHOP_SYNC_EXECUTE_MAX_ROUNDS, 12, 200);
  const executeIntentBatchSize = toPositiveInt(process.env.SHOP_SYNC_EXECUTE_INTENT_BATCH_SIZE, 300, 5000);
  const pushChunkSize = toPositiveInt(process.env.SHOP_SYNC_PUSH_CHUNK_SIZE, 150, 1000);
  const sb = getShopAdminClient();
  if (!sb) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase server env missing",
        has_next_public_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        has_supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const leaseOwnerToken = crypto.randomUUID();
  let leaseClaimed = false;
  let leaseStatus: "SUCCESS" | "FAILED" | "SKIPPED" = "SKIPPED";
  let leaseErrorMessage: string | null = null;

  try {
    leaseClaimed = await claimSchedulerLease(sb, channelId, leaseOwnerToken, schedulerLeaseSeconds);
    if (!leaseClaimed) {
      return NextResponse.json(
        {
          ok: true,
          mode: "AUTO_SYNC_V2",
          channel_id: channelId,
          interval_minutes: intervalMinutes,
          requested_interval_minutes: requestedIntervalMinutes,
          skipped: true,
          skip_reason: "LEASE_HELD",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

  const runningRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, started_at, request_payload")
    .eq("channel_id", channelId)
    .eq("status", "RUNNING")
    .order("started_at", { ascending: false })
    .limit(1);
  if (runningRes.error) {
    leaseStatus = "FAILED";
    leaseErrorMessage = runningRes.error.message ?? "running run 조회 실패";
    return bad(leaseErrorMessage, 500);
  }

  const running = (runningRes.data ?? [])[0];
  if (running) {
    const startedAtMs = toMs((running as { started_at?: unknown }).started_at);
    const overlapActive = startedAtMs === null || (Date.now() - startedAtMs) <= runningStaleWindowMs;
    if (overlapActive) {
      const activeRunId = String((running as { run_id?: unknown }).run_id ?? "").trim() || null;

      if (activeRunId) {
        const resumedExecuteSnapshots: unknown[] = [];
        let resumedExecuteJson: Record<string, unknown> = {};

        for (let round = 0; round < executeRoundLimit; round += 1) {
          const executeRes = await executeRunPost(
            mkJsonRequest(`/api/price-sync-runs-v2/${activeRunId}/execute`, {
              intent_batch_size: executeIntentBatchSize,
              push_chunk_size: pushChunkSize,
            }),
            { params: Promise.resolve({ run_id: activeRunId }) },
          );
          resumedExecuteJson = (await executeRes.json().catch(() => ({}))) as Record<string, unknown>;
          resumedExecuteSnapshots.push({ round: round + 1, status: executeRes.status, body: resumedExecuteJson });

          if (!executeRes.ok) {
            await recordCronTickRun(sb, {
              channelId,
              intervalMinutes,
              reason: "EXECUTE_RUN_FAILED",
              relatedRunId: activeRunId,
              detail: {
                stage: "execute_run",
                status: executeRes.status,
                round: round + 1,
                payload_snippet: toDetailSnippet(resumedExecuteJson),
              },
            });
            leaseStatus = "FAILED";
            leaseErrorMessage = `EXECUTE_RUN_FAILED:${executeRes.status}`;
            return NextResponse.json(
              {
                ok: false,
                stage: "execute_run",
                status: executeRes.status,
                detail: resumedExecuteJson,
                channel_id: channelId,
                run_id: activeRunId,
                resumed_existing_run: true,
              },
              { status: executeRes.status, headers: { "Cache-Control": "no-store" } },
            );
          }

          const runStatus = String(resumedExecuteJson.status ?? "").trim().toUpperCase();
          const pending = Number(resumedExecuteJson.pending ?? 0);
          if (runStatus !== "RUNNING" || !Number.isFinite(pending) || pending <= 0) break;
        }

        const resumedStatus = String(resumedExecuteJson.status ?? "").trim().toUpperCase();
        if (resumedStatus !== "RUNNING") {
          const runningPayload = (running as { request_payload?: unknown }).request_payload;
          const runningPayloadObj = runningPayload && typeof runningPayload === "object" && !Array.isArray(runningPayload)
            ? runningPayload as Record<string, unknown>
            : {};
          const resumedMasterItemIds = parseMasterItemIds(runningPayloadObj.scope_master_item_ids ?? runningPayloadObj.master_item_ids);
          if (resumedMasterItemIds.length > 0) {
            const activeMapRes = await sb
              .from("sales_channel_product")
              .select("channel_product_id, master_item_id, current_product_sync_profile")
              .eq("channel_id", channelId)
              .eq("is_active", true)
              .in("master_item_id", resumedMasterItemIds);
            if (activeMapRes.error) {
              throw new Error(activeMapRes.error.message ?? "active mapping lookup failed for resumed run finalization");
            }
            const activeMapRows = (activeMapRes.data ?? []) as ActiveSchedulerMappingRow[];
            const profileByMaster = buildCurrentProductSyncProfileByMaster(activeMapRows);
            await upsertSchedulerRows(
              sb,
              buildFinalizedScheduleRows({
                channelId,
                masterItemIds: resumedMasterItemIds,
                profileByMaster,
                now: new Date().toISOString(),
                runId: activeRunId,
                computeRequestId: String(runningPayloadObj.compute_request_id ?? "").trim() || null,
                reason: runningPayloadObj.scheduler_reason === "DAILY_FULL_SYNC" ? "DAILY_FULL_SYNC" : "DUE",
              }),
            );
          }
          leaseStatus = "SUCCESS";
          return NextResponse.json(
            {
              ok: true,
              mode: "AUTO_SYNC_V2",
              channel_id: channelId,
              interval_minutes: intervalMinutes,
              requested_interval_minutes: requestedIntervalMinutes,
              resumed_existing_run: true,
              run_id: activeRunId,
              execute: resumedExecuteJson,
              execute_rounds: resumedExecuteSnapshots,
              execute_round_limit: executeRoundLimit,
              execute_intent_batch_size: executeIntentBatchSize,
              push_chunk_size: pushChunkSize,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
      }

      await recordCronTickRun(sb, {
        channelId,
        intervalMinutes,
        reason: "OVERLAP_RUNNING",
        relatedRunId: activeRunId,
        detail: { running_stale_minutes: Math.floor(runningStaleWindowMs / 60000) },
      });
      return NextResponse.json(
        {
          ok: true,
          mode: "AUTO_SYNC_V2",
          channel_id: channelId,
          interval_minutes: intervalMinutes,
          requested_interval_minutes: requestedIntervalMinutes,
          skipped: true,
          skip_reason: "OVERLAP_RUNNING",
          running_stale_minutes: Math.floor(runningStaleWindowMs / 60000),
          run_id: activeRunId,
          resumed_existing_run: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const recentRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, status, started_at, error_message, request_payload")
    .eq("channel_id", channelId)
    .in("status", ["SUCCESS", "PARTIAL", "FAILED", "CANCELLED"])
    .order("started_at", { ascending: false })
    .limit(30);
  if (recentRes.error) {
    leaseStatus = "FAILED";
    leaseErrorMessage = recentRes.error.message ?? "최근 run 조회 실패";
    return bad(leaseErrorMessage, 500);
  }

  const policyTimezone = resolvePolicyTimezone();
  const nowLocal = getLocalTimeParts(new Date(), policyTimezone);
  const isDailyWindow = nowLocal.hour === resolveDailyFullSyncHour()
    && nowLocal.minute < resolveDailyFullSyncWindowMinutes();
  const hasDailyFullSyncToday = (recentRes.data ?? []).some((row) => {
    if (isCronTickError((row as { error_message?: unknown }).error_message)) return false;
    const payload = (row as { request_payload?: unknown }).request_payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const payloadObj = payload as Record<string, unknown>;
    return toBool(payloadObj.daily_full_sync) && String(payloadObj.daily_full_sync_date ?? "").trim() === nowLocal.dateKey;
  });
  const forceFullSync = forceFullSyncRequested || (isDailyWindow && !hasDailyFullSyncToday);

  const recent = (recentRes.data ?? []).find((row) => !isCronTickError((row as { error_message?: unknown }).error_message));
  if (recent) {
    const startedAtMs = toMs((recent as { started_at?: unknown }).started_at);
    if (startedAtMs !== null) {
      const elapsedMs = Date.now() - startedAtMs;
      const intervalWindowMs = intervalMinutes * 60 * 1000;
      const intervalEarlyGraceMs = Math.min(
        resolveIntervalEarlyGraceMs(),
        Math.max(0, Math.floor(intervalWindowMs * 0.1)),
      );
      if (!forceFullSync && elapsedMs >= 0 && (elapsedMs + intervalEarlyGraceMs) < intervalWindowMs) {
        const recentRunId = String((recent as { run_id?: unknown }).run_id ?? "").trim() || null;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const graceSeconds = Math.floor(intervalEarlyGraceMs / 1000);
        await recordCronTickRun(sb, {
          channelId,
          intervalMinutes,
          reason: "INTERVAL_NOT_ELAPSED",
          relatedRunId: recentRunId,
          detail: { elapsed_minutes: elapsedMinutes, interval_early_grace_seconds: graceSeconds },
        });
        return NextResponse.json(
          {
            ok: true,
            mode: "AUTO_SYNC_V2",
            channel_id: channelId,
            interval_minutes: intervalMinutes,
            requested_interval_minutes: requestedIntervalMinutes,
            skipped: true,
            skip_reason: "INTERVAL_NOT_ELAPSED",
            elapsed_minutes: elapsedMinutes,
            interval_early_grace_seconds: graceSeconds,
            run_id: recentRunId,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
  }

  const activeMappingsRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, current_product_sync_profile")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (activeMappingsRes.error) {
    throw new Error(activeMappingsRes.error.message ?? "active scheduler mapping lookup failed");
  }
  const activeMapRows = (activeMappingsRes.data ?? []) as ActiveSchedulerMappingRow[];
  const activeMasterItemIds = Array.from(new Set(activeMapRows.map((row) => String(row.master_item_id ?? "").trim()).filter(Boolean)));
  if (activeMasterItemIds.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        mode: "AUTO_SYNC_V2",
        channel_id: channelId,
        interval_minutes: intervalMinutes,
        requested_interval_minutes: requestedIntervalMinutes,
        skipped: true,
        skip_reason: "NO_ACTIVE_MAPPINGS",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const existingScheduleRows = await loadScopedSchedulerState(sb, channelId, activeMasterItemIds);
  const scopedPlan = buildScopedSyncPlan({
    channelId,
    activeMapRows,
    existingScheduleRows,
    now: new Date().toISOString(),
    forceFullSync,
  });
  if (scopedPlan.seedRows.length > 0) {
    await upsertSchedulerRows(sb, scopedPlan.seedRows);
  }
  if (scopedPlan.dueMasterIds.length === 0 || scopedPlan.dueChannelProductIds.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        mode: "AUTO_SYNC_V2",
        channel_id: channelId,
        interval_minutes: intervalMinutes,
        requested_interval_minutes: requestedIntervalMinutes,
        skipped: true,
        skip_reason: "NO_DUE_MASTERS",
        due_master_count: 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const pullRes = await pullPost(mkJsonRequest("/api/channel-prices/pull", {
    channel_id: channelId,
    channel_product_ids: scopedPlan.dueChannelProductIds,
  }));
  const pullJson = await pullRes.json().catch(() => ({}));
  if (!pullRes.ok) {
    await recordCronTickRun(sb, {
      channelId,
      intervalMinutes,
      reason: "PULL_FAILED",
      relatedRunId: null,
      detail: {
        stage: "pull",
        status: pullRes.status,
        payload_snippet: toDetailSnippet(pullJson),
      },
    });
    leaseStatus = "FAILED";
    leaseErrorMessage = `PULL_FAILED:${pullRes.status}`;
    return NextResponse.json(
      { ok: false, stage: "pull", status: pullRes.status, detail: pullJson, channel_id: channelId },
      { status: pullRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const recomputeRes = await recomputePost(mkJsonRequest("/api/pricing/recompute", {
    channel_id: channelId,
    master_item_ids: scopedPlan.dueMasterIds,
    pricing_algo_version: "REVERSE_FEE_V2",
  }));
  const recomputeJson = await recomputeRes.json().catch(() => ({}));
  if (!recomputeRes.ok) {
    await recordCronTickRun(sb, {
      channelId,
      intervalMinutes,
      reason: "RECOMPUTE_FAILED",
      relatedRunId: null,
      detail: {
        stage: "recompute",
        status: recomputeRes.status,
        payload_snippet: toDetailSnippet(recomputeJson),
      },
    });
    leaseStatus = "FAILED";
    leaseErrorMessage = `RECOMPUTE_FAILED:${recomputeRes.status}`;
    return NextResponse.json(
      { ok: false, stage: "recompute", status: recomputeRes.status, detail: recomputeJson, channel_id: channelId },
      { status: recomputeRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const runCreateRes = await createRunPost(
    mkJsonRequest("/api/price-sync-runs-v2", {
      channel_id: channelId,
      interval_minutes: intervalMinutes,
      trigger_type: "AUTO",
      master_item_ids: scopedPlan.dueMasterIds,
      scope_master_item_ids: scopedPlan.dueMasterIds,
      force_full_sync: forceFullSync,
      daily_full_sync: forceFullSync,
      daily_full_sync_date: forceFullSync ? nowLocal.dateKey : undefined,
      scheduler_reason: forceFullSync ? "DAILY_FULL_SYNC" : "DUE",
      compute_request_id: String((recomputeJson as { compute_request_id?: unknown }).compute_request_id ?? "").trim() || undefined,
    }),
  );
  const runCreateJson = await runCreateRes.json().catch(() => ({}));
  if (!runCreateRes.ok) {
    await recordCronTickRun(sb, {
      channelId,
      intervalMinutes,
      reason: "CREATE_RUN_FAILED",
      relatedRunId: null,
      detail: {
        stage: "create_run",
        status: runCreateRes.status,
        payload_snippet: toDetailSnippet(runCreateJson),
      },
    });
    leaseStatus = "FAILED";
    leaseErrorMessage = `CREATE_RUN_FAILED:${runCreateRes.status}`;
    return NextResponse.json(
      { ok: false, stage: "create_run", status: runCreateRes.status, detail: runCreateJson, channel_id: channelId },
      { status: runCreateRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const runId = String((runCreateJson as { run_id?: unknown }).run_id ?? "").trim();
  const skipped = Boolean((runCreateJson as { skipped?: unknown }).skipped === true);
  const skipReason = String((runCreateJson as { skip_reason?: unknown }).skip_reason ?? "").trim();

  if (skipped) {
    await recordCronTickRun(sb, {
      channelId,
      intervalMinutes,
      reason: skipReason || "RUN_SKIPPED",
      relatedRunId: runId || null,
      detail: { stage: "create_run" },
    });
    return NextResponse.json(
      {
        ok: true,
        mode: "AUTO_SYNC_V2",
        channel_id: channelId,
        interval_minutes: intervalMinutes,
        pull: pullJson,
        recompute: recomputeJson,
        run: runCreateJson,
        skipped: true,
        skip_reason: skipReason || "RUN_SKIPPED",
        force_full_sync: forceFullSync,
        daily_full_sync_date: forceFullSync ? nowLocal.dateKey : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!runId) {
    await recordCronTickRun(sb, {
      channelId,
      intervalMinutes,
      reason: "CREATE_RUN_FAILED",
      relatedRunId: null,
      detail: {
        stage: "create_run",
        status: 500,
        error: "run_id missing",
        payload_snippet: toDetailSnippet(runCreateJson),
      },
    });
    leaseStatus = "FAILED";
    leaseErrorMessage = "CREATE_RUN_FAILED:run_id missing";
    return NextResponse.json(
      { ok: false, stage: "create_run", status: 500, detail: "run_id missing", channel_id: channelId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const executeSnapshots: unknown[] = [];
  let executeJson: Record<string, unknown> = {};
  for (let round = 0; round < executeRoundLimit; round += 1) {
    const executeRes = await executeRunPost(
      mkJsonRequest(`/api/price-sync-runs-v2/${runId}/execute`, {
        intent_batch_size: executeIntentBatchSize,
        push_chunk_size: pushChunkSize,
      }),
      { params: Promise.resolve({ run_id: runId }) },
    );
    executeJson = (await executeRes.json().catch(() => ({}))) as Record<string, unknown>;
    executeSnapshots.push({ round: round + 1, status: executeRes.status, body: executeJson });
    if (!executeRes.ok) {
      await recordCronTickRun(sb, {
        channelId,
        intervalMinutes,
        reason: "EXECUTE_RUN_FAILED",
        relatedRunId: runId,
        detail: {
          stage: "execute_run",
          status: executeRes.status,
          round: round + 1,
          payload_snippet: toDetailSnippet(executeJson),
        },
      });
      leaseStatus = "FAILED";
      leaseErrorMessage = `EXECUTE_RUN_FAILED:${executeRes.status}`;
      return NextResponse.json(
        { ok: false, stage: "execute_run", status: executeRes.status, detail: executeJson, channel_id: channelId, run_id: runId },
        { status: executeRes.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const runStatus = String(executeJson.status ?? "").trim().toUpperCase();
    const pending = Number(executeJson.pending ?? 0);
    if (runStatus !== "RUNNING" || !Number.isFinite(pending) || pending <= 0) break;
  }

  const terminalRunStatus = String(executeJson.status ?? "").trim().toUpperCase();
  if (terminalRunStatus && terminalRunStatus !== "RUNNING") {
    await upsertSchedulerRows(
      sb,
      buildFinalizedScheduleRows({
        channelId,
        masterItemIds: scopedPlan.dueMasterIds,
        profileByMaster: scopedPlan.profileByMaster,
        now: new Date().toISOString(),
        runId,
        computeRequestId: String((recomputeJson as { compute_request_id?: unknown }).compute_request_id ?? "").trim() || null,
        reason: forceFullSync ? "DAILY_FULL_SYNC" : "DUE",
      }),
    );
  }

  let cleanupJson: Record<string, unknown> | null = null;
  if (new Date().getUTCMinutes() % 30 === 0) {
    const cleanupRes = await sb.rpc("cleanup_operational_snapshot_history_v1");
    if (!cleanupRes.error) {
      cleanupJson = typeof cleanupRes.data === "object" && cleanupRes.data && !Array.isArray(cleanupRes.data)
        ? cleanupRes.data as Record<string, unknown>
        : { ok: true };
    }
  }

  leaseStatus = "SUCCESS";
  return NextResponse.json(
    {
      ok: true,
      mode: "AUTO_SYNC_V2",
      channel_id: channelId,
      interval_minutes: intervalMinutes,
      pull: pullJson,
      recompute: recomputeJson,
      run: runCreateJson,
      execute: executeJson,
      force_full_sync: forceFullSync,
      daily_full_sync_date: forceFullSync ? nowLocal.dateKey : null,
      due_master_count: scopedPlan.dueMasterIds.length,
      due_channel_product_count: scopedPlan.dueChannelProductIds.length,
      execute_rounds: executeSnapshots,
      execute_round_limit: executeRoundLimit,
      execute_intent_batch_size: executeIntentBatchSize,
      push_chunk_size: pushChunkSize,
      cleanup: cleanupJson,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  } catch (error) {
    leaseStatus = "FAILED";
    leaseErrorMessage = error instanceof Error ? error.message : "scheduler cron failed";
    return bad(leaseErrorMessage, 500);
  } finally {
    if (leaseClaimed) {
      await releaseSchedulerLease(sb, channelId, leaseOwnerToken, leaseStatus, leaseErrorMessage).catch(() => null);
    }
  }
}

export async function POST(request: Request) {
  return runCron(request);
}

export async function GET(request: Request) {
  return runCron(request);
}
