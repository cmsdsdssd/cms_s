/**
 * DB 일관성 확인 API
 * GET /api/check-consistency
 * 
 * 주의: 이 API는 관리자용이며 민감한 정보를 반환할 수 있음
 * 프로덕션에서는 인증 미들웨어를 추가하세요
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase Admin 클라이언트
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key, {
    db: { schema: "public" },
  });
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 설정이 없습니다" },
      { status: 500 }
    );
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: {
      critical: 0,
      warning: 0,
      ok: 0,
    },
  };

  try {
    // 1. AR 없는 확정 출고 확인 (Critical)
    console.log("Checking shipments without AR...");
    const { data: confirmedShipments, error: se1 } = await supabase
      .from("cms_shipment_header")
      .select("shipment_id, customer_party_id, confirmed_at")
      .eq("status", "CONFIRMED")
      .limit(100);

    if (se1) throw se1;

    const shipmentsWithoutAR: any[] = [];
    for (const shipment of confirmedShipments || []) {
      const { data: ar, error: ae1 } = await supabase
        .from("cms_ar_ledger")
        .select("ar_ledger_id, amount_krw")
        .eq("shipment_id", shipment.shipment_id)
        .limit(1);

      if (ae1) continue;

      if (!ar || ar.length === 0) {
        shipmentsWithoutAR.push({
          shipment_id: shipment.shipment_id,
          customer_party_id: shipment.customer_party_id,
          confirmed_at: shipment.confirmed_at,
        });
      }
    }

    results.checks.shipmentsWithoutAR = {
      status: shipmentsWithoutAR.length > 0 ? "CRITICAL" : "OK",
      count: shipmentsWithoutAR.length,
      details: shipmentsWithoutAR.slice(0, 5), // 상위 5개만
      message: shipmentsWithoutAR.length > 0 
        ? "출고 확정 시 자동으로 AR이 생성되지 않고 있습니다!"
        : "모든 확정 출고에 AR이 정상 생성됨",
    };

    if (shipmentsWithoutAR.length > 0) {
      results.summary.critical++;
    } else {
      results.summary.ok++;
    }

    // 2. 주문 상태 확인
    console.log("Checking order statuses...");
    const { data: shippedOrders, error: oe1 } = await supabase
      .from("cms_order_line")
      .select("order_line_id, status, qty, model_name")
      .in("order_line_id", 
        confirmedShipments?.map((s: any) => s.shipment_id) || []
      )
      .limit(50);

    const notShippedOrders = (shippedOrders || []).filter(
      (o: any) => o.status !== "SHIPPED" && o.status !== "CANCELLED"
    );

    results.checks.orderStatus = {
      status: notShippedOrders.length > 0 ? "WARNING" : "OK",
      count: notShippedOrders.length,
      details: notShippedOrders.slice(0, 5),
      message: notShippedOrders.length > 0
        ? "출고된 주문의 상태가 SHIPPED로 업데이트되지 않음"
        : "주문 상태가 정상적으로 업데이트됨",
    };

    if (notShippedOrders.length > 0) {
      results.summary.warning++;
    } else {
      results.summary.ok++;
    }

    // 3. 금액 불일치 확인
    console.log("Checking amount mismatches...");
    const { data: shipmentsWithAR, error: se2 } = await supabase
      .from("cms_shipment_line")
      .select("shipment_line_id, total_amount_sell_krw, shipment_id")
      .not("total_amount_sell_krw", "is", null)
      .limit(50);

    let mismatchedAmounts = 0;
    const mismatches: any[] = [];

    if (shipmentsWithAR) {
      for (const line of shipmentsWithAR) {
        const { data: arData } = await supabase
          .from("cms_ar_ledger")
          .select("amount_krw")
          .eq("shipment_line_id", line.shipment_line_id)
          .limit(1);

        if (arData && arData.length > 0) {
          const arAmount = arData[0].amount_krw;
          if (arAmount !== line.total_amount_sell_krw) {
            mismatchedAmounts++;
            if (mismatches.length < 5) {
              mismatches.push({
                shipment_line_id: line.shipment_line_id,
                shipment_amount: line.total_amount_sell_krw,
                ar_amount: arAmount,
                diff: arAmount - line.total_amount_sell_krw,
              });
            }
          }
        }
      }
    }

    results.checks.amountMismatch = {
      status: mismatchedAmounts > 0 ? "WARNING" : "OK",
      count: mismatchedAmounts,
      details: mismatches,
      message: mismatchedAmounts > 0
        ? "출고 금액과 AR 금액이 불일치하는 경우 발견"
        : "모든 출고-AR 금액이 일치함",
    };

    if (mismatchedAmounts > 0) {
      results.summary.warning++;
    } else {
      results.summary.ok++;
    }

    // 4. 트리거 확인 (정보용)
    console.log("Checking triggers...");
    try {
      const { data: triggers } = await supabase.rpc("get_triggers", {
        table_name: "cms_shipment_header",
      });

      results.checks.triggers = {
        status: triggers && triggers.length > 0 ? "OK" : "INFO",
        count: triggers?.length || 0,
        details: triggers,
        message: triggers && triggers.length > 0
          ? "자동화 트리거가 설정됨"
          : "자동화 트리거가 없음 (수동 처리 중일 수 있음)",
      };
    } catch (e) {
      results.checks.triggers = {
        status: "INFO",
        message: "트리저 확인 RPC가 없음 (무시 가능)",
      };
    }

    // 최종 결과
    results.overallStatus = results.summary.critical > 0 
      ? "CRITICAL" 
      : results.summary.warning > 0 
        ? "WARNING" 
        : "OK";

    return NextResponse.json(results);

  } catch (error) {
    console.error("Consistency check error:", error);
    return NextResponse.json(
      {
        error: "검증 중 오류 발생",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
