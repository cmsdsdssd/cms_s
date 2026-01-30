import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

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
        return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") ?? "").trim();

    let query = supabase
        .from("cms_part_item")
        .select("part_id, part_name, unit_default, part_kind, family_name, spec_text")
        .eq("is_active", true);

    if (q) {
        query = query.ilike("part_name", `%${q}%`).limit(10);
    } else {
        query = query.limit(50);
    }

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
