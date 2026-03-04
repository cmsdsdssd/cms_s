import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import type { PricingSnapshotExplainResponse, PricingSnapshotExplainRow } from "@/types/pricingSnapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toInt = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  const computeRequestId = String(searchParams.get("compute_request_id") ?? "").trim();

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!computeRequestId) return jsonError("compute_request_id is required", 400);

  const snapshotRes = await sb
    .from("pricing_snapshot")
    .select("channel_id, master_item_id, channel_product_id, base_total_pre_margin_krw, margin_multiplier_used, total_after_margin_krw, delta_material_krw, delta_size_krw, delta_color_krw, delta_decor_krw, delta_other_krw, delta_total_krw, final_target_price_krw, compute_request_id, computed_at, breakdown_json")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("compute_request_id", computeRequestId)
    .order("computed_at", { ascending: false });

  if (snapshotRes.error) return jsonError(snapshotRes.error.message ?? "스냅샷 조회 실패", 500);
  const snapshotRows = snapshotRes.data ?? [];
  if (snapshotRows.length === 0) return jsonError("해당 compute_request_id에 대한 스냅샷이 없습니다", 404);

  const channelProductIds = snapshotRows
    .map((row) => String((row as { channel_product_id?: string | null }).channel_product_id ?? "").trim())
    .filter(Boolean);

  const mappingRes = channelProductIds.length > 0
    ? await sb
      .from("sales_channel_product")
      .select("channel_product_id, external_variant_code")
      .in("channel_product_id", channelProductIds)
    : { data: [], error: null };

  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);

  const variantCodeByProductId = new Map(
    (mappingRes.data ?? []).map((row) => [
      String((row as { channel_product_id?: string | null }).channel_product_id ?? ""),
      String((row as { external_variant_code?: string | null }).external_variant_code ?? "").trim() || null,
    ]),
  );

  const basePreferred = snapshotRows.find((row) => {
    const productId = String((row as { channel_product_id?: string | null }).channel_product_id ?? "");
    const variantCode = variantCodeByProductId.get(productId);
    return !variantCode;
  });
  const source = basePreferred ?? snapshotRows[0];

  const productId = String((source as { channel_product_id?: string | null }).channel_product_id ?? "");
  const breakdown = ((source as { breakdown_json?: unknown }).breakdown_json ?? {}) as Record<string, unknown>;

  const deltaMaterial = toInt((source as { delta_material_krw?: unknown }).delta_material_krw);
  const deltaSize = toInt((source as { delta_size_krw?: unknown }).delta_size_krw);
  const deltaColor = toInt((source as { delta_color_krw?: unknown }).delta_color_krw);
  const deltaDecor = toInt((source as { delta_decor_krw?: unknown }).delta_decor_krw);
  const deltaOther = toInt((source as { delta_other_krw?: unknown }).delta_other_krw);
  const summedDelta = deltaMaterial + deltaSize + deltaColor + deltaDecor + deltaOther;

  const data: PricingSnapshotExplainRow = {
    channel_id: String((source as { channel_id?: string | null }).channel_id ?? channelId),
    master_item_id: String((source as { master_item_id?: string | null }).master_item_id ?? masterItemId),
    channel_product_id: productId,
    external_variant_code: variantCodeByProductId.get(productId) ?? null,
    master_base_price_krw: toInt((source as { base_total_pre_margin_krw?: unknown }).base_total_pre_margin_krw),
    shop_margin_multiplier: Number((source as { margin_multiplier_used?: unknown }).margin_multiplier_used ?? 1) || 1,
    price_after_margin_krw: toInt((source as { total_after_margin_krw?: unknown }).total_after_margin_krw),
    base_adjust_krw: toInt(breakdown.base_price_delta_krw),
    delta_material_krw: deltaMaterial,
    delta_size_krw: deltaSize,
    delta_color_krw: deltaColor,
    delta_decor_krw: deltaDecor,
    delta_other_krw: deltaOther,
    delta_total_krw: summedDelta,
    final_target_price_krw: toInt((source as { final_target_price_krw?: unknown }).final_target_price_krw),
    compute_request_id: String((source as { compute_request_id?: string | null }).compute_request_id ?? computeRequestId),
    computed_at: String((source as { computed_at?: string | null }).computed_at ?? ""),
  };

  const payload: PricingSnapshotExplainResponse = { data };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
