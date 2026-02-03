import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { receipt_id?: string; receipt_line_uuid?: string; limit?: number }
    | null;

  const receiptId = body?.receipt_id ?? null;
  const receiptLineUuid = body?.receipt_line_uuid ?? null;
  const limit = Math.min(Math.max(Number(body?.limit ?? 8) || 8, 1), 20);

  if (!receiptId || !receiptLineUuid) {
    return NextResponse.json({ error: "receipt_id and receipt_line_uuid required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cms_fn_receipt_line_match_suggest_v1", {
    p_receipt_id: receiptId,
    p_receipt_line_uuid: receiptLineUuid,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "매칭 제안 실패", code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
