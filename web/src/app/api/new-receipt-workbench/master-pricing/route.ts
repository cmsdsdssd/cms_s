import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type MasterPricingRow = {
  master_item_id?: string | null;
  labor_base_sell?: number | null;
  labor_base_cost?: number | null;
  labor_center_sell?: number | null;
  labor_center_cost?: number | null;
  labor_sub1_sell?: number | null;
  labor_sub1_cost?: number | null;
  labor_sub2_sell?: number | null;
  labor_sub2_cost?: number | null;
  labor_bead_sell?: number | null;
  labor_bead_cost?: number | null;
  setting_addon_margin_krw_per_piece?: number | null;
  stone_addon_margin_krw_per_piece?: number | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = String(searchParams.get("item_id") ?? "").trim();
  const orderLineId = String(searchParams.get("order_line_id") ?? "").trim();

  if (!itemId && !orderLineId) {
    return NextResponse.json({ error: "item_id 또는 order_line_id 값이 필요합니다." }, { status: 400 });
  }

  let resolvedItemId = itemId;
  if (!resolvedItemId && orderLineId) {
    const { data: orderLine, error: orderError } = await supabase
      .from("cms_order_line")
      .select("matched_master_id")
      .eq("order_line_id", orderLineId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message ?? "주문 라인 조회 실패" }, { status: 500 });
    }

    resolvedItemId = String(orderLine?.matched_master_id ?? "").trim();
    if (!resolvedItemId) {
      return NextResponse.json({ data: null });
    }
  }

  const { data, error } = await supabase
    .from("cms_master_item")
    .select(
      "master_item_id, labor_base_sell, labor_base_cost, labor_center_sell, labor_center_cost, labor_sub1_sell, labor_sub1_cost, labor_sub2_sell, labor_sub2_cost, labor_bead_sell, labor_bead_cost, setting_addon_margin_krw_per_piece, stone_addon_margin_krw_per_piece, weight_default_g, deduction_weight_default_g"
    )
    .eq("master_item_id", resolvedItemId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "마스터 원가 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? null) as MasterPricingRow | null });
}
