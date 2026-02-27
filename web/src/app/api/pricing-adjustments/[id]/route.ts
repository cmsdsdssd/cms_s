import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const adjustmentId = String(id ?? "").trim();
  if (!adjustmentId) return jsonError("adjustment id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (body.apply_to !== undefined) patch.apply_to = String(body.apply_to).toUpperCase();
  if (body.stage !== undefined) patch.stage = String(body.stage).toUpperCase();
  if (body.amount_type !== undefined) patch.amount_type = String(body.amount_type).toUpperCase();
  if (body.amount_value !== undefined) patch.amount_value = Number(body.amount_value);
  if (body.priority !== undefined) patch.priority = Number(body.priority);
  if (body.reason !== undefined) patch.reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from || null;
  if (body.valid_to !== undefined) patch.valid_to = body.valid_to || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  const { data, error } = await sb
    .from("pricing_adjustment")
    .update(patch)
    .eq("adjustment_id", adjustmentId)
    .select("adjustment_id, channel_id, channel_product_id, master_item_id, apply_to, stage, amount_type, amount_value, priority, reason, valid_from, valid_to, is_active, created_by, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "adjustment 수정 실패", 400);

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const adjustmentId = String(id ?? "").trim();
  if (!adjustmentId) return jsonError("adjustment id is required", 400);

  const { error } = await sb
    .from("pricing_adjustment")
    .delete()
    .eq("adjustment_id", adjustmentId);
  if (error) return jsonError(error.message ?? "adjustment 삭제 실패", 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
