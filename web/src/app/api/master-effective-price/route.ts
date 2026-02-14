import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const masterId = String(searchParams.get("master_id") ?? "").trim();
  const variantKeyRaw = searchParams.get("variant_key");
  const qtyRaw = searchParams.get("qty");

  if (!masterId) {
    return NextResponse.json({ error: "master_id 값이 필요합니다." }, { status: 400 });
  }

  const qty = qtyRaw === null || qtyRaw === "" ? 1 : Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "qty는 0보다 큰 숫자여야 합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cms_fn_get_master_effective_price_v1", {
    p_master_id: masterId,
    p_variant_key: variantKeyRaw && variantKeyRaw.trim() ? variantKeyRaw.trim() : null,
    p_qty: qty,
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "유효가격 조회 실패" }, { status: 400 });
  }

  return NextResponse.json(data ?? null, { headers: { "Cache-Control": "no-store" } });
}
