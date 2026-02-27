import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { id } = await params;
  const factorSetId = String(id ?? "").trim();
  if (!factorSetId) return jsonError("factor set id is required", 400);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (body.is_active !== undefined) patch.is_active = body.is_active === true;
  if (body.is_global_default !== undefined) patch.is_global_default = body.is_global_default === true;

  if (patch.is_global_default === true) {
    const currentRes = await sb
      .from("material_factor_set")
      .select("scope")
      .eq("factor_set_id", factorSetId)
      .maybeSingle();
    if (currentRes.error) return jsonError(currentRes.error.message ?? "factor set 조회 실패", 400);
    if (!currentRes.data || currentRes.data.scope !== "GLOBAL") {
      return jsonError("is_global_default=true 는 GLOBAL scope에서만 허용됩니다", 400);
    }
    const clearRes = await sb
      .from("material_factor_set")
      .update({ is_global_default: false })
      .eq("scope", "GLOBAL")
      .eq("is_global_default", true)
      .neq("factor_set_id", factorSetId);
    if (clearRes.error) return jsonError(clearRes.error.message ?? "기본 factor set 정리 실패", 400);
  }

  const { data, error } = await sb
    .from("material_factor_set")
    .update(patch)
    .eq("factor_set_id", factorSetId)
    .select("factor_set_id, scope, channel_id, name, description, is_active, is_global_default, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "factor set 수정 실패", 400);

  if (Array.isArray(body.factors)) {
    const factors = body.factors
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const materialCode = String((row as Record<string, unknown>).material_code ?? "").trim();
        const multiplier = Number((row as Record<string, unknown>).multiplier ?? 1);
        if (!materialCode || !Number.isFinite(multiplier) || multiplier <= 0) return null;
        return {
          factor_set_id: factorSetId,
          material_code: materialCode,
          multiplier,
          note: typeof (row as Record<string, unknown>).note === "string" ? String((row as Record<string, unknown>).note).trim() : null,
        };
      })
      .filter((v): v is { factor_set_id: string; material_code: string; multiplier: number; note: string | null } => Boolean(v));

    if (factors.length > 0) {
      const upsertRes = await sb
        .from("material_factor")
        .upsert(factors, { onConflict: "factor_set_id,material_code" });
      if (upsertRes.error) return jsonError(upsertRes.error.message ?? "factor rows 저장 실패", 400);
    }
  }

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
