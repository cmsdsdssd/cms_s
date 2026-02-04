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
  const vendorPartyId = searchParams.get("vendor_party_id") ?? "";
  const billDate = searchParams.get("bill_date") ?? "";
  const receiptId = searchParams.get("receipt_id");
  const vendorToken = searchParams.get("vendor_token") ?? "";

  if (!vendorPartyId || !billDate) {
    return NextResponse.json({ error: "vendor_party_id, bill_date가 필요합니다." }, { status: 400 });
  }

  let query = supabase
    .from("cms_v_receipt_inbox_open_v1")
    .select("receipt_id, bill_no, issued_at")
    .eq("vendor_party_id", vendorPartyId)
    .eq("issued_at", billDate);

  if (receiptId) {
    query = query.neq("receipt_id", receiptId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "영수증 조회 실패" }, { status: 500 });
  }

  const rows = data ?? [];
  const dateToken = billDate.replaceAll("-", "");
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = vendorToken ? new RegExp(`^${escapeRegExp(dateToken)}_${escapeRegExp(vendorToken)}_(\\d+)$`) : null;
  let maxSeq = 0;

  if (pattern) {
    rows.forEach((row) => {
      const billNo = row.bill_no ?? "";
      const match = billNo.match(pattern);
      if (!match) return;
      const parsed = Number(match[1] ?? 0);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    });
  }

  const nextSeq = maxSeq > 0 ? maxSeq + 1 : rows.length + 1;

  return NextResponse.json({
    data: {
      count: rows.length,
      next_seq: nextSeq,
    },
  });
}
