"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { NumberText } from "@/components/ui/number-text";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchSelect } from "@/components/ui/search-select";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type ReceiptInboxRow = {
  receipt_id: string;
  received_at?: string | null;
  status?: string | null;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  bill_no?: string | null;
  issued_at?: string | null;
  memo?: string | null;
  file_bucket?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  pricing_currency_code?: string | null;
  pricing_total_amount?: number | null;
  pricing_total_amount_krw?: number | null;
  weight_g?: number | null;
  labor_basic?: number | null;
  labor_other?: number | null;
};

type HeaderSnapshot = {
  vendorPartyId: string;
  billNo: string;
  billDate: string;
  memo: string;
};

type ReceiptHeaderRow = {
  receipt_id?: string | null;
  vendor_party_id?: string | null;
  bill_no?: string | null;
  issued_at?: string | null;
  memo?: string | null;
};

type ReceiptLineItemInput = {
  line_uuid: string;
  receipt_line_uuid?: string | null;
  customer_factory_code: string;
  model_name: string;
  material_code: string;
  qty: string;
  weight_raw_g: string;
  weight_deduct_g: string;
  labor_basic_cost_krw: string;
  labor_other_cost_krw: string;
  stone_center_qty: string;
  stone_sub1_qty: string;
  stone_sub2_qty: string;
  stone_center_unit_cost_krw: string;
  stone_sub1_unit_cost_krw: string;
  stone_sub2_unit_cost_krw: string;
  total_amount_krw: string;
  size: string;
  color: string;
  vendor_seq_no: string;
  remark: string;
};

type ReceiptLineItemRow = {
  receipt_id?: string | null;
  line_uuid?: string | null;
  receipt_line_uuid?: string | null;
  customer_factory_code?: string | null;
  model_name?: string | null;
  material_code?: string | null;
  qty?: number | null;
  weight_g?: number | null;
  weight_raw_g?: number | null;
  weight_deduct_g?: number | null;
  labor_basic_cost_krw?: number | null;
  labor_other_cost_krw?: number | null;
  stone_center_qty?: number | null;
  stone_sub1_qty?: number | null;
  stone_sub2_qty?: number | null;
  stone_center_unit_cost_krw?: number | null;
  stone_sub1_unit_cost_krw?: number | null;
  stone_sub2_unit_cost_krw?: number | null;
  total_amount_krw?: number | null;
  size?: string | null;
  color?: string | null;
  vendor_seq_no?: number | null;
  remark?: string | null;
};

type UnlinkedLineRow = {
  receipt_id?: string | null;
  receipt_line_uuid?: string | null;
  vendor_party_id?: string | null;
  vendor_name?: string | null;
  issued_at?: string | null;
  customer_factory_code?: string | null;
  model_name?: string | null;
  material_code?: string | null;
  factory_weight_g?: number | null;
  weight_raw_g?: number | null;
  weight_deduct_g?: number | null;
  stone_center_qty?: number | null;
  stone_sub1_qty?: number | null;
  stone_sub2_qty?: number | null;
  vendor_seq_no?: number | null;
  remark?: string | null;
  size?: string | null;
  color?: string | null;
};

type CustomerCodeSuggestItem = {
  party_id: string;
  name: string;
  mask_code: string;
};

type ModelNameSuggestItem = {
  master_item_id: string;
  model_name: string;
};

type MatchCandidate = {
  order_no?: string | null;
  order_line_id?: string | null;
  customer_party_id?: string | null;
  customer_mask_code?: string | null;
  customer_name?: string | null;
  status?: string | null;
  model_name?: string | null;
  size?: string | null;
  color?: string | null;
  material_code?: string | null;
  is_plated?: boolean | null;
  plating_color_code?: string | null;
  effective_weight_g?: number | null;
  weight_min_g?: number | null;
  weight_max_g?: number | null;
  factory_po_id?: string | null;
  memo?: string | null;
  stone_center_exists?: boolean | null;
  stone_sub1_exists?: boolean | null;
  stone_sub2_exists?: boolean | null;
  match_score?: number | null;
  score_detail_json?: Record<string, unknown> | null;
};

type ConfirmResult = {
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  created_shipment_draft?: boolean | null;
  missing_unit_cost_warn?: boolean | null;
  weight_deviation_warn?: boolean | null;
};

type ConfirmedMatchRow = {
  receipt_id: string;
  receipt_line_uuid: string;
  vendor_seq_no?: string | null;
  customer_factory_code?: string | null;
  receipt_model_name?: string | null;
  receipt_material_code?: string | null;
  receipt_size?: string | null;
  receipt_color?: string | null;
  receipt_weight_g?: number | null;
  receipt_qty?: number | null;
  order_line_id?: string | null;
  customer_party_id?: string | null;
  customer_name?: string | null;
  order_no?: string | null;
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  shipment_status?: string | null;
  confirmed_at?: string | null;
  selected_weight_g?: number | null;
  selected_material_code?: string | null;
  note?: string | null;
};

type MatchClearReasonCode =
  | "INPUT_ERROR"
  | "WRONG_MATCH"
  | "RECEIPT_CORRECTION"
  | "ORDER_CANCEL"
  | "TEST"
  | "OTHER";

type PartyOption = { label: string; value: string };

const MATERIAL_OPTIONS = ["14", "18", "24", "925", "999", "00"] as const;
const MATCH_CLEAR_REASONS: Array<{ value: MatchClearReasonCode; label: string }> = [
  { value: "INPUT_ERROR", label: "입력오류(공임/중량/수량)" },
  { value: "WRONG_MATCH", label: "오매칭(다른 주문에 연결)" },
  { value: "RECEIPT_CORRECTION", label: "공장 영수증 정정" },
  { value: "ORDER_CANCEL", label: "주문 취소/변경" },
  { value: "TEST", label: "테스트/샘플" },
  { value: "OTHER", label: "기타" },
];
const STONE_FIELDS = [
  "stone_center_qty",
  "stone_sub1_qty",
  "stone_sub2_qty",
  "stone_center_unit_cost_krw",
  "stone_sub1_unit_cost_krw",
  "stone_sub2_unit_cost_krw",
] as const;

type StoneField = (typeof STONE_FIELDS)[number];

type MetalUnit = "g" | "don";

type FactoryMetalInput = {
  value: string;
  unit: MetalUnit;
};

type FactoryRowInput = {
  rowCode: "RECENT_PAYMENT" | "PRE_BALANCE" | "SALE" | "POST_BALANCE";
  label: string;
  refDate: string;
  note: string;
  gold: FactoryMetalInput;
  silver: FactoryMetalInput;
  laborKrw: string;
};

type FactoryStatementResult = {
  reconcile?: {
    issue_counts?: {
      error?: number | null;
      warn?: number | null;
    } | null;
  } | null;
};

function formatNumber(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return new Intl.NumberFormat("ko-KR").format(Number(n));
}

function formatYmd(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR");
}

function normalizeVendorToken(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "FAC";
  const cleaned = trimmed.replace(/\s+/g, "_").replace(/[^0-9A-Za-z가-힣_-]/g, "");
  return cleaned || "FAC";
}

function normalizeHeaderValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeHeaderSnapshot(snapshot: HeaderSnapshot) {
  return {
    vendorPartyId: normalizeHeaderValue(snapshot.vendorPartyId),
    billNo: normalizeHeaderValue(snapshot.billNo),
    billDate: normalizeHeaderValue(snapshot.billDate),
    memo: normalizeHeaderValue(snapshot.memo),
  };
}

function buildHeaderSnapshotFromReceipt(receipt: ReceiptInboxRow): HeaderSnapshot {
  return {
    vendorPartyId: receipt.vendor_party_id ?? "",
    billNo: receipt.bill_no ?? "",
    billDate: receipt.issued_at ? receipt.issued_at.slice(0, 10) : "",
    memo: receipt.memo ?? "",
  };
}

function buildHeaderSnapshotFromRow(row: ReceiptHeaderRow): HeaderSnapshot {
  return {
    vendorPartyId: row.vendor_party_id ?? "",
    billNo: row.bill_no ?? "",
    billDate: row.issued_at ? row.issued_at.slice(0, 10) : "",
    memo: row.memo ?? "",
  };
}

function buildBillNo(billDate: string, vendorLabel: string, seq: number) {
  const dateToken = billDate.replaceAll("-", "");
  const vendorToken = normalizeVendorToken(vendorLabel);
  return `${dateToken}_${vendorToken}_${seq}`;
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function formatNumberInput(value: string) {
  const cleaned = value.replaceAll(",", "").trim();
  if (!cleaned) return "";
  const sign = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/[^0-9.]/g, "");
  const parts = unsigned.split(".");
  const intDigits = parts[0] ?? "";
  const decimalDigits = parts[1] ?? "";
  const intFormatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (unsigned.includes(".")) {
    return `${sign}${intFormatted || "0"}.${decimalDigits}`;
  }
  return `${sign}${intFormatted || "0"}`;
}

function getRpcErrorMessage(error: unknown) {
  const e = error as
    | { message?: string; error_description?: string; details?: string; hint?: string }
    | string
    | null
    | undefined;
  const message =
    (typeof e === "string" ? e : e?.message) ??
    (typeof e === "string" ? undefined : e?.error_description) ??
    "잠시 후 다시 시도해 주세요";
  if (message.includes("ON CONFLICT specification")) {
    return "중복 제약이 없어 AP 생성이 실패했습니다. DB 제약 확인이 필요합니다.";
  }
  return message;
}

function mapMatchClearError(message: string) {
  if (message.includes("shipment not DRAFT")) {
    return "출고확정된 건이라 취소할 수 없습니다. 정정 영수증으로 처리하세요.";
  }
  if (message.includes("AR ledger exists")) {
    return "AR 전표가 이미 생성되어 취소할 수 없습니다. 회계 조정이 필요합니다.";
  }
  if (message.includes("inventory ISSUE")) {
    return "재고 출고(ISSUE) 기록이 있어 취소할 수 없습니다.";
  }
  if (message.includes("purchase_cost_status") || message.includes("ACTUAL")) {
    return "원가확정(ACTUAL)이 완료되어 취소할 수 없습니다.";
  }
  if (message.includes("vendor_bill_allocation")) {
    return "원가 배분이 이미 진행되어 취소할 수 없습니다.";
  }
  if (message.includes("AP alloc")) {
    return "AP 배분/상계가 진행되어 취소할 수 없습니다.";
  }
  return message;
}

function getIssueCounts(result: FactoryStatementResult | undefined) {
  const counts = result?.reconcile?.issue_counts ?? null;
  if (!counts) return null;
  const error = Number(counts.error ?? 0);
  const warn = Number(counts.warn ?? 0);
  return {
    error: Number.isFinite(error) ? error : 0,
    warn: Number.isFinite(warn) ? warn : 0,
  };
}

function roundTo6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isValidSeq(value: string) {
  const n = parseNumber(value);
  return n !== null && Number.isInteger(n) && n > 0;
}

function getNextVendorSeq(items: ReceiptLineItemInput[]) {
  const seqs = items
    .map((item) => parseNumber(item.vendor_seq_no))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxSeq = seqs.length > 0 ? Math.max(...seqs) : 0;
  return maxSeq + 1;
}

function toInputNumber(value?: number | null) {
  if (value === null || value === undefined) return "";
  if (Number.isNaN(Number(value))) return "";
  return String(value);
}

function calcWeightTotal(raw: string, deduct: string) {
  const rawNum = parseNumber(raw) ?? 0;
  const deductNum = parseNumber(deduct) ?? 0;
  return Math.max(0, rawNum - deductNum);
}

function calcStoneFactoryCost(item: Pick<ReceiptLineItemInput, StoneField>) {
  const centerQty = parseNumber(item.stone_center_qty) ?? 0;
  const sub1Qty = parseNumber(item.stone_sub1_qty) ?? 0;
  const sub2Qty = parseNumber(item.stone_sub2_qty) ?? 0;
  const centerUnit = parseNumber(item.stone_center_unit_cost_krw) ?? 0;
  const sub1Unit = parseNumber(item.stone_sub1_unit_cost_krw) ?? 0;
  const sub2Unit = parseNumber(item.stone_sub2_unit_cost_krw) ?? 0;

  return centerQty * centerUnit + sub1Qty * sub1Unit + sub2Qty * sub2Unit;
}

function getLineIdFromTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return null;
  return target.dataset.lineId ?? null;
}

function getReceiptLineUuid(line: UnlinkedLineRow) {
  return line.receipt_line_uuid ?? "";
}

const DEFAULT_STATUS_FILTER = "ALL";
const AUTO_FIELD_CLASS = "bg-[var(--panel)]/70";
const DEFAULT_RANGE_MONTHS = -3;
const DON_TO_G = 3.75;

const FACTORY_ROWS: Array<Pick<FactoryRowInput, "rowCode" | "label">> = [
  { rowCode: "RECENT_PAYMENT", label: "최근결제" },
  { rowCode: "PRE_BALANCE", label: "거래전미수" },
  { rowCode: "SALE", label: "판매" },
  { rowCode: "POST_BALANCE", label: "거래후미수" },
];

function getDefaultRangeDateByMonths(offsetMonths: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

export default function ReceiptLineWorkbench({ initialReceiptId }: { initialReceiptId?: string | null }) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState(() => getDefaultRangeDateByMonths(DEFAULT_RANGE_MONTHS));
  const [toDate, setToDate] = useState(() => getDefaultRangeDateByMonths(0));
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [limit, setLimit] = useState(50);
  const [lineLimit, setLineLimit] = useState(50);
  const [unlinkedLimit, setUnlinkedLimit] = useState(50);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [vendorPartyId, setVendorPartyId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [memo, setMemo] = useState("");
  const [billNoTouched, setBillNoTouched] = useState(false);
  const [autoBillNo, setAutoBillNo] = useState<string | null>(null);
  const [billNoAutoEligible, setBillNoAutoEligible] = useState(true);
  const [billNoSuggestNonce, setBillNoSuggestNonce] = useState(0);
  const headerSnapshotsRef = useRef<Map<string, HeaderSnapshot>>(new Map());
  const [headerSnapshot, setHeaderSnapshot] = useState<HeaderSnapshot | null>(null);
  const [headerSaveNudge, setHeaderSaveNudge] = useState(false);
  const headerNudgeTimerRef = useRef<number | null>(null);

  const [factoryRows, setFactoryRows] = useState<FactoryRowInput[]>(() =>
    FACTORY_ROWS.map((row) => ({
      rowCode: row.rowCode,
      label: row.label,
      refDate: "",
      note: "",
      gold: { value: "", unit: "g" },
      silver: { value: "", unit: "g" },
      laborKrw: "",
    }))
  );
  const [factoryRefDate, setFactoryRefDate] = useState("");
  const [factoryNote, setFactoryNote] = useState("");
  const [reconcileIssueCounts, setReconcileIssueCounts] = useState<{ error: number; warn: number } | null>(null);
  const [apSyncStatus, setApSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [apSyncMessage, setApSyncMessage] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<ReceiptLineItemInput[]>([]);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  const [activeLineSuggest, setActiveLineSuggest] = useState<
    { lineId: string; field: "customer" | "model" } | null
  >(null);
  const [customerCodeSuggest, setCustomerCodeSuggest] = useState<CustomerCodeSuggestItem[]>([]);
  const [modelNameSuggest, setModelNameSuggest] = useState<ModelNameSuggestItem[]>([]);
  const [isCustomerSuggestLoading, setIsCustomerSuggestLoading] = useState(false);
  const [isModelSuggestLoading, setIsModelSuggestLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReceiptLineItemInput | null>(null);
  const [deleteReason, setDeleteReason] = useState("입력오류");
  const [deleteNote, setDeleteNote] = useState("");

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBillNoSuggestKey = useRef<string | null>(null);
  const suggestTimerRef = useRef<number | null>(null);
  const customerSuggestTimerRef = useRef<number | null>(null);
  const modelSuggestTimerRef = useRef<number | null>(null);
  const lastCustomerSuggestKeyRef = useRef<string | null>(null);
  const lastModelSuggestKeyRef = useRef<string | null>(null);
  const suppressModelSuggestRef = useRef<{ lineId: string; value: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"match" | "confirmed" | "reconcile" | "integrity">("match");
  const [isMatchPanelExpanded, setIsMatchPanelExpanded] = useState(false);
  const [selectedUnlinked, setSelectedUnlinked] = useState<UnlinkedLineRow | null>(null);
  const [suggestions, setSuggestions] = useState<MatchCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [scoreOpenMap, setScoreOpenMap] = useState<Record<string, boolean>>({});
  const [selectedWeight, setSelectedWeight] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [customerNameMap, setCustomerNameMap] = useState<Record<string, string | null>>({});
  const [customerLookupState, setCustomerLookupState] = useState<Record<string, "idle" | "loading" | "done">>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [suggestDebugState, setSuggestDebugState] = useState<{ query: string; count: number } | null>(null);

  const [matchClearOpen, setMatchClearOpen] = useState(false);
  const [matchClearTarget, setMatchClearTarget] = useState<ConfirmedMatchRow | null>(null);
  const [matchClearReason, setMatchClearReason] = useState<MatchClearReasonCode>("INPUT_ERROR");
  const [matchClearReasonText, setMatchClearReasonText] = useState("");
  const [matchClearNote, setMatchClearNote] = useState("");
  const [matchClearError, setMatchClearError] = useState<string | null>(null);
  const matchExpandRef = useRef<HTMLDivElement | null>(null);
  const matchExpandHeightRef = useRef<number | null>(null);
  const [matchPanelMinHeight, setMatchPanelMinHeight] = useState<number | null>(null);

  const debugSuggest = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debugSuggest") === "1";
  }, []);

  useEffect(() => {
    if (!debugSuggest || typeof window === "undefined") return;
    (window as Window & { __suggestLookup?: (q: string) => void }).__suggestLookup = (q: string) => {
      void handleSuggestOrdersInput(q, "");
    };
    console.log("[suggest-debug] ready: window.__suggestLookup('루')");
  }, [debugSuggest]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  useEffect(() => {
    if (!expandedLineId) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const isInside = target.closest(`[data-line-block="${expandedLineId}"]`);
      if (!isInside) {
        setExpandedLineId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [expandedLineId]);

  useEffect(() => {
    return () => {
      if (suggestTimerRef.current) {
        window.clearTimeout(suggestTimerRef.current);
      }
      if (customerSuggestTimerRef.current) {
        window.clearTimeout(customerSuggestTimerRef.current);
      }
      if (modelSuggestTimerRef.current) {
        window.clearTimeout(modelSuggestTimerRef.current);
      }
      if (headerNudgeTimerRef.current) {
        window.clearTimeout(headerNudgeTimerRef.current);
      }
    };
  }, []);

  const vendorOptionsQuery = useQuery({
    queryKey: ["vendor-parties"],
    queryFn: async () => {
      const res = await fetch("/api/vendors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "거래처 조회 실패");
      const rows = (json?.data ?? []) as Array<{ party_id: string; name: string }>;
      return rows.map((row) => ({
        label: row.name,
        value: row.party_id,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const receiptsQuery = useQuery({
    queryKey: ["new-receipt-workbench", "receipts", statusFilter, vendorFilter, fromDate, toDate, unlinkedOnly, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (vendorFilter) params.set("vendor_party_id", vendorFilter);
      if (fromDate) params.set("received_from", fromDate);
      if (toDate) params.set("received_to", toDate);
      if (unlinkedOnly) params.set("unlinked_only", "1");

      const res = await fetch(`/api/new-receipt-workbench/receipts?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "영수증 조회 실패");
      return (json?.data ?? []) as ReceiptInboxRow[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const lineItemsQuery = useQuery({
    queryKey: ["new-receipt-workbench", "line-items", selectedReceiptId, lineLimit],
    queryFn: async () => {
      if (!selectedReceiptId) return [] as ReceiptLineItemRow[];
      const res = await fetch(
        `/api/new-receipt-workbench/line-items?receipt_id=${encodeURIComponent(selectedReceiptId)}&limit=${lineLimit}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "라인 조회 실패");
      return (json?.data ?? []) as ReceiptLineItemRow[];
    },
    enabled: Boolean(selectedReceiptId),
    staleTime: 20 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const unlinkedQuery = useQuery({
    queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId, unlinkedLimit],
    queryFn: async () => {
      if (!selectedReceiptId) return [] as UnlinkedLineRow[];
      const res = await fetch(
        `/api/new-receipt-workbench/unlinked?receipt_id=${encodeURIComponent(selectedReceiptId)}&limit=${unlinkedLimit}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "미매칭 라인 조회 실패");
      return (json?.data ?? []) as UnlinkedLineRow[];
    },
    enabled: Boolean(selectedReceiptId),
    staleTime: 20 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const matchesQuery = useQuery({
    queryKey: ["new-receipt-workbench", "matches", selectedReceiptId],
    queryFn: async () => {
      if (!selectedReceiptId) return [] as ConfirmedMatchRow[];
      const res = await fetch(
        `/api/new-receipt-workbench/matches?receipt_id=${encodeURIComponent(selectedReceiptId)}&limit=200`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : typeof json?.error === "string"
              ? json.error
              : "확정 매칭 조회 실패";
        throw new Error(message);
      }
      return (json?.data ?? []) as ConfirmedMatchRow[];
    },
    enabled: Boolean(selectedReceiptId),
    staleTime: 5 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const reconcileQuery = useQuery({
    queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId],
    queryFn: async () => {
      if (!selectedReceiptId) return [] as Record<string, unknown>[];
      const res = await fetch(
        `/api/new-receipt-workbench/reconcile?receipt_id=${encodeURIComponent(selectedReceiptId)}&limit=50`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[Reconcile API Error]", json);
        }
        throw new Error(json?.error ?? "정합성 조회 실패");
      }
      return (json?.data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(selectedReceiptId),
    staleTime: 20 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const integrityQuery = useQuery({
    queryKey: ["new-receipt-workbench", "integrity", selectedReceiptId],
    queryFn: async () => {
      if (!selectedReceiptId) return [] as Record<string, unknown>[];
      const res = await fetch(
        `/api/new-receipt-workbench/integrity?receipt_id=${encodeURIComponent(selectedReceiptId)}&limit=50`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "링크 오류 조회 실패");
      return (json?.data ?? []) as Record<string, unknown>[];
    },
    enabled: Boolean(selectedReceiptId),
    staleTime: 20 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const upsertSnapshot = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.receiptPricingSnapshotUpsertV2,
    successMessage: "라인 저장 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "line-items", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
      void lineItemsQuery.refetch();
      void unlinkedQuery.refetch().then((result) => {
        if (!selectedUnlinked) return;
        const currentUuid = getReceiptLineUuid(selectedUnlinked);
        if (!currentUuid) return;
        const next = (result.data ?? []).find((line) => getReceiptLineUuid(line) === currentUuid);
        if (next) {
          setSelectedUnlinked(next);
        }
      });
    },
  });

  const ensureApFromReceipt = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.ensureApFromReceipt,
  });

  const factoryStatementUpsert = useRpcMutation<FactoryStatementResult>({
    fn: CONTRACTS.functions.factoryReceiptStatementUpsert,
    successMessage: "저장됨",
    onSuccess: (result) => {
      const counts = getIssueCounts(result);
      if (counts) {
        setReconcileIssueCounts(counts);
      }
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId] });
    },
  });

  const headerUpdate = useRpcMutation<void>({
    fn: "cms_fn_update_vendor_bill_header_v1",
    successMessage: "헤더 저장 완료",
    onSuccess: () => {
      if (selectedReceiptId) {
        const snapshot: HeaderSnapshot = {
          vendorPartyId,
          billNo,
          billDate,
          memo,
        };
        headerSnapshotsRef.current.set(selectedReceiptId, snapshot);
        setHeaderSnapshot(snapshot);
        void fetchHeaderSnapshot(selectedReceiptId);
      }
      setHeaderSaveNudge(false);
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
    },
  });

  const receiptLineDelete = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.receiptLineDeleteV1,
    successMessage: "라인 삭제 완료",
    onSuccess: () => {
      setApSyncStatus("success");
      setApSyncMessage(null);
      queryClient.invalidateQueries({
        queryKey: ["new-receipt-workbench", "line-items", selectedReceiptId, lineLimit],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "new-receipt-workbench",
          "receipts",
          statusFilter,
          vendorFilter,
          fromDate,
          toDate,
          unlinkedOnly,
          limit,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId, unlinkedLimit],
      });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "integrity", selectedReceiptId] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return Array.isArray(k) && k.length > 0 && k[0] === "new-receipt-workbench";
        },
      });
    },
  });

  const matchConfirm = useRpcMutation<ConfirmResult>({
    fn: CONTRACTS.functions.receiptLineMatchConfirm,
    successMessage: "매칭 확정 + shipment draft 생성 완료",
    onSuccess: (result) => {
      setConfirmResult(result);
      if (result?.missing_unit_cost_warn) {
        toast.warning("자입 보석 단가가 0입니다(확인 필요)");
      }
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "integrity", selectedReceiptId] });
    },
  });

  const matchClearMutation = useMutation({
    mutationFn: async (payload: {
      receipt_id: string;
      receipt_line_uuid: string;
      reason_code: MatchClearReasonCode;
      reason_text?: string;
      note?: string;
    }) => {
      const res = await fetch("/api/new-receipt-workbench/match-clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : typeof json?.error === "string"
              ? json.error
              : "매칭취소 실패";
        throw new Error(message);
      }
      return json?.data as Record<string, unknown> | null;
    },
    onSuccess: () => {
      toast.success("매칭취소 완료: 출고대기에서 해제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "line-items", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "matches", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "integrity", selectedReceiptId] });
      setMatchClearOpen(false);
      setMatchClearTarget(null);
      setMatchClearReason("INPUT_ERROR");
      setMatchClearReasonText("");
      setMatchClearNote("");
      setMatchClearError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "매칭취소 실패";
      const mapped = mapMatchClearError(message);
      toast.error(mapped);
      setMatchClearError(mapped);
    },
  });

  const receipts = receiptsQuery.data ?? [];
  const vendorOptions = vendorOptionsQuery.data ?? [];
  const confirmedMatches = matchesQuery.data ?? [];
  const lockedLineMap = useMemo(() => {
    const map = new Map<string, ConfirmedMatchRow>();
    confirmedMatches.forEach((row) => {
      if (row.receipt_line_uuid) {
        map.set(row.receipt_line_uuid, row);
      }
    });
    return map;
  }, [confirmedMatches]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>([DEFAULT_STATUS_FILTER]);
    receipts.forEach((row) => {
      if (row.status) set.add(row.status);
    });
    return Array.from(new Set(["ALL", ...Array.from(set)]));
  }, [receipts]);

  const selectedReceipt = useMemo(() => {
    if (!selectedReceiptId) return null;
    return receipts.find((row) => row.receipt_id === selectedReceiptId) ?? null;
  }, [receipts, selectedReceiptId]);

  const normalizedCurrentHeader = useMemo(
    () => normalizeHeaderSnapshot({ vendorPartyId, billNo, billDate, memo }),
    [vendorPartyId, billNo, billDate, memo]
  );

  const normalizedHeaderSnapshot = useMemo(() => {
    if (!headerSnapshot) return null;
    return normalizeHeaderSnapshot(headerSnapshot);
  }, [headerSnapshot]);

  const isHeaderDirty = useMemo(() => {
    if (!selectedReceiptId || !normalizedHeaderSnapshot) return false;
    return (
      normalizedCurrentHeader.vendorPartyId !== normalizedHeaderSnapshot.vendorPartyId ||
      normalizedCurrentHeader.billNo !== normalizedHeaderSnapshot.billNo ||
      normalizedCurrentHeader.billDate !== normalizedHeaderSnapshot.billDate ||
      normalizedCurrentHeader.memo !== normalizedHeaderSnapshot.memo
    );
  }, [normalizedCurrentHeader, normalizedHeaderSnapshot, selectedReceiptId]);

  const headerSaved = useMemo(() => {
    if (!selectedReceiptId) return false;
    const snapshot = normalizedHeaderSnapshot ?? normalizedCurrentHeader;
    return Boolean(snapshot.vendorPartyId || snapshot.billNo || snapshot.billDate || snapshot.memo);
  }, [normalizedCurrentHeader, normalizedHeaderSnapshot, selectedReceiptId]);

  const headerNeedsSave = useMemo(() => {
    if (!selectedReceiptId) return false;
    return !headerSaved || isHeaderDirty;
  }, [headerSaved, isHeaderDirty, selectedReceiptId]);

  const triggerHeaderSaveNudge = useCallback(() => {
    setHeaderSaveNudge(true);
    if (headerNudgeTimerRef.current) {
      window.clearTimeout(headerNudgeTimerRef.current);
    }
    headerNudgeTimerRef.current = window.setTimeout(() => {
      setHeaderSaveNudge(false);
    }, 1400);
  }, []);

  const applyHeaderSnapshot = useCallback((snapshot: HeaderSnapshot) => {
    setVendorPartyId(snapshot.vendorPartyId);
    setBillNo(snapshot.billNo);
    setBillDate(snapshot.billDate);
    setMemo(snapshot.memo);
    setBillNoTouched(false);
    setAutoBillNo(null);
    setBillNoAutoEligible(!snapshot.billNo);
    lastBillNoSuggestKey.current = null;
    setFactoryRefDate(snapshot.billDate);
  }, []);

  const fetchHeaderSnapshot = useCallback(
    async (receiptId: string) => {
      try {
        const res = await fetch(
          `/api/new-receipt-workbench/receipt?receipt_id=${encodeURIComponent(receiptId)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!res.ok) {
          const message = typeof json?.error === "string" ? json.error : "헤더 조회에 실패했습니다.";
          toast.error(message);
          return;
        }
        const row = (json?.data ?? null) as ReceiptHeaderRow | null;
        if (!row) {
          toast.error("헤더 데이터가 없습니다.");
          return;
        }
        const snapshot = buildHeaderSnapshotFromRow(row);
        headerSnapshotsRef.current.set(receiptId, snapshot);
        if (selectedReceiptId === receiptId) {
          setHeaderSnapshot(snapshot);
          applyHeaderSnapshot(snapshot);
        }
      } catch {
        toast.error("헤더 조회 중 오류가 발생했습니다.");
      }
    },
    [applyHeaderSnapshot, selectedReceiptId]
  );

  useEffect(() => {
    if (!headerNeedsSave) {
      setHeaderSaveNudge(false);
    }
  }, [headerNeedsSave]);

  useEffect(() => {
    if (!selectedReceiptId) {
      setHeaderSnapshot(null);
      return;
    }
    const cached = headerSnapshotsRef.current.get(selectedReceiptId);
    if (cached) {
      applyHeaderSnapshot(cached);
      setHeaderSnapshot(cached);
      return;
    }
    if (!selectedReceipt) return;
    const snapshot = buildHeaderSnapshotFromReceipt(selectedReceipt);
    headerSnapshotsRef.current.set(selectedReceiptId, snapshot);
    applyHeaderSnapshot(snapshot);
    setHeaderSnapshot(snapshot);
    void fetchHeaderSnapshot(selectedReceiptId);
  }, [applyHeaderSnapshot, fetchHeaderSnapshot, selectedReceipt, selectedReceiptId]);

  useEffect(() => {
    if (!factoryRefDate) return;
    setFactoryRows((prev) => prev.map((row) => ({ ...row, refDate: factoryRefDate })));
  }, [factoryRefDate]);

  useEffect(() => {
    if (!selectedReceiptId || !vendorPartyId || !billDate) return;
    if (billNoTouched || !billNoAutoEligible) return;

    const vendorLabel = vendorOptions.find((option) => option.value === vendorPartyId)?.label ?? "FAC";
    const vendorToken = normalizeVendorToken(vendorLabel);
    const key = `${selectedReceiptId}:${vendorPartyId}:${billDate}:${billNoSuggestNonce}:${vendorToken}`;
    if (lastBillNoSuggestKey.current === key) return;
    lastBillNoSuggestKey.current = key;

    let cancelled = false;

    async function suggestBillNo() {
      try {
        const params = new URLSearchParams();
        params.set("vendor_party_id", vendorPartyId);
        params.set("bill_date", billDate);
        params.set("vendor_token", vendorToken);
        if (selectedReceiptId) {
          params.set("receipt_id", selectedReceiptId);
        }
        const res = await fetch(`/api/new-receipt-workbench/bill-no-suggest?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const nextSeq = Number(json?.data?.next_seq ?? 1) || 1;
        const suggested = buildBillNo(billDate, vendorLabel, nextSeq);
        if (cancelled) return;
        setAutoBillNo(suggested);
        setBillNo(suggested);
      } catch {
        // ignore suggestion errors
      }
    }

    suggestBillNo();

    return () => {
      cancelled = true;
    };
  }, [billDate, billNoAutoEligible, billNoSuggestNonce, billNoTouched, selectedReceiptId, vendorOptions, vendorPartyId]);

  useEffect(() => {
    if (!lineItemsQuery.data) return;
    if (lineItemsDirty) return;
    const rows = lineItemsQuery.data;
    const existingSeqs = rows
      .map((row) => row.vendor_seq_no)
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    let nextSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
    const mapped = rows.map((row) => {
      const lineUuid = row.line_uuid ?? row.receipt_line_uuid ?? crypto.randomUUID();
      const seqValue = row.vendor_seq_no ?? (nextSeq += 1);
      return {
        line_uuid: lineUuid,
        receipt_line_uuid: row.receipt_line_uuid ?? null,
        customer_factory_code: row.customer_factory_code ?? "",
        model_name: row.model_name ?? "",
        material_code: row.material_code ?? "",
        qty: toInputNumber(row.qty ?? 1),
        weight_raw_g: toInputNumber(row.weight_raw_g ?? row.weight_g ?? null),
        weight_deduct_g: toInputNumber(row.weight_deduct_g ?? null),
        labor_basic_cost_krw: toInputNumber(row.labor_basic_cost_krw ?? null),
        labor_other_cost_krw: toInputNumber(row.labor_other_cost_krw ?? null),
        stone_center_qty: toInputNumber(row.stone_center_qty ?? 0),
        stone_sub1_qty: toInputNumber(row.stone_sub1_qty ?? 0),
        stone_sub2_qty: toInputNumber(row.stone_sub2_qty ?? 0),
        stone_center_unit_cost_krw: toInputNumber(row.stone_center_unit_cost_krw ?? 0),
        stone_sub1_unit_cost_krw: toInputNumber(row.stone_sub1_unit_cost_krw ?? 0),
        stone_sub2_unit_cost_krw: toInputNumber(row.stone_sub2_unit_cost_krw ?? 0),
        total_amount_krw: toInputNumber(row.total_amount_krw ?? null),
        size: row.size ?? "",
        color: row.color ?? "",
        vendor_seq_no: toInputNumber(seqValue),
        remark: row.remark ?? "",
      };
    });
    setLineItems(mapped);
  }, [lineItemsDirty, lineItemsQuery.data]);

  const handleSelectReceipt = useCallback(
    (row: ReceiptInboxRow) => {
      if (headerNeedsSave && selectedReceiptId && row.receipt_id !== selectedReceiptId) {
        triggerHeaderSaveNudge();
        toast.error("먼저 헤더 저장을 진행해 주세요.");
        return;
      }
      const receiptId = row.receipt_id;
      if (!receiptId) return;
      const snapshot = headerSnapshotsRef.current.get(receiptId) ?? buildHeaderSnapshotFromReceipt(row);
      headerSnapshotsRef.current.set(receiptId, snapshot);
      setHeaderSnapshot(snapshot);
      applyHeaderSnapshot(snapshot);
      setSelectedReceiptId(receiptId);
      void fetchHeaderSnapshot(receiptId);
    },
    [applyHeaderSnapshot, fetchHeaderSnapshot, headerNeedsSave, selectedReceiptId, triggerHeaderSaveNudge]
  );

  useEffect(() => {
    const unlinkedLines = unlinkedQuery.data ?? [];
    const codes = Array.from(
      new Set(
        [
          ...lineItems.map((item) => item.customer_factory_code.trim()),
          ...unlinkedLines.map((line) => line.customer_factory_code?.trim() ?? ""),
        ].filter((code) => code.length > 0)
      )
    );

    if (codes.length === 0) return;

    const missing = codes.filter((code) => !customerLookupState[code]);
    if (missing.length === 0) return;

    missing.forEach((code) => {
      setCustomerLookupState((prev) => ({ ...prev, [code]: "loading" }));
    });

    Promise.all(
      missing.map(async (code) => {
        try {
          const res = await fetch(
            `/api/new-receipt-workbench/party-by-mask?mask_code=${encodeURIComponent(code)}`,
            { cache: "no-store" }
          );
          const json = await res.json();
          if (!res.ok) {
            setCustomerNameMap((prev) => ({ ...prev, [code]: null }));
          } else {
            const name = json?.data?.name ?? null;
            setCustomerNameMap((prev) => ({ ...prev, [code]: name }));
          }
        } catch {
          setCustomerNameMap((prev) => ({ ...prev, [code]: null }));
        } finally {
          setCustomerLookupState((prev) => ({ ...prev, [code]: "done" }));
        }
      })
    );
  }, [customerLookupState, lineItems, unlinkedQuery.data]);

  useEffect(() => {
    if (!initialReceiptId) return;
    if (selectedReceiptId) return;
    const target = receipts.find((row) => row.receipt_id === initialReceiptId);
    if (!target) return;
    if (headerNeedsSave && selectedReceiptId && target.receipt_id !== selectedReceiptId) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return;
    }
    const receiptId = target.receipt_id;
    if (!receiptId) return;
    const snapshot = headerSnapshotsRef.current.get(receiptId) ?? buildHeaderSnapshotFromReceipt(target);
    headerSnapshotsRef.current.set(receiptId, snapshot);
    setHeaderSnapshot(snapshot);
    applyHeaderSnapshot(snapshot);
    setSelectedReceiptId(receiptId);
  }, [applyHeaderSnapshot, headerNeedsSave, initialReceiptId, receipts, selectedReceiptId, triggerHeaderSaveNudge]);

  useEffect(() => {
    setLineItemsDirty(false);
    setSuggestions([]);
    setSelectedCandidate(null);
    setSelectedUnlinked(null);
    setConfirmResult(null);
    setSelectedWeight("");
    setConfirmNote("");
    setLineLimit(50);
    setUnlinkedLimit(50);
    setExpandedLineId(null);
    setMatchClearOpen(false);
    setMatchClearTarget(null);
    setMatchClearReason("INPUT_ERROR");
    setMatchClearReasonText("");
    setMatchClearNote("");
    setMatchClearError(null);
    setFactoryRows(
      FACTORY_ROWS.map((row) => ({
        rowCode: row.rowCode,
        label: row.label,
        refDate: "",
        note: "",
        gold: { value: "", unit: "g" },
        silver: { value: "", unit: "g" },
        laborKrw: "",
      }))
    );
    setFactoryNote("");
    setReconcileIssueCounts(null);
    setApSyncStatus("idle");
    setApSyncMessage(null);
  }, [selectedReceiptId]);

  useEffect(() => {
    async function fetchPreview(receiptId: string) {
      setIsPreviewLoading(true);
      setPreviewBlobUrl(null);
      setPreviewMime(null);
      try {
        const res = await fetch(`/api/receipt-preview?receipt_id=${encodeURIComponent(receiptId)}`);
        if (!res.ok) {
          toast.error("미리보기 로드 실패");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        setPreviewMime(blob.type || null);
      } catch {
        toast.error("미리보기 로드 실패");
      } finally {
        setIsPreviewLoading(false);
      }
    }

    if (selectedReceiptId) {
      fetchPreview(selectedReceiptId);
    } else {
      setPreviewBlobUrl(null);
      setPreviewMime(null);
    }
  }, [selectedReceiptId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadPreviewUrl(null);
    }
  }

  function resetUpload() {
    setSelectedFile(null);
    setUploadPreviewUrl(null);
    setIsUploading(false);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  async function uploadReceipt() {
    const file = selectedFile;
    if (!file) {
      toast.error("파일을 선택해 주세요");
      return;
    }

    setIsUploading(true);
    try {
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

      const receiptId = json?.receipt_id as string | undefined;
      setUploadOpen(false);
      resetUpload();

      if (receiptId) {
        toast.success("영수증 업로드 완료");
        setStatusFilter(DEFAULT_STATUS_FILTER);
        setVendorFilter("");
        setUnlinkedOnly(false);
        setFromDate(getDefaultRangeDateByMonths(DEFAULT_RANGE_MONTHS));
        setToDate(getDefaultRangeDateByMonths(0));
        setSelectedReceiptId(receiptId);
        void fetchHeaderSnapshot(receiptId);
        await queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
        void receiptsQuery.refetch();
      } else {
        toast.error("업로드는 완료되었으나 영수증 ID를 받지 못했습니다");
      }
    } catch {
      toast.error("업로드 중 오류 발생");
    } finally {
      setIsUploading(false);
    }
  }

  function addLine() {
    setLineItemsDirty(true);
    setLineItems((prev) => {
      const nextSeq = getNextVendorSeq(prev);
      return [
        ...prev,
        {
          line_uuid: crypto.randomUUID(),
          customer_factory_code: "",
          model_name: "",
          material_code: "",
          qty: "1",
          weight_raw_g: "",
          weight_deduct_g: "",
          labor_basic_cost_krw: "",
          labor_other_cost_krw: "",
          stone_center_qty: "0",
          stone_sub1_qty: "0",
          stone_sub2_qty: "0",
          stone_center_unit_cost_krw: "0",
          stone_sub1_unit_cost_krw: "0",
          stone_sub2_unit_cost_krw: "0",
          total_amount_krw: "",
          size: "",
          color: "",
          vendor_seq_no: String(nextSeq),
          remark: "",
        },
      ];
    });
  }

  function removeLineLocal(lineUuid: string) {
    setLineItemsDirty(true);
    setLineItems((prev) => prev.filter((item) => item.line_uuid !== lineUuid));
  }

  function openDeleteModal(target: ReceiptLineItemInput) {
    setDeleteTarget(target);
    setDeleteReason("입력오류");
    setDeleteNote("");
    setDeleteOpen(true);
  }

  function openMatchClearModal(target: ConfirmedMatchRow) {
    setMatchClearTarget(target);
    setMatchClearReason("INPUT_ERROR");
    setMatchClearReasonText("");
    setMatchClearNote("");
    setMatchClearError(null);
    setMatchClearOpen(true);
  }

  function closeMatchClearModal() {
    setMatchClearOpen(false);
    setMatchClearTarget(null);
    setMatchClearError(null);
  }

  function closeDeleteModal() {
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!selectedReceiptId) {
      removeLineLocal(deleteTarget.line_uuid);
      toast.success("로컬에서만 삭제됨(저장 전)");
      closeDeleteModal();
      return;
    }
    if (lineItemsDirty) {
      toast.error("저장되지 않은 변경사항이 있어 삭제 전에 먼저 저장해야 합니다.");
      return;
    }

    try {
      await receiptLineDelete.mutateAsync({
        p_receipt_id: selectedReceiptId,
        p_line_uuid: deleteTarget.line_uuid,
        p_reason: deleteReason.trim() || null,
        p_actor_person_id: null,
        p_note: deleteNote.trim() || null,
        p_correlation_id: null,
      });
      setLineItems((prev) => prev.filter((item) => item.line_uuid !== deleteTarget.line_uuid));
      closeDeleteModal();
    } catch (error) {
      const message = getRpcErrorMessage(error);
      if (message.includes("no pricing snapshot yet")) {
        toast.error("먼저 ‘라인 저장’을 눌러 저장본을 만든 뒤 삭제하세요.");
        return;
      }
      if (message.includes("cannot delete")) {
        toast.error("이미 매칭/출고 연결된 라인이라 삭제할 수 없습니다. 먼저 연결 해제 절차가 필요합니다.");
        return;
      }
      toast.error(message);
    }
  }

  async function confirmMatchClear() {
    if (!selectedReceiptId || !matchClearTarget) return;
    setMatchClearError(null);
    await matchClearMutation.mutateAsync({
      receipt_id: selectedReceiptId,
      receipt_line_uuid: matchClearTarget.receipt_line_uuid,
      reason_code: matchClearReason,
      reason_text: matchClearReasonText.trim() || undefined,
      note: matchClearNote.trim() || undefined,
    });
  }

  function updateLine(lineUuid: string, field: keyof ReceiptLineItemInput, value: string) {
    setLineItemsDirty(true);
    setLineItems((prev) =>
      prev.map((item) => (item.line_uuid === lineUuid ? { ...item, [field]: value } : item))
    );
  }

  async function fetchCustomerCodeSuggest(q: string, lineId: string) {
    try {
      const res = await fetch("/api/new-receipt-workbench/customer-code-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, limit: 30 }),
      });
      const json = await res.json();
      const key = `${lineId}:${q}`;
      if (lastCustomerSuggestKeyRef.current !== key) return;
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "고객코드 조회 실패");
      }
      const data = (json?.data ?? []) as CustomerCodeSuggestItem[];
      setCustomerCodeSuggest(data);
      setIsCustomerSuggestLoading(false);
    } catch (error) {
      const key = `${lineId}:${q}`;
      if (lastCustomerSuggestKeyRef.current !== key) return;
      console.log("[customer-code-suggest] failed", error);
      setCustomerCodeSuggest([]);
      setIsCustomerSuggestLoading(false);
    }
  }

  async function fetchModelNameSuggest(q: string, lineId: string) {
    try {
      const res = await fetch("/api/new-receipt-workbench/model-name-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, limit: 30 }),
      });
      const json = await res.json();
      const key = `${lineId}:${q}`;
      if (lastModelSuggestKeyRef.current !== key) return;
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "모델명 조회 실패");
      }
      const data = (json?.data ?? []) as ModelNameSuggestItem[];
      setModelNameSuggest(data);
      setIsModelSuggestLoading(false);
    } catch (error) {
      const key = `${lineId}:${q}`;
      if (lastModelSuggestKeyRef.current !== key) return;
      console.log("[model-name-suggest] failed", error);
      setModelNameSuggest([]);
      setIsModelSuggestLoading(false);
    }
  }

  function handleCustomerChange(lineId: string, nextValue: string) {
    updateLine(lineId, "customer_factory_code", nextValue);
    const query = nextValue.trim();
    if (customerSuggestTimerRef.current) {
      window.clearTimeout(customerSuggestTimerRef.current);
    }
    if (!query) {
      if (activeLineSuggest?.field === "customer" && activeLineSuggest.lineId === lineId) {
        setActiveLineSuggest(null);
      }
      setCustomerCodeSuggest([]);
      setIsCustomerSuggestLoading(false);
      return;
    }
    const key = `${lineId}:${query}`;
    lastCustomerSuggestKeyRef.current = key;
    setActiveLineSuggest({ lineId, field: "customer" });
    setIsCustomerSuggestLoading(true);
    customerSuggestTimerRef.current = window.setTimeout(() => {
      void fetchCustomerCodeSuggest(query, lineId);
    }, 150);
  }

  function handleModelChange(lineId: string, nextValue: string) {
    updateLine(lineId, "model_name", nextValue);
    if (suppressModelSuggestRef.current) {
      const suppress = suppressModelSuggestRef.current;
      if (suppress.lineId === lineId && suppress.value === nextValue) {
        suppressModelSuggestRef.current = null;
        setActiveLineSuggest(null);
        setIsModelSuggestLoading(false);
        return;
      }
    }
    const query = nextValue.trim();
    if (modelSuggestTimerRef.current) {
      window.clearTimeout(modelSuggestTimerRef.current);
    }
    if (!query) {
      if (activeLineSuggest?.field === "model" && activeLineSuggest.lineId === lineId) {
        setActiveLineSuggest(null);
      }
      setModelNameSuggest([]);
      setIsModelSuggestLoading(false);
      return;
    }
    const key = `${lineId}:${query}`;
    lastModelSuggestKeyRef.current = key;
    setActiveLineSuggest({ lineId, field: "model" });
    setIsModelSuggestLoading(true);
    modelSuggestTimerRef.current = window.setTimeout(() => {
      void fetchModelNameSuggest(query, lineId);
    }, 150);
  }

  function updateLineNumber(
    lineUuid: string,
    field: keyof ReceiptLineItemInput,
    value: string,
    options?: { format?: boolean }
  ) {
    const nextValue = options?.format === false ? value : formatNumberInput(value);
    updateLine(lineUuid, field, nextValue);
  }

  function updateLineAndResetTotal(lineUuid: string, field: keyof ReceiptLineItemInput, value: string) {
    setLineItemsDirty(true);
    setLineItems((prev) =>
      prev.map((item) =>
        item.line_uuid === lineUuid
          ? { ...item, [field]: value, total_amount_krw: "" }
          : item
      )
    );
  }

  function updateLineNumberAndResetTotal(
    lineUuid: string,
    field: keyof ReceiptLineItemInput,
    value: string,
    options?: { format?: boolean }
  ) {
    const nextValue = options?.format === false ? value : formatNumberInput(value);
    updateLineAndResetTotal(lineUuid, field, nextValue);
  }

  function updateLineMaterial(lineUuid: string, value: string) {
    const normalized = value.trim().toUpperCase();
    updateLine(lineUuid, "material_code", normalized);
  }

  function updateFactoryRow(rowCode: FactoryRowInput["rowCode"], patch: Partial<FactoryRowInput>) {
    setFactoryRows((prev) =>
      prev.map((row) => (row.rowCode === rowCode ? { ...row, ...patch } : row))
    );
  }

  function updateFactoryMetal(
    rowCode: FactoryRowInput["rowCode"],
    metal: "gold" | "silver",
    patch: Partial<FactoryMetalInput>
  ) {
    setFactoryRows((prev) =>
      prev.map((row) =>
        row.rowCode === rowCode
          ? { ...row, [metal]: { ...row[metal], ...patch } }
          : row
      )
    );
  }

  function buildFactoryLeg(assetCode: "XAU_G" | "XAG_G", input: FactoryMetalInput) {
    const inputQty = parseNumber(input.value) ?? 0;
    const qty = input.unit === "don" ? roundTo6(inputQty * DON_TO_G) : roundTo6(inputQty);
    return {
      asset_code: assetCode,
      qty,
      input_unit: input.unit,
      input_qty: inputQty,
    };
  }

  function buildFactoryLegFromGInput(assetCode: "XAU_G" | "XAG_G", inputValue: string) {
    const inputG = parseNumber(inputValue) ?? 0;
    return {
      asset_code: assetCode,
      qty: roundTo6(inputG),
      input_unit: "don" as const,
      input_qty: roundTo6(inputG / DON_TO_G),
    };
  }

  function buildLaborLeg(inputValue: string) {
    const inputQty = parseNumber(inputValue) ?? 0;
    return {
      asset_code: "KRW_LABOR",
      qty: inputQty,
      input_unit: "krw",
      input_qty: inputQty,
    };
  }

  const lineTotals = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        const qty = parseNumber(item.qty) ?? 1;
        const weight = calcWeightTotal(item.weight_raw_g, item.weight_deduct_g);
        const laborBasic = parseNumber(item.labor_basic_cost_krw) ?? 0;
        const laborOther = parseNumber(item.labor_other_cost_krw) ?? 0;
        const stoneFactory = calcStoneFactoryCost(item);
        const totalLine = parseNumber(item.total_amount_krw) ?? laborBasic + laborOther + stoneFactory;
        return {
          qty: acc.qty + qty,
          weight: acc.weight + weight * qty,
          laborBasic: acc.laborBasic + laborBasic * qty,
          laborOther: acc.laborOther + laborOther * qty,
          stoneLabor: acc.stoneLabor + stoneFactory * qty,
          totalAmount: acc.totalAmount + totalLine * qty,
        };
      },
      { qty: 0, weight: 0, laborBasic: 0, laborOther: 0, stoneLabor: 0, totalAmount: 0 }
    );
  }, [lineItems]);

  const lineMetalTotals = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        const qty = parseNumber(item.qty) ?? 1;
        const weight = calcWeightTotal(item.weight_raw_g, item.weight_deduct_g) * qty;
        switch (item.material_code) {
          case "14":
            acc.rawGold += weight;
            acc.convertedGold += weight * 0.6435;
            break;
          case "18":
            acc.rawGold += weight;
            acc.convertedGold += weight * 0.825;
            break;
          case "24":
            acc.rawGold += weight;
            acc.convertedGold += weight;
            break;
          case "925":
            acc.rawSilver += weight;
            acc.convertedSilver += weight * 0.925;
            break;
          case "999":
            acc.rawSilver += weight;
            acc.convertedSilver += weight;
            break;
          default:
            break;
        }
        return acc;
      },
      { rawGold: 0, rawSilver: 0, convertedGold: 0, convertedSilver: 0 }
    );
  }, [lineItems]);

  const duplicateSeqSet = useMemo(() => {
    const counts = new Map<number, number>();
    lineItems.forEach((item) => {
      const seqValue = parseNumber(item.vendor_seq_no);
      if (seqValue === null) return;
      counts.set(seqValue, (counts.get(seqValue) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([value]) => value));
  }, [lineItems]);

  const sortedLineItems = useMemo(() => {
    return [...lineItems].sort((a, b) => {
      const aSeq = parseNumber(a.vendor_seq_no);
      const bSeq = parseNumber(b.vendor_seq_no);
      if (aSeq === null && bSeq === null) return a.line_uuid.localeCompare(b.line_uuid);
      if (aSeq === null) return 1;
      if (bSeq === null) return -1;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return a.line_uuid.localeCompare(b.line_uuid);
    });
  }, [lineItems]);

  async function saveHeader() {
    if (!selectedReceiptId) {
      toast.error("영수증을 선택하세요");
      return;
    }
    await headerUpdate.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_vendor_party_id: vendorPartyId || null,
      p_bill_no: billNo || null,
      p_bill_date: billDate || null,
      p_memo: memo || null,
    });
  }

  async function saveLines(): Promise<boolean> {
    if (!selectedReceiptId) {
      toast.error("영수증을 선택하세요");
      return false;
    }
    if (headerNeedsSave) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return false;
    }

    const invalid = lineItems.find((item) => !item.model_name.trim() || !item.material_code.trim());
    if (invalid) {
      toast.error("모델명/소재는 필수입니다");
      return false;
    }

    const invalidSeq = lineItems.find((item) => !isValidSeq(item.vendor_seq_no));
    if (invalidSeq) {
      toast.error("라인 번호를 확인하세요");
      return false;
    }
    if (duplicateSeqSet.size > 0) {
      toast.error("라인 번호가 중복되었습니다");
      return false;
    }

    const payload = lineItems.map((item) => {
      const qty = parseNumber(item.qty) ?? 1;
      const laborBasic = parseNumber(item.labor_basic_cost_krw) ?? 0;
      const laborOther = parseNumber(item.labor_other_cost_krw) ?? 0;
      const stoneFactoryCost = calcStoneFactoryCost(item);
      const totalAmount = parseNumber(item.total_amount_krw) ?? laborBasic + laborOther + stoneFactoryCost;
      const weightTotal = calcWeightTotal(item.weight_raw_g, item.weight_deduct_g);

      return {
        line_uuid: item.line_uuid,
        customer_factory_code: item.customer_factory_code || null,
        model_name: item.model_name || null,
        material_code: item.material_code || null,
        qty,
        weight_g: weightTotal,
        weight_raw_g: parseNumber(item.weight_raw_g),
        weight_deduct_g: parseNumber(item.weight_deduct_g),
        labor_basic_cost_krw: laborBasic,
        labor_other_cost_krw: laborOther,
        stone_center_qty: parseNumber(item.stone_center_qty) ?? 0,
        stone_sub1_qty: parseNumber(item.stone_sub1_qty) ?? 0,
        stone_sub2_qty: parseNumber(item.stone_sub2_qty) ?? 0,
        stone_center_unit_cost_krw: parseNumber(item.stone_center_unit_cost_krw) ?? 0,
        stone_sub1_unit_cost_krw: parseNumber(item.stone_sub1_unit_cost_krw) ?? 0,
        stone_sub2_unit_cost_krw: parseNumber(item.stone_sub2_unit_cost_krw) ?? 0,
        total_amount_krw: totalAmount,
        size: item.size || null,
        color: item.color || null,
        vendor_seq_no: parseNumber(item.vendor_seq_no),
        remark: item.remark || null,
      };
    });

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_currency_code: "KRW",
      p_total_amount: lineTotals.totalAmount,
      p_weight_g: lineTotals.weight,
      p_labor_basic: lineTotals.laborBasic,
      p_labor_other: lineTotals.laborOther,
      p_line_items: payload,
    });

    try {
      await ensureApFromReceipt.mutateAsync({
        p_receipt_id: selectedReceiptId,
        p_note: memo || null,
      });
      setApSyncStatus("success");
      setApSyncMessage(null);
    } catch (error) {
      setApSyncStatus("error");
      setApSyncMessage(getRpcErrorMessage(error));
    }
    setLineItemsDirty(false);
    return true;
  }

  async function retryEnsureAp() {
    if (!selectedReceiptId) {
      toast.error("영수증을 선택하세요");
      return;
    }
    if (headerNeedsSave) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return;
    }
    try {
      await ensureApFromReceipt.mutateAsync({
        p_receipt_id: selectedReceiptId,
        p_note: memo || null,
      });
      setApSyncStatus("success");
      setApSyncMessage(null);
      toast.success("AP 동기화 완료");
    } catch (error) {
      setApSyncStatus("error");
      setApSyncMessage(getRpcErrorMessage(error));
    }
  }

  async function saveFactoryStatement() {
    if (!selectedReceiptId) {
      toast.error("영수증을 선택하세요");
      return;
    }
    if (headerNeedsSave) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return;
    }

    const rows = factoryRows.map((row) => ({
      row_code: row.rowCode,
      ref_date: row.refDate || null,
      note: row.note || null,
      legs: [
        buildFactoryLegFromGInput("XAU_G", row.gold.value),
        buildFactoryLegFromGInput("XAG_G", row.silver.value),
        buildLaborLeg(row.laborKrw),
      ],
    }));

    await factoryStatementUpsert.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_statement: { rows },
      p_note: factoryNote || null,
    });
  }

  async function handleSuggest(lineOverride?: UnlinkedLineRow | null) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[match-suggest] click", {
        receiptId: selectedReceiptId,
        receiptLineUuid: selectedUnlinked?.receipt_line_uuid,
      });
    }
    const fallbackLine = (unlinkedQuery.data ?? [])[0] ?? null;
    const targetLine = lineOverride ?? selectedUnlinked ?? fallbackLine;
    if (!selectedReceiptId || !targetLine) {
      toast.error("미매칭 라인을 선택하세요");
      return;
    }
    if (headerNeedsSave) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return;
    }
    if (lineItemsDirty) {
      const saved = await saveLines();
      if (!saved) return;
      await Promise.all([lineItemsQuery.refetch(), unlinkedQuery.refetch()]);
    }
    const normalizeText = (value?: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
    let receiptLineUuid = getReceiptLineUuid(targetLine);
    if (!receiptLineUuid) {
      const normalizedModel = normalizeText(targetLine.model_name);
      const normalizedMaterial = normalizeText(targetLine.material_code);
      const normalizedColor = normalizeText(targetLine.color);
      const normalizedSize = normalizeText(targetLine.size);
      const candidateFromUnlinked = (unlinkedQuery.data ?? []).find((line) => {
        if (targetLine.vendor_seq_no !== null && targetLine.vendor_seq_no !== undefined) {
          return line.vendor_seq_no === targetLine.vendor_seq_no && normalizeText(line.model_name) === normalizedModel;
        }
        return (
          normalizeText(line.model_name) === normalizedModel &&
          normalizeText(line.material_code) === normalizedMaterial &&
          normalizeText(line.color) === normalizedColor &&
          normalizeText(line.size) === normalizedSize
        );
      });
      if (candidateFromUnlinked?.receipt_line_uuid) {
        setSelectedUnlinked(candidateFromUnlinked);
        receiptLineUuid = candidateFromUnlinked.receipt_line_uuid ?? "";
      } else if (fallbackLine?.receipt_line_uuid) {
        setSelectedUnlinked(fallbackLine);
        receiptLineUuid = fallbackLine.receipt_line_uuid ?? "";
      }
    }
    if (!receiptLineUuid) {
      const saved = await saveLines();
      if (!saved) return;
      const refreshed = await fetch(
        `/api/new-receipt-workbench/line-items?receipt_id=${encodeURIComponent(selectedReceiptId)}`,
        { cache: "no-store" }
      );
      if (refreshed.ok) {
        const json = await refreshed.json();
        const rows = (json?.data ?? []) as Array<{
          receipt_line_uuid?: string | null;
          model_name?: string | null;
          material_code?: string | null;
          color?: string | null;
          size?: string | null;
          vendor_seq_no?: number | null;
          customer_factory_code?: string | null;
          remark?: string | null;
        }>;
        const updated = rows.find((line) => {
          if (targetLine.vendor_seq_no !== null && targetLine.vendor_seq_no !== undefined) {
            return line.vendor_seq_no === targetLine.vendor_seq_no && line.model_name === targetLine.model_name;
          }
          return (
            line.model_name === targetLine.model_name &&
            line.material_code === targetLine.material_code &&
            line.color === targetLine.color &&
            line.size === targetLine.size
          );
        });
        if (updated?.receipt_line_uuid) {
          const merged: UnlinkedLineRow = {
            ...targetLine,
            receipt_id: selectedReceiptId,
            receipt_line_uuid: updated.receipt_line_uuid,
            customer_factory_code: updated.customer_factory_code ?? targetLine.customer_factory_code ?? null,
            remark: updated.remark ?? targetLine.remark ?? null,
          };
          setSelectedUnlinked(merged);
          receiptLineUuid = updated.receipt_line_uuid;
        }
      }
      if (!receiptLineUuid) {
        toast.error("라인 UUID를 확인할 수 없습니다. 라인 저장 후 다시 시도하세요.");
        return;
      }
    }

    setIsSuggesting(true);
    try {
      const res = await fetch("/api/new-receipt-workbench/match-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: selectedReceiptId,
          receipt_line_uuid: receiptLineUuid,
          limit: 8,
        }),
      });
      const json = await res.json();
      if (process.env.NODE_ENV !== "production") {
        console.log("[match-suggest] response", json);
      }
      if (!res.ok) {
        toast.error("매칭 제안 실패", { description: json?.error ?? "" });
        return;
      }
      const payload = json?.data ?? null;
      const rawCandidates = (Array.isArray(payload?.candidates)
        ? payload.candidates
        : Array.isArray(payload)
          ? payload
          : Array.isArray(json?.candidates)
            ? json.candidates
            : []) as Array<MatchCandidate & { match_reason?: Record<string, unknown> | null }>;
      const candidates: MatchCandidate[] = rawCandidates.map((candidate) => ({
        ...candidate,
        score_detail_json: candidate.score_detail_json ?? candidate.match_reason ?? null,
      }));
      if (payload?.already_confirmed) {
        toast.error("이미 매칭 확정된 라인입니다.");
        setSuggestions([]);
        setSelectedCandidate(null);
        setConfirmResult(null);
        return;
      }

      let nextCandidates = [...candidates].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
      if (nextCandidates.length === 0) {
        const modelName = targetLine.model_name ?? "";
        const customerCode = targetLine.customer_factory_code ?? "";
        const buildFallbackCandidates = async (payload: { model_name: string; customer_factory_code: string }) => {
          const resFallback = await fetch("/api/new-receipt-workbench/match-suggest-input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model_name: payload.model_name,
              customer_factory_code: payload.customer_factory_code,
              limit: 8,
            }),
          });
          const jsonFallback = await resFallback.json();
          if (!resFallback.ok) return [] as MatchCandidate[];
          const rows = (jsonFallback?.data?.candidates ?? []) as Array<{
            order_line_id?: string | null;
            customer_party_id?: string | null;
            customer_mask_code?: string | null;
            customer_name?: string | null;
            model_name?: string | null;
            size?: string | null;
            color?: string | null;
            material_code?: string | null;
            status?: string | null;
            is_plated?: boolean | null;
            plating_color_code?: string | null;
            memo?: string | null;
          }>;
          return rows.map((row) => ({
            order_line_id: row.order_line_id ?? null,
            customer_party_id: row.customer_party_id ?? null,
            customer_mask_code: row.customer_mask_code ?? null,
            customer_name: row.customer_name ?? null,
            model_name: row.model_name ?? null,
            size: row.size ?? null,
            color: row.color ?? null,
            material_code: row.material_code ?? null,
            status: row.status ?? null,
            is_plated: row.is_plated ?? null,
            plating_color_code: row.plating_color_code ?? null,
            memo: row.memo ?? null,
            match_score: null,
            score_detail_json: null,
          }));
        };

        nextCandidates = await buildFallbackCandidates({ model_name: modelName, customer_factory_code: customerCode });
        if (nextCandidates.length === 0 && modelName && customerCode) {
          nextCandidates = await buildFallbackCandidates({ model_name: modelName, customer_factory_code: "" });
        }
      }

      if (nextCandidates.length === 0) {
        toast.error("매칭 후보가 없습니다.");
      }
      setSuggestions(nextCandidates);
      setSelectedCandidate(null);
      setConfirmResult(null);
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleSuggestOrdersInput(modelName: string, customerCode: string) {
    const queryText = [modelName, customerCode].filter((value) => value.trim().length > 0).join(" ").trim();
    if (!queryText) {
      setSuggestions([]);
      setSelectedCandidate(null);
      setSuggestDebugState({ query: "", count: 0 });
      return;
    }
    if (debugSuggest) {
      console.log("[suggest-debug] orders", { queryText, modelName, customerCode });
    }
    setIsSuggesting(true);
    try {
      const params = new URLSearchParams();
      params.set("q", queryText);
      params.set("limit", "20");
      const res = await fetch(`/api/order-lookup?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("주문 검색 실패", { description: json?.error ?? "" });
        return;
      }
      const rows = (json?.data ?? []) as Array<{
        order_no?: string | null;
        order_line_id?: string | null;
        client_id?: string | null;
        client_name?: string | null;
        client_code?: string | null;
        model_no?: string | null;
        color?: string | null;
        material_code?: string | null;
        status?: string | null;
        plating_status?: boolean | null;
        plating_color?: string | null;
      }>;
      const candidates: MatchCandidate[] = rows.map((row) => ({
        order_no: row.order_no ?? null,
        order_line_id: row.order_line_id ?? null,
        customer_party_id: row.client_id ?? null,
        customer_mask_code: row.client_code ?? null,
        customer_name: row.client_name ?? null,
        model_name: row.model_no ?? null,
        size: null,
        color: row.color ?? null,
        material_code: row.material_code ?? null,
        status: row.status ?? null,
        is_plated: row.plating_status ?? null,
        plating_color_code: row.plating_color ?? null,
        memo: null,
        match_score: null,
        score_detail_json: null,
      }));
      setSuggestions(candidates);
      setSelectedCandidate(null);
      setConfirmResult(null);
    } finally {
      setIsSuggesting(false);
    }
  }

  function buildLocalUnlinked(
    item: ReceiptLineItemInput,
    overrides?: { modelName?: string; customerCode?: string }
  ): UnlinkedLineRow {
    return {
      receipt_id: selectedReceiptId ?? null,
      receipt_line_uuid: item.receipt_line_uuid ?? null,
      customer_factory_code: overrides?.customerCode ?? item.customer_factory_code ?? null,
      model_name: overrides?.modelName ?? item.model_name ?? null,
      material_code: item.material_code ?? null,
      factory_weight_g: calcWeightTotal(item.weight_raw_g, item.weight_deduct_g),
      weight_raw_g: parseNumber(item.weight_raw_g),
      weight_deduct_g: parseNumber(item.weight_deduct_g),
      stone_center_qty: parseNumber(item.stone_center_qty),
      stone_sub1_qty: parseNumber(item.stone_sub1_qty),
      stone_sub2_qty: parseNumber(item.stone_sub2_qty),
      vendor_seq_no: parseNumber(item.vendor_seq_no),
      remark: item.remark || null,
      size: item.size || null,
      color: item.color || null,
    };
  }

  useEffect(() => {
    if (!selectedUnlinked && !selectedCandidate) {
      setSelectedWeight("");
      return;
    }
    const preferred = selectedUnlinked?.factory_weight_g ?? selectedCandidate?.effective_weight_g ?? null;
    if (preferred !== null && preferred !== undefined) {
      setSelectedWeight(String(preferred));
    }
  }, [selectedCandidate, selectedUnlinked]);

  useEffect(() => {
    if (selectedUnlinked) return;
    const first = (unlinkedQuery.data ?? [])[0] ?? null;
    if (first) {
      setSelectedUnlinked(first);
    }
  }, [selectedUnlinked, unlinkedQuery.data]);

  function isWeightInRange() {
    if (!selectedCandidate) return false;
    const weight = parseNumber(selectedWeight);
    if (weight === null) return false;
    const min = selectedCandidate.weight_min_g ?? null;
    const max = selectedCandidate.weight_max_g ?? null;
    if (min === null || max === null) return true;
    return weight >= min && weight <= max;
  }

  async function handleConfirm() {
    if (!selectedReceiptId || !selectedUnlinked || !selectedCandidate) return;
    if (headerNeedsSave) {
      triggerHeaderSaveNudge();
      toast.error("먼저 헤더 저장을 진행해 주세요.");
      return;
    }
    const receiptLineUuid = getReceiptLineUuid(selectedUnlinked);
    const orderLineId = selectedCandidate.order_line_id;
    if (!receiptLineUuid || !orderLineId) {
      toast.error("확정에 필요한 정보가 없습니다");
      return;
    }
    const materialCode = selectedUnlinked.material_code ?? null;
    let weight = parseNumber(selectedWeight);
    if (weight === null && materialCode === "00") {
      weight = 0;
    }
    if (weight === null && materialCode !== "00") {
      toast.error("중량을 입력하세요");
      return;
    }
    if (weight !== null && materialCode !== "00" && !isWeightInRange()) {
      toast.error("허용 범위를 벗어난 중량입니다");
      return;
    }

    await matchConfirm.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_receipt_line_uuid: receiptLineUuid,
      p_order_line_id: orderLineId,
      p_selected_weight_g: weight,
      p_selected_material_code: materialCode,
      p_selected_factory_labor_basic_cost_krw: null,
      p_selected_factory_labor_other_cost_krw: null,
      p_selected_factory_total_cost_krw: null,
      p_actor_person_id: null,
      p_note: confirmNote || null,
    });
  }

  const busy =
    receiptsQuery.isLoading ||
    lineItemsQuery.isLoading ||
    upsertSnapshot.isPending ||
    headerUpdate.isPending ||
    matchConfirm.isPending ||
    factoryStatementUpsert.isPending ||
    isSuggesting;

  const isMatchFocusMode = activeTab === "match" && isMatchPanelExpanded;
  const isWorkbenchExpanded = isPreviewExpanded;

  const setMatchPanelExpandedSafely = useCallback(
    (value: boolean) => {
      if (value) {
        matchExpandHeightRef.current = matchExpandRef.current?.offsetHeight ?? null;
        setMatchPanelMinHeight(matchExpandHeightRef.current);
      } else {
        setMatchPanelMinHeight(null);
      }
      setIsMatchPanelExpanded(value);
    },
    []
  );

  useLayoutEffect(() => {
    if (!isMatchPanelExpanded) return;
    if (matchPanelMinHeight !== null) return;
    const height = matchExpandRef.current?.offsetHeight ?? null;
    if (height !== null) setMatchPanelMinHeight(height);
  }, [isMatchPanelExpanded, matchPanelMinHeight]);

  useEffect(() => {
    if (activeTab !== "match") setMatchPanelExpandedSafely(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isMatchPanelExpanded) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (matchExpandRef.current?.contains(target)) return;
      setMatchPanelExpandedSafely(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isMatchPanelExpanded]);

  const reconcileStatus = useMemo(() => {
    if (!reconcileIssueCounts) {
      return { label: "미확인", tone: "neutral" as const };
    }
    if (reconcileIssueCounts.error > 0) {
      return { label: "ERROR", tone: "danger" as const };
    }
    if (reconcileIssueCounts.warn > 0) {
      return { label: "WARN", tone: "warning" as const };
    }
    return { label: "OK", tone: "active" as const };
  }, [reconcileIssueCounts]);

  const reconcileLink = vendorPartyId
    ? `/ap/reconcile?vendor_party_id=${encodeURIComponent(vendorPartyId)}&status=OPEN,ACKED`
    : "/ap/reconcile";

  const previewImageClass = isPreviewExpanded ? "max-h-[70vh]" : "max-h-[55vh]";
  const previewFrameClass = isPreviewExpanded ? "h-[70vh]" : "h-[55vh]";

  return (
    <div className="mx-auto max-w-[1900px] space-y-6 px-4 pb-10 pt-4 md:px-6">
      <div className="rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        <ActionBar
          title="NEW 영수증/매칭 워크벤치"
          subtitle="영수증 업로드부터 라인 입력, 매칭 확정까지 한 화면에서 처리합니다."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => receiptsQuery.refetch()} disabled={busy}>
                새로고침
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)} disabled={busy}>
                영수증 업로드
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className={cn("space-y-4", isWorkbenchExpanded ? "lg:hidden" : "lg:col-span-3")}>
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="text-sm font-semibold">영수증 필터</div>
            </CardHeader>
            <CardBody className="space-y-3 p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">상태</label>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">미매칭</label>
                <Select value={unlinkedOnly ? "only" : "all"} onChange={(e) => setUnlinkedOnly(e.target.value === "only")}
                >
                  <option value="only">미매칭만</option>
                  <option value="all">전체</option>
                </Select>
              </div>

              <SearchSelect
                label="공장"
                placeholder="검색 (* 입력 시 전체)"
                options={[{ label: "전체", value: "" }, ...vendorOptions]}
                value={vendorFilter}
                onChange={(value) => setVendorFilter(value)}
                showResultsOnEmptyQuery={false}
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">시작일</label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">종료일</label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter(DEFAULT_STATUS_FILTER);
                  setVendorFilter("");
                  setFromDate(getDefaultRangeDateByMonths(DEFAULT_RANGE_MONTHS));
                  setToDate(getDefaultRangeDateByMonths(0));
                  setUnlinkedOnly(true);
                  setLimit(50);
                }}
              >
                필터 초기화
              </Button>
            </CardBody>
          </Card>

          <Card className="flex-1 border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">영수증 목록</div>
                <span className="text-xs text-[var(--muted)]">{receipts.length}건</span>
              </div>
            </CardHeader>
            <CardBody className="max-h-[calc(100vh-340px)] overflow-y-auto p-2">
              {receiptsQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={`receipt-skel-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <div className="mt-2 flex gap-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : receipts.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] text-sm text-[var(--muted)]">
                  조회 결과가 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {receipts.map((row) => {
                    const isSelected = row.receipt_id === selectedReceiptId;
                    return (
                      <button
                        key={row.receipt_id}
                        type="button"
                        onClick={() => handleSelectReceipt(row)}
                        onDoubleClick={() => {
                          handleSelectReceipt(row);
                          setIsPreviewExpanded(true);
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3 py-3 text-left transition-all",
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-transparent bg-[var(--panel)] hover:border-[var(--panel-border)]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                              {row.bill_no || row.receipt_id.slice(0, 8)}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              {formatYmd(row.received_at)} · {row.vendor_name ?? "거래처 미지정"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                              {row.status ?? "-"}
                            </Badge>
                            <div className="text-xs tabular-nums text-[var(--muted)]">
                              <NumberText value={row.pricing_total_amount_krw ?? row.pricing_total_amount} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
            {receipts.length >= limit && !receiptsQuery.isLoading ? (
              <div className="border-t border-[var(--panel-border)] px-3 py-2">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setLimit((prev) => prev + 50)}>
                  더보기
                </Button>
              </div>
            ) : null}
          </Card>
        </div>

        <div className={cn("space-y-4", "lg:col-span-6")}>
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">라인 입력 (1행 요약 + 상세 펼침)</div>
                  {isWorkbenchExpanded ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setIsPreviewExpanded(false);
                        setMatchPanelExpandedSafely(false);
                      }}
                    >
                      목록 열기
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {apSyncStatus === "error" ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="warning" className="h-6 px-2 text-[10px]">
                        AP 동기화 실패
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={retryEnsureAp}
                        disabled={!selectedReceiptId || ensureApFromReceipt.isPending}
                      >
                        재시도
                      </Button>
                    </div>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={addLine} disabled={!selectedReceiptId}>
                    + 라인 추가
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveLines}
                    disabled={!selectedReceiptId || upsertSnapshot.isPending || headerNeedsSave}
                  >
                    라인 저장
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 p-4">
              {lineItemsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Skeleton key={`line-skel-${idx}`} className="h-10 w-full" />
                  ))}
                </div>
              ) : lineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--muted)]">
                  라인을 추가해 주세요.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>표시 중 {lineItems.length}건</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setLineLimit((prev) => prev + 50)}
                      disabled={lineItemsQuery.isFetching}
                    >
                      더보기
                    </Button>
                  </div>
                  <div className="overflow-x-hidden rounded-lg border border-[var(--panel-border)]">
                    <table className="w-full table-fixed text-[10px]">
                      <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
                        <tr>
                          <th className="px-1.5 py-2 text-left w-[44px]">번호</th>
                          <th className="px-1.5 py-2 text-left w-[60px]">고객코드</th>
                          <th className="px-1.5 py-2 text-left w-[200px]">모델명*</th>
                          <th className="px-1.5 py-2 text-left w-[56px]">소재*</th>
                          <th className="px-1.5 py-2 text-left w-[60px]">색상</th>
                          <th className="px-1.5 py-2 text-right w-[72px]">총중량</th>
                          <th className="px-1.5 py-2 text-right w-[80px]">총공임</th>
                          <th className="px-1.5 py-2 text-right w-[96px]">총합(저장)</th>
                          <th className="px-1.5 py-2 text-left w-[110px]">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLineItems.map((item) => {
                          const weightTotal = calcWeightTotal(item.weight_raw_g, item.weight_deduct_g);
                          const laborBasic = parseNumber(item.labor_basic_cost_krw) ?? 0;
                          const laborOther = parseNumber(item.labor_other_cost_krw) ?? 0;
                          const stoneFactoryCost = calcStoneFactoryCost(item);
                          const factoryTotalCost = laborBasic + laborOther + stoneFactoryCost;
                          const totalAmount = parseNumber(item.total_amount_krw) ?? factoryTotalCost;
                          const isExpanded = expandedLineId === item.line_uuid;
                          const seqValue = parseNumber(item.vendor_seq_no);
                          const isSeqDuplicate = seqValue !== null && duplicateSeqSet.has(seqValue);
                          const lockRow = item.receipt_line_uuid ? lockedLineMap.get(item.receipt_line_uuid) : null;
                          const lockStatus = lockRow?.shipment_status ?? null;
                          const isLocked = Boolean(lockRow);
                          const isDraftLock = lockStatus === "DRAFT";
                          const isConfirmedLock = lockStatus === "CONFIRMED";
                          const inputDisabled = isLocked;
                          const lockBadgeLabel = isDraftLock
                            ? "매칭확정(출고대기)"
                            : isConfirmedLock
                              ? "출고확정(LOCK)"
                              : lockStatus ?? null;
                          const deleteTooltip = isLocked
                            ? isDraftLock
                              ? "매칭확정된 라인은 삭제할 수 없습니다. 먼저 매칭취소를 하세요."
                              : "출고확정된 라인은 삭제할 수 없습니다."
                            : undefined;
                          const seqDisplayClass = cn(
                            "flex h-9 items-center justify-end rounded-md px-2 text-[11px]",
                            isSeqDuplicate && "ring-1 ring-rose-500/70 bg-rose-500/10"
                          );

                          return (
                            <Fragment key={item.line_uuid}>
                              <tr
                                className="border-t border-[var(--panel-border)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15"
                                data-line-block={item.line_uuid}
                                onClick={() => {
                                  updateLineNumber(item.line_uuid, "qty", "1");
                                  setExpandedLineId(item.line_uuid);
                                }}
                                onDoubleClick={() => {
                                  updateLineNumber(item.line_uuid, "qty", "1");
                                  setExpandedLineId(item.line_uuid);
                                }}
                              >
                                <td className="px-2 py-1">
                                  <div className={seqDisplayClass} title={isSeqDuplicate ? "라인 번호가 중복되었습니다" : undefined}>
                                    {item.vendor_seq_no || "-"}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex h-9 items-center text-[11px]">
                                    {item.customer_factory_code || "-"}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex h-9 items-center text-xs">
                                    {item.model_name || "-"}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex h-9 items-center text-[11px]">
                                    {item.material_code || "-"}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex h-9 items-center text-[11px]">
                                    {item.color || "-"}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className={cn("flex h-9 items-center justify-end text-[11px]", AUTO_FIELD_CLASS)}>
                                    {formatNumber(weightTotal)}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className={cn("flex h-9 items-center justify-end text-[11px]", AUTO_FIELD_CLASS)}>
                                    {formatNumber(factoryTotalCost)}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex h-9 items-center justify-end text-[11px]">
                                    {formatNumber(totalAmount)}
                                  </div>
                                </td>
                                <td className="px-2 py-1">
                                  {lockBadgeLabel ? (
                                    <Badge tone={isDraftLock ? "warning" : "neutral"} className="h-6 px-2 text-[10px]">
                                      {lockBadgeLabel}
                                    </Badge>
                                  ) : (
                                    <span className="text-[var(--muted)]">-</span>
                                  )}
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr
                                  className="border-t border-[var(--panel-border)] bg-[var(--panel)]/15 text-[11px]"
                                  key={`${item.line_uuid}-detail`}
                                  data-line-block={item.line_uuid}
                                >
                                  <td colSpan={9} className="px-3 py-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[36px_110px_minmax(0,1.2fr)_78px_78px_minmax(0,1fr)]">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">번호</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.vendor_seq_no}
                                          disabled={inputDisabled}
                                          onChange={(e) => updateLine(item.line_uuid, "vendor_seq_no", e.target.value)}
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className={cn(
                                            "h-7 text-[11px] text-right",
                                            isSeqDuplicate && "ring-1 ring-rose-500/70 bg-rose-500/10 hover:ring-2 hover:ring-rose-500/80"
                                          )}
                                          title={isSeqDuplicate ? "라인 번호가 중복되었습니다" : undefined}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">고객코드</label>
                                        <div className="relative">
                                          <Input
                                            value={item.customer_factory_code}
                                            disabled={inputDisabled}
                                            onChange={(e) => handleCustomerChange(item.line_uuid, e.currentTarget.value)}
                                            onInput={(e) => handleCustomerChange(item.line_uuid, e.currentTarget.value)}
                                            onKeyUp={(e) => handleCustomerChange(item.line_uuid, e.currentTarget.value)}
                                            onCompositionEnd={(e) => handleCustomerChange(item.line_uuid, e.currentTarget.value)}
                                            onBlur={(e) => {
                                              const nextId = getLineIdFromTarget(e.relatedTarget);
                                              if (nextId !== item.line_uuid) {
                                                setExpandedLineId(null);
                                                setActiveLineSuggest(null);
                                              }
                                            }}
                                            data-line-id={item.line_uuid}
                                            className="h-7 text-[11px]"
                                          />
                                          {activeLineSuggest?.lineId === item.line_uuid &&
                                          activeLineSuggest.field === "customer" &&
                                          item.customer_factory_code.trim() ? (
                                            <div
                                              className="absolute left-0 right-0 top-full mt-1 z-[9999] max-h-60 overflow-y-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-lg pointer-events-auto"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                              }}
                                              onPointerDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }}
                                            >
                                              <div className="px-2 py-1 text-xs text-[var(--muted)]">
                                                {isCustomerSuggestLoading ? "검색 중..." : "\u00A0"}
                                              </div>
                                              {customerCodeSuggest.length === 0 && !isCustomerSuggestLoading ? (
                                                <div className="px-2 py-2 text-xs text-[var(--muted)]">검색 결과 없음</div>
                                              ) : null}
                                              {customerCodeSuggest.map((option) => (
                                                <button
                                                  key={option.party_id}
                                                  type="button"
                                                  className="flex w-full items-center justify-between px-2 py-2 text-left text-[11px] hover:bg-[var(--muted)]/10"
                                                  data-line-id={item.line_uuid}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateLine(item.line_uuid, "customer_factory_code", option.mask_code);
                                                    setIsCustomerSuggestLoading(false);
                                                    setCustomerCodeSuggest([]);
                                                    setActiveLineSuggest(null);
                                                  }}
                                                >
                                                  <span>{option.mask_code}</span>
                                                  <span className="text-[10px] text-[var(--muted)]">
                                                    {option.name ? `| ${option.name}` : ""}
                                                  </span>
                                                </button>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">모델명</label>
                                        <div className="relative">
                                          <Input
                                            value={item.model_name}
                                            disabled={inputDisabled}
                                            onChange={(e) => handleModelChange(item.line_uuid, e.currentTarget.value)}
                                            onInput={(e) => handleModelChange(item.line_uuid, e.currentTarget.value)}
                                            onKeyUp={(e) => handleModelChange(item.line_uuid, e.currentTarget.value)}
                                            onCompositionEnd={(e) => handleModelChange(item.line_uuid, e.currentTarget.value)}
                                            onBlur={(e) => {
                                              const nextId = getLineIdFromTarget(e.relatedTarget);
                                              if (nextId !== item.line_uuid) {
                                                setExpandedLineId(null);
                                                setActiveLineSuggest(null);
                                              }
                                            }}
                                            data-line-id={item.line_uuid}
                                            className="h-7 text-[11px]"
                                          />
                                          {activeLineSuggest?.lineId === item.line_uuid &&
                                          activeLineSuggest.field === "model" &&
                                          item.model_name.trim() ? (
                                            <div
                                              className="absolute left-0 right-0 top-full mt-1 z-[9999] max-h-60 overflow-y-auto rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-lg pointer-events-auto"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                              }}
                                              onPointerDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }}
                                            >
                                              <div className="px-2 py-1 text-xs text-[var(--muted)]">
                                                {isModelSuggestLoading ? "검색 중..." : "\u00A0"}
                                              </div>
                                              {modelNameSuggest.length === 0 && !isModelSuggestLoading ? (
                                                <div className="px-2 py-2 text-xs text-[var(--muted)]">검색 결과 없음</div>
                                              ) : null}
                                              {modelNameSuggest.map((option) => (
                                                <button
                                                  key={option.master_item_id}
                                                  type="button"
                                                  className="flex w-full items-center justify-between px-2 py-2 text-left text-[11px] hover:bg-[var(--muted)]/10"
                                                  data-line-id={item.line_uuid}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    suppressModelSuggestRef.current = {
                                                      lineId: item.line_uuid,
                                                      value: option.model_name,
                                                    };
                                                    updateLine(item.line_uuid, "model_name", option.model_name);
                                                    setIsModelSuggestLoading(false);
                                                    setActiveLineSuggest(null);
                                                  }}
                                                >
                                                  <span>{option.model_name}</span>
                                                </button>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">소재</label>
                                          <Select
                                            value={item.material_code}
                                            disabled={inputDisabled}
                                            onChange={(e) => updateLineMaterial(item.line_uuid, e.target.value)}
                                            onBlur={(e) => {
                                              const nextId = getLineIdFromTarget(e.relatedTarget);
                                              if (nextId !== item.line_uuid) setExpandedLineId(null);
                                            }}
                                            data-line-id={item.line_uuid}
                                            className="h-7 px-2 py-1 text-[11px] leading-4"
                                          >
                                          <option value="">선택</option>
                                          {MATERIAL_OPTIONS.map((code) => (
                                            <option key={code} value={code}>
                                              {code}
                                            </option>
                                          ))}
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">색상</label>
                                          <Select
                                            value={item.color}
                                            disabled={inputDisabled}
                                            onChange={(e) => updateLine(item.line_uuid, "color", e.target.value)}
                                            onBlur={(e) => {
                                              const nextId = getLineIdFromTarget(e.relatedTarget);
                                              if (nextId !== item.line_uuid) setExpandedLineId(null);
                                            }}
                                            data-line-id={item.line_uuid}
                                            className="h-7 px-2 py-1 text-[11px] leading-4"
                                          >
                                          <option value="">선택</option>
                                          <option value="P">P</option>
                                          <option value="W">W</option>
                                          <option value="G">G</option>
                                          <option value="PW">PW</option>
                                          <option value="PG">PG</option>
                                          <option value="WG">WG</option>
                                          <option value="PWG">PWG</option>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">비고</label>
                                        <Input
                                          value={item.remark}
                                          disabled={inputDisabled}
                                          onChange={(e) => updateLine(item.line_uuid, "remark", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-7 text-[11px]"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[36px_minmax(0,0.9fr)_70px_70px_110px_110px_110px]">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">수량</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value="1"
                                          disabled
                                          readOnly
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">고객명</label>
                                        <Input
                                          value={item.customer_factory_code.trim() ? customerNameMap[item.customer_factory_code.trim()] ?? "매칭되는 고객 없음" : ""}
                                          readOnly
                                          className={`h-8 text-[11px] ${AUTO_FIELD_CLASS}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중량</label>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={item.weight_raw_g}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumber(item.line_uuid, "weight_raw_g", e.target.value, { format: false })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">차감중량</label>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={item.weight_deduct_g}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumber(item.line_uuid, "weight_deduct_g", e.target.value, { format: false })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">기본공임</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.labor_basic_cost_krw}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(item.line_uuid, "labor_basic_cost_krw", e.target.value, {
                                              format: false,
                                            })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">알공임</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={stoneFactoryCost}
                                          readOnly
                                          className={`h-8 text-[11px] text-right ${AUTO_FIELD_CLASS}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">기타공임</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.labor_other_cost_krw}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(item.line_uuid, "labor_other_cost_krw", e.target.value, {
                                              format: false,
                                            })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[46px_110px_46px_110px_46px_110px_110px_172px]">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중심 개수</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_center_qty}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(item.line_uuid, "stone_center_qty", e.target.value, {
                                              format: false,
                                            })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중심석 원가</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_center_unit_cost_krw}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(
                                              item.line_uuid,
                                              "stone_center_unit_cost_krw",
                                              e.target.value,
                                              { format: false }
                                            )
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">1 개수</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_sub1_qty}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(item.line_uuid, "stone_sub1_qty", e.target.value, {
                                              format: false,
                                            })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조1석 원가</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_sub1_unit_cost_krw}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(
                                              item.line_uuid,
                                              "stone_sub1_unit_cost_krw",
                                              e.target.value,
                                              { format: false }
                                            )
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">2 개수</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_sub2_qty}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(item.line_uuid, "stone_sub2_qty", e.target.value, {
                                              format: false,
                                            })
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조2석 원가</label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.stone_sub2_unit_cost_krw}
                                          disabled={inputDisabled}
                                          onChange={(e) =>
                                            updateLineNumberAndResetTotal(
                                              item.line_uuid,
                                              "stone_sub2_unit_cost_krw",
                                              e.target.value,
                                              { format: false }
                                            )
                                          }
                                          autoFormat={false}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">총중량</label>
                                        <Input
                                          inputMode="decimal"
                                          value={weightTotal}
                                          readOnly
                                          className={`h-8 text-[11px] text-right ${AUTO_FIELD_CLASS}`}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">총공임</label>
                                        <Input
                                          inputMode="numeric"
                                          value={factoryTotalCost}
                                          readOnly
                                          className={`h-8 text-[11px] text-right ${AUTO_FIELD_CLASS}`}
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {isLocked ? (
                                        <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)]/60 p-2 text-[11px] text-[var(--muted)]">
                                          {isDraftLock
                                            ? "수정/삭제하려면 ‘확정/출고대기’ 탭에서 매칭취소 후 진행하세요."
                                            : "출고확정 이후에는 수정/삭제할 수 없습니다. 정정 영수증으로 처리하세요."}
                                        </div>
                                      ) : null}
                                      <div className="flex justify-end">
                                        <span className="inline-flex" title={deleteTooltip}>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openDeleteModal(item)}
                                            disabled={receiptLineDelete.isPending || isLocked}
                                            data-line-id={item.line_uuid}
                                          >
                                            삭제
                                          </Button>
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-[72px_minmax(0,1.2fr)_minmax(0,1.2fr)_repeat(4,minmax(0,1fr))] gap-2 text-xs text-[var(--muted)]">
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-2 py-2 text-center">
                      총수량
                      <div className="mt-0.5 font-semibold text-[var(--foreground)]">{lineTotals.qty}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">환산전 중량</div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--foreground)]">
                          금 <NumberText value={lineMetalTotals.rawGold} />
                        </span>
                        <span className="font-semibold text-[var(--foreground)]">
                          은 <NumberText value={lineMetalTotals.rawSilver} />
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">환산후 중량</div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[var(--foreground)]">
                          금 <NumberText value={lineMetalTotals.convertedGold} />
                        </span>
                        <span className="font-semibold text-[var(--foreground)]">
                          은 <NumberText value={lineMetalTotals.convertedSilver} />
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      공임(기본)
                      <div className="mt-0.5 font-semibold text-[var(--foreground)]">
                        <NumberText value={lineTotals.laborBasic} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      알공임
                      <div className="mt-0.5 font-semibold text-[var(--foreground)]">
                        <NumberText value={lineTotals.stoneLabor} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      공임(기타)
                      <div className="mt-0.5 font-semibold text-[var(--foreground)]">
                        <NumberText value={lineTotals.laborOther} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      합계
                      <div className="mt-0.5 font-semibold text-[var(--foreground)]">
                        <NumberText value={lineTotals.totalAmount} />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden transition-all duration-300 max-h-[1800px] opacity-100">
                    <Card className="border-none shadow-sm ring-1 ring-black/5">
                    <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold">공장 영수증 하단 4행</div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">기준일</label>
                            <Input
                              type="date"
                              value={factoryRefDate}
                              onChange={(e) => setFactoryRefDate(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={saveFactoryStatement}
                          disabled={!selectedReceiptId || factoryStatementUpsert.isPending || headerNeedsSave}
                        >
                          저장
                        </Button>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4 p-4">
                      {!selectedReceiptId ? (
                        <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 p-4 text-center text-sm text-[var(--muted)]">
                          영수증을 선택하세요.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {factoryRows.map((row) => (
                            <div key={row.rowCode} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
                                <div className="text-sm font-semibold text-[var(--foreground)]">{row.label}</div>
                                <div className="space-y-0.5">
                                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">금</label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.gold.value}
                                      onChange={(e) =>
                                        updateFactoryMetal(row.rowCode, "gold", { value: e.target.value })
                                      }
                                      autoFormat={false}
                                      className="h-7 text-sm text-right"
                                    />
                                    <span className="text-xs text-[var(--muted)]">g</span>
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">은</label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.silver.value}
                                      onChange={(e) =>
                                        updateFactoryMetal(row.rowCode, "silver", { value: e.target.value })
                                      }
                                      autoFormat={false}
                                      className="h-7 text-sm text-right"
                                    />
                                    <span className="text-xs text-[var(--muted)]">g</span>
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">공임현금</label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.laborKrw}
                                    onChange={(e) => updateFactoryRow(row.rowCode, { laborKrw: e.target.value })}
                                    autoFormat={false}
                                    className="h-7 text-sm text-right"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">행 메모</label>
                                  <Input
                                    placeholder="선택"
                                    value={row.note}
                                    onChange={(e) => updateFactoryRow(row.rowCode, { note: e.target.value })}
                                    className="h-7 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <Textarea
                            placeholder="정산 메모 (선택)"
                            value={factoryNote}
                            onChange={(e) => setFactoryNote(e.target.value)}
                            className="min-h-[90px] text-sm"
                          />
                          <div className="text-xs text-[var(--muted)]">g 입력은 자동으로 돈 기준(1 don = 3.75g)으로 기록됩니다.</div>
                        </div>
                      )}
                    </CardBody>
                    </Card>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className={cn("space-y-4", isWorkbenchExpanded ? "lg:col-span-6" : "lg:col-span-3")}>
          <Card className="border-none shadow-sm ring-1 ring-black/5 lg:sticky lg:top-20 h-fit">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">영수증 미리보기</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={headerNeedsSave ? "primary" : "secondary"}
                    onClick={saveHeader}
                    disabled={!selectedReceiptId || headerUpdate.isPending}
                    className={cn(
                      headerNeedsSave && "ring-2 ring-[var(--primary)]/30 shadow-[0_0_0_4px_rgba(37,99,235,0.15)]",
                      headerSaveNudge && "animate-pulse"
                    )}
                  >
                    헤더 저장
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4 p-4">
              {!selectedReceiptId ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--muted)]">
                  영수증을 선택하세요.
                </div>
              ) : (
                <div className={cn(isPreviewExpanded ? "space-y-3" : "space-y-4")}>
                  <div
                    className={cn(
                      "grid gap-3",
                      isPreviewExpanded ? "grid-cols-1 lg:grid-cols-4 items-end" : "grid-cols-1"
                    )}
                  >
                    <SearchSelect
                      label="공장"
                      placeholder="검색"
                      options={vendorOptions}
                      value={vendorPartyId}
                      onChange={(value) => {
                        setVendorPartyId(value);
                        setBillNoTouched(false);
                        setAutoBillNo(null);
                        setBillNoAutoEligible(true);
                        lastBillNoSuggestKey.current = null;
                      }}
                      showResultsOnEmptyQuery={false}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증 일자</label>
                      <Input
                        type="date"
                        value={billDate}
                        onChange={(e) => {
                          setBillDate(e.target.value);
                          setBillNoTouched(false);
                          setAutoBillNo(null);
                          setBillNoAutoEligible(true);
                          lastBillNoSuggestKey.current = null;
                        }}
                        onBlur={() => setBillNoSuggestNonce((prev) => prev + 1)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</label>
                      <Input placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증 번호</label>
                      <Input
                        placeholder="예: 20260203_FAC_1"
                        value={billNo}
                        onChange={(e) => {
                          setBillNo(e.target.value);
                          setBillNoTouched(true);
                          setAutoBillNo(null);
                          setBillNoAutoEligible(false);
                        }}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                    {isPreviewLoading ? (
                      <div className="flex h-52 items-center justify-center text-sm text-[var(--muted)]">로딩 중...</div>
                    ) : previewBlobUrl ? (
                      <div className="bg-[var(--surface)]">
                        {previewMime?.startsWith("image/") ? (
                          <img src={previewBlobUrl} alt="Receipt Preview" className={`${previewImageClass} w-full object-contain`} />
                        ) : previewMime === "application/pdf" ? (
                          <iframe src={previewBlobUrl} className={`${previewFrameClass} w-full`} title="Receipt PDF Preview" />
                        ) : (
                          <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
                            미리보기를 표시할 수 없습니다
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
                        미리보기를 불러올 수 없습니다
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <div>
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">정합 상태</div>
                <Badge tone={reconcileStatus.tone} className="h-6 px-2 text-[10px]">
                  {reconcileStatus.label}
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-2 p-4">
              <div className="text-xs text-[var(--muted)]">
                오류 {reconcileIssueCounts?.error ?? "-"} · 경고 {reconcileIssueCounts?.warn ?? "-"}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.location.href = reconcileLink;
                }}
              >
                정합 큐 열기
              </Button>
              {apSyncStatus === "error" && apSyncMessage ? (
                <div className="text-[11px] text-[var(--danger)]">AP 동기화 실패: {apSyncMessage}</div>
              ) : null}
            </CardBody>
          </Card>
          </div>

          <Card className="border-none shadow-sm ring-1 ring-black/5 overflow-visible">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {[
                    { key: "match", label: "매칭" },
                    { key: "confirmed", label: "확정/출고대기" },
                    { key: "reconcile", label: "정합성" },
                    { key: "integrity", label: "링크오류" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key as typeof activeTab)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        activeTab === tab.key
                          ? "border-[var(--primary)] bg-[var(--chip)] text-[var(--primary)]"
                          : "border-[var(--panel-border)] text-[var(--muted)]"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {activeTab === "match" ? (
                  <Button
                    size="sm"
                    variant={isMatchPanelExpanded ? "primary" : "secondary"}
                    onClick={() => setMatchPanelExpandedSafely(!isMatchPanelExpanded)}
                  >
                    {isMatchPanelExpanded ? "축소" : "확장"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardBody className="p-4 space-y-4 relative overflow-visible">
              {activeTab === "match" && (
                <div style={{ minHeight: matchPanelMinHeight ?? undefined }}>
                  <div
                    ref={matchExpandRef}
                    className={cn(
                      "space-y-4 transition-all duration-300 lg:relative",
                      isMatchFocusMode
                        ? "lg:absolute lg:right-0 lg:top-0 lg:z-30 lg:w-[220%] rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)]"
                        : ""
                    )}
                    onClick={() => {
                      if (!isMatchPanelExpanded) setMatchPanelExpandedSafely(true);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                  >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">미매칭 라인</div>
                        <span className="text-[10px] text-[var(--muted)]">(클릭 시 확장 · 외부 클릭 시 축소)</span>
                      </div>
                      <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                        {unlinkedQuery.data?.length ?? 0}건
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        "mt-2 max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-2 transition-all duration-300",
                        isMatchFocusMode ? "lg:max-h-[520px]" : ""
                      )}
                    >
                      {unlinkedQuery.isLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (unlinkedQuery.data ?? []).length === 0 ? (
                        <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                          미매칭 라인이 없습니다.
                        </div>
                      ) : (
                        (unlinkedQuery.data ?? []).map((line, idx) => {
                          const uuid = getReceiptLineUuid(line) || `${idx}`;
                          const isSelected = selectedUnlinked && getReceiptLineUuid(selectedUnlinked) === getReceiptLineUuid(line);
                          const customerCode = line.customer_factory_code?.trim() ?? "";
                          const customerName = customerCode
                            ? customerNameMap[customerCode] ?? "매칭되는 고객 없음"
                            : "-";
                          const weightValue = line.factory_weight_g ?? line.weight_raw_g ?? null;
                          const weightLabel =
                            weightValue === null || weightValue === undefined ? "-" : `${formatNumber(weightValue)}g`;
                          const deductLabel =
                            line.weight_deduct_g === null || line.weight_deduct_g === undefined
                              ? "-"
                              : `${formatNumber(line.weight_deduct_g)}g`;
                          return (
                            <button
                              key={uuid}
                              type="button"
                              onClick={() => {
                                setSelectedUnlinked(line);
                                setSelectedCandidate(null);
                                setSuggestions([]);
                                setConfirmResult(null);
                              }}
                              className={cn(
                                "w-full rounded-lg border px-3 py-2 text-left text-xs",
                                isSelected
                                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                                  : "border-[var(--panel-border)] bg-[var(--panel)]"
                              )}
                            >
                              <div className="font-semibold text-[var(--foreground)]">
                                {formatNumber(line.vendor_seq_no)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line.model_name ?? "-"}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line.material_code ?? "-"}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line.color ?? "-"}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line.size ?? "-"}
                              </div>
                              <div className="mt-1 text-[var(--muted)]">
                                {customerCode || "-"}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{customerName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{weightLabel}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{deductLabel}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatNumber(line.stone_center_qty)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatNumber(line.stone_sub1_qty)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{formatNumber(line.stone_sub2_qty)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line.remark ?? "-"}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setUnlinkedLimit((prev) => prev + 50)}
                        disabled={unlinkedQuery.isFetching}
                      >
                        미매칭 더보기
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs">
                    <div className="text-sm font-semibold">선택 라인</div>
                    {selectedUnlinked ? (
                      (() => {
                        const customerCode = selectedUnlinked.customer_factory_code?.trim() ?? "";
                        const customerName = customerCode
                          ? customerNameMap[customerCode] ?? "매칭되는 고객 없음"
                          : "-";
                        const weightValue = selectedUnlinked.factory_weight_g ?? selectedUnlinked.weight_raw_g ?? null;
                        const weightLabel =
                          weightValue === null || weightValue === undefined ? "-" : `${formatNumber(weightValue)}g`;
                        const deductLabel =
                          selectedUnlinked.weight_deduct_g === null || selectedUnlinked.weight_deduct_g === undefined
                            ? "-"
                            : `${formatNumber(selectedUnlinked.weight_deduct_g)}g`;

                        return (
                          <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                            <div className="grid grid-cols-[160px_1fr]">
                              <span className="font-semibold text-[var(--foreground)]">모델명</span>
                              <span>{selectedUnlinked.model_name ?? "-"}</span>
                            </div>
                            <div className="grid grid-cols-[160px_1fr]">
                              <span className="font-semibold text-[var(--foreground)]">소재/색상/사이즈</span>
                              <span>
                                {selectedUnlinked.material_code ?? "-"}&nbsp;&nbsp;&nbsp;{selectedUnlinked.color ?? "-"}&nbsp;&nbsp;&nbsp;{selectedUnlinked.size ?? "-"}
                              </span>
                            </div>
                            <div className="grid grid-cols-[160px_1fr]">
                              <span className="font-semibold text-[var(--foreground)]">도금여부/도금색상/비고</span>
                              <span>-&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;&nbsp;{selectedUnlinked.remark ?? "-"}</span>
                            </div>
                            <div className="grid grid-cols-[160px_1fr]">
                              <span className="font-semibold text-[var(--foreground)]">거래처</span>
                              <span>{customerCode || "-"}&nbsp;&nbsp;&nbsp;{customerName}</span>
                            </div>
                            <div className="grid grid-cols-[160px_1fr]">
                              <span className="font-semibold text-[var(--foreground)]">중심/보조1/보조2</span>
                              <span>
                                {formatNumber(selectedUnlinked.stone_center_qty)}&nbsp;&nbsp;&nbsp;{formatNumber(selectedUnlinked.stone_sub1_qty)}&nbsp;&nbsp;&nbsp;{formatNumber(selectedUnlinked.stone_sub2_qty)}
                              </span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="mt-2 text-[var(--muted)]">라인을 선택하세요.</div>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleSuggest();
                    }}
                    disabled={!selectedUnlinked || isSuggesting}
                  >
                    매칭 제안
                  </Button>
                  {debugSuggest && suggestDebugState ? (
                    <div className="text-[10px] text-[var(--muted)]">
                      검색어: {suggestDebugState.query || "-"} · 결과: {suggestDebugState.count}
                    </div>
                  ) : null}
                  <div className="text-[10px] text-[var(--muted)]">
                    선택 라인: {selectedUnlinked?.receipt_line_uuid ?? "없음"}
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">추천 후보</div>
                      {(() => {
                        const baseCustomerCode = selectedUnlinked?.customer_factory_code?.trim() ?? "";
                        const baseCustomerName = baseCustomerCode
                          ? customerNameMap[baseCustomerCode] ?? "매칭되는 고객 없음"
                          : "-";
                          const baseLine = selectedUnlinked
                            ? {
                              modelName: selectedUnlinked.model_name ?? "-",
                              material: selectedUnlinked.material_code ?? "-",
                              color: selectedUnlinked.color ?? "-",
                              size: selectedUnlinked.size ?? "-",
                              plated: "N",
                              platingColor: "-",
                              memo: selectedUnlinked.remark ?? "-",
                              customerCode: baseCustomerCode || "-",
                              customerName: baseCustomerName,
                              stoneCenter: formatNumber(selectedUnlinked.stone_center_qty),
                              stoneSub1: formatNumber(selectedUnlinked.stone_sub1_qty),
                              stoneSub2: formatNumber(selectedUnlinked.stone_sub2_qty),
                            }
                            : null;

                        const diffClass = (value: string, base?: string | null) =>
                          baseLine && base !== undefined && base !== null && value !== base
                            ? "bg-amber-500/10 text-[var(--foreground)]"
                            : "";

                        return (
                          <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]">
                            <table className="w-full text-xs">
                              <thead className="bg-[var(--panel)]/70 text-[var(--muted)]">
                                <tr>
                                  <th className="px-2 py-2 text-left w-[56px]">구분</th>
                                  <th className="px-2 py-2 text-left">모델명</th>
                                  <th className="px-2 py-2 text-left">소재</th>
                                  <th className="px-2 py-2 text-left">색상</th>
                                  <th className="px-2 py-2 text-left">사이즈</th>
                                  <th className="px-2 py-2 text-left">도금</th>
                                  <th className="px-2 py-2 text-left">도금색상</th>
                                  <th className="px-2 py-2 text-left">거래처코드</th>
                                  <th className="px-2 py-2 text-left">거래처명</th>
                                  <th className="px-2 py-2 text-left">중심</th>
                                  <th className="px-2 py-2 text-left">보조1</th>
                                  <th className="px-2 py-2 text-left">보조2</th>
                                  <th className="px-2 py-2 text-right w-[96px]">점수</th>
                                  <th className="px-2 py-2 text-right w-[140px]">선택</th>
                                </tr>
                              </thead>
                              <tbody>
                                {baseLine ? (
                                  <>
                                    <tr className="border-t border-[var(--panel-border)] bg-[var(--surface)]/40 text-[var(--foreground)]">
                                      <td className="px-2 py-2 font-semibold">기준</td>
                                      <td className="px-2 py-2">{baseLine.modelName}</td>
                                      <td className="px-2 py-2">{baseLine.material}</td>
                                      <td className="px-2 py-2">{baseLine.color}</td>
                                      <td className="px-2 py-2">{baseLine.size}</td>
                                      <td className="px-2 py-2">{baseLine.plated}</td>
                                      <td className="px-2 py-2">{baseLine.platingColor}</td>
                                      <td className="px-2 py-2">{baseLine.customerCode}</td>
                                      <td className="px-2 py-2">{baseLine.customerName}</td>
                                      <td className="px-2 py-2">{baseLine.stoneCenter}</td>
                                      <td className="px-2 py-2">{baseLine.stoneSub1}</td>
                                      <td className="px-2 py-2">{baseLine.stoneSub2}</td>
                                      <td className="px-2 py-2 text-right">-</td>
                                      <td className="px-2 py-2 text-right">-</td>
                                    </tr>
                                    <tr className="border-t border-[var(--panel-border)] bg-[var(--surface)]/30">
                                      <td className="px-2 py-1 text-[var(--muted)]"> </td>
                                      <td className="px-2 py-1 text-[10px] text-[var(--muted)]" colSpan={13}>
                                        비고: {baseLine.memo}
                                      </td>
                                    </tr>
                                  </>
                                ) : null}
                                {suggestions.map((candidate, idx) => {
                                  const key = candidate.order_line_id ?? `candidate-${idx}`;
                                  const expanded = scoreOpenMap[key] ?? false;
                                  const platedLabel =
                                    candidate.is_plated === null || candidate.is_plated === undefined
                                      ? "-"
                                      : candidate.is_plated
                                        ? "Y"
                                        : "N";
                                  const stonePresence =
                                    candidate.score_detail_json &&
                                    typeof candidate.score_detail_json.stone_presence === "object" &&
                                    candidate.score_detail_json.stone_presence !== null
                                      ? (candidate.score_detail_json.stone_presence as Record<string, unknown>)
                                      : null;
                                  const centerExists =
                                    candidate.stone_center_exists ??
                                    (typeof stonePresence?.center === "boolean" ? stonePresence.center : null);
                                  const sub1Exists =
                                    candidate.stone_sub1_exists ??
                                    (typeof stonePresence?.sub1 === "boolean" ? stonePresence.sub1 : null);
                                  const sub2Exists =
                                    candidate.stone_sub2_exists ??
                                    (typeof stonePresence?.sub2 === "boolean" ? stonePresence.sub2 : null);
                                  const row = {
                                    modelName: candidate.model_name ?? "-",
                                    material: candidate.material_code ?? "-",
                                    color: candidate.color ?? "-",
                                    size: candidate.size ?? "-",
                                    plated: platedLabel,
                                    platingColor: candidate.plating_color_code ?? "-",
                                    memo: candidate.memo ?? "-",
                                    customerCode: candidate.customer_mask_code ?? "-",
                                    customerName: candidate.customer_name ?? "-",
                                    stoneCenter: centerExists === null ? "-" : centerExists ? "✓" : "-",
                                    stoneSub1: sub1Exists === null ? "-" : sub1Exists ? "✓" : "-",
                                    stoneSub2: sub2Exists === null ? "-" : sub2Exists ? "✓" : "-",
                                  };

                                  return (
                                    <Fragment key={key}>
                                      <tr className="border-t border-[var(--panel-border)]">
                                        <td className="px-2 py-2 text-[var(--muted)]">후보</td>
                                        <td className={cn("px-2 py-2", diffClass(row.modelName, baseLine?.modelName))}>{row.modelName}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.material, baseLine?.material))}>{row.material}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.color, baseLine?.color))}>{row.color}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.size, baseLine?.size))}>{row.size}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.plated, baseLine?.plated))}>{row.plated}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.platingColor, baseLine?.platingColor))}>{row.platingColor}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.customerCode, baseLine?.customerCode))}>{row.customerCode}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.customerName, baseLine?.customerName))}>{row.customerName}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.stoneCenter, baseLine?.stoneCenter))}>{row.stoneCenter}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.stoneSub1, baseLine?.stoneSub1))}>{row.stoneSub1}</td>
                                        <td className={cn("px-2 py-2", diffClass(row.stoneSub2, baseLine?.stoneSub2))}>{row.stoneSub2}</td>
                                        <td className="px-2 py-2 text-right">
                                          <Badge tone="warning" className="h-6 px-2 text-[10px] font-bold">
                                            점수 {formatNumber(candidate.match_score)}
                                          </Badge>
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                            {selectedCandidate?.order_line_id === candidate.order_line_id ? (
                                              <Badge tone="active" className="h-5 px-2 text-[10px]">
                                                선택됨
                                              </Badge>
                                            ) : null}
                                            <Button
                                              size="sm"
                                              variant={selectedCandidate?.order_line_id === candidate.order_line_id ? "primary" : "secondary"}
                                              onClick={() => {
                                                setSelectedCandidate(candidate);
                                                setConfirmResult(null);
                                              }}
                                            >
                                              선택
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                      <tr className="border-t border-[var(--panel-border)] bg-[var(--surface)]/30">
                                        <td className="px-2 py-1 text-[var(--muted)]"> </td>
                                        <td className="px-2 py-1 text-[10px] text-[var(--muted)]" colSpan={13}>
                                          비고: {row.memo}
                                        </td>
                                      </tr>
                                      <tr className="border-t border-[var(--panel-border)]">
                                        <td className="px-2 py-1 text-[var(--muted)]"> </td>
                                        <td className="px-2 py-1" colSpan={13}>
                                          <button
                                            type="button"
                                            className="text-[var(--primary)]"
                                            onClick={() => setScoreOpenMap((prev) => ({ ...prev, [key]: !expanded }))}
                                          >
                                            {expanded ? "점수 상세 닫기" : "점수 상세 보기"}
                                          </button>
                                          {expanded ? (
                                            <div className="mt-2 text-[10px] text-[var(--muted)]">
                                              {(() => {
                                                const detail = (candidate.score_detail_json ?? {}) as Record<string, unknown>;
                                                const modelDetail =
                                                  detail.model_name && typeof detail.model_name === "object"
                                                    ? (detail.model_name as Record<string, unknown>)
                                                    : null;
                                                const customerDetail =
                                                  detail.customer_factory_code && typeof detail.customer_factory_code === "object"
                                                    ? (detail.customer_factory_code as Record<string, unknown>)
                                                    : null;
                                                const memoDetail =
                                                  detail.memo_match && typeof detail.memo_match === "object"
                                                    ? (detail.memo_match as Record<string, unknown>)
                                                    : null;
                                                const scoreBreakdown =
                                                  detail.score_breakdown && typeof detail.score_breakdown === "object"
                                                    ? (detail.score_breakdown as Record<string, unknown>)
                                                    : null;
                                                const readScore = (value: unknown) =>
                                                  typeof value === "number"
                                                    ? value
                                                    : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
                                                      ? Number(value)
                                                      : 0;

                                                const scoreModel =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.model_name)
                                                    : typeof modelDetail?.exact === "boolean"
                                                      ? modelDetail.exact
                                                        ? 60
                                                        : 0
                                                      : 0;
                                                const scoreMaterial =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.material)
                                                    : typeof detail.material_code_match === "boolean"
                                                      ? detail.material_code_match
                                                        ? 15
                                                        : 0
                                                      : 0;
                                                const scoreColor =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.color)
                                                    : typeof detail.color_match === "boolean"
                                                      ? detail.color_match
                                                        ? 10
                                                        : 0
                                                      : 0;
                                                const scoreSize =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.size)
                                                    : typeof detail.size_match === "boolean"
                                                      ? detail.size_match
                                                        ? 10
                                                        : 0
                                                      : 0;
                                                const scoreMemo =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.memo)
                                                    : typeof memoDetail?.exact === "boolean"
                                                      ? memoDetail.exact
                                                        ? 10
                                                        : typeof memoDetail?.partial === "boolean" && memoDetail.partial
                                                          ? 5
                                                          : 0
                                                      : 0;
                                                const scoreCustomer =
                                                  scoreBreakdown !== null
                                                    ? readScore(scoreBreakdown.customer_factory_code)
                                                    : typeof customerDetail?.match === "boolean"
                                                      ? customerDetail.match
                                                        ? 5
                                                        : 0
                                                      : 0;
                                                const scoreTotal =
                                                  scoreModel + scoreMaterial + scoreColor + scoreSize + scoreMemo + scoreCustomer;

                                                return (
                                                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                                    <span className="font-bold text-[var(--foreground)]">점수상세</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">모델명</span>
                                                    <span>{scoreModel}점</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">소재</span>
                                                    <span>{scoreMaterial}점</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">색상</span>
                                                    <span>{scoreColor}점</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">사이즈</span>
                                                    <span>{scoreSize}점</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">비고</span>
                                                    <span>{scoreMemo}점</span>
                                                    <span>|</span>
                                                    <span className="text-[var(--foreground)]">거래처코드</span>
                                                    <span>{scoreCustomer}점</span>
                                                    <span>|</span>
                                                    <span className="font-semibold text-blue-600">합산 {scoreTotal}점</span>
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          ) : null}
                                        </td>
                                      </tr>
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  ) : !isSuggesting ? (
                    <div className="text-xs text-[var(--muted)]">매칭 후보가 없습니다.</div>
                  ) : null}

                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs space-y-2">
                    <div className="text-sm font-semibold">확정</div>
                    {!selectedCandidate ? (
                      <div className="text-[var(--muted)]">후보를 선택하세요.</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[var(--muted)]">
                          허용 범위: {formatNumber(selectedCandidate.weight_min_g)} ~ {formatNumber(selectedCandidate.weight_max_g)}g
                        </div>
                        <Input
                          type="number"
                          value={selectedWeight}
                          onChange={(e) => setSelectedWeight(e.target.value)}
                          placeholder="선택 중량(g)"
                          className="h-8 text-xs"
                        />
                        <Textarea
                          value={confirmNote}
                          onChange={(e) => setConfirmNote(e.target.value)}
                          placeholder="확정 메모 (선택)"
                          className="min-h-[64px] text-xs"
                        />
                        {(() => {
                          const weightValue = parseNumber(selectedWeight);
                          const weightInvalid = weightValue !== null && !isWeightInRange();
                          return (
                            <>
                              <Button size="sm" onClick={handleConfirm} disabled={weightInvalid || matchConfirm.isPending}>
                                확정
                              </Button>
                              {weightInvalid ? (
                                <div className="text-[var(--danger)]">허용 범위를 확인하세요.</div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {confirmResult?.shipment_id ? (
                      <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-xs">
                        <div>shipment_id: <span className="font-semibold text-[var(--foreground)]">{confirmResult.shipment_id}</span></div>
                        {selectedCandidate?.customer_party_id ? (
                          <a
                            href={`/workbench/${selectedCandidate.customer_party_id}`}
                            className="mt-2 inline-block text-[var(--primary)]"
                          >
                            거래처 작업대 열기
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
              )}

              {activeTab === "confirmed" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs text-[var(--muted)]">
                    <div>확정된 매칭 목록입니다. 출고대기(DRAFT) 상태에서만 ‘매칭취소’가 가능합니다.</div>
                    <div>출고확정/정산 진행 건은 취소할 수 없으며, 정정 영수증으로 처리합니다.</div>
                  </div>
                  {matchesQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={`match-skel-${idx}`} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : matchesQuery.isError ? (
                    <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                      <div>불러오기 실패</div>
                      <div className="mt-2">
                        <Button size="sm" variant="secondary" onClick={() => matchesQuery.refetch()}>
                          재시도
                        </Button>
                      </div>
                    </div>
                  ) : confirmedMatches.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                      확정된 매칭이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {confirmedMatches.map((row) => {
                        const statusLabel =
                          row.shipment_status === "DRAFT"
                            ? "출고대기"
                            : row.shipment_status === "CONFIRMED"
                              ? "출고확정"
                              : row.shipment_status ?? "기타";
                        const isCancelable = row.shipment_status === "DRAFT";
                        const cancelTooltip = isCancelable
                          ? undefined
                          : "출고확정 이후에는 취소할 수 없습니다. 정정 영수증으로 처리하세요.";
                        const weightLabel =
                          row.receipt_weight_g === null || row.receipt_weight_g === undefined
                            ? "-"
                            : `${formatNumber(row.receipt_weight_g)}g`;
                        const qtyLabel =
                          row.receipt_qty === null || row.receipt_qty === undefined
                            ? "-"
                            : `${formatNumber(row.receipt_qty)}개`;
                        return (
                          <div
                            key={`${row.receipt_line_uuid}:${row.shipment_line_id ?? ""}`}
                            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-[var(--foreground)]">
                                {row.vendor_seq_no ? `라인 ${row.vendor_seq_no}` : "라인"}
                                {row.customer_factory_code ? ` · ${row.customer_factory_code}` : ""}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge tone={row.shipment_status === "DRAFT" ? "warning" : "neutral"} className="h-6 px-2 text-[10px]">
                                  {statusLabel}
                                </Badge>
                                <span className="inline-flex" title={cancelTooltip}>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openMatchClearModal(row)}
                                    disabled={!isCancelable || matchClearMutation.isPending}
                                  >
                                    매칭취소
                                  </Button>
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-[var(--muted)]">
                              {(row.receipt_model_name ?? "-") + " · " + (row.receipt_material_code ?? "-")}
                              {row.receipt_size ? ` · ${row.receipt_size}` : ""}
                              {row.receipt_color ? ` · ${row.receipt_color}` : ""}
                              {` · ${weightLabel} · ${qtyLabel}`}
                            </div>
                            <div className="mt-1 text-[var(--muted)]">
                              고객: {row.customer_name ?? "-"} · 주문번호: {row.order_no ?? "-"}
                            </div>
                            <div className="mt-1 text-[var(--muted)]">확정일: {formatYmd(row.confirmed_at)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "reconcile" && (
                <div className="space-y-2">
                  {reconcileQuery.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (reconcileQuery.data ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                      정합성 데이터가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(reconcileQuery.data ?? []).map((row, idx) => (
                        <div key={`reconcile-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                          {Object.entries(row).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-2">
                              <span className="text-[var(--muted)]">{key}</span>
                              <span className="text-[var(--foreground)]">{String(value ?? "-")}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "integrity" && (
                <div className="space-y-2">
                  {integrityQuery.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (integrityQuery.data ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--panel-border)] p-3 text-xs text-[var(--muted)]">
                      링크 오류가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(integrityQuery.data ?? []).map((row, idx) => (
                        <div key={`integrity-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                          {Object.entries(row).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-2">
                              <span className="text-[var(--muted)]">{key}</span>
                              <span className="text-[var(--foreground)]">{String(value ?? "-")}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={matchClearOpen} onClose={closeMatchClearModal} title="매칭취소(출고대기 되돌리기)">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs text-[var(--muted)] space-y-1">
            <div>이 작업은 ‘출고대기(DRAFT)’ 상태에서만 가능합니다.</div>
            <div>취소 후에는 영수증 라인을 수정/삭제하고 다시 매칭할 수 있습니다.</div>
            <div>출고확정/정산(AR/AP/재고이동/원가확정/배분)이 진행된 건은 취소할 수 없으며, 정정 영수증으로 처리해야 합니다.</div>
          </div>

          {matchClearTarget ? (
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">대상 라인</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--foreground)]">
                  {matchClearTarget.receipt_model_name ?? "모델명 없음"}
                </span>
                <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                  {matchClearTarget.vendor_seq_no ? `라인 ${matchClearTarget.vendor_seq_no}` : "라인"}
                </Badge>
                {matchClearTarget.customer_factory_code ? (
                  <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                    {matchClearTarget.customer_factory_code}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                UUID {matchClearTarget.receipt_line_uuid.slice(0, 8)}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">사유*</label>
            <Select value={matchClearReason} onChange={(e) => setMatchClearReason(e.target.value as MatchClearReasonCode)}>
              {MATCH_CLEAR_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">사유 상세</label>
            <Input
              value={matchClearReasonText}
              onChange={(e) => setMatchClearReasonText(e.target.value)}
              placeholder="예) 공임 120,000을 1,200,000으로 잘못 입력"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</label>
            <Textarea
              value={matchClearNote}
              onChange={(e) => setMatchClearNote(e.target.value)}
              placeholder="팀 내부 공유 메모(선택)"
              className="min-h-[80px] text-xs"
            />
          </div>

          {matchClearError ? (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs">
              <div className="font-semibold text-[var(--danger)]">{matchClearError}</div>
              <div className="mt-1 text-[11px] text-[var(--danger)]">
                이 건은 원본을 수정하지 않습니다. 정정 영수증(새 영수증 업로드)로 처리해주세요.
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeMatchClearModal} disabled={matchClearMutation.isPending}>
              취소
            </Button>
            <Button onClick={confirmMatchClear} disabled={matchClearMutation.isPending || !matchClearTarget}>
              매칭취소 실행
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={closeDeleteModal} title="라인 삭제">
        <div className="space-y-4">
          {deleteTarget ? (
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">삭제 대상</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-[var(--foreground)]">
                  {deleteTarget.model_name?.trim() ? deleteTarget.model_name : "모델명 없음"}
                </span>
                <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                  수량 {formatNumber(parseNumber(deleteTarget.qty) ?? 0)}
                </Badge>
                <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                  금액 {formatNumber(parseNumber(deleteTarget.total_amount_krw) ?? 0)}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">
                UUID {deleteTarget.line_uuid ? deleteTarget.line_uuid.slice(0, 8) : "-"}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">삭제 사유*</label>
            <Select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
              <option value="입력오류">입력오류</option>
              <option value="중복라인">중복라인</option>
              <option value="공장 영수증 정정">공장 영수증 정정</option>
              <option value="테스트/샘플">테스트/샘플</option>
              <option value="기타">기타</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</label>
            <Textarea
              value={deleteNote}
              onChange={(e) => setDeleteNote(e.target.value)}
              placeholder="메모 (선택)"
              className="min-h-[80px] text-xs"
            />
          </div>

          {lineItemsDirty ? (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs">
              <div className="font-semibold text-[var(--danger)]">저장되지 않은 변경사항이 있습니다.</div>
              <div className="mt-1 text-[11px] text-[var(--danger)]">
                삭제 전에 먼저 라인 저장을 진행해 주세요.
              </div>
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={saveLines} disabled={upsertSnapshot.isPending}>
                  먼저 저장
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeDeleteModal} disabled={receiptLineDelete.isPending}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={lineItemsDirty || receiptLineDelete.isPending || !deleteReason.trim()}
            >
              삭제 확정
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="영수증 업로드">
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            onChange={handleFileChange}
            className="w-full cursor-pointer rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/40 px-4 py-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[var(--primary)]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--primary)] hover:bg-[var(--panel)]/60"
          />
          {uploadPreviewUrl ? (
            <img src={uploadPreviewUrl} alt="preview" className="max-h-56 w-full rounded-lg object-contain" />
          ) : null}
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetUpload} disabled={isUploading}>
              초기화
            </Button>
            <Button onClick={uploadReceipt} disabled={isUploading}>
              업로드
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
