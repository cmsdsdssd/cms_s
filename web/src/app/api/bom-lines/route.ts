import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin(): SupabaseClient<unknown> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase server env missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
        hint: "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in server env (.env.local on dev).",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const bomId = String(searchParams.get("bom_id") ?? "").trim();
  if (!bomId) {
    return NextResponse.json({ error: "bom_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(CONTRACTS.views.bomRecipeLinesEnriched)
    .select("*")
    .eq("bom_id", bomId)
    .eq("is_void", false)
    .order("line_no", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message ?? "BOM 라인 조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
