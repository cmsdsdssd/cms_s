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
  if (!receiptId) {
    return NextResponse.json({ error: "receipt_id가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_receipt_inbox")
    .select("receipt_id, vendor_party_id, bill_no, issued_at, memo")
    .eq("receipt_id", receiptId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "헤더 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
