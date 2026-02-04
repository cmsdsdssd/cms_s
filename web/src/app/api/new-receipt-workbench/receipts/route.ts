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
  const limitRaw = searchParams.get("limit");
  const status = searchParams.get("status");
  const vendorPartyId = searchParams.get("vendor_party_id");
  const receivedFrom = searchParams.get("received_from");
  const receivedTo = searchParams.get("received_to");
  const unlinkedOnlyRaw = searchParams.get("unlinked_only");
  const unlinkedOnly = ["true", "1", "yes"].includes((unlinkedOnlyRaw ?? "").toLowerCase());

  const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);

  let query = supabase
    .from("cms_v_receipt_inbox_open_v1")
    .select(
      "receipt_id, received_at, status, vendor_party_id, vendor_name, bill_no, issued_at, memo, pricing_total_amount, pricing_total_amount_krw"
    )
    .order("received_at", { ascending: false })
    .limit(limit);

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (vendorPartyId) {
    query = query.eq("vendor_party_id", vendorPartyId);
  }
  if (receivedFrom) {
    query = query.gte("received_at", receivedFrom);
  }
  if (receivedTo) {
    query = query.lte("received_at", `${receivedTo}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "작업대 조회 실패" }, { status: 500 });
  }
  const rows = (data ?? []) as Array<{ receipt_id?: string | null }>;
  if (!unlinkedOnly || rows.length === 0) {
    return NextResponse.json({ data: rows });
  }

  const receiptIds = rows.map((row) => row.receipt_id).filter((id): id is string => Boolean(id));
  if (receiptIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: unlinkedRows, error: unlinkedError } = await supabase
    .from("cms_v_receipt_line_unlinked_v1")
    .select("receipt_id")
    .in("receipt_id", receiptIds);

  if (unlinkedError) {
    return NextResponse.json({ error: unlinkedError.message ?? "미매칭 라인 조회 실패" }, { status: 500 });
  }

  const unlinkedSet = new Set(
    (unlinkedRows ?? [])
      .map((row) => row.receipt_id)
      .filter((id): id is string => Boolean(id))
  );
  const filtered = rows.filter((row) => row.receipt_id && unlinkedSet.has(row.receipt_id));

  return NextResponse.json({ data: filtered });
}
