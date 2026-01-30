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

type ShipReadyRow = {
  shipment_id?: string;
  customer_name?: string;
  line_count?: number;
  status?: string;
  ship_date?: string;
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
    queryFn: () => readView<ShipReadyRow>("cms_shipment_header", 50),
  });

  const lineSummaryQuery = useQuery({
    queryKey: ["cms", "shipment_line", "summary"],
    queryFn: () =>
      readView<ShipmentLineSummary>("cms_shipment_line", 200, {
        orderBy: { column: "created_at", ascending: false },
      }),
  });

  // Load lines for current shipment (for manual cost input)
  const currentLinesQuery = useQuery({
    queryKey: ["cms", "shipment_line", currentShipmentId],
    queryFn: () => {
      if (!currentShipmentId) return [] as ShipmentLineSummary[];
      return readView<ShipmentLineSummary>("cms_shipment_line", 50, {
        filter: { column: "shipment_id", op: "eq", value: currentShipmentId },
        orderBy: { column: "created_at", ascending: false },
      });
    },
    enabled: Boolean(currentShipmentId),
  });

  // Load receipts for selection
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
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("limit", "20");
      const res = await fetch(`/api/order-lookup?${params.toString()}`);
      const json = (await res.json()) as { data?: OrderLookupRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "조회 실패");
      const rows = json.data ?? [];
      setOrderLookupCache((prev) => ({ ...prev, [debouncedQuery]: rows }));
      return rows;
    },
    enabled: searchOpen,
  });

  const lookupRows = useMemo(() => {
    const rows = lookupQuery.data ?? [];
    return rows.filter((row) => {
      const status = String(row.status ?? "").toUpperCase();
      return status !== "CANCELLED" && status !== "VOID";
    });
  }, [lookupQuery.data]);

  const masterQuery = useQuery({
    queryKey: ["cms", "master_summary", prefill?.model_no],
    queryFn: async () => {
      if (!prefill?.model_no) return null;
      const res = await fetch(`/api/master-items?model=${encodeURIComponent(prefill.model_no)}`);
      const json = (await res.json()) as { data?: MasterSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "마스터 조회 실패");
      const rows = json.data ?? [];
      const modelKey = (prefill.model_no ?? "").trim().toLowerCase();
      const exact = rows.find((r) => (r.model_name ?? "").toLowerCase() === modelKey);
      return exact ?? rows[0] ?? null;
    },
    enabled: Boolean(prefill?.model_no),
  });

  const historyByModelQuery = useQuery({
    queryKey: ["cms", "shipment_history", "by_model", prefill?.model_no],
    queryFn: () => {
      if (!prefill?.model_no) return [] as ShipmentHistoryRow[];
      return readView<ShipmentHistoryRow>("v_cms_shipment_history_by_model", 50, {
        filter: { column: "model_name", op: "ilike", value: prefill.model_no },
        orderBy: { column: "ship_date", ascending: false },
      });
    },
    enabled: Boolean(prefill?.model_no),
  });

  const historyRecentQuery = useQuery({
    queryKey: ["cms", "shipment_history", "recent"],
    queryFn: () =>
      readView<ShipmentHistoryRow>("v_cms_shipment_history_by_model", 50, {
        orderBy: { column: "ship_date", ascending: false },
      }),
  });

  const historyRows = useMemo(() => {
    const modelKey = (prefill?.model_no ?? "").trim().toLowerCase();
    const byModel = historyByModelQuery.data ?? [];
    const recent = historyRecentQuery.data ?? [];
    const seen = new Set<string>();
    const merged: ShipmentHistoryRow[] = [];

    for (const row of byModel) {
      const key = row.shipment_line_id ?? "";
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    for (const row of recent) {
      const key = row.shipment_line_id ?? "";
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }

    merged.sort((a, b) => {
      const matchA = modelKey ? (a.model_name ?? "").trim().toLowerCase() === modelKey : false;
      const matchB = modelKey ? (b.model_name ?? "").trim().toLowerCase() === modelKey : false;
      if (matchA !== matchB) return matchA ? -1 : 1;

      const dateA = (a.ship_date ?? a.created_at ?? "").toString();
      const dateB = (b.ship_date ?? b.created_at ?? "").toString();
      if (dateA === dateB) return 0;
      return dateA < dateB ? 1 : -1;
    });

    return merged.slice(0, 20);
  }, [prefill?.model_no, historyByModelQuery.data, historyRecentQuery.data]);

  useEffect(() => {
    if (masterQuery.data) {
      setMasterInfo(masterQuery.data as MasterSummary);
    } else {
      setMasterInfo(null);
    }
  }, [masterQuery.data]);

  const handleSelectOrder = async (row: OrderLookupRow) => {
    if (!row.order_line_id) return;
    setSelectedOrderLineId(row.order_line_id);
    setSearchOpen(false);
    setWeightG("");
    setTotalLabor("");

    const res = await fetch(`/api/shipment-prefill?order_line_id=${row.order_line_id}`);
    const json = (await res.json()) as { data?: ShipmentPrefill; error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "프리필 조회 실패");
    }
    setPrefill(json.data ?? null);
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

  // 1) Save -> open confirm modal
  const handleInitialConfirm = async () => {
    if (!selectedOrderLineId) return;
    const weightValue = Number(weightG);
    const laborValue = Number(totalLabor);
    if (Number.isNaN(weightValue) || weightValue <= 0) return;
    if (Number.isNaN(laborValue) || laborValue <= 0) return;
    if (!actorId) return;

    setSaving(true);
    try {
      const saved = await saveMutation.mutateAsync({
        p_order_line_id: selectedOrderLineId,
        p_weight_g: weightValue,
        p_total_labor: laborValue,
        p_actor_person_id: actorId || null,
        p_idempotency_key: idempotencyKey,
      });
      const shipmentId = saved?.shipment_id;
      if (!shipmentId) return;

      setCurrentShipmentId(shipmentId);
      setConfirmModalOpen(true);
      setCostMode("PROVISIONAL");
      setCostReceiptId(null);
      setCostInputs({});
      setReceiptFile(null);
      setReceiptUploading(false);
      setReceiptFileInputKey((k) => k + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("출고 저장 실패", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadReceipt = async () => {
    if (!confirmModalOpen) return;
    if (costMode !== "RECEIPT") setCostMode("RECEIPT");

    if (!receiptFile) {
      toast.error("업로드할 영수증 파일을 선택해주세요.");
      return;
    }

    setReceiptUploading(true);
    try {
      const fd = new FormData();
      fd.append("file0", receiptFile);

      const res = await fetch("/api/receipt-upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; receipt_id?: string; error?: string };

      if (!res.ok || !json?.ok || !json.receipt_id) {
        throw new Error(json?.error ?? `upload failed (${res.status})`);
      }

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

  const handlePreviewReceipt = async () => {
    if (!costReceiptId) return;
    const r = (receiptsQuery.data ?? []).find((x) => x.receipt_id === costReceiptId);
    if (!r) return;

    const res = await fetch(
      `/api/receipt-file?bucket=${r.file_bucket}&path=${encodeURIComponent(r.file_path)}`
    );
    const json = (await res.json()) as { signedUrl?: string; error?: string };
    if (json.signedUrl) {
      window.open(json.signedUrl, "_blank");
    } else {
      toast.error("영수증 미리보기 실패", { description: json.error || "signedUrl missing" });
    }
  };

  // 2) Final confirm
  const handleFinalConfirm = async () => {
    if (!currentShipmentId || !actorId) return;

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

      setConfirmModalOpen(false);
      readyQuery.refetch();
      lineSummaryQuery.refetch();
      historyByModelQuery.refetch();
      historyRecentQuery.refetch();
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

  return (
    <div className="space-y-4">
      <ActionBar title="출고" subtitle="주문을 선택하고 출고를 확정하세요." />

      <FilterBar id="shipments.filterBar">
        <div className="relative w-full">
          <Input
            ref={inputRef}
            placeholder="출고검색 (주문번호/고객/모델)"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchOpen ? (
            <div
              ref={popoverRef}
              className="absolute left-0 right-0 mt-2 rounded-[12px] border border-[var(--panel-border)] bg-white shadow-lg z-20"
            >
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#f8f9fc]">
                    <tr>
                      <th className="px-3 py-2">CUSTOMER</th>
                      <th className="px-3 py-2">MODEL</th>
                      <th className="px-3 py-2">COLOR</th>
                      <th className="px-3 py-2">ORDER NO</th>
                      <th className="px-3 py-2">DATE</th>
                      <th className="px-3 py-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {lookupRows.map((row) => (
                      <tr
                        key={row.order_line_id}
                        className="cursor-pointer hover:bg-blue-50/40"
                        onClick={() => handleSelectOrder(row)}
                      >
                        <td className="px-3 py-2 font-semibold">{row.client_name ?? "-"}</td>
                        <td className="px-3 py-2 font-semibold">{row.model_no ?? "-"}</td>
                        <td className="px-3 py-2">{row.color ?? "-"}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{row.order_no ?? "-"}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{row.order_date ?? "-"}</td>
                        <td className="px-3 py-2">
                          <Badge tone={row.status === "READY" ? "active" : "neutral"}>
                            {row.status ?? "READY"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {lookupQuery.isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-[var(--muted)]">
                          조회 중...
                        </td>
                      </tr>
                    ) : null}
                    {!lookupQuery.isLoading && lookupRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center text-[var(--muted)]">
                          검색 결과 없음
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </FilterBar>

      <Modal open={confirmModalOpen} onOpenChange={setConfirmModalOpen} title="출고 확정">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-2">
            <div className="text-sm font-semibold">확정 대상</div>
            <div className="text-xs text-[var(--muted)]">
              주문: {prefill?.order_no ?? "—"} / 고객: {prefill?.client_name ?? "—"} / 모델:{" "}
              {prefill?.model_no ?? "—"}
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
                <p className="text-xs text-gray-500 mt-1">※ 미입력 시 마스터 임시원가 사용</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleFinalConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "확정 중..." : "출고 확정"}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3" id="shipments.formPanel">
          <Card id="shipments.orderCard">
            <CardHeader>
              <ActionBar title="출고 입력" subtitle="주문 선택 → 중량/공임 입력 → 저장" />
            </CardHeader>
            <CardBody className="space-y-3">
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

              <div className="flex justify-end">
                <Button onClick={handleInitialConfirm} disabled={!canSave || saving}>
                  {saving ? "저장 중..." : "출고 저장"}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card id="shipments.readyList">
            <CardHeader>
              <ActionBar title="출고 현황" subtitle="최근 출고 기록" />
            </CardHeader>
            <CardBody className="space-y-2 text-xs">
              {(readyQuery.data ?? []).map((row) => (
                <div
                  key={row.shipment_id}
                  className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white p-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{row.customer_name ?? "—"}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {row.ship_date ?? ""} · 라인 {row.line_count ?? 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone="neutral" className="rounded-[4px]">
                      {row.status ?? "—"}
                    </Badge>
                    <div className="mt-1">
                      <Link className="text-xs text-[var(--primary)] underline" href={`/shipments_main`}>
                        목록
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {(readyQuery.data ?? []).length === 0 ? (
                <div className="text-sm text-[var(--muted)]">출고 데이터가 없습니다.</div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3" id="shipments.listPanel">
          <Card id="shipments.masterCard">
            <CardHeader>
              <ActionBar title="마스터 정보" subtitle={prefill?.model_no ?? "모델 선택"} />
            </CardHeader>
            <CardBody className="grid gap-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
                <div className="aspect-square rounded-[12px] border border-dashed border-[var(--panel-border)] flex items-center justify-center w-full max-w-[194px] overflow-hidden">
                  {masterInfo?.image_url ? (
                    <img
                      src={masterInfo.image_url}
                      alt={masterInfo.model_name ?? "master"}
                      className="w-full h-full object-cover rounded-[10px]"
                    />
                  ) : (
                    <span className="text-xs text-[var(--muted)]">이미지 없음</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div>
                    <label className="text-[var(--muted)]">MODEL</label>
                    <div className="mt-1 text-sm">{masterInfo?.model_name ?? "-"}</div>
                  </div>
                  <div>
                    <label className="text-[var(--muted)]">VENDOR</label>
                    <div className="mt-1 text-sm">{masterInfo?.vendor_name ?? "-"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[var(--muted)]">WEIGHT DEFAULT</label>
                      <div className="mt-1 text-sm">{masterInfo?.weight_default_g ?? "-"} g</div>
                    </div>
                    <div>
                      <label className="text-[var(--muted)]">DEDUCTION</label>
                      <div className="mt-1 text-sm">{masterInfo?.deduction_weight_default_g ?? "-"} g</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card id="shipments.history">
            <CardHeader>
              <ActionBar title="이전 출고 내역" subtitle="동일 모델 우선 → 날짜 최신순" />
            </CardHeader>
            <CardBody className="space-y-2 text-xs">
              {(historyRows ?? []).map((row) => {
                const modelKey = (prefill?.model_no ?? "").trim().toLowerCase();
                const isMatch =
                  modelKey && (row.model_name ?? "").trim().toLowerCase() === modelKey;

                return (
                  <div
                    key={row.shipment_line_id}
                    className="rounded-[12px] border border-[var(--panel-border)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {row.model_name ?? "-"} {row.suffix ?? ""}
                        {isMatch ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                            MATCH
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[var(--muted)]">
                        {row.ship_date ?? row.created_at ?? "-"}
                      </span>
                    </div>
                    <div className="mt-1 text-[var(--muted)]">
                      색상 {row.color ?? "-"} · 수량 {row.qty ?? 0} · 상태 {row.shipment_status ?? "-"}
                    </div>
                  </div>
                );
              })}
              {(historyRows ?? []).length === 0 ? (
                <p className="text-xs text-[var(--muted)]">이전 출고 내역 없음</p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
