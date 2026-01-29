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
    return process.env.SUPABASE_RECEIPT_BUCKET ?? "receipt_inbox";
}

function sha256(buf: Buffer) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "file이 필요합니다." }, { status: 400 });
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
    const filePath = `inbox/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${safeExt}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, buf, {
        contentType: file.type,
        upsert: true,
    });
    if (upErr) {
        return NextResponse.json({ error: upErr.message ?? "upload failed" }, { status: 500 });
    }

    // DB register via RPC (권장)
    const { data, error: rpcErr } = await supabase.rpc("cms_fn_upsert_receipt_inbox_v1", {
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
        receipt_id: data,
        bucket,
        path: filePath,
        sha256: hash,
    });
}
