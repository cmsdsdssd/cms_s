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
    onSuccess: (data) => {
      if (!selectedPartyId && (data?.length ?? 0) > 0) {
        applySelectedPartyId(data[0]?.party_id ?? null);
      }
    },
  });

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);

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
    return positions.find((row) => row.party_id === selectedPartyId) ?? null;
  }, [positions, selectedPartyId]);

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
    queryKey: ["cms", "ar_ledger", selectedPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!selectedPartyId) return [] as LedgerRow[];
      const { data, error } = await schemaClient
        .from("cms_ar_ledger")
        .select(
          "ar_ledger_id, party_id, occurred_at, created_at, entry_type, amount_krw, memo, shipment_id, shipment_line_id, payment_id, return_line_id"
        )
        .eq("party_id", selectedPartyId)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
    enabled: Boolean(selectedPartyId),
  });

  const shipmentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_line", "ar", returnPartyId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!returnPartyId) return [] as ShipmentLineRow[];
      const { data, error } = await schemaClient
        .from("cms_shipment_line")
        .select(
          "shipment_line_id, shipment_id, qty, total_amount_sell_krw, material_amount_sell_krw, labor_total_sell_krw, model_name, suffix, color, size, created_at, shipment_header:cms_shipment_header(ship_date, status, customer_party_id)"
        )
        .eq("shipment_header.customer_party_id", returnPartyId)
        .eq("shipment_header.status", "CONFIRMED")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ShipmentLineRow[];
    },
    enabled: Boolean(returnPartyId),
  });

  const shipmentLines = useMemo(() => shipmentLinesQuery.data ?? [], [shipmentLinesQuery.data]);
  const scopedShipmentLines = useMemo(() => {
    if (!returnPartyId) return [] as ShipmentLineRow[];
    return shipmentLines.filter(
      (line) => line.shipment_header?.customer_party_id === returnPartyId
    );
  }, [shipmentLines, returnPartyId]);
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

  const partyOptions = useMemo(() => {
    return positions
      .filter((row) => row.party_id && row.name)
      .map((row) => ({ label: row.name ?? "-", value: row.party_id ?? "" }));
  }, [positions]);

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
    Boolean(paymentPartyId) &&
    Boolean(paidAt) &&
    tenderPayload.length > 0 &&
    !paymentMutation.isPending;

  const canSaveReturn = isFnConfigured(CONTRACTS.functions.recordReturn);
  const canSubmitReturn =
    canSaveReturn &&
    Boolean(returnPartyId) &&
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
            <div className="space-y-4" id="ar.listPanel">
              <Card id="ar.summary">
                <CardHeader>
                  <ActionBar title="전체 요약" />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-[var(--muted)]">총 미수</p>
                      <p className="text-base font-semibold">{formatKrw(summary.receivable)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">총 크레딧</p>
                      <p className="text-base font-semibold">{formatKrw(summary.credit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">총 잔액</p>
                      <p className="text-base font-semibold">{formatSignedKrw(summary.balance)}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <div className="space-y-3">
                {filteredParties.map((party) => {
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
                      className="w-full text-left"
                    >
                      <ListCard
                        title={party.name ?? "-"}
                        subtitle={`잔액 ${formatSignedKrw(balance)}`}
                        meta={`미수 ${formatKrw(party.receivable_krw)} · 크레딧 ${formatKrw(
                          party.credit_krw
                        )}`}
                        badge={badge}
                        selected={party.party_id === selectedPartyId}
                        right={
                          <span className="text-xs text-[var(--muted)]">
                            {formatDateTimeKst(party.last_activity_at)}
                          </span>
                        }
                      />
                    </button>
                  );
                })}
                {filteredParties.length === 0 ? (
                  <Card>
                    <CardBody>
                      <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                    </CardBody>
                  </Card>
                ) : null}
              </div>
            </div>
          }
          right={
            <div className="space-y-4" id="ar.detailPanel">
              <Card id="ar.detail.summary">
                <CardHeader>
                  <ActionBar title={selectedParty?.name ?? "고객 선택"} />
                </CardHeader>
                <CardBody>
                  {selectedParty ? (
                    <div className="grid gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-[var(--muted)]">잔액</p>
                        <p className="text-base font-semibold">
                          {formatSignedKrw(selectedParty.balance_krw)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">미수</p>
                        <p className="text-base font-semibold">
                          {formatKrw(selectedParty.receivable_krw)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">크레딧</p>
                        <p className="text-base font-semibold">
                          {formatKrw(selectedParty.credit_krw)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">최근 활동</p>
                        <p className="text-sm">
                          {formatDateTimeKst(selectedParty.last_activity_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">좌측에서 고객을 선택해 주세요.</p>
                  )}
                </CardBody>
              </Card>
              <div className="flex items-center gap-2">
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
                      "rounded-full border px-4 py-2 text-sm",
                      activeTab === tab.key
                        ? "border-[var(--primary)] bg-[var(--chip)] text-[var(--primary)]"
                        : "border-[var(--panel-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === "ledger" ? (
                <Card id="ar.detail.ledgerTable">
                  <CardHeader>
                    <ActionBar title="원장" />
                  </CardHeader>
                  <CardBody>
                    <table className="w-full text-left text-xs">
                      <thead className="text-[var(--muted)]">
                        <tr>
                          <th className="px-2 py-2">구분</th>
                          <th className="px-2 py-2">모델명</th>
                          <th className="px-2 py-2 text-right">소재가격</th>
                          <th className="px-2 py-2 text-right">총공임</th>
                          <th className="px-2 py-2 text-right">총가격</th>
                          <th className="px-2 py-2">메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ledgerQuery.data ?? []).map((row) => {
                          const isShipment = (row.entry_type ?? "").toUpperCase() === "SHIPMENT";
                          const shipmentLine = row.shipment_line_id
                            ? shipmentLineById.get(row.shipment_line_id)
                            : undefined;
                          const modelName = shipmentLine?.model_name ?? "-";
                          const materialAmount = shipmentLine?.material_amount_sell_krw ?? null;
                          const laborAmount = shipmentLine?.labor_total_sell_krw ?? null;
                          const totalAmount = shipmentLine?.total_amount_sell_krw ?? row.amount_krw ?? null;
                          return (
                            <tr key={row.ar_ledger_id} className="border-t border-[var(--panel-border)]">
                              <td className="px-2 py-2">{isShipment ? "출고" : row.entry_type ?? "-"}</td>
                              <td className="px-2 py-2">{isShipment ? modelName : "-"}</td>
                              <td className="px-2 py-2 text-right">
                                {isShipment ? formatKrw(materialAmount) : "-"}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {isShipment ? formatKrw(laborAmount) : "-"}
                              </td>
                              <td className="px-2 py-2 text-right">
                                {formatSignedKrw(totalAmount)}
                              </td>
                              <td className="px-2 py-2">{row.memo ?? "-"}</td>
                            </tr>
                          );
                        })}
                        {(ledgerQuery.data ?? []).length === 0 ? (
                          <tr>
                            <td className="px-2 py-4 text-center text-[var(--muted)]" colSpan={5}>
                              원장 내역이 없습니다.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
              ) : null}
              {activeTab === "payment" ? (
                <Card id="ar.detail.payment">
                  <CardHeader>
                    <ActionBar title="수금 등록" />
                  </CardHeader>
                  <CardBody>
                    <form
                      className="grid gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!canSubmitPayment) return;
                        paymentMutation.mutate({
                          p_party_id: paymentPartyId,
                          p_paid_at: new Date(paidAt).toISOString(),
                          p_tenders: tenderPayload,
                          p_memo: paymentMemo || null,
                        });
                      }}
                    >
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          거래처*
                        </p>
                        <Input
                          placeholder="좌측에서 거래처를 선택하세요"
                          value={selectedParty?.name ?? ""}
                          disabled
                        />
                      </div>
                      <Input
                        type="datetime-local"
                        value={paidAt}
                        onChange={(event) => setPaidAt(event.target.value)}
                      />
                      <div className="space-y-3">
                        {tenders.map((line) => (
                          <div key={line.id} className="grid gap-3 sm:grid-cols-4">
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
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setTenders((prev) => prev.filter((item) => item.id !== line.id))}
                                disabled={tenders.length === 1}
                              >
                                삭제
                              </Button>
                              <Button type="button" onClick={() => setTenders((prev) => [...prev, createTenderLine()])}>
                                추가
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Textarea
                        placeholder="메모"
                        value={paymentMemo}
                        onChange={(event) => setPaymentMemo(event.target.value)}
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[var(--muted)]">합계 {formatKrw(totalTenderAmount)}</p>
                        <div className="flex items-center gap-2">
                          <Button type="submit" disabled={!canSubmitPayment}>
                            저장
                          </Button>
                          {!canSavePayment ? (
                            <p className="text-xs text-[var(--muted)]">
                              cms 계약의 결제 등록 RPC명이 필요합니다.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </form>
                  </CardBody>
                </Card>
              ) : null}
              {activeTab === "return" ? (
                <Card id="ar.detail.return">
                  <CardHeader>
                    <ActionBar title="반품 등록" />
                  </CardHeader>
                  <CardBody>
                    <form
                      className="grid gap-4"
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
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          거래처*
                        </p>
                        <Input
                          placeholder="좌측에서 거래처를 선택하세요"
                          value={selectedParty?.name ?? ""}
                          disabled
                        />
                      </div>
                      <SearchSelect
                        label="출고 라인*"
                        placeholder="검색"
                        options={shipmentLineOptions}
                        value={effectiveReturnShipmentLineId}
                        onChange={(value) => setReturnShipmentLineId(value)}
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-[var(--muted)]">출고 수량</p>
                          <p className="text-sm font-semibold">{selectedLine?.qty ?? "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">누적 반품</p>
                          <p className="text-sm font-semibold">{selectedLine ? returnedBefore : "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">잔여 수량</p>
                          <p className="text-sm font-semibold">{selectedLine ? remainingQty : "-"}</p>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        placeholder="반품 수량"
                        value={returnQty}
                        onChange={(event) => setReturnQty(event.target.value)}
                      />
                      <Input
                        type="datetime-local"
                        value={returnOccurredAt}
                        onChange={(event) => setReturnOccurredAt(event.target.value)}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="금액(옵션)"
                        value={returnOverrideAmount}
                        onChange={(event) => setReturnOverrideAmount(event.target.value)}
                      />
                      <div className="grid gap-2 text-sm text-[var(--muted)]">
                        <div className="flex items-center justify-between">
                          <span>자동 계산</span>
                          <span>{formatKrw(autoReturnAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[var(--foreground)]">
                          <span>최종 반품 금액</span>
                          <span className="font-semibold">{formatKrw(finalReturnAmount)}</span>
                        </div>
                      </div>
                      <Textarea
                        placeholder="메모"
                        value={returnReason}
                        onChange={(event) => setReturnReason(event.target.value)}
                      />
                      <div className="flex items-center justify-between">
                        <Button type="submit" disabled={!canSubmitReturn}>
                          저장
                        </Button>
                        {!canSaveReturn ? (
                          <p className="text-xs text-[var(--muted)]">
                            cms 계약의 반품 등록 RPC명이 필요합니다.
                          </p>
                        ) : null}
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
