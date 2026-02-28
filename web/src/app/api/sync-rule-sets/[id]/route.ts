import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const ruleSetId = String(id ?? "").trim();
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  if (Object.keys(patch).length === 0) return jsonError("no updatable fields", 400);
  if (typeof patch.name === "string" && !patch.name) return jsonError("name must not be blank", 400);

  const { data, error } = await sb
    .from("sync_rule_set")
    .update(patch)
    .eq("rule_set_id", ruleSetId)
    .select("rule_set_id, channel_id, name, description, is_active, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "룰셋 수정 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const ruleSetId = String(id ?? "").trim();
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const { error } = await sb
    .from("sync_rule_set")
    .delete()
    .eq("rule_set_id", ruleSetId);
  if (error) return jsonError(error.message ?? "룰셋 삭제 실패", 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
