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
    .from("cms_v_receipt_line_items_flat_v1")
    .select(
      "receipt_id, receipt_line_uuid, customer_factory_code, model_name, material_code, qty, factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw, size, color, vendor_seq_no, remark, line_item_json"
    )
    .eq("receipt_id", receiptId)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message ?? "라인 조회 실패" }, { status: 500 });
  }

  function parseNumeric(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    return null;
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const mapped = rows.map((row) => {
    const lineJson = (row.line_item_json ?? null) as Record<string, unknown> | null;
    return {
      receipt_id: row.receipt_id ?? null,
      receipt_line_uuid: row.receipt_line_uuid ?? null,
      customer_factory_code: row.customer_factory_code ?? null,
      model_name: row.model_name ?? null,
      material_code: row.material_code ?? null,
      qty: row.qty ?? null,
      weight_g: row.factory_weight_g ?? null,
      weight_raw_g: parseNumeric(lineJson?.weight_raw_g),
      weight_deduct_g: parseNumeric(lineJson?.weight_deduct_g),
      labor_basic_cost_krw: row.factory_labor_basic_cost_krw ?? null,
      labor_other_cost_krw: row.factory_labor_other_cost_krw ?? null,
      total_amount_krw: row.factory_total_amount_krw ?? null,
      stone_center_qty: parseNumeric(lineJson?.stone_center_qty),
      stone_sub1_qty: parseNumeric(lineJson?.stone_sub1_qty),
      stone_sub2_qty: parseNumeric(lineJson?.stone_sub2_qty),
      stone_center_unit_cost_krw: parseNumeric(lineJson?.stone_center_unit_cost_krw),
      stone_sub1_unit_cost_krw: parseNumeric(lineJson?.stone_sub1_unit_cost_krw),
      stone_sub2_unit_cost_krw: parseNumeric(lineJson?.stone_sub2_unit_cost_krw),
      size: row.size ?? null,
      color: row.color ?? null,
      vendor_seq_no: row.vendor_seq_no ?? null,
      remark: row.remark ?? null,
    };
  });

  return NextResponse.json({ data: mapped });
}
