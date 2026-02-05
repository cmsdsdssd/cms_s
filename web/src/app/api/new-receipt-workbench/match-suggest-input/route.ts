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
    .select("order_line_id, client_id, client_name, model_no, color, status, plating_status, plating_color")
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
    material_code: null,
    status: row.status ?? null,
    is_plated: row.plating_status ?? null,
    plating_color_code: row.plating_color ?? null,
    memo: null,
  }));

  return NextResponse.json({ data: { candidates } });
}
