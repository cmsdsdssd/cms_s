import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Cafe24OAuthStatePayload = {
  channelId: string;
  expiresAtSec: number;
};

function getStateSecret(): string {
  const secret = (process.env.CAFE24_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret) throw new Error("OAuth state secret missing");
  return secret;
}

function stateSignature(raw: string): string {
  return createHmac("sha256", getStateSecret()).update(raw).digest("base64url");
}

export function buildCafe24OAuthState(channelId: string, ttlSec = 600): string {
  const safeChannelId = String(channelId ?? "").trim();
  if (!safeChannelId) throw new Error("channel id is required");

  const expiresAtSec = Math.floor(Date.now() / 1000) + Math.max(60, Math.floor(ttlSec));
  const nonce = randomBytes(12).toString("base64url");
  const raw = `${safeChannelId}.${expiresAtSec}.${nonce}`;
  const sig = stateSignature(raw);
  return `${raw}.${sig}`;
}

export function verifyCafe24OAuthState(state: string): Cafe24OAuthStatePayload {
  const safeState = String(state ?? "").trim();
  const parts = safeState.split(".");
  if (parts.length !== 4) throw new Error("invalid state format");

  const [channelId, expiresAt, nonce, sig] = parts;
  if (!channelId || !expiresAt || !nonce || !sig) throw new Error("invalid state fields");

  const raw = `${channelId}.${expiresAt}.${nonce}`;
  const expected = stateSignature(raw);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(sig);
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    throw new Error("invalid state signature");
  }

  const expiresAtSec = Number(expiresAt);
  if (!Number.isFinite(expiresAtSec) || expiresAtSec <= Math.floor(Date.now() / 1000)) {
    throw new Error("state expired");
  }

  return { channelId, expiresAtSec };
}

export function resolveCafe24CallbackUrl(request: Request): string {
  const forced = (process.env.CAFE24_OAUTH_REDIRECT_URI ?? "").trim();
  if (forced) return forced;

  const reqUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  const proto = forwardedProto || reqUrl.protocol.replace(":", "");
  const host = forwardedHost || reqUrl.host;
  return `${proto}://${host}/api/shop-oauth/cafe24/callback`;
}

function resolveRequestOrigin(request: Request): string {
  const reqUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  const proto = forwardedProto || reqUrl.protocol.replace(":", "");
  const host = forwardedHost || reqUrl.host;
  return `${proto}://${host}`;
}

export function toChannelsSettingsUrl(request: Request, params?: Record<string, string>): string {
  const target = new URL("/settings/shopping/channels", resolveRequestOrigin(request));
  for (const [k, v] of Object.entries(params ?? {})) {
    target.searchParams.set(k, v);
  }
  return target.toString();
}
