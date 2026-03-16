import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { resolveCanonicalExternalProductNo } from "@/lib/shop/mapping-option-details";
import { attachExistingChannelProductIds, validateActiveMappingInvariants } from "@/lib/shop/mapping-integrity";
import { toChannelProductIdentityInsertRow } from "@/lib/shop/channel-product-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toTrimmed = (value: unknown): string => String(value ?? "").trim();

type BulkRow = {
  channel_product_id?: string | null;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
  size_price_override_enabled: boolean;
  size_price_override_krw: number | null;
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL";
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
  current_product_sync_profile: "GENERAL" | "MARKET_LINKED" | null;
  mapping_source: "MANUAL" | "CSV" | "AUTO";
  is_active: boolean;
};

type SyncRuleSetTargetRow = {
  channel_id: string;
  external_product_no: string;
  external_variant_code: string;
  option_price_mode: 'SYNC' | 'MANUAL';
  sync_rule_set_id: string | null;
  is_active: boolean;
};

async function ensureActiveSyncRuleSetIdsForRows<T extends SyncRuleSetTargetRow>(
  rows: T[],
  loadActiveRuleSet: (channelId: string) => Promise<{ rule_set_id: string }>,
): Promise<T[]> {
  const channelIds = Array.from(new Set(
    rows
      .filter((row) => row.is_active && row.option_price_mode === 'SYNC' && !toTrimmed(row.sync_rule_set_id))
      .map((row) => row.channel_id),
  ));

  if (channelIds.length === 0) return rows;

  const activeRuleSetIdByChannel = new Map<string, string>();
  await Promise.all(channelIds.map(async (channelId) => {
    const activeRuleSet = await loadActiveRuleSet(channelId);
    activeRuleSetIdByChannel.set(channelId, activeRuleSet.rule_set_id);
  }));

  return rows.map((row) => {
    if (!row.is_active) return row;
    if (row.option_price_mode !== 'SYNC') return row;
    if (toTrimmed(row.sync_rule_set_id)) return row;
    return {
      ...row,
      sync_rule_set_id: activeRuleSetIdByChannel.get(row.channel_id) ?? null,
    } as T;
  });
}

export function canonicalizeBulkRowsByActiveProductNos<T extends Pick<BulkRow, "channel_id" | "master_item_id" | "external_product_no">>(
  rows: T[],
  activeProductNosByPair: Map<string, string[]>,
): T[] {
  return rows.map((row) => {
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
      activeProductNosByPair.get(pairKey) ?? [],
      row.external_product_no,
    );
    if (!canonicalExternalProductNo || canonicalExternalProductNo === row.external_product_no) {
      return row;
    }
    return {
      ...row,
      external_product_no: canonicalExternalProductNo,
    };
  });
}

function normalizeRow(raw: unknown): { ok: true; row: BulkRow } | { ok: false; error: string } {
  const body = parseJsonObject(raw);
  if (!body) return { ok: false, error: "row must be object" };

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const externalVariantCode = String(body.external_variant_code ?? "").trim();

  const materialMultiplierOverride = null;
  const sizeWeightDeltaG = null;
  const sizePriceOverrideEnabled = false;
  const sizePriceOverrideKrw = null;
  const optionPriceDeltaKrw = null;
  const optionPriceMode: "SYNC" | "MANUAL" = "SYNC";
  const syncRuleSetId = null;
  const optionMaterialCode = null;
  const optionColorCode = null;
  const optionDecorationCode = null;
  const optionSizeValue = null;
  const optionManualTargetKrw = null;
  const currentProductSyncProfileRaw = String(body.current_product_sync_profile ?? "").trim().toUpperCase();
  const currentProductSyncProfile = currentProductSyncProfileRaw === "MARKET_LINKED"
    ? "MARKET_LINKED"
    : currentProductSyncProfileRaw === "GENERAL"
      ? "GENERAL"
      : null;

  const mappingSourceRaw = String(body.mapping_source ?? "AUTO").trim().toUpperCase();
  const mappingSource: "MANUAL" | "CSV" | "AUTO" = ["MANUAL", "CSV", "AUTO"].includes(mappingSourceRaw)
    ? (mappingSourceRaw as "MANUAL" | "CSV" | "AUTO")
    : "AUTO";
  const isActive = body.is_active === false ? false : true;
  const includeMasterPlatingLabor = body.include_master_plating_labor === false ? false : true;
  const syncRuleMaterialEnabled = body.sync_rule_material_enabled === false ? false : true;
  const syncRuleWeightEnabled = body.sync_rule_weight_enabled === false ? false : true;
  const syncRulePlatingEnabled = body.sync_rule_plating_enabled === false ? false : true;
  const syncRuleDecorationEnabled = body.sync_rule_decoration_enabled === false ? false : true;
  const syncRuleMarginRoundingEnabled = body.sync_rule_margin_rounding_enabled === false ? false : true;

  if (!channelId) return { ok: false, error: "channel_id is required" };
  if (!masterItemId) return { ok: false, error: "master_item_id is required" };
  if (!externalProductNo) return { ok: false, error: "external_product_no is required" };
  if (!externalVariantCode) return { ok: false, error: "external_variant_code is required" };
  if (!isActive) return { ok: false, error: "?쒖꽦 留ㅽ븨留??덉슜?⑸땲??(is_active must be true)" };


  return {
    ok: true,
    row: {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: externalProductNo,
      external_variant_code: externalVariantCode,
      sync_rule_set_id: null,
      option_material_code: optionMaterialCode,
      option_color_code: optionColorCode,
      option_decoration_code: optionDecorationCode,
      option_size_value: optionSizeValue,
      material_multiplier_override: null,
      size_weight_delta_g: null,
      size_price_override_enabled: false,
      size_price_override_krw: null,
      option_price_delta_krw: null,
      option_price_mode: "SYNC",
      option_manual_target_krw: null,
      include_master_plating_labor: true,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: true,
      sync_rule_margin_rounding_enabled: true,
      current_product_sync_profile: currentProductSyncProfile,
      mapping_source: mappingSource,
      is_active: isActive,
    },
  };
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);
  const changeReason = typeof body.change_reason === "string" ? toTrimmed(body.change_reason) : "";
  const changedBy =
    toTrimmed(request.headers.get("x-user-email"))
    || toTrimmed(request.headers.get("x-user-id"))
    || toTrimmed(request.headers.get("x-user"))
    || null;

  const inputRows = Array.isArray(body.rows) ? body.rows : [];
  if (inputRows.length === 0) return jsonError("rows is required", 400);

  let normalized: BulkRow[] = [];
  for (let i = 0; i < inputRows.length; i += 1) {
    const result = normalizeRow(inputRows[i]);
    if (!result.ok) return jsonError(`rows[${i}]: ${result.error}`, 400);
    normalized.push(result.row);
  }


  const affectedChannelIds = Array.from(new Set(normalized.map((row) => row.channel_id)));
  const affectedMasterIds = Array.from(new Set(normalized.map((row) => row.master_item_id)));
  const activeProductRes = await sb
    .from('sales_channel_product')
    .select('channel_id, master_item_id, external_product_no')
    .in('channel_id', affectedChannelIds)
    .in('master_item_id', affectedMasterIds)
    .eq('is_active', true);
  if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? '활성 상품번호 조회 실패', 500);

  const activeProductNosByPair = new Map<string, string[]>();
  for (const row of (activeProductRes.data ?? []) as Array<{ channel_id: string; master_item_id: string; external_product_no: string | null }>) {
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const prev = activeProductNosByPair.get(pairKey) ?? [];
    const productNo = String(row.external_product_no ?? '').trim();
    if (!productNo || prev.includes(productNo)) continue;
    prev.push(productNo);
    activeProductNosByPair.set(pairKey, prev);
  }

  normalized = canonicalizeBulkRowsByActiveProductNos(normalized, activeProductNosByPair);

  const existingIdentityRes = await sb
    .from('sales_channel_product')
    .select('channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code')
    .in('channel_id', affectedChannelIds)
    .in('master_item_id', affectedMasterIds)
    .eq('is_active', true);
  if (existingIdentityRes.error) return jsonError(existingIdentityRes.error.message ?? '활성 매핑 식별자 조회 실패', 500);

  normalized = attachExistingChannelProductIds(
    normalized,
    ((existingIdentityRes.data ?? []) as Array<{
      channel_product_id: string | null;
      channel_id: string;
      master_item_id: string;
      external_product_no: string | null;
      external_variant_code: string | null;
    }>).map((row) => {
      const pairKey = `${row.channel_id}::${row.master_item_id}`;
      return {
        ...row,
        external_product_no: resolveCanonicalExternalProductNo(
          activeProductNosByPair.get(pairKey) ?? [],
          String(row.external_product_no ?? "").trim(),
        ),
      };
    }),
  );

  const invariantCheck = await validateActiveMappingInvariants({
    sb,
    rows: normalized.map((row) => ({
      channel_product_id: row.channel_product_id,
      channel_id: row.channel_id,
      master_item_id: row.master_item_id,
      external_product_no: row.external_product_no,
      external_variant_code: row.external_variant_code,
      is_active: row.is_active,
    })),
  });
  if (!invariantCheck.ok) {
    return jsonError(invariantCheck.message, 422, {
      code: invariantCheck.code,
      ...(invariantCheck.detail ?? {}),
    });
  }

  const dedup = new Map<string, BulkRow>();
  for (const row of normalized) {
    const key = `${row.channel_id}::${row.external_product_no}::${row.external_variant_code}`;
    dedup.set(key, row);
  }
  let rows = Array.from(dedup.values());

  const affectedPairSet = new Set(rows.map((row) => `${row.channel_id}::${row.master_item_id}`));
  rows = rows.map((row) => {
    const pairKey = `${row.channel_id}::${row.master_item_id}`;
    const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
      activeProductNosByPair.get(pairKey) ?? [],
      row.external_product_no,
    );
    return {
      ...toChannelProductIdentityInsertRow({
        channel_id: row.channel_id,
        master_item_id: row.master_item_id,
        external_product_no: canonicalExternalProductNo,
        external_variant_code: row.external_variant_code,
        current_product_sync_profile: ((row.current_product_sync_profile ?? 'GENERAL') as 'GENERAL' | 'MARKET_LINKED'),
        mapping_source: row.mapping_source,
        is_active: row.is_active,
      }),
      material_multiplier_override: null,
      size_weight_delta_g: null,
      size_price_override_enabled: false,
      size_price_override_krw: null,
      option_price_delta_krw: null,
      option_manual_target_krw: null,
      include_master_plating_labor: true,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: true,
      sync_rule_margin_rounding_enabled: true,
    } satisfies BulkRow;
  });

  const { data, error } = await sb.rpc("cms_fn_upsert_sales_channel_product_mappings_v1", { p_rows: rows });

  if (error) return jsonError(error.message ?? '일괄 매핑 저장 실패', 400);

  const savedRows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];

  return NextResponse.json(
    {
      data: savedRows,
      requested: inputRows.length,
      deduplicated: rows.length,
      saved: savedRows.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}



