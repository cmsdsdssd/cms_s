import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/shop/admin";

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
  const versionSuffix = `v=${Date.now()}`;
  const appendVersion = (urlValue: string) => {
    if (!urlValue) return urlValue;
    return `${urlValue}${urlValue.includes("?") ? "&" : "?"}${versionSuffix}`;
  };

  if (path.startsWith("http://") || path.startsWith("https://")) return appendVersion(path);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const bucket = process.env.SUPABASE_BUCKET ?? "master_images";
  if (!url) return null;
  const normalized = normalizeImagePath(path, bucket);

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
  const base = data?.publicUrl ?? `${url}/storage/v1/object/public/${bucket}/${normalized}`;
  return appendVersion(base);
}

function normalizeMasterRow(supabase: SupabaseClient<unknown>, row: Record<string, unknown>) {
  const resolvedMasterItemId = String(row.master_item_id ?? row.master_id ?? "").trim() || null;
  const resolvedMasterId = String(row.master_id ?? row.master_item_id ?? "").trim() || null;

  return {
    ...row,
    master_item_id: resolvedMasterItemId,
    master_id: resolvedMasterId,
    image_url: buildImageUrl(supabase, row.image_path ? String(row.image_path) : null),
  };
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
  const masterIdsRaw = String(searchParams.get("master_ids") ?? "").trim();
  const isUuidQuery = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(model);

  if (masterIdsRaw) {
    const masterIds = Array.from(
      new Set(
        masterIdsRaw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      )
    ).slice(0, 300);

    if (masterIds.length === 0) {
      return NextResponse.json({ data: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const runByMasterIds = (column: "master_item_id" | "master_id") => supabase
      .from("cms_master_item")
      .select("*")
      .in(column, masterIds)
      .limit(masterIds.length);

    let { data, error } = await runByMasterIds("master_item_id");
    if (error && isMissingColumnError(error, "cms_master_item.master_item_id")) {
      ({ data, error } = await runByMasterIds("master_id"));
    }

    if (error) {
      return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
    }

    const mapped = (data ?? []).map((row: Record<string, unknown>) => normalizeMasterRow(supabase, row));

    return NextResponse.json({ data: mapped }, { headers: { "Cache-Control": "no-store" } });
  }

  if (model) {
    const runByExactId = (column: "master_item_id" | "master_id") => supabase
      .from("cms_master_item")
      .select("*")
      .eq(column, model)
      .limit(20);

    let data;
    let error;
    if (isUuidQuery) {
      ({ data, error } = await runByExactId("master_item_id"));
      if (error && isMissingColumnError(error, "cms_master_item.master_item_id")) {
        ({ data, error } = await runByExactId("master_id"));
      }
    } else {
      ({ data, error } = await supabase
        .from("cms_master_item")
        .select("*")
        .ilike("model_name", `%${model}%`)
        .limit(120));
    }

    if (error) {
      return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
    }
    return NextResponse.json(
      { data: (data ?? []).map((row: Record<string, unknown>) => normalizeMasterRow(supabase, row)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await supabase
    .from("cms_master_item")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    return NextResponse.json({ error: error.message ?? "데이터 조회 실패" }, { status: 500 });
  }

  const mapped = (data ?? []).map((row: Record<string, unknown>) => normalizeMasterRow(supabase, row));

  return NextResponse.json({ data: mapped }, { headers: { "Cache-Control": "no-store" } });
}
