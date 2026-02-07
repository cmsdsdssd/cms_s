import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PricingRuleComponent = "SETTING" | "STONE" | "PACKAGE";
type PricingRuleScope = "ANY" | "SELF" | "PROVIDED" | "FACTORY";

type PricingRuleRow = {
  rule_id: string;
  component: PricingRuleComponent;
  scope: PricingRuleScope;
  vendor_party_id: string | null;
  min_cost_krw: number;
  max_cost_krw: number | null;
  markup_kind: string;
  markup_value_krw: number;
  priority: number;
  is_active: boolean;
  note: string | null;
  updated_at: string;
};

const COMPONENTS = new Set<PricingRuleComponent>(["SETTING", "STONE", "PACKAGE"]);
const SCOPES = new Set<PricingRuleScope>(["ANY", "SELF", "PROVIDED", "FACTORY"]);

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

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("cms_pricing_rule_v1")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as PricingRuleRow[] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const component = String(body.component ?? "").trim() as PricingRuleComponent;
  const scope = String(body.scope ?? "").trim() as PricingRuleScope;
  const minCost = toNumber(body.min_cost_krw);
  const maxCost = body.max_cost_krw === null || body.max_cost_krw === undefined || body.max_cost_krw === ""
    ? null
    : toNumber(body.max_cost_krw);
  const markupValue = toNumber(body.markup_value_krw);
  const priorityValue = toNumber(body.priority);

  if (!COMPONENTS.has(component)) {
    return NextResponse.json({ error: "component 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!SCOPES.has(scope)) {
    return NextResponse.json({ error: "scope 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (minCost === null || minCost < 0) {
    return NextResponse.json({ error: "min_cost_krw는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (maxCost !== null && (maxCost < minCost)) {
    return NextResponse.json({ error: "max_cost_krw는 min_cost_krw 이상이어야 합니다." }, { status: 400 });
  }
  if (markupValue === null || markupValue < 0) {
    return NextResponse.json({ error: "markup_value_krw는 0 이상이어야 합니다." }, { status: 400 });
  }

  const ruleId = toNullableText(body.rule_id) ?? crypto.randomUUID();
  const payload = {
    rule_id: ruleId,
    component,
    scope,
    vendor_party_id: toNullableText(body.vendor_party_id),
    min_cost_krw: minCost,
    max_cost_krw: maxCost,
    markup_kind: "ADD_KRW",
    markup_value_krw: markupValue,
    priority: Number.isInteger(priorityValue) ? Number(priorityValue) : 100,
    is_active: body.is_active === false ? false : true,
    note: toNullableText(body.note),
  };

  const { data, error } = await supabase
    .from("cms_pricing_rule_v1")
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
    .from("cms_pricing_rule_v1")
    .delete()
    .eq("rule_id", ruleId);

  if (error) {
    return NextResponse.json({ error: error.message ?? "삭제 실패" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
