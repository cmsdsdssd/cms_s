import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json(
            { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
            { status: 500 }
        );
    }

    const payload = await request.json();

    const { data, error } = await supabase.rpc("cms_fn_upsert_order_line_v3", payload);

    if (error) {
        return NextResponse.json(
            {
                error: error.message,
                details: (error as any).details,
                hint: (error as any).hint,
                code: (error as any).code,
            },
            { status: 400 }
        );
    }

    return NextResponse.json({ data });
}
