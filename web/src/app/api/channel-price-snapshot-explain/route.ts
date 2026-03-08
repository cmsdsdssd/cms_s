import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError } from "@/lib/shop/admin";
import { resolveCurrentProductSyncProfile, resolveEffectiveCurrentProductSyncProfile } from "@/lib/shop/current-product-sync-profile";
import { resolveCanonicalProductNo } from "@/lib/shop/canonical-mapping";
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

const isActiveInWindow = (from: unknown, to: unknown, nowMs: number): boolean => {
  const fromMs = from ? Date.parse(String(from)) : Number.NaN;
  const toMs = to ? Date.parse(String(to)) : Number.NaN;
  if (Number.isFinite(fromMs) && fromMs > nowMs) return false;
  if (Number.isFinite(toMs) && toMs < nowMs) return false;
  return true;
};

const uniqueTextList = (values: Array<unknown>): string[] => {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
};

const patchLaborComponent = (
  component: NonNullable<PricingSnapshotExplainRow["labor_component_json"]>[string] | null | undefined,
  patch: Partial<NonNullable<PricingSnapshotExplainRow["labor_component_json"]>[string]>,
) => ({
  labor_cost_krw: toInt(component?.labor_cost_krw),
  labor_absorb_applied_krw: toInt(component?.labor_absorb_applied_krw),
  labor_absorb_raw_krw: toInt(component?.labor_absorb_raw_krw),
  labor_cost_plus_absorb_krw: toInt(component?.labor_cost_plus_absorb_krw),
  labor_sell_krw: toInt(component?.labor_sell_krw),
  labor_sell_plus_absorb_krw: toInt(component?.labor_sell_plus_absorb_krw),
  labor_class: String(component?.labor_class ?? "GENERAL"),
  ...patch,
});

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

  const baseSelectColumns =
    "channel_id, master_item_id, channel_product_id, external_product_no, external_variant_code, compute_request_id, computed_at, pricing_algo_version, calc_version, material_code_effective, material_basis_resolved, material_purity_rate_resolved, material_adjust_factor_resolved, effective_tick_krw_g, net_weight_g, material_raw_krw, material_final_krw, labor_component_json, absorb_total_applied_krw, absorb_total_raw_krw, labor_cost_applied_krw_components, labor_sell_total_plus_absorb_krw_components, cost_sum_krw, material_pre_fee_krw, labor_pre_fee_krw, fixed_pre_fee_krw, candidate_pre_fee_krw, candidate_price_krw, min_margin_price_krw, guardrail_price_krw, guardrail_reason_code, final_target_price_v2_krw, current_channel_price_krw, diff_krw, diff_pct";
  const absorbPlatingSelectColumns = "absorb_plating_krw";
  let supportsAbsorbPlatingColumn = true;

  const fetchRows = async (args: {
    computeRequestId?: string;
    externalProductNos?: string[];
  }): Promise<Record<string, unknown>[]> => {
    const runQuery = async (selectColumns: string) => {
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
      return query;
    };

    const preferredSelect = supportsAbsorbPlatingColumn
      ? `${baseSelectColumns}, ${absorbPlatingSelectColumns}`
      : baseSelectColumns;
    let res = await runQuery(preferredSelect);
    if (res.error && supportsAbsorbPlatingColumn && isMissingColumnError(res.error, "v_price_composition_flat_v2.absorb_plating_krw")) {
      supportsAbsorbPlatingColumn = false;
      res = await runQuery(baseSelectColumns);
    }

    if (res.error) throw res.error;
    return ((res.data ?? []) as unknown[]).filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
  };

  let rows: Record<string, unknown>[] = [];
  let resolvedCanonicalProductNo = externalProductNo;
  let requestedProductNos: string[] = uniqueTextList([externalProductNo]);
  try {
    if (externalProductNo) {
      const activeMapRes = await sb
        .from("sales_channel_product")
        .select("external_product_no")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterItemId)
        .eq("is_active", true);
      if (activeMapRes.error) {
        return jsonError(activeMapRes.error.message ?? "Failed to read canonical product", 500);
      }
      const activeProductNos = uniqueTextList(
        (activeMapRes.data ?? []).map((row) => (row as { external_product_no?: string | null }).external_product_no ?? ""),
      );
      resolvedCanonicalProductNo = resolveCanonicalProductNo(activeProductNos, externalProductNo);
      requestedProductNos = uniqueTextList([externalProductNo, resolvedCanonicalProductNo]);
    }

    rows = await fetchRows({ computeRequestId, externalProductNos: requestedProductNos });
    if (rows.length === 0 && computeRequestId) {
      rows = await fetchRows({ externalProductNos: requestedProductNos });
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to read V2 snapshot view", 500);
  }

  let preferredVariantCodes: string[] = [];
  let currentStateRows: Array<{ external_variant_code?: string | null; exclude_plating_labor?: boolean | null }> = [];
  if (!channelProductId && requestedProductNos.length > 0) {
    const currentStatePickRes = await sb
      .from("channel_option_current_state_v1")
      .select("external_variant_code, exclude_plating_labor, updated_at")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .in("external_product_no", requestedProductNos)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (currentStatePickRes.error) {
      return jsonError(currentStatePickRes.error.message ?? "Failed to read current-state variant selection", 500);
    }
    currentStateRows = (currentStatePickRes.data ?? []) as Array<{ external_variant_code?: string | null; exclude_plating_labor?: boolean | null }>;
    preferredVariantCodes = uniqueTextList(
      currentStateRows.map((row) => row.external_variant_code ?? ""),
    );
  }

  const source = (() => {
    if (channelProductId) {
      const exactChannelProductRow = rows.find((row) => String(row.channel_product_id ?? "").trim() === channelProductId);
      if (exactChannelProductRow) return exactChannelProductRow;
    }
    for (const variantCode of preferredVariantCodes) {
      const variantRow = rows.find((row) => String(row.external_variant_code ?? "").trim() === variantCode);
      if (variantRow) return variantRow;
    }
    return rows.find((row) => String(row.external_variant_code ?? "").trim().length === 0)
      ?? rows[0]
      ?? null;
  })() as Record<string, unknown> | null;
  if (!source) return jsonError("No V2 snapshot row found in view", 404);

  const sourceVariantCode = String(source.external_variant_code ?? "").trim();
  const excludePlatingLabor = (() => {
    if (sourceVariantCode) {
      const matched = currentStateRows.find((row) => String(row.external_variant_code ?? "").trim() === sourceVariantCode);
      if (matched) return matched.exclude_plating_labor === true;
    }
    return currentStateRows.length > 0 && currentStateRows.every((row) => row.exclude_plating_labor === true);
  })();

  const nowMs = Date.now();
  const [overrideRes, floorRes, masterPlatingRes] = await Promise.all([
    sb
      .from("pricing_override")
      .select("override_id, override_price_krw, valid_from, valid_to, is_active, updated_at")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(10),
    sb
      .from("product_price_guard_v2")
      .select("guard_id, floor_price_krw, effective_from, effective_to, is_active, updated_at")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(10),
    sb
      .from("cms_master_item")
      .select("plating_price_sell_default, plating_price_cost_default")
      .eq("master_item_id", masterItemId)
      .maybeSingle(),
  ]);
  if (overrideRes.error) return jsonError(overrideRes.error.message ?? "Failed to read pricing override", 500);
  if (floorRes.error) return jsonError(floorRes.error.message ?? "Failed to read product price guard", 500);
  if (masterPlatingRes.error) return jsonError(masterPlatingRes.error.message ?? "Failed to read master plating pricing", 500);

  const activeOverrideRow = ((overrideRes.data ?? []) as Record<string, unknown>[]).find((row) =>
    isActiveInWindow(row.valid_from, row.valid_to, nowMs),
  ) ?? null;
  const activeFloorRow = ((floorRes.data ?? []) as Record<string, unknown>[]).find((row) =>
    isActiveInWindow(row.effective_from, row.effective_to, nowMs),
  ) ?? null;

  const masterPlatingRow = (masterPlatingRes.data ?? null) as { plating_price_sell_default?: unknown; plating_price_cost_default?: unknown } | null;

  const currentProductSyncProfileRes = await sb
    .from('sales_channel_product')
    .select('current_product_sync_profile')
    .eq('channel_id', channelId)
    .eq('master_item_id', masterItemId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  if (currentProductSyncProfileRes.error && !isMissingColumnError(currentProductSyncProfileRes.error, 'sales_channel_product.current_product_sync_profile')) {
    return jsonError(currentProductSyncProfileRes.error.message ?? "Failed to read current product sync profile", 500);
  }
  const currentProductSyncProfileRows = (currentProductSyncProfileRes.error
    ? []
    : (currentProductSyncProfileRes.data ?? [])) as Array<{ current_product_sync_profile?: string | null }>;

  const buildChannelPolicyQuery = (includeThresholdProfile: boolean) => sb
    .from('pricing_policy')
    .select(includeThresholdProfile ? 'auto_sync_threshold_profile, updated_at' : 'updated_at')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let channelPolicyRes = await buildChannelPolicyQuery(true);
  if (channelPolicyRes.error && isMissingColumnError(channelPolicyRes.error, 'pricing_policy.auto_sync_threshold_profile')) {
    channelPolicyRes = await buildChannelPolicyQuery(false);
  }
  if (channelPolicyRes.error) return jsonError(channelPolicyRes.error.message ?? "Failed to read pricing policy", 500);
  const channelPolicyRow = (channelPolicyRes.data ?? null) as { auto_sync_threshold_profile?: string | null } | null;

  const currentProductSyncProfile = resolveEffectiveCurrentProductSyncProfile({
    channelProfile: channelPolicyRow?.auto_sync_threshold_profile,
    currentProductProfile: resolveCurrentProductSyncProfile(
      currentProductSyncProfileRows,
    ),
  });

  const sourceLaborCostApplied = toNullableInt(source.labor_cost_applied_krw_components);
  const sourceLaborSellPlusAbsorb = toNullableInt(source.labor_sell_total_plus_absorb_krw_components);
  const sourceAbsorbApplied = toNullableInt(source.absorb_total_applied_krw);
  const sourceAbsorbRaw = toNullableInt(source.absorb_total_raw_krw);

  let snapshotFallback: {
    snapshot_id: string | null;
    labor_cost_applied_krw: number | null;
    labor_sell_total_plus_absorb_krw: number | null;
  } | null = null;

  const fallbackQuery = sb
    .from("pricing_snapshot")
    .select("snapshot_id, labor_cost_applied_krw, labor_sell_total_plus_absorb_krw")
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
      snapshot_id: String(fallback.snapshot_id ?? "").trim() || null,
      labor_cost_applied_krw: toNullableInt(fallback.labor_cost_applied_krw),
      labor_sell_total_plus_absorb_krw: toNullableInt(fallback.labor_sell_total_plus_absorb_krw),
    };
  }

  const resolvedLaborCostApplied = sourceLaborCostApplied ?? snapshotFallback?.labor_cost_applied_krw ?? null;
  const resolvedLaborSellPlusAbsorb = sourceLaborSellPlusAbsorb ?? snapshotFallback?.labor_sell_total_plus_absorb_krw ?? null;
  let v2LaborComponentJson: PricingSnapshotExplainRow["labor_component_json"] | null = null;

  if (snapshotFallback?.snapshot_id) {
    const v2LaborComponentRes = await sb
      .from("pricing_snapshot_labor_component_v2")
      .select("component_key, labor_class, labor_cost_krw, labor_absorb_applied_krw, labor_absorb_raw_krw, labor_cost_plus_absorb_krw, labor_sell_krw, labor_sell_plus_absorb_krw")
      .eq("snapshot_id", snapshotFallback.snapshot_id);
    if (v2LaborComponentRes.error) return jsonError(v2LaborComponentRes.error.message ?? "Failed to read V2 labor components", 500);
    const v2LaborComponentRows = (v2LaborComponentRes.data ?? []) as Array<Record<string, unknown>>;
    if (v2LaborComponentRows.length > 0) {
      v2LaborComponentJson = v2LaborComponentRows.reduce<NonNullable<PricingSnapshotExplainRow["labor_component_json"]>>((acc, row) => {
        const componentKey = String(row.component_key ?? "").trim();
        if (!componentKey) return acc;
        acc[componentKey] = {
          labor_cost_krw: toInt(row.labor_cost_krw),
          labor_absorb_applied_krw: toInt(row.labor_absorb_applied_krw),
          labor_absorb_raw_krw: toInt(row.labor_absorb_raw_krw),
          labor_cost_plus_absorb_krw: toInt(row.labor_cost_plus_absorb_krw),
          labor_sell_krw: toInt(row.labor_sell_krw),
          labor_sell_plus_absorb_krw: toInt(row.labor_sell_plus_absorb_krw),
          labor_class: String(row.labor_class ?? "GENERAL"),
        };
        return acc;
      }, {});
    }
  }

const laborComponentJson = (() => {
  const totalCostApplied = Math.max(0, Math.round(Number(resolvedLaborCostApplied ?? 0)));
  const absorbApplied = Math.max(0, Math.round(Number(sourceAbsorbApplied ?? 0)));
  const absorbRaw = Math.max(0, Math.round(Number(sourceAbsorbRaw ?? absorbApplied)));
  const sellPlusAbsorb = Math.max(0, Math.round(Number(resolvedLaborSellPlusAbsorb ?? totalCostApplied)));
  const platingCost = excludePlatingLabor ? 0 : Math.max(0, toInt(masterPlatingRow?.plating_price_cost_default));
  const platingSell = excludePlatingLabor ? 0 : Math.max(0, toInt(masterPlatingRow?.plating_price_sell_default));
  const platingAbsorbApplied = Math.max(0, toInt(source.absorb_plating_krw));
  const platingAbsorbRaw = Math.min(absorbRaw, platingAbsorbApplied);
  const platingCostPlusAbsorb = platingCost + platingAbsorbApplied;
  const platingSellPlusAbsorb = platingSell + platingAbsorbApplied;
  const baseCost = Math.max(0, totalCostApplied - platingCost);
  const baseAbsorbApplied = Math.max(0, absorbApplied - platingAbsorbApplied);
  const baseAbsorbRaw = Math.max(0, absorbRaw - platingAbsorbRaw);
  const baseCostPlusAbsorb = Math.max(0, baseCost + baseAbsorbApplied);
  const baseSellPlusAbsorb = Math.max(0, sellPlusAbsorb - platingSellPlusAbsorb);
  if (v2LaborComponentJson && Object.keys(v2LaborComponentJson).length > 0) return v2LaborComponentJson;

  const existing = (source.labor_component_json ?? null) as PricingSnapshotExplainRow["labor_component_json"];

  if (existing && Object.keys(existing).length > 0) {
    const existingPlating = existing.PLATING ?? null;
    const existingBase = existing.BASE_LABOR ?? null;
    const shouldBackfillPlating = (
      platingCost > 0 || platingSell > 0 || platingAbsorbApplied > 0
    )
      && toInt(existingPlating?.labor_cost_krw) === 0
      && toInt(existingPlating?.labor_sell_krw) === 0
      && toInt(existingPlating?.labor_absorb_applied_krw) === 0;
    if (!shouldBackfillPlating) return existing;

    return {
      ...existing,
      BASE_LABOR: patchLaborComponent(existingBase, {
        labor_cost_krw: Math.max(0, toInt(existingBase?.labor_cost_krw) - platingCost),
        labor_absorb_applied_krw: Math.max(0, toInt(existingBase?.labor_absorb_applied_krw) - platingAbsorbApplied),
        labor_absorb_raw_krw: Math.max(0, toInt(existingBase?.labor_absorb_raw_krw) - platingAbsorbRaw),
        labor_cost_plus_absorb_krw: Math.max(0, toInt(existingBase?.labor_cost_plus_absorb_krw) - platingCostPlusAbsorb),
        labor_sell_krw: Math.max(0, toInt(existingBase?.labor_sell_krw) - platingSell),
        labor_sell_plus_absorb_krw: Math.max(0, toInt(existingBase?.labor_sell_plus_absorb_krw) - platingSellPlusAbsorb),
      }),
      PLATING: patchLaborComponent(existingPlating, {
        labor_cost_krw: platingCost,
        labor_absorb_applied_krw: platingAbsorbApplied,
        labor_absorb_raw_krw: platingAbsorbRaw,
        labor_cost_plus_absorb_krw: platingCostPlusAbsorb,
        labor_sell_krw: platingSell,
        labor_sell_plus_absorb_krw: platingSellPlusAbsorb,
      }),
    };
  }
  if (resolvedLaborCostApplied == null && resolvedLaborSellPlusAbsorb == null) return null;

  return {
    BASE_LABOR: {
      labor_cost_krw: baseCost,
      labor_absorb_applied_krw: baseAbsorbApplied,
      labor_absorb_raw_krw: baseAbsorbRaw,
      labor_cost_plus_absorb_krw: baseCostPlusAbsorb,
      labor_sell_krw: baseSellPlusAbsorb,
      labor_sell_plus_absorb_krw: baseSellPlusAbsorb,
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
      labor_cost_krw: platingCost,
      labor_absorb_applied_krw: platingAbsorbApplied,
      labor_absorb_raw_krw: platingAbsorbRaw,
      labor_cost_plus_absorb_krw: platingCostPlusAbsorb,
      labor_sell_krw: platingSell,
      labor_sell_plus_absorb_krw: platingSellPlusAbsorb,
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
  const overridePrice = toNullableInt(activeOverrideRow?.override_price_krw);
  const floorPrice = Math.max(0, toInt(activeFloorRow?.floor_price_krw));
  const finalTargetBeforeFloor = overridePrice ?? finalTarget;
  const floorClamped = finalTargetBeforeFloor < floorPrice;
  const finalTargetWithOverrideAndFloor = floorClamped ? floorPrice : finalTargetBeforeFloor;

  const data: PricingSnapshotExplainRow = {
    channel_id: String(source.channel_id ?? channelId),
    master_item_id: String(source.master_item_id ?? masterItemId),
    channel_product_id: String(source.channel_product_id ?? ""),
    external_variant_code: toTextOrNull(source.external_variant_code),
    current_product_sync_profile: currentProductSyncProfile,

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
    master_plating_sell_krw: Math.max(0, toInt(masterPlatingRow?.plating_price_sell_default)),
    master_labor_base_cost_krw: 0,
    master_labor_center_cost_krw: 0,
    master_labor_sub1_cost_krw: 0,
    master_labor_sub2_cost_krw: 0,
    master_plating_cost_krw: Math.max(0, toInt(masterPlatingRow?.plating_price_cost_default)),
    master_center_qty: 0,
    master_sub1_qty: 0,
    master_sub2_qty: 0,
    master_labor_sell_profile_krw: 0,
    master_labor_cost_profile_krw: 0,

    absorb_item_count: laborComponentRows.length,
    absorb_total_krw: toInt(sourceAbsorbApplied),
    absorb_base_labor_krw: 0,
    absorb_stone_labor_krw: 0,
    absorb_plating_krw: toInt(source.absorb_plating_krw),
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
    override_price_krw: overridePrice,
    floor_price_krw: floorPrice,
    final_target_before_floor_krw: finalTargetBeforeFloor,
    floor_clamped: floorClamped,
    final_target_price_krw: finalTargetWithOverrideAndFloor,

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
