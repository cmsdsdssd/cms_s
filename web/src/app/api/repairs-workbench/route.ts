import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type RepairWorkbenchRow = Record<string, unknown>;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

const asMessage = (error: unknown) => {
  const e = error as { message?: string; details?: string; hint?: string } | null;
  return [e?.message, e?.details, e?.hint].filter(Boolean).join(" | ");
};

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  let workbenchError: unknown = null;
  try {
    const { data, error } = await supabase
      .from(CONTRACTS.views.repairWorkbench)
      .select("*")
      .order("status_sort_order", { ascending: true })
      .order("priority_sort_order", { ascending: true })
      .order("requested_due_date", { ascending: true })
      .order("received_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []) as RepairWorkbenchRow[], source: "workbench" });
  } catch (error) {
    workbenchError = error;
  }

  try {
    const { data, error } = await supabase
      .from(CONTRACTS.views.repairLineEnriched)
      .select(
        "repair_line_id, customer_party_id, customer_name, received_at, model_name, model_name_raw, suffix, material_code, color, qty, measured_weight_g, is_plated, plating_variant_id, plating_display_name, repair_fee_krw, repair_fee_reason, issue_desc, status, memo, created_at, updated_at"
      )
      .order("received_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []) as RepairWorkbenchRow[], source: "enriched" });
  } catch (error) {
    const message = [
      "수리 목록을 불러오지 못했습니다.",
      `workbench: ${asMessage(workbenchError) || "(none)"}`,
      `enriched: ${asMessage(error) || "(none)"}`,
    ].join("\n");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
