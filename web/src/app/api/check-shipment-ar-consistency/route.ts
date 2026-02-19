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
  const shipmentId = String(searchParams.get("shipment_id") ?? "").trim();
  if (!shipmentId) {
    return NextResponse.json({ error: "shipment_id 값이 필요합니다." }, { status: 400 });
  }

  const { data: shipmentRows, error: shipmentError } = await supabase
    .from("cms_shipment_line")
    .select("total_amount_sell_krw")
    .eq("shipment_id", shipmentId);

  if (shipmentError) {
    return NextResponse.json({ error: shipmentError.message ?? "출고 금액 조회 실패" }, { status: 500 });
  }

  const { data: arRows, error: arError } = await supabase
    .from("cms_ar_ledger")
    .select("amount_krw")
    .eq("shipment_id", shipmentId)
    .eq("entry_type", "SHIPMENT");

  if (arError) {
    return NextResponse.json({ error: arError.message ?? "AR 금액 조회 실패" }, { status: 500 });
  }

  const shipmentTotal = (shipmentRows ?? []).reduce((sum, row) => {
    const value = Number((row as { total_amount_sell_krw?: number | null }).total_amount_sell_krw ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const arTotal = (arRows ?? []).reduce((sum, row) => {
    const value = Number((row as { amount_krw?: number | null }).amount_krw ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return NextResponse.json({
    data: {
      shipment_id: shipmentId,
      shipment_total_sell_krw: shipmentTotal,
      ar_total_krw: arTotal,
      ar_row_count: (arRows ?? []).length,
      is_consistent: Math.round(shipmentTotal) === Math.round(arTotal),
      diff_krw: Math.round(arTotal - shipmentTotal),
    },
  });
}
