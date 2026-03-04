import { NextResponse } from "next/server";
import { POST as pullPost } from "@/app/api/channel-prices/pull/route";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as createRunPost } from "@/app/api/price-sync-runs-v2/route";
import { POST as executeRunPost } from "@/app/api/price-sync-runs-v2/[run_id]/execute/route";
import { getShopAdminClient } from "@/lib/shop/admin";

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

const resolveRunningStaleWindowMs = (): number => {
  const staleMinutes = toPositiveInt(process.env.SHOP_SYNC_RUNNING_STALE_MINUTES, 360, 7 * 24 * 60);
  return staleMinutes * 60 * 1000;
};

const toMs = (value: unknown): number | null => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const CRON_TICK_ERROR_PREFIX = "CRON_TICK:";

const isCronTickError = (value: unknown): boolean =>
  String(value ?? "").trim().toUpperCase().startsWith(CRON_TICK_ERROR_PREFIX);

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
  const secret = (process.env.SHOP_SYNC_CRON_SECRET ?? "").trim();
  if (!secret) throw new Error("SHOP_SYNC_CRON_SECRET env is required");

  const { searchParams } = new URL(request.url);
  const providedSecret = String(
    request.headers.get("x-shop-sync-secret")
    ?? bodyObj.secret
    ?? searchParams.get("secret")
    ?? "",
  ).trim();
  if (!providedSecret || providedSecret !== secret) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

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
    ?? 20,
  );
  const intervalMinutes = Number.isFinite(intervalRaw) ? Math.max(1, Math.min(60, Math.floor(intervalRaw))) : 20;

  return { channelId, intervalMinutes };
}

async function runCron(request: Request) {
  const body = await request.json().catch(() => ({}));
  const bodyObj = typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  let input: { channelId: string; intervalMinutes: number };
  try {
    input = parseInput(request, bodyObj);
  } catch (err) {
    const status = Number((err as { status?: number }).status ?? 500);
    return bad(err instanceof Error ? err.message : "invalid request", status);
  }

  const { channelId, intervalMinutes } = input;
  const runningStaleWindowMs = resolveRunningStaleWindowMs();
  const executeRoundLimit = toPositiveInt(process.env.SHOP_SYNC_EXECUTE_MAX_ROUNDS, 12, 200);
  const executeIntentBatchSize = toPositiveInt(process.env.SHOP_SYNC_EXECUTE_INTENT_BATCH_SIZE, 300, 5000);
  const pushChunkSize = toPositiveInt(process.env.SHOP_SYNC_PUSH_CHUNK_SIZE, 150, 1000);
  const sb = getShopAdminClient();
  if (!sb) return bad("Supabase server env missing", 500);

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
          skipped: true,
          skip_reason: "OVERLAP_RUNNING",
          running_stale_minutes: Math.floor(runningStaleWindowMs / 60000),
          run_id: activeRunId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const recentRes = await sb
    .from("price_sync_run_v2")
    .select("run_id, status, started_at, error_message")
    .eq("channel_id", channelId)
    .in("status", ["SUCCESS", "PARTIAL", "FAILED", "CANCELLED"])
    .order("started_at", { ascending: false })
    .limit(30);
  if (recentRes.error) {
    return bad(recentRes.error.message ?? "최근 run 조회 실패", 500);
  }

  const recent = (recentRes.data ?? []).find((row) => !isCronTickError((row as { error_message?: unknown }).error_message));
  if (recent) {
    const startedAtMs = toMs((recent as { started_at?: unknown }).started_at);
    if (startedAtMs !== null) {
      const elapsedMs = Date.now() - startedAtMs;
      const intervalWindowMs = intervalMinutes * 60 * 1000;
      if (elapsedMs >= 0 && elapsedMs < intervalWindowMs) {
        const recentRunId = String((recent as { run_id?: unknown }).run_id ?? "").trim() || null;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        await recordCronTickRun(sb, {
          channelId,
          intervalMinutes,
          reason: "INTERVAL_NOT_ELAPSED",
          relatedRunId: recentRunId,
          detail: { elapsed_minutes: elapsedMinutes },
        });
        return NextResponse.json(
          {
            ok: true,
            mode: "AUTO_SYNC_V2",
            channel_id: channelId,
            interval_minutes: intervalMinutes,
            skipped: true,
            skip_reason: "INTERVAL_NOT_ELAPSED",
            elapsed_minutes: elapsedMinutes,
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
    return NextResponse.json(
      { ok: false, stage: "pull", status: pullRes.status, detail: pullJson, channel_id: channelId },
      { status: pullRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const recomputeRes = await recomputePost(mkJsonRequest("/api/pricing/recompute", { channel_id: channelId }));
  const recomputeJson = await recomputeRes.json().catch(() => ({}));
  if (!recomputeRes.ok) {
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
      compute_request_id: String((recomputeJson as { compute_request_id?: unknown }).compute_request_id ?? "").trim() || undefined,
    }),
  );
  const runCreateJson = await runCreateRes.json().catch(() => ({}));
  if (!runCreateRes.ok) {
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
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!runId) {
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
      return NextResponse.json(
        { ok: false, stage: "execute_run", status: executeRes.status, detail: executeJson, channel_id: channelId, run_id: runId },
        { status: executeRes.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const runStatus = String(executeJson.status ?? "").trim().toUpperCase();
    const pending = Number(executeJson.pending ?? 0);
    if (runStatus !== "RUNNING" || !Number.isFinite(pending) || pending <= 0) break;
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
      execute_rounds: executeSnapshots,
      execute_round_limit: executeRoundLimit,
      execute_intent_batch_size: executeIntentBatchSize,
      push_chunk_size: pushChunkSize,
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
