"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";

import { CONTRACTS } from "@/lib/contracts";
import { readView } from "@/lib/supabase/read";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { cn } from "@/lib/utils";

type OrderLookupRow = {
  order_line_id?: string;
  order_id?: string;
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

type ShipmentPrefillRow = {
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

type MasterLookupRow = {
  master_item_id?: string;
  model_name?: string;
  photo_url?: string | null;
  material_code_default?: string | null;
  category_code?: string | null;
  weight_default_g?: number | null;
  deduction_weight_default_g?: number | null;
  center_qty_default?: number | null;
  sub1_qty_default?: number | null;
  sub2_qty_default?: number | null;
  vendor_name?: string | null;
  material_price?: number | null;
  labor_basic?: number | null;
  labor_center?: number | null;
  labor_side1?: number | null;
  labor_side2?: number | null;
};

type ShipmentLineRow = {
  shipment_line_id?: string;
  shipment_id?: string;
  model_name?: string;
  qty?: number;
};

type ReceiptRow = {
  receipt_id: string;
  received_at: string;
  file_path: string;
  file_bucket: string;
  mime_type?: string;
  status: string;
};

type ShipmentUpsertResult = {
  shipment_id?: string;
  shipment_line_id?: string;
  status?: string;
};

const debounceMs = 250;
// ✅ 0265에 있는 함수명을 그대로 사용 (영수증 “연결” upsert)
const FN_RECEIPT_USAGE_UPSERT = "cms_fn_upsert_receipt_usage_alloc_v1";

const normalizeId = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return text;
};

export default function ShipmentsPage() {
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now())),
    []
  );

  // --- 주문 검색/선택 ---
  const [lookupOpen, setLookupOpen] = useState(false);
  const lookupInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [onlyReadyToShip, setOnlyReadyToShip] = useState(true);

  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string | null>(null);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string | null>(null);

  // --- prefill + master info ---
  const [prefill, setPrefill] = useState<ShipmentPrefillRow | null>(null);

  // --- 입력값 ---
  const [weightG, setWeightG] = useState("");
  const [deductionWeightG, setDeductionWeightG] = useState("");
  const [totalLabor, setTotalLabor] = useState(""); // 헤더 입력(참고/빠른 입력)

  // --- confirm modal ---
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentShipmentId, setCurrentShipmentId] = useState<string | null>(null);
  const [currentShipmentLineId, setCurrentShipmentLineId] = useState<string | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);

  // ✅ A안: RECEIPT 모드 제거 (임시/수기만 유지)
  const [costMode, setCostMode] = useState<"PROVISIONAL" | "MANUAL">("PROVISIONAL");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({}); // shipment_line_id -> unit_cost_krw

  // --- 영수증(연결만, A안) ---
  const [linkedReceiptId, setLinkedReceiptId] = useState<string | null>(null);

  // receipt upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptFileInputKey, setReceiptFileInputKey] = useState(0);

  // receipt preview
  const [receiptPreviewSrc, setReceiptPreviewSrc] = useState<string | null>(null); // objectURL
  const [receiptPreviewOpenUrl, setReceiptPreviewOpenUrl] = useState<string | null>(null); // server URL (new tab)
  const [receiptPreviewKind, setReceiptPreviewKind] = useState<"pdf" | "image" | null>(null);
  const [receiptPreviewTitle, setReceiptPreviewTitle] = useState<string>("");
  const [receiptPreviewError, setReceiptPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery.trim()), debounceMs);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (!lookupOpen) return;
    const t = setTimeout(() => lookupInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [lookupOpen]);

  // ✅ 검색 오픈 시 기본 목록(limit=50)도 조회
  const orderLookupQuery = useQuery({
    queryKey: ["order-lookup", debouncedQuery, lookupOpen, onlyReadyToShip],
    enabled: lookupOpen,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/order-lookup?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error ?? `order-lookup failed (${res.status})`);
      return (json.data ?? []) as OrderLookupRow[];
    },
  });

  const prefillQuery = useQuery({
    queryKey: ["shipment-prefill", selectedOrderLineId],
    enabled: Boolean(selectedOrderLineId),
    queryFn: async () => {
      const id = String(selectedOrderLineId);
      const rows = await readView<ShipmentPrefillRow>(CONTRACTS.views.shipmentPrefill, 1, {
        filter: { column: "order_line_id", op: "eq", value: id },
      });
      return rows?.[0] ?? null;
    },
  });

  useEffect(() => {
    if (prefillQuery.data) setPrefill(prefillQuery.data);
  }, [prefillQuery.data]);

  // ✅ 선택된 주문의 model_no로 마스터 정보 조회
  const masterLookupQuery = useQuery({
    queryKey: ["master-lookup", prefill?.model_no],
    enabled: Boolean(prefill?.model_no),
    queryFn: async () => {
      const model = String(prefill?.model_no ?? "");
      const rows = await readView<MasterLookupRow>(CONTRACTS.views.masterItemLookup, 1, {
        filter: { column: "model_name", op: "eq", value: model },
      });
      return rows?.[0] ?? null;
    },
  });

  const filteredLookupRows = useMemo(() => {
    const rows = orderLookupQuery.data ?? [];
    if (!onlyReadyToShip) return rows;
    return rows.filter((r) => r.status === "READY_TO_SHIP");
  }, [orderLookupQuery.data, onlyReadyToShip]);

  const handleSelectOrder = async (row: OrderLookupRow) => {
    const id = row.order_line_id;
    if (!id) return;

    setSelectedOrderLineId(String(id));
    setSelectedOrderStatus(row.status ? String(row.status) : null);
    setSearchQuery(`${row.model_no ?? ""} ${row.client_name ?? ""}`.trim());
    setLookupOpen(false);

    setWeightG("");
    setDeductionWeightG("");
    setTotalLabor("");
  };

  // --- RPC: 출고 저장 ---
  const normalizedShipmentId = useMemo(() => normalizeId(currentShipmentId), [currentShipmentId]);

  const currentLinesQuery = useQuery({
    queryKey: ["shipment-lines", normalizedShipmentId, confirmModalOpen],
    enabled: Boolean(normalizedShipmentId) && confirmModalOpen,
    queryFn: async () => {
      const shipmentId = normalizedShipmentId;
      if (!shipmentId) return [];
      return readView<ShipmentLineRow>("cms_shipment_line", 50, {
        filter: { column: "shipment_id", op: "eq", value: shipmentId },
        orderBy: { column: "created_at", ascending: false },
      });
    },
  });

  const shipmentUpsertMutation = useRpcMutation<ShipmentUpsertResult>({
    fn: CONTRACTS.functions.shipmentUpsertFromOrder,
    successMessage: "출고 저장 완료",
    onSuccess: async (data) => {
      const shipmentId = normalizeId(data?.shipment_id);
      const shipmentLineId = data?.shipment_line_id ? String(data.shipment_line_id) : null;
      if (!shipmentId) return;

      setCurrentShipmentId(shipmentId);
      setCurrentShipmentLineId(shipmentLineId);
      setShowAllLines(false);

      setConfirmModalOpen(true);

      setCostMode("PROVISIONAL");
      setCostInputs({});

      // 영수증 연결 상태 초기화
      setLinkedReceiptId(null);
      setReceiptFile(null);
      setReceiptUploading(false);
      setReceiptFileInputKey((k) => k + 1);

      setReceiptPreviewSrc(null);
      setReceiptPreviewOpenUrl(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      setReceiptPreviewError(null);

      await currentLinesQuery.refetch();
    },
  });

  const shipmentLineUpdateMutation = useRpcMutation<any>({
    fn: CONTRACTS.functions.shipmentUpdateLine,
  });

  // ✅ 영수증 “연결” upsert
  const receiptUsageUpsertMutation = useRpcMutation<any>({
    fn: FN_RECEIPT_USAGE_UPSERT,
    successMessage: "영수증 연결 완료",
  });

  const handleSaveShipment = async () => {
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", {
        description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요.",
      });
      return;
    }
    if (!selectedOrderLineId) {
      toast.error("주문(출고대기)을 먼저 선택해주세요.");
      return;
    }

    const weightValue = Number(weightG);
    const laborValue = Number(totalLabor);

    if (Number.isNaN(weightValue) || weightValue <= 0) {
      toast.error("중량(g)을 올바르게 입력해주세요.");
      return;
    }
    if (Number.isNaN(laborValue) || laborValue < 0) {
      toast.error("총 공임(원)을 올바르게 입력해주세요.");
      return;
    }

    await shipmentUpsertMutation.mutateAsync({
      p_order_line_id: selectedOrderLineId,
      p_weight_g: weightValue,
      p_total_labor: laborValue,
      p_actor_person_id: actorId,
      p_idempotency_key: idempotencyKey,
    });
  };

  const displayedLines = useMemo(() => {
    const all = currentLinesQuery.data ?? [];
    if (showAllLines) return all;
    if (!currentShipmentLineId) return all;
    return all.filter((l) => String(l.shipment_line_id) === String(currentShipmentLineId));
  }, [currentLinesQuery.data, showAllLines, currentShipmentLineId]);

  const hasOtherLines = useMemo(() => {
    const all = currentLinesQuery.data ?? [];
    if (!currentShipmentLineId) return false;
    return all.some((l) => String(l.shipment_line_id) !== String(currentShipmentLineId));
  }, [currentLinesQuery.data, currentShipmentLineId]);

  // --- 영수증 목록(선택) ---
  const receiptsQuery = useQuery({
    queryKey: ["receipts", confirmModalOpen],
    enabled: confirmModalOpen,
    queryFn: async () => {
      const res = await fetch("/api/receipts?status=UPLOADED,LINKED&limit=50");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `receipts failed (${res.status})`);
      return (json.data ?? []) as ReceiptRow[];
    },
  });

  // 로컬 프리뷰(업로드 전)
  useEffect(() => {
    if (!confirmModalOpen) return;
    if (!receiptFile) return;

    const objUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewSrc(objUrl);
    setReceiptPreviewOpenUrl(objUrl);
    setReceiptPreviewError(null);

    const isPdf =
      receiptFile.type === "application/pdf" || receiptFile.name.toLowerCase().endsWith(".pdf");
    setReceiptPreviewKind(isPdf ? "pdf" : "image");
    setReceiptPreviewTitle(receiptFile.name);

    return () => URL.revokeObjectURL(objUrl);
  }, [confirmModalOpen, receiptFile]);

  // 원격 프리뷰(선택/업로드 후): receipt_id 기반
  useEffect(() => {
    if (!confirmModalOpen) return;
    if (receiptFile) return; // 로컬 우선

    if (!linkedReceiptId) {
      setReceiptPreviewSrc(null);
      setReceiptPreviewOpenUrl(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      setReceiptPreviewError(null);
      return;
    }

    const openUrl = `/api/receipt-preview?receipt_id=${encodeURIComponent(linkedReceiptId)}`;
    setReceiptPreviewOpenUrl(openUrl);
    setReceiptPreviewError(null);

    const r = (receiptsQuery.data ?? []).find((x) => x.receipt_id === linkedReceiptId);
    const title = r?.file_path?.split("/")?.pop() ?? `receipt-${linkedReceiptId.slice(0, 8)}`;
    setReceiptPreviewTitle(title);

    let revoked = false;
    let objUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(openUrl);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `preview failed (${res.status})`);
        }

        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        const isPdf = ct.includes("pdf") || title.toLowerCase().endsWith(".pdf");
        setReceiptPreviewKind(isPdf ? "pdf" : "image");

        const blob = await res.blob();
        objUrl = URL.createObjectURL(blob);

        if (!revoked) {
          setReceiptPreviewSrc(objUrl);
          setReceiptPreviewError(null);
        }
      } catch (e: any) {
        if (!revoked) {
          setReceiptPreviewSrc(null);
          setReceiptPreviewKind(null);
          setReceiptPreviewError(e?.message ?? "이미지/PDF 로드 실패(프리뷰 API 응답을 확인하세요).");
        }
      }
    })();

    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [confirmModalOpen, receiptFile, linkedReceiptId, receiptsQuery.data]);

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      toast.error("업로드할 영수증 파일을 선택해주세요.");
      return;
    }

    setReceiptUploading(true);
    try {
      const fileName = receiptFile.name;
      const isPdf =
        receiptFile.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

      const fd = new FormData();
      fd.append("file0", receiptFile);

      const res = await fetch("/api/receipt-upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; receipt_id?: string; error?: string };

      if (!res.ok || !json?.ok || !json.receipt_id)
        throw new Error(json?.error ?? `upload failed (${res.status})`);

      const rid = String(json.receipt_id);

      setLinkedReceiptId(rid); // effect가 receipt_id로 프리뷰 로드
      setReceiptPreviewTitle(fileName);
      setReceiptPreviewKind(isPdf ? "pdf" : "image");
      setReceiptPreviewError(null);

      setReceiptFile(null);
      setReceiptFileInputKey((k) => k + 1);

      await receiptsQuery.refetch();
      toast.success("영수증 업로드 완료");
    } catch (e: any) {
      toast.error("영수증 업로드 실패", { description: e?.message ?? String(e) });
    } finally {
      setReceiptUploading(false);
    }
  };

  const openReceiptInNewTab = () => {
    const url = receiptPreviewOpenUrl || receiptPreviewSrc;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // --- RPC: 출고 확정 ---
  const confirmMutation = useRpcMutation<any>({
    fn: CONTRACTS.functions.shipmentConfirm,
    successMessage: "출고 확정 완료",
    onSuccess: () => {
      setConfirmModalOpen(false);
      setCurrentShipmentId(null);
      setCurrentShipmentLineId(null);
      setShowAllLines(false);

      setSelectedOrderLineId(null);
      setSelectedOrderStatus(null);
      setPrefill(null);
      setSearchQuery("");
      setDebouncedQuery("");
      setWeightG("");
      setDeductionWeightG("");
      setTotalLabor("");
      setCostMode("PROVISIONAL");
      setCostInputs({});

      setLinkedReceiptId(null);
      setReceiptFile(null);
      setReceiptUploading(false);
      setReceiptFileInputKey((k) => k + 1);

      setReceiptPreviewSrc(null);
      setReceiptPreviewOpenUrl(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      setReceiptPreviewError(null);
    },
  });

  const handleFinalConfirm = async () => {
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", {
        description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요.",
      });
      return;
    }
    const shipmentId = normalizeId(currentShipmentId);
    if (!shipmentId) return;

    // ✅ 확정 직전, 현재 라인의 차감중량을 한번 더 저장 (모달에서 수정했을 수 있음)
    if (currentShipmentLineId) {
      const dText = (deductionWeightG ?? "").trim();
      const masterDeduct = Number(masterLookupQuery.data?.deduction_weight_default_g ?? 0);
      const dValue = dText === "" ? masterDeduct : Number(dText);

      if (!Number.isFinite(dValue) || Number.isNaN(dValue) || dValue < 0) {
        toast.error("차감중량(g)을 올바르게 입력해주세요.");
        return;
      }
      await shipmentLineUpdateMutation.mutateAsync({
        p_shipment_line_id: String(currentShipmentLineId),
        p_deduction_weight_g: dValue,
      });
    }

    // ✅ MANUAL 모드일 때만 현재 화면에 보이는 라인(기본: 지금 출고한 라인)만 전송
    const allowedLineIds = new Set(
      (displayedLines ?? [])
        .map((l) => (l.shipment_line_id ? String(l.shipment_line_id) : ""))
        .filter(Boolean)
    );

    const costLines =
      costMode === "MANUAL"
        ? Object.entries(costInputs)
          .filter(([lineId]) => allowedLineIds.has(String(lineId)))
          .map(([lineId, cost]) => ({
            shipment_line_id: lineId,
            unit_cost_krw: Number(cost),
          }))
          .filter((x) => !Number.isNaN(x.unit_cost_krw) && x.unit_cost_krw >= 0)
        : [];

    // ✅ A안: 출고에서는 영수증 금액/환율/배분을 확정하지 않고, 내부 원가로 출고 확정 + 영수증은 '연결만'
    await confirmMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_actor_person_id: actorId,
      p_note: "confirm from web",
      p_emit_inventory: true,
      p_cost_mode: costMode,
      p_receipt_id: null,
      p_cost_lines: costLines,
      p_force: false,
    });

    // ✅ 영수증 연결만 (receipt_usage upsert)
    const rid = normalizeId(linkedReceiptId);
    if (rid) {
      const corr =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      await receiptUsageUpsertMutation.mutateAsync({
        p_receipt_id: rid,
        p_entity_type: "SHIPMENT_HEADER",
        p_entity_id: shipmentId,
        p_actor_person_id: actorId,
        p_note: "link from shipments confirm",
        p_correlation_id: corr,
      });
    }
  };

  const master = masterLookupQuery.data;

  const resolvedDeductionG = useMemo(() => {
    const t = (deductionWeightG ?? "").trim();
    if (t === "") return Number(master?.deduction_weight_default_g ?? 0);
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }, [deductionWeightG, master?.deduction_weight_default_g]);

  const resolvedNetWeightG = useMemo(() => {
    const w = Number(weightG);
    if (!Number.isFinite(w)) return null;
    return Math.max(w - (resolvedDeductionG ?? 0), 0);
  }, [weightG, resolvedDeductionG]);

  const masterLaborTotal =
    (master?.labor_basic ?? 0) +
    (master?.labor_center ?? 0) +
    (master?.labor_side1 ?? 0) +
    (master?.labor_side2 ?? 0);

  return (
    <div className="space-y-6">
      <ActionBar
        title="출고"
        subtitle="출고대기 주문을 선택 → 출고 저장 → 원가 모드 선택(임시/수기) 후 출고 확정 (영수증은 연결만)"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setLookupOpen(true)}>
              출고입력
            </Button>
            <Link href="/purchase_cost_worklist">
              <Button variant="secondary">원가 작업대</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold text-[var(--foreground)]">출고 입력</div>
              <div className="text-sm text-[var(--muted)]">검색창을 클릭하면 목록이 표시됩니다.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyReadyToShip((v) => !v)}
                className={cn(
                  "text-xs px-2 py-1 rounded-[10px] border border-[var(--panel-border)]",
                  onlyReadyToShip ? "bg-[#eef2f6]" : "bg-white"
                )}
              >
                {onlyReadyToShip ? "출고대기만" : "전체"}
              </button>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--foreground)]">모델/고객/주문 검색</label>

              <Input
                ref={lookupInputRef}
                placeholder="예: 모델명 / 고객명 / 주문번호"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!lookupOpen) setLookupOpen(true);
                }}
                onFocus={() => setLookupOpen(true)}
              />

              {lookupOpen ? (
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--panel-border)]">
                    <div className="text-xs text-[var(--muted)]">
                      {orderLookupQuery.isLoading ? "불러오는 중..." : `결과 ${filteredLookupRows.length}건`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => orderLookupQuery.refetch()}
                        disabled={orderLookupQuery.isFetching}
                      >
                        새로고침
                      </Button>
                      <Button variant="secondary" onClick={() => setLookupOpen(false)}>
                        닫기
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {orderLookupQuery.isError ? (
                      <div className="px-3 py-3 text-sm text-red-600">
                        {(orderLookupQuery.error as any)?.message ?? "조회 실패"}
                      </div>
                    ) : null}

                    {!orderLookupQuery.isLoading && filteredLookupRows.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-[var(--muted)]">표시할 항목이 없습니다.</div>
                    ) : null}

                    {filteredLookupRows.map((row) => {
                      const id = row.order_line_id ?? "";
                      const labelLeft = `${row.client_name ?? "-"} · ${row.model_no ?? "-"}${row.color ? ` · ${row.color}` : ""
                        }`;
                      const labelRight = row.order_date ? row.order_date : "";

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleSelectOrder(row)}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-[#f6f7f9] border-b border-[var(--panel-border)] last:border-b-0",
                            selectedOrderLineId === id ? "bg-[#eef2f6]" : "bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{labelLeft}</div>
                              <div className="text-xs text-[var(--muted)] truncate">
                                주문: {row.order_no ?? "-"} · 상태: {row.status ?? "-"}
                                {row.plating_status ? ` · 도금: ${row.plating_color ?? "-"}` : ""}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-[var(--muted)]">{labelRight}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)]">검색창을 클릭하면 목록이 열립니다.</div>
              )}
            </div>

            <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">선택된 주문</div>
                <Badge tone={selectedOrderStatus === "READY_TO_SHIP" ? "active" : "neutral"}>
                  {selectedOrderStatus ?? "미선택"}
                </Badge>
              </div>

              {prefillQuery.isLoading ? (
                <div className="text-sm text-[var(--muted)]">상세 불러오는 중...</div>
              ) : prefill ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">{prefill.client_name ?? "-"}</span>{" "}
                    <span className="text-[var(--muted)]">/</span>{" "}
                    <span className="font-semibold">{prefill.model_no ?? "-"}</span>
                    {prefill.color ? <span className="text-[var(--muted)]"> · {prefill.color}</span> : null}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    주문번호: {prefill.order_no ?? "-"} · 주문일: {prefill.order_date ?? "-"}
                  </div>
                  {prefill.note ? <div className="text-xs text-[var(--muted)]">메모: {prefill.note}</div> : null}
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">아직 선택되지 않았습니다.</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--foreground)]">중량(g)</label>
                <Input placeholder="예: 12.3" value={weightG} onChange={(e) => setWeightG(e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--foreground)]">차감중량(g)</label>
                <Input
                  placeholder="예: 0.5 (빈칸이면 마스터 공제값)"
                  value={deductionWeightG}
                  onChange={(e) => setDeductionWeightG(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--foreground)]">총 공임(원)</label>
                <Input placeholder="예: 35000" value={totalLabor} onChange={(e) => setTotalLabor(e.target.value)} />
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">마스터 정보</div>
                {master ? <Badge tone="active">등록됨</Badge> : <Badge tone="neutral">미등록</Badge>}
              </div>

              {masterLookupQuery.isLoading ? (
                <div className="text-sm text-[var(--muted)]">마스터 불러오는 중...</div>
              ) : master ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">벤더</span>: {master.vendor_name ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">카테고리</span>: {master.category_code ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">기본 소재</span>: {master.material_code_default ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">기본 중량</span>: {master.weight_default_g ?? "-"}g / 공제 {master.deduction_weight_default_g ?? "-"}g
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">원석 수량</span>: C {master.center_qty_default ?? 0}, S1 {master.sub1_qty_default ?? 0}, S2 {master.sub2_qty_default ?? 0}
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--foreground)]">소재가(참고)</span>: {master.material_price ?? "-"}원
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold text-[var(--foreground)]">공임(기본/센터/사이드1/사이드2)</span>: {master.labor_basic ?? 0} / {master.labor_center ?? 0} / {master.labor_side1 ?? 0} / {master.labor_side2 ?? 0} (합 {masterLaborTotal})
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted)]">마스터가 없으면 기본값은 주문 입력값/수기 입력으로 처리됩니다.</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedOrderLineId(null);
                  setSelectedOrderStatus(null);
                  setPrefill(null);
                  setSearchQuery("");
                  setDebouncedQuery("");
                  setWeightG("");
                  setDeductionWeightG("");
                  setTotalLabor("");
                }}
              >
                초기화
              </Button>
              <Button variant="primary" onClick={handleSaveShipment} disabled={shipmentUpsertMutation.isPending}>
                {shipmentUpsertMutation.isPending ? "저장 중..." : "출고 저장"}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold text-[var(--foreground)]">사용 흐름</div>
              <div className="text-sm text-[var(--muted)]">출고 저장 후, 원가 모드를 선택해 출고를 확정합니다. 영수증은 연결만 합니다.</div>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-[var(--muted)]">
            <div>1) 출고입력 → 2) 주문 선택 → 3) 중량/차감/공임 입력 → 4) 출고 저장</div>
            <div>5) 원가 모드 선택(PROVISIONAL / MANUAL) → 6) (선택) 영수증 연결 → 7) 출고 확정</div>
          </CardBody>
        </Card>
      </div>

      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="출고 확정" className="max-w-6xl">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
            <div className="text-sm font-semibold">확정 대상</div>
            <div className="text-xs text-[var(--muted)]">주문: {prefill?.order_no ?? "-"} / 고객: {prefill?.client_name ?? "-"} / 모델: {prefill?.model_no ?? "-"}</div>
            <div className="text-xs text-[var(--muted)]">
              중량(g): {weightG || "-"} / 차감(g): {deductionWeightG || String(master?.deduction_weight_default_g ?? "-")} / 순중량(g): {resolvedNetWeightG === null ? "-" : resolvedNetWeightG.toFixed(3)} / 총 공임(원): {totalLabor || "-"}
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[var(--muted)]">차감중량(g)</div>
                <Input placeholder="예: 0.5 (빈칸이면 마스터 공제값)" value={deductionWeightG} onChange={(e) => setDeductionWeightG(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[var(--muted)]">순중량(g)</div>
                <div className="text-xs text-[var(--muted)] rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2">
                  {resolvedNetWeightG === null ? "-" : resolvedNetWeightG.toFixed(3)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[var(--muted)]">참고(마스터 공제)</div>
                <div className="text-xs text-[var(--muted)] rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2">
                  {master?.deduction_weight_default_g ?? "-"}g
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">원가 모드</div>
            <div className="flex flex-wrap gap-2">
              <Button variant={costMode === "PROVISIONAL" ? "primary" : "secondary"} onClick={() => setCostMode("PROVISIONAL")}>임시원가</Button>
              <Button variant={costMode === "MANUAL" ? "primary" : "secondary"} onClick={() => setCostMode("MANUAL")}>수기입력</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-3">
                <div className="text-sm font-semibold">영수증 연결 (선택)</div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--muted)]">업로드</div>
                  <Input key={receiptFileInputKey} type="file" accept="application/pdf,image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleUploadReceipt} disabled={receiptUploading || !receiptFile}>
                      {receiptUploading ? "업로드 중..." : "업로드"}
                    </Button>
                    <div className="text-xs text-[var(--muted)]">PDF/JPG/PNG/WebP</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--muted)]">선택</div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <SearchSelect
                        placeholder="업로드된 영수증 검색"
                        options={(receiptsQuery.data ?? []).map((r) => ({
                          label: `${r.received_at.slice(0, 10)} · ${r.file_path.split("/").pop()} (${r.status})`,
                          value: r.receipt_id,
                        }))}
                        value={linkedReceiptId ?? undefined}
                        onChange={(v) => {
                          setReceiptFile(null);
                          setLinkedReceiptId(v);
                          setReceiptPreviewError(null);
                        }}
                      />
                    </div>
                    <Button variant="secondary" onClick={openReceiptInNewTab} disabled={!receiptPreviewOpenUrl && !receiptPreviewSrc}>
                      새 창
                    </Button>
                  </div>
                  {receiptsQuery.isError ? (
                    <div className="text-xs text-red-600">{(receiptsQuery.error as any)?.message ?? "영수증 조회 실패"}</div>
                  ) : null}
                  <div className="text-xs text-[var(--muted)]">※ 출고 단계에서는 영수증 금액/환율/배분을 입력하지 않습니다. 연결만 저장됩니다.</div>
                </div>
              </div>

              {costMode === "MANUAL" ? (
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-[var(--panel-border)] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">라인별 단가 입력</div>
                      <div className="text-xs text-[var(--muted)]">기본은 지금 출고한 라인만 표시됩니다.</div>
                    </div>
                    {hasOtherLines ? (
                      <Button variant="secondary" onClick={() => setShowAllLines((v) => !v)}>
                        {showAllLines ? "현재 라인만" : "전체 라인 보기"}
                      </Button>
                    ) : null}
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#f8f9fc]">
                      <tr>
                        <th className="px-3 py-2">MODEL</th>
                        <th className="px-3 py-2">QTY</th>
                        <th className="px-3 py-2">UNIT COST (KRW)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--panel-border)]">
                      {currentLinesQuery.isLoading ? (
                        <tr><td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">라인 로딩 중...</td></tr>
                      ) : null}

                      {!currentLinesQuery.isLoading && displayedLines.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">표시할 출고 라인이 없습니다.</td></tr>
                      ) : null}

                      {displayedLines
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
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 text-sm text-[var(--muted)]">
                  임시원가(PROVISIONAL)로 출고를 확정합니다. (라인 단가 입력 없음)
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">영수증 미리보기</div>
              <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden h-[70vh]">
                {receiptPreviewError ? (
                  <div className="w-full h-full flex items-center justify-center text-sm text-red-600 px-4 text-center">{receiptPreviewError}</div>
                ) : receiptPreviewSrc ? (
                  receiptPreviewKind === "pdf" ? (
                    <iframe title={receiptPreviewTitle || "receipt"} src={receiptPreviewSrc} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full overflow-auto">
                      <img src={receiptPreviewSrc} alt={receiptPreviewTitle || "receipt"} className="block w-full h-auto" />
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted)]">영수증을 업로드하거나 선택하면 여기에 표시됩니다.</div>
                )}
              </div>
              {receiptPreviewTitle ? <div className="text-xs text-[var(--muted)] truncate">{receiptPreviewTitle}</div> : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>취소</Button>
            <Button variant="primary" onClick={handleFinalConfirm} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "확정 중..." : "출고 확정"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
