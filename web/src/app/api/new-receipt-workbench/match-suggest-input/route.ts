import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

type InputCandidate = {
  order_line_id: string | null;
  customer_party_id: string | null;
  customer_mask_code: string | null;
  customer_name: string | null;
  model_name: string | null;
  size: string | null;
  color: string | null;
  material_code: string | null;
  is_plated: boolean | null;
  plating_color_code: string | null;
  stone_center_qty: number | null;
  stone_sub1_qty: number | null;
  stone_sub2_qty: number | null;
  center_stone_source: string | null;
  sub1_stone_source: string | null;
  sub2_stone_source: string | null;
  status: string | null;
  memo: string | null;
};

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { model_name?: string; customer_factory_code?: string; limit?: number }
    | null;

  const modelName = String(body?.model_name ?? "").trim();
  const customerCode = String(body?.customer_factory_code ?? "").trim();
  const limit = Math.min(Math.max(Number(body?.limit ?? 8) || 8, 1), 20);

  const modelPattern = modelName ? `%${modelName}%` : "";
  const customerPattern = customerCode ? `%${customerCode}%` : "";

  if (!modelName && !customerCode) {
    return NextResponse.json({ data: { candidates: [] } });
  }

  let customerPartyIds: string[] = [];
  if (customerCode) {
    const { data: parties, error: partyError } = await supabase
      .from("cms_party")
      .select("party_id")
      .ilike("mask_code", customerPattern)
      .limit(200);

    if (partyError) {
      return NextResponse.json({ error: partyError.message ?? "거래처 조회 실패" }, { status: 500 });
    }
    customerPartyIds = (parties ?? [])
      .map((party) => party.party_id)
      .filter((id): id is string => Boolean(id));
  }

  let query = supabase
    .from("v_cms_order_lookup")
    .select("order_line_id, client_id, client_name, model_no, color, material_code, status, plating_status, plating_color")
    .eq("status", "SENT_TO_VENDOR")
    .order("order_date", { ascending: false })
    .limit(limit);

  if (modelName) {
    query = query.or(`order_no.ilike.${modelPattern},client_name.ilike.${modelPattern},model_no.ilike.${modelPattern}`);
  }
  if (customerPartyIds.length > 0) {
    query = query.in("client_id", customerPartyIds);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  const candidates: InputCandidate[] = (data ?? []).map((row) => ({
    order_line_id: row.order_line_id ?? null,
    customer_party_id: row.client_id ?? null,
    customer_mask_code: null,
    customer_name: row.client_name ?? null,
    model_name: row.model_no ?? null,
    size: null,
    color: row.color ?? null,
    material_code: row.material_code ?? null,
    status: row.status ?? null,
    is_plated: row.plating_status ?? null,
    plating_color_code: row.plating_color ?? null,
    stone_center_qty: null,
    stone_sub1_qty: null,
    stone_sub2_qty: null,
    center_stone_source: null,
    sub1_stone_source: null,
    sub2_stone_source: null,
    memo: null,
  }));

  const orderLineIds = candidates
    .map((candidate) => candidate.order_line_id)
    .filter((id): id is string => Boolean(id));

  if (orderLineIds.length > 0) {
    const { data: orderLines, error: orderLineError } = await supabase
      .from("cms_order_line")
      .select(
        "order_line_id, center_stone_qty, sub1_stone_qty, sub2_stone_qty, center_stone_source, sub1_stone_source, sub2_stone_source, is_plated, plating_color_code"
      )
      .in("order_line_id", orderLineIds);

    if (orderLineError) {
      return NextResponse.json({ error: orderLineError.message ?? "주문 라인 상세 조회 실패" }, { status: 500 });
    }

    const orderLineMap = new Map(
      (orderLines ?? []).map((row) => [
        row.order_line_id,
        {
          stone_center_qty: row.center_stone_qty ?? null,
          stone_sub1_qty: row.sub1_stone_qty ?? null,
          stone_sub2_qty: row.sub2_stone_qty ?? null,
          center_stone_source: row.center_stone_source ?? null,
          sub1_stone_source: row.sub1_stone_source ?? null,
          sub2_stone_source: row.sub2_stone_source ?? null,
          is_plated: row.is_plated ?? null,
          plating_color_code: row.plating_color_code ?? null,
        },
      ])
    );

    candidates.forEach((candidate) => {
      if (!candidate.order_line_id) return;
      const detail = orderLineMap.get(candidate.order_line_id);
      if (!detail) return;
      candidate.stone_center_qty = detail.stone_center_qty;
      candidate.stone_sub1_qty = detail.stone_sub1_qty;
      candidate.stone_sub2_qty = detail.stone_sub2_qty;
      candidate.center_stone_source = detail.center_stone_source;
      candidate.sub1_stone_source = detail.sub1_stone_source;
      candidate.sub2_stone_source = detail.sub2_stone_source;
      candidate.is_plated = detail.is_plated;
      candidate.plating_color_code = detail.plating_color_code;
    });
  }

  return NextResponse.json({ data: { candidates } });
}
