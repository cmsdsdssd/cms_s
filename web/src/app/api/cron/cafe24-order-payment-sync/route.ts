import { NextResponse } from "next/server";
import { getShopAdminClient } from "@/lib/shop/admin";
import {
  cafe24GetOrder,
  cafe24GetOrderPaymentTimeline,
  cafe24ListOrders,
} from "@/lib/shop/cafe24-payment";
import {
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type CronInput = {
  channelId: string;
  overlapSeconds: number;
  defaultLookbackMinutes: number;
  pageLimit: number;
  maxPages: number;
  dateType: string;
};

type RepresentativeError = {
  stage: string;
  order_id: string | null;
  status?: number;
  message: string;
};

const bad = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status, headers: { "Cache-Control": "no-store" } });

const toPositiveInt = (value: unknown, fallback: number, max = 10000): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
};

const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "y" || normalized === "yes";
};

const parseJsonObject = (value: unknown): JsonObject =>
  typeof value === "object" && value && !Array.isArray(value) ? (value as JsonObject) : {};

const toMs = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const cafe24Date = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const pickOrderId = (order: Record<string, unknown> | null | undefined): string | null => {
  if (!order) return null;
  const candidates = [order.order_id, order.orderId, order.no, order.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(Math.floor(candidate));
  }
  return null;
};

const pickOrderUpdatedAtMs = (order: Record<string, unknown> | null | undefined): number | null => {
  if (!order) return null;
  const candidates = [
    order.updated_date,
    order.modified_date,
    order.order_updated_at,
    order.updatedAt,
    order.modifiedAt,
  ];
  for (const candidate of candidates) {
    const ms = toMs(candidate);
    if (ms !== null) return ms;
  }
  return null;
};

function parseInput(request: Request, body: JsonObject): CronInput {
  const secret = String(process.env.CAFE24_PAYMENT_SYNC_CRON_SECRET ?? "").trim();
  if (!secret) throw Object.assign(new Error("CAFE24_PAYMENT_SYNC_CRON_SECRET env is required"), { status: 500 });

  const enabled = toBool(process.env.CAFE24_PAYMENT_SYNC_ENABLED ?? "false");
  if (!enabled) throw Object.assign(new Error("CAFE24_PAYMENT_SYNC_ENABLED must be true"), { status: 503 });

  const { searchParams } = new URL(request.url);
  const providedSecret = String(
    request.headers.get("x-cafe24-payment-sync-secret")
    ?? request.headers.get("x-shop-sync-secret")
    ?? body.secret
    ?? searchParams.get("secret")
    ?? "",
  ).trim();

  if (!providedSecret || providedSecret !== secret) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const channelId = String(
    body.channel_id
    ?? searchParams.get("channel_id")
    ?? "",
  ).trim();
  if (!channelId) throw Object.assign(new Error("channel_id is required"), { status: 400 });

  return {
    channelId,
    overlapSeconds: toPositiveInt(body.overlap_seconds ?? searchParams.get("overlap_seconds") ?? process.env.CAFE24_PAYMENT_SYNC_OVERLAP_SECONDS, 180, 86400),
    defaultLookbackMinutes: toPositiveInt(body.default_lookback_minutes ?? searchParams.get("default_lookback_minutes") ?? process.env.CAFE24_PAYMENT_SYNC_DEFAULT_LOOKBACK_MINUTES, 20, 1440),
    pageLimit: toPositiveInt(body.page_limit ?? searchParams.get("page_limit") ?? process.env.CAFE24_PAYMENT_SYNC_PAGE_LIMIT, 100, 500),
    maxPages: toPositiveInt(body.max_pages ?? searchParams.get("max_pages") ?? process.env.CAFE24_PAYMENT_SYNC_MAX_PAGES, 50, 2000),
    dateType: String(body.date_type ?? searchParams.get("date_type") ?? process.env.CAFE24_PAYMENT_SYNC_DATE_TYPE ?? "modified_date").trim() || "modified_date",
  };
}

async function updateRun(
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  pollRunId: string,
  patch: Record<string, unknown>,
) {
  await sb.from("shop_poll_run").update(patch).eq("poll_run_id", pollRunId);
}

async function runCron(request: Request) {
  const raw = await request.json().catch(() => ({}));
  const body = parseJsonObject(raw);

  let input: CronInput;
  try {
    input = parseInput(request, body);
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 500);
    return bad(error instanceof Error ? error.message : "invalid request", status);
  }

  const sb = getShopAdminClient();
  if (!sb) {
    return bad("Supabase server env missing", 500, {
      has_next_public_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      has_supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  const now = new Date();
  const cursorRes = await sb
    .from("shop_poll_cursor")
    .select("last_seen_updated_at, last_seen_order_id")
    .eq("channel_id", input.channelId)
    .maybeSingle();
  if (cursorRes.error) return bad(cursorRes.error.message ?? "poll cursor lookup failed", 500);

  const cursorFromBaseMs = toMs(cursorRes.data?.last_seen_updated_at) ?? (now.getTime() - (input.defaultLookbackMinutes * 60 * 1000));
  const cursorFrom = new Date(cursorFromBaseMs - (input.overlapSeconds * 1000));
  const cursorTo = now;

  const runStart = await sb.rpc("shop_fn_try_start_poll_run_v1", {
    p_channel_id: input.channelId,
    p_cursor_from_ts: cursorFrom.toISOString(),
    p_cursor_to_ts: cursorTo.toISOString(),
    p_detail: {
      source: "cron:cafe24-order-payment-sync",
      overlap_seconds: input.overlapSeconds,
      default_lookback_minutes: input.defaultLookbackMinutes,
      page_limit: input.pageLimit,
      max_pages: input.maxPages,
      date_type: input.dateType,
    },
  });

  if (runStart.error) {
    return bad(runStart.error.message ?? "poll run start failed", 500);
  }

  const runStartRow = Array.isArray(runStart.data) ? runStart.data[0] : null;
  const pollRunId = String(runStartRow?.poll_run_id ?? "").trim();
  const started = runStartRow?.started === true;
  const startReason = String(runStartRow?.reason ?? "").trim();

  if (!started) {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        skip_reason: startReason || "RUNNING_EXISTS",
        channel_id: input.channelId,
        poll_run_id: pollRunId || null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let ordersSeen = 0;
  let ordersProcessed = 0;
  let errorsCount = 0;
  let pageCount = 0;
  let latestUpdatedAtMs: number | null = null;
  let latestOrderId: string | null = null;
  const representativeErrors: RepresentativeError[] = [];

  const pushError = (error: RepresentativeError) => {
    errorsCount += 1;
    if (representativeErrors.length < 20) representativeErrors.push(error);
  };

  try {
    const account = await loadCafe24Account(sb, input.channelId);
    if (!account) throw new Error("sales_channel_account not found");

    const accessToken = await ensureValidCafe24AccessToken(sb, account);

    let offset = 0;
    for (let page = 0; page < input.maxPages; page += 1) {
      const listRes = await cafe24ListOrders(account, accessToken, {
        startDate: cafe24Date(cursorFrom),
        endDate: cafe24Date(cursorTo),
        dateType: input.dateType,
        limit: input.pageLimit,
        offset,
      });

      if (!listRes.ok) {
        throw new Error(`cafe24ListOrders failed: ${listRes.status} ${listRes.error ?? "unknown"}`);
      }

      const pageOrders = listRes.orders;
      pageCount += 1;
      ordersSeen += pageOrders.length;

      if (pageOrders.length === 0) break;

      for (const orderSummary of pageOrders) {
        const orderId = pickOrderId(orderSummary);
        if (!orderId) {
          pushError({ stage: "parse_order_id", order_id: null, message: "missing order_id in list item" });
          continue;
        }

        const orderDetailRes = await cafe24GetOrder(account, accessToken, orderId);
        if (!orderDetailRes.ok || !orderDetailRes.order) {
          pushError({
            stage: "get_order",
            order_id: orderId,
            status: orderDetailRes.status,
            message: orderDetailRes.error ?? "order detail fetch failed",
          });
          continue;
        }

        const timelineRes = await cafe24GetOrderPaymentTimeline(account, accessToken, orderId);
        if (!timelineRes.ok) {
          pushError({
            stage: "get_payment_timeline",
            order_id: orderId,
            status: timelineRes.status,
            message: timelineRes.error ?? "payment timeline fetch failed",
          });
          continue;
        }

        const recordRes = await sb.rpc("shop_fn_record_payment_observations_v1", {
          p_channel_id: input.channelId,
          p_order_json: orderDetailRes.order,
          p_paymenttimeline_json: { paymenttimeline: timelineRes.timeline },
          p_observed_at: new Date().toISOString(),
        });
        if (recordRes.error) {
          pushError({
            stage: "record_observation",
            order_id: orderId,
            message: recordRes.error.message ?? "record observation rpc failed",
          });
          continue;
        }

        const recomputeRes = await sb.rpc("shop_fn_recompute_order_payment_sot_v1", {
          p_channel_id: input.channelId,
          p_order_id: orderId,
        });
        if (recomputeRes.error) {
          pushError({
            stage: "recompute_sot",
            order_id: orderId,
            message: recomputeRes.error.message ?? "recompute sot rpc failed",
          });
          continue;
        }

        ordersProcessed += 1;

        const updatedAtMs = pickOrderUpdatedAtMs(orderDetailRes.order) ?? pickOrderUpdatedAtMs(orderSummary);
        if (updatedAtMs !== null && (latestUpdatedAtMs === null || updatedAtMs > latestUpdatedAtMs)) {
          latestUpdatedAtMs = updatedAtMs;
          latestOrderId = orderId;
        }
      }

      offset += pageOrders.length;
      if (pageOrders.length < input.pageLimit) break;
    }

    const cursorUpdatedAtIso = latestUpdatedAtMs === null
      ? cursorTo.toISOString()
      : new Date(latestUpdatedAtMs).toISOString();

    const cursorUpsert = await sb.rpc("shop_fn_upsert_poll_cursor_v1", {
      p_channel_id: input.channelId,
      p_last_seen_updated_at: cursorUpdatedAtIso,
      p_last_seen_order_id: latestOrderId,
    });
    if (cursorUpsert.error) {
      pushError({ stage: "upsert_cursor", order_id: latestOrderId, message: cursorUpsert.error.message ?? "cursor upsert failed" });
    }

    if (pollRunId) {
      await updateRun(sb, pollRunId, {
        status: "SUCCESS",
        orders_seen: ordersSeen,
        orders_processed: ordersProcessed,
        errors_count: errorsCount,
        error_message: representativeErrors[0]?.message ?? null,
        detail: {
          page_count: pageCount,
          page_limit: input.pageLimit,
          max_pages: input.maxPages,
          date_type: input.dateType,
          cursor_from_ts: cursorFrom.toISOString(),
          cursor_to_ts: cursorTo.toISOString(),
          cursor_last_seen_updated_at: cursorUpdatedAtIso,
          cursor_last_seen_order_id: latestOrderId,
          representative_errors: representativeErrors,
        },
        finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        ok: true,
        channel_id: input.channelId,
        poll_run_id: pollRunId,
        cursor_from_ts: cursorFrom.toISOString(),
        cursor_to_ts: cursorTo.toISOString(),
        page_count: pageCount,
        orders_seen: ordersSeen,
        orders_processed: ordersProcessed,
        errors_count: errorsCount,
        representative_errors: representativeErrors,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (pollRunId) {
      await updateRun(sb, pollRunId, {
        status: "FAILED",
        orders_seen: ordersSeen,
        orders_processed: ordersProcessed,
        errors_count: errorsCount + 1,
        error_message: message,
        detail: {
          page_count: pageCount,
          page_limit: input.pageLimit,
          max_pages: input.maxPages,
          date_type: input.dateType,
          cursor_from_ts: cursorFrom.toISOString(),
          cursor_to_ts: cursorTo.toISOString(),
          representative_errors: representativeErrors,
          fatal_error: message,
        },
        finished_at: new Date().toISOString(),
      });
    }

    return bad("Cafe24 payment sync failed", 500, {
      channel_id: input.channelId,
      poll_run_id: pollRunId,
      orders_seen: ordersSeen,
      orders_processed: ordersProcessed,
      errors_count: errorsCount + 1,
      representative_errors: representativeErrors,
      detail: message,
    });
  }
}

export async function POST(request: Request) {
  return runCron(request);
}

export async function GET(request: Request) {
  return runCron(request);
}
