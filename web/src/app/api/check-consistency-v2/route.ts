/**
 * DB 일관성 확인 API - 수정 버전
 * GET /api/check-consistency-v2
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: "public" } });
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 설정 없음" }, { status: 500 });
  }

  try {
    // 1. 간단하게: 전체 통계만 확인
    const { data: stats, error: statsError } = await supabase
      .from("cms_shipment_header")
      .select("status, count", { count: "exact" })
      .eq("status", "CONFIRMED");

    const { count: confirmedCount } = await supabase
      .from("cms_shipment_header")
      .select("*", { count: "exact", head: true })
      .eq("status", "CONFIRMED");

    const { count: arCount } = await supabase
      .from("cms_ar_ledger")
      .select("*", { count: "exact", head: true })
      .eq("entry_type", "SHIPMENT");

    // 2. 누락 AR 간단 확인
    const { data: missingAR, error: missingError } = await supabase.rpc(
      "check_missing_ar_count"
    );

    // 3. 결과 반환
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      simpleStats: {
        confirmedShipments: confirmedCount || 0,
        arEntries: arCount || 0,
        difference: (confirmedCount || 0) - (arCount || 0),
      },
      status:
        (confirmedCount || 0) <= (arCount || 0) ? "OK" : "NEEDS_CHECK",
      message:
        (confirmedCount || 0) <= (arCount || 0)
          ? "정상: 출고 수 <= AR 수"
          : `주의: ${(confirmedCount || 0) - (arCount || 0)}개 출고에 AR 누락 가능`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
