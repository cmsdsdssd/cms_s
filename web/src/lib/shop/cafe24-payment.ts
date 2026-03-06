import { normalizeMallId } from "@/lib/shop/mall-id";

const CAFE24_FETCH_TIMEOUT_MS = 15000;

type Cafe24ApiResultBase = {
  ok: boolean;
  status: number;
  raw: unknown;
  error?: string;
};

export type Cafe24PaymentAccount = {
  mall_id: string;
  shop_no: number;
  api_version: string | null;
};

export type Cafe24OrderListParams = {
  startDate?: string;
  endDate?: string;
  dateType?: string;
  limit?: number;
  offset?: number;
  orderStatus?: string;
  paymentStatus?: string;
};

export type Cafe24RefundListParams = {
  startDate: string;
  endDate: string;
  dateType?: string;
  limit?: number;
  offset?: number;
};

export type Cafe24WebhookLogParams = {
  sinceLogId?: number;
  success?: boolean;
  limit?: number;
  offset?: number;
};

function adminBase(account: Cafe24PaymentAccount): string {
  const normalizedMall = normalizeMallId(account.mall_id);
  if (!normalizedMall.ok) {
    throw new Error(normalizedMall.reason);
  }
  return `https://${normalizedMall.mallId}.cafe24api.com/api/v2/admin`;
}

function withShopNo(url: string, shopNo: number | null | undefined): string {
  const n = Number(shopNo ?? 0);
  if (!Number.isFinite(n) || n <= 0) return url;
  const u = new URL(url);
  u.searchParams.set("shop_no", String(Math.floor(n)));
  return u.toString();
}

function withAdminQuery(path: string, params: Record<string, unknown>): string {
  const base = new URL(path, "https://internal.local");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (!str) continue;
    base.searchParams.set(key, str);
  }
  return `${base.pathname}${base.search}`;
}

function adminHeaders(accessToken: string, apiVersion: string | null): HeadersInit {
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (apiVersion && apiVersion.trim()) {
    headers["X-Cafe24-Api-Version"] = apiVersion.trim();
  }
  return headers;
}

function adminHeaderCandidates(accessToken: string, apiVersion: string | null): HeadersInit[] {
  const primary = adminHeaders(accessToken, apiVersion);
  if (!apiVersion || !apiVersion.trim()) return [primary];
  return [primary, adminHeaders(accessToken, null)];
}

function extractApiErrorMessage(json: Record<string, unknown>, fallbackStatus: number): string {
  const pick = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const nested = [obj.message, obj.error_description, obj.error, obj.reason]
        .map((entry) => pick(entry))
        .find(Boolean);
      if (nested) return nested;
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  return (
    pick(json.error_description)
    || pick(json.error)
    || pick(json.message)
    || pick(json.result)
    || `HTTP ${fallbackStatus}`
  );
}

function readOrderArray(json: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(json.orders)) {
    return json.orders.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  if (json.order && typeof json.order === "object") {
    return [json.order as Record<string, unknown>];
  }
  return [];
}

function readPaymentTimelineArray(json: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates = [
    json.paymenttimeline,
    json.payment_timeline,
    json.payments,
    json.paymentTimeline,
    (json.order as Record<string, unknown> | undefined)?.paymenttimeline,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  return [];
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CAFE24_FETCH_TIMEOUT_MS);
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      if (attempt < retries) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }
      return new Response(
        JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error) } }),
        { status: 599, headers: { "Content-Type": "application/json" } },
      );
    }

    if (response.status !== 429 || attempt >= retries) return response;
    attempt += 1;
    const retryAfter = Number(response.headers.get("retry-after") ?? "0");
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function runCafe24ListCall<TOk extends Cafe24ApiResultBase, TErr extends Cafe24ApiResultBase>(
  account: Cafe24PaymentAccount,
  accessToken: string,
  path: string,
  parseOk: (json: Record<string, unknown>, status: number) => TOk,
  parseError: (status: number, raw: unknown, error: string) => TErr,
): Promise<TOk | TErr> {
  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
    for (const url of [withShopNo(path, account.shop_no), path]) {
      const res = await fetchWithRetry(url, { method: "GET", headers });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      lastStatus = res.status;
      lastJson = json;
      lastErr = extractApiErrorMessage(json, res.status);

      if (res.ok) return parseOk(json, res.status);

      if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
        return parseError(lastStatus, lastJson, lastErr);
      }
    }
  }

  return parseError(lastStatus, lastJson, lastErr);
}

export async function cafe24ListOrders(
  account: Cafe24PaymentAccount,
  accessToken: string,
  params: Cafe24OrderListParams = {},
): Promise<{ ok: boolean; status: number; orders: Array<Record<string, unknown>>; raw: unknown; error?: string }> {
  const path = withAdminQuery(`${adminBase(account)}/orders`, {
    start_date: params.startDate,
    end_date: params.endDate,
    date_type: params.dateType,
    limit: params.limit,
    offset: params.offset,
    order_status: params.orderStatus,
    payment_status: params.paymentStatus,
  });
  return runCafe24ListCall(
    account,
    accessToken,
    path,
    (json, status) => ({ ok: true, status, orders: readOrderArray(json), raw: json }),
    (status, raw, error) => ({ ok: false, status, orders: [], raw, error }),
  );
}

export async function cafe24GetOrder(
  account: Cafe24PaymentAccount,
  accessToken: string,
  orderId: string,
): Promise<{ ok: boolean; status: number; order: Record<string, unknown> | null; raw: unknown; error?: string }> {
  const safeOrderId = String(orderId ?? "").trim();
  if (!safeOrderId) return { ok: false, status: 400, order: null, raw: {}, error: "missing order_id" };

  const path = `${adminBase(account)}/orders/${encodeURIComponent(safeOrderId)}`;
  return runCafe24ListCall(
    account,
    accessToken,
    path,
    (json, status) => ({ ok: true, status, order: readOrderArray(json)[0] ?? null, raw: json }),
    (status, raw, error) => ({ ok: false, status, order: null, raw, error }),
  );
}

export async function cafe24GetOrderPaymentTimeline(
  account: Cafe24PaymentAccount,
  accessToken: string,
  orderId: string,
): Promise<{ ok: boolean; status: number; timeline: Array<Record<string, unknown>>; raw: unknown; error?: string }> {
  const safeOrderId = String(orderId ?? "").trim();
  if (!safeOrderId) return { ok: false, status: 400, timeline: [], raw: {}, error: "missing order_id" };

  const path = `${adminBase(account)}/orders/${encodeURIComponent(safeOrderId)}/paymenttimeline`;
  return runCafe24ListCall(
    account,
    accessToken,
    path,
    (json, status) => ({ ok: true, status, timeline: readPaymentTimelineArray(json), raw: json }),
    (status, raw, error) => ({ ok: false, status, timeline: [], raw, error }),
  );
}

export async function cafe24ListRefunds(
  account: Cafe24PaymentAccount,
  accessToken: string,
  params: Cafe24RefundListParams,
): Promise<{ ok: boolean; status: number; refunds: Array<Record<string, unknown>>; raw: unknown; error?: string }> {
  const path = withAdminQuery(`${adminBase(account)}/refunds`, {
    start_date: params.startDate,
    end_date: params.endDate,
    date_type: params.dateType,
    limit: params.limit,
    offset: params.offset,
  });
  return runCafe24ListCall(
    account,
    accessToken,
    path,
    (json, status) => {
      const refunds = Array.isArray(json.refunds)
        ? json.refunds.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        : [];
      return { ok: true, status, refunds, raw: json };
    },
    (status, raw, error) => ({ ok: false, status, refunds: [], raw, error }),
  );
}

export async function cafe24ListWebhookLogs(
  account: Cafe24PaymentAccount,
  accessToken: string,
  params: Cafe24WebhookLogParams = {},
): Promise<{ ok: boolean; status: number; logs: Array<Record<string, unknown>>; raw: unknown; error?: string }> {
  const path = withAdminQuery(`${adminBase(account)}/webhooks/logs`, {
    since_log_id: params.sinceLogId,
    success: params.success === undefined ? undefined : (params.success ? "T" : "F"),
    limit: params.limit,
    offset: params.offset,
  });
  return runCafe24ListCall(
    account,
    accessToken,
    path,
    (json, status) => {
      const logs = Array.isArray(json.webhooks)
        ? json.webhooks.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        : Array.isArray(json.logs)
          ? json.logs.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          : [];
      return { ok: true, status, logs, raw: json };
    },
    (status, raw, error) => ({ ok: false, status, logs: [], raw, error }),
  );
}
