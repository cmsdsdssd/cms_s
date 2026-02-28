import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

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
  const priceState = (searchParams.get("price_state") ?? "").trim();
  const modelName = (searchParams.get("model_name") ?? "").trim();
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
  if (priceState) q = q.eq("price_state", priceState);
  if (modelName) q = q.ilike("model_name", `%${modelName}%`);
  if (onlyOverrides) q = q.not("active_override_id", "is", null);
  if (onlyAdjustments) q = q.gt("active_adjustment_count", 0);

  const { data, error } = await q;
  if (error) return jsonError(error.message ?? "대시보드 조회 실패", 500);

  const mappedRows = (data ?? []) as DashboardRow[];

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
