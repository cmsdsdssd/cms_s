import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";
import {
  cafe24ListProductVariants,
  cafe24GetProductPrice,
  cafe24GetVariantPrice,
  cafe24UpdateProductOptionLabels,
  cafe24UpdateProductPrice,
  cafe24UpdateVariantAdditionalAmount,
  ensureValidCafe24AccessToken,
  loadCafe24Account,
} from "@/lib/shop/cafe24";
import { loadPublishedBaseStateByMasterIds, loadPublishedPriceStateByChannelProducts, loadPublishedPriceStateByVersion } from "@/lib/shop/publish-price-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERIFY_RETRY_DELAYS_MS = [600, 1200, 2000, 3500, 5000] as const;
const IN_QUERY_CHUNK_SIZE = 500;
const ITEM_INSERT_CHUNK_SIZE = 1000;

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
};

const computeThresholdKrw = (
  absoluteMinKrw: number,
  rate: number,
  baselineKrw: number | null | undefined,
): number => {
  const normalizedAbsolute = Number.isFinite(absoluteMinKrw) ? Math.max(0, Math.round(absoluteMinKrw)) : 0;
  const normalizedRate = Number.isFinite(rate) ? Math.max(0, rate) : 0;
  const normalizedBaseline = Number.isFinite(Number(baselineKrw ?? Number.NaN))
    ? Math.abs(Math.round(Number(baselineKrw)))
    : 0;
  return Math.max(normalizedAbsolute, Math.round(normalizedBaseline * normalizedRate));
};

async function verifyAppliedPrice(
  account: Awaited<ReturnType<typeof loadCafe24Account>> extends infer T ? NonNullable<T> : never,
  accessToken: string,
  externalProductNo: string,
  expectedPrice: number,
): Promise<{ ok: boolean; current: number | null; status: number; raw: unknown; error?: string }> {
  let last = await cafe24GetProductPrice(account, accessToken, externalProductNo);
  if (!last.ok) {
    return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "verify failed" };
  }

  for (const waitMs of VERIFY_RETRY_DELAYS_MS) {
    if (last.currentPriceKrw === expectedPrice) {
      return { ok: true, current: last.currentPriceKrw, status: last.status, raw: last.raw };
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    last = await cafe24GetProductPrice(account, accessToken, externalProductNo);
    if (!last.ok) {
      return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "verify failed" };
    }
  }

  return {
    ok: last.currentPriceKrw === expectedPrice,
    current: last.currentPriceKrw,
    status: last.status,
    raw: last.raw,
    error: last.currentPriceKrw === expectedPrice ? undefined : `VERIFY_MISMATCH expected=${expectedPrice} actual=${last.currentPriceKrw ?? "null"}`,
  };
}

async function verifyAppliedVariantPrice(
  account: Awaited<ReturnType<typeof loadCafe24Account>> extends infer T ? NonNullable<T> : never,
  accessToken: string,
  externalProductNo: string,
  externalVariantCode: string,
  expectedPrice: number,
  expectedAdditionalAmount?: number,
): Promise<{ ok: boolean; current: number | null; status: number; raw: unknown; error?: string }> {
  let last = await cafe24GetVariantPrice(account, accessToken, externalProductNo, externalVariantCode);
  if (!last.ok) {
    return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "variant verify failed" };
  }

  const verifyMatched = (currentPrice: number | null): boolean => currentPrice === expectedPrice;
  const additionalMatched = (additionalAmount: number | null): boolean => {
    if (typeof expectedAdditionalAmount !== "number" || !Number.isFinite(expectedAdditionalAmount)) return true;
    if (additionalAmount == null || !Number.isFinite(Number(additionalAmount))) return false;
    return Math.round(Number(additionalAmount)) === Math.round(expectedAdditionalAmount);
  };

  for (const waitMs of VERIFY_RETRY_DELAYS_MS) {
    if (verifyMatched(last.currentPriceKrw) && additionalMatched(last.additionalAmount)) {
      return { ok: true, current: last.currentPriceKrw, status: last.status, raw: last.raw };
    }
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    last = await cafe24GetVariantPrice(account, accessToken, externalProductNo, externalVariantCode);
    if (!last.ok) {
      return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "variant verify failed" };
    }
  }

  const expectedAdditionalLabel =
    typeof expectedAdditionalAmount === "number" && Number.isFinite(expectedAdditionalAmount)
      ? ` expected_additional=${Math.round(expectedAdditionalAmount)} actual_additional=${last.additionalAmount ?? "null"}`
      : "";

  const matchedByPrice = verifyMatched(last.currentPriceKrw);
  const matchedByAdditional = additionalMatched(last.additionalAmount);
  const verificationAccepted = matchedByPrice && matchedByAdditional;
  return {
    ok: verificationAccepted,
    current: last.currentPriceKrw,
    status: last.status,
    raw: last.raw,
    error: verificationAccepted
      ? undefined
      : `VERIFY_MISMATCH expected=${expectedPrice} actual=${last.currentPriceKrw ?? "null"}${expectedAdditionalLabel}`,
  };
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.hostname !== "internal.local") {
    return jsonError("channel-prices/push is internal-only; use price-sync-runs-v2 execute flow", 403);
  }

  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const channelProductIds = parseUuidArray(body.channel_product_ids);
  const pinnedComputeRequestId = String(body.publish_version ?? body.compute_request_id ?? "").trim();
  const runType = String(body.run_type ?? "MANUAL").toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
  const dryRun = body.dry_run === true;
  // Never rewrite option labels during price push. Price sync must only update
  // base price and variant additional amounts.
  const syncOptionLabels = false;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!dryRun && !pinnedComputeRequestId) {
    return jsonError("publish_version is required for deterministic push", 400);
  }

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("채널 계정이 없습니다", 422);

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "카페24 토큰 확인 실패", 422);
  }

  const listVariantsWithRefresh = async (externalProductNo: string) => {
    let variants = await cafe24ListProductVariants(account, accessToken, externalProductNo);
    if (!variants.ok && variants.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        variants = await cafe24ListProductVariants(account, accessToken, externalProductNo);
      } catch {
        // keep original 401 result
      }
    }
    return variants;
  };

  const logicalTargetKey = (masterItemId: string, externalVariantCode: string) => `${masterItemId}::${externalVariantCode || "BASE"}`;
  const baseTargetKey = (masterItemId: string, externalProductNo: string) => `${masterItemId}::${externalProductNo || "BASE"}`;
  const allowVariantAdditionalOverride = true;
  let pinnedTargetByChannelProduct = new Map<string, number>();
  let pinnedTargetByLogical = new Map<string, number>();
  let pinnedRawByChannelProduct = new Map<string, number>();
  let pinnedRawByLogical = new Map<string, number>();
  let pinnedAdditionalByChannelProduct = new Map<string, number>();
  let pinnedAdditionalByLogical = new Map<string, number>();
  const pinnedBaseTargetByMaster = new Map<string, number>();
  const pinnedBaseTargetByProduct = new Map<string, number>();
  const pinnedBaseRawTargetByMaster = new Map<string, number>();
  const pinnedBaseRawTargetByProduct = new Map<string, number>();

  const publishedRes = Array.isArray(channelProductIds) && channelProductIds.length > 0
    ? await loadPublishedPriceStateByChannelProducts({ sb, channelId, channelProductIds, publishVersions: [pinnedComputeRequestId] })
    : await loadPublishedPriceStateByVersion({ sb, channelId, publishVersion: pinnedComputeRequestId });
  if (!publishedRes.available || publishedRes.rowsByChannelProduct.size === 0) {
    return jsonError("publish rows are required for deterministic push", 422, {
      code: "PUBLISHED_PRICE_ROWS_REQUIRED",
      publish_version: pinnedComputeRequestId,
    });
  }

  const activeMapQuery = sb
    .from("sales_channel_product")
    .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("external_variant_code", { ascending: true });
  const activeMapRes = Array.isArray(channelProductIds) && channelProductIds.length > 0
    ? await activeMapQuery.in("channel_product_id", channelProductIds)
    : await activeMapQuery;
  if (activeMapRes.error) return jsonError(activeMapRes.error.message ?? "활성 매핑 조회 실패", 500);
  const activeMapRows = (activeMapRes.data ?? []).filter((row) => publishedRes.rowsByChannelProduct.has(String(row.channel_product_id ?? "").trim()));
  if (activeMapRows.length === 0) {
    return jsonError("active published mappings are required for push", 422, {
      code: "ACTIVE_PUBLISHED_MAPPINGS_REQUIRED",
      publish_version: pinnedComputeRequestId,
    });
  }

  if (Array.isArray(channelProductIds) && channelProductIds.length > 0) {
    const activeIds = new Set(activeMapRows.map((row) => String(row.channel_product_id ?? "").trim()));
    const missingIds = channelProductIds.filter((id) => !activeIds.has(id));
    if (missingIds.length > 0) {
      return jsonError("inactive or unpublished channel_product_id is included", 422, {
        code: "PUBLISHED_MAPPING_MISMATCH",
        publish_version: pinnedComputeRequestId,
        missing_channel_product_ids: missingIds,
      });
    }
  }

  const currentRows: Array<{ channel_product_id: string | null; current_price_krw: number | null }> = [];
  const activeIdsForCurrent = activeMapRows.map((row) => String(row.channel_product_id ?? "").trim()).filter(Boolean);
  for (const idChunk of chunkArray(activeIdsForCurrent, IN_QUERY_CHUNK_SIZE)) {
    if (idChunk.length === 0) continue;
    const currentRes = await sb
      .from("channel_price_snapshot_latest")
      .select("channel_product_id, current_price_krw")
      .eq("channel_id", channelId)
      .in("channel_product_id", idChunk);
    if (currentRes.error) return jsonError(currentRes.error.message ?? "현재 채널 가격 조회 실패", 500);
    currentRows.push(...(currentRes.data ?? []));
  }
  const currentByChannelProduct = new Map<string, number>();
  for (const row of currentRows) {
    const id = String(row.channel_product_id ?? "").trim();
    const current = Number(row.current_price_krw ?? Number.NaN);
    if (!id || !Number.isFinite(current) || currentByChannelProduct.has(id)) continue;
    currentByChannelProduct.set(id, Math.round(current));
  }

  const publishedRows = Array.from(publishedRes.rowsByChannelProduct.values());
  for (const row of publishedRows) {
    if (Number.isFinite(Number(row.targetPriceRawKrw ?? Number.NaN))) {
      pinnedRawByChannelProduct.set(row.channelProductId, Math.round(Number(row.targetPriceRawKrw)));
      pinnedRawByLogical.set(logicalTargetKey(row.masterItemId, row.externalVariantCode), Math.round(Number(row.targetPriceRawKrw)));
    }
    pinnedAdditionalByChannelProduct.set(row.channelProductId, row.publishedAdditionalAmountKrw);
    pinnedAdditionalByLogical.set(logicalTargetKey(row.masterItemId, row.externalVariantCode), row.publishedAdditionalAmountKrw);
    if (!row.externalVariantCode) {
      pinnedBaseTargetByMaster.set(row.masterItemId, row.publishedBasePriceKrw);
      pinnedBaseTargetByProduct.set(baseTargetKey(row.masterItemId, row.externalProductNo), row.publishedBasePriceKrw);
      if (Number.isFinite(Number(row.targetPriceRawKrw ?? Number.NaN))) {
        pinnedBaseRawTargetByMaster.set(row.masterItemId, Math.round(Number(row.targetPriceRawKrw)));
        pinnedBaseRawTargetByProduct.set(baseTargetKey(row.masterItemId, row.externalProductNo), Math.round(Number(row.targetPriceRawKrw)));
      }
    }
  }

  const candidateRows = activeMapRows
    .map((mapping) => {
      const id = String(mapping.channel_product_id ?? "").trim();
      const published = publishedRes.rowsByChannelProduct.get(id) ?? null;
      const masterKey = String(mapping.master_item_id ?? "").trim();
      const productNo = String(mapping.external_product_no ?? "").trim();
      const variantCode = String(mapping.external_variant_code ?? "").trim();
      if (!published || !masterKey || !productNo) return null;
      const exactBaseKey = baseTargetKey(masterKey, productNo);
      const exactPublishedBasePrice = pinnedBaseTargetByProduct.get(exactBaseKey);
      if (variantCode && !Number.isFinite(Number(exactPublishedBasePrice ?? Number.NaN))) {
        return {
          missingExactPublishedBase: true as const,
          channel_product_id: id,
          master_item_id: masterKey,
          external_product_no: productNo,
          external_variant_code: variantCode,
          publish_version: pinnedComputeRequestId,
        };
      }
      const basePrice = variantCode ? Math.round(Number(exactPublishedBasePrice)) : published.publishedBasePriceKrw;
      const totalPrice = variantCode ? basePrice + published.publishedAdditionalAmountKrw : published.publishedBasePriceKrw;
      pinnedTargetByChannelProduct.set(id, totalPrice);
      pinnedTargetByLogical.set(logicalTargetKey(masterKey, variantCode), totalPrice);
      return {
        channel_id: String(mapping.channel_id ?? "").trim() || null,
        channel_product_id: id || null,
        master_item_id: masterKey || null,
        external_product_no: productNo || null,
        external_variant_code: variantCode || null,
        target_price_raw_krw: published.targetPriceRawKrw,
        final_target_price_krw: totalPrice,
        current_channel_price_krw: currentByChannelProduct.get(id) ?? null,
      };
    });

  const missingExactPublishedBase = candidateRows.find(
    (row): row is {
      missingExactPublishedBase: true;
      channel_product_id: string;
      master_item_id: string;
      external_product_no: string;
      external_variant_code: string;
      publish_version: string;
    } => row !== null && "missingExactPublishedBase" in row,
  );

  if (missingExactPublishedBase) {
    return jsonError("variant push requires an exact published base row for the same master/product/publish version", 422, {
      code: "EXACT_PUBLISHED_BASE_ROW_REQUIRED",
      channel_product_id: missingExactPublishedBase.channel_product_id,
      master_item_id: missingExactPublishedBase.master_item_id,
      external_product_no: missingExactPublishedBase.external_product_no,
      external_variant_code: missingExactPublishedBase.external_variant_code,
      publish_version: missingExactPublishedBase.publish_version,
    });
  }

  const sortedCandidates = candidateRows
    .filter((row): row is Exclude<NonNullable<typeof row>, { missingExactPublishedBase: true }> => (
      row !== null && !("missingExactPublishedBase" in row)
    ))
    .sort((a, b) => {
      const am = String(a.master_item_id ?? "");
      const bm = String(b.master_item_id ?? "");
      if (am !== bm) return am.localeCompare(bm);
      const av = String(a.external_variant_code ?? "").trim();
      const bv = String(b.external_variant_code ?? "").trim();
      if (!av && bv) return -1;
      if (av && !bv) return 1;
      return av.localeCompare(bv);
    });

  const masterBaseRawTarget = new Map<string, number>(pinnedBaseRawTargetByMaster);
  const productBaseRawTarget = new Map<string, number>(pinnedBaseRawTargetByProduct);
  const masterFallbackTarget = new Map<string, number>(pinnedBaseTargetByMaster);
  const productFallbackTarget = new Map<string, number>(pinnedBaseTargetByProduct);

  const resolveVariantAdditionalOverride = (channelProductId: string, masterKey: string, variantCode: string): number | undefined => {
    const byChannelProduct = pinnedAdditionalByChannelProduct.get(channelProductId);
    if (Number.isFinite(Number(byChannelProduct))) return Math.round(Number(byChannelProduct));
    const byLogical = pinnedAdditionalByLogical.get(logicalTargetKey(masterKey, variantCode));
    if (Number.isFinite(Number(byLogical))) return Math.round(Number(byLogical));
    return undefined;
  };

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: sortedCandidates.length,
      data: sortedCandidates,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const jobRes = await sb
    .from("price_sync_job")
    .insert({
      channel_id: channelId,
      run_type: runType,
      status: "RUNNING",
      request_payload: body,
      started_at: new Date().toISOString(),
    })
    .select("job_id")
    .single();

  if (jobRes.error) return jsonError(jobRes.error.message ?? "동기화 작업 생성 실패", 500);
  const jobId = jobRes.data.job_id as string;

  const itemRows = [] as Array<Record<string, unknown>>;
  const successfulVariantDeltaByProduct = new Map<string, Map<string, number>>();
  const labelDeltaByProduct = new Map<string, Map<string, number>>();
  const blockedMastersByBaseFailure = new Set<string>();
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const variantStateRows = [] as Array<{
    channel_id: string;
    external_product_no: string;
    external_variant_code: string;
    final_target_additional_amount_krw: number;
    last_pushed_additional_amount_krw: number | null;
    last_push_status: "SUCCEEDED" | "FAILED" | "VERIFY_FAILED";
    last_push_http_status: number | null;
    last_push_error: string | null;
    last_pushed_at: string | null;
    last_verified_at: string | null;
  }>;

  const recordVariantState = (args: {
    channel_id: string;
    external_product_no: string;
    external_variant_code: string;
    final_target_additional_amount_krw: number;
    last_pushed_additional_amount_krw: number | null;
    last_push_status: "SUCCEEDED" | "FAILED" | "VERIFY_FAILED";
    last_push_http_status: number | null;
    last_push_error: string | null;
    last_pushed_at?: string | null;
    last_verified_at?: string | null;
  }) => {
    if (!args.external_variant_code) return;
    variantStateRows.push({
      ...args,
      last_pushed_at: args.last_pushed_at ?? null,
      last_verified_at: args.last_verified_at ?? null,
    });
  };

  const formatOptionTextWithDelta = (baseText: string, delta: number): string => {
    const stripped = String(baseText ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();
    if (!Number.isFinite(delta) || Math.round(delta) === 0) return stripped;
    const amount = Math.abs(Math.round(delta)).toLocaleString();
    const sign = delta >= 0 ? "+" : "-";
    return `${stripped} (${sign}${amount}원)`;
  };

  const pickRepresentativeDelta = (deltas: Set<number>): number | null => {
    const values = Array.from(deltas.values()).map((v) => Math.round(Number(v))).filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    const freq = new Map<number, number>();
    for (const value of values) {
      freq.set(value, (freq.get(value) ?? 0) + 1);
    }
    const ranked = Array.from(freq.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const absDiff = Math.abs(a[0]) - Math.abs(b[0]);
      if (absDiff !== 0) return absDiff;
      return a[0] - b[0];
    });
    return ranked[0]?.[0] ?? null;
  };

  const stripPriceDeltaSuffix = (text: string): string =>
    String(text ?? "").replace(/\s*\([+-][\d,]+원\)\s*$/u, "").trim();

  function extractProductLike(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    const direct = obj.product;
    if (direct && typeof direct === "object") return direct as Record<string, unknown>;
    const list = Array.isArray(obj.products) ? obj.products : [];
    const first = list[0];
    if (first && typeof first === "object") return first as Record<string, unknown>;
    const nestedResource = obj.resource;
    if (nestedResource && typeof nestedResource === "object") {
      const nestedObj = nestedResource as Record<string, unknown>;
      if (nestedObj.product && typeof nestedObj.product === "object") {
        return nestedObj.product as Record<string, unknown>;
      }
      const nestedProducts = Array.isArray(nestedObj.products) ? nestedObj.products : [];
      const nestedFirst = nestedProducts[0];
      if (nestedFirst && typeof nestedFirst === "object") {
        return nestedFirst as Record<string, unknown>;
      }
    }
    return null;
  }

  function hasOptionProduct(raw: unknown): boolean {
    const product = extractProductLike(raw);
    return String(product?.has_option ?? "").trim().toUpperCase() === "T";
  }

  function getOptionType(raw: unknown): string {
    const product = extractProductLike(raw);
    return String(product?.option_type ?? "").trim().toUpperCase();
  }

  async function resolveBasePriceForVariantAdditional(externalProductNo: string): Promise<{ ok: true; basePrice: number; optionType: string } | { ok: false; status: number; raw: unknown; error: string; optionType: string }> {
    const base = await getBaseSnapshot(externalProductNo);
    const optionType = base.ok ? getOptionType(base.raw) : "";
    if (!base.ok || base.currentPriceKrw === null) {
      return {
        ok: false,
        status: base.status,
        raw: base.raw,
        error: base.error ?? "base product price required for variant update",
        optionType,
      };
    }

    const basePrice = base.currentPriceKrw;

    return { ok: true, basePrice, optionType };
  }

  async function getBaseSnapshot(externalProductNo: string) {
    let base = await cafe24GetProductPrice(account!, accessToken, externalProductNo);
    if (!base.ok && base.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb!, account!);
        base = await cafe24GetProductPrice(account!, accessToken, externalProductNo);
      } catch {
        // keep original 401 result
      }
    }
    return base;
  }

  async function filterActiveCandidates<T extends { channel_product_id?: unknown }>(rows: T[]): Promise<T[]> {
    const ids = Array.from(new Set(rows.map((r) => String(r.channel_product_id ?? "").trim()).filter(Boolean)));
    if (ids.length === 0) return [];
    const activeSet = new Set<string>();
    for (const idChunk of chunkArray(ids, IN_QUERY_CHUNK_SIZE)) {
      if (idChunk.length === 0) continue;
      const activeRes = await sb!
        .from("sales_channel_product")
        .select("channel_product_id")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .in("channel_product_id", idChunk);
      if (activeRes.error) return rows;
      for (const row of activeRes.data ?? []) activeSet.add(String(row.channel_product_id));
    }
    return rows.filter((r) => activeSet.has(String(r.channel_product_id ?? "")));
  }

  for (const c of sortedCandidates) {
    const masterKey = String(c.master_item_id ?? "").trim();
    const variantCode = String(c.external_variant_code ?? "").trim();
    const externalProductNo = String(c.external_product_no ?? "");

    const rawTarget = Number(c.final_target_price_krw);
    const productBaseKey = baseTargetKey(masterKey, externalProductNo);
    let targetPrice = Number.isFinite(rawTarget) ? Math.round(rawTarget) : Number.NaN;

    const overrideAdditionalForValidation = allowVariantAdditionalOverride && variantCode
      ? resolveVariantAdditionalOverride(String(c.channel_product_id ?? "").trim(), masterKey, variantCode)
      : undefined;
    if ((!Number.isFinite(targetPrice) || targetPrice <= 0) && !Number.isFinite(Number(overrideAdditionalForValidation ?? Number.NaN))) {
      if (!variantCode && masterKey) blockedMastersByBaseFailure.add(masterKey);
      failedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: String(c.channel_id ?? "").trim(),
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        external_variant_code: variantCode,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: 0,
        after_price_krw: c.current_channel_price_krw,
        status: "FAILED",
        http_status: 422,
        error_code: "INVALID_TARGET_PRICE",
        error_message: "target price must be > 0",
        raw_response_json: { target: c.final_target_price_krw },
      });
      continue;
    }

    if (variantCode && masterKey && blockedMastersByBaseFailure.has(masterKey)) {
      skippedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: String(c.channel_id ?? "").trim(),
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        external_variant_code: variantCode,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: targetPrice,
        after_price_krw: c.current_channel_price_krw,
        status: "SKIPPED",
        http_status: null,
        error_code: "BASE_PRICE_UNSTABLE",
        error_message: "기준(base) 가격 반영이 안정화되지 않아 variant 반영을 건너뜀",
        raw_response_json: { blocked_master_item_id: masterKey },
      });
      continue;
    }

    let expectedAdditionalAmount: number | undefined;
    let targetPriceForPush = targetPrice;
    const overrideAdditionalAmount = allowVariantAdditionalOverride && variantCode
      ? resolveVariantAdditionalOverride(String(c.channel_product_id ?? "").trim(), masterKey, variantCode)
      : undefined;
    const preferredBaseForThreshold = Number(productFallbackTarget.get(productBaseKey) ?? masterFallbackTarget.get(masterKey));
    const baseForThreshold = Number.isFinite(preferredBaseForThreshold) ? Math.round(preferredBaseForThreshold) : null;
    const plannedAdditionalAmount = variantCode
      ? (Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN))
        ? Math.round(Number(overrideAdditionalAmount))
        : (baseForThreshold !== null ? (targetPrice - baseForThreshold) : undefined))
      : undefined;

    let pushRes = variantCode
      ? await (async () => {
        const baseResolved = await resolveBasePriceForVariantAdditional(externalProductNo);
        if (!baseResolved.ok) {
          return {
            ok: false,
            status: baseResolved.status,
            raw: baseResolved.raw,
            error: baseResolved.error,
            attempt_key: "variant_base_price_lookup",
          };
        }

        const baseForDelta = baseResolved.basePrice;
        const additionalAmount = Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN))
          ? Math.round(Number(overrideAdditionalAmount))
          : (targetPrice - baseForDelta);
        targetPriceForPush = baseForDelta + additionalAmount;
        expectedAdditionalAmount = additionalAmount;
        return cafe24UpdateVariantAdditionalAmount(
          account,
          accessToken,
          externalProductNo,
          variantCode,
          additionalAmount,
        );
      })()
      : await cafe24UpdateProductPrice(account, accessToken, externalProductNo, targetPrice);

    if (!pushRes.ok && pushRes.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        pushRes = variantCode
          ? await (async () => {
            const baseResolved = await resolveBasePriceForVariantAdditional(externalProductNo);
            if (!baseResolved.ok) {
              return {
                ok: false,
                status: baseResolved.status,
                raw: baseResolved.raw,
                error: baseResolved.error,
                attempt_key: "variant_base_price_lookup",
              };
            }

            const baseForDelta = baseResolved.basePrice;
            const additionalAmount = Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN))
              ? Math.round(Number(overrideAdditionalAmount))
              : (targetPrice - baseForDelta);
            targetPriceForPush = baseForDelta + additionalAmount;
            expectedAdditionalAmount = additionalAmount;
            return cafe24UpdateVariantAdditionalAmount(
              account,
              accessToken,
              externalProductNo,
              variantCode,
              additionalAmount,
            );
          })()
          : await cafe24UpdateProductPrice(account, accessToken, externalProductNo, targetPrice);
      } catch {
        // keep original 401 result
      }
    }

    if (pushRes.ok) {
      const verify = variantCode
        ? await verifyAppliedVariantPrice(
          account,
          accessToken,
          String(c.external_product_no),
          variantCode,
          targetPriceForPush,
          expectedAdditionalAmount,
        )
        : await verifyAppliedPrice(account, accessToken, String(c.external_product_no), targetPrice);

      const verifyPendingAccepted = false;
      if (verify.ok) {
        successCount += 1;
        if (variantCode && Number.isFinite(Number(expectedAdditionalAmount ?? Number.NaN))) {
          const delta = Math.round(Number(expectedAdditionalAmount));
          const byVariant = successfulVariantDeltaByProduct.get(String(c.external_product_no)) ?? new Map<string, number>();
          byVariant.set(variantCode, delta);
          successfulVariantDeltaByProduct.set(String(c.external_product_no), byVariant);
        }
        itemRows.push({
          job_id: jobId,
          channel_id: String(c.channel_id ?? "").trim(),
          channel_product_id: c.channel_product_id,
          master_item_id: c.master_item_id,
          external_product_no: c.external_product_no,
          external_variant_code: variantCode,
          before_price_krw: c.current_channel_price_krw,
          target_price_krw: variantCode ? targetPriceForPush : targetPrice,
          after_price_krw: verify.ok
            ? (verify.current ?? (variantCode ? targetPriceForPush : targetPrice))
            : (variantCode ? targetPriceForPush : targetPrice),
          status: "SUCCESS",
          http_status: pushRes.status,
          error_code: null,
          error_message: null,
          raw_response_json: {
            push: pushRes.raw,
            verify: verify.raw,
            verify_pending_accepted: verifyPendingAccepted,
          },
        });
        if (variantCode && Number.isFinite(Number(expectedAdditionalAmount ?? Number.NaN))) {
          recordVariantState({
            channel_id: String(c.channel_id ?? "").trim(),
            external_product_no: externalProductNo,
            external_variant_code: variantCode,
            final_target_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
            last_pushed_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
            last_push_status: "SUCCEEDED",
            last_push_http_status: pushRes.status,
            last_push_error: null,
            last_pushed_at: new Date().toISOString(),
            last_verified_at: verify.ok ? new Date().toISOString() : null,
          });
        }
      } else {
        let retryRecorded = false;
        if (variantCode) {
          const retryBase = await resolveBasePriceForVariantAdditional(externalProductNo);
          if (retryBase.ok) {
            expectedAdditionalAmount = Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN)) ? Math.round(Number(overrideAdditionalAmount)) : (targetPrice - retryBase.basePrice);
            targetPriceForPush = retryBase.basePrice + expectedAdditionalAmount;
            const retryPush = await cafe24UpdateVariantAdditionalAmount(
              account,
              accessToken,
              externalProductNo,
              variantCode,
              expectedAdditionalAmount,
            );
            if (retryPush.ok) {
              const retryVerify = await verifyAppliedVariantPrice(
                account,
                accessToken,
                String(c.external_product_no),
                variantCode,
                targetPriceForPush,
                expectedAdditionalAmount,
              );
              if (retryVerify.ok) {
                successCount += 1;
                itemRows.push({
                  job_id: jobId,
                  channel_id: String(c.channel_id ?? "").trim(),
                  channel_product_id: c.channel_product_id,
                  master_item_id: c.master_item_id,
                  external_product_no: c.external_product_no,
                  external_variant_code: variantCode,
                  before_price_krw: c.current_channel_price_krw,
                  target_price_krw: variantCode ? targetPriceForPush : targetPrice,
                  after_price_krw: retryVerify.current ?? (variantCode ? targetPriceForPush : targetPrice),
                  status: "SUCCESS",
                  http_status: retryPush.status,
                  error_code: null,
                  error_message: null,
                  raw_response_json: {
                    push: pushRes.raw,
                    verify: verify.raw,
                    retry: { push: retryPush.raw, verify: retryVerify.raw, retry_reason: "VERIFY_MISMATCH_RETRY_WITH_FRESH_BASE" },
                  },
                });
                if (Number.isFinite(Number(expectedAdditionalAmount ?? Number.NaN))) {
                  recordVariantState({
                    channel_id: String(c.channel_id ?? "").trim(),
                    external_product_no: externalProductNo,
                    external_variant_code: variantCode,
                    final_target_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
                    last_pushed_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
                    last_push_status: "SUCCEEDED",
                    last_push_http_status: retryPush.status,
                    last_push_error: null,
                    last_pushed_at: new Date().toISOString(),
                    last_verified_at: new Date().toISOString(),
                  });
                }
                retryRecorded = true;
              }
            }
          }
        } else {
          const retryPush = await cafe24UpdateProductPrice(account, accessToken, externalProductNo, targetPrice);
          if (retryPush.ok) {
            const retryVerify = await verifyAppliedPrice(account, accessToken, String(c.external_product_no), targetPrice);
            const retryPendingAccepted = false;
            if (retryVerify.ok) {
              successCount += 1;
              itemRows.push({
                job_id: jobId,
                channel_id: String(c.channel_id ?? "").trim(),
                channel_product_id: c.channel_product_id,
                master_item_id: c.master_item_id,
                external_product_no: c.external_product_no,
                external_variant_code: variantCode,
                before_price_krw: c.current_channel_price_krw,
                target_price_krw: variantCode ? targetPriceForPush : targetPrice,
                after_price_krw: retryVerify.ok
                  ? (retryVerify.current ?? (variantCode ? targetPriceForPush : targetPrice))
                  : (variantCode ? targetPriceForPush : targetPrice),
                status: "SUCCESS",
                http_status: retryPush.status,
                error_code: null,
                error_message: null,
                raw_response_json: {
                  push: pushRes.raw,
                  verify: verify.raw,
                  retry: {
                    push: retryPush.raw,
                    verify: retryVerify.raw,
                    retry_reason: "VERIFY_MISMATCH_RETRY_PRODUCT_PRICE",
                    verify_pending_accepted: retryPendingAccepted,
                  },
                },
              });
              retryRecorded = true;
            }
          }
        }

        if (retryRecorded) {
          continue;
        }

        failedCount += 1;
        if (!variantCode && masterKey) blockedMastersByBaseFailure.add(masterKey);
        itemRows.push({
          job_id: jobId,
          channel_id: String(c.channel_id ?? "").trim(),
          channel_product_id: c.channel_product_id,
          master_item_id: c.master_item_id,
          external_product_no: c.external_product_no,
          external_variant_code: variantCode,
          before_price_krw: c.current_channel_price_krw,
          target_price_krw: variantCode ? targetPriceForPush : targetPrice,
          after_price_krw: verify.current ?? c.current_channel_price_krw,
          status: "FAILED",
          http_status: verify.status || pushRes.status,
          error_code: "VERIFY_MISMATCH",
          error_message: `${verify.error ?? "push succeeded but verify mismatch"}${pushRes.attempt_key ? ` (attempt=${pushRes.attempt_key})` : ""}`,
          raw_response_json: { push: pushRes.raw, verify: verify.raw, mismatch_reason: "VERIFY_MISMATCH_AFTER_WRITE_OK" },
        });
        if (variantCode && Number.isFinite(Number(expectedAdditionalAmount ?? Number.NaN))) {
          recordVariantState({
            channel_id: String(c.channel_id ?? "").trim(),
            external_product_no: externalProductNo,
            external_variant_code: variantCode,
            final_target_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
            last_pushed_additional_amount_krw: null,
            last_push_status: "VERIFY_FAILED",
            last_push_http_status: Number.isFinite(Number(verify.status || pushRes.status)) ? Number(verify.status || pushRes.status) : null,
            last_push_error: `${verify.error ?? "push succeeded but verify mismatch"}${pushRes.attempt_key ? ` (attempt=${pushRes.attempt_key})` : ""}`,
            last_pushed_at: new Date().toISOString(),
            last_verified_at: null,
          });
        }
      }
    } else {
      const pushErrorMessage = String(pushRes.error ?? "");
      const noApiFound = /no api found/i.test(pushErrorMessage);
      const itemStatus = "FAILED";
      failedCount += 1;
      if (!variantCode && masterKey) blockedMastersByBaseFailure.add(masterKey);
      itemRows.push({
        job_id: jobId,
        channel_id: String(c.channel_id ?? "").trim(),
        channel_product_id: c.channel_product_id,
        master_item_id: c.master_item_id,
        external_product_no: c.external_product_no,
        external_variant_code: variantCode,
        before_price_krw: c.current_channel_price_krw,
        target_price_krw: variantCode ? targetPriceForPush : targetPrice,
        after_price_krw: c.current_channel_price_krw,
        status: itemStatus,
        http_status: pushRes.status,
        error_code: noApiFound ? "PRODUCT_ENDPOINT_NOT_FOUND" : `HTTP_${pushRes.status}`,
        error_message: noApiFound
          ? "카페24 상품 엔드포인트를 찾지 못했습니다(상품번호/코드 매핑 확인 필요)"
          : (pushRes.error ?? "카페24 push 실패"),
        raw_response_json: noApiFound
          ? { push: pushRes.raw, external_product_no: externalProductNo, external_variant_code: variantCode || null }
          : pushRes.raw,
      });
      if (variantCode && Number.isFinite(Number(expectedAdditionalAmount ?? Number.NaN))) {
        recordVariantState({
          channel_id: String(c.channel_id ?? "").trim(),
          external_product_no: externalProductNo,
          external_variant_code: variantCode,
          final_target_additional_amount_krw: Math.round(Number(expectedAdditionalAmount)),
          last_pushed_additional_amount_krw: null,
          last_push_status: "FAILED",
          last_push_http_status: pushRes.status,
          last_push_error: noApiFound
            ? "카페24 상품 엔드포인트를 찾지 못했습니다(상품번호/코드 매핑 확인 필요)"
            : (pushRes.error ?? "카페24 push 실패"),
          last_pushed_at: new Date().toISOString(),
          last_verified_at: null,
        });
      }
    }
  }

  if (syncOptionLabels) {
    for (const [productNo, byVariant] of successfulVariantDeltaByProduct.entries()) {
      labelDeltaByProduct.set(productNo, new Map(byVariant));
    }
    for (const c of sortedCandidates) {
      const variantCode = String(c.external_variant_code ?? "").trim();
      if (!variantCode) continue;
      const externalProductNo = String(c.external_product_no ?? "").trim();
      const masterKey = String(c.master_item_id ?? "").trim();
      if (!externalProductNo || !masterKey) continue;

      const overrideAdditionalAmount = allowVariantAdditionalOverride
        ? resolveVariantAdditionalOverride(String(c.channel_product_id ?? "").trim(), masterKey, variantCode)
        : undefined;
      if (Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN))) {
        const byVariant = labelDeltaByProduct.get(externalProductNo) ?? new Map<string, number>();
        byVariant.set(variantCode, Math.round(Number(overrideAdditionalAmount)));
        labelDeltaByProduct.set(externalProductNo, byVariant);
        continue;
      }

      let targetPrice = Number.isFinite(Number(c.final_target_price_krw ?? Number.NaN)) ? Math.round(Number(c.final_target_price_krw)) : Number.NaN;
      const productBaseKey = baseTargetKey(masterKey, externalProductNo);
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) continue;

      const preferredBaseForDelta = productFallbackTarget.get(productBaseKey) ?? masterFallbackTarget.get(masterKey);
      let basePriceForDelta: number | null = Number.isFinite(Number(preferredBaseForDelta ?? Number.NaN))
        ? Math.round(Number(preferredBaseForDelta))
        : null;
      if (basePriceForDelta === null) {
        const base = await getBaseSnapshot(externalProductNo);
        if (base.ok && base.currentPriceKrw !== null) basePriceForDelta = base.currentPriceKrw;
      }
      if (basePriceForDelta === null) continue;

      const delta = Math.round(targetPrice - basePriceForDelta);
      const byVariant = labelDeltaByProduct.get(externalProductNo) ?? new Map<string, number>();
      byVariant.set(variantCode, delta);
      labelDeltaByProduct.set(externalProductNo, byVariant);
    }
  }

  const labelSyncErrors: Array<{ external_product_no: string; error: string }> = [];
  if (syncOptionLabels && labelDeltaByProduct.size > 0) {
    for (const [externalProductNo, deltaByVariant] of labelDeltaByProduct.entries()) {
      let variantsRes = await cafe24ListProductVariants(account, accessToken, externalProductNo);
      if (!variantsRes.ok && variantsRes.status === 401) {
        try {
          accessToken = await ensureValidCafe24AccessToken(sb, account);
          variantsRes = await cafe24ListProductVariants(account, accessToken, externalProductNo);
        } catch {
          // keep original failure
        }
      }
      if (!variantsRes.ok) {
        labelSyncErrors.push({ external_product_no: externalProductNo, error: variantsRes.error ?? "variant 목록 조회 실패" });
        continue;
      }

      const optionGroups = new Map<string, { optionName: string; currentTextRaw: string; normalizedText: string; deltas: Set<number> }>();
      const optionOrder = variantsRes.variants.find((v) => v.options.length > 0)?.options.map((o) => String(o.name ?? "").trim()).filter(Boolean) ?? [];
      const firstAxisName = optionOrder[0] ?? "";
      const secondAxisName = optionOrder[1] ?? "";
      const variantAxisMap = new Map<string, { firstValue: string; secondValue: string }>();
      for (const variant of variantsRes.variants) {
        const firstOpt = variant.options.find((o) => String(o.name ?? "").trim() === firstAxisName);
        const secondOpt = variant.options.find((o) => String(o.name ?? "").trim() === secondAxisName);
        variantAxisMap.set(String(variant.variantCode ?? "").trim(), {
          firstValue: stripPriceDeltaSuffix(String(firstOpt?.value ?? "").trim()),
          secondValue: stripPriceDeltaSuffix(String(secondOpt?.value ?? "").trim()),
        });
      }

      const firstAxisBaseDeltaByValue = new Map<string, number>();
      for (const variant of variantsRes.variants) {
        const variantCode = String(variant.variantCode ?? "").trim();
        const delta = deltaByVariant.get(variantCode);
        if (delta === undefined) continue;
        const axis = variantAxisMap.get(variantCode);
        const firstValue = String(axis?.firstValue ?? "").trim();
        if (!firstValue) continue;
        const prev = firstAxisBaseDeltaByValue.get(firstValue);
        if (prev == null || Math.round(delta) < prev) {
          firstAxisBaseDeltaByValue.set(firstValue, Math.round(delta));
        }
      }

      const secondAxisResidualByValue = new Map<string, Set<number>>();
      for (const variant of variantsRes.variants) {
        const variantCode = String(variant.variantCode ?? "").trim();
        const delta = deltaByVariant.get(variantCode);
        if (delta === undefined) continue;
        const axis = variantAxisMap.get(variantCode);
        const firstValue = String(axis?.firstValue ?? "").trim();
        const secondValue = String(axis?.secondValue ?? "").trim();
        if (!firstValue || !secondValue) continue;
        const firstBase = firstAxisBaseDeltaByValue.get(firstValue);
        if (firstBase == null) continue;
        const residual = Math.round(delta) - firstBase;
        const prev = secondAxisResidualByValue.get(secondValue) ?? new Set<number>();
        prev.add(residual);
        secondAxisResidualByValue.set(secondValue, prev);
      }

      const secondAxisDeltaByValue = new Map<string, number>();
      for (const [value, deltas] of secondAxisResidualByValue.entries()) {
        const picked = pickRepresentativeDelta(deltas);
        if (picked != null) secondAxisDeltaByValue.set(value, picked);
      }

      for (const variant of variantsRes.variants) {
        const variantCode = String(variant.variantCode ?? "").trim();
        const totalDelta = deltaByVariant.get(variantCode);
        if (totalDelta === undefined) continue;
        for (const opt of variant.options) {
          const optionName = String(opt.name ?? "").trim();
          const optionValueTextRaw = String(opt.value ?? "").trim();
          const optionValueText = stripPriceDeltaSuffix(optionValueTextRaw);
          if (!optionName || !optionValueText) continue;

          let deltaForLabel: number = Math.round(totalDelta);
          if (optionName === firstAxisName) {
            const firstDelta = firstAxisBaseDeltaByValue.get(optionValueText);
            if (firstDelta != null) deltaForLabel = firstDelta;
          } else if (optionName === secondAxisName) {
            const secondDelta = secondAxisDeltaByValue.get(optionValueText);
            if (secondDelta != null) deltaForLabel = secondDelta;
          }

          const key = `${optionName}::${optionValueText}`;
          const prev = optionGroups.get(key) ?? { optionName, currentTextRaw: optionValueTextRaw || optionValueText, normalizedText: optionValueText, deltas: new Set<number>() };
          prev.deltas.add(deltaForLabel);
          if (!prev.currentTextRaw && optionValueTextRaw) prev.currentTextRaw = optionValueTextRaw;
          optionGroups.set(key, prev);
        }
      }

      const updates = Array.from(optionGroups.values())
        .map((g) => {
          const delta = pickRepresentativeDelta(g.deltas);
          if (delta === null) return null;
          return {
            optionName: g.optionName,
            currentText: g.currentTextRaw,
            nextText: formatOptionTextWithDelta(g.normalizedText, delta),
          };
        })
        .filter((u): u is { optionName: string; currentText: string; nextText: string } => Boolean(u))
        .filter((u) => u.currentText !== u.nextText);

      if (updates.length === 0) continue;

      let labelRes = await cafe24UpdateProductOptionLabels(account, accessToken, externalProductNo, updates);
      if (!labelRes.ok && labelRes.status === 401) {
        try {
          accessToken = await ensureValidCafe24AccessToken(sb, account);
          labelRes = await cafe24UpdateProductOptionLabels(account, accessToken, externalProductNo, updates);
        } catch {
          // keep original failure
        }
      }
      if (!labelRes.ok) {
        labelSyncErrors.push({ external_product_no: externalProductNo, error: labelRes.error ?? "옵션명 라벨 동기화 실패" });
      }
    }
  }

  if (itemRows.length > 0) {
    for (const chunk of chunkArray(itemRows, ITEM_INSERT_CHUNK_SIZE)) {
      if (chunk.length === 0) continue;
      const itemRes = await sb.from("price_sync_job_item").insert(chunk);
      if (itemRes.error) return jsonError(itemRes.error.message ?? "동기화 작업 아이템 저장 실패", 500);
    }
  }

  if (variantStateRows.length > 0) {
    for (const row of variantStateRows) {
      const stateUpdateRes = await sb
        .from("channel_option_current_state_v1")
        .update({
          final_target_additional_amount_krw: row.final_target_additional_amount_krw,
          last_pushed_additional_amount_krw: row.last_pushed_additional_amount_krw,
          last_push_status: row.last_push_status,
          last_push_http_status: row.last_push_http_status,
          last_push_error: row.last_push_error,
          last_pushed_at: row.last_pushed_at,
          last_verified_at: row.last_verified_at,
          updated_by: "AUTO_SYNC_PUSH",
        })
        .eq("channel_id", row.channel_id)
        .eq("external_product_no", row.external_product_no)
        .eq("external_variant_code", row.external_variant_code);
      if (stateUpdateRes.error && !String(stateUpdateRes.error.message ?? "").toLowerCase().includes("could not find the table")) return jsonError(stateUpdateRes.error.message ?? "옵션 현재상태 반영결과 저장 실패", 500);
    }
  }

  if (pinnedComputeRequestId && itemRows.length > 0) {
    const liveStateRows = itemRows
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const channelProductId = String(row.channel_product_id ?? "").trim();
        const channelIdValue = String(row.channel_id ?? "").trim();
        const externalProductNo = String(row.external_product_no ?? "").trim();
        if (!channelProductId || !channelIdValue || !externalProductNo) return null;
        const externalVariantCode = String(row.external_variant_code ?? "").trim();
        const status = String(row.status ?? "").trim().toUpperCase();
        if (status === "SKIPPED") return null;
        const targetPrice = Number(row.target_price_krw ?? Number.NaN);
        const afterPrice = Number(row.after_price_krw ?? Number.NaN);
        const liveTotalPriceKrw = Number.isFinite(afterPrice)
          ? Math.round(afterPrice)
          : (Number.isFinite(targetPrice) ? Math.round(targetPrice) : null);
        const errorCode = String(row.error_code ?? "").trim() || null;
        return {
          channel_product_id: channelProductId,
          channel_id: channelIdValue,
          master_item_id: String(row.master_item_id ?? "").trim() || null,
          external_product_no: externalProductNo,
          external_variant_code: externalVariantCode,
          publish_version: pinnedComputeRequestId,
          live_base_price_krw: externalVariantCode ? null : liveTotalPriceKrw,
          live_additional_amount_krw: externalVariantCode
            ? (variantStateRows.find((state) => state.external_product_no === externalProductNo && state.external_variant_code === externalVariantCode)?.last_pushed_additional_amount_krw ?? null)
            : null,
          live_total_price_krw: liveTotalPriceKrw,
          sync_status: status === "SUCCESS"
            ? "SYNCED"
            : errorCode === "VERIFY_MISMATCH"
              ? "VERIFY_FAILED"
              : "FAILED",
          last_error_code: errorCode,
          last_error_message: String(row.error_message ?? "").trim() || null,
          verified_at: status === "SUCCESS" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (liveStateRows.length > 0) {
      const liveStateRes = await sb
        .from("product_price_live_state_v1")
        .upsert(liveStateRows, { onConflict: "channel_product_id,publish_version" });
      if (liveStateRes.error) return jsonError(liveStateRes.error.message ?? "publish live state upsert failed", 500);
    }
  }

  const finalStatus =
    sortedCandidates.length === 0
      ? "SUCCESS"
      : failedCount === 0
        ? (skippedCount > 0 ? "PARTIAL" : "SUCCESS")
        : successCount === 0
          ? "FAILED"
          : "PARTIAL";

  const finishRes = await sb
    .from("price_sync_job")
    .update({
      status: finalStatus,
      success_count: successCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      finished_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);
  if (finishRes.error) return jsonError(finishRes.error.message ?? "동기화 작업 마감 실패", 500);

  return NextResponse.json({
    ok: true,
    job_id: jobId,
    publish_version: pinnedComputeRequestId || null,
    compute_request_id: pinnedComputeRequestId || null,
    total: sortedCandidates.length,
    success: successCount,
    failed: failedCount,
    skipped: skippedCount,
    label_sync: {
      enabled: syncOptionLabels,
      failed: labelSyncErrors.length,
      failed_examples: labelSyncErrors.slice(0, 5),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
