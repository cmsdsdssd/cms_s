import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const overrideId = String(id ?? "").trim();
  if (!overrideId) return jsonError("override id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (body.override_price_krw !== undefined) patch.override_price_krw = Number(body.override_price_krw);
  if (body.reason !== undefined) patch.reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from || null;
  if (body.valid_to !== undefined) patch.valid_to = body.valid_to || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  if (patch.valid_from && patch.valid_to) {
    if (Date.parse(String(patch.valid_to)) < Date.parse(String(patch.valid_from))) {
      return jsonError("valid_to must be >= valid_from", 400);
    }
  }

  const { data, error } = await sb
    .from("pricing_override")
    .update(patch)
    .eq("override_id", overrideId)
    .select("override_id, channel_id, master_item_id, override_price_krw, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "override 수정 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const overrideId = String(id ?? "").trim();
  if (!overrideId) return jsonError("override id is required", 400);

  const { error } = await sb
    .from("pricing_override")
    .delete()
    .eq("override_id", overrideId);
  if (error) return jsonError(error.message ?? "override 삭제 실패", 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
