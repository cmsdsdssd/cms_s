import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
  const maskCode = searchParams.get("mask_code")?.trim();

  if (!maskCode) {
    return NextResponse.json({ error: "mask_code required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_party")
    .select("party_id, name, party_type, mask_code")
    .eq("mask_code", maskCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "고객 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? null });
}
