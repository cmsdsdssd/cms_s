import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketName() {
  return process.env.SUPABASE_REPAIRS_IMAGE_BUCKET || "repairs_images";
}

function normalizeRepairLineId(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(text)) return "";
  return text;
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const repairLineId = normalizeRepairLineId(searchParams.get("repair_line_id"));
  if (!repairLineId) {
    return NextResponse.json({ error: "repair_line_id 값이 필요합니다." }, { status: 400 });
  }

  const bucket = getBucketName();
  const { data: list, error: listError } = await supabase.storage
    .from(bucket)
    .list(repairLineId, { limit: 100, sortBy: { column: "name", order: "desc" } });

  if (listError) {
    return NextResponse.json({ error: listError.message ?? "이미지 목록 조회 실패" }, { status: 500 });
  }

  const paths = (list ?? [])
    .map((item) => item.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => `${repairLineId}/${name}`);

  if (paths.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const { data: signedRows, error: signError } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  if (signError) {
    return NextResponse.json({ error: signError.message ?? "이미지 URL 생성 실패" }, { status: 500 });
  }

  const data = (signedRows ?? [])
    .filter((row) => Boolean(row.path && row.signedUrl))
    .map((row) => ({ path: row.path as string, signedUrl: row.signedUrl }));

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await request.formData();
  const repairLineId = normalizeRepairLineId(formData.get("repair_line_id"));
  const file = formData.get("file");

  if (!repairLineId) {
    return NextResponse.json({ error: "repair_line_id 값이 필요합니다." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "이미지 용량은 10MB 이하만 가능합니다." }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const objectPath = `${repairLineId}/${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error: uploadError } = await supabase.storage
    .from(getBucketName())
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message ?? "이미지 업로드 실패" }, { status: 500 });
  }

  return NextResponse.json({ path: objectPath });
}
