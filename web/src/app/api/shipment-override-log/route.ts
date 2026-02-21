import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OverrideLogPayload = {
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  order_line_id?: string | null;
  event_type?: "SAVE" | "FINAL_CONFIRM";
  override_scope?: string;
  reason_code?: "FACTORY_MISTAKE" | "RECEIPT_DIFF" | "POLICY_EXCEPTION" | "CUSTOMER_REQUEST" | "OTHER";
  reason_detail?: string | null;
  actor_person_id?: string | null;
  pricing_mode?: string | null;
  is_manual_total_override?: boolean;
  is_manual_labor?: boolean;
  payload?: Record<string, unknown>;
};

const ALLOWED_EVENT_TYPES = new Set(["SAVE", "FINAL_CONFIRM"]);
const ALLOWED_REASON_CODES = new Set([
  "FACTORY_MISTAKE",
  "RECEIPT_DIFF",
  "POLICY_EXCEPTION",
  "CUSTOMER_REQUEST",
  "OTHER",
]);

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as OverrideLogPayload;
  const eventType = String(body.event_type ?? "").trim().toUpperCase();
  const reasonCode = String(body.reason_code ?? "").trim().toUpperCase();
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "event_type must be SAVE or FINAL_CONFIRM" }, { status: 400 });
  }
  if (!ALLOWED_REASON_CODES.has(reasonCode)) {
    return NextResponse.json({ error: "invalid reason_code" }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const insertPayload = {
    shipment_id: body.shipment_id ?? null,
    shipment_line_id: body.shipment_line_id ?? null,
    order_line_id: body.order_line_id ?? null,
    event_type: eventType,
    override_scope: (body.override_scope ?? "MANUAL_LABOR").trim() || "MANUAL_LABOR",
    reason_code: reasonCode,
    reason_detail: body.reason_detail ?? null,
    actor_person_id: body.actor_person_id ?? null,
    pricing_mode: body.pricing_mode ?? null,
    is_manual_total_override: Boolean(body.is_manual_total_override),
    is_manual_labor: Boolean(body.is_manual_labor),
    payload: body.payload ?? {},
  };

  const { error } = await supabase.from("cms_shipment_override_log").insert(insertPayload);
  if (error) {
    return NextResponse.json(
      { error: error.message, details: error.details, hint: error.hint, code: error.code },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
