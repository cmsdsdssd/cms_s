"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Package, PackageCheck, ClipboardList, Wrench } from "lucide-react";
import {
  UnifiedToolbar,
  ToolbarSelect,
  ToolbarInput,
  ToolbarButton,
} from "@/components/layout/unified-toolbar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListCard } from "@/components/ui/list-card";
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
    <div className="min-h-[calc(100vh-4rem)] flex flex-col space-y-3" id="inventory.root">
      {/* Unified Toolbar - Compact Header */}
      <UnifiedToolbar title="재고관리">
        {/* View Mode Toggle Pills */}
        <div className="flex bg-[var(--panel)] p-0.5 rounded-md border border-[var(--panel-border)]">
          <button
            type="button"
            onClick={() => setPositionMode("total")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-sm transition-all",
              positionMode === "total"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setPositionMode("byLocation")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-sm transition-all",
              positionMode === "byLocation"
                ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            )}
          >
            위치별
          </button>
        </div>

        {/* Location Filter (when byLocation mode) */}
        {positionMode === "byLocation" && (
          <ToolbarSelect
            value={selectedLocation}
            onChange={(value) => setSelectedLocation(value)}
            className="w-28"
          >
            <option value="">(전체 위치)</option>
            <option value="__NULL__">미지정</option>
            {LOCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </ToolbarSelect>
        )}

        <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

        {/* Search */}
        <ToolbarInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="모델 검색..."
          className="w-32 md:w-48"
        />
      </UnifiedToolbar>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-auto px-4">
        <SplitLayout
          className="h-full items-start"
          left={
            <div className="flex h-full min-h-0 flex-col gap-2" id="inventory.listPanel">
              <Card className="flex-1 min-h-0">
                <CardHeader className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-semibold text-foreground">재고 리스트</span>
                  </div>
                  <span className="text-xs text-[var(--muted)] tabular-nums">
                    {filteredPosition.length.toLocaleString()}건
                  </span>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="h-full overflow-auto">
                    {positionLoading ? (
                      <div className="p-3 space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={`position-skeleton-${i}`} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : filteredPosition.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
                        <p className="text-sm">조건에 맞는 재고가 없습니다</p>
                        <p className="text-xs text-[var(--muted-weak)]">검색어나 필터를 조정해보세요</p>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {filteredPosition.map((row) => (
                          <button
                            key={`${row.master_id}-${row.location_code ?? "NA"}`}
                            type="button"
                            onClick={() => handleSelectPositionRow(row)}
                            className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          >
                            <ListCard
                              title={row.model_name}
                              subtitle={
                                <span className="tabular-nums whitespace-nowrap">
                                  재고 {row.on_hand_qty.toLocaleString()}
                                </span>
                              }
                              meta={
                                positionMode === "byLocation" ? (
                                  <span className="text-xs text-[var(--muted-weak)]">
                                    {row.location_code || "미지정"}
                                  </span>
                                ) : undefined
                              }
                              right={
                                <span className="text-xs text-[var(--muted)] tabular-nums whitespace-nowrap">
                                  {formatKst(row.last_move_at)}
                                </span>
                              }
                              selected={selectedMasterId === row.master_id}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          }
          right={
            <div
              className="flex h-full min-h-0 flex-col gap-2 overflow-auto pr-1"
              id="inventory.detailPanel"
            >
              {/* Mobile Navigation */}
              <div className="md:hidden">
                <div className="flex items-center gap-1 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-1 shadow-sm">
                  {([
                    { id: "position", label: "현황" },
                    { id: "moves", label: "입출고" },
                    { id: "stocktake", label: "실사" },
                    { id: "actions", label: "처리" },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMobileSection(item.id)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                        mobileSection === item.id
                          ? "bg-[var(--chip)] text-[var(--foreground)] shadow-sm"
                          : "text-[var(--muted)]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Position Card */}
              <Card className={cn("hidden md:block", mobileSection === "position" && "block")}>
                <CardHeader className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-semibold text-foreground">현재 재고</span>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  {!selectedMasterId ? (
                    <div className="text-sm text-[var(--muted)]">좌측에서 모델을 선택하세요</div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs text-[var(--muted)]">선택 모델</div>
                          <div className="text-base font-semibold text-foreground">
                            {selectedMasterLabel || "-"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-[var(--muted)]">총 재고</div>
                          <div className="text-2xl font-bold tabular-nums">
                            {selectedPositionTotal !== null
                              ? selectedPositionTotal.toLocaleString()
                              : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                          <span>로케이션</span>
                          {positionMode !== "byLocation" ? (
                            <span className="font-normal">위치별 보기에서 확인</span>
                          ) : null}
                        </div>
                        {positionMode !== "byLocation" ? null : selectedPositionRows.length === 0 ? (
                          <div className="text-xs text-[var(--muted)]">해당 로케이션 데이터가 없습니다</div>
                        ) : (
                          <div className="divide-y divide-border/40 rounded-md border border-border/40">
                            {selectedPositionRows.map((row) => (
                              <div key={`${row.master_id}-${row.location_code ?? "NA"}`} className="flex items-center justify-between px-3 py-2 text-sm">
                                <span className="text-[var(--muted)]">
                                  {row.location_code || "미지정"}
                                </span>
                                <span className="tabular-nums font-semibold text-foreground">
                                  {row.on_hand_qty.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>

              {/* Moves Card */}
              <Card className={cn("hidden md:block", mobileSection === "moves" && "block")}>
                <CardHeader className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-semibold text-foreground">최근 입출고</span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  {!selectedMasterId ? (
                    <div className="p-4 text-sm text-[var(--muted)]">좌측에서 모델을 선택하세요</div>
                  ) : filteredMoves.length === 0 ? (
                    <div className="p-4 text-sm text-[var(--muted)]">최근 이동 데이터가 없습니다</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background z-10 text-xs font-medium text-[var(--muted)] uppercase tracking-wider border-b border-border/40">
                          <tr>
                            <th className="px-3 py-2 text-left">시각</th>
                            <th className="px-3 py-2 text-center">번호</th>
                            <th className="px-3 py-2 text-left">모델명</th>
                            <th className="px-3 py-2 text-center">타입</th>
                            <th className="px-3 py-2 text-right">수량</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {filteredMoves.map((move) => (
                            <tr
                              key={move.move_line_id || move.move_id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-3 py-2 text-xs text-[var(--muted)] whitespace-nowrap tabular-nums">
                                <div>{formatKst(move.occurred_at).split(" ")[0]}</div>
                                <div className="text-[10px] opacity-70">
                                  {formatKst(move.occurred_at).split(" ")[1]}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-[var(--muted)] tabular-nums">
                                {move.move_no}
                              </td>
                              <td
                                className="px-3 py-2 font-medium text-foreground truncate max-w-[140px]"
                                title={move.master_model_name || move.item_name || ""}
                              >
                                {move.master_model_name || move.item_name}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge
                                  tone={
                                    move.move_type === "RECEIPT"
                                      ? "primary"
                                      : move.move_type === "ISSUE"
                                        ? "warning"
                                        : "neutral"
                                  }
                                  className="text-[10px] px-1.5 py-0 h-5 border-0"
                                >
                                  {move.move_type}
                                </Badge>
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right tabular-nums font-semibold",
                                  move.direction === "IN" ? "text-blue-600" : "text-orange-600"
                                )}
                              >
                                {move.direction === "IN" ? "+" : "-"}
                                {move.qty}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Stocktake Card - Truncated for brevity */}
              <Card className={cn("hidden md:block", mobileSection === "stocktake" && "block")}>
                <CardHeader className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-semibold text-foreground">실사</span>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3 min-h-0">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
                    {/* Session List */}
                    <div className="rounded-md border border-border/40 overflow-hidden flex min-h-0 flex-col">
                      <div className="p-2 border-b border-border/40 bg-muted/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">실사 세션</h3>
                        </div>
                        <form onSubmit={sessionForm.handleSubmit(onCreateSession)} className="flex gap-1.5">
                          <select
                            {...sessionForm.register("location_code")}
                            className="h-7 text-xs w-20 flex-shrink-0 rounded border border-[var(--panel-border)] bg-[var(--panel)]"
                          >
                            <option value="">위치</option>
                            {LOCATION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <input
                            {...sessionForm.register("session_code")}
                            placeholder="예: 사무실 금고"
                            className="h-7 text-xs flex-1 px-2 rounded border border-[var(--panel-border)] bg-[var(--panel)]"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={createSessionMutation.isPending}
                            className="h-7 px-2 text-xs"
                          >
                            {createSessionMutation.isPending ? "..." : "추가"}
                          </Button>
                        </form>
                        <input
                          type="text"
                          placeholder="세션 검색"
                          value={sessionSearchQuery}
                          onChange={(e) => setSessionSearchQuery(e.target.value)}
                          className="h-7 text-xs w-full px-2 rounded border border-[var(--panel-border)] bg-[var(--panel)]"
                        />
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto p-1.5 space-y-1">
                        {filteredSessions.map((session) => (
                          <button
                            key={session.session_id}
                            onClick={() => setSelectedSessionId(session.session_id)}
                            className={cn(
                              "w-full text-left p-2 rounded border transition-all",
                              selectedSessionId === session.session_id
                                ? "border-primary/50 bg-primary/5"
                                : "border-transparent hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium">
                                {session.session_code || `#${session.session_no}`}
                              </span>
                              <Badge
                                tone={
                                  session.status === "FINALIZED"
                                    ? "active"
                                    : session.status === "VOID"
                                      ? "danger"
                                      : "warning"
                                }
                                className="text-[10px] px-1.5 py-0 h-4 border-0"
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
                    <div className="lg:col-span-2 rounded-md border border-border/40 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-border/40 bg-muted/5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">
                            {selectedSession ? selectedSession.session_code || `세션 #${selectedSession.session_no}` : "세션 라인"}
                          </h3>
                          {selectedSession && !isFinalized && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="secondary" onClick={onVoidSession} className="h-6 px-2 text-xs">
                                취소
                              </Button>
                              <Button size="sm" onClick={onFinalize} className="h-6 px-2 text-xs">
                                확정
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        {selectedSessionId ? (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-background z-10 text-xs font-medium text-[var(--muted)] border-b border-border/40">
                              <tr>
                                <th className="px-2 py-1.5 text-left">#</th>
                                <th className="px-2 py-1.5 text-left">품목</th>
                                <th className="px-2 py-1.5 text-right">실사</th>
                                <th className="px-2 py-1.5 text-right">시스템</th>
                                <th className="px-2 py-1.5 text-right">델타</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {sessionLinesData.map((line) => (
                                <tr key={line.count_line_id} className={line.is_void ? "opacity-50" : ""}>
                                  <td className="px-2 py-1.5 text-xs text-[var(--muted)]">{line.line_no}</td>
                                  <td className="px-2 py-1.5">{line.item_name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{line.counted_qty}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-[var(--muted)]">
                                    {line.system_qty_asof ?? "-"}
                                  </td>
                                  <td className={cn(
                                    "px-2 py-1.5 text-right tabular-nums font-semibold",
                                    (line.delta_qty ?? 0) > 0 ? "text-blue-600" : (line.delta_qty ?? 0) < 0 ? "text-orange-600" : "text-[var(--muted)]"
                                  )}>
                                    {line.delta_qty && line.delta_qty > 0 ? "+" : ""}
                                    {line.delta_qty ?? "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-center text-sm text-[var(--muted)]">
                            세션을 선택하세요
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Quick Actions Card */}
              <Card className={cn("hidden md:block", mobileSection === "actions" && "block")}>
                <CardHeader className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[var(--muted)]" />
                    <span className="text-sm font-semibold text-foreground">빠른 처리</span>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <form onSubmit={quickMoveForm.handleSubmit(onSubmitQuickMove)} className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-[var(--muted)] block mb-1">타입</label>
                        <select
                          {...quickMoveForm.register("move_type")}
                          className="h-8 text-xs w-full rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2"
                        >
                          <option value="RECEIPT">입고 (RECEIPT)</option>
                          <option value="ISSUE">출고 (ISSUE)</option>
                          <option value="ADJUST">조정 (ADJUST)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)] block mb-1">위치</label>
                        <select
                          {...quickMoveForm.register("location_code")}
                          className="h-8 text-xs w-full rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2"
                        >
                          <option value="">(선택)</option>
                          {LOCATION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)] block mb-1">수량</label>
                        <input
                          type="number"
                          {...quickMoveForm.register("qty", { valueAsNumber: true })}
                          className="h-8 text-xs w-full rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--muted)] block mb-1">중량(g)</label>
                        <input
                          type="number"
                          step="0.01"
                          {...quickMoveForm.register("base_weight_g", { valueAsNumber: true })}
                          className="h-8 text-xs w-full rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        {...quickMoveForm.register("model_name")}
                        placeholder="품목명"
                        className="flex-1 h-8 text-xs rounded border border-[var(--panel-border)] bg-[var(--panel)] px-2"
                      />
                      <Button type="submit" size="sm" disabled={quickMoveMutation.isPending} className="h-8 px-3 text-xs">
                        {quickMoveMutation.isPending ? "처리중..." : "등록"}
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
    </div>
  );
}
