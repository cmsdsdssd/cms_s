"use client";

import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import {
  ReceiptPrintHalf,
  type ReceiptAmounts,
  type ReceiptLineItem,
} from "@/components/receipt/receipt-print";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Amounts = ReceiptAmounts;

type ReceiptLine = ReceiptLineItem & {
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
    is_store_pickup?: boolean | null;
    customer?: { name?: string | null } | null;
  } | null;
};

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
  };
  end_position: {
    balance_krw: number;
    labor_cash_outstanding_krw: number;
    gold_outstanding_g: number;
    silver_outstanding_g: number;
  };
  details: {
    shipments: Array<{
      ar_ledger_id: string;
      shipment_id: string;
      ledger_occurred_at: string;
      customer_name?: string | null;
      ship_date?: string | null;
      confirmed_at?: string | null;
      is_store_pickup?: boolean | null;
      lines: Array<{
        shipment_line_id?: string | null;
        repair_line_id?: string | null;
        model_name?: string | null;
        qty?: number | null;
        material_code?: string | null;
        net_weight_g?: number | null;
        color?: string | null;
        size?: string | null;
        labor_total_sell_krw?: number | null;
        material_amount_sell_krw?: number | null;
        repair_fee_krw?: number | null;
        amount_krw: number;
        synthetic?: boolean;
      }>;
    }>;
    returns: Array<{
      ar_ledger_id: string;
      return_line_id: string;
      ledger_occurred_at: string;
      amount_krw: number;
      return_qty?: number | null;
      model_name?: string | null;
      material_code?: string | null;
      net_weight_g?: number | null;
      color?: string | null;
      size?: string | null;
      qty?: number | null;
      total_amount_sell_krw?: number | null;
      labor_total_sell_krw?: number | null;
      material_amount_sell_krw?: number | null;
    }>;
    payments?: Array<{
      payment_id?: string | null;
      paid_at?: string | null;
      ledger_occurred_at?: string | null;
      cash_krw?: number | null;
      alloc_gold_g?: number | null;
      alloc_silver_g?: number | null;
      alloc_labor_krw?: number | null;
      ledger_amount_krw?: number | null;
      ledger_memo?: string | null;
      note?: string | null;
    }>;
  };
  checks: {
    check_end_equals_prev_plus_delta_krw: number;
    check_ship_lines_equals_ledger_shipment_krw: number;
    check_return_sum_equals_ledger_return_krw: number;
  };
};

type LegacyLedgerStatementRow = {
  party_id: string;
  kst_date: string;
  prev_position?: Record<string, unknown> | null;
  day_ledger_totals?: Record<string, unknown> | null;
  end_position?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

type PartyGroup = {
  partyId: string;
  partyName: string;
  statement: LedgerStatementRow;
  lines: ReceiptLine[];
};

type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ReceiptLine[];
  totals: Amounts;
  previous: Amounts;
  sales: Amounts;
  dayPayment: Amounts;
};

const zeroAmounts: Amounts = { gold: 0, silver: 0, labor: 0, total: 0 };

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const isValidYmd = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

const getKstStartIso = (ymd: string) => `${ymd}T00:00:00+09:00`;

const getKstNextStartIso = (ymd: string) => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
};

const toKstPrintTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(value)
    .replace(" ", "-");

const normalizePrintedAt = (raw: string) => {
  const text = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return toKstPrintTimestamp(parsed);
};

const shiftYmd = (ymd: string, delta: number) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(new Date(`${ymd}T00:00:00+09:00`).getTime() + delta * 86400000));

const chunkLines = (lines: ReceiptLine[], size: number) => {
  const chunks: ReceiptLine[][] = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
};

const buildSummaryRows = (page: PartyReceiptPage) => [
  { label: "당일결제", value: page.dayPayment },
  { label: "이전 미수", value: page.previous },
  { label: "판매", value: page.sales },
  { label: "합계", value: page.totals },
];

const isPartyPass = (checks: LedgerStatementRow["checks"]) =>
  checks.check_end_equals_prev_plus_delta_krw === 0 &&
  checks.check_ship_lines_equals_ledger_shipment_krw === 0 &&
  checks.check_return_sum_equals_ledger_return_krw === 0;

const toMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

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

const addAmounts = (a: Amounts, b: Amounts): Amounts => ({
  gold: a.gold + b.gold,
  silver: a.silver + b.silver,
  labor: a.labor + b.labor,
  total: a.total + b.total,
});

const materialBucket = (materialCode?: string | null) => {
  const code = (materialCode ?? "").trim();
  if (!code || code === "00") return { kind: "none" as const, factor: 0 };
  if (code === "14") return { kind: "gold" as const, factor: 0.6435 };
  if (code === "18") return { kind: "gold" as const, factor: 0.825 };
  if (code === "24") return { kind: "gold" as const, factor: 1 };
  if (code === "925") return { kind: "silver" as const, factor: 0.925 };
  if (code === "999") return { kind: "silver" as const, factor: 1 };
  return { kind: "none" as const, factor: 0 };
};

const toShipmentLineAmounts = (line: {
  material_code?: string | null;
  net_weight_g?: number | null;
  labor_total_sell_krw?: number | null;
  repair_fee_krw?: number | null;
  material_amount_sell_krw?: number | null;
  repair_line_id?: string | null;
  amount_krw?: number | null;
}): Amounts => {
  const bucket = materialBucket(line.material_code ?? null);
  const weight = Number(line.net_weight_g ?? 0);
  const isRepair = Boolean(line.repair_line_id);
  const repairLabor =
    line.repair_fee_krw !== null && line.repair_fee_krw !== undefined
      ? Number(line.repair_fee_krw)
      : Number(line.labor_total_sell_krw ?? 0);
  const labor = isRepair ? repairLabor : Number(line.labor_total_sell_krw ?? 0);

  if (isRepair && Number(line.material_amount_sell_krw ?? 0) <= 0) {
    return { gold: 0, silver: 0, labor, total: Number(line.amount_krw ?? 0) };
  }

  const pureWeight = weight * bucket.factor;
  return {
    gold: bucket.kind === "gold" ? pureWeight : 0,
    silver: bucket.kind === "silver" ? pureWeight : 0,
    labor,
    total: Number(line.amount_krw ?? 0),
  };
};

const normalizeLegacyRow = (row: LegacyLedgerStatementRow): LedgerStatementRow => {
  const prev = toObject(row.prev_position);
  const day = toObject(row.day_ledger_totals);
  const end = toObject(row.end_position);
  const details = toObject(row.details);

  const inferPartyName = () => {
    for (const shipment of toArray(details.shipments)) {
      const name = toObject(shipment).customer_name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
    return "-";
  };

  const shipmentLinesSum = toArray(details.shipments).reduce((partySum, shipment) => {
    return (
      partySum +
      toArray(toObject(shipment).lines).reduce(
        (lineSum, line) => lineSum + toNumber(toObject(line).amount_krw),
        0
      )
    );
  }, 0);
  const returnSum = toArray(details.returns).reduce(
    (sum, ret) => sum + toNumber(toObject(ret).amount_krw),
    0
  );

  return {
    party_id: row.party_id,
    party_name: inferPartyName(),
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
        delta_payment_krw: toNumber(day.delta_payment_krw),
      },
    end_position: {
      balance_krw: toNumber(end.balance_krw),
      labor_cash_outstanding_krw: toNumber(end.labor_cash_outstanding_krw),
      gold_outstanding_g: toNumber(end.gold_outstanding_g),
      silver_outstanding_g: toNumber(end.silver_outstanding_g),
    },
    details: {
      shipments: toArray(details.shipments) as LedgerStatementRow["details"]["shipments"],
      returns: toArray(details.returns) as LedgerStatementRow["details"]["returns"],
      payments: toArray(details.payments) as LedgerStatementRow["details"]["payments"],
    },
    checks: {
      check_end_equals_prev_plus_delta_krw:
        toNumber(end.balance_krw) - (toNumber(prev.balance_krw) + toNumber(day.delta_total_krw)),
      check_ship_lines_equals_ledger_shipment_krw: shipmentLinesSum - toNumber(day.delta_shipment_krw),
      check_return_sum_equals_ledger_return_krw: returnSum - toNumber(day.delta_return_krw),
    },
  };
};

function ShipmentsPrintContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterPartyId = (searchParams.get("party_id") ?? "").trim();
  const dateParam = (searchParams.get("date") ?? "").trim();
  const printedAtParam = (searchParams.get("printed_at") ?? "").trim();

  const today = useMemo(() => (isValidYmd(dateParam) ? dateParam : getKstYmd()), [dateParam]);
  const printedAtLabel = useMemo(() => {
    const normalized = normalizePrintedAt(printedAtParam);
    if (normalized) return normalized;
    return `${today}-00:00:00`;
  }, [printedAtParam, today]);

  const activePartyId = filterPartyId || null;
  const dayStartIso = useMemo(() => getKstStartIso(today), [today]);
  const dayEndIso = useMemo(() => getKstNextStartIso(today), [today]);

  const updateQuery = useCallback(
    (next: { date?: string; partyId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.date) {
        params.set("date", next.date);
      }
      if (next.partyId) {
        params.set("party_id", next.partyId);
      } else if (next.partyId === null) {
        params.delete("party_id");
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const statementQuery = useQuery({
    queryKey: ["shipments-print-ledger-statement-v2", today, filterPartyId],
    queryFn: async () => {
      const sortRows = (rows: LedgerStatementRow[]) =>
        [...rows].sort((a, b) => (a.party_name ?? "").localeCompare(b.party_name ?? "", "ko-KR"));

      try {
        const params = new URLSearchParams({ date: today });
        if (filterPartyId) params.set("party_id", filterPartyId);
        const supabase = getSupabaseClient();
        const token = supabase
          ? ((await supabase.auth.getSession()).data.session?.access_token ?? "")
          : "";
        const response = await fetch(`/api/shipments-print-ledger-statement?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          headers: token ? { "x-supabase-access-token": token } : undefined,
        });
        let payload: { data?: LedgerStatementRow[]; error?: string } | null = null;
        try {
          payload = (await response.json()) as { data?: LedgerStatementRow[]; error?: string };
        } catch {
          payload = null;
        }
        if (!response.ok) {
          throw new Error(payload?.error || `원장 명세 조회 실패 (${response.status})`);
        }
        if (payload?.error) throw new Error(payload.error);
        return sortRows(payload?.data ?? []);
      } catch (apiError) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          throw new Error(`원장 명세 조회 실패: api=${toMessage(apiError)} (Supabase public env missing)`);
        }

        const supabase = getSupabaseClient();
        const token = supabase
          ? ((await supabase.auth.getSession()).data.session?.access_token ?? SUPABASE_ANON_KEY)
          : SUPABASE_ANON_KEY;

        const callRpc = async <T,>(fn: "cms_fn_shipments_print_ledger_statement_v2" | "cms_fn_shipments_print_ledger_statement_v1") => {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "Accept-Profile": "public",
              "Content-Profile": "public",
            },
            body: JSON.stringify({
              p_party_ids: filterPartyId ? [filterPartyId] : null,
              p_kst_date: today,
            }),
          });
          let payload: T | null = null;
          let text = "";
          try {
            payload = (await response.json()) as T;
          } catch {
            text = await response.text();
          }
          if (!response.ok) {
            throw new Error(text || `rpc ${fn} failed (${response.status})`);
          }
          return payload;
        };

        try {
          const v2Rows = (await callRpc<LedgerStatementRow[]>("cms_fn_shipments_print_ledger_statement_v2")) ?? [];
          return sortRows(v2Rows);
        } catch (v2Err) {
          try {
            const v1Rows = (await callRpc<LegacyLedgerStatementRow[]>("cms_fn_shipments_print_ledger_statement_v1")) ?? [];
            return sortRows(v1Rows.map(normalizeLegacyRow));
          } catch (v1Err) {
            throw new Error(`원장 명세 조회 실패: api=${toMessage(apiError)} | rest-v2=${toMessage(v2Err)} | rest-v1=${toMessage(v1Err)}`);
          }
        }
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: true,
  });

  const partyGroups = useMemo<PartyGroup[]>(() => {
    return (statementQuery.data ?? []).map((statement) => {
      const shipmentLines: ReceiptLine[] = (statement.details?.shipments ?? []).flatMap((shipment, shipmentIndex) => {
        return (shipment.lines ?? []).map((line, lineIndex) => ({
          shipment_line_id:
            line.shipment_line_id ?? `synthetic-shipment-${statement.party_id}-${shipmentIndex}-${lineIndex}`,
          model_name: line.model_name ?? null,
          qty: line.qty ?? null,
          material_code: line.material_code ?? null,
          net_weight_g: line.net_weight_g ?? null,
          color: line.color ?? null,
          size: line.size ?? null,
          labor_total_sell_krw: line.labor_total_sell_krw ?? null,
          material_amount_sell_krw: line.material_amount_sell_krw ?? null,
          repair_fee_krw: line.repair_fee_krw ?? null,
          total_amount_sell_krw: Number(line.amount_krw ?? 0),
          is_return: false,
          is_repair: Boolean(line.repair_line_id),
          shipment_header: {
            ship_date: shipment.ship_date ?? shipment.confirmed_at ?? null,
            status: "CONFIRMED",
            customer_party_id: statement.party_id,
            is_store_pickup: shipment.is_store_pickup ?? null,
            customer: { name: statement.party_name ?? shipment.customer_name ?? "-" },
          },
        }));
      });

      const returnLines: ReceiptLine[] = (statement.details?.returns ?? []).map((ret, returnIndex) => ({
        shipment_line_id: ret.return_line_id || `return-${statement.party_id}-${returnIndex}`,
        model_name: ret.model_name ?? null,
        qty: ret.return_qty ?? ret.qty ?? null,
        material_code: ret.material_code ?? null,
        net_weight_g: ret.net_weight_g ?? null,
        color: ret.color ?? null,
        size: ret.size ?? null,
        labor_total_sell_krw: ret.labor_total_sell_krw ?? null,
        material_amount_sell_krw: ret.material_amount_sell_krw ?? null,
        repair_fee_krw: null,
        total_amount_sell_krw: Number(ret.amount_krw ?? 0),
        is_return: true,
        is_repair: false,
        shipment_header: {
          ship_date: null,
          status: "RETURNED",
          customer_party_id: statement.party_id,
          is_store_pickup: null,
          customer: { name: statement.party_name ?? "-" },
        },
      }));

      return {
        partyId: statement.party_id,
        partyName: statement.party_name ?? "-",
        statement,
        lines: [...shipmentLines, ...returnLines],
      };
    });
  }, [statementQuery.data]);

  const paymentFallbackQuery = useQuery({
    queryKey: ["shipments-print-payment-fallback", today, filterPartyId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return [] as Array<{ party_id: string; payment_id: string; occurred_at: string; amount_krw: number }>;
      let query = supabase
        .from("cms_ar_ledger")
        .select("party_id,payment_id,occurred_at,amount_krw")
        .eq("entry_type", "PAYMENT")
        .gte("occurred_at", dayStartIso)
        .lt("occurred_at", dayEndIso)
        .order("occurred_at", { ascending: false });
      if (filterPartyId) {
        query = query.eq("party_id", filterPartyId);
      }
      const { data, error } = await query;
      if (error) return [];
      return (data ?? []) as Array<{ party_id: string; payment_id: string; occurred_at: string; amount_krw: number }>;
    },
    enabled: true,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const paymentFallbackByParty = useMemo(() => {
    const map = new Map<string, Array<LedgerStatementRow["details"]["payments"] extends Array<infer T> ? T : never>>();
    (paymentFallbackQuery.data ?? []).forEach((row) => {
      const partyId = (row.party_id ?? "").toString();
      if (!partyId) return;
      const current = map.get(partyId) ?? [];
      current.push({
        payment_id: row.payment_id,
        paid_at: row.occurred_at,
        ledger_occurred_at: row.occurred_at,
        cash_krw: -Number(row.amount_krw ?? 0),
        alloc_gold_g: 0,
        alloc_silver_g: 0,
        alloc_labor_krw: 0,
        ledger_amount_krw: Number(row.amount_krw ?? 0),
        ledger_memo: null,
        note: null,
      });
      map.set(partyId, current);
    });
    return map;
  }, [paymentFallbackQuery.data]);

  const getPartyPayments = useCallback(
    (group: PartyGroup) => {
      const statementPayments = group.statement.details.payments ?? [];
      if (statementPayments.length > 0) return statementPayments;
      return paymentFallbackByParty.get(group.partyId) ?? [];
    },
    [paymentFallbackByParty]
  );

  const receiptPages = useMemo<PartyReceiptPage[]>(() => {
    const pages: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const prev = group.statement.prev_position;
      const end = group.statement.end_position;
      const day = group.statement.day_ledger_totals;

      const partyPayments = getPartyPayments(group);
      const shipmentSales = (group.statement.details.shipments ?? []).reduce<Amounts>(
        (sum, shipment) => {
          const shipmentSum = (shipment.lines ?? []).reduce<Amounts>(
            (lineSum, line) => addAmounts(lineSum, toShipmentLineAmounts(line)),
            { ...zeroAmounts }
          );
          return addAmounts(sum, shipmentSum);
        },
        { ...zeroAmounts }
      );

      const paymentAmounts = partyPayments.reduce<Amounts>(
        (sum, payment) => ({
          gold: sum.gold + Number(payment.alloc_gold_g ?? 0),
          silver: sum.silver + Number(payment.alloc_silver_g ?? 0),
          labor: sum.labor + Number(payment.alloc_labor_krw ?? 0),
          total:
            sum.total +
            Number(
              payment.cash_krw ??
                (payment.ledger_amount_krw !== null && payment.ledger_amount_krw !== undefined
                  ? -payment.ledger_amount_krw
                  : 0)
            ),
        }),
        { ...zeroAmounts }
      );

      const pageTemplate: Omit<PartyReceiptPage, "lines"> = {
        partyId: group.partyId,
        partyName: group.partyName,
        dayPayment: {
          gold: paymentAmounts.gold,
          silver: paymentAmounts.silver,
          labor: paymentAmounts.labor,
          total: -Number(day.delta_payment_krw ?? paymentAmounts.total),
        },
        totals: {
          gold: Number(end.gold_outstanding_g ?? 0),
          silver: Number(end.silver_outstanding_g ?? 0),
          labor: Number(end.labor_cash_outstanding_krw ?? 0),
          total: Number(end.balance_krw ?? 0),
        },
        previous: {
          gold: Number(prev.gold_outstanding_g ?? 0),
          silver: Number(prev.silver_outstanding_g ?? 0),
          labor: Number(prev.labor_cash_outstanding_krw ?? 0),
          total: Number(prev.balance_krw ?? 0),
        },
        sales: {
          gold: shipmentSales.gold,
          silver: shipmentSales.silver,
          labor: shipmentSales.labor,
          total: Number(day.delta_shipment_krw ?? shipmentSales.total),
        },
      };

      chunkLines(group.lines, 15).forEach((chunk) => {
        pages.push({
          ...pageTemplate,
          lines: chunk,
        });
      });
    });

    if (pages.length === 0) {
      pages.push({
        partyId: "empty",
        partyName: "-",
        lines: [],
        totals: { ...zeroAmounts },
        previous: { ...zeroAmounts },
        sales: { ...zeroAmounts },
        dayPayment: { ...zeroAmounts },
      });
    }

    return pages;
  }, [getPartyPayments, partyGroups]);

  const pageChecks = useMemo(
    () =>
      partyGroups.map((group) => ({
        partyId: group.partyId,
        partyName: group.partyName,
        checks: group.statement.checks,
        pass: isPartyPass(group.statement.checks),
      })),
    [partyGroups]
  );

  const isPagePass = useMemo(() => pageChecks.every((row) => row.pass), [pageChecks]);

  const visiblePages = useMemo(() => {
    if (!activePartyId) return receiptPages;
    return receiptPages.filter((page) => page.partyId === activePartyId);
  }, [activePartyId, receiptPages]);

  const visiblePartyGroups = useMemo(() => {
    if (!activePartyId) return partyGroups;
    return partyGroups.filter((group) => group.partyId === activePartyId);
  }, [activePartyId, partyGroups]);

  const totalLineCount = useMemo(
    () => partyGroups.reduce((sum, group) => sum + group.lines.length, 0),
    [partyGroups]
  );

  const totalLineAmountKrw = useMemo(
    () =>
      partyGroups.reduce(
        (sum, group) =>
          sum + group.lines.reduce((lineSum, line) => lineSum + Number(line.total_amount_sell_krw ?? 0), 0),
        0
      ),
    [partyGroups]
  );

  const dayPaymentByParty = useMemo(
    () =>
      partyGroups.map((group) => {
        const partyPayments = getPartyPayments(group);
        return {
          partyId: group.partyId,
          amount: -Number(group.statement.day_ledger_totals.delta_payment_krw ?? 0),
          paymentCount: partyPayments.length,
        };
      }),
    [getPartyPayments, partyGroups]
  );

  const dayPaymentOverall = useMemo(
    () =>
      partyGroups.reduce(
        (sum, group) => sum - Number(group.statement.day_ledger_totals.delta_payment_krw ?? 0),
        0
      ),
    [partyGroups]
  );

  const dayPaymentByPartyMap = useMemo(
    () => new Map(dayPaymentByParty.map((row) => [row.partyId, row])),
    [dayPaymentByParty]
  );

  const isLoading = statementQuery.isLoading;
  const errorMessage = statementQuery.error ? toMessage(statementQuery.error) : "";

  const canPrint = isPagePass && !isLoading && visiblePages.length > 0 && visiblePages[0]?.partyId !== "empty";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions no-print px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="출고 영수증(원장 기준)"
          subtitle={`기준일: ${today} · 원장 정합 ${isPagePass ? "PASS" : "FAIL"}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(today, -1) })}>
                  ◀
                </Button>
                <Input
                  type="date"
                  value={today}
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    if (!isValidYmd(next)) return;
                    updateQuery({ date: next });
                  }}
                  className="h-8 w-[140px]"
                />
                <Button variant="secondary" onClick={() => updateQuery({ date: shiftYmd(today, 1) })}>
                  ▶
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    statementQuery.refetch();
                  }}
                >
                  새로고침
                </Button>
                <Button variant="primary" onClick={() => canPrint && window.print()} disabled={!canPrint}>
                  영수증 출력
                </Button>
              </div>
            </div>
          }
        />
      </div>

      <div className="shipments-print-stage px-6 py-6 space-y-6">
        <Card className="no-print border-[var(--panel-border)]">
          <CardBody className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--muted)]">원장 정합 상태</div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  isPagePass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}
              >
                {isPagePass ? "PASS" : "FAIL"}
              </span>
            </div>

            {!isPagePass && pageChecks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--panel-border)]">
                      <th className="py-2 text-left">거래처</th>
                      <th className="py-2 text-right tabular-nums">end-prev-delta</th>
                      <th className="py-2 text-right tabular-nums">ship-lines-ledger</th>
                      <th className="py-2 text-right tabular-nums">return-sum-ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageChecks.map((row) => (
                      <tr key={row.partyId} className="border-b border-[var(--panel-border)]">
                        <td className={cn("py-2", row.pass ? "text-muted-foreground" : "text-rose-700 font-semibold")}>{row.partyName}</td>
                        <td className="py-2 text-right tabular-nums">{formatKrw(row.checks.check_end_equals_prev_plus_delta_krw)}</td>
                        <td className="py-2 text-right tabular-nums">{formatKrw(row.checks.check_ship_lines_equals_ledger_shipment_krw)}</td>
                        <td className="py-2 text-right tabular-nums">{formatKrw(row.checks.check_return_sum_equals_ledger_return_krw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {isLoading ? (
          <Card className="no-print border-[var(--panel-border)]">
            <CardBody className="p-6 text-sm text-[var(--muted)]">로딩 중...</CardBody>
          </Card>
        ) : errorMessage ? (
          <Card className="no-print border-[var(--panel-border)]">
            <CardBody className="p-6 text-sm text-[var(--danger)]">오류: {errorMessage}</CardBody>
          </Card>
        ) : partyGroups.length === 0 ? (
          <Card className="no-print border-[var(--panel-border)]">
            <CardBody className="p-6 text-sm text-[var(--muted)]">결과 없음</CardBody>
          </Card>
        ) : (
          <>
            <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-[var(--panel-border)]">
                <CardBody className="p-4">
                  <div className="text-xs text-[var(--muted)]">라인 수(amount_krw 기반)</div>
                  <div className="text-xl font-semibold tabular-nums">{totalLineCount}</div>
                </CardBody>
              </Card>
              <Card className="border-[var(--panel-border)]">
                <CardBody className="p-4">
                  <div className="text-xs text-[var(--muted)]">라인 합계(amount_krw)</div>
                  <div className="text-xl font-semibold tabular-nums">{formatKrw(totalLineAmountKrw)}</div>
                </CardBody>
              </Card>
              <Card className="border-[var(--panel-border)]">
                <CardBody className="p-4">
                  <div className="text-xs text-[var(--muted)]">당일 결제 합계(원장 SOT)</div>
                  <div className="text-xl font-semibold tabular-nums">{formatKrw(dayPaymentOverall)}</div>
                </CardBody>
              </Card>
            </div>

            <div className="no-print shipments-print-main grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
              <Card className="border-[var(--panel-border)] h-fit">
                <CardHeader className="border-b border-[var(--panel-border)] py-3">
                  <div className="text-sm font-semibold">거래처 선택</div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[var(--panel-border)]">
                    <button
                      type="button"
                      onClick={() => updateQuery({ partyId: null })}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors",
                        activePartyId ? "hover:bg-[var(--panel-hover)]" : "bg-[var(--panel-hover)]"
                      )}
                    >
                      <div className="text-sm font-semibold">전체 보기</div>
                      <div className="text-xs text-[var(--muted)] tabular-nums">{partyGroups.length} 거래처</div>
                    </button>
                    {partyGroups.map((group) => {
                      const isActive = group.partyId === activePartyId;
                      const partyPass = isPartyPass(group.statement.checks);
                      const dayPayment = dayPaymentByPartyMap.get(group.partyId) ?? null;
                      return (
                        <button
                          key={group.partyId}
                          type="button"
                          onClick={() => updateQuery({ partyId: group.partyId })}
                          className={cn(
                            "w-full text-left px-4 py-3 transition-colors",
                            isActive ? "bg-[var(--panel-hover)]" : "hover:bg-[var(--panel-hover)]"
                          )}
                        >
                          <div className="text-sm font-semibold truncate">{group.partyName}</div>
                          <div className="text-xs text-[var(--muted)] tabular-nums">
                            {group.lines.length}건 · {partyPass ? "PASS" : "FAIL"}
                          </div>
                          <div className="text-[11px] text-[var(--muted)] tabular-nums mt-1">
                            당일결제: {formatKrw(dayPayment?.amount ?? 0)} · {dayPayment?.paymentCount ?? 0}건
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              {!isPagePass && (
                <div className="space-y-4">
                  {visiblePartyGroups.filter((group) => !isPartyPass(group.statement.checks)).map((group) => {
                  const shipmentRefs = (group.statement.details.shipments ?? []).map((shipment) => ({
                    arLedgerId: shipment.ar_ledger_id,
                    shipmentId: shipment.shipment_id,
                    occurredAt: shipment.ledger_occurred_at,
                  }));
                  const returnRefs = (group.statement.details.returns ?? []).map((ret) => ({
                    arLedgerId: ret.ar_ledger_id,
                    returnLineId: ret.return_line_id,
                    occurredAt: ret.ledger_occurred_at,
                  }));

                    return (
                      <Card key={group.partyId} className="border-[var(--panel-border)]">
                      <CardHeader className="border-b border-[var(--panel-border)] py-3">
                        <div className="text-sm font-semibold">Debug Panel · {group.partyName}</div>
                        <div className="text-xs text-[var(--muted)]">
                          checks: {formatKrw(group.statement.checks.check_end_equals_prev_plus_delta_krw)} /{" "}
                          {formatKrw(group.statement.checks.check_ship_lines_equals_ledger_shipment_krw)} /{" "}
                          {formatKrw(group.statement.checks.check_return_sum_equals_ledger_return_krw)}
                        </div>
                      </CardHeader>
                      <CardBody className="p-4">
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">shipment_id / ar_ledger_id 보기</summary>
                          <div className="mt-3 space-y-2 text-xs">
                            {shipmentRefs.length === 0 ? (
                              <div className="text-[var(--muted)]">shipment 참조 없음</div>
                            ) : (
                              shipmentRefs.map((ref) => (
                                <div key={`${ref.arLedgerId}-${ref.shipmentId}`} className="tabular-nums">
                                  shipment_id={ref.shipmentId} · ar_ledger_id={ref.arLedgerId} · occurred_at={ref.occurredAt}
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium">return_line_id / ar_ledger_id 보기</summary>
                          <div className="mt-3 space-y-2 text-xs">
                            {returnRefs.length === 0 ? (
                              <div className="text-[var(--muted)]">return 참조 없음</div>
                            ) : (
                              returnRefs.map((ref) => (
                                <div key={`${ref.arLedgerId}-${ref.returnLineId}`} className="tabular-nums">
                                  return_line_id={ref.returnLineId} · ar_ledger_id={ref.arLedgerId} · occurred_at={ref.occurredAt}
                                </div>
                              ))
                            )}
                          </div>
                        </details>
                      </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}

              <div className="space-y-4">
                {visiblePartyGroups.map((group) => {
                  const payments = getPartyPayments(group)
                    .slice()
                    .sort(
                    (a, b) =>
                      new Date(b.paid_at ?? b.ledger_occurred_at ?? 0).getTime() -
                      new Date(a.paid_at ?? a.ledger_occurred_at ?? 0).getTime()
                  );
                  return (
                    <Card key={`payments-${group.partyId}`} className="border-[var(--panel-border)]">
                      <CardHeader className="border-b border-[var(--panel-border)] py-3">
                        <div className="text-sm font-semibold">당일결제 내역(원장 SOT) · {group.partyName}</div>
                        <div className="text-xs text-[var(--muted)] tabular-nums">합계 {formatKrw(payments.reduce((sum, payment) => {
                          const amount =
                            payment.cash_krw !== null && payment.cash_krw !== undefined
                              ? Number(payment.cash_krw)
                              : payment.ledger_amount_krw !== null && payment.ledger_amount_krw !== undefined
                                ? -Number(payment.ledger_amount_krw)
                                : 0;
                          return sum + amount;
                        }, 0))} · {payments.length}건</div>
                      </CardHeader>
                      <CardBody className="p-4">
                        {payments.length === 0 ? (
                          <div className="text-xs text-[var(--muted)]">당일 결제 내역 없음</div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            {payments.map((payment, index) => {
                              const amount =
                                payment.cash_krw !== null && payment.cash_krw !== undefined
                                  ? Number(payment.cash_krw)
                                  : payment.ledger_amount_krw !== null && payment.ledger_amount_krw !== undefined
                                    ? -Number(payment.ledger_amount_krw)
                                    : 0;
                              return (
                                <div
                                  key={`${payment.payment_id ?? "payment"}-${payment.ledger_occurred_at ?? index}`}
                                  className="flex items-center justify-between gap-4 tabular-nums"
                                >
                                  <div className="truncate">
                                    {formatDateTimeKst(payment.paid_at ?? payment.ledger_occurred_at)} · {payment.payment_id ?? "-"}
                                  </div>
                                  <div className="font-semibold">{formatKrw(amount)}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="receipt-print-root shipments-print-root print-only space-y-6">
              {canPrint ? (
                visiblePages.map((page, index) => (
                  <div
                    key={`${page.partyId}-${index}`}
                    className={cn(
                      "receipt-print-page print-sheet shipments-print-sheet mx-auto bg-white p-[10mm] text-black shadow-sm",
                      "border border-neutral-200"
                    )}
                    style={{ width: "297mm", height: "210mm" }}
                  >
                    <div className="grid h-full grid-cols-2 gap-4">
                      <div className="h-full border-r border-dashed border-neutral-300 pr-4">
                        <ReceiptPrintHalf
                          partyName={page.partyName}
                          dateLabel={printedAtLabel}
                          lines={page.lines}
                          summaryRows={buildSummaryRows(page)}
                        />
                      </div>
                      <div className="h-full pl-4">
                        <ReceiptPrintHalf
                          partyName={page.partyName}
                          dateLabel={printedAtLabel}
                          lines={page.lines}
                          summaryRows={buildSummaryRows(page)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className={cn(
                    "receipt-print-page print-sheet shipments-print-sheet mx-auto bg-white p-[16mm] text-black",
                    "border border-neutral-200"
                  )}
                  style={{ width: "297mm", height: "210mm" }}
                >
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <div className="text-2xl font-semibold text-rose-700">PRINT BLOCKED</div>
                      <div className="mt-3 text-sm">원장 정합 checks가 FAIL 상태라 출력이 차단되었습니다.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ShipmentsPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--muted)]">
          Loading...
        </div>
      }
    >
      <ShipmentsPrintContent />
    </Suspense>
  );
}
