"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import {
  ReceiptPrintHalf,
  type ReceiptAmounts,
  type ReceiptPrintEvidenceRow,
  type ReceiptLineItem,
  type ReceiptPrintWriteoffRow,
} from "@/components/receipt/receipt-print";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
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
        silver_adjust_factor?: number | null;
        color?: string | null;
        size?: string | null;
        labor_total_sell_krw?: number | null;
        material_amount_sell_krw?: number | null;
        repair_fee_krw?: number | null;
        is_unit_pricing?: boolean | null;
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
      gold_g?: number | null;
      silver_g?: number | null;
      alloc_gold_g?: number | null;
      alloc_silver_g?: number | null;
      alloc_labor_krw?: number | null;
      alloc_material_krw?: number | null;
      ledger_amount_krw?: number | null;
      ledger_memo?: string | null;
      note?: string | null;
    }>;
    adjusts?: Array<{
      ar_ledger_id: string;
      occurred_at: string;
      amount_krw: number;
      memo?: string | null;
      payment_id?: string | null;
    }>;
    offsets?: Array<{
      ar_ledger_id: string;
      occurred_at: string;
      amount_krw: number;
      memo?: string | null;
    }>;
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

type PartyGroup = {
  partyId: string;
  partyName: string;
  statement: LedgerStatementRow;
  lines: ReceiptLine[];
};

type LedgerPaymentDetail = NonNullable<LedgerStatementRow["details"]["payments"]>[number];
type MasterUnitPricingRow = { model_name?: string | null; is_unit_pricing?: boolean | null };

type PartyReceiptPage = {
  partyId: string;
  partyName: string;
  lines: ReceiptLine[];
  totals: Amounts;
  previous: Amounts;
  todayDue: Amounts;
  printCategoryBreakdown?: {
    shipment: Amounts;
    return: Amounts;
    payment: Amounts;
    adjust: Amounts;
    offset: Amounts;
    other: Amounts;
  };
  hasNonZeroOther: boolean;
  printWriteoffs?: {
    totalKrw: number;
    count: number;
    rows: ReceiptPrintWriteoffRow[];
    extraCount: number;
  };
  evidencePayments?: {
    totalKrw: number;
    rows: ReceiptPrintEvidenceRow[];
  };
  evidenceWriteoffs?: {
    totalKrw: number;
    rows: ReceiptPrintEvidenceRow[];
  };
  isFullyPaid: boolean;
};

const zeroAmounts: Amounts = { gold: 0, silver: 0, labor: 0, total: 0 };

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatBreakdownKrw = (amounts: Amounts) => {
  const hasCommodityOrLaborResidual =
    Math.abs(amounts.gold) > 0 || Math.abs(amounts.silver) > 0 || Math.abs(amounts.labor) > 0;
  if (Math.abs(amounts.total) <= 0 && hasCommodityOrLaborResidual) {
    return "-";
  }
  return formatKrw(amounts.total);
};

const isFullyPaidAmounts = (amounts: Amounts) => Number(amounts.total ?? 0) === 0;

const formatCheckValue = (name: string, value: number) => {
  if (name.includes("_krw")) return formatKrw(value);
  return new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(value);
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

const formatDateTimeKstYmdHm = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} | ${get("hour")}:${get("minute")}`;
};

const getKstDateKey = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
  { label: "이전 미수", value: page.previous },
  { label: "당일 미수", value: page.todayDue },
  { label: "합계", value: page.totals },
];

const getCheckTolerance = (checkName: string) => {
  if (checkName.includes("_krw")) return 0.5;
  return 1e-6;
};

const getCheckFailures = (checks: LedgerStatementRow["checks"]) => {
  return Object.entries(checks ?? {})
    .filter(([name, raw]) => name.startsWith("check_") && Number.isFinite(Number(raw)))
    .map(([name, raw]) => ({
      name,
      value: Number(raw),
      tolerance: getCheckTolerance(name),
    }))
    .filter((entry) => Math.abs(entry.value) > entry.tolerance);
};

const isPartyPass = (checks: LedgerStatementRow["checks"]) =>
  getCheckFailures(checks).length === 0;

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

const toBreakdownAmounts = (bucket?: { krw?: number; labor_krw?: number; gold_g?: number; silver_g?: number }): Amounts => ({
  gold: Number(bucket?.gold_g ?? 0),
  silver: Number(bucket?.silver_g ?? 0),
  labor: Number(bucket?.labor_krw ?? 0),
  total: Number(bucket?.krw ?? 0),
});

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

  const shipmentLinesSum = toArray(details.shipments).reduce<number>((partySum, shipment) => {
    return (
      partySum +
      toArray(toObject(shipment).lines).reduce<number>(
        (lineSum, line) => lineSum + toNumber(toObject(line).amount_krw),
        0
      )
    );
  }, 0);
  const returnSum = toArray(details.returns).reduce<number>(
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
        delta_adjust_krw: toNumber(day.delta_adjust_krw),
        delta_offset_krw: toNumber(day.delta_offset_krw),
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
      adjusts: toArray(details.adjusts) as LedgerStatementRow["details"]["adjusts"],
      offsets: toArray(details.offsets) as LedgerStatementRow["details"]["offsets"],
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
  useEffect(() => {
    document.body.classList.add("shipments-print-printing");
    return () => {
      document.body.classList.remove("shipments-print-printing");
    };
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rightPanel, setRightPanel] = useState<"payments" | "reset">("payments");
  const [selectedResetShipmentId, setSelectedResetShipmentId] = useState<string | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");

  const filterPartyId = (searchParams.get("party_id") ?? "").trim();
  const printModeParam = (searchParams.get("print_mode") ?? "").trim();
  const dateParam = (searchParams.get("date") ?? "").trim();
  const printedAtParam = (searchParams.get("printed_at") ?? "").trim();
  const printMode: "settlement" | "evidence" = printModeParam === "evidence" ? "evidence" : "settlement";

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

  const updatePrintMode = useCallback(
    (mode: "settlement" | "evidence") => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "evidence") params.set("print_mode", "evidence");
      else params.delete("print_mode");
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const statementQuery = useQuery({
    queryKey: ["shipments-print-ledger-statement-v3", today, filterPartyId],
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
        let payload: { data?: LedgerStatementRow[]; error?: string; source?: "v3" | "v2" | "v1" } | null = null;
        try {
          payload = (await response.json()) as { data?: LedgerStatementRow[]; error?: string; source?: "v3" | "v2" | "v1" };
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

        const callRpc = async <T,>(
          fn:
            | "cms_fn_shipments_print_ledger_statement_v3"
            | "cms_fn_shipments_print_ledger_statement_v2"
            | "cms_fn_shipments_print_ledger_statement_v1"
        ) => {
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
          const v3Rows = (await callRpc<LedgerStatementRow[]>("cms_fn_shipments_print_ledger_statement_v3")) ?? [];
          return sortRows(v3Rows);
        } catch (v3Err) {
          try {
            const v2Rows = (await callRpc<LedgerStatementRow[]>("cms_fn_shipments_print_ledger_statement_v2")) ?? [];
            return sortRows(v2Rows);
          } catch (v2Err) {
            try {
              const v1Rows = (await callRpc<LegacyLedgerStatementRow[]>("cms_fn_shipments_print_ledger_statement_v1")) ?? [];
              return sortRows(v1Rows.map(normalizeLegacyRow));
            } catch (v1Err) {
              throw new Error(`원장 명세 조회 실패: api=${toMessage(apiError)} | rest-v3=${toMessage(v3Err)} | rest-v2=${toMessage(v2Err)} | rest-v1=${toMessage(v1Err)}`);
            }
          }
        }
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: true,
  });

  const modelNamesForLookup = useMemo(() => {
    const unique = new Set<string>();
    (statementQuery.data ?? []).forEach((statement) => {
      (statement.details?.shipments ?? []).forEach((shipment) => {
        (shipment.lines ?? []).forEach((line) => {
          const name = (line.model_name ?? "").trim();
          if (name) unique.add(name);
        });
      });
    });
    return Array.from(unique);
  }, [statementQuery.data]);

  const unitPricingModelQuery = useQuery({
    queryKey: ["shipments-print-unit-pricing-models", modelNamesForLookup.join("|")],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      if (!supabase || modelNamesForLookup.length === 0) return [] as MasterUnitPricingRow[];
      const { data, error } = await supabase
        .from("cms_master_item")
        .select("model_name,is_unit_pricing")
        .in("model_name", modelNamesForLookup)
        .eq("is_unit_pricing", true);
      if (error) return [] as MasterUnitPricingRow[];
      return (data ?? []) as MasterUnitPricingRow[];
    },
    enabled: modelNamesForLookup.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const unitPricingByModel = useMemo(() => {
    const map = new Map<string, boolean>();
    (unitPricingModelQuery.data ?? []).forEach((row) => {
      const name = (row.model_name ?? "").trim();
      if (!name) return;
      map.set(name, Boolean(row.is_unit_pricing));
    });
    return map;
  }, [unitPricingModelQuery.data]);

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
          silver_adjust_factor: line.silver_adjust_factor ?? null,
          color: line.color ?? null,
          size: line.size ?? null,
          labor_total_sell_krw: line.labor_total_sell_krw ?? null,
          material_amount_sell_krw: line.material_amount_sell_krw ?? null,
          repair_fee_krw: line.repair_fee_krw ?? null,
          is_unit_pricing:
            line.is_unit_pricing ??
            unitPricingByModel.get((line.model_name ?? "").trim()) ??
            false,
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
  }, [statementQuery.data, unitPricingByModel]);

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

  const evidenceHistoryQuery = useQuery({
    queryKey: ["shipments-print-evidence-history", today, activePartyId, printMode],
    queryFn: async () => {
      if (printMode !== "evidence" || !activePartyId) {
        return {
          payments: [] as Array<{ occurred_at: string; amount_krw: number; payment_id?: string | null; memo?: string | null; cash_krw?: number | null; alloc_gold_g?: number | null; alloc_silver_g?: number | null; paid_gold_krw?: number | null; paid_silver_krw?: number | null }>,
          writeoffs: [] as Array<{ occurred_at: string; amount_krw: number; memo?: string | null }>,
        };
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        return {
          payments: [] as Array<{ occurred_at: string; amount_krw: number; payment_id?: string | null; memo?: string | null; cash_krw?: number | null; alloc_gold_g?: number | null; alloc_silver_g?: number | null; paid_gold_krw?: number | null; paid_silver_krw?: number | null }>,
          writeoffs: [] as Array<{ occurred_at: string; amount_krw: number; memo?: string | null }>,
        };
      }
      const { data: ledgerRows, error } = await supabase
        .from("cms_ar_ledger")
        .select("entry_type,occurred_at,amount_krw,memo,payment_id,ar_id")
        .eq("party_id", activePartyId)
        .lte("occurred_at", dayEndIso)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) {
        return {
          payments: [] as Array<{ occurred_at: string; amount_krw: number; payment_id?: string | null; memo?: string | null; cash_krw?: number | null; alloc_gold_g?: number | null; alloc_silver_g?: number | null; paid_gold_krw?: number | null; paid_silver_krw?: number | null }>,
          writeoffs: [] as Array<{ occurred_at: string; amount_krw: number; memo?: string | null }>,
        };
      }
      const rows = (ledgerRows ?? []) as Array<{
        entry_type?: string | null;
        occurred_at: string;
        amount_krw?: number | null;
        memo?: string | null;
        payment_id?: string | null;
        ar_id?: string | null;
      }>;

      const paymentRows = rows.filter((row) => (row.entry_type ?? "").toUpperCase().includes("PAYMENT"));
      const latestPaymentOccurredAt = paymentRows[0]?.occurred_at ?? null;
      const latestPaymentDateKey = getKstDateKey(latestPaymentOccurredAt);
      const rowsOnLatestPaymentDay =
        latestPaymentDateKey
          ? rows.filter((row) => getKstDateKey(row.occurred_at) === latestPaymentDateKey)
          : [];
      const paymentRowsOnDay = rowsOnLatestPaymentDay.filter((row) => (row.entry_type ?? "").toUpperCase().includes("PAYMENT"));

      const arIds = Array.from(new Set(paymentRowsOnDay.map((row) => (row.ar_id ?? "").trim()).filter(Boolean)));
      let allocRows: Array<{
        payment_id?: string | null;
        paid_at?: string | null;
        alloc_created_at?: string | null;
        cash_krw?: number | null;
        gold_g?: number | null;
        silver_g?: number | null;
        alloc_gold_g?: number | null;
        alloc_silver_g?: number | null;
        alloc_labor_krw?: number | null;
        alloc_material_krw?: number | null;
        alloc_value_krw?: number | null;
        ar_id?: string | null;
      }> = [];
      if (arIds.length > 0) {
        const { data: allocData } = await supabase
          .from("cms_v_ar_payment_alloc_detail_v1")
          .select("payment_id,paid_at,alloc_created_at,cash_krw,gold_g,silver_g,alloc_gold_g,alloc_silver_g,alloc_labor_krw,alloc_material_krw,alloc_value_krw,ar_id")
          .in("ar_id", arIds.slice(0, 200));
        allocRows = (allocData ?? []) as Array<{
          payment_id?: string | null;
          paid_at?: string | null;
          alloc_created_at?: string | null;
          cash_krw?: number | null;
          gold_g?: number | null;
          silver_g?: number | null;
          alloc_gold_g?: number | null;
          alloc_silver_g?: number | null;
          alloc_labor_krw?: number | null;
          alloc_material_krw?: number | null;
          alloc_value_krw?: number | null;
          ar_id?: string | null;
        }>;
      }

      const paymentMap = new Map<string, { occurred_at: string; amount_krw: number; payment_id?: string | null; memo?: string | null; cash_krw: number; paid_gold_g: number; paid_silver_g: number; paid_gold_krw: number; paid_silver_krw: number; alloc_gold_g: number; alloc_silver_g: number; alloc_labor_krw: number; alloc_material_krw: number; alloc_material_gold_krw: number; alloc_material_silver_krw: number }>();
      const allocRowsByPayment = new Map<string, typeof allocRows>();
      allocRows.forEach((row) => {
        const paymentId = (row.payment_id ?? "").trim();
        if (!paymentId) return;
        const current = allocRowsByPayment.get(paymentId) ?? [];
        current.push(row);
        allocRowsByPayment.set(paymentId, current);
      });

      allocRowsByPayment.forEach((rowsForPayment, paymentId) => {
        const sortedRows = rowsForPayment
          .slice()
          .sort((a, b) =>
            new Date(a.alloc_created_at ?? a.paid_at ?? 0).getTime() - new Date(b.alloc_created_at ?? b.paid_at ?? 0).getTime()
          );

        let remainingPaidGold = Math.max(0, Number(sortedRows[0]?.gold_g ?? 0));
        let remainingPaidSilver = Math.max(0, Number(sortedRows[0]?.silver_g ?? 0));

        const summary = {
          occurred_at: sortedRows[0]?.paid_at ?? "",
          amount_krw: 0,
          payment_id: sortedRows[0]?.payment_id ?? null,
          memo: null,
          cash_krw: Number(sortedRows[0]?.cash_krw ?? 0),
          paid_gold_g: remainingPaidGold,
          paid_silver_g: remainingPaidSilver,
          paid_gold_krw: 0,
          paid_silver_krw: 0,
          alloc_gold_g: 0,
          alloc_silver_g: 0,
          alloc_labor_krw: 0,
          alloc_material_krw: 0,
          alloc_material_gold_krw: 0,
          alloc_material_silver_krw: 0,
        };

        sortedRows.forEach((row) => {
          const allocGoldG = Math.max(0, Number(row.alloc_gold_g ?? 0));
          const allocSilverG = Math.max(0, Number(row.alloc_silver_g ?? 0));
          const allocMaterialKrw = Math.max(0, Number(row.alloc_material_krw ?? 0));

          const commodityGoldG = Math.min(remainingPaidGold, allocGoldG);
          const cashGoldG = Math.max(0, allocGoldG - commodityGoldG);
          remainingPaidGold = Math.max(0, remainingPaidGold - commodityGoldG);

          const commoditySilverG = Math.min(remainingPaidSilver, allocSilverG);
          const cashSilverG = Math.max(0, allocSilverG - commoditySilverG);
          remainingPaidSilver = Math.max(0, remainingPaidSilver - commoditySilverG);

          const allocTotalG = allocGoldG + allocSilverG;
          const goldAllocRatio = allocTotalG > 0 ? allocGoldG / allocTotalG : 0;
          const silverAllocRatio = allocTotalG > 0 ? allocSilverG / allocTotalG : 0;
          const allocMaterialGoldKrw = allocMaterialKrw * goldAllocRatio;
          const allocMaterialSilverKrw = allocMaterialKrw * silverAllocRatio;

          const cashMaterialGoldKrw = allocGoldG > 0 ? allocMaterialGoldKrw * (cashGoldG / allocGoldG) : 0;
          const cashMaterialSilverKrw = allocSilverG > 0 ? allocMaterialSilverKrw * (cashSilverG / allocSilverG) : 0;
          const paidMaterialGoldKrw = Math.max(0, allocMaterialGoldKrw - cashMaterialGoldKrw);
          const paidMaterialSilverKrw = Math.max(0, allocMaterialSilverKrw - cashMaterialSilverKrw);

          summary.amount_krw -= Number(row.alloc_value_krw ?? 0);
          summary.paid_gold_krw += paidMaterialGoldKrw;
          summary.paid_silver_krw += paidMaterialSilverKrw;
          summary.alloc_gold_g += allocGoldG;
          summary.alloc_silver_g += allocSilverG;
          summary.alloc_labor_krw += Number(row.alloc_labor_krw ?? 0);
          summary.alloc_material_krw += cashMaterialGoldKrw + cashMaterialSilverKrw;
          summary.alloc_material_gold_krw += cashMaterialGoldKrw;
          summary.alloc_material_silver_krw += cashMaterialSilverKrw;
        });

        paymentMap.set(paymentId, summary);
      });

      paymentRowsOnDay
        .forEach((row) => {
          const paymentId = (row.payment_id ?? "").trim();
          if (!paymentId || paymentMap.has(paymentId)) return;
          paymentMap.set(paymentId, {
            occurred_at: row.occurred_at,
            amount_krw: Number(row.amount_krw ?? 0),
            payment_id: row.payment_id ?? null,
            memo: row.memo ?? null,
            cash_krw: Number(row.amount_krw ?? 0) * -1,
            paid_gold_g: 0,
            paid_silver_g: 0,
            paid_gold_krw: 0,
            paid_silver_krw: 0,
            alloc_gold_g: 0,
            alloc_silver_g: 0,
            alloc_labor_krw: 0,
            alloc_material_krw: 0,
            alloc_material_gold_krw: 0,
            alloc_material_silver_krw: 0,
          });
        });

      return {
        payments: Array.from(paymentMap.values()).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
        writeoffs: rowsOnLatestPaymentDay
          .filter((row) => (row.entry_type ?? "").toUpperCase() === "ADJUST" && (row.memo ?? "").toUpperCase().includes("SERVICE_WRITEOFF"))
          .map((row) => ({
            occurred_at: row.occurred_at,
            amount_krw: Number(row.amount_krw ?? 0),
            memo: row.memo ?? null,
          })),
      };
    },
    enabled: printMode === "evidence" && Boolean(activePartyId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const paymentFallbackByParty = useMemo(() => {
    const map = new Map<string, LedgerPaymentDetail[]>();
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

  const evidencePaymentsByParty = useMemo(() => {
    const map = new Map<string, { totalKrw: number; rows: ReceiptPrintEvidenceRow[] }>();
    if (printMode !== "evidence" || !activePartyId) return map;
    const rows = evidenceHistoryQuery.data?.payments ?? [];
    map.set(activePartyId, {
      totalKrw: rows.reduce((sum, row) => sum + -Number(row.amount_krw ?? 0), 0),
      rows: rows.map((row) => ({
        paidGoldG: Number(row.paid_gold_g ?? 0),
        paidSilverG: Number(row.paid_silver_g ?? 0),
        atLabel: formatDateTimeKstYmdHm(row.occurred_at),
        amountKrw: -Number(row.amount_krw ?? 0),
        goldG: Number(row.alloc_gold_g ?? 0),
        silverG: Number(row.alloc_silver_g ?? 0),
        cashKrw: Number(row.cash_krw ?? 0),
        cashMaterialGoldG: Math.max(0, Number(row.alloc_gold_g ?? 0) - Number(row.paid_gold_g ?? 0)),
        cashMaterialSilverG: Math.max(0, Number(row.alloc_silver_g ?? 0) - Number(row.paid_silver_g ?? 0)),
        cashMaterialGoldKrw: Number(row.alloc_material_gold_krw ?? 0),
        cashMaterialSilverKrw: Number(row.alloc_material_silver_krw ?? 0),
        paidGoldKrw: Number(row.paid_gold_krw ?? 0),
        paidSilverKrw: Number(row.paid_silver_krw ?? 0),
        allocLaborKrw: Number(row.alloc_labor_krw ?? 0),
        allocMaterialKrw: Number(row.alloc_material_krw ?? 0),
        paymentId: row.payment_id ?? null,
        memo: row.memo ?? null,
      })),
    });
    return map;
  }, [activePartyId, evidenceHistoryQuery.data?.payments, printMode]);

  const evidenceWriteoffsByParty = useMemo(() => {
    const map = new Map<string, { totalKrw: number; rows: ReceiptPrintEvidenceRow[] }>();
    if (printMode !== "evidence" || !activePartyId) return map;
    const rows = evidenceHistoryQuery.data?.writeoffs ?? [];
    map.set(activePartyId, {
      totalKrw: rows.reduce((sum, row) => sum + -Number(row.amount_krw ?? 0), 0),
      rows: rows.map((row) => ({
        atLabel: formatDateTimeKstYmdHm(row.occurred_at),
        amountKrw: -Number(row.amount_krw ?? 0),
        goldG: 0,
        silverG: 0,
        cashKrw: -Number(row.amount_krw ?? 0),
        memo: row.memo ?? null,
      })),
    });
    return map;
  }, [activePartyId, evidenceHistoryQuery.data?.writeoffs, printMode]);

  const receiptPages = useMemo<PartyReceiptPage[]>(() => {
    const pages: PartyReceiptPage[] = [];
    partyGroups.forEach((group) => {
      const prev = group.statement.prev_position;
      const end = group.statement.end_position;
      const day = group.statement.day_ledger_totals;
      const writeoffs = (group.statement.details.adjusts ?? [])
        .filter((adjust) => (adjust.memo ?? "").toUpperCase().includes("SERVICE_WRITEOFF"))
        .slice()
        .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime());

      const breakdown = group.statement.day_breakdown;
      const shipmentBreakdown = toBreakdownAmounts(breakdown?.shipment);
      const returnBreakdown = toBreakdownAmounts(breakdown?.return);
      const paymentBreakdown = toBreakdownAmounts(breakdown?.payment);
      const adjustBreakdown = toBreakdownAmounts(breakdown?.adjust);
      const offsetBreakdown = toBreakdownAmounts(breakdown?.offset);
      const otherBreakdown = toBreakdownAmounts(breakdown?.other);

      const printWriteoffs = {
        totalKrw: writeoffs.reduce((sum, adjust) => sum + -Number(adjust.amount_krw ?? 0), 0),
        count: writeoffs.length,
        rows: writeoffs.slice(0, 2).map((adjust) => ({
          atLabel: formatDateTimeKst(adjust.occurred_at),
          amountKrw: -Number(adjust.amount_krw ?? 0),
          memo: adjust.memo ?? null,
        })),
        extraCount: Math.max(writeoffs.length - 2, 0),
      };

      const statementEvidencePayments = (group.statement.details.payments ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.paid_at ?? b.ledger_occurred_at ?? 0).getTime() -
            new Date(a.paid_at ?? a.ledger_occurred_at ?? 0).getTime()
        )
        .map((row) => {
          const paidGoldG = Number(row.gold_g ?? 0);
          const paidSilverG = Number(row.silver_g ?? 0);
          const allocGoldG = Number(row.alloc_gold_g ?? 0);
          const allocSilverG = Number(row.alloc_silver_g ?? 0);
          const allocMaterialKrw = Number(row.alloc_material_krw ?? 0);
          const cashMaterialGoldG = Math.max(0, allocGoldG - paidGoldG);
          const cashMaterialSilverG = Math.max(0, allocSilverG - paidSilverG);
          const totalAllocG = Math.max(0, allocGoldG) + Math.max(0, allocSilverG);
          const cashAllocG = cashMaterialGoldG + cashMaterialSilverG;
          const cashMaterialTotalKrw = totalAllocG > 0 ? allocMaterialKrw * (cashAllocG / totalAllocG) : 0;
          const hasGoldAlloc = Math.abs(allocGoldG) > 0;
          const hasSilverAlloc = Math.abs(allocSilverG) > 0;
          const cashMaterialGoldKrw =
            hasGoldAlloc && cashAllocG > 0 ? cashMaterialTotalKrw * (cashMaterialGoldG / cashAllocG) : 0;
          const cashMaterialSilverKrw =
            hasSilverAlloc && cashAllocG > 0 ? cashMaterialTotalKrw * (cashMaterialSilverG / cashAllocG) : 0;
          const commodityGoldG = Math.min(Math.max(0, paidGoldG), Math.max(0, allocGoldG));
          const commoditySilverG = Math.min(Math.max(0, paidSilverG), Math.max(0, allocSilverG));
          const commodityTotalG = commodityGoldG + commoditySilverG;
          const commodityMaterialTotalKrw = Math.max(0, allocMaterialKrw - cashMaterialTotalKrw);
          const paidGoldKrw = commodityTotalG > 0 ? commodityMaterialTotalKrw * (commodityGoldG / commodityTotalG) : 0;
          const paidSilverKrw = commodityTotalG > 0 ? commodityMaterialTotalKrw * (commoditySilverG / commodityTotalG) : 0;
          return {
            atLabel: formatDateTimeKstYmdHm(row.paid_at ?? row.ledger_occurred_at),
            amountKrw:
              row.ledger_amount_krw !== null && row.ledger_amount_krw !== undefined
                ? -Number(row.ledger_amount_krw)
                : 0,
            goldG: allocGoldG,
            silverG: allocSilverG,
            cashKrw: Number(row.cash_krw ?? 0),
            paidGoldG,
            paidSilverG,
            cashMaterialGoldG,
            cashMaterialSilverG,
            cashMaterialGoldKrw,
            cashMaterialSilverKrw,
            paidGoldKrw,
            paidSilverKrw,
            allocLaborKrw: Number(row.alloc_labor_krw ?? 0),
            allocMaterialKrw: cashMaterialTotalKrw,
            paymentId: row.payment_id ?? null,
            memo: row.note ?? null,
          };
        });

      const statementEvidenceWriteoffs = (group.statement.details.adjusts ?? [])
        .filter((adjust) => (adjust.memo ?? "").toUpperCase().includes("SERVICE_WRITEOFF"))
        .slice()
        .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime())
        .map((row) => ({
          atLabel: formatDateTimeKstYmdHm(row.occurred_at),
          amountKrw: -Number(row.amount_krw ?? 0),
          goldG: 0,
          silverG: 0,
          cashKrw: -Number(row.amount_krw ?? 0),
          memo: row.memo ?? null,
        }));

      const mappedEvidencePayments = evidencePaymentsByParty.get(group.partyId);
      const mappedEvidenceWriteoffs = evidenceWriteoffsByParty.get(group.partyId);
      const finalEvidencePayments =
        mappedEvidencePayments && mappedEvidencePayments.rows.length > 0
          ? mappedEvidencePayments
          : statementEvidencePayments.length > 0
            ? {
                totalKrw: statementEvidencePayments.reduce((sum, row) => sum + Number(row.amountKrw ?? 0), 0),
                rows: statementEvidencePayments,
              }
            : undefined;
      const finalEvidenceWriteoffs =
        mappedEvidenceWriteoffs && mappedEvidenceWriteoffs.rows.length > 0
          ? mappedEvidenceWriteoffs
          : statementEvidenceWriteoffs.length > 0
            ? {
                totalKrw: statementEvidenceWriteoffs.reduce((sum, row) => sum + Number(row.amountKrw ?? 0), 0),
                rows: statementEvidenceWriteoffs,
              }
            : undefined;

      const endAmounts: Amounts = {
        gold: Number(end.gold_outstanding_g ?? 0),
        silver: Number(end.silver_outstanding_g ?? 0),
        labor: Number(end.labor_cash_outstanding_krw ?? 0),
        total: Number(end.balance_krw ?? 0),
      };

      const pageTemplate: Omit<PartyReceiptPage, "lines"> = {
        partyId: group.partyId,
        partyName: group.partyName,
        totals: endAmounts,
        previous: {
          gold: Number(prev.gold_outstanding_g ?? 0),
          silver: Number(prev.silver_outstanding_g ?? 0),
          labor: Number(prev.labor_cash_outstanding_krw ?? 0),
          total: Number(prev.balance_krw ?? 0),
        },
        todayDue: {
          gold: Number(end.gold_outstanding_g ?? 0) - Number(prev.gold_outstanding_g ?? 0),
          silver: Number(end.silver_outstanding_g ?? 0) - Number(prev.silver_outstanding_g ?? 0),
          labor: Number(end.labor_cash_outstanding_krw ?? 0) - Number(prev.labor_cash_outstanding_krw ?? 0),
          total: Number(day.delta_total_krw ?? 0),
        },
        printCategoryBreakdown: breakdown
          ? {
              shipment: shipmentBreakdown,
              return: returnBreakdown,
              payment: paymentBreakdown,
              adjust: adjustBreakdown,
              offset: offsetBreakdown,
              other: otherBreakdown,
            }
          : undefined,
        hasNonZeroOther:
          Math.abs(otherBreakdown.total) > 0 ||
          Math.abs(otherBreakdown.gold) > 0 ||
          Math.abs(otherBreakdown.silver) > 0 ||
          Math.abs(otherBreakdown.labor) > 0,
        evidencePayments: finalEvidencePayments,
        evidenceWriteoffs: finalEvidenceWriteoffs,
        isFullyPaid: isFullyPaidAmounts(endAmounts),
      };

      chunkLines(group.lines, 6).forEach((chunk, chunkIndex) => {
        pages.push({
          ...pageTemplate,
          lines: chunk,
          printWriteoffs: printMode === "settlement" && chunkIndex === 0 && printWriteoffs.count > 0 ? printWriteoffs : undefined,
          printCategoryBreakdown:
            printMode === "settlement" && chunkIndex === 0 ? pageTemplate.printCategoryBreakdown : undefined,
          hasNonZeroOther: printMode === "settlement" && chunkIndex === 0 ? pageTemplate.hasNonZeroOther : false,
          evidencePayments: printMode === "evidence" && chunkIndex === 0 ? pageTemplate.evidencePayments : undefined,
          evidenceWriteoffs: printMode === "evidence" && chunkIndex === 0 ? pageTemplate.evidenceWriteoffs : undefined,
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
        todayDue: { ...zeroAmounts },
        printCategoryBreakdown: undefined,
        hasNonZeroOther: false,
        evidencePayments: undefined,
        evidenceWriteoffs: undefined,
        isFullyPaid: false,
      });
    }

    return pages;
  }, [evidencePaymentsByParty, evidenceWriteoffsByParty, partyGroups, printMode]);

  const pageChecks = useMemo(
    () =>
      partyGroups.map((group) => ({
        partyId: group.partyId,
        partyName: group.partyName,
        checks: group.statement.checks,
        failures: getCheckFailures(group.statement.checks),
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

  const selectedPartyGroup = useMemo(
    () => (activePartyId ? partyGroups.find((group) => group.partyId === activePartyId) ?? null : null),
    [activePartyId, partyGroups]
  );

  const resetCandidates = useMemo(() => {
    if (!selectedPartyGroup)
      return [] as Array<{
        shipmentId: string;
        occurredAt: string;
        customerName: string;
        modelSummary: string;
        lineCount: number;
        amountKrw: number;
      }>;
    return (selectedPartyGroup.statement.details.shipments ?? [])
      .map((shipment) => {
        const modelSummary = (shipment.lines ?? [])
          .map((line) => (line.model_name ?? "").trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(", ");
        const amountKrw = (shipment.lines ?? []).reduce((sum, line) => sum + Number(line.amount_krw ?? 0), 0);
        return {
          shipmentId: shipment.shipment_id,
          occurredAt: shipment.ledger_occurred_at,
          customerName: shipment.customer_name ?? selectedPartyGroup.partyName,
          modelSummary: modelSummary || "모델정보 없음",
          lineCount: (shipment.lines ?? []).length,
          amountKrw,
        };
      })
      .filter((row) => Boolean(row.shipmentId));
  }, [selectedPartyGroup]);

  const selectedResetShipment = useMemo(
    () => resetCandidates.find((row) => row.shipmentId === selectedResetShipmentId) ?? null,
    [resetCandidates, selectedResetShipmentId]
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

  const dayShipmentOverall = useMemo(
    () => partyGroups.reduce((sum, group) => sum + Number(group.statement.day_ledger_totals.delta_shipment_krw ?? 0), 0),
    [partyGroups]
  );

  const dayDueOverall = useMemo(
    () => partyGroups.reduce((sum, group) => sum + Number(group.statement.day_ledger_totals.delta_total_krw ?? 0), 0),
    [partyGroups]
  );

  const dayPaymentByPartyMap = useMemo(
    () => new Map(dayPaymentByParty.map((row) => [row.partyId, row])),
    [dayPaymentByParty]
  );

  const unconfirmShipmentMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentUnconfirm,
    successMessage: "출고 초기화 완료",
    onSuccess: () => {
      setReasonModalOpen(false);
      setReasonText("");
      setSelectedResetShipmentId(null);
      statementQuery.refetch();
    },
  });

  const handleConfirmClear = useCallback(async () => {
    if (!selectedResetShipment) return;
    const reason = reasonText.trim();
    if (!reason) return;
    await unconfirmShipmentMutation.mutateAsync({
      p_shipment_id: selectedResetShipment.shipmentId,
      p_reason: reason,
      p_note: "unconfirm from shipments_print",
    });
  }, [reasonText, selectedResetShipment, unconfirmShipmentMutation]);

  const isLoading = statementQuery.isLoading;
  const errorMessage = statementQuery.error ? toMessage(statementQuery.error) : "";

  const canPrint =
    isPagePass &&
    !isLoading &&
    visiblePages.length > 0 &&
    visiblePages[0]?.partyId !== "empty" &&
    (printMode === "settlement" || Boolean(activePartyId));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="receipt-print-actions no-print px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="출고 영수증(원장 기준)"
          subtitle={`기준일: ${today} · ${printMode === "evidence" ? "증빙용" : "정산용"} · 원장 정합 ${isPagePass ? "PASS" : "FAIL"}`}
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
                  variant={printMode === "settlement" ? "primary" : "secondary"}
                  onClick={() => updatePrintMode("settlement")}
                >
                  정산용
                </Button>
                <Button
                  variant={printMode === "evidence" ? "primary" : "secondary"}
                  onClick={() => updatePrintMode("evidence")}
                >
                  증빙용
                </Button>
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
        {rightPanel === "reset" && selectedResetShipment && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
            <div className="text-xs tabular-nums">
              선택 출고: {selectedResetShipment.customerName} · {selectedResetShipment.modelSummary} · {formatKrw(selectedResetShipment.amountKrw)} · {formatDateTimeKst(selectedResetShipment.occurredAt)}
            </div>
            <Button variant="secondary" onClick={() => setReasonModalOpen(true)}>
              출고초기화
            </Button>
          </div>
        )}
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
                        <td className={cn("py-2", row.pass ? "text-muted-foreground" : "text-rose-700 font-semibold")}>
                          <div>{row.partyName}</div>
                          {!row.pass && row.failures.length > 0 && (
                            <div className="text-[11px] font-normal text-rose-600 tabular-nums">
                              {row.failures.slice(0, 2).map((f) => `${f.name}=${formatCheckValue(f.name, f.value)}`).join(" · ")}
                            </div>
                          )}
                        </td>
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
                  <div className="text-xs text-[var(--muted)]">오늘 출고(원장 SOT)</div>
                  <div className="text-xl font-semibold tabular-nums">{formatKrw(dayShipmentOverall)}</div>
                </CardBody>
              </Card>
              <Card className="border-[var(--panel-border)]">
                <CardBody className="p-4">
                  <div className="text-xs text-[var(--muted)]">최근 결제(원장 SOT)</div>
                  <div className="text-xl font-semibold tabular-nums">{formatKrw(dayPaymentOverall)}</div>
                </CardBody>
              </Card>
              <Card className="border-[var(--panel-border)]">
                <CardBody className="p-4">
                  <div className="text-xs text-[var(--muted)]">당일 미수 변화(원장 SOT)</div>
                  <div className="text-xl font-semibold tabular-nums">{formatKrw(dayDueOverall)}</div>
                </CardBody>
              </Card>
            </div>

            {printMode === "evidence" && !activePartyId && (
              <Card className="no-print border-amber-300 bg-amber-50">
                <CardBody className="p-3 text-xs text-amber-700">
                  증빙용 영수증은 거래처 1곳 선택 후 출력할 수 있습니다.
                </CardBody>
              </Card>
            )}

            <div className="no-print shipments-print-main grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
              <Card className="border-[var(--panel-border)] h-fit">
                <CardHeader className="border-b border-[var(--panel-border)] py-3">
                  <div className="text-sm font-semibold">거래처 선택</div>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[var(--panel-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResetShipmentId(null);
                        updateQuery({ partyId: null });
                      }}
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
                        <div key={group.partyId}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResetShipmentId(null);
                              updateQuery({ partyId: group.partyId });
                            }}
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
                          {isActive && (
                            <div className="px-4 pb-3 flex items-center gap-2 bg-[var(--panel-hover)]">
                              <Button
                                variant={rightPanel === "payments" ? "primary" : "secondary"}
                                onClick={() => setRightPanel("payments")}
                              >
                                당일결제내역
                              </Button>
                              <Button
                                variant={rightPanel === "reset" ? "primary" : "secondary"}
                                onClick={() => {
                                  setSelectedResetShipmentId(null);
                                  setRightPanel("reset");
                                }}
                              >
                                출고초기화
                              </Button>
                            </div>
                          )}
                        </div>
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

              <div className="space-y-2">
                {!selectedPartyGroup ? (
                  <Card className="border-[var(--panel-border)]">
                    <CardBody className="p-2 text-xs text-[var(--muted)]">좌측에서 거래처를 선택하면 패널을 사용할 수 있습니다.</CardBody>
                  </Card>
                ) : rightPanel === "payments" ? (
                  (() => {
                    const payments = getPartyPayments(selectedPartyGroup)
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.paid_at ?? b.ledger_occurred_at ?? 0).getTime() -
                          new Date(a.paid_at ?? a.ledger_occurred_at ?? 0).getTime()
                      );
                    return (
                      <Card key={`payments-${selectedPartyGroup.partyId}`} className="border-[var(--panel-border)]">
                        <CardHeader className="border-b border-[var(--panel-border)] py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold">당일결제 내역(원장 SOT) · {selectedPartyGroup.partyName}</div>
                            {isFullyPaidAmounts({
                              gold: Number(selectedPartyGroup.statement.end_position.gold_outstanding_g ?? 0),
                              silver: Number(selectedPartyGroup.statement.end_position.silver_outstanding_g ?? 0),
                              labor: Number(selectedPartyGroup.statement.end_position.labor_cash_outstanding_krw ?? 0),
                              total: Number(selectedPartyGroup.statement.end_position.balance_krw ?? 0),
                            }) && (
                              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                                완불
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted)] tabular-nums">합계 {formatKrw(-Number(selectedPartyGroup.statement.day_ledger_totals.delta_payment_krw ?? 0))} · {payments.length}건</div>
                        </CardHeader>
                        <CardBody className="p-4">
                          {selectedPartyGroup.day_breakdown ? (
                            <div className="mb-4 rounded border border-[var(--panel-border)] p-3">
                              <div className="text-xs font-semibold">당일 변동 내역</div>
                              <div className="mt-1 text-[11px] text-[var(--muted)]">(+는 미수 증가, -는 미수 감소)</div>
                              {(() => {
                                const shipment = toBreakdownAmounts(selectedPartyGroup.day_breakdown.shipment);
                                const returns = toBreakdownAmounts(selectedPartyGroup.day_breakdown.return);
                                const adjust = toBreakdownAmounts(selectedPartyGroup.day_breakdown.adjust);
                                const offset = toBreakdownAmounts(selectedPartyGroup.day_breakdown.offset);
                                const other = toBreakdownAmounts(selectedPartyGroup.day_breakdown.other);
                                const payment = toBreakdownAmounts(selectedPartyGroup.day_breakdown.payment);
                                const hasReturns =
                                  Math.abs(returns.gold) > 0 ||
                                  Math.abs(returns.silver) > 0 ||
                                  Math.abs(returns.labor) > 0 ||
                                  Math.abs(returns.total) > 0;
                                const sales: Amounts = {
                                  gold: shipment.gold + returns.gold,
                                  silver: shipment.silver + returns.silver,
                                  labor: shipment.labor + returns.labor,
                                  total: shipment.total + returns.total,
                                };
                                const misc: Amounts = {
                                  gold: adjust.gold + offset.gold + other.gold,
                                  silver: adjust.silver + offset.silver + other.silver,
                                  labor: adjust.labor + offset.labor + other.labor,
                                  total: adjust.total + offset.total + other.total,
                                };
                                const net: Amounts = {
                                  gold: sales.gold + payment.gold + misc.gold,
                                  silver: sales.silver + payment.silver + misc.silver,
                                  labor: sales.labor + payment.labor + misc.labor,
                                  total: sales.total + payment.total + misc.total,
                                };
                                const showMisc =
                                  Math.abs(misc.gold) > 0 ||
                                  Math.abs(misc.silver) > 0 ||
                                  Math.abs(misc.labor) > 0 ||
                                  Math.abs(misc.total) > 0;
                                const rows: Array<[string, Amounts]> = [
                                  ["오늘 판매(출고+반품)", sales],
                                  ["오늘 결제", payment],
                                ];
                                if (showMisc) rows.push(["기타(조정+상계+정정)", misc]);
                                rows.push(["당일 미수 변화", net]);
                                return (
                                  <>
                                    <div className="mt-2 rounded border border-[var(--panel-border)] p-2 text-xs">
                                      <table className="w-full border-collapse tabular-nums">
                                        <thead>
                                          <tr className="border-b border-[var(--panel-border)]">
                                            <th className="py-1 text-left">구분</th>
                                            <th className="py-1 text-right">순금</th>
                                            <th className="py-1 text-right">순은</th>
                                            <th className="py-1 text-right">공임</th>
                                            <th className="py-1 text-right">총금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rows.map(([label, value]) => (
                                            <tr key={label} className="border-b border-[var(--panel-border)]">
                                              <td className={cn("py-1", label === "당일 미수 변화" && "font-semibold")}>{label}</td>
                                              <td className="py-1 text-right">{(value as Amounts).gold.toFixed(3)}g</td>
                                              <td className="py-1 text-right">{(value as Amounts).silver.toFixed(3)}g</td>
                                              <td className="py-1 text-right">{formatKrw((value as Amounts).labor)}</td>
                                              <td className="py-1 text-right">{formatBreakdownKrw(value as Amounts)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    {hasReturns && (
                                      <div className="mt-2 text-[11px] text-[var(--muted)]">※ 금/은 반품분은 당시 시세로 계산되어 총금액에 반영됩니다.</div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                              v3 day_breakdown이 없어 카테고리별 분해표를 표시하지 않습니다(v2/v1 fallback).
                            </div>
                          )}

                          {payments.length === 0 ? (
                            <div className="text-xs text-[var(--muted)]">당일 결제 내역 없음</div>
                          ) : (
                            <div className="space-y-2 text-xs">
                              {payments.map((payment, index) => {
                                const amount =
                                  payment.ledger_amount_krw !== null && payment.ledger_amount_krw !== undefined
                                    ? -Number(payment.ledger_amount_krw)
                                    : 0;
                                return (
                                  <div
                                    key={`${payment.payment_id ?? "payment"}-${payment.ledger_occurred_at ?? index}`}
                                    className="flex items-center justify-between gap-4 tabular-nums"
                                  >
                                    <div className="truncate">
                                      {formatDateTimeKst(payment.paid_at ?? payment.ledger_occurred_at)} · 현금 {formatKrw(payment.cash_krw ?? 0)} · 금 {Number(payment.alloc_gold_g ?? 0).toFixed(3)}g · 은 {Number(payment.alloc_silver_g ?? 0).toFixed(3)}g
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
                  })()
                ) : (
                  <Card className="border-[var(--panel-border)]">
                    <CardHeader className="border-b border-[var(--panel-border)] py-3">
                      <div className="text-sm font-semibold">출고초기화 대상 · {selectedPartyGroup.partyName}</div>
                      <div className="text-xs text-[var(--muted)]">대상을 선택하면 상단에서 초기화 액션을 실행할 수 있습니다.</div>
                    </CardHeader>
                    <CardBody className="p-0">
                      {resetCandidates.length === 0 ? (
                        <div className="p-4 text-xs text-[var(--muted)]">초기화 가능한 출고가 없습니다.</div>
                      ) : (
                        <div className="divide-y divide-[var(--panel-border)]">
                          {resetCandidates.map((row) => (
                            <button
                              key={row.shipmentId}
                              type="button"
                              onClick={() => setSelectedResetShipmentId(row.shipmentId)}
                              className={cn(
                                "w-full px-4 py-3 text-left transition-colors",
                                selectedResetShipmentId === row.shipmentId
                                  ? "bg-[var(--panel-hover)]"
                                  : "hover:bg-[var(--panel-hover)]"
                              )}
                            >
                              <div className="text-sm font-semibold">{row.customerName}</div>
                              <div className="text-xs text-[var(--muted)] tabular-nums">
                                {row.modelSummary} · {row.lineCount}건 · {formatKrw(row.amountKrw)} · {formatDateTimeKst(row.occurredAt)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )}
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
                          printMode={printMode}
                          printWriteoffs={page.printWriteoffs}
                          evidencePayments={page.evidencePayments}
                          evidenceWriteoffs={page.evidenceWriteoffs}
                          printCategoryBreakdown={page.printCategoryBreakdown}
                          isFullyPaid={page.isFullyPaid}
                        />
                      </div>
                      <div className="h-full pl-4">
                        <ReceiptPrintHalf
                          partyName={page.partyName}
                          dateLabel={printedAtLabel}
                          lines={page.lines}
                          summaryRows={buildSummaryRows(page)}
                          printMode={printMode}
                          printWriteoffs={page.printWriteoffs}
                          evidencePayments={page.evidencePayments}
                          evidenceWriteoffs={page.evidenceWriteoffs}
                          printCategoryBreakdown={page.printCategoryBreakdown}
                          isFullyPaid={page.isFullyPaid}
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

      <Modal
        open={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        title="출고초기화 사유"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">사유</label>
            <Textarea
              placeholder="예: 당일 발송 불가"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className={cn("text-xs", reasonText.trim() ? "text-[var(--muted)]" : "text-[var(--danger)]")}>
              사유를 입력해야 초기화됩니다.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReasonModalOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void handleConfirmClear();
                }}
                disabled={!reasonText.trim() || !selectedResetShipment || unconfirmShipmentMutation.isPending}
              >
                {unconfirmShipmentMutation.isPending ? "처리 중..." : "초기화"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
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
