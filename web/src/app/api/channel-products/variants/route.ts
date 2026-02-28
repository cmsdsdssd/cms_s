import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import {
  cafe24ListProductVariants,
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const externalProductNo = String(searchParams.get("external_product_no") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("채널 계정이 없습니다", 422);

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "카페24 토큰 확인 실패", 422);
  }

  let result = await cafe24ListProductVariants(account, accessToken, externalProductNo);
  if (!result.ok && result.status === 401) {
    try {
      accessToken = await ensureValidCafe24AccessToken(sb, account);
      result = await cafe24ListProductVariants(account, accessToken, externalProductNo);
    } catch {
      // keep original 401 result
    }
  }

  if (!result.ok) {
    return jsonError(result.error ?? "옵션 목록 조회 실패", result.status || 502, {
      error_code: `HTTP_${result.status || 502}`,
    });
  }

  const rows = result.variants.map((v) => ({
    variant_code: v.variantCode,
    custom_variant_code: v.customVariantCode,
    options: v.options,
    option_label: v.options.map((o) => `${o.name}:${o.value}`).join(" / "),
    additional_amount: v.additionalAmount,
  }));

  return NextResponse.json(
    {
      data: {
        channel_id: channelId,
        requested_product_no: externalProductNo,
        resolved_product_no: result.resolvedProductNo ?? externalProductNo,
        total: rows.length,
        variants: rows,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
