import { NextResponse } from "next/server";
import { POST as pullPost } from "@/app/api/channel-prices/pull/route";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as pushPost } from "@/app/api/channel-prices/push/route";
import { getShopAdminClient } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function mkJsonRequest(path: string, payload: Record<string, unknown>): Request {
  return new Request(`https://internal.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

type CronInput = {
  secret: string;
  channelId: string;
  batchLimit: number;
  masterRecomputeOnly: boolean;
};

function parseCronInput(request: Request, bodyObj: Record<string, unknown>): CronInput {
  const secret = (process.env.SHOP_SYNC_CRON_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("SHOP_SYNC_CRON_SECRET env is required");
  }

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
  if (!channelId) {
    throw Object.assign(new Error("channel_id is required"), { status: 400 });
  }

  const batchLimitRaw = Number(
    bodyObj.batch_limit
    ?? searchParams.get("batch_limit")
    ?? process.env.SHOP_SYNC_BATCH_LIMIT
    ?? 20,
  );
  const batchLimit = Number.isFinite(batchLimitRaw) && batchLimitRaw > 0 ? Math.floor(batchLimitRaw) : 20;

  const masterOnlyRaw = String(
    bodyObj.master_recompute_only
    ?? searchParams.get("master_recompute_only")
    ?? "false",
  ).toLowerCase();
  const masterRecomputeOnly = masterOnlyRaw === "1" || masterOnlyRaw === "true" || masterOnlyRaw === "yes";

  return {
    secret,
    channelId,
    batchLimit,
    masterRecomputeOnly,
  };
}

async function runCron(request: Request) {
  const body = await request.json().catch(() => ({}));
  const bodyObj = typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  let input: CronInput;
  try {
    input = parseCronInput(request, bodyObj);
  } catch (err) {
    const status = Number((err as { status?: number }).status ?? 500);
    return bad(err instanceof Error ? err.message : "invalid request", status);
  }

  const { channelId, batchLimit, masterRecomputeOnly } = input;

  const sb = getShopAdminClient();
  if (!sb) return bad("Supabase server env missing", 500);

  const running = await sb
    .from("price_sync_job")
    .select("job_id, started_at")
    .eq("channel_id", channelId)
    .eq("status", "RUNNING")
    .order("started_at", { ascending: false })
    .limit(1);

  if (running.error) return bad(running.error.message ?? "running job check failed", 500);
  const latestRunning = (running.data ?? [])[0] as { job_id?: string | null; started_at?: string | null } | undefined;
  if (latestRunning?.job_id) {
    const startedAtMs = Date.parse(String(latestRunning.started_at ?? ""));
    const staleThresholdMs = 30 * 60 * 1000;
    const isStale = Number.isFinite(startedAtMs) && Date.now() - startedAtMs > staleThresholdMs;
    if (isStale) {
      const staleCloseRes = await sb
        .from("price_sync_job")
        .update({ status: "FAILED", finished_at: new Date().toISOString() })
        .eq("job_id", latestRunning.job_id);
      if (staleCloseRes.error) return bad(staleCloseRes.error.message ?? "stale running job close failed", 500);
    } else {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "RUNNING_JOB_EXISTS", channel_id: channelId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  if (masterRecomputeOnly) {
    const mappedRes = await sb
      .from("sales_channel_product")
      .select("master_item_id")
      .eq("channel_id", channelId)
      .eq("is_active", true);
    if (mappedRes.error) return bad(mappedRes.error.message ?? "mapped master query failed", 500);

    const masterIds = Array.from(new Set(
      (mappedRes.data ?? [])
        .map((r) => String((r as { master_item_id?: string | null }).master_item_id ?? "").trim())
        .filter(Boolean),
    ));

    if (masterIds.length === 0) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "NO_MAPPED_MASTERS", channel_id: channelId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const chunkSizeRaw = Number(bodyObj.chunk_size ?? 200);
    const chunkSize = Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0 ? Math.min(500, Math.floor(chunkSizeRaw)) : 200;

    const chunks: string[][] = [];
    for (let i = 0; i < masterIds.length; i += chunkSize) {
      chunks.push(masterIds.slice(i, i + chunkSize));
    }

    let inserted = 0;
    let skipped = 0;
    let blockedByMissingRulesCount = 0;
    const blockedSamples: Array<{ channel_product_id: string; missing_rules: string[]; reason: string }> = [];

    for (const chunk of chunks) {
      const recomputeRes = await recomputePost(
        mkJsonRequest("/api/pricing/recompute", {
          channel_id: channelId,
          master_item_ids: chunk,
        }),
      );
      const recomputeJson = await recomputeRes.json().catch(() => ({}));
      if (!recomputeRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            stage: "recompute",
            status: recomputeRes.status,
            detail: recomputeJson,
            channel_id: channelId,
          },
          { status: recomputeRes.status, headers: { "Cache-Control": "no-store" } },
        );
      }

      const insertedNow = Number((recomputeJson as { inserted?: number }).inserted ?? 0);
      const skippedNow = Number((recomputeJson as { skipped?: number }).skipped ?? 0);
      const blockedNow = Number((recomputeJson as { blocked_by_missing_rules_count?: number }).blocked_by_missing_rules_count ?? 0);
      inserted += Number.isFinite(insertedNow) ? insertedNow : 0;
      skipped += Number.isFinite(skippedNow) ? skippedNow : 0;
      blockedByMissingRulesCount += Number.isFinite(blockedNow) ? blockedNow : 0;

      const blocked = (recomputeJson as { blocked_by_missing_rules?: Array<{ channel_product_id: string; missing_rules: string[]; reason: string }> }).blocked_by_missing_rules ?? [];
      for (const b of blocked) {
        if (blockedSamples.length >= 50) break;
        blockedSamples.push(b);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        mode: "MASTER_RECOMPUTE_ONLY",
        channel_id: channelId,
        master_count: masterIds.length,
        chunk_size: chunkSize,
        chunk_count: chunks.length,
        inserted,
        skipped,
        blocked_by_missing_rules_count: blockedByMissingRulesCount,
        blocked_by_missing_rules: blockedSamples,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
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

  const diffRes = await sb
    .from("v_channel_price_dashboard")
    .select("channel_product_id")
    .eq("channel_id", channelId)
    .eq("price_state", "OUT_OF_SYNC")
    .order("channel_price_fetched_at", { ascending: true, nullsFirst: true })
    .limit(batchLimit);

  if (diffRes.error) return bad(diffRes.error.message ?? "dashboard diff query failed", 500);
  const diffIds = (diffRes.data ?? [])
    .map((r) => String((r as { channel_product_id: string | null }).channel_product_id ?? "").trim())
    .filter(Boolean);

  if (diffIds.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "NO_CANDIDATES",
        channel_id: channelId,
        pull: pullJson,
        recompute: recomputeJson,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const pushRes = await pushPost(
    mkJsonRequest("/api/channel-prices/push", {
      channel_id: channelId,
      channel_product_ids: diffIds,
      run_type: "AUTO",
      dry_run: false,
    }),
  );
  const pushJson = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) {
    return NextResponse.json(
      { ok: false, stage: "push", status: pushRes.status, detail: pushJson, channel_id: channelId },
      { status: pushRes.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      mode: "FULL_SYNC",
      channel_id: channelId,
      batch_limit: batchLimit,
      candidate_count: diffIds.length,
      pull: pullJson,
      recompute: recomputeJson,
      push: pushJson,
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
