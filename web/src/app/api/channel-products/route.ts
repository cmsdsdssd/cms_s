import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { resolveCanonicalExternalProductNo } from "@/lib/shop/mapping-option-details";
import { attachExistingChannelProductIds, validateActiveMappingInvariants } from "@/lib/shop/mapping-integrity";
import { toChannelProductIdentityInsertRow } from "@/lib/shop/channel-product-identity";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CHANNEL_PRODUCT_SELECT_BASE = "channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, mapping_source, is_active, created_at, updated_at";
const CHANNEL_PRODUCT_SELECT_WITH_PROFILE = `${CHANNEL_PRODUCT_SELECT_BASE},current_product_sync_profile`;

const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const CURRENT_PRODUCT_SYNC_PROFILES = ["GENERAL", "MARKET_LINKED"] as const;

const parseCurrentProductSyncProfile = (value: unknown) => {
  const profile = String(value ?? "GENERAL").trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("current_product_sync_profile must be GENERAL/MARKET_LINKED");
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  const buildQuery = (includeCurrentProductSyncProfile: boolean) => {
    let query = sb
      .from("sales_channel_product")
      .select(includeCurrentProductSyncProfile ? CHANNEL_PRODUCT_SELECT_WITH_PROFILE : CHANNEL_PRODUCT_SELECT_BASE)
      .order("updated_at", { ascending: false });

    if (channelId) query = query.eq("channel_id", channelId);
    if (masterItemId) query = query.eq("master_item_id", masterItemId);
    return query;
  };

  let { data, error } = await buildQuery(true);
  if (error && isMissingColumnError(error, "sales_channel_product.current_product_sync_profile")) {
    ({ data, error } = await buildQuery(false));
  }
  if (error) return jsonError(error.message ?? "매핑 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);
  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const externalVariantCode = typeof body.external_variant_code === "string" ? body.external_variant_code.trim() : "";
  const mappingSource = String(body.mapping_source ?? "MANUAL").trim().toUpperCase();
  const optionSizeValue =
    body.option_size_value === null || body.option_size_value === undefined || body.option_size_value === ""
      ? null
      : Number(body.option_size_value);
  const isActive = body.is_active === false ? false : true;
  const hasCurrentProductSyncProfile = Object.prototype.hasOwnProperty.call(body, "current_product_sync_profile");
  let currentProductSyncProfile: (typeof CURRENT_PRODUCT_SYNC_PROFILES)[number] | null = null;

  if (hasCurrentProductSyncProfile) {
    try {
      currentProductSyncProfile = parseCurrentProductSyncProfile(body.current_product_sync_profile);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid current_product_sync_profile", 400);
    }
  }

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);
  if (!isActive) return jsonError("활성 매핑만 허용됩니다 (is_active must be true)", 422);
  if (optionSizeValue !== null && (!Number.isFinite(optionSizeValue) || optionSizeValue < 0)) {
    return jsonError("option_size_value must be >= 0", 400);
  }

  const activeProductRes = await sb
    .from("sales_channel_product")
    .select("external_product_no")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);

  const canonicalExternalProductNo = resolveCanonicalExternalProductNo(
    (activeProductRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim()),
    externalProductNo,
  );
  if (canonicalExternalProductNo !== externalProductNo) {
    return jsonError("canonical external_product_no drift is not allowed", 422, {
      code: "CANONICAL_PRODUCT_NO_DRIFT",
      channel_id: channelId,
      master_item_id: masterItemId,
      requested_external_product_no: externalProductNo,
      canonical_external_product_no: canonicalExternalProductNo,
      external_variant_code: externalVariantCode || null,
    });
  }

  const existingMappingCandidates = [canonicalExternalProductNo].filter(Boolean);
  let existingMappingQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, option_material_code, option_color_code, option_decoration_code, option_size_value, external_product_no")
    .eq("channel_id", channelId)
    .eq("external_variant_code", externalVariantCode)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (existingMappingCandidates.length === 1) {
    existingMappingQuery = existingMappingQuery.eq("external_product_no", existingMappingCandidates[0]);
  } else {
    existingMappingQuery = existingMappingQuery.in("external_product_no", existingMappingCandidates);
  }
  const existingMappingRes = await existingMappingQuery.maybeSingle();
  if (existingMappingRes.error) return jsonError(existingMappingRes.error.message ?? "기존 옵션 상세 조회 실패", 500);

  const invariantRows = attachExistingChannelProductIds(
    [{
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: canonicalExternalProductNo,
      external_variant_code: externalVariantCode,
      is_active: true,
    }],
    existingMappingRes.data
      ? [{
          channel_product_id: existingMappingRes.data.channel_product_id,
          channel_id: channelId,
          master_item_id: masterItemId,
          external_product_no: canonicalExternalProductNo,
          external_variant_code: externalVariantCode,
        }]
      : [],
  );

  const invariantCheck = await validateActiveMappingInvariants({
    sb,
    rows: invariantRows,
  });
  if (!invariantCheck.ok) {
    return jsonError(invariantCheck.message, 422, {
      code: invariantCheck.code,
      ...(invariantCheck.detail ?? {}),
    });
  }
  const buildSiblingQuery = (includeCurrentProductSyncProfile: boolean) => sb
    .from("sales_channel_product")
    .select(includeCurrentProductSyncProfile ? "channel_product_id, is_active, current_product_sync_profile" : "channel_product_id, is_active")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId);

  let siblingRes = await buildSiblingQuery(true);
  if (siblingRes.error && isMissingColumnError(siblingRes.error, "sales_channel_product.current_product_sync_profile")) {
    siblingRes = await buildSiblingQuery(false);
  }
  if (siblingRes.error) return jsonError(siblingRes.error.message ?? "동일 마스터 옵션 조회 실패", 500);

  const siblingRowsRaw = Array.isArray(siblingRes.data) ? (siblingRes.data as unknown[]) : [];
  const activeSiblingRows = siblingRowsRaw.map((row) => {
    const record = row && typeof row === "object"
      ? row as { is_active?: boolean | null; current_product_sync_profile?: string | null }
      : {};
    return {
      is_active: record.is_active !== false,
      current_product_sync_profile: typeof record.current_product_sync_profile === "string" ? record.current_product_sync_profile : null,
    };
  }).filter((row) => row.is_active);

  const resolvedCurrentProductSyncProfile = hasCurrentProductSyncProfile
    ? currentProductSyncProfile
    : (activeSiblingRows.find((row) => row.current_product_sync_profile)?.current_product_sync_profile as (typeof CURRENT_PRODUCT_SYNC_PROFILES)[number] | null) ?? "GENERAL";

  const payloadWithProfile = toChannelProductIdentityInsertRow({
    channel_id: channelId,
    master_item_id: masterItemId,
    external_product_no: canonicalExternalProductNo,
    external_variant_code: externalVariantCode,
    current_product_sync_profile: resolvedCurrentProductSyncProfile,
    mapping_source: ["MANUAL", "CSV", "AUTO"].includes(mappingSource) ? mappingSource : "MANUAL",
    is_active: isActive,
  });
  const payloadBase = payloadWithProfile;

  const executeUpsert = (payload: typeof payloadBase | typeof payloadWithProfile) => sb
    .rpc("cms_fn_upsert_sales_channel_product_mappings_v1", { p_rows: [payload] });

  let { data, error } = await executeUpsert(payloadWithProfile);
  if (error && isMissingColumnError(error, "sales_channel_product.current_product_sync_profile")) {
    ({ data, error } = await executeUpsert(payloadBase));
  }

  if (error) return jsonError(error.message ?? "매핑 저장 실패", 400);
  const savedRow = Array.isArray(data) ? data[0] : null;
  const responseData = savedRow
    ? {
        ...savedRow,
        current_product_sync_profile: resolvedCurrentProductSyncProfile,
      }
    : savedRow;

  if (canonicalExternalProductNo !== externalProductNo) {
    const aliasHistoryRes = await sb
      .from("sales_channel_product_alias_history")
      .insert([{
        channel_id: channelId,
        canonical_channel_product_id: String(savedRow?.channel_product_id ?? "").trim() || null,
        master_item_id: masterItemId,
        canonical_external_product_no: canonicalExternalProductNo,
        alias_external_product_no: externalProductNo,
        external_variant_code: externalVariantCode,
        reason: "SINGLE_MAPPING_CANONICALIZED",
      }]);
    if (aliasHistoryRes.error) return jsonError(aliasHistoryRes.error.message ?? "별칭 이력 저장 실패", 500);
  }

  return NextResponse.json({ data: responseData }, { headers: { "Cache-Control": "no-store" } });
}
