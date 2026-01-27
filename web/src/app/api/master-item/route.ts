import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const modelName = String(body.model_name ?? "");
  if (!modelName) {
    return NextResponse.json({ error: "model_name 값이 필요합니다." }, { status: 400 });
  }

  const payload = {
    master_id: body.master_id ?? null,
    model_name: modelName,
    category_code: body.category_code ?? null,
    material_code_default: body.material_code_default ?? null,
    weight_default_g: body.weight_default_g ?? null,
    deduction_weight_default_g: body.deduction_weight_default_g ?? null,
    center_qty_default: body.center_qty_default ?? null,
    sub1_qty_default: body.sub1_qty_default ?? null,
    sub2_qty_default: body.sub2_qty_default ?? null,
    labor_base_sell: body.labor_base_sell ?? null,
    labor_center_sell: body.labor_center_sell ?? null,
    labor_sub1_sell: body.labor_sub1_sell ?? null,
    labor_sub2_sell: body.labor_sub2_sell ?? null,
    labor_base_cost: body.labor_base_cost ?? null,
    labor_center_cost: body.labor_center_cost ?? null,
    labor_sub1_cost: body.labor_sub1_cost ?? null,
    labor_sub2_cost: body.labor_sub2_cost ?? null,
    plating_price_sell_default: body.plating_price_sell_default ?? null,
    plating_price_cost_default: body.plating_price_cost_default ?? null,
    labor_profile_mode: body.labor_profile_mode ?? null,
    labor_band_code: body.labor_band_code ?? null,
    vendor_party_id: body.vendor_party_id ?? null,
    note: body.note ?? null,
    image_path: body.image_path ?? null,
  };

  const { data, error } = await supabase
    .schema("public")
    .from("cms_master_item")
    .upsert(payload, { onConflict: "model_name" })
    .select("master_id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message ?? "저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? {});
}
