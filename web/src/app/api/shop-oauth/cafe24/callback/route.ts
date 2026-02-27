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
};

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

  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
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
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as Cafe24TokenResponse;

  if (!tokenRes.ok || !tokenJson.access_token) {
    const reason = sanitizeMessage(tokenJson.error_description || tokenJson.error || `HTTP_${tokenRes.status}`);
    await sb
      .from("sales_channel_account")
      .update({ status: "ERROR", last_error_code: String(tokenRes.status), last_error_message: `oauth exchange failed: ${reason}` })
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
