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

    if (!error) {
      return NextResponse.json({ data: data ?? [], source: "v3" });
    }

    const v2Rpc = supabase.rpc as unknown as (
      fn: string,
      args: { p_party_ids: string[] | null; p_kst_date: string }
    ) => Promise<{ data: LedgerStatementRow[] | null; error: { message?: string; code?: string } | null }>;

    const { data: v2Data, error: v2Error } = await v2Rpc("cms_fn_shipments_print_ledger_statement_v2", {
      p_party_ids: partyId ? [partyId] : null,
      p_kst_date: date,
    });

    if (!v2Error) {
      return NextResponse.json({ data: v2Data ?? [], source: "v2" });
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

    if (!legacyError) {
      return NextResponse.json({ data: (legacyData ?? []).map(normalizeLegacyRow) });
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
