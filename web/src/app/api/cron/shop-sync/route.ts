import { NextResponse } from "next/server";
import { POST as pullPost } from "@/app/api/channel-prices/pull/route";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as pushPost } from "@/app/api/channel-prices/push/route";
import { getShopAdminClient } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function POST(request: Request) {
  const secret = (process.env.SHOP_SYNC_CRON_SECRET ?? "").trim();
  if (!secret) return bad("SHOP_SYNC_CRON_SECRET env is required", 500);

  const body = await request.json().catch(() => ({}));
  const bodyObj = typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const providedSecret = String(
    request.headers.get("x-shop-sync-secret") ?? bodyObj.secret ?? "",
  ).trim();
  if (!providedSecret || providedSecret !== secret) return bad("unauthorized", 401);

  const channelId = String(bodyObj.channel_id ?? process.env.SHOP_SYNC_CHANNEL_ID ?? "").trim();
  if (!channelId) return bad("channel_id is required", 400);

  const batchLimitRaw = Number(bodyObj.batch_limit ?? process.env.SHOP_SYNC_BATCH_LIMIT ?? 20);
  const batchLimit = Number.isFinite(batchLimitRaw) && batchLimitRaw > 0 ? Math.floor(batchLimitRaw) : 20;

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
  if ((running.data ?? []).length > 0) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "RUNNING_JOB_EXISTS", channel_id: channelId },
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
