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
  const rows = (data ?? []) as Array<{
    receipt_id?: string | null;
    receipt_line_uuid?: string | null;
    vendor_party_id?: string | null;
    vendor_name?: string | null;
    issued_at?: string | null;
    model_name?: string | null;
    material_code?: string | null;
    factory_weight_g?: number | null;
    vendor_seq_no?: number | null;
    customer_factory_code?: string | null;
    remark?: string | null;
  }>;

  if (rows.some((row) => !row.receipt_line_uuid)) {
    const { data: lineRows, error: lineError } = await supabase
      .from("cms_v_receipt_line_items_flat_v1")
      .select("receipt_line_uuid, model_name, material_code, color, size, vendor_seq_no, remark")
      .eq("receipt_id", receiptId);

    if (!lineError) {
      const candidates = (lineRows ?? []) as Array<{
        receipt_line_uuid?: string | null;
        model_name?: string | null;
        material_code?: string | null;
        color?: string | null;
        size?: string | null;
        vendor_seq_no?: number | null;
        remark?: string | null;
      }>;

      rows.forEach((row) => {
        if (row.receipt_line_uuid) return;
        const match = candidates.find((candidate) => {
          if (row.vendor_seq_no !== null && row.vendor_seq_no !== undefined) {
            return candidate.vendor_seq_no === row.vendor_seq_no && candidate.model_name === row.model_name;
          }
          return (
            candidate.model_name === row.model_name &&
            candidate.material_code === row.material_code &&
            candidate.color === (row as { color?: string | null }).color &&
            candidate.size === (row as { size?: string | null }).size &&
            candidate.remark === row.remark
          );
        });
        if (match?.receipt_line_uuid) {
          row.receipt_line_uuid = match.receipt_line_uuid;
        }
      });
    }
  }

  const lineIds = rows
    .map((row) => row.receipt_line_uuid)
    .filter((id): id is string => Boolean(id));

  if (lineIds.length === 0) {
    return NextResponse.json({ data: rows });
  }

  const { data: sizeRows, error: sizeError } = await supabase
    .from("cms_v_receipt_line_items_flat_v1")
    .select("receipt_line_uuid, size, color, line_item_json")
    .in("receipt_line_uuid", lineIds);

  if (sizeError) {
    return NextResponse.json({ error: sizeError.message ?? "사이즈 조회 실패" }, { status: 500 });
  }

  function parseNumeric(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    return null;
  }

  const sizeMap = new Map(
    (sizeRows ?? []).map((row) => [row.receipt_line_uuid, row])
  );
  const merged = rows.map((row) => {
    const extra = row.receipt_line_uuid ? sizeMap.get(row.receipt_line_uuid) ?? null : null;
    const lineJson = (extra?.line_item_json ?? null) as Record<string, unknown> | null;

    return {
      ...row,
      size: extra?.size ?? null,
      color: extra?.color ?? null,
      weight_raw_g: parseNumeric(lineJson?.weight_raw_g),
      weight_deduct_g: parseNumeric(lineJson?.weight_deduct_g),
      stone_center_qty: parseNumeric(lineJson?.stone_center_qty),
      stone_sub1_qty: parseNumeric(lineJson?.stone_sub1_qty),
      stone_sub2_qty: parseNumeric(lineJson?.stone_sub2_qty),
    };
  });

  return NextResponse.json({ data: merged });
}
