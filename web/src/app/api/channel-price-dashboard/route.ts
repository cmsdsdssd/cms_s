import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  external_variant_code: string | null;
  category_code: string | null;
  material_code: string | null;
  option_price_delta_krw: number | null;
  net_weight_g: number | null;
  as_of_at: string | null;
  tick_gold_krw_g: number | null;
  tick_silver_krw_g: number | null;
  factor_set_id_used: string | null;
  material_factor_multiplier_used: number | null;
  material_raw_krw: number | null;
  material_final_krw: number | null;
  labor_raw_krw: number | null;
  labor_pre_margin_adj_krw: number | null;
  labor_post_margin_adj_krw: number | null;
  margin_multiplier_used: number | null;
  rounding_unit_used: number | null;
  rounding_mode_used: "CEIL" | "ROUND" | "FLOOR" | null;
  final_target_price_krw: number | null;
  current_channel_price_krw: number | null;
  diff_krw: number | null;
  diff_pct: number | null;
  price_state: "OK" | "OUT_OF_SYNC" | "ERROR" | "UNMAPPED";
  active_adjustment_count: number;
  active_override_id: string | null;
  computed_at: string | null;
  channel_price_fetched_at: string | null;
  fetch_status: string | null;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
  current_product_sync_profile: 'GENERAL' | 'MARKET_LINKED' | null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  option_price_delta_krw: number | null;
  current_product_sync_profile: 'GENERAL' | 'MARKET_LINKED' | null;
};

type V2Row = {
  channel_id: string | null;
  channel_product_id: string | null;
  external_product_no: string | null;
  external_variant_code: string | null;
  master_item_id: string | null;
  compute_request_id: string | null;
  computed_at: string | null;
  material_code_effective: string | null;
  net_weight_g: number | null;
  material_raw_krw: number | null;
  material_final_krw: number | null;
  labor_cost_applied_krw_components: number | null;
  labor_sell_total_plus_absorb_krw_components: number | null;
  final_target_price_v2_krw: number | null;
  current_channel_price_krw: number | null;
  diff_krw: number | null;
  diff_pct: number | null;
};

type MasterMetaRow = {
  master_item_id: string | null;
  model_name: string | null;
  category_code: string | null;
  material_code_default: string | null;
};

type ActiveOverrideRow = {
  override_id: string;
  channel_id: string;
  master_item_id: string;
};

type ActiveAdjustmentRow = {
  adjustment_id: string;
  channel_id: string;
  channel_product_id: string | null;
  master_item_id: string | null;
};

type CurrentPriceRow = {
  external_product_no: string | null;
  external_variant_code: string | null;
  current_price_krw: number | null;
  fetched_at: string | null;
  fetch_status: string | null;
  http_status: number | null;
  error_code: string | null;
  error_message: string | null;
};

const toKeyPart = (value: string | null | undefined) => String(value ?? '').trim();
const normalizeCurrentProductSyncProfile = (value: unknown): 'GENERAL' | 'MARKET_LINKED' => {
  return String(value == null ? 'GENERAL' : value).trim().toUpperCase() === 'MARKET_LINKED' ? 'MARKET_LINKED' : 'GENERAL';
};

const toExternalKey = (externalProductNo: string | null | undefined, externalVariantCode: string | null | undefined) => {
  return `${toKeyPart(externalProductNo)}::${toKeyPart(externalVariantCode)}`;
};

const isFetchFailure = (fetchStatus: string | null | undefined) => {
  if (!fetchStatus) return false;
  const normalized = fetchStatus.trim().toUpperCase();
  if (!normalized) return false;
  return !["SUCCESS", "SUCCEEDED", "OK"].includes(normalized);
};

const derivePriceState = (
  currentPrice: number | null,
  finalTargetPrice: number | null,
  fetchStatus: string | null,
): DashboardRow["price_state"] => {
  if (isFetchFailure(fetchStatus)) return "ERROR";
  if (currentPrice == null || finalTargetPrice == null) return "ERROR";
  return Math.abs(finalTargetPrice - currentPrice) >= 1 ? "OUT_OF_SYNC" : "OK";
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const computeRequestId = (searchParams.get("compute_request_id") ?? "").trim();
  const priceState = (searchParams.get("price_state") ?? "").trim();
  const modelName = (searchParams.get("model_name") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();
  const onlyOverrides = searchParams.get("only_overrides") === "true";
  const onlyAdjustments = searchParams.get("only_adjustments") === "true";
  const includeUnmapped = searchParams.get("include_unmapped") !== "false";
  const limitRaw = Number(searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;

  const mappingSelectBase = "channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, option_price_delta_krw";
  const runMappingQuery = (includeCurrentProductSyncProfile: boolean) => {
    let query = sb
      .from("sales_channel_product")
      .select(includeCurrentProductSyncProfile ? `${mappingSelectBase}, current_product_sync_profile` : mappingSelectBase)
      .eq("channel_id", channelId)
      .eq("is_active", true);
    if (masterItemId) query = query.eq("master_item_id", masterItemId);
    return query;
  };

  let mappingRes = await runMappingQuery(true);
  if (mappingRes.error && isMissingColumnError(mappingRes.error, "sales_channel_product.current_product_sync_profile")) {
    mappingRes = await runMappingQuery(false);
  }
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "활성 매핑 조회 실패", 500);

  const mappings = ((mappingRes.data ?? []) as Array<Partial<MappingRow>>).map((row) => ({
    channel_product_id: String(row.channel_product_id ?? "").trim(),
    channel_id: String(row.channel_id ?? "").trim(),
    master_item_id: String(row.master_item_id ?? "").trim(),
    external_product_no: String(row.external_product_no ?? "").trim(),
    external_variant_code: typeof row.external_variant_code === "string" ? row.external_variant_code : null,
    option_price_delta_krw: row.option_price_delta_krw == null ? null : Number(row.option_price_delta_krw),
    current_product_sync_profile:
      row.current_product_sync_profile === "GENERAL" || row.current_product_sync_profile === "MARKET_LINKED"
        ? row.current_product_sync_profile
        : null,
  })) as MappingRow[];
  const channelProductIds = Array.from(new Set(mappings.map((row) => toKeyPart(row.channel_product_id)).filter(Boolean)));
  const masterIds = Array.from(new Set(mappings.map((row) => toKeyPart(row.master_item_id)).filter(Boolean)));

  const v2RowsRes = channelProductIds.length > 0
    ? await sb
      .from("v_price_composition_flat_v2")
      .select("channel_id, channel_product_id, external_product_no, external_variant_code, master_item_id, compute_request_id, computed_at, material_code_effective, net_weight_g, material_raw_krw, material_final_krw, labor_cost_applied_krw_components, labor_sell_total_plus_absorb_krw_components, final_target_price_v2_krw, current_channel_price_krw, diff_krw, diff_pct")
      .eq("channel_id", channelId)
      .in("channel_product_id", channelProductIds)
      .order("computed_at", { ascending: false })
    : { data: [], error: null };
  if (v2RowsRes.error) return jsonError(v2RowsRes.error.message ?? "대시보드 조회 실패", 500);

  const sourceRows = (v2RowsRes.data ?? []) as V2Row[];

  const masterMetaRes = masterIds.length > 0
    ? await sb
      .from("cms_master_item")
      .select("master_item_id, model_name, category_code, material_code_default")
      .in("master_item_id", masterIds)
    : { data: [], error: null };
  if (masterMetaRes.error) return jsonError(masterMetaRes.error.message ?? "마스터 메타 조회 실패", 500);

  const activeOverrideRes = masterIds.length > 0
    ? await sb
      .from("pricing_override")
      .select("override_id, channel_id, master_item_id")
      .eq("is_active", true)
      .eq("channel_id", channelId)
      .in("master_item_id", masterIds)
    : { data: [], error: null };
  if (activeOverrideRes.error) return jsonError(activeOverrideRes.error.message ?? "활성 오버라이드 조회 실패", 500);

  const activeAdjustmentRes = await sb
    .from("pricing_adjustment")
    .select("adjustment_id, channel_id, channel_product_id, master_item_id")
    .eq("is_active", true)
    .eq("channel_id", channelId);
  if (activeAdjustmentRes.error) return jsonError(activeAdjustmentRes.error.message ?? "활성 조정 조회 실패", 500);

  const currentPriceRes = await sb
    .from("channel_price_snapshot_latest")
    .select("external_product_no, external_variant_code, current_price_krw, fetched_at, fetch_status, http_status, error_code, error_message")
    .eq("channel_id", channelId);
  if (currentPriceRes.error) return jsonError(currentPriceRes.error.message ?? "현재 채널가 조회 실패", 500);

  const latestV2ByProduct = new Map<string, V2Row>();
  const pinnedV2ByProduct = new Map<string, V2Row>();
  for (const row of sourceRows) {
    const productKey = toKeyPart(row.channel_product_id);
    if (!productKey) continue;
    if (!latestV2ByProduct.has(productKey)) latestV2ByProduct.set(productKey, row);
    if (computeRequestId && toKeyPart(row.compute_request_id) === computeRequestId && !pinnedV2ByProduct.has(productKey)) {
      pinnedV2ByProduct.set(productKey, row);
    }
  }

  const currentPriceByExternal = new Map<string, CurrentPriceRow>();
  for (const row of (currentPriceRes.data ?? []) as CurrentPriceRow[]) {
    const key = toExternalKey(row.external_product_no, row.external_variant_code);
    if (!toKeyPart(row.external_product_no)) continue;
    if (!currentPriceByExternal.has(key)) currentPriceByExternal.set(key, row);
  }

  const masterMetaById = new Map(
    ((masterMetaRes.data ?? []) as MasterMetaRow[]).map((row) => [toKeyPart(row.master_item_id), row]),
  );

  const activeOverrideIdByChannelMaster = new Map<string, string>();
  for (const row of (activeOverrideRes.data ?? []) as ActiveOverrideRow[]) {
    const key = `${toKeyPart(row.channel_id)}::${toKeyPart(row.master_item_id)}`;
    if (!activeOverrideIdByChannelMaster.has(key)) activeOverrideIdByChannelMaster.set(key, row.override_id);
  }

  const channelProductSet = new Set(channelProductIds);
  const masterSet = new Set(masterIds);
  const adjustmentCountByProduct = new Map<string, number>();
  const adjustmentCountByMaster = new Map<string, number>();
  const adjustmentCountByBoth = new Map<string, number>();
  for (const row of (activeAdjustmentRes.data ?? []) as ActiveAdjustmentRow[]) {
    const channelKey = toKeyPart(row.channel_id);
    const productKey = toKeyPart(row.channel_product_id);
    const masterKey = toKeyPart(row.master_item_id);

    if (productKey && channelProductSet.has(productKey)) {
      const key = `${channelKey}::${productKey}`;
      adjustmentCountByProduct.set(key, (adjustmentCountByProduct.get(key) ?? 0) + 1);
    }

    if (masterKey && masterSet.has(masterKey)) {
      const key = `${channelKey}::${masterKey}`;
      adjustmentCountByMaster.set(key, (adjustmentCountByMaster.get(key) ?? 0) + 1);
    }

    if (productKey && masterKey && channelProductSet.has(productKey) && masterSet.has(masterKey)) {
      const key = `${channelKey}::${productKey}::${masterKey}`;
      adjustmentCountByBoth.set(key, (adjustmentCountByBoth.get(key) ?? 0) + 1);
    }
  }

  let mappedRows: DashboardRow[] = mappings.map((mapping) => {
    const normalizedChannelId = toKeyPart(mapping.channel_id);
    const normalizedMasterId = toKeyPart(mapping.master_item_id);
    const normalizedChannelProductId = toKeyPart(mapping.channel_product_id);
    const sourceRow = (computeRequestId ? pinnedV2ByProduct.get(normalizedChannelProductId) : null)
      ?? latestV2ByProduct.get(normalizedChannelProductId)
      ?? null;
    const masterMeta = masterMetaById.get(normalizedMasterId) ?? null;
    const finalTarget = sourceRow?.final_target_price_v2_krw ?? null;

    const externalProductNo = toKeyPart(mapping.external_product_no) || toKeyPart(sourceRow?.external_product_no) || "-";
    const externalVariantCode = toKeyPart(mapping.external_variant_code) || toKeyPart(sourceRow?.external_variant_code) || null;
    const fallbackCurrentPrice = currentPriceByExternal.get(toExternalKey(externalProductNo, externalVariantCode));
    const currentPrice = sourceRow?.current_channel_price_krw ?? fallbackCurrentPrice?.current_price_krw ?? null;
    const fetchStatus = fallbackCurrentPrice?.fetch_status ?? null;

    const productAdjustmentCount = adjustmentCountByProduct.get(`${normalizedChannelId}::${normalizedChannelProductId}`) ?? 0;
    const masterAdjustmentCount = adjustmentCountByMaster.get(`${normalizedChannelId}::${normalizedMasterId}`) ?? 0;
    const bothAdjustmentCount = adjustmentCountByBoth.get(`${normalizedChannelId}::${normalizedChannelProductId}::${normalizedMasterId}`) ?? 0;
    const activeAdjustmentCount = Math.max(0, productAdjustmentCount + masterAdjustmentCount - bothAdjustmentCount);

    return {
      channel_id: normalizedChannelId,
      channel_product_id: normalizedChannelProductId,
      master_item_id: normalizedMasterId,
      model_name: masterMeta?.model_name ?? null,
      external_product_no: externalProductNo,
      external_variant_code: externalVariantCode,
      category_code: masterMeta?.category_code ?? null,
      option_price_delta_krw: mapping.option_price_delta_krw,
      current_product_sync_profile: normalizeCurrentProductSyncProfile(mapping.current_product_sync_profile),
      material_code: toKeyPart(sourceRow?.material_code_effective) || (masterMeta?.material_code_default ?? null),
      net_weight_g: sourceRow?.net_weight_g ?? null,
      as_of_at: null,
      tick_gold_krw_g: null,
      tick_silver_krw_g: null,
      factor_set_id_used: null,
      material_factor_multiplier_used: null,
      material_raw_krw: sourceRow?.material_raw_krw ?? null,
      material_final_krw: sourceRow?.material_final_krw ?? null,
      labor_raw_krw: sourceRow?.labor_cost_applied_krw_components ?? null,
      labor_pre_margin_adj_krw: sourceRow?.labor_cost_applied_krw_components ?? null,
      labor_post_margin_adj_krw: sourceRow?.labor_sell_total_plus_absorb_krw_components ?? null,
      margin_multiplier_used: null,
      rounding_unit_used: null,
      rounding_mode_used: null,
      final_target_price_krw: finalTarget,
      current_channel_price_krw: currentPrice,
      diff_krw: finalTarget != null && currentPrice != null ? finalTarget - currentPrice : null,
      diff_pct:
        finalTarget != null && currentPrice != null && currentPrice !== 0
          ? ((finalTarget - currentPrice) / currentPrice) * 100
          : null,
      price_state: derivePriceState(currentPrice, finalTarget, fetchStatus),
      active_adjustment_count: activeAdjustmentCount,
      active_override_id: activeOverrideIdByChannelMaster.get(`${normalizedChannelId}::${normalizedMasterId}`) ?? null,
      computed_at: sourceRow?.computed_at ?? null,
      channel_price_fetched_at: fallbackCurrentPrice?.fetched_at ?? null,
      fetch_status: fallbackCurrentPrice?.fetch_status ?? null,
      http_status: fallbackCurrentPrice?.http_status ?? null,
      error_code: fallbackCurrentPrice?.error_code ?? null,
      error_message: fallbackCurrentPrice?.error_message ?? null,
    };
  });

  if (modelName) {
    const needle = modelName.toLowerCase();
    mappedRows = mappedRows.filter((row) => String(row.model_name ?? "").toLowerCase().includes(needle));
  }

  if (onlyOverrides) mappedRows = mappedRows.filter((row) => row.active_override_id != null);
  if (onlyAdjustments) mappedRows = mappedRows.filter((row) => row.active_adjustment_count > 0);
  if (priceState && priceState !== "UNMAPPED") mappedRows = mappedRows.filter((row) => row.price_state === priceState);
  mappedRows = mappedRows.slice(0, limit);

  if (!includeUnmapped || onlyOverrides || onlyAdjustments) {
    return NextResponse.json({ data: mappedRows }, { headers: { "Cache-Control": "no-store" } });
  }

  if (priceState && priceState !== "UNMAPPED") {
    return NextResponse.json({ data: mappedRows }, { headers: { "Cache-Control": "no-store" } });
  }

  const mappedMasterRes = await sb
    .from("sales_channel_product")
    .select("master_item_id")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (mappedMasterRes.error) {
    return jsonError(mappedMasterRes.error.message ?? "매핑 마스터 조회 실패", 500);
  }

  const mappedMasterSet = new Set(
    (mappedMasterRes.data ?? [])
      .map((r) => String((r as { master_item_id?: string | null }).master_item_id ?? "").trim())
      .filter((v) => v.length > 0),
  );

  const remainingLimit = priceState === "UNMAPPED" ? limit : Math.max(0, limit - mappedRows.length);
  if (remainingLimit === 0 && priceState !== "UNMAPPED") {
    return NextResponse.json({ data: mappedRows }, { headers: { "Cache-Control": "no-store" } });
  }

  let masterQuery = sb
    .from("cms_master_item")
    .select("master_item_id, model_name, category_code, material_code_default, weight_default_g, deduction_weight_default_g")
    .order("model_name", { ascending: true })
    .limit(Math.max(remainingLimit * 3, 200));

  if (modelName) masterQuery = masterQuery.ilike("model_name", `%${modelName}%`);

  const masterRes = await masterQuery;
  if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 조회 실패", 500);

  const unmappedRows: DashboardRow[] = (masterRes.data ?? [])
    .filter((r) => !mappedMasterSet.has(String((r as { master_item_id?: string | null }).master_item_id ?? "")))
    .slice(0, remainingLimit)
    .map((r) => {
      const unmappedMasterItemId = String((r as { master_item_id?: string | null }).master_item_id ?? "");
      return {
        channel_id: channelId,
        channel_product_id: unmappedMasterItemId,
        master_item_id: unmappedMasterItemId,
        model_name: (r as { model_name?: string | null }).model_name ?? null,
        external_product_no: "-",
        external_variant_code: null,
        category_code: (r as { category_code?: string | null }).category_code ?? null,
        option_price_delta_krw: null,
        material_code: (r as { material_code_default?: string | null }).material_code_default ?? null,
        net_weight_g: Math.max(
          Number((r as { weight_default_g?: number | null }).weight_default_g ?? 0)
            - Number((r as { deduction_weight_default_g?: number | null }).deduction_weight_default_g ?? 0),
          0,
        ),
        as_of_at: null,
        tick_gold_krw_g: null,
        tick_silver_krw_g: null,
        factor_set_id_used: null,
        material_factor_multiplier_used: null,
        material_raw_krw: null,
        material_final_krw: null,
        labor_raw_krw: null,
        labor_pre_margin_adj_krw: null,
        labor_post_margin_adj_krw: null,
        margin_multiplier_used: null,
        rounding_unit_used: null,
        rounding_mode_used: null,
        final_target_price_krw: null,
        current_channel_price_krw: null,
        diff_krw: null,
        diff_pct: null,
        price_state: "UNMAPPED",
        active_adjustment_count: 0,
        active_override_id: null,
        computed_at: null,
        channel_price_fetched_at: null,
        fetch_status: null,
        http_status: null,
        error_code: null,
        error_message: null,
        current_product_sync_profile: null,
      };
    });

  const mergedRows = priceState === "UNMAPPED" ? unmappedRows : [...mappedRows, ...unmappedRows];

  return NextResponse.json({ data: mergedRows }, { headers: { "Cache-Control": "no-store" } });
}
