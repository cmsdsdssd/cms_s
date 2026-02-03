"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
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

type ReceiptLineItemInput = {
  line_uuid: string;
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
  vendor_seq_no?: number | null;
  remark?: string | null;
};

type MatchCandidate = {
  order_line_id?: string | null;
  customer_party_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  model_name?: string | null;
  size?: string | null;
  color?: string | null;
  material_code?: string | null;
  effective_weight_g?: number | null;
  weight_min_g?: number | null;
  weight_max_g?: number | null;
  factory_po_id?: string | null;
  memo?: string | null;
  match_score?: number | null;
  score_detail_json?: Record<string, unknown> | null;
};

type ConfirmResult = {
  shipment_id?: string | null;
  shipment_line_id?: string | null;
  created_shipment_draft?: boolean | null;
};

type PartyOption = { label: string; value: string };

const MATERIAL_OPTIONS = ["14", "18", "24", "925", "999", "00"] as const;
const STONE_FIELDS = [
  "stone_center_qty",
  "stone_sub1_qty",
  "stone_sub2_qty",
  "stone_center_unit_cost_krw",
  "stone_sub1_unit_cost_krw",
  "stone_sub2_unit_cost_krw",
] as const;

type StoneField = (typeof STONE_FIELDS)[number];

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

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
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

function getDefaultRangeDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function ReceiptLineWorkbench({ initialReceiptId }: { initialReceiptId?: string | null }) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("");
  const [fromDate, setFromDate] = useState(() => getDefaultRangeDate(-45));
  const [toDate, setToDate] = useState(() => getDefaultRangeDate(0));
  const [limit, setLimit] = useState(50);
  const [lineLimit, setLineLimit] = useState(50);
  const [unlinkedLimit, setUnlinkedLimit] = useState(50);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [vendorPartyId, setVendorPartyId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [memo, setMemo] = useState("");

  const [lineItems, setLineItems] = useState<ReceiptLineItemInput[]>([]);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"match" | "reconcile" | "integrity">("match");
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

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

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
    queryKey: ["new-receipt-workbench", "receipts", statusFilter, vendorFilter, fromDate, toDate, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (vendorFilter) params.set("vendor_party_id", vendorFilter);
      if (fromDate) params.set("received_from", fromDate);
      if (toDate) params.set("received_to", toDate);

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
    },
  });

  const ensureApFromReceipt = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.ensureApFromReceipt,
  });

  const headerUpdate = useRpcMutation<void>({
    fn: "cms_fn_update_vendor_bill_header_v1",
    successMessage: "헤더 저장 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
    },
  });

  const matchConfirm = useRpcMutation<ConfirmResult>({
    fn: CONTRACTS.functions.receiptLineMatchConfirm,
    successMessage: "매칭 확정 + shipment draft 생성 완료",
    onSuccess: (result) => {
      setConfirmResult(result);
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "unlinked", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "receipts"] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "reconcile", selectedReceiptId] });
      queryClient.invalidateQueries({ queryKey: ["new-receipt-workbench", "integrity", selectedReceiptId] });
    },
  });

  const receipts = receiptsQuery.data ?? [];
  const vendorOptions = vendorOptionsQuery.data ?? [];

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach((row) => {
      if (row.status) set.add(row.status);
    });
    return ["ALL", ...Array.from(set)];
  }, [receipts]);

  const selectedReceipt = useMemo(() => {
    if (!selectedReceiptId) return null;
    return receipts.find((row) => row.receipt_id === selectedReceiptId) ?? null;
  }, [receipts, selectedReceiptId]);

  useEffect(() => {
    if (!selectedReceipt) return;
    setVendorPartyId(selectedReceipt.vendor_party_id ?? "");
    setBillNo(selectedReceipt.bill_no ?? "");
    setBillDate(selectedReceipt.issued_at ? selectedReceipt.issued_at.slice(0, 10) : "");
    setMemo(selectedReceipt.memo ?? "");
  }, [selectedReceipt]);

  useEffect(() => {
    if (!lineItemsQuery.data) return;
    if (lineItemsDirty) return;
    const mapped = lineItemsQuery.data.map((row) => {
      const lineUuid = row.line_uuid ?? row.receipt_line_uuid ?? crypto.randomUUID();
      return {
        line_uuid: lineUuid,
        customer_factory_code: row.customer_factory_code ?? "",
        model_name: row.model_name ?? "",
        material_code: row.material_code ?? "",
        qty: toInputNumber(row.qty ?? 1),
        weight_raw_g: toInputNumber(row.weight_g ?? null),
        weight_deduct_g: "",
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
        vendor_seq_no: toInputNumber(row.vendor_seq_no ?? null),
        remark: row.remark ?? "",
      };
    });
    setLineItems(mapped);
  }, [lineItemsDirty, lineItemsQuery.data]);

  useEffect(() => {
    const codes = Array.from(
      new Set(
        lineItems
          .map((item) => item.customer_factory_code.trim())
          .filter((code) => code.length > 0)
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
  }, [customerLookupState, lineItems]);

  useEffect(() => {
    if (!initialReceiptId) return;
    if (selectedReceiptId) return;
    const target = receipts.find((row) => row.receipt_id === initialReceiptId);
    if (target) {
      setSelectedReceiptId(target.receipt_id);
    }
  }, [initialReceiptId, receipts, selectedReceiptId]);

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
        await receiptsQuery.refetch();
        const refreshed = await receiptsQuery.refetch();
        const rows = refreshed.data ?? [];
        const found = rows.find((row) => row.receipt_id === receiptId);
        if (found) {
          setSelectedReceiptId(receiptId);
        }
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
    setLineItems((prev) => [
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
        vendor_seq_no: "",
        remark: "",
      },
    ]);
  }

  function removeLine(lineUuid: string) {
    setLineItemsDirty(true);
    setLineItems((prev) => prev.filter((item) => item.line_uuid !== lineUuid));
  }

  function updateLine(lineUuid: string, field: keyof ReceiptLineItemInput, value: string) {
    setLineItemsDirty(true);
    setLineItems((prev) =>
      prev.map((item) => (item.line_uuid === lineUuid ? { ...item, [field]: value } : item))
    );
  }

  function updateLineMaterial(lineUuid: string, value: string) {
    const normalized = value.trim().toUpperCase();
    updateLine(lineUuid, "material_code", normalized);
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
          totalAmount: acc.totalAmount + totalLine * qty,
        };
      },
      { qty: 0, weight: 0, laborBasic: 0, laborOther: 0, totalAmount: 0 }
    );
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

  async function saveLines() {
    if (!selectedReceiptId) {
      toast.error("영수증을 선택하세요");
      return;
    }

    const invalid = lineItems.find((item) => !item.model_name.trim() || !item.material_code.trim());
    if (invalid) {
      toast.error("모델명/소재는 필수입니다");
      return;
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

    await ensureApFromReceipt.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_note: memo || null,
    });
    setLineItemsDirty(false);
  }

  async function handleSuggest() {
    if (process.env.NODE_ENV !== "production") {
      console.log("[match-suggest] click", {
        receiptId: selectedReceiptId,
        receiptLineUuid: selectedUnlinked?.receipt_line_uuid,
      });
    }
    if (!selectedReceiptId || !selectedUnlinked) {
      toast.error("미매칭 라인을 선택하세요");
      return;
    }
    const receiptLineUuid = getReceiptLineUuid(selectedUnlinked);
    if (!receiptLineUuid) {
      toast.error("라인 UUID를 확인할 수 없습니다");
      return;
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
      const candidates = (json?.data?.candidates ?? []) as MatchCandidate[];
      const sorted = [...candidates].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
      setSuggestions(sorted);
      setSelectedCandidate(null);
      setConfirmResult(null);
    } finally {
      setIsSuggesting(false);
    }
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
    isSuggesting;

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
        <div className="lg:col-span-3 space-y-4">
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

              <SearchSelect
                label="공장"
                placeholder="검색 (* 입력 시 전체)"
                options={[{ label: "전체", value: "" }, ...vendorOptions]}
                value={vendorFilter}
                onChange={(value) => setVendorFilter(value)}
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
                  setStatusFilter("ALL");
                  setVendorFilter("");
                  setFromDate(getDefaultRangeDate(-45));
                  setToDate(getDefaultRangeDate(0));
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
                        onClick={() => setSelectedReceiptId(row.receipt_id)}
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
                              {formatNumber(row.pricing_total_amount_krw ?? row.pricing_total_amount)}
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

        <div className="lg:col-span-6 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">라인 입력 (1행 요약 + 상세 펼침)</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={addLine} disabled={!selectedReceiptId}>
                    + 라인 추가
                  </Button>
                  <Button size="sm" onClick={saveLines} disabled={!selectedReceiptId || upsertSnapshot.isPending}>
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
                    <table className="w-full table-fixed text-[11px]">
                      <thead className="bg-[var(--panel)] text-[var(--muted)] sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left w-[120px]">고객코드</th>
                          <th className="px-2 py-2 text-left w-[260px]">모델명*</th>
                          <th className="px-2 py-2 text-left w-[70px]">소재*</th>
                          <th className="px-2 py-2 text-right w-[90px]">총중량</th>
                          <th className="px-2 py-2 text-right w-[100px]">총공임</th>
                          <th className="px-2 py-2 text-right w-[110px]">총합(저장)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item) => {
                          const weightTotal = calcWeightTotal(item.weight_raw_g, item.weight_deduct_g);
                          const laborBasic = parseNumber(item.labor_basic_cost_krw) ?? 0;
                          const laborOther = parseNumber(item.labor_other_cost_krw) ?? 0;
                          const stoneFactoryCost = calcStoneFactoryCost(item);
                          const factoryTotalCost = laborBasic + laborOther + stoneFactoryCost;
                          const totalAmount = parseNumber(item.total_amount_krw) ?? factoryTotalCost;
                          const isExpanded = expandedLineId === item.line_uuid;

                          return (
                            <Fragment key={item.line_uuid}>
                              <tr
                                className="border-t border-[var(--panel-border)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15"
                                onClick={() => setExpandedLineId(item.line_uuid)}
                                onDoubleClick={() => setExpandedLineId(item.line_uuid)}
                              >
                                <td className="px-2 py-1">
                                  <Input
                                    value={item.customer_factory_code}
                                    onChange={(e) => updateLine(item.line_uuid, "customer_factory_code", e.target.value)}
                                    onFocus={() => setExpandedLineId(item.line_uuid)}
                                    onBlur={(e) => {
                                      const nextId = getLineIdFromTarget(e.relatedTarget);
                                      if (nextId !== item.line_uuid) setExpandedLineId(null);
                                    }}
                                    data-line-id={item.line_uuid}
                                    className="h-7 text-[11px]"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <Input
                                    value={item.model_name}
                                    onChange={(e) => updateLine(item.line_uuid, "model_name", e.target.value)}
                                    onFocus={() => setExpandedLineId(item.line_uuid)}
                                    onBlur={(e) => {
                                      const nextId = getLineIdFromTarget(e.relatedTarget);
                                      if (nextId !== item.line_uuid) setExpandedLineId(null);
                                    }}
                                    data-line-id={item.line_uuid}
                                    className="h-7 text-xs"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <Select
                                    value={item.material_code}
                                    onChange={(e) => updateLineMaterial(item.line_uuid, e.target.value)}
                                    onFocus={() => setExpandedLineId(item.line_uuid)}
                                    onBlur={(e) => {
                                      const nextId = getLineIdFromTarget(e.relatedTarget);
                                      if (nextId !== item.line_uuid) setExpandedLineId(null);
                                    }}
                                    data-line-id={item.line_uuid}
                                    className="h-7 text-[11px]"
                                  >
                                    <option value="">선택</option>
                                    {MATERIAL_OPTIONS.map((code) => (
                                      <option key={code} value={code}>
                                        {code}
                                      </option>
                                    ))}
                                  </Select>
                                </td>
                                <td className="px-2 py-1">
                                  <Input value={String(weightTotal)} readOnly className="h-7 text-[11px] text-right bg-[var(--panel)]" />
                                </td>
                                <td className="px-2 py-1">
                                  <Input value={String(factoryTotalCost)} readOnly className="h-7 text-[11px] text-right bg-[var(--panel)]" />
                                </td>
                                <td className="px-2 py-1">
                                  <Input
                                    type="number"
                                    value={item.total_amount_krw}
                                    onChange={(e) => updateLine(item.line_uuid, "total_amount_krw", e.target.value)}
                                    onFocus={() => setExpandedLineId(item.line_uuid)}
                                    onBlur={(e) => {
                                      const nextId = getLineIdFromTarget(e.relatedTarget);
                                      if (nextId !== item.line_uuid) setExpandedLineId(null);
                                    }}
                                    data-line-id={item.line_uuid}
                                    className="h-7 text-[11px] text-right"
                                    placeholder={String(totalAmount)}
                                  />
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="border-t border-[var(--panel-border)] bg-[var(--panel)]/15 text-[11px]" key={`${item.line_uuid}-detail`}>
                                  <td colSpan={6} className="px-3 py-3">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">고객코드</label>
                                        <Input
                                          value={item.customer_factory_code}
                                          onChange={(e) => updateLine(item.line_uuid, "customer_factory_code", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-7 text-[11px]"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">SEQ</label>
                                        <Input
                                          value={item.vendor_seq_no}
                                          onChange={(e) => updateLine(item.line_uuid, "vendor_seq_no", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-7 text-[11px]"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">고객명</label>
                                        <Input
                                          value={item.customer_factory_code.trim() ? customerNameMap[item.customer_factory_code.trim()] ?? "매칭되는 고객 없음" : ""}
                                          readOnly
                                          className="h-7 text-[11px] bg-[var(--panel)]"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중심석 개수</label>
                                        <Input
                                          type="number"
                                          value={item.stone_center_qty}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_center_qty", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중심석 단가</label>
                                        <Input
                                          type="number"
                                          value={item.stone_center_unit_cost_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_center_unit_cost_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조1석 개수</label>
                                        <Input
                                          type="number"
                                          value={item.stone_sub1_qty}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_sub1_qty", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조1석 단가</label>
                                        <Input
                                          type="number"
                                          value={item.stone_sub1_unit_cost_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_sub1_unit_cost_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조2석 개수</label>
                                        <Input
                                          type="number"
                                          value={item.stone_sub2_qty}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_sub2_qty", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">보조2석 단가</label>
                                        <Input
                                          type="number"
                                          value={item.stone_sub2_unit_cost_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "stone_sub2_unit_cost_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">수량</label>
                                        <Input
                                          type="number"
                                          value={item.qty}
                                          onChange={(e) => updateLine(item.line_uuid, "qty", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">중량</label>
                                        <Input
                                          type="number"
                                          value={item.weight_raw_g}
                                          onChange={(e) => updateLine(item.line_uuid, "weight_raw_g", e.target.value)}
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
                                          type="number"
                                          value={item.weight_deduct_g}
                                          onChange={(e) => updateLine(item.line_uuid, "weight_deduct_g", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">기본공임</label>
                                        <Input
                                          type="number"
                                          value={item.labor_basic_cost_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "labor_basic_cost_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">기타공임</label>
                                        <Input
                                          type="number"
                                          value={item.labor_other_cost_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "labor_other_cost_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">총합(저장)</label>
                                        <Input
                                          type="number"
                                          value={item.total_amount_krw}
                                          onChange={(e) => updateLine(item.line_uuid, "total_amount_krw", e.target.value)}
                                          onBlur={(e) => {
                                            const nextId = getLineIdFromTarget(e.relatedTarget);
                                            if (nextId !== item.line_uuid) setExpandedLineId(null);
                                          }}
                                          data-line-id={item.line_uuid}
                                          className="h-8 text-[11px] text-right"
                                          placeholder={String(totalAmount)}
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 space-y-1">
                                      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">비고</label>
                                      <Input
                                        value={item.remark}
                                        onChange={(e) => updateLine(item.line_uuid, "remark", e.target.value)}
                                        onBlur={(e) => {
                                          const nextId = getLineIdFromTarget(e.relatedTarget);
                                          if (nextId !== item.line_uuid) setExpandedLineId(null);
                                        }}
                                        data-line-id={item.line_uuid}
                                        className="h-8 text-[11px]"
                                      />
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => removeLine(item.line_uuid)}>
                                        삭제
                                      </Button>
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

                  <div className="grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      총 수량: <span className="font-semibold text-[var(--foreground)]">{lineTotals.qty}</span>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      총 중량: <span className="font-semibold text-[var(--foreground)]">{formatNumber(lineTotals.weight)}</span>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      공임(기본): <span className="font-semibold text-[var(--foreground)]">{formatNumber(lineTotals.laborBasic)}</span>
                    </div>
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      공임(기타): <span className="font-semibold text-[var(--foreground)]">{formatNumber(lineTotals.laborOther)}</span>
                    </div>
                    <div className="col-span-2 rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/60 px-3 py-2">
                      합계: <span className="font-semibold text-[var(--foreground)]">{formatNumber(lineTotals.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card className="border-none shadow-sm ring-1 ring-black/5 lg:sticky lg:top-20 h-fit">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">영수증 미리보기</div>
                <Button size="sm" variant="secondary" onClick={saveHeader} disabled={!selectedReceiptId || headerUpdate.isPending}>
                  헤더 저장
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4 p-4">
              {!selectedReceiptId ? (
                <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--muted)]">
                  영수증을 선택하세요.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <SearchSelect
                      label="공장"
                      placeholder="검색"
                      options={vendorOptions}
                      value={vendorPartyId}
                      onChange={(value) => setVendorPartyId(value)}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증 번호</label>
                      <Input
                        placeholder="예: 20260203_FAC_1"
                        value={billNo}
                        onChange={(e) => setBillNo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증 일자</label>
                      <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</label>
                      <Input placeholder="메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
                    {isPreviewLoading ? (
                      <div className="flex h-52 items-center justify-center text-sm text-[var(--muted)]">로딩 중...</div>
                    ) : previewBlobUrl ? (
                      <div className="bg-[var(--surface)]">
                        {previewMime?.startsWith("image/") ? (
                          <img src={previewBlobUrl} alt="Receipt Preview" className="max-h-[55vh] w-full object-contain" />
                        ) : previewMime === "application/pdf" ? (
                          <iframe src={previewBlobUrl} className="h-[55vh] w-full" title="Receipt PDF Preview" />
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

          <Card className="border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3">
              <div className="flex items-center gap-2">
                {[
                  { key: "match", label: "매칭" },
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
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              {activeTab === "match" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">미매칭 라인</div>
                    <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                      {unlinkedQuery.data?.length ?? 0}건
                    </Badge>
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
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
                                {line.model_name ?? "-"}
                              </div>
                              <div className="mt-1 text-[var(--muted)]">
                                {line.material_code ?? "-"} · {formatNumber(line.factory_weight_g)}g
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
                      <div className="mt-2 space-y-1 text-[var(--muted)]">
                        <div>모델: <span className="text-[var(--foreground)]">{selectedUnlinked.model_name ?? "-"}</span></div>
                        <div>소재: <span className="text-[var(--foreground)]">{selectedUnlinked.material_code ?? "-"}</span></div>
                        <div>중량: <span className="text-[var(--foreground)]">{formatNumber(selectedUnlinked.factory_weight_g)}</span></div>
                      </div>
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
                  <div className="text-[10px] text-[var(--muted)]">
                    선택 라인: {selectedUnlinked?.receipt_line_uuid ?? "없음"}
                  </div>

                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">추천 후보</div>
                      {suggestions.map((candidate, idx) => {
                        const key = candidate.order_line_id ?? `candidate-${idx}`;
                        const expanded = scoreOpenMap[key] ?? false;
                        return (
                          <div key={key} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-[var(--foreground)]">
                                  {candidate.customer_name ?? "-"} · {candidate.status ?? "-"}
                                </div>
                                <div className="mt-1 text-[var(--muted)]">
                                  {candidate.model_name ?? "-"} {candidate.size ?? ""} {candidate.color ?? ""}
                                </div>
                                <div className="mt-1 text-[var(--muted)]">
                                  소재 {candidate.material_code ?? "-"} · 중량 {formatNumber(candidate.effective_weight_g)}g
                                </div>
                                <div className="mt-1 text-[var(--muted)]">
                                  범위 {formatNumber(candidate.weight_min_g)} ~ {formatNumber(candidate.weight_max_g)}g
                                </div>
                                <div className="mt-1 text-[var(--muted)]">
                                  PO {candidate.factory_po_id ?? "-"} · {candidate.memo ?? ""}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge tone="primary" className="h-5 px-2 text-[10px]">{formatNumber(candidate.match_score)}</Badge>
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
                            </div>
                            <button
                              type="button"
                              className="mt-2 text-[var(--primary)]"
                              onClick={() => setScoreOpenMap((prev) => ({ ...prev, [key]: !expanded }))}
                            >
                              {expanded ? "점수 상세 닫기" : "점수 상세 보기"}
                            </button>
                            {expanded ? (
                              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-[var(--surface)] p-2 text-[10px] text-[var(--muted)]">
                                {JSON.stringify(candidate.score_detail_json ?? {}, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

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

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="영수증 업로드">
        <div className="space-y-4">
          <input ref={fileRef} type="file" onChange={handleFileChange} />
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
