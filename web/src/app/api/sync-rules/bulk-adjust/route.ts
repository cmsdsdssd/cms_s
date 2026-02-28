import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RuleType = "R2" | "R3";

const toNum = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isHundredStep = (value: number): boolean => Number.isInteger(value) && value % 100 === 0;

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleType = String(body.rule_type ?? "").trim().toUpperCase() as RuleType;
  const ruleSetId = String(body.rule_set_id ?? "").trim();
  const delta = toNum(body.delta_krw);
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);
  if (!delta || delta === 0) return jsonError("delta_krw must be non-zero", 400);
  if (!isHundredStep(Math.round(delta))) return jsonError("delta_krw must be 100 KRW step", 400);
  if (!["R2", "R3"].includes(ruleType)) return jsonError("rule_type must be R2 or R3", 400);

  if (ruleType === "R2") {
    let q = sb
      .from("sync_rule_r2_size_weight")
      .select("rule_id, delta_krw")
      .eq("rule_set_id", ruleSetId)
      .eq("is_active", true);

    const materialCode = typeof body.match_material_code === "string" ? body.match_material_code.trim() : "";
    const categoryCode = typeof body.match_category_code === "string" ? body.match_category_code.trim() : "";
    const minG = toNum(body.weight_min_g);
    const maxG = toNum(body.weight_max_g);
    if (materialCode) q = q.eq("match_material_code", materialCode);
    if (categoryCode) q = q.eq("match_category_code", categoryCode);
    if (minG !== null) q = q.gte("weight_min_g", minG);
    if (maxG !== null) q = q.lte("weight_max_g", maxG);

    const selected = await q;
    if (selected.error) return jsonError(selected.error.message ?? "R2 대상 조회 실패", 400);
    const rows = selected.data ?? [];
    if (rows.length === 0) return NextResponse.json({ updated: 0, data: [] }, { headers: { "Cache-Control": "no-store" } });

    const updates = await Promise.all(rows.map((r) => sb
      .from("sync_rule_r2_size_weight")
      .update({ delta_krw: Math.round(Number(r.delta_krw ?? 0) + delta) })
      .eq("rule_id", r.rule_id)
      .select("rule_id, delta_krw")
      .single()));

    const failed = updates.find((u) => u.error);
    if (failed?.error) return jsonError(failed.error.message ?? "R2 일괄 조정 실패", 400);
    return NextResponse.json({ updated: updates.length, data: updates.map((u) => u.data) }, { headers: { "Cache-Control": "no-store" } });
  }

  let q = sb
    .from("sync_rule_r3_color_margin")
    .select("rule_id, delta_krw")
    .eq("rule_set_id", ruleSetId)
    .eq("is_active", true);

  const colorCode = typeof body.color_code === "string" ? body.color_code.trim().toUpperCase() : "";
  const minMargin = toNum(body.margin_min_krw);
  const maxMargin = toNum(body.margin_max_krw);
  if (colorCode) q = q.eq("color_code", colorCode);
  if (minMargin !== null) q = q.gte("margin_min_krw", minMargin);
  if (maxMargin !== null) q = q.lte("margin_max_krw", maxMargin);

  const selected = await q;
  if (selected.error) return jsonError(selected.error.message ?? "R3 대상 조회 실패", 400);
  const rows = selected.data ?? [];
  if (rows.length === 0) return NextResponse.json({ updated: 0, data: [] }, { headers: { "Cache-Control": "no-store" } });

  const updates = await Promise.all(rows.map((r) => sb
    .from("sync_rule_r3_color_margin")
    .update({ delta_krw: Math.round(Number(r.delta_krw ?? 0) + delta) })
    .eq("rule_id", r.rule_id)
    .select("rule_id, delta_krw")
    .single()));

  const failed = updates.find((u) => u.error);
  if (failed?.error) return jsonError(failed.error.message ?? "R3 일괄 조정 실패", 400);
  return NextResponse.json({ updated: updates.length, data: updates.map((u) => u.data) }, { headers: { "Cache-Control": "no-store" } });
}
