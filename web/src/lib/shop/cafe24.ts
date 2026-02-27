import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMallId } from "@/lib/shop/mall-id";

type ShopChannelAccount = {
  account_id: string;
  channel_id: string;
  mall_id: string;
  shop_no: number;
  client_id_enc: string | null;
  client_secret_enc: string | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  refresh_token_enc: string | null;
  refresh_token_expires_at: string | null;
  api_version: string | null;
  status: string;
};

type Cafe24TokenRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isExpired = (iso: string | null | undefined, marginMs = 60_000): boolean => {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return t <= Date.now() + marginMs;
};

const productNoFromValue = (value: string): string => {
  const trimmed = String(value ?? "").trim();
  return encodeURIComponent(trimmed);
};

function parseCurrentPriceFromProduct(product: Record<string, unknown> | null): number | null {
  if (!product) return null;
  const candidates = [
    product.price,
    product.retail_price,
    product.selling_price,
    product.custom_product_price,
    product.product_price,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt >= retries) return res;
    attempt += 1;
    const retryAfter = Number(res.headers.get("retry-after") ?? "0");
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1000;
    await sleep(waitMs);
  }
}

export async function loadCafe24Account(
  sb: SupabaseClient,
  channelId: string,
): Promise<ShopChannelAccount | null> {
  const { data, error } = await sb
    .from("sales_channel_account")
    .select("account_id, channel_id, mall_id, shop_no, client_id_enc, client_secret_enc, access_token_enc, access_token_expires_at, refresh_token_enc, refresh_token_expires_at, api_version, status")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "채널 계정 조회 실패");
  return (data as ShopChannelAccount | null) ?? null;
}

export async function ensureValidCafe24AccessToken(
  sb: SupabaseClient,
  account: ShopChannelAccount,
): Promise<string> {
  if (account.access_token_enc && !isExpired(account.access_token_expires_at, 30_000)) {
    return account.access_token_enc;
  }

  if (!account.refresh_token_enc || !account.client_id_enc || !account.client_secret_enc) {
    throw new Error("카페24 토큰 갱신에 필요한 refresh/client 정보가 없습니다");
  }

  if (isExpired(account.refresh_token_expires_at, 30_000)) {
    throw new Error("refresh token 이 만료되었습니다");
  }

  const normalizedMall = normalizeMallId(account.mall_id);
  if (!normalizedMall.ok) {
    throw new Error(normalizedMall.reason);
  }

  const tokenUrl = `https://${normalizedMall.mallId}.cafe24api.com/api/v2/oauth/token`;
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", account.refresh_token_enc);
  body.set("client_id", account.client_id_enc);
  body.set("client_secret", account.client_secret_enc);

  const res = await fetchWithRetry(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as Cafe24TokenRefreshResponse;
  if (!res.ok || !json.access_token) {
    const reason = json.error_description || json.error || `HTTP ${res.status}`;
    await sb
      .from("sales_channel_account")
      .update({ status: "ERROR", last_error_code: String(res.status), last_error_message: `refresh failed: ${reason}` })
      .eq("account_id", account.account_id);
    throw new Error(`카페24 토큰 갱신 실패: ${reason}`);
  }

  const expiresAt = json.expires_at
    ? new Date(json.expires_at).toISOString()
    : new Date(Date.now() + Math.max(60, Number(json.expires_in ?? 7200)) * 1000).toISOString();

  const updatePayload: Record<string, unknown> = {
    access_token_enc: json.access_token,
    access_token_expires_at: expiresAt,
    status: "CONNECTED",
    last_error_code: null,
    last_error_message: null,
  };
  if (json.refresh_token) updatePayload.refresh_token_enc = json.refresh_token;

  const { error: updateError } = await sb
    .from("sales_channel_account")
    .update(updatePayload)
    .eq("account_id", account.account_id);

  if (updateError) {
    throw new Error(updateError.message ?? "카페24 토큰 갱신 저장 실패");
  }

  return json.access_token;
}

function adminBase(account: ShopChannelAccount): string {
  const normalizedMall = normalizeMallId(account.mall_id);
  if (!normalizedMall.ok) {
    throw new Error(normalizedMall.reason);
  }
  return `https://${normalizedMall.mallId}.cafe24api.com/api/v2/admin`;
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

export async function cafe24GetProductPrice(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
): Promise<{ ok: boolean; status: number; currentPriceKrw: number | null; raw: unknown; error?: string }> {
  const url = `${adminBase(account)}/products/${productNoFromValue(externalProductNo)}`;
  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: adminHeaders(accessToken, account.api_version),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      currentPriceKrw: null,
      raw: json,
      error: String((json.error as string) || (json.message as string) || `HTTP ${res.status}`),
    };
  }

  const product = (json.product as Record<string, unknown> | undefined)
    ?? ((Array.isArray(json.products) ? json.products[0] : null) as Record<string, unknown> | null)
    ?? null;

  return {
    ok: true,
    status: res.status,
    currentPriceKrw: parseCurrentPriceFromProduct(product),
    raw: json,
  };
}

export async function cafe24UpdateProductPrice(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
  targetPriceKrw: number,
): Promise<{ ok: boolean; status: number; raw: unknown; error?: string }> {
  const url = `${adminBase(account)}/products/${productNoFromValue(externalProductNo)}`;
  const asString = String(Math.round(targetPriceKrw));

  const candidatePayloads = [
    { request: { product: { price: asString } } },
    { request: { product: { retail_price: asString } } },
    { request: { product: { custom_product_price: asString } } },
  ];

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  for (const payload of candidatePayloads) {
    const res = await fetchWithRetry(url, {
      method: "PUT",
      headers: adminHeaders(accessToken, account.api_version),
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    lastStatus = res.status;
    lastJson = json;

    if (res.ok) {
      return { ok: true, status: res.status, raw: json };
    }

    lastErr = String((json.error as string) || (json.message as string) || `HTTP ${res.status}`);

    if (res.status === 401 || res.status === 403 || res.status >= 500 || res.status === 429) {
      break;
    }
  }

  return {
    ok: false,
    status: lastStatus,
    raw: lastJson,
    error: lastErr,
  };
}
