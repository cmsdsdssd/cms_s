import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type ShipmentCostCandidate = {
  shipment_id: string;
  ship_date: string | null;
  status: string | null;
  customer_party_id: string | null;
  customer_name: string | null;
  line_cnt: number | null;
  total_qty: number | null;
  total_cost_krw: number | null;
  total_sell_krw: number | null;
  cost_confirmed: boolean | null;
  has_receipt: boolean | null;
  model_names: string | null;
  purchase_receipt_id: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getSupabaseSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // noop in route handlers where cookies are readonly
        }
      },
    },
  });
}

function normalizeRow(row: Record<string, unknown>): ShipmentCostCandidate | null {
  const shipmentId = typeof row.shipment_id === "string" ? row.shipment_id : "";
  if (!shipmentId) return null;

  return {
    shipment_id: shipmentId,
    ship_date: typeof row.ship_date === "string" ? row.ship_date : null,
    status: typeof row.status === "string" ? row.status : null,
    customer_party_id: typeof row.customer_party_id === "string" ? row.customer_party_id : null,
    customer_name: typeof row.customer_name === "string" ? row.customer_name : null,
    line_cnt: row.line_cnt == null ? null : Number(row.line_cnt),
    total_qty: row.total_qty == null ? null : Number(row.total_qty),
    total_cost_krw: row.total_cost_krw == null ? null : Number(row.total_cost_krw),
    total_sell_krw: row.total_sell_krw == null ? null : Number(row.total_sell_krw),
    cost_confirmed: typeof row.cost_confirmed === "boolean" ? row.cost_confirmed : null,
    has_receipt: typeof row.has_receipt === "boolean" ? row.has_receipt : null,
    model_names: typeof row.model_names === "string" ? row.model_names : null,
    purchase_receipt_id: typeof row.purchase_receipt_id === "string" ? row.purchase_receipt_id : null,
  };
}

export async function GET() {
  const session = await getSupabaseSession();
  const supabase = getSupabaseAdmin();

  if (!session || !supabase) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  const { data: authData, error: authError } = await session.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("cms_v_shipment_cost_apply_candidates_v1")
    .select("*")
    .order("ship_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message ?? "failed to load shipment candidates" }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const normalized = rows
    .map((row) => normalizeRow((row ?? {}) as Record<string, unknown>))
    .filter((row): row is ShipmentCostCandidate => row !== null);

  return NextResponse.json(
    { data: normalized },
    {
      headers: {
        "Cache-Control": "no-store, private",
      },
    }
  );
}
