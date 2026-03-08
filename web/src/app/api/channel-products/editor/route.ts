import { NextResponse } from "next/server";
import { getShopAdminClient, isMissingColumnError, jsonError, parseJsonObject } from "@/lib/shop/admin";
import {
  type Cafe24ProductDetailSummary,
  type Cafe24VariantSummary,
  cafe24GetProductDetail,
  cafe24ListProductVariants,
  cafe24UpdateProductFields,
  cafe24UpdateVariantAdditionalAmount,
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";
import { POST as recomputePost } from "@/app/api/pricing/recompute/route";
import { POST as pushPost } from "@/app/api/channel-prices/push/route";
import { resolveCurrentProductSyncProfile } from "@/lib/shop/current-product-sync-profile.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EditorMeta = {
  floor_price_krw: number;
  exclude_plating_labor: boolean;
  plating_labor_sell_krw: number;
  total_labor_sell_krw: number;
  tick_gold_krw_per_g: number;
  tick_silver_krw_per_g: number;
  current_product_sync_profile: 'GENERAL' | 'MARKET_LINKED';
};

type MasterMeta = {
  material_code_default: string | null;
  weight_default_g: number | null;
  deduction_weight_default_g: number | null;
  labor_base_sell: number | null;
  labor_center_sell: number | null;
  labor_sub1_sell: number | null;
  labor_sub2_sell: number | null;
  plating_price_sell_default: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
};

type PostApplySyncResult = {
  requested: boolean;
  ok: boolean;
  stage: "skipped" | "recompute" | "push" | "done";
  skipped_reason?: string | null;
  compute_request_id?: string | null;
  recompute_status?: number;
  push_status?: number;
  job_id?: string | null;
  success?: number;
  failed?: number;
  skipped?: number;
  error?: string | null;
  detail?: unknown;
};

const toIntCeil = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.ceil(n) : fallback;
};

const roundByMode = (value: number, unit: number, mode: "CEIL" | "ROUND" | "FLOOR") => {
  if (!Number.isFinite(value)) return 0;
  const safeUnit = Number.isFinite(unit) && unit > 0 ? unit : 1;
  const q = value / safeUnit;
  if (mode === "FLOOR") return Math.floor(q) * safeUnit;
  if (mode === "ROUND") return Math.round(q) * safeUnit;
  return Math.ceil(q) * safeUnit;
};

const mkJsonRequest = (path: string, payload: Record<string, unknown>): Request =>
  new Request(`https://internal.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const toIntCeilNonNegative = (value: unknown, fallback = 0) => Math.max(0, toIntCeil(value, fallback));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeProductNoCandidates = (values: Array<unknown>): string[] => {
  return Array.from(new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean)));
};

const parseCurrentProductSyncProfile = (value: unknown): EditorMeta["current_product_sync_profile"] => {
  const profile = String(value ?? "").trim().toUpperCase();
  if (profile === "GENERAL" || profile === "MARKET_LINKED") return profile;
  throw new Error("current_product_sync_profile must be GENERAL/MARKET_LINKED");
};

function applyExpectedVariantAdditionalToPreview(
  detail: Cafe24ProductDetailSummary,
  expectedByVariant: Map<string, number>,
  variantResults: Array<Record<string, unknown>>,
): Cafe24ProductDetailSummary {
  if (!Array.isArray(detail.variants) || detail.variants.length === 0 || expectedByVariant.size === 0) {
    return detail;
  }

  const transportOkByVariant = new Map<string, boolean>();
  for (const row of variantResults) {
    const resolved = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    if (!resolved) continue;
    transportOkByVariant.set(resolved, row.ok === true);
  }

  const nextVariants = detail.variants.map((variant) => {
    const canonical = String(variant.variantCode ?? "").trim();
    const custom = String(variant.customVariantCode ?? "").trim();
    const expectedCanonical = canonical ? expectedByVariant.get(canonical) : undefined;
    const expectedCustom = custom ? expectedByVariant.get(custom) : undefined;
    const expected = expectedCanonical ?? expectedCustom;
    if (!Number.isFinite(Number(expected))) return variant;

    const transportOk = (canonical && transportOkByVariant.get(canonical) === true)
      || (custom && transportOkByVariant.get(custom) === true);
    if (!transportOk) return variant;

    return {
      ...variant,
      additionalAmount: toIntCeil(expected),
    };
  });

  return {
    ...detail,
    variants: nextVariants,
  };
}

function applyExpectedProductFieldsToPreview(
  detail: Cafe24ProductDetailSummary,
  expected: {
    price: number | null;
    retail_price: number | null;
    selling: string | null;
    display: string | null;
  },
): Cafe24ProductDetailSummary {
  const next = { ...detail };

  if (Number.isFinite(Number(expected.price))) {
    next.price = toIntCeil(expected.price);
  }
  if (Number.isFinite(Number(expected.retail_price))) {
    next.retailPrice = toIntCeil(expected.retail_price);
  }

  const selling = String(expected.selling ?? "").trim().toUpperCase();
  if (selling === "T" || selling === "F") {
    next.selling = selling;
  }

  const display = String(expected.display ?? "").trim().toUpperCase();
  if (display === "T" || display === "F") {
    next.display = display;
  }

  return next;
}

async function loadDbOptionAdditionalByVariant(
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  externalProductNos: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (externalProductNos.length === 0) return map;

  let stateQuery = sb
    .from("channel_option_current_state_v1")
    .select("state_id, external_variant_code, final_target_additional_amount_krw, updated_at")
    .eq("channel_id", channelId)
    .order("updated_at", { ascending: false })
    .order("state_id", { ascending: false });
  if (externalProductNos.length === 1) {
    stateQuery = stateQuery.eq("external_product_no", externalProductNos[0]);
  } else {
    stateQuery = stateQuery.in("external_product_no", externalProductNos);
  }
  const stateRes = await stateQuery;
  if (stateRes.error) {
    throw new Error(stateRes.error.message ?? "current_state 조회 실패");
  }
  for (const row of stateRes.data ?? []) {
    const code = String((row as { external_variant_code?: string | null }).external_variant_code ?? "").trim();
    if (!code) continue;
    if (map.has(code)) continue;
    const amount = toIntCeil((row as { final_target_additional_amount_krw?: number | null }).final_target_additional_amount_krw ?? Number.NaN, Number.NaN);
    if (!Number.isFinite(amount)) continue;
    map.set(code, amount);
  }
  return map;
}

type EditorPreviewVariant = Cafe24VariantSummary & { savedTargetAdditionalAmount: number | null };

function applyDbOptionAdditionalToPreview(
  detail: Cafe24ProductDetailSummary,
  dbAdditionalByVariant: Map<string, number>,
): Cafe24ProductDetailSummary & { variants: EditorPreviewVariant[] } {
  if (!Array.isArray(detail.variants) || detail.variants.length === 0) {
    return {
      ...detail,
      variants: [],
    };
  }

  const nextVariants = detail.variants.map((variant) => {
    const canonical = String(variant.variantCode ?? "").trim();
    const custom = String(variant.customVariantCode ?? "").trim();
    const fromCanonical = canonical ? dbAdditionalByVariant.get(canonical) : undefined;
    const fromCustom = custom ? dbAdditionalByVariant.get(custom) : undefined;
    const nextAmount = fromCanonical ?? fromCustom;
    return {
      ...variant,
      savedTargetAdditionalAmount: Number.isFinite(Number(nextAmount)) ? toIntCeil(nextAmount) : null,
    } as EditorPreviewVariant;
  });

  return {
    ...detail,
    variants: nextVariants,
  };
}

async function loadEditorMeta(
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  externalProductNos: string[],
  masterItemId: string,
  preferredExternalProductNo?: string,
): Promise<EditorMeta> {
  const tickRes = await sb
    .from("cms_v_market_tick_latest_gold_silver_ops_v1")
    .select("gold_price_krw_per_g, silver_price_krw_per_g")
    .maybeSingle();
  if (tickRes.error) throw new Error(tickRes.error.message ?? "시세 조회 실패");

  const productNos = normalizeProductNoCandidates(externalProductNos);
  let stateLatestQuery = sb
    .from("channel_option_current_state_v1")
    .select("external_product_no, exclude_plating_labor, plating_labor_sell_krw, total_labor_sell_krw, floor_price_krw")
    .eq("channel_id", channelId)
    .order("updated_at", { ascending: false })
    .order("state_id", { ascending: false });
  if (productNos.length === 1) {
    stateLatestQuery = stateLatestQuery.eq("external_product_no", productNos[0]);
  } else if (productNos.length > 1) {
    stateLatestQuery = stateLatestQuery.in("external_product_no", productNos);
  }
  const stateLatestRes = await stateLatestQuery;
  if (stateLatestRes.error) throw new Error(stateLatestRes.error.message ?? 'current_state 조회 실패');

  const buildMappingProfileQuery = () => {
    let mappingProfileQuery = sb
      .from("sales_channel_product")
      .select("current_product_sync_profile")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (masterItemId) {
      mappingProfileQuery = mappingProfileQuery.eq("master_item_id", masterItemId);
    } else if (productNos.length === 1) {
      mappingProfileQuery = mappingProfileQuery.eq("external_product_no", productNos[0]);
    } else if (productNos.length > 1) {
      mappingProfileQuery = mappingProfileQuery.in("external_product_no", productNos);
    }
    return mappingProfileQuery;
  };
  const mappingProfileRes = masterItemId || productNos.length > 0
    ? await buildMappingProfileQuery()
    : null;
  if (mappingProfileRes?.error && !isMissingColumnError(mappingProfileRes.error, "sales_channel_product.current_product_sync_profile")) {
    throw new Error(mappingProfileRes.error.message ?? "현재 상품 프로필 조회 실패");
  }
  const mappingProfileRows = ((mappingProfileRes && !mappingProfileRes.error) ? (mappingProfileRes.data ?? []) : []) as Array<{ current_product_sync_profile?: string | null }>;

  const floorRes = masterItemId
    ? await sb
      .from("product_price_guard_v2")
      .select("floor_price_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };
  if (floorRes.error) throw new Error(floorRes.error.message ?? "바닥가 조회 실패");

  const masterRes = masterItemId
    ? await sb
      .from("cms_master_item")
      .select("labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, plating_price_sell_default, center_qty_default, sub1_qty_default, sub2_qty_default")
      .eq("master_item_id", masterItemId)
      .maybeSingle()
    : { data: null, error: null };
  if (masterRes.error) throw new Error(masterRes.error.message ?? "마스터 조회 실패");

  const latestSnapshotRes = masterItemId
    ? await sb
      .from("pricing_snapshot")
      .select("labor_raw_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };
  if (latestSnapshotRes.error) throw new Error(latestSnapshotRes.error.message ?? "최근 스냅샷 조회 실패");

  const stateRows = ((stateLatestRes.data ?? []) as Array<{
    exclude_plating_labor?: boolean;
    plating_labor_sell_krw?: number;
    total_labor_sell_krw?: number;
    floor_price_krw?: number;
    external_product_no?: string | null;
  }>).filter((row) => Boolean(row) && typeof row === "object");
  const preferredProductNo = String(preferredExternalProductNo ?? "").trim();
  const relevantStateRows = (() => {
    if (!preferredProductNo) return stateRows;
    const exactRows = stateRows.filter((row) => String(row.external_product_no ?? "").trim() === preferredProductNo);
    return exactRows.length > 0 ? exactRows : stateRows;
  })();
  const hasSingleRelevantStateRow = relevantStateRows.length === 1;
  const state = hasSingleRelevantStateRow ? (relevantStateRows[0] ?? null) : null;
  const master = (masterRes.data as Partial<MasterMeta> | null) ?? null;
  const platingSell = toIntCeilNonNegative(state?.plating_labor_sell_krw ?? master?.plating_price_sell_default ?? 0);
  const laborFromSnapshot = toIntCeil((latestSnapshotRes.data as { labor_raw_krw?: number } | null)?.labor_raw_krw ?? Number.NaN, Number.NaN);
  const laborFallback = toIntCeilNonNegative(
    Number(master?.labor_base_sell ?? 0)
    + Number(master?.labor_center_sell ?? 0) * Math.max(Number(master?.center_qty_default ?? 0), 0)
    + Number(master?.labor_sub1_sell ?? 0) * Math.max(Number(master?.sub1_qty_default ?? 0), 0)
    + Number(master?.labor_sub2_sell ?? 0) * Math.max(Number(master?.sub2_qty_default ?? 0), 0)
    + Number(master?.plating_price_sell_default ?? 0),
  );
  const totalLabor = Number.isFinite(laborFromSnapshot) ? laborFromSnapshot : laborFallback;

  const excludePlatingLabor = relevantStateRows.length > 0
    && relevantStateRows.every((row) => row.exclude_plating_labor === true);

  return {
    floor_price_krw: Math.max(
      0,
      toIntCeil((floorRes.data as { floor_price_krw?: number } | null)?.floor_price_krw ?? state?.floor_price_krw ?? 0),
    ),
    exclude_plating_labor: excludePlatingLabor,
    plating_labor_sell_krw: platingSell,
    total_labor_sell_krw: Math.max(
      0,
      toIntCeil(state?.total_labor_sell_krw ?? totalLabor - (excludePlatingLabor ? platingSell : 0)),
    ),
    tick_gold_krw_per_g: toIntCeilNonNegative((tickRes.data as { gold_price_krw_per_g?: number } | null)?.gold_price_krw_per_g ?? 0),
    tick_silver_krw_per_g: toIntCeilNonNegative((tickRes.data as { silver_price_krw_per_g?: number } | null)?.silver_price_krw_per_g ?? 0),
    current_product_sync_profile: resolveCurrentProductSyncProfile(mappingProfileRows),
  };
}

async function loadMappingDebug(
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  externalProductNo: string,
) {
  const dbgRes = await sb
    .from("sales_channel_product")
    .select("channel_id,is_active,external_product_no")
    .eq("external_product_no", externalProductNo)
    .limit(500);
  if (dbgRes.error) return null;
  const rows = dbgRes.data ?? [];
  const activeInRequested = rows.filter((r) => String(r.channel_id) === channelId && r.is_active === true).length;
  const totalInRequested = rows.filter((r) => String(r.channel_id) === channelId).length;
  const activeByChannel = new Map<string, number>();
  for (const r of rows) {
    if (r.is_active !== true) continue;
    const cid = String(r.channel_id);
    activeByChannel.set(cid, (activeByChannel.get(cid) ?? 0) + 1);
  }
  return {
    requested_channel_id: channelId,
    external_product_no: externalProductNo,
    requested_channel_active_rows: activeInRequested,
    requested_channel_total_rows: totalInRequested,
    active_rows_by_channel: Array.from(activeByChannel.entries()).map(([cid, cnt]) => ({ channel_id: cid, count: cnt })),
  };
}

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

  const detail = await cafe24GetProductDetail(account, accessToken, externalProductNo);
  if (!detail.ok || !detail.data) {
    return jsonError(detail.error ?? "상품 조회 실패", detail.status || 500, {
      status: detail.status,
      raw: detail.raw,
    });
  }

  const requestedProductNo = externalProductNo;
  const productNoCandidates = normalizeProductNoCandidates([
    requestedProductNo,
    detail.data.productNo,
  ]);

  let mappingQuery = sb
    .from("sales_channel_product")
    .select("master_item_id")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (productNoCandidates.length === 1) {
    mappingQuery = mappingQuery.eq("external_product_no", productNoCandidates[0]);
  } else {
    mappingQuery = mappingQuery.in("external_product_no", productNoCandidates);
  }
  const mappingRes = await mappingQuery.maybeSingle();
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);
  let resolvedMasterItemId = String(mappingRes.data?.master_item_id ?? "").trim();
  let aliasCanonicalProductNo = "";

  if (!resolvedMasterItemId) {
    const aliasHistoryRes = await sb
      .from("sales_channel_product_alias_history")
      .select("master_item_id, canonical_external_product_no")
      .eq("channel_id", channelId)
      .in("alias_external_product_no", productNoCandidates)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aliasHistoryRes.error) return jsonError(aliasHistoryRes.error.message ?? "별칭 이력 조회 실패", 500);
    resolvedMasterItemId = String(aliasHistoryRes.data?.master_item_id ?? "").trim();
    aliasCanonicalProductNo = String(aliasHistoryRes.data?.canonical_external_product_no ?? "").trim();
    if (aliasCanonicalProductNo) productNoCandidates.push(aliasCanonicalProductNo);
  }

  if (resolvedMasterItemId) {
    const aliasRes = await sb
      .from("sales_channel_product")
      .select("external_product_no")
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .eq("is_active", true);
    if (!aliasRes.error) {
      for (const row of aliasRes.data ?? []) {
        productNoCandidates.push(String((row as { external_product_no?: string | null }).external_product_no ?? "").trim());
      }
    }
  }
  const normalizedCandidates = normalizeProductNoCandidates(productNoCandidates);

  let meta: EditorMeta;
  try {
    meta = await loadEditorMeta(sb, channelId, normalizedCandidates, resolvedMasterItemId, detail.data.productNo);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "에디터 메타 조회 실패", 500);
  }

  let detailWithDb = detail.data;
  try {
    const dbAdditionalByVariant = await loadDbOptionAdditionalByVariant(sb, channelId, normalizedCandidates);
    detailWithDb = applyDbOptionAdditionalToPreview(detail.data, dbAdditionalByVariant);
  } catch {
    // fallback to Cafe24 detail when DB overlay read fails
  }

  return NextResponse.json({ data: { ...detailWithDb, ...meta, master_item_id: resolvedMasterItemId || null } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const requestedMasterItemId = String(body.master_item_id ?? body.mater_item_id ?? "").trim();
  const syncFullPipelineRequested = body.sync_full_pipeline === true || body.recompute_and_sync === true;
  const syncFullPipeline = syncFullPipelineRequested && body.explicit_sync_confirm === true;
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

  const detailBefore = await cafe24GetProductDetail(account, accessToken, externalProductNo);
  if (!detailBefore.ok || !detailBefore.data) {
    return jsonError(detailBefore.error ?? "반영 전 상품 조회 실패", detailBefore.status || 500, {
      status: detailBefore.status,
      raw: detailBefore.raw,
    });
  }
  let detailBeforeData = detailBefore.data;

  const product = parseJsonObject(body.product) ?? {};
  const fields = {
    price: Number.isFinite(Number(product.price)) ? toIntCeil(product.price) : null,
    retail_price: Number.isFinite(Number(product.retail_price)) ? toIntCeil(product.retail_price) : null,
    selling: typeof product.selling === "string" ? product.selling : null,
    display: typeof product.display === "string" ? product.display : null,
  };
  const hasProductFieldUpdate = ["price", "retail_price", "selling", "display"].some((key) =>
    Object.prototype.hasOwnProperty.call(product, key),
  );

  const floorPriceRaw = Number(body.floor_price_krw ?? Number.NaN);
  const hasFloorUpdate = Number.isFinite(floorPriceRaw) && floorPriceRaw >= 0;
  const excludePlatingLabor = Boolean(body.exclude_plating_labor);
  const hasCurrentProductSyncProfile = Object.prototype.hasOwnProperty.call(body, "current_product_sync_profile");
  let currentProductSyncProfile: EditorMeta["current_product_sync_profile"] | null = null;
  if (hasCurrentProductSyncProfile) {
    try {
      currentProductSyncProfile = parseCurrentProductSyncProfile(body.current_product_sync_profile);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid current_product_sync_profile", 400);
    }
  }

  const variantPatchesRaw = Array.isArray(body.variants) ? body.variants : [];
  const variantPatches = variantPatchesRaw
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      variant_code: String(entry.variant_code ?? "").trim(),
      additional_amount: toIntCeil(entry.additional_amount),
    }))
    .filter((entry) => entry.variant_code && Number.isFinite(entry.additional_amount));

  const mappingRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, external_product_no, external_variant_code, option_material_code, option_size_value, option_color_code, option_decoration_code")
    .eq("channel_id", channelId)
    .eq("external_product_no", externalProductNo)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);

  let mappings = (mappingRes.data ?? []) as Array<{
    channel_product_id: string;
    master_item_id: string;
    external_product_no: string;
    external_variant_code: string | null;
    option_material_code: string | null;
    option_size_value: number | null;
    option_color_code: string | null;
    option_decoration_code: string | null;
  }>;
  const masterIds = Array.from(new Set(mappings.map((m) => String(m.master_item_id ?? "").trim()).filter(Boolean)));
  let aliasCanonicalProductNo = "";
  if (masterIds.length === 0 && !requestedMasterItemId) {
    const aliasHistoryRes = await sb
      .from("sales_channel_product_alias_history")
      .select("master_item_id, canonical_external_product_no")
      .eq("channel_id", channelId)
      .eq("alias_external_product_no", externalProductNo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (aliasHistoryRes.error) return jsonError(aliasHistoryRes.error.message ?? "별칭 이력 조회 실패", 500);
    const aliasMasterItemId = String(aliasHistoryRes.data?.master_item_id ?? "").trim();
    aliasCanonicalProductNo = String(aliasHistoryRes.data?.canonical_external_product_no ?? "").trim();
    if (aliasMasterItemId) masterIds.push(aliasMasterItemId);
  }
  if (masterIds.length > 1) {
    return jsonError("1 마스터 = 1 상품 제약 위반: 동일 product_no에 복수 master 매핑", 422, {
      channel_id: channelId,
      external_product_no: externalProductNo,
      master_item_ids: masterIds,
    });
  }
  if (requestedMasterItemId && masterIds.length > 0 && !masterIds.includes(requestedMasterItemId)) {
    return jsonError("master_item_id mismatch: 요청값과 product_no 매핑값이 다릅니다", 422, {
      requested_master_item_id: requestedMasterItemId,
      mapped_master_item_ids: masterIds,
      channel_id: channelId,
      external_product_no: externalProductNo,
    });
  }

  const resolvedMasterItemId = requestedMasterItemId || masterIds[0] || '';
  if (hasCurrentProductSyncProfile && !resolvedMasterItemId) {
    return jsonError('현재 상품 프로필을 저장할 master_item_id가 없습니다', 422);
  }
  if (resolvedMasterItemId) {
    const masterExistsRes = await sb
      .from("cms_master_item")
      .select("master_item_id")
      .eq("master_item_id", resolvedMasterItemId)
      .maybeSingle();
    if (masterExistsRes.error) return jsonError(masterExistsRes.error.message ?? "master 검증 실패", 500);
    if (!masterExistsRes.data) {
      return jsonError("master_item_id가 cms_master_item에 존재하지 않습니다", 422, {
        master_item_id: resolvedMasterItemId,
        channel_id: channelId,
        external_product_no: externalProductNo,
      });
    }
  }

  const detailProductNo = String(detailBeforeData.productNo ?? "").trim();
  const productNoCandidates = normalizeProductNoCandidates([externalProductNo, detailProductNo, aliasCanonicalProductNo]);
  let resolvedExternalProductNo = externalProductNo;

  if (resolvedMasterItemId) {
    const aliasRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id, master_item_id, external_product_no, external_variant_code, option_material_code, option_size_value, option_color_code, option_decoration_code")
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (aliasRes.error) return jsonError(aliasRes.error.message ?? "활성 별칭 매핑 조회 실패", 500);

    const aliasMappings = (aliasRes.data ?? []) as Array<{
      channel_product_id: string;
      master_item_id: string;
      external_product_no: string;
      external_variant_code: string | null;
      option_material_code: string | null;
      option_size_value: number | null;
      option_color_code: string | null;
      option_decoration_code: string | null;
    }>;
    if (mappings.length === 0 && aliasMappings.length > 0) {
      mappings = aliasMappings;
    }
    for (const row of aliasMappings) {
      const productNo = String(row.external_product_no ?? "").trim();
      if (productNo) productNoCandidates.push(productNo);
    }
  }

  const normalizedProductCandidates = normalizeProductNoCandidates(productNoCandidates);
  if (normalizedProductCandidates.length > 0) {
    let activeMappingQuery = sb
      .from("sales_channel_product")
      .select("channel_product_id, master_item_id, external_product_no, external_variant_code, option_material_code, option_size_value, option_color_code, option_decoration_code")
      .eq("channel_id", channelId)
      .eq("is_active", true);
    if (normalizedProductCandidates.length === 1) {
      activeMappingQuery = activeMappingQuery.eq("external_product_no", normalizedProductCandidates[0]);
    } else {
      activeMappingQuery = activeMappingQuery.in("external_product_no", normalizedProductCandidates);
    }

    const activeMappingRes = await activeMappingQuery.order("updated_at", { ascending: false });
    if (activeMappingRes.error) return jsonError(activeMappingRes.error.message ?? "활성 매핑 조회 실패", 500);

    const activeMappings = (activeMappingRes.data ?? []) as Array<{
      channel_product_id: string;
      master_item_id: string;
      external_product_no: string;
      external_variant_code: string | null;
      option_material_code: string | null;
      option_size_value: number | null;
      option_color_code: string | null;
      option_decoration_code: string | null;
    }>;

    if (activeMappings.length > 0) {
      const activeProductNos = Array.from(
        new Set(activeMappings.map((row) => String(row.external_product_no ?? "").trim()).filter(Boolean)),
      );
      if (activeProductNos.includes(externalProductNo)) {
        resolvedExternalProductNo = externalProductNo;
      } else if (detailProductNo && activeProductNos.includes(detailProductNo)) {
        resolvedExternalProductNo = detailProductNo;
      } else {
        resolvedExternalProductNo = activeProductNos.find((value) => /^P/i.test(value)) ?? activeProductNos[0] ?? externalProductNo;
      }

      const rowsForResolvedProduct = activeMappings.filter(
        (row) => String(row.external_product_no ?? "").trim() === resolvedExternalProductNo,
      );
      if (rowsForResolvedProduct.length > 0) {
        mappings = rowsForResolvedProduct;
      }
    }
  }

  if (resolvedExternalProductNo !== externalProductNo) {
    const canonicalDetailBefore = await cafe24GetProductDetail(account, accessToken, resolvedExternalProductNo);
    if (canonicalDetailBefore.ok && canonicalDetailBefore.data) {
      detailBeforeData = canonicalDetailBefore.data;
    }
  }

  if (resolvedMasterItemId) {
    const includeMasterPlatingLabor = !excludePlatingLabor;
    const platingMappingUpdateRes = await sb
      .from("sales_channel_product")
      .update({ include_master_plating_labor: includeMasterPlatingLabor })
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .eq("is_active", true);
    if (platingMappingUpdateRes.error) {
      return jsonError(platingMappingUpdateRes.error.message ?? "도금공임 포함 여부 저장 실패", 500);
    }
  }

  if (hasCurrentProductSyncProfile && resolvedMasterItemId) {
    const mappingProfileUpdateRes = await sb
      .from("sales_channel_product")
      .update({ current_product_sync_profile: currentProductSyncProfile })
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .eq("is_active", true)
      .select("channel_product_id");
    if (mappingProfileUpdateRes.error && !isMissingColumnError(mappingProfileUpdateRes.error, "sales_channel_product.current_product_sync_profile")) {
      return jsonError(mappingProfileUpdateRes.error.message ?? "현재 상품 프로필 저장 실패", 500);
    }
    if (!mappingProfileUpdateRes.error && (mappingProfileUpdateRes.data?.length ?? 0) === 0) {
      return jsonError("현재 상품 프로필을 저장할 활성 매핑이 없습니다", 422, {
        channel_id: channelId,
        master_item_id: resolvedMasterItemId,
        external_product_no: resolvedExternalProductNo,
        current_product_sync_profile: currentProductSyncProfile,
        updated: 0,
      });
    }
  }

  const isProfileOnlyUpdate = hasCurrentProductSyncProfile
    && !hasFloorUpdate
    && variantPatches.length === 0
    && !hasProductFieldUpdate
    && !syncFullPipelineRequested;

  if (isProfileOnlyUpdate) {
    let profileOnlyMeta: EditorMeta;
    try {
      profileOnlyMeta = await loadEditorMeta(sb, channelId, [resolvedExternalProductNo, externalProductNo, detailProductNo], resolvedMasterItemId, resolvedExternalProductNo);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "에디터 메타 조회 실패", 500);
    }

    let profileOnlyDetail = detailBeforeData;
    try {
      const dbAdditionalByVariant = await loadDbOptionAdditionalByVariant(
        sb,
        channelId,
        normalizeProductNoCandidates([resolvedExternalProductNo, externalProductNo, detailProductNo]),
      );
      profileOnlyDetail = applyDbOptionAdditionalToPreview(detailBeforeData, dbAdditionalByVariant);
    } catch {
      // fallback to Cafe24 detail when DB overlay read fails
    }

    return NextResponse.json(
      {
        ok: true,
        product_updated: false,
        variant_patch_total: 0,
        variant_patch_failed: 0,
        variant_verify_failed: 0,
        variant_results: [],
        data: { ...profileOnlyDetail, ...profileOnlyMeta, master_item_id: resolvedMasterItemId || null },
        post_apply_sync: {
          requested: false,
          ok: true,
          stage: "skipped",
          skipped_reason: "PROFILE_ONLY_UPDATE",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (hasFloorUpdate && resolvedMasterItemId) {
    const actor = "AUTO_PRICE_EDITOR_APPLY";
    const nowIso = new Date().toISOString();
    const deactivateRes = await sb
      .from("product_price_guard_v2")
      .update({ is_active: false, effective_to: nowIso, updated_at: nowIso, updated_by: actor })
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .eq("is_active", true);
    if (deactivateRes.error) return jsonError(deactivateRes.error.message ?? "기존 바닥가 비활성화 실패", 500);
    const insertFloorRes = await sb
      .from("product_price_guard_v2")
      .insert({
        channel_id: channelId,
        master_item_id: resolvedMasterItemId,
        floor_price_krw: toIntCeilNonNegative(floorPriceRaw),
        floor_source: "MANUAL",
        is_active: true,
        effective_from: nowIso,
        created_by: actor,
        updated_by: actor,
      });
    if (insertFloorRes.error) return jsonError(insertFloorRes.error.message ?? "바닥가 저장 실패", 500);
  }

  const canonicalVariantCodeByAnyCode = new Map<string, string>();
  const variantsMeta = await cafe24ListProductVariants(account, accessToken, resolvedExternalProductNo);
  if (variantsMeta.ok) {
    for (const variant of variantsMeta.variants) {
      const canonical = String(variant.variantCode ?? "").trim();
      const custom = String(variant.customVariantCode ?? "").trim();
      if (canonical) {
        canonicalVariantCodeByAnyCode.set(canonical, canonical);
      }
      if (custom) {
        canonicalVariantCodeByAnyCode.set(custom, canonical || custom);
      }
    }
  }

  const variantOptionPathByAnyCode = new Map<string, Array<{ name: string; value: string }>>();
  for (const variant of detailBeforeData.variants ?? []) {
    const canonical = String(variant.variantCode ?? "").trim();
    const custom = String(variant.customVariantCode ?? "").trim();
    const optionPath = (variant.options ?? []).map((o) => ({
      name: String(o.name ?? "").trim(),
      value: String(o.value ?? "").trim(),
    }));
    if (canonical) variantOptionPathByAnyCode.set(canonical, optionPath);
    if (custom) variantOptionPathByAnyCode.set(custom, optionPath);
  }

  const mappingByVariantCode = new Map<string, { channel_product_id: string; master_item_id: string; external_variant_code: string }>();
  for (const row of mappings) {
    const code = String(row.external_variant_code ?? "").trim();
    if (!code) continue;
    mappingByVariantCode.set(code, {
      channel_product_id: String(row.channel_product_id ?? "").trim(),
      master_item_id: String(row.master_item_id ?? "").trim(),
      external_variant_code: code,
    });
  }

  const tickRes = await sb
    .from("cms_v_market_tick_latest_gold_silver_ops_v1")
    .select("gold_price_krw_per_g, silver_price_krw_per_g")
    .maybeSingle();
  if (tickRes.error) return jsonError(tickRes.error.message ?? "시세 조회 실패", 500);

  let masterMeta: MasterMeta | null = null;
  if (resolvedMasterItemId) {
    const masterRes = await sb
      .from("cms_master_item")
      .select("material_code_default, weight_default_g, deduction_weight_default_g, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, plating_price_sell_default, center_qty_default, sub1_qty_default, sub2_qty_default")
      .eq("master_item_id", resolvedMasterItemId)
      .maybeSingle();
    if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 조회 실패", 500);
    masterMeta = (masterRes.data as MasterMeta | null) ?? null;
  }

  const latestSnapshotRes = resolvedMasterItemId
    ? await sb
      .from("pricing_snapshot")
      .select("labor_raw_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", resolvedMasterItemId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };
  if (latestSnapshotRes.error) return jsonError(latestSnapshotRes.error.message ?? "최근 스냅샷 조회 실패", 500);

  let basePriceResolved = Number.isFinite(Number(fields.price))
    ? toIntCeil(fields.price)
    : toIntCeil(detailBeforeData.price ?? 0);
  const retailPriceResolved = Number.isFinite(Number(fields.retail_price))
    ? toIntCeil(fields.retail_price)
    : (detailBeforeData.retailPrice != null ? toIntCeil(detailBeforeData.retailPrice) : null);

  let editorMetaBefore: EditorMeta;
  try {
    editorMetaBefore = await loadEditorMeta(sb, channelId, [resolvedExternalProductNo, externalProductNo], resolvedMasterItemId, resolvedExternalProductNo);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "에디터 메타 조회 실패", 500);
  }

  const floorPriceResolved = hasFloorUpdate
    ? toIntCeilNonNegative(floorPriceRaw)
    : toIntCeilNonNegative(editorMetaBefore.floor_price_krw ?? 0);

  const policyRes = await sb
    .from("pricing_policy")
    .select("margin_multiplier, rounding_unit, rounding_mode")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policyRes.error) return jsonError(policyRes.error.message ?? "가격 정책 조회 실패", 500);

  const marginMultiplier = Number(policyRes.data?.margin_multiplier ?? 1);
  const roundingUnit = Math.max(1, Math.round(Number(policyRes.data?.rounding_unit ?? 1000)));
  const roundingModeRaw = String(policyRes.data?.rounding_mode ?? "CEIL").trim().toUpperCase();
  const roundingMode = (roundingModeRaw === "FLOOR" || roundingModeRaw === "ROUND" || roundingModeRaw === "CEIL"
    ? roundingModeRaw
    : "CEIL") as "CEIL" | "ROUND" | "FLOOR";
  const floorWithMargin = Number.isFinite(marginMultiplier) && marginMultiplier > 0
    ? roundByMode(floorPriceResolved * marginMultiplier, roundingUnit, roundingMode)
    : floorPriceResolved;
  const effectiveFloorResolved = Math.max(floorPriceResolved, floorWithMargin);

  if (basePriceResolved < effectiveFloorResolved) {
    basePriceResolved = effectiveFloorResolved;
  }
  fields.price = basePriceResolved;

  const updateProductRes = await cafe24UpdateProductFields(account, accessToken, resolvedExternalProductNo, fields);
  if (!updateProductRes.ok) {
    return jsonError(updateProductRes.error ?? "상품 필드 수정 실패", updateProductRes.status || 500, {
      raw: updateProductRes.raw,
    });
  }

  const invalidVariantTargets = variantPatches
    .map((patch) => {
      const resolvedVariantCode = canonicalVariantCodeByAnyCode.get(patch.variant_code) ?? patch.variant_code;
      const additionalAmount = toIntCeil(patch.additional_amount);
      const finalPrice = toIntCeil(basePriceResolved + additionalAmount);
      return {
        requested_variant_code: patch.variant_code,
        resolved_variant_code: resolvedVariantCode,
        additional_amount: additionalAmount,
        final_price_krw: finalPrice,
      };
    })
    .filter((row) => row.final_price_krw <= 0);
  if (invalidVariantTargets.length > 0) {
    return jsonError("옵션 최종 판매가가 0 이하인 품목이 있어 반영할 수 없습니다", 422, {
      code: "INVALID_VARIANT_TARGET_PRICE",
      base_price_krw: basePriceResolved,
      effective_floor_price_krw: effectiveFloorResolved,
      invalid_variants: invalidVariantTargets,
    });
  }

  const platingSell = toIntCeilNonNegative(masterMeta?.plating_price_sell_default ?? 0);
  const laborFromSnapshot = toIntCeil((latestSnapshotRes.data as { labor_raw_krw?: number } | null)?.labor_raw_krw ?? Number.NaN, Number.NaN);
  const laborFallback = toIntCeilNonNegative(
    Number(masterMeta?.labor_base_sell ?? 0)
    + Number(masterMeta?.labor_center_sell ?? 0) * Math.max(Number(masterMeta?.center_qty_default ?? 0), 0)
    + Number(masterMeta?.labor_sub1_sell ?? 0) * Math.max(Number(masterMeta?.sub1_qty_default ?? 0), 0)
    + Number(masterMeta?.labor_sub2_sell ?? 0) * Math.max(Number(masterMeta?.sub2_qty_default ?? 0), 0)
    + Number(masterMeta?.plating_price_sell_default ?? 0),
  );
  const totalLaborRaw = Number.isFinite(laborFromSnapshot) ? laborFromSnapshot : laborFallback;
  const totalLaborAdjusted = Math.max(totalLaborRaw - (excludePlatingLabor ? platingSell : 0), 0);

  const weightG = Number(masterMeta?.weight_default_g ?? 0);
  const deductionWeightG = Number(masterMeta?.deduction_weight_default_g ?? 0);
  const netWeightG = Math.max(weightG - deductionWeightG, 0);

  const requestedStateRows = variantPatches.map((patch) => {
    const resolvedVariantCode = canonicalVariantCodeByAnyCode.get(patch.variant_code) ?? patch.variant_code;
    const mapping = mappingByVariantCode.get(resolvedVariantCode);
    const masterItemId = mapping?.master_item_id || resolvedMasterItemId;
    const sourceHash = [
      channelId,
      externalProductNo,
      resolvedVariantCode,
      String(basePriceResolved),
      String(patch.additional_amount),
      String(floorPriceResolved),
      excludePlatingLabor ? "1" : "0",
    ].join("|");
    return {
      channel_id: channelId,
      channel_product_id: mapping?.channel_product_id || null,
      master_item_id: masterItemId || null,
      external_product_no: resolvedExternalProductNo,
      external_variant_code: resolvedVariantCode,
      product_name: detailBeforeData.productName ?? null,
      option_path: variantOptionPathByAnyCode.get(resolvedVariantCode) ?? variantOptionPathByAnyCode.get(patch.variant_code) ?? [],
      material_code: String(masterMeta?.material_code_default ?? "").trim() || null,
      weight_g: Number.isFinite(weightG) ? weightG : null,
      deduction_weight_g: Number.isFinite(deductionWeightG) ? deductionWeightG : null,
      net_weight_g: Number.isFinite(netWeightG) ? netWeightG : null,
      material_price_krw: null,
      tick_gold_krw_per_g: toIntCeilNonNegative((tickRes.data as { gold_price_krw_per_g?: number } | null)?.gold_price_krw_per_g ?? 0),
      tick_silver_krw_per_g: toIntCeilNonNegative((tickRes.data as { silver_price_krw_per_g?: number } | null)?.silver_price_krw_per_g ?? 0),
      base_price_krw: basePriceResolved,
      retail_price_krw: retailPriceResolved,
      floor_price_krw: floorPriceResolved,
      exclude_plating_labor: excludePlatingLabor,
      plating_labor_sell_krw: platingSell,
      total_labor_sell_krw: totalLaborAdjusted,
      option_sync_delta_krw: toIntCeil(patch.additional_amount),
      final_target_additional_amount_krw: toIntCeil(patch.additional_amount),
      last_push_status: "PENDING",
      last_push_http_status: null,
      last_push_error: null,
      source_snapshot_hash: sourceHash,
      updated_by: "AUTO_PRICE_EDITOR_APPLY",
      created_by: "AUTO_PRICE_EDITOR_APPLY",
    };
  });

  if (requestedStateRows.length > 0) {
    const stateUpsertRes = await sb
      .from("channel_option_current_state_v1")
      .upsert(requestedStateRows, { onConflict: "channel_id,external_product_no,external_variant_code" })
      .select("state_id, channel_id, external_product_no, external_variant_code");
    if (stateUpsertRes.error) return jsonError(stateUpsertRes.error.message ?? "current_state 저장 실패", 500);

    const stateIdByVariant = new Map<string, string>();
    for (const row of (stateUpsertRes.data ?? []) as Array<{ state_id: string; external_variant_code: string }>) {
      const variantCode = String(row.external_variant_code ?? "").trim();
      const stateId = String(row.state_id ?? "").trim();
      if (variantCode && stateId) stateIdByVariant.set(variantCode, stateId);
    }

    const requestLogs = requestedStateRows.map((row) => ({
      state_id: stateIdByVariant.get(String(row.external_variant_code)) ?? null,
      channel_id: row.channel_id,
      channel_product_id: row.channel_product_id,
      master_item_id: row.master_item_id,
      external_product_no: row.external_product_no,
      external_variant_code: row.external_variant_code,
      action_type: "REQUESTED",
      result_status: "PENDING",
      expected_additional_amount_krw: row.final_target_additional_amount_krw,
      request_payload: {
        base_price_krw: row.base_price_krw,
        retail_price_krw: row.retail_price_krw,
        floor_price_krw: row.floor_price_krw,
        exclude_plating_labor: row.exclude_plating_labor,
      },
      source_snapshot_hash: row.source_snapshot_hash,
      triggered_by: "AUTO_PRICE_EDITOR_APPLY",
    }));
    if (requestLogs.length > 0) {
      const logInsertRes = await sb.from("channel_option_apply_log_v1").insert(requestLogs);
      if (logInsertRes.error) return jsonError(logInsertRes.error.message ?? "apply 로그(REQUESTED) 저장 실패", 500);
    }
  }

  const variantResults: Array<Record<string, unknown>> = [];
  const concurrency = 4;
  for (let i = 0; i < variantPatches.length; i += concurrency) {
    const chunk = variantPatches.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (patch) => {
        const resolvedVariantCode = canonicalVariantCodeByAnyCode.get(patch.variant_code) ?? patch.variant_code;
        const targetAdditionalAmount = toIntCeil(patch.additional_amount);
        const variantRes = await cafe24UpdateVariantAdditionalAmount(
          account,
          accessToken,
          resolvedExternalProductNo,
          resolvedVariantCode,
          targetAdditionalAmount,
        );
        return {
          requested_variant_code: patch.variant_code,
          resolved_variant_code: resolvedVariantCode,
          target_additional_amount: targetAdditionalAmount,
          ok: variantRes.ok,
          status: variantRes.status,
          error: variantRes.error ?? null,
          raw: variantRes.raw,
        };
      }),
    );
    variantResults.push(...chunkResults);
  }

  // Retry transport/API failures sequentially once to reduce transient 429/timeout misses.
  for (const row of variantResults) {
    if (row.ok === true) continue;
    const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    const targetAdditionalAmount = toIntCeil(row.target_additional_amount ?? 0);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const retryRes = await cafe24UpdateVariantAdditionalAmount(
      account,
      accessToken,
      resolvedExternalProductNo,
      resolvedVariantCode,
      targetAdditionalAmount,
    );
    row.ok = retryRes.ok;
    row.status = retryRes.status;
    row.error = retryRes.error ?? null;
    row.raw = retryRes.raw;
  }

  const failedVariants = variantResults.filter((row) => row.ok !== true);

  const expectedByVariant = new Map<string, number>();
  for (const row of variantResults) {
    const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    expectedByVariant.set(resolvedVariantCode, toIntCeil(row.target_additional_amount ?? 0));
  }

  const actualAdditionalByVariant = new Map<string, number | null>();
  let detailAfter = await cafe24GetProductDetail(account, accessToken, resolvedExternalProductNo);
  const hydrateActualMap = () => {
    actualAdditionalByVariant.clear();
    for (const variant of detailAfter.data?.variants ?? []) {
      const canonical = String(variant.variantCode ?? "").trim();
      const custom = String(variant.customVariantCode ?? "").trim();
      const additional = variant.additionalAmount == null ? null : toIntCeil(variant.additionalAmount);
      if (canonical) actualAdditionalByVariant.set(canonical, additional);
      if (custom) actualAdditionalByVariant.set(custom, additional);
    }
  };
  hydrateActualMap();

  // Backend-confirmed verification loop: wait briefly for Cafe24 read-after-write consistency.
  for (const waitMs of [250, 450, 700]) {
    const allMatched = Array.from(expectedByVariant.entries()).every(([variantCode, expected]) => {
      const actual = actualAdditionalByVariant.get(variantCode) ?? null;
      return actual !== null && actual === expected;
    });
    if (allMatched || failedVariants.length > 0) break;
    await sleep(waitMs);
    detailAfter = await cafe24GetProductDetail(account, accessToken, resolvedExternalProductNo);
    hydrateActualMap();
  }

  const resultStateRows = variantResults.map((row) => {
    const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    const expected = toIntCeil(row.target_additional_amount ?? 0);
    const actual = actualAdditionalByVariant.get(resolvedVariantCode) ?? null;
    const transportOk = row.ok === true;
    const verified = actual !== null && actual === expected;
    const status = !transportOk ? "FAILED" : (verified ? "SUCCEEDED" : "VERIFY_FAILED");
    return {
      channel_id: channelId,
      external_product_no: resolvedExternalProductNo,
      external_variant_code: resolvedVariantCode,
      last_pushed_additional_amount_krw: transportOk ? expected : null,
      last_push_status: status,
      last_push_http_status: Number.isFinite(Number(row.status)) ? Number(row.status) : null,
      last_push_error: !transportOk
        ? String(row.error ?? "variant apply failed")
        : (verified ? null : "verify pending or mismatch"),
      last_pushed_at: new Date().toISOString(),
      last_verified_at: verified ? new Date().toISOString() : null,
      updated_by: "AUTO_PRICE_EDITOR_APPLY",
    };
  }).filter((row) => row.external_variant_code);
  if (resultStateRows.length > 0) {
    for (const row of resultStateRows) {
      const stateUpdateRes = await sb
        .from("channel_option_current_state_v1")
        .update({
          last_pushed_additional_amount_krw: row.last_pushed_additional_amount_krw,
          last_push_status: row.last_push_status,
          last_push_http_status: row.last_push_http_status,
          last_push_error: row.last_push_error,
          last_pushed_at: row.last_pushed_at,
          last_verified_at: row.last_verified_at,
          updated_by: row.updated_by,
        })
        .eq("channel_id", row.channel_id)
        .eq("external_product_no", row.external_product_no)
        .eq("external_variant_code", row.external_variant_code);
      if (stateUpdateRes.error) return jsonError(stateUpdateRes.error.message ?? "current_state 반영결과 저장 실패", 500);
    }
  }

  const resultLogs = variantResults.map((row) => {
    const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    const expected = toIntCeil(row.target_additional_amount ?? 0);
    const actual = actualAdditionalByVariant.get(resolvedVariantCode) ?? null;
    const transportOk = row.ok === true;
    const verified = actual !== null && actual === expected;
    const logStatus = !transportOk ? "FAILED" : (verified ? "SUCCEEDED" : "VERIFY_FAILED");
    return {
      channel_id: channelId,
      channel_product_id: null,
      master_item_id: resolvedMasterItemId || null,
      external_product_no: resolvedExternalProductNo,
      external_variant_code: resolvedVariantCode || null,
      action_type: transportOk ? "VERIFIED" : "FAILED",
      result_status: logStatus,
      expected_additional_amount_krw: expected,
      actual_additional_amount_krw: actual,
      http_status: Number.isFinite(Number(row.status)) ? Number(row.status) : null,
      error_message: !transportOk
        ? String(row.error ?? "variant apply failed")
        : (verified ? null : "verify pending or mismatch"),
      response_payload: row.raw ?? null,
      verify_payload: {
        actual_additional_amount: actual,
      },
      source_snapshot_hash: [channelId, resolvedExternalProductNo, resolvedVariantCode, String(expected)].join("|"),
      triggered_by: "AUTO_PRICE_EDITOR_APPLY",
    };
  });
  if (resultLogs.length > 0) {
    const resultLogRes = await sb.from("channel_option_apply_log_v1").insert(resultLogs);
    if (resultLogRes.error) return jsonError(resultLogRes.error.message ?? "apply 로그(RESULT) 저장 실패", 500);
  }

  const strictFailedCount = variantResults.filter((row) => {
    return row.ok !== true;
  }).length;
  const verifyFailedCount = variantResults.filter((row) => {
    const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
    const expected = toIntCeil(row.target_additional_amount ?? 0);
    const actual = actualAdditionalByVariant.get(resolvedVariantCode) ?? null;
    return row.ok === true && (actual === null || actual !== expected);
  }).length;

  const fallbackMeta: EditorMeta = {
    floor_price_krw: floorPriceResolved,
    exclude_plating_labor: excludePlatingLabor,
    plating_labor_sell_krw: platingSell,
    total_labor_sell_krw: totalLaborAdjusted,
    tick_gold_krw_per_g: toIntCeilNonNegative((tickRes.data as { gold_price_krw_per_g?: number } | null)?.gold_price_krw_per_g ?? 0),
    tick_silver_krw_per_g: toIntCeilNonNegative((tickRes.data as { silver_price_krw_per_g?: number } | null)?.silver_price_krw_per_g ?? 0),
    current_product_sync_profile: currentProductSyncProfile ?? editorMetaBefore.current_product_sync_profile,
  };

  const buildFallbackPreview = () => {
    let fallback = applyExpectedProductFieldsToPreview(detailBeforeData, fields);
    fallback = applyExpectedVariantAdditionalToPreview(fallback, expectedByVariant, variantResults);
    return {
      ...fallback,
      ...fallbackMeta,
      master_item_id: resolvedMasterItemId || null,
    };
  };

  const runPostApplySync = async (): Promise<PostApplySyncResult> => {
    if (!syncFullPipeline) {
      return {
        requested: syncFullPipelineRequested,
        ok: true,
        stage: "skipped",
        skipped_reason: syncFullPipelineRequested ? "SYNC_NOT_CONFIRMED" : "NOT_REQUESTED",
      };
    }

    const masterItemIds = resolvedMasterItemId ? [resolvedMasterItemId] : [];
    if (masterItemIds.length === 0) {
      return {
        requested: true,
        ok: true,
        stage: "skipped",
        skipped_reason: "NO_MASTER_ITEM_ID",
        error: "활성 매핑(master_item_id)이 없어 재계산/동기화를 생략했습니다",
      };
    }

    const recomputeRes = await recomputePost(
      mkJsonRequest("/api/pricing/recompute", {
        channel_id: channelId,
        master_item_ids: masterItemIds,
      }),
    );
    const recomputeRaw = await recomputeRes.json().catch(() => null);
    const recomputeBody = recomputeRaw && typeof recomputeRaw === "object" && !Array.isArray(recomputeRaw)
      ? (recomputeRaw as Record<string, unknown>)
      : {};

    if (!recomputeRes.ok) {
      return {
        requested: true,
        ok: false,
        stage: "recompute",
        recompute_status: recomputeRes.status,
        error: String(recomputeBody.error ?? recomputeBody.message ?? "pricing recompute failed"),
        detail: recomputeRaw,
      };
    }

    const computeRequestId = String(recomputeBody.compute_request_id ?? "").trim();
    if (!computeRequestId) {
      return {
        requested: true,
        ok: false,
        stage: "recompute",
        recompute_status: recomputeRes.status,
        error: "재계산 결과 compute_request_id가 없습니다",
        detail: recomputeRaw,
      };
    }

    const unresolvedOrUnverified = variantResults.some((row) => {
      if (row.ok !== true) return true;
      const resolvedVariantCode = String(row.resolved_variant_code ?? row.requested_variant_code ?? "").trim();
      const expected = toIntCeil(row.target_additional_amount ?? 0);
      const actual = actualAdditionalByVariant.get(resolvedVariantCode) ?? null;
      return actual === null || actual !== expected;
    });
    if (unresolvedOrUnverified) {
      return {
        requested: true,
        ok: false,
        stage: "skipped",
        skipped_reason: "EDITOR_VARIANT_NOT_STABLE",
        compute_request_id: computeRequestId,
        recompute_status: recomputeRes.status,
        error: "에디터 옵션 반영이 미검증 상태여서 자동 동기화를 생략했습니다",
      };
    }

    const patchedVariantCodes = new Set(
      variantPatches
        .map((patch) => canonicalVariantCodeByAnyCode.get(patch.variant_code) ?? patch.variant_code)
        .map((code) => String(code ?? "").trim())
        .filter(Boolean),
    );
    const safeMappings = mappings.filter((row) => {
      const variantCode = String(row.external_variant_code ?? "").trim();
      if (!variantCode) return true;
      return !patchedVariantCodes.has(variantCode);
    });

    const channelProductIds = Array.from(
      new Set(
        safeMappings
          .map((row) => String(row.channel_product_id ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (channelProductIds.length === 0) {
      return {
        requested: true,
        ok: true,
        stage: "done",
        skipped_reason: "NO_SAFE_PUSH_TARGETS",
        compute_request_id: computeRequestId,
        recompute_status: recomputeRes.status,
        success: 0,
        failed: 0,
        skipped: 0,
      };
    }

    const pushRes = await pushPost(
      mkJsonRequest("/api/channel-prices/push", {
        channel_id: channelId,
        channel_product_ids: channelProductIds,
        compute_request_id: computeRequestId,
        run_type: "MANUAL",
        dry_run: false,
      }),
    );
    const pushRaw = await pushRes.json().catch(() => null);
    const pushBody = pushRaw && typeof pushRaw === "object" && !Array.isArray(pushRaw)
      ? (pushRaw as Record<string, unknown>)
      : {};

    if (!pushRes.ok) {
      return {
        requested: true,
        ok: false,
        stage: "push",
        compute_request_id: computeRequestId,
        recompute_status: recomputeRes.status,
        push_status: pushRes.status,
        error: String(pushBody.error ?? pushBody.message ?? "channel price push failed"),
        detail: pushRaw,
      };
    }

    const num = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    return {
      requested: true,
      ok: true,
      stage: "done",
      compute_request_id: computeRequestId,
      recompute_status: recomputeRes.status,
      push_status: pushRes.status,
      job_id: String(pushBody.job_id ?? "").trim() || null,
      success: num(pushBody.success),
      failed: num(pushBody.failed),
      skipped: num(pushBody.skipped),
    };
  };

  if (failedVariants.length > 0 || strictFailedCount > 0) {
    let detailAfterWithMeta: (Cafe24ProductDetailSummary & Partial<EditorMeta> & { master_item_id?: string | null }) | null = null;
    if (detailAfter.ok && detailAfter.data) {
      detailAfterWithMeta = { ...detailAfter.data, ...fallbackMeta };
      try {
    const metaAfter = await loadEditorMeta(sb, channelId, [resolvedExternalProductNo, externalProductNo], resolvedMasterItemId, resolvedExternalProductNo);
        detailAfterWithMeta = { ...detailAfter.data, ...metaAfter };
      } catch {
        // keep original detailAfter.data
      }
      if (detailAfterWithMeta) {
        detailAfterWithMeta = { ...detailAfterWithMeta, ...fallbackMeta };
        detailAfterWithMeta = applyExpectedProductFieldsToPreview(detailAfterWithMeta, fields);
        detailAfterWithMeta = applyExpectedVariantAdditionalToPreview(detailAfterWithMeta, expectedByVariant, variantResults);
        detailAfterWithMeta = { ...detailAfterWithMeta, master_item_id: resolvedMasterItemId || null };
      }
    } else {
      detailAfterWithMeta = buildFallbackPreview();
    }
    const postApplySync = await runPostApplySync();
    return NextResponse.json(
      {
        ok: false,
        product_updated: true,
        message: "옵션가(additional_amount) 반영에 실패한 variant가 있습니다",
        variant_patch_total: variantResults.length,
        variant_patch_failed: strictFailedCount,
        variant_verify_failed: verifyFailedCount,
        variant_results: variantResults,
        data: detailAfterWithMeta,
        post_apply_sync: postApplySync,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let finalData: (Cafe24ProductDetailSummary & Partial<EditorMeta> & { master_item_id?: string | null }) | null = null;
  if (detailAfter.ok && detailAfter.data) {
    finalData = { ...detailAfter.data, ...fallbackMeta };
    try {
    const metaAfter = await loadEditorMeta(sb, channelId, [resolvedExternalProductNo, externalProductNo], resolvedMasterItemId, resolvedExternalProductNo);
      finalData = { ...detailAfter.data, ...metaAfter };
    } catch {
      // keep detailAfter.data
    }
    if (finalData) {
      finalData = { ...finalData, ...fallbackMeta };
      finalData = applyExpectedProductFieldsToPreview(finalData, fields);
      finalData = applyExpectedVariantAdditionalToPreview(finalData, expectedByVariant, variantResults);
      finalData = { ...finalData, master_item_id: resolvedMasterItemId || null };
    }
  } else {
    finalData = buildFallbackPreview();
  }

  const postApplySync = await runPostApplySync();

  return NextResponse.json(
    {
      ok: true,
      product_updated: true,
      variant_patch_total: variantResults.length,
      variant_patch_failed: strictFailedCount,
      variant_verify_failed: verifyFailedCount,
      variant_results: variantResults,
      data: finalData,
      post_apply_sync: postApplySync,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
