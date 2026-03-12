import { NextResponse } from "next/server";
import { POST as pullPost } from "@/app/api/channel-prices/pull/route";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as createRunPost } from "@/app/api/price-sync-runs-v2/route";
import { POST as executeRunPost } from "@/app/api/price-sync-runs-v2/[run_id]/execute/route";
import { getShopAdminClient } from "@/lib/shop/admin";
import { isAuthorizedCronRequest, resolveAllowedCronSecrets } from "@/lib/shop/cron-auth";
import { CRON_TICK_ERROR_PREFIX, isCronTickError } from "@/lib/shop/price-sync-guards";

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

  const runningRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, started_at")
    .eq("channel_id", channelId)
    .eq("status", "RUNNING")
    .order("started_at", { ascending: false })
    .limit(1);
  if (runningRes.error) {
    return bad(runningRes.error.message ?? "running run 조회 실패", 500);
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
    return bad(recentRes.error.message ?? "최근 run 조회 실패", 500);
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

  const pullRes = await pullPost(mkJsonRequest("/api/channel-prices/pull", { channel_id: channelId }));
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
    return NextResponse.json(
      { ok: false, stage: "pull", status: pullRes.status, detail: pullJson, channel_id: channelId },
      { status: pullRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const recomputeRes = await recomputePost(mkJsonRequest("/api/pricing/recompute", { channel_id: channelId, pricing_algo_version: "REVERSE_FEE_V2" }));
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
      force_full_sync: forceFullSync,
      daily_full_sync: forceFullSync,
      daily_full_sync_date: forceFullSync ? nowLocal.dateKey : undefined,
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
      return NextResponse.json(
        { ok: false, stage: "execute_run", status: executeRes.status, detail: executeJson, channel_id: channelId, run_id: runId },
        { status: executeRes.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const runStatus = String(executeJson.status ?? "").trim().toUpperCase();
    const pending = Number(executeJson.pending ?? 0);
    if (runStatus !== "RUNNING" || !Number.isFinite(pending) || pending <= 0) break;
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
      execute_rounds: executeSnapshots,
      execute_round_limit: executeRoundLimit,
      execute_intent_batch_size: executeIntentBatchSize,
      push_chunk_size: pushChunkSize,
      cleanup: cleanupJson,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  return runCron(request);
}

export async function GET(request: Request) {
  return runCron(request);
}
