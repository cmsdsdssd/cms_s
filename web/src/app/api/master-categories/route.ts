import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const res = await sb
    .from("cms_master_item")
    .select("category_code")
    .not("category_code", "is", null)
    .order("category_code", { ascending: true })
    .limit(5000);

  if (res.error) return jsonError(res.error.message ?? "카테고리 조회 실패", 500);

  const categories = Array.from(
    new Set(
      (res.data ?? [])
        .map((row) => String(row.category_code ?? "").trim().toUpperCase())
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ data: categories }, { headers: { "Cache-Control": "no-store" } });
}
