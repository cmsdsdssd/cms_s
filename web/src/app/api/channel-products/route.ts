import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get("channel_id") ?? "").trim();
  const masterItemId = (searchParams.get("master_item_id") ?? "").trim();

  let query = sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, mapping_source, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (channelId) query = query.eq("channel_id", channelId);
  if (masterItemId) query = query.eq("master_item_id", masterItemId);

  const { data, error } = await query;
  if (error) return jsonError(error.message ?? "매핑 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const externalVariantCode = typeof body.external_variant_code === "string" ? body.external_variant_code.trim() : null;
  const mappingSource = String(body.mapping_source ?? "MANUAL").trim().toUpperCase();
  const isActive = body.is_active === false ? false : true;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);

  const payload = {
    channel_id: channelId,
    master_item_id: masterItemId,
    external_product_no: externalProductNo,
    external_variant_code: externalVariantCode,
    mapping_source: ["MANUAL", "CSV", "AUTO"].includes(mappingSource) ? mappingSource : "MANUAL",
    is_active: isActive,
  };

  const { data, error } = await sb
    .from("sales_channel_product")
    .upsert(payload, { onConflict: "channel_id,external_product_no" })
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, mapping_source, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "매핑 저장 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
