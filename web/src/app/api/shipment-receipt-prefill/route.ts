import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildLaborSnapshotHash,
  normalizeExtraLaborItemsWithStableIds,
} from "@/lib/shipments-prefill-snapshot";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

const parseNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.replaceAll(",", "").trim();
    if (normalized !== "" && Number.isFinite(Number(normalized))) {
      return Number(normalized);
    }
  }
  return null;
};

const parseNumericOrNull = (value: unknown) => {
  const parsed = parseNumeric(value);
  return parsed === null ? null : Number(parsed);
};

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const orderLineId = String(searchParams.get("order_line_id") ?? "").trim();
  if (!orderLineId) {
    return NextResponse.json({ error: "order_line_id 값이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_receipt_line_match")
    .select(
      "receipt_id, receipt_line_uuid, order_line_id, shipment_line_id, status, selected_weight_g, selected_material_code, selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw, overridden_fields, pricing_policy_version, pricing_policy_meta, confirmed_at"
    )
    .eq("order_line_id", orderLineId)
    .eq("status", "CONFIRMED")
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "조회 실패" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ data: null });
  }

  let receiptWeightG: number | null = null;
  let receiptDeductionWeightG: number | null = null;
  let shipmentBaseLaborKrw: number | null = null;
  let shipmentExtraLaborKrw: number | null = null;
  let shipmentExtraLaborItems: unknown = null;
  let shipmentMasterId: string | null = null;
  let stoneCenterQty: number | null = null;
  let stoneSub1Qty: number | null = null;
  let stoneSub2Qty: number | null = null;
  let stoneCenterUnitCostKrw: number | null = null;
  let stoneSub1UnitCostKrw: number | null = null;
  let stoneSub2UnitCostKrw: number | null = null;
  let stoneLaborKrw: number | null = null;
  let receiptLaborBasicCostKrw: number | null = null;
  let receiptLaborOtherCostKrw: number | null = null;

  if (data.receipt_id && data.receipt_line_uuid) {
    const { data: lineRow } = await supabase
      .from("cms_v_receipt_line_items_flat_v1")
      .select("factory_weight_g, factory_labor_basic_cost_krw, line_item_json")
      .eq("receipt_id", data.receipt_id)
      .eq("receipt_line_uuid", data.receipt_line_uuid)
      .maybeSingle();

    const lineJson = (lineRow?.line_item_json ?? null) as Record<string, unknown> | null;
    const raw = lineJson?.weight_raw_g ?? lineJson?.weight_g ?? null;
    const deduct =
      lineJson?.weight_deduct_g ??
      lineJson?.deduction_weight_g ??
      null;

    stoneCenterQty = parseNumeric(lineJson?.stone_center_qty ?? null);
    stoneSub1Qty = parseNumeric(lineJson?.stone_sub1_qty ?? null);
    stoneSub2Qty = parseNumeric(lineJson?.stone_sub2_qty ?? null);
    stoneCenterUnitCostKrw = parseNumeric(lineJson?.stone_center_unit_cost_krw ?? null);
    stoneSub1UnitCostKrw = parseNumeric(lineJson?.stone_sub1_unit_cost_krw ?? null);
    stoneSub2UnitCostKrw = parseNumeric(lineJson?.stone_sub2_unit_cost_krw ?? null);
    receiptLaborBasicCostKrw =
      parseNumeric(lineJson?.labor_basic_cost_krw ?? null) ??
      parseNumeric(lineRow?.factory_labor_basic_cost_krw ?? null);
    receiptLaborOtherCostKrw = parseNumeric(lineJson?.labor_other_cost_krw ?? null);

    const centerLabor = Math.max(stoneCenterQty ?? 0, 0) * Math.max(stoneCenterUnitCostKrw ?? 0, 0);
    const sub1Labor = Math.max(stoneSub1Qty ?? 0, 0) * Math.max(stoneSub1UnitCostKrw ?? 0, 0);
    const sub2Labor = Math.max(stoneSub2Qty ?? 0, 0) * Math.max(stoneSub2UnitCostKrw ?? 0, 0);
    const sumLabor = centerLabor + sub1Labor + sub2Labor;
    stoneLaborKrw = sumLabor > 0 ? sumLabor : null;

    receiptWeightG = parseNumeric(raw) ?? parseNumeric(lineRow?.factory_weight_g ?? null);
    receiptDeductionWeightG = parseNumeric(deduct);
  }

  if (data.shipment_line_id) {
    const { data: shipmentLineRow } = await supabase
      .from("cms_shipment_line")
      .select("master_id, base_labor_krw, extra_labor_krw, extra_labor_items")
      .eq("shipment_line_id", data.shipment_line_id)
      .maybeSingle();

    shipmentMasterId = shipmentLineRow?.master_id ? String(shipmentLineRow.master_id) : null;

    if (shipmentLineRow?.base_labor_krw !== null && shipmentLineRow?.base_labor_krw !== undefined) {
      shipmentBaseLaborKrw = Number(shipmentLineRow.base_labor_krw);
    }
    if (shipmentLineRow?.extra_labor_krw !== null && shipmentLineRow?.extra_labor_krw !== undefined) {
      shipmentExtraLaborKrw = Number(shipmentLineRow.extra_labor_krw);
    }
    shipmentExtraLaborItems = shipmentLineRow?.extra_labor_items ?? null;
  }

  const normalizedShipmentExtraLaborItems = normalizeExtraLaborItemsWithStableIds(shipmentExtraLaborItems);

  const policyMeta =
    data.pricing_policy_meta && typeof data.pricing_policy_meta === "object" && !Array.isArray(data.pricing_policy_meta)
      ? (data.pricing_policy_meta as Record<string, unknown>)
      : null;
  const shipmentExtraItemsArray = normalizedShipmentExtraLaborItems as Array<Record<string, unknown>>;
  const shipmentPlatingItems = shipmentExtraItemsArray.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    const label = String(item.label ?? "");
    return type.includes("PLATING") || label.includes("도금");
  });

  const laborPrefillSnapshotBase = {
    snapshot_version: Number(data.pricing_policy_version ?? 1),
    snapshot_source: data.shipment_line_id ? "SHIPMENT_LINE" : "RECEIPT_MATCH",
    base_labor_sell_krw: shipmentBaseLaborKrw,
    base_labor_cost_krw:
      parseNumericOrNull(data.selected_factory_labor_basic_cost_krw) ??
      parseNumericOrNull(receiptLaborBasicCostKrw),
    extra_labor_sell_krw: shipmentExtraLaborKrw,
    extra_labor_cost_krw:
      parseNumericOrNull(data.selected_factory_labor_other_cost_krw) ??
      parseNumericOrNull(receiptLaborOtherCostKrw),
    policy_plating_sell_krw: parseNumericOrNull(policyMeta?.plating_sell_krw ?? null),
    policy_plating_cost_krw: parseNumericOrNull(policyMeta?.plating_cost_krw ?? null),
    policy_absorb_plating_krw: parseNumericOrNull(policyMeta?.absorb_plating_krw ?? null),
    policy_absorb_etc_total_krw: parseNumericOrNull(policyMeta?.absorb_etc_total_krw ?? null),
    policy_absorb_decor_total_krw: parseNumericOrNull(policyMeta?.absorb_decor_total_krw ?? null),
    policy_absorb_other_total_krw: parseNumericOrNull(policyMeta?.absorb_other_total_krw ?? null),
    extra_labor_items: normalizedShipmentExtraLaborItems,
  };
  const laborPrefillSnapshot = {
    ...laborPrefillSnapshotBase,
    snapshot_hash: buildLaborSnapshotHash(laborPrefillSnapshotBase),
  };

  console.log("[PLATING_DEBUG][API_PREFILL]", {
    orderLineId,
    shipmentLineId: data.shipment_line_id,
    selectedFactoryLaborOtherCostKrw: data.selected_factory_labor_other_cost_krw,
    shipmentExtraLaborKrw,
    pricingPolicyVersion: data.pricing_policy_version,
    policyPlatingSellKrw: parseNumeric(policyMeta?.plating_sell_krw ?? null),
    policyPlatingCostKrw: parseNumeric(policyMeta?.plating_cost_krw ?? null),
    policyAbsorbPlatingKrw: parseNumeric(policyMeta?.absorb_plating_krw ?? null),
    policyAbsorbEtcTotalKrw: parseNumeric(policyMeta?.absorb_etc_total_krw ?? null),
    shipmentPlatingItems,
  });

  return NextResponse.json({
    data: {
      ...data,
      receipt_weight_g: receiptWeightG,
      receipt_deduction_weight_g: receiptDeductionWeightG,
      shipment_base_labor_krw: shipmentBaseLaborKrw,
      shipment_extra_labor_krw: shipmentExtraLaborKrw,
      shipment_extra_labor_items: normalizedShipmentExtraLaborItems,
      shipment_master_id: shipmentMasterId,
      receipt_match_overridden_fields: data.overridden_fields ?? null,
      stone_center_qty: stoneCenterQty,
      stone_sub1_qty: stoneSub1Qty,
      stone_sub2_qty: stoneSub2Qty,
      stone_center_unit_cost_krw: stoneCenterUnitCostKrw,
      stone_sub1_unit_cost_krw: stoneSub1UnitCostKrw,
      stone_sub2_unit_cost_krw: stoneSub2UnitCostKrw,
      stone_labor_krw: stoneLaborKrw,
      receipt_labor_basic_cost_krw: receiptLaborBasicCostKrw,
      receipt_labor_other_cost_krw: receiptLaborOtherCostKrw,
      labor_prefill_snapshot: laborPrefillSnapshot,
    },
  });
}
