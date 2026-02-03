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
  const orderLineId = String(searchParams.get("order_line_id") ?? "").trim();
  if (!orderLineId) {
    return NextResponse.json({ error: "order_line_id 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_receipt_line_match")
    .select(
      "receipt_id, receipt_line_uuid, order_line_id, status, selected_weight_g, selected_material_code, selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw, confirmed_at"
    )
    .eq("order_line_id", orderLineId)
    .eq("status", "CONFIRMED")
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ data: null });
  }

  let receiptWeightG: number | null = null;
  let receiptDeductionWeightG: number | null = null;

  if (data.receipt_id && data.receipt_line_uuid) {
    const { data: lineRow } = await supabase
      .from("cms_v_receipt_line_items_flat_v1")
      .select("factory_weight_g, line_item_json")
      .eq("receipt_id", data.receipt_id)
      .eq("receipt_line_uuid", data.receipt_line_uuid)
      .maybeSingle();

    const lineJson = (lineRow?.line_item_json ?? null) as Record<string, unknown> | null;
    const raw = lineJson?.weight_raw_g ?? null;
    const deduct = lineJson?.weight_deduct_g ?? null;

    if (typeof raw === "number") {
      receiptWeightG = raw;
    } else if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
      receiptWeightG = Number(raw);
    } else if (typeof lineRow?.factory_weight_g === "number") {
      receiptWeightG = lineRow.factory_weight_g;
    }

    if (typeof deduct === "number") {
      receiptDeductionWeightG = deduct;
    } else if (typeof deduct === "string" && deduct.trim() !== "" && Number.isFinite(Number(deduct))) {
      receiptDeductionWeightG = Number(deduct);
    }
  }

  return NextResponse.json({
    data: {
      ...data,
      receipt_weight_g: receiptWeightG,
      receipt_deduction_weight_g: receiptDeductionWeightG,
    },
  });
}
