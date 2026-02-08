"use client";


import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Search, RotateCcw, Wrench } from "lucide-react";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { readView } from "@/lib/supabase/read";

type Tone = "neutral" | "active" | "warning" | "danger" | "primary";

type RepairWorkbenchRow = {
  repair_line_id: string;
  customer_party_id: string;
  customer_name?: string | null;

  received_at?: string | null;
  requested_due_date?: string | null;
  priority_code?: "NORMAL" | "URGENT" | "VVIP" | string | null;
  status?: string | null;

  model_name?: string | null;
  model_name_raw?: string | null;
  suffix?: string | null;
  material_code?: string | null;
  color?: string | null;
  qty?: number | null;

  weight_received_g?: number | null;
  measured_weight_g?: number | null;

  is_plated?: boolean | null;
  plating_variant_id?: string | null;
  plating_display_name?: string | null;
  plating_color_code?: string | null;

  repair_fee_krw?: number | null;
  repair_fee_reason?: string | null;
  is_paid?: boolean | null;

  issue_desc?: string | null;
  memo?: string | null;

  is_overdue?: boolean | null;
  age_days?: number | null;
  due_in_days?: number | null;

  linked_shipment_id?: string | null;
  linked_shipment_status?: string | null;
  linked_shipment_confirmed_at?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type PartyRow = { party_id: string; name: string; party_type?: string | null };
type PartyOption = { label: string; value: string };

type MasterItem = {
  master_item_id?: string | null;
  model_name?: string | null;
  material_code_default?: string | null;
};

type PlatingOption = {
  plating_variant_id: string;
  display_name: string;
  plating_type?: string;
  color_code?: string;
  thickness_code?: string;
};

type ShipmentHeaderRow = {
  shipment_id: string;
  status?: string | null;
  created_at?: string | null;
  ship_date?: string | null;
  confirmed_at?: string | null;
  memo?: string | null;
};

type CreateLineDraft = {
  id: string;
  modelId: string;
  modelText: string;
  suffix: string;
  materialCode: string;
  color: string;
  qty: string;
  issueDesc: string;
  memo: string;
  requestedDueDate: string;
  priorityCode: "NORMAL" | "URGENT" | "VVIP";
  weightReceivedG: string;
  measuredWeightG: string;
  isPlated: boolean;
  platingVariantId: string;
};

type DetailDraft = CreateLineDraft & {
  repairFeeKrw: string;
  repairFeeReason: string;
  isPaid: boolean;
};

type RepairImageRow = {
  path: string;
  signedUrl: string;
};

const STATUS_OPTIONS: Array<{ value: string; label: string; tone: Exclude<Tone, "primary"> }> = [
  { value: "RECEIVED", label: "접수", tone: "warning" },
  { value: "IN_PROGRESS", label: "진행", tone: "active" },
  { value: "READY_TO_SHIP", label: "출고대기", tone: "active" },
  { value: "SHIPPED", label: "출고완료", tone: "neutral" },
  { value: "CANCELLED", label: "취소", tone: "danger" },
  { value: "CLOSED", label: "마감", tone: "neutral" },
];

const PRIORITY_OPTIONS: Array<{ value: "NORMAL" | "URGENT" | "VVIP"; label: string }> = [
  { value: "NORMAL", label: "일반" },
  { value: "URGENT", label: "긴급" },
  { value: "VVIP", label: "VVIP" },
];

const MATERIAL_OPTIONS = [
  { label: "14K", value: "14" },
  { label: "18K", value: "18" },
  { label: "24K", value: "24" },
  { label: "925", value: "925" },
  { label: "00(기타)", value: "00" },
];

const normalizeId = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const lowered = text.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return text;
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  const v = Number(value);
  if (!Number.isFinite(v)) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(v))}`;
};

const formatDateYmd = (value?: string | null) => {
  if (!value) return "-";
  // value might be DATE('YYYY-MM-DD') or timestamptz
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
};

const parseNumberInput = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replaceAll(",", "").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const extractRepairLineIds = (result: { repair_line_ids?: string[] | null } | string | null) => {
  if (typeof result === "string") {
    const normalized = normalizeId(result);
    return normalized ? [normalized] : [];
  }
  if (!result || typeof result !== "object") return [];
  const any = result as { repair_line_id?: unknown; repair_line_ids?: unknown };
  const fromList = Array.isArray(any.repair_line_ids)
    ? any.repair_line_ids.map((value) => normalizeId(value)).filter((value): value is string => Boolean(value))
    : [];
  if (fromList.length > 0) return fromList;
  const single = normalizeId(any.repair_line_id);
  return single ? [single] : [];
};

const extractShipmentId = (result: { shipment_id?: string | null } | string | null) => {
  if (typeof result === "string") {
    return normalizeId(result);
  }
  if (!result || typeof result !== "object") return null;
  return normalizeId(result.shipment_id);
};

const resolveMaterialCodeForShipment = (value: string | null | undefined) => {
  const code = (value ?? "").trim();
  if (code === "14" || code === "18" || code === "24" || code === "925" || code === "00") {
    return code;
  }
  return "00";
};

const statusBadge = (status?: string | null) => {
  const normalized = (status ?? "").trim();
  const found = STATUS_OPTIONS.find((o) => o.value === normalized);
  return found
    ? { label: found.label, tone: found.tone }
    : { label: normalized || "-", tone: "neutral" as const };
};

const dueBadge = (row: RepairWorkbenchRow): { label: string; tone: Exclude<Tone, "primary"> } | null => {
  const due = row.requested_due_date;
  if (!due) return null;
  const isOverdue = Boolean(row.is_overdue);
  const d = row.due_in_days;
  if (isOverdue) {
    const lag = typeof d === "number" && d < 0 ? Math.abs(d) : undefined;
    return { label: lag !== undefined ? `지연 D+${lag}` : "지연", tone: "danger" };
  }
  if (typeof d === "number") {
    if (d === 0) return { label: "D-0", tone: "warning" };
    if (d === 1 || d === 2) return { label: `D-${d}`, tone: "warning" };
    if (d > 2) return { label: `D-${d}`, tone: "neutral" };
  }
  return { label: formatDateYmd(due), tone: "neutral" };
};

const createEmptyLine = (): CreateLineDraft => ({
  id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
  modelId: "",
  modelText: "",
  suffix: "",
  materialCode: "",
  color: "",
  qty: "1",
  issueDesc: "",
  memo: "",
  requestedDueDate: "",
  priorityCode: "NORMAL",
  weightReceivedG: "",
  measuredWeightG: "",
  isPlated: false,
  platingVariantId: "",
});

export default function RepairsPage() {
  const schemaClient = getSchemaClient();
  const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

  // ---- filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [onlyUnshipped, setOnlyUnshipped] = useState<boolean>(false);

  // ---- selection
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);

  // ---- list diagnostics
  const [repairsSource, setRepairsSource] = useState<"workbench" | "enriched" | "unknown">("unknown");

  // ---- modals
  const [createOpen, setCreateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  // ---- create form
  const [createPartyId, setCreatePartyId] = useState<string>("");
  const [createHeaderNote, setCreateHeaderNote] = useState<string>("");
  const [createLines, setCreateLines] = useState<CreateLineDraft[]>([createEmptyLine()]);
  const [createLineFiles, setCreateLineFiles] = useState<Record<string, File[]>>({});

  const lastCreatePartyIdRef = useRef<string>("");

  // ---- send modal
  const [sendExtraFee, setSendExtraFee] = useState<string>("");
  const [sendExtraFeeReason, setSendExtraFeeReason] = useState<string>("");
  const [sendNote, setSendNote] = useState<string>("");
  const [sendMode, setSendMode] = useState<"NEW" | "EXISTING">("NEW");
  const [targetShipmentId, setTargetShipmentId] = useState<string>("");

  // ---- detail draft
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [detailPartyName, setDetailPartyName] = useState<string>("");
  const [detailUploadBusy, setDetailUploadBusy] = useState(false);

  // ---- data: parties
  const partiesQuery = useQuery({
    queryKey: ["repairs-parties"],
    enabled: Boolean(schemaClient),
    queryFn: async () => {
      if (!schemaClient) return [] as PartyOption[];
      const { data, error } = await schemaClient
        .from("cms_party")
        .select("party_id, name, party_type")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as PartyRow[];
      return rows
        .filter((row) => (row.party_type ?? "").trim() === "customer")
        .map((row) => ({ label: row.name, value: row.party_id }));
    },
  });

  // ---- data: master models (for search select)
  const masterQuery = useQuery({
    queryKey: ["repairs-master-items"],
    queryFn: async () =>
      readView<MasterItem>(CONTRACTS.views.masterItemLookup, 20000, {
        orderBy: { column: "model_name", ascending: true },
      }),
    enabled: true,
  });

  const masterOptions = useMemo(() => {
    const rows = masterQuery.data ?? [];
    return rows
      .map((row) => {
        const id = normalizeId(row.master_item_id);
        const label = (row.model_name ?? "").trim();
        if (!id || !label) return null;
        return { value: id, label };
      })
      .filter((v): v is { value: string; label: string } => Boolean(v));
  }, [masterQuery.data]);

  const masterMap = useMemo(() => {
    const map = new Map<string, MasterItem>();
    (masterQuery.data ?? []).forEach((row) => {
      const id = normalizeId(row.master_item_id);
      if (!id) return;
      map.set(id, row);
    });
    return map;
  }, [masterQuery.data]);

  // ---- data: plating options
  const platingQuery = useQuery<PlatingOption[]>({
    queryKey: ["plating-options"],
    queryFn: async () => {
      const res = await fetch("/api/plating-options", { cache: "no-store" });
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        const message = typeof json === "object" && json ? (json as { error?: string }).error : "plating options failed";
        throw new Error(message ?? "plating options failed");
      }
      return (json ?? []) as PlatingOption[];
    },
  });

  const platingOptions = useMemo(() => {
    const rows = platingQuery.data ?? [];
    return rows
      .map((row) => {
        const id = normalizeId(row.plating_variant_id);
        const label = (row.display_name ?? "").trim();
        if (!id || !label) return null;
        return { value: id, label };
      })
      .filter((v): v is { value: string; label: string } => Boolean(v));
  }, [platingQuery.data]);

  // ---- data: repairs list (prefer workbench view, fallback to enriched view)
  const repairsQuery = useQuery<RepairWorkbenchRow[]>({
    queryKey: ["repairs-workbench"],
    enabled: true,
    queryFn: async () => {
      const res = await fetch("/api/repairs-workbench", { cache: "no-store" });
      const json = (await res.json()) as {
        data?: RepairWorkbenchRow[];
        source?: "workbench" | "enriched";
        error?: string;
      };
      if (!res.ok) {
        setRepairsSource("unknown");
        throw new Error(json.error ?? "수리 목록을 불러오지 못했습니다.");
      }
      setRepairsSource(json.source ?? "unknown");
      return (json.data ?? []) as RepairWorkbenchRow[];
    },
  });

  const filteredRepairs = useMemo(() => {
    const rows = repairsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter && (row.status ?? "").trim() !== statusFilter) return false;
      if (partyFilter && row.customer_party_id !== partyFilter) return false;
      if (onlyOverdue && !row.is_overdue) return false;
      if (onlyUnshipped && row.linked_shipment_id) return false;
      if (!q) return true;
      const hay = [
        row.customer_name,
        row.model_name,
        row.model_name_raw,
        row.suffix,
        row.issue_desc,
        row.memo,
        row.repair_fee_reason,
        row.plating_display_name,
      ]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [repairsQuery.data, statusFilter, partyFilter, query, onlyOverdue, onlyUnshipped]);

  // Auto-select first item
  useEffect(() => {
    if (selectedRepairId) return;
    const first = filteredRepairs[0]?.repair_line_id;
    if (first) setSelectedRepairId(first);
  }, [filteredRepairs, selectedRepairId]);

  const selectedRepair = useMemo(() => {
    const id = selectedRepairId;
    if (!id) return null;
    return (repairsQuery.data ?? []).find((row) => row.repair_line_id === id) ?? null;
  }, [repairsQuery.data, selectedRepairId]);

  const repairImagesQuery = useQuery<RepairImageRow[]>({
    queryKey: ["repairs-images", selectedRepair?.repair_line_id],
    enabled: Boolean(selectedRepair?.repair_line_id),
    queryFn: async () => {
      if (!selectedRepair?.repair_line_id) return [];
      const res = await fetch(`/api/repairs-images?repair_line_id=${encodeURIComponent(selectedRepair.repair_line_id)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { data?: RepairImageRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "수리 이미지 조회 실패");
      return json.data ?? [];
    },
  });

  // Keep a stable party name for detail header
  useEffect(() => {
    const partyId = selectedRepair?.customer_party_id ?? "";
    if (!partyId) {
      setDetailPartyName("");
      return;
    }
    const option = (partiesQuery.data ?? []).find((p) => p.value === partyId);
    setDetailPartyName(option?.label ?? selectedRepair?.customer_name ?? "");
  }, [selectedRepair?.customer_party_id, selectedRepair?.customer_name, partiesQuery.data]);

  // Hydrate detail draft when selection changes
  useEffect(() => {
    if (!selectedRepair) {
      setDetailDraft(null);
      return;
    }
    setDetailDraft({
      id: selectedRepair.repair_line_id,
      modelId: "",
      modelText: selectedRepair.model_name ?? selectedRepair.model_name_raw ?? "",
      suffix: selectedRepair.suffix ?? "",
      materialCode: selectedRepair.material_code ?? "",
      color: selectedRepair.color ?? "",
      qty: String(selectedRepair.qty ?? 1),
      issueDesc: selectedRepair.issue_desc ?? "",
      memo: selectedRepair.memo ?? "",
      requestedDueDate: selectedRepair.requested_due_date ? formatDateYmd(selectedRepair.requested_due_date) : "",
      priorityCode: (selectedRepair.priority_code ?? "NORMAL") as "NORMAL" | "URGENT" | "VVIP",
      weightReceivedG: selectedRepair.weight_received_g !== null && selectedRepair.weight_received_g !== undefined ? String(selectedRepair.weight_received_g) : "",
      measuredWeightG: selectedRepair.measured_weight_g !== null && selectedRepair.measured_weight_g !== undefined ? String(selectedRepair.measured_weight_g) : "",
      isPlated: Boolean(selectedRepair.is_plated),
      platingVariantId: selectedRepair.plating_variant_id ?? "",
      repairFeeKrw: selectedRepair.repair_fee_krw !== null && selectedRepair.repair_fee_krw !== undefined ? String(selectedRepair.repair_fee_krw) : "",
      repairFeeReason: selectedRepair.repair_fee_reason ?? "",
      isPaid: Boolean(selectedRepair.is_paid),
    });
  }, [selectedRepair]);

  // ---- data: draft shipments for selected party (only used in send modal)
  const draftShipmentsQuery = useQuery<ShipmentHeaderRow[]>({
    queryKey: ["repairs-draft-shipments", selectedRepair?.customer_party_id],
    enabled: Boolean(schemaClient && selectedRepair?.customer_party_id && sendOpen),
    queryFn: async () => {
      if (!schemaClient || !selectedRepair?.customer_party_id) return [];
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select("shipment_id, status, created_at, ship_date, confirmed_at, memo")
        .eq("customer_party_id", selectedRepair.customer_party_id)
        .eq("status", "DRAFT")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ShipmentHeaderRow[];
    },
  });

  const draftShipmentOptions = useMemo(() => {
    return (draftShipmentsQuery.data ?? []).map((row) => {
      const created = row.created_at ? formatDateTimeKst(row.created_at) : "-";
      const memo = (row.memo ?? "").trim();
      const label = memo ? `#${row.shipment_id.slice(0, 6)} · ${created} · ${memo}` : `#${row.shipment_id.slice(0, 6)} · ${created}`;
      return { value: row.shipment_id, label };
    });
  }, [draftShipmentsQuery.data]);

  // ---- mutations
  const createRepairMutation = useRpcMutation<{ repair_line_ids?: string[] | null } | string | null>({
    fn: CONTRACTS.functions.repairCreateV2,
    successMessage: "수리 접수 완료",
    onSuccess: (result) => {
      const createdPartyId = lastCreatePartyIdRef.current;
      const firstId = (() => {
        if (typeof result === "string") return normalizeId(result);
        if (result && typeof result === "object") {
          const any = result as { repair_line_id?: unknown; repair_line_ids?: unknown };
          const list = any.repair_line_ids;
          if (Array.isArray(list) && list.length > 0) return normalizeId(list[0]);
          return normalizeId(any.repair_line_id);
        }
        return null;
      })();

      // Reset create modal
      setCreateOpen(false);
      setCreatePartyId("");
      setCreateHeaderNote("");
      setCreateLines([createEmptyLine()]);
      setCreateLineFiles({});

      // Make the newly created line visible even if user had filters on.
      if (createdPartyId) setPartyFilter(createdPartyId);
      setStatusFilter("RECEIVED");
      setQuery("");
      setOnlyOverdue(false);
      setOnlyUnshipped(false);

      if (firstId) setSelectedRepairId(firstId);
      repairsQuery.refetch();
    },
  });

  const updateRepairMutation = useRpcMutation<{ repair_line_id?: string | null } | string | null>({
    fn: CONTRACTS.functions.repairUpdateV2,
    successMessage: "저장 완료",
    onSuccess: () => {
      repairsQuery.refetch();
    },
  });

  const setStatusMutation = useRpcMutation<void>({
    fn: CONTRACTS.functions.repairSetStatusV2,
    successMessage: "상태 변경 완료",
    onSuccess: () => repairsQuery.refetch(),
  });

  const sendToShipmentMutation = useRpcMutation<{ shipment_id?: string | null } | string | null>({
    fn: CONTRACTS.functions.repairSendToShipmentV2,
    successMessage: "출고로 전송 완료",
    onSuccess: () => {
      repairsQuery.refetch();
    },
  });

  const confirmShipmentMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentConfirm,
    successMessage: "출고 확정 완료",
    onSuccess: () => {
      repairsQuery.refetch();
    },
  });

  // ---- derived: KPIs
  const kpis = useMemo(() => {
    const rows = repairsQuery.data ?? [];
    const overdue = rows.filter((r) => Boolean(r.is_overdue)).length;
    const ready = rows.filter((r) => (r.status ?? "").trim() === "READY_TO_SHIP").length;
    const received = rows.filter((r) => (r.status ?? "").trim() === "RECEIVED").length;
    const unpaidFee = rows.filter((r) => (r.repair_fee_krw ?? 0) > 0 && !r.is_paid).length;
    return { total: rows.length, overdue, ready, received, unpaidFee };
  }, [repairsQuery.data]);

  const canSaveDetail = Boolean(selectedRepair && detailDraft && !updateRepairMutation.isPending);
  const isSendActionPending = sendToShipmentMutation.isPending || confirmShipmentMutation.isPending;
  const canSend = Boolean(selectedRepair && !isSendActionPending);

  const closeSendModalAndReset = () => {
    setSendOpen(false);
    setSendExtraFee("");
    setSendExtraFeeReason("");
    setSendNote("");
    setSendMode("NEW");
    setTargetShipmentId("");
  };

  const openSendModal = () => {
    const draftFee = parseNumberInput(detailDraft?.repairFeeKrw ?? null);
    const selectedFee = selectedRepair?.repair_fee_krw ?? null;
    const nextFee = draftFee ?? (typeof selectedFee === "number" ? selectedFee : null);
    const draftReason = (detailDraft?.repairFeeReason ?? "").trim();
    const selectedReason = (selectedRepair?.repair_fee_reason ?? "").trim();
    setSendOpen(true);
    setSendMode("NEW");
    setTargetShipmentId("");
    setSendExtraFee(nextFee !== null && Number.isFinite(nextFee) ? String(nextFee) : "");
    setSendExtraFeeReason(draftReason || selectedReason);
    setSendNote((detailDraft?.memo ?? selectedRepair?.memo ?? "").trim());
  };

  const handleCreateLineModelChange = (lineId: string, modelId: string) => {
    const master = masterMap.get(modelId);
    const nextName = (master?.model_name ?? "").trim();
    const nextMaterial = (master?.material_code_default ?? "").trim();
    setCreateLines((prev) =>
      prev.map((line) =>
        line.id !== lineId
          ? line
          : {
            ...line,
            modelId,
            modelText: nextName || line.modelText,
            materialCode: nextMaterial || line.materialCode,
          }
      )
    );
  };

  const uploadRepairImage = async (repairLineId: string, file: File) => {
    const formData = new FormData();
    formData.append("repair_line_id", repairLineId);
    formData.append("file", file);
    const res = await fetch("/api/repairs-images", { method: "POST", body: formData });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(json?.error ?? "수리 이미지 업로드 실패");
    }
  };

  const uploadImagesForCreatedLines = async (lineIds: string[], filesByDraftId: Record<string, File[]>, lines: CreateLineDraft[]) => {
    for (let index = 0; index < lineIds.length; index += 1) {
      const repairLineId = lineIds[index];
      const draftId = lines[index]?.id;
      if (!repairLineId || !draftId) continue;
      const files = filesByDraftId[draftId] ?? [];
      for (const file of files) {
        await uploadRepairImage(repairLineId, file);
      }
    }
  };

  const handleSubmitCreate = async () => {
    if (!createPartyId) throw new Error("거래처를 선택하세요");
    lastCreatePartyIdRef.current = createPartyId;
    const lines = createLines
      .map((line) => {
        const modelName = (line.modelText ?? "").trim();
        const qty = parseNumberInput(line.qty) ?? 0;
        const issue = (line.issueDesc ?? "").trim();
        if (!modelName || qty <= 0 || !issue) return null;
        const material = (line.materialCode ?? "").trim() || null;
        const due = (line.requestedDueDate ?? "").trim() || null;
        const priority = (line.priorityCode ?? "NORMAL").trim() || "NORMAL";

        const weightReceived = parseNumberInput(line.weightReceivedG);
        const platingId = (line.platingVariantId ?? "").trim() || null;

        return {
          model_name: modelName,
          model_name_raw: null,
          suffix: (line.suffix ?? "").trim() || null,
          material_code: material,
          color: (line.color ?? "").trim() || null,
          qty: Math.trunc(qty),
          issue_desc: issue,
          memo: (line.memo ?? "").trim() || null,
          requested_due_date: due,
          priority_code: priority,
          weight_received_g: weightReceived,
          is_plated: platingId ? true : Boolean(line.isPlated),
          plating_variant_id: platingId,
          // ✅ repair fee is decided later (when sending to shipment)
          repair_fee_krw: 0,
          repair_fee_reason: null,
          is_paid: false,
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    if (lines.length === 0) throw new Error("최소 1개 라인(모델/수량/수리내용)을 입력하세요");

    const filesSnapshot = { ...createLineFiles };
    const linesSnapshot = [...createLines];

    const result = await createRepairMutation.mutateAsync({
      p_party_id: createPartyId,
      p_notes: createHeaderNote.trim() || null,
      p_lines: lines,
      p_actor_person_id: actorId || null,
    });

    const createdIds = extractRepairLineIds(result);
    if (createdIds.length > 0) {
      await uploadImagesForCreatedLines(createdIds, filesSnapshot, linesSnapshot);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedRepair || !detailDraft) return;
    const repairLineId = selectedRepair.repair_line_id;
    const modelName = detailDraft.modelText.trim();
    const qty = parseNumberInput(detailDraft.qty) ?? 0;
    if (!modelName) throw new Error("모델명을 입력하세요");
    if (qty <= 0) throw new Error("수량을 확인하세요");
    const issue = detailDraft.issueDesc.trim();
    if (!issue) throw new Error("수리 내용을 입력하세요");

    const weightReceived = parseNumberInput(detailDraft.weightReceivedG);
    const measuredWeight = parseNumberInput(detailDraft.measuredWeightG);
    const weightForUpdate = measuredWeight ?? weightReceived;
    const fee = parseNumberInput(detailDraft.repairFeeKrw);
    const feeReason = detailDraft.repairFeeReason.trim() || null;
    const platingId = (detailDraft.platingVariantId ?? "").trim() || null;

    await updateRepairMutation.mutateAsync({
      p_repair_line_id: repairLineId,
      p_received_at: selectedRepair.received_at ?? null,
      p_requested_due_date: detailDraft.requestedDueDate.trim() || null,
      p_priority_code: detailDraft.priorityCode ?? "NORMAL",
      p_model_name: modelName,
      p_suffix: detailDraft.suffix.trim() || null,
      p_material_code: detailDraft.materialCode.trim() || null,
      p_color: detailDraft.color.trim() || null,
      p_qty: Math.trunc(qty),
      p_issue_desc: issue,
      p_memo: detailDraft.memo.trim() || null,
      p_weight_received_g: weightForUpdate,
      p_is_plated: platingId ? true : Boolean(detailDraft.isPlated),
      p_plating_variant_id: platingId,
      p_repair_fee_krw: fee,
      p_repair_fee_reason: feeReason,
      p_is_paid: Boolean(detailDraft.isPaid),
      p_actor_person_id: actorId || null,
    });
  };

  const handleUploadDetailImages = async (files: FileList | null) => {
    if (!selectedRepair?.repair_line_id || !files || files.length === 0) return;
    setDetailUploadBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadRepairImage(selectedRepair.repair_line_id, file);
      }
      await repairImagesQuery.refetch();
    } finally {
      setDetailUploadBusy(false);
    }
  };

  const handleSetStatus = async (nextStatus: string) => {
    if (!selectedRepair) return;
    await setStatusMutation.mutateAsync({
      p_repair_id: selectedRepair.repair_line_id,
      p_status: nextStatus,
      p_actor_person_id: actorId || null,
    });
  };

  const handleSendToShipment = async () => {
    if (!selectedRepair) return;
    const extraFee = parseNumberInput(sendExtraFee) ?? 0;
    if (extraFee > 0 && !sendExtraFeeReason.trim()) {
      throw new Error("수리비 사유를 입력하세요");
    }
    const useExisting = sendMode === "EXISTING";
    if (useExisting && !targetShipmentId.trim()) {
      throw new Error("기존 출고를 선택하세요");
    }

    await sendToShipmentMutation.mutateAsync({
      p_repair_id: selectedRepair.repair_line_id,
      p_target_shipment_id: useExisting ? targetShipmentId.trim() : null,
      p_extra_fee_krw: extraFee,
      p_extra_fee_reason: extraFee > 0 ? sendExtraFeeReason.trim() : null,
      p_note: sendNote.trim() || null,
      p_actor_person_id: actorId || null,
    });

    closeSendModalAndReset();
  };

  const handleSendToShipmentAndConfirm = async () => {
    if (!selectedRepair) return;
    const extraFee = parseNumberInput(sendExtraFee) ?? 0;
    if (extraFee > 0 && !sendExtraFeeReason.trim()) {
      throw new Error("수리비 사유를 입력하세요");
    }
    const useExisting = sendMode === "EXISTING";
    if (useExisting && !targetShipmentId.trim()) {
      throw new Error("기존 출고를 선택하세요");
    }

    const sendResult = await sendToShipmentMutation.mutateAsync({
      p_repair_id: selectedRepair.repair_line_id,
      p_target_shipment_id: useExisting ? targetShipmentId.trim() : null,
      p_extra_fee_krw: extraFee,
      p_extra_fee_reason: extraFee > 0 ? sendExtraFeeReason.trim() : null,
      p_note: sendNote.trim() || null,
      p_actor_person_id: actorId || null,
    });

    const shipmentId = extractShipmentId(sendResult);
    if (!shipmentId) {
      throw new Error("전송은 완료됐지만 shipment_id를 받지 못했습니다. 출고 화면에서 직접 확정해주세요.");
    }

    {
      const prepRes = await fetch("/api/repairs-prepare-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: shipmentId,
          repair_line_id: selectedRepair.repair_line_id,
          material_code: resolveMaterialCodeForShipment(selectedRepair.material_code),
        }),
      });
      if (!prepRes.ok) {
        const json = (await prepRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(`출고 라인 보정 실패: ${json?.error ?? `HTTP ${prepRes.status}`}`);
      }
    }

    await confirmShipmentMutation.mutateAsync({
      p_shipment_id: shipmentId,
      p_actor_person_id: actorId || null,
      p_note: "confirm from repairs send",
      p_emit_inventory: true,
      p_cost_mode: "PROVISIONAL",
      p_receipt_id: null,
      p_cost_lines: [],
      p_force: false,
    });

    closeSendModalAndReset();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]">
      {/* LEFT SIDEBAR - Repair List */}
      <div className="w-72 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              수리 관리
            </h2>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + 접수
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <input
              placeholder="모델명/메모 검색..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--chip)] border-none text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* Filter Chips */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(statusFilter === opt.value ? "" : opt.value)}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium rounded-md transition-colors border",
                  statusFilter === opt.value
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="rounded"
              />
              지연만
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={onlyUnshipped}
                onChange={(e) => setOnlyUnshipped(e.target.checked)}
                className="rounded"
              />
              미출고만
            </label>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-2 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">총 {filteredRepairs.length}건</span>
          <div className="flex gap-3">
            <span><span className="text-amber-600 font-medium">{kpis.overdue}</span> 지연</span>
            <span><span className="text-red-600 font-medium">{kpis.unpaidFee}</span> 미결제</span>
          </div>
        </div>

        {/* Repair List */}
        <div className="flex-1 overflow-y-auto">
          {repairsQuery.isError ? (
            <div className="p-6 text-center">
              <div className="text-sm text-red-600 mb-2">조회 실패</div>
              <Button variant="secondary" size="sm" onClick={() => repairsQuery.refetch()}>
                다시 시도
              </Button>
            </div>
          ) : repairsQuery.isPending ? (
            <div className="p-6 text-center text-sm text-[var(--muted)]">불러오는 중…</div>
          ) : filteredRepairs.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] text-sm">
              조건에 맞는 수리가 없습니다.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredRepairs.map((row) => {
                const badge = statusBadge(row.status);
                const due = dueBadge(row);
                const active = row.repair_line_id === selectedRepairId;
                const fee = row.repair_fee_krw ?? 0;
                const isPaid = Boolean(row.is_paid);

                return (
                  <button
                    key={row.repair_line_id}
                    onClick={() => setSelectedRepairId(row.repair_line_id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all border",
                      active
                        ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-[var(--chip)] hover:border-[var(--panel-border)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn("font-medium truncate text-sm", active && "text-[var(--primary)]")}>
                        {row.model_name ?? row.model_name_raw ?? "-"}
                      </span>
                      <span className={cn(
                        "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded",
                        badge.tone === "active" && "bg-green-100 text-green-700",
                        badge.tone === "warning" && "bg-amber-100 text-amber-700",
                        badge.tone === "danger" && "bg-red-100 text-red-700",
                        badge.tone === "neutral" && "bg-gray-100 text-gray-600"
                      )}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)] truncate mb-1">
                      {row.customer_name ?? (partiesQuery.data ?? []).find((p) => p.value === row.customer_party_id)?.label ?? ""}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>{formatDateYmd(row.received_at)}</span>
                      <div className="flex items-center gap-2">
                        {due && (
                          <span className={cn(
                            "font-medium",
                            due.tone === "danger" && "text-red-600",
                            due.tone === "warning" && "text-amber-600"
                          )}>
                            {due.label}
                          </span>
                        )}
                        {fee > 0 && (
                          <span className={isPaid ? "text-green-600" : "text-red-600"}>
                            {formatKrw(fee)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">
        {selectedRepair && detailDraft ? (
          <>
            {/* Detail Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                      {selectedRepair.model_name ?? selectedRepair.model_name_raw ?? "모델명 없음"}
                    </h1>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      statusBadge(selectedRepair.status).tone === "active" && "bg-green-100 text-green-700",
                      statusBadge(selectedRepair.status).tone === "warning" && "bg-amber-100 text-amber-700",
                      statusBadge(selectedRepair.status).tone === "danger" && "bg-red-100 text-red-700",
                      statusBadge(selectedRepair.status).tone === "neutral" && "bg-gray-100 text-gray-600"
                    )}>
                      {statusBadge(selectedRepair.status).label}
                    </span>
                    {selectedRepair.is_overdue && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">지연</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    {detailPartyName} · 접수일 {formatDateYmd(selectedRepair.received_at)}
                    {selectedRepair.requested_due_date && ` · 납기 ${formatDateYmd(selectedRepair.requested_due_date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    className="h-8 text-xs"
                    value={(selectedRepair.status ?? "").trim()}
                    onChange={(e) => handleSetStatus(e.target.value)}
                    disabled={setStatusMutation.isPending}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => repairsQuery.refetch()}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">수량</p>
                  <p className="text-lg font-bold">{selectedRepair.qty ?? 1}개</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">소재</p>
                  <p className="text-lg font-bold">{selectedRepair.material_code || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">수리비</p>
                  <p className={cn("text-lg font-bold", (selectedRepair.repair_fee_krw ?? 0) > 0 ? (selectedRepair.is_paid ? "text-green-600" : "text-red-600") : "")}>
                    {(selectedRepair.repair_fee_krw ?? 0) > 0 ? formatKrw(selectedRepair.repair_fee_krw) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">우선순위</p>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedRepair.priority_code === "URGENT" && "text-amber-600",
                    selectedRepair.priority_code === "VVIP" && "text-red-600"
                  )}>
                    {PRIORITY_OPTIONS.find(p => p.value === selectedRepair.priority_code)?.label ?? "일반"}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto w-full max-w-[1440px] space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Issue Description */}
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                      수리 요청사항
                    </h3>
                    <Textarea
                      rows={2}
                      className="bg-[var(--chip)] border-none"
                      placeholder="수리 내용을 입력하세요..."
                      value={detailDraft.issueDesc}
                      onChange={(e) => setDetailDraft(prev => prev ? { ...prev, issueDesc: e.target.value } : prev)}
                    />
                  </div>

                  {/* Form Fields */}
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <h3 className="text-sm font-bold mb-4">상세 정보</h3>
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">모델명</label>
                        <Input
                          value={detailDraft.modelText}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, modelText: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">수량</label>
                        <Input
                          type="number"
                          value={detailDraft.qty}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, qty: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">소재</label>
                        <Select
                          value={detailDraft.materialCode}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, materialCode: e.target.value } : prev)}
                        >
                          <option value="">-</option>
                          {MATERIAL_OPTIONS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">우선순위</label>
                        <Select
                          value={detailDraft.priorityCode}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, priorityCode: e.target.value as any } : prev)}
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">납기 요청일</label>
                        <Input
                          type="date"
                          autoFormat={false}
                          value={detailDraft.requestedDueDate}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, requestedDueDate: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">접수중량(g)</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={detailDraft.weightReceivedG}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, weightReceivedG: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">실측중량(g)</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={detailDraft.measuredWeightG}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, measuredWeightG: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">도금</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={detailDraft.isPlated}
                            onChange={(e) => setDetailDraft(prev => prev ? { ...prev, isPlated: e.target.checked } : prev)}
                            className="rounded"
                          />
                          <span className="text-sm">있음</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Memo */}
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <h3 className="text-sm font-bold mb-3">내부 메모</h3>
                    <Textarea
                      rows={2}
                      className="bg-[var(--chip)] border-none"
                      placeholder="내부 참고사항..."
                      value={detailDraft.memo}
                      onChange={(e) => setDetailDraft(prev => prev ? { ...prev, memo: e.target.value } : prev)}
                    />
                  </div>

                  {/* Images */}
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold">첨부 사진</h3>
                      <label className="text-xs text-[var(--primary)] hover:underline cursor-pointer font-medium">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={detailUploadBusy}
                          onChange={(e) => {
                            void handleUploadDetailImages(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                        + 사진 추가
                      </label>
                    </div>
                    {repairImagesQuery.isFetching ? (
                      <div className="h-24 flex items-center justify-center text-xs text-[var(--muted)]">로딩 중...</div>
                    ) : (repairImagesQuery.data ?? []).length === 0 ? (
                      <div className="h-24 flex items-center justify-center border-2 border-dashed border-[var(--panel-border)] rounded-lg text-xs text-[var(--muted)]">
                        등록된 사진이 없습니다
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {(repairImagesQuery.data ?? []).map((img) => (
                          <a
                            key={img.path}
                            href={img.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="aspect-square rounded-lg overflow-hidden border border-[var(--panel-border)] hover:opacity-80 transition-opacity"
                          >
                            <img src={img.signedUrl} className="w-full h-full object-cover" alt="" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fee Section */}
                {((parseNumberInput(detailDraft.repairFeeKrw) ?? 0) > 0 || (selectedRepair.repair_fee_krw ?? 0) > 0) && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <h3 className="text-sm font-bold mb-3 text-amber-800">수리비 정산</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-amber-700 block mb-1.5">금액(원)</label>
                        <Input
                          value={detailDraft.repairFeeKrw}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, repairFeeKrw: e.target.value } : prev)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-amber-700 block mb-1.5">사유</label>
                        <Input
                          value={detailDraft.repairFeeReason}
                          onChange={(e) => setDetailDraft(prev => prev ? { ...prev, repairFeeReason: e.target.value } : prev)}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={detailDraft.isPaid}
                        onChange={(e) => setDetailDraft(prev => prev ? { ...prev, isPaid: e.target.checked } : prev)}
                        className="rounded"
                      />
                      <span className={detailDraft.isPaid ? "text-green-700 font-medium" : "text-amber-700"}>
                        {detailDraft.isPaid ? "결제 완료" : "미결제"}
                      </span>
                    </label>
                  </div>
                )}

                {/* Linked Shipment */}
                {selectedRepair.linked_shipment_id && (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <div>
                      <h3 className="text-sm font-bold text-blue-800 mb-1">출고 연결됨</h3>
                      <p className="text-xs text-blue-600">
                        {selectedRepair.linked_shipment_status} · {selectedRepair.linked_shipment_confirmed_at ? formatDateTimeKst(selectedRepair.linked_shipment_confirmed_at) : "미확정"}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-blue-500">{selectedRepair.linked_shipment_id.slice(0, 8)}...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Footer */}
            <div className="shrink-0 border-t border-[var(--panel-border)] bg-[var(--panel)] px-6 py-4 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!selectedRepair) return;
                  setDetailDraft({
                    id: selectedRepair.repair_line_id,
                    modelId: "",
                    modelText: selectedRepair.model_name ?? selectedRepair.model_name_raw ?? "",
                    suffix: selectedRepair.suffix ?? "",
                    materialCode: selectedRepair.material_code ?? "",
                    color: selectedRepair.color ?? "",
                    qty: String(selectedRepair.qty ?? 1),
                    issueDesc: selectedRepair.issue_desc ?? "",
                    memo: selectedRepair.memo ?? "",
                    requestedDueDate: selectedRepair.requested_due_date ? formatDateYmd(selectedRepair.requested_due_date) : "",
                    priorityCode: (selectedRepair.priority_code ?? "NORMAL") as any,
                    weightReceivedG: selectedRepair.weight_received_g ? String(selectedRepair.weight_received_g) : "",
                    measuredWeightG: selectedRepair.measured_weight_g ? String(selectedRepair.measured_weight_g) : "",
                    isPlated: Boolean(selectedRepair.is_plated),
                    platingVariantId: selectedRepair.plating_variant_id ?? "",
                    repairFeeKrw: selectedRepair.repair_fee_krw ? String(selectedRepair.repair_fee_krw) : "",
                    repairFeeReason: selectedRepair.repair_fee_reason ?? "",
                    isPaid: Boolean(selectedRepair.is_paid),
                  });
                }}
              >
                변경 취소
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={openSendModal} disabled={!canSend}>
                  출고로 보내기
                </Button>
                <Button onClick={handleSaveDetail} disabled={!canSaveDetail}>
                  저장
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
            <div className="text-center">
              <Wrench className="mx-auto mb-4 h-16 w-16 opacity-10" />
              <p className="text-lg font-medium mb-1">수리 건을 선택하세요</p>
              <p className="text-sm">왼쪽 목록에서 수리 건을 클릭하면 상세 정보가 표시됩니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateLineFiles({});
        }}
        title="수리 접수"
        description="거래처를 선택하고, 여러 라인을 한 번에 접수할 수 있습니다."
      >
        <div className="space-y-4">
          <SearchSelect
            label="거래처(필수)"
            placeholder="거래처 검색"
            options={partiesQuery.data ?? []}
            value={createPartyId}
            onChange={(value) => setCreatePartyId(value)}
            floating
          />

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">헤더 메모(선택)</p>
            <Input value={createHeaderNote} onChange={(e) => setCreateHeaderNote(e.target.value)} placeholder="예: 고객이 방문 예정" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">라인</div>
              <Button
                variant="secondary"
                onClick={() => setCreateLines((prev) => [...prev, createEmptyLine()])}
              >
                라인 추가
              </Button>
            </div>

            {createLines.map((line, idx) => (
              <Card key={line.id} className="border-[var(--panel-border)]">
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">#{idx + 1}</div>
                    {createLines.length > 1 ? (
                      <Button
                        variant="ghost"
                        onClick={() => setCreateLines((prev) => prev.filter((v) => v.id !== line.id))}
                      >
                        삭제
                      </Button>
                    ) : null}
                  </div>

                  <SearchSelect
                    label="모델 선택(선택)"
                    placeholder="모델명 검색"
                    options={masterOptions}
                    value={line.modelId}
                    onChange={(value) => handleCreateLineModelChange(line.id, value)}
                    floating
                    columns={2}
                  />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">모델명(필수)</p>
                      <Input
                        value={line.modelText}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, modelText: e.target.value } : v)))
                        }
                        placeholder="예: 루체 반지"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수량(필수)</p>
                      <Input
                        type="number"
                        value={line.qty}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, qty: e.target.value } : v)))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">소재</p>
                      <Select
                        value={line.materialCode}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, materialCode: e.target.value } : v)))
                        }
                      >
                        <option value="">-</option>
                        {MATERIAL_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">우선순위</p>
                      <Select
                        value={line.priorityCode}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, priorityCode: e.target.value as CreateLineDraft["priorityCode"] } : v)))
                        }
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">납기</p>
                      <Input
                        type="date"
                        value={line.requestedDueDate}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, requestedDueDate: e.target.value } : v)))
                        }
                        autoFormat={false}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">색상</p>
                      <Input
                        value={line.color}
                        onChange={(e) =>
                          setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, color: e.target.value } : v)))
                        }
                        placeholder="예: W / Y / G"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수리 내용(필수)</p>
                    <Textarea
                      rows={3}
                      value={line.issueDesc}
                      onChange={(e) =>
                        setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, issueDesc: e.target.value } : v)))
                      }
                      placeholder="예: 길이 2cm 늘림 / 잠금장치 교체"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">메모</p>
                    <Textarea
                      rows={2}
                      value={line.memo}
                      onChange={(e) =>
                        setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, memo: e.target.value } : v)))
                      }
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수리 사진</p>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setCreateLineFiles((prev) => ({ ...prev, [line.id]: files }));
                      }}
                    />
                    {(createLineFiles[line.id] ?? []).length > 0 ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        {(createLineFiles[line.id] ?? []).map((file) => file.name).join(", ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">추가 정보(선택)</div>

                    <SearchSelect
                      label="도금"
                      placeholder="도금명 검색"
                      options={[{ value: "", label: "-" }, ...platingOptions]}
                      value={line.platingVariantId}
                      onChange={(value) =>
                        setCreateLines((prev) =>
                          prev.map((v) =>
                            v.id === line.id
                              ? {
                                ...v,
                                platingVariantId: value,
                                isPlated: Boolean(value) ? true : v.isPlated,
                              }
                              : v
                          )
                        )
                      }
                      columns={2}
                      floating
                    />
                    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={line.isPlated}
                        onChange={(e) =>
                          setCreateLines((prev) =>
                            prev.map((v) =>
                              v.id === line.id
                                ? {
                                  ...v,
                                  isPlated: e.target.checked,
                                  platingVariantId: e.target.checked ? v.platingVariantId : "",
                                }
                                : v
                            )
                          )
                        }
                      />
                      도금 있음
                    </label>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">접수중량(g)</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={line.weightReceivedG}
                          onChange={(e) =>
                            setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, weightReceivedG: e.target.value } : v)))
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">실측중량(g)</p>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={line.measuredWeightG}
                          onChange={(e) =>
                            setCreateLines((prev) => prev.map((v) => (v.id === line.id ? { ...v, measuredWeightG: e.target.value } : v)))
                          }
                        />
                      </div>
                    </div>

                    <div className="text-xs text-[var(--muted)]">
                      수리비는 접수 단계에서 확정하지 않습니다. 수리 완료 후 <span className="font-semibold">출고로 보내기</span>에서 입력하세요.
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setCreateLineFiles({});
              }}
            >
              닫기
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createRepairMutation.isPending}>
              접수 저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- Send Modal ---- */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="출고로 보내기"
        description="수리 라인을 출고(Shipment) 라인으로 생성/추가합니다."
      >
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-sm">
            <div className="font-semibold text-[var(--foreground)]">
              {selectedRepair?.model_name ?? selectedRepair?.model_name_raw ?? "-"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {detailPartyName || ""} · 수량 {selectedRepair?.qty ?? 1}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">전송 방식</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={sendMode === "NEW" ? "primary" : "secondary"}
                onClick={() => {
                  setSendMode("NEW");
                  setTargetShipmentId("");
                }}
              >
                새 출고 생성
              </Button>
              <Button
                type="button"
                variant={sendMode === "EXISTING" ? "primary" : "secondary"}
                onClick={() => setSendMode("EXISTING")}
                disabled={(draftShipmentsQuery.data ?? []).length === 0}
              >
                기존 드래프트에 추가
              </Button>
            </div>
            {sendMode === "EXISTING" ? (
              <SearchSelect
                label="드래프트 출고 선택"
                placeholder="shipment 검색"
                options={draftShipmentOptions}
                value={targetShipmentId}
                onChange={(value) => setTargetShipmentId(value)}
                floating
              />
            ) : null}
            {(draftShipmentsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-[var(--muted)]">선택 가능한 드래프트 출고가 없습니다. (새 출고로 생성하세요)</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">수리비(원)</p>
              <Input type="number" value={sendExtraFee} onChange={(e) => setSendExtraFee(e.target.value)} placeholder="0" />
              <p className="mt-1 text-xs text-[var(--muted)]">접수 단계에서는 0으로 두고, 수리 완료 시점에 입력하세요.</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">사유</p>
              <Input value={sendExtraFeeReason} onChange={(e) => setSendExtraFeeReason(e.target.value)} placeholder="예: 추가 도금" />
              <p className="mt-1 text-xs text-[var(--muted)]">수리비가 0보다 크면 사유는 필수입니다.</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">출고 라인 메모(선택)</p>
            <Textarea rows={3} value={sendNote} onChange={(e) => setSendNote(e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setSendOpen(false)}>
              닫기
            </Button>
            <Button variant="secondary" onClick={handleSendToShipment} disabled={isSendActionPending}>
              전송
            </Button>
            <Button onClick={handleSendToShipmentAndConfirm} disabled={isSendActionPending}>
              전송 후 확정
            </Button>
          </div>
        </div>
      </Modal>
    </div >
  );
}
