import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelId = String(id ?? "").trim();
  if (!channelId) return jsonError("channel id is required", 400);

  const { data, error } = await sb
    .from("sales_channel_account")
    .select("account_id, channel_id, mall_id, shop_no, api_version, status, access_token_expires_at, refresh_token_expires_at, last_error_code, last_error_message, created_at, updated_at")
    .eq("channel_id", channelId)
    .maybeSingle();

  if (error) return jsonError(error.message ?? "계정 조회 실패", 500);
  return NextResponse.json({ data: data ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelId = String(id ?? "").trim();
  if (!channelId) return jsonError("channel id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const mallId = String(body.mall_id ?? "").trim();
  const shopNo = Number(body.shop_no ?? 1);
  const apiVersion = typeof body.api_version === "string" ? body.api_version.trim() : null;
  const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : null;
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : null;
  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : null;
  const clientSecret = typeof body.client_secret === "string" ? body.client_secret.trim() : null;

  if (!mallId) return jsonError("mall_id is required", 400);
  if (!Number.isFinite(shopNo) || shopNo <= 0) return jsonError("shop_no must be positive", 400);

  const payload = {
    channel_id: channelId,
    mall_id: mallId,
    shop_no: Math.floor(shopNo),
    api_version: apiVersion,
    access_token_enc: accessToken,
    refresh_token_enc: refreshToken,
    client_id_enc: clientId,
    client_secret_enc: clientSecret,
    status: "CONNECTED",
    last_error_code: null,
    last_error_message: null,
  };

  const { data, error } = await sb
    .from("sales_channel_account")
    .upsert(payload, { onConflict: "channel_id" })
    .select("account_id, channel_id, mall_id, shop_no, api_version, status, access_token_expires_at, refresh_token_expires_at, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "계정 저장 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
