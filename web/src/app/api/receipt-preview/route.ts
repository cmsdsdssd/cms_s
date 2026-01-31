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

function guessContentType(mimeHint: string, filename: string, blobType: string) {
    const hint = (mimeHint || "").trim().toLowerCase();
    if (hint) return hint;

    const bt = (blobType || "").trim().toLowerCase();
    if (bt) return bt;

    const lower = (filename || "").toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";

    return "application/octet-stream";
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const receiptId = searchParams.get("receipt_id");
    let bucket = searchParams.get("bucket");
    let path = searchParams.get("path");
    let mime = searchParams.get("mime") ?? "";

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    // ✅ Preferred: receipt_id (resolve bucket/path from cms_receipt_inbox)
    if (receiptId && (!bucket || !path)) {
        const { data, error } = await supabase
            .from("cms_receipt_inbox")
            .select("file_bucket, file_path, mime_type")
            .eq("receipt_id", receiptId)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message ?? "receipt lookup failed" }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: "receipt not found" }, { status: 404 });
        }

        bucket = data.file_bucket;
        path = data.file_path;
        mime = mime || (data.mime_type ?? "");
    }

    if (!bucket || !path) {
        return NextResponse.json({ error: "receipt_id or (bucket and path) required" }, { status: 400 });
    }

    try {
        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error || !data) {
            const msg = error?.message ?? "download failed";
            const status = msg.toLowerCase().includes("not found") ? 404 : 500;
            return NextResponse.json({ error: msg }, { status });
        }

        const filename = safeFilename(path.split("/").pop() ?? "receipt");
        const blob = data as Blob;
        const contentType = guessContentType(mime, filename, blob.type);

        // NextResponse + Blob 직접 반환 시, 브라우저에서 이미지/PDF가 깨지는 케이스가 있어
        // Uint8Array로 변환해서 반환합니다.
        const ab = await blob.arrayBuffer();
        const body = new Uint8Array(ab);

        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Disposition", `inline; filename="${filename}"`);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");

        return new NextResponse(body, { headers, status: 200 });
    } catch (error) {
        const err = error as { message?: string } | null;
        return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
    }
}
