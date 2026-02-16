import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PricingRuleComponent = "BASE_LABOR" | "SETTING" | "STONE" | "PACKAGE";
type PricingRuleScope = "ANY" | "SELF" | "PROVIDED" | "FACTORY";
type PricingRuleApplyUnit = "PER_PIECE" | "PER_STONE" | "PER_G";
type PricingRuleStoneRole = "CENTER" | "SUB1" | "SUB2" | "BEAD";

const COMPONENTS = new Set<PricingRuleComponent>(["BASE_LABOR", "SETTING", "STONE", "PACKAGE"]);
const SCOPES = new Set<PricingRuleScope>(["ANY", "SELF", "PROVIDED", "FACTORY"]);
const APPLY_UNITS = new Set<PricingRuleApplyUnit>(["PER_PIECE", "PER_STONE", "PER_G"]);
const STONE_ROLES = new Set<PricingRuleStoneRole>(["CENTER", "SUB1", "SUB2", "BEAD"]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const component = String(body.component ?? "").trim() as PricingRuleComponent;
  const scope = String(body.scope ?? "").trim() as PricingRuleScope;
  const applyUnit = String(body.apply_unit ?? "").trim() as PricingRuleApplyUnit;
  const stoneRoleRaw = String(body.stone_role ?? "").trim();
  const stoneRole = stoneRoleRaw ? (stoneRoleRaw as PricingRuleStoneRole) : null;
  const vendorPartyId = String(body.vendor_party_id ?? "").trim() || null;
  const costBasis = Number(body.cost_basis_krw ?? 0);

  if (!COMPONENTS.has(component)) {
    return NextResponse.json({ error: "component 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!SCOPES.has(scope)) {
    return NextResponse.json({ error: "scope 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!APPLY_UNITS.has(applyUnit)) {
    return NextResponse.json({ error: "apply_unit 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (stoneRole !== null && !STONE_ROLES.has(stoneRole)) {
    return NextResponse.json({ error: "stone_role 값이 올바르지 않습니다." }, { status: 400 });
  }
  if (component === "BASE_LABOR" && applyUnit !== "PER_PIECE") {
    return NextResponse.json({ error: "BASE_LABOR는 apply_unit=PER_PIECE만 허용됩니다." }, { status: 400 });
  }
  if (component === "BASE_LABOR" && stoneRole !== null) {
    return NextResponse.json({ error: "BASE_LABOR는 stone_role을 허용하지 않습니다." }, { status: 400 });
  }
  if (component === "STONE" && applyUnit === "PER_STONE" && stoneRole === null) {
    return NextResponse.json({ error: "STONE + PER_STONE은 stone_role이 필요합니다." }, { status: 400 });
  }
  if (!Number.isFinite(costBasis) || costBasis < 0) {
    return NextResponse.json({ error: "cost_basis_krw는 0 이상 숫자여야 합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("cms_fn_pick_pricing_rule_markup_v2", {
    p_component: component,
    p_scope: scope,
    p_apply_unit: applyUnit,
    p_stone_role: stoneRole,
    p_vendor_party_id: vendorPartyId,
    p_cost_basis_krw: costBasis,
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "룰 테스트 실패" }, { status: 400 });
  }

  return NextResponse.json({ data: data ?? null });
}
