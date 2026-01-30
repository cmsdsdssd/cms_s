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
  client_id?: string;
  client_name?: string;
  model_no?: string;
  color?: string;
  weight_g?: number;
  total_labor?: number;
};

type ShipmentLineSummary = {
  shipment_line_id?: string;
  shipment_id?: string;
  model_name?: string;
  qty?: number;
};

type ShipmentHistoryRow = {
  shipment_id?: string;
  ship_date?: string;
  customer_name?: string;
  model_name?: string;
  color?: string;
  qty?: number;
  shipment_status?: string;
};

type MasterSummary = {
  model_name?: string;
  category_code?: string;
  material_code?: string;
  type_code?: string;
  is_set_product?: boolean;
  set_components?: any;
};

type ReceiptRow = {
  receipt_id: string;
  received_at: string;
  file_path: string;
  file_bucket: string;
  mime_type?: string;
  status: string;
  vendor_party_id?: string;
  file_size_bytes?: number;
};

const debounceMs = 350;

export default function ShipmentsPage() {
  const schemaClient = useMemo(() => null, []); // (기존 코드 유지)
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

  // Load receipts for selection (✅ LINKED도 포함)
  const receiptsQuery = useQuery({
    queryKey: ["receipts", "uploaded"],
    queryFn: async () => {
      const res = await fetch("/api/receipts?status=UPLOADED,LINKED&limit=50");
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

      const res = await fetch(`/api/order-lookup?${params.toString()}`);
      const json = await res.json();
      const rows = (json.data ?? []) as OrderLookupRow[];
      setOrderLookupCache((prev) => ({ ...prev, [debouncedQuery]: rows }));
      return rows;
    },
    enabled: Boolean(debouncedQuery),
  });

  const saveMutation = useRpcMutation(CONTRACTS.functions.shipmentUpsertFromOrder);
  const confirmMutation = useRpcMutation(CONTRACTS.functions.shipmentConfirm);

  const handleSaveShipment = async () => {
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

  // Receipt Preview (inline)
  const [receiptPreviewSrc, setReceiptPreviewSrc] = useState<string | null>(null);
  const [receiptPreviewKind, setReceiptPreviewKind] = useState<"pdf" | "image" | null>(null);
  const [receiptPreviewTitle, setReceiptPreviewTitle] = useState<string>("");

  // Local preview (before upload)
  useEffect(() => {
    if (!confirmModalOpen || costMode !== "RECEIPT") return;
    if (!receiptFile) return;

    const objUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewSrc(objUrl);
    setReceiptPreviewKind(receiptFile.type === "application/pdf" ? "pdf" : "image");
    setReceiptPreviewTitle(receiptFile.name);

    return () => {
      URL.revokeObjectURL(objUrl);
    };
  }, [confirmModalOpen, costMode, receiptFile]);

  // Remote preview (after upload / selection)
  useEffect(() => {
    if (!confirmModalOpen || costMode !== "RECEIPT") return;

    // if local file is selected, local preview effect handles it
    if (receiptFile) return;

    if (!costReceiptId) {
      setReceiptPreviewSrc(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      return;
    }

    const r = (receiptsQuery.data ?? []).find((x) => x.receipt_id === costReceiptId);
    if (!r) return;

    const mime = (r as any).mime_type as string | undefined;
    const kind = mime?.includes("pdf") ? "pdf" : "image";

    setReceiptPreviewKind(kind);
    setReceiptPreviewTitle(r.file_path.split("/").pop() ?? "receipt");

    // Server-side proxy for reliable inline preview (PDF/image)
    const previewUrl = `/api/receipt-preview?bucket=${encodeURIComponent(r.file_bucket)}&path=${encodeURIComponent(
      r.file_path
    )}&mime=${encodeURIComponent(mime ?? "")}`;

    setReceiptPreviewSrc(previewUrl);
  }, [confirmModalOpen, costMode, receiptFile, costReceiptId, receiptsQuery.data]);

  const handleOpenReceiptInNewTab = () => {
    if (!receiptPreviewSrc) return;
    window.open(receiptPreviewSrc, "_blank", "noopener,noreferrer");
  };

  // 2) Final confirm
  const handleFinalConfirm = async () => {
    if (costMode === "RECEIPT" && !costReceiptId) {
      toast.error("RECEIPT 모드에서는 영수증을 선택해야 합니다.");
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

      setConfirmModalOpen(false);
      readyQuery.refetch();
      lineSummaryQuery.refetch();
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

  // (이하 페이지 렌더링: 기존 코드 유지, 모달 내부만 변경)
  return (
    <div className="space-y-6">
      <ActionBar
        title="출고"
        subtitle="주문을 검색하고 출고 저장 → 확정(영수증/수기/임시원가)을 진행합니다."
        right={
          <div className="flex gap-2">
            <Link href="/purchase_cost_worklist">
              <Button variant="secondary">원가 작업대</Button>
            </Link>
          </div>
        }
      />

      <FilterBar>
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            placeholder="주문/모델 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
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
                      <Button variant="secondary" onClick={handleOpenReceiptInNewTab} disabled={!receiptPreviewSrc}>
                        새 창
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ※ 영수증 업로드/선택 시 우측에 미리보기가 표시됩니다.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[var(--foreground)]">cost_lines (라인별 단가)</label>

                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#f8f9fc]">
                        <tr>
                          <th className="px-3 py-2">MODEL</th>
                          <th className="px-3 py-2">QTY</th>
                          <th className="px-3 py-2">UNIT COST (KRW)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--panel-border)]">
                        {(currentLinesQuery.data ?? [])
                          .filter((l) => Boolean(l.shipment_line_id))
                          .map((l) => {
                            const lineId = String(l.shipment_line_id);
                            return (
                              <tr key={lineId}>
                                <td className="px-3 py-2 font-semibold">{l.model_name ?? "-"}</td>
                                <td className="px-3 py-2">{l.qty ?? 0}</td>
                                <td className="px-3 py-2">
                                  <Input
                                    placeholder="예: 12000"
                                    value={costInputs[lineId] ?? ""}
                                    onChange={(e) =>
                                      setCostInputs((prev) => ({ ...prev, [lineId]: e.target.value }))
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        {currentLinesQuery.isLoading ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                              라인 로딩 중...
                            </td>
                          </tr>
                        ) : null}
                        {!currentLinesQuery.isLoading && (currentLinesQuery.data ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                              출고 라인이 없습니다.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-[var(--muted)]">
                    {costMode === "RECEIPT"
                      ? "RECEIPT 모드: 입력한 라인만 ACTUAL + purchase_receipt_id 연결, 빈칸은 master 임시원가 fallback(=PROVISIONAL)로 남습니다."
                      : "MANUAL 모드: 입력한 라인만 ACTUAL로 확정됩니다."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">영수증 미리보기</div>
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden h-[70vh]">
                  {receiptPreviewSrc ? (
                    receiptPreviewKind === "pdf" ? (
                      <iframe
                        title={receiptPreviewTitle || "receipt"}
                        src={receiptPreviewSrc}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full overflow-auto">
                        <img
                          src={receiptPreviewSrc}
                          alt={receiptPreviewTitle || "receipt"}
                          className="block w-full h-auto"
                        />
                      </div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted)]">
                      영수증을 업로드하거나 선택하면 여기에 표시됩니다.
                    </div>
                  )}
                </div>
                {receiptPreviewTitle ? (
                  <div className="text-xs text-[var(--muted)] truncate">{receiptPreviewTitle}</div>
                ) : null}
              </div>
            </div>
          )}

          {costMode === "MANUAL" && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[var(--foreground)]">cost_lines (라인별 단가)</label>

              <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f8f9fc]">
                    <tr>
                      <th className="px-3 py-2">MODEL</th>
                      <th className="px-3 py-2">QTY</th>
                      <th className="px-3 py-2">UNIT COST (KRW)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)]">
                    {(currentLinesQuery.data ?? [])
                      .filter((l) => Boolean(l.shipment_line_id))
                      .map((l) => {
                        const lineId = String(l.shipment_line_id);
                        return (
                          <tr key={lineId}>
                            <td className="px-3 py-2 font-semibold">{l.model_name ?? "-"}</td>
                            <td className="px-3 py-2">{l.qty ?? 0}</td>
                            <td className="px-3 py-2">
                              <Input
                                placeholder="예: 12000"
                                value={costInputs[lineId] ?? ""}
                                onChange={(e) => setCostInputs((prev) => ({ ...prev, [lineId]: e.target.value }))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    {currentLinesQuery.isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                          라인 로딩 중...
                        </td>
                      </tr>
                    ) : null}
                    {!currentLinesQuery.isLoading && (currentLinesQuery.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                          출고 라인이 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-[var(--muted)]">
                MANUAL 모드: 입력한 라인만 ACTUAL로 확정됩니다.
              </p>
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

      {/* (기존 페이지 하단 렌더링은 레포 원본 유지) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="출고 준비 목록" subtitle="저장 후 확정하세요." />
          <CardBody className="space-y-2">
            {(readyQuery.data ?? []).map((row, idx) => (
              <div
                key={row.shipment_id ?? idx}
                className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white p-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{row.customer_name ?? "-"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    shipment_id: {row.shipment_id ?? "-"} / lines: {row.line_count ?? 0}
                  </div>
                </div>
                <Badge>{row.status ?? "-"}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="도움말" subtitle="영수증 기반 원가 확정 흐름" />
          <CardBody className="text-sm text-[var(--muted)] space-y-2">
            <p>1) 출고 저장 → 2) 원가 모드 선택 → 3) 영수증 업로드/선택 → 4) 라인 단가 입력 → 5) 출고 확정</p>
            <p>※ OCR/자동 라인 매칭/입고 자동화는 현재 레포에 아직 포함되어 있지 않습니다.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
