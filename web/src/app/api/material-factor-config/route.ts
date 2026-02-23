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

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server env missing" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cms_material_factor_config")
    .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis");

  if (error) {
    return NextResponse.json({ error: error.message ?? "소재 팩터 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
