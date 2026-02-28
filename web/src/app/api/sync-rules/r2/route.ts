import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isHundredStep = (value: number): boolean => Number.isInteger(value) && value % 100 === 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const ruleSetId = (searchParams.get("rule_set_id") ?? "").trim();
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const { data, error } = await sb
    .from("sync_rule_r2_size_weight")
    .select("rule_id, rule_set_id, linked_r1_rule_id, match_material_code, match_category_code, weight_min_g, weight_max_g, option_range_expr, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .eq("rule_set_id", ruleSetId)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) return jsonError(error.message ?? "R2 룰 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleSetId = String(body.rule_set_id ?? "").trim();
  const matchMaterialCodeRaw = toNullableText(body.match_material_code);
  const matchMaterialCode = matchMaterialCodeRaw ? normalizeMaterialCode(matchMaterialCodeRaw) : null;
  const matchCategoryCode = toNullableText(body.match_category_code);
  const linkedR1RuleId = typeof body.linked_r1_rule_id === "string" ? body.linked_r1_rule_id.trim() || null : null;
  const weightMin = Number(body.weight_min_g ?? 0);
  const weightMax = Number(body.weight_max_g ?? 999999);
  const optionRangeExpr = "*";
  const marginMin = body.margin_min_krw === null || body.margin_min_krw === undefined || body.margin_min_krw === ""
    ? null
    : Number(body.margin_min_krw);
  const marginMax = body.margin_max_krw === null || body.margin_max_krw === undefined || body.margin_max_krw === ""
    ? null
    : Number(body.margin_max_krw);
  const deltaKrw = Number(body.delta_krw ?? Number.NaN);
  const roundingUnit = Number(body.rounding_unit ?? 100);
  const roundingMode = String(body.rounding_mode ?? "ROUND").trim().toUpperCase();
  const priority = Number(body.priority ?? 100);
  const isActive = body.is_active === false ? false : true;
  const note = toNullableText(body.note);

  if (!ruleSetId) return jsonError("rule_set_id is required", 400);
  if (!Number.isFinite(weightMin) || !Number.isFinite(weightMax) || weightMin > weightMax) return jsonError("weight range is invalid", 400);
  if (marginMin !== null && !Number.isFinite(marginMin)) return jsonError("margin_min_krw must be a number", 400);
  if (marginMax !== null && !Number.isFinite(marginMax)) return jsonError("margin_max_krw must be a number", 400);
  if ((marginMin === null) !== (marginMax === null)) return jsonError("margin_min_krw and margin_max_krw must be both null or both numbers", 400);
  if (marginMin !== null && marginMax !== null && marginMin > marginMax) return jsonError("margin range is invalid", 400);
  if (marginMin !== null && !isHundredStep(Math.round(marginMin))) return jsonError("margin_min_krw must be 100 KRW step", 400);
  if (marginMax !== null && !isHundredStep(Math.round(marginMax))) return jsonError("margin_max_krw must be 100 KRW step", 400);
  if (!Number.isFinite(deltaKrw)) return jsonError("delta_krw must be a number", 400);
  if (!isHundredStep(Math.round(deltaKrw))) return jsonError("delta_krw must be 100 KRW step", 400);
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!isHundredStep(Math.round(roundingUnit))) return jsonError("rounding_unit must be 100 KRW step", 400);
  if (!Number.isFinite(priority)) return jsonError("priority must be a number", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(roundingMode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  if (linkedR1RuleId) {
    const linkedRes = await sb
      .from("sync_rule_r1_material_delta")
      .select("rule_id, rule_set_id, is_active")
      .eq("rule_id", linkedR1RuleId)
      .maybeSingle();
    if (linkedRes.error) return jsonError(linkedRes.error.message ?? "linked_r1_rule_id 검증 실패", 500);
    if (!linkedRes.data) return jsonError("linked_r1_rule_id not found", 400);
    if (!linkedRes.data.is_active) return jsonError("linked_r1_rule_id must be active", 400);
    if (String(linkedRes.data.rule_set_id ?? "") !== ruleSetId) {
      return jsonError("linked_r1_rule_id must belong to same rule_set_id", 400);
    }
  }
  if (matchMaterialCode) {
    const matRes = await sb
      .from("cms_material_factor_config")
      .select("material_code")
      .eq("material_code", matchMaterialCode)
      .limit(1)
      .maybeSingle();
    if (matRes.error) return jsonError(matRes.error.message ?? "소재 조회 실패", 500);
    if (!matRes.data?.material_code) return jsonError("match_material_code must exist in settings material config", 400);
  }
  if (matchCategoryCode) {
    const categoryRes = await sb
      .from("cms_master_item")
      .select("category_code")
      .eq("category_code", matchCategoryCode)
      .limit(1)
      .maybeSingle();
    if (categoryRes.error) return jsonError(categoryRes.error.message ?? "카테고리 조회 실패", 500);
    if (!categoryRes.data?.category_code) {
      return jsonError("match_category_code must exist in master_item category pool", 400);
    }
  }

  const { data, error } = await sb
    .from("sync_rule_r2_size_weight")
    .insert({
      rule_set_id: ruleSetId,
      linked_r1_rule_id: linkedR1RuleId,
      match_material_code: matchMaterialCode,
      match_category_code: matchCategoryCode,
      weight_min_g: weightMin,
      weight_max_g: weightMax,
      option_range_expr: optionRangeExpr,
      margin_min_krw: marginMin,
      margin_max_krw: marginMax,
      delta_krw: deltaKrw,
      rounding_unit: Math.round(roundingUnit),
      rounding_mode: roundingMode,
      priority: Math.round(priority),
      is_active: isActive,
      note,
    })
    .select("rule_id, rule_set_id, linked_r1_rule_id, match_material_code, match_category_code, weight_min_g, weight_max_g, option_range_expr, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "R2 룰 생성 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
