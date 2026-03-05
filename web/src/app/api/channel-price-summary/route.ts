import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActivePolicyRow = {
  policy_id: string;
  margin_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
  material_factor_set_id: string | null;
};

type FactorSetRow = {
  factor_set_id: string;
  scope: "GLOBAL" | "CHANNEL";
  name: string;
};

type LatestV2Row = {
  channel_id: string | null;
  channel_product_id: string | null;
  external_product_no: string | null;
  external_variant_code: string | null;
  master_item_id: string | null;
  computed_at: string | null;
  current_channel_price_krw: number | null;
  final_target_price_v2_krw: number | null;
};

type MappingRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
};

type CurrentPriceRow = {
  external_product_no: string | null;
  external_variant_code: string | null;
  current_price_krw: number | null;
  fetch_status: string | null;
};

type LatestSnapshotRow = {
  computed_at: string | null;
  tick_gold_krw_g: number | null;
  tick_silver_krw_g: number | null;
};

type ActiveOverrideRow = {
  channel_id: string;
  master_item_id: string;
};

type ActiveAdjustmentRow = {
  channel_id: string;
  channel_product_id: string | null;
  master_item_id: string | null;
};

function toKeyPart(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function toExternalKey(externalProductNo: string | null | undefined, externalVariantCode: string | null | undefined) {
  return `${toKeyPart(externalProductNo)}::${toKeyPart(externalVariantCode)}`;
}

function isFetchFailure(fetchStatus: string | null | undefined) {
  if (!fetchStatus) return false;
  const normalized = fetchStatus.trim().toUpperCase();
  if (!normalized) return false;
  return !["SUCCESS", "SUCCEEDED", "OK"].includes(normalized);
}

function derivePriceState(
  currentPrice: number | null,
  finalTargetPrice: number | null,
  fetchStatus: string | null,
): "OK" | "OUT_OF_SYNC" | "ERROR" {
  if (isFetchFailure(fetchStatus)) return "ERROR";
  if (currentPrice == null || finalTargetPrice == null) return "ERROR";
  return Math.abs(finalTargetPrice - currentPrice) >= 1 ? "OUT_OF_SYNC" : "OK";
}

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  if (!channelId) return jsonError("channel_id is required", 400);

  const mappingRes = await sb
    .from("sales_channel_product")
    .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "활성 매핑 조회 실패", 500);

  const mappings = (mappingRes.data ?? []) as MappingRow[];
  const channelProductIds = Array.from(new Set(mappings.map((row) => toKeyPart(row.channel_product_id)).filter(Boolean)));
  const masterIds = Array.from(new Set(mappings.map((row) => toKeyPart(row.master_item_id)).filter(Boolean)));

  const [
    latestV2RowsRes,
    currentPriceRes,
    latestSnapshotRes,
    latestPushRes,
    activeOverrideRes,
    activeAdjustmentRes,
    activePolicyRes,
    globalDefaultRes,
  ] = await Promise.all([
    channelProductIds.length > 0
      ? sb
          .from("v_price_composition_flat_v2")
          .select("channel_id, channel_product_id, external_product_no, external_variant_code, master_item_id, computed_at, current_channel_price_krw, final_target_price_v2_krw")
          .eq("channel_id", channelId)
          .in("channel_product_id", channelProductIds)
          .order("computed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("channel_price_snapshot_latest")
      .select("external_product_no, external_variant_code, current_price_krw, fetch_status")
      .eq("channel_id", channelId),
    sb
      .from("pricing_snapshot")
      .select("computed_at,tick_gold_krw_g,tick_silver_krw_g")
      .eq("channel_id", channelId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle<LatestSnapshotRow>(),
    sb
      .from("price_sync_job")
      .select("finished_at,started_at")
      .eq("channel_id", channelId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ finished_at: string | null; started_at: string | null }>(),
    masterIds.length > 0
      ? sb
          .from("pricing_override")
          .select("channel_id, master_item_id")
          .eq("channel_id", channelId)
          .eq("is_active", true)
          .in("master_item_id", masterIds)
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("pricing_adjustment")
      .select("channel_id, channel_product_id, master_item_id")
      .eq("channel_id", channelId)
      .eq("is_active", true),
    sb
      .from("pricing_policy")
      .select("policy_id,margin_multiplier,rounding_unit,rounding_mode,material_factor_set_id")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<ActivePolicyRow>(),
    sb
      .from("material_factor_set")
      .select("factor_set_id,scope,name")
      .eq("scope", "GLOBAL")
      .eq("is_global_default", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<FactorSetRow>(),
  ]);

  if (latestV2RowsRes.error) return jsonError(latestV2RowsRes.error.message ?? "요약 대상 조회 실패", 500);
  if (currentPriceRes.error) return jsonError(currentPriceRes.error.message ?? "현재 채널가 조회 실패", 500);
  if (latestSnapshotRes.error) return jsonError(latestSnapshotRes.error.message ?? "최신 시각 조회 실패", 500);
  if (latestPushRes.error) return jsonError(latestPushRes.error.message ?? "최신 push 조회 실패", 500);
  if (activeOverrideRes.error) return jsonError(activeOverrideRes.error.message ?? "활성 오버라이드 조회 실패", 500);
  if (activeAdjustmentRes.error) return jsonError(activeAdjustmentRes.error.message ?? "활성 조정 조회 실패", 500);
  if (activePolicyRes.error) return jsonError(activePolicyRes.error.message ?? "활성 정책 조회 실패", 500);
  if (globalDefaultRes.error) return jsonError(globalDefaultRes.error.message ?? "글로벌 기본 factor 조회 실패", 500);

  const latestV2Rows = (latestV2RowsRes.data ?? []) as LatestV2Row[];
  const latestV2ByProduct = new Map<string, LatestV2Row>();
  for (const row of latestV2Rows) {
    const productKey = toKeyPart(row.channel_product_id);
    if (!productKey) continue;
    if (!latestV2ByProduct.has(productKey)) latestV2ByProduct.set(productKey, row);
  }

  const currentPriceByExternal = new Map<string, CurrentPriceRow>();
  for (const row of (currentPriceRes.data ?? []) as CurrentPriceRow[]) {
    const externalProductNo = toKeyPart(row.external_product_no);
    if (!externalProductNo) continue;
    const key = toExternalKey(row.external_product_no, row.external_variant_code);
    if (!currentPriceByExternal.has(key)) currentPriceByExternal.set(key, row);
  }

  const overrideKeys = new Set<string>();
  for (const row of (activeOverrideRes.data ?? []) as ActiveOverrideRow[]) {
    overrideKeys.add(`${toKeyPart(row.channel_id)}::${toKeyPart(row.master_item_id)}`);
  }

  const adjustmentProductKeys = new Set<string>();
  const adjustmentMasterKeys = new Set<string>();
  for (const row of (activeAdjustmentRes.data ?? []) as ActiveAdjustmentRow[]) {
    const normalizedChannelId = toKeyPart(row.channel_id);
    const productKey = toKeyPart(row.channel_product_id);
    const masterKey = toKeyPart(row.master_item_id);
    if (productKey) adjustmentProductKeys.add(`${normalizedChannelId}::${productKey}`);
    if (masterKey) adjustmentMasterKeys.add(`${normalizedChannelId}::${masterKey}`);
  }

  let okCount = 0;
  let outOfSyncCount = 0;
  let errorCount = 0;

  let overrideCount = 0;
  let adjustmentCount = 0;

  for (const mapping of mappings) {
    const normalizedChannelId = toKeyPart(mapping.channel_id);
    const normalizedChannelProductId = toKeyPart(mapping.channel_product_id);
    const normalizedMasterId = toKeyPart(mapping.master_item_id);

    const sourceRow = latestV2ByProduct.get(normalizedChannelProductId) ?? null;
    const finalTargetPrice = sourceRow?.final_target_price_v2_krw ?? null;

    const externalProductNo = toKeyPart(mapping.external_product_no) || toKeyPart(sourceRow?.external_product_no) || "-";
    const externalVariantCode = toKeyPart(mapping.external_variant_code) || toKeyPart(sourceRow?.external_variant_code) || null;
    const fallbackCurrentPrice = currentPriceByExternal.get(toExternalKey(externalProductNo, externalVariantCode));

    const currentPrice = sourceRow?.current_channel_price_krw ?? fallbackCurrentPrice?.current_price_krw ?? null;
    const fetchStatus = fallbackCurrentPrice?.fetch_status ?? null;
    const state = derivePriceState(currentPrice, finalTargetPrice, fetchStatus);

    if (state === "OK") okCount += 1;
    else if (state === "OUT_OF_SYNC") outOfSyncCount += 1;
    else errorCount += 1;

    if (overrideKeys.has(`${normalizedChannelId}::${normalizedMasterId}`)) {
      overrideCount += 1;
    }

    if (
      adjustmentProductKeys.has(`${normalizedChannelId}::${normalizedChannelProductId}`)
      || adjustmentMasterKeys.has(`${normalizedChannelId}::${normalizedMasterId}`)
    ) {
      adjustmentCount += 1;
    }
  }

  const activePolicy = activePolicyRes.data;
  const globalDefault = globalDefaultRes.data;

  let activeFactorSet: FactorSetRow | null = null;
  if (activePolicy?.material_factor_set_id) {
    const factorRes = await sb
      .from("material_factor_set")
      .select("factor_set_id,scope,name")
      .eq("factor_set_id", activePolicy.material_factor_set_id)
      .limit(1)
      .maybeSingle<FactorSetRow>();
    if (factorRes.error) return jsonError(factorRes.error.message ?? "활성 factor set 조회 실패", 500);
    activeFactorSet = factorRes.data;
  } else {
    activeFactorSet = globalDefault;
  }

  const factorSource = activePolicy?.material_factor_set_id
    ? "CHANNEL_POLICY"
    : globalDefault
      ? "GLOBAL_DEFAULT"
      : "SYSTEM_DEFAULT";

  return NextResponse.json(
    {
      data: {
        channel_id: channelId,
        counts: {
          total: mappings.length,
          ok: okCount,
          out_of_sync: outOfSyncCount,
          error: errorCount,
          override: overrideCount,
          adjustment: adjustmentCount,
        },
        freshness: {
          tick_as_of: latestSnapshotRes.data?.computed_at ?? null,
          last_pull_at: null,
          last_recompute_at: latestV2Rows[0]?.computed_at ?? null,
          last_push_at: latestPushRes.data?.finished_at ?? latestPushRes.data?.started_at ?? null,
        },
        market: {
          gold_krw_g: latestSnapshotRes.data?.tick_gold_krw_g ?? null,
          silver_krw_g: latestSnapshotRes.data?.tick_silver_krw_g ?? null,
        },
        policy: {
          policy_id: activePolicy?.policy_id ?? null,
          margin_multiplier: activePolicy?.margin_multiplier ?? 1,
          rounding_unit: activePolicy?.rounding_unit ?? 1000,
          rounding_mode: activePolicy?.rounding_mode ?? "CEIL",
        },
        factor: {
          source: factorSource,
          factor_set_id: activeFactorSet?.factor_set_id ?? null,
          factor_set_name: activeFactorSet?.name ?? null,
          factor_scope: activeFactorSet?.scope ?? null,
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
