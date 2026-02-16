import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PlatingMarkupRuleRow = {
  rule_id: string;
  plating_variant_id: string;
  effective_from: string;
  category_code: string | null;
  material_code: string | null;
  margin_fixed_krw: number;
  margin_per_g_krw: number;
  priority: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const platingVariantId = searchParams.get("plating_variant_id")?.trim() ?? "";

  let query = supabase
    .from("cms_plating_markup_rule_v1")
    .select("*")
    .order("updated_at", { ascending: false });

  if (platingVariantId) {
    query = query.eq("plating_variant_id", platingVariantId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as PlatingMarkupRuleRow[] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const platingVariantId = String(body.plating_variant_id ?? "").trim();
  const effectiveFrom = String(body.effective_from ?? "").trim() || new Date().toISOString().slice(0, 10);
  const marginFixed = toNumber(body.margin_fixed_krw);
  const marginPerG = toNumber(body.margin_per_g_krw);
  const priorityValue = toNumber(body.priority);

  if (!platingVariantId) {
    return NextResponse.json({ error: "plating_variant_id 값이 필요합니다." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "effective_from 형식은 YYYY-MM-DD 입니다." }, { status: 400 });
  }
  if (marginFixed === null || marginFixed < 0) {
    return NextResponse.json({ error: "margin_fixed_krw는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (marginPerG === null || marginPerG < 0) {
    return NextResponse.json({ error: "margin_per_g_krw는 0 이상이어야 합니다." }, { status: 400 });
  }

  const ruleId = toNullableText(body.rule_id) ?? crypto.randomUUID();
  const payload = {
    rule_id: ruleId,
    plating_variant_id: platingVariantId,
    effective_from: effectiveFrom,
    category_code: toNullableText(body.category_code),
    material_code: toNullableText(body.material_code),
    margin_fixed_krw: marginFixed,
    margin_per_g_krw: marginPerG,
    priority: Number.isInteger(priorityValue) ? Number(priorityValue) : 100,
    is_active: body.is_active === false ? false : true,
    note: toNullableText(body.note),
  };

  const { data, error } = await supabase
    .from("cms_plating_markup_rule_v1")
    .upsert(payload, { onConflict: "rule_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message ?? "저장 실패" }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get("rule_id")?.trim() ?? "";
  if (!ruleId) {
    return NextResponse.json({ error: "rule_id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("cms_plating_markup_rule_v1")
    .delete()
    .eq("rule_id", ruleId);

  if (error) {
    return NextResponse.json({ error: error.message ?? "삭제 실패" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
