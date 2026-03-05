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
import { restoreVariantTargetFromRawDelta } from "@/lib/shop/price-sync-guards";

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

const isNumericProductNo = (productNo: string): boolean => /^[0-9]+$/u.test(String(productNo ?? "").trim());
const looksCanonicalProductCode = (productNo: string): boolean => /^P/i.test(String(productNo ?? "").trim());

const shouldPreferProductNo = (currentProductNo: string, nextProductNo: string): boolean => {
  const current = String(currentProductNo ?? "").trim();
  const next = String(nextProductNo ?? "").trim();
  if (!current && next) return true;
  if (!next) return false;
  const currentNumeric = isNumericProductNo(current);
  const nextNumeric = isNumericProductNo(next);
  if (nextNumeric !== currentNumeric) return nextNumeric;
  const currentCanonical = looksCanonicalProductCode(current);
  const nextCanonical = looksCanonicalProductCode(next);
  if (nextCanonical !== currentCanonical) return nextCanonical;
  return next.localeCompare(current) < 0;
};

const isProductWriteAcceptedButVerifyPending = (raw: unknown, expectedPrice: number): boolean => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const payload = raw as Record<string, unknown>;
  if (payload.verify_pending !== true) return false;
  const verifyExpected = Math.round(Number(payload.verify_expected ?? Number.NaN));
  if (!Number.isFinite(verifyExpected) || verifyExpected !== Math.round(expectedPrice)) return false;
  const response = payload.response;
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  const product = (response as Record<string, unknown>).product;
  if (!product || typeof product !== "object" || Array.isArray(product)) return false;
  const responsePrice = Math.round(Number((product as Record<string, unknown>).price ?? Number.NaN));
  return Number.isFinite(responsePrice) && responsePrice === Math.round(expectedPrice);
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
  const hasExpectedAdditional = typeof expectedAdditionalAmount === "number" && Number.isFinite(expectedAdditionalAmount);
  const verificationAccepted = hasExpectedAdditional ? matchedByAdditional : (matchedByPrice && matchedByAdditional);
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
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const channelProductIds = parseUuidArray(body.channel_product_ids);
  const pinnedComputeRequestId = String(body.compute_request_id ?? "").trim();
  const runType = String(body.run_type ?? "MANUAL").toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
  const dryRun = body.dry_run === true;
  const syncOptionLabels = body.sync_option_labels !== false;

  const desiredTargetByChannelProduct = new Map<string, number>();
  const desiredRaw = body.desired_target_price_by_channel_product;
  if (desiredRaw && typeof desiredRaw === "object" && !Array.isArray(desiredRaw)) {
    for (const [key, value] of Object.entries(desiredRaw as Record<string, unknown>)) {
      const channelProductId = String(key ?? "").trim();
      if (!channelProductId) continue;
      const desired = Math.round(Number(value ?? Number.NaN));
      if (!Number.isFinite(desired) || desired <= 0) continue;
      desiredTargetByChannelProduct.set(channelProductId, desired);
    }
  }

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!dryRun && !pinnedComputeRequestId) {
    return jsonError("compute_request_id is required for deterministic push", 400);
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

  const initialRows: Array<{
    channel_id: string | null;
    channel_product_id: string | null;
    master_item_id: string | null;
    external_product_no: string | null;
    external_variant_code: string | null;
    target_price_raw_krw: number | null;
    final_target_price_krw: number | null;
    current_channel_price_krw: number | null;
  }> = [];
  if (channelProductIds && channelProductIds.length > 0) {
    for (const idChunk of chunkArray(channelProductIds, IN_QUERY_CHUNK_SIZE)) {
      if (idChunk.length === 0) continue;
      const initialRes = await sb
        .from("v_channel_price_dashboard")
        .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, target_price_raw_krw, final_target_price_krw, current_channel_price_krw")
        .eq("channel_id", channelId)
        .in("channel_product_id", idChunk);
      if (initialRes.error) return jsonError(initialRes.error.message ?? "반영 대상 조회 실패", 500);
      initialRows.push(...(initialRes.data ?? []));
    }
  } else {
    const initialRes = await sb
      .from("v_channel_price_dashboard")
      .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, target_price_raw_krw, final_target_price_krw, current_channel_price_krw")
      .eq("channel_id", channelId);
    if (initialRes.error) return jsonError(initialRes.error.message ?? "반영 대상 조회 실패", 500);
    initialRows.push(...(initialRes.data ?? []));
  }
  const initialCandidates = await filterActiveCandidates(
    initialRows.filter((r) => r.channel_product_id && r.external_product_no),
  );

  const logicalTargetKey = (masterItemId: string, externalVariantCode: string) => `${masterItemId}::${externalVariantCode || "BASE"}`;
  const allowVariantAdditionalOverride = pinnedComputeRequestId.length === 0;
  let pinnedTargetByChannelProduct = new Map<string, number>();
  let pinnedTargetByLogical = new Map<string, number>();
  if (pinnedComputeRequestId) {
    const pinnedRows: Array<{
      channel_product_id: string | null;
      master_item_id: string | null;
      final_target_price_krw: number | null;
    }> = [];
    if (channelProductIds && channelProductIds.length > 0) {
      for (const idChunk of chunkArray(channelProductIds, IN_QUERY_CHUNK_SIZE)) {
        if (idChunk.length === 0) continue;
        const pinnedRes = await sb
          .from("pricing_snapshot")
          .select("channel_product_id, master_item_id, final_target_price_krw")
          .eq("channel_id", channelId)
          .eq("compute_request_id", pinnedComputeRequestId)
          .in("channel_product_id", idChunk);
        if (pinnedRes.error) return jsonError(pinnedRes.error.message ?? "고정 스냅샷 조회 실패", 500);
        pinnedRows.push(...(pinnedRes.data ?? []));
      }
    } else {
      const pinnedRes = await sb
        .from("pricing_snapshot")
        .select("channel_product_id, master_item_id, final_target_price_krw")
        .eq("channel_id", channelId)
        .eq("compute_request_id", pinnedComputeRequestId);
      if (pinnedRes.error) return jsonError(pinnedRes.error.message ?? "고정 스냅샷 조회 실패", 500);
      pinnedRows.push(...(pinnedRes.data ?? []));
    }
    const pinnedPairs: Array<[string, number]> = pinnedRows
      .map((r) => [String(r.channel_product_id ?? "").trim(), Number(r.final_target_price_krw)] as [string, number])
      .filter(([id, target]) => id.length > 0 && Number.isFinite(target))
      .map(([id, target]) => [id, Math.round(target)] as [string, number]);
    pinnedTargetByChannelProduct = new Map<string, number>(pinnedPairs);

    const pinnedChannelProductIds = Array.from(
      new Set(
        pinnedRows
          .map((r) => String(r.channel_product_id ?? "").trim())
          .filter(Boolean),
      ),
    );
    const variantCodeByChannelProduct = new Map<string, string>();
    for (const idChunk of chunkArray(pinnedChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
      if (idChunk.length === 0) continue;
      const mapRes = await sb
        .from("sales_channel_product")
        .select("channel_product_id, external_variant_code")
        .in("channel_product_id", idChunk);
      if (mapRes.error) return jsonError(mapRes.error.message ?? "고정 스냅샷 매핑 조회 실패", 500);
      for (const row of mapRes.data ?? []) {
        const channelProductId = String(row.channel_product_id ?? "").trim();
        if (!channelProductId) continue;
        variantCodeByChannelProduct.set(channelProductId, String(row.external_variant_code ?? "").trim());
      }
    }

    const pinnedLogicalPairs: Array<[string, number]> = pinnedRows
      .map((r) => {
        const masterId = String(r.master_item_id ?? "").trim();
        const channelProductId = String(r.channel_product_id ?? "").trim();
        const variantCode = variantCodeByChannelProduct.get(channelProductId) ?? "";
        const target = Number(r.final_target_price_krw);
        if (!masterId || !Number.isFinite(target)) return null;
        return [logicalTargetKey(masterId, variantCode), Math.round(target)] as [string, number];
      })
      .filter((pair): pair is [string, number] => pair !== null);
    pinnedTargetByLogical = new Map<string, number>(pinnedLogicalPairs);
    if (pinnedTargetByChannelProduct.size === 0) {
      return jsonError("해당 compute_request_id로 사용할 대상 스냅샷이 없습니다", 422);
    }
  }

  const baseRows = initialCandidates.filter((r) => String(r.external_variant_code ?? "").trim().length === 0);
  if (baseRows.length > 0) {
    const externalProductNos = Array.from(new Set(baseRows.map((r) => String(r.external_product_no ?? "").trim()).filter(Boolean)));
    const baseChannelProductIds = Array.from(new Set(baseRows.map((r) => String(r.channel_product_id ?? "").trim()).filter(Boolean)));
    const existingMapRows: Array<{ external_product_no: string | null; external_variant_code: string | null }> = [];
    for (const productChunk of chunkArray(externalProductNos, IN_QUERY_CHUNK_SIZE)) {
      if (productChunk.length === 0) continue;
      const existingMapRes = await sb
        .from("sales_channel_product")
        .select("external_product_no, external_variant_code")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .in("external_product_no", productChunk);
      if (existingMapRes.error) return jsonError(existingMapRes.error.message ?? "기존 매핑 조회 실패", 500);
      existingMapRows.push(...(existingMapRes.data ?? []));
    }

    const baseDetailRows: Array<{
      channel_product_id: string | null;
      master_item_id: string | null;
      external_product_no: string | null;
      sync_rule_set_id: string | null;
      option_material_code: string | null;
      option_color_code: string | null;
      option_decoration_code: string | null;
      option_size_value: string | null;
      material_multiplier_override: number | null;
      size_weight_delta_g: number | null;
      option_price_delta_krw: number | null;
      option_price_mode: string | null;
      option_manual_target_krw: number | null;
      include_master_plating_labor: boolean | null;
      sync_rule_material_enabled: boolean | null;
      sync_rule_weight_enabled: boolean | null;
      sync_rule_plating_enabled: boolean | null;
      sync_rule_decoration_enabled: boolean | null;
      sync_rule_margin_rounding_enabled: boolean | null;
    }> = [];
    for (const baseIdChunk of chunkArray(baseChannelProductIds, IN_QUERY_CHUNK_SIZE)) {
      if (baseIdChunk.length === 0) continue;
      const baseDetailRes = await sb
        .from("sales_channel_product")
        .select("channel_product_id, master_item_id, external_product_no, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .in("channel_product_id", baseIdChunk);
      if (baseDetailRes.error) return jsonError(baseDetailRes.error.message ?? "기준 매핑 조회 실패", 500);
      baseDetailRows.push(...(baseDetailRes.data ?? []));
    }

    const baseMasterIds = Array.from(new Set(
      baseDetailRows
        .map((row) => String(row.master_item_id ?? "").trim())
        .filter(Boolean),
    ));
    let siblingRuleSetRows: Array<{
      master_item_id: string | null;
      option_price_mode: string | null;
      sync_rule_set_id: string | null;
      is_active: boolean | null;
    }> = [];
    if (baseMasterIds.length > 0) {
      for (const masterChunk of chunkArray(baseMasterIds, IN_QUERY_CHUNK_SIZE)) {
        if (masterChunk.length === 0) continue;
        const siblingRuleSetRes = await sb
          .from("sales_channel_product")
          .select("master_item_id, option_price_mode, sync_rule_set_id, is_active")
          .eq("channel_id", channelId)
          .in("master_item_id", masterChunk)
          .eq("is_active", true);
        if (siblingRuleSetRes.error) return jsonError(siblingRuleSetRes.error.message ?? "룰셋 보정 조회 실패", 500);
        siblingRuleSetRows.push(...(siblingRuleSetRes.data ?? []));
      }
    }

    const existingVariantByProduct = new Map<string, Set<string>>();
    for (const row of existingMapRows) {
      const p = String(row.external_product_no ?? "").trim();
      const v = String(row.external_variant_code ?? "").trim();
      if (!p || !v) continue;
      const set = existingVariantByProduct.get(p) ?? new Set<string>();
      set.add(v);
      existingVariantByProduct.set(p, set);
    }

    const baseDetailByChannelProduct = new Map(
      baseDetailRows.map((r) => [String(r.channel_product_id), r]),
    );

    const canonicalBaseProductByMaster = new Map<string, string>();
    for (const row of baseRows) {
      const channelProductId = String(row.channel_product_id ?? "").trim();
      const productNo = String(row.external_product_no ?? "").trim();
      const detail = baseDetailByChannelProduct.get(channelProductId);
      const masterId = String(detail?.master_item_id ?? "").trim();
      if (!masterId || !productNo) continue;
      const current = canonicalBaseProductByMaster.get(masterId) ?? "";
      if (shouldPreferProductNo(current, productNo)) {
        canonicalBaseProductByMaster.set(masterId, productNo);
      }
    }

    const syncRuleSetCandidatesByMaster = new Map<string, Set<string>>();
    for (const row of siblingRuleSetRows) {
      const masterId = String(row.master_item_id ?? "").trim();
      const optionMode = String(row.option_price_mode ?? "SYNC").trim().toUpperCase();
      const ruleSetId = String(row.sync_rule_set_id ?? "").trim();
      if (!masterId || optionMode !== "SYNC" || !ruleSetId) continue;
      const set = syncRuleSetCandidatesByMaster.get(masterId) ?? new Set<string>();
      set.add(ruleSetId);
      syncRuleSetCandidatesByMaster.set(masterId, set);
    }

    for (const baseRow of baseRows) {
      const externalProductNo = String(baseRow.external_product_no ?? "").trim();
      if (!externalProductNo) continue;

      const existingSet = existingVariantByProduct.get(externalProductNo) ?? new Set<string>();
      if (existingSet.size > 0) continue;

      const baseSnapshot = await getBaseSnapshot(externalProductNo);
      if (!baseSnapshot.ok || !hasOptionProduct(baseSnapshot.raw)) continue;

      const variantsRes = await listVariantsWithRefresh(externalProductNo);
      if (!variantsRes.ok || variantsRes.variants.length === 0) continue;

      const baseDetail = baseDetailByChannelProduct.get(String(baseRow.channel_product_id));
      if (!baseDetail?.master_item_id) continue;
      const masterId = String(baseDetail.master_item_id ?? "").trim();
      const canonicalBaseProductNo = canonicalBaseProductByMaster.get(masterId) ?? "";
      if (canonicalBaseProductNo && externalProductNo !== canonicalBaseProductNo) continue;
      const baseOptionMode = String(baseDetail.option_price_mode ?? "SYNC").trim().toUpperCase() === "MANUAL" ? "MANUAL" : "SYNC";
      let resolvedRuleSetId = String(baseDetail.sync_rule_set_id ?? "").trim();
      if (baseOptionMode === "SYNC" && !resolvedRuleSetId) {
        const candidates = syncRuleSetCandidatesByMaster.get(masterId);
        if (candidates && candidates.size === 1) {
          resolvedRuleSetId = Array.from(candidates)[0] ?? "";
        }
      }
      if (baseOptionMode === "SYNC" && !resolvedRuleSetId) {
        return jsonError("SYNC 모드 자동 옵션 매핑에 sync_rule_set_id가 필요합니다", 422, {
          code: "SOT_SYNC_RULESET_REQUIRED",
          channel_id: channelId,
          master_item_id: masterId,
          external_product_no: externalProductNo,
        });
      }

      const variantCodes = Array.from(new Set(
        variantsRes.variants.map((v) => String(v.variantCode ?? "").trim()).filter(Boolean),
      ));
      if (variantCodes.length === 0) continue;

      const preConflictRes = await sb
        .from("sales_channel_product")
        .select("external_product_no")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterId)
        .eq("is_active", true)
        .in("external_variant_code", variantCodes)
        .not("external_product_no", "is", null)
        .neq("external_product_no", externalProductNo);
      if (preConflictRes.error) {
        return jsonError(preConflictRes.error.message ?? "옵션 자동 매핑 사전 충돌 조회 실패", 500);
      }

      const conflictingProductNos = Array.from(new Set(
        (preConflictRes.data ?? [])
          .map((row) => String(row.external_product_no ?? "").trim())
          .filter(Boolean),
      ));

      if (conflictingProductNos.length > 0) {
        const activeBaseRes = await sb
          .from("sales_channel_product")
          .select("external_product_no, external_variant_code")
          .eq("channel_id", channelId)
          .eq("master_item_id", masterId)
          .eq("is_active", true)
          .in("external_product_no", conflictingProductNos);
        if (activeBaseRes.error) {
          return jsonError(activeBaseRes.error.message ?? "레거시 상품 기준행 조회 실패", 500);
        }

        const hasActiveBaseByProductNo = new Set(
          (activeBaseRes.data ?? [])
            .filter((row) => String(row.external_variant_code ?? "").trim().length === 0)
            .map((row) => String(row.external_product_no ?? "").trim())
            .filter(Boolean),
        );

        const keepAliveBaseRows = conflictingProductNos
          .filter((productNo) => !hasActiveBaseByProductNo.has(productNo))
          .map((productNo) => ({
            channel_id: channelId,
            master_item_id: masterId,
            external_product_no: productNo,
            external_variant_code: "",
            sync_rule_set_id: resolvedRuleSetId || null,
            option_material_code: baseDetail.option_material_code ?? null,
            option_color_code: baseDetail.option_color_code ?? null,
            option_decoration_code: baseDetail.option_decoration_code ?? null,
            option_size_value: baseDetail.option_size_value ?? null,
            material_multiplier_override: baseDetail.material_multiplier_override ?? null,
            size_weight_delta_g: baseDetail.size_weight_delta_g ?? null,
            option_price_delta_krw: baseDetail.option_price_delta_krw ?? null,
            option_price_mode: baseOptionMode,
            option_manual_target_krw: baseDetail.option_manual_target_krw ?? null,
            include_master_plating_labor: baseDetail.include_master_plating_labor ?? true,
            sync_rule_material_enabled: baseDetail.sync_rule_material_enabled ?? true,
            sync_rule_weight_enabled: baseDetail.sync_rule_weight_enabled ?? true,
            sync_rule_plating_enabled: baseDetail.sync_rule_plating_enabled ?? true,
            sync_rule_decoration_enabled: baseDetail.sync_rule_decoration_enabled ?? true,
            sync_rule_margin_rounding_enabled: baseDetail.sync_rule_margin_rounding_enabled ?? true,
            mapping_source: "AUTO",
            is_active: true,
          }));

        if (keepAliveBaseRows.length > 0) {
          const keepAliveUpsertRes = await sb
            .from("sales_channel_product")
            .upsert(keepAliveBaseRows, { onConflict: "channel_id,external_product_no,external_variant_code" });
          if (keepAliveUpsertRes.error) {
            return jsonError(keepAliveUpsertRes.error.message ?? "레거시 상품 기준행 보정 실패", 500, {
              code: "ENSURE_LEGACY_PRODUCT_BASE_MAPPING_FAILED",
              channel_id: channelId,
              master_item_id: masterId,
              conflicting_external_product_nos: conflictingProductNos,
            });
          }
        }
      }

      const deactivateRes = await sb
        .from("sales_channel_product")
        .update({ is_active: false })
        .eq("channel_id", channelId)
        .eq("master_item_id", masterId)
        .not("external_product_no", "is", null)
        .neq("external_product_no", externalProductNo)
        .in("external_variant_code", variantCodes)
        .eq("is_active", true);
      if (deactivateRes.error) {
        return jsonError(deactivateRes.error.message ?? "옵션 자동 매핑 비활성화 실패", 500, {
          code: "DEACTIVATE_CONFLICTING_VARIANTS_FAILED",
          channel_id: channelId,
          master_item_id: masterId,
          external_product_no: externalProductNo,
          variant_codes: variantCodes,
        });
      }

      const postConflictRes = await sb
        .from("sales_channel_product")
        .select("channel_product_id, external_product_no, external_variant_code")
        .eq("channel_id", channelId)
        .eq("master_item_id", masterId)
        .eq("is_active", true)
        .in("external_variant_code", variantCodes)
        .not("external_product_no", "is", null)
        .neq("external_product_no", externalProductNo);
      if (postConflictRes.error) {
        return jsonError(postConflictRes.error.message ?? "옵션 자동 매핑 잔여 충돌 조회 실패", 500);
      }

      const postConflicts = postConflictRes.data ?? [];
      if (postConflicts.length > 0) {
        return jsonError("옵션 자동 매핑 충돌: 동일 master+variant가 다른 상품번호에 이미 활성화되어 있습니다", 409, {
          code: "ACTIVE_VARIANT_MAPPING_CONFLICT",
          channel_id: channelId,
          master_item_id: masterId,
          target_external_product_no: externalProductNo,
          variant_codes: variantCodes,
          conflicts: postConflicts.slice(0, 50),
        });
      }

      const upsertRows = variantCodes.map((variantCode) => ({
        channel_id: channelId,
        master_item_id: masterId,
        external_product_no: externalProductNo,
        external_variant_code: variantCode,
        sync_rule_set_id: resolvedRuleSetId || null,
        option_material_code: baseDetail.option_material_code ?? null,
        option_color_code: baseDetail.option_color_code ?? null,
        option_decoration_code: baseDetail.option_decoration_code ?? null,
        option_size_value: baseDetail.option_size_value ?? null,
        material_multiplier_override: baseDetail.material_multiplier_override ?? null,
        size_weight_delta_g: baseDetail.size_weight_delta_g ?? null,
        option_price_delta_krw: baseDetail.option_price_delta_krw ?? null,
        option_price_mode: baseOptionMode,
        option_manual_target_krw: baseDetail.option_manual_target_krw ?? null,
        include_master_plating_labor: baseDetail.include_master_plating_labor ?? true,
        sync_rule_material_enabled: baseDetail.sync_rule_material_enabled ?? true,
        sync_rule_weight_enabled: baseDetail.sync_rule_weight_enabled ?? true,
        sync_rule_plating_enabled: baseDetail.sync_rule_plating_enabled ?? true,
        sync_rule_decoration_enabled: baseDetail.sync_rule_decoration_enabled ?? true,
        sync_rule_margin_rounding_enabled: baseDetail.sync_rule_margin_rounding_enabled ?? true,
        mapping_source: "AUTO",
        is_active: true,
      }));

      const upsertRes = await sb
        .from("sales_channel_product")
        .upsert(upsertRows, { onConflict: "channel_id,external_product_no,external_variant_code" });
      if (upsertRes.error) return jsonError(upsertRes.error.message ?? "옵션 자동 매핑 실패", 500);
    }
  }

  const finalRows: Array<{
    channel_id: string | null;
    channel_product_id: string | null;
    master_item_id: string | null;
    external_product_no: string | null;
    external_variant_code: string | null;
    target_price_raw_krw: number | null;
    final_target_price_krw: number | null;
    current_channel_price_krw: number | null;
  }> = [];

  if (channelProductIds && channelProductIds.length > 0) {
    const targetMasterIds = Array.from(new Set(
      initialCandidates.map((r) => String(r.master_item_id ?? "").trim()).filter(Boolean),
    ));
    if (targetMasterIds.length > 0) {
      for (const masterChunk of chunkArray(targetMasterIds, IN_QUERY_CHUNK_SIZE)) {
        if (masterChunk.length === 0) continue;
        const candRes = await sb
          .from("v_channel_price_dashboard")
          .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, target_price_raw_krw, final_target_price_krw, current_channel_price_krw")
          .eq("channel_id", channelId)
          .in("master_item_id", masterChunk);
        if (candRes.error) return jsonError(candRes.error.message ?? "반영 대상 재조회 실패", 500);
        finalRows.push(...(candRes.data ?? []));
      }
    } else {
      for (const idChunk of chunkArray(channelProductIds, IN_QUERY_CHUNK_SIZE)) {
        if (idChunk.length === 0) continue;
        const candRes = await sb
          .from("v_channel_price_dashboard")
          .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, target_price_raw_krw, final_target_price_krw, current_channel_price_krw")
          .eq("channel_id", channelId)
          .in("channel_product_id", idChunk);
        if (candRes.error) return jsonError(candRes.error.message ?? "반영 대상 재조회 실패", 500);
        finalRows.push(...(candRes.data ?? []));
      }
    }
  } else {
    const candRes = await sb
      .from("v_channel_price_dashboard")
      .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, target_price_raw_krw, final_target_price_krw, current_channel_price_krw")
      .eq("channel_id", channelId);
    if (candRes.error) return jsonError(candRes.error.message ?? "반영 대상 재조회 실패", 500);
    finalRows.push(...(candRes.data ?? []));
  }

  const candidates = await filterActiveCandidates(
    finalRows.filter((r) => r.channel_product_id && r.external_product_no),
  );

  const canonicalProductByMaster = new Map<string, string>();
  for (const row of candidates) {
    const master = String(row.master_item_id ?? "").trim();
    const variant = String(row.external_variant_code ?? "").trim();
    const productNo = String(row.external_product_no ?? "").trim();
    if (!master || !productNo || variant) continue;
    const current = canonicalProductByMaster.get(master) ?? "";
    if (shouldPreferProductNo(current, productNo)) {
      canonicalProductByMaster.set(master, productNo);
    }
  }

  const dedupedMap = new Map<string, (typeof candidates)[number]>();
  const scoreCandidateRow = (row: (typeof candidates)[number], canonicalProductNo: string): number => {
    const productNo = String(row.external_product_no ?? "").trim();
    const target = Number(row.final_target_price_krw);
    const hasFinitePositiveTarget = Number.isFinite(target) && target > 0;
    const looksCanonicalCode = /^P/i.test(productNo);
    let score = 0;
    if (hasFinitePositiveTarget) score += 1000;
    if (canonicalProductNo && productNo === canonicalProductNo) score += 100;
    if (looksCanonicalCode) score += 30;
    return score;
  };
  for (const row of candidates) {
    const master = String(row.master_item_id ?? "").trim();
    const variant = String(row.external_variant_code ?? "").trim();
    const productNo = String(row.external_product_no ?? "").trim();
    const key = `${master}::${variant}`;
    const prev = dedupedMap.get(key);
    if (!prev) {
      dedupedMap.set(key, row);
      continue;
    }

    const canonical = canonicalProductByMaster.get(master) ?? "";
    const prevScore = scoreCandidateRow(prev, canonical);
    const nextScore = scoreCandidateRow(row, canonical);
    if (nextScore > prevScore) {
      dedupedMap.set(key, row);
      continue;
    }
    if (prevScore > nextScore) {
      continue;
    }
    if (canonical) {
      if (productNo === canonical && String(prev.external_product_no ?? "").trim() !== canonical) {
        dedupedMap.set(key, row);
        continue;
      }
      if (String(prev.external_product_no ?? "").trim() === canonical) continue;
    }

    const prevNo = String(prev.external_product_no ?? "").trim();
    const currIsCode = /^P/i.test(productNo);
    const prevIsCode = /^P/i.test(prevNo);
    if (currIsCode && !prevIsCode) {
      dedupedMap.set(key, row);
    }
  }

  let dedupedCandidates = Array.from(dedupedMap.values());

  if (pinnedTargetByChannelProduct.size > 0) {
    dedupedCandidates = dedupedCandidates
      .map((row) => {
        const id = String(row.channel_product_id ?? "").trim();
        const master = String(row.master_item_id ?? "").trim();
        const variant = String(row.external_variant_code ?? "").trim();
        const pinned = pinnedTargetByChannelProduct.get(id)
          ?? (master ? pinnedTargetByLogical.get(logicalTargetKey(master, variant)) : undefined);
        if (!id || pinned == null || !Number.isFinite(pinned)) return null;
        const normalizedPinned = Math.round(pinned);
        return {
          ...row,
          final_target_price_krw: normalizedPinned,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (channelProductIds && channelProductIds.length > 0) {
      const missingPinned = channelProductIds.filter((id) => !pinnedTargetByChannelProduct.has(id));
      if (missingPinned.length > 0) {
        return jsonError(`compute_request_id에 없는 channel_product_id가 있습니다: ${missingPinned.slice(0, 5).join(",")}`, 422);
      }
    }
  }

  const sortedCandidates = [...dedupedCandidates].sort((a, b) => {
    const am = String(a.master_item_id ?? "");
    const bm = String(b.master_item_id ?? "");
    if (am !== bm) return am.localeCompare(bm);
    const av = String(a.external_variant_code ?? "").trim();
    const bv = String(b.external_variant_code ?? "").trim();
    if (!av && bv) return -1;
    if (av && !bv) return 1;
    return av.localeCompare(bv);
  });

  const mastersWithExplicitBaseRows = new Set<string>();
  const masterBaseRawTarget = new Map<string, number>();

  const masterFallbackTarget = new Map<string, number>();
  for (const row of sortedCandidates) {
    const masterKey = String(row.master_item_id ?? "").trim();
    const variantCode = String(row.external_variant_code ?? "").trim();
    const target = Number(row.final_target_price_krw);
    const targetRaw = Number(row.target_price_raw_krw);
    if (!masterKey || variantCode) continue;
    mastersWithExplicitBaseRows.add(masterKey);
    if (Number.isFinite(target) && !masterFallbackTarget.has(masterKey)) {
      masterFallbackTarget.set(masterKey, Math.round(target));
    }
    if (Number.isFinite(targetRaw) && !masterBaseRawTarget.has(masterKey)) {
      masterBaseRawTarget.set(masterKey, targetRaw);
    }
  }

  const missingMasterFallbackIds = Array.from(new Set(
    sortedCandidates
      .map((row) => String(row.master_item_id ?? "").trim())
      .filter((masterKey) => masterKey.length > 0 && !masterFallbackTarget.has(masterKey)),
  ));
  if (missingMasterFallbackIds.length > 0) {
    for (const masterChunk of chunkArray(missingMasterFallbackIds, IN_QUERY_CHUNK_SIZE)) {
      if (masterChunk.length === 0) continue;
      const fallbackRes = await sb
        .from("v_channel_price_dashboard")
        .select("master_item_id, final_target_price_krw")
        .eq("channel_id", channelId)
        .eq("external_variant_code", "")
        .in("master_item_id", masterChunk);
      if (fallbackRes.error) return jsonError(fallbackRes.error.message ?? "기준옵션 목표가 조회 실패", 500);
      for (const row of fallbackRes.data ?? []) {
        const masterKey = String(row.master_item_id ?? "").trim();
        const target = Number(row.final_target_price_krw);
        if (!masterKey || masterFallbackTarget.has(masterKey)) continue;
        if (Number.isFinite(target) && target > 0) {
          masterFallbackTarget.set(masterKey, Math.round(target));
        }
      }
    }
  }

  const variantAdditionalOverrideByMasterVariant = new Map<string, number>();
  const variantAdditionalOverrideByProductVariant = new Map<string, number>();
  const overrideMasterIds = Array.from(new Set(
    sortedCandidates
      .map((row) => String(row.master_item_id ?? "").trim())
      .filter(Boolean),
  ));
  const overrideProductNos = Array.from(new Set(
    sortedCandidates
      .map((row) => String(row.external_product_no ?? "").trim())
      .filter(Boolean),
  ));
  const overrideMasterUpdatedAt = new Map<string, number>();
  const overrideProductUpdatedAt = new Map<string, number>();

  const upsertOverride = (
    map: Map<string, number>,
    tsMap: Map<string, number>,
    key: string,
    delta: number,
    updatedAt: unknown,
  ) => {
    const ts = Date.parse(String(updatedAt ?? ""));
    const nextTs = Number.isFinite(ts) ? ts : Number.MIN_SAFE_INTEGER;
    const prevTs = tsMap.get(key);
    if (prevTs === undefined || nextTs >= prevTs) {
      map.set(key, Math.round(delta));
      tsMap.set(key, nextTs);
    }
  };

  if (overrideMasterIds.length > 0) {
    for (const masterChunk of chunkArray(overrideMasterIds, IN_QUERY_CHUNK_SIZE)) {
      if (masterChunk.length === 0) continue;
      const stateRes = await sb
        .from("channel_option_current_state_v1")
        .select("state_id, master_item_id, external_product_no, external_variant_code, final_target_additional_amount_krw, updated_at")
        .eq("channel_id", channelId)
        .in("master_item_id", masterChunk)
        .order("updated_at", { ascending: false })
        .order("state_id", { ascending: false });
      if (stateRes.error) return jsonError(stateRes.error.message ?? "옵션 현재상태 조회 실패", 500);

      for (const row of stateRes.data ?? []) {
        const variantCode = String(row.external_variant_code ?? "").trim();
        if (!variantCode) continue;
        const delta = Number(row.final_target_additional_amount_krw ?? Number.NaN);
        if (!Number.isFinite(delta)) continue;

        const masterKey = String(row.master_item_id ?? "").trim();
        const productNo = String(row.external_product_no ?? "").trim();

        if (masterKey) {
          const mk = `${masterKey}::${variantCode}`;
          upsertOverride(variantAdditionalOverrideByMasterVariant, overrideMasterUpdatedAt, mk, delta, row.updated_at);
        }

        if (productNo) {
          const pk = `${productNo}::${variantCode}`;
          upsertOverride(variantAdditionalOverrideByProductVariant, overrideProductUpdatedAt, pk, delta, row.updated_at);
        }
      }
    }
  }

  if (overrideProductNos.length > 0) {
    for (const productChunk of chunkArray(overrideProductNos, IN_QUERY_CHUNK_SIZE)) {
      if (productChunk.length === 0) continue;
      const stateRes = await sb
        .from("channel_option_current_state_v1")
        .select("state_id, master_item_id, external_product_no, external_variant_code, final_target_additional_amount_krw, updated_at")
        .eq("channel_id", channelId)
        .in("external_product_no", productChunk)
        .order("updated_at", { ascending: false })
        .order("state_id", { ascending: false });
      if (stateRes.error) return jsonError(stateRes.error.message ?? "옵션 현재상태 조회 실패", 500);

      for (const row of stateRes.data ?? []) {
        const variantCode = String(row.external_variant_code ?? "").trim();
        if (!variantCode) continue;
        const delta = Number(row.final_target_additional_amount_krw ?? Number.NaN);
        if (!Number.isFinite(delta)) continue;

        const masterKey = String(row.master_item_id ?? "").trim();
        const productNo = String(row.external_product_no ?? "").trim();

        if (masterKey) {
          const mk = `${masterKey}::${variantCode}`;
          upsertOverride(variantAdditionalOverrideByMasterVariant, overrideMasterUpdatedAt, mk, delta, row.updated_at);
        }

        if (productNo) {
          const pk = `${productNo}::${variantCode}`;
          upsertOverride(variantAdditionalOverrideByProductVariant, overrideProductUpdatedAt, pk, delta, row.updated_at);
        }
      }
    }
  }

  const resolveVariantAdditionalOverride = (masterKey: string, productNo: string, variantCode: string): number | undefined => {
    const byProduct = variantAdditionalOverrideByProductVariant.get(`${productNo}::${variantCode}`);
    if (Number.isFinite(Number(byProduct))) return Math.round(Number(byProduct));
    const byMaster = variantAdditionalOverrideByMasterVariant.get(`${masterKey}::${variantCode}`);
    if (Number.isFinite(Number(byMaster))) return Math.round(Number(byMaster));
    return undefined;
  };

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: dedupedCandidates.length,
      data: dedupedCandidates,
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

  async function resolveBasePriceForVariantAdditional(externalProductNo: string, masterKey: string): Promise<{ ok: true; basePrice: number; optionType: string } | { ok: false; status: number; raw: unknown; error: string; optionType: string }> {
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
    const fallbackTarget = masterFallbackTarget.get(masterKey);
    const hasFiniteRawTarget = Number.isFinite(rawTarget);
    const shouldUseFallbackForVariant = Boolean(variantCode)
      && fallbackTarget !== undefined
      && (!hasFiniteRawTarget || rawTarget <= 0);
    let targetPrice = shouldUseFallbackForVariant
      ? Math.round(fallbackTarget)
      : (hasFiniteRawTarget ? Math.round(rawTarget) : Number.NaN);

    const forcedDesiredTarget = desiredTargetByChannelProduct.get(String(c.channel_product_id ?? "").trim());
    if (Number.isFinite(Number(forcedDesiredTarget ?? Number.NaN))) {
      targetPrice = Math.round(Number(forcedDesiredTarget));
    }

    if (variantCode) {
      const baseFinalTarget = masterFallbackTarget.get(masterKey);
      const baseRawTarget = masterBaseRawTarget.get(masterKey);
      const variantRawTarget = Number(c.target_price_raw_krw);
      const hasBaseFinal = Number.isFinite(Number(baseFinalTarget ?? Number.NaN));
      const hasBaseRaw = Number.isFinite(Number(baseRawTarget ?? Number.NaN));
      const hasVariantRaw = Number.isFinite(variantRawTarget);
      if (hasBaseFinal && hasBaseRaw && hasVariantRaw) {
        targetPrice = restoreVariantTargetFromRawDelta({
          targetPrice,
          baseFinalTarget: Number(baseFinalTarget),
          baseRawTarget: Number(baseRawTarget),
          variantRawTarget,
        });
      }
    }

    const overrideAdditionalForValidation = allowVariantAdditionalOverride && variantCode
      ? resolveVariantAdditionalOverride(masterKey, String(c.external_product_no ?? "").trim(), variantCode)
      : undefined;
    if ((!Number.isFinite(targetPrice) || targetPrice <= 0) && !Number.isFinite(Number(overrideAdditionalForValidation ?? Number.NaN))) {
      if (!variantCode && masterKey) blockedMastersByBaseFailure.add(masterKey);
      failedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
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
        raw_response_json: { target: c.final_target_price_krw, fallback_target: fallbackTarget ?? null },
      });
      continue;
    }

    if (variantCode && masterKey && blockedMastersByBaseFailure.has(masterKey)) {
      skippedCount += 1;
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
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
      ? resolveVariantAdditionalOverride(masterKey, String(c.external_product_no ?? "").trim(), variantCode)
      : undefined;

    let pushRes = variantCode
      ? await (async () => {
        const baseResolved = await resolveBasePriceForVariantAdditional(externalProductNo, masterKey);
        if (!baseResolved.ok) {
          return {
            ok: false,
            status: baseResolved.status,
            raw: baseResolved.raw,
            error: baseResolved.error,
            attempt_key: "variant_base_price_lookup",
          };
        }

        const preferredBaseForDelta = Number(masterFallbackTarget.get(masterKey));
        const usePreferredBase = mastersWithExplicitBaseRows.has(masterKey) && Number.isFinite(preferredBaseForDelta);
        const baseForDelta = usePreferredBase ? Math.round(preferredBaseForDelta) : baseResolved.basePrice;
        const additionalAmount = Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN)) ? Math.round(Number(overrideAdditionalAmount)) : (targetPrice - baseForDelta);
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
            const baseResolved = await resolveBasePriceForVariantAdditional(externalProductNo, masterKey);
            if (!baseResolved.ok) {
              return {
                ok: false,
                status: baseResolved.status,
                raw: baseResolved.raw,
                error: baseResolved.error,
                attempt_key: "variant_base_price_lookup",
              };
            }

            const preferredBaseForDelta = Number(masterFallbackTarget.get(masterKey));
            const usePreferredBase = mastersWithExplicitBaseRows.has(masterKey) && Number.isFinite(preferredBaseForDelta);
            const baseForDelta = usePreferredBase ? Math.round(preferredBaseForDelta) : baseResolved.basePrice;
            const additionalAmount = Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN)) ? Math.round(Number(overrideAdditionalAmount)) : (targetPrice - baseForDelta);
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

      const verifyPendingAccepted = !variantCode && isProductWriteAcceptedButVerifyPending(pushRes.raw, targetPrice);
      if (verify.ok || verifyPendingAccepted) {
        successCount += 1;
        if (variantCode) {
          const masterBaseTarget = masterFallbackTarget.get(masterKey);
          let basePriceForDelta: number | null = Number.isFinite(Number(masterBaseTarget ?? Number.NaN))
            ? Math.round(Number(masterBaseTarget))
            : null;
          if (basePriceForDelta === null) {
            const base = await getBaseSnapshot(externalProductNo);
            if (base.ok && base.currentPriceKrw !== null) basePriceForDelta = base.currentPriceKrw;
          }
          if (basePriceForDelta !== null) {
            const delta = Math.round(targetPriceForPush - basePriceForDelta);
            const byVariant = successfulVariantDeltaByProduct.get(String(c.external_product_no)) ?? new Map<string, number>();
            byVariant.set(variantCode, delta);
            successfulVariantDeltaByProduct.set(String(c.external_product_no), byVariant);
          }
        }
        itemRows.push({
          job_id: jobId,
          channel_id: c.channel_id,
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
      } else {
        let retryRecorded = false;
        if (variantCode) {
          const retryBase = await resolveBasePriceForVariantAdditional(externalProductNo, masterKey);
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
                  channel_id: c.channel_id,
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
                retryRecorded = true;
              }
            }
          }
        } else {
          const retryPush = await cafe24UpdateProductPrice(account, accessToken, externalProductNo, targetPrice);
          if (retryPush.ok) {
            const retryVerify = await verifyAppliedPrice(account, accessToken, String(c.external_product_no), targetPrice);
            const retryPendingAccepted = isProductWriteAcceptedButVerifyPending(retryPush.raw, targetPrice);
            if (retryVerify.ok || retryPendingAccepted) {
              successCount += 1;
              itemRows.push({
                job_id: jobId,
                channel_id: c.channel_id,
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
          channel_id: c.channel_id,
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
      }
    } else {
      const pushErrorMessage = String(pushRes.error ?? "");
      const noApiFound = /no api found/i.test(pushErrorMessage);
      const itemStatus = "FAILED";
      failedCount += 1;
      if (!variantCode && masterKey) blockedMastersByBaseFailure.add(masterKey);
      itemRows.push({
        job_id: jobId,
        channel_id: c.channel_id,
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
        ? resolveVariantAdditionalOverride(masterKey, externalProductNo, variantCode)
        : undefined;
      if (Number.isFinite(Number(overrideAdditionalAmount ?? Number.NaN))) {
        const byVariant = labelDeltaByProduct.get(externalProductNo) ?? new Map<string, number>();
        byVariant.set(variantCode, Math.round(Number(overrideAdditionalAmount)));
        labelDeltaByProduct.set(externalProductNo, byVariant);
        continue;
      }

      const rawTarget = Number(c.final_target_price_krw);
      const fallbackTarget = masterFallbackTarget.get(masterKey);
      const hasFiniteRawTarget = Number.isFinite(rawTarget);
      const shouldUseFallbackForVariant = Boolean(variantCode)
        && fallbackTarget !== undefined
        && (!hasFiniteRawTarget || rawTarget <= 0);
      let targetPrice = shouldUseFallbackForVariant
        ? Math.round(fallbackTarget)
        : (hasFiniteRawTarget ? Math.round(rawTarget) : Number.NaN);
      const forcedDesiredTarget = desiredTargetByChannelProduct.get(String(c.channel_product_id ?? "").trim());
      if (Number.isFinite(Number(forcedDesiredTarget ?? Number.NaN))) {
        targetPrice = Math.round(Number(forcedDesiredTarget));
      }
      if (variantCode) {
        const baseFinalTarget = masterFallbackTarget.get(masterKey);
        const baseRawTarget = masterBaseRawTarget.get(masterKey);
        const variantRawTarget = Number(c.target_price_raw_krw);
        const hasBaseFinal = Number.isFinite(Number(baseFinalTarget ?? Number.NaN));
        const hasBaseRaw = Number.isFinite(Number(baseRawTarget ?? Number.NaN));
        const hasVariantRaw = Number.isFinite(variantRawTarget);
        if (hasBaseFinal && hasBaseRaw && hasVariantRaw) {
          targetPrice = restoreVariantTargetFromRawDelta({
            targetPrice,
            baseFinalTarget: Number(baseFinalTarget),
            baseRawTarget: Number(baseRawTarget),
            variantRawTarget,
          });
        }
      }
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) continue;

      let basePriceForDelta: number | null = Number.isFinite(Number(masterFallbackTarget.get(masterKey) ?? Number.NaN))
        ? Math.round(Number(masterFallbackTarget.get(masterKey)))
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

  const finalStatus =
    dedupedCandidates.length === 0
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
    compute_request_id: pinnedComputeRequestId || null,
    total: dedupedCandidates.length,
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
