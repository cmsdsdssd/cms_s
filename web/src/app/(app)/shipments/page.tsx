"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
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

  // (0264/0265) pricing snapshot columns (numeric는 string으로 올 수도 있어서 union 처리)
  issued_at?: string | null;
  currency_code?: string | null;
  total_amount_original?: number | string | null;
  fx_rate_to_krw?: number | string | null;
  fx_source?: string | null;
  fx_observed_at?: string | null;
  total_amount_krw?: number | string | null;

  memo?: string | null;
};

type ReceiptAllocVsCostRow = {
  receipt_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null; // shipment_id
  shipment_id?: string | null;
  shipment_no?: string | null;
  used_at?: string | null;

  currency_code?: string | null;
  receipt_total_amount_original?: number | string | null;
  receipt_total_amount_krw?: number | string | null;

  allocated_total_original?: number | string | null;
  allocated_total_krw?: number | string | null;
  allocation_method?: string | null;

  shipment_purchase_cost_total_krw?: number | string | null;
  delta_krw?: number | string | null;
};

type ShipmentUpsertResult = {
  shipment_id?: string;
  shipment_line_id?: string;
  status?: string;
};

const debounceMs = 250;

const normalizeId = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return text;
};

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const t = String(value).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const toDateOnly = (iso: unknown): string => {
  const t = String(iso ?? "").trim();
  if (!t) return "";
  // "YYYY-MM-DD" or "YYYY-MM-DDTHH:..." 둘 다 대응
  return t.slice(0, 10);
};

const newUuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

export default function ShipmentsPage() {
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

  // ---- RPC/VIEW 이름 (contracts에 없어도 동작하도록 fallback) ----
  const FN_SHIPMENT_UPSERT = CONTRACTS.functions.shipmentUpsertFromOrder;
  const FN_SHIPMENT_CONFIRM = CONTRACTS.functions.shipmentConfirm;
  const FN_SHIPMENT_LINE_UPDATE = CONTRACTS.functions.shipmentUpdateLine;

  // 0265에서 추가된 함수들(contracts에 아직 안 넣었어도 동작)
  const FN_RECEIPT_PRICING_PATCH =
    ((CONTRACTS.functions as any).receiptPricingPatch as string) ?? "cms_fn_patch_receipt_pricing_v1";
  const FN_RECEIPT_USAGE_ALLOC_UPSERT =
    ((CONTRACTS.functions as any).receiptUsageAllocUpsert as string) ?? "cms_fn_upsert_receipt_usage_alloc_v1";

  const VIEW_RECEIPT_ALLOC_VS_COST = "cms_v_receipt_allocation_vs_shipment_cost_v1";

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
  const [deductionWeightG, setDeductionWeightG] = useState(""); // ✅ 추가(차감중량)
  const [totalLabor, setTotalLabor] = useState("");

  // --- confirm modal ---
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [currentShipmentId, setCurrentShipmentId] = useState<string | null>(null);
  const [currentShipmentLineId, setCurrentShipmentLineId] = useState<string | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);

  const [costMode, setCostMode] = useState<"PROVISIONAL" | "MANUAL" | "RECEIPT">("PROVISIONAL");
  const [costReceiptId, setCostReceiptId] = useState<string | null>(null);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({}); // shipment_line_id -> unit_cost_krw

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

  // ✅ receipt pricing snapshot inputs (RECEIPT 모드에서만 사용)
  const [receiptIssuedAt, setReceiptIssuedAt] = useState<string>("");
  const [receiptCurrencyCode, setReceiptCurrencyCode] = useState<string>("");
  const [receiptTotalOriginal, setReceiptTotalOriginal] = useState<string>("");
  const [receiptFxRateToKrw, setReceiptFxRateToKrw] = useState<string>("");
  const [receiptTotalKrwOverride, setReceiptTotalKrwOverride] = useState<string>("");
  const [receiptNote, setReceiptNote] = useState<string>("");

  // ✅ receipt allocation(출고별 배분: 선택 입력)
  const [allocMethod, setAllocMethod] = useState<"AUTO" | "FULL" | "MANUAL" | "PROPORTIONAL">("AUTO");
  const [allocTotalOriginal, setAllocTotalOriginal] = useState<string>("");
  const [allocTotalKrw, setAllocTotalKrw] = useState<string>("");
  const [allocFactoryWeightG, setAllocFactoryWeightG] = useState<string>(""); // 선택
  const [allocLaborBasicOriginal, setAllocLaborBasicOriginal] = useState<string>(""); // 선택
  const [allocLaborOtherOriginal, setAllocLaborOtherOriginal] = useState<string>(""); // 선택
  const [allocNote, setAllocNote] = useState<string>("");

  const [allocAdvancedOpen, setAllocAdvancedOpen] = useState(false);

  // ---------- debounce ----------
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
    queryKey: ["order-lookup", debouncedQuery, lookupOpen],
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
    setDeductionWeightG(""); // ✅
    setTotalLabor("");
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

  // --- 라인 로드(모달에서) ---
  const normalizedShipmentId = useMemo(() => normalizeId(currentShipmentId), [currentShipmentId]);

  const currentLinesQuery = useQuery({
    queryKey: ["shipment-lines", normalizedShipmentId],
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
    queryKey: ["receipts", confirmModalOpen, costMode],
    enabled: confirmModalOpen && costMode === "RECEIPT",
    queryFn: async () => {
      const res = await fetch("/api/receipts?status=UPLOADED,LINKED&limit=50");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `receipts failed (${res.status})`);
      return (json.data ?? []) as ReceiptRow[];
    },
  });

  const selectedReceipt = useMemo(() => {
    if (!costReceiptId) return null;
    return (receiptsQuery.data ?? []).find((r) => r.receipt_id === costReceiptId) ?? null;
  }, [receiptsQuery.data, costReceiptId]);

  // ✅ receipt 선택 시, 스냅샷 입력값을 DB값으로 프리필(없으면 빈값 유지)
  useEffect(() => {
    if (!confirmModalOpen || costMode !== "RECEIPT") return;

    if (!selectedReceipt) {
      setReceiptIssuedAt("");
      setReceiptCurrencyCode("");
      setReceiptTotalOriginal("");
      setReceiptFxRateToKrw("");
      setReceiptTotalKrwOverride("");
      setReceiptNote("");
      setAllocMethod("AUTO");
      setAllocTotalOriginal("");
      setAllocTotalKrw("");
      setAllocFactoryWeightG("");
      setAllocLaborBasicOriginal("");
      setAllocLaborOtherOriginal("");
      setAllocNote("");
      return;
    }

    setReceiptIssuedAt(toDateOnly(selectedReceipt.issued_at));
    setReceiptCurrencyCode(String(selectedReceipt.currency_code ?? "").trim());
    setReceiptTotalOriginal(selectedReceipt.total_amount_original == null ? "" : String(selectedReceipt.total_amount_original));
    setReceiptFxRateToKrw(selectedReceipt.fx_rate_to_krw == null ? "" : String(selectedReceipt.fx_rate_to_krw));
    setReceiptTotalKrwOverride(selectedReceipt.total_amount_krw == null ? "" : String(selectedReceipt.total_amount_krw));
    setReceiptNote(String(selectedReceipt.memo ?? "").trim());

    // 배분 입력은 "새로" 잡는 게 일반적이라 기본은 비움
    setAllocMethod("AUTO");
    setAllocTotalOriginal("");
    setAllocTotalKrw("");
    setAllocFactoryWeightG("");
    setAllocLaborBasicOriginal("");
    setAllocLaborOtherOriginal("");
    setAllocNote("");
    setAllocAdvancedOpen(false);
  }, [confirmModalOpen, costMode, selectedReceipt]);

  // ✅ receipt allocation vs shipment cost view (선택된 영수증이 이미 어디에 연결됐는지 보여줌)
  const receiptAllocVsCostQuery = useQuery({
    queryKey: ["receipt-alloc-vs-cost", confirmModalOpen, costMode, costReceiptId],
    enabled: confirmModalOpen && costMode === "RECEIPT" && Boolean(costReceiptId),
    queryFn: async () => {
      if (!costReceiptId) return [];
      return readView<ReceiptAllocVsCostRow>(VIEW_RECEIPT_ALLOC_VS_COST, 50, {
        filter: { column: "receipt_id", op: "eq", value: costReceiptId },
        orderBy: { column: "used_at", ascending: false },
      });
    },
  });

  const allocSummary = useMemo(() => {
    const rows = receiptAllocVsCostQuery.data ?? [];
    const sumOrig = rows.reduce((acc, r) => acc + (toNum(r.allocated_total_original) ?? 0), 0);
    const sumKrw = rows.reduce((acc, r) => acc + (toNum(r.allocated_total_krw) ?? 0), 0);
    return { sumOrig, sumKrw, count: rows.length };
  }, [receiptAllocVsCostQuery.data]);

  // -------- receipt preview --------
  // 로컬 프리뷰(업로드 전)
  useEffect(() => {
    if (!confirmModalOpen || costMode !== "RECEIPT") return;
    if (!receiptFile) return;

    const objUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewSrc(objUrl);
    setReceiptPreviewOpenUrl(objUrl);
    setReceiptPreviewError(null);

    const isPdf = receiptFile.type === "application/pdf" || receiptFile.name.toLowerCase().endsWith(".pdf");
    setReceiptPreviewKind(isPdf ? "pdf" : "image");
    setReceiptPreviewTitle(receiptFile.name);

    return () => URL.revokeObjectURL(objUrl);
  }, [confirmModalOpen, costMode, receiptFile]);

  // 원격 프리뷰(선택/업로드 후): receipt_id 기반 (서버 응답을 blob으로 받아 objectURL로 표시)
  useEffect(() => {
    if (!confirmModalOpen || costMode !== "RECEIPT") return;
    if (receiptFile) return; // 로컬 우선

    if (!costReceiptId) {
      setReceiptPreviewSrc(null);
      setReceiptPreviewOpenUrl(null);
      setReceiptPreviewKind(null);
      setReceiptPreviewTitle("");
      setReceiptPreviewError(null);
      return;
    }

    const openUrl = `/api/receipt-preview?receipt_id=${encodeURIComponent(costReceiptId)}`;
    setReceiptPreviewOpenUrl(openUrl);
    setReceiptPreviewError(null);

    const r = (receiptsQuery.data ?? []).find((x) => x.receipt_id === costReceiptId);
    const title = r?.file_path?.split("/")?.pop() ?? `receipt-${costReceiptId.slice(0, 8)}`;
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
  }, [confirmModalOpen, costMode, receiptFile, costReceiptId, receiptsQuery.data]);

  const openReceiptInNewTab = () => {
    const url = receiptPreviewOpenUrl || receiptPreviewSrc;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ---------- Mutations ----------
  const shipmentUpsertMutation = useRpcMutation<ShipmentUpsertResult>({
    fn: FN_SHIPMENT_UPSERT,
    successMessage: "출고 저장 완료",
  });

  const shipmentLineUpdateMutation = useRpcMutation<any>({
    fn: FN_SHIPMENT_LINE_UPDATE,
    successMessage: "출고 라인 업데이트 완료",
  });

  const receiptPricingPatchMutation = useRpcMutation<any>({
    fn: FN_RECEIPT_PRICING_PATCH,
    successMessage: "영수증 가격 스냅샷 저장 완료",
  });

  const receiptUsageAllocUpsertMutation = useRpcMutation<any>({
    fn: FN_RECEIPT_USAGE_ALLOC_UPSERT,
    successMessage: "영수증 배분 저장 완료",
  });

  const confirmMutation = useRpcMutation<any>({
    fn: FN_SHIPMENT_CONFIRM,
    successMessage: "출고 확정 완료",
  });

  // ---------- handlers ----------
  const resetAllAfterConfirm = () => {
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
    setCostReceiptId(null);
    setCostInputs({});

    setReceiptFile(null);
    setReceiptUploading(false);
    setReceiptFileInputKey((k) => k + 1);

    setReceiptPreviewSrc(null);
    setReceiptPreviewOpenUrl(null);
    setReceiptPreviewKind(null);
    setReceiptPreviewTitle("");
    setReceiptPreviewError(null);

    setReceiptIssuedAt("");
    setReceiptCurrencyCode("");
    setReceiptTotalOriginal("");
    setReceiptFxRateToKrw("");
    setReceiptTotalKrwOverride("");
    setReceiptNote("");

    setAllocMethod("AUTO");
    setAllocTotalOriginal("");
    setAllocTotalKrw("");
    setAllocFactoryWeightG("");
    setAllocLaborBasicOriginal("");
    setAllocLaborOtherOriginal("");
    setAllocNote("");
    setAllocAdvancedOpen(false);
  };

  const handleSaveShipment = async () => {
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", { description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요." });
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
    if (Number.isNaN(laborValue) || laborValue <= 0) {
      toast.error("총 공임(원)을 올바르게 입력해주세요.");
      return;
    }

    const dText = (deductionWeightG ?? "").trim();
    const masterDeduct = Number(master?.deduction_weight_default_g ?? 0);
    const dValue = dText === "" ? masterDeduct : Number(dText);

    if (!Number.isFinite(dValue) || Number.isNaN(dValue) || dValue < 0) {
      toast.error("차감중량(g)을 올바르게 입력해주세요.");
      return;
    }

    const idemKey = newUuid();

    const data = await shipmentUpsertMutation.mutateAsync({
      p_order_line_id: selectedOrderLineId,
      p_weight_g: weightValue,
      p_total_labor: laborValue,
      p_actor_person_id: actorId,
      p_idempotency_key: idemKey,
    });

    const shipmentId = normalizeId(data?.shipment_id);
    const shipmentLineId = data?.shipment_line_id ? String(data.shipment_line_id) : null;

    if (!shipmentId) return;

    // ✅ 차감중량은 저장 직후 라인에 반영(확정 전에도 값이 DB에 남게)
    if (shipmentLineId) {
      await shipmentLineUpdateMutation.mutateAsync({
        p_shipment_line_id: shipmentLineId,
        p_deduction_weight_g: dValue,
      });
    }

    setCurrentShipmentId(shipmentId);
    setCurrentShipmentLineId(shipmentLineId);
    setShowAllLines(false);

    setConfirmModalOpen(true);

    // confirm 상태 초기화
    setCostMode("PROVISIONAL");
    setCostReceiptId(null);
    setCostInputs({});

    setReceiptFile(null);
    setReceiptUploading(false);
    setReceiptFileInputKey((k) => k + 1);

    setReceiptPreviewSrc(null);
    setReceiptPreviewOpenUrl(null);
    setReceiptPreviewKind(null);
    setReceiptPreviewTitle("");
    setReceiptPreviewError(null);

    await currentLinesQuery.refetch();
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      toast.error("업로드할 영수증 파일을 선택해주세요.");
      return;
    }

    setReceiptUploading(true);
    try {
      const fileName = receiptFile.name;
      const isPdf = receiptFile.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

      const fd = new FormData();
      fd.append("file0", receiptFile);

      const res = await fetch("/api/receipt-upload", { method: "POST", body: fd });
      const json = (await res.json()) as { ok?: boolean; receipt_id?: string; error?: string };

      if (!res.ok || !json?.ok || !json.receipt_id) throw new Error(json?.error ?? `upload failed (${res.status})`);

      const rid = String(json.receipt_id);

      setCostReceiptId(rid); // effect가 receipt_id로 프리뷰 로드
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

  const derivedReceiptTotalKrw = useMemo(() => {
    // override가 있으면 override 우선
    const overrideKrw = toNum(receiptTotalKrwOverride);
    if (overrideKrw != null) return overrideKrw;

    const cur = (receiptCurrencyCode ?? "").trim().toUpperCase();
    const totalOrig = toNum(receiptTotalOriginal);
    if (totalOrig == null) return null;

    if (!cur || cur === "KRW") return totalOrig;

    const fx = toNum(receiptFxRateToKrw);
    if (fx == null) return null;
    return totalOrig * fx;
  }, [receiptCurrencyCode, receiptTotalOriginal, receiptFxRateToKrw, receiptTotalKrwOverride]);

  const handleFinalConfirm = async () => {
    if (!actorId) {
      toast.error("ACTOR_ID 설정이 필요합니다.", { description: "NEXT_PUBLIC_CMS_ACTOR_ID를 확인하세요." });
      return;
    }

    const shipmentId = normalizeId(currentShipmentId);
    if (!shipmentId) return;

    // ✅ 확정 직전, 현재 라인의 차감중량을 한번 더 저장 (모달에서 수정했을 수 있음)
    if (currentShipmentLineId) {
      const dText = (deductionWeightG ?? "").trim();
      const masterDeduct = Number(master?.deduction_weight_default_g ?? 0);
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

    // ✅ 현재 화면에 보이는 라인(기본: 지금 출고한 라인)만 전송
    const allowedLineIds = new Set(
      (displayedLines ?? [])
        .map((l) => (l.shipment_line_id ? String(l.shipment_line_id) : ""))
        .filter(Boolean)
    );

    const costLines = Object.entries(costInputs)
      .filter(([lineId]) => allowedLineIds.has(String(lineId)))
      .map(([lineId, cost]) => ({ shipment_line_id: lineId, unit_cost_krw: Number(cost) }))
      .filter((x) => !Number.isNaN(x.unit_cost_krw) && x.unit_cost_krw >= 0);

    // ---- RECEIPT 모드: 스냅샷 저장 + 확정 + 배분 저장 ----
    if (costMode === "RECEIPT") {
      if (!costReceiptId) {
        toast.error("RECEIPT 모드에서는 영수증을 선택해야 합니다.");
        return;
      }

      const currency = (receiptCurrencyCode ?? "").trim().toUpperCase();
      const totalOrig = toNum(receiptTotalOriginal);

      // ✅ 분석 1순위 기준: 최소한 통화 + 원본총액은 받는 게 맞음
      if (!currency) {
        toast.error("영수증 통화(currency_code)를 입력해주세요.");
        return;
      }
      if (totalOrig == null || totalOrig <= 0) {
        toast.error("영수증 총액(원본통화)을 입력해주세요.");
        return;
      }

      const issuedAt = receiptIssuedAt ? receiptIssuedAt : null;
      const fx = toNum(receiptFxRateToKrw);
      const overrideKrw = toNum(receiptTotalKrwOverride);

      // 스냅샷 저장(패치)
      await receiptPricingPatchMutation.mutateAsync({
        p_receipt_id: costReceiptId,
        p_actor_person_id: actorId,
        p_issued_at: issuedAt,
        p_currency_code: currency,
        p_total_amount_original: totalOrig,
        p_fx_rate_to_krw: fx,
        p_fx_source: fx != null ? "MANUAL" : null,
        p_fx_observed_at: fx != null ? new Date().toISOString() : null,
        p_total_amount_krw_override: overrideKrw,
        p_note: receiptNote || null,
        p_correlation_id: newUuid(),
      });

      // 출고 확정(영수증 연결 + 원가반영)
      await confirmMutation.mutateAsync({
        p_shipment_id: shipmentId,
        p_actor_person_id: actorId,
        p_note: "confirm from web",
        p_emit_inventory: true,
        p_cost_mode: costMode,
        p_receipt_id: costReceiptId,
        p_cost_lines: costLines,
        p_force: false,
      });

      // 출고별 배분 저장(선택 입력)
      const allocOrig = toNum(allocTotalOriginal);
      const allocKrw = toNum(allocTotalKrw);
      const fWeight = toNum(allocFactoryWeightG);
      const laborBasic = toNum(allocLaborBasicOriginal);
      const laborOther = toNum(allocLaborOtherOriginal);

      const finalMethod =
        allocMethod === "AUTO"
          ? allocOrig != null || allocKrw != null || fWeight != null || laborBasic != null || laborOther != null
            ? "MANUAL"
            : null
          : allocMethod;

      // 입력이 하나라도 있으면 upsert (아무것도 안 적었으면 저장 안 함 = 귀찮음 최소화)
      const hasAnyAllocInput =
        allocOrig != null || allocKrw != null || fWeight != null || laborBasic != null || laborOther != null || (allocNote ?? "").trim() !== "";

      if (hasAnyAllocInput) {
        await receiptUsageAllocUpsertMutation.mutateAsync({
          p_receipt_id: costReceiptId,
          p_entity_type: "SHIPMENT_HEADER",
          p_entity_id: shipmentId,
          p_allocated_total_original: allocOrig,
          p_allocated_total_krw: allocKrw,
          p_allocation_method: finalMethod,
          p_factory_weight_g: fWeight,
          p_factory_labor_basic_original: laborBasic,
          p_factory_labor_other_original: laborOther,
          p_note: (allocNote ?? "").trim() || null,
          p_actor_person_id: actorId,
          p_correlation_id: newUuid(),
        });
      } else {
        // 배분 입력 없이도 OK (나중에 분석/정산에서 자동 배분 로직이나 수기 보완 가능)
      }

      resetAllAfterConfirm();
      return;
    }

    // ---- MANUAL / PROVISIONAL ----
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

    resetAllAfterConfirm();
  };

  return (
    <div className="space-y-6">
      <ActionBar
        title="출고"
        subtitle="출고대기 주문을 선택 → 출고 저장 → 원가 모드 선택 후 출고 확정"
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
                      <Button variant="secondary" onClick={() => orderLookupQuery.refetch()} disabled={orderLookupQuery.isFetching}>
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
                      const labelLeft = `${row.client_name ?? "-"} · ${row.model_no ?? "-"}${row.color ? ` · ${row.color}` : ""}`;
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
                <Badge tone={selectedOrderStatus === "READY_TO_SHIP" ? "active" : "neutral"}>{selectedOrderStatus ?? "미선택"}</Badge>
              </div>

              {prefillQuery.isLoading ? (
                <div className="text-sm text-[var(--muted)]">상세 불러오는 중...</div>
              ) : prefill ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">{prefill.client_name ?? "-"}</span> <span className="text-[var(--muted)]">/</span>{" "}
                    <span className="font-semibold">{prefill.model_no ?? "-"}</span>
                    {prefill.color ? <span className="text-[var(--muted)]"> · {prefill.color}</span> : null}
                  </div>
                  <div className="text-xs text-[var(--muted)]">주문번호: {prefill.order_no ?? "-"} · 주문일: {prefill.order_date ?? "-"}</div>
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
                <div className="text-[11px] text-[var(--muted)]">측정/총중량</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--foreground)]">차감중량(g)</label>
                <Input placeholder="예: 0.5 (빈칸이면 마스터 공제값)" value={deductionWeightG} onChange={(e) => setDeductionWeightG(e.target.value)} />
                <div className="text-[11px] text-[var(--muted)]">총중량에서 차감 → 순중량(금속중량) 계산</div>
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
                <div className="text-sm text-[var(--muted)]">
                  해당 모델({prefill?.model_no ?? "-"})에 연결된 마스터가 없습니다. (등록하면 자동으로 채워집니다)
                </div>
              )}
            </div>

            <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
              <div className="text-sm font-semibold">순중량(참고)</div>
              <div className="text-xs text-[var(--muted)]">
                순중량(g) = max(총중량 - 차감중량, 0) →{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {resolvedNetWeightG === null ? "-" : resolvedNetWeightG.toFixed(3)}
                </span>
              </div>
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
              <div className="text-sm text-[var(--muted)]">출고 저장 후, 원가 모드를 선택해 출고를 확정합니다.</div>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 text-sm text-[var(--muted)]">
            <div>1) 출고입력 → 2) 주문 선택 → 3) 중량/차감중량/공임 입력 → 4) 출고 저장</div>
            <div>5) 원가 모드 선택(PROVISIONAL / MANUAL / RECEIPT) → 6) 출고 확정</div>
            <div className="text-xs text-[var(--muted)]">
              * RECEIPT 모드는 “영수증 총액(통화/원본총액/환율 등 스냅샷)”을 남기고, 필요 시 “출고별 배분”도 함께 저장합니다.
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="출고 확정" className="max-w-6xl">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-1">
            <div className="text-sm font-semibold">확정 대상</div>
            <div className="text-xs text-[var(--muted)]">
              주문: {prefill?.order_no ?? "-"} / 고객: {prefill?.client_name ?? "-"} / 모델: {prefill?.model_no ?? "-"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              총중량(g): {weightG || "-"} / 차감(g): {deductionWeightG || String(master?.deduction_weight_default_g ?? "-")} / 순중량(g):{" "}
              {resolvedNetWeightG === null ? "-" : resolvedNetWeightG.toFixed(3)} / 총 공임(원): {totalLabor || "-"}
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
              <Button variant={costMode === "PROVISIONAL" ? "primary" : "secondary"} onClick={() => setCostMode("PROVISIONAL")}>
                임시원가
              </Button>
              <Button variant={costMode === "MANUAL" ? "primary" : "secondary"} onClick={() => setCostMode("MANUAL")}>
                수기입력
              </Button>
              <Button variant={costMode === "RECEIPT" ? "primary" : "secondary"} onClick={() => setCostMode("RECEIPT")}>
                영수증
              </Button>
            </div>
          </div>

          {costMode === "MANUAL" || costMode === "RECEIPT" ? (
            <div className={cn("grid gap-4", costMode === "RECEIPT" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-3">
                {costMode === "RECEIPT" ? (
                  <>
                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-3">
                      <div className="text-sm font-semibold">영수증 업로드/선택</div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[var(--muted)]">업로드</div>
                        <Input
                          key={receiptFileInputKey}
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        />
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
                              value={costReceiptId ?? undefined}
                              onChange={(v) => {
                                setReceiptFile(null);
                                setCostReceiptId(v);
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
                      </div>
                    </div>

                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">영수증 가격 스냅샷(분석용)</div>
                        {selectedReceipt ? <Badge tone="active">{selectedReceipt.status}</Badge> : <Badge tone="neutral">미선택</Badge>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-[var(--muted)]">발행일(선택)</div>
                          <Input type="date" value={receiptIssuedAt} onChange={(e) => setReceiptIssuedAt(e.target.value)} />
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-[var(--muted)]">통화 코드(필수)</div>
                          <div className="flex gap-2">
                            <Input placeholder="예: CNY / KRW" value={receiptCurrencyCode} onChange={(e) => setReceiptCurrencyCode(e.target.value)} />
                            <Button variant="secondary" onClick={() => setReceiptCurrencyCode("CNY")}>
                              CNY
                            </Button>
                            <Button variant="secondary" onClick={() => setReceiptCurrencyCode("KRW")}>
                              KRW
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-[var(--muted)]">총액(원본통화, 필수)</div>
                          <Input placeholder="예: 1580.5" value={receiptTotalOriginal} onChange={(e) => setReceiptTotalOriginal(e.target.value)} />
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-[var(--muted)]">환율(선택, 1통화→KRW)</div>
                          <Input placeholder="예: 190.25" value={receiptFxRateToKrw} onChange={(e) => setReceiptFxRateToKrw(e.target.value)} />
                          <div className="text-[11px] text-[var(--muted)]">
                            * 환율/원화총액을 안 적어도 저장은 되지만, 원화 분석은 공백이 될 수 있음
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-xs font-semibold text-[var(--muted)]">원화 총액 Override(선택)</div>
                          <Input
                            placeholder="예: 320000 (특정 기준으로 원화총액을 고정하고 싶을 때)"
                            value={receiptTotalKrwOverride}
                            onChange={(e) => setReceiptTotalKrwOverride(e.target.value)}
                          />
                          <div className="text-[11px] text-[var(--muted)]">
                            계산된 원화총액(참고):{" "}
                            <span className="font-semibold text-[var(--foreground)]">
                              {derivedReceiptTotalKrw == null ? "-" : Math.round(derivedReceiptTotalKrw).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-xs font-semibold text-[var(--muted)]">메모(선택)</div>
                          <Textarea
                            placeholder="예: 공장 발행 시점 가격 기준, 배송 대기 중 시세변동 고려 등"
                            value={receiptNote}
                            onChange={(e) => setReceiptNote(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="rounded-[10px] border border-[var(--panel-border)] bg-white p-2">
                        <div className="text-xs font-semibold">이미 연결된 출고(이 영수증 기준)</div>
                        <div className="text-[11px] text-[var(--muted)]">
                          배정합(원본): {allocSummary.sumOrig.toLocaleString()} / 배정합(원화): {Math.round(allocSummary.sumKrw).toLocaleString()} / 건수:{" "}
                          {allocSummary.count}
                        </div>

                        {receiptAllocVsCostQuery.isError ? (
                          <div className="text-xs text-red-600 mt-1">{(receiptAllocVsCostQuery.error as any)?.message ?? "연결 조회 실패"}</div>
                        ) : null}

                        <div className="mt-2 max-h-40 overflow-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-[#f8f9fc]">
                              <tr>
                                <th className="px-2 py-1 text-left">출고</th>
                                <th className="px-2 py-1 text-right">배정(원본)</th>
                                <th className="px-2 py-1 text-right">배정(원화)</th>
                                <th className="px-2 py-1 text-right">원가합(원화)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--panel-border)]">
                              {(receiptAllocVsCostQuery.data ?? []).slice(0, 20).map((r, idx) => (
                                <tr key={`${r.entity_id ?? "x"}-${idx}`}>
                                  <td className="px-2 py-1">{r.shipment_no ?? (r.entity_id ? String(r.entity_id).slice(0, 8) : "-")}</td>
                                  <td className="px-2 py-1 text-right">
                                    {toNum(r.allocated_total_original) == null ? "-" : (toNum(r.allocated_total_original) ?? 0).toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {toNum(r.allocated_total_krw) == null ? "-" : Math.round(toNum(r.allocated_total_krw) ?? 0).toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1 text-right">
                                    {toNum(r.shipment_purchase_cost_total_krw) == null
                                      ? "-"
                                      : Math.round(toNum(r.shipment_purchase_cost_total_krw) ?? 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                              {(receiptAllocVsCostQuery.data ?? []).length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-2 py-2 text-center text-[var(--muted)]">
                                    아직 연결된 출고가 없습니다.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-[var(--muted)]">출고별 배분(선택)</div>
                        <Button variant="secondary" onClick={() => setAllocAdvancedOpen((v) => !v)}>
                          {allocAdvancedOpen ? "접기" : "배분 입력 열기"}
                        </Button>
                      </div>

                      {allocAdvancedOpen ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs font-semibold text-[var(--muted)]">배분 방식</div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant={allocMethod === "AUTO" ? "primary" : "secondary"} onClick={() => setAllocMethod("AUTO")}>
                                AUTO(비움)
                              </Button>
                              <Button variant={allocMethod === "FULL" ? "primary" : "secondary"} onClick={() => setAllocMethod("FULL")}>
                                전체
                              </Button>
                              <Button variant={allocMethod === "MANUAL" ? "primary" : "secondary"} onClick={() => setAllocMethod("MANUAL")}>
                                수기
                              </Button>
                              <Button
                                variant={allocMethod === "PROPORTIONAL" ? "primary" : "secondary"}
                                onClick={() => setAllocMethod("PROPORTIONAL")}
                              >
                                비례
                              </Button>
                            </div>
                            <div className="text-[11px] text-[var(--muted)]">
                              * 배분값을 입력하면 receipt_usage에 저장(영수증 1개 → 여러 출고 연결 시 핵심)
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[var(--muted)]">이 출고에 배분할 금액(원본통화)</div>
                            <Input placeholder="예: 520.5" value={allocTotalOriginal} onChange={(e) => setAllocTotalOriginal(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[var(--muted)]">이 출고에 배분할 금액(원화)</div>
                            <Input placeholder="예: 120000" value={allocTotalKrw} onChange={(e) => setAllocTotalKrw(e.target.value)} />
                            <div className="text-[11px] text-[var(--muted)]">
                              * 원본/원화 둘 중 하나만 적어도 됨(둘 다 적으면 둘 다 저장)
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[var(--muted)]">공장 기준 중량(선택)</div>
                            <Input placeholder="예: 12.3" value={allocFactoryWeightG} onChange={(e) => setAllocFactoryWeightG(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[var(--muted)]">공장 기본공임(원본통화, 선택)</div>
                            <Input placeholder="예: 30" value={allocLaborBasicOriginal} onChange={(e) => setAllocLaborBasicOriginal(e.target.value)} />
                          </div>

                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-[var(--muted)]">공장 기타공임(원본통화, 선택)</div>
                            <Input placeholder="예: 10" value={allocLaborOtherOriginal} onChange={(e) => setAllocLaborOtherOriginal(e.target.value)} />
                          </div>

                          <div className="space-y-1 md:col-span-2">
                            <div className="text-xs font-semibold text-[var(--muted)]">배분 메모(선택)</div>
                            <Textarea
                              placeholder="예: 이 출고는 총 4개 중 1개분, 나머지는 다음 출고에 배정"
                              value={allocNote}
                              onChange={(e) => setAllocNote(e.target.value)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

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
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                            라인 로딩 중...
                          </td>
                        </tr>
                      ) : null}

                      {!currentLinesQuery.isLoading && displayedLines.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-3 text-center text-[var(--muted)]">
                            표시할 출고 라인이 없습니다.
                          </td>
                        </tr>
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

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
                    닫기
                  </Button>
                  <Button variant="primary" onClick={handleFinalConfirm} disabled={confirmMutation.isPending}>
                    {confirmMutation.isPending ? "확정 중..." : "출고 확정"}
                  </Button>
                </div>
              </div>

              {costMode === "RECEIPT" ? (
                <div className="space-y-3">
                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-white p-3 space-y-2">
                    <div className="text-sm font-semibold">영수증 프리뷰</div>

                    {receiptPreviewError ? <div className="text-xs text-red-600">{receiptPreviewError}</div> : null}

                    {!receiptPreviewSrc ? (
                      <div className="text-xs text-[var(--muted)]">영수증을 업로드하거나 선택하면 미리보기가 표시됩니다.</div>
                    ) : receiptPreviewKind === "pdf" ? (
                      <iframe
                        title={receiptPreviewTitle || "receipt-preview"}
                        src={receiptPreviewSrc}
                        className="w-full h-[680px] rounded-[12px] border border-[var(--panel-border)] bg-white"
                      />
                    ) : (
                      // image
                      <img
                        src={receiptPreviewSrc}
                        alt={receiptPreviewTitle || "receipt-preview"}
                        className="w-full max-h-[680px] object-contain rounded-[12px] border border-[var(--panel-border)] bg-white"
                      />
                    )}

                    {receiptPreviewTitle ? <div className="text-xs text-[var(--muted)]">파일: {receiptPreviewTitle}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
                닫기
              </Button>
              <Button variant="primary" onClick={handleFinalConfirm} disabled={confirmMutation.isPending}>
                {confirmMutation.isPending ? "확정 중..." : "출고 확정"}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
