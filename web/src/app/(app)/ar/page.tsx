"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
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

type TenderLine = {
  id: string;
  method: string;
  amount: string;
  meta: string;
};

type ReturnResponse = {
  ok?: boolean;
  return_line_id?: string;
  auto_amount_krw?: number;
  final_amount_krw?: number;
  remaining_qty?: number;
};

const paymentMethods = ["BANK", "CASH", "GOLD", "SILVER", "OFFSET"];

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatSignedKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  return `${sign}₩${new Intl.NumberFormat("ko-KR").format(abs)}`;
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

const createTenderLine = (): TenderLine => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  method: paymentMethods[0],
  amount: "",
  meta: "",
});

export default function ArPage() {
  const schemaClient = getSchemaClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"ledger" | "payment" | "return">("ledger");
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [paymentPartyId, setPaymentPartyId] = useState("");
  const [paidAt, setPaidAt] = useState(toKstInputValue);
  const [paymentMemo, setPaymentMemo] = useState("");
  const [tenders, setTenders] = useState<TenderLine[]>([createTenderLine()]);
  const [returnPartyId, setReturnPartyId] = useState("");
  const [returnShipmentLineId, setReturnShipmentLineId] = useState("");
  const [returnQty, setReturnQty] = useState("1");
  const [returnOccurredAt, setReturnOccurredAt] = useState(toKstInputValue);
  const [returnOverrideAmount, setReturnOverrideAmount] = useState("");
  const [returnReason, setReturnReason] = useState("");

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
        .select("party_id, party_type, name, balance_krw, receivable_krw, credit_krw, last_activity_at")
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
    fn: CONTRACTS.functions.recordPayment,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      positionsQuery.refetch();
      ledgerQuery.refetch();
      setPaymentMemo("");
      setTenders([createTenderLine()]);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (params: Record<string, unknown>) => callRpc<ReturnResponse>(CONTRACTS.functions.recordReturn, params),
    onSuccess: () => {
      toast.success("반품 등록 완료");
      positionsQuery.refetch();
      ledgerQuery.refetch();
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

  const canSavePayment = isFnConfigured(CONTRACTS.functions.recordPayment);
  const totalTenderAmount = tenders.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const tenderPayload = tenders
    .map((line) => ({
      method: line.method,
      amount_krw: Number(line.amount),
      meta: line.meta ? { note: line.meta } : {},
    }))
    .filter((line) => Number.isFinite(line.amount_krw) && line.amount_krw > 0);

  const canSubmitPayment =
    canSavePayment &&
    Boolean(effectivePaymentPartyId) &&
    Boolean(paidAt) &&
    tenderPayload.length > 0 &&
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
        title="미수"
        subtitle="미수/결제/반품"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setActiveTab("payment")}>
              수금 등록
            </Button>
            <Button onClick={() => setActiveTab("return")}>반품 등록</Button>
          </div>
        }
        id="ar.actionBar"
      />
      <FilterBar id="ar.filterBar">
        <Input
          placeholder="거래처 검색"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Select value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}>
          <option value="all">잔액 전체</option>
          <option value="receivable">미수만</option>
          <option value="credit">크레딧만</option>
          <option value="nonzero">0원 제외</option>
        </Select>
      </FilterBar>
      <div id="ar.body">
        <SplitLayout
          left={
            <div className="space-y-4 h-full flex flex-col" id="ar.listPanel">
              <Card id="ar.summary" className="shrink-0 shadow-sm">
                <CardHeader>
                  <ActionBar title="전체 요약" />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-4 text-sm sm:grid-cols-3 tabular-nums">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">총 미수</p>
                      <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">{formatKrw(summary.receivable)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">총 크레딧</p>
                      <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">{formatKrw(summary.credit)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[var(--muted)]">총 잔액</p>
                      <p className={cn("text-lg font-bold tracking-tight", summary.balance > 0 ? "text-[var(--warning)]" : summary.balance < 0 ? "text-[var(--success)]" : "text-[var(--foreground)]")}>{formatSignedKrw(summary.balance)}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <div className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-1">
                {positionsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg bg-[var(--panel)]">
                      <div className="space-y-2 w-full">
                        <Skeleton className="h-4 w-[40%]" />
                        <Skeleton className="h-3 w-[70%]" />
                      </div>
                    </div>
                  ))
                ) : filteredParties.length > 0 ? (
                  filteredParties.map((party) => {
                    const balance = Number(party.balance_krw ?? 0);
                    const badge =
                      balance > 0
                        ? { label: "미수", tone: "warning" as const }
                        : balance < 0
                          ? { label: "크레딧", tone: "active" as const }
                          : { label: "정산", tone: "neutral" as const };
                    return (
                      <button
                        key={party.party_id}
                        type="button"
                        onClick={() => applySelectedPartyId(party.party_id ?? null)}
                        className="w-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg transition-all"
                      >
                        <ListCard
                          title={party.name ?? "-"}
                          subtitle={<span className="tabular-nums font-medium">잔액 {formatSignedKrw(balance)}</span>}
                          meta={<span className="tabular-nums text-xs opacity-80">미수 {formatKrw(party.receivable_krw)} · 크레딧 {formatKrw(party.credit_krw)}</span>}
                          badge={badge}
                          selected={party.party_id === effectiveSelectedPartyId}
                          right={
                            <span className="text-xs text-[var(--muted)] tabular-nums">
                              {formatDateTimeKst(party.last_activity_at)}
                            </span>
                          }
                        />
                      </button>
                    );
                  })
                ) : (
                  <Card className="border-dashed shadow-none bg-transparent">
                    <CardBody className="py-12 text-center">
                      <p className="text-sm text-[var(--muted)]">데이터가 없습니다.</p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </div>
          }
          right={
            <div className="space-y-6 h-full flex flex-col" id="ar.detailPanel">
              <Card id="ar.detail.summary" className="shrink-0 shadow-sm">
                <CardHeader>
                  <ActionBar title={selectedParty?.name ?? "고객 선택"} />
                </CardHeader>
                <CardBody>
                  {selectedParty ? (
                    <div className="grid gap-4 text-sm sm:grid-cols-4 tabular-nums">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--muted)]">잔액</p>
                        <p className={cn("text-lg font-bold tracking-tight", selectedParty.balance_krw && selectedParty.balance_krw > 0 ? "text-[var(--warning)]" : selectedParty.balance_krw && selectedParty.balance_krw < 0 ? "text-[var(--success)]" : "text-[var(--foreground)]")}>
                          {formatSignedKrw(selectedParty.balance_krw)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--muted)]">미수</p>
                        <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                          {formatKrw(selectedParty.receivable_krw)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--muted)]">크레딧</p>
                        <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">
                          {formatKrw(selectedParty.credit_krw)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--muted)]">최근 활동</p>
                        <p className="text-sm font-medium pt-1">
                          {formatDateTimeKst(selectedParty.last_activity_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-[var(--muted)] bg-[var(--chip)] rounded-lg border border-dashed">
                      <p className="text-sm">좌측에서 고객을 선택해 주세요.</p>
                    </div>
                  )}
                </CardBody>
              </Card>
              <div className="flex items-center gap-1 p-1 bg-[var(--chip)] rounded-lg w-fit border">
                {([
                  { key: "ledger", label: "원장" },
                  { key: "payment", label: "수금" },
                  { key: "return", label: "반품" },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                      activeTab === tab.key
                        ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--panel-hover)]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === "ledger" ? (
                <Card id="ar.detail.ledgerTable" className="flex-1 flex flex-col min-h-0 shadow-sm">
                  <CardHeader className="shrink-0">
                    <ActionBar title="원장" />
                  </CardHeader>
                  <CardBody className="flex-1 min-h-0 p-0 overflow-hidden">
                    <div className="h-full overflow-auto relative">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[var(--muted)] bg-[var(--chip)] sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">구분</th>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">모델명</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">소재가격</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">총공임</th>
                            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">총가격</th>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">메모</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--panel-border)]">
                          {ledgerQuery.isLoading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                              <tr key={i}>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                              </tr>
                            ))
                          ) : (ledgerQuery.data ?? []).map((row) => {
                            const isShipment = (row.entry_type ?? "").toUpperCase() === "SHIPMENT";
                            const shipmentLine = row.shipment_line_id
                              ? shipmentLineById.get(row.shipment_line_id)
                              : undefined;
                            const modelName = shipmentLine?.model_name ?? "-";
                            const materialAmount = shipmentLine?.material_amount_sell_krw ?? null;
                            const laborAmount = shipmentLine?.labor_total_sell_krw ?? null;
                            const totalAmount = shipmentLine?.total_amount_sell_krw ?? row.amount_krw ?? null;
                            return (
                              <tr key={row.ar_ledger_id} className="group transition-colors hover:bg-[var(--panel-hover)]">
                                <td className="px-4 py-3 font-medium text-[var(--foreground)]">{isShipment ? "출고" : row.entry_type ?? "-"}</td>
                                <td className="px-4 py-3 text-[var(--muted)] group-hover:text-[var(--foreground)]">{isShipment ? modelName : "-"}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                                  {isShipment ? formatKrw(materialAmount) : "-"}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                                  {isShipment ? formatKrw(laborAmount) : "-"}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--foreground)]">
                                  {formatSignedKrw(totalAmount)}
                                </td>
                                <td className="px-4 py-3 text-[var(--muted)] max-w-[200px] truncate" title={row.memo ?? ""}>{row.memo ?? "-"}</td>
                              </tr>
                            );
                          })}
                          {!ledgerQuery.isLoading && (ledgerQuery.data ?? []).length === 0 ? (
                            <tr>
                              <td className="px-4 py-12 text-center text-[var(--muted)]" colSpan={6}>
                                원장 내역이 없습니다.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              ) : null}
              {activeTab === "payment" ? (
                <Card id="ar.detail.payment" className="shadow-sm">
                  <CardHeader>
                    <ActionBar title="수금 등록" />
                  </CardHeader>
                  <CardBody>
                    <form
                      className="grid gap-6"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!canSubmitPayment) return;
                        paymentMutation.mutate({
                          p_party_id: effectivePaymentPartyId,
                          p_paid_at: new Date(paidAt).toISOString(),
                          p_tenders: tenderPayload,
                          p_memo: paymentMemo || null,
                        });
                      }}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                            거래처*
                          </p>
                          <Input
                            placeholder="좌측에서 거래처를 선택하세요"
                            value={selectedParty?.name ?? ""}
                            disabled
                            className="bg-[var(--chip)]"
                          />
                        </div>
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
                      </div>
                      
                      <div className="space-y-3 border rounded-lg p-4 bg-[var(--chip)]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">결제 수단</p>
                        </div>
                        {tenders.map((line) => (
                          <div key={line.id} className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                            <Select
                              value={line.method}
                              onChange={(event) =>
                                setTenders((prev) =>
                                  prev.map((item) =>
                                    item.id === line.id ? { ...item, method: event.target.value } : item
                                  )
                                )
                              }
                            >
                              {paymentMethods.map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              placeholder="금액"
                              value={line.amount}
                              onChange={(event) =>
                                setTenders((prev) =>
                                  prev.map((item) =>
                                    item.id === line.id ? { ...item, amount: event.target.value } : item
                                  )
                                )
                              }
                              className="tabular-nums text-right"
                            />
                            <Input
                              placeholder="메모"
                              value={line.meta}
                              onChange={(event) =>
                                setTenders((prev) =>
                                  prev.map((item) =>
                                    item.id === line.id ? { ...item, meta: event.target.value } : item
                                  )
                                )
                              }
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setTenders((prev) => prev.filter((item) => item.id !== line.id))}
                                disabled={tenders.length === 1}
                                className="px-2"
                              >
                                삭제
                              </Button>
                              <Button type="button" variant="secondary" onClick={() => setTenders((prev) => [...prev, createTenderLine()])} className="px-2">
                                추가
                              </Button>
                            </div>
                          </div>
                        ))}
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
                          <p className="text-xs text-[var(--muted)]">총 결제 금액</p>
                          <p className="text-lg font-bold tabular-nums">{formatKrw(totalTenderAmount)}</p>
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
              ) : null}
              {activeTab === "return" ? (
                <Card id="ar.detail.return" className="shadow-sm">
                  <CardHeader>
                    <ActionBar title="반품 등록" />
                  </CardHeader>
                  <CardBody>
                    <form
                      className="grid gap-6"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!canSubmitReturn) return;
                        returnMutation.mutate({
                          p_shipment_line_id: effectiveReturnShipmentLineId,
                          p_return_qty: parsedReturnQty,
                          p_occurred_at: new Date(returnOccurredAt).toISOString(),
                          p_override_amount_krw:
                            returnOverrideAmount !== "" ? Number(returnOverrideAmount) : null,
                          p_reason: returnReason || null,
                        });
                      }}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                            거래처*
                          </p>
                          <Input
                            placeholder="좌측에서 거래처를 선택하세요"
                            value={selectedParty?.name ?? ""}
                            disabled
                            className="bg-[var(--chip)]"
                          />
                        </div>
                        <SearchSelect
                          label="출고 라인*"
                          placeholder="검색"
                          options={shipmentLineOptions}
                          value={effectiveReturnShipmentLineId}
                          onChange={(value) => setReturnShipmentLineId(value)}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 p-4 bg-[var(--chip)] rounded-lg border">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[var(--muted)]">출고 수량</p>
                          <p className="text-lg font-bold tabular-nums">{selectedLine?.qty ?? "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[var(--muted)]">누적 반품</p>
                          <p className="text-lg font-bold tabular-nums">{selectedLine ? returnedBefore : "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-[var(--muted)]">잔여 수량</p>
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
                            placeholder="반품 수량"
                            value={returnQty}
                            onChange={(event) => setReturnQty(event.target.value)}
                            className="tabular-nums"
                          />
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
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                            금액 (옵션)
                          </p>
                          <Input
                            type="number"
                            min={0}
                            placeholder="금액(옵션)"
                            value={returnOverrideAmount}
                            onChange={(event) => setReturnOverrideAmount(event.target.value)}
                            className="tabular-nums text-right"
                          />
                        </div>
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
                        {!canSaveReturn ? (
                          <p className="text-xs text-[var(--muted)]">
                            cms 계약의 반품 등록 RPC명이 필요합니다.
                          </p>
                        ) : null}
                        <Button type="submit" disabled={!canSubmitReturn} size="lg">
                          반품 등록하기
                        </Button>
                      </div>
                    </form>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}
