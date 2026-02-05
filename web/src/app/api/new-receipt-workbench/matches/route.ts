import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function jsonError(
  message: string,
  status: number,
  meta?: { code?: string; hint?: string; details?: unknown }
) {
  return NextResponse.json(
    {
      error: {
        message,
        ...(meta?.code ? { code: meta.code } : null),
        ...(meta?.hint ? { hint: meta.hint } : null),
        ...(meta?.details ? { details: meta.details } : null),
      },
    },
    { status }
  );
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonError("Supabase 환경 변수가 설정되지 않았습니다.", 500);
  }

  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get("receipt_id");
  const limitRaw = searchParams.get("limit");
  const parsedLimit = Number(limitRaw ?? "200");
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 200, 1), 500);

  if (!isUuid(receiptId)) {
    return jsonError("receipt_id must be uuid", 400, { code: "INVALID_ARGUMENT" });
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("cms_receipt_line_match")
    .select(
      "receipt_id, receipt_line_uuid, shipment_id, shipment_line_id, order_line_id, confirmed_at, selected_weight_g, selected_material_code, note, status"
    )
    .eq("receipt_id", receiptId)
    .eq("status", "CONFIRMED")
    .limit(limit);

  if (matchError) {
    return jsonError(matchError.message ?? "매칭 목록 조회 실패", 500, {
      code: matchError.code ?? undefined,
      details: matchError.details ?? undefined,
      hint: matchError.hint ?? undefined,
    });
  }

  const matches = (matchRows ?? []) as Array<Record<string, unknown>>;
  if (matches.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const shipmentIds = Array.from(
    new Set(matches.map((row) => row.shipment_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  const orderLineIds = Array.from(
    new Set(matches.map((row) => row.order_line_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  const receiptLineUuids = Array.from(
    new Set(
      matches
        .map((row) => row.receipt_line_uuid)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const shipmentStatusMap = new Map<string, string | null>();
  if (shipmentIds.length > 0) {
    const { data: shipmentRows, error: shipmentError } = await supabase
      .from("cms_shipment_header")
      .select("shipment_id, status")
      .in("shipment_id", shipmentIds);
    if (shipmentError) {
      return jsonError(shipmentError.message ?? "shipment 조회 실패", 500, {
        code: shipmentError.code ?? undefined,
        details: shipmentError.details ?? undefined,
        hint: shipmentError.hint ?? undefined,
      });
    }
    (shipmentRows ?? []).forEach((row) => {
      const id = (row as { shipment_id?: string | null }).shipment_id;
      if (id) {
        shipmentStatusMap.set(id, (row as { status?: string | null }).status ?? null);
      }
    });
  }

  const receiptLineMap = new Map<string, Record<string, unknown>>();
  if (receiptLineUuids.length > 0) {
    const { data: lineRows, error: lineError } = await supabase
      .from("cms_v_receipt_line_items_flat_v1")
      .select(
        "receipt_id, receipt_line_uuid, vendor_seq_no, customer_factory_code, model_name, material_code, size, color, factory_weight_g, qty"
      )
      .eq("receipt_id", receiptId)
      .in("receipt_line_uuid", receiptLineUuids);
    if (lineError) {
      return jsonError(lineError.message ?? "라인 요약 조회 실패", 500, {
        code: lineError.code ?? undefined,
        details: lineError.details ?? undefined,
        hint: lineError.hint ?? undefined,
      });
    }
    (lineRows ?? []).forEach((row) => {
      const id = (row as { receipt_line_uuid?: string | null }).receipt_line_uuid;
      if (id) receiptLineMap.set(id, row as Record<string, unknown>);
    });
  }

  const orderMap = new Map<string, Record<string, unknown>>();
  if (orderLineIds.length > 0) {
    const { data: orderRows, error: orderError } = await supabase
      .from("cms_v_order_worklist")
      .select("order_line_id, customer_party_id, customer_name, order_no")
      .in("order_line_id", orderLineIds);
    if (orderError) {
      return jsonError(orderError.message ?? "주문 요약 조회 실패", 500, {
        code: orderError.code ?? undefined,
        details: orderError.details ?? undefined,
        hint: orderError.hint ?? undefined,
      });
    }
    (orderRows ?? []).forEach((row) => {
      const id = (row as { order_line_id?: string | null }).order_line_id;
      if (id) orderMap.set(id, row as Record<string, unknown>);
    });
  }

  const data = matches.map((row) => {
    const receiptLineUuid = row.receipt_line_uuid as string | null | undefined;
    const orderLineId = row.order_line_id as string | null | undefined;
    const shipmentId = row.shipment_id as string | null | undefined;
    const line = receiptLineUuid ? receiptLineMap.get(receiptLineUuid) : null;
    const order = orderLineId ? orderMap.get(orderLineId) : null;
    const vendorSeq = line?.vendor_seq_no;

    return {
      receipt_id: row.receipt_id ?? null,
      receipt_line_uuid: receiptLineUuid ?? null,
      vendor_seq_no: vendorSeq === null || vendorSeq === undefined ? null : String(vendorSeq),
      customer_factory_code: line?.customer_factory_code ?? null,
      receipt_model_name: line?.model_name ?? null,
      receipt_material_code: line?.material_code ?? null,
      receipt_size: line?.size ?? null,
      receipt_color: line?.color ?? null,
      receipt_weight_g: line?.factory_weight_g ?? null,
      receipt_qty: line?.qty ?? null,
      order_line_id: orderLineId ?? null,
      customer_party_id: order?.customer_party_id ?? null,
      customer_name: order?.customer_name ?? null,
      order_no: order?.order_no ?? null,
      shipment_id: shipmentId ?? null,
      shipment_line_id: row.shipment_line_id ?? null,
      shipment_status: shipmentId ? shipmentStatusMap.get(shipmentId) ?? null : null,
      confirmed_at: row.confirmed_at ?? null,
      selected_weight_g: row.selected_weight_g ?? null,
      selected_material_code: row.selected_material_code ?? null,
      note: row.note ?? null,
    };
  });

  return NextResponse.json({ data });
}
