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
  const productMasterId = String(searchParams.get("product_master_id") ?? "").trim();
  const variantKeyRaw = searchParams.get("variant_key");

  if (!productMasterId) {
    return NextResponse.json({ error: "product_master_id 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cms_fn_bom_flatten_active_v1", {
    p_product_master_id: productMasterId,
    p_variant_key: variantKeyRaw && variantKeyRaw.trim() ? variantKeyRaw.trim() : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "BOM 펼침 조회 실패" }, { status: 400 });
  }

  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}
