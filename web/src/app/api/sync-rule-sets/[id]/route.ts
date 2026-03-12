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

  const currentRes = await sb
    .from("sync_rule_set")
    .select("rule_set_id, channel_id, is_active")
    .eq("rule_set_id", ruleSetId)
    .maybeSingle();
  if (currentRes.error) return jsonError(currentRes.error.message ?? "룰셋 조회 실패", 400);
  if (!currentRes.data?.rule_set_id) return jsonError("rule_set_id not found", 404);
  const current = currentRes.data;

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;

  if (Object.keys(patch).length === 0) return jsonError("no updatable fields", 400);
  if (typeof patch.name === "string" && !patch.name) return jsonError("name must not be blank", 400);

  if (patch.is_active === true) {
    const deactivateRes = await sb
      .from("sync_rule_set")
      .update({ is_active: false })
      .eq("channel_id", current.channel_id)
      .eq("is_active", true)
      .neq("rule_set_id", ruleSetId);
    if (deactivateRes.error) return jsonError(deactivateRes.error.message ?? "기존 활성 룰셋 비활성화 실패", 400);
  }
  if (patch.is_active === false && current.is_active === true) {
    return jsonError("active sync rule set cannot be deactivated directly. Activate another rule set first.", 422, {
      code: "ACTIVE_SYNC_RULE_SET_REQUIRED",
      channel_id: current.channel_id,
      rule_set_id: ruleSetId,
    });
  }

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

  const currentRes = await sb
    .from("sync_rule_set")
    .select("rule_set_id, channel_id, is_active")
    .eq("rule_set_id", ruleSetId)
    .maybeSingle();
  if (currentRes.error) return jsonError(currentRes.error.message ?? "룰셋 조회 실패", 400);
  if (!currentRes.data?.rule_set_id) return jsonError("rule_set_id not found", 404);
  if (currentRes.data.is_active === true) {
    return jsonError("active sync rule set cannot be deleted. Activate another rule set first.", 422, {
      code: "ACTIVE_SYNC_RULE_SET_REQUIRED",
      channel_id: currentRes.data.channel_id,
      rule_set_id: ruleSetId,
    });
  }

  const { error } = await sb
    .from("sync_rule_set")
    .delete()
    .eq("rule_set_id", ruleSetId);
  if (error) return jsonError(error.message ?? "룰셋 삭제 실패", 400);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
