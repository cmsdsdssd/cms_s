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

  const body = (await request.json().catch(() => null)) as { q?: string; limit?: number } | null;
  const query = String(body?.q ?? "").trim();
  const limit = Math.min(Math.max(Number(body?.limit ?? 10) || 10, 1), 50);

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await supabase
    .from("cms_party")
    .select("party_id, name, mask_code")
    .eq("party_type", "customer")
    .ilike("mask_code", `%${query}%`)
    .order("mask_code", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
