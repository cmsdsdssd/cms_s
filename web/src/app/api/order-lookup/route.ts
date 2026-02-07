import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .schema("public")
    .from("v_cms_order_lookup")
    .select(
      "order_id, order_line_id, order_no, order_date, client_id, client_name, client_code, model_no, color, material_code, status, plating_status, plating_color"
    )
    .order("order_date", { ascending: true })
    .limit(limit);

  if (q) {
    query = query.or(
      `order_no.ilike.%${q}%,client_name.ilike.%${q}%,client_code.ilike.%${q}%,model_no.ilike.%${q}%,client_name_initials.ilike.%${q}%,client_code_initials.ilike.%${q}%,model_no_initials.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const orderLineIds = rows
    .map((row) => (typeof row.order_line_id === "string" ? row.order_line_id : null))
    .filter((id): id is string => Boolean(id));

  if (orderLineIds.length > 0) {
    const { data: orderLines, error: orderLineError } = await supabase
      .schema("public")
      .from("cms_order_line")
      .select(
        "order_line_id, size, center_stone_qty, sub1_stone_qty, sub2_stone_qty, center_stone_source, sub1_stone_source, sub2_stone_source, is_plated, plating_color_code"
      )
      .in("order_line_id", orderLineIds);

    if (orderLineError) {
      return NextResponse.json({ error: orderLineError.message ?? "주문 라인 상세 조회 실패" }, { status: 500 });
    }

    const orderLineMap = new Map((orderLines ?? []).map((row) => [row.order_line_id, row]));
    rows.forEach((row) => {
      const orderLineId = typeof row.order_line_id === "string" ? row.order_line_id : null;
      if (!orderLineId) return;
      const detail = orderLineMap.get(orderLineId);
      if (!detail) return;
      row.size = detail.size ?? null;
      row.stone_center_qty = detail.center_stone_qty ?? null;
      row.stone_sub1_qty = detail.sub1_stone_qty ?? null;
      row.stone_sub2_qty = detail.sub2_stone_qty ?? null;
      row.center_stone_source = detail.center_stone_source ?? null;
      row.sub1_stone_source = detail.sub1_stone_source ?? null;
      row.sub2_stone_source = detail.sub2_stone_source ?? null;
      row.plating_status = detail.is_plated ?? null;
      row.plating_color = detail.plating_color_code ?? null;
    });
  }

  return NextResponse.json({ data: rows });
}
