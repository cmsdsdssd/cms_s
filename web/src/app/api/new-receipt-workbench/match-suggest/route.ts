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

  const payload = data as { candidates?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null;
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.candidates)
      ? payload.candidates
      : [];

  const orderLineIds = candidates
    .map((candidate) => (typeof candidate.order_line_id === "string" ? candidate.order_line_id : null))
    .filter((id): id is string => Boolean(id));

  if (orderLineIds.length === 0) {
    return NextResponse.json({ data });
  }

  const { data: orderLines, error: orderLineError } = await supabase
    .from("cms_order_line")
    .select(
      "order_line_id, center_stone_qty, sub1_stone_qty, sub2_stone_qty, center_stone_source, sub1_stone_source, sub2_stone_source, is_plated, plating_color_code"
    )
    .in("order_line_id", orderLineIds);

  if (orderLineError) {
    return NextResponse.json({ error: orderLineError.message ?? "주문 라인 상세 조회 실패" }, { status: 500 });
  }

  const orderLineMap = new Map((orderLines ?? []).map((row) => [row.order_line_id, row]));
  const enrichedCandidates = candidates.map((candidate) => {
    const orderLineId = typeof candidate.order_line_id === "string" ? candidate.order_line_id : null;
    if (!orderLineId) return candidate;
    const detail = orderLineMap.get(orderLineId);
    if (!detail) return candidate;
    return {
      ...candidate,
      stone_center_qty: candidate.stone_center_qty ?? detail.center_stone_qty ?? null,
      stone_sub1_qty: candidate.stone_sub1_qty ?? detail.sub1_stone_qty ?? null,
      stone_sub2_qty: candidate.stone_sub2_qty ?? detail.sub2_stone_qty ?? null,
      center_stone_source: candidate.center_stone_source ?? detail.center_stone_source ?? null,
      sub1_stone_source: candidate.sub1_stone_source ?? detail.sub1_stone_source ?? null,
      sub2_stone_source: candidate.sub2_stone_source ?? detail.sub2_stone_source ?? null,
      is_plated: candidate.is_plated ?? detail.is_plated ?? null,
      plating_color_code: candidate.plating_color_code ?? detail.plating_color_code ?? null,
    };
  });

  if (Array.isArray(payload)) {
    return NextResponse.json({ data: enrichedCandidates });
  }

  if (payload && typeof payload === "object") {
    return NextResponse.json({ data: { ...payload, candidates: enrichedCandidates } });
  }

  return NextResponse.json({ data });
}
