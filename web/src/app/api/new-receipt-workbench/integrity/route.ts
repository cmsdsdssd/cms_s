import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
  const receiptId = searchParams.get("receipt_id");
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);

  if (!receiptId) {
    return NextResponse.json({ error: "receipt_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_v_receipt_line_link_integrity_v1")
    .select("*")
    .eq("receipt_id", receiptId)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message ?? "링크 오류 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
