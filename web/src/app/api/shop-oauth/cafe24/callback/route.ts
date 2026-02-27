import { NextResponse } from "next/server";
import { getShopAdminClient } from "@/lib/shop/admin";
import { resolveCafe24CallbackUrl, toChannelsSettingsUrl, verifyCafe24OAuthState } from "@/lib/shop/cafe24-oauth";
import { normalizeMallId } from "@/lib/shop/mall-id";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Cafe24TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  expires_in?: number;
  refresh_token_expires_at?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
  trace_id?: string;
};

type TokenAttemptResult = {
  ok: boolean;
  status: number;
  json: Cafe24TokenResponse;
  reason: string;
};

function getRawQueryParam(requestUrl: string, key: string): string | null {
  const query = requestUrl.split("?", 2)[1] ?? "";
  if (!query) return null;

  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    const rawK = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
    const rawV = eqIdx >= 0 ? pair.slice(eqIdx + 1) : "";

    let decodedK = "";
    try {
      decodedK = decodeURIComponent(rawK);
    } catch {
      continue;
    }
    if (decodedK !== key) continue;

    try {
      return decodeURIComponent(rawV);
    } catch {
      return rawV;
    }
  }
  return null;
}

function calcExpiryIso(expiresAt?: string, expiresIn?: number, defaultSec = 7200): string {
  if (expiresAt) {
    const t = Date.parse(expiresAt);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  const sec = Number(expiresIn);
  const ttl = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : defaultSec;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

function sanitizeMessage(input: string): string {
  return String(input ?? "").replace(/[\r\n]/g, " ").slice(0, 180);
}

async function requestCafe24Token(
  tokenUrl: string,
  body: URLSearchParams,
  authorizationHeader?: string,
): Promise<TokenAttemptResult> {
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (authorizationHeader) {
    headers.Authorization = authorizationHeader;
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Cafe24TokenResponse;
  const reason = sanitizeMessage(
    json.error_description || json.error || (json.trace_id ? `trace_id=${json.trace_id}` : `HTTP_${res.status}`),
  );

  return {
    ok: res.ok && Boolean(json.access_token),
    status: res.status,
    json,
    reason,
  };
}

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) {
    return NextResponse.redirect(toChannelsSettingsUrl(request, { oauth: "error", reason: "server_env_missing" }));
  }

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error")?.trim();
  const oauthErrorDescription = url.searchParams.get("error_description")?.trim();
  if (oauthError) {
    return NextResponse.redirect(
      toChannelsSettingsUrl(request, {
        oauth: "error",
        reason: sanitizeMessage(oauthErrorDescription || oauthError),
      }),
    );
  }

  // NOTE: URLSearchParams may normalize '+' into space.
  // OAuth providers can issue code/state containing '+', so parse raw query first.
  const code = (getRawQueryParam(request.url, "code") ?? url.searchParams.get("code") ?? "").trim();
  const state = (getRawQueryParam(request.url, "state") ?? url.searchParams.get("state") ?? "").trim();
  if (!code || !state) {
    return NextResponse.redirect(toChannelsSettingsUrl(request, { oauth: "error", reason: "missing_code_or_state" }));
  }

  let channelId = "";
  try {
    const parsed = verifyCafe24OAuthState(state);
    channelId = parsed.channelId;
  } catch (e) {
    return NextResponse.redirect(
      toChannelsSettingsUrl(request, { oauth: "error", reason: sanitizeMessage(e instanceof Error ? e.message : "invalid_state") }),
    );
  }

  const { data: account, error: accountError } = await sb
    .from("sales_channel_account")
    .select("account_id, mall_id, client_id_enc, client_secret_enc")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.redirect(toChannelsSettingsUrl(request, { oauth: "error", reason: "account_not_found" }));
  }

  const mallIdRaw = String(account.mall_id ?? "").trim();
  const clientId = String(account.client_id_enc ?? "").trim();
  const clientSecret = String(account.client_secret_enc ?? "").trim();
  const normalizedMall = normalizeMallId(mallIdRaw);
  if (!normalizedMall.ok || !clientId || !clientSecret) {
    return NextResponse.redirect(toChannelsSettingsUrl(request, { oauth: "error", reason: "account_credentials_missing" }));
  }

  const tokenUrl = `https://${normalizedMall.mallId}.cafe24api.com/api/v2/oauth/token`;
  const redirectUri = resolveCafe24CallbackUrl(request);
  const basicAuth = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

  const attempt1Body = new URLSearchParams();
  attempt1Body.set("grant_type", "authorization_code");
  attempt1Body.set("code", code);
  attempt1Body.set("redirect_uri", redirectUri);
  attempt1Body.set("client_id", clientId);
  attempt1Body.set("client_secret", clientSecret);

  const attempt2Body = new URLSearchParams();
  attempt2Body.set("grant_type", "authorization_code");
  attempt2Body.set("code", code);
  attempt2Body.set("client_id", clientId);
  attempt2Body.set("client_secret", clientSecret);

  const attempt3Body = new URLSearchParams();
  attempt3Body.set("grant_type", "authorization_code");
  attempt3Body.set("code", code);
  attempt3Body.set("redirect_uri", redirectUri);

  const attempt4Body = new URLSearchParams();
  attempt4Body.set("grant_type", "authorization_code");
  attempt4Body.set("code", code);

  const attempts: Array<{ name: string; body: URLSearchParams; auth?: string }> = [
    { name: "body_with_redirect", body: attempt1Body },
    { name: "body_without_redirect", body: attempt2Body },
    { name: "basic_with_redirect", body: attempt3Body, auth: basicAuth },
    { name: "basic_without_redirect", body: attempt4Body, auth: basicAuth },
  ];

  let tokenJson: Cafe24TokenResponse | null = null;
  let tokenStatus = 500;
  const attemptReasons: string[] = [];

  for (const attempt of attempts) {
    const res = await requestCafe24Token(tokenUrl, attempt.body, attempt.auth);
    attemptReasons.push(`${attempt.name}:${res.status}:${res.reason}`);
    if (res.ok) {
      tokenJson = res.json;
      tokenStatus = res.status;
      break;
    }
    tokenStatus = res.status;
  }

  if (!tokenJson?.access_token) {
    const reason = sanitizeMessage(attemptReasons.join(" | "));
    await sb
      .from("sales_channel_account")
      .update({ status: "ERROR", last_error_code: String(tokenStatus), last_error_message: `oauth exchange failed: ${reason}` })
      .eq("account_id", account.account_id);

    return NextResponse.redirect(
      toChannelsSettingsUrl(request, { oauth: "error", reason, channel_id: channelId }),
    );
  }

  const updatePayload: Record<string, unknown> = {
    access_token_enc: tokenJson.access_token,
    access_token_expires_at: calcExpiryIso(tokenJson.expires_at, tokenJson.expires_in, 7200),
    status: "CONNECTED",
    last_error_code: null,
    last_error_message: null,
  };

  if (tokenJson.refresh_token && tokenJson.refresh_token.trim()) {
    updatePayload.refresh_token_enc = tokenJson.refresh_token.trim();
    updatePayload.refresh_token_expires_at = calcExpiryIso(tokenJson.refresh_token_expires_at, tokenJson.refresh_token_expires_in, 60 * 60 * 24 * 30);
  }

  const { error: updateError } = await sb
    .from("sales_channel_account")
    .update(updatePayload)
    .eq("account_id", account.account_id);

  if (updateError) {
    return NextResponse.redirect(toChannelsSettingsUrl(request, { oauth: "error", reason: "account_update_failed", channel_id: channelId }));
  }

  return NextResponse.redirect(
    toChannelsSettingsUrl(request, {
      oauth: "success",
      channel_id: channelId,
    }),
  );
}
