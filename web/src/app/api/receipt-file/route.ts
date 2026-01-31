import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force dynamic to avoid caching signed URLs
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const path = searchParams.get("path");

    if (!bucket || !path) {
        return NextResponse.json({ error: "bucket and path required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    try {
        // Create signed URL valid for 1 hour (3600 seconds)
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ signedUrl: data.signedUrl });
    } catch (error) {
        const err = error as { message?: string } | null;
        return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
    }
}
