import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase environment is missing" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const shipmentLineId = String(searchParams.get("shipment_line_id") ?? "").trim();
  if (!shipmentLineId) {
    return NextResponse.json({ error: "shipment_line_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cms_receipt_line_match")
    .select("pricing_policy_meta, selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw, confirmed_at")
    .eq("shipment_line_id", shipmentLineId)
    .eq("status", "CONFIRMED")
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to fetch policy meta" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      pricing_policy_meta: data?.pricing_policy_meta ?? null,
      selected_factory_labor_basic_cost_krw: data?.selected_factory_labor_basic_cost_krw ?? null,
      selected_factory_labor_other_cost_krw: data?.selected_factory_labor_other_cost_krw ?? null,
      selected_factory_total_cost_krw: data?.selected_factory_total_cost_krw ?? null,
    },
  });
}
