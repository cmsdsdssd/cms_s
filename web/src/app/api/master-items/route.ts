import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

function getSupabaseAdmin(): SupabaseClient<unknown> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeImagePath(path: string, bucket: string) {
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
  if (path.startsWith("storage/v1/object/public/")) {
    return path.replace("storage/v1/object/public/", "").split("/").slice(1).join("/");
  }
  return path;
}

async function buildImageUrl(supabase: SupabaseClient<unknown>, path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = process.env.SUPABASE_BUCKET ?? "master_images";
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalized, 60 * 60);
  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  return `${url}/storage/v1/object/public/${bucket}/${normalized}`;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cms_master_item")
    .select("*")
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
  }

  const mapped = await Promise.all(
    (data ?? []).map(async (row: Record<string, unknown>) => ({
      ...row,
      image_url: await buildImageUrl(supabase, row.image_path ? String(row.image_path) : null),
    }))
  );

  return NextResponse.json({ data: mapped });
}
