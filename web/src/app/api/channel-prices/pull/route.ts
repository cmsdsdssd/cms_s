import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";
import {
  cafe24GetProductPrice,
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const channelProductIds = parseUuidArray(body.channel_product_ids);
  if (!channelId) return jsonError("channel_id is required", 400);

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("채널 계정이 없습니다", 422);

  let mapQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_product_no")
    .eq("channel_id", channelId)
    .eq("is_active", true);

  if (channelProductIds && channelProductIds.length > 0) mapQuery = mapQuery.in("channel_product_id", channelProductIds);
  const mapRes = await mapQuery;
  if (mapRes.error) return jsonError(mapRes.error.message ?? "매핑 조회 실패", 500);
  const mappings = mapRes.data ?? [];

  if (mappings.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, reason: "NO_MAPPINGS" }, { headers: { "Cache-Control": "no-store" } });
  }

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "카페24 토큰 확인 실패", 422);
  }

  let successCount = 0;
  let failedCount = 0;

  const rows = [] as Array<Record<string, unknown>>;

  for (const m of mappings) {
    const fetchedAt = new Date().toISOString();

    let pull = await cafe24GetProductPrice(account, accessToken, String(m.external_product_no));

    if (!pull.ok && pull.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        pull = await cafe24GetProductPrice(account, accessToken, String(m.external_product_no));
      } catch {
        // keep original 401 result
      }
    }

    if (pull.ok) {
      successCount += 1;
      rows.push({
        channel_id: m.channel_id,
        channel_product_id: m.channel_product_id,
        master_item_id: m.master_item_id,
        external_product_no: m.external_product_no,
        current_price_krw: pull.currentPriceKrw,
        currency: "KRW",
        fetched_at: fetchedAt,
        http_status: pull.status,
        fetch_status: "SUCCESS",
        error_code: null,
        error_message: null,
        raw_json: pull.raw,
      });
    } else {
      failedCount += 1;
      rows.push({
        channel_id: m.channel_id,
        channel_product_id: m.channel_product_id,
        master_item_id: m.master_item_id,
        external_product_no: m.external_product_no,
        current_price_krw: null,
        currency: "KRW",
        fetched_at: fetchedAt,
        http_status: pull.status,
        fetch_status: "FAILED",
        error_code: `HTTP_${pull.status}`,
        error_message: pull.error ?? "카페24 pull 실패",
        raw_json: pull.raw,
      });
    }
  }

  const insertRes = await sb
    .from("channel_price_snapshot")
    .insert(rows)
    .select("channel_price_snapshot_id");
  if (insertRes.error) return jsonError(insertRes.error.message ?? "현재가 스냅샷 저장 실패", 500);

  return NextResponse.json({
    ok: true,
    inserted: insertRes.data?.length ?? 0,
    success: successCount,
    failed: failedCount,
    channel_id: channelId,
  }, { headers: { "Cache-Control": "no-store" } });
}
