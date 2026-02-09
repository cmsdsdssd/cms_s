import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketName() {
  return process.env.SUPABASE_COLLECTION_IMAGE_BUCKET || "collection_image";
}

function normalizeUuid(value: unknown) {
  const text = String(value ?? "").trim();
  return UUID_REGEX.test(text) ? text : "";
}

function normalizeToken(value: unknown) {
  const text = String(value ?? "").trim();
  const normalized = text.replace(/[^0-9A-Za-z_-]/g, "");
  return normalized || "unknown";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const formData = await request.formData();
  const partyId = normalizeUuid(formData.get("party_id"));
  const idempotencyKey = normalizeToken(formData.get("idempotency_key"));
  const file = formData.get("file");

  if (!partyId) {
    return NextResponse.json({ error: "party_id 값이 필요합니다." }, { status: 400 });
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
  const objectPath = `${partyId}/${idempotencyKey}/${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error: uploadError } = await supabase.storage
    .from(getBucketName())
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message ?? "이미지 업로드 실패" }, { status: 500 });
  }

  return NextResponse.json({ path: objectPath });
}
