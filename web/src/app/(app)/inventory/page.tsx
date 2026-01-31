"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Select } from "@/components/ui/field";
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
    photo_url?: string; // from view (image_path as photo_url)
    image_path?: string; // direct column
};

type QuickMoveForm = {
    move_type: "RECEIPT" | "ISSUE" | "ADJUST";
    location_code: string;
    model_name: string;
    master_id?: string;
    session_id?: string;
    qty: number;

    // Master-derived fields
    material_code?: string;
    category_code?: string;
    base_weight_g?: number; // MUST be undefined initially
    deduction_weight_g?: number; // MUST be undefined initially
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

// Helper to convert relative image path to full URL
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
    const [activeTab, setActiveTab] = useState<"position" | "moves" | "stocktake">("position");
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sessionSearchQuery, setSessionSearchQuery] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Master search state for Moves tab
    const [selectedMaster, setSelectedMaster] = useState<MasterItem | null>(null);
    const [masterSearchQuery, setMasterSearchQuery] = useState("");
    const [showMasterSearch, setShowMasterSearch] = useState(false);

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

    const filteredPosition = positionData.filter((row) =>
        (row.model_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ===================== STOCKTAKE: SESSIONS (also used by QuickMove link) =====================
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
        enabled: showMasterSearch && masterSearchQuery.length > 0,
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
            base_weight_g: undefined, // CRITICAL: undefined, not 0
            deduction_weight_g: undefined, // CRITICAL: undefined, not 0
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
            setSelectedMaster(null);
        },
    });

    const onSubmitQuickMove = (values: QuickMoveForm) => {
        // CRITICAL: Weight validation
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

    // Master search handlers
    const handleMasterSelect = (master: MasterItem) => {
        setSelectedMaster(master);
        quickMoveForm.setValue("model_name", master.model_name);
        quickMoveForm.setValue("master_id", master.master_id);
        setShowMasterSearch(false);
        setMasterSearchQuery("");
    };

    const handleCopyFromMaster = () => {
        if (!selectedMaster) {
            toast.error("마스터를 먼저 선택해주세요");
            return;
        }

        // Copy all fields EXCEPT weight
        quickMoveForm.setValue("material_code", selectedMaster.material_code_default || "");
        quickMoveForm.setValue("category_code", selectedMaster.category_code || "");
        quickMoveForm.setValue("center_qty", selectedMaster.center_qty_default || 0);
        quickMoveForm.setValue("sub1_qty", selectedMaster.sub1_qty_default || 0);
        quickMoveForm.setValue("sub2_qty", selectedMaster.sub2_qty_default || 0);
        quickMoveForm.setValue("plating_sell", selectedMaster.plating_price_sell_default || 0);
        quickMoveForm.setValue("plating_cost", selectedMaster.plating_price_cost_default || 0);
        quickMoveForm.setValue("labor_base_sell", selectedMaster.labor_base_sell || 0);
        quickMoveForm.setValue("labor_base_cost", selectedMaster.labor_base_cost || 0);

        // STRICT RULE: DO NOT copy weight fields
        // quickMoveForm.setValue("base_weight_g", ...) // FORBIDDEN
        // quickMoveForm.setValue("deduction_weight_g", ...) // FORBIDDEN

        toast.info("마스터 데이터 복사됨 (중량 제외)");
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
    const tabs = [
        { id: "position", label: "현재재고 (Position)" },
        { id: "moves", label: "입출고 (Moves)" },
        { id: "stocktake", label: "실사 (Stocktake)" },
    ] as const;

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col space-y-4 p-2">
            <div className="flex items-center justify-between px-1">
                <ActionBar title="재고관리" subtitle="재고 현황, 입출고, 실사" />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-border/40 px-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "pb-3 text-sm font-medium transition-all relative",
                            activeTab === tab.id
                                ? "text-primary after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
                {/* Position Tab */}
                {activeTab === "position" && (
                    <Card className="h-full flex flex-col border-border/40 shadow-sm">
                        <div className="p-4 border-b border-border/40 flex items-center justify-between gap-4 bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold text-foreground">현재 재고</div>
                                <div className="h-5 w-px bg-border/40" aria-hidden="true" />
                                <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
                                    <button
                                        type="button"
                                        onClick={() => setPositionMode("total")}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            positionMode === "total"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        전체
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPositionMode("byLocation")}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            positionMode === "byLocation"
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        위치별
                                    </button>
                                </div>

                                {positionMode === "byLocation" && (
                                    <Select
                                        value={selectedLocation}
                                        onChange={(e) => setSelectedLocation(e.target.value)}
                                        className="h-8 text-xs w-40"
                                    >
                                        <option value="">(전체 위치)</option>
                                        <option value="__NULL__">미지정</option>
                                        {LOCATION_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </div>

                            <Input
                                placeholder="모델 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-64 h-8 text-xs"
                            />
                        </div>

                        <div className="flex-1 overflow-auto">
                            {positionLoading ? (
                                <div className="p-4 space-y-2">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : filteredPosition.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <p className="text-sm">조건에 맞는 재고가 없습니다</p>
                                    <p className="text-xs text-muted-foreground/70">검색어나 필터를 조정해보세요</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-background z-10 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/40">
                                        <tr>
                                            {positionMode === "byLocation" && (
                                                <th className="px-4 py-3 font-medium">위치</th>
                                            )}
                                            <th className="px-4 py-3 font-medium">모델명</th>
                                            <th className="px-4 py-3 font-medium text-right">재고</th>
                                            <th className="px-4 py-3 font-medium text-right">최종이동</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {filteredPosition.map((row, idx) => (
                                            <tr key={`${row.master_id}-${row.location_code ?? "NA"}-${idx}`} className="group hover:bg-muted/30 transition-colors">
                                                {positionMode === "byLocation" && (
                                                    <td className="px-4 py-3 text-xs text-muted-foreground group-hover:text-foreground">
                                                        {row.location_code || <span className="opacity-50">미지정</span>}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 font-medium text-foreground">{row.model_name}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <Badge
                                                        tone={
                                                            row.on_hand_qty < 0
                                                                ? "danger"
                                                                : row.on_hand_qty === 0
                                                                    ? "neutral"
                                                                    : "active"
                                                        }
                                                        className="font-mono text-xs border-0"
                                                    >
                                                        {row.on_hand_qty.toLocaleString()}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground text-right font-mono">
                                                    {formatKst(row.last_move_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                )}

                {/* Moves Tab */}
                {activeTab === "moves" && (
                    <div className="h-full grid grid-cols-10 gap-4">
                        {/* Left Panel: History */}
                        <Card className="col-span-5 flex flex-col border-border/40 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-border/40 bg-muted/5">
                                <h3 className="text-sm font-semibold text-foreground">입출고 이력</h3>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {movesData.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">데이터 없음</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-background z-10 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/40">
                                            <tr>
                                                <th className="px-3 py-2 text-left">시각</th>
                                                <th className="px-3 py-2 text-center">번호</th>
                                                <th className="px-3 py-2 text-left">모델명</th>
                                                <th className="px-3 py-2 text-center">타입</th>
                                                <th className="px-3 py-2 text-right">수량</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {movesData.map((move) => (
                                                <tr key={move.move_line_id || move.move_id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                        <div className="font-mono">{formatKst(move.occurred_at).split(" ")[0]}</div>
                                                        <div className="text-[10px] opacity-70">{formatKst(move.occurred_at).split(" ")[1]}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-xs font-mono text-muted-foreground">
                                                        {move.move_no}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-foreground truncate max-w-[120px]" title={move.master_model_name || move.item_name || ""}>
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
                                                    <td className={cn("px-3 py-2 text-right font-mono font-medium", move.direction === "IN" ? "text-blue-600" : "text-orange-600")}>
                                                        {move.direction === "IN" ? "+" : "-"}
                                                        {move.qty}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </Card>

                        {/* Middle Panel: Master Detail */}
                        <Card className="col-span-2 flex flex-col border-border/40 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-border/40 bg-muted/5">
                                <h3 className="text-sm font-semibold text-foreground">마스터 내용</h3>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                {!selectedMaster ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                            <span className="text-2xl">?</span>
                                        </div>
                                        <p className="text-xs">마스터를 선택하세요</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden border border-border/50 relative group shadow-sm">
                                            {(() => {
                                                const imageUrl = getImageUrl(selectedMaster.photo_url || selectedMaster.image_path);
                                                return imageUrl ? (
                                                    <img
                                                        src={imageUrl}
                                                        alt={selectedMaster.model_name}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">이미지 없음</div>
                                                );
                                            })()}
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                                                <p className="text-white font-medium text-sm truncate">{selectedMaster.model_name}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border/40 pb-1">기본 정보</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="text-muted-foreground">재질</div>
                                                    <div className="font-medium text-right">{selectedMaster.material_code_default || "-"}</div>
                                                    <div className="text-muted-foreground">분류</div>
                                                    <div className="font-medium text-right">{selectedMaster.category_code || "-"}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border/40 pb-1">중량 (g)</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="text-muted-foreground">기본</div>
                                                    <div className="font-medium text-right font-mono">{selectedMaster.weight_default_g ?? "-"}</div>
                                                    <div className="text-muted-foreground">차감</div>
                                                    <div className="font-medium text-right font-mono">{selectedMaster.deduction_weight_default_g ?? "-"}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 border-b border-border/40 pb-1">스톤 (EA)</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="text-muted-foreground">Center</div>
                                                    <div className="font-medium text-right font-mono">{selectedMaster.center_qty_default ?? "-"}</div>
                                                    <div className="text-muted-foreground">Sub</div>
                                                    <div className="font-medium text-right font-mono">{selectedMaster.sub1_qty_default ?? "-"} / {selectedMaster.sub2_qty_default ?? "-"}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Right Panel: Quick Input */}
                        <Card className="col-span-3 flex flex-col border-border/40 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-border/40 bg-muted/5">
                                <h3 className="text-sm font-semibold text-foreground">빠른 입력</h3>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                <form onSubmit={quickMoveForm.handleSubmit(onSubmitQuickMove)} className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">타입</label>
                                            <Select {...quickMoveForm.register("move_type")} className="h-9 text-xs">
                                                <option value="RECEIPT">입고</option>
                                                <option value="ISSUE">출고</option>
                                                <option value="ADJUST">조정</option>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">위치</label>
                                            <Select {...quickMoveForm.register("location_code")} className="h-9 text-xs">
                                                <option value="">선택</option>
                                                {LOCATION_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">실사 세션 연결(선택)</label>
                                        <Select {...quickMoveForm.register("session_id")} className="h-9 text-xs">
                                            <option value="">(선택 안함)</option>
                                            {sessionsData.map((s) => (
                                                <option key={s.session_id} value={s.session_id}>
                                                    {s.location_code || s.session_code || `세션 #${s.session_no}`}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2 space-y-1.5 relative">
                                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">모델명</label>
                                            <Input
                                                {...quickMoveForm.register("model_name")}
                                                onFocus={() => setShowMasterSearch(true)}
                                                onChange={(e) => {
                                                    quickMoveForm.setValue("model_name", e.target.value);
                                                    setMasterSearchQuery(e.target.value);
                                                    setShowMasterSearch(true);
                                                }}
                                                placeholder="모델명 검색..."
                                                className="h-9 text-xs"
                                                autoComplete="off"
                                            />
                                            {showMasterSearch && masterSearchResults.length > 0 && (
                                                <div className="absolute z-20 w-full bg-[var(--card)] border border-[var(--panel-border)] shadow-md rounded-md mt-1 max-h-48 overflow-auto">
                                                    {masterSearchResults.map((master, idx) => (
                                                        <button
                                                            key={`${master.master_id}-${idx}`}
                                                            type="button"
                                                            onClick={() => handleMasterSelect(master)}
                                                            className="w-full text-left p-2 hover:bg-muted text-xs border-b border-border/50 last:border-0"
                                                        >
                                                            <div className="font-medium">{master.model_name}</div>
                                                            <div className="text-[10px] text-muted-foreground">{master.vendor_name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-semibold uppercase text-muted-foreground">수량</label>
                                            <Input type="number" {...quickMoveForm.register("qty", { valueAsNumber: true })} className="h-9 text-xs font-mono text-right" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">메모</label>
                                        <Input {...quickMoveForm.register("memo")} placeholder="메모..." className="h-9 text-xs" />
                                    </div>

                                    <Button type="submit" variant="primary" className="w-full h-10 font-bold shadow-sm">
                                        등 록
                                    </Button>

                                    <div className="pt-4 border-t border-dashed border-border/50">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="space-y-0.5">
                                                <span className="text-[10px] font-semibold uppercase text-muted-foreground">상세 입력</span>
                                                <div className="text-[10px] text-muted-foreground">중량은 복사되지 않음</div>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                onClick={handleCopyFromMaster}
                                                disabled={!selectedMaster}
                                                className="h-6 text-[10px] px-2"
                                            >
                                                마스터 복사
                                            </Button>
                                        </div>

                                        <div className="bg-muted/30 rounded-lg p-3 border border-border/40 space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input {...quickMoveForm.register("material_code")} placeholder="Material Code" className="h-7 text-xs bg-background" />
                                                <Input {...quickMoveForm.register("category_code")} placeholder="Category Code" className="h-7 text-xs bg-background" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input {...quickMoveForm.register("base_weight_g", { valueAsNumber: true })} placeholder="기본 중량 *" className="h-7 text-xs bg-yellow-50/50 border-yellow-200/50" />
                                                <Input {...quickMoveForm.register("deduction_weight_g", { valueAsNumber: true })} placeholder="차감 중량 *" className="h-7 text-xs bg-yellow-50/50 border-yellow-200/50" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input {...quickMoveForm.register("sub1_qty", { valueAsNumber: true })} placeholder="Sub 1" className="h-7 text-xs bg-background" />
                                                <Input {...quickMoveForm.register("center_qty", { valueAsNumber: true })} placeholder="Center" className="h-7 text-xs bg-background" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input {...quickMoveForm.register("plating_cost", { valueAsNumber: true })} placeholder="Cost" className="h-7 text-xs bg-background" />
                                                <Input {...quickMoveForm.register("plating_sell", { valueAsNumber: true })} placeholder="Sell" className="h-7 text-xs bg-background" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input {...quickMoveForm.register("labor_base_cost", { valueAsNumber: true })} placeholder="Base Cost" className="h-7 text-xs bg-background" />
                                                <Input {...quickMoveForm.register("labor_base_sell", { valueAsNumber: true })} placeholder="Base Sell" className="h-7 text-xs bg-background" />
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Stocktake Tab */}
                {activeTab === "stocktake" && (
                    <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Session List */}
                        <Card className="flex flex-col border-border/40 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-border/40 bg-muted/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-foreground">실사 세션</h3>
                                </div>
                                <form onSubmit={sessionForm.handleSubmit(onCreateSession)} className="flex gap-2">
                                    <Select {...sessionForm.register("location_code")} className="h-8 text-xs w-24 flex-shrink-0">
                                        <option value="">위치</option>
                                        {LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </Select>
                                    <Input {...sessionForm.register("session_code")} placeholder="예: 사무실 금고, 1층 매장" className="h-8 text-xs flex-1" />
                                    <Button type="submit" size="sm" disabled={createSessionMutation.isPending} className="h-8 px-3">
                                        {createSessionMutation.isPending ? "생성 중..." : "추가"}
                                    </Button>
                                </form>
                                <Input
                                    placeholder="세션 검색 (이름, 번호)"
                                    value={sessionSearchQuery}
                                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="flex-1 overflow-auto p-2 space-y-1">
                                {sessionsData
                                    .filter((s) => {
                                        const q = sessionSearchQuery.toLowerCase().trim();
                                        if (!q) return true;
                                        return (
                                            (s.session_code?.toLowerCase() || "").includes(q) ||
                                            (s.location_code?.toLowerCase() || "").includes(q) ||
                                            String(s.session_no).includes(q)
                                        );
                                    })
                                    .map((session) => (
                                        <button
                                            key={session.session_id}
                                            onClick={() => setSelectedSessionId(session.session_id)}
                                            className={cn(
                                                "w-full text-left p-3 rounded-lg border transition-all group",
                                                selectedSessionId === session.session_id
                                                    ? "border-primary/50 bg-primary/5 shadow-sm"
                                                    : "border-transparent hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={cn("text-sm font-medium", selectedSessionId === session.session_id ? "text-primary" : "text-foreground")}>
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
                                                    className="text-[10px] px-1.5 py-0 h-5 border-0"
                                                >
                                                    {session.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>{formatKst(session.snapshot_at)}</span>
                                                <span className="font-mono">라인: {session.line_count}</span>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </Card>

                        {/* Session Detail */}
                        <Card className="lg:col-span-2 flex flex-col border-border/40 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-border/40 bg-muted/5 flex items-center justify-between h-14">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {selectedSession ? (
                                            <>
                                                {selectedSession.session_code || `#${selectedSession.session_no}`}
                                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                    {selectedSession.location_code}
                                                </span>
                                            </>
                                        ) : "세션 선택"}
                                    </h3>
                                </div>
                                {selectedSession && (
                                    <div className="flex gap-2">
                                        {!isFinalized && (
                                            <>
                                                <Button onClick={onFinalize} disabled={finalizeMutation.isPending} size="sm" className="h-8 text-xs">
                                                    {finalizeMutation.isPending ? "확정 중..." : "Finalize"}
                                                </Button>
                                                <Button onClick={onVoidSession} disabled={voidSessionMutation.isPending} variant="secondary" size="sm" className="h-8 text-xs">
                                                    취소
                                                </Button>
                                            </>
                                        )}
                                        {selectedSession.generated_move_id && (
                                            <Badge tone="active" className="text-[10px] px-2 py-0.5">
                                                ADJUST Move #{selectedSession.generated_move_status}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col">
                                {!selectedSessionId ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                        왼쪽에서 세션을 선택하세요
                                    </div>
                                ) : (
                                    <>
                                        {!isFinalized && (
                                            <div className="p-3 border-b border-border/40 bg-background">
                                                <form onSubmit={countLineForm.handleSubmit(onAddLine)} className="flex gap-2">
                                                    <div className="flex-1 relative">
                                                        <Input
                                                            {...countLineForm.register("item_name", { required: true })}
                                                            placeholder="품목명 (마스터 검색) *"
                                                            disabled={isFinalized}
                                                            autoComplete="off"
                                                            className="h-9 text-xs"
                                                            onFocus={() => setShowMasterSearch(true)}
                                                            onChange={(e) => {
                                                                countLineForm.setValue("item_name", e.target.value);
                                                                setMasterSearchQuery(e.target.value);
                                                                setShowMasterSearch(true);
                                                            }}
                                                        />
                                                        {showMasterSearch && masterSearchResults.length > 0 && activeTab === "stocktake" && (
                                                            <div className="absolute z-50 w-full bg-[var(--card)] border border-[var(--panel-border)] shadow-lg rounded-md mt-1 max-h-48 overflow-auto">
                                                                {masterSearchResults.map((master, idx) => (
                                                                    <button
                                                                        key={`${master.master_id}-${idx}-st`}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            countLineForm.setValue("item_name", master.model_name);
                                                                            countLineForm.setValue("master_id", master.master_id);
                                                                            setShowMasterSearch(false);
                                                                        }}
                                                                        className="w-full text-left p-2 hover:bg-muted text-xs border-b border-border/50 last:border-0"
                                                                    >
                                                                        <div className="font-medium">{master.model_name}</div>
                                                                        <div className="text-[10px] text-muted-foreground">{master.vendor_name}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        {...countLineForm.register("counted_qty", { required: true, valueAsNumber: true })}
                                                        placeholder="수량 *"
                                                        className="w-20 h-9 text-xs font-mono text-right"
                                                        disabled={isFinalized}
                                                    />
                                                    <Button type="submit" disabled={addLineMutation.isPending || isFinalized} className="h-9 px-4">
                                                        {addLineMutation.isPending ? "추가 중..." : "추가"}
                                                    </Button>
                                                </form>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-auto">
                                            {sessionLinesData.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">라인이 없습니다</div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="sticky top-0 bg-background z-10 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/40">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left w-12">#</th>
                                                            <th className="px-4 py-2 text-left">품목명</th>
                                                            <th className="px-4 py-2 text-right">실사</th>
                                                            <th className="px-4 py-2 text-right text-muted-foreground">시스템</th>
                                                            <th className="px-4 py-2 text-right">델타</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/40">
                                                        {sessionLinesData
                                                            .filter((l) => !l.is_void)
                                                            .map((line) => (
                                                                <tr key={line.count_line_id} className="hover:bg-muted/30 transition-colors">
                                                                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{line.line_no}</td>
                                                                    <td className="px-4 py-2 font-medium">{line.item_name}</td>
                                                                    <td className="px-4 py-2 text-right font-mono font-bold">{line.counted_qty}</td>
                                                                    <td className="px-4 py-2 text-right font-mono text-muted-foreground text-xs">
                                                                        {line.system_qty_asof ?? "-"}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-mono">
                                                                        {line.delta_qty !== null && line.delta_qty !== undefined ? (
                                                                            <Badge
                                                                                tone={
                                                                                    line.delta_qty > 0
                                                                                        ? "primary"
                                                                                        : line.delta_qty < 0
                                                                                            ? "danger"
                                                                                            : "neutral"
                                                                                }
                                                                                className="text-[10px] px-1.5 py-0 h-5 border-0 font-mono"
                                                                            >
                                                                                {line.delta_qty > 0 ? "+" : ""}
                                                                                {line.delta_qty}
                                                                            </Badge>
                                                                        ) : (
                                                                            "-"
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
