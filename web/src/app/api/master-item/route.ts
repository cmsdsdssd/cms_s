import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isStoneSource } from "@/lib/stone-source";

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

  const centerStoneSourceDefault = isStoneSource(body.center_stone_source_default)
    ? body.center_stone_source_default
    : null;
  const sub1StoneSourceDefault = isStoneSource(body.sub1_stone_source_default)
    ? body.sub1_stone_source_default
    : null;
  const sub2StoneSourceDefault = isStoneSource(body.sub2_stone_source_default)
    ? body.sub2_stone_source_default
    : null;
  const buyMarginProfileId = typeof body.buy_margin_profile_id === "string"
    ? body.buy_margin_profile_id.trim() || null
    : null;

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

  const masterId = data as string | null;
  const centerStoneName = (body.center_stone_name_default as string | null) ?? null;
  const sub1StoneName = (body.sub1_stone_name_default as string | null) ?? null;
  const sub2StoneName = (body.sub2_stone_name_default as string | null) ?? null;
  const laborBaseSell = typeof body.labor_base_sell === "number" ? body.labor_base_sell : undefined;
  const laborCenterSell = typeof body.labor_center_sell === "number" ? body.labor_center_sell : undefined;
  const laborSub1Sell = typeof body.labor_sub1_sell === "number" ? body.labor_sub1_sell : undefined;
  const laborSub2Sell = typeof body.labor_sub2_sell === "number" ? body.labor_sub2_sell : undefined;
  const laborBaseCost = typeof body.labor_base_cost === "number" ? body.labor_base_cost : undefined;
  const laborCenterCost = typeof body.labor_center_cost === "number" ? body.labor_center_cost : undefined;
  const laborSub1Cost = typeof body.labor_sub1_cost === "number" ? body.labor_sub1_cost : undefined;
  const laborSub2Cost = typeof body.labor_sub2_cost === "number" ? body.labor_sub2_cost : undefined;
  const laborProfileMode = typeof body.labor_profile_mode === "string" ? body.labor_profile_mode : undefined;
  const laborBandCode = typeof body.labor_band_code === "string" ? body.labor_band_code : undefined;
  const settingAddonMargin = typeof body.setting_addon_margin_krw_per_piece === "number"
    ? body.setting_addon_margin_krw_per_piece
    : undefined;
  const stoneAddonMargin = typeof body.stone_addon_margin_krw_per_piece === "number"
    ? body.stone_addon_margin_krw_per_piece
    : undefined;

  if (masterId) {
    const updatePayload: Record<string, unknown> = {
      center_stone_name_default: centerStoneName,
      sub1_stone_name_default: sub1StoneName,
      sub2_stone_name_default: sub2StoneName,
      center_stone_source_default: centerStoneSourceDefault,
      sub1_stone_source_default: sub1StoneSourceDefault,
      sub2_stone_source_default: sub2StoneSourceDefault,
      buy_margin_profile_id: buyMarginProfileId,
    };
    if (laborBaseSell !== undefined) updatePayload.labor_base_sell = laborBaseSell;
    if (laborCenterSell !== undefined) updatePayload.labor_center_sell = laborCenterSell;
    if (laborSub1Sell !== undefined) updatePayload.labor_sub1_sell = laborSub1Sell;
    if (laborSub2Sell !== undefined) updatePayload.labor_sub2_sell = laborSub2Sell;
    if (laborBaseCost !== undefined) updatePayload.labor_base_cost = laborBaseCost;
    if (laborCenterCost !== undefined) updatePayload.labor_center_cost = laborCenterCost;
    if (laborSub1Cost !== undefined) updatePayload.labor_sub1_cost = laborSub1Cost;
    if (laborSub2Cost !== undefined) updatePayload.labor_sub2_cost = laborSub2Cost;
    if (laborProfileMode !== undefined) updatePayload.labor_profile_mode = laborProfileMode;
    if (laborBandCode !== undefined) updatePayload.labor_band_code = laborBandCode;
    if (settingAddonMargin !== undefined) {
      updatePayload.setting_addon_margin_krw_per_piece = Math.max(settingAddonMargin, 0);
    }
    if (stoneAddonMargin !== undefined) {
      updatePayload.stone_addon_margin_krw_per_piece = Math.max(stoneAddonMargin, 0);
    }

    const { error: updateError } = await supabase
      .from("cms_master_item")
      .update(updatePayload)
      .eq("master_id", masterId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message ?? "저장에 실패했습니다." }, { status: 400 });
    }
  }

  return NextResponse.json({ master_id: masterId ?? undefined });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const masterId = String(searchParams.get("id") ?? searchParams.get("master_id") ?? "").trim();
  if (!masterId) {
    return NextResponse.json({ error: "삭제할 master_id(id) 값이 필요합니다." }, { status: 400 });
  }

  const { data: existingRow, error: findError } = await supabase
    .from("cms_master_item")
    .select("master_id")
    .eq("master_id", masterId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message ?? "삭제 대상 확인에 실패했습니다." }, { status: 400 });
  }

  if (!existingRow?.master_id) {
    return NextResponse.json({ error: "삭제할 마스터를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("cms_master_item")
    .delete()
    .eq("master_id", masterId);

  if (deleteError) {
    const isReferenceError = deleteError.code === "23503";
    return NextResponse.json(
      {
        error: isReferenceError
          ? "이 마스터를 참조하는 데이터가 있어 삭제할 수 없습니다. 먼저 연결된 데이터를 정리해 주세요."
          : deleteError.message ?? "삭제에 실패했습니다.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, master_id: masterId });
}
