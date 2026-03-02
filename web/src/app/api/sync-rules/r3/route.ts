import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { normalizePlatingComboCode } from "@/lib/shop/sync-rules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isHundredStep = (value: number): boolean => Number.isInteger(value) && value % 100 === 0;

const parseRuleId = (value: unknown): string => String(value ?? "").trim();

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const ruleSetId = (searchParams.get("rule_set_id") ?? "").trim();
  if (!ruleSetId) return jsonError("rule_set_id is required", 400);

  const { data, error } = await sb
    .from("sync_rule_r3_color_margin")
    .select("rule_id, rule_set_id, color_code, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .eq("rule_set_id", ruleSetId)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) return jsonError(error.message ?? "R3 룰 조회 실패", 500);
  return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleSetId = String(body.rule_set_id ?? "").trim();
  const colorCode = normalizePlatingComboCode(String(body.color_code ?? ""));
  const marginMin = Number(body.margin_min_krw ?? Number.NaN);
  const marginMax = Number(body.margin_max_krw ?? Number.NaN);
  const deltaKrw = Number(body.delta_krw ?? Number.NaN);
  const roundingUnit = Number(body.rounding_unit ?? 100);
  const roundingMode = String(body.rounding_mode ?? "ROUND").trim().toUpperCase();
  const priority = Number(body.priority ?? 100);
  const isActive = body.is_active === false ? false : true;
  const note = toNullableText(body.note);

  if (!ruleSetId) return jsonError("rule_set_id is required", 400);
  if (!colorCode) return jsonError("color_code is required", 400);
  if (!Number.isFinite(marginMin) || !Number.isFinite(marginMax) || marginMin > marginMax) return jsonError("margin range is invalid", 400);
  if (!isHundredStep(Math.round(marginMin))) return jsonError("margin_min_krw must be 100 KRW step", 400);
  if (!isHundredStep(Math.round(marginMax))) return jsonError("margin_max_krw must be 100 KRW step", 400);
  if (!Number.isFinite(deltaKrw)) return jsonError("delta_krw must be a number", 400);
  if (!isHundredStep(Math.round(deltaKrw))) return jsonError("delta_krw must be 100 KRW step", 400);
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!isHundredStep(Math.round(roundingUnit))) return jsonError("rounding_unit must be 100 KRW step", 400);
  if (!Number.isFinite(priority)) return jsonError("priority must be a number", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(roundingMode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  const { data, error } = await sb
    .from("sync_rule_r3_color_margin")
    .insert({
      rule_set_id: ruleSetId,
      color_code: colorCode,
      margin_min_krw: marginMin,
      margin_max_krw: marginMax,
      delta_krw: deltaKrw,
      rounding_unit: Math.round(roundingUnit),
      rounding_mode: roundingMode,
      priority: Math.round(priority),
      is_active: isActive,
      note,
    })
    .select("rule_id, rule_set_id, color_code, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .single();
  if (error) return jsonError(error.message ?? "R3 룰 생성 실패", 400);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleId = parseRuleId(body.rule_id);
  const colorCode = normalizePlatingComboCode(String(body.color_code ?? ""));
  const marginMin = Number(body.margin_min_krw ?? Number.NaN);
  const marginMax = Number(body.margin_max_krw ?? Number.NaN);
  const deltaKrw = Number(body.delta_krw ?? Number.NaN);
  const roundingUnit = Number(body.rounding_unit ?? 100);
  const roundingMode = String(body.rounding_mode ?? "ROUND").trim().toUpperCase();
  const priority = Number(body.priority ?? 100);
  const isActive = body.is_active === false ? false : true;
  const note = toNullableText(body.note);

  if (!ruleId) return jsonError("rule_id is required", 400);
  if (!colorCode) return jsonError("color_code is required", 400);
  if (!Number.isFinite(marginMin) || !Number.isFinite(marginMax) || marginMin > marginMax) return jsonError("margin range is invalid", 400);
  if (!isHundredStep(Math.round(marginMin))) return jsonError("margin_min_krw must be 100 KRW step", 400);
  if (!isHundredStep(Math.round(marginMax))) return jsonError("margin_max_krw must be 100 KRW step", 400);
  if (!Number.isFinite(deltaKrw)) return jsonError("delta_krw must be a number", 400);
  if (!isHundredStep(Math.round(deltaKrw))) return jsonError("delta_krw must be 100 KRW step", 400);
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) return jsonError("rounding_unit must be > 0", 400);
  if (!isHundredStep(Math.round(roundingUnit))) return jsonError("rounding_unit must be 100 KRW step", 400);
  if (!Number.isFinite(priority)) return jsonError("priority must be a number", 400);
  if (!["CEIL", "ROUND", "FLOOR"].includes(roundingMode)) return jsonError("rounding_mode must be CEIL/ROUND/FLOOR", 400);

  const { data, error } = await sb
    .from("sync_rule_r3_color_margin")
    .update({
      color_code: colorCode,
      margin_min_krw: marginMin,
      margin_max_krw: marginMax,
      delta_krw: deltaKrw,
      rounding_unit: Math.round(roundingUnit),
      rounding_mode: roundingMode,
      priority: Math.round(priority),
      is_active: isActive,
      note,
    })
    .eq("rule_id", ruleId)
    .select("rule_id, rule_set_id, color_code, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active, note, created_at, updated_at")
    .maybeSingle();
  if (error) return jsonError(error.message ?? "R3 룰 수정 실패", 400);
  if (!data) return jsonError("rule_id not found", 404);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleId = parseRuleId(body.rule_id);
  if (!ruleId) return jsonError("rule_id is required", 400);

  const { data, error } = await sb
    .from("sync_rule_r3_color_margin")
    .delete()
    .eq("rule_id", ruleId)
    .select("rule_id")
    .maybeSingle();
  if (error) return jsonError(error.message ?? "R3 룰 삭제 실패", 400);
  if (!data) return jsonError("rule_id not found", 404);

  return NextResponse.json({ ok: true, rule_id: ruleId }, { headers: { "Cache-Control": "no-store" } });
}
