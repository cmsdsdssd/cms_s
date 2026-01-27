import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketName() {
  return process.env.SUPABASE_BUCKET ?? "master_images";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "이미지 용량은 10MB 이하만 가능합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "");
  const fileName = `${crypto.randomUUID()}.${safeExt || "jpg"}`;
  const filePath = `master/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const bucket = getBucketName();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, arrayBuffer, { contentType: file.type, upsert: true });

  if (error) {
    return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 500 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return NextResponse.json({ publicUrl: data.publicUrl, path: filePath });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as { path?: string };
  const path = body?.path ?? "";
  if (!path || !path.startsWith("master/")) {
    return NextResponse.json({ error: "삭제 경로가 올바르지 않습니다." }, { status: 400 });
  }

  const bucket = getBucketName();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    return NextResponse.json({ error: "이미지 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
