import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

function getBucketName() {
    // Requirements: default to 'receipt_inbox', override with environment variable if present
    return process.env.SUPABASE_RECEIPT_BUCKET || "receipt_inbox";
}

function sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    try {
        const form = await request.formData();
        const file = (form.get("file0") ?? form.get("file")) as File | null;

        if (!file) {
            return NextResponse.json({ error: "file missing" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
        }
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: "file too large" }, { status: 400 });
        }

        const bucket = getBucketName();
        const arrayBuf = await file.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const hash = sha256(buf);

        const ext =
            file.type === "application/pdf"
                ? "pdf"
                : file.type === "image/jpeg"
                    ? "jpg"
                    : file.type === "image/png"
                        ? "png"
                        : "webp";

        const filePath = `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}/${hash}.${ext}`;

        const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(filePath, buf, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadErr) {
            if (String(uploadErr.message || "").includes("already exists")) {
                // ok - already uploaded
            } else {
                return NextResponse.json({ error: uploadErr.message ?? "upload failed" }, { status: 500 });
            }
        }

        // record in DB via RPC
        const { data: receipt_id, error: rpcErr } = await supabase.rpc("cms_fn_upsert_receipt_inbox_v1", {
            p_file_bucket: bucket,
            p_file_path: filePath,
            p_file_sha256: hash,
            p_file_size_bytes: file.size,
            p_mime_type: file.type,
            p_source: "SCANNER",
            p_vendor_party_id: null,
            p_issued_at: null,
            p_total_amount_krw: null,
            p_status: "UPLOADED",
            p_memo: null,
            p_meta: {},
        });

        if (rpcErr) {
            return NextResponse.json({ error: rpcErr.message ?? "rpc failed" }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            receipt_id,
            bucket,
            path: filePath,
            sha256: hash,
        });
    } catch (error) {
        const err = error as { message?: string } | null;
        return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
    }
}
