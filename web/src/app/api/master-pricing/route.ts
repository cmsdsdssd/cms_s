import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

const SELECT_COLUMNS =
  "master_id, model_name, labor_base_sell, labor_base_cost, labor_center_sell, labor_center_cost, labor_sub1_sell, labor_sub1_cost, labor_sub2_sell, labor_sub2_cost, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_cost_default, plating_price_sell_default";

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const masterId = String(searchParams.get("master_id") ?? "").trim();
  const modelName = String(searchParams.get("model_name") ?? "").trim();

  const logMasterPricing = (source: string, row: Record<string, unknown> | null) => {
    if (!row) return;
    console.log("[PLATING_DEBUG][API_MASTER_PRICING]", {
      source,
      masterId,
      modelName,
      resolvedMasterId: row.master_id,
      resolvedModelName: row.model_name,
      platingPriceSellDefault: row.plating_price_sell_default,
      platingPriceCostDefault: row.plating_price_cost_default,
    });
  };

  if (!masterId && !modelName) {
    return NextResponse.json({ error: "master_id 또는 model_name이 필요합니다." }, { status: 400 });
  }

  if (masterId) {
    const byId = await supabase
      .from("cms_master_item")
      .select(SELECT_COLUMNS)
      .eq("master_id", masterId)
      .maybeSingle();
    if (byId.error) return NextResponse.json({ error: byId.error.message ?? "조회 실패" }, { status: 500 });
    if (byId.data) {
      logMasterPricing("master_id", byId.data as Record<string, unknown>);
      return NextResponse.json({ data: byId.data });
    }
  }

  if (!modelName) return NextResponse.json({ data: null });

  const byModelExact = await supabase
    .from("cms_master_item")
    .select(SELECT_COLUMNS)
    .eq("model_name", modelName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byModelExact.error) return NextResponse.json({ error: byModelExact.error.message ?? "조회 실패" }, { status: 500 });
  if (byModelExact.data) {
    logMasterPricing("model_exact", byModelExact.data as Record<string, unknown>);
    return NextResponse.json({ data: byModelExact.data });
  }

  const byModelInsensitive = await supabase
    .from("cms_master_item")
    .select(SELECT_COLUMNS)
    .ilike("model_name", modelName)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byModelInsensitive.error) return NextResponse.json({ error: byModelInsensitive.error.message ?? "조회 실패" }, { status: 500 });
  if (byModelInsensitive.data) {
    logMasterPricing("model_insensitive", byModelInsensitive.data as Record<string, unknown>);
    return NextResponse.json({ data: byModelInsensitive.data });
  }

  const byModelContains = await supabase
    .from("cms_master_item")
    .select(SELECT_COLUMNS)
    .ilike("model_name", `%${modelName}%`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byModelContains.error) return NextResponse.json({ error: byModelContains.error.message ?? "조회 실패" }, { status: 500 });

  logMasterPricing("model_contains", (byModelContains.data ?? null) as Record<string, unknown> | null);

  return NextResponse.json({ data: byModelContains.data ?? null });
}
