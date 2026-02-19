import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function buildImageUrl(supabase: SupabaseClient<unknown>, path: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = process.env.SUPABASE_BUCKET ?? "master_images";
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
  return data?.publicUrl ?? `${url}/storage/v1/object/public/${bucket}/${normalized}`;
}


export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase server env missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
        hint: "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in server env (.env.local on dev).",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const model = String(searchParams.get("model") ?? "").trim();
  const isUuidQuery = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(model);

  if (model) {
    const baseQuery = supabase
      .from("cms_master_item")
      .select("master_id,model_name,category_code,material_code_default");

    const { data, error } = isUuidQuery
      ? await baseQuery.eq("master_id", model).limit(20)
      : await baseQuery.ilike("model_name", `%${model}%`).limit(120);

    if (error) {
      return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await supabase.from("cms_master_item").select("*").limit(100);
  if (error) {
    return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
  }

  const mapped = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    image_url: buildImageUrl(supabase, row.image_path ? String(row.image_path) : null),
  }));

  return NextResponse.json({ data: mapped }, { headers: { "Cache-Control": "no-store" } });
}
