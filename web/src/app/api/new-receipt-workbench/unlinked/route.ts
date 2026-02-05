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

  const { data: baseRows, error: baseError } = await supabase
    .from("cms_v_receipt_line_items_flat_v1")
    .select(
      "receipt_id, receipt_line_uuid, vendor_party_id, vendor_name, issued_at, model_name, material_code, factory_weight_g, vendor_seq_no, customer_factory_code, remark, size, color, line_item_json"
    )
    .eq("receipt_id", receiptId)
    .limit(limit);
  if (baseError) {
    return NextResponse.json({ error: baseError.message ?? "미매칭 라인 조회 실패" }, { status: 500 });
  }

  const { data: confirmed, error: confirmedError } = await supabase
    .from("cms_receipt_line_match")
    .select("receipt_line_uuid")
    .eq("receipt_id", receiptId)
    .eq("status", "CONFIRMED")
    .limit(1000);
  if (confirmedError) {
    return NextResponse.json({ error: confirmedError.message ?? "미매칭 라인 조회 실패" }, { status: 500 });
  }
  const confirmedSet = new Set(
    (confirmed ?? []).map((row) => row.receipt_line_uuid).filter((id): id is string => Boolean(id))
  );
  const rows = (baseRows ?? []).filter((row) => !row.receipt_line_uuid || !confirmedSet.has(row.receipt_line_uuid));

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

  function parseNumeric(value: unknown) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
    return null;
  }

  const mapped = rows.map((row) => {
    const lineJson = (row.line_item_json ?? null) as Record<string, unknown> | null;
    return {
      receipt_id: row.receipt_id ?? null,
      receipt_line_uuid: row.receipt_line_uuid ?? null,
      vendor_party_id: row.vendor_party_id ?? null,
      vendor_name: row.vendor_name ?? null,
      issued_at: row.issued_at ?? null,
      model_name: row.model_name ?? null,
      material_code: row.material_code ?? null,
      factory_weight_g: row.factory_weight_g ?? null,
      vendor_seq_no: row.vendor_seq_no ?? null,
      customer_factory_code: row.customer_factory_code ?? null,
      remark: row.remark ?? null,
      size: row.size ?? null,
      color: row.color ?? null,
      weight_raw_g: parseNumeric(lineJson?.weight_raw_g),
      weight_deduct_g: parseNumeric(lineJson?.weight_deduct_g),
      stone_center_qty: parseNumeric(lineJson?.stone_center_qty),
      stone_sub1_qty: parseNumeric(lineJson?.stone_sub1_qty),
      stone_sub2_qty: parseNumeric(lineJson?.stone_sub2_qty),
    };
  });

  return NextResponse.json({ data: mapped });
}
