"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { callRpc } from "@/lib/supabase/rpc";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  qty?: number | null;
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

const isArInvoiceAnomaly = (row: ArInvoicePositionRow) => {
  if (row.material_code !== "999") return false;
  return (
    row.commodity_type === null ||
    Number(row.material_cash_due_krw ?? 0) === 0 ||
    Number(row.commodity_due_g ?? 0) === 0 ||
    Number(row.commodity_price_snapshot_krw_per_g ?? 0) === 0
  );
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatGram = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  const formatted = new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numeric);
  return `${formatted}g`;
};

type AmountPillProps = {
  amount?: number | null;
  ariaLabel?: string;
  className?: string;
};

const AmountPill = ({ amount, ariaLabel, className }: AmountPillProps) => {
  if (amount === null || amount === undefined) {
    return <span className={cn("text-[var(--muted)]", className)}>-</span>;
  }
  const numeric = Number(amount);
  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
  const abs = Math.abs(Math.round(numeric));
  const tone =
    numeric > 0
      ? "text-[var(--primary)]"
      : numeric < 0
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";
  const label =
    ariaLabel ??
    (numeric > 0
      ? "증가"
      : numeric < 0
        ? "감소"
        : "변동 없음");
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums font-semibold", tone, className)}
      aria-label={label}
    >
      {`${sign}₩${new Intl.NumberFormat("ko-KR").format(abs)}`}
    </span>
  );
};

const formatDateTimeKst = (value?: string | null) => {
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
    hour12: false,
  }).format(parsed);
};

const toKstInputValue = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 16);
};

export default function ArPage() {
  const schemaClient = getSchemaClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"payment" | "return">("payment");
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [paymentPartyId, setPaymentPartyId] = useState("");
  const [paidAt, setPaidAt] = useState(toKstInputValue);
  const [paymentMemo, setPaymentMemo] = useState("");
  const [paymentCashKrw, setPaymentCashKrw] = useState("");
  const [paymentGoldG, setPaymentGoldG] = useState("");
  const [paymentSilverG, setPaymentSilverG] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => crypto.randomUUID());
  const [returnPartyId, setReturnPartyId] = useState("");
  const [returnShipmentLineId, setReturnShipmentLineId] = useState("");
  const [returnQty, setReturnQty] = useState("1");
  const [returnOccurredAt, setReturnOccurredAt] = useState(toKstInputValue);
  const [returnOverrideAmount, setReturnOverrideAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetReturnForm = () => {
    setReturnShipmentLineId("");
    setReturnQty("1");
    setReturnOverrideAmount("");
    setReturnReason("");
  };

  const setReturnPartyIdWithReset = (nextPartyId: string) => {
    setReturnPartyId(nextPartyId);
    if (nextPartyId) {
      resetReturnForm();
    }
  };

  const applySelectedPartyId = (nextPartyId: string | null) => {
    setSelectedPartyId(nextPartyId);
    if (!nextPartyId) {
      setReturnPartyIdWithReset("");
      return;
    }
    if (!paymentPartyId) {
      setPaymentPartyId(nextPartyId);
    }
    if (nextPartyId !== returnPartyId) {
      setReturnPartyIdWithReset(nextPartyId);
    }
  };

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
  const defaultPartyId = positions[0]?.party_id ?? null;
  const effectiveSelectedPartyId = selectedPartyId ?? defaultPartyId;
  const effectivePaymentPartyId = paymentPartyId || effectiveSelectedPartyId || "";
  const effectiveReturnPartyId = returnPartyId || effectiveSelectedPartyId || "";

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
      const receivableA = Number(a.receivable_krw ?? 0);
      const receivableB = Number(b.receivable_krw ?? 0);
      if (receivableA !== receivableB) return receivableB - receivableA;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko-KR");
    });
  }, [positions, searchQuery, balanceFilter]);

  const selectedParty = useMemo(() => {
    return positions.find((row) => row.party_id === effectiveSelectedPartyId) ?? null;
  }, [positions, effectiveSelectedPartyId]);

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

  const selectedLedger = useMemo(() => {
    if (!selectedLedgerId) return null;
    return (ledgerQuery.data ?? []).find((row) => row.ar_ledger_id === selectedLedgerId) ?? null;
  }, [ledgerQuery.data, selectedLedgerId]);

  const selectedLedgerShipmentId = selectedLedger?.shipment_id ?? null;

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

  const invoicePositions = useMemo(
    () => invoicePositionsQuery.data ?? [],
    [invoicePositionsQuery.data]
  );
  const resolvedSelectedInvoiceId = useMemo(() => {
    if (!selectedInvoiceId) return null;
    const exists = invoicePositions.some((row) => row.ar_id === selectedInvoiceId);
    return exists ? selectedInvoiceId : null;
  }, [invoicePositions, selectedInvoiceId]);
  const openInvoices = useMemo(() => {
    return invoicePositions.filter((row) => {
      const cashOutstanding = Number(row.total_cash_outstanding_krw ?? 0);
      const commodityOutstanding = Number(row.commodity_outstanding_g ?? 0);
      return cashOutstanding > 0 || commodityOutstanding > 0 || isArInvoiceAnomaly(row);
    });
  }, [invoicePositions]);
  const anomalyInvoices = useMemo(
    () => invoicePositions.filter((row) => isArInvoiceAnomaly(row)),
    [invoicePositions]
  );
  const selectedInvoice = useMemo(() => {
    if (!resolvedSelectedInvoiceId) return null;
    return invoicePositions.find((row) => row.ar_id === resolvedSelectedInvoiceId) ?? null;
  }, [invoicePositions, resolvedSelectedInvoiceId]);
  const selectedInvoiceHasAnomaly = selectedInvoice ? isArInvoiceAnomaly(selectedInvoice) : false;

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

  const paymentGroups = useMemo(() => {
    const map = new Map<
      string,
      { payment: ArPaymentAllocDetailRow; allocations: ArPaymentAllocDetailRow[] }
    >();
    (paymentAllocQuery.data ?? []).forEach((row) => {
      if (!row.payment_id) return;
      if (!map.has(row.payment_id)) {
        map.set(row.payment_id, { payment: row, allocations: [] });
      }
      if (row.alloc_id) {
        map.get(row.payment_id)?.allocations.push(row);
      }
    });
    return Array.from(map.values());
  }, [paymentAllocQuery.data]);

  const paymentSummaryById = useMemo(() => {
    const map = new Map<
      string,
      { labor: number; material: number; gold: number; silver: number }
    >();
    (paymentAllocQuery.data ?? []).forEach((row) => {
      if (!row.payment_id) return;
      if (!map.has(row.payment_id)) {
        map.set(row.payment_id, { labor: 0, material: 0, gold: 0, silver: 0 });
      }
      const entry = map.get(row.payment_id);
      if (!entry) return;
      const laborValue = Number(row.alloc_labor_krw ?? 0);
      const rawMaterial = Number(row.alloc_material_krw ?? 0);
      const materialValue = rawMaterial > 0 ? rawMaterial : Number(row.alloc_value_krw ?? 0);
      entry.labor += laborValue;
      entry.material += materialValue;
      entry.gold += Number(row.alloc_gold_g ?? 0);
      entry.silver += Number(row.alloc_silver_g ?? 0);
    });
    return map;
  }, [paymentAllocQuery.data]);

  const shipmentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_line", "ar", effectiveReturnPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveReturnPartyId) return [] as ShipmentLineRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, qty, total_amount_sell_krw, material_amount_sell_krw, labor_total_sell_krw, model_name, suffix, color, size, created_at, shipment_header:cms_shipment_header(ship_date, status, customer_party_id)"
        )
        .eq("shipment_header.customer_party_id", effectiveReturnPartyId)
        .eq("shipment_header.status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
    },
    enabled: Boolean(effectiveReturnPartyId),
  });

  const shipmentLines = useMemo(() => shipmentLinesQuery.data ?? [], [shipmentLinesQuery.data]);
  const scopedShipmentLines = useMemo(() => {
    if (!effectiveReturnPartyId) return [] as ShipmentLineRow[];
    return shipmentLines.filter(
      (line) => line.shipment_header?.customer_party_id === effectiveReturnPartyId
    );
  }, [shipmentLines, effectiveReturnPartyId]);
  const shipmentLineById = useMemo(() => {
    const map = new Map<string, ShipmentLineRow>();
    scopedShipmentLines.forEach((line) => {
      if (line.shipment_line_id) map.set(line.shipment_line_id, line);
    });
    return map;
  }, [scopedShipmentLines]);
  const shipmentLineIds = useMemo(
    () => scopedShipmentLines.map((line) => line.shipment_line_id).filter(Boolean) as string[],
    [scopedShipmentLines]
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
    scopedShipmentLines.forEach((line) => {
      if (!line.shipment_line_id) return;
      const returned = returnedQtyByLine.get(line.shipment_line_id) ?? 0;
      const remaining = Math.max(Number(line.qty ?? 0) - returned, 0);
      map.set(line.shipment_line_id, remaining);
    });
    return map;
  }, [scopedShipmentLines, returnedQtyByLine]);

  const shipmentLineOptions = useMemo(() => {
    return scopedShipmentLines
      .filter((line) => {
        if (!line.shipment_line_id) return false;
        const remaining = remainingQtyByLine.get(line.shipment_line_id) ?? 0;
        return remaining > 0;
      })
      .map((line) => {
        const shipDate = line.shipment_header?.ship_date
          ? line.shipment_header?.ship_date.slice(0, 10)
          : "-";
        const shipmentId = line.shipment_id ? String(line.shipment_id).slice(0, 8) : "-";
        const nameParts = [line.model_name, line.suffix, line.color, line.size].filter(Boolean);
        const label = `${shipDate} · ${shipmentId} · ${nameParts.join(" / ")} · ${line.qty ?? 0}개`;
        return { label, value: line.shipment_line_id ?? "" };
      });
  }, [scopedShipmentLines, remainingQtyByLine]);

  const selectedLedgerValuationQuery = useQuery({
    queryKey: ["cms", "shipment_valuation", selectedLedgerShipmentId],
    enabled: Boolean(selectedLedgerShipmentId),
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!selectedLedgerShipmentId) return null;
      const { data, error } = await schemaClient
        .from("cms_shipment_valuation")
        .select(
          "shipment_id, pricing_locked_at, pricing_source, gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot, material_value_krw, labor_value_krw, total_value_krw"
        )
        .eq("shipment_id", selectedLedgerShipmentId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ShipmentValuationRow | null;
    },
  });

  const effectiveReturnShipmentLineId = useMemo(() => {
    if (!returnShipmentLineId) return "";
    const exists = scopedShipmentLines.some(
      (line) => line.shipment_line_id === returnShipmentLineId
    );
    return exists ? returnShipmentLineId : "";
  }, [returnShipmentLineId, scopedShipmentLines]);

  const selectedLine = useMemo(() => {
    return scopedShipmentLines.find((line) => line.shipment_line_id === effectiveReturnShipmentLineId) ?? null;
  }, [scopedShipmentLines, effectiveReturnShipmentLineId]);

  const returnedBefore = selectedLine?.shipment_line_id
    ? returnedQtyByLine.get(selectedLine.shipment_line_id) ?? 0
    : 0;

  const remainingQty = Math.max(Number(selectedLine?.qty ?? 0) - returnedBefore, 0);
  const parsedReturnQty = Number(returnQty);
  const isReturnQtyValid = Number.isFinite(parsedReturnQty) && parsedReturnQty > 0;
  const autoReturnAmount =
    selectedLine && isReturnQtyValid && Number(selectedLine.qty ?? 0) > 0
      ? Math.round((Number(selectedLine.total_amount_sell_krw ?? 0) / Number(selectedLine.qty ?? 1)) * parsedReturnQty)
      : 0;
  const overrideAmount = Number(returnOverrideAmount);
  const finalReturnAmount = Number.isFinite(overrideAmount) && returnOverrideAmount !== "" ? overrideAmount : autoReturnAmount;

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
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요";
      if (message.includes("exceeds remaining qty")) {
        toast.error("처리 실패", { description: "잔여 반품 가능 수량을 초과했습니다." });
        return;
      }
      toast.error("처리 실패", { description: message });
    },
  });

  const arInvoiceResyncMutation = useRpcMutation<ArResyncResult>({
    fn: CONTRACTS.functions.arInvoiceResyncFromShipment,
    onSuccess: (result) => {
      const updated = result?.updated ?? 0;
      const inserted = result?.inserted ?? 0;
      toast.success(`AR 재계산 완료 (updated=${updated}, inserted=${inserted})`);
      invoicePositionsQuery.refetch();
    },
  });

  const showResyncAction = anomalyInvoices.length > 0 || selectedInvoiceHasAnomaly;
  const canResyncArInvoice =
    selectedInvoiceHasAnomaly &&
    Boolean(selectedInvoice?.shipment_id) &&
    !arInvoiceResyncMutation.isPending;

  const handleArInvoiceResync = async () => {
    const shipmentId = selectedInvoice?.shipment_id ?? null;
    if (!shipmentId) return;
    await arInvoiceResyncMutation.mutateAsync({
      p_shipment_id: shipmentId,
    });
  };

  const canSavePayment = isFnConfigured(CONTRACTS.functions.arApplyPaymentFifo);
  const parsedCash = Number(paymentCashKrw);
  const parsedGold = Number(paymentGoldG);
  const parsedSilver = Number(paymentSilverG);
  const cashValue = Number.isFinite(parsedCash) ? parsedCash : 0;
  const goldValue = Number.isFinite(parsedGold) ? parsedGold : 0;
  const silverValue = Number.isFinite(parsedSilver) ? parsedSilver : 0;
  const hasPaymentValue = cashValue > 0 || goldValue > 0 || silverValue > 0;
  const canSubmitPayment =
    canSavePayment &&
    Boolean(effectivePaymentPartyId) &&
    Boolean(paidAt) &&
    hasPaymentValue &&
    !paymentMutation.isPending;

  const canSaveReturn = isFnConfigured(CONTRACTS.functions.recordReturn);
  const canSubmitReturn =
    canSaveReturn &&
    Boolean(effectiveReturnPartyId) &&
    Boolean(effectiveReturnShipmentLineId) &&
    Boolean(returnOccurredAt) &&
    isReturnQtyValid &&
    parsedReturnQty <= remainingQty &&
    !returnMutation.isPending;

  return (
    <div className="space-y-6" id="ar.root">
      <ActionBar
        title="미수 관리"
        subtitle="미수 현황 조회 및 수금/반품 처리"
        id="ar.actionBar"
      />

      <div className="relative z-20" ref={selectorRef}>
        <div
          className="flex items-center gap-4 p-4 bg-[var(--panel)] border border-[var(--panel-border)] rounded-xl shadow-sm cursor-pointer hover:border-[var(--primary)] transition-colors"
          onClick={() => setIsSelectorOpen(!isSelectorOpen)}
        >
          <div className="flex-1">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">거래처</p>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                {selectedParty ? selectedParty.name : "거래처를 선택하세요"}
              </h2>
              <span
                className={cn(
                  "text-sm font-semibold text-[var(--muted)] transition-transform",
                  isSelectorOpen && "rotate-180"
                )}
                aria-hidden="true"
              >
                v
              </span>
            </div>
          </div>
          {selectedParty && (
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-[var(--muted)]">총 잔액</p>
              <p className="text-lg font-bold tabular-nums">
                {formatKrw(selectedParty.total_cash_outstanding_krw)}
              </p>
            </div>
          )}
        </div>

        {isSelectorOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--panel)] border border-[var(--panel-border)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[600px]">
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)]">
              <FilterBar>
                <Input
                  placeholder="거래처 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <Select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="all">전체 잔액</option>
                  <option value="receivable">미수만</option>
                  <option value="credit">크레딧만</option>
                  <option value="nonzero">0원 제외</option>
                </Select>
              </FilterBar>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {positionsQuery.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="p-3 rounded-lg border border-dashed border-[var(--panel-border)]">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                  ))
                : filteredParties.map((party) => (
                    <button
                      key={party.party_id}
                      className={cn(
                        "w-full text-left p-3 rounded-lg hover:bg-[var(--panel-hover)] transition-colors flex items-center justify-between group",
                        party.party_id === effectiveSelectedPartyId && "bg-[var(--panel-hover)]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        applySelectedPartyId(party.party_id ?? null);
                        setIsSelectorOpen(false);
                      }}
                    >
                      <div>
                        <p className="font-medium">{party.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          공임 {formatKrw(party.labor_cash_outstanding_krw)} · 소재 {formatKrw(party.material_cash_outstanding_krw)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          금 {formatGram(party.gold_outstanding_g)} · 은 {formatGram(party.silver_outstanding_g)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {formatKrw(party.total_cash_outstanding_krw)}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {formatDateTimeKst(party.last_activity_at)}
                        </p>
                      </div>
                    </button>
                  ))}
              {!positionsQuery.isLoading && filteredParties.length === 0 && (
                <div className="p-8 text-center text-[var(--muted)]">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {positionsQuery.isError ? (
        <Card className="border-[var(--danger)]/40 bg-[var(--chip)]">
          <CardBody>
            <p className="text-sm text-[var(--danger)]">거래처 정보를 불러오지 못했습니다.</p>
          </CardBody>
        </Card>
      ) : null}

      <SplitLayout
        left={
          <Card className="h-full shadow-sm">
            <CardHeader>
              <ActionBar title="전체 요약" />
            </CardHeader>
            <CardBody>
              {positionsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-36" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--muted)]">총 미수</span>
                    <span className="font-bold">{formatKrw(summary.receivable)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--muted)]">총 크레딧</span>
                    <span className="font-bold">{formatKrw(summary.credit)}</span>
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">총 잔액</span>
                    <AmountPill amount={summary.balance} className="text-xl" />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        }
        right={
          <Card className="h-full shadow-sm">
            <CardHeader>
              <ActionBar title={selectedParty ? "거래처 요약" : "선택 없음"} />
            </CardHeader>
            <CardBody>
              {positionsQuery.isLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : selectedParty ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-[var(--muted)]">공임 잔액</p>
                    <p className="text-lg font-bold">{formatKrw(selectedParty.labor_cash_outstanding_krw)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">소재 환산</p>
                    <p className="text-lg font-bold">{formatKrw(selectedParty.material_cash_outstanding_krw)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">총 잔액</p>
                    <p className="text-lg font-bold">{formatKrw(selectedParty.total_cash_outstanding_krw)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">금 잔액</p>
                    <p className="text-sm font-semibold tabular-nums">{formatGram(selectedParty.gold_outstanding_g)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">은 잔액</p>
                    <p className="text-sm font-semibold tabular-nums">{formatGram(selectedParty.silver_outstanding_g)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">최근 활동</p>
                    <p className="text-sm font-medium">{formatDateTimeKst(selectedParty.last_activity_at)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--muted)]">
                  거래처를 선택하여 상세 정보를 확인하세요.
                </div>
              )}
            </CardBody>
          </Card>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <Card className="min-h-[600px] flex flex-col shadow-sm">
            <CardHeader className="shrink-0">
              <ActionBar title="원장" />
            </CardHeader>
            <CardBody className="flex-1 min-h-0 p-0 overflow-hidden">
              <div className="h-full overflow-auto relative">
                <table className="w-full text-left text-xs">
                  <thead className="text-[var(--muted)] bg-[var(--chip)] sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">날짜</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">구분</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">모델명</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">소재비</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">공임</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">합계</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">증감</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">메모</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {ledgerQuery.isLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        </tr>
                      ))
                    ) : (ledgerQuery.data ?? []).map((row) => {
                      const isShipment = (row.entry_type ?? "").toUpperCase() === "SHIPMENT";
                      const shipmentLine = row.shipment_line_id
                        ? shipmentLineById.get(row.shipment_line_id)
                        : undefined;
                      const modelName = shipmentLine?.model_name ?? "-";
                      const optionParts = [shipmentLine?.suffix, shipmentLine?.color, shipmentLine?.size].filter(Boolean);
                      const paymentSummary = row.payment_id
                        ? paymentSummaryById.get(row.payment_id)
                        : undefined;
                      const paymentMetalLabel = paymentSummary
                        ? `금 ${formatGram(paymentSummary.gold)} · 은 ${formatGram(paymentSummary.silver)}`
                        : "-";
                      const materialAmount = shipmentLine?.material_amount_sell_krw ?? null;
                      const laborAmount = shipmentLine?.labor_total_sell_krw ?? null;
                      const totalAmount = shipmentLine?.total_amount_sell_krw ?? null;
                      const paymentMaterial = paymentSummary ? paymentSummary.material : null;
                      const paymentLabor = paymentSummary ? paymentSummary.labor : null;
                      const paymentTotal = paymentSummary
                        ? paymentSummary.material + paymentSummary.labor
                        : null;
                      return (
                        <tr
                          key={row.ar_ledger_id}
                          onClick={() => {
                            if (row.ar_ledger_id) setSelectedLedgerId(row.ar_ledger_id);
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors hover:bg-[var(--panel-hover)]",
                            row.ar_ledger_id && selectedLedgerId === row.ar_ledger_id
                              ? "bg-[var(--chip)] ring-1 ring-[var(--panel-border)]"
                              : null
                          )}
                        >
                          <td className="px-4 py-3 text-[var(--muted)] tabular-nums">
                            {formatDateTimeKst(row.occurred_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--chip)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)]">
                              {isShipment ? "출고" : row.entry_type ?? "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {isShipment ? modelName : paymentMetalLabel}
                              </p>
                              <p className="text-[11px] text-[var(--muted)]">
                                {isShipment && optionParts.length > 0 ? optionParts.join(" / ") : "-"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                            {isShipment ? formatKrw(materialAmount) : formatKrw(paymentMaterial)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                            {isShipment ? formatKrw(laborAmount) : formatKrw(paymentLabor)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--foreground)]">
                            {isShipment ? formatKrw(totalAmount) : formatKrw(paymentTotal)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AmountPill amount={row.amount_krw} />
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)] max-w-[220px] truncate" title={row.memo ?? ""}>
                            {row.memo ?? "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {!ledgerQuery.isLoading && ledgerQuery.isError && (ledgerQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td className="px-4 py-12 text-center text-[var(--danger)]" colSpan={8}>
                          원장 데이터를 불러오지 못했습니다.
                        </td>
                      </tr>
                    ) : null}
                    {!ledgerQuery.isLoading && !ledgerQuery.isError && (ledgerQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td className="px-4 py-12 text-center text-[var(--muted)]" colSpan={8}>
                          원장 내역이 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar
                title="미수 잔액 (FIFO)"
                actions={
                  showResyncAction ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleArInvoiceResync}
                      disabled={!canResyncArInvoice}
                    >
                      {arInvoiceResyncMutation.isPending ? "재계산 중..." : "AR 재계산(선택 출고)"}
                    </Button>
                  ) : null
                }
              />
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[var(--muted)] bg-[var(--chip)] sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">출고일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">모델</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">소재</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">공임 잔액</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">소재 환산</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">금/은 잔량</th>
                      <th className="px-4 py-3 font-medium text-right whitespace-nowrap">총 잔액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {invoicePositionsQuery.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-10" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        </tr>
                      ))
                    ) : openInvoices.map((row) => {
                      const optionParts = [row.suffix, row.color, row.size].filter(Boolean);
                      const modelLabel = [row.model_name, optionParts.join(" / ")].filter(Boolean).join(" · ");
                      const commodityLabel = row.commodity_type === "gold"
                        ? `금 ${formatGram(row.commodity_outstanding_g)}`
                        : row.commodity_type === "silver"
                          ? `은 ${formatGram(row.commodity_outstanding_g)}`
                          : "-";
                      const isSelected = row.ar_id && row.ar_id === resolvedSelectedInvoiceId;
                      return (
                        <tr
                          key={row.ar_id}
                          onClick={() => {
                            if (row.ar_id) setSelectedInvoiceId(row.ar_id);
                          }}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-[var(--panel-hover)]",
                            isSelected ? "bg-[var(--chip)] ring-1 ring-[var(--panel-border)]" : null
                          )}
                        >
                          <td className="px-4 py-3 text-[var(--muted)] tabular-nums">
                            {formatDateTimeKst(row.occurred_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {modelLabel || "-"}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {row.material_code ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatKrw(row.labor_cash_outstanding_krw)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatKrw(row.material_cash_outstanding_krw)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {commodityLabel}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatKrw(row.total_cash_outstanding_krw)}
                          </td>
                        </tr>
                      );
                    })}
                    {!invoicePositionsQuery.isLoading && invoicePositionsQuery.isError ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-[var(--danger)]" colSpan={7}>
                          미수 잔액을 불러오지 못했습니다.
                        </td>
                      </tr>
                    ) : null}
                    {!invoicePositionsQuery.isLoading && !invoicePositionsQuery.isError && openInvoices.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-[var(--muted)]" colSpan={7}>
                          FIFO 잔액이 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          {selectedLedgerShipmentId ? (
            <Card className="shadow-sm">
              <CardHeader>
                <ActionBar title="출고 시세 스냅샷" />
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[var(--muted)]">확정시각</p>
                    <p className="font-semibold">
                      {formatDateTimeKst(selectedLedgerValuationQuery.data?.pricing_locked_at ?? null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">확정소스</p>
                    <p className="font-semibold">
                      {selectedLedgerValuationQuery.data?.pricing_source ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Gold/g</p>
                    <p className="font-semibold">
                      {selectedLedgerValuationQuery.data?.gold_krw_per_g_snapshot ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Silver/g</p>
                    <p className="font-semibold">
                      {selectedLedgerValuationQuery.data?.silver_krw_per_g_snapshot ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">소재</p>
                    <p className="font-semibold">
                      {formatKrw(selectedLedgerValuationQuery.data?.material_value_krw ?? null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">공임</p>
                    <p className="font-semibold">
                      {formatKrw(selectedLedgerValuationQuery.data?.labor_value_krw ?? null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">총액</p>
                    <p className="font-semibold">
                      {formatKrw(selectedLedgerValuationQuery.data?.total_value_krw ?? null)}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : null}
          <div className="flex items-center gap-1 p-1 bg-[var(--chip)] rounded-lg w-full border">
            {([
              { key: "payment", label: "수금 등록" },
              { key: "return", label: "반품 등록" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  activeTab === tab.key
                    ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <div
              className={cn(
                "transition-all duration-200 ease-out",
                activeTab === "payment"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
              )}
              aria-hidden={activeTab !== "payment"}
            >
              <Card className="shadow-sm">
                <CardHeader>
                  <ActionBar title="수금 정보 입력" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!canSubmitPayment) return;
                      const nowPaidAt = toKstInputValue();
                      setPaidAt(nowPaidAt);
                      paymentMutation.mutate({
                        p_party_id: effectivePaymentPartyId,
                        p_paid_at: new Date(nowPaidAt).toISOString(),
                        p_cash_krw: cashValue,
                        p_gold_g: goldValue,
                        p_silver_g: silverValue,
                        p_idempotency_key: paymentIdempotencyKey,
                        p_note: paymentMemo || null,
                      });
                    }}
                  >
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      수금일시*
                    </p>
                    <Input
                      type="datetime-local"
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                    />
                  </div>

                  <div className="space-y-3 border rounded-lg p-4 bg-[var(--chip)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">결제 입력</p>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-[var(--muted)]">현금(원)</p>
                          <Input
                            type="number"
                            min={0}
                            placeholder="현금"
                            value={paymentCashKrw}
                            onChange={(event) => setPaymentCashKrw(event.target.value)}
                            className="tabular-nums text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-[var(--muted)]">금(g)</p>
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            placeholder="금 중량"
                            value={paymentGoldG}
                            onChange={(event) => setPaymentGoldG(event.target.value)}
                            className="tabular-nums text-right"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-[var(--muted)]">은(g)</p>
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            placeholder="은 중량"
                            value={paymentSilverG}
                            onChange={(event) => setPaymentSilverG(event.target.value)}
                            className="tabular-nums text-right"
                          />
                        </div>
                        <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs text-[var(--muted)]">
                          FIFO 자동 상계 (출고 시세 스냅샷 기준)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      메모
                    </p>
                    <Textarea
                      placeholder="메모를 입력하세요"
                      value={paymentMemo}
                      onChange={(event) => setPaymentMemo(event.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted)]">현금 입력</p>
                      <p className="text-lg font-bold tabular-nums">{formatKrw(cashValue)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        금 {formatGram(goldValue)} · 은 {formatGram(silverValue)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {!canSavePayment ? (
                        <p className="text-xs text-[var(--muted)]">
                          cms 계약의 결제 등록 RPC명이 필요합니다.
                        </p>
                      ) : null}
                      <Button type="submit" disabled={!canSubmitPayment} size="lg">
                        저장하기
                      </Button>
                    </div>
                  </div>
                </form>
                </CardBody>
              </Card>
            </div>
            <div
              className={cn(
                "transition-all duration-200 ease-out",
                activeTab === "return"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
              )}
              aria-hidden={activeTab !== "return"}
            >
              <Card className="shadow-sm">
                <CardHeader>
                  <ActionBar title="반품 정보 입력" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!canSubmitReturn) return;
                      const nowReturnAt = toKstInputValue();
                      setReturnOccurredAt(nowReturnAt);
                      returnMutation.mutate({
                        p_shipment_line_id: effectiveReturnShipmentLineId,
                        p_return_qty: parsedReturnQty,
                        p_occurred_at: new Date(nowReturnAt).toISOString(),
                        p_override_amount_krw:
                          returnOverrideAmount !== "" ? Number(returnOverrideAmount) : null,
                        p_reason: returnReason || null,
                      });
                    }}
                  >
                    {!canSaveReturn ? (
                      <p className="text-xs text-[var(--muted)]">
                        cms 계약의 반품 등록 RPC명이 필요합니다.
                      </p>
                    ) : null}
                    {shipmentLinesQuery.isError || returnLinesQuery.isError ? (
                      <p className="text-xs text-[var(--danger)]">
                        출고 라인 정보를 불러오지 못했습니다.
                      </p>
                    ) : null}
                  <SearchSelect
                    label="출고 라인*"
                    placeholder="검색"
                    options={shipmentLineOptions}
                    value={effectiveReturnShipmentLineId}
                    onChange={(value) => setReturnShipmentLineId(value)}
                  />

                  <div className="grid gap-3 sm:grid-cols-3 p-4 bg-[var(--chip)] rounded-lg border">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">출고</p>
                      <p className="text-lg font-bold tabular-nums">{selectedLine?.qty ?? "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">반품</p>
                      <p className="text-lg font-bold tabular-nums">{selectedLine ? returnedBefore : "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">잔여</p>
                      <p className={cn("text-lg font-bold tabular-nums", selectedLine && remainingQty === 0 ? "text-[var(--muted)]" : "text-[var(--primary)]")}>{selectedLine ? remainingQty : "-"}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        반품 수량*
                      </p>
                      <Input
                        type="number"
                        min={1}
                        placeholder="수량"
                        value={returnQty}
                        onChange={(event) => setReturnQty(event.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        금액 (옵션)
                      </p>
                      <Input
                        type="number"
                        min={0}
                        placeholder="금액"
                        value={returnOverrideAmount}
                        onChange={(event) => setReturnOverrideAmount(event.target.value)}
                        className="tabular-nums text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      반품 일시*
                    </p>
                    <Input
                      type="datetime-local"
                      value={returnOccurredAt}
                      onChange={(event) => setReturnOccurredAt(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-2 text-sm p-4 bg-[var(--chip)] rounded-lg border border-dashed">
                    <div className="flex items-center justify-between text-[var(--muted)]">
                      <span>자동 계산 금액</span>
                      <span className="tabular-nums">{formatKrw(autoReturnAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--foreground)] pt-2 border-t border-dashed border-[var(--panel-border)]">
                      <span className="font-medium">최종 반품 금액</span>
                      <span className="font-bold text-lg tabular-nums">{formatKrw(finalReturnAmount)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      사유
                    </p>
                    <Textarea
                      placeholder="반품 사유를 입력하세요"
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <Button type="submit" disabled={!canSubmitReturn} size="lg">
                      반품 등록하기
                    </Button>
                  </div>
                  </form>
                </CardBody>
              </Card>
            </div>
            <Card className="shadow-sm">
              <CardHeader>
                <ActionBar title="결제/상계 내역" />
              </CardHeader>
              <CardBody className="p-0">
                <div className="max-h-[420px] overflow-auto">
                  {paymentAllocQuery.isLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-60" />
                        </div>
                      ))}
                    </div>
                  ) : paymentGroups.length > 0 ? (
                    <div className="divide-y divide-[var(--panel-border)]">
                      {paymentGroups.map(({ payment, allocations }) => (
                        <div key={payment.payment_id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                수금 {formatDateTimeKst(payment.paid_at)}
                              </p>
                              <p className="text-xs text-[var(--muted)]">{payment.note ?? "-"}</p>
                            </div>
                            <div className="text-right text-xs text-[var(--muted)]">
                              <p>현금 {formatKrw(payment.cash_krw)}</p>
                              <p>금 {formatGram(payment.gold_g)} · 은 {formatGram(payment.silver_g)}</p>
                            </div>
                          </div>
                          {allocations.length > 0 ? (
                            <table className="w-full text-left text-[11px]">
                              <thead className="text-[var(--muted)]">
                                <tr>
                                  <th className="py-1 pr-2">AR</th>
                                  <th className="py-1 text-right">현금</th>
                                  <th className="py-1 text-right">금(g)</th>
                                  <th className="py-1 text-right">은(g)</th>
                                  <th className="py-1 text-right">환산</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--panel-border)]">
                                {allocations.map((row) => {
                                  const optionParts = [row.suffix, row.color, row.size].filter(Boolean);
                                  const modelLabel = row.model_name
                                    ? `${row.model_name}${optionParts.length ? ` · ${optionParts.join(" / ")}` : ""}`
                                    : row.shipment_line_id
                                      ? `#${row.shipment_line_id.slice(0, 8)}`
                                      : "-";
                                  return (
                                    <tr key={row.alloc_id}>
                                      <td className="py-2 pr-2 text-[var(--foreground)]">{modelLabel}</td>
                                      <td className="py-2 text-right tabular-nums">{formatKrw(row.alloc_cash_krw)}</td>
                                      <td className="py-2 text-right tabular-nums">{formatGram(row.alloc_gold_g)}</td>
                                      <td className="py-2 text-right tabular-nums">{formatGram(row.alloc_silver_g)}</td>
                                      <td className="py-2 text-right tabular-nums">{formatKrw(row.alloc_value_krw)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-xs text-[var(--muted)]">상계 내역이 없습니다.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-[var(--muted)]">
                      결제 내역이 없습니다.
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
