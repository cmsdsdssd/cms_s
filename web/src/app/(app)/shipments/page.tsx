"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useQuery } from "@tanstack/react-query";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { readView } from "@/lib/supabase/read";
import { toast } from "sonner";

// --- Types ---
type ShipReadyRow = {
  shipment_id?: string;
  shipment_header_id?: string;
  customer_name?: string;
  line_count?: number;
  status?: string;
  ship_date?: string;
  created_at?: string;
};

type OrderLookupRow = {
  order_id?: string;
  order_line_id?: string;
  order_no?: string;
  order_date?: string;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  color?: string;
  status?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
};

type ShipmentPrefill = {
  order_line_id?: string;
  order_id?: string;
  order_no?: string;
  order_date?: string;
  client_id?: string;
  client_name?: string;
  model_no?: string;
  color?: string;
  plating_status?: boolean | null;
  plating_color?: string | null;
  category?: string | null;
  size?: string | null;
  note?: string | null;
  photo_url?: string | null;
};

type MasterSummary = {
  model_name?: string | null;
  image_url?: string | null;
  vendor_name?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  symbol?: string | null;
  color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  labor_basic?: number | null;
  labor_center?: number | null;
  labor_side1?: number | null;
  labor_side2?: number | null;
  labor_base_cost?: number | null;
  labor_center_cost?: number | null;
  labor_sub1_cost?: number | null;
  labor_sub2_cost?: number | null;
};

type ShipmentHistoryRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  order_line_id?: string | null;
  ship_date?: string | null;
  shipment_status?: string | null;
  model_name?: string | null;
  suffix?: string | null;
  color?: string | null;
  qty?: number | null;
  is_plated?: boolean | null;
  plating_variant_id?: string | null;
  manual_total_amount_krw?: number | null;
  created_at?: string | null;
};

type ShipmentLineSummary = {
  shipment_id?: string;
  shipment_line_id?: string;
  model_name?: string | null;
  color?: string | null;
  measured_weight_g?: number | null;
  manual_labor_krw?: number | null;
  qty?: number;
};

type ReceiptRow = {
  receipt_id: string;
  received_at: string;
  file_path: string;
  file_bucket: string;
  status: string;
  vendor_party_id?: string;
  file_size_bytes?: number;
};

type CurrentShipmentLine = {
  shipment_line_id?: string;
  shipment_id?: string;
  model_name?: string | null;
  qty?: number | null;
};

const debounceMs = 250;

export default function ShipmentsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [weightG, setWeightG] = useState("");
  const [totalLabor, setTotalLabor] = useState("");
  const [prefill, setPrefill] = useState<ShipmentPrefill | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderLookupCache, setOrderLookupCache] = useState<Record<string, OrderLookupRow[]>>({});
  const [masterInfo, setMasterInfo] = useState<MasterSummary | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Confirm Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentShipmentId, setCurrentShipmentId] = useState<string | null>(null);
  const [costMode, setCostMode] = useState<"PROVISIONAL" | "MANUAL" | "RECEIPT">("PROVISIONAL");
  const [costReceiptId, setCostReceiptId] = useState<string | null>(null);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({}); // lineId -> cost

  // Receipt upload (inbox)
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptFileInputKey, setReceiptFileInputKey] = useState(0);

  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())),
    []
  );

  // --- Queries ---
  const readyQuery = useQuery({
    queryKey: ["cms", "shipment_header"],
    queryFn: () => readView<ShipReadyRow>("cms_v_shipment_ready_v1", 50),
  });

  const lineSummaryQuery = useQuery({
    queryKey: ["cms", "shipment_line_summary"],
    queryFn: () => readView<ShipmentLineSummary>("cms_v_shipment_line_summary_v1", 200),
  });

  const historyQuery = useQuery({
    queryKey: ["cms", "shipment_history"],
    queryFn: () => readView<ShipmentHistoryRow>("cms_v_shipment_history_v1", 200),
  });

  const currentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_lines_current", currentShipmentId],
    queryFn: async () => {
      if (!currentShipmentId) return [];
      const rows = await readView<CurrentShipmentLine>("cms_v_shipment_lines_for_cost_v1", 200, {
        shipment_id: currentShipmentId,
      });
      return rows ?? [];
    },
    enabled: Boolean(confirmModalOpen && currentShipmentId),
  });

  const receiptsQuery = useQuery({
    queryKey: ["receipts", "uploaded"],
    queryFn: async () => {
      const res = await fetch("/api/receipts?status=UPLOADED&limit=50");
      const json = await res.json();
      return (json.data ?? []) as ReceiptRow[];
    },
    enabled: confirmModalOpen && costMode === "RECEIPT",
  });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery.trim()), debounceMs);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const lookupQuery = useQuery({
    queryKey: ["order-lookup", debouncedQuery],
    queryFn: async () => {
      if (orderLookupCache[debouncedQuery]) return orderLookupCache[debouncedQuery];
      const payload = { q: debouncedQuery, limit: 30 };
      const res = await fetch("/api/order-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      const data = (json.data ?? []) as OrderLookupRow[];
      setOrderLookupCache((prev) => ({ ...prev, [debouncedQuery]: data }));
      return data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleSelectOrderLine = async (row: OrderLookupRow) => {
    const id = row.order_line_id ?? null;
    setSelectedOrderLineId(id);
    setSearchOpen(false);
    setSearchQuery(row.order_no ?? "");
    setPrefill(null);
    setMasterInfo(null);

    if (!id) return;

    // Prefill info
    const res = await fetch("/api/shipment-prefill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_line_id: id }),
    });
    const json = await res.json();
    setPrefill(json.data ?? null);

    // Master info (optional)
    if (json.data?.model_no) {
      const mres = await fetch(`/api/master-item?model_name=${encodeURIComponent(json.data.model_no)}`);
      const mjson = await mres.json();
      setMasterInfo(mjson.data ?? null);
    }
  };

  const upsertFn = CONTRACTS.functions.shipmentUpsertFromOrder;
  const confirmFn = CONTRACTS.functions.shipmentConfirm;

  const saveMutation = useRpcMutation<{ shipment_id: string; shipment_line_id: string }>({
    fn: upsertFn,
  });

  const confirmMutation = useRpcMutation<{ ok: boolean }>({
    fn: confirmFn,
    successMessage: "출고 확정 및 원가 적용 완료",
  });

  const canSave =
    Boolean(selectedOrderLineId) &&
    Boolean(actorId) &&
    Boolean(weightG) &&
    Boolean(totalLabor) &&
    isFnConfigured(upsertFn) &&
    isFnConfigured(confirmFn);

  // 1. Initial Confirm (Save -> Open Modal)
  const handleInitialConfirm = async () => {
    if (!selectedOrderLineId) return;
    const weightValue = Number(weightG);
    const laborValue = Number(totalLabor);
    if (Number.isNaN(weightValue) || weightValue <= 0) return;
    if (Number.isNaN(laborValue) || laborValue <= 0) return;
    if (!actorId) return;

    setSaving(true);
    try {
      // Upsert shipment first to ensure it exists
      const saved = await saveMutation.mutateAsync({
        p_order_line_id: selectedOrderLineId,
        p_weight_g: weightValue,
        p_total_labor: laborValue,
        p_actor_person_id: actorId || null,
        p_idempotency_key: idempotencyKey,
      });
      const shipmentId = saved?.shipment_id;
      if (!shipmentId) return;

      // Set state and open modal
      setCurrentShipmentId(shipmentId);
      setConfirmModalOpen(true);
      setCostMode("PROVISIONAL");
      setCostReceiptId(null);
      setCostInputs({});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("출고 저장 실패", { description: message });
    } finally {
      setSaving(false);
    }
  };

  // Receipt Upload -> Receipt Inbox (Storage + DB)
  const handleUploadReceipt = async () => {
    if (!confirmModalOpen) return;
    if (costMode !== "RECEIPT") {
      setCostMode("RECEIPT");
    }
    if (!receiptFile) {
      toast.error("업로드할 영수증 파일을 선택해주세요.");
      return;
    }

    setReceiptUploading(true);
    try {
      const fd = new FormData();
      fd.append("file0", receiptFile);

      const res = await fetch("/api/receipt-upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        const msg = json?.error ? String(json.error) : `upload failed (${res.status})`;
        throw new Error(msg);
      }

      // Refresh list and auto-select
      await receiptsQuery.refetch();
      setCostReceiptId(String(json.receipt_id));

      toast.success("영수증 업로드 완료");
      setReceiptFile(null);
      setReceiptFileInputKey((k) => k + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("영수증 업로드 실패", { description: message });
    } finally {
      setReceiptUploading(false);
    }
  };

  // 2. Final Confirm (Call RPC)
  const handleFinalConfirm = async () => {
    if (!currentShipmentId || !actorId) return;

    // Validate inputs
    if (costMode === "RECEIPT" && !costReceiptId) {
      toast.error("영수증을 선택해주세요.");
      return;
    }

    const costLines = Object.entries(costInputs)
      .map(([lineId, cost]) => ({
        shipment_line_id: lineId,
        unit_cost_krw: Number(cost),
      }))
      .filter((x) => !Number.isNaN(x.unit_cost_krw) && x.unit_cost_krw >= 0);

    try {
      await confirmMutation.mutateAsync({
        p_shipment_id: currentShipmentId,
        p_actor_person_id: actorId,
        p_note: "confirm from web",
        p_cost_mode: costMode,
        p_receipt_id: costReceiptId,
        p_cost_lines: costLines,
        p_emit_inventory: true,
      });

      // Cleanup
      setConfirmModalOpen(false);
      readyQuery.refetch();
      lineSummaryQuery.refetch();
      historyQuery.refetch();
      setSelectedOrderLineId(null);
      setPrefill(null);
      setWeightG("");
      setTotalLabor("");
      setSearchQuery("");
      setCurrentShipmentId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("출고 확정 실패", { description: message });
    }
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current || !inputRef.current) return;
      if (popoverRef.current.contains(event.target as Node)) return;
      if (inputRef.current.contains(event.target as Node)) return;
      setSearchOpen(false);
    };
    if (searchOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [searchOpen]);

  const handlePreviewReceipt = async () => {
    if (!costReceiptId) return;
    const r = receiptsQuery.data?.find((x) => x.receipt_id === costReceiptId);
    if (r) {
      const res = await fetch(
        `/api/receipt-file?bucket=${r.file_bucket}&path=${encodeURIComponent(r.file_path)}`
      );
      const json = await res.json();
      if (json.signedUrl) {
        window.open(json.signedUrl, "_blank");
      } else {
        toast.error("영수증 미리보기 실패", { description: json.error || "signedUrl missing" });
      }
    }
  };

  const selectedLookupRow = useMemo(() => {
    return (lookupQuery.data ?? []).find((x) => x.order_line_id === selectedOrderLineId) ?? null;
  }, [lookupQuery.data, selectedOrderLineId]);

  const shipmentSummaryById = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    (lineSummaryQuery.data ?? []).forEach((row) => {
      const id = row.shipment_id ?? "";
      if (!id) return;
      const prev = map.get(id) ?? { total: 0, count: 0 };
      map.set(id, {
        total: prev.total + (row.manual_labor_krw ?? 0),
        count: prev.count + 1,
      });
    });
    return map;
  }, [lineSummaryQuery.data]);

  const currentShipmentLines = useMemo(() => {
    return (currentLinesQuery.data ?? []).filter((x) => x.shipment_line_id);
  }, [currentLinesQuery.data]);

  return (
    <div className="space-y-4">
      <ActionBar title="출고" subtitle="주문을 선택하고 출고를 확정하세요." />

      <FilterBar>
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef as any}
              placeholder="주문 검색 (주문번호/고객/모델)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />

            {searchOpen ? (
              <div
                ref={popoverRef}
                className="absolute z-50 mt-2 w-full rounded-[12px] border border-[var(--panel-border)] bg-white shadow-lg overflow-hidden"
              >
                <div className="max-h-72 overflow-y-auto">
                  {(lookupQuery.data ?? []).map((row) => (
                    <button
                      type="button"
                      key={row.order_line_id}
                      className="w-full px-3 py-2 text-left hover:bg-[#f6f7f9] flex items-center justify-between"
                      onClick={() => handleSelectOrderLine(row)}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">
                          {row.order_no ?? "—"}{" "}
                          <span className="text-xs text-[var(--muted)]">
                            {row.order_date ?? ""}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {row.client_name ?? "고객"} · {row.model_no ?? ""} · {row.color ?? ""}
                        </div>
                      </div>
                      <Badge className="rounded-[4px]" variant="secondary">
                        선택
                      </Badge>
                    </button>
                  ))}
                  {(lookupQuery.data ?? []).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-[var(--muted)]">검색 결과 없음</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <Button onClick={handleInitialConfirm} disabled={!canSave || saving}>
            {saving ? "저장 중..." : "출고 저장"}
          </Button>
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="선택 주문" subtitle="출고할 주문 상세" />
          <CardBody className="space-y-3">
            {prefill ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{prefill.order_no ?? "—"}</div>
                  <Badge variant="secondary" className="rounded-[4px]">
                    {prefill.order_date ?? ""}
                  </Badge>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  고객: <span className="font-semibold">{prefill.client_name ?? "—"}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
                    <div className="text-[var(--muted)]">모델</div>
                    <div className="font-semibold">{prefill.model_no ?? "—"}</div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
                    <div className="text-[var(--muted)]">색상</div>
                    <div className="font-semibold">{prefill.color ?? "—"}</div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
                    <div className="text-[var(--muted)]">사이즈</div>
                    <div className="font-semibold">{prefill.size ?? "—"}</div>
                  </div>
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
                    <div className="text-[var(--muted)]">메모</div>
                    <div className="font-semibold">{prefill.note ?? "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--foreground)]">중량(g)</label>
                    <Input
                      className="h-10"
                      placeholder="예: 3.25"
                      value={weightG}
                      onChange={(e) => setWeightG(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--foreground)]">총 공임(원)</label>
                    <Input
                      className="h-10"
                      placeholder="예: 50000"
                      value={totalLabor}
                      onChange={(e) => setTotalLabor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  * 출고 저장 후 모달에서 원가/영수증(선택)을 확정합니다.
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--muted)]">주문을 검색해서 선택하세요.</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="출고 현황" subtitle="최근 출고/확정 기록" />
          <CardBody className="space-y-2">
            {(readyQuery.data ?? []).map((row) => {
              const id = row.shipment_id ?? "";
              const summary = shipmentSummaryById.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white p-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{row.customer_name ?? "—"}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {row.ship_date ?? ""} · 라인 {row.line_count ?? 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="rounded-[4px]">
                      {row.status ?? "—"}
                    </Badge>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      공임합: {summary?.total ?? 0} (라인 {summary?.count ?? 0})
                    </div>
                    <Link
                      className="text-xs text-[var(--primary)] underline"
                      href={`/shipments_main`}
                    >
                      목록
                    </Link>
                  </div>
                </div>
              );
            })}
            {(readyQuery.data ?? []).length === 0 ? (
              <div className="text-sm text-[var(--muted)]">출고 준비 데이터가 없습니다.</div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Modal open={confirmModalOpen} onOpenChange={setConfirmModalOpen} title="출고 확정">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-2">
            <div className="text-sm font-semibold">확정 대상</div>
            <div className="text-xs text-[var(--muted)]">
              주문: {prefill?.order_no ?? selectedLookupRow?.order_no ?? "—"} / 모델:{" "}
              {prefill?.model_no ?? selectedLookupRow?.model_no ?? "—"} / 색상:{" "}
              {prefill?.color ?? selectedLookupRow?.color ?? "—"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              중량(g): {weightG || "—"} / 총 공임(원): {totalLabor || "—"}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">원가 모드</label>
            <div className="flex gap-2">
              <Button
                variant={costMode === "PROVISIONAL" ? "default" : "secondary"}
                onClick={() => setCostMode("PROVISIONAL")}
              >
                임시원가
              </Button>
              <Button
                variant={costMode === "MANUAL" ? "default" : "secondary"}
                onClick={() => setCostMode("MANUAL")}
              >
                수기입력
              </Button>
              <Button
                variant={costMode === "RECEIPT" ? "default" : "secondary"}
                onClick={() => setCostMode("RECEIPT")}
              >
                영수증
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              * 영수증/수기 모드에서도 라인별 단가 입력을 생략하면 임시원가로 남길 수 있습니다.
            </p>
          </div>

          {costMode === "RECEIPT" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">영수증 업로드</label>
                <div className="flex flex-col gap-2">
                  <Input
                    key={receiptFileInputKey}
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="secondary"
                      onClick={handleUploadReceipt}
                      disabled={receiptUploading || !receiptFile}
                    >
                      {receiptUploading ? "업로드 중..." : "업로드"}
                    </Button>
                    <span className="text-xs text-[var(--muted)]">PDF/JPG/PNG/WebP (최대 20MB)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">영수증 선택</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchSelect
                      placeholder="영수증 검색..."
                      options={(receiptsQuery.data ?? []).map((r) => ({
                        label: `${r.received_at.slice(0, 10)} (${r.file_path.split("/").pop()})`,
                        value: r.receipt_id,
                      }))}
                      value={costReceiptId ?? undefined}
                      onChange={setCostReceiptId}
                    />
                  </div>
                  <Button variant="secondary" onClick={handlePreviewReceipt} disabled={!costReceiptId}>
                    보기
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  선택된 영수증은 출고 확정 시 원가 근거로 <span className="font-semibold">cms_receipt_usage</span>에 연결되고,
                  영수증 상태가 <span className="font-semibold">LINKED</span>로 변경됩니다.
                </p>
              </div>
            </div>
          )}

          {(costMode === "MANUAL" || costMode === "RECEIPT") && (
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">실제 원가 입력 (선택)</label>
              <div className="space-y-2 max-h-40 overflow-auto border rounded p-2">
                {(currentLinesQuery.data ?? []).length === 0 && (
                  <span className="text-xs text-gray-500">라인 로딩 중...</span>
                )}
                {(currentLinesQuery.data ?? []).map((line) => (
                  <div key={line.shipment_line_id} className="grid grid-cols-[1fr_80px] gap-2 items-center">
                    <span className="text-xs">
                      {line.model_name} (Qty: {line.qty ?? 1})
                    </span>
                    <Input
                      className="h-8 text-right"
                      placeholder="단가"
                      value={costInputs[line.shipment_line_id!] || ""}
                      onChange={(e) =>
                        setCostInputs((prev) => ({ ...prev, [line.shipment_line_id!]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">
                * 단가 입력 시 해당 라인은 ACTUAL로 확정되며, 영수증을 선택한 경우 purchase_receipt_id가 함께 저장됩니다.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleFinalConfirm} disabled={!currentShipmentId || confirmMutation.isPending}>
              {confirmMutation.isPending ? "확정 중..." : "출고 확정"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
