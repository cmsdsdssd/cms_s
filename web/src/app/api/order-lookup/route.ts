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
      "order_id, order_line_id, order_no, order_date, client_id, client_name, client_code, model_no, color, status, plating_status, plating_color"
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

  return NextResponse.json({ data: data ?? [] });
}
