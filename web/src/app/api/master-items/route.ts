import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await supabase
    .schema("ms_s")
    .from("v_staff_master_list_v1")
    .select("*")
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
