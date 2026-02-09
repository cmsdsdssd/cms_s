"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { ApVendorList, type VendorItem } from "./_components/ApVendorList";

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

type ApReconcileOpenRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  error_count?: number | null;
  warn_count?: number | null;
};

type ApPaymentUnallocatedRow = Record<string, unknown> & {
  vendor_party_id?: string | null;
  asset_code?: string | null;
  unallocated_qty?: number | null;
};

type AssetSummary = {
  gold: number;
  silver: number;
  labor: number;
};

type PaymentHistoryItem = {
  key: string;
  paidAt: string | null;
  note: string;
  gold: number;
  silver: number;
  labor: number;
};

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

const getErrorMessage = (error: unknown) => {
  const e = error as
    | { message?: string; error_description?: string; details?: string; hint?: string }
    | string
    | null
    | undefined;
  return (
    (typeof e === "string" ? e : e?.message) ??
    (typeof e === "string" ? undefined : e?.error_description) ??
    "잠시 후 다시 시도해 주세요"
  );
};

const toNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const getAssetCode = (row: Record<string, unknown>) => {
  const raw = row.asset_code ?? row.commodity_type ?? row.asset;
  return typeof raw === "string" ? raw : "";
};

const getAmountByKeys = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in row) {
      return toNumeric(row[key]);
    }
  }
  return 0;
};

const summarizeByAsset = (rows: Record<string, unknown>[], keys: string[]): AssetSummary => {
  return rows.reduce<AssetSummary>(
    (acc, row) => {
      const assetCode = getAssetCode(row);
      const amount = getAmountByKeys(row, keys);
      if (assetCode === "XAU_G") acc.gold += amount;
      if (assetCode === "XAG_G") acc.silver += amount;
      if (assetCode === "KRW_LABOR") acc.labor += amount;
      return acc;
    },
    { gold: 0, silver: 0, labor: 0 }
  );
};

const summarizeFromPositions = (rows: ApPositionRow[]) => {
  return rows.reduce<AssetSummary>(
    (acc, row) => {
      const amount = Number(row.outstanding_qty ?? 0);
      if (row.asset_code === "XAU_G") acc.gold += amount;
      if (row.asset_code === "XAG_G") acc.silver += amount;
      if (row.asset_code === "KRW_LABOR") acc.labor += amount;
      return acc;
    },
    { gold: 0, silver: 0, labor: 0 }
  );
};

const buildPaymentHistory = (rows: Record<string, unknown>[]) => {
  const map = new Map<string, PaymentHistoryItem>();

  for (const row of rows) {
    const paymentId = typeof row.payment_id === "string" ? row.payment_id : "";
    const paidAt = typeof row.paid_at === "string" ? row.paid_at : null;
    const note =
      (typeof row.note === "string" && row.note) ||
      (typeof row.payment_note === "string" && row.payment_note) ||
      (typeof row.memo === "string" && row.memo) ||
      "";
    const key = paymentId || `${paidAt ?? ""}|${note}`;

    const current =
      map.get(key) ??
      ({
        key,
        paidAt,
        note,
        gold: 0,
        silver: 0,
        labor: 0,
      } satisfies PaymentHistoryItem);

    const assetCode = getAssetCode(row);
    const qty = getAmountByKeys(row, ["paid_qty", "qty", "amount", "alloc_qty"]);

    if (assetCode === "XAU_G") current.gold += qty;
    if (assetCode === "XAG_G") current.silver += qty;
    if (assetCode === "KRW_LABOR") current.labor += qty;

    if (!current.paidAt && paidAt) {
      current.paidAt = paidAt;
    }

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => {
    const at = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const bt = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return bt - at;
  });
};

export default function ApPage() {
  const schemaClient = getSchemaClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVendorId = searchParams.get("vendor_party_id") ?? null;

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(initialVendorId);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"post" | "history" | "action">("post");
  const [paidAt, setPaidAt] = useState(toKstInputValue);
  const [note, setNote] = useState("");
  const [goldG, setGoldG] = useState("");
  const [silverG, setSilverG] = useState("");
  const [laborKrw, setLaborKrw] = useState("");

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

  const uniqueVendors = useMemo<VendorItem[]>(() => {
    const map = new Map<string, VendorItem>();
    for (const row of positions) {
      const vid = row.vendor_party_id;
      if (!vid || map.has(vid)) continue;
      map.set(vid, {
        vendor_party_id: vid,
        vendor_name: row.vendor_name ?? null,
        vendor_region: row.vendor_region ?? null,
        vendor_is_active: row.vendor_is_active ?? null,
      });
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

  const effectiveVendorId =
    selectedVendorId ?? filteredVendors[0]?.vendor_party_id ?? uniqueVendors[0]?.vendor_party_id ?? null;
  const selectedVendor = uniqueVendors.find((v) => v.vendor_party_id === effectiveVendorId) ?? null;

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

  const factoryPostQuery = useQuery({
    queryKey: ["cms", "ap_factory_post_balance", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apFactoryPostBalanceByVendor)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const factoryLatestReceiptQuery = useQuery({
    queryKey: ["cms", "ap_factory_latest_receipt", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apFactoryLatestReceiptByVendor)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("issued_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId && activeTab === "post"),
  });

  const factoryRecentPaymentQuery = useQuery({
    queryKey: ["cms", "ap_factory_recent_payment", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apFactoryRecentPaymentByVendor)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("issued_at", { ascending: false })
        .order("asset_code", { ascending: true })
        .limit(16);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId && activeTab === "post"),
    retry: false,
  });

  const paymentHistoryQuery = useQuery({
    queryKey: ["cms", "ap_payment_history", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPaymentHistoryByVendor)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId && activeTab === "history"),
  });

  const paymentUnallocatedQuery = useQuery({
    queryKey: ["cms", "ap_payment_unallocated", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApPaymentUnallocatedRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apPaymentUnallocated)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId);
      if (error) throw error;
      return (data ?? []) as ApPaymentUnallocatedRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const systemBalanceQuery = useQuery({
    queryKey: ["cms", "ap_balance_by_vendor", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as Record<string, unknown>[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apBalanceByVendor)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const reconcileOpenQuery = useQuery({
    queryKey: ["cms", "ap_reconcile_open_named", effectiveVendorId],
    queryFn: async () => {
      if (!schemaClient || !effectiveVendorId) return [] as ApReconcileOpenRow[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.apReconcileOpenByVendorNamed)
        .select("*")
        .eq("vendor_party_id", effectiveVendorId);
      if (error) throw error;
      return (data ?? []) as ApReconcileOpenRow[];
    },
    enabled: Boolean(schemaClient && effectiveVendorId),
  });

  const paymentMutation = useRpcMutation<{ payment_id?: string }>({
    fn: CONTRACTS.functions.apPayAndFifo,
    successMessage: "결제 등록 완료",
    onSuccess: () => {
      void Promise.all([
        positionsQuery.refetch(),
        factoryPostQuery.refetch(),
        factoryRecentPaymentQuery.refetch(),
        paymentHistoryQuery.refetch(),
        paymentUnallocatedQuery.refetch(),
        systemBalanceQuery.refetch(),
        reconcileOpenQuery.refetch(),
        invoiceQuery.refetch(),
      ]);
      setGoldG("");
      setSilverG("");
      setLaborKrw("");
      setNote("");
    },
  });

  const globalSummary = useMemo(() => summarizeFromPositions(positions), [positions]);

  const vendorSummary = useMemo(() => {
    if (!effectiveVendorId) return { gold: 0, silver: 0, labor: 0 };
    const vendorRows = positions.filter((row) => row.vendor_party_id === effectiveVendorId);
    return summarizeFromPositions(vendorRows);
  }, [positions, effectiveVendorId]);

  const factoryPostSummary = useMemo(
    () => summarizeByAsset(factoryPostQuery.data ?? [], ["post_balance_qty", "outstanding_qty", "qty", "amount"]),
    [factoryPostQuery.data]
  );

  const systemSummary = useMemo(() => {
    const summarized = summarizeByAsset(systemBalanceQuery.data ?? [], [
      "balance_qty",
      "net_qty",
      "outstanding_qty",
      "qty",
      "amount",
    ]);
    if (summarized.gold || summarized.silver || summarized.labor) {
      return summarized;
    }
    return vendorSummary;
  }, [systemBalanceQuery.data, vendorSummary]);

  const unallocatedSummary = useMemo(
    () => summarizeByAsset(paymentUnallocatedQuery.data ?? [], ["unallocated_qty", "qty", "amount"]),
    [paymentUnallocatedQuery.data]
  );

  const netSystemSummary = useMemo(
    () => ({
      gold: systemSummary.gold - unallocatedSummary.gold,
      silver: systemSummary.silver - unallocatedSummary.silver,
      labor: systemSummary.labor - unallocatedSummary.labor,
    }),
    [systemSummary, unallocatedSummary]
  );

  const diffSummary = useMemo(
    () => ({
      gold: factoryPostSummary.gold - netSystemSummary.gold,
      silver: factoryPostSummary.silver - netSystemSummary.silver,
      labor: factoryPostSummary.labor - netSystemSummary.labor,
    }),
    [factoryPostSummary, netSystemSummary]
  );

  const latestReceipt =
    (factoryLatestReceiptQuery.data ?? [])[0] ?? (factoryPostQuery.data ?? [])[0] ?? null;
  const latestIssuedAt =
    typeof latestReceipt?.issued_at === "string"
      ? latestReceipt.issued_at
      : typeof latestReceipt?.ref_date === "string"
        ? latestReceipt.ref_date
        : null;
  const latestBillNo =
    typeof latestReceipt?.bill_no === "string"
      ? latestReceipt.bill_no
      : typeof latestReceipt?.ref_bill_no === "string"
        ? latestReceipt.ref_bill_no
        : "";

  const paymentHistoryItems = useMemo(
    () => buildPaymentHistory((paymentHistoryQuery.data ?? []) as Record<string, unknown>[]),
    [paymentHistoryQuery.data]
  );

  const recentFactoryPaymentItems = useMemo(
    () => buildPaymentHistory((factoryRecentPaymentQuery.data ?? []) as Record<string, unknown>[]),
    [factoryRecentPaymentQuery.data]
  );

  const reconcileErrorCount = useMemo(
    () =>
      (reconcileOpenQuery.data ?? []).reduce((sum, row) => {
        return sum + Number(row.error_count ?? 0);
      }, 0),
    [reconcileOpenQuery.data]
  );

  const reconcileWarnCount = useMemo(
    () =>
      (reconcileOpenQuery.data ?? []).reduce((sum, row) => {
        return sum + Number(row.warn_count ?? 0);
      }, 0),
    [reconcileOpenQuery.data]
  );

  const hasReconcileError = reconcileErrorCount > 0;

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
    !hasReconcileError &&
    !paymentMutation.isPending;

  const refreshAll = () => {
    void Promise.all([
      positionsQuery.refetch(),
      invoiceQuery.refetch(),
      factoryPostQuery.refetch(),
      factoryLatestReceiptQuery.refetch(),
      factoryRecentPaymentQuery.refetch(),
      paymentHistoryQuery.refetch(),
      paymentUnallocatedQuery.refetch(),
      systemBalanceQuery.refetch(),
      reconcileOpenQuery.refetch(),
    ]);
  };

  const goToReconcile = () => {
    if (!effectiveVendorId) {
      router.push("/ap/reconcile");
      return;
    }
    router.push(`/ap/reconcile?vendor_party_id=${encodeURIComponent(effectiveVendorId)}&status=OPEN,ACKED`);
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
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

    try {
      await paymentMutation.mutateAsync({
        p_vendor_party_id: effectiveVendorId,
        p_paid_at: new Date(nowPaidAt).toISOString(),
        p_legs: legs,
        p_note: note || null,
        p_idempotency_key: idempotencyKey,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("PAYMENT_BLOCKED")) {
        toast.error("결제 차단됨: reconcile ERROR 해결 필요", {
          description: `이동 경로: /ap/reconcile?vendor_party_id=${effectiveVendorId}`,
        });
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]" id="ap.root">
      <div className="z-20 flex w-80 flex-none flex-col border-r border-[var(--panel-border)] bg-[var(--panel)] shadow-xl">
        <div className="space-y-3 border-b border-[var(--panel-border)] bg-[var(--panel)] p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Search className="h-5 w-5" />
            공장 찾기
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <Input
              placeholder="공장명 검색..."
              className="border-none bg-[var(--chip)] pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--chip)] px-4 py-3 text-xs">
          <span className="text-[var(--muted)]">전체 공장미수(공임)</span>
          <span className="font-bold text-[var(--foreground)]">{formatKrw(globalSummary.labor)}</span>
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

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--background)]">
        {selectedVendor ? (
          <>
            <div className="z-10 shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">{selectedVendor.vendor_name}</h1>
                    <span className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                      vendor
                    </span>
                    {hasReconcileError && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Reconcile 필요
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    권역: {selectedVendor.vendor_region ?? "-"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={refreshAll}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  새로고침
                </Button>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--chip)] p-4">
                <p className="mb-3 text-xs text-[var(--muted)]">
                  공장 입력값과 우리 장부/결제값을 분리 표시합니다. (공장값은 결제로 직접 변경되지 않음)
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">공장 기준 미수(POST)</p>
                    <p className="text-sm font-semibold">공임 {formatKrw(factoryPostSummary.labor)}</p>
                    <p className="text-sm">금 {formatGram(factoryPostSummary.gold)}</p>
                    <p className="text-sm">은 {formatGram(factoryPostSummary.silver)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">우리 장부 미수(due-alloc)</p>
                    <p className="text-sm font-semibold">공임 {formatKrw(systemSummary.labor)}</p>
                    <p className="text-sm">금 {formatGram(systemSummary.gold)}</p>
                    <p className="text-sm">은 {formatGram(systemSummary.silver)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">미배정 결제(크레딧)</p>
                    <p className="text-sm font-semibold">공임 {formatKrw(unallocatedSummary.labor)}</p>
                    <p className="text-sm">금 {formatGram(unallocatedSummary.gold)}</p>
                    <p className="text-sm">은 {formatGram(unallocatedSummary.silver)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">우리 순잔액(장부-크레딧)</p>
                    <p className="text-sm font-semibold">공임 {formatKrw(netSystemSummary.labor)}</p>
                    <p className="text-sm">금 {formatGram(netSystemSummary.gold)}</p>
                    <p className="text-sm">은 {formatGram(netSystemSummary.silver)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">정합 차이(공장-우리순잔액)</p>
                    <p className="text-sm font-semibold">공임 {formatKrw(diffSummary.labor)}</p>
                    <p className="text-sm">금 {formatGram(diffSummary.gold)}</p>
                    <p className="text-sm">은 {formatGram(diffSummary.silver)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky top-0 flex border-b border-[var(--panel-border)] bg-[var(--panel)] px-6">
              <button
                onClick={() => setActiveTab("post")}
                className={cn(
                  "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === "post"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                공장 미수(POST)
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === "history"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                결제 내역
              </button>
              <button
                onClick={() => setActiveTab("action")}
                className={cn(
                  "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === "action"
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                결제 처리
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {activeTab === "post" && (
                <>
                  <Card className="shadow-sm">
                    <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                      <span className="text-sm font-semibold">기준 영수증</span>
                    </CardHeader>
                    <CardBody className="text-sm">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-[var(--muted)]">발행일</p>
                          <p className="font-medium">{formatDateTimeKst(latestIssuedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--muted)]">영수증 번호</p>
                          <p className="font-medium">{latestBillNo || "-"}</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                      <span className="text-sm font-semibold">공장 최근 결제(참고)</span>
                    </CardHeader>
                    <CardBody className="space-y-2">
                      {factoryRecentPaymentQuery.isLoading ? (
                        <Skeleton className="h-14 w-full" />
                      ) : recentFactoryPaymentItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                          공장 최근 결제 정보가 없습니다.
                        </div>
                      ) : (
                        recentFactoryPaymentItems.slice(0, 5).map((row) => (
                          <div
                            key={`factory-recent-${row.key}`}
                            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--muted)]">{formatDateTimeKst(row.paidAt)}</span>
                              <span className="font-medium">{row.note || "-"}</span>
                            </div>
                            <div className="mt-2 flex gap-4 text-[11px] text-[var(--muted)]">
                              <span>금 {formatGram(row.gold)}</span>
                              <span>은 {formatGram(row.silver)}</span>
                              <span>공임 {formatKrw(row.labor)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </CardBody>
                  </Card>

                  <details className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                      내부 FIFO(감사)
                    </summary>
                    <div className="space-y-2 border-t border-[var(--panel-border)] p-4">
                      <p className="text-xs text-[var(--muted)]">
                        운영용 아님. 증가분(당일 거래) 검증이 필요할 때만 확인하세요.
                      </p>
                      {invoiceQuery.isLoading ? (
                        <Skeleton className="h-14 w-full" />
                      ) : (invoiceQuery.data ?? []).length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                          내부 증가분 데이터가 없습니다.
                        </div>
                      ) : (
                        (invoiceQuery.data ?? []).map((row, idx) => (
                          <div
                            key={`inv-${idx}`}
                            className="rounded-lg border border-[var(--panel-border)] bg-[var(--background)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--muted)]">{formatDateTimeKst(row.occurred_at)}</span>
                              <span className="rounded bg-[var(--chip)] px-1.5 py-0.5 font-medium">
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
                            {row.memo && <div className="mt-1 truncate text-[11px] text-[var(--muted)]">{row.memo}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </>
              )}

              {activeTab === "history" && (
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-[var(--panel-border)] px-4 py-3">
                    <span className="text-sm font-semibold">우리 결제 내역</span>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    {paymentHistoryQuery.isLoading ? (
                      <Skeleton className="h-14 w-full" />
                    ) : paymentHistoryItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-4 text-sm text-[var(--muted)]">
                        결제 내역이 없습니다.
                      </div>
                    ) : (
                      paymentHistoryItems.map((row) => (
                        <div
                          key={`payment-history-${row.key}`}
                          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[var(--muted)]">{formatDateTimeKst(row.paidAt)}</span>
                            <span className="truncate text-right">{row.note || "-"}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded bg-[var(--chip)] px-2 py-1">금 {formatGram(row.gold)}</div>
                            <div className="rounded bg-[var(--chip)] px-2 py-1">은 {formatGram(row.silver)}</div>
                            <div className="rounded bg-[var(--chip)] px-2 py-1">공임 {formatKrw(row.labor)}</div>
                          </div>
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
                      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--chip)] p-3 text-xs text-[var(--muted)]">
                        결제는 Reconcile ERROR 없을 때만 가능합니다.
                        {reconcileWarnCount > 0 && ` (경고 ${reconcileWarnCount}건)`}
                      </div>

                      {hasReconcileError && (
                        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          <span>결제 차단됨: reconcile ERROR {reconcileErrorCount}건 해결 필요</span>
                          <Button type="button" size="sm" variant="secondary" onClick={goToReconcile}>
                            Reconcile로 이동
                          </Button>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-[var(--muted)]">결제일시*</p>
                        <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
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
                            className="text-right tabular-nums"
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
                            className="text-right tabular-nums"
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
                            className="text-right tabular-nums"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="w-full rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--chip)] p-2 text-center text-[10px] text-[var(--muted)]">
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

                      <div className="flex items-center justify-between border-t pt-2">
                        <div className="text-xs text-[var(--muted)]">
                          공임 {formatKrw(numericLabor)} · 금 {formatGram(numericGold)} · 은 {formatGram(numericSilver)}
                        </div>
                        <Button type="submit" disabled={!canSubmitPayment} size="sm">
                          저장
                        </Button>
                      </div>
                    </form>
                  </CardBody>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="font-medium text-[var(--foreground)]">공장을 선택해주세요</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                좌측 목록에서 공장을 선택하여 상세 정보를 확인하세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
