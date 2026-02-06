"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { ApVendorList, type VendorItem } from "./_components/ApVendorList";
import { ApPaymentAllocHistory } from "./_components/ApPaymentAllocHistory";
import { ApUnallocatedCreditList } from "./_components/ApUnallocatedCreditList";

type ApPositionRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  vendor_region?: string | null;
  vendor_is_active?: boolean | null;
  asset_code?: string | null;
  outstanding_qty?: number | null;
  credit_qty?: number | null;
};

type ApInvoiceRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  asset_code?: string | null;
  occurred_at?: string | null;
  memo?: string | null;
  outstanding_qty?: number | null;
};

type ApPaymentAllocRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  payment_id?: string | null;
  paid_at?: string | null;
  payment_note?: string | null;
  alloc_id?: string | null;
  asset_code?: string | null;
  alloc_qty?: number | null;
  occurred_at?: string | null;
  movement_code?: string | null;
  invoice_memo?: string | null;
};

type ApPaymentUnallocatedRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  payment_id?: string | null;
  paid_at?: string | null;
  note?: string | null;
  asset_code?: string | null;
  paid_qty?: number | null;
  allocated_qty?: number | null;
  unallocated_qty?: number | null;
};

// ── Formatters ──────────────────────────────────────────────────────────────
const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatGram = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(numeric)}g`;
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

const toNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const numeric = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const toAssetLabel = (assetCode?: string | null) => {
  switch (assetCode) {
    case "XAU_G":
      return "금(g)";
    case "XAG_G":
      return "은(g)";
    case "KRW_LABOR":
      return "공임(원)";
    case "KRW_MATERIAL":
      return "소재비(원)";
    default:
      return assetCode ?? "-";
  }
};

const buildIdempotencyKey = (vendorId: string) => {
  const now = new Date();
  const token = now
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "")
    .slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6);
  return `${vendorId}-${token}-${random}`;
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function ApPage() {
  const schemaClient = getSchemaClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"invoice" | "action" | "history">("invoice");
  const [paidAt, setPaidAt] = useState(toKstInputValue);
  const [note, setNote] = useState("");
  const [goldG, setGoldG] = useState("");
  const [silverG, setSilverG] = useState("");
  const [laborKrw, setLaborKrw] = useState("");

  // ── Positions Query (Named View with vendor_name) ──
  const positionsQuery = useQuery({
    queryKey: ["cms", "ap_position_named"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPositionByVendorNamed)
        .select("*")
        .order("vendor_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ApPositionRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);

  // ── Dedupe vendors by vendor_party_id ──
  const uniqueVendors = useMemo<VendorItem[]>(() => {
    const map = new Map<string, VendorItem>();
    for (const row of positions) {
      const vid = row.vendor_party_id;
      if (!vid) continue;
      if (!map.has(vid)) {
        map.set(vid, {
          vendor_party_id: vid,
          vendor_name: row.vendor_name ?? null,
          vendor_region: row.vendor_region ?? null,
          vendor_is_active: row.vendor_is_active ?? null,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.vendor_name ?? "").localeCompare(b.vendor_name ?? "", "ko")
    );
  }, [positions]);

  const filteredVendors = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return uniqueVendors;
    return uniqueVendors.filter((vendor) =>
      (vendor.vendor_name ?? "").toLowerCase().includes(keyword)
    );
  }, [searchQuery, uniqueVendors]);

  const effectiveVendorId = selectedVendorId ?? filteredVendors[0]?.vendor_party_id ?? uniqueVendors[0]?.vendor_party_id ?? null;
  const selectedVendor = uniqueVendors.find((v) => v.vendor_party_id === effectiveVendorId) ?? null;

  // ── Asset positions for selected vendor ──
  const assetPositions = useMemo(() => {
    if (!effectiveVendorId) return [];
    return positions
      .filter((row) => row.vendor_party_id === effectiveVendorId)
      .map((row) => ({
        asset: row.asset_code ?? "-",
        outstanding: row.outstanding_qty ?? null,
        credit: row.credit_qty ?? null,
      }));
  }, [positions, effectiveVendorId]);

  // ── Invoice Query ──
  const invoiceQuery = useQuery({
    queryKey: ["cms", "ap_invoice_position", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApInvoiceRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apInvoicePosition)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ApInvoiceRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  // ── Payment Alloc Query ──
  const paymentAllocQuery = useQuery({
    queryKey: ["cms", "ap_payment_alloc", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApPaymentAllocRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPaymentAllocDetail)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApPaymentAllocRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  // ── Payment Unallocated Query ──
  const paymentUnallocatedQuery = useQuery({
    queryKey: ["cms", "ap_payment_unallocated", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApPaymentUnallocatedRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPaymentUnallocated)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApPaymentUnallocatedRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  // ── Payment Mutation ──
  const paymentMutation = useRpcMutation<{ payment_id?: string }>({
    fn: CONTRACTS.functions.apPayAndFifo,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      invoiceQuery.refetch();
      paymentAllocQuery.refetch();
      paymentUnallocatedQuery.refetch();
      positionsQuery.refetch();
      setGoldG("");
      setSilverG("");
      setLaborKrw("");
      setNote("");
    },
  });

  const canSavePayment = isFnConfigured(CONTRACTS.functions.apPayAndFifo);
  const numericGold = toNumber(goldG);
  const numericSilver = toNumber(silverG);
  const numericLabor = toNumber(laborKrw);
  const hasPaymentValue = numericGold > 0 || numericSilver > 0 || numericLabor > 0;
  const canSubmitPayment =
    canSavePayment &&
    Boolean(effectiveVendorId) &&
    Boolean(paidAt) &&
    hasPaymentValue &&
    !paymentMutation.isPending;

  const summary = useMemo(() => {
    const totals = positions.reduce<{ gold: number; silver: number; labor: number }>(
      (acc, row) => {
        const asset = row.asset_code;
        const outstanding = Number(row.outstanding_qty ?? 0);
        if (asset === "XAU_G") acc.gold += outstanding;
        if (asset === "XAG_G") acc.silver += outstanding;
        if (asset === "KRW_LABOR") acc.labor += outstanding;
        return acc;
      },
      { gold: 0, silver: 0, labor: 0 }
    );
    return totals;
  }, [positions]);

  const handlePaymentSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitPayment || !effectiveVendorId) return;
    const nowPaidAt = toKstInputValue();
    setPaidAt(nowPaidAt);
    const idempotencyKey = buildIdempotencyKey(effectiveVendorId);
    const legs = [
      numericGold > 0 ? { asset_code: "XAU_G", qty: numericGold } : null,
      numericSilver > 0 ? { asset_code: "XAG_G", qty: numericSilver } : null,
      numericLabor > 0 ? { asset_code: "KRW_LABOR", qty: numericLabor } : null,
    ].filter(Boolean);
    if (legs.length === 0) {
      toast.error("결제 수량을 입력하세요");
      return;
    }
    paymentMutation.mutate({
      p_vendor_party_id: effectiveVendorId,
      p_paid_at: new Date(nowPaidAt).toISOString(),
      p_legs_json: legs,
      p_note: note || null,
      p_idempotency_key: idempotencyKey,
    });
  };

  // ── Render ──
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]" id="ap.root">
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search className="w-5 h-5" />
            공장 찾기
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <Input
              placeholder="공장명 검색..."
              className="pl-9 bg-[var(--chip)] border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 py-3 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">전체 공장미수(공임)</span>
          <span className="font-bold text-[var(--foreground)]">{formatKrw(summary.labor)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <ApVendorList
            vendors={filteredVendors}
            isLoading={positionsQuery.isLoading}
            selectedVendorId={effectiveVendorId}
            onSelectVendor={setSelectedVendorId}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        {selectedVendor ? (
          <>
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold tracking-tight">{selectedVendor.vendor_name}</h1>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-medium">
                      vendor
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)] flex items-center gap-2">
                    권역: {selectedVendor.vendor_region ?? "-"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    positionsQuery.refetch();
                    invoiceQuery.refetch();
                    paymentAllocQuery.refetch();
                    paymentUnallocatedQuery.refetch();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  새로고침
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">공임 잔액</p>
                  <p className="text-lg font-bold tabular-nums text-[var(--danger)]">{formatKrw(summary.labor)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">금 잔액</p>
                  <p className="text-lg font-bold tabular-nums">{formatGram(summary.gold)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">은 잔액</p>
                  <p className="text-lg font-bold tabular-nums">{formatGram(summary.silver)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">자산 수</p>
                  <p className="text-lg font-bold tabular-nums">{assetPositions.length}</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-[var(--panel-border)] px-6 bg-[var(--panel)] sticky top-0">
              <button
                onClick={() => setActiveTab("invoice")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "invoice"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                미지급 잔액 (FIFO)
              </button>
              <button
                onClick={() => setActiveTab("action")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "action"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                결제 처리
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "history"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                결제 배정/크레딧
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeTab === "invoice" && (
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                    <span className="text-sm font-semibold">인보이스 (FIFO)</span>
                  </CardHeader>
                  <CardBody className="max-h-[480px] overflow-y-auto space-y-2">
                    {invoiceQuery.isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : (invoiceQuery.data ?? []).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                        FIFO 잔액이 없습니다.
                      </div>
                    ) : (
                      (invoiceQuery.data ?? []).map((row, idx) => (
                        <div
                          key={`inv-${idx}`}
                          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--muted)]">{formatDateTimeKst(row.occurred_at)}</span>
                            <span className="font-medium px-1.5 py-0.5 rounded bg-[var(--chip)]">
                              {toAssetLabel(row.asset_code)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[var(--muted)]">잔액</span>
                            <span className="font-semibold">
                              {row.asset_code === "KRW_LABOR"
                                ? formatKrw(row.outstanding_qty)
                                : formatGram(row.outstanding_qty)}
                            </span>
                          </div>
                          {row.memo && <div className="mt-1 text-[11px] text-[var(--muted)] truncate">{row.memo}</div>}
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
              )}

              {activeTab === "action" && (
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                    <span className="text-sm font-semibold">결제 입력</span>
                  </CardHeader>
                  <CardBody>
                    <form className="grid gap-4" onSubmit={handlePaymentSubmit}>
                      <div className="space-y-1">
                    <p className="text-xs font-medium text-[var(--muted)]">결제일시*</p>
                    <Input
                      type="datetime-local"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </div>

                      <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted)]">공임(원)</p>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={laborKrw}
                        onChange={(e) => setLaborKrw(e.target.value)}
                        className="tabular-nums text-right"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted)]">금(g)</p>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        placeholder="0"
                        value={goldG}
                        onChange={(e) => setGoldG(e.target.value)}
                        className="tabular-nums text-right"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted)]">은(g)</p>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        placeholder="0"
                        value={silverG}
                        onChange={(e) => setSilverG(e.target.value)}
                        className="tabular-nums text-right"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--chip)] p-2 text-[10px] text-[var(--muted)] w-full text-center">
                        FIFO 자동상계
                      </div>
                    </div>
                  </div>

                      <div className="space-y-1">
                    <p className="text-xs text-[var(--muted)]">메모</p>
                    <Textarea
                      placeholder="메모 입력"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-xs text-[var(--muted)]">
                      공임 {formatKrw(numericLabor)} · 금 {formatGram(numericGold)} · 은{" "}
                      {formatGram(numericSilver)}
                    </div>
                    <Button type="submit" disabled={!canSubmitPayment} size="sm">
                      저장
                    </Button>
                      </div>
                    </form>
                  </CardBody>
                </Card>
              )}

              {activeTab === "history" && (
                <>
                  <Card className="shadow-sm">
                    <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                      <span className="text-sm font-semibold">결제 배정 내역</span>
                    </CardHeader>
                    <CardBody className="max-h-[360px] overflow-y-auto">
                      <ApPaymentAllocHistory
                        allocations={paymentAllocQuery.data ?? []}
                        isLoading={paymentAllocQuery.isLoading}
                      />
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                      <span className="text-sm font-semibold">미배정 크레딧</span>
                    </CardHeader>
                    <CardBody className="max-h-[280px] overflow-y-auto">
                      <ApUnallocatedCreditList
                        unallocated={paymentUnallocatedQuery.data ?? []}
                        isLoading={paymentUnallocatedQuery.isLoading}
                      />
                    </CardBody>
                  </Card>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="font-medium text-[var(--foreground)]">공장을 선택해주세요</p>
              <p className="text-sm mt-1 text-[var(--muted)]">좌측 목록에서 공장을 선택하여 상세 정보를 확인하세요.</p>
            </div>
          </div>
        )}
        </div>
      </div>
  );
}
