import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type LedgerStatementRow = {
  party_id: string;
  party_name: string;
  kst_date: string;
  prev_position: {
    balance_krw: number;
    labor_cash_outstanding_krw: number;
    gold_outstanding_g: number;
    silver_outstanding_g: number;
  };
  day_ledger_totals: {
    delta_total_krw: number;
    delta_shipment_krw: number;
    delta_return_krw: number;
    delta_payment_krw?: number;
    delta_adjust_krw?: number;
    delta_offset_krw?: number;
  };
  day_breakdown?: {
    shipment?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
    return?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
    payment?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
    adjust?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
    offset?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
    other?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number };
  };
  end_position: {
    balance_krw: number;
    labor_cash_outstanding_krw: number;
    gold_outstanding_g: number;
    silver_outstanding_g: number;
  };
  details: {
    shipments: unknown[];
    returns: unknown[];
  };
  checks: Record<string, number>;
};

type LegacyLedgerStatementRow = {
  party_id: string;
  kst_date: string;
  prev_position?: Record<string, unknown> | null;
  day_ledger_totals?: Record<string, unknown> | null;
  end_position?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function getSupabaseAuthedClient(accessToken: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) return null;
  const bearer = accessToken?.trim() || anonKey;
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
    },
  });
}

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const inferPartyName = (details: Record<string, unknown>) => {
  const shipments = toArray(details.shipments);
  for (const shipment of shipments) {
    const name = toObject(shipment).customer_name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "-";
};

const normalizeLegacyRow = (row: LegacyLedgerStatementRow): LedgerStatementRow => {
  const prev = toObject(row.prev_position);
  const day = toObject(row.day_ledger_totals);
  const end = toObject(row.end_position);
  const details = toObject(row.details);

  const shipmentLinesSum = toArray(details.shipments).reduce<number>((partySum, shipment) => {
    const lines = toArray(toObject(shipment).lines);
    return (
      partySum +
      lines.reduce<number>((lineSum, line) => lineSum + toNumber(toObject(line).amount_krw), 0)
    );
  }, 0);
  const returnSum = toArray(details.returns).reduce<number>(
    (sum, ret) => sum + toNumber(toObject(ret).amount_krw),
    0
  );

  const checkEnd =
    toNumber(end.balance_krw) - (toNumber(prev.balance_krw) + toNumber(day.delta_total_krw));
  const checkShip = shipmentLinesSum - toNumber(day.delta_shipment_krw);
  const checkReturn = returnSum - toNumber(day.delta_return_krw);

  return {
    party_id: row.party_id,
    party_name: inferPartyName(details),
    kst_date: row.kst_date,
    prev_position: {
      balance_krw: toNumber(prev.balance_krw),
      labor_cash_outstanding_krw: toNumber(prev.labor_cash_outstanding_krw),
      gold_outstanding_g: toNumber(prev.gold_outstanding_g),
      silver_outstanding_g: toNumber(prev.silver_outstanding_g),
    },
    day_ledger_totals: {
      delta_total_krw: toNumber(day.delta_total_krw),
      delta_shipment_krw: toNumber(day.delta_shipment_krw),
      delta_return_krw: toNumber(day.delta_return_krw),
    },
    end_position: {
      balance_krw: toNumber(end.balance_krw),
      labor_cash_outstanding_krw: toNumber(end.labor_cash_outstanding_krw),
      gold_outstanding_g: toNumber(end.gold_outstanding_g),
      silver_outstanding_g: toNumber(end.silver_outstanding_g),
    },
    details: {
      shipments: toArray(details.shipments),
      returns: toArray(details.returns),
    },
    checks: {
      check_end_equals_prev_plus_delta_krw: checkEnd,
      check_ship_lines_equals_ledger_shipment_krw: checkShip,
      check_return_sum_equals_ledger_return_krw: checkReturn,
    },
  };
};

const getKstBoundsIso = (ymd: string) => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("x-supabase-access-token");
    const admin = getSupabaseAdmin();
    const authed = getSupabaseAuthedClient(authHeader);
    const supabase = admin ?? authed;

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase 환경 변수가 설정되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY 또는 anon key 필요)" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = (searchParams.get("date") ?? "").trim();
    const partyId = (searchParams.get("party_id") ?? "").trim();

    if (!isValidYmd(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD)가 필요합니다." }, { status: 400 });
    }

    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: { p_party_ids: string[] | null; p_kst_date: string }
    ) => Promise<{ data: LedgerStatementRow[] | null; error: { message?: string; code?: string } | null }>;

    const { data, error } = await rpc("cms_fn_shipments_print_ledger_statement_v3", {
      p_party_ids: partyId ? [partyId] : null,
      p_kst_date: date,
    });

    const v3Rows = data ?? [];
    if (!error && v3Rows.length > 0) {
      return NextResponse.json({ data: v3Rows, source: "v3" });
    }

    const v2Rpc = supabase.rpc as unknown as (
      fn: string,
      args: { p_party_ids: string[] | null; p_kst_date: string }
    ) => Promise<{ data: LedgerStatementRow[] | null; error: { message?: string; code?: string } | null }>;

    const { data: v2Data, error: v2Error } = await v2Rpc("cms_fn_shipments_print_ledger_statement_v2", {
      p_party_ids: partyId ? [partyId] : null,
      p_kst_date: date,
    });

    const v2Rows = v2Data ?? [];
    if (!v2Error && v2Rows.length > 0) {
      return NextResponse.json({ data: v2Rows, source: "v2" });
    }

    const legacyRpc = supabase.rpc as unknown as (
      fn: string,
      args: { p_party_ids: string[] | null; p_kst_date: string }
    ) => Promise<{ data: LegacyLedgerStatementRow[] | null; error: { message?: string; code?: string } | null }>;

    const { data: legacyData, error: legacyError } = await legacyRpc(
      "cms_fn_shipments_print_ledger_statement_v1",
      {
        p_party_ids: partyId ? [partyId] : null,
        p_kst_date: date,
      }
    );

    const v1Rows = (legacyData ?? []).map(normalizeLegacyRow);
    if (!legacyError && v1Rows.length > 0) {
      return NextResponse.json({ data: v1Rows, source: "v1" });
    }

    const { startIso, endIso } = getKstBoundsIso(date);
    let shipmentHeaderQuery = supabase
      .from("cms_shipment_header")
      .select("shipment_id,customer_party_id,confirmed_at,ship_date,is_store_pickup,memo")
      .eq("status", "CONFIRMED")
      .gte("confirmed_at", startIso)
      .lt("confirmed_at", endIso)
      .order("confirmed_at", { ascending: true });

    if (partyId) {
      shipmentHeaderQuery = shipmentHeaderQuery.eq("customer_party_id", partyId);
    }

    const { data: shipmentHeaders, error: shipmentHeaderError } = await shipmentHeaderQuery;

    if (!shipmentHeaderError && Array.isArray(shipmentHeaders) && shipmentHeaders.length > 0) {
      const shipmentIds = shipmentHeaders.map((row) => String(row.shipment_id)).filter(Boolean);
      const partyIds = Array.from(
        new Set(shipmentHeaders.map((row) => String(row.customer_party_id ?? "")).filter((id) => id.length > 0))
      );

      const [{ data: shipmentLines }, { data: parties }] = await Promise.all([
        supabase
          .from("cms_shipment_line")
          .select(
            "shipment_id,shipment_line_id,repair_line_id,model_name,qty,material_code,net_weight_g,color,size,labor_total_sell_krw,material_amount_sell_krw,repair_fee_krw,total_amount_sell_krw,silver_adjust_factor"
          )
          .in("shipment_id", shipmentIds),
        partyIds.length > 0
          ? supabase.from("cms_party").select("party_id,name").in("party_id", partyIds)
          : Promise.resolve({ data: [] as Array<{ party_id: string; name: string | null }> }),
      ]);

      const partyNameById = new Map<string, string>();
      (parties ?? []).forEach((party) => {
        const id = String(party.party_id ?? "").trim();
        if (!id) return;
        partyNameById.set(id, String(party.name ?? "-").trim() || "-");
      });

      const linesByShipmentId = new Map<string, Array<Record<string, unknown>>>();
      (shipmentLines ?? []).forEach((line) => {
        const shipmentId = String((line as Record<string, unknown>).shipment_id ?? "").trim();
        if (!shipmentId) return;
        const current = linesByShipmentId.get(shipmentId) ?? [];
        current.push(line as Record<string, unknown>);
        linesByShipmentId.set(shipmentId, current);
      });

      const groupedByParty = new Map<string, LedgerStatementRow>();

      shipmentHeaders.forEach((header) => {
        const headerRow = header as Record<string, unknown>;
        const currentPartyId = String(headerRow.customer_party_id ?? "").trim();
        if (!currentPartyId) return;
        const shipmentId = String(headerRow.shipment_id ?? "").trim();
        if (!shipmentId) return;

        const lines = (linesByShipmentId.get(shipmentId) ?? []).map((line) => {
          const totalAmount = toNumber((line as Record<string, unknown>).total_amount_sell_krw);
          return {
            shipment_line_id: (line as Record<string, unknown>).shipment_line_id ?? null,
            repair_line_id: (line as Record<string, unknown>).repair_line_id ?? null,
            model_name: (line as Record<string, unknown>).model_name ?? null,
            qty: (line as Record<string, unknown>).qty ?? null,
            material_code: (line as Record<string, unknown>).material_code ?? null,
            net_weight_g: (line as Record<string, unknown>).net_weight_g ?? null,
            color: (line as Record<string, unknown>).color ?? null,
            size: (line as Record<string, unknown>).size ?? null,
            labor_total_sell_krw: (line as Record<string, unknown>).labor_total_sell_krw ?? null,
            material_amount_sell_krw: (line as Record<string, unknown>).material_amount_sell_krw ?? null,
            repair_fee_krw: (line as Record<string, unknown>).repair_fee_krw ?? null,
            total_amount_sell_krw: (line as Record<string, unknown>).total_amount_sell_krw ?? null,
            silver_adjust_factor: (line as Record<string, unknown>).silver_adjust_factor ?? null,
            amount_krw: totalAmount,
          };
        });

        const shipmentAmount = lines.reduce((sum, line) => sum + toNumber((line as Record<string, unknown>).amount_krw), 0);
        const shipmentLabor = lines.reduce(
          (sum, line) => sum + toNumber((line as Record<string, unknown>).labor_total_sell_krw),
          0
        );

        const shipmentJson = {
          shipment_id: shipmentId,
          ledger_occurred_at: headerRow.confirmed_at ?? null,
          ledger_amount_krw: shipmentAmount,
          ledger_memo: headerRow.memo ?? null,
          ship_date: headerRow.ship_date ?? null,
          confirmed_at: headerRow.confirmed_at ?? null,
          is_store_pickup: headerRow.is_store_pickup ?? null,
          memo: headerRow.memo ?? null,
          customer_party_id: currentPartyId,
          customer_name: partyNameById.get(currentPartyId) ?? "-",
          lines_raw_sum_krw: shipmentAmount,
          lines_allocated_sum_krw: shipmentAmount,
          lines,
          lines_vs_ledger_diff_krw: 0,
        };

        const existing = groupedByParty.get(currentPartyId);
        if (!existing) {
          groupedByParty.set(currentPartyId, {
            party_id: currentPartyId,
            party_name: partyNameById.get(currentPartyId) ?? "-",
            kst_date: date,
            prev_position: {
              balance_krw: 0,
              labor_cash_outstanding_krw: 0,
              gold_outstanding_g: 0,
              silver_outstanding_g: 0,
            },
            day_ledger_totals: {
              delta_total_krw: shipmentAmount,
              delta_shipment_krw: shipmentAmount,
              delta_return_krw: 0,
              delta_payment_krw: 0,
              delta_adjust_krw: 0,
              delta_offset_krw: 0,
            },
            day_breakdown: {
              shipment: { krw: shipmentAmount, labor_krw: shipmentLabor, gold_g: 0, silver_g: 0 },
              return: { krw: 0, labor_krw: 0, gold_g: 0, silver_g: 0 },
              payment: { krw: 0, labor_krw: 0, gold_g: 0, silver_g: 0 },
              adjust: { krw: 0, labor_krw: 0, gold_g: 0, silver_g: 0 },
              offset: { krw: 0, labor_krw: 0, gold_g: 0, silver_g: 0 },
              other: { krw: 0, labor_krw: 0, gold_g: 0, silver_g: 0 },
            },
            end_position: {
              balance_krw: shipmentAmount,
              labor_cash_outstanding_krw: shipmentLabor,
              gold_outstanding_g: 0,
              silver_outstanding_g: 0,
            },
            details: {
              shipments: [shipmentJson],
              returns: [],
              payments: [],
              adjusts: [],
              offsets: [],
            },
            checks: {
              check_end_equals_prev_plus_delta_krw: 0,
              check_ship_lines_equals_ledger_shipment_krw: 0,
              check_return_sum_equals_ledger_return_krw: 0,
            },
          });
          return;
        }

        const nextShipments = [...(existing.details.shipments ?? []), shipmentJson];
        const nextDeltaShipment = toNumber(existing.day_ledger_totals.delta_shipment_krw) + shipmentAmount;
        const nextDeltaTotal = toNumber(existing.day_ledger_totals.delta_total_krw) + shipmentAmount;
        const nextLabor = toNumber(existing.end_position.labor_cash_outstanding_krw) + shipmentLabor;

        groupedByParty.set(currentPartyId, {
          ...existing,
          day_ledger_totals: {
            ...existing.day_ledger_totals,
            delta_total_krw: nextDeltaTotal,
            delta_shipment_krw: nextDeltaShipment,
          },
          day_breakdown: {
            ...(existing.day_breakdown ?? {}),
            shipment: {
              krw: nextDeltaShipment,
              labor_krw: nextLabor,
              gold_g: 0,
              silver_g: 0,
            },
          },
          end_position: {
            ...existing.end_position,
            balance_krw: nextDeltaTotal,
            labor_cash_outstanding_krw: nextLabor,
          },
          details: {
            ...existing.details,
            shipments: nextShipments,
          },
        });
      });

      const fallbackRows = Array.from(groupedByParty.values()).sort((a, b) =>
        (a.party_name ?? "").localeCompare(b.party_name ?? "", "ko-KR")
      );
      if (fallbackRows.length > 0) {
        return NextResponse.json({ data: fallbackRows, source: "shipment_fallback" });
      }
    }

    if (!error || !v2Error || !legacyError) {
      return NextResponse.json({ data: [], source: "empty" });
    }

    const v3Message = `${error.message ?? "v3 실패"}${error.code ? ` (code=${error.code})` : ""}`;
    const v2Message = `${v2Error.message ?? "v2 실패"}${v2Error.code ? ` (code=${v2Error.code})` : ""}`;
    const v1Message = `${legacyError.message ?? "v1 실패"}${legacyError.code ? ` (code=${legacyError.code})` : ""}`;
    return NextResponse.json({ error: `원장 명세 조회 실패: v3=${v3Message} | v2=${v2Message} | v1=${v1Message}` }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "원장 명세 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
