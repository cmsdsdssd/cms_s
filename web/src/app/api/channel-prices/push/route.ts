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

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  for (let i = 0; i < 2; i += 1) {
    if (last.currentPriceKrw === expectedPrice) {
      return { ok: true, current: last.currentPriceKrw, status: last.status, raw: last.raw };
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
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
): Promise<{ ok: boolean; current: number | null; status: number; raw: unknown; error?: string }> {
  let last = await cafe24GetVariantPrice(account, accessToken, externalProductNo, externalVariantCode);
  if (!last.ok) {
    return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "variant verify failed" };
  }

  for (let i = 0; i < 2; i += 1) {
    if (last.currentPriceKrw === expectedPrice) {
      return { ok: true, current: last.currentPriceKrw, status: last.status, raw: last.raw };
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    last = await cafe24GetVariantPrice(account, accessToken, externalProductNo, externalVariantCode);
    if (!last.ok) {
      return { ok: false, current: null, status: last.status, raw: last.raw, error: last.error ?? "variant verify failed" };
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

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const channelProductIds = parseUuidArray(body.channel_product_ids);
  const runType = String(body.run_type ?? "MANUAL").toUpperCase() === "AUTO" ? "AUTO" : "MANUAL";
  const dryRun = body.dry_run === true;
  const syncOptionLabels = body.sync_option_labels !== false;

  if (!channelId) return jsonError("channel_id is required", 400);

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

  let q = sb
    .from("v_channel_price_dashboard")
    .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, final_target_price_krw, current_channel_price_krw")
    .eq("channel_id", channelId);

  if (channelProductIds && channelProductIds.length > 0) q = q.in("channel_product_id", channelProductIds);

  const initialRes = await q;
  if (initialRes.error) return jsonError(initialRes.error.message ?? "반영 대상 조회 실패", 500);
  const initialCandidates = await filterActiveCandidates(
    (initialRes.data ?? []).filter((r) => r.channel_product_id && r.external_product_no),
  );

  const baseRows = initialCandidates.filter((r) => String(r.external_variant_code ?? "").trim().length === 0);
  if (baseRows.length > 0) {
    const externalProductNos = Array.from(new Set(baseRows.map((r) => String(r.external_product_no ?? "").trim()).filter(Boolean)));
    const baseChannelProductIds = Array.from(new Set(baseRows.map((r) => String(r.channel_product_id ?? "").trim()).filter(Boolean)));

    const [existingMapRes, baseDetailRes] = await Promise.all([
      sb
        .from("sales_channel_product")
        .select("external_product_no, external_variant_code")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .in("external_product_no", externalProductNos),
      sb
        .from("sales_channel_product")
        .select("channel_product_id, master_item_id, external_product_no, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled")
        .eq("channel_id", channelId)
        .eq("is_active", true)
        .in("channel_product_id", baseChannelProductIds),
    ]);

    if (existingMapRes.error) return jsonError(existingMapRes.error.message ?? "기존 매핑 조회 실패", 500);
    if (baseDetailRes.error) return jsonError(baseDetailRes.error.message ?? "기준 매핑 조회 실패", 500);

    const existingVariantByProduct = new Map<string, Set<string>>();
    for (const row of existingMapRes.data ?? []) {
      const p = String(row.external_product_no ?? "").trim();
      const v = String(row.external_variant_code ?? "").trim();
      if (!p || !v) continue;
      const set = existingVariantByProduct.get(p) ?? new Set<string>();
      set.add(v);
      existingVariantByProduct.set(p, set);
    }

    const baseDetailByChannelProduct = new Map(
      (baseDetailRes.data ?? []).map((r) => [String(r.channel_product_id), r]),
    );

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

      const variantCodes = Array.from(new Set(
        variantsRes.variants.map((v) => String(v.variantCode ?? "").trim()).filter(Boolean),
      ));
      if (variantCodes.length === 0) continue;

      await sb
        .from("sales_channel_product")
        .update({ is_active: false })
        .eq("channel_id", channelId)
        .eq("master_item_id", String(baseDetail.master_item_id))
        .neq("external_product_no", externalProductNo)
        .in("external_variant_code", variantCodes)
        .eq("is_active", true);

      const upsertRows = variantCodes.map((variantCode) => ({
        channel_id: channelId,
        master_item_id: String(baseDetail.master_item_id),
        external_product_no: externalProductNo,
        external_variant_code: variantCode,
        sync_rule_set_id: baseDetail.sync_rule_set_id ?? null,
        option_material_code: baseDetail.option_material_code ?? null,
        option_color_code: baseDetail.option_color_code ?? null,
        option_decoration_code: baseDetail.option_decoration_code ?? null,
        option_size_value: baseDetail.option_size_value ?? null,
        material_multiplier_override: baseDetail.material_multiplier_override ?? null,
        size_weight_delta_g: baseDetail.size_weight_delta_g ?? null,
        option_price_delta_krw: baseDetail.option_price_delta_krw ?? null,
        option_price_mode: baseDetail.option_price_mode ?? "SYNC",
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

  let finalQuery = sb
    .from("v_channel_price_dashboard")
    .select("channel_id, channel_product_id, master_item_id, external_product_no, external_variant_code, final_target_price_krw, current_channel_price_krw")
    .eq("channel_id", channelId);

  if (channelProductIds && channelProductIds.length > 0) {
    const targetMasterIds = Array.from(new Set(
      initialCandidates.map((r) => String(r.master_item_id ?? "").trim()).filter(Boolean),
    ));
    if (targetMasterIds.length > 0) finalQuery = finalQuery.in("master_item_id", targetMasterIds);
    else finalQuery = finalQuery.in("channel_product_id", channelProductIds);
  }

  const candRes = await finalQuery;
  if (candRes.error) return jsonError(candRes.error.message ?? "반영 대상 재조회 실패", 500);
  const candidates = await filterActiveCandidates(
    (candRes.data ?? []).filter((r) => r.channel_product_id && r.external_product_no),
  );

  const canonicalProductByMaster = new Map<string, string>();
  for (const row of candidates) {
    const master = String(row.master_item_id ?? "").trim();
    const variant = String(row.external_variant_code ?? "").trim();
    const productNo = String(row.external_product_no ?? "").trim();
    if (!master || !productNo) continue;
    if (!variant && !canonicalProductByMaster.has(master)) {
      canonicalProductByMaster.set(master, productNo);
    }
  }

  const dedupedMap = new Map<string, (typeof candidates)[number]>();
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

  const dedupedCandidates = Array.from(dedupedMap.values());

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

  const mastersWithVariantRows = new Set(
    sortedCandidates
      .filter((r) => String(r.external_variant_code ?? "").trim().length > 0)
      .map((r) => String(r.master_item_id ?? "").trim())
      .filter(Boolean),
  );

  const masterFallbackTarget = new Map<string, number>();
  for (const row of sortedCandidates) {
    const masterKey = String(row.master_item_id ?? "").trim();
    const variantCode = String(row.external_variant_code ?? "").trim();
    const target = Number(row.final_target_price_krw);
    if (!masterKey || variantCode) continue;
    if (Number.isFinite(target) && !masterFallbackTarget.has(masterKey)) {
      masterFallbackTarget.set(masterKey, Math.round(target));
    }
  }

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

  function hasOptionProduct(raw: unknown): boolean {
    const product = (raw as { product?: { has_option?: unknown } } | null)?.product;
    return String(product?.has_option ?? "").trim() === "T";
  }

  function getOptionType(raw: unknown): string {
    const product = (raw as { product?: { option_type?: unknown } } | null)?.product;
    return String(product?.option_type ?? "").trim().toUpperCase();
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
    const activeRes = await sb!
      .from("sales_channel_product")
      .select("channel_product_id")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .in("channel_product_id", ids);
    if (activeRes.error) return rows;
    const activeSet = new Set((activeRes.data ?? []).map((r) => String(r.channel_product_id)));
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
    const targetPrice = shouldUseFallbackForVariant
      ? Math.round(fallbackTarget)
      : (hasFiniteRawTarget ? Math.round(rawTarget) : Number.NaN);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      skippedCount += 1;
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
        status: "SKIPPED",
        http_status: 422,
        error_code: "INVALID_TARGET_PRICE",
        error_message: "target price must be > 0",
        raw_response_json: { target: c.final_target_price_krw, fallback_target: fallbackTarget ?? null },
      });
      continue;
    }

    if (!variantCode) {
      const baseCheck = await getBaseSnapshot(externalProductNo);
      if (baseCheck.ok && hasOptionProduct(baseCheck.raw) && !mastersWithVariantRows.has(masterKey)) {
        const optionType = getOptionType(baseCheck.raw);
        if (optionType === "C") {
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
            after_price_krw: baseCheck.currentPriceKrw ?? c.current_channel_price_krw,
            status: "SKIPPED",
            http_status: baseCheck.status,
            error_code: "BASE_PRICE_IMMUTABLE_OPTION_TYPE_C",
            error_message: "옵션타입 C 상품은 기본가 직접 반영이 제한됩니다. 옵션코드 매핑 후 옵션행 기준으로 동기화하세요",
            raw_response_json: { verify: baseCheck.raw },
          });
          continue;
        }

        failedCount += 1;
        itemRows.push({
          job_id: jobId,
          channel_id: c.channel_id,
          channel_product_id: c.channel_product_id,
          master_item_id: c.master_item_id,
          external_product_no: c.external_product_no,
          external_variant_code: variantCode,
          before_price_krw: c.current_channel_price_krw,
          target_price_krw: targetPrice,
          after_price_krw: baseCheck.currentPriceKrw ?? c.current_channel_price_krw,
          status: "FAILED",
          http_status: baseCheck.status,
          error_code: "BASE_PRICE_IMMUTABLE_NEEDS_VARIANT_MAPPING",
          error_message: "옵션상품 기본가는 직접 반영이 어려워 옵션코드 매핑 후 옵션 전체 push가 필요합니다",
          raw_response_json: { verify: baseCheck.raw },
        });
        continue;
      }
    }

    let pushRes = variantCode
      ? await (async () => {
        const masterBaseTarget = masterFallbackTarget.get(masterKey);
        let basePriceForAdditional: number | null = Number.isFinite(Number(masterBaseTarget ?? Number.NaN))
          ? Math.round(Number(masterBaseTarget))
          : null;
        if (basePriceForAdditional === null) {
          const base = await getBaseSnapshot(externalProductNo);
          if (!base.ok || base.currentPriceKrw === null) {
            return {
              ok: false,
              status: base.status,
              raw: base.raw,
              error: base.error ?? "base product price required for variant update",
              attempt_key: "variant_base_price_lookup",
            };
          }
          basePriceForAdditional = base.currentPriceKrw;
        }

        const additionalAmount = targetPrice - basePriceForAdditional;
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
            const masterBaseTarget = masterFallbackTarget.get(masterKey);
            let basePriceForAdditional: number | null = Number.isFinite(Number(masterBaseTarget ?? Number.NaN))
              ? Math.round(Number(masterBaseTarget))
              : null;
            if (basePriceForAdditional === null) {
              const base = await getBaseSnapshot(externalProductNo);
              if (!base.ok || base.currentPriceKrw === null) {
                return {
                  ok: false,
                  status: base.status,
                  raw: base.raw,
                  error: base.error ?? "base product price required for variant update",
                  attempt_key: "variant_base_price_lookup",
                };
              }
              basePriceForAdditional = base.currentPriceKrw;
            }

            const additionalAmount = targetPrice - basePriceForAdditional;
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
      const verifyPending = (() => {
        const raw = (pushRes.raw ?? null) as { verify_pending?: unknown } | null;
        return raw?.verify_pending === true;
      })();

      if (verifyPending) {
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
            const delta = Math.round(targetPrice - basePriceForDelta);
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
          target_price_krw: targetPrice,
          after_price_krw: targetPrice,
          status: "SUCCESS",
          http_status: pushRes.status,
          error_code: null,
          error_message: null,
          raw_response_json: { push: pushRes.raw, verify: { pending: true } },
        });
        continue;
      }

      const verify = variantCode
        ? await verifyAppliedVariantPrice(account, accessToken, String(c.external_product_no), variantCode, targetPrice)
        : await verifyAppliedPrice(account, accessToken, String(c.external_product_no), targetPrice);

      if (verify.ok) {
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
            const delta = Math.round(targetPrice - basePriceForDelta);
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
          target_price_krw: targetPrice,
          after_price_krw: verify.current ?? targetPrice,
          status: "SUCCESS",
          http_status: pushRes.status,
          error_code: null,
          error_message: null,
          raw_response_json: { push: pushRes.raw, verify: verify.raw },
        });
      } else {
        const baseMeta = await getBaseSnapshot(externalProductNo);
        const optionType = baseMeta.ok ? getOptionType(baseMeta.raw) : "";
        const variantAdditionalMismatch = Boolean(variantCode)
          && String(verify.error ?? "").includes("VERIFY_MISMATCH")
          && optionType === "C";
        const optionMasterBaseImmutable = !variantCode && mastersWithVariantRows.has(masterKey) && hasOptionProduct(verify.raw);
        const optionProductWithoutMappedVariants = !variantCode && !mastersWithVariantRows.has(masterKey) && hasOptionProduct(verify.raw);

        if (optionMasterBaseImmutable) {
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
            after_price_krw: verify.current ?? c.current_channel_price_krw,
            status: "SKIPPED",
            http_status: verify.status || pushRes.status,
            error_code: "BASE_PRICE_IMMUTABLE_OPTION_PRODUCT",
            error_message: "옵션상품은 카페24 정책상 기본가가 즉시 변경되지 않아 옵션가 기준으로 동기화했습니다",
            raw_response_json: { push: pushRes.raw, verify: verify.raw },
          });
        } else if (optionProductWithoutMappedVariants) {
          failedCount += 1;
          itemRows.push({
            job_id: jobId,
            channel_id: c.channel_id,
            channel_product_id: c.channel_product_id,
            master_item_id: c.master_item_id,
            external_product_no: c.external_product_no,
            external_variant_code: variantCode,
            before_price_krw: c.current_channel_price_krw,
            target_price_krw: targetPrice,
            after_price_krw: verify.current ?? c.current_channel_price_krw,
            status: "FAILED",
            http_status: verify.status || pushRes.status,
            error_code: "BASE_PRICE_IMMUTABLE_NEEDS_VARIANT_MAPPING",
            error_message: "옵션상품 기본가는 직접 반영이 어려워 옵션코드 매핑 후 옵션 전체 push가 필요합니다",
            raw_response_json: { push: pushRes.raw, verify: verify.raw },
          });
        } else if (variantAdditionalMismatch) {
          failedCount += 1;
          itemRows.push({
            job_id: jobId,
            channel_id: c.channel_id,
            channel_product_id: c.channel_product_id,
            master_item_id: c.master_item_id,
            external_product_no: c.external_product_no,
            external_variant_code: variantCode,
            before_price_krw: c.current_channel_price_krw,
            target_price_krw: targetPrice,
            after_price_krw: verify.current ?? c.current_channel_price_krw,
            status: "FAILED",
            http_status: verify.status || pushRes.status,
            error_code: "VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C",
            error_message: "옵션타입 C 상품은 카페24 정책상 variant 추가금(additional_amount) 반영이 제한될 수 있습니다",
            raw_response_json: { push: pushRes.raw, verify: verify.raw, option_type: optionType },
          });
        } else {
          failedCount += 1;
          itemRows.push({
            job_id: jobId,
            channel_id: c.channel_id,
            channel_product_id: c.channel_product_id,
            master_item_id: c.master_item_id,
            external_product_no: c.external_product_no,
            external_variant_code: variantCode,
            before_price_krw: c.current_channel_price_krw,
            target_price_krw: targetPrice,
            after_price_krw: verify.current ?? c.current_channel_price_krw,
            status: "FAILED",
            http_status: verify.status || pushRes.status,
            error_code: "VERIFY_MISMATCH",
            error_message: `${verify.error ?? "push succeeded but verify mismatch"}${pushRes.attempt_key ? ` (attempt=${pushRes.attempt_key})` : ""}`,
            raw_response_json: { push: pushRes.raw, verify: verify.raw },
          });
        }
      }
    } else {
      const baseMeta = await getBaseSnapshot(externalProductNo);
      const optionType = baseMeta.ok ? getOptionType(baseMeta.raw) : "";
      const variantAdditionalMismatch = Boolean(variantCode)
        && optionType === "C"
        && String(pushRes.error ?? "").includes("additional_amount mismatch");
      failedCount += 1;
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
        status: "FAILED",
        http_status: pushRes.status,
        error_code: variantAdditionalMismatch
          ? "VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C"
          : `HTTP_${pushRes.status}`,
        error_message: variantAdditionalMismatch
          ? "옵션타입 C 상품은 카페24 정책상 variant 추가금(additional_amount) 반영이 제한될 수 있습니다"
          : (pushRes.error ?? "카페24 push 실패"),
        raw_response_json: variantAdditionalMismatch
          ? { push: pushRes.raw, option_type: optionType }
          : pushRes.raw,
      });
    }
  }

  const labelSyncErrors: Array<{ external_product_no: string; error: string }> = [];
  if (syncOptionLabels && successfulVariantDeltaByProduct.size > 0) {
    for (const [externalProductNo, deltaByVariant] of successfulVariantDeltaByProduct.entries()) {
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

      const optionGroups = new Map<string, { optionName: string; currentText: string; deltas: Set<number> }>();
      for (const variant of variantsRes.variants) {
        const delta = deltaByVariant.get(variant.variantCode);
        if (delta === undefined) continue;
        for (const opt of variant.options) {
          const optionName = String(opt.name ?? "").trim();
          const optionValueText = String(opt.value ?? "").trim();
          if (!optionName || !optionValueText) continue;
          const key = `${optionName}::${optionValueText}`;
          const prev = optionGroups.get(key) ?? { optionName, currentText: optionValueText, deltas: new Set<number>() };
          prev.deltas.add(delta);
          optionGroups.set(key, prev);
        }
      }

      const updates = Array.from(optionGroups.values())
        .filter((g) => g.deltas.size === 1)
        .map((g) => {
          const [delta] = Array.from(g.deltas.values());
          return {
            optionName: g.optionName,
            currentText: g.currentText,
            nextText: formatOptionTextWithDelta(g.currentText, delta),
          };
        })
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
    const itemRes = await sb.from("price_sync_job_item").insert(itemRows);
    if (itemRes.error) return jsonError(itemRes.error.message ?? "동기화 작업 아이템 저장 실패", 500);
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
