"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";

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

  const effectiveVendorId = selectedVendorId ?? uniqueVendors[0]?.vendor_party_id ?? null;
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
    <div className="flex flex-col h-[calc(100vh-4rem)]" id="ap.root">
      <ActionBar title="미지급(AP)" subtitle="공장 미지급 현황 조회 및 결제 처리" />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left: Vendor List */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          <Card className="h-full flex flex-col shadow-sm">
            <CardHeader className="shrink-0 border-b border-[var(--panel-border)] px-3 py-2">
              <span className="text-sm font-semibold">공장 목록</span>
            </CardHeader>
            <CardBody className="flex-1 overflow-hidden p-0">
              <ApVendorList
                vendors={uniqueVendors}
                isLoading={positionsQuery.isLoading}
                selectedVendorId={effectiveVendorId}
                onSelectVendor={setSelectedVendorId}
              />
            </CardBody>
          </Card>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-9 h-full overflow-y-auto space-y-4">
          {/* Position Summary */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {selectedVendor?.vendor_name ?? "공장 선택"}
                </span>
                {selectedVendor?.vendor_region && (
                  <span className="text-xs text-[var(--muted)]">
                    {selectedVendor.vendor_region}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {positionsQuery.isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : assetPositions.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">공장을 선택하세요.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {assetPositions.map((asset) => (
                    <div
                      key={asset.asset}
                      className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3"
                    >
                      <div className="text-xs text-[var(--muted)]">{asset.asset}</div>
                      <div className="mt-1 text-sm font-semibold">
                        {asset.asset === "KRW_LABOR"
                          ? formatKrw(asset.outstanding)
                          : formatGram(asset.outstanding)}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--muted)]">
                        크레딧{" "}
                        {asset.asset === "KRW_LABOR"
                          ? formatKrw(asset.credit)
                          : formatGram(asset.credit)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* FIFO Invoices */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                <span className="text-sm font-semibold">인보이스 (FIFO)</span>
              </CardHeader>
              <CardBody className="max-h-[300px] overflow-y-auto space-y-2">
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
                        <span className="text-[var(--muted)]">
                          {formatDateTimeKst(row.occurred_at)}
                        </span>
                        <span className="font-medium px-1.5 py-0.5 rounded bg-[var(--chip)]">
                          {row.asset_code ?? "-"}
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
                      {row.memo && (
                        <div className="mt-1 text-[11px] text-[var(--muted)] truncate">
                          {row.memo}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            {/* Payment Form */}
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
          </div>

          {/* Payment Alloc History */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
              <span className="text-sm font-semibold">결제 배정 내역</span>
            </CardHeader>
            <CardBody className="max-h-[300px] overflow-y-auto">
              <ApPaymentAllocHistory
                allocations={paymentAllocQuery.data ?? []}
                isLoading={paymentAllocQuery.isLoading}
              />
            </CardBody>
          </Card>

          {/* Unallocated Credit */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
              <span className="text-sm font-semibold">미배정 크레딧</span>
            </CardHeader>
            <CardBody className="max-h-[250px] overflow-y-auto">
              <ApUnallocatedCreditList
                unallocated={paymentUnallocatedQuery.data ?? []}
                isLoading={paymentUnallocatedQuery.isLoading}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
