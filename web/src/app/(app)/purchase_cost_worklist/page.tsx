"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";

type LinkedShipment = {
  shipment_id: string;
  ship_date: string | null;
  shipment_status: string | null;
  customer_party_id: string | null;
  customer_name: string | null;
  basis_cost_krw: number | null;
  line_cnt: number | null;
};

type ReceiptWorklistRow = {
  receipt_id: string;
  received_at: string;
  source?: string | null;
  status: string;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  issued_at?: string | null;

  inbox_currency_code?: string | null;
  inbox_total_amount_krw?: number | null;

  file_bucket: string;
  file_path: string;
  file_sha256?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  memo?: string | null;

  pricing_currency_code?: string | null;
  pricing_total_amount?: number | null;
  weight_g?: number | null;
  labor_basic?: number | null;
  labor_other?: number | null;
  pricing_total_amount_krw?: number | null;
  fx_rate_krw_per_unit?: number | null;
  fx_tick_id?: string | null;
  applied_at?: string | null;

  linked_shipment_cnt: number;
  linked_basis_cost_krw: number;
  linked_shipments: LinkedShipment[];
};

type UpsertSnapshotResult = {
  ok: boolean;
  receipt_id: string;
  currency_code?: string;
  total_amount?: number;
  total_amount_krw?: number;
};

type ApplySnapshotResult = {
  ok: boolean;
  receipt_id: string;
  total_amount_krw: number;
  shipment_count: number;
};

function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("ko-KR").format(Number(n));
}

function formatYmd(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR");
}

function shortPath(path: string) {
  const name = (path ?? "").split("/").pop() ?? "";
  return name || path;
}

function parseNumOrNull(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function calcAllocations(totalKrw: number | null, linked: LinkedShipment[]) {
  if (!totalKrw || totalKrw <= 0) return [] as Array<LinkedShipment & { alloc_krw: number }>;
  const basisTotal = linked.reduce((acc, s) => acc + (Number(s.basis_cost_krw) || 0), 0);
  if (basisTotal <= 0) return linked.map((s) => ({ ...s, alloc_krw: 0 }));

  // progressive remainder allocation to keep sum exact
  let remainingKrw = totalKrw;
  let remainingBasis = basisTotal;
  const sorted = [...linked].sort((a, b) => (a.shipment_id > b.shipment_id ? 1 : -1));
  const out: Array<LinkedShipment & { alloc_krw: number }> = [];

  for (const s of sorted) {
    const basis = Number(s.basis_cost_krw) || 0;
    const alloc = remainingBasis > 0 ? Math.round((remainingKrw * basis) / remainingBasis) : remainingKrw;
    remainingKrw -= alloc;
    remainingBasis -= basis;
    out.push({ ...s, alloc_krw: alloc });
  }
  return out;
}

function filterRowsByStatus(
  rows: ReceiptWorklistRow[],
  filter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED"
) {
  if (filter === "ALL") return rows;
  if (filter === "APPLIED") return rows.filter((r) => !!r.applied_at);
  if (filter === "NEED_INPUT") {
    return rows.filter((r) => !r.pricing_total_amount_krw && !r.pricing_total_amount);
  }
  return rows.filter((r) => !r.applied_at);
}

function pickFirstRow(
  rows: ReceiptWorklistRow[],
  filter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED"
) {
  return filterRowsByStatus(rows, filter)[0] ?? null;
}

export default function PurchaseCostWorklistPage() {
  // NOTE: route 이름은 유지하지만, 실제로는 "영수증 작업대"를 구현합니다.
  const [filter, setFilter] = useState<"ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED">("NEED_APPLY");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [currencyCode, setCurrencyCode] = useState<"KRW" | "CNY">("KRW");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [weightG, setWeightG] = useState<string>("");
  const [laborBasic, setLaborBasic] = useState<string>("");
  const [laborOther, setLaborOther] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [forceReapply, setForceReapply] = useState<boolean>(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function applySelectedReceipt(receipt: ReceiptWorklistRow) {
    const c = (receipt.pricing_currency_code ?? receipt.inbox_currency_code ?? "KRW").toUpperCase();
    setCurrencyCode((c === "CNY" ? "CNY" : "KRW") as "KRW" | "CNY");
    setTotalAmount(receipt.pricing_total_amount != null ? String(receipt.pricing_total_amount) : "");
    setWeightG(receipt.weight_g != null ? String(receipt.weight_g) : "");
    setLaborBasic(receipt.labor_basic != null ? String(receipt.labor_basic) : "");
    setLaborOther(receipt.labor_other != null ? String(receipt.labor_other) : "");
    setNote("");
    setForceReapply(false);
  }

  const worklist = useQuery<{ data: ReceiptWorklistRow[] }>(
    {
      queryKey: ["cms", "receipt_worklist"],
      queryFn: async () => {
        const res = await fetch("/api/purchase-cost-worklist?limit=250", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "작업대 조회 실패");
        if (!selectedReceiptId) {
          const first = pickFirstRow(json?.data ?? [], filter);
          if (first?.receipt_id) {
            queueMicrotask(() => {
              setSelectedReceiptId(first.receipt_id);
              applySelectedReceipt(first);
            });
          }
        }
        return json;
      },
      refetchInterval: 15_000,
    }
  );

  const rows = useMemo(() => worklist.data?.data ?? [], [worklist.data]);

  const selectReceiptId = (receiptId: string | null, sourceRows: ReceiptWorklistRow[] = rows) => {
    setSelectedReceiptId(receiptId);
    if (!receiptId) return;
    const target = sourceRows.find((r) => r.receipt_id === receiptId) ?? null;
    if (target) {
      applySelectedReceipt(target);
    }
  };

  const handleFilterChange = (nextFilter: "ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED") => {
    setFilter(nextFilter);
    if (!selectedReceiptId) {
      const first = pickFirstRow(rows, nextFilter);
      if (first?.receipt_id) {
        selectReceiptId(first.receipt_id, rows);
      }
    }
  };

  const filteredRows = useMemo(() => {
    return filterRowsByStatus(rows, filter);
  }, [rows, filter]);

  const selected = useMemo(() => {
    if (!selectedReceiptId) return null;
    return rows.find((r) => r.receipt_id === selectedReceiptId) ?? null;
  }, [rows, selectedReceiptId]);

  const upsertSnapshot = useRpcMutation<UpsertSnapshotResult>({
    fn: "cms_fn_upsert_receipt_pricing_snapshot_v1",
    successMessage: "영수증 값 저장 완료",
    onSuccess: () => worklist.refetch(),
  });

  const applySnapshot = useRpcMutation<ApplySnapshotResult>({
    fn: "cms_fn_apply_receipt_pricing_snapshot_v1",
    successMessage: "출고 원가 배분/적용 완료",
    onSuccess: () => worklist.refetch(),
  });

  async function onSave() {
    if (!selectedReceiptId) return;

    const p_total_amount = parseNumOrNull(totalAmount);
    if (p_total_amount == null) {
      toast.error("총금액은 필수입니다");
      return;
    }

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_currency_code: currencyCode,
      p_total_amount,
      p_weight_g: parseNumOrNull(weightG),
      p_labor_basic: parseNumOrNull(laborBasic),
      p_labor_other: parseNumOrNull(laborOther),
      p_note: note || null,
    });
  }

  async function onApply() {
    if (!selected) return;
    if ((selected.linked_shipment_cnt ?? 0) <= 0) {
      toast.error("이 영수증에 연결된 출고가 없습니다. 먼저 출고에서 영수증을 선택해 연결하세요.");
      return;
    }

    // ✅ Apply 버튼 한 번에 끝내기: 저장(스냅샷) → 적용
    const p_total_amount = parseNumOrNull(totalAmount);
    if (p_total_amount == null) {
      toast.error("총금액은 필수입니다");
      return;
    }

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selected.receipt_id,
      p_currency_code: currencyCode,
      p_total_amount,
      p_weight_g: parseNumOrNull(weightG),
      p_labor_basic: parseNumOrNull(laborBasic),
      p_labor_other: parseNumOrNull(laborOther),
      p_note: note || null,
    });

    await applySnapshot.mutateAsync({
      p_receipt_id: selected.receipt_id,
      p_note: note || null,
      p_force: forceReapply,
    });
  }

  async function openReceiptPreview(receiptId: string) {
    try {
      const url = `/api/receipt-preview?receipt_id=${encodeURIComponent(receiptId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("미리보기를 열 수 없습니다");
    }
  }

  async function uploadReceipt() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("파일을 선택해 주세요");
      return;
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/receipt-upload", {
      method: "POST",
      body: form,
    });

    const json = await res.json();
    if (!res.ok) {
      toast.error("업로드 실패", { description: json?.error ?? "" });
      return;
    }

    const receiptId = json?.data?.receipt_id as string | undefined;
    if (receiptId) {
      toast.success("영수증 업로드 완료");
      setUploadOpen(false);
      // refresh and select
      const refreshed = await worklist.refetch();
      const nextRows = refreshed.data?.data ?? [];
      selectReceiptId(receiptId, nextRows);
    }
  }

  const allocations = useMemo((): Array<LinkedShipment & { alloc_krw: number }> => {
    if (!selected) return [];
    const totalKrw = selected.pricing_total_amount_krw ?? null;
    return calcAllocations(totalKrw, selected.linked_shipments ?? []);
  }, [selected]);

  const busy = worklist.isLoading || upsertSnapshot.isPending || applySnapshot.isPending;

  return (
    <div className="mx-auto max-w-[1800px] space-y-8 px-4 pb-10 pt-4 md:px-6">
      <div className="relative z-10 rounded-[18px] border border-[var(--panel-border)] bg-white/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        <ActionBar
          title="원가마감 작업대"
          subtitle="영수증 총합(중량/공임/총금액)을 저장하고, 연결된 출고에 자동 배분하여 ACTUAL 원가로 반영합니다."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => worklist.refetch()} disabled={busy}>
                새로고침
              </Button>
              <Button onClick={() => setUploadOpen(true)} disabled={busy}>
                영수증 업로드
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: receipt list */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <Card className="flex-1 overflow-hidden border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white/50 px-4 py-3 backdrop-blur-sm">
              <div className="text-sm font-semibold text-gray-900">영수증 목록</div>
              <div className="flex items-center gap-1.5">
                {(["NEED_APPLY", "NEED_INPUT", "APPLIED", "ALL"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filter === f ? "primary" : "ghost"}
                    onClick={() => handleFilterChange(f)}
                    className={`h-7 px-2.5 text-xs font-medium transition-all ${
                      filter === f ? "shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {f === "NEED_APPLY" && "미적용"}
                    {f === "NEED_INPUT" && "미입력"}
                    {f === "APPLIED" && "적용완료"}
                    {f === "ALL" && "전체"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardBody className="max-h-[calc(100vh-240px)] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
              {worklist.isLoading ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={`receipt-skeleton-${idx}`} className="rounded-lg border border-gray-100 bg-white p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <div className="mt-3 flex items-center gap-2">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/70 text-sm text-[var(--muted)]">
                  처리할 항목이 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredRows.map((r) => {
                    const isSelected = r.receipt_id === selectedReceiptId;
                    const hasInput = !!(r.pricing_total_amount_krw ?? r.pricing_total_amount);
                    const isApplied = !!r.applied_at;
                    const hasLinks = (r.linked_shipment_cnt ?? 0) > 0;

                    return (
                      <button
                        key={r.receipt_id}
                        type="button"
                        onClick={() => selectReceiptId(r.receipt_id)}
                        className={`group relative w-full rounded-lg border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm ring-1 ring-[var(--primary)]"
                            : "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-semibold transition-colors ${isSelected ? "text-[var(--primary)]" : "text-gray-900"}`}>
                              {shortPath(r.file_path)}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                              <span className="tabular-nums">{formatYmd(r.received_at)}</span>
                              <span className="text-gray-300">·</span>
                              <span className="truncate font-medium text-gray-700">{r.vendor_name ?? "거래처 미지정"}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5">
                              {hasLinks && <Badge tone="primary" className="h-5 px-1.5 text-[10px]">연결 {r.linked_shipment_cnt}</Badge>}
                              <Badge tone={hasInput ? "active" : "warning"} className="h-5 px-1.5 text-[10px]">{hasInput ? "입력" : "미입력"}</Badge>
                              <Badge tone={isApplied ? "active" : "warning"} className="h-5 px-1.5 text-[10px]">{isApplied ? "적용" : "미적용"}</Badge>
                            </div>
                            <div className="text-xs font-medium tabular-nums text-[var(--muted)]">
                              {r.pricing_currency_code ?? "-"} {formatNumber(r.pricing_total_amount)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: selected receipt editor */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Card className="min-h-[600px] border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-gray-900">
                  {selected ? "영수증 상세 및 배분" : "영수증을 선택하세요"}
                </div>
                {selected?.applied_at && (
                  <Badge tone="active" className="ml-2">적용완료</Badge>
                )}
              </div>
              {selected ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openReceiptPreview(selected.receipt_id)}>
                    미리보기
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => selectReceiptId(null)}>
                    닫기
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardBody className="p-6">
              {worklist.isLoading ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <Skeleton className="h-4 w-1/3" />
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="mt-3 h-24 w-full" />
                  </div>
                </div>
              ) : !selected ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-20 text-center">
                  <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                    <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">항목을 선택하세요</h3>
                  <p className="mt-1 max-w-sm text-sm text-gray-500">
                    왼쪽 목록에서 영수증을 선택하여 상세 정보를 입력하고<br />출고 원가 배분을 진행하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary Section */}
                  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">
                          {shortPath(selected.file_path)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="tabular-nums">{formatYmd(selected.received_at)}</span>
                          <span className="text-gray-300">·</span>
                          <span className="truncate font-medium text-gray-700">{selected.vendor_name ?? "거래처 미지정"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={selected.applied_at ? "active" : "warning"} className="h-5 px-1.5 text-[10px]">
                          {selected.applied_at ? "적용" : "미적용"}
                        </Badge>
                        <Badge tone={selected.pricing_total_amount_krw ? "active" : "warning"} className="h-5 px-1.5 text-[10px]">
                          {selected.pricing_total_amount_krw ? "입력" : "미입력"}
                        </Badge>
                        <Badge tone={selected.linked_shipment_cnt > 0 ? "primary" : "neutral"} className="h-5 px-1.5 text-[10px]">
                          연결 {selected.linked_shipment_cnt ?? 0}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-gray-500 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">통화</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {selected.pricing_currency_code ?? selected.inbox_currency_code ?? "-"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">총금액</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                          {formatNumber(selected.pricing_total_amount)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">KRW 환산</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">
                          {formatNumber(selected.pricing_total_amount_krw)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input Section */}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">통화</label>
                      <Select 
                        value={currencyCode} 
                        onChange={(e) => setCurrencyCode(e.target.value as "KRW" | "CNY")}
                        className="bg-gray-50/50"
                      >
                        <option value="KRW">KRW (원화)</option>
                        <option value="CNY">CNY (위안화)</option>
                      </Select>
                      <p className="text-[11px] text-gray-400">
                        * 환율은 적용 시점의 최신 시세(meta)를 참조
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">총금액 ({currencyCode})</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        className="font-mono text-lg font-medium tabular-nums"
                      />
                      <p className="text-[11px] text-gray-400">
                        KRW 환산: <span className="font-medium text-gray-700">{formatNumber(selected.pricing_total_amount_krw)}</span>
                        {selected.fx_rate_krw_per_unit && (
                          <span className="ml-1">(fx {formatNumber(selected.fx_rate_krw_per_unit)})</span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">중량 (g)</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={weightG}
                        onChange={(e) => setWeightG(e.target.value)}
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">기본공임</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={laborBasic}
                        onChange={(e) => setLaborBasic(e.target.value)}
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">기타공임</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={laborOther}
                        onChange={(e) => setLaborOther(e.target.value)}
                        className="font-mono tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5 lg:col-span-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">메모</label>
                      <Textarea
                        placeholder="특이사항이나 비고를 입력하세요"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="min-h-[80px] resize-none bg-gray-50/50"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={forceReapply}
                        onChange={(e) => setForceReapply(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span>기존 데이터 덮어쓰기 (재적용)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={onSave} disabled={busy || !selectedReceiptId}>
                        저장만 하기
                      </Button>
                      <Button onClick={onApply} disabled={busy || !selectedReceiptId} className="px-6 shadow-sm">
                        저장 및 배분 적용
                      </Button>
                    </div>
                  </div>

                  {/* Allocations Section */}
                  <div className="space-y-4">
                    <div className="flex items-end justify-between border-b border-gray-100 pb-2">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">연결된 출고 내역</h4>
                        <p className="mt-0.5 text-xs text-gray-500">
                          출고확정 당시 내부원가 합계 비례 배분
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-medium text-gray-900">{selected.linked_shipment_cnt ?? 0}건</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-gray-500">기준합 {formatNumber(selected.linked_basis_cost_krw)} KRW</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selected.linked_shipments?.length ? (
                        allocations.map((s) => (
                          <div
                            key={s.shipment_id}
                            className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 transition-all hover:border-gray-200 hover:shadow-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-gray-900">
                                  {s.customer_name ?? "(거래처 미상)"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Badge tone="neutral" className="bg-gray-100 text-gray-600">{formatYmd(s.ship_date)}</Badge>
                                  <Badge tone="neutral" className="bg-gray-100 text-gray-600">라인 {s.line_cnt ?? 0}</Badge>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-mono text-[10px] text-gray-400">{s.shipment_id}</span>
                                <span>·</span>
                                <span>기준 {formatNumber(s.basis_cost_krw)} KRW</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-[var(--primary)] tabular-nums">
                                {formatNumber(s.alloc_krw)} KRW
                              </div>
                              <div className="text-[10px] text-gray-400">
                                배분금액
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-12 text-center">
                          <p className="text-sm text-gray-500">연결된 출고가 없습니다.</p>
                          <p className="mt-1 text-xs text-gray-400">출고 관리에서 영수증을 연결해주세요.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selected.applied_at && (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold">원가 배분 적용 완료</p>
                        <p className="text-xs opacity-80">적용일시: {formatYmd(selected.applied_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="영수증 업로드">
        <div className="space-y-6">
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center transition-colors hover:bg-gray-50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <label className="cursor-pointer">
              <span className="text-sm font-semibold text-[var(--primary)] hover:underline">파일 선택</span>
              <Input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" />
            </label>
            <p className="mt-2 text-xs text-gray-500">
              PDF 또는 이미지 파일 (최대 10MB)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              취소
            </Button>
            <Button onClick={uploadReceipt} disabled={busy}>
              업로드
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
