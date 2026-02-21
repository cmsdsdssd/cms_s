import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ShipmentHeaderRow = {
  shipment_id: string;
  customer_party_id: string | null;
  confirmed_at: string | null;
};

type ShipmentLineRow = {
  shipment_id: string | null;
  shipment_line_id: string;
  order_line_id: string | null;
  total_amount_sell_krw: number | null;
};

type ArLedgerRow = {
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  amount_krw?: number | null;
};

type OrderLineRow = {
  order_line_id: string;
  status: string | null;
  qty: number | null;
  model_name: string | null;
};

type CheckResult = {
  status: "CRITICAL" | "WARNING" | "OK" | "INFO";
  count?: number;
  details?: unknown;
  message: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: "public" } });
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 설정이 없습니다" }, { status: 500 });
  }

  const results: {
    timestamp: string;
    checks: Record<string, CheckResult>;
    summary: { critical: number; warning: number; ok: number };
    overallStatus?: "CRITICAL" | "WARNING" | "OK";
  } = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: { critical: 0, warning: 0, ok: 0 },
  };

  try {
    const { data: confirmedShipments, error: confirmedError } = await supabase
      .from("cms_shipment_header")
      .select("shipment_id, customer_party_id, confirmed_at")
      .eq("status", "CONFIRMED")
      .limit(500);

    if (confirmedError) throw confirmedError;

    const shipmentRows = (confirmedShipments ?? []) as ShipmentHeaderRow[];
    const shipmentIds = shipmentRows.map((row) => row.shipment_id);

    if (shipmentIds.length === 0) {
      results.checks.shipmentsWithoutAR = {
        status: "OK",
        count: 0,
        details: [],
        message: "확정 출고 데이터가 없어 검증 대상을 찾지 못했습니다",
      };
      results.checks.orderStatus = {
        status: "OK",
        count: 0,
        details: [],
        message: "검증 대상 주문이 없습니다",
      };
      results.checks.amountMismatch = {
        status: "OK",
        count: 0,
        details: [],
        message: "검증 대상 금액 데이터가 없습니다",
      };
      results.summary.ok += 3;
      results.overallStatus = "OK";
      return NextResponse.json(results);
    }

    const [
      arByShipment,
      shipmentLines,
      lineArRows,
    ] = await Promise.all([
      supabase
        .from("cms_ar_ledger")
        .select("shipment_id")
        .in("shipment_id", shipmentIds),
      supabase
        .from("cms_shipment_line")
        .select("shipment_id, shipment_line_id, order_line_id, total_amount_sell_krw")
        .in("shipment_id", shipmentIds)
        .limit(5000),
      supabase
        .from("cms_ar_ledger")
        .select("shipment_line_id, amount_krw")
        .in("shipment_id", shipmentIds)
        .limit(5000),
    ]);

    if (arByShipment.error) throw arByShipment.error;
    if (shipmentLines.error) throw shipmentLines.error;
    if (lineArRows.error) throw lineArRows.error;

    const arShipmentIdSet = new Set(
      ((arByShipment.data ?? []) as ArLedgerRow[])
        .map((row) => row.shipment_id ?? "")
        .filter(Boolean)
    );

    const shipmentsWithoutAR = shipmentRows
      .filter((shipment) => !arShipmentIdSet.has(shipment.shipment_id))
      .slice(0, 5)
      .map((shipment) => ({
        shipment_id: shipment.shipment_id,
        customer_party_id: shipment.customer_party_id,
        confirmed_at: shipment.confirmed_at,
      }));

    const shipmentsWithoutARCount = shipmentRows.filter(
      (shipment) => !arShipmentIdSet.has(shipment.shipment_id)
    ).length;

    results.checks.shipmentsWithoutAR = {
      status: shipmentsWithoutARCount > 0 ? "CRITICAL" : "OK",
      count: shipmentsWithoutARCount,
      details: shipmentsWithoutAR,
      message:
        shipmentsWithoutARCount > 0
          ? "출고 확정 시 자동으로 AR이 생성되지 않고 있습니다!"
          : "모든 확정 출고에 AR이 정상 생성됨",
    };

    if (shipmentsWithoutARCount > 0) results.summary.critical++;
    else results.summary.ok++;

    const shipmentLineRows = (shipmentLines.data ?? []) as ShipmentLineRow[];
    const orderLineIds = Array.from(
      new Set(shipmentLineRows.map((row) => row.order_line_id ?? "").filter(Boolean))
    );

    let notShippedOrders: OrderLineRow[] = [];
    if (orderLineIds.length > 0) {
      const { data: orderRows, error: orderError } = await supabase
        .from("cms_order_line")
        .select("order_line_id, status, qty, model_name")
        .in("order_line_id", orderLineIds)
        .limit(5000);
      if (orderError) throw orderError;

      notShippedOrders = ((orderRows ?? []) as OrderLineRow[]).filter(
        (row) => row.status !== "SHIPPED" && row.status !== "CANCELLED"
      );
    }

    results.checks.orderStatus = {
      status: notShippedOrders.length > 0 ? "WARNING" : "OK",
      count: notShippedOrders.length,
      details: notShippedOrders.slice(0, 5),
      message:
        notShippedOrders.length > 0
          ? "출고된 주문의 상태가 SHIPPED로 업데이트되지 않음"
          : "주문 상태가 정상적으로 업데이트됨",
    };

    if (notShippedOrders.length > 0) results.summary.warning++;
    else results.summary.ok++;

    const arByShipmentLine = new Map<string, number>();
    for (const row of (lineArRows.data ?? []) as ArLedgerRow[]) {
      const shipmentLineId = row.shipment_line_id ?? null;
      if (!shipmentLineId) continue;
      arByShipmentLine.set(shipmentLineId, Number(row.amount_krw ?? 0));
    }

    let mismatchedAmounts = 0;
    const mismatches: Array<{
      shipment_line_id: string;
      shipment_amount: number;
      ar_amount: number;
      diff: number;
    }> = [];

    for (const line of shipmentLineRows) {
      if (line.total_amount_sell_krw === null) continue;
      const arAmount = arByShipmentLine.get(line.shipment_line_id);
      if (arAmount === undefined) continue;
      if (Number(arAmount) !== Number(line.total_amount_sell_krw)) {
        mismatchedAmounts++;
        if (mismatches.length < 5) {
          mismatches.push({
            shipment_line_id: line.shipment_line_id,
            shipment_amount: Number(line.total_amount_sell_krw),
            ar_amount: Number(arAmount),
            diff: Number(arAmount) - Number(line.total_amount_sell_krw),
          });
        }
      }
    }

    results.checks.amountMismatch = {
      status: mismatchedAmounts > 0 ? "WARNING" : "OK",
      count: mismatchedAmounts,
      details: mismatches,
      message:
        mismatchedAmounts > 0
          ? "출고 금액과 AR 금액이 불일치하는 경우 발견"
          : "모든 출고-AR 금액이 일치함",
    };

    if (mismatchedAmounts > 0) results.summary.warning++;
    else results.summary.ok++;

    try {
      const { data: triggers } = await supabase.rpc("get_triggers", {
        table_name: "cms_shipment_header",
      });

      results.checks.triggers = {
        status: triggers && triggers.length > 0 ? "OK" : "INFO",
        count: triggers?.length || 0,
        details: triggers,
        message:
          triggers && triggers.length > 0
            ? "자동화 트리거가 설정됨"
            : "자동화 트리거가 없음 (수동 처리 중일 수 있음)",
      };
    } catch {
      results.checks.triggers = {
        status: "INFO",
        message: "트리거 확인 RPC가 없음 (무시 가능)",
      };
    }

    results.overallStatus =
      results.summary.critical > 0
        ? "CRITICAL"
        : results.summary.warning > 0
          ? "WARNING"
          : "OK";

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        error: "검증 중 오류 발생",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
