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
    .select("shipment_line_id, category_code, material_code")
    .eq("shipment_id", shipmentId)
    .eq("repair_line_id", repairLineId)
    .maybeSingle<{ shipment_line_id: string; category_code: string | null; material_code: string | null }>();

  if (lineError) {
    return NextResponse.json({ error: lineError.message ?? "shipment line query failed" }, { status: 500 });
  }
  if (!row?.shipment_line_id) {
    return NextResponse.json({ error: "shipment line not found" }, { status: 404 });
  }

  const nextCategory = (row.category_code ?? "").trim() || "ETC";
  const nextMaterial = (row.material_code ?? "").trim() || materialCode;

  if (nextCategory !== (row.category_code ?? "") || nextMaterial !== (row.material_code ?? "") || hasAddedWeight) {
    const patch: {
      category_code: string;
      material_code: string;
      measured_weight_g?: number;
      deduction_weight_g?: number;
      net_weight_g?: number;
    } = {
      category_code: nextCategory,
      material_code: nextMaterial,
    };
    if (hasAddedWeight) {
      patch.measured_weight_g = addedWeight;
      patch.deduction_weight_g = 0;
      patch.net_weight_g = addedWeight;
    }
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
