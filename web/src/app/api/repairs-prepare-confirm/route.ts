import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildMaterialFactorMap, calcMaterialAmountSellKrw } from "@/lib/material-factors";

export const dynamic = "force-dynamic";

type Body = {
  shipment_id?: string;
  repair_line_id?: string;
  material_code?: string | null;
  added_weight_g?: number | null;
};

const REPAIR_MATERIAL_CODE_PATTERN = /^(00|\d{1,4})$/;

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
  const code = String(value ?? "").trim().toUpperCase();
  if (code === "14K") return "14";
  if (code === "18K") return "18";
  if (code === "24K" || code === "PURE") return "24";
  if (code === "S925") return "925";
  if (code === "S999") return "999";
  return REPAIR_MATERIAL_CODE_PATTERN.test(code) ? code : "00";
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

  const { data: shipmentHeader, error: shipmentHeaderError } = await supabase
    .from("cms_shipment_header")
    .select("confirmed_at, status")
    .eq("shipment_id", shipmentId)
    .maybeSingle<{ confirmed_at: string | null; status: string | null }>();

  if (shipmentHeaderError) {
    return NextResponse.json({ error: shipmentHeaderError.message ?? "shipment header query failed" }, { status: 500 });
  }

  if (shipmentHeader?.confirmed_at || shipmentHeader?.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "shipment is confirmed; repairs pre-confirm adjustment is locked" },
      { status: 409 }
    );
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
      .select("gold_krw_per_g_snapshot, silver_krw_per_g_snapshot")
      .eq("shipment_id", shipmentId)
      .maybeSingle<{
        gold_krw_per_g_snapshot: number | null;
        silver_krw_per_g_snapshot: number | null;
      }>();

    if (valuationError) {
      return NextResponse.json({ error: valuationError.message ?? "shipment valuation query failed" }, { status: 500 });
    }

    const goldPrice = Number(valuation?.gold_krw_per_g_snapshot ?? 0);
    const silverPrice = Number(valuation?.silver_krw_per_g_snapshot ?? 0);

    const { data: factorRows } = await supabase
      .from("cms_material_factor_config")
      .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis");
    const factors = buildMaterialFactorMap((factorRows ?? []) as never[]);

    let materialAmount = 0;
    let goldTick: number | null = null;
    let silverTick: number | null = null;
    if (nextMaterial === "14") {
      materialAmount = calcMaterialAmountSellKrw({
        netWeightG: netWeight,
        tickPriceKrwPerG: goldPrice,
        materialCode: nextMaterial,
        factors,
      });
      goldTick = goldPrice;
    } else if (nextMaterial === "18") {
      materialAmount = calcMaterialAmountSellKrw({
        netWeightG: netWeight,
        tickPriceKrwPerG: goldPrice,
        materialCode: nextMaterial,
        factors,
      });
      goldTick = goldPrice;
    } else if (nextMaterial === "24") {
      materialAmount = calcMaterialAmountSellKrw({
        netWeightG: netWeight,
        tickPriceKrwPerG: goldPrice,
        materialCode: nextMaterial,
        factors,
      });
      goldTick = goldPrice;
    } else if (nextMaterial === "925") {
      materialAmount = calcMaterialAmountSellKrw({
        netWeightG: netWeight,
        tickPriceKrwPerG: silverPrice,
        materialCode: nextMaterial,
        factors,
      });
      silverTick = silverPrice;
    } else if (nextMaterial === "999") {
      materialAmount = calcMaterialAmountSellKrw({
        netWeightG: netWeight,
        tickPriceKrwPerG: silverPrice,
        materialCode: nextMaterial,
        factors,
      });
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
      silver_adjust_factor: 1,
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
