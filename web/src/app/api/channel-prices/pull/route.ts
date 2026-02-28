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
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code")
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
  const basePriceCache = new Map<string, Awaited<ReturnType<typeof cafe24GetProductPrice>>>();

  const rows = [] as Array<Record<string, unknown>>;

  for (const m of mappings) {
    const fetchedAt = new Date().toISOString();

    const variantCode = String((m as { external_variant_code?: string | null }).external_variant_code ?? "").trim();
    const productNo = String(m.external_product_no ?? "").trim();
    let pull = basePriceCache.get(productNo) ?? await cafe24GetProductPrice(account, accessToken, productNo);

    if (!pull.ok && pull.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        pull = await cafe24GetProductPrice(account, accessToken, productNo);
      } catch {
        // keep original 401 result
      }
    }

    basePriceCache.set(productNo, pull);

    if (pull.ok) {
      successCount += 1;
      rows.push({
        channel_id: m.channel_id,
        channel_product_id: m.channel_product_id,
        master_item_id: m.master_item_id,
        external_product_no: m.external_product_no,
        external_variant_code: variantCode,
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
        external_variant_code: variantCode,
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

  const insertWithVariant = async () =>
    sb
      .from("channel_price_snapshot")
      .insert(rows)
      .select("channel_price_snapshot_id");

  const insertWithoutVariant = async () => {
    const fallbackRows = rows.map(({ external_variant_code: _variant, ...rest }) => rest);
    return sb
      .from("channel_price_snapshot")
      .insert(fallbackRows)
      .select("channel_price_snapshot_id");
  };

  let insertRes = await insertWithVariant();

  if (insertRes.error) {
    const code = String((insertRes.error as { code?: string }).code ?? "");
    const message = String(insertRes.error.message ?? "");
    const missingVariantColumn =
      code === "PGRST204"
      || /external_variant_code/i.test(message)
      || /schema cache/i.test(message);

    if (missingVariantColumn) {
      insertRes = await insertWithoutVariant();
    }
  }

  if (insertRes.error) return jsonError(insertRes.error.message ?? "현재가 스냅샷 저장 실패", 500);

  const failedExamples = rows
    .filter((r) => String(r.fetch_status ?? "") === "FAILED")
    .slice(0, 3)
    .map((r) => ({
      external_product_no: String(r.external_product_no ?? ""),
      external_variant_code: String(r.external_variant_code ?? ""),
      http_status: Number(r.http_status ?? 0),
      error_code: String(r.error_code ?? ""),
      error_message: String(r.error_message ?? ""),
    }));

  return NextResponse.json({
    ok: true,
    inserted: insertRes.data?.length ?? 0,
    success: successCount,
    failed: failedCount,
    failed_examples: failedExamples,
    channel_id: channelId,
  }, { headers: { "Cache-Control": "no-store" } });
}
