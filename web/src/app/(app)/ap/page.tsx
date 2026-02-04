"use client";

import { useMemo, useState, useRef, useEffect } from "react";
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
import { cn } from "@/lib/utils";

type ApPositionRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  party_id?: string | null;
  vendor_name?: string | null;
  name?: string | null;
  asset_code?: string | null;
};

type ApInvoiceRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  asset_code?: string | null;
  occurred_at?: string | null;
  memo?: string | null;
};

type ApPaymentAllocRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  payment_id?: string | null;
  paid_at?: string | null;
  alloc_id?: string | null;
};

type ApPaymentUnallocatedRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  payment_id?: string | null;
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
    maximumFractionDigits: 6,
  }).format(numeric);
  return `${formatted}g`;
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

const pickNumber = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
};

const pickString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
};

const getVendorId = (row: ApPositionRow | ApInvoiceRow | ApPaymentAllocRow | ApPaymentUnallocatedRow) =>
  (row.vendor_party_id ?? row.party_id ?? null) as string | null;

const getVendorName = (row: ApPositionRow) =>
  (row.vendor_name ?? row.name ?? null) as string | null;

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

export default function ApPage() {
  const schemaClient = getSchemaClient();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paidAt, setPaidAt] = useState(toKstInputValue);
  const [note, setNote] = useState("");
  const [goldG, setGoldG] = useState("");
  const [silverG, setSilverG] = useState("");
  const [laborKrw, setLaborKrw] = useState("");
  const selectorRef = useRef<HTMLDivElement>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const positionsQuery = useQuery({
    queryKey: ["cms", "ap_position"],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPositionByVendor)
        .select("*")
        .order("vendor_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ApPositionRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const defaultVendorId = positions[0] ? getVendorId(positions[0]) : null;
  const effectiveVendorId = selectedVendorId ?? defaultVendorId;


  const filteredVendors = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return positions.filter((row) => {
      const name = (getVendorName(row) ?? "").toLowerCase();
      if (!needle) return true;
      return name.includes(needle);
    });
  }, [positions, searchQuery]);

  const selectedVendor = useMemo(
    () => positions.find((row) => getVendorId(row) === effectiveVendorId) ?? null,
    [positions, effectiveVendorId]
  );

  const invoiceQuery = useQuery({
    queryKey: ["cms", "ap_invoice_position", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveVendorId) return [] as ApInvoiceRow[];
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

  const paymentAllocQuery = useQuery({
    queryKey: ["cms", "ap_payment_alloc", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveVendorId) return [] as ApPaymentAllocRow[];
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

  const paymentUnallocatedQuery = useQuery({
    queryKey: ["cms", "ap_payment_unallocated", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      if (!effectiveVendorId) return [] as ApPaymentUnallocatedRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPaymentUnallocated)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApPaymentUnallocatedRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const paymentMutation = useRpcMutation<{ payment_id?: string }>({
    fn: CONTRACTS.functions.apPayAndFifo,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      invoiceQuery.refetch();
      paymentAllocQuery.refetch();
      paymentUnallocatedQuery.refetch();
      setGoldG("");
      setSilverG("");
      setLaborKrw("");
      setNote("");
    },
  });

  const paymentsGrouped = useMemo(() => {
    const map = new Map<string, { payment: ApPaymentAllocRow; allocations: ApPaymentAllocRow[] }>();
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

  const canSavePayment = isFnConfigured(CONTRACTS.functions.apPayAndFifo);
  const numericGold = toNumber(goldG);
  const numericSilver = toNumber(silverG);
  const numericLabor = toNumber(laborKrw);
  const hasPaymentValue = numericGold > 0 || numericSilver > 0 || numericLabor > 0;
  const canSubmitPayment =
    canSavePayment && Boolean(effectiveVendorId) && Boolean(paidAt) && hasPaymentValue && !paymentMutation.isPending;

  const assetPositions = useMemo(() => {
    if (!selectedVendor) return [] as Array<{ asset: string; outstanding: number | null; credit: number | null }>;
    const hasAssetRows = positions.some((row) => row.asset_code);
    if (hasAssetRows) {
      return positions
        .filter((row) => getVendorId(row) === effectiveVendorId)
        .map((row) => {
          const asset = row.asset_code ?? "-";
          const outstanding = pickNumber(row, ["outstanding_qty", "outstanding_g", "outstanding_krw", "balance_qty"]);
          const credit = pickNumber(row, ["credit_qty", "credit_g", "credit_krw"]);
          return { asset, outstanding, credit };
        });
    }
    return [
      {
        asset: "XAU_G",
        outstanding: pickNumber(selectedVendor, ["gold_outstanding_g", "xau_outstanding_g"]),
        credit: pickNumber(selectedVendor, ["gold_credit_g", "xau_credit_g"]),
      },
      {
        asset: "XAG_G",
        outstanding: pickNumber(selectedVendor, ["silver_outstanding_g", "xag_outstanding_g"]),
        credit: pickNumber(selectedVendor, ["silver_credit_g", "xag_credit_g"]),
      },
      {
        asset: "KRW_LABOR",
        outstanding: pickNumber(selectedVendor, ["labor_cash_outstanding_krw", "labor_outstanding_krw"]),
        credit: pickNumber(selectedVendor, ["labor_cash_credit_krw", "labor_credit_krw"]),
      },
    ];
  }, [selectedVendor, positions, effectiveVendorId]);

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return new Intl.NumberFormat("ko-KR").format(value);
    if (typeof value === "string" && value.trim()) return value;
    return String(value);
  };

  return (
    <div className="space-y-6" id="ap.root">
      <ActionBar title="미지급(AP)" subtitle="공장 미지급 현황 조회 및 결제 처리" />

      <div className="relative z-20" ref={selectorRef}>
        <div
          className="flex items-center gap-4 p-4 bg-[var(--panel)] border border-[var(--panel-border)] rounded-xl shadow-sm cursor-pointer hover:border-[var(--primary)] transition-colors"
          onClick={() => setSelectorOpen(!selectorOpen)}
        >
          <div className="flex-1">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">공장</p>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                {selectedVendor ? getVendorName(selectedVendor) : "공장을 선택하세요"}
              </h2>
              <span
                className={cn(
                  "text-sm font-semibold text-[var(--muted)] transition-transform",
                  selectorOpen && "rotate-180"
                )}
                aria-hidden="true"
              >
                v
              </span>
            </div>
          </div>
        </div>

        {selectorOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--panel)] border border-[var(--panel-border)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[600px]">
            <div className="border-b border-[var(--panel-border)] bg-[var(--chip)] p-3">
              <Input
                placeholder="공장 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {positionsQuery.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="p-3 rounded-lg border border-dashed border-[var(--panel-border)]">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </div>
                  ))
                : filteredVendors.map((vendor, index) => (
                    <button
                      key={getVendorId(vendor) ?? String(index)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg hover:bg-[var(--panel-hover)] transition-colors flex items-center justify-between",
                        getVendorId(vendor) === effectiveVendorId && "bg-[var(--panel-hover)]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVendorId(getVendorId(vendor));
                        setSelectorOpen(false);
                      }}
                    >
                      <div>
                        <p className="font-medium">{getVendorName(vendor) ?? "-"}</p>
                        <p className="text-xs text-[var(--muted)]">{getVendorId(vendor) ?? "-"}</p>
                      </div>
                    </button>
                  ))}
              {!positionsQuery.isLoading && filteredVendors.length === 0 && (
                <div className="p-8 text-center text-[var(--muted)]">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar title="포지션" />
            </CardHeader>
            <CardBody>
              {positionsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : selectedVendor ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {assetPositions.map((asset) => (
                    <div key={asset.asset} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                      <div className="text-xs text-[var(--muted)]">{asset.asset}</div>
                      <div className="mt-1 text-sm font-semibold">
                        {asset.asset === "KRW_LABOR"
                          ? formatKrw(asset.outstanding)
                          : formatGram(asset.outstanding)}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--muted)]">
                        크레딧 {asset.asset === "KRW_LABOR" ? formatKrw(asset.credit) : formatGram(asset.credit)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">공장을 선택하세요.</div>
              )}
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar title="인보이스 (FIFO)" />
            </CardHeader>
            <CardBody className="space-y-3">
              {invoiceQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (invoiceQuery.data ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                  FIFO 잔액이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {(invoiceQuery.data ?? []).map((row, idx) => (
                    <div key={`ap-invoice-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">발생일</span>
                        <span>{formatDateTimeKst(row.occurred_at ?? pickString(row, ["created_at"]))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">자산</span>
                        <span>{row.asset_code ?? pickString(row, ["asset", "commodity_type"]) ?? "-"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">잔액</span>
                        <span>{renderValue(pickNumber(row, ["outstanding_qty", "outstanding_g", "outstanding_krw"]))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">메모</span>
                        <span>{row.memo ?? pickString(row, ["note"]) ?? "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar title="결제 입력" />
            </CardHeader>
            <CardBody>
              <form
                className="grid gap-6"
                onSubmit={(event) => {
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
                }}
              >
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">결제일시*</p>
                  <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>

                <div className="space-y-3 border rounded-lg p-4 bg-[var(--chip)]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">결제 입력</p>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-[var(--muted)]">공임 현금(원)</p>
                        <Input
                          type="number"
                          min={0}
                          placeholder="공임"
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
                          step="0.000001"
                          placeholder="금 중량"
                          value={goldG}
                          onChange={(e) => setGoldG(e.target.value)}
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
                          step="0.000001"
                          placeholder="은 중량"
                          value={silverG}
                          onChange={(e) => setSilverG(e.target.value)}
                          className="tabular-nums text-right"
                        />
                      </div>
                      <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs text-[var(--muted)]">
                        FIFO 자동 상계 (자산별 FIFO)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</p>
                  <Textarea
                    placeholder="메모를 입력하세요"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--muted)]">공임 입력</p>
                    <p className="text-lg font-bold tabular-nums">{formatKrw(numericLabor)}</p>
                    <p className="text-xs text-[var(--muted)]">금 {formatGram(numericGold)} · 은 {formatGram(numericSilver)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!canSavePayment ? (
                      <p className="text-xs text-[var(--muted)]">cms 계약의 결제 RPC명이 필요합니다.</p>
                    ) : null}
                    <Button type="submit" disabled={!canSubmitPayment} size="lg">
                      저장하기
                    </Button>
                  </div>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar title="결제 배정 결과" />
            </CardHeader>
            <CardBody className="space-y-3">
              {paymentAllocQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : paymentsGrouped.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                  배정 내역이 없습니다.
                </div>
              ) : (
                paymentsGrouped.map((group, index) => (
                  <div key={group.payment.payment_id ?? String(index)} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">결제일시</span>
                      <span>{formatDateTimeKst(group.payment.paid_at ?? pickString(group.payment, ["created_at"]))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted)]">결제ID</span>
                      <span>{group.payment.payment_id ?? "-"}</span>
                    </div>
                    {group.allocations.length > 0 ? (
                      <div className="space-y-2">
                        {group.allocations.map((alloc, idx) => (
                          <div key={`${group.payment.payment_id}-${idx}`} className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)]/60 p-2">
                            {Object.entries(alloc).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between gap-2">
                                <span className="text-[var(--muted)]">{key}</span>
                                <span>{renderValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[var(--muted)]">배정 내역 없음</div>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <ActionBar title="미배정 크레딧" />
            </CardHeader>
            <CardBody className="space-y-3">
              {paymentUnallocatedQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (paymentUnallocatedQuery.data ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                  미배정 크레딧이 없습니다.
                </div>
              ) : (
                (paymentUnallocatedQuery.data ?? []).map((row, idx) => (
                  <div key={`ap-unalloc-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-[var(--muted)]">{key}</span>
                        <span>{renderValue(value)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
