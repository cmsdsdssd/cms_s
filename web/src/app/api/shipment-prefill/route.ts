import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
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

async function buildSignedUrl(supabase: ReturnType<typeof createClient>, path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const bucket = process.env.SUPABASE_BUCKET ?? "master_images";
  const normalized = normalizeImagePath(path, bucket);
  const { data } = await supabase.storage.from(bucket).createSignedUrl(normalized, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const orderLineId = String(searchParams.get("order_line_id") ?? "").trim();
  if (!orderLineId) {
    return NextResponse.json({ error: "order_line_id 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema("public")
    .from("v_cms_shipment_prefill")
    .select("*")
    .eq("order_line_id", orderLineId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ data: null });
  }

  let photoUrl = data.photo_url as string | null;
  if (!photoUrl && data.model_no) {
    const { data: master } = await supabase
      .from("cms_master_item")
      .select("image_path")
      .eq("model_name", data.model_no)
      .maybeSingle();
    photoUrl = (master?.image_path as string) ?? null;
  }
  const signedUrl = await buildSignedUrl(supabase, photoUrl);

  return NextResponse.json({ data: { ...data, photo_url: signedUrl } });
}
