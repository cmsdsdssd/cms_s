import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getShopAdminClient } from "@/lib/shop/admin";
import { normalizeMallId } from "@/lib/shop/mall-id";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type ChannelAccountRow = {
  account_id: string;
  channel_id: string;
  shop_no: number;
};

const bad = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status, headers: { "Cache-Control": "no-store" } });

function parseJsonObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }
  return null;
}

function extractMallId(payload: JsonObject): string | null {
  const nestedMall = parseJsonObject(payload.mall);
  return pickString(payload.mall_id, payload.mallId, nestedMall?.id, nestedMall?.mall_id);
}

function extractShopNo(payload: JsonObject): number | null {
  const nestedShop = parseJsonObject(payload.shop);
  return toInt(payload.shop_no ?? payload.shopNo ?? nestedShop?.shop_no ?? nestedShop?.no);
}

function extractEventNo(payload: JsonObject): string | null {
  return pickString(payload.event_no, payload.eventNo, payload.webhook_no, payload.id);
}

function extractEventType(payload: JsonObject): string | null {
  return pickString(payload.event_type, payload.eventType, payload.type, payload.event);
}

function extractOrderId(payload: JsonObject): string | null {
  const nestedOrder = parseJsonObject(payload.order);
  const nestedData = parseJsonObject(payload.data);
  return pickString(payload.order_id, payload.orderId, nestedOrder?.order_id, nestedOrder?.orderId, nestedData?.order_id, nestedData?.orderId);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: unknown }).code ?? "").trim();
  return code === "23505";
}

function headersToJson(headers: Headers): JsonObject {
  const out: JsonObject = {};
  for (const [key, value] of headers.entries()) out[key] = value;
  return out;
}

function buildPayloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function buildIdempotencyKey(args: {
  channelId: string;
  mallId: string;
  shopNo: number | null;
  eventNo: string | null;
  eventType: string | null;
  orderId: string | null;
  payloadHash: string;
}): string {
  return [
    "CAFE24_ORDER_WEBHOOK",
    args.channelId,
    args.mallId,
    args.shopNo === null ? "" : String(args.shopNo),
    args.eventNo ?? "",
    args.eventType ?? "",
    args.orderId ?? "",
    args.payloadHash,
  ].join(":");
}

function normalizeSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

async function resolveChannelId(
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  mallId: string,
  shopNo: number | null,
): Promise<{ ok: true; channelId: string } | { ok: false; status: number; error: string }> {
  let query = sb
    .from("sales_channel_account")
    .select("account_id, channel_id, shop_no")
    .eq("mall_id", mallId);

  if (shopNo !== null && shopNo > 0) {
    query = query.eq("shop_no", shopNo);
  }

  const { data, error } = await query;
  if (error) return { ok: false, status: 500, error: error.message ?? "sales_channel_account lookup failed" };

  const rows = (data ?? []) as ChannelAccountRow[];
  if (rows.length === 1) {
    return { ok: true, channelId: String(rows[0].channel_id ?? "").trim() };
  }

  if (rows.length === 0 && shopNo !== null && shopNo > 0) {
    const fallback = await sb
      .from("sales_channel_account")
      .select("account_id, channel_id, shop_no")
      .eq("mall_id", mallId)
      .limit(2);
    if (fallback.error) return { ok: false, status: 500, error: fallback.error.message ?? "sales_channel_account fallback lookup failed" };

    const fallbackRows = (fallback.data ?? []) as ChannelAccountRow[];
    if (fallbackRows.length === 1) {
      return { ok: true, channelId: String(fallbackRows[0].channel_id ?? "").trim() };
    }
    if (fallbackRows.length > 1) {
      return { ok: false, status: 409, error: "multiple channels matched mall_id; include a valid shop_no" };
    }
  }

  if (rows.length > 1) {
    return { ok: false, status: 409, error: "multiple channels matched webhook payload" };
  }

  return { ok: false, status: 404, error: "sales_channel_account not found for mall_id/shop_no" };
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) {
    return bad("Supabase server env missing", 500, {
      has_next_public_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      has_supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  const rawBody = await request.text().catch(() => "");
  if (!rawBody.trim()) return bad("Empty body", 400);

  let payloadRaw: unknown;
  try {
    payloadRaw = JSON.parse(rawBody);
  } catch {
    return bad("Invalid JSON payload", 400);
  }
  const payload = parseJsonObject(payloadRaw);
  if (!payload) return bad("Invalid JSON payload", 400);

  const configuredSecret = String(process.env.CAFE24_WEBHOOK_SECRET ?? "").trim();
  if (!configuredSecret) return bad("CAFE24_WEBHOOK_SECRET env is required", 500);

  const { searchParams } = new URL(request.url);
  const providedSecret = normalizeSecret(String(
    request.headers.get("x-cafe24-webhook-secret")
    ?? request.headers.get("x-webhook-secret")
    ?? request.headers.get("authorization")
    ?? payload.secret
    ?? payload.webhook_secret
    ?? searchParams.get("secret")
    ?? "",
  ));

  if (!providedSecret || providedSecret !== configuredSecret) {
    return bad("Unauthorized", 401);
  }

  const mallIdRaw = extractMallId(payload);
  if (!mallIdRaw) return bad("mall_id is required in webhook payload", 400);
  const normalizedMall = normalizeMallId(mallIdRaw);
  if (!normalizedMall.ok) return bad(normalizedMall.reason, 400);

  const shopNo = extractShopNo(payload);
  const eventNo = extractEventNo(payload);
  const eventType = extractEventType(payload);
  const orderId = extractOrderId(payload);
  const channel = await resolveChannelId(sb, normalizedMall.mallId, shopNo);
  if (!channel.ok) return bad(channel.error, channel.status);

  const payloadHash = buildPayloadHash(rawBody);
  const idempotencyKey = buildIdempotencyKey({
    channelId: channel.channelId,
    mallId: normalizedMall.mallId,
    shopNo,
    eventNo,
    eventType,
    orderId,
    payloadHash,
  });

  const insertRes = await sb.from("shop_webhook_inbox").insert({
    channel_id: channel.channelId,
    mall_id: normalizedMall.mallId,
    shop_no: shopNo,
    event_no: eventNo,
    event_type: eventType,
    order_id: orderId,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    headers_json: headersToJson(request.headers),
    raw_json: payload,
  });

  if (insertRes.error) {
    if (isUniqueViolation(insertRes.error)) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          channel_id: channel.channelId,
          idempotency_key: idempotencyKey,
          payload_hash: payloadHash,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return bad(insertRes.error.message ?? "webhook inbox insert failed", 500);
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      channel_id: channel.channelId,
      idempotency_key: idempotencyKey,
      payload_hash: payloadHash,
      event_no: eventNo,
      event_type: eventType,
      order_id: orderId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
