import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { validateActiveMappingInvariants } from "@/lib/shop/mapping-integrity";
import { toChannelProductIdentityPatch } from "@/lib/shop/channel-product-identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelProductId = String(id ?? "").trim();
  if (!channelProductId) return jsonError("channel product id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch = toChannelProductIdentityPatch(body);
  if (Object.keys(patch).length === 0) return jsonError("update fields are required", 400);
  if (patch.is_active === false) return jsonError("활성 매핑만 허용됩니다 (is_active must be true)", 422);

  const currentRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code")
    .eq("channel_product_id", channelProductId)
    .maybeSingle();
  if (currentRes.error) return jsonError(currentRes.error.message ?? "기존 옵션 조회 실패", 500);
  const current = currentRes.data;
  if (!current) return jsonError("channel product not found", 404);

  const nextChannelId = String(body.channel_id ?? current.channel_id ?? "").trim() || String(current.channel_id ?? "").trim();
  const nextMasterItemId = String(patch.master_item_id ?? current.master_item_id ?? "").trim() || String(current.master_item_id ?? "").trim();
  const nextExternalProductNo = String(patch.external_product_no ?? current.external_product_no ?? "").trim() || String(current.external_product_no ?? "").trim();
  const nextExternalVariantCode = String(patch.external_variant_code ?? current.external_variant_code ?? "").trim() || String(current.external_variant_code ?? "").trim();

  const invariantCheck = await validateActiveMappingInvariants({
    sb,
    rows: [{
      channel_product_id: channelProductId,
      channel_id: nextChannelId,
      master_item_id: nextMasterItemId,
      external_product_no: nextExternalProductNo,
      external_variant_code: nextExternalVariantCode,
      is_active: true,
    }],
    excludeChannelProductIds: [channelProductId],
  });
  if (!invariantCheck.ok) {
    return jsonError(invariantCheck.message, 422, {
      code: invariantCheck.code,
      ...(invariantCheck.detail ?? {}),
    });
  }

  const { data, error } = await sb
    .from("sales_channel_product")
    .update(patch)
    .eq("channel_product_id", channelProductId)
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, mapping_source, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "매핑 수정 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const channelProductId = String(id ?? "").trim();
  if (!channelProductId) return jsonError("channel product id is required", 400);

  const { error } = await sb
    .from("sales_channel_product")
    .delete()
    .eq("channel_product_id", channelProductId);

  if (error) return jsonError(error.message ?? "매핑 삭제 실패", 400);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
