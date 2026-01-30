import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force dynamic to avoid caching
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

function safeFilename(name: string) {
    // minimal header-safe filename
    return name.replace(/["\r\n]/g, "").slice(0, 180) || "receipt";
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const path = searchParams.get("path");
    const mime = searchParams.get("mime") ?? "";

    if (!bucket || !path) {
        return NextResponse.json({ error: "bucket and path required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    try {
        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error || !data) {
            return NextResponse.json({ error: error?.message ?? "download failed" }, { status: 500 });
        }

        const filename = safeFilename(path.split("/").pop() ?? "receipt");
        const contentType = (mime || (data as any).type || "application/octet-stream").trim();

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Disposition", `inline; filename="${filename}"`);
        headers.set("Cache-Control", "no-store");

        return new NextResponse(data as any, { headers, status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
    }
}
