import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REASON_CODES = [
  "INPUT_ERROR",
  "WRONG_MATCH",
  "RECEIPT_CORRECTION",
  "ORDER_CANCEL",
  "TEST",
  "OTHER",
] as const;

type ReasonCode = (typeof REASON_CODES)[number];

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

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function isReasonCode(value: string | null | undefined): value is ReasonCode {
  return Boolean(value && REASON_CODES.includes(value as ReasonCode));
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonError("Supabase 환경 변수가 설정되지 않았습니다.", 500);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        receipt_id?: string;
        receipt_line_uuid?: string;
        reason_code?: string;
        reason_text?: string;
        note?: string;
      }
    | null;

  if (!body) {
    return jsonError("request body required", 400, { code: "INVALID_ARGUMENT" });
  }

  const receiptId = body.receipt_id ?? null;
  const receiptLineUuid = body.receipt_line_uuid ?? null;
  const reasonCode = body.reason_code ?? null;

  if (!isUuid(receiptId) || !isUuid(receiptLineUuid)) {
    return jsonError("receipt_id and receipt_line_uuid must be uuid", 400, { code: "INVALID_ARGUMENT" });
  }

  if (!isReasonCode(reasonCode)) {
    return jsonError("reason_code invalid", 400, { code: "INVALID_ARGUMENT" });
  }

  const reasonText = body.reason_text?.trim();
  const note = body.note?.trim() ?? null;
  const reason = reasonText ? `${reasonCode} - ${reasonText}` : reasonCode;

  const { data, error } = await supabase.rpc("cms_fn_receipt_line_match_clear_v1", {
    p_receipt_id: receiptId,
    p_receipt_line_uuid: receiptLineUuid,
    p_reason: reason,
    p_actor_person_id: null,
    p_note: note,
    p_correlation_id: crypto.randomUUID(),
  });

  if (error) {
    return jsonError(error.message ?? "매칭취소 실패", 409, {
      code: error.code ?? undefined,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
    });
  }

  return NextResponse.json({ data });
}
