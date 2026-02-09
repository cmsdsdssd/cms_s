import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  order_line_id?: string;
  memo?: string | null;
  material_code?: string | null;
  color?: string | null;
  size?: string | null;
  center_stone_name?: string | null;
  center_stone_qty?: number | null;
  sub1_stone_name?: string | null;
  sub1_stone_qty?: number | null;
  sub2_stone_name?: string | null;
  sub2_stone_qty?: number | null;
  selected_base_weight_g?: number | null;
  selected_deduction_weight_g?: number | null;
  selected_net_weight_g?: number | null;
  selected_labor_base_sell_krw?: number | null;
  selected_labor_other_sell_krw?: number | null;
  selected_inventory_move_line_id?: string | null;
  selected_inventory_location_code?: string | null;
  selected_inventory_bin_code?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value.trim());

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as Payload;
  if (!isUuid(payload.order_line_id)) {
    return NextResponse.json({ error: "order_line_id(uuid) required" }, { status: 400 });
  }

  const supabase = createClient(url, key);
  const updatePayload: Record<string, unknown> = {
    memo: payload.memo ?? null,
  };

  if (payload.material_code !== undefined) updatePayload.material_code = payload.material_code ?? null;
  if (payload.color !== undefined) updatePayload.color = payload.color ?? null;
  if (payload.size !== undefined) updatePayload.size = payload.size ?? null;
  if (payload.center_stone_name !== undefined) updatePayload.center_stone_name = payload.center_stone_name ?? null;
  if (payload.center_stone_qty !== undefined) updatePayload.center_stone_qty = payload.center_stone_qty ?? null;
  if (payload.sub1_stone_name !== undefined) updatePayload.sub1_stone_name = payload.sub1_stone_name ?? null;
  if (payload.sub1_stone_qty !== undefined) updatePayload.sub1_stone_qty = payload.sub1_stone_qty ?? null;
  if (payload.sub2_stone_name !== undefined) updatePayload.sub2_stone_name = payload.sub2_stone_name ?? null;
  if (payload.sub2_stone_qty !== undefined) updatePayload.sub2_stone_qty = payload.sub2_stone_qty ?? null;
  if (payload.selected_base_weight_g !== undefined) updatePayload.selected_base_weight_g = payload.selected_base_weight_g ?? null;
  if (payload.selected_deduction_weight_g !== undefined) updatePayload.selected_deduction_weight_g = payload.selected_deduction_weight_g ?? null;
  if (payload.selected_net_weight_g !== undefined) updatePayload.selected_net_weight_g = payload.selected_net_weight_g ?? null;
  if (payload.selected_labor_base_sell_krw !== undefined) updatePayload.selected_labor_base_sell_krw = payload.selected_labor_base_sell_krw ?? null;
  if (payload.selected_labor_other_sell_krw !== undefined) updatePayload.selected_labor_other_sell_krw = payload.selected_labor_other_sell_krw ?? null;
  if (payload.selected_inventory_move_line_id !== undefined) updatePayload.selected_inventory_move_line_id = payload.selected_inventory_move_line_id ?? null;
  if (payload.selected_inventory_location_code !== undefined) updatePayload.selected_inventory_location_code = payload.selected_inventory_location_code ?? null;
  if (payload.selected_inventory_bin_code !== undefined) updatePayload.selected_inventory_bin_code = payload.selected_inventory_bin_code ?? null;

  const { error } = await supabase
    .from("cms_order_line")
    .update(updatePayload)
    .eq("order_line_id", payload.order_line_id);

  if (error) {
    return NextResponse.json(
      { error: error.message, details: error.details, hint: error.hint, code: error.code },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
