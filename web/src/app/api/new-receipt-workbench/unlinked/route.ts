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
  const limit = Math.min(Math.max(parseInt(limitRaw ?? "200", 10) || 200, 1), 500);

  if (!receiptId) {
    return NextResponse.json({ error: "receipt_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_v_receipt_line_unlinked_v1")
    .select(
      "receipt_id, receipt_line_uuid, vendor_party_id, vendor_name, issued_at, model_name, material_code, factory_weight_g, vendor_seq_no, customer_factory_code, remark"
    )
    .eq("receipt_id", receiptId)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message ?? "미매칭 라인 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
