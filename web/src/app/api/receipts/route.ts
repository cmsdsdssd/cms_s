import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "UPLOADED" | "LINKED" | "ARCHIVED" | "UPLOADED,LINKED"
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const vendor_party_id = searchParams.get("vendor_party_id");

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    try {
        let query = supabase
            .from("cms_receipt_inbox")
            .select("*")
            .order("received_at", { ascending: false })
            .limit(limit);

        if (status) {
            const statuses = status
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            if (statuses.length === 1) {
                query = query.eq("status", statuses[0]);
            } else {
                query = query.in("status", statuses);
            }
        }
        if (vendor_party_id) {
            query = query.eq("vendor_party_id", vendor_party_id);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
