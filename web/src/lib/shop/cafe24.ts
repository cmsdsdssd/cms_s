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

export type Cafe24VariantOption = {
  name: string;
  value: string;
};

export type Cafe24VariantSummary = {
  variantCode: string;
  customVariantCode: string | null;
  options: Cafe24VariantOption[];
  additionalAmount: number | null;
};

export type Cafe24ProductOptionValue = {
  option_text: string;
  [key: string]: unknown;
};

export type Cafe24ProductOptionGroup = {
  option_name: string;
  option_value: Cafe24ProductOptionValue[];
  [key: string]: unknown;
};

type Cafe24TokenRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type RefreshAttemptResult = {
  ok: boolean;
  status: number;
  json: Cafe24TokenRefreshResponse;
  reason: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CAFE24_FETCH_TIMEOUT_MS = 15_000;
const UPDATE_VERIFY_DELAYS_MS = [0, 300, 900, 1800];

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
  const toCafe24Number = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9+\-.]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const candidates = [
    // 실판매가 기준을 우선 사용한다.
    product.selling_price,
    product.price,
    product.retail_price,
    product.custom_product_price,
    product.product_price,
  ];
  for (const v of candidates) {
    const n = toCafe24Number(v);
    if (n !== null) return Math.round(n);
  }
  return null;
}

function extractApiErrorMessage(json: Record<string, unknown>, fallbackStatus: number): string {
  const pick = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const nested = [obj.message, obj.error_description, obj.error, obj.reason]
        .map((x) => pick(x))
        .find(Boolean);
      if (nested) return nested;
      try {
        return JSON.stringify(v);
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

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CAFE24_FETCH_TIMEOUT_MS);
      try {
        res = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      if (attempt < retries) {
        attempt += 1;
        await sleep(attempt * 1000);
        continue;
      }
      return new Response(JSON.stringify({ error: { message: e instanceof Error ? e.message : String(e) } }), {
        status: 599,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (res.status !== 429 || attempt >= retries) return res;
    attempt += 1;
    const retryAfter = Number(res.headers.get("retry-after") ?? "0");
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1000;
    await sleep(waitMs);
  }
}

async function requestCafe24RefreshToken(
  tokenUrl: string,
  body: URLSearchParams,
  authorizationHeader?: string,
): Promise<RefreshAttemptResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (authorizationHeader) headers.Authorization = authorizationHeader;

  const res = await fetchWithRetry(tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Cafe24TokenRefreshResponse;
  const reason = String(json.error_description || json.error || `HTTP ${res.status}`).replace(/[\r\n]/g, " ").slice(0, 180);

  return {
    ok: res.ok && Boolean(json.access_token),
    status: res.status,
    json,
    reason,
  };
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
  accessTokenExpiryMarginMs = 30_000,
): Promise<string> {
  if (account.access_token_enc && !isExpired(account.access_token_expires_at, accessTokenExpiryMarginMs)) {
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
  const basicAuth = `Basic ${Buffer.from(`${account.client_id_enc}:${account.client_secret_enc}`).toString("base64")}`;

  const attempt1 = new URLSearchParams();
  attempt1.set("grant_type", "refresh_token");
  attempt1.set("refresh_token", account.refresh_token_enc);
  attempt1.set("client_id", account.client_id_enc);
  attempt1.set("client_secret", account.client_secret_enc);

  const attempt2 = new URLSearchParams();
  attempt2.set("grant_type", "refresh_token");
  attempt2.set("refresh_token", account.refresh_token_enc);

  const attempt3 = new URLSearchParams();
  attempt3.set("grant_type", "refresh_token");
  attempt3.set("refresh_token", account.refresh_token_enc);
  attempt3.set("client_id", account.client_id_enc);

  const attempt4 = new URLSearchParams();
  attempt4.set("grant_type", "refresh_token");
  attempt4.set("refresh_token", account.refresh_token_enc);
  attempt4.set("client_secret", account.client_secret_enc);

  const attempts: Array<{ name: string; body: URLSearchParams; auth?: string }> = [
    { name: "body_client_id_secret", body: attempt1 },
    { name: "basic_only", body: attempt2, auth: basicAuth },
    { name: "basic_plus_client_id", body: attempt3, auth: basicAuth },
    { name: "basic_plus_client_secret", body: attempt4, auth: basicAuth },
  ];

  let json: Cafe24TokenRefreshResponse | null = null;
  let status = 500;
  const reasons: string[] = [];

  for (const attempt of attempts) {
    const res = await requestCafe24RefreshToken(tokenUrl, attempt.body, attempt.auth);
    reasons.push(`${attempt.name}:${res.status}:${res.reason}`);
    status = res.status;
    if (res.ok) {
      json = res.json;
      break;
    }
  }

  if (!json?.access_token) {
    const reason = reasons.join(" | ");
    await sb
      .from("sales_channel_account")
      .update({ status: "ERROR", last_error_code: String(status), last_error_message: `refresh failed: ${reason}` })
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

function withShopNo(url: string, shopNo: number | null | undefined): string {
  const n = Number(shopNo ?? 0);
  if (!Number.isFinite(n) || n <= 0) return url;
  const u = new URL(url);
  u.searchParams.set("shop_no", String(Math.floor(n)));
  return u.toString();
}

function adminProductUrls(account: ShopChannelAccount, externalProductNo: string): string[] {
  const base = `${adminBase(account)}/products/${productNoFromValue(externalProductNo)}`;
  const withShop = withShopNo(base, account.shop_no);
  if (withShop === base) return [base];
  return [withShop, base];
}

function adminProductWriteUrls(account: ShopChannelAccount, externalProductNo: string): string[] {
  return [`${adminBase(account)}/products/${productNoFromValue(externalProductNo)}`];
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

function parseProductNoFromJson(json: Record<string, unknown>): string | null {
  const fromObj = (obj: Record<string, unknown> | null | undefined): string | null => {
    if (!obj) return null;
    const candidate = obj.product_no ?? obj.productNo ?? obj.no;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(Math.trunc(candidate));
    return null;
  };

  const p1 = fromObj(json.product as Record<string, unknown> | undefined);
  if (p1) return p1;

  if (Array.isArray(json.products) && json.products.length > 0) {
    const p2 = fromObj(json.products[0] as Record<string, unknown>);
    if (p2) return p2;
  }
  return null;
}

function parseVariantFromJson(json: Record<string, unknown>): Record<string, unknown> | null {
  const direct = json.variant as Record<string, unknown> | undefined;
  if (direct && typeof direct === "object") return direct;

  if (Array.isArray(json.variants) && json.variants.length > 0) {
    const first = json.variants[0] as Record<string, unknown>;
    if (first && typeof first === "object") return first;
  }
  return null;
}

function parseVariantAdditionalAmount(variant: Record<string, unknown> | null): number | null {
  if (!variant) return null;
  const toCafe24Number = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9+\-.]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const candidates = [variant.additional_amount, variant.addition_amount, variant.additionalAmount];
  for (const v of candidates) {
    const n = toCafe24Number(v);
    if (n !== null) return n;
  }
  return null;
}

function parseVariantPrice(variant: Record<string, unknown> | null): number | null {
  if (!variant) return null;
  const toCafe24Number = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9+\-.]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const candidates = [variant.selling_price, variant.price, variant.retail_price, variant.product_price];
  for (const v of candidates) {
    const n = toCafe24Number(v);
    if (n !== null) return Math.round(n);
  }
  return null;
}

function parseVariantOptions(optionsRaw: unknown): Cafe24VariantOption[] {
  if (!Array.isArray(optionsRaw)) return [];

  return optionsRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const name = String(obj.name ?? "").trim();
      const value = String(obj.value ?? "").trim();
      if (!name && !value) return null;
      return { name, value } satisfies Cafe24VariantOption;
    })
    .filter((v): v is Cafe24VariantOption => Boolean(v));
}

function parseVariantListFromJson(json: Record<string, unknown>): Cafe24VariantSummary[] {
  const list = Array.isArray(json.variants)
    ? json.variants
    : (json.variant && typeof json.variant === "object" ? [json.variant] : []);

  return list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const variant = entry as Record<string, unknown>;
      const variantCode = String(variant.variant_code ?? variant.variantCode ?? "").trim();
      if (!variantCode) return null;
      const customCodeRaw = String(variant.custom_variant_code ?? variant.customVariantCode ?? "").trim();

      return {
        variantCode,
        customVariantCode: customCodeRaw || null,
        options: parseVariantOptions(variant.options),
        additionalAmount: parseVariantAdditionalAmount(variant),
      } satisfies Cafe24VariantSummary;
    })
    .filter((v): v is Cafe24VariantSummary => Boolean(v));
}

async function lookupProductNoByProductCode(
  account: ShopChannelAccount,
  accessToken: string,
  externalCode: string,
): Promise<string | null> {
  const code = String(externalCode ?? "").trim();
  if (!code) return null;

  const urls = [
    withShopNo(`${adminBase(account)}/products?product_code=${encodeURIComponent(code)}&limit=1`, account.shop_no),
    `${adminBase(account)}/products?product_code=${encodeURIComponent(code)}&limit=1`,
  ];

  for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
    for (const url of urls) {
      const res = await fetchWithRetry(url, { method: "GET", headers });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) continue;
      const productNo = parseProductNoFromJson(json);
      if (productNo) return productNo;
    }
  }

  return null;
}

export async function cafe24GetProductPrice(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
): Promise<{ ok: boolean; status: number; currentPriceKrw: number | null; raw: unknown; error?: string }> {
  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  // 1) direct with mapped value
  for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
    for (const url of adminProductUrls(account, externalProductNo)) {
      const res = await fetchWithRetry(url, { method: "GET", headers });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      lastStatus = res.status;
      lastJson = json;
      lastErr = extractApiErrorMessage(json, res.status);
      if (res.ok) {
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
      if (![400, 404].includes(res.status)) {
        return { ok: false, status: lastStatus, currentPriceKrw: null, raw: lastJson, error: lastErr };
      }
    }
  }

  // 2) treat mapped value as product_code and resolve product_no
  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, externalProductNo);
  if (resolvedProductNo) {
    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const url of adminProductUrls(account, resolvedProductNo)) {
        const res = await fetchWithRetry(url, { method: "GET", headers });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        lastStatus = res.status;
        lastJson = json;
        lastErr = extractApiErrorMessage(json, res.status);
        if (res.ok) {
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
        if (![400, 404].includes(res.status)) break;
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    currentPriceKrw: null,
    raw: lastJson,
    error: lastErr,
  };
}

export async function cafe24GetVariantPrice(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
  externalVariantCode: string,
): Promise<{ ok: boolean; status: number; currentPriceKrw: number | null; additionalAmount: number | null; raw: unknown; error?: string }> {
  const productNoLike = String(externalProductNo ?? "").trim();
  const variantCode = String(externalVariantCode ?? "").trim();
  if (!productNoLike || !variantCode) {
    return { ok: false, status: 400, currentPriceKrw: null, additionalAmount: null, raw: {}, error: "missing product_no or variant_code" };
  }

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  const tryFetchByProductNoLike = async (productNo: string): Promise<{ ok: boolean; status: number; currentPriceKrw: number | null; additionalAmount: number | null; raw: unknown } | null> => {
    const path = `${adminBase(account)}/products/${productNoFromValue(productNo)}/variants/${productNoFromValue(variantCode)}`;

    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const url of [withShopNo(path, account.shop_no), path]) {
        const res = await fetchWithRetry(url, { method: "GET", headers });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        lastStatus = res.status;
        lastJson = json;
        lastErr = extractApiErrorMessage(json, res.status);

        if (res.ok) {
          const variant = parseVariantFromJson(json);
          const directPrice = parseVariantPrice(variant);
          const additionalAmount = parseVariantAdditionalAmount(variant);

          if (directPrice !== null) {
            return { ok: true, status: res.status, currentPriceKrw: directPrice, additionalAmount, raw: json };
          }

          const basePriceRes = await cafe24GetProductPrice(account, accessToken, productNo);
          const basePrice = basePriceRes.ok ? basePriceRes.currentPriceKrw : null;
          const computed = basePrice !== null && additionalAmount !== null ? Math.round(basePrice + additionalAmount) : null;
          return { ok: true, status: res.status, currentPriceKrw: computed, additionalAmount, raw: json };
        }

        if (![400, 404].includes(res.status)) {
          return { ok: false, status: lastStatus, currentPriceKrw: null, additionalAmount: null, raw: lastJson };
        }
      }
    }

    return null;
  };

  const direct = await tryFetchByProductNoLike(productNoLike);
  if (direct) return { ...direct, error: direct.ok ? undefined : lastErr };

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, productNoLike);
  if (resolvedProductNo) {
    const resolved = await tryFetchByProductNoLike(resolvedProductNo);
    if (resolved) return { ...resolved, error: resolved.ok ? undefined : lastErr };
  }

  return { ok: false, status: lastStatus, currentPriceKrw: null, additionalAmount: null, raw: lastJson, error: lastErr };
}

export async function cafe24ListProductVariants(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
): Promise<{
  ok: boolean;
  status: number;
  variants: Cafe24VariantSummary[];
  raw: unknown;
  resolvedProductNo: string | null;
  error?: string;
}> {
  const productNoLike = String(externalProductNo ?? "").trim();
  if (!productNoLike) {
    return {
      ok: false,
      status: 400,
      variants: [],
      raw: {},
      resolvedProductNo: null,
      error: "missing product_no",
    };
  }

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  const tryListByProductNoLike = async (productNo: string): Promise<Cafe24VariantSummary[] | null> => {
    const basePath = `${adminBase(account)}/products/${productNoFromValue(productNo)}/variants`;
    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const url of [withShopNo(basePath, account.shop_no), basePath]) {
        const res = await fetchWithRetry(url, { method: "GET", headers });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        lastStatus = res.status;
        lastJson = json;
        lastErr = extractApiErrorMessage(json, res.status);

        if (res.ok) {
          return parseVariantListFromJson(json);
        }

        if (![400, 404].includes(res.status)) {
          return null;
        }
      }
    }
    return null;
  };

  const direct = await tryListByProductNoLike(productNoLike);
  if (direct) {
    return {
      ok: true,
      status: lastStatus,
      variants: direct,
      raw: lastJson,
      resolvedProductNo: productNoLike,
    };
  }

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, productNoLike);
  if (resolvedProductNo) {
    const resolved = await tryListByProductNoLike(resolvedProductNo);
    if (resolved) {
      return {
        ok: true,
        status: lastStatus,
        variants: resolved,
        raw: lastJson,
        resolvedProductNo,
      };
    }
  }

  return {
    ok: false,
    status: lastStatus,
    variants: [],
    raw: lastJson,
    resolvedProductNo: resolvedProductNo ?? null,
    error: lastErr,
  };
}

export async function cafe24UpdateProductPrice(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
  targetPriceKrw: number,
): Promise<{ ok: boolean; status: number; raw: unknown; error?: string; attempt_key?: string }> {
  const asNumber = Math.round(targetPriceKrw);
  const shopNo = Number(account.shop_no ?? 0);
  const candidatePayloads: Array<{ key: string; body: Record<string, unknown> }> = [
    {
      key: "req_price_num",
      body: {
        ...(Number.isFinite(shopNo) && shopNo > 0 ? { shop_no: Math.floor(shopNo) } : {}),
        request: { price: asNumber },
      },
    },
    { key: "req_price_num_no_shop", body: { request: { price: asNumber } } },
  ];

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";
  let lastAttemptKey = "unknown";
  const verifyDelaysMs = UPDATE_VERIFY_DELAYS_MS;

  const tryUpdateByProductNoLike = async (productNoLike: string): Promise<boolean> => {
    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const url of adminProductWriteUrls(account, productNoLike)) {
        for (const payload of candidatePayloads) {
          const res = await fetchWithRetry(url, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload.body),
          });

          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          lastStatus = res.status;
          lastJson = { attempt_key: payload.key, response: json };
          lastAttemptKey = payload.key;

          if (res.ok) {
            let verified = false;
            let verifyCurrent: number | null = null;
            let verifyRaw: unknown = null;

            for (const waitMs of verifyDelaysMs) {
              if (waitMs > 0) await sleep(waitMs);
              const verify = await cafe24GetProductPrice(account, accessToken, productNoLike);
              verifyCurrent = verify.ok ? verify.currentPriceKrw : null;
              verifyRaw = verify.raw;
              if (verify.ok && verifyCurrent === asNumber) {
                verified = true;
                break;
              }
            }

            if (verified) {
              lastJson = { attempt_key: payload.key, response: json, verify: verifyRaw };
              return true;
            }
            lastJson = {
              attempt_key: payload.key,
              response: json,
              verify: verifyRaw,
              verify_current: verifyCurrent,
              verify_expected: asNumber,
              verify_pending: true,
            };
            return true;
          }

          lastErr = extractApiErrorMessage(json, res.status);

          if (res.status === 401 || res.status === 403 || res.status >= 500 || res.status === 429) {
            return false;
          }
        }

        if (![400, 404].includes(lastStatus)) return false;
      }
    }
    return false;
  };

  if (await tryUpdateByProductNoLike(externalProductNo)) {
    return { ok: true, status: lastStatus, raw: lastJson, attempt_key: lastAttemptKey };
  }

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, externalProductNo);
  if (resolvedProductNo && await tryUpdateByProductNoLike(resolvedProductNo)) {
    return { ok: true, status: lastStatus, raw: lastJson, attempt_key: lastAttemptKey };
  }

  return {
    ok: false,
    status: lastStatus,
    raw: lastJson,
    error: lastErr,
    attempt_key: lastAttemptKey,
  };
}

export async function cafe24UpdateVariantAdditionalAmount(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
  externalVariantCode: string,
  additionalAmountKrw: number,
): Promise<{ ok: boolean; status: number; raw: unknown; error?: string; attempt_key?: string }> {
  const productNoLike = String(externalProductNo ?? "").trim();
  const variantCode = String(externalVariantCode ?? "").trim();
  if (!productNoLike || !variantCode) {
    return { ok: false, status: 400, raw: {}, error: "missing product_no or variant_code", attempt_key: "missing_keys" };
  }

  const asNumber = Math.round(additionalAmountKrw);
  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";
  let lastAttempt = "unknown";
  const verifyDelaysMs = UPDATE_VERIFY_DELAYS_MS;

  const tryUpdateByProductNoLike = async (productNo: string): Promise<boolean> => {
    const singlePath = `${adminBase(account)}/products/${productNoFromValue(productNo)}/variants/${productNoFromValue(variantCode)}`;
    const bulkPath = `${adminBase(account)}/products/${productNoFromValue(productNo)}/variants`;
    const payloads: Array<{ key: string; path: string; body: Record<string, unknown> }> = [
      { key: "variant_single_request_additional_amount_num", path: singlePath, body: { request: { additional_amount: asNumber } } },
      { key: "variant_bulk_requests_num", path: bulkPath, body: { requests: [{ variant_code: variantCode, additional_amount: asNumber }] } },
    ];

    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const payload of payloads) {
        for (const url of [payload.path]) {
          const res = await fetchWithRetry(url, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload.body),
          });
          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          lastStatus = res.status;
          lastAttempt = payload.key;
          lastJson = { attempt_key: payload.key, response: json };

        if (res.ok) {
          const responseVariant = parseVariantFromJson(json);
          const responseAdditional = parseVariantAdditionalAmount(responseVariant);
          if (responseAdditional !== null && Math.round(responseAdditional) === asNumber) {
            lastJson = {
              attempt_key: payload.key,
              response: json,
              verify: { source: "response", additional_amount: responseAdditional },
            };
            return true;
          }

          let verified = false;
          let verifyAdditionalAmount: number | null = null;
          let verifyRaw: unknown = null;

            for (const waitMs of verifyDelaysMs) {
              if (waitMs > 0) await sleep(waitMs);
              const verify = await cafe24GetVariantPrice(account, accessToken, productNo, variantCode);
              verifyAdditionalAmount = verify.additionalAmount;
              verifyRaw = verify.raw;
              if (verify.ok && verifyAdditionalAmount !== null && Math.round(verifyAdditionalAmount) === asNumber) {
                verified = true;
                break;
              }
            }

          if (verified) {
            lastJson = { attempt_key: payload.key, response: json, verify: verifyRaw };
            return true;
          }
          lastJson = {
            attempt_key: payload.key,
            response: json,
            verify: verifyRaw,
            verify_additional_amount: verifyAdditionalAmount,
            verify_expected_additional_amount: asNumber,
            verify_pending: true,
          };
          return true;
        }

          lastErr = extractApiErrorMessage(json, res.status);
          if (res.status === 401 || res.status === 403 || res.status >= 500 || res.status === 429) {
            return false;
          }
        }
      }
    }

    return false;
  };

  if (await tryUpdateByProductNoLike(productNoLike)) {
    return { ok: true, status: lastStatus, raw: lastJson, attempt_key: lastAttempt };
  }

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, productNoLike);
  if (resolvedProductNo && await tryUpdateByProductNoLike(resolvedProductNo)) {
    return { ok: true, status: lastStatus, raw: lastJson, attempt_key: lastAttempt };
  }

  return { ok: false, status: lastStatus, raw: lastJson, error: lastErr, attempt_key: lastAttempt };
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function cafe24GetProductOptions(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
): Promise<{ ok: boolean; status: number; options: Cafe24ProductOptionGroup[]; raw: unknown; error?: string }> {
  const productNoLike = String(externalProductNo ?? "").trim();
  if (!productNoLike) return { ok: false, status: 400, options: [], raw: {}, error: "missing product_no" };

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";

  const tryFetch = async (productNo: string): Promise<Cafe24ProductOptionGroup[] | null> => {
    const basePath = `${adminBase(account)}/products/${productNoFromValue(productNo)}/options`;
    for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
      for (const url of [withShopNo(basePath, account.shop_no), basePath]) {
        const res = await fetchWithRetry(url, { method: "GET", headers });
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        lastStatus = res.status;
        lastJson = json;
        lastErr = extractApiErrorMessage(json, res.status);
        if (res.ok) {
          const list = Array.isArray(json.options) ? json.options : [];
          return list
            .map((entry) => {
              if (!entry || typeof entry !== "object") return null;
              const obj = entry as Record<string, unknown>;
              const optionName = String(obj.option_name ?? "").trim();
              if (!optionName) return null;
              const optionValues = Array.isArray(obj.option_value) ? obj.option_value : [];
              return {
                ...obj,
                option_name: optionName,
                option_value: optionValues,
              } as Cafe24ProductOptionGroup;
            })
            .filter((v): v is Cafe24ProductOptionGroup => Boolean(v));
        }
        if (![400, 404].includes(res.status)) return null;
      }
    }
    return null;
  };

  const direct = await tryFetch(productNoLike);
  if (direct) return { ok: true, status: lastStatus, options: direct, raw: lastJson };

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, productNoLike);
  if (resolvedProductNo) {
    const resolved = await tryFetch(resolvedProductNo);
    if (resolved) return { ok: true, status: lastStatus, options: resolved, raw: lastJson };
  }

  return { ok: false, status: lastStatus, options: [], raw: lastJson, error: lastErr };
}

export async function cafe24UpdateProductOptionLabels(
  account: ShopChannelAccount,
  accessToken: string,
  externalProductNo: string,
  updates: Array<{ optionName: string; currentText: string; nextText: string }>,
): Promise<{ ok: boolean; status: number; updated: number; raw: unknown; error?: string; attempt_key?: string }> {
  const productNoLike = String(externalProductNo ?? "").trim();
  if (!productNoLike) return { ok: false, status: 400, updated: 0, raw: {}, error: "missing product_no" };
  if (!Array.isArray(updates) || updates.length === 0) return { ok: true, status: 200, updated: 0, raw: { skipped: "no_updates" } };

  const source = await cafe24GetProductOptions(account, accessToken, productNoLike);
  if (!source.ok) {
    return {
      ok: false,
      status: source.status,
      updated: 0,
      raw: source.raw,
      error: source.error ?? "failed to fetch product options",
      attempt_key: "fetch_options",
    };
  }

  const options = deepCloneJson(source.options);
  let updated = 0;
  for (const patch of updates) {
    const optionName = String(patch.optionName ?? "").trim();
    const currentText = String(patch.currentText ?? "").trim();
    const nextText = String(patch.nextText ?? "").trim();
    if (!optionName || !currentText || !nextText || currentText === nextText) continue;

    for (const group of options) {
      if (String(group.option_name ?? "").trim() !== optionName) continue;
      const values = Array.isArray(group.option_value) ? group.option_value : [];
      for (const valueRaw of values) {
        if (!valueRaw || typeof valueRaw !== "object") continue;
        const value = valueRaw as Record<string, unknown>;
        if (String(value.option_text ?? "").trim() === currentText) {
          value.option_text = nextText;
          updated += 1;
        }
      }
    }
  }

  if (updated === 0) {
    return { ok: true, status: 200, updated: 0, raw: { skipped: "no_matching_option_values" }, attempt_key: "no_change" };
  }

  const resolvedProductNo = await lookupProductNoByProductCode(account, accessToken, productNoLike);
  const productNoForWrite = resolvedProductNo ?? productNoLike;
  const basePath = `${adminBase(account)}/products/${productNoFromValue(productNoForWrite)}/options`;
  const body = {
    request: {
      options,
      original_options: source.options,
    },
  };

  let lastStatus = 0;
  let lastJson: unknown = null;
  let lastErr = "unknown";
  let lastAttempt = "update_options";

  for (const headers of adminHeaderCandidates(accessToken, account.api_version)) {
    for (const url of [withShopNo(basePath, account.shop_no), basePath]) {
      const res = await fetchWithRetry(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      lastStatus = res.status;
      lastJson = json;
      lastErr = extractApiErrorMessage(json, res.status);

      if (res.ok) {
        return { ok: true, status: res.status, updated, raw: json, attempt_key: lastAttempt };
      }

      if (res.status === 401 || res.status === 403 || res.status >= 500 || res.status === 429) {
        return { ok: false, status: lastStatus, updated: 0, raw: lastJson, error: lastErr, attempt_key: lastAttempt };
      }
    }
  }

  return { ok: false, status: lastStatus, updated: 0, raw: lastJson, error: lastErr, attempt_key: lastAttempt };
}
