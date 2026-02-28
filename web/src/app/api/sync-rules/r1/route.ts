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

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isHundredStep = (value: number): boolean => Number.isInteger(value) && value % 100 === 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const ruleSetId = (searchParams.get("rule_set_id") ?? "").trim();
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const { data, error } = await sb
    .from("sync_rule_r1_material_delta")
    .select("rule_id, rule_set_id, source_material_code, target_material_code, match_category_code, weight_min_g, weight_max_g, option_weight_multiplier, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .eq("rule_set_id", ruleSetId)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) return jsonError(error.message ?? "R1 룰 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleSetId = String(body.rule_set_id ?? "").trim();
  const sourceMaterialCodeRaw = toNullableText(body.source_material_code);
  const targetMaterialCodeRaw = String(body.target_material_code ?? "").trim();
  const sourceMaterialCode = sourceMaterialCodeRaw ? normalizeMaterialCode(sourceMaterialCodeRaw) : null;
  const targetMaterialCode = normalizeMaterialCode(targetMaterialCodeRaw);
  const matchCategoryCode = toNullableText(body.match_category_code);
  const weightMin = toNullableNumber(body.weight_min_g);
  const weightMax = toNullableNumber(body.weight_max_g);
  const optionWeightMultiplier = Number(body.option_weight_multiplier ?? 1);
  const roundingUnit = Number(body.rounding_unit ?? 100);
  const roundingMode = String(body.rounding_mode ?? "ROUND").trim().toUpperCase();
  const priority = Number(body.priority ?? 100);
  const isActive = body.is_active === false ? false : true;
  const note = toNullableText(body.note);

  if (!ruleSetId) return jsonError("rule_set_id is required", 400);
  if (!targetMaterialCode) return jsonError("target_material_code is required", 400);
  if (!Number.isFinite(optionWeightMultiplier) || optionWeightMultiplier <= 0) return jsonError("option_weight_multiplier must be > 0", 400);
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!isHundredStep(Math.round(roundingUnit))) return jsonError("rounding_unit must be 100 KRW step", 400);
  if (!Number.isFinite(priority)) return jsonError("priority must be a number", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(roundingMode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);
  if ((weightMin === null) !== (weightMax === null)) return jsonError("weight_min_g and weight_max_g must both be null or both be numbers", 400);
  if (weightMin !== null && weightMax !== null && weightMin > weightMax) return jsonError("weight range is invalid", 400);

  const materialConfigRes = await sb
    .from("cms_material_factor_config")
    .select("material_code");
  if (materialConfigRes.error) {
    return jsonError(materialConfigRes.error.message ?? "소재 설정 조회 실패", 500);
  }
  const allowedCodes = new Set(
    (materialConfigRes.data ?? [])
      .map((row) => normalizeMaterialCode(String(row.material_code ?? "")))
      .filter((code) => code.length > 0),
  );
  if (!allowedCodes.has(targetMaterialCode)) {
    return jsonError("target_material_code must exist in settings material config", 400);
  }
  if (sourceMaterialCode && !allowedCodes.has(sourceMaterialCode)) {
    return jsonError("source_material_code must exist in settings material config", 400);
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

  const payload = {
    rule_set_id: ruleSetId,
    source_material_code: sourceMaterialCode,
    target_material_code: targetMaterialCode,
    match_category_code: matchCategoryCode,
    weight_min_g: weightMin,
    weight_max_g: weightMax,
    option_weight_multiplier: optionWeightMultiplier,
    rounding_unit: Math.round(roundingUnit),
    rounding_mode: roundingMode,
    priority: Math.round(priority),
    is_active: isActive,
    note,
  };

  const { data, error } = await sb
    .from("sync_rule_r1_material_delta")
    .insert(payload)
    .select("rule_id, rule_set_id, source_material_code, target_material_code, match_category_code, weight_min_g, weight_max_g, option_weight_multiplier, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .single();

  if (error) return jsonError(error.message ?? "R1 룰 생성 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
