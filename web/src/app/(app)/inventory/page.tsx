"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Package, PackageCheck, ClipboardList, Wrench, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LOCATION_OPTIONS = [
  { value: "MAIN", label: "메인" },
  { value: "WAREHOUSE", label: "창고" },
  { value: "SHOP", label: "매장" },
  { value: "FACTORY", label: "공장" },
] as const;

// ===================== TYPES =====================
type PositionRow = {
  location_code?: string | null;
  master_id: string;
  model_name: string;
  on_hand_qty: number;
  last_move_at?: string | null;
};

type MoveRow = {
  move_line_id?: string;
  move_id?: string;
  move_no?: number | string;
  move_type?: string;
  status?: string;
  occurred_at?: string;
  party_id?: string;
  party_name?: string;
  line_count?: number;
  total_in_qty?: number;
  total_out_qty?: number;
  memo?: string;
  master_model_name?: string | null;
  item_name?: string | null;
  direction?: string | null;
  qty?: number | null;
};

type SessionRow = {
  session_id: string;
  session_no: number;
  session_code?: string;
  snapshot_at: string;
  status: string;
  line_count: number;
  delta_line_count: number;
  sum_abs_delta: number;
  generated_move_id?: string;
  generated_move_status?: string;
  created_at: string;
  location_code?: string | null;
};

type FinalizeResult = {
  generated_move_id?: string | null;
  nonzero_delta_lines?: number | null;
};

type CountLineRow = {
  count_line_id: string;
  line_no: number;
  item_ref_type: string;
  item_name: string;
  variant_hint?: string;
  counted_qty: number;
  system_qty_asof?: number;
  delta_qty?: number;
  abs_delta_qty?: number;
  is_void: boolean;
  master_id?: string;
};

type MasterItem = {
  master_id: string;
  model_name: string;
  vendor_name?: string;
  category_code?: string;
  material_code_default?: string;
  weight_default_g?: number;
  deduction_weight_default_g?: number;
  center_qty_default?: number;
  sub1_qty_default?: number;
  sub2_qty_default?: number;
  plating_price_sell_default?: number;
  plating_price_cost_default?: number;
  labor_base_sell?: number;
  labor_center_sell?: number;
  labor_sub1_sell?: number;
  labor_sub2_sell?: number;
  labor_base_cost?: number;
  labor_center_cost?: number;
  labor_sub1_cost?: number;
  labor_sub2_cost?: number;
  color?: string;
  symbol?: string;
  photo_url?: string;
  image_path?: string;
};

type QuickMoveForm = {
  move_type: "RECEIPT" | "ISSUE" | "ADJUST";
  location_code: string;
  model_name: string;
  master_id?: string;
  session_id?: string;
  qty: number;
  material_code?: string;
  category_code?: string;
  base_weight_g?: number;
  deduction_weight_g?: number;
  center_qty?: number;
  sub1_qty?: number;
  sub2_qty?: number;
  plating_sell?: number;
  plating_cost?: number;
  labor_base_sell?: number;
  labor_base_cost?: number;
  memo: string;
};

type SessionForm = {
  location_code: string;
  session_code: string;
  memo: string;
};

type CountLineForm = {
  item_name: string;
  counted_qty: number;
  variant_hint: string;
  master_id?: string;
};

// ===================== HELPERS =====================
const formatKst = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const getImageUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL not set");
    return null;
  }
  const bucketName =
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || "master_images";
  const cleanPath = path.startsWith(`${bucketName}/`) ? path.slice(bucketName.length + 1) : path;
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanPath}`;
};

// ===================== MAIN COMPONENT =====================
export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [mobileSection, setMobileSection] = useState<"position" | "moves" | "stocktake" | "actions">(
    "position"
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedMasterName, setSelectedMasterName] = useState("");

  const [selectedQuickMaster, setSelectedQuickMaster] = useState<MasterItem | null>(null);
  const [masterSearchQuery, setMasterSearchQuery] = useState("");
  const [masterSearchContext, setMasterSearchContext] = useState<"quick" | "count" | null>(null);

  // ===================== POSITION TAB STATE =====================
  const [positionMode, setPositionMode] = useState<"total" | "byLocation">("total");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  // ===================== POSITION TAB DATA =====================
  const { data: positionData = [], isLoading: positionLoading } = useQuery({
    queryKey: ["inventory", "position", positionMode, selectedLocation],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const view =
        positionMode === "total"
          ? CONTRACTS.views.inventoryPositionByMaster
          : CONTRACTS.views.inventoryPositionByMasterLocation;

      let q = client.from(view).select("*").order("on_hand_qty", { ascending: false });

      if (positionMode === "byLocation" && selectedLocation) {
        if (selectedLocation === "__NULL__") q = q.is("location_code", null);
        else q = q.eq("location_code", selectedLocation);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data as PositionRow[]) ?? [];
    },
  });

  const filteredPosition = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return positionData;
    return positionData.filter((row) => (row.model_name || "").toLowerCase().includes(query));
  }, [positionData, searchTerm]);

  const selectedPositionRows = useMemo(() => {
    if (!selectedMasterId) return [];
    return positionData.filter((row) => row.master_id === selectedMasterId);
  }, [positionData, selectedMasterId]);

  const selectedPositionTotal = useMemo(() => {
    if (!selectedMasterId) return null;
    if (positionMode === "byLocation") {
      return selectedPositionRows.reduce((sum, row) => sum + row.on_hand_qty, 0);
    }
    const row = positionData.find((item) => item.master_id === selectedMasterId);
    return row?.on_hand_qty ?? null;
  }, [positionData, positionMode, selectedMasterId, selectedPositionRows]);

  const selectedMasterLabel = useMemo(() => {
    if (selectedMasterName) return selectedMasterName;
    if (!selectedMasterId) return "";
    return positionData.find((row) => row.master_id === selectedMasterId)?.model_name || "";
  }, [positionData, selectedMasterId, selectedMasterName]);

  useEffect(() => {
    if (filteredPosition.length === 0) {
      setSelectedMasterId(null);
      setSelectedMasterName("");
      return;
    }

    const exists = selectedMasterId
      ? filteredPosition.some((row) => row.master_id === selectedMasterId)
      : false;

    if (!exists) {
      const first = filteredPosition[0];
      setSelectedMasterId(first.master_id);
      setSelectedMasterName(first.model_name);
    }
  }, [filteredPosition, selectedMasterId]);

  // ===================== STOCKTAKE: SESSIONS =====================
  const { data: sessionsData = [] } = useQuery({
    queryKey: ["inventory", "stocktake", "sessions"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryCountSessions)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as SessionRow[]) ?? [];
    },
  });

  const filteredSessions = useMemo(() => {
    const query = sessionSearchQuery.toLowerCase().trim();
    if (!query) return sessionsData;
    return sessionsData.filter((session) => {
      return (
        (session.session_code?.toLowerCase() || "").includes(query) ||
        (session.location_code?.toLowerCase() || "").includes(query) ||
        String(session.session_no).includes(query)
      );
    });
  }, [sessionsData, sessionSearchQuery]);

  // ===================== MASTER SEARCH FOR MOVES TAB =====================
  const { data: masterSearchResults = [] } = useQuery({
    queryKey: ["master", "search", masterSearchQuery],
    queryFn: async () => {
      if (!masterSearchQuery || masterSearchQuery.length < 1) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.masterItemLookup)
        .select("*")
        .ilike("model_name", `%${masterSearchQuery}%`)
        .limit(10);
      if (error) throw error;
      return (data as MasterItem[]) ?? [];
    },
    enabled: masterSearchContext !== null && masterSearchQuery.length > 0,
  });

  // ===================== MOVES TAB DATA =====================
  const { data: movesData = [] } = useQuery({
    queryKey: ["inventory", "moves"],
    queryFn: async () => {
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryMoveLinesEnriched)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as MoveRow[]) ?? [];
    },
  });

  const filteredMoves = useMemo(() => {
    if (!selectedMasterLabel) return [];
    const target = selectedMasterLabel.toLowerCase();
    return movesData
      .filter((move) => {
        const name = (move.master_model_name || move.item_name || "").toLowerCase();
        return name.includes(target);
      })
      .slice(0, 12);
  }, [movesData, selectedMasterLabel]);

  // ===================== QUICK MOVE =====================
  const quickMoveForm = useForm<QuickMoveForm>({
    defaultValues: {
      move_type: "RECEIPT",
      location_code: "",
      model_name: "",
      master_id: undefined,
      session_id: undefined,
      qty: 0,
      material_code: undefined,
      category_code: undefined,
      base_weight_g: undefined,
      deduction_weight_g: undefined,
      center_qty: undefined,
      sub1_qty: undefined,
      sub2_qty: undefined,
      plating_sell: undefined,
      plating_cost: undefined,
      labor_base_sell: undefined,
      labor_base_cost: undefined,
      memo: "",
    },
  });

  const quickMoveMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.quickInventoryMove,
    successMessage: "등록 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      quickMoveForm.reset();
      setSelectedQuickMaster(null);
    },
  });

  const onSubmitQuickMove = (values: QuickMoveForm) => {
    if (values.base_weight_g === null || values.base_weight_g === undefined) {
      toast.error("기본 중량을 입력해주세요");
      return;
    }
    if (values.deduction_weight_g === null || values.deduction_weight_g === undefined) {
      toast.error("차감 중량을 입력해주세요");
      return;
    }

    if (!values.model_name || values.qty <= 0) {
      toast.error("품목명과 수량을 입력해주세요");
      return;
    }

    const resolvedLocation =
      values.location_code ||
      (values.session_id
        ? sessionsData.find((s) => s.session_id === values.session_id)?.location_code
        : null) ||
      null;

    if (!resolvedLocation) {
      toast.error("위치를 선택해주세요");
      return;
    }

    quickMoveMutation.mutate({
      p_move_type: values.move_type,
      p_item_name: values.model_name,
      p_qty: values.qty,
      p_occurred_at: new Date().toISOString(),
      p_party_id: null,
      p_location_code: resolvedLocation,
      p_master_id: values.master_id || null,
      p_variant_hint: values.material_code || null,
      p_unit: "EA",
      p_source: "MANUAL",
      p_memo: values.memo || null,
      p_meta: values.session_id ? { session_id: values.session_id } : {},
      p_idempotency_key: null,
      p_actor_person_id: null,
      p_note: values.session_id ? `Linked to session` : null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const handleMasterSelect = (master: MasterItem) => {
    setSelectedQuickMaster(master);
    quickMoveForm.setValue("model_name", master.model_name);
    quickMoveForm.setValue("master_id", master.master_id);
    setMasterSearchContext(null);
    setMasterSearchQuery("");
  };

  const handleCopyFromMaster = () => {
    if (!selectedQuickMaster) {
      toast.error("마스터를 먼저 선택해주세요");
      return;
    }

    quickMoveForm.setValue("material_code", selectedQuickMaster.material_code_default || "");
    quickMoveForm.setValue("category_code", selectedQuickMaster.category_code || "");
    quickMoveForm.setValue("center_qty", selectedQuickMaster.center_qty_default || 0);
    quickMoveForm.setValue("sub1_qty", selectedQuickMaster.sub1_qty_default || 0);
    quickMoveForm.setValue("sub2_qty", selectedQuickMaster.sub2_qty_default || 0);
    quickMoveForm.setValue("plating_sell", selectedQuickMaster.plating_price_sell_default || 0);
    quickMoveForm.setValue("plating_cost", selectedQuickMaster.plating_price_cost_default || 0);
    quickMoveForm.setValue("labor_base_sell", selectedQuickMaster.labor_base_sell || 0);
    quickMoveForm.setValue("labor_base_cost", selectedQuickMaster.labor_base_cost || 0);

    toast.info("마스터 데이터 복사됨 (중량 제외)");
  };

  const handleSelectPositionRow = (row: PositionRow) => {
    setSelectedMasterId(row.master_id);
    setSelectedMasterName(row.model_name);
    quickMoveForm.setValue("model_name", row.model_name);
    quickMoveForm.setValue("master_id", row.master_id);
  };

  // ===================== STOCKTAKE TAB DATA =====================
  const { data: sessionLinesData = [] } = useQuery({
    queryKey: ["inventory", "stocktake", "lines", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      const client = getSchemaClient();
      if (!client) throw new Error("No client");
      const { data, error } = await client
        .from(CONTRACTS.views.inventoryCountLinesEnriched)
        .select("*")
        .eq("session_id", selectedSessionId)
        .order("line_no", { ascending: true });
      if (error) throw error;
      return (data as CountLineRow[]) ?? [];
    },
    enabled: !!selectedSessionId,
  });

  const selectedSession = sessionsData.find((s) => s.session_id === selectedSessionId);
  const isFinalized = selectedSession?.status === "FINALIZED";

  const sessionForm = useForm<SessionForm>({
    defaultValues: {
      location_code: "",
      session_code: "",
      memo: "",
    },
  });

  const countLineForm = useForm<CountLineForm>({
    defaultValues: {
      item_name: "",
      counted_qty: 0,
      variant_hint: "",
    },
  });

  const createSessionMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.inventoryCountSessionCreate,
    successMessage: "실사 세션 생성 완료",
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      setSelectedSessionId(sessionId);
      sessionForm.reset();
    },
  });

  const addLineMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.inventoryCountLineAdd,
    successMessage: "라인 추가 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      countLineForm.reset();
    },
  });

  const finalizeMutation = useRpcMutation<FinalizeResult>({
    fn: CONTRACTS.functions.inventoryCountSessionFinalize,
    successMessage: "실사 확정 완료",
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (result.generated_move_id) {
        toast.success(`ADJUST 이동 생성됨: ${result.nonzero_delta_lines}개 델타 라인`);
      } else {
        toast.info("델타 0 - ADJUST 이동 생성하지 않음");
      }
    },
  });

  const voidSessionMutation = useRpcMutation<void>({
    fn: CONTRACTS.functions.inventoryCountSessionVoid,
    successMessage: "세션 취소 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "stocktake"] });
      setSelectedSessionId(null);
    },
  });

  const onCreateSession = (values: SessionForm) => {
    if (!values.location_code) {
      toast.error("세션 위치를 선택해주세요");
      return;
    }

    createSessionMutation.mutate({
      p_snapshot_at: new Date().toISOString(),
      p_location_code: values.location_code || null,
      p_session_code: values.session_code || null,
      p_memo: values.memo || null,
      p_meta: {},
      p_idempotency_key: null,
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onAddLine = (values: CountLineForm) => {
    if (!selectedSessionId) {
      toast.error("세션을 선택해주세요");
      return;
    }
    if (!values.item_name || values.counted_qty < 0) {
      toast.error("품목명과 수량을 입력해주세요");
      return;
    }

    addLineMutation.mutate({
      p_session_id: selectedSessionId,
      p_item_ref_type: values.master_id ? "MASTER" : "UNLINKED",
      p_item_name: values.item_name,
      p_counted_qty: values.counted_qty,
      p_master_id: values.master_id || null,
      p_part_id: null,
      p_variant_hint: values.variant_hint || null,
      p_note: null,
      p_meta: {},
      p_actor_person_id: null,
      p_note2: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onFinalize = () => {
    if (!selectedSessionId) return;
    if (!confirm("실사를 확정하시겠습니까? (delta≠0이면 ADJUST 이동이 생성되고 POST됩니다)")) return;

    finalizeMutation.mutate({
      p_session_id: selectedSessionId,
      p_generate_adjust: true,
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  const onVoidSession = () => {
    if (!selectedSessionId) return;
    if (!confirm("이 세션을 취소하시겠습니까?")) return;

    voidSessionMutation.mutate({
      p_session_id: selectedSessionId,
      p_reason: "user_void",
      p_actor_person_id: null,
      p_note: null,
      p_correlation_id: crypto.randomUUID(),
    });
  };

  // ===================== RENDER =====================
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]" id="inventory.root">
      {/* LEFT SIDEBAR - Inventory List */}
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[var(--panel-border)] space-y-3 bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5" />
            재고 관리
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--muted)]" />
            <input
              placeholder="모델명 검색..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-[var(--chip)] border-none text-sm placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* View Mode Toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setPositionMode("total")}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors border",
                positionMode === "total"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
              )}
            >
              전체
            </button>
            <button
              onClick={() => setPositionMode("byLocation")}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors border",
                positionMode === "byLocation"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-[var(--chip)] text-[var(--muted)] border-transparent hover:border-[var(--panel-border)]"
              )}
            >
              위치별
            </button>
          </div>
          {positionMode === "byLocation" && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full h-8 text-xs rounded-md bg-[var(--chip)] border-none px-2"
            >
              <option value="">(전체 위치)</option>
              <option value="__NULL__">미지정</option>
              {LOCATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-2 bg-[var(--chip)] border-b border-[var(--panel-border)] flex justify-between items-center text-xs">
          <span className="text-[var(--muted)]">총 {filteredPosition.length}개 모델</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {positionLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={`position-skeleton-${i}`} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPosition.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] text-sm">
              조건에 맞는 재고가 없습니다
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredPosition.map((row) => {
                const active = selectedMasterId === row.master_id;
                return (
                  <button
                    key={`${row.master_id}-${row.location_code ?? "NA"}`}
                    onClick={() => handleSelectPositionRow(row)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all border",
                      active
                        ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-[var(--chip)] hover:border-[var(--panel-border)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn("font-medium truncate text-sm", active && "text-[var(--primary)]")}>
                        {row.model_name}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {row.on_hand_qty.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>{positionMode === "byLocation" ? (row.location_code || "미지정") : ""}</span>
                      <span>{formatKst(row.last_move_at)}</span>
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
        {selectedMasterId ? (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight mb-1">
                    {selectedMasterLabel || "모델 선택"}
                  </h1>
                  <p className="text-sm text-[var(--muted)]">
                    재고 현황 및 입출고 관리
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--chip)] border border-[var(--panel-border)]">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">총 재고</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {selectedPositionTotal !== null ? selectedPositionTotal.toLocaleString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">최근 이동</p>
                  <p className="text-lg font-bold">
                    {filteredMoves.length > 0 ? `${filteredMoves.length}건` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">실사 세션</p>
                  <p className="text-lg font-bold">{sessionsData.length}개</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">위치</p>
                  <p className="text-lg font-bold">{selectedPositionRows.length}곳</p>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--panel-border)] px-6 bg-[var(--panel)] sticky top-0">
              {([
                { id: "position", label: "현황", icon: Package },
                { id: "moves", label: "입출고", icon: PackageCheck },
                { id: "stocktake", label: "실사", icon: ClipboardList },
                { id: "actions", label: "빠른처리", icon: Wrench },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMobileSection(item.id)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    mobileSection === item.id
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Position Tab */}
                {mobileSection === "position" && (
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      로케이션별 재고
                    </h3>
                    {positionMode !== "byLocation" ? (
                      <div className="text-sm text-[var(--muted)] p-4 bg-[var(--chip)] rounded-lg text-center">
                        위치별 보기 모드에서 상세 로케이션 현황을 확인할 수 있습니다
                      </div>
                    ) : selectedPositionRows.length === 0 ? (
                      <div className="text-sm text-[var(--muted)] p-4 bg-[var(--chip)] rounded-lg text-center">
                        해당 로케이션 데이터가 없습니다
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--panel-border)] rounded-lg border border-[var(--panel-border)]">
                        {selectedPositionRows.map((row) => (
                          <div key={`${row.master_id}-${row.location_code ?? "NA"}`} className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm">{row.location_code || "미지정"}</span>
                            <span className="text-lg font-bold tabular-nums">{row.on_hand_qty.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Moves Tab */}
                {mobileSection === "moves" && (
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] overflow-hidden">
                    <div className="p-4 border-b border-[var(--panel-border)]">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <PackageCheck className="w-4 h-4" />
                        최근 입출고 ({filteredMoves.length}건)
                      </h3>
                    </div>
                    {filteredMoves.length === 0 ? (
                      <div className="p-8 text-center text-sm text-[var(--muted)]">
                        최근 이동 데이터가 없습니다
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--chip)] text-xs font-medium text-[var(--muted)] uppercase tracking-wider border-b border-[var(--panel-border)]">
                          <tr>
                            <th className="px-4 py-3 text-left">시각</th>
                            <th className="px-4 py-3 text-center">번호</th>
                            <th className="px-4 py-3 text-left">모델명</th>
                            <th className="px-4 py-3 text-center">타입</th>
                            <th className="px-4 py-3 text-right">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--panel-border)]">
                          {filteredMoves.map((move) => (
                            <tr key={move.move_line_id || move.move_id} className="hover:bg-[var(--chip)]/50">
                              <td className="px-4 py-3 text-xs text-[var(--muted)] tabular-nums">
                                {formatKst(move.occurred_at)}
                              </td>
                              <td className="px-4 py-3 text-center text-xs tabular-nums">{move.move_no}</td>
                              <td className="px-4 py-3 font-medium truncate max-w-[160px]">
                                {move.master_model_name || move.item_name}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge
                                  tone={move.move_type === "RECEIPT" ? "primary" : move.move_type === "ISSUE" ? "warning" : "neutral"}
                                  className="text-[10px] px-2"
                                >
                                  {move.move_type}
                                </Badge>
                              </td>
                              <td className={cn(
                                "px-4 py-3 text-right tabular-nums font-semibold",
                                move.direction === "IN" ? "text-blue-600" : "text-orange-600"
                              )}>
                                {move.direction === "IN" ? "+" : "-"}{move.qty}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Stocktake Tab */}
                {mobileSection === "stocktake" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Session List */}
                      <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--panel-border)] space-y-3">
                          <h3 className="text-sm font-bold flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" />
                            실사 세션
                          </h3>
                          <form onSubmit={sessionForm.handleSubmit(onCreateSession)} className="flex gap-2">
                            <select
                              {...sessionForm.register("location_code")}
                              className="h-8 text-xs w-20 rounded-md bg-[var(--chip)] border-none"
                            >
                              <option value="">위치</option>
                              {LOCATION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <input
                              {...sessionForm.register("session_code")}
                              placeholder="세션명"
                              className="h-8 text-xs flex-1 px-2 rounded-md bg-[var(--chip)] border-none"
                            />
                            <Button type="submit" size="sm" disabled={createSessionMutation.isPending} className="h-8 px-3 text-xs">
                              추가
                            </Button>
                          </form>
                          <input
                            type="text"
                            placeholder="세션 검색..."
                            value={sessionSearchQuery}
                            onChange={(e) => setSessionSearchQuery(e.target.value)}
                            className="h-8 text-xs w-full px-3 rounded-md bg-[var(--chip)] border-none"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                          {filteredSessions.map((session) => (
                            <button
                              key={session.session_id}
                              onClick={() => setSelectedSessionId(session.session_id)}
                              className={cn(
                                "w-full text-left p-3 rounded-lg border transition-all",
                                selectedSessionId === session.session_id
                                  ? "bg-[var(--primary)]/10 border-[var(--primary)]/30"
                                  : "border-transparent hover:bg-[var(--chip)]"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{session.session_code || `#${session.session_no}`}</span>
                                <Badge
                                  tone={session.status === "FINALIZED" ? "active" : session.status === "VOID" ? "danger" : "warning"}
                                  className="text-[10px] px-1.5"
                                >
                                  {session.status}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                                <span>{session.location_code || "미지정"}</span>
                                <span className="tabular-nums">{session.line_count}라인</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Session Lines */}
                      <div className="lg:col-span-2 bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--panel-border)] flex items-center justify-between">
                          <h3 className="text-sm font-bold">
                            {selectedSession ? (selectedSession.session_code || `세션 #${selectedSession.session_no}`) : "세션 라인"}
                          </h3>
                          {selectedSession && !isFinalized && (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="secondary" onClick={onVoidSession} className="h-7 px-2 text-xs">
                                취소
                              </Button>
                              <Button size="sm" onClick={onFinalize} className="h-7 px-2 text-xs">
                                확정
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {selectedSessionId ? (
                            <table className="w-full text-sm">
                              <thead className="bg-[var(--chip)] text-xs font-medium text-[var(--muted)] border-b border-[var(--panel-border)]">
                                <tr>
                                  <th className="px-3 py-2 text-left">#</th>
                                  <th className="px-3 py-2 text-left">품목</th>
                                  <th className="px-3 py-2 text-right">실사</th>
                                  <th className="px-3 py-2 text-right">시스템</th>
                                  <th className="px-3 py-2 text-right">델타</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--panel-border)]">
                                {sessionLinesData.map((line) => (
                                  <tr key={line.count_line_id} className={line.is_void ? "opacity-50" : ""}>
                                    <td className="px-3 py-2 text-xs text-[var(--muted)]">{line.line_no}</td>
                                    <td className="px-3 py-2">{line.item_name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{line.counted_qty}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-[var(--muted)]">{line.system_qty_asof ?? "-"}</td>
                                    <td className={cn(
                                      "px-3 py-2 text-right tabular-nums font-semibold",
                                      (line.delta_qty ?? 0) > 0 ? "text-blue-600" : (line.delta_qty ?? 0) < 0 ? "text-orange-600" : "text-[var(--muted)]"
                                    )}>
                                      {line.delta_qty && line.delta_qty > 0 ? "+" : ""}{line.delta_qty ?? "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-8 text-center text-sm text-[var(--muted)]">
                              세션을 선택하세요
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions Tab */}
                {mobileSection === "actions" && (
                  <div className="bg-[var(--panel)] rounded-xl border border-[var(--panel-border)] p-5">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      빠른 입출고 등록
                    </h3>
                    <form onSubmit={quickMoveForm.handleSubmit(onSubmitQuickMove)} className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">타입</label>
                          <select
                            {...quickMoveForm.register("move_type")}
                            className="w-full h-9 text-sm rounded-md bg-[var(--chip)] border-none px-3"
                          >
                            <option value="RECEIPT">입고 (RECEIPT)</option>
                            <option value="ISSUE">출고 (ISSUE)</option>
                            <option value="ADJUST">조정 (ADJUST)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">위치</label>
                          <select
                            {...quickMoveForm.register("location_code")}
                            className="w-full h-9 text-sm rounded-md bg-[var(--chip)] border-none px-3"
                          >
                            <option value="">(선택)</option>
                            {LOCATION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">수량</label>
                          <input
                            type="number"
                            {...quickMoveForm.register("qty", { valueAsNumber: true })}
                            className="w-full h-9 text-sm rounded-md bg-[var(--chip)] border-none px-3"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[var(--muted)] block mb-1.5">중량(g)</label>
                          <input
                            type="number"
                            step="0.01"
                            {...quickMoveForm.register("base_weight_g", { valueAsNumber: true })}
                            className="w-full h-9 text-sm rounded-md bg-[var(--chip)] border-none px-3"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          {...quickMoveForm.register("model_name")}
                          placeholder="품목명"
                          className="flex-1 h-9 text-sm rounded-md bg-[var(--chip)] border-none px-3"
                        />
                        <Button type="submit" disabled={quickMoveMutation.isPending}>
                          {quickMoveMutation.isPending ? "처리중..." : "등록"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--muted)]">
            <div className="text-center">
              <Package className="mx-auto mb-4 h-16 w-16 opacity-10" />
              <p className="text-lg font-medium mb-1">모델을 선택하세요</p>
              <p className="text-sm">왼쪽 목록에서 모델을 클릭하면 상세 정보가 표시됩니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
