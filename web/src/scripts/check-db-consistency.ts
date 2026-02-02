/**
 * DB 확인 스크립트
 * 
 * 사용법:
 * 1. 이 파일을 web/src/scripts/check-db-consistency.ts로 저장
 * 2. npx ts-node web/src/scripts/check-db-consistency.ts 실행
 * 
 * 또는 Next.js API Route로 만들어서 호출:
 * - web/src/app/api/check-consistency/route.ts 참고
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: "public" },
});

async function checkTriggers() {
  console.log("\n=== 1. 트리거 확인 ===");
  
  const { data, error } = await supabase
    .from("pg_trigger")
    .select("tgname, tgrelid::regclass as table_name")
    .eq("tgrelid::regclass", "cms_shipment_header")
    .single();

  if (error) {
    console.log("❌ 트리거 확인 실패:", error.message);
    return;
  }

  if (data) {
    console.log("✅ 트리거 발견:", data.tgname);
  } else {
    console.log("⚠️  트리거 없음! 자동 AR 생성 안 될 수 있음");
  }
}

async function checkOrphanedShipments() {
  console.log("\n=== 2. 주문 없는 출고 확인 ===");
  
  const { data, error, count } = await supabase
    .from("cms_shipment_line")
    .select("shipment_line_id", { count: "exact" })
    .is("order_line_id", null);

  if (error) {
    console.log("❌ 쿼리 실패:", error.message);
    return;
  }

  console.log(`ℹ️  주문 없는 출고 라인: ${count || 0}개`);
  if (data && data.length > 0) {
    console.log("예시:", data.slice(0, 3));
  }
}

async function checkShipmentsWithoutAR() {
  console.log("\n=== 3. AR 없는 확정 출고 확인 (Critical) ===");
  
  const { data, error } = await supabase.rpc("check_shipments_without_ar");
  
  if (error) {
    // RPC가 없으면 직접 쿼리
    const { data: shipments, error: qError } = await supabase
      .from("cms_shipment_header")
      .select(`
        shipment_id,
        customer_party_id,
        confirmed_at,
        cms_shipment_line:shipment_id (
          total_amount_sell_krw
        )
      `)
      .eq("status", "CONFIRMED")
      .limit(100);

    if (qError) {
      console.log("❌ 쿼리 실패:", qError.message);
      return;
    }

    // 각 출고별 AR 확인
    let withoutARCount = 0;
    for (const shipment of shipments || []) {
      const { data: ar } = await supabase
        .from("cms_ar_ledger")
        .select("ar_ledger_id")
        .eq("shipment_id", shipment.shipment_id)
        .limit(1);

      if (!ar || ar.length === 0) {
        withoutARCount++;
        console.log(`⚠️  AR 없음: shipment_id=${shipment.shipment_id}`);
      }
    }

    if (withoutARCount === 0) {
      console.log("✅ 모든 확정 출고에 AR이 생성됨");
    } else {
      console.log(`\n❌ ${withoutARCount}개의 출고에 AR이 없음!`);
    }
  }
}

async function checkAmountMismatch() {
  console.log("\n=== 4. 금액 불일치 확인 ===");
  
  const { data, error } = await supabase
    .from("cms_shipment_line")
    .select(`
      shipment_line_id,
      total_amount_sell_krw,
      cms_ar_ledger:shipment_line_id (
        amount_krw
      )
    `)
    .not("cms_ar_ledger", "is", null)
    .limit(100);

  if (error) {
    console.log("❌ 쿼리 실패:", error.message);
    return;
  }

  let mismatchCount = 0;
  for (const row of data || []) {
    const shipmentAmount = row.total_amount_sell_krw;
    const arAmount = row.cms_ar_ledger?.[0]?.amount_krw;
    
    if (shipmentAmount !== arAmount) {
      mismatchCount++;
      console.log(`⚠️  불일치: ${row.shipment_line_id}`);
      console.log(`  출고금액: ${shipmentAmount}, AR금액: ${arAmount}`);
    }
  }

  if (mismatchCount === 0) {
    console.log("✅ 모든 출고-AR 금액 일치");
  } else {
    console.log(`\n❌ ${mismatchCount}개의 금액 불일치 발견!`);
  }
}

async function checkOrderStatus() {
  console.log("\n=== 5. 주문 상태 확인 ===");
  
  const { data, error } = await supabase
    .from("cms_order_line")
    .select("order_line_id, status, cms_shipment_line:order_line_id (shipment_id)")
    .not("cms_shipment_line", "is", null)
    .limit(50);

  if (error) {
    console.log("❌ 쿼리 실패:", error.message);
    return;
  }

  let notShippedCount = 0;
  for (const order of data || []) {
    if (order.status !== "SHIPPED" && order.status !== "CANCELLED") {
      notShippedCount++;
      console.log(`⚠️  출고 있지만 상태가 ${order.status}: ${order.order_line_id}`);
    }
  }

  if (notShippedCount === 0) {
    console.log("✅ 출고된 주문의 상태가 SHIPPED로 정상 설정됨");
  } else {
    console.log(`\n❌ ${notShippedCount}개의 주문 상태가 업데이트되지 않음!`);
  }
}

async function main() {
  console.log("🚀 DB 일관성 검증 시작...");
  console.log("Supabase URL:", supabaseUrl);

  try {
    await checkTriggers();
    await checkOrphanedShipments();
    await checkShipmentsWithoutAR();
    await checkAmountMismatch();
    await checkOrderStatus();

    console.log("\n✅ 검증 완료!");
  } catch (err) {
    console.error("\n❌ 검증 중 오류:", err);
  }
}

main();
