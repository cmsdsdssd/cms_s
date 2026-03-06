import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import type { PricingSnapshotExplainResponse, PricingSnapshotExplainRow } from "@/types/pricingSnapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toInt = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const toNullableInt = (value: unknown): number | null => {
  if (value == null) return null;
  return toInt(value);
};

const toNullableNumber = (value: unknown): number | null => {
  const n = Number(value ?? Number.NaN);
  return Number.isFinite(n) ? n : null;
};

const toTextOrNull = (value: unknown): string | null => {
  const v = String(value ?? "").trim();
  return v || null;
};

const uniqueTextList = (values: Array<unknown>): string[] => {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  const channelProductId = String(searchParams.get("channel_product_id") ?? "").trim();
  const externalProductNo = String(searchParams.get("external_product_no") ?? "").trim();
  const computeRequestId = String(searchParams.get("compute_request_id") ?? "").trim();

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  const selectColumns =
    "channel_id, master_item_id, channel_product_id, external_product_no, external_variant_code, compute_request_id, computed_at, pricing_algo_version, calc_version, material_code_effective, material_basis_resolved, material_purity_rate_resolved, material_adjust_factor_resolved, effective_tick_krw_g, net_weight_g, material_raw_krw, material_final_krw, labor_component_json, absorb_total_applied_krw, absorb_total_raw_krw, labor_cost_applied_krw_components, labor_sell_total_plus_absorb_krw_components, cost_sum_krw, material_pre_fee_krw, labor_pre_fee_krw, fixed_pre_fee_krw, candidate_pre_fee_krw, candidate_price_krw, min_margin_price_krw, guardrail_price_krw, guardrail_reason_code, final_target_price_v2_krw, current_channel_price_krw, diff_krw, diff_pct";

  const fetchRows = async (args: {
    computeRequestId?: string;
    externalProductNos?: string[];
  }): Promise<Record<string, unknown>[]> => {
    let query = sb
      .from("v_price_composition_flat_v2")
      .select(selectColumns)
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .order("computed_at", { ascending: false })
      .limit(50);

    if (channelProductId) query = query.eq("channel_product_id", channelProductId);
    const productNos = uniqueTextList(args.externalProductNos ?? []);
    if (productNos.length === 1) {
      query = query.eq("external_product_no", productNos[0]);
    } else if (productNos.length > 1) {
      query = query.in("external_product_no", productNos);
    }
    if (args.computeRequestId) query = query.eq("compute_request_id", args.computeRequestId);

    const res = await query;
    if (res.error) throw new Error(res.error.message ?? "Failed to read V2 snapshot view");
    return (res.data ?? []) as Record<string, unknown>[];
  };

  let rows: Record<string, unknown>[] = [];
  const requestedProductNos = uniqueTextList([externalProductNo]);
  try {
    rows = await fetchRows({ computeRequestId, externalProductNos: requestedProductNos });
    if (rows.length === 0 && computeRequestId) {
      rows = await fetchRows({ externalProductNos: requestedProductNos });
    }

    if (rows.length === 0 && externalProductNo) {
      const aliasRes = await sb
        .from("sales_channel_product")
        .select("external_product_no")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .eq("is_active", true);
      if (aliasRes.error) {
        return jsonError(aliasRes.error.message ?? "Failed to read product aliases", 500);
      }
      const aliasProductNos = uniqueTextList([
        externalProductNo,
        ...(aliasRes.data ?? []).map((row) => (row as { external_product_no?: string | null }).external_product_no ?? ""),
      ]);
      rows = await fetchRows({ computeRequestId, externalProductNos: aliasProductNos });
      if (rows.length === 0 && computeRequestId) {
        rows = await fetchRows({ externalProductNos: aliasProductNos });
      }
    }

    if (rows.length === 0 && externalProductNo) {
      rows = await fetchRows({ computeRequestId });
      if (rows.length === 0 && computeRequestId) {
        rows = await fetchRows({});
      }
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to read V2 snapshot view", 500);
  }

  const source = (
    rows.find((row) => String(row.external_variant_code ?? "").trim().length === 0)
    ?? rows[0]
    ?? null
  ) as Record<string, unknown> | null;
  if (!source) return jsonError("No V2 snapshot row found in view", 404);

  const sourceLaborCostApplied = toNullableInt(source.labor_cost_applied_krw_components);
  const sourceLaborSellPlusAbsorb = toNullableInt(source.labor_sell_total_plus_absorb_krw_components);
  const sourceAbsorbApplied = toNullableInt(source.absorb_total_applied_krw);
  const sourceAbsorbRaw = toNullableInt(source.absorb_total_raw_krw);

  let snapshotFallback: {
    labor_cost_applied_krw: number | null;
    labor_sell_total_plus_absorb_krw: number | null;
  } | null = null;

  if (sourceLaborCostApplied == null || sourceLaborSellPlusAbsorb == null) {
    let fallbackQuery = sb
      .from("pricing_snapshot")
      .select("labor_cost_applied_krw, labor_sell_total_plus_absorb_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("pricing_algo_version", "REVERSE_FEE_V2")
      .order("computed_at", { ascending: false })
      .limit(1);

    if (channelProductId) {
      fallbackQuery.eq("channel_product_id", channelProductId);
    } else {
      const sourceChannelProductId = String(source.channel_product_id ?? "").trim();
      if (sourceChannelProductId) fallbackQuery.eq("channel_product_id", sourceChannelProductId);
    }
    if (computeRequestId) {
      fallbackQuery.eq("compute_request_id", computeRequestId);
    }

    const fallbackRes = await fallbackQuery.maybeSingle();
    if (fallbackRes.error) return jsonError(fallbackRes.error.message ?? "Failed to read snapshot fallback", 500);
    const fallback = (fallbackRes.data ?? null) as Record<string, unknown> | null;
    if (fallback) {
      snapshotFallback = {
        labor_cost_applied_krw: toNullableInt(fallback.labor_cost_applied_krw),
        labor_sell_total_plus_absorb_krw: toNullableInt(fallback.labor_sell_total_plus_absorb_krw),
      };
    }
  }

  const resolvedLaborCostApplied = sourceLaborCostApplied ?? snapshotFallback?.labor_cost_applied_krw ?? null;
  const resolvedLaborSellPlusAbsorb = sourceLaborSellPlusAbsorb ?? snapshotFallback?.labor_sell_total_plus_absorb_krw ?? null;

  const laborComponentJson = (() => {
    const existing = (source.labor_component_json ?? null) as PricingSnapshotExplainRow["labor_component_json"];
    if (existing && Object.keys(existing).length > 0) return existing;
    if (resolvedLaborCostApplied == null && resolvedLaborSellPlusAbsorb == null) return null;

    const baseCost = Math.max(0, Math.round(Number(resolvedLaborCostApplied ?? 0)));
    const absorbApplied = Math.max(0, Math.round(Number(sourceAbsorbApplied ?? 0)));
    const absorbRaw = Math.max(0, Math.round(Number(sourceAbsorbRaw ?? absorbApplied)));
    const sellPlusAbsorb = Math.max(0, Math.round(Number(resolvedLaborSellPlusAbsorb ?? baseCost)));

    return {
      BASE_LABOR: {
        labor_cost_krw: baseCost,
        labor_absorb_applied_krw: absorbApplied,
        labor_absorb_raw_krw: absorbRaw,
        labor_cost_plus_absorb_krw: Math.max(0, baseCost + absorbApplied),
        labor_sell_krw: sellPlusAbsorb,
        labor_sell_plus_absorb_krw: sellPlusAbsorb,
        labor_class: "GENERAL",
      },
      STONE_LABOR: {
        labor_cost_krw: 0,
        labor_absorb_applied_krw: 0,
        labor_absorb_raw_krw: 0,
        labor_cost_plus_absorb_krw: 0,
        labor_sell_krw: 0,
        labor_sell_plus_absorb_krw: 0,
        labor_class: "GENERAL",
      },
      PLATING: {
        labor_cost_krw: 0,
        labor_absorb_applied_krw: 0,
        labor_absorb_raw_krw: 0,
        labor_cost_plus_absorb_krw: 0,
        labor_sell_krw: 0,
        labor_sell_plus_absorb_krw: 0,
        labor_class: "GENERAL",
      },
      ETC: {
        labor_cost_krw: 0,
        labor_absorb_applied_krw: 0,
        labor_absorb_raw_krw: 0,
        labor_cost_plus_absorb_krw: 0,
        labor_sell_krw: 0,
        labor_sell_plus_absorb_krw: 0,
        labor_class: "GENERAL",
      },
      DECOR: {
        labor_cost_krw: 0,
        labor_absorb_applied_krw: 0,
        labor_absorb_raw_krw: 0,
        labor_cost_plus_absorb_krw: 0,
        labor_sell_krw: 0,
        labor_sell_plus_absorb_krw: 0,
        labor_class: "GENERAL",
      },
    };
  })();

  const laborComponentRows = laborComponentJson ? Object.values(laborComponentJson) : [];
  const laborSellTotalFromComponents = laborComponentRows.reduce((sum, component) => sum + toInt(component?.labor_sell_krw), 0);

  const deltaMaterial = toInt(source.delta_material_krw);
  const deltaSize = toInt(source.delta_size_krw);
  const deltaColor = toInt(source.delta_color_krw);
  const deltaDecor = toInt(source.delta_decor_krw);
  const deltaOther = toInt(source.delta_other_krw);
  const deltaTotal = toInt(source.delta_total_krw) || (deltaMaterial + deltaSize + deltaColor + deltaDecor + deltaOther);

  const finalTargetV2 = toNullableInt(source.final_target_price_v2_krw);
  const finalTarget = finalTargetV2 ?? 0;

  const data: PricingSnapshotExplainRow = {
    channel_id: String(source.channel_id ?? channelId),
    master_item_id: String(source.master_item_id ?? masterItemId),
    channel_product_id: String(source.channel_product_id ?? ""),
    external_variant_code: toTextOrNull(source.external_variant_code),

    master_base_price_krw: toInt(source.cost_sum_krw),
    shop_margin_multiplier: Number(source.margin_multiplier_used ?? 1) || 1,

    material_raw_krw: toInt(source.material_raw_krw),
    material_final_krw: toInt(source.material_final_krw),

    labor_raw_krw: toInt(resolvedLaborCostApplied ?? 0),
    labor_pre_margin_adj_krw: toInt(resolvedLaborCostApplied ?? 0),
    labor_post_margin_adj_krw: toInt(resolvedLaborSellPlusAbsorb ?? 0),
    labor_sell_total_krw: laborSellTotalFromComponents > 0 ? laborSellTotalFromComponents : toInt(resolvedLaborSellPlusAbsorb ?? 0),
    labor_sell_master_krw: 0,
    labor_sell_decor_krw: 0,

    master_labor_base_sell_krw: 0,
    master_labor_center_sell_krw: 0,
    master_labor_sub1_sell_krw: 0,
    master_labor_sub2_sell_krw: 0,
    master_plating_sell_krw: 0,
    master_labor_base_cost_krw: 0,
    master_labor_center_cost_krw: 0,
    master_labor_sub1_cost_krw: 0,
    master_labor_sub2_cost_krw: 0,
    master_plating_cost_krw: 0,
    master_center_qty: 0,
    master_sub1_qty: 0,
    master_sub2_qty: 0,
    master_labor_sell_profile_krw: 0,
    master_labor_cost_profile_krw: 0,

    absorb_item_count: laborComponentRows.length,
    absorb_total_krw: toInt(sourceAbsorbApplied),
    absorb_base_labor_krw: 0,
    absorb_stone_labor_krw: 0,
    absorb_plating_krw: 0,
    absorb_etc_krw: 0,
    absorb_general_class_krw: 0,
    absorb_material_class_krw: 0,

    total_pre_margin_adj_krw: toInt(source.total_pre_margin_adj_krw),
    total_post_margin_adj_krw: toInt(source.total_post_margin_adj_krw),
    price_after_margin_krw: toInt(source.guardrail_price_krw ?? source.candidate_price_krw ?? source.final_target_price_v2_krw),

    base_adjust_krw: 0,
    delta_material_krw: deltaMaterial,
    delta_size_krw: deltaSize,
    delta_color_krw: deltaColor,
    delta_decor_krw: deltaDecor,
    delta_other_krw: deltaOther,
    delta_total_krw: deltaTotal,

    target_price_raw_krw: finalTarget,
    rounded_target_price_krw: finalTarget,
    override_price_krw: null,
    floor_price_krw: 0,
    final_target_before_floor_krw: finalTarget,
    floor_clamped: false,
    final_target_price_krw: finalTarget,

    tick_gold_krw_g: toInt(source.tick_gold_krw_g),
    tick_silver_krw_g: toInt(source.tick_silver_krw_g),
    compute_request_id: String(source.compute_request_id ?? ""),
    computed_at: String(source.computed_at ?? ""),

    pricing_algo_version: toTextOrNull(source.pricing_algo_version) ?? undefined,
    calc_version: toTextOrNull(source.calc_version),
    material_code_effective: toTextOrNull(source.material_code_effective),
    material_basis_resolved: toTextOrNull(source.material_basis_resolved),
    material_purity_rate_resolved: toNullableNumber(source.material_purity_rate_resolved),
    material_adjust_factor_resolved: toNullableNumber(source.material_adjust_factor_resolved),
    effective_tick_krw_g: toNullableNumber(source.effective_tick_krw_g),
    net_weight_g: toNullableNumber(source.net_weight_g),

    labor_cost_applied_krw: resolvedLaborCostApplied,
    labor_sell_total_plus_absorb_krw: resolvedLaborSellPlusAbsorb,
    absorb_total_krw_raw: sourceAbsorbRaw,
    absorb_total_krw_applied: sourceAbsorbApplied,

    fee_rate: null,
    min_margin_rate_total: null,
    cost_sum_krw: toNullableInt(source.cost_sum_krw),
    material_pre_fee_krw: toNullableInt(source.material_pre_fee_krw),
    labor_pre_fee_krw: toNullableInt(source.labor_pre_fee_krw),
    fixed_pre_fee_krw: toNullableInt(source.fixed_pre_fee_krw),
    candidate_pre_fee_krw: toNullableInt(source.candidate_pre_fee_krw),
    candidate_price_krw: toNullableInt(source.candidate_price_krw),
    min_margin_price_krw: toNullableInt(source.min_margin_price_krw),
    guardrail_price_krw: toNullableInt(source.guardrail_price_krw),
    guardrail_reason_code: toTextOrNull(source.guardrail_reason_code),
    final_target_price_v2_krw: finalTargetV2,
    current_channel_price_krw: toNullableInt(source.current_channel_price_krw),
    diff_krw: toNullableInt(source.diff_krw),
    diff_pct: toNullableNumber(source.diff_pct),

    labor_component_json: laborComponentJson,
    absorb_total_applied_krw: sourceAbsorbApplied,
    absorb_total_raw_krw: sourceAbsorbRaw,
  };

  const payload: PricingSnapshotExplainResponse = { data };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
