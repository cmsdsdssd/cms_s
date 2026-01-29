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
    // Requirements: default to 'ocr_docs', override with environment variable if present
    return process.env.SUPABASE_RECEIPT_BUCKET || "ocr_docs";
}

function sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        // Requirements: file0 priority, fallback to file
        const file = (formData.get("file0") as File) || (formData.get("file") as File);

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "file0 or file is required." }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
        }
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: "파일 용량이 너무 큽니다(20MB 이하)." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        const hash = sha256(buf);

        const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const safeExt = ext || (file.type === "application/pdf" ? "pdf" : "jpg");

        const bucket = getBucketName();
        // Requirements: receipt_inbox/YYYY/MM/DD/<uuid>.<ext>
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const filePath = `receipt_inbox/${yyyy}/${mm}/${dd}/${crypto.randomUUID()}.${safeExt}`;

        // 1. Upload to Storage
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, buf, {
            contentType: file.type,
            upsert: true,
        });
        if (upErr) {
            return NextResponse.json({ error: upErr.message ?? "upload failed" }, { status: 500 });
        }

        // 2. DB Register using RPC
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
            file_bucket: bucket,
            file_path: filePath,
            sha256: hash,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? "unknown error" }, { status: 500 });
    }
}
