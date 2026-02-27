import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";
import {
  cafe24GetProductPrice,
  cafe24UpdateProductPrice,
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
  const runType = String(body.run_type ?? "MANUAL").toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
  const dryRun = body.dry_run === true;

  if (!channelId) return jsonError("channel_id is required", 400);

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("채널 계정이 없습니다", 422);

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "카페24 토큰 확인 실패", 422);
  }

  let q = sb
    .from("v_channel_price_dashboard")
    .select("channel_id, channel_product_id, master_item_id, external_product_no, final_target_price_krw, current_channel_price_krw")
    .eq("channel_id", channelId);

  if (channelProductIds && channelProductIds.length > 0) q = q.in("channel_product_id", channelProductIds);

  const candRes = await q;
  if (candRes.error) return jsonError(candRes.error.message ?? "반영 대상 조회 실패", 500);
  const candidates = (candRes.data ?? []).filter(
    (r) => r.channel_product_id && r.external_product_no && Number.isFinite(Number(r.final_target_price_krw)),
  );

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: candidates.length,
      data: candidates,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const jobRes = await sb
    .from("price_sync_job")
    .insert({
      channel_id: channelId,
      run_type: runType,
      status: "RUNNING",
      request_payload: body,
      started_at: new Date().toISOString(),
    })
    .select("job_id")
    .single();

  if (jobRes.error) return jsonError(jobRes.error.message ?? "동기화 작업 생성 실패", 500);
  const jobId = jobRes.data.job_id as string;

  const itemRows = [] as Array<Record<string, unknown>>;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const c of candidates) {
    const targetPrice = Math.round(Number(c.final_target_price_krw));
    if (!Number.isFinite(targetPrice) || targetPrice < 0) {
      skippedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: 0,
        after_price_krw: c.current_channel_price_krw,
        status: "SKIPPED",
        http_status: 422,
        error_code: "INVALID_TARGET_PRICE",
        error_message: "target price is invalid",
        raw_response_json: { target: c.final_target_price_krw },
      });
      continue;
    }

    let pushRes = await cafe24UpdateProductPrice(account, accessToken, String(c.external_product_no), targetPrice);
    if (!pushRes.ok && pushRes.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        pushRes = await cafe24UpdateProductPrice(account, accessToken, String(c.external_product_no), targetPrice);
      } catch {
        // keep original 401 result
      }
    }

    if (pushRes.ok) {
      let afterPrice = targetPrice;
      const verify = await cafe24GetProductPrice(account, accessToken, String(c.external_product_no));
      if (verify.ok && verify.currentPriceKrw !== null) {
        afterPrice = verify.currentPriceKrw;
      }

      successCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: targetPrice,
        after_price_krw: afterPrice,
        status: "SUCCESS",
        http_status: pushRes.status,
        error_code: null,
        error_message: null,
        raw_response_json: pushRes.raw,
      });
    } else {
      failedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: targetPrice,
        after_price_krw: c.current_channel_price_krw,
        status: "FAILED",
        http_status: pushRes.status,
        error_code: `HTTP_${pushRes.status}`,
        error_message: pushRes.error ?? "카페24 push 실패",
        raw_response_json: pushRes.raw,
      });
    }
  }

  if (itemRows.length > 0) {
    const itemRes = await sb.from("price_sync_job_item").insert(itemRows);
    if (itemRes.error) return jsonError(itemRes.error.message ?? "동기화 작업 아이템 저장 실패", 500);
  }

  const finalStatus =
    candidates.length === 0
      ? "SUCCESS"
      : failedCount === 0
        ? (skippedCount > 0 ? "PARTIAL" : "SUCCESS")
        : successCount === 0
          ? "FAILED"
          : "PARTIAL";

  const finishRes = await sb
    .from("price_sync_job")
    .update({
      status: finalStatus,
      success_count: successCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      finished_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);
  if (finishRes.error) return jsonError(finishRes.error.message ?? "동기화 작업 마감 실패", 500);

  return NextResponse.json({
    ok: true,
    job_id: jobId,
    total: candidates.length,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
  }, { headers: { "Cache-Control": "no-store" } });
}
