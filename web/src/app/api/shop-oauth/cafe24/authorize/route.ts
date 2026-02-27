import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { buildCafe24OAuthState, resolveCafe24CallbackUrl } from "@/lib/shop/cafe24-oauth";
import { normalizeMallId } from "@/lib/shop/mall-id";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const { data: account, error } = await sb
    .from("sales_channel_account")
    .select("channel_id, mall_id, client_id_enc")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) return jsonError(error.message ?? "채널 계정 조회 실패", 500);
  if (!account) return jsonError("채널 계정이 없습니다. 채널 설정에서 mall/client 정보를 먼저 저장하세요", 400);

  const mallIdRaw = String(account.mall_id ?? "").trim();
  const clientId = String(account.client_id_enc ?? "").trim();
  const normalizedMall = normalizeMallId(mallIdRaw);
  if (!normalizedMall.ok) return jsonError(normalizedMall.reason, 400);
  if (!clientId) return jsonError("client_id is required", 400);

  const redirectUri = resolveCafe24CallbackUrl(request);
  let state = "";
  try {
    state = buildCafe24OAuthState(channelId, 600);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "OAuth state 생성 실패", 500);
  }

  const query = new URLSearchParams();
  query.set("response_type", "code");
  query.set("client_id", clientId);
  query.set("state", state);
  query.set("redirect_uri", redirectUri);

  const authorizeUrl = `https://${normalizedMall.mallId}.cafe24api.com/api/v2/oauth/authorize?${query.toString()}`;
  return NextResponse.json(
    {
      data: {
        authorize_url: authorizeUrl,
        redirect_uri: redirectUri,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
