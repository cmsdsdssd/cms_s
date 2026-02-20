"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Search, ChevronRight, ArrowUpRight, ArrowDownLeft, X, Check, Wallet, RotateCcw } from "lucide-react";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { getSchemaClient } from "@/lib/supabase/client";
import { getMaterialFactor, normalizeMaterialCode } from "@/lib/material-factors";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ArPositionRow = {
  party_id?: string;
  party_type?: string;
  name?: string;
  balance_krw?: number | null;
  receivable_krw?: number | null;
  credit_krw?: number | null;
  last_activity_at?: string | null;
  labor_cash_outstanding_krw?: number | null;
  material_cash_outstanding_krw?: number | null;
  total_cash_outstanding_krw?: number | null;
  gold_outstanding_g?: number | null;
  silver_outstanding_g?: number | null;
};

type LedgerRow = {
  ar_ledger_id?: string;
  party_id?: string;
  occurred_at?: string | null;
  created_at?: string | null;
  entry_type?: string;
  amount_krw?: number | null;
  memo?: string | null;
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  payment_id?: string | null;
  return_line_id?: string | null;
};

type ShipmentLineRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  repair_line_id?: string | null;
  qty?: number | null;
  material_code?: string | null;
  net_weight_g?: number | null;
  total_amount_sell_krw?: number | null;
  material_amount_sell_krw?: number | null;
  labor_total_sell_krw?: number | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  size?: string | null;
  created_at?: string | null;
  shipment_header?: {
    ship_date?: string | null;
    status?: string | null;
    customer_party_id?: string | null;
  } | null;
};

type ReturnLineRow = {
  shipment_line_id?: string | null;
  return_qty?: number | null;
};

type ArInvoicePositionRow = {
  ar_id?: string;
  party_id?: string;
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  occurred_at?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  size?: string | null;
  qty?: number | null;
  material_code?: string | null;
  labor_cash_due_krw?: number | null;
  material_cash_due_krw?: number | null;
  total_cash_due_krw?: number | null;
  labor_cash_outstanding_krw?: number | null;
  material_cash_outstanding_krw?: number | null;
  total_cash_outstanding_krw?: number | null;
  commodity_type?: string | null;
  commodity_due_g?: number | null;
  commodity_outstanding_g?: number | null;
  commodity_price_snapshot_krw_per_g?: number | null;
};

type ArPaymentAllocDetailRow = {
  payment_id?: string;
  paid_at?: string | null;
  cash_krw?: number | null;
  gold_g?: number | null;
  silver_g?: number | null;
  note?: string | null;
  alloc_id?: string | null;
  ar_id?: string | null;
  alloc_cash_krw?: number | null;
  alloc_gold_g?: number | null;
  alloc_silver_g?: number | null;
  alloc_value_krw?: number | null;
  alloc_labor_krw?: number | null;
  alloc_material_krw?: number | null;
  shipment_line_id?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  size?: string | null;
  invoice_occurred_at?: string | null;
};

type AdvancedAllocationMode = "GLOBAL_FIFO" | "TARGET_FIRST";

type PaymentAllocationPreviewLine = {
  arId: string;
  occurredAt: string | null;
  modelName: string;
  laborApplied: number;
  materialApplied: number;
};

type PaymentAllocationPreview = {
  laborAppliedTotal: number;
  materialAppliedTotal: number;
  remainingCash: number;
  lines: PaymentAllocationPreviewLine[];
};

type ShipmentValuationRow = {
  shipment_id?: string | null;
  pricing_locked_at?: string | null;
  pricing_source?: string | null;
  gold_krw_per_g_snapshot?: number | null;
  silver_krw_per_g_snapshot?: number | null;
  silver_adjust_factor_snapshot?: number | null;
  material_value_krw?: number | null;
  labor_value_krw?: number | null;
  total_value_krw?: number | null;
};

type ReturnResponse = {
  ok?: boolean;
  return_line_id?: string;
  auto_amount_krw?: number;
  final_amount_krw?: number;
  remaining_qty?: number;
};

type ArResyncResult = {
  ok?: boolean;
  shipment_id?: string;
  updated?: number;
  inserted?: number;
};

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

const isArInvoiceAnomaly = (row: ArInvoicePositionRow) => {
  if (row.material_code !== "999") return false;
  return (
    row.commodity_type === null ||
    Number(row.material_cash_due_krw ?? 0) === 0 ||
    Number(row.commodity_due_g ?? 0) === 0 ||
    Number(row.commodity_price_snapshot_krw_per_g ?? 0) === 0
  );
};

const isUnitPricingCashOnlyAr = (row: ArInvoicePositionRow) => {
  return (
    row.commodity_type == null &&
    Number(row.material_cash_due_krw ?? 0) === 0 &&
    Number(row.material_cash_outstanding_krw ?? 0) === 0 &&
    Number(row.commodity_due_g ?? 0) === 0 &&
    Number(row.commodity_outstanding_g ?? 0) === 0 &&
    Number(row.labor_cash_due_krw ?? 0) === Number(row.total_cash_due_krw ?? 0) &&
    Number(row.labor_cash_outstanding_krw ?? 0) === Number(row.total_cash_outstanding_krw ?? 0)
  );
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatKrwDashZero = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (Math.round(numeric) === 0) return "-";
  return formatKrw(numeric);
};

const formatGram = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  const formatted = new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(numeric);
  return `${formatted}g`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const formatTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
};

const splitDateTimeKst = (value?: string | null) => {
  const full = formatTimeKst(value);
  if (full === "-") return { date: "-", time: "-" };
  const [date, time] = full.split(" ");
  return { date: date ?? "-", time: time ?? "-" };
};

const getMaterialCodeToneClass = (materialCode?: string | null) => {
  const code = (materialCode ?? "").trim();
  if (code === "14" || code === "18" || code === "24") return "text-yellow-600 dark:text-yellow-300";
  if (code === "925" || code === "999") return "text-emerald-600 dark:text-emerald-400";
  return "text-amber-700 dark:text-amber-300";
};

const buildPaymentAllocationPreview = (args: {
  rows: ArInvoicePositionRow[];
  cashValue: number;
  allowCashForMaterial: boolean;
  mode: AdvancedAllocationMode;
  targetArIds: string[];
}): PaymentAllocationPreview => {
  const { rows, cashValue, allowCashForMaterial, mode, targetArIds } = args;
  const targetSet = new Set(targetArIds);
  const sortable = rows
    .filter((row) => Number(row.total_cash_outstanding_krw ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const aTarget = mode === "TARGET_FIRST" && targetSet.has(a.ar_id ?? "") ? 0 : 1;
      const bTarget = mode === "TARGET_FIRST" && targetSet.has(b.ar_id ?? "") ? 0 : 1;
      if (aTarget !== bTarget) return aTarget - bTarget;
      const aTime = new Date(a.occurred_at ?? 0).getTime();
      const bTime = new Date(b.occurred_at ?? 0).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return String(a.ar_id ?? "").localeCompare(String(b.ar_id ?? ""));
    });

  let remainingCash = Math.max(cashValue, 0);
  const lines = new Map<string, PaymentAllocationPreviewLine>();

  const ensureLine = (row: ArInvoicePositionRow) => {
    const arId = row.ar_id ?? "";
    const prev = lines.get(arId);
    if (prev) return prev;
    const created: PaymentAllocationPreviewLine = {
      arId,
      occurredAt: row.occurred_at ?? null,
      modelName: [row.model_name, row.suffix, row.color, row.size].filter(Boolean).join(" / ") || "-",
      laborApplied: 0,
      materialApplied: 0,
    };
    lines.set(arId, created);
    return created;
  };

  for (const row of sortable) {
    if (remainingCash <= 0) break;
    const laborOutstanding = Math.max(Number(row.labor_cash_outstanding_krw ?? 0), 0);
    if (laborOutstanding <= 0) continue;
    const applied = Math.min(remainingCash, laborOutstanding);
    const line = ensureLine(row);
    line.laborApplied += applied;
    remainingCash -= applied;
  }

  if (allowCashForMaterial) {
    for (const row of sortable) {
      if (remainingCash <= 0) break;
      const materialOutstanding = Math.max(Number(row.material_cash_outstanding_krw ?? 0), 0);
      if (materialOutstanding <= 0) continue;
      const applied = Math.min(remainingCash, materialOutstanding);
      const line = ensureLine(row);
      line.materialApplied += applied;
      remainingCash -= applied;
    }
  }

  const previewLines = Array.from(lines.values()).sort((a, b) => {
    const aTarget = mode === "TARGET_FIRST" && targetSet.has(a.arId) ? 0 : 1;
    const bTarget = mode === "TARGET_FIRST" && targetSet.has(b.arId) ? 0 : 1;
    if (aTarget !== bTarget) return aTarget - bTarget;
    return new Date(a.occurredAt ?? 0).getTime() - new Date(b.occurredAt ?? 0).getTime();
  });

  return {
    laborAppliedTotal: previewLines.reduce((sum, row) => sum + row.laborApplied, 0),
    materialAppliedTotal: previewLines.reduce((sum, row) => sum + row.materialApplied, 0),
    remainingCash,
    lines: previewLines,
  };
};

const toKstInputValue = (withSeconds = false) => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const hours = String(kst.getHours()).padStart(2, '0');
  const minutes = String(kst.getMinutes()).padStart(2, '0');
  const seconds = String(kst.getSeconds()).padStart(2, '0');
  return withSeconds
    ? `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    : `${year}-${month}-${day}T${hours}:${minutes}`;
};

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

type AmountPillProps = {
  amount?: number | null;
  className?: string;
  simple?: boolean;
};

const AmountPill = ({ amount, className, simple }: AmountPillProps) => {
  if (amount === null || amount === undefined) {
    return <span className={cn("text-[var(--muted)]", className)}>-</span>;
  }
  const numeric = Number(amount);
  const tone =
    numeric > 0
      ? "text-[var(--primary)]"
      : numeric < 0
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";

  if (simple) {
    if (Math.round(numeric) === 0) {
      return <span className={cn("tabular-nums font-medium text-[var(--muted)]", className)}>-</span>;
    }
    const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
    const abs = Math.abs(Math.round(numeric));
    return (
      <span className={cn("tabular-nums font-medium", tone, className)}>
        {`${sign}₩${new Intl.NumberFormat("ko-KR").format(abs)}`}
      </span>
    )
  }

  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  const abs = Math.abs(Math.round(numeric));

  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums font-semibold", tone, className)}
    >
      {`${sign}₩${new Intl.NumberFormat("ko-KR").format(abs)}`}
    </span>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export default function ArPage() {
  const schemaClient = getSchemaClient();
  const advancedAllocationEnabled = process.env.NEXT_PUBLIC_AR_TARGETED_ALLOC_ENABLED === "true";
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  // Tabs for the right pane
  const [activeTab, setActiveTab] = useState<"ledger" | "invoice" | "action">("ledger");
  const [actionTab, setActionTab] = useState<
    "payment" | "return" | "offset" | "adjust_down" | "adjust_up"
  >("payment");

  // Selection
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  // Forms State
  const [paidAt, setPaidAt] = useState(() => toKstInputValue(true));
  const [paymentMemo, setPaymentMemo] = useState("");
  const [paymentCashKrw, setPaymentCashKrw] = useState("");
  const [paymentGoldG, setPaymentGoldG] = useState("");
  const [paymentSilverG, setPaymentSilverG] = useState("");
  const [allowCashForMaterial, setAllowCashForMaterial] = useState(false);
  const [advancedAllocationMode, setAdvancedAllocationMode] = useState<AdvancedAllocationMode>("GLOBAL_FIFO");
  const [advancedTargetArIds, setAdvancedTargetArIds] = useState<string[]>([]);
  const [advancedAllocationConfirm, setAdvancedAllocationConfirm] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [isPaymentProofUploading, setIsPaymentProofUploading] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => crypto.randomUUID());

  const [returnShipmentLineId, setReturnShipmentLineId] = useState("");
  const [returnQty, setReturnQty] = useState("1");
  const [returnOccurredAt, setReturnOccurredAt] = useState(toKstInputValue);
  const [returnOverrideAmount, setReturnOverrideAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  // Manual AR actions (OFFSET / ADJUST)
  const [offsetOccurredAt, setOffsetOccurredAt] = useState(toKstInputValue);
  const [offsetCashKrw, setOffsetCashKrw] = useState("");
  const [offsetReasonCode, setOffsetReasonCode] = useState("OFFSET");
  const [offsetReasonDetail, setOffsetReasonDetail] = useState("");
  const [offsetIdempotencyKey, setOffsetIdempotencyKey] = useState(() => crypto.randomUUID());
  const [offsetConfirm, setOffsetConfirm] = useState(false);

  const [adjustDownOccurredAt, setAdjustDownOccurredAt] = useState(toKstInputValue);
  const [adjustDownCashKrw, setAdjustDownCashKrw] = useState("");
  const [adjustDownReasonCode, setAdjustDownReasonCode] = useState("ADJUST_DOWN");
  const [adjustDownReasonDetail, setAdjustDownReasonDetail] = useState("");
  const [adjustDownIdempotencyKey, setAdjustDownIdempotencyKey] = useState(() => crypto.randomUUID());
  const [adjustDownConfirm, setAdjustDownConfirm] = useState(false);

  const [adjustUpOccurredAt, setAdjustUpOccurredAt] = useState(toKstInputValue);
  const [adjustUpTotalCashKrw, setAdjustUpTotalCashKrw] = useState("");
  const [adjustUpLaborCashKrw, setAdjustUpLaborCashKrw] = useState("");
  const [adjustUpMaterialCashKrw, setAdjustUpMaterialCashKrw] = useState("");
  const [adjustUpReasonCode, setAdjustUpReasonCode] = useState("ADJUST_UP");
  const [adjustUpReasonDetail, setAdjustUpReasonDetail] = useState("");
  const [adjustUpIdempotencyKey, setAdjustUpIdempotencyKey] = useState(() => crypto.randomUUID());
  const [adjustUpConfirm, setAdjustUpConfirm] = useState(false);


  // 1. Fetch Parties
  const positionsQuery = useQuery({
    queryKey: ["cms", "ar_position"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPositionByParty)
        .select(
          "party_id, party_type, name, balance_krw, receivable_krw, credit_krw, last_activity_at, labor_cash_outstanding_krw, material_cash_outstanding_krw, total_cash_outstanding_krw, gold_outstanding_g, silver_outstanding_g"
        )
        .eq("party_type", "customer")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ArPositionRow[];
    },
  });

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);

  // Initialize selection
  const effectiveSelectedPartyId = selectedPartyId ?? positions[0]?.party_id ?? null;
  const selectedParty = useMemo(() => {
    return positions.find((row) => row.party_id === effectiveSelectedPartyId) ?? null;
  }, [positions, effectiveSelectedPartyId]);

  // Filter Logic
  const filteredParties = useMemo(() => {
    const filtered = positions.filter((row) => {
      const nameMatch = (row.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const balance = Number(row.balance_krw ?? 0);
      const balanceMatch = (() => {
        if (balanceFilter === "receivable") return balance > 0;
        if (balanceFilter === "credit") return balance < 0;
        if (balanceFilter === "nonzero") return balance !== 0;
        return true;
      })();
      return nameMatch && balanceMatch;
    });
    return [...filtered].sort((a, b) => {
      // Sort by receivable desc
      const balA = Number(a.balance_krw ?? 0);
      const balB = Number(b.balance_krw ?? 0);
      if (balA !== balB) return balB - balA;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko-KR");
    });
  }, [positions, searchQuery, balanceFilter]);

  // Summary Logic
  const summary = useMemo(() => {
    return positions.reduce(
      (acc, row) => {
        acc.balance += Number(row.balance_krw ?? 0);
        acc.receivable += Number(row.receivable_krw ?? 0);
        acc.credit += Number(row.credit_krw ?? 0);
        return acc;
      },
      { balance: 0, receivable: 0, credit: 0 }
    );
  }, [positions]);

  // 2. Fetch Ledger
  const ledgerQuery = useQuery({
    queryKey: ["cms", "ar_ledger", effectiveSelectedPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveSelectedPartyId) return [] as LedgerRow[];
      const { data, error } = await schemaClient
        .from("cms_ar_ledger")
        .select(
          "ar_ledger_id, party_id, occurred_at, created_at, entry_type, amount_krw, memo, shipment_id, shipment_line_id, payment_id, return_line_id"
        )
        .eq("party_id", effectiveSelectedPartyId)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
    enabled: Boolean(effectiveSelectedPartyId),
  });

  // 3. Fetch Invoices (Open Items)
  const invoicePositionsQuery = useQuery({
    queryKey: ["cms", "ar_invoice_position", effectiveSelectedPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveSelectedPartyId) return [] as ArInvoicePositionRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select(
          "ar_id, party_id, shipment_id, shipment_line_id, occurred_at, model_name, suffix, color, size, qty, material_code, labor_cash_due_krw, material_cash_due_krw, total_cash_due_krw, labor_cash_outstanding_krw, material_cash_outstanding_krw, total_cash_outstanding_krw, commodity_type, commodity_due_g, commodity_outstanding_g, commodity_price_snapshot_krw_per_g"
        )
        .eq("party_id", effectiveSelectedPartyId)
        .order("occurred_at", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ArInvoicePositionRow[];
    },
    enabled: Boolean(effectiveSelectedPartyId),
  });

  const displayOutstanding = useMemo(() => {
    if (!invoicePositionsQuery.data) {
      return {
        labor: Number(selectedParty?.labor_cash_outstanding_krw ?? 0),
        material: Number(selectedParty?.material_cash_outstanding_krw ?? 0),
        gold: Number(selectedParty?.gold_outstanding_g ?? 0),
        silver: Number(selectedParty?.silver_outstanding_g ?? 0),
      };
    }
    return invoicePositionsQuery.data.reduce(
      (acc, row) => {
        if (isUnitPricingCashOnlyAr(row)) return acc;
        acc.labor += Number(row.labor_cash_outstanding_krw ?? 0);
        acc.material += Number(row.material_cash_outstanding_krw ?? 0);
        if (row.commodity_type === "gold") {
          acc.gold += Number(row.commodity_outstanding_g ?? 0);
        }
        if (row.commodity_type === "silver") {
          acc.silver += Number(row.commodity_outstanding_g ?? 0);
        }
        return acc;
      },
      { labor: 0, material: 0, gold: 0, silver: 0 }
    );
  }, [invoicePositionsQuery.data, selectedParty]);

  const targetableInvoiceRows = useMemo(() => {
    return (invoicePositionsQuery.data ?? []).filter(
      (row) => Number(row.total_cash_outstanding_krw ?? 0) > 0
    );
  }, [invoicePositionsQuery.data]);

  useEffect(() => {
    const valid = new Set(targetableInvoiceRows.map((row) => row.ar_id ?? "").filter(Boolean));
    setAdvancedTargetArIds((prev) => prev.filter((id) => valid.has(id)));
  }, [targetableInvoiceRows]);

  // 4. Fetch Payment Details
  const paymentAllocQuery = useQuery({
    queryKey: ["cms", "ar_payment_alloc", effectiveSelectedPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveSelectedPartyId) return [] as ArPaymentAllocDetailRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPaymentAllocDetail)
        .select(
          "payment_id, paid_at, cash_krw, gold_g, silver_g, note, alloc_id, ar_id, alloc_cash_krw, alloc_gold_g, alloc_silver_g, alloc_value_krw, alloc_labor_krw, alloc_material_krw, shipment_line_id, model_name, suffix, color, size, invoice_occurred_at"
        )
        .eq("party_id", effectiveSelectedPartyId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ArPaymentAllocDetailRow[];
    },
    enabled: Boolean(effectiveSelectedPartyId),
  });

  // 5. Fetch Shipment Lines (For Return)
  const shipmentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_line", "ar", effectiveSelectedPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveSelectedPartyId) return [] as ShipmentLineRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, repair_line_id, qty, material_code, net_weight_g, total_amount_sell_krw, material_amount_sell_krw, labor_total_sell_krw, model_name, suffix, color, size, created_at, shipment_header:cms_shipment_header(ship_date, status, customer_party_id)"
        )
        .eq("shipment_header.customer_party_id", effectiveSelectedPartyId)
        .eq("shipment_header.status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
    },
    enabled: Boolean(effectiveSelectedPartyId),
  });

  // Derived Data for Returns
  const shipmentLines = useMemo(() => shipmentLinesQuery.data ?? [], [shipmentLinesQuery.data]);
  const shipmentModelNames = useMemo(() => {
    const names = new Set<string>();
    shipmentLines.forEach((line) => {
      const name = (line.model_name ?? "").trim();
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [shipmentLines]);

  const shipmentMasterQuery = useQuery({
    queryKey: ["cms", "shipment-master", shipmentModelNames.join("|")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (shipmentModelNames.length === 0) return [] as { model_name?: string | null; is_unit_pricing?: boolean | null }[];
      const { data, error } = await schemaClient
        .from("cms_master_item")
        .select("model_name, is_unit_pricing")
        .in("model_name", shipmentModelNames);
      if (error) throw error;
      return (data ?? []) as { model_name?: string | null; is_unit_pricing?: boolean | null }[];
    },
    enabled: Boolean(schemaClient) && shipmentModelNames.length > 0,
  });

  const isUnitPricingByModel = useMemo(() => {
    const map = new Map<string, boolean>();
    (shipmentMasterQuery.data ?? []).forEach((row) => {
      const name = (row.model_name ?? "").trim();
      if (!name) return;
      map.set(name, Boolean(row.is_unit_pricing));
    });
    return map;
  }, [shipmentMasterQuery.data]);

  const shipmentLineById = useMemo(() => {
    const map = new Map<string, ShipmentLineRow>();
    shipmentLines.forEach((line) => {
      if (!line.shipment_line_id) return;
      map.set(line.shipment_line_id, line);
    });
    return map;
  }, [shipmentLines]);
  const invoiceByShipmentLineId = useMemo(() => {
    const map = new Map<string, ArInvoicePositionRow>();
    (invoicePositionsQuery.data ?? []).forEach((row) => {
      const key = row.shipment_line_id ?? "";
      if (!key || map.has(key)) return;
      map.set(key, row);
    });
    return map;
  }, [invoicePositionsQuery.data]);
  const paymentMaterialByPaymentId = useMemo(() => {
    const map = new Map<string, { materialKrw: number; laborKrw: number; goldG: number; silverG: number }>();
    (paymentAllocQuery.data ?? []).forEach((row) => {
      const paymentId = row.payment_id ?? "";
      if (!paymentId) return;
      const prev = map.get(paymentId) ?? { materialKrw: 0, laborKrw: 0, goldG: 0, silverG: 0 };
      map.set(paymentId, {
        materialKrw: prev.materialKrw + Number(row.alloc_material_krw ?? 0),
        laborKrw: prev.laborKrw + Number(row.alloc_labor_krw ?? 0),
        goldG: prev.goldG + Number(row.alloc_gold_g ?? 0),
        silverG: prev.silverG + Number(row.alloc_silver_g ?? 0),
      });
    });
    return map;
  }, [paymentAllocQuery.data]);
  const shipmentLineIds = useMemo(
    () => shipmentLines.map((line) => line.shipment_line_id).filter(Boolean) as string[],
    [shipmentLines]
  );
  const returnLinesQuery = useQuery({
    queryKey: ["cms", "return_line", shipmentLineIds.join(",")],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (shipmentLineIds.length === 0) return [] as ReturnLineRow[];
      const { data, error } = await schemaClient
        .from("cms_return_line")
        .select("shipment_line_id, return_qty")
        .in("shipment_line_id", shipmentLineIds);
      if (error) throw error;
      return (data ?? []) as ReturnLineRow[];
    },
    enabled: shipmentLineIds.length > 0,
  });

  const returnedQtyByLine = useMemo(() => {
    const map = new Map<string, number>();
    (returnLinesQuery.data ?? []).forEach((row) => {
      if (!row.shipment_line_id) return;
      const current = map.get(row.shipment_line_id) ?? 0;
      map.set(row.shipment_line_id, current + Number(row.return_qty ?? 0));
    });
    return map;
  }, [returnLinesQuery.data]);

  const remainingQtyByLine = useMemo(() => {
    const map = new Map<string, number>();
    shipmentLines.forEach((line) => {
      if (!line.shipment_line_id) return;
      const returned = returnedQtyByLine.get(line.shipment_line_id) ?? 0;
      const remaining = Math.max(Number(line.qty ?? 0) - returned, 0);
      map.set(line.shipment_line_id, remaining);
    });
    return map;
  }, [shipmentLines, returnedQtyByLine]);

  const shipmentLineOptions = useMemo(() => {
    return shipmentLines
      .filter((line) => {
        if (!line.shipment_line_id) return false;
        const remaining = remainingQtyByLine.get(line.shipment_line_id) ?? 0;
        return remaining > 0;
      })
      .map((line) => {
        const shipDate = line.shipment_header?.ship_date
          ? line.shipment_header?.ship_date.slice(0, 10)
          : "-";
        const nameParts = [line.model_name, line.suffix, line.color, line.size].filter(Boolean);
        const label = `${shipDate} · ${nameParts.join(" / ")} · ${line.qty ?? 0}개 남음`;
        return { label, value: line.shipment_line_id ?? "" };
      });
  }, [shipmentLines, remainingQtyByLine]);

  // Mutations
  const paymentMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.arApplyPaymentFifo,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      setPaymentMemo("");
      setPaymentCashKrw("");
      setPaymentGoldG("");
      setPaymentSilverG("");
      setAllowCashForMaterial(false);
      setAdvancedAllocationMode("GLOBAL_FIFO");
      setAdvancedTargetArIds([]);
      setAdvancedAllocationConfirm(false);
      setPaymentProofFile(null);
      setPaidAt(toKstInputValue(true));
      setPaymentIdempotencyKey(crypto.randomUUID());
    },
  });

  const paymentAdvancedMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.arApplyPaymentFifoAdvanced,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      setPaymentMemo("");
      setPaymentCashKrw("");
      setPaymentGoldG("");
      setPaymentSilverG("");
      setAllowCashForMaterial(false);
      setAdvancedAllocationMode("GLOBAL_FIFO");
      setAdvancedTargetArIds([]);
      setAdvancedAllocationConfirm(false);
      setPaymentProofFile(null);
      setPaidAt(toKstInputValue(true));
      setPaymentIdempotencyKey(crypto.randomUUID());
    },
  });

  const returnMutation = useMutation({
    mutationFn: (params: Record<string, unknown>) => callRpc<ReturnResponse>(CONTRACTS.functions.recordReturn, params),
    onSuccess: () => {
      toast.success("반품 등록 완료");
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      shipmentLinesQuery.refetch();
      returnLinesQuery.refetch();
      setReturnQty("1");
      setReturnOverrideAmount("");
      setReturnReason("");
      setReturnShipmentLineId("");
      setReturnOccurredAt(toKstInputValue());
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요";
      toast.error("처리 실패", { description: message });
    }
  });
  const offsetMutation = useRpcMutation<{
    ok?: boolean;
    action_id?: string | null;
    applied_cash_krw?: number | null;
    remaining_cash_krw?: number | null;
    message?: string | null;
  }>({
    fn: CONTRACTS.functions.arApplyOffsetFromUnallocatedCash,
    successMessage: "상계(OFFSET) 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      setOffsetOccurredAt(toKstInputValue());
      setOffsetCashKrw("");
      setOffsetReasonCode("OFFSET");
      setOffsetReasonDetail("");
      setOffsetIdempotencyKey(crypto.randomUUID());
      setOffsetConfirm(false);
    },
  });

  const adjustDownMutation = useRpcMutation<{
    ok?: boolean;
    action_id?: string;
    payment_id?: string;
    applied_cash_krw?: number | null;
  }>({
    fn: CONTRACTS.functions.arApplyAdjustmentDownFifo,
    successMessage: "조정-차감 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      setAdjustDownOccurredAt(toKstInputValue());
      setAdjustDownCashKrw("");
      setAdjustDownReasonCode("ADJUST_DOWN");
      setAdjustDownReasonDetail("");
      setAdjustDownIdempotencyKey(crypto.randomUUID());
      setAdjustDownConfirm(false);
    },
  });

  const adjustUpMutation = useRpcMutation<{
    ok?: boolean;
    action_id?: string;
    ar_id?: string;
    total_cash_due_krw?: number | null;
    labor_cash_due_krw?: number | null;
    material_cash_due_krw?: number | null;
  }>({
    fn: CONTRACTS.functions.arCreateAdjustmentUpInvoice,
    successMessage: "조정-증가(인보이스) 생성 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      invoicePositionsQuery.refetch();
      paymentAllocQuery.refetch();
      setAdjustUpOccurredAt(toKstInputValue());
      setAdjustUpTotalCashKrw("");
      setAdjustUpLaborCashKrw("");
      setAdjustUpMaterialCashKrw("");
      setAdjustUpReasonCode("ADJUST_UP");
      setAdjustUpReasonDetail("");
      setAdjustUpIdempotencyKey(crypto.randomUUID());
      setAdjustUpConfirm(false);
    },
  });

  // Action Logic
  const canSavePayment = isFnConfigured(CONTRACTS.functions.arApplyPaymentFifo);
  const parsedCash = Number(paymentCashKrw.replace(/,/g, ""));
  const parsedGold = Number(paymentGoldG.replace(/,/g, ""));
  const parsedSilver = Number(paymentSilverG.replace(/,/g, ""));
  const cashValue = Number.isFinite(parsedCash) ? parsedCash : 0;
  const goldValue = Number.isFinite(parsedGold) ? parsedGold : 0;
  const silverValue = Number.isFinite(parsedSilver) ? parsedSilver : 0;
  const hasPaymentValue = cashValue > 0 || goldValue > 0 || silverValue > 0;
  const isTargetFirstMode = advancedAllocationEnabled && advancedAllocationMode === "TARGET_FIRST";
  const requiresTargetSelection = isTargetFirstMode;
  const missingTargetSelection = requiresTargetSelection && advancedTargetArIds.length === 0;
  const requiresAdvancedConfirm = isTargetFirstMode;
  const missingAdvancedConfirm = requiresAdvancedConfirm && !advancedAllocationConfirm;
  const exceedsLaborCashWithoutMaterialAllowance =
    !allowCashForMaterial &&
    cashValue > 0 &&
    cashValue > Number(displayOutstanding.labor ?? 0) + 0.000001;
  const paymentSubmitting = paymentMutation.isPending || paymentAdvancedMutation.isPending;

  const canSubmitPayment =
    canSavePayment &&
    Boolean(effectiveSelectedPartyId) &&
    Boolean(paidAt) &&
    hasPaymentValue &&
    !exceedsLaborCashWithoutMaterialAllowance &&
    !missingTargetSelection &&
    !missingAdvancedConfirm &&
    !paymentSubmitting &&
    !isPaymentProofUploading;

  const paymentAllocationPreview = useMemo(
    () =>
      buildPaymentAllocationPreview({
        rows: invoicePositionsQuery.data ?? [],
        cashValue,
        allowCashForMaterial,
        mode: isTargetFirstMode ? "TARGET_FIRST" : "GLOBAL_FIFO",
        targetArIds: isTargetFirstMode ? advancedTargetArIds : [],
      }),
    [invoicePositionsQuery.data, cashValue, allowCashForMaterial, isTargetFirstMode, advancedTargetArIds]
  );

  const effectiveReturnShipmentLineId = useMemo(() => {
    if (!returnShipmentLineId) return "";
    const exists = shipmentLines.some(
      (line) => line.shipment_line_id === returnShipmentLineId
    );
    return exists ? returnShipmentLineId : "";
  }, [returnShipmentLineId, shipmentLines]);

  const parseNum = (s: string) => {
    const n = Number((s ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const parseOptNum = (s: string) => {
    const t = (s ?? "").replace(/,/g, "").trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const canSaveReturn = isFnConfigured(CONTRACTS.functions.recordReturn);
  const selectedReturnLine = shipmentLines.find(l => l.shipment_line_id === effectiveReturnShipmentLineId);
  const returnedBefore = selectedReturnLine?.shipment_line_id ? returnedQtyByLine.get(selectedReturnLine.shipment_line_id) ?? 0 : 0;
  const qtyRemains = Math.max(Number(selectedReturnLine?.qty ?? 0) - returnedBefore, 0);
  const parsedReturnQty = parseNum(returnQty);

  const canSubmitReturn =
    canSaveReturn &&
    Boolean(effectiveSelectedPartyId) &&
    Boolean(effectiveReturnShipmentLineId) &&
    Boolean(returnOccurredAt) &&
    parsedReturnQty > 0 &&
    parsedReturnQty <= qtyRemains &&
    !returnMutation.isPending;
  // OFFSET
  const canSaveOffset = isFnConfigured(CONTRACTS.functions.arApplyOffsetFromUnallocatedCash);
  const offsetCashValue = parseNum(offsetCashKrw);
  const canSubmitOffset =
    canSaveOffset &&
    Boolean(effectiveSelectedPartyId) &&
    Boolean(offsetOccurredAt) &&
    offsetCashValue > 0 &&
    offsetReasonCode.trim().length > 0 &&
    offsetReasonDetail.trim().length > 0 &&
    offsetConfirm &&
    !offsetMutation.isPending;

  // ADJUST_DOWN
  const canSaveAdjustDown = isFnConfigured(CONTRACTS.functions.arApplyAdjustmentDownFifo);
  const adjustDownCashValue = parseNum(adjustDownCashKrw);
  const canSubmitAdjustDown =
    canSaveAdjustDown &&
    Boolean(effectiveSelectedPartyId) &&
    Boolean(adjustDownOccurredAt) &&
    adjustDownCashValue > 0 &&
    adjustDownReasonCode.trim().length > 0 &&
    adjustDownReasonDetail.trim().length > 0 &&
    adjustDownConfirm &&
    !adjustDownMutation.isPending;

  // ADJUST_UP (split 자동 보정)
  const canSaveAdjustUp = isFnConfigured(CONTRACTS.functions.arCreateAdjustmentUpInvoice);
  const adjustUpTotalValue = parseNum(adjustUpTotalCashKrw);
  const laborIn = parseOptNum(adjustUpLaborCashKrw);
  const materialIn = parseOptNum(adjustUpMaterialCashKrw);

  let adjustUpLaborFinal = 0;
  let adjustUpMaterialFinal = 0;
  let adjustUpSplitOk = false;

  if (adjustUpTotalValue > 0) {
    if (laborIn === null && materialIn === null) {
      adjustUpLaborFinal = adjustUpTotalValue;
      adjustUpMaterialFinal = 0;
      adjustUpSplitOk = true;
    } else if (laborIn !== null && materialIn !== null) {
      adjustUpLaborFinal = laborIn;
      adjustUpMaterialFinal = materialIn;
      adjustUpSplitOk = Math.abs(adjustUpLaborFinal + adjustUpMaterialFinal - adjustUpTotalValue) < 0.0001;
    } else if (laborIn !== null) {
      adjustUpLaborFinal = laborIn;
      adjustUpMaterialFinal = adjustUpTotalValue - adjustUpLaborFinal;
      adjustUpSplitOk = adjustUpMaterialFinal >= 0;
    } else if (materialIn !== null) {
      adjustUpMaterialFinal = materialIn;
      adjustUpLaborFinal = adjustUpTotalValue - adjustUpMaterialFinal;
      adjustUpSplitOk = adjustUpLaborFinal >= 0;
    }
  }

  const canSubmitAdjustUp =
    canSaveAdjustUp &&
    Boolean(effectiveSelectedPartyId) &&
    Boolean(adjustUpOccurredAt) &&
    adjustUpTotalValue > 0 &&
    adjustUpSplitOk &&
    adjustUpReasonCode.trim().length > 0 &&
    adjustUpReasonDetail.trim().length > 0 &&
    adjustUpConfirm &&
    !adjustUpMutation.isPending;

  // Render Helpers
  const renderSidebarItem = (party: ArPositionRow) => {
    const isSelected = party.party_id === effectiveSelectedPartyId;
    return (
      <button
        key={party.party_id}
        onClick={() => setSelectedPartyId(party.party_id ?? null)}
        className={cn(
          "w-full text-left p-3 rounded-lg transition-all border group relative",
          isSelected
            ? "bg-[var(--chip)] border-[var(--primary)] shadow-sm"
            : "border-transparent hover:bg-[var(--panel-hover)]"
        )}
      >
        <div className="flex justify-between items-start mb-1">
          <span className={cn("font-bold text-sm truncate pr-2", isSelected ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>{party.name}</span>
          <span className={cn("text-xs font-medium tabular-nums", Number(party.balance_krw) > 0 ? "text-[var(--danger)]" : "text-[var(--muted)]")}>
            {formatKrw(party.balance_krw)}
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px] text-[var(--muted)]">
          <span>미수 {formatKrw(party.receivable_krw)}</span>
          <span>{formatGram(party.gold_outstanding_g)} / {formatGram(party.silver_outstanding_g)}</span>
        </div>
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary)] rounded-l-lg" />
        )}
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]">
      {/* LEFT SIDEBAR */}
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        {/* Search Header */}
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search className="w-5 h-5" />
            거래처 찾기
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <Input
              placeholder="상호명 검색..."
              className="pl-9 bg-[var(--chip)] border-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {['all', 'receivable', 'nonzero'].map(filter => (
              <button
                key={filter}
                onClick={() => setBalanceFilter(filter)}
                className={cn(
                  "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors border",
                  balanceFilter === filter
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
                )}
              >
                {filter === 'all' && '전체'}
                {filter === 'receivable' && '미수'}
                {filter === 'nonzero' && '잔액보유'}
              </button>
            ))}
          </div>
        </div>

        {/* Global Compact Summary */}
        <div className="px-4 py-3 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">전체 미수금</span>
          <span className="font-bold text-[var(--foreground)]">{formatKrw(summary.receivable)}</span>
        </div>

        {/* Dealer List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {positionsQuery.isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 border border-transparent">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : filteredParties.length > 0 ? (
            filteredParties.map(renderSidebarItem)
          ) : (
            <div className="p-8 text-center text-[var(--muted)] text-sm">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        {selectedParty ? (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold tracking-tight">{selectedParty.name}</h1>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-medium">
                      {selectedParty.party_type}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)] flex items-center gap-2">
                    마지막 활동: {formatDateTimeKst(selectedParty.last_activity_at)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  positionsQuery.refetch();
                  ledgerQuery.refetch();
                  invoicePositionsQuery.refetch();
                }}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  새로고침
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-5 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">총 미수금</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--danger)]">{formatKrw(selectedParty.receivable_krw)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">금 잔액</p>
                  <p className="text-lg font-bold tabular-nums">{formatGram(displayOutstanding.gold)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">은 잔액</p>
                  <p className="text-lg font-bold tabular-nums">{formatGram(displayOutstanding.silver)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">공임 잔액</p>
                  <p className="text-lg font-bold tabular-nums">{formatKrw(displayOutstanding.labor)}</p>
                </div>
                <div className="border-l border-[var(--panel-border)] pl-4">
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">자재/공임 구분</p>
                  <div className="text-sm space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">소재</span>
                      <span className="font-medium">{formatKrw(displayOutstanding.material)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">공임</span>
                      <span className="font-medium">{formatKrw(displayOutstanding.labor)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--panel-border)] px-6 bg-[var(--panel)] sticky top-0">
              <button
                onClick={() => setActiveTab('ledger')}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'ledger'
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                거래 원장
              </button>
              <button
                onClick={() => setActiveTab('invoice')}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'invoice'
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                미수 잔액 (FIFO)
              </button>
              <button
                onClick={() => setActiveTab('action')}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'action'
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                수금/반품 처리
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'ledger' && (
                <Card className="min-h-[500px] shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs table-fixed">
                      <thead className="bg-[var(--chip)] text-[var(--muted)] font-medium border-b border-[var(--panel-border)]">
                        <tr>
                          <th className="px-4 py-3 whitespace-nowrap w-[140px]">날짜</th>
                          <th className="px-4 py-3 whitespace-nowrap w-[80px]">구분</th>
                          <th className="px-4 py-3 whitespace-nowrap w-[240px]">내용</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right w-[120px]">총금액</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right font-bold w-[280px]">소재가격(판매/결제)</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right w-[100px]">총공임</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {ledgerQuery.isLoading ? (
                          <tr><td colSpan={6} className="p-8 text-center"><Skeleton className="h-4 w-32 mx-auto" /></td></tr>
                        ) : (ledgerQuery.data ?? []).map((row, index, rows) => {
                          const isShipment = row.entry_type === "SHIPMENT";
                          const isPayment = (row.entry_type ?? "").toUpperCase().includes("PAYMENT");
                          const currentDateKey = formatTimeKst(row.occurred_at).slice(0, 10);
                          const prevDateKey = index > 0 ? formatTimeKst(rows[index - 1]?.occurred_at).slice(0, 10) : "";
                          const isNewDateGroup = index > 0 && currentDateKey !== prevDateKey;
                          const shipmentLine = row.shipment_line_id
                            ? shipmentLineById.get(row.shipment_line_id)
                            : undefined;
                          const shipmentLabel = [shipmentLine?.model_name, shipmentLine?.suffix, shipmentLine?.color, shipmentLine?.size]
                            .filter(Boolean)
                            .join(" /");
                          const modelName = (shipmentLine?.model_name ?? "").trim();
                          const isRepairLine = Boolean(shipmentLine?.repair_line_id);
                          const memoText = (row.memo ?? "").trim();
                          const modelMeta = [shipmentLine?.suffix, shipmentLine?.color, shipmentLine?.size]
                            .filter(Boolean)
                            .join(" /");
                          const shipmentContentText = isRepairLine
                            ? `[수리] | ${modelName || shipmentLabel || "-"} | ${memoText || "-"}`
                            : `${modelName || shipmentLabel || row.memo || "-"}${modelName && modelMeta ? ` / ${modelMeta}` : ""}`;
                          const returnContentText = `[${isRepairLine ? "수리" : "반품"}] | ${modelName || shipmentLabel || "-"} | ${memoText || "-"}`;
                          const invoice = row.shipment_line_id
                            ? invoiceByShipmentLineId.get(row.shipment_line_id)
                            : undefined;
                          const unitOnly = shipmentLine
                            ? isUnitPricingByModel.get((shipmentLine.model_name ?? "").trim()) ?? false
                            : false;
                          const paymentMaterial = row.payment_id
                            ? paymentMaterialByPaymentId.get(row.payment_id)
                            : undefined;
                          const convertedWeight = Number(invoice?.commodity_due_g ?? 0);
                          const originalWeight = Number(shipmentLine?.net_weight_g ?? 0);
                          const materialCode = (invoice?.material_code ?? shipmentLine?.material_code ?? "").trim();
                          const paymentMaterialKrwLabel = formatKrwDashZero(paymentMaterial?.materialKrw ?? 0);
                          const paymentLaborKrwLabel = formatKrwDashZero(paymentMaterial?.laborKrw ?? 0);
                          const materialSellKrwLabel = formatKrwDashZero(shipmentLine?.material_amount_sell_krw ?? null);
                          const laborSellKrwLabel = formatKrwDashZero(shipmentLine?.labor_total_sell_krw ?? null);
                          const isReturn = row.entry_type === "RETURN";
                          const entryLabel = isShipment
                            ? "매출"
                            : isPayment
                              ? "결제"
                              : isReturn
                                ? "반품"
                                : row.entry_type;
                          const entryToneClass = isShipment
                            ? "border-[var(--primary)] bg-[var(--chip)] text-red-700 font-bold"
                            : isReturn
                              ? "border-[var(--primary)] bg-[var(--chip)] text-blue-700 font-bold"
                              : isPayment
                                ? "border-[var(--primary)] bg-[var(--chip)] text-[var(--primary)]"
                                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]";
                          const displayTotalAmount = isShipment && unitOnly
                            ? shipmentLine?.total_amount_sell_krw ?? row.amount_krw
                            : row.amount_krw;
                          return (
                            <tr
                              key={row.ar_ledger_id}
                              className={cn(
                                "hover:bg-[var(--panel-hover)] transition-colors cursor-pointer",
                                isNewDateGroup && "border-t-2 border-[var(--panel-border)]"
                              )}
                              onClick={() => setSelectedLedgerId(row.ar_ledger_id ?? null)}
                            >
                              <td className="px-4 py-3 tabular-nums">
                                {(() => {
                                  const dt = splitDateTimeKst(row.occurred_at);
                                  return (
                                    <span className="inline-flex flex-col items-start leading-tight">
                                      <span className="font-bold text-[var(--foreground)]">{dt.date}</span>
                                      <span className="text-[11px] text-[var(--muted)]">{dt.time}</span>
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "inline-flex items-center rounded border px-2.5 py-1 text-[11px] font-extrabold tracking-wide",
                                  entryToneClass
                                )}>
                                  {entryLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[var(--foreground)]">
                                {isShipment ? (
                                  <span className="block truncate whitespace-nowrap">{shipmentContentText}</span>
                                ) : isReturn ? (
                                  <span className="block truncate whitespace-nowrap">{returnContentText}</span>
                                ) : (
                                  <span className="block truncate whitespace-nowrap">{row.memo || "-"}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <AmountPill
                                  amount={displayTotalAmount}
                                  simple
                                  className={cn(
                                    "font-black",
                                    isShipment
                                      ? "text-red-600 dark:text-red-400"
                                      : isReturn
                                        ? "text-blue-600 dark:text-blue-400"
                                        : isPayment
                                          ? "text-[var(--primary)]"
                                          : ""
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold w-[280px] max-w-[280px]">
                                {isPayment ? (
                                  paymentMaterialKrwLabel === "-" ? "-" : (
                                    <div className="flex flex-col items-end">
                                      <span className="truncate whitespace-nowrap">{paymentMaterialKrwLabel}</span>
                                      {(paymentMaterial?.goldG || paymentMaterial?.silverG) && (
                                        <span className="text-[10px] text-[var(--foreground)] font-normal">
                                          <span className="text-[var(--muted)]">(</span>
                                          {paymentMaterial.goldG ? (
                                            <>
                                              <span className="text-[var(--muted)]">금</span> {formatGram(paymentMaterial.goldG)}
                                            </>
                                          ) : null}
                                          {paymentMaterial.goldG && paymentMaterial.silverG ? " " : ""}
                                          {paymentMaterial.silverG ? (
                                            <>
                                              <span className="text-[var(--muted)]">은</span> {formatGram(paymentMaterial.silverG)}
                                            </>
                                          ) : null}
                                          <span className="text-[var(--muted)]">)</span>
                                        </span>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  unitOnly || materialSellKrwLabel === "-" ? "-" : (
                                    <span className="inline-flex max-w-full items-center justify-end gap-1 overflow-hidden whitespace-nowrap leading-tight">
                                      <span className="shrink-0">{materialSellKrwLabel}</span>
                                      <span className="truncate text-[var(--foreground)]">
                                        <span className={getMaterialCodeToneClass(materialCode)}>(</span>
                                        <span className={getMaterialCodeToneClass(materialCode)}>{materialCode || "-"}</span>
                                        <span>, {formatGram(originalWeight)}, {formatGram(convertedWeight)}</span>
                                        <span className={getMaterialCodeToneClass(materialCode)}>)</span>
                                      </span>
                                    </span>
                                  )
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {isPayment ? (
                                  paymentLaborKrwLabel
                                ) : unitOnly ? (
                                  "-"
                                ) : laborSellKrwLabel}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {(!ledgerQuery.isLoading && (ledgerQuery.data?.length === 0)) && (
                      <div className="p-12 text-center text-[var(--muted)]">내역이 없습니다.</div>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'invoice' && (
                <Card className="min-h-[500px] shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--chip)] text-[var(--muted)] font-medium border-b border-[var(--panel-border)]">
                        <tr>
                          <th className="px-4 py-3 whitespace-nowrap">발생일</th>
                          <th className="px-4 py-3 whitespace-nowrap">모델</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">공임잔액</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">소재잔액</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">금/은 잔액</th>
                          <th className="px-4 py-3 whitespace-nowrap text-right">합계</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {invoicePositionsQuery.data && invoicePositionsQuery.data
                          .filter(row => row.total_cash_outstanding_krw! > 0 || row.commodity_outstanding_g! > 0)
                          .map(row => {
                            const unitOnly = isUnitPricingCashOnlyAr(row);
                            return (
                              <tr key={row.ar_id} className="hover:bg-[var(--panel-hover)]">
                                <td className="px-4 py-3 text-[var(--muted)] tabular-nums">{formatTimeKst(row.occurred_at)}</td>
                                <td className="px-4 py-3 font-medium">
                                  {row.model_name}
                                  <span className="text-[var(--muted)] font-normal ml-1">
                                    {[row.suffix, row.color, row.size].filter(Boolean).join('/')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  {unitOnly ? "-" : formatKrw(row.labor_cash_outstanding_krw)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  {unitOnly ? "-" : formatKrw(row.material_cash_outstanding_krw)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                                  {unitOnly
                                    ? "-"
                                    : row.commodity_type === 'gold' ? `금 ${formatGram(row.commodity_outstanding_g)}` :
                                      row.commodity_type === 'silver' ? `은 ${formatGram(row.commodity_outstanding_g)}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-bold text-[var(--danger)]">
                                  {formatKrw(row.total_cash_outstanding_krw)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {activeTab === 'action' && (
                <div className="flex flex-col lg:flex-row gap-6 min-h-full">
                  {/* Action Panel */}
                  <Card className="flex-1 shadow-sm border-2 border-[var(--panel-border)]">
                    <CardHeader className="border-b border-[var(--panel-border)] p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={actionTab === "payment" ? "primary" : "secondary"}
                          onClick={() => setActionTab("payment")}
                        >
                          <Wallet className="w-4 h-4 mr-2" /> 수금 등록
                        </Button>

                        <Button
                          variant={actionTab === "return" ? "primary" : "secondary"}
                          onClick={() => setActionTab("return")}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> 반품 등록
                        </Button>

                        <Button
                          variant={actionTab === "offset" ? "primary" : "secondary"}
                          onClick={() => setActionTab("offset")}
                        >
                          <Check className="w-4 h-4 mr-2" /> 상계(OFFSET)
                        </Button>

                        <Button
                          variant={actionTab === "adjust_down" ? "primary" : "secondary"}
                          onClick={() => setActionTab("adjust_down")}
                        >
                          <ArrowDownLeft className="w-4 h-4 mr-2" /> 조정-차감
                        </Button>

                        <Button
                          className="col-span-2"
                          variant={actionTab === "adjust_up" ? "primary" : "secondary"}
                          onClick={() => setActionTab("adjust_up")}
                        >
                          <ArrowUpRight className="w-4 h-4 mr-2" /> 조정-증가
                        </Button>
                      </div>
                    </CardHeader>

                    <CardBody className="p-6">
                      {/* 1) 수금 */}
                      {actionTab === "payment" && (
                        <form
                          className="space-y-6"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!canSubmitPayment) {
                              if (exceedsLaborCashWithoutMaterialAllowance) {
                                toast.error("수금 등록 실패", {
                                  description: `소재 현금 허용이 꺼져 있어 현금은 공임(${formatKrw(displayOutstanding.labor)})까지만 결제할 수 있습니다.`,
                                });
                              }
                              if (missingTargetSelection) {
                                toast.error("수금 등록 실패", {
                                  description: "대상 우선 배분 모드에서는 최소 1개 송장을 선택해야 합니다.",
                                });
                              }
                              if (missingAdvancedConfirm) {
                                toast.error("수금 등록 실패", {
                                  description: "고급 배분 확인 체크를 완료해야 진행할 수 있습니다.",
                                });
                              }
                              return;
                            }
                            let resolvedNote = paymentMemo.trim();
                            const paidAtIso = new Date().toISOString();
                            setPaidAt(toKstInputValue(true));

                            try {
                              if (paymentProofFile && effectiveSelectedPartyId) {
                                setIsPaymentProofUploading(true);
                                const formData = new FormData();
                                formData.append("party_id", effectiveSelectedPartyId);
                                formData.append("idempotency_key", paymentIdempotencyKey);
                                formData.append("file", paymentProofFile);

                                const uploadRes = await fetch("/api/ar-payment-image-upload", {
                                  method: "POST",
                                  body: formData,
                                });
                                const uploadJson = await uploadRes.json().catch(() => ({}));
                                if (!uploadRes.ok) {
                                  const message =
                                    typeof uploadJson?.error === "string"
                                      ? uploadJson.error
                                      : "수금 증빙 업로드 실패";
                                  throw new Error(message);
                                }

                                const uploadedPath =
                                  typeof uploadJson?.path === "string" ? uploadJson.path : "";
                                if (uploadedPath) {
                                  const attachmentLine = `[수금증빙] ${uploadedPath}`;
                                  resolvedNote = resolvedNote
                                    ? `${resolvedNote}\n${attachmentLine}`
                                    : attachmentLine;
                                }
                              }

                              if (isTargetFirstMode) {
                                await paymentAdvancedMutation.mutateAsync({
                                  p_party_id: effectiveSelectedPartyId,
                                  p_paid_at: paidAtIso,
                                  p_cash_krw: cashValue,
                                  p_gold_g: goldValue,
                                  p_silver_g: silverValue,
                                  p_allow_cash_for_material: allowCashForMaterial,
                                  p_allocation_mode: "TARGET_FIRST",
                                  p_target_ar_ids: advancedTargetArIds,
                                  p_idempotency_key: paymentIdempotencyKey,
                                  p_note: resolvedNote || null,
                                });
                              } else {
                                await paymentMutation.mutateAsync({
                                  p_party_id: effectiveSelectedPartyId,
                                  p_paid_at: paidAtIso,
                                  p_cash_krw: cashValue,
                                  p_gold_g: goldValue,
                                  p_silver_g: silverValue,
                                  p_allow_cash_for_material: allowCashForMaterial,
                                  p_idempotency_key: paymentIdempotencyKey,
                                  p_note: resolvedNote || null,
                                });
                              }
                            } catch (error) {
                              const message = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요";
                              toast.error("수금 등록 실패", { description: message });
                            } finally {
                              setIsPaymentProofUploading(false);
                            }
                          }}
                        >
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">수금일시</label>
                            <Input type="datetime-local" step={1} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 col-span-2">
                              <label className="text-xs font-semibold text-[var(--muted)]">현금 (KRW)</label>
                              <Input
                                inputMode="numeric"
                                className="text-right text-lg font-bold"
                                value={paymentCashKrw}
                                onChange={(e) => setPaymentCashKrw(e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">금 (g)</label>
                              <Input
                                inputMode="decimal"
                                className="text-right"
                                value={paymentGoldG}
                                onChange={(e) => setPaymentGoldG(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">은 (g)</label>
                              <Input
                                inputMode="decimal"
                                className="text-right"
                                value={paymentSilverG}
                                onChange={(e) => setPaymentSilverG(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">메모</label>
                            <Textarea value={paymentMemo} onChange={(e) => setPaymentMemo(e.target.value)} placeholder="메모 입력" className="resize-none" />
                          </div>

                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={allowCashForMaterial}
                              onChange={(e) => setAllowCashForMaterial(e.target.checked)}
                            />
                            <span className="text-[var(--muted)]">소재 현금 허용 (기본 OFF, 공임 소진 후 FIFO 적용)</span>
                          </label>
                          {advancedAllocationEnabled ? (
                            <div className="space-y-2 rounded border border-[var(--panel-border)] bg-[var(--chip)] p-3">
                              <div className="text-xs font-semibold text-[var(--muted)]">고급 배분 모드 (제한 개방)</div>
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={advancedAllocationMode === "TARGET_FIRST"}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAdvancedAllocationMode("TARGET_FIRST");
                                    } else {
                                      setAdvancedAllocationMode("GLOBAL_FIFO");
                                      setAdvancedTargetArIds([]);
                                      setAdvancedAllocationConfirm(false);
                                    }
                                  }}
                                />
                                <span className="text-[var(--muted)]">대상 우선 배분(TARGET_FIRST)</span>
                              </label>

                              {isTargetFirstMode ? (
                                <>
                                  <div className="max-h-40 overflow-y-auto rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-xs">
                                    {targetableInvoiceRows.length === 0 ? (
                                      <div className="text-[var(--muted)]">선택 가능한 미수 송장이 없습니다.</div>
                                    ) : (
                                      <div className="space-y-1">
                                        {targetableInvoiceRows.map((row) => {
                                          const arId = row.ar_id ?? "";
                                          const checked = advancedTargetArIds.includes(arId);
                                          const label = [row.model_name, row.suffix, row.color, row.size].filter(Boolean).join("/") || "-";
                                          return (
                                            <label key={arId} className="flex items-center justify-between gap-2">
                                              <span className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={(e) => {
                                                    setAdvancedTargetArIds((prev) =>
                                                      e.target.checked
                                                        ? Array.from(new Set([...prev, arId]))
                                                        : prev.filter((id) => id !== arId)
                                                    );
                                                  }}
                                                />
                                                <span className="truncate max-w-[240px]">{formatDateTimeKst(row.occurred_at)} · {label}</span>
                                              </span>
                                              <span className="tabular-nums text-[var(--muted)]">{formatKrw(row.total_cash_outstanding_krw)}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-xs space-y-1">
                                    <div className="font-semibold text-[var(--foreground)]">배분 프리뷰</div>
                                    <div className="text-[var(--muted)]">
                                      공임 {formatKrw(paymentAllocationPreview.laborAppliedTotal)} · 소재 {formatKrw(paymentAllocationPreview.materialAppliedTotal)} · 잔여현금 {formatKrw(paymentAllocationPreview.remainingCash)}
                                    </div>
                                    <div className="max-h-28 overflow-y-auto space-y-1">
                                      {paymentAllocationPreview.lines.map((line) => (
                                        <div key={line.arId} className="flex items-center justify-between gap-2">
                                          <span className="truncate">{line.modelName}</span>
                                          <span className="tabular-nums text-[var(--muted)]">공임 {formatKrw(line.laborApplied)} / 소재 {formatKrw(line.materialApplied)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={advancedAllocationConfirm}
                                      onChange={(e) => setAdvancedAllocationConfirm(e.target.checked)}
                                    />
                                    <span className="text-[var(--muted)]">기본 FIFO와 다른 결과가 될 수 있음을 확인했습니다.</span>
                                  </label>
                                </>
                              ) : (
                                <div className="text-xs text-[var(--muted)]">기본 GLOBAL FIFO 적용 중</div>
                              )}
                            </div>
                          ) : null}
                          {exceedsLaborCashWithoutMaterialAllowance ? (
                            <div className="text-xs text-[var(--danger)]">
                              현금 입력액이 공임 잔액({formatKrw(displayOutstanding.labor)})을 초과했습니다. 소재 현금 허용을 켜거나 현금액을 줄여주세요.
                            </div>
                          ) : null}
                          {missingTargetSelection ? (
                            <div className="text-xs text-[var(--danger)]">대상 우선 배분 모드에서는 최소 1개 송장을 선택해야 합니다.</div>
                          ) : null}
                          {missingAdvancedConfirm ? (
                            <div className="text-xs text-[var(--danger)]">고급 배분 확인 체크를 완료해야 제출할 수 있습니다.</div>
                          ) : null}

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--muted)]">수금 증빙 이미지</label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setPaymentProofFile(e.target.files?.[0] ?? null)}
                            />
                            {paymentProofFile && (
                              <div className="flex items-center justify-between rounded border border-[var(--panel-border)] bg-[var(--chip)] px-3 py-2 text-xs">
                                <span className="truncate pr-2">{paymentProofFile.name}</span>
                                <Button type="button" size="sm" variant="secondary" onClick={() => setPaymentProofFile(null)}>
                                  제거
                                </Button>
                              </div>
                            )}
                          </div>

                          <Button type="submit" size="lg" className="w-full" disabled={!canSubmitPayment}>
                            {isPaymentProofUploading ? "증빙 업로드 중..." : paymentSubmitting ? "처리 중..." : "수금 등록 완료"}
                          </Button>
                        </form>
                      )}

                      {/* 2) 반품 */}
                      {actionTab === "return" && (
                        <form
                          className="space-y-6"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!canSubmitReturn) return;
                            returnMutation.mutate({
                              p_shipment_line_id: effectiveReturnShipmentLineId,
                              p_return_qty: parsedReturnQty,
                              p_occurred_at: new Date(returnOccurredAt).toISOString(),
                              p_override_amount_krw: parseOptNum(returnOverrideAmount),
                              p_reason: returnReason || null,
                            });
                          }}
                        >
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">출고 선택</label>
                            <SearchSelect
                              options={shipmentLineOptions}
                              value={returnShipmentLineId}
                              onChange={setReturnShipmentLineId}
                              placeholder="출고 내역 검색..."
                            />
                          </div>

                          {selectedReturnLine && (
                            <div className="p-3 bg-[var(--chip)] rounded border text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[var(--muted)]">제품</span>
                                <span className="font-medium">{selectedReturnLine.model_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[var(--muted)]">출고일</span>
                                <span>{formatTimeKst(selectedReturnLine.created_at)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 mt-1">
                                <span className="text-[var(--muted)]">반품 가능 수량</span>
                                <span className="font-bold text-[var(--primary)]">{qtyRemains}개</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">반품 수량</label>
                              <Input
                                inputMode="numeric"
                                className="text-right"
                                value={returnQty}
                                onChange={(e) => setReturnQty(e.target.value)}
                                placeholder="1"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">금액 강제지정 (선택)</label>
                              <Input
                                inputMode="numeric"
                                className="text-right"
                                value={returnOverrideAmount}
                                onChange={(e) => setReturnOverrideAmount(e.target.value)}
                                placeholder="자동계산"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">반품일시</label>
                            <Input type="datetime-local" value={returnOccurredAt} onChange={(e) => setReturnOccurredAt(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유</label>
                            <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="사유 입력" className="resize-none" />
                          </div>

                          <Button type="submit" size="lg" variant="danger" className="w-full" disabled={!canSubmitReturn}>
                            반품 처리 완료
                          </Button>
                        </form>
                      )}

                      {/* 3) OFFSET */}
                      {actionTab === "offset" && (
                        <form
                          className="space-y-6"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!canSubmitOffset) return;

                            offsetMutation.mutate({
                              p_party_id: effectiveSelectedPartyId,
                              p_idempotency_key: offsetIdempotencyKey,
                              p_offset_cash_krw: offsetCashValue,
                              p_occurred_at: new Date(offsetOccurredAt).toISOString(),
                              p_reason_code: offsetReasonCode.trim(),
                              p_reason_detail: offsetReasonDetail.trim(),
                            });
                          }}
                        >
                          <div className="p-3 bg-[var(--chip)] rounded border text-xs text-[var(--muted)]">
                            <div className="font-semibold text-[var(--foreground)] mb-1">상계(OFFSET)</div>
                            <div>미할당 선수금(현금)을 FIFO로 미수에 상계합니다. (새 결제 생성 X)</div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">상계일시</label>
                            <Input type="datetime-local" value={offsetOccurredAt} onChange={(e) => setOffsetOccurredAt(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">상계 금액 (KRW)</label>
                            <Input className="text-right text-lg font-bold" value={offsetCashKrw} onChange={(e) => setOffsetCashKrw(e.target.value)} placeholder="0" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 코드</label>
                            <Input value={offsetReasonCode} onChange={(e) => setOffsetReasonCode(e.target.value)} placeholder="OFFSET" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 상세</label>
                            <Textarea value={offsetReasonDetail} onChange={(e) => setOffsetReasonDetail(e.target.value)} placeholder="왜 상계가 필요한지 구체적으로" className="resize-none" />
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">Idempotency Key</label>
                              <Input value={offsetIdempotencyKey} readOnly />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setOffsetIdempotencyKey(crypto.randomUUID())}>
                              재생성
                            </Button>
                          </div>

                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={offsetConfirm} onChange={(e) => setOffsetConfirm(e.target.checked)} />
                            <span className="text-[var(--muted)]">위 내용을 확인했고 실행합니다 (필수)</span>
                          </label>

                          <Button type="submit" size="lg" className="w-full" disabled={!canSubmitOffset}>
                            상계 실행
                          </Button>
                        </form>
                      )}

                      {/* 4) ADJUST_DOWN */}
                      {actionTab === "adjust_down" && (
                        <form
                          className="space-y-6"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!canSubmitAdjustDown) return;

                            adjustDownMutation.mutate({
                              p_party_id: effectiveSelectedPartyId,
                              p_idempotency_key: adjustDownIdempotencyKey,
                              p_adjust_cash_krw: adjustDownCashValue,
                              p_occurred_at: new Date(adjustDownOccurredAt).toISOString(),
                              p_reason_code: adjustDownReasonCode.trim(),
                              p_reason_detail: adjustDownReasonDetail.trim(),
                            });
                          }}
                        >
                          <div className="p-3 bg-[var(--chip)] rounded border text-xs text-[var(--muted)]">
                            <div className="font-semibold text-[var(--foreground)] mb-1">조정-차감(ADJUST_DOWN)</div>
                            <div>미수를 줄이는 수동 조정입니다. (내부 정정/오류 수정용)</div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">조정일시</label>
                            <Input type="datetime-local" value={adjustDownOccurredAt} onChange={(e) => setAdjustDownOccurredAt(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">차감 금액 (KRW)</label>
                            <Input className="text-right text-lg font-bold" value={adjustDownCashKrw} onChange={(e) => setAdjustDownCashKrw(e.target.value)} placeholder="0" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 코드</label>
                            <Input value={adjustDownReasonCode} onChange={(e) => setAdjustDownReasonCode(e.target.value)} placeholder="ADJUST_DOWN" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 상세</label>
                            <Textarea value={adjustDownReasonDetail} onChange={(e) => setAdjustDownReasonDetail(e.target.value)} placeholder="정정 사유/근거를 구체적으로" className="resize-none" />
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">Idempotency Key</label>
                              <Input value={adjustDownIdempotencyKey} readOnly />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setAdjustDownIdempotencyKey(crypto.randomUUID())}>
                              재생성
                            </Button>
                          </div>

                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={adjustDownConfirm} onChange={(e) => setAdjustDownConfirm(e.target.checked)} />
                            <span className="text-[var(--muted)]">위 내용을 확인했고 실행합니다 (필수)</span>
                          </label>

                          <Button type="submit" size="lg" variant="danger" className="w-full" disabled={!canSubmitAdjustDown}>
                            차감 조정 실행
                          </Button>
                        </form>
                      )}

                      {/* 5) ADJUST_UP */}
                      {actionTab === "adjust_up" && (
                        <form
                          className="space-y-6"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!canSubmitAdjustUp) return;

                            adjustUpMutation.mutate({
                              p_party_id: effectiveSelectedPartyId,
                              p_idempotency_key: adjustUpIdempotencyKey,
                              p_total_cash_due_krw: adjustUpTotalValue,
                              p_occurred_at: new Date(adjustUpOccurredAt).toISOString(),
                              p_labor_cash_due_krw: adjustUpLaborFinal,
                              p_material_cash_due_krw: adjustUpMaterialFinal,
                              p_reason_code: adjustUpReasonCode.trim(),
                              p_reason_detail: adjustUpReasonDetail.trim(),
                            });
                          }}
                        >
                          <div className="p-3 bg-[var(--chip)] rounded border text-xs text-[var(--muted)]">
                            <div className="font-semibold text-[var(--foreground)] mb-1">조정-증가(ADJUST_UP)</div>
                            <div>미수를 늘리는 수동 조정입니다. (정정 인보이스를 생성)</div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">발생일시</label>
                            <Input type="datetime-local" value={adjustUpOccurredAt} onChange={(e) => setAdjustUpOccurredAt(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">총 금액 (KRW)</label>
                            <Input className="text-right text-lg font-bold" value={adjustUpTotalCashKrw} onChange={(e) => setAdjustUpTotalCashKrw(e.target.value)} placeholder="0" />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">공임 (선택)</label>
                              <Input className="text-right" value={adjustUpLaborCashKrw} onChange={(e) => setAdjustUpLaborCashKrw(e.target.value)} placeholder="미입력 시 자동" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">소재 (선택)</label>
                              <Input className="text-right" value={adjustUpMaterialCashKrw} onChange={(e) => setAdjustUpMaterialCashKrw(e.target.value)} placeholder="미입력 시 자동" />
                            </div>
                          </div>

                          <div className="p-3 bg-[var(--chip)] rounded border text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[var(--muted)]">적용 공임</span>
                              <span className="font-medium">{formatKrw(adjustUpLaborFinal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--muted)]">적용 소재</span>
                              <span className="font-medium">{formatKrw(adjustUpMaterialFinal)}</span>
                            </div>
                            {!adjustUpSplitOk && adjustUpTotalValue > 0 && (
                              <div className="text-[var(--danger)]">공임+소재 합이 총액과 맞아야 합니다.</div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 코드</label>
                            <Input value={adjustUpReasonCode} onChange={(e) => setAdjustUpReasonCode(e.target.value)} placeholder="ADJUST_UP" />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-[var(--muted)]">사유 상세</label>
                            <Textarea value={adjustUpReasonDetail} onChange={(e) => setAdjustUpReasonDetail(e.target.value)} placeholder="정정 사유/근거를 구체적으로" className="resize-none" />
                          </div>

                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-semibold text-[var(--muted)]">Idempotency Key</label>
                              <Input value={adjustUpIdempotencyKey} readOnly />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setAdjustUpIdempotencyKey(crypto.randomUUID())}>
                              재생성
                            </Button>
                          </div>

                          <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={adjustUpConfirm} onChange={(e) => setAdjustUpConfirm(e.target.checked)} />
                            <span className="text-[var(--muted)]">위 내용을 확인했고 실행합니다 (필수)</span>
                          </label>

                          <Button type="submit" size="lg" className="w-full" disabled={!canSubmitAdjustUp}>
                            증가 조정 실행
                          </Button>
                        </form>
                      )}
                    </CardBody>

                  </Card>

                  {/* Recent History Side-panel */}
                  <div className="lg:w-80 shrink-0 space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--muted)] px-1">최근 수금/반품 내역</h3>
                    <div className="space-y-2">
                      {paymentAllocQuery.data?.slice(0, 5).map((pay, index) => (
                        <div key={`${pay.payment_id ?? "payment"}-${pay.alloc_id ?? "alloc"}-${index}`} className="p-3 rounded border bg-[var(--chip)] text-xs">
                          <div className="flex justify-between font-medium mb-1">
                            <span>수금</span>
                            <span>{formatKrw(pay.cash_krw)}</span>
                          </div>
                          <div className="text-[var(--muted)] flex justify-between">
                            <span>{formatTimeKst(pay.paid_at)}</span>
                            {pay.note && <span className="truncate max-w-[100px]">{pay.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted)] p-8">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">거래처를 선택해주세요</p>
            <p className="text-sm mt-1">좌측 목록에서 거래처를 선택하여 상세 정보를 확인하세요.</p>
          </div>
        )}
      </div>


      <DetailsModal
        open={Boolean(selectedLedgerId)}
        onClose={() => setSelectedLedgerId(null)}
        ledgerId={selectedLedgerId ?? ""}
        ledgerRows={ledgerQuery.data ?? []}
        schemaClient={schemaClient}
      />
    </div>
  );
}

function PaymentAllocationDetail({ paymentId, schemaClient }: { paymentId?: string | null; schemaClient: any }) {
  const allocQuery = useQuery({
    queryKey: ["cms", "payment_alloc_detail", paymentId],
    queryFn: async () => {
      if (!schemaClient || !paymentId) return [] as ArPaymentAllocDetailRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arPaymentAllocDetail)
        .select(
          "payment_id, paid_at, cash_krw, gold_g, silver_g, note, alloc_id, ar_id, alloc_cash_krw, alloc_gold_g, alloc_silver_g, alloc_value_krw, alloc_labor_krw, alloc_material_krw, shipment_line_id, model_name, suffix, color, size, invoice_occurred_at"
        )
        .eq("payment_id", paymentId)
        .order("invoice_occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ArPaymentAllocDetailRow[];
    },
    enabled: Boolean(schemaClient) && Boolean(paymentId),
  });

  if (!paymentId) {
    return (
      <div className="border-t border-[var(--panel-border)] pt-4">
        <h4 className="font-semibold mb-2">결제 상세</h4>
        <p className="text-sm text-[var(--muted)]">결제 ID가 없습니다.</p>
      </div>
    );
  }

  if (allocQuery.isLoading) {
    return (
      <div className="border-t border-[var(--panel-border)] pt-4">
        <h4 className="font-semibold mb-2">결제 상세</h4>
        <p className="text-sm text-[var(--muted)]">상세 내역 로딩 중...</p>
      </div>
    );
  }

  const allocations = allocQuery.data ?? [];

  // Payment totals (deposited amounts) - same for all rows
  const paymentCashKrw = allocations.length > 0 ? Number(allocations[0].cash_krw ?? 0) : 0;
  const paymentGoldG = allocations.length > 0 ? Number(allocations[0].gold_g ?? 0) : 0;
  const paymentSilverG = allocations.length > 0 ? Number(allocations[0].silver_g ?? 0) : 0;
  const paymentNote = allocations.length > 0 ? (allocations[0].note ?? "").trim() : "";

  // Allocation totals (how it was distributed)
  const totalLaborKrw = allocations.reduce((sum, a) => sum + Number(a.alloc_labor_krw ?? 0), 0);
  const totalMaterialKrw = allocations.reduce((sum, a) => sum + Number(a.alloc_material_krw ?? 0), 0);
  const totalGoldG = allocations.reduce((sum, a) => sum + Number(a.alloc_gold_g ?? 0), 0);
  const totalSilverG = allocations.reduce((sum, a) => sum + Number(a.alloc_silver_g ?? 0), 0);
  const totalCashKrw = allocations.reduce((sum, a) => sum + Number(a.alloc_cash_krw ?? 0), 0);

  if (allocations.length === 0) {
    return (
      <div className="border-t border-[var(--panel-border)] pt-4">
        <h4 className="font-semibold mb-2">결제 상세</h4>
        <p className="text-sm text-[var(--muted)]">
          배분 내역이 없습니다. (미할당 또는 FIFO 대기 중)
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--panel-border)] pt-4 space-y-4">
      <div>
        <h4 className="font-semibold mb-1">결제 입금 내역</h4>
        <p className="text-xs text-[var(--muted)] mb-3">
          거래처가 입금한 금액 및 소재
        </p>
        <div className="grid grid-cols-2 gap-4 p-3 bg-[var(--panel-hover)] rounded-md border border-[var(--panel-border)]">
          <div>
            <div className="text-xs text-[var(--muted)] mb-0.5">현금(KRW)</div>
            <div className="text-lg font-bold tabular-nums text-[var(--primary)]">
              {paymentCashKrw === 0 ? "-" : formatKrw(paymentCashKrw)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] mb-0.5">메모</div>
            <div className="text-sm truncate">{paymentNote || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] mb-0.5">금(g)</div>
            <div className="text-lg font-bold tabular-nums text-yellow-600 dark:text-yellow-400">
              {paymentGoldG === 0 ? "-" : formatGram(paymentGoldG)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)] mb-0.5">은(g)</div>
            <div className="text-lg font-bold tabular-nums text-slate-500 dark:text-slate-400">
              {paymentSilverG === 0 ? "-" : formatGram(paymentSilverG)}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-1">배분 상세</h4>
        <p className="text-xs text-[var(--muted)] mb-3">
          입금된 금액/소재가 어떤 출고 건에 얼마씩 배분되었는지 보여줍니다. (총 {allocations.length}건)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--panel-border)]">
              <th className="text-left py-2 px-2 text-xs font-semibold text-[var(--muted)]">모델명</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-[var(--muted)]">옵션</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--muted)]">공임</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--muted)]">재료비</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--muted)]">금(g)</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--muted)]">은(g)</th>
              <th className="text-right py-2 px-2 text-xs font-semibold text-[var(--muted)]">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--panel-border)]">
            {allocations.map((alloc) => {
              const modelName = (alloc.model_name ?? "").trim() || "-";
              const suffix = (alloc.suffix ?? "").trim();
              const color = (alloc.color ?? "").trim();
              const size = (alloc.size ?? "").trim();
              const opts = [suffix, color, size].filter(Boolean).join(" / ");
              const laborKrw = Number(alloc.alloc_labor_krw ?? 0);
              const materialKrw = Number(alloc.alloc_material_krw ?? 0);
              const goldG = Number(alloc.alloc_gold_g ?? 0);
              const silverG = Number(alloc.alloc_silver_g ?? 0);
              // ✅ 합계 = 공임 + 재료비 (직접 계산)
              const lineTotalKrw = laborKrw + materialKrw;

              return (
                <tr key={alloc.alloc_id ?? alloc.ar_id ?? Math.random()} className="hover:bg-[var(--panel-hover)]">
                  <td className="py-2 px-2 font-medium">{modelName}</td>
                  <td className="py-2 px-2 text-xs text-[var(--muted)]">{opts || "-"}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {laborKrw === 0 ? "-" : formatKrw(laborKrw)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {materialKrw === 0 ? "-" : formatKrw(materialKrw)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {goldG === 0 ? "-" : formatGram(goldG)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {silverG === 0 ? "-" : formatGram(silverG)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold">
                    {formatKrw(lineTotalKrw)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-[var(--panel-border)]">
            <tr className="font-semibold bg-[var(--panel-hover)]">
              <td colSpan={2} className="py-2 px-2">
                배분 합계
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {totalLaborKrw === 0 ? "-" : formatKrw(totalLaborKrw)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {totalMaterialKrw === 0 ? "-" : formatKrw(totalMaterialKrw)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {totalGoldG === 0 ? "-" : formatGram(totalGoldG)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {totalSilverG === 0 ? "-" : formatGram(totalSilverG)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {formatKrw(totalLaborKrw + totalMaterialKrw)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>


      {/* Verification: Check if totals match */}
      {(Math.abs(totalCashKrw - paymentCashKrw) > 100 ||
        Math.abs(totalGoldG - paymentGoldG) > 0.01 ||
        Math.abs(totalSilverG - paymentSilverG) > 0.01) && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">ℹ️ 교차 결제 감지</div>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>입금액과 배분 합계에 차이가 있습니다:</div>
              <div className="pl-2">
                {Math.abs(totalCashKrw - paymentCashKrw) > 100 && (
                  <div>• 현금: 입금 {formatKrw(paymentCashKrw)} → 배분 {formatKrw(totalCashKrw)} (차이: {formatKrw(totalCashKrw - paymentCashKrw)})</div>
                )}
                {Math.abs(totalGoldG - paymentGoldG) > 0.01 && (
                  <div>• 금: 입금 {formatGram(paymentGoldG)} → 배분 {formatGram(totalGoldG)} (차이: {formatGram(totalGoldG - paymentGoldG)})</div>
                )}
                {Math.abs(totalSilverG - paymentSilverG) > 0.01 && (
                  <div>• 은: 입금 {formatGram(paymentSilverG)} → 배분 {formatGram(totalSilverG)} (차이: {formatGram(totalSilverG - paymentSilverG)})</div>
                )}
              </div>
              <div className="text-[10px] opacity-80 mt-1">
                💡 현금↔소재 교차 결제가 발생했을 수 있습니다. (예: 초과 현금으로 재료비 소재 대체)<br />
                일부가 미배분 상태이거나 FIFO 처리 중일 수도 있습니다.
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

function DetailsModal({
  open,
  onClose,
  ledgerId,
  ledgerRows,
  schemaClient,
}: {
  open: boolean;
  onClose: () => void;
  ledgerId: string;
  ledgerRows: LedgerRow[];
  schemaClient: any;
}) {
  const row = ledgerRows.find((r) => r.ar_ledger_id === ledgerId);
  const shipmentId = row?.shipment_id;

  const valuationQuery = useQuery({
    queryKey: ["cms", "shipment_valuation_modal", shipmentId],
    queryFn: async () => {
      if (!schemaClient || !shipmentId) return null;
      const { data, error } = await schemaClient
        .from("cms_shipment_valuation")
        .select("*")
        .eq("shipment_id", shipmentId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return (data ?? null) as ShipmentValuationRow | null;
    },
    enabled: open && Boolean(shipmentId),
  });

  const valuation = valuationQuery.data;

  if (!row) return null;

  const isShipment = row.entry_type === "SHIPMENT";
  const isReturn = row.entry_type === "RETURN";
  const isPayment = (row.entry_type ?? "").toUpperCase().includes("PAYMENT");
  const title = isShipment ? "매출 상세" : isReturn ? "반품 상세" : isPayment ? "결제 상세" : "거래 내역 상세";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block text-[var(--muted)] text-xs mb-1">발생일시</span>
            <span className="font-medium">{formatTimeKst(row.occurred_at)}</span>
          </div>
          <div>
            <span className="block text-[var(--muted)] text-xs mb-1">구분</span>
            <span className="font-medium">{row.entry_type}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-[var(--muted)] text-xs mb-1">메모/내용</span>
            <span className="font-medium">{row.memo || "-"}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-[var(--muted)] text-xs mb-1">금액</span>
            <span className={cn(
              "text-xl font-bold tabular-nums",
              isShipment ? "text-red-600 dark:text-red-400" :
                isReturn ? "text-blue-600 dark:text-blue-400" :
                  isPayment ? "text-[var(--primary)]" : ""
            )}>
              {formatKrw(row.amount_krw)}
            </span>
          </div>
        </div>

        {shipmentId && row.shipment_line_id && (
          <LineCalculation
            schemaClient={schemaClient}
            shipmentLineId={row.shipment_line_id}
            rowAmount={row.amount_krw ?? 0}
            valuation={valuation}
          />
        )}

        {(isShipment || isReturn) && (
          <div className="border-t border-[var(--panel-border)] pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span>적용 시세 정보</span>
              {valuation?.pricing_locked_at && (
                <span className="text-xs font-normal text-[var(--muted)]">
                  ({formatTimeKst(valuation.pricing_locked_at)} 기준)
                </span>
              )}
            </h4>

            {valuationQuery.isLoading ? (
              <div className="py-4 text-center text-xs text-[var(--muted)]">시세 정보 로딩 중...</div>
            ) : valuation ? (
              <div className="bg-[var(--chip)] rounded-lg p-4 grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <span className="block text-[var(--muted)] text-xs mb-1">금 시세 (Gold)</span>
                  <span className="font-bold tabular-nums text-[var(--foreground)]">
                    {formatKrw(valuation.gold_krw_per_g_snapshot)} <span className="text-xs font-normal text-[var(--muted)]">/g</span>
                  </span>
                </div>
                <div>
                  <span className="block text-[var(--muted)] text-xs mb-1">은 시세 (Silver)</span>
                  <span className="font-bold tabular-nums text-[var(--foreground)]">
                    {formatKrw(valuation.silver_krw_per_g_snapshot)} <span className="text-xs font-normal text-[var(--muted)]">/g</span>
                  </span>
                </div>
                <div>
                  <span className="block text-[var(--muted)] text-xs mb-1">은 보정계수 (Factor)</span>
                  <span className="font-bold tabular-nums text-[var(--foreground)]">
                    {valuation.silver_adjust_factor_snapshot ?? "1.0"}x
                  </span>
                </div>
                <div>
                  <span className="block text-[var(--muted)] text-xs mb-1">자료 출처</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {valuation.pricing_source ?? "-"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[var(--muted)]">
                시세 스냅샷 정보가 없습니다. (수동 기입 등)
              </div>
            )}
          </div>
        )}

        {isPayment && (
          <PaymentAllocationDetail paymentId={row.payment_id} schemaClient={schemaClient} />
        )}
      </div>
    </Modal>
  );
}

function LineCalculation({
  schemaClient,
  shipmentLineId,
  rowAmount,
  valuation,
}: {
  schemaClient: any;
  shipmentLineId: string;
  rowAmount: number;
  valuation?: ShipmentValuationRow | null;
}) {
  // 1. Fetch Line Info
  const lineQuery = useQuery({
    queryKey: ["cms", "shipment_line_modal", shipmentLineId],
    queryFn: async () => {
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select("*")
        .eq("shipment_line_id", shipmentLineId)
        .single();
      if (error) throw error;
      return (data ?? null) as ShipmentLineRow & {
        gold_tick_krw_per_g?: number | null;
        silver_tick_krw_per_g?: number | null;
        silver_adjust_factor?: number | null;
        unit_price_krw?: number | null;
      };
    },
    enabled: Boolean(shipmentLineId),
  });

  // 2. Fetch Invoice Info (Authoritative Converted Weight)
  const invoiceQuery = useQuery({
    queryKey: ["cms", "ar_invoice_modal", shipmentLineId],
    queryFn: async () => {
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.arInvoicePosition)
        .select("commodity_due_g, commodity_price_snapshot_krw_per_g")
        .eq("shipment_line_id", shipmentLineId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as { commodity_due_g?: number | null; commodity_price_snapshot_krw_per_g?: number | null } | null;
    },
    enabled: Boolean(shipmentLineId),
  });

  if (lineQuery.isLoading || invoiceQuery.isLoading) return <div className="text-xs text-[var(--muted)]">세부 내역 로딩 중...</div>;
  const line = lineQuery.data;
  const invoice = invoiceQuery.data;

  if (!line) return null;

  const mat = (line.material_code ?? "").toUpperCase();
  const isSilver = mat.startsWith("925") || mat.startsWith("999");

  // Logic: Use authoritative weight from Invoice if available, else calc
  let purity = 1.0;
  let loss = 1.0;
  const normalizedMat = normalizeMaterialCode(mat);

  if (isSilver) {
    purity = getMaterialFactor({ materialCode: normalizedMat, silverAdjustApplied: 1 }).purityRate;
    loss = valuation?.silver_adjust_factor_snapshot ?? line.silver_adjust_factor ?? 1.0;
  } else {
    if (normalizedMat === "14" || normalizedMat === "18" || normalizedMat === "24") {
      const factor = getMaterialFactor({ materialCode: normalizedMat, silverAdjustApplied: 1 });
      purity = factor.purityRate;
      loss = factor.adjustApplied;
    } else {
      purity = 1.0;
      loss = 1.0;
    }
  }

  const rawWeight = line.net_weight_g ?? 0;

  // Authoritative data from Invoice
  const invoiceWeight = invoice?.commodity_due_g ? Number(invoice.commodity_due_g) : null;
  const invoicePrice = invoice?.commodity_price_snapshot_krw_per_g ? Number(invoice.commodity_price_snapshot_krw_per_g) : null;

  // Use invoice weight if available, else fallback to manual calc
  const convertedWeight = invoiceWeight ?? (rawWeight * purity * loss);
  const pricePerG = invoicePrice ?? (isSilver ? (line.silver_tick_krw_per_g ?? 0) : (line.gold_tick_krw_per_g ?? 0));

  const materialAmt = line.material_amount_sell_krw ?? 0;
  const labor = line.labor_total_sell_krw ?? 0;

  return (
    <div className="bg-[var(--surface)] p-3 rounded-md border border-[var(--panel-border)] text-sm space-y-1">
      <div className="font-semibold text-[var(--foreground)] mb-2 flex items-center justify-between">
        <span>계산 상세</span>
        <span className="text-xs font-normal text-[var(--muted)]">
          {mat} {isSilver ? "(은)" : "(금)"}
        </span>
      </div>

      {/* Formula: 원중량 * 함량 * 해리 = 순금 환산 중량 */}
      <div className="flex justify-between items-center text-[var(--muted)] text-xs">
        <div className="flex flex-col">
          <span>
            {rawWeight}g(원중량) × {purity}(함량) × {loss}(해리)
          </span>
        </div>
        <span className="font-medium text-[var(--foreground)]">
          = {formatGram(convertedWeight)} (환산)
        </span>
      </div>

      <div className="my-1 border-t border-[var(--panel-border)] border-dashed" />

      {/* Price calculation */}
      <div className="flex justify-between items-center text-[var(--muted)]">
        <span>환산중량 {formatGram(convertedWeight)} × 시세 ({formatKrw(pricePerG)})</span>
        <span>{formatKrw(materialAmt)}</span>
      </div>
      <div className="flex justify-between items-center text-[var(--muted)]">
        <span>+ 공임 합계</span>
        <span>{formatKrw(labor)}</span>
      </div>

      <div className="border-t border-[var(--panel-border)] mt-2 pt-2 flex justify-between items-center font-bold text-[var(--foreground)]">
        <span>= 합계</span>
        <span>{formatKrw(rowAmount)}</span>
      </div>

      {/* Warning if calc mismatch (only if invoice exists) */}
      {invoiceWeight && Math.abs(invoiceWeight - (rawWeight * purity * loss)) > 0.05 && (
        <div className="text-[10px] text-[var(--warn)] mt-1">
          * 시스템 환산 중량({formatGram(invoiceWeight)})과 계산상 중량({formatGram(rawWeight * purity * loss)})에 차이가 있습니다. (시스템 값 적용)
        </div>
      )}
    </div>
  );
}
