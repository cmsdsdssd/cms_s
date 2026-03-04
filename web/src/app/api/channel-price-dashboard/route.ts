import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) out.push(items.slice(i, i + chunkSize));
  return out;
};

type DashboardRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  external_variant_code: string | null;
  category_code: string | null;
  material_code: string | null;
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
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const computeRequestId = (searchParams.get("compute_request_id") ?? "").trim();
  const priceState = (searchParams.get("price_state") ?? "").trim();
  const modelName = (searchParams.get("model_name") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();
  const onlyOverrides = searchParams.get("only_overrides") === "true";
  const onlyAdjustments = searchParams.get("only_adjustments") === "true";
  const includeUnmapped = searchParams.get("include_unmapped") !== "false";
  const limitRaw = Number(searchParams.get("limit") ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 200;

  let q = sb
    .from("v_channel_price_dashboard")
    .select("*")
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (channelId) q = q.eq("channel_id", channelId);
  if (masterItemId) q = q.eq("master_item_id", masterItemId);
  if (priceState) q = q.eq("price_state", priceState);
  if (modelName) q = q.ilike("model_name", `%${modelName}%`);
  if (onlyOverrides) q = q.not("active_override_id", "is", null);
  if (onlyAdjustments) q = q.gt("active_adjustment_count", 0);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "대시보드 조회 실패", 500);

  const mappedRows = (data ?? []) as DashboardRow[];

  if (channelId && computeRequestId) {
    const snapshotRes = await sb
      .from("pricing_snapshot")
      .select("channel_product_id, master_item_id, net_weight_g, material_raw_krw, factor_set_id_used, material_factor_multiplier_used, material_final_krw, labor_raw_krw, labor_pre_margin_adj_krw, labor_post_margin_adj_krw, margin_multiplier_used, rounding_unit_used, rounding_mode_used, final_target_price_krw, computed_at")
      .eq("channel_id", channelId)
      .eq("compute_request_id", computeRequestId);
    if (snapshotRes.error) return jsonError(snapshotRes.error.message ?? "스냅샷 조회 실패", 500);

    const snapshotByKey = new Map(
      (snapshotRes.data ?? []).map((row) => [
        `${String((row as { channel_product_id?: string | null }).channel_product_id ?? "")}::${String((row as { master_item_id?: string | null }).master_item_id ?? "")}`,
        row as {
          net_weight_g: number | null;
          material_raw_krw: number | null;
          factor_set_id_used: string | null;
          material_factor_multiplier_used: number | null;
          material_final_krw: number | null;
          labor_raw_krw: number | null;
          labor_pre_margin_adj_krw: number | null;
          labor_post_margin_adj_krw: number | null;
          margin_multiplier_used: number | null;
          rounding_unit_used: number | null;
          rounding_mode_used: "CEIL" | "ROUND" | "FLOOR" | null;
          final_target_price_krw: number | null;
          computed_at: string | null;
        },
      ]),
    );

    const pinnedRows = mappedRows
      .map((row) => {
        const key = `${String(row.channel_product_id ?? "")}::${String(row.master_item_id ?? "")}`;
        const snap = snapshotByKey.get(key);
        if (!snap) return null;
        const currentPrice = row.current_channel_price_krw;
        const nextTarget = snap.final_target_price_krw;
        const nextDiff = nextTarget == null || currentPrice == null ? null : nextTarget - currentPrice;
        const nextDiffPct = nextTarget == null || currentPrice == null || currentPrice === 0
          ? null
          : nextDiff! / currentPrice;
        const nextState = currentPrice == null || nextTarget == null
          ? "ERROR"
          : Math.abs(nextTarget - currentPrice) >= 1
            ? "OUT_OF_SYNC"
            : "OK";
        return {
          ...row,
          net_weight_g: snap.net_weight_g,
          material_raw_krw: snap.material_raw_krw,
          factor_set_id_used: snap.factor_set_id_used,
          material_factor_multiplier_used: snap.material_factor_multiplier_used,
          material_final_krw: snap.material_final_krw,
          labor_raw_krw: snap.labor_raw_krw,
          labor_pre_margin_adj_krw: snap.labor_pre_margin_adj_krw,
          labor_post_margin_adj_krw: snap.labor_post_margin_adj_krw,
          margin_multiplier_used: snap.margin_multiplier_used,
          rounding_unit_used: snap.rounding_unit_used,
          rounding_mode_used: snap.rounding_mode_used,
          final_target_price_krw: nextTarget,
          computed_at: snap.computed_at,
          diff_krw: nextDiff,
          diff_pct: nextDiffPct,
          price_state: nextState as DashboardRow["price_state"],
        };
      })
      .filter((row): row is DashboardRow => Boolean(row));

    return NextResponse.json({ data: pinnedRows }, { headers: { "Cache-Control": "no-store" } });
  }

  if (mappedRows.length > 0) {
    const masterIds = Array.from(
      new Set(mappedRows.map((row) => String(row.master_item_id ?? "").trim()).filter(Boolean)),
    );
    if (masterIds.length > 0) {
      const masterMetaRes = await sb
        .from("cms_master_item")
        .select("master_item_id, material_code_default")
        .in("master_item_id", masterIds);
      if (masterMetaRes.error) {
        return jsonError(masterMetaRes.error.message ?? "마스터 소재 조회 실패", 500);
      }
      const masterMaterialById = new Map(
        (masterMetaRes.data ?? []).map((row) => [
          String((row as { master_item_id?: string | null }).master_item_id ?? ""),
          (row as { material_code_default?: string | null }).material_code_default ?? null,
        ]),
      );
      for (const row of mappedRows) {
        if (row.material_code) continue;
        const key = String(row.master_item_id ?? "").trim();
        row.material_code = masterMaterialById.get(key) ?? null;
      }

      const stateRows: Array<{
        master_item_id: string | null;
        external_product_no: string | null;
        external_variant_code: string | null;
        final_target_additional_amount_krw: number | null;
      }> = [];
      for (const masterChunk of chunkArray(masterIds, 500)) {
        if (masterChunk.length === 0) continue;
        const stateRes = await sb
          .from("channel_option_current_state_v1")
          .select("master_item_id, external_product_no, external_variant_code, final_target_additional_amount_krw, updated_at")
          .eq("channel_id", channelId)
          .in("master_item_id", masterChunk)
          .order("updated_at", { ascending: false });
        if (stateRes.error) {
          return jsonError(stateRes.error.message ?? "옵션 현재상태 조회 실패", 500);
        }
        stateRows.push(...((stateRes.data ?? []) as typeof stateRows));
      }

      const desiredAdditionalByMasterVariant = new Map<string, number>();
      const desiredAdditionalByProductVariant = new Map<string, number>();
      for (const row of stateRows) {
        const variantCode = String(row.external_variant_code ?? "").trim();
        if (!variantCode) continue;
        const delta = Number(row.final_target_additional_amount_krw ?? Number.NaN);
        if (!Number.isFinite(delta)) continue;
        const roundedDelta = Math.round(delta);

        const masterKey = String(row.master_item_id ?? "").trim();
        if (masterKey) {
          const key = `${masterKey}::${variantCode}`;
          if (!desiredAdditionalByMasterVariant.has(key)) desiredAdditionalByMasterVariant.set(key, roundedDelta);
        }

        const productNo = String(row.external_product_no ?? "").trim();
        if (productNo) {
          const key = `${productNo}::${variantCode}`;
          if (!desiredAdditionalByProductVariant.has(key)) desiredAdditionalByProductVariant.set(key, roundedDelta);
        }
      }

      const baseCurrentByMaster = new Map<string, number>();
      const baseCurrentByProduct = new Map<string, number>();
      for (const row of mappedRows) {
        const variantCode = String(row.external_variant_code ?? "").trim();
        if (variantCode) continue;
        const current = Number(row.current_channel_price_krw ?? Number.NaN);
        if (!Number.isFinite(current)) continue;
        const roundedCurrent = Math.round(current);

        const masterKey = String(row.master_item_id ?? "").trim();
        if (masterKey && !baseCurrentByMaster.has(masterKey)) {
          baseCurrentByMaster.set(masterKey, roundedCurrent);
        }
        const productNo = String(row.external_product_no ?? "").trim();
        if (productNo && !baseCurrentByProduct.has(productNo)) {
          baseCurrentByProduct.set(productNo, roundedCurrent);
        }
      }

      for (const row of mappedRows) {
        const variantCode = String(row.external_variant_code ?? "").trim();
        if (!variantCode) continue;

        const masterKey = String(row.master_item_id ?? "").trim();
        const productNo = String(row.external_product_no ?? "").trim();
        const desiredAdditional = desiredAdditionalByMasterVariant.get(`${masterKey}::${variantCode}`)
          ?? desiredAdditionalByProductVariant.get(`${productNo}::${variantCode}`);
        if (!Number.isFinite(Number(desiredAdditional ?? Number.NaN))) continue;

        const baseCurrent = baseCurrentByMaster.get(masterKey) ?? baseCurrentByProduct.get(productNo);
        if (!Number.isFinite(Number(baseCurrent ?? Number.NaN))) continue;

        const nextTarget = Math.round(Number(baseCurrent) + Number(desiredAdditional));
        row.final_target_price_krw = nextTarget;

        const current = Number(row.current_channel_price_krw ?? Number.NaN);
        if (!Number.isFinite(current)) {
          row.diff_krw = null;
          row.diff_pct = null;
          row.price_state = "ERROR";
          continue;
        }

        const roundedCurrent = Math.round(current);
        const diff = nextTarget - roundedCurrent;
        row.diff_krw = diff;
        row.diff_pct = roundedCurrent === 0 ? null : diff / roundedCurrent;
        row.price_state = Math.abs(diff) >= 1 ? "OUT_OF_SYNC" : "OK";
      }
    }
  }

  if (!channelId || !includeUnmapped || onlyOverrides || onlyAdjustments) {
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
      const masterItemId = String((r as { master_item_id?: string | null }).master_item_id ?? "");
      return {
        channel_id: channelId,
        channel_product_id: masterItemId,
        master_item_id: masterItemId,
        model_name: (r as { model_name?: string | null }).model_name ?? null,
        external_product_no: "-",
        external_variant_code: null,
        category_code: (r as { category_code?: string | null }).category_code ?? null,
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
      };
    });

  const mergedRows = priceState === "UNMAPPED" ? unmappedRows : [...mappedRows, ...unmappedRows];

  return NextResponse.json({ data: mergedRows }, { headers: { "Cache-Control": "no-store" } });
}
