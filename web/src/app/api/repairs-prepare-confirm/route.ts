import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Body = {
  shipment_id?: string;
  repair_line_id?: string;
  material_code?: string | null;
  added_weight_g?: number | null;
};

const REPAIR_MATERIAL_CODES = new Set(["14", "18", "24", "925", "999", "00"]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function asUuid(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(text)) return "";
  return text;
}

function resolveMaterialCode(value: unknown) {
  const code = String(value ?? "").trim();
  return REPAIR_MATERIAL_CODES.has(code) ? code : "00";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const shipmentId = asUuid(body?.shipment_id);
  const repairLineId = asUuid(body?.repair_line_id);
  if (!shipmentId || !repairLineId) {
    return NextResponse.json({ error: "shipment_id and repair_line_id are required" }, { status: 400 });
  }

  const materialCode = resolveMaterialCode(body?.material_code ?? null);
  const addedWeight = Number(body?.added_weight_g ?? NaN);
  const hasAddedWeight = Number.isFinite(addedWeight) && addedWeight > 0;

  const { data: row, error: lineError } = await supabase
    .from("cms_shipment_line")
    .select(
      "shipment_line_id, category_code, material_code, repair_fee_krw, measured_weight_g, deduction_weight_g, net_weight_g"
    )
    .eq("shipment_id", shipmentId)
    .eq("repair_line_id", repairLineId)
    .maybeSingle<{
      shipment_line_id: string;
      category_code: string | null;
      material_code: string | null;
      repair_fee_krw: number | null;
      measured_weight_g: number | null;
      deduction_weight_g: number | null;
      net_weight_g: number | null;
    }>();

  if (lineError) {
    return NextResponse.json({ error: lineError.message ?? "shipment line query failed" }, { status: 500 });
  }
  if (!row?.shipment_line_id) {
    return NextResponse.json({ error: "shipment line not found" }, { status: 404 });
  }

  const nextCategory = (row.category_code ?? "").trim() || "ETC";
  const currentMaterial = (row.material_code ?? "").trim();
  const nextMaterial = hasAddedWeight
    ? (materialCode !== "00" ? materialCode : currentMaterial || materialCode)
    : currentMaterial || materialCode;

  if (nextCategory !== (row.category_code ?? "") || nextMaterial !== (row.material_code ?? "") || hasAddedWeight) {
    const measuredWeight = hasAddedWeight ? addedWeight : Number(row.measured_weight_g ?? row.net_weight_g ?? 0);
    const deductionWeight = 0;
    const netWeight = Math.max(0, measuredWeight - deductionWeight);

    const { data: valuation, error: valuationError } = await supabase
      .from("cms_shipment_valuation")
      .select("gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot")
      .eq("shipment_id", shipmentId)
      .maybeSingle<{
        gold_krw_per_g_snapshot: number | null;
        silver_krw_per_g_snapshot: number | null;
        silver_adjust_factor_snapshot: number | null;
      }>();

    if (valuationError) {
      return NextResponse.json({ error: valuationError.message ?? "shipment valuation query failed" }, { status: 500 });
    }

    const silverAdjustRaw = Number(valuation?.silver_adjust_factor_snapshot ?? 1);
    const silverAdjust = Number.isFinite(silverAdjustRaw) && silverAdjustRaw > 0 ? silverAdjustRaw : 1;
    const goldPrice = Number(valuation?.gold_krw_per_g_snapshot ?? 0);
    const silverPrice = Number(valuation?.silver_krw_per_g_snapshot ?? 0);

    let materialAmount = 0;
    let goldTick: number | null = null;
    let silverTick: number | null = null;
    if (nextMaterial === "14") {
      materialAmount = Math.round(netWeight * 0.6435 * goldPrice);
      goldTick = goldPrice;
    } else if (nextMaterial === "18") {
      materialAmount = Math.round(netWeight * 0.825 * goldPrice);
      goldTick = goldPrice;
    } else if (nextMaterial === "24") {
      materialAmount = Math.round(netWeight * goldPrice);
      goldTick = goldPrice;
    } else if (nextMaterial === "925") {
      materialAmount = Math.round(netWeight * 0.925 * silverAdjust * silverPrice);
      silverTick = silverPrice;
    } else if (nextMaterial === "999") {
      materialAmount = Math.round(netWeight * silverAdjust * silverPrice);
      silverTick = silverPrice;
    }

    const laborAmount = Math.max(0, Math.round(Number(row.repair_fee_krw ?? 0)));
    const totalAmount = materialAmount + laborAmount;

    const patch: {
      category_code: string;
      material_code: string;
      pricing_mode: "RULE";
      manual_total_amount_krw: null;
      material_amount_sell_krw: number;
      labor_total_sell_krw: number;
      total_amount_sell_krw: number;
      gold_tick_krw_per_g: number | null;
      silver_tick_krw_per_g: number | null;
      silver_adjust_factor: number;
      price_calc_trace: Record<string, unknown>;
      measured_weight_g?: number;
      deduction_weight_g?: number;
      net_weight_g?: number;
    } = {
      category_code: nextCategory,
      material_code: nextMaterial,
      pricing_mode: "RULE",
      manual_total_amount_krw: null,
      material_amount_sell_krw: materialAmount,
      labor_total_sell_krw: laborAmount,
      total_amount_sell_krw: totalAmount,
      gold_tick_krw_per_g: goldTick,
      silver_tick_krw_per_g: silverTick,
      silver_adjust_factor: silverAdjust,
      price_calc_trace: {
        repair_prepare_confirm_repriced: true,
        repair_fee_included: true,
      },
    };
    patch.measured_weight_g = measuredWeight;
    patch.deduction_weight_g = deductionWeight;
    patch.net_weight_g = netWeight;

    const { error: updateError } = await supabase
      .from("cms_shipment_line")
      .update(patch)
      .eq("shipment_line_id", row.shipment_line_id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message ?? "shipment line update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
