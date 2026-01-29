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
  const modelName = String(body.model_name ?? "").trim();
  if (!modelName) {
    return NextResponse.json({ error: "model_name 값이 필요합니다." }, { status: 400 });
  }

  // ✅ WRITE는 RPC만
  const rpcPayload = {
    p_master_id: (body.master_id as string | null) ?? null,
    p_model_name: modelName,
    p_master_kind: (body.master_kind as string | null) ?? "MODEL",
    p_category_code: (body.category_code as string | null) ?? null,
    p_material_code_default: (body.material_code_default as string | null) ?? null,
    p_weight_default_g: (body.weight_default_g as number | null) ?? null,
    p_deduction_weight_default_g: (body.deduction_weight_default_g as number | null) ?? 0,
    p_center_qty_default: (body.center_qty_default as number | null) ?? 0,
    p_sub1_qty_default: (body.sub1_qty_default as number | null) ?? 0,
    p_sub2_qty_default: (body.sub2_qty_default as number | null) ?? 0,

    // labor sell
    p_labor_base_sell: (body.labor_base_sell as number | null) ?? 0,
    p_labor_center_sell: (body.labor_center_sell as number | null) ?? 0,
    p_labor_sub1_sell: (body.labor_sub1_sell as number | null) ?? 0,
    p_labor_sub2_sell: (body.labor_sub2_sell as number | null) ?? 0,

    // labor cost
    p_labor_base_cost: (body.labor_base_cost as number | null) ?? 0,
    p_labor_center_cost: (body.labor_center_cost as number | null) ?? 0,
    p_labor_sub1_cost: (body.labor_sub1_cost as number | null) ?? 0,
    p_labor_sub2_cost: (body.labor_sub2_cost as number | null) ?? 0,

    // plating
    p_plating_price_sell_default: (body.plating_price_sell_default as number | null) ?? 0,
    p_plating_price_cost_default: (body.plating_price_cost_default as number | null) ?? 0,

    // band mode
    p_labor_profile_mode: (body.labor_profile_mode as string | null) ?? "MANUAL",
    p_labor_band_code: (body.labor_band_code as string | null) ?? null,

    p_vendor_party_id: (body.vendor_party_id as string | null) ?? null,
    p_note: (body.note as string | null) ?? null,
    p_image_path: (body.image_path as string | null) ?? null,
    p_actor_person_id: (body.actor_person_id as string | null) ?? null,
  };

  const { data, error } = await supabase.rpc("cms_fn_upsert_master_item_v1", rpcPayload);
  if (error) {
    return NextResponse.json({ error: error.message ?? "저장에 실패했습니다." }, { status: 400 });
  }

  return NextResponse.json({ master_id: data });
}
