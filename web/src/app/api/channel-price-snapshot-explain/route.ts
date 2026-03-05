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
    .select("channel_id, master_item_id, channel_product_id, base_total_pre_margin_krw, margin_multiplier_used, material_raw_krw, material_final_krw, labor_raw_krw, labor_pre_margin_adj_krw, labor_post_margin_adj_krw, total_pre_margin_adj_krw, total_post_margin_adj_krw, total_after_margin_krw, target_price_raw_krw, rounded_target_price_krw, override_price_krw, floor_price_krw, final_target_before_floor_krw, floor_clamped, final_target_price_krw, tick_gold_krw_g, tick_silver_krw_g, delta_material_krw, delta_size_krw, delta_color_krw, delta_decor_krw, delta_other_krw, delta_total_krw, compute_request_id, computed_at, breakdown_json")
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

  const masterRes = await sb
    .from("cms_master_item")
    .select("master_item_id, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, plating_price_sell_default, labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, plating_price_cost_default, center_qty_default, sub1_qty_default, sub2_qty_default")
    .eq("master_item_id", masterItemId)
    .maybeSingle();
  if (masterRes.error) return jsonError(masterRes.error.message ?? "master metadata lookup failed", 500);

  const absorbRes = await sb
    .from("cms_master_absorb_labor_item_v1")
    .select("bucket, amount_krw, labor_class")
    .eq("master_id", masterItemId)
    .eq("is_active", true);
  if (absorbRes.error) return jsonError(absorbRes.error.message ?? "absorb lookup failed", 500);

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

  const masterMeta = (masterRes.data ?? null) as (Record<string, unknown> | null);
  const masterCenterQty = Math.max(0, toInt(masterMeta?.center_qty_default));
  const masterSub1Qty = Math.max(0, toInt(masterMeta?.sub1_qty_default));
  const masterSub2Qty = Math.max(0, toInt(masterMeta?.sub2_qty_default));

  const masterLaborSellProfile =
    toInt(masterMeta?.labor_base_sell)
    + toInt(masterMeta?.labor_center_sell) * masterCenterQty
    + toInt(masterMeta?.labor_sub1_sell) * masterSub1Qty
    + toInt(masterMeta?.labor_sub2_sell) * masterSub2Qty
    + toInt(masterMeta?.plating_price_sell_default);

  const masterLaborCostProfile =
    toInt(masterMeta?.labor_base_cost)
    + toInt(masterMeta?.labor_center_cost) * masterCenterQty
    + toInt(masterMeta?.labor_sub1_cost) * masterSub1Qty
    + toInt(masterMeta?.labor_sub2_cost) * masterSub2Qty
    + toInt(masterMeta?.plating_price_cost_default);

  const absorbRows = (absorbRes.data ?? []) as Array<Record<string, unknown>>;
  let absorbTotal = 0;
  let absorbBaseLabor = 0;
  let absorbStoneLabor = 0;
  let absorbPlating = 0;
  let absorbEtc = 0;
  let absorbGeneralClass = 0;
  let absorbMaterialClass = 0;
  for (const row of absorbRows) {
    const amount = toInt(row.amount_krw);
    absorbTotal += amount;
    const bucket = String(row.bucket ?? "").trim().toUpperCase();
    if (bucket === "BASE_LABOR") absorbBaseLabor += amount;
    else if (bucket === "STONE_LABOR") absorbStoneLabor += amount;
    else if (bucket === "PLATING") absorbPlating += amount;
    else absorbEtc += amount;
    const laborClass = String(row.labor_class ?? "GENERAL").trim().toUpperCase();
    if (laborClass === "MATERIAL") absorbMaterialClass += amount;
    else absorbGeneralClass += amount;
  }

  const data: PricingSnapshotExplainRow = {
    channel_id: String((source as { channel_id?: string | null }).channel_id ?? channelId),
    master_item_id: String((source as { master_item_id?: string | null }).master_item_id ?? masterItemId),
    channel_product_id: productId,
    external_variant_code: variantCodeByProductId.get(productId) ?? null,
    master_base_price_krw: toInt((source as { base_total_pre_margin_krw?: unknown }).base_total_pre_margin_krw),
    shop_margin_multiplier: Number((source as { margin_multiplier_used?: unknown }).margin_multiplier_used ?? 1) || 1,
    material_raw_krw: toInt((source as { material_raw_krw?: unknown }).material_raw_krw),
    material_final_krw: toInt((source as { material_final_krw?: unknown }).material_final_krw),
    labor_raw_krw: toInt((source as { labor_raw_krw?: unknown }).labor_raw_krw),
    labor_pre_margin_adj_krw: toInt((source as { labor_pre_margin_adj_krw?: unknown }).labor_pre_margin_adj_krw),
    labor_post_margin_adj_krw: toInt((source as { labor_post_margin_adj_krw?: unknown }).labor_post_margin_adj_krw),
    labor_sell_total_krw: toInt(breakdown.labor_sot_total_sell_krw),
    labor_sell_master_krw: toInt(breakdown.labor_sot_master_sell_krw),
    labor_sell_decor_krw: toInt(breakdown.labor_sot_decor_sell_krw),
    master_labor_base_sell_krw: toInt(masterMeta?.labor_base_sell),
    master_labor_center_sell_krw: toInt(masterMeta?.labor_center_sell),
    master_labor_sub1_sell_krw: toInt(masterMeta?.labor_sub1_sell),
    master_labor_sub2_sell_krw: toInt(masterMeta?.labor_sub2_sell),
    master_plating_sell_krw: toInt(masterMeta?.plating_price_sell_default),
    master_labor_base_cost_krw: toInt(masterMeta?.labor_base_cost),
    master_labor_center_cost_krw: toInt(masterMeta?.labor_center_cost),
    master_labor_sub1_cost_krw: toInt(masterMeta?.labor_sub1_cost),
    master_labor_sub2_cost_krw: toInt(masterMeta?.labor_sub2_cost),
    master_plating_cost_krw: toInt(masterMeta?.plating_price_cost_default),
    master_center_qty: masterCenterQty,
    master_sub1_qty: masterSub1Qty,
    master_sub2_qty: masterSub2Qty,
    master_labor_sell_profile_krw: masterLaborSellProfile,
    master_labor_cost_profile_krw: masterLaborCostProfile,
    absorb_item_count: absorbRows.length,
    absorb_total_krw: absorbTotal,
    absorb_base_labor_krw: absorbBaseLabor,
    absorb_stone_labor_krw: absorbStoneLabor,
    absorb_plating_krw: absorbPlating,
    absorb_etc_krw: absorbEtc,
    absorb_general_class_krw: absorbGeneralClass,
    absorb_material_class_krw: absorbMaterialClass,
    total_pre_margin_adj_krw: toInt((source as { total_pre_margin_adj_krw?: unknown }).total_pre_margin_adj_krw),
    total_post_margin_adj_krw: toInt((source as { total_post_margin_adj_krw?: unknown }).total_post_margin_adj_krw),
    price_after_margin_krw: toInt((source as { total_after_margin_krw?: unknown }).total_after_margin_krw),
    base_adjust_krw: toInt(breakdown.base_price_delta_krw),
    delta_material_krw: deltaMaterial,
    delta_size_krw: deltaSize,
    delta_color_krw: deltaColor,
    delta_decor_krw: deltaDecor,
    delta_other_krw: deltaOther,
    delta_total_krw: summedDelta,
    target_price_raw_krw: toInt((source as { target_price_raw_krw?: unknown }).target_price_raw_krw),
    rounded_target_price_krw: toInt((source as { rounded_target_price_krw?: unknown }).rounded_target_price_krw),
    override_price_krw: (() => { const v = (source as { override_price_krw?: unknown }).override_price_krw; return v == null ? null : toInt(v); })(),
    floor_price_krw: toInt((source as { floor_price_krw?: unknown }).floor_price_krw),
    final_target_before_floor_krw: toInt((source as { final_target_before_floor_krw?: unknown }).final_target_before_floor_krw),
    floor_clamped: Boolean((source as { floor_clamped?: unknown }).floor_clamped),
    final_target_price_krw: toInt((source as { final_target_price_krw?: unknown }).final_target_price_krw),
    tick_gold_krw_g: toInt((source as { tick_gold_krw_g?: unknown }).tick_gold_krw_g),
    tick_silver_krw_g: toInt((source as { tick_silver_krw_g?: unknown }).tick_silver_krw_g),
    compute_request_id: String((source as { compute_request_id?: string | null }).compute_request_id ?? computeRequestId),
    computed_at: String((source as { computed_at?: string | null }).computed_at ?? ""),
  };

  const payload: PricingSnapshotExplainResponse = { data };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
