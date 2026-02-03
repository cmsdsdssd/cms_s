"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { getSchemaClient } from "@/lib/supabase/client";

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
  bill_no?: string | null;
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
  meta?: {
    line_items?: ReceiptLineItem[] | null;
  } | null;
};

type ReceiptLineItem = {
  id: string;
  model_name: string;
  material_code?: string | null;
  weight_g: number | null;
  labor_basic: number | null;
  labor_other: number | null;
  qty: number;
};

type ShipmentCostCandidate = {
  shipment_id: string;
  ship_date?: string | null;
  status?: string | null;
  customer_party_id?: string | null;
  customer_name?: string | null;
  line_cnt?: number | null;
  total_qty?: number | null;
  total_cost_krw?: number | null;
  total_sell_krw?: number | null;
  cost_confirmed?: boolean | null;
  has_receipt?: boolean | null;
  model_names?: string | null;
};

type PartyOption = { label: string; value: string };

type VendorRow = {
  party_id: string;
  name: string;
  party_type?: string | null;
};

type UpsertSnapshotResult = {
  ok: boolean;
  receipt_id: string;
  currency_code?: string;
  total_amount?: number;
  total_amount_krw?: number;
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

function getReceiptDisplayName(index: number, receivedAt: string | null | undefined) {
  const date = receivedAt ? new Date(receivedAt).toISOString().slice(0, 10).replace(/-/g, '') : 'unknown';
  return `영수증_${date}_${index}`;
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

function getMaterialFactor(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized === "14" || normalized === "14K") return 0.6435;
  if (normalized === "18" || normalized === "18K") return 0.825;
  if (normalized === "24" || normalized === "24K") return 1;
  if (normalized === "925" || normalized === "S925") return 0.925;
  return 1;
}

function getMaterialBucket(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized === "14" || normalized === "14K") return "GOLD";
  if (normalized === "18" || normalized === "18K") return "GOLD";
  if (normalized === "24" || normalized === "24K") return "GOLD";
  if (normalized === "925" || normalized === "S925") return "SILVER";
  return "OTHER";
}

function calcShipmentAllocations(
  totalKrw: number | null,
  rows: ShipmentCostCandidate[],
  method: "PROVISIONAL" | "QTY"
) {
  if (!totalKrw || totalKrw <= 0) return [] as Array<ShipmentCostCandidate & { alloc_krw: number; basis: number }>;
  const basisForRow = (row: ShipmentCostCandidate) => {
    if (method === "QTY") return Number(row.total_qty) || 0;
    return Number(row.total_cost_krw) || Number(row.total_sell_krw) || Number(row.total_qty) || 0;
  };
  const totalBasis = rows.reduce((sum, row) => sum + basisForRow(row), 0);
  if (totalBasis <= 0) return rows.map((row) => ({ ...row, alloc_krw: 0, basis: 0 }));

  let remainingKrw = totalKrw;
  let remainingBasis = totalBasis;
  const sorted = [...rows].sort((a, b) => (a.shipment_id > b.shipment_id ? 1 : -1));
  const out: Array<ShipmentCostCandidate & { alloc_krw: number; basis: number }> = [];

  for (const row of sorted) {
    const basis = basisForRow(row);
    const alloc = remainingBasis > 0 ? Math.round((remainingKrw * basis) / remainingBasis) : remainingKrw;
    remainingKrw -= alloc;
    remainingBasis -= basis;
    out.push({ ...row, alloc_krw: alloc, basis });
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
  const schemaClient = getSchemaClient();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"ALL" | "NEED_INPUT" | "NEED_APPLY" | "APPLIED">("NEED_APPLY");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [vendorPartyId, setVendorPartyId] = useState<string>("");
  const [billNo, setBillNo] = useState<string>("");
  const [billDate, setBillDate] = useState<string>("");

  const [currencyCode, setCurrencyCode] = useState<"KRW" | "CNY">("KRW");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [weightG, setWeightG] = useState<string>("");
  const [goldWeightG, setGoldWeightG] = useState<string>("");
  const [silverWeightG, setSilverWeightG] = useState<string>("");
  const [laborBasic, setLaborBasic] = useState<string>("");
  const [laborOther, setLaborOther] = useState<string>("");
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);
  const [note, setNote] = useState<string>("");
  const [forceReapply, setForceReapply] = useState<boolean>(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMethod, setApplyMethod] = useState<"PROVISIONAL" | "QTY">("PROVISIONAL");
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [shipmentPartyFilter, setShipmentPartyFilter] = useState<string>("");
  const [shipmentModelFilter, setShipmentModelFilter] = useState<string>("");
  const [shipmentDateFilter, setShipmentDateFilter] = useState<string>("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  // Receipt preview in left panel (double-click)
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    
    if (file && file.type.startsWith('image/')) {
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
      fileRef.current.value = '';
    }
  }

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
      if (!schemaClient) return [] as PartyOption[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type")
        .eq("party_type", "vendor")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as VendorRow[] | null | undefined ?? []).map((row) => ({
        label: row.name,
        value: row.party_id,
      }));
    },
    enabled: Boolean(schemaClient),
  });

  const shipmentCandidatesQuery = useQuery({
    queryKey: ["shipment-cost-candidates"],
    queryFn: async () => {
      if (!schemaClient) return [] as ShipmentCostCandidate[];
      const { data, error } = await schemaClient
        .from(CONTRACTS.views.shipmentCostApplyCandidates)
        .select("*")
        .order("ship_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShipmentCostCandidate[];
    },
    enabled: Boolean(schemaClient),
  });

  async function handleReceiptDoubleClick(receiptId: string) {
    if (previewReceiptId === receiptId) {
      // Toggle off if clicking same receipt
      setPreviewReceiptId(null);
      setPreviewBlobUrl(null);
      setPreviewMime(null);
      return;
    }

    setPreviewReceiptId(receiptId);
    setIsPreviewLoading(true);
    setPreviewBlobUrl(null);
    setPreviewMime(null);
    
    try {
      const res = await fetch(`/api/receipt-file?receipt_id=${encodeURIComponent(receiptId)}`);
      let blob: Blob | null = null;
      if (res.ok) {
        blob = await res.blob();
      } else {
        const previewRes = await fetch(`/api/receipt-preview?receipt_id=${encodeURIComponent(receiptId)}`);
        if (previewRes.ok) {
          blob = await previewRes.blob();
        }
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        setPreviewMime(blob.type || null);
      } else {
        toast.error("미리보기 로드 실패");
      }
    } catch (err) {
      toast.error("미리보기 로드 실패");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function getDisplayName() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `영수증_${today}_${uploadCount}`;
  }

  function addLine() {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        model_name: "",
        material_code: "",
        weight_g: null,
        labor_basic: null,
        labor_other: null,
        qty: 1,
      },
    ]);
  }

  function removeLine(id: string) {
    setLineItems(lineItems.filter((item) => item.id !== id));
  }

  function updateLine(
    id: string,
    field: keyof ReceiptLineItem,
    value: ReceiptLineItem[keyof ReceiptLineItem]
  ) {
    if (field === "material_code" && typeof value === "string") {
      const normalized = value.trim().toUpperCase();
      const cleaned = normalized.replace(/[^0-9A-Z]/g, "");
      setLineItems(
        lineItems.map((item) =>
          item.id === id ? { ...item, material_code: cleaned } : item
        )
      );
      return;
    }
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function applySelectedReceipt(receipt: ReceiptWorklistRow) {
    const c = (receipt.pricing_currency_code ?? receipt.inbox_currency_code ?? "KRW").toUpperCase();
    setCurrencyCode((c === "CNY" ? "CNY" : "KRW") as "KRW" | "CNY");
    setTotalAmount(receipt.pricing_total_amount != null ? String(receipt.pricing_total_amount) : "");
    setWeightG(receipt.weight_g != null ? String(receipt.weight_g) : "");
    setGoldWeightG("");
    setSilverWeightG("");
    setLaborBasic(receipt.labor_basic != null ? String(receipt.labor_basic) : "");
    setLaborOther(receipt.labor_other != null ? String(receipt.labor_other) : "");
    setLineItems(receipt.meta?.line_items ?? []);
    setNote(receipt.memo ?? "");
    setVendorPartyId(receipt.vendor_party_id ?? "");
    setBillNo(receipt.bill_no ?? "");
    setBillDate(receipt.issued_at ? receipt.issued_at.slice(0, 10) : "");
    setIsCreating(false);
    setForceReapply(false);
  }

  function startCreateBill() {
    setSelectedReceiptId(null);
    setIsCreating(true);
    setVendorPartyId("");
    setBillNo("");
    setBillDate("");
    setCurrencyCode("KRW");
    setTotalAmount("");
    setWeightG("");
    setGoldWeightG("");
    setSilverWeightG("");
    setLaborBasic("");
    setLaborOther("");
    setLineItems([]);
    setNote("");
    setForceReapply(false);
  }

  // Auto-calculate totals from line items
  useEffect(() => {
    if (lineItems.length === 0) {
      setGoldWeightG("");
      setSilverWeightG("");
      return;
    }

    const totalAmt = lineItems.reduce((acc, item) => {
      const price = (item.labor_basic ?? 0) + (item.labor_other ?? 0);
      return acc + price * item.qty;
    }, 0);

    let totalWgt = 0;
    let totalGold = 0;
    let totalSilver = 0;
    lineItems.forEach((item) => {
      const factor = getMaterialFactor(item.material_code);
      const bucket = getMaterialBucket(item.material_code);
      const raw = (item.weight_g ?? 0) * item.qty;
      const converted = raw * factor;
      totalWgt += raw;
      if (bucket === "GOLD") totalGold += converted;
      if (bucket === "SILVER") totalSilver += converted;
    });
    const totalBasic = lineItems.reduce((acc, item) => acc + (item.labor_basic ?? 0) * item.qty, 0);
    const totalOther = lineItems.reduce((acc, item) => acc + (item.labor_other ?? 0) * item.qty, 0);

    setTotalAmount(String(totalAmt));
    setWeightG(String(totalWgt));
    setGoldWeightG(String(totalGold));
    setSilverWeightG(String(totalSilver));
    setLaborBasic(String(totalBasic));
    setLaborOther(String(totalOther));
  }, [lineItems]);

  const worklist = useQuery<{ data: ReceiptWorklistRow[] }>(
    {
      queryKey: ["cms", "receipt_worklist"],
      queryFn: async () => {
        const res = await fetch("/api/purchase-cost-worklist?limit=250", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "작업대 조회 실패");
        if (!selectedReceiptId && !isCreating) {
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
  const vendorOptions = vendorOptionsQuery.data ?? [];

  useEffect(() => {
    const rid = searchParams.get("receipt_id");
    if (!rid) return;
    if (rows.length === 0) return;
    if (isCreating) return;
    if (selectedReceiptId === rid) return;
    selectReceiptId(rid, rows);
  }, [searchParams, rows, isCreating, selectedReceiptId]);

  const selectReceiptId = (receiptId: string | null, sourceRows: ReceiptWorklistRow[] = rows) => {
    setSelectedReceiptId(receiptId);
    if (!receiptId) {
      setIsCreating(false);
      return;
    }
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

  const shipmentCandidates = useMemo(() => shipmentCandidatesQuery.data ?? [], [shipmentCandidatesQuery.data]);

  const filteredShipmentCandidates = useMemo(() => {
    return shipmentCandidates.filter((row) => {
      if (row.cost_confirmed) return false;
      if (shipmentPartyFilter && row.customer_party_id !== shipmentPartyFilter) return false;
      if (shipmentDateFilter && row.ship_date !== shipmentDateFilter) return false;
      if (shipmentModelFilter.trim()) {
        const needle = shipmentModelFilter.trim().toLowerCase();
        const models = String(row.model_names ?? "").toLowerCase();
        if (!models.includes(needle)) return false;
      }
      return true;
    });
  }, [shipmentCandidates, shipmentPartyFilter, shipmentDateFilter, shipmentModelFilter]);

  const shipmentPartyOptions = useMemo(() => {
    const map = new Map<string, string>();
    shipmentCandidates.forEach((row) => {
      if (row.customer_party_id) {
        map.set(row.customer_party_id, row.customer_name ?? row.customer_party_id);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [shipmentCandidates]);

  const selected = useMemo(() => {
    if (!selectedReceiptId) return null;
    return rows.find((r) => r.receipt_id === selectedReceiptId) ?? null;
  }, [rows, selectedReceiptId]);

  const selectedCandidateRows = useMemo(
    () => shipmentCandidates.filter((row) => selectedShipments.has(row.shipment_id)),
    [shipmentCandidates, selectedShipments]
  );

  const allocationPreview = useMemo(() => {
    const totalKrw = selected?.pricing_total_amount_krw ?? parseNumOrNull(totalAmount);
    return calcShipmentAllocations(totalKrw, selectedCandidateRows, applyMethod);
  }, [selected, totalAmount, selectedCandidateRows, applyMethod]);

  const upsertSnapshot = useRpcMutation<UpsertSnapshotResult>({
    fn: "cms_fn_upsert_receipt_pricing_snapshot_v1",
    successMessage: "영수증 값 저장 완료",
    onSuccess: () => worklist.refetch(),
  });

  const vendorBillHeaderUpdate = useRpcMutation<void>({
    fn: "cms_fn_update_vendor_bill_header_v1",
    successMessage: "영수증 헤더 저장 완료",
    onSuccess: () => worklist.refetch(),
  });

  const vendorBillCreate = useRpcMutation<string>({
    fn: CONTRACTS.functions.vendorBillCreate,
    successMessage: "영수증 저장 완료",
    onSuccess: (receiptId) => {
      setSelectedReceiptId(String(receiptId));
      setIsCreating(false);
      worklist.refetch();
    },
  });

  const vendorBillApply = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.vendorBillApply,
    successMessage: "출고 배분 완료",
    onSuccess: () => {
      setApplyOpen(false);
      setSelectedShipments(new Set());
      shipmentCandidatesQuery.refetch();
      worklist.refetch();
    },
  });

  const ensureApFromReceipt = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.ensureApFromReceipt,
  });

  async function onSave() {
    const p_total_amount = parseNumOrNull(totalAmount);
    if (p_total_amount == null) {
      toast.error("총금액은 필수입니다");
      return;
    }

    if (isCreating) {
      if (!vendorPartyId) {
        toast.error("공장을 선택해주세요");
        return;
      }
      if (currencyCode !== "KRW") {
        toast.error("수기 영수증은 KRW만 지원합니다");
        return;
      }

      await vendorBillCreate.mutateAsync({
        p_vendor_party_id: vendorPartyId,
        p_bill_no: billNo || null,
        p_bill_date: billDate || null,
        p_memo: note || null,
        p_total_amount_krw: p_total_amount,
        p_lines: lineItems,
      });
      return;
    }

    if (!selectedReceiptId) return;

    await vendorBillHeaderUpdate.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_vendor_party_id: vendorPartyId || null,
      p_bill_no: billNo || null,
      p_bill_date: billDate || null,
      p_memo: note || null,
      p_lines: lineItems,
    });

    await upsertSnapshot.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_currency_code: currencyCode,
      p_total_amount,
      p_weight_g: parseNumOrNull(weightG),
      p_labor_basic: parseNumOrNull(laborBasic),
      p_labor_other: parseNumOrNull(laborOther),
      p_note: note || null,
    });

    await ensureApFromReceipt.mutateAsync({
      p_receipt_id: selectedReceiptId,
      p_note: note || null,
    });
  }

  async function onApply() {
    if (isCreating) {
      toast.error("먼저 영수증을 저장하세요");
      return;
    }
    if (!selected) return;

    await onSave();
    setApplyOpen(true);
  }

  async function handleApplyToShipments() {
    if (!selected) return;
    const totalKrw = selected.pricing_total_amount_krw ?? parseNumOrNull(totalAmount);
    if (!totalKrw || totalKrw <= 0) {
      toast.error("총금액(KRW)이 필요합니다");
      return;
    }
    if (selectedCandidateRows.length === 0) {
      toast.error("출고를 선택해주세요");
      return;
    }

    const allocations = calcShipmentAllocations(totalKrw, selectedCandidateRows, applyMethod).map((row) => ({
      shipment_id: row.shipment_id,
      allocated_cost_krw: row.alloc_krw,
    }));

    await vendorBillApply.mutateAsync({
      p_bill_id: selected.receipt_id,
      p_allocations: allocations,
      p_allocation_method: applyMethod,
      p_force: forceReapply,
      p_note: note || null,
    });
  }

  const toggleShipment = (shipmentId: string) => {
    setSelectedShipments((prev) => {
      const next = new Set(prev);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  };

  const toggleAllVisibleShipments = (checked: boolean) => {
    setSelectedShipments((prev) => {
      const next = new Set(prev);
      const ids = filteredShipmentCandidates.map((row) => row.shipment_id);
      if (checked) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  async function openReceiptPreview(receiptId: string) {
    try {
      const url = `/api/receipt-preview?receipt_id=${encodeURIComponent(receiptId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("미리보기를 열 수 없습니다");
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
      
      // 성공 여부와 관계없이 먼저 팝업 닫고 초기화
      setUploadOpen(false);
      resetUpload();
      setUploadCount(prev => prev + 1);
      
      if (receiptId) {
        toast.success(`영수증 업로드 완료: ${getDisplayName()}`);
        
        // 목록 강제 새로고침
        await worklist.refetch();
        
        // 새로고침 후 데이터가 반영될 시간을 주고 선택
        setTimeout(() => {
          worklist.refetch().then((refreshed) => {
            const nextRows = refreshed.data?.data ?? [];
            const newReceipt = nextRows.find((r) => r.receipt_id === receiptId);
            if (newReceipt) {
              selectReceiptId(receiptId, nextRows);
            }
          });
        }, 500);
      } else {
        toast.error(`업로드는 완료되었으나 영수증 ID를 받지 못했습니다: ${json?.error || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error("업로드 중 오류 발생");
    } finally {
      setIsUploading(false);
    }
  }

  const allocations = useMemo((): Array<LinkedShipment & { alloc_krw: number }> => {
    if (!selected) return [];
    const totalKrw = selected.pricing_total_amount_krw ?? null;
    return calcAllocations(totalKrw, selected.linked_shipments ?? []);
  }, [selected]);

  const busy =
    worklist.isLoading ||
    upsertSnapshot.isPending ||
    vendorBillCreate.isPending ||
    vendorBillApply.isPending ||
    vendorBillHeaderUpdate.isPending;
  const isEditing = isCreating || Boolean(selected);

  return (
    <div className="mx-auto max-w-[1800px] space-y-8 px-4 pb-10 pt-4 md:px-6">
      <div className="relative z-10 rounded-[18px] border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
        <ActionBar
          title="원가마감 작업대"
          subtitle="영수증 총합(중량/공임/총금액)을 저장하고, 연결된 출고에 자동 배분하여 ACTUAL 원가로 반영합니다."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => worklist.refetch()} disabled={busy}>
                새로고침
              </Button>
              <Button variant="secondary" onClick={startCreateBill} disabled={busy}>
                수기 영수증
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
          {/* Receipt Preview Panel (double-click to open) */}
          {previewReceiptId && (
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-black/5">
              <CardHeader className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-2 backdrop-blur-sm">
                <div className="text-sm font-semibold text-[var(--foreground)]">영수증 미리보기</div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setPreviewReceiptId(null);
                    setPreviewBlobUrl(null);
                    setPreviewMime(null);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </CardHeader>
              <CardBody className="p-0">
                {isPreviewLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-8 w-8 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs text-[var(--muted)]">로딩 중...</span>
                    </div>
                  </div>
                ) : previewBlobUrl ? (
                  <div className="relative bg-[var(--surface)]">
                    {previewMime?.startsWith("image/") ? (
                      <img 
                        src={previewBlobUrl} 
                        alt="Receipt Preview" 
                        className="max-h-[50vh] w-full object-contain"
                      />
                    ) : previewMime === "application/pdf" ? (
                      <iframe
                        src={previewBlobUrl}
                        className="h-[50vh] w-full"
                        title="Receipt PDF Preview"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center text-sm text-[var(--muted)]">
                        미리보기를 표시할 수 없습니다
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-sm text-[var(--muted)]">
                    미리보기를 불러올 수 없습니다
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <Card className="flex-1 overflow-hidden border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-4 py-3 backdrop-blur-sm">
              <div className="text-sm font-semibold text-[var(--foreground)]">영수증 목록</div>
              <div className="flex items-center gap-1.5">
                {(["NEED_APPLY", "NEED_INPUT", "APPLIED", "ALL"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filter === f ? "primary" : "ghost"}
                    onClick={() => handleFilterChange(f)}
                    className={`h-7 px-2.5 text-xs font-medium transition-all ${
                      filter === f ? "shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
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
            <CardBody className="max-h-[calc(100vh-240px)] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[var(--border)]">
              {worklist.isLoading ? (
                <div className="space-y-2 p-1">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={`receipt-skeleton-${idx}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
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
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/70 text-sm text-[var(--muted)]">
                  처리할 항목이 없습니다.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(() => {
                    // 전체 rows 기준으로 날짜별 순번 계산 (상세 화면과 동일)
                    const dateIndexMap = new Map<string, number>();
                    const sortedAllRows = [...rows].sort((a, b) => 
                      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
                    );
                    
                    // receipt_id -> displayName 매핑 생성
                    const displayNameMap = new Map<string, string>();
                    sortedAllRows.forEach((r) => {
                      const dateKey = r.received_at ? new Date(r.received_at).toISOString().slice(0, 10) : 'unknown';
                      const currentIndex = (dateIndexMap.get(dateKey) || 0) + 1;
                      dateIndexMap.set(dateKey, currentIndex);
                      displayNameMap.set(r.receipt_id, getReceiptDisplayName(currentIndex, r.received_at));
                    });
                    
                    // 필터링된 행을 날짜순으로 정렬하여 표시
                    const sortedFilteredRows = [...filteredRows].sort((a, b) => 
                      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
                    );
                    
                    return sortedFilteredRows.map((r) => {
                      const isSelected = r.receipt_id === selectedReceiptId;
                      const hasInput = !!(r.pricing_total_amount_krw ?? r.pricing_total_amount);
                      const isApplied = !!r.applied_at;
                      const hasLinks = (r.linked_shipment_cnt ?? 0) > 0;
                      const displayName = displayNameMap.get(r.receipt_id) || r.receipt_id.slice(0, 8);

                    return (
                      <button
                        key={r.receipt_id}
                        type="button"
                        onClick={() => selectReceiptId(r.receipt_id)}
                        onDoubleClick={() => handleReceiptDoubleClick(r.receipt_id)}
                        className={`group relative w-full rounded-lg border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm ring-1 ring-[var(--primary)]"
                            : "border-transparent bg-[var(--panel)] hover:border-[var(--panel-border)] hover:bg-[var(--panel-hover)] hover:shadow-sm"
                        } ${previewReceiptId === r.receipt_id ? 'ring-2 ring-[var(--secondary)]' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-semibold transition-colors ${isSelected ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                              {displayName}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                              <span className="tabular-nums">{formatYmd(r.received_at)}</span>
                              <span className="text-[var(--muted-weak)]">·</span>
                              <span className="truncate font-medium text-[var(--muted-foreground)]">{r.vendor_name ?? "거래처 미지정"}</span>
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
                  })})()}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: selected receipt editor */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Card className="min-h-[600px] border-none shadow-sm ring-1 ring-black/5">
            <CardHeader className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-[var(--foreground)]">
                  {isCreating ? "수기 영수증 입력" : selected ? "영수증 상세 및 배분" : "영수증을 선택하세요"}
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
              ) : isCreating ? (
                <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                  닫기
                </Button>
              ) : null}
            </CardHeader>
            <CardBody className="p-6">
              {worklist.isLoading ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <Skeleton className="h-4 w-1/3" />
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="mt-3 h-24 w-full" />
                  </div>
                </div>
              ) : !isEditing ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 py-20 text-center">
                  <div className="mb-4 rounded-full bg-[var(--panel)] p-4 shadow-sm">
                    <svg className="h-8 w-8 text-[var(--muted-weak)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-[var(--foreground)]">항목을 선택하세요</h3>
                  <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
                    왼쪽 목록에서 영수증을 선택하여 상세 정보를 입력하고<br />출고 원가 배분을 진행하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--foreground)]">영수증 헤더</div>
                      {vendorPartyId ? (
                        <Badge tone="neutral" className="text-xs">{vendorOptions.find((v) => v.value === vendorPartyId)?.label ?? ""}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <SearchSelect
                        label="공장(거래처)*"
                        placeholder="검색"
                        options={vendorOptions}
                        value={vendorPartyId}
                        onChange={(value) => setVendorPartyId(value)}
                      />
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증번호</label>
                        <Input
                          placeholder="예: VB-202602"
                          value={billNo}
                          onChange={(e) => setBillNo(e.target.value)}
                          className="bg-[var(--input-bg)]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">영수증일자</label>
                        <Input
                          type="date"
                          value={billDate}
                          onChange={(e) => setBillDate(e.target.value)}
                          className="bg-[var(--input-bg)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary Section */}
                  {selected ? (
                    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                            {(() => {
                              // 현재 선택된 영수증의 날짜별 순번 계산 (목록과 동일한 로직)
                              if (!selected) return '-';
                              
                              // rows를 received_at 기준으로 정렬 (목록과 동일)
                              const sortedRows = [...rows].sort((a, b) => 
                                new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
                              );
                              
                              const selectedDate = selected.received_at ? new Date(selected.received_at).toISOString().slice(0, 10) : 'unknown';
                              let index = 1;
                              
                              for (const row of sortedRows) {
                                if (row.receipt_id === selected.receipt_id) break;
                                const rowDate = row.received_at ? new Date(row.received_at).toISOString().slice(0, 10) : 'unknown';
                                if (rowDate === selectedDate) index++;
                              }
                              
                              return getReceiptDisplayName(index, selected.received_at);
                            })()}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                            <span className="tabular-nums">{formatYmd(selected.received_at)}</span>
                            <span className="text-[var(--muted-weak)]">·</span>
                            <span className="truncate font-medium text-[var(--muted-foreground)]">{selected.vendor_name ?? "거래처 미지정"}</span>
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
                      <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/70 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-weak)]">통화</div>
                          <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                            {selected.pricing_currency_code ?? selected.inbox_currency_code ?? "-"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/70 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-weak)]">총금액</div>
                          <div className="mt-1 text-sm font-semibold text-[var(--foreground)] tabular-nums">
                            {formatNumber(selected.pricing_total_amount)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/70 px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-weak)]">KRW 환산</div>
                          <div className="mt-1 text-sm font-semibold text-[var(--foreground)] tabular-nums">
                            {formatNumber(selected.pricing_total_amount_krw)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--surface)]/60 p-4 text-xs text-[var(--muted)]">
                      수기 영수증은 저장 후 요약 정보가 표시됩니다.
                    </div>
                  )}

                  {/* Line Items Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        상세 내역 ({lineItems.length})
                      </label>
                      <Button size="sm" variant="secondary" onClick={addLine} disabled={!selectedReceiptId && !isCreating}>
                        + 라인 추가
                      </Button>
                    </div>

                    {lineItems.length > 0 ? (
                      <div className="space-y-1">
                        {lineItems.map((item, idx) => {
                          const subtotal = ((item.labor_basic ?? 0) + (item.labor_other ?? 0)) * item.qty;
                          return (
                            <div key={item.id} className="flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/30 px-2 py-1.5">
                              <div className="flex items-center justify-center w-5 h-7 text-[11px] text-[var(--muted)] shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-[100px]">
                                <Input
                                  placeholder="모델명"
                                  value={item.model_name}
                                  onChange={(e) => updateLine(item.id, "model_name", e.target.value)}
                                  className="h-7 text-xs px-2"
                                />
                              </div>
                              <div className="w-[70px]">
                                <Input
                                  placeholder="소재"
                                  value={item.material_code ?? ""}
                                  onChange={(e) => updateLine(item.id, "material_code", e.target.value)}
                                  className="h-7 text-xs text-center px-1"
                                />
                              </div>
                              <div className="w-[70px]">
                                <Input
                                  type="number"
                                  placeholder="중량(g)"
                                  value={item.weight_g ?? ""}
                                  onChange={(e) => updateLine(item.id, "weight_g", parseNumOrNull(e.target.value))}
                                  className="h-7 text-xs tabular-nums text-right px-2"
                                />
                              </div>
                              <div className="w-[80px]">
                                <Input
                                  type="number"
                                  placeholder="기본공임"
                                  value={item.labor_basic ?? ""}
                                  onChange={(e) => updateLine(item.id, "labor_basic", parseNumOrNull(e.target.value))}
                                  className="h-7 text-xs tabular-nums text-right px-2"
                                />
                              </div>
                              <div className="w-[80px]">
                                <Input
                                  type="number"
                                  placeholder="부가공임"
                                  value={item.labor_other ?? ""}
                                  onChange={(e) => updateLine(item.id, "labor_other", parseNumOrNull(e.target.value))}
                                  className="h-7 text-xs tabular-nums text-right px-2"
                                />
                              </div>
                              <div className="w-[50px]">
                                <Input
                                  type="number"
                                  placeholder="수량"
                                  value={item.qty}
                                  onChange={(e) => updateLine(item.id, "qty", Number(e.target.value) || 1)}
                                  className="h-7 text-xs tabular-nums text-center px-1"
                                />
                              </div>
                              <div className="flex items-center justify-end w-[70px] h-7 text-xs font-medium tabular-nums text-[var(--primary)] shrink-0">
                                {formatNumber(subtotal)}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeLine(item.id)}
                                className="h-7 w-7 p-0 text-[var(--muted)] hover:text-red-500 shrink-0"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/30 p-4 text-center text-xs text-[var(--muted)]">
                        라인을 추가하여 상세 내역을 입력할 수 있습니다. (선택사항)
                      </div>
                    )}
                  </div>

                  {/* Input Section */}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">통화</label>
                      <Select 
                        value={currencyCode} 
                        onChange={(e) => setCurrencyCode(e.target.value as "KRW" | "CNY")}
                        className="bg-[var(--input-bg)]"
                      >
                        <option value="KRW">KRW (원화)</option>
                        <option value="CNY">CNY (위안화)</option>
                      </Select>
                      <p className="text-[11px] text-[var(--muted-weak)]">
                        * 환율은 적용 시점의 최신 시세(meta)를 참조
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">총금액 ({currencyCode})</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        readOnly={lineItems.length > 0}
                        className={`font-mono text-lg font-medium tabular-nums ${lineItems.length > 0 ? "bg-[var(--surface)] text-[var(--muted-foreground)]" : ""}`}
                      />
                      <p className="text-[11px] text-[var(--muted-weak)]">
                        KRW 환산: <span className="font-medium text-[var(--muted-foreground)]">{formatNumber(selected?.pricing_total_amount_krw)}</span>
                        {selected?.fx_rate_krw_per_unit && (
                          <span className="ml-1">(fx {formatNumber(selected.fx_rate_krw_per_unit)})</span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">원물 중량 (g)</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={weightG}
                        onChange={(e) => setWeightG(e.target.value)}
                        readOnly={lineItems.length > 0}
                        className={`font-mono tabular-nums ${lineItems.length > 0 ? "bg-[var(--surface)] text-[var(--muted-foreground)]" : ""}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">금 중량 (g)</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={goldWeightG}
                        readOnly
                        className="font-mono tabular-nums bg-[var(--surface)] text-[var(--muted-foreground)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">은 중량 (g)</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={silverWeightG}
                        readOnly
                        className="font-mono tabular-nums bg-[var(--surface)] text-[var(--muted-foreground)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">기본공임</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={laborBasic}
                        onChange={(e) => setLaborBasic(e.target.value)}
                        readOnly={lineItems.length > 0}
                        className={`font-mono tabular-nums ${lineItems.length > 0 ? "bg-[var(--surface)] text-[var(--muted-foreground)]" : ""}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">기타공임</label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={laborOther}
                        onChange={(e) => setLaborOther(e.target.value)}
                        readOnly={lineItems.length > 0}
                        className={`font-mono tabular-nums ${lineItems.length > 0 ? "bg-[var(--surface)] text-[var(--muted-foreground)]" : ""}`}
                      />
                    </div>

                    <div className="space-y-1.5 lg:col-span-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">메모</label>
                      <Textarea
                        placeholder="특이사항이나 비고를 입력하세요"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="min-h-[80px] resize-none bg-[var(--input-bg)]"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--panel-border)] bg-[var(--surface)]/50 p-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={forceReapply}
                        onChange={(e) => setForceReapply(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--panel-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span>기존 데이터 덮어쓰기 (재적용)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={onSave}
                        disabled={busy || (!selectedReceiptId && !isCreating)}
                      >
                        저장만 하기
                      </Button>
                      <Button
                        onClick={onApply}
                        disabled={busy || isCreating || !selectedReceiptId}
                        className="px-6 shadow-sm"
                      >
                        저장 및 배분 적용
                      </Button>
                    </div>
                  </div>

                  {/* Allocations Section */}
                  {selected ? (
                    <div className="space-y-4">
                      <div className="flex items-end justify-between border-b border-[var(--panel-border)] pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-[var(--foreground)]">연결된 출고 내역</h4>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            출고확정 당시 내부원가 합계 비례 배분
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <span className="font-medium text-[var(--foreground)]">{selected.linked_shipment_cnt ?? 0}건</span>
                          <span className="mx-2 text-[var(--muted-weak)]">|</span>
                          <span className="text-[var(--muted)]">기준합 {formatNumber(selected.linked_basis_cost_krw)} KRW</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {selected.linked_shipments?.length ? (
                          allocations.map((s) => (
                            <div
                              key={s.shipment_id}
                              className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 transition-all hover:border-[var(--panel-border)] hover:shadow-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-[var(--foreground)]">
                                    {s.customer_name ?? "(거래처 미상)"}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Badge tone="neutral" className="bg-[var(--muted)]/10 text-[var(--muted)]">{formatYmd(s.ship_date)}</Badge>
                                    <Badge tone="neutral" className="bg-[var(--muted)]/10 text-[var(--muted)]">라인 {s.line_cnt ?? 0}</Badge>
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                                  <span className="font-mono text-[10px] text-[var(--muted-weak)]">{s.shipment_id}</span>
                                  <span>·</span>
                                  <span>기준 {formatNumber(s.basis_cost_krw)} KRW</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-[var(--primary)] tabular-nums">
                                  {formatNumber(s.alloc_krw)} KRW
                                </div>
                                <div className="text-[10px] text-[var(--muted-weak)]">
                                  배분금액
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] py-12 text-center">
                            <p className="text-sm text-[var(--muted)]">연결된 출고가 없습니다.</p>
                            <p className="mt-1 text-xs text-[var(--muted-weak)]">출고 관리에서 영수증을 연결해주세요.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[var(--panel-border)] py-10 text-center text-sm text-[var(--muted)]">
                      저장 후 배분 결과가 표시됩니다.
                    </div>
                  )}

                  {selected?.applied_at && (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-4 text-sm text-[var(--success)]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/20 text-[var(--success)]">
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

      <Modal 
        open={uploadOpen} 
        onClose={() => {
          setUploadOpen(false);
          resetUpload();
        }} 
        title="영수증 업로드"
      >
        <div className="space-y-4">
          {selectedFile ? (
            <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 p-4">
              <div className="flex gap-4">
                {uploadPreviewUrl && selectedFile.type.startsWith('image/') ? (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--panel-border)]">
                    <img 
                      src={uploadPreviewUrl} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]">
                    <svg className="h-10 w-10 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {getDisplayName()}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    {selectedFile.type.startsWith('image/') ? '이미지' : 'PDF'} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadPreviewUrl(null);
                    }} 
                    className="text-xs mt-2 h-7 px-2"
                  >
                    다른 파일 선택
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <label className="block cursor-pointer">
              <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/50 p-6 text-center transition-colors hover:bg-[var(--panel-hover)] hover:border-[var(--primary)]">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[var(--primary)] hover:underline mt-3">
                  파일 선택
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  PDF 또는 이미지 파일 (최대 10MB)
                </p>
                <Input 
                  ref={fileRef} 
                  type="file" 
                  accept="application/pdf,image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>
            </label>
          )}
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setUploadOpen(false);
                resetUpload();
              }}
              disabled={isUploading}
            >
              취소
            </Button>
            <Button 
              onClick={uploadReceipt} 
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {getDisplayName()} 업로드 중...
                </span>
              ) : (
                `${getDisplayName()} 업로드`
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="출고 배분">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select
              value={applyMethod}
              onChange={(e) => setApplyMethod(e.target.value as "PROVISIONAL" | "QTY")}
              className="bg-[var(--input-bg)]"
            >
              <option value="PROVISIONAL">임시원가 비율</option>
              <option value="QTY">수량 비율</option>
            </Select>
            <Select value={shipmentPartyFilter} onChange={(e) => setShipmentPartyFilter(e.target.value)}>
              <option value="">거래처</option>
              {shipmentPartyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              placeholder="모델 검색"
              value={shipmentModelFilter}
              onChange={(e) => setShipmentModelFilter(e.target.value)}
            />
            <Input
              type="date"
              value={shipmentDateFilter}
              onChange={(e) => setShipmentDateFilter(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-[var(--muted)]">
              총금액: {formatNumber(selected?.pricing_total_amount_krw ?? parseNumOrNull(totalAmount))} KRW
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={
                  filteredShipmentCandidates.length > 0 &&
                  filteredShipmentCandidates.every((row) => selectedShipments.has(row.shipment_id))
                }
                onChange={(e) => toggleAllVisibleShipments(e.target.checked)}
              />
              전체 선택
            </label>
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-2">
            {filteredShipmentCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--muted)]">
                선택 가능한 출고가 없습니다.
              </div>
            ) : (
              filteredShipmentCandidates.map((row) => {
                const checked = selectedShipments.has(row.shipment_id);
                return (
                  <div
                    key={row.shipment_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3"
                  >
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleShipment(row.shipment_id)}
                      />
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">
                          {row.customer_name ?? "거래처"}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {row.model_names ?? "-"}
                        </div>
                        <div className="text-xs text-[var(--muted-weak)]">
                          {row.ship_date ? formatYmd(row.ship_date) : "-"} · 수량 {row.total_qty ?? 0}
                        </div>
                      </div>
                    </label>
                    <div className="text-right text-xs text-[var(--muted)]">
                      <div>기준 {formatNumber(row.total_cost_krw || row.total_sell_krw || row.total_qty)} KRW</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {allocationPreview.length > 0 ? (
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)]/50 p-3 text-xs text-[var(--muted)]">
              선택 {allocationPreview.length}건 · 배분 합계 {formatNumber(
                allocationPreview.reduce((sum, row) => sum + row.alloc_krw, 0)
              )} KRW
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              취소
            </Button>
            <Button onClick={handleApplyToShipments} disabled={vendorBillApply.isPending}>
              배분 적용
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
