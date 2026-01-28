"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ===================== TYPES =====================
type PositionRow = {
    item_ref_type: string;
    item_name: string;
    variant_hint?: string;
    on_hand_qty: number;
    last_move_at?: string;
};

type MoveRow = {
    move_id: string;
    move_no: number;
    move_type: string;
    status: string;
    occurred_at: string;
    party_id?: string;
    party_name?: string;
    line_count: number;
    total_in_qty: number;
    total_out_qty: number;
    memo?: string;
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
    model_name: string; // Changed from item_name
    master_id?: string;
    session_id?: string; // New: Link to session
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
    labor_center_sell?: number;
    labor_sub1_sell?: number;
    labor_sub2_sell?: number;
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

const getKstNow = () => {
    const now = new Date();
    const kstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getDate()).padStart(2, "0");
    const hours = String(kstDate.getHours()).padStart(2, "0");
    const minutes = String(kstDate.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper to convert relative image path to full URL
const getImageUrl = (path?: string | null): string | null => {
    if (!path) return null;

    // If already a full URL, return as is
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    // Convert relative path to Supabase Storage URL
    // Format: master/c0bc6c7e-70df-42fb-bf11-5b50c94493e7.png
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
        console.warn("NEXT_PUBLIC_SUPABASE_URL not set");
        return null;
    }

    // Use SUPABASE_BUCKET environment variable, default to master_images
    // Note: process.env.SUPABASE_BUCKET is usually server-only. If undefined on client, we fallback to string.
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || "master_images";

    // If path already starts with bucket name, strip it to avoid duplication
    // e.g. "master_images/master/..." -> "master/..."
    const cleanPath = path.startsWith(`${bucketName}/`) ? path.slice(bucketName.length + 1) : path;

    // Build the URL
    const fullUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanPath}`;

    // Only log error if needed, reduce console noise
    // console.log("Generated image URL:", fullUrl);

    return fullUrl;
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

    // ===================== POSITION TAB DATA =====================
    const { data: positionData = [], isLoading: positionLoading } = useQuery({
        queryKey: ["inventory", "position"],
        queryFn: async () => {
            const client = getSchemaClient();
            const { data, error } = await client
                .from(CONTRACTS.views.inventoryPositionByItemLabel)
                .select("*")
                .order("on_hand_qty", { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data as PositionRow[]) ?? [];
        },
    });

    const filteredPosition = positionData.filter((row) =>
        row.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ===================== MASTER SEARCH FOR MOVES TAB =====================
    const { data: masterSearchResults = [] } = useQuery({
        queryKey: ["master", "search", masterSearchQuery],
        queryFn: async () => {
            if (!masterSearchQuery || masterSearchQuery.length < 1) return [];
            const client = getSchemaClient();
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
            const { data, error } = await client
                .from(CONTRACTS.views.inventoryMoveLinesEnriched)
                .select("*")
                .order("occurred_at", { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data as any[]) ?? [];
        },
    });

    const quickMoveForm = useForm<QuickMoveForm>({
        defaultValues: {
            move_type: "RECEIPT",
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
            labor_center_sell: undefined,
            labor_sub1_sell: undefined,
            labor_sub2_sell: undefined,
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

        // Resolve Session Reference if selected
        let refType: any = null;
        let refId = null;

        if (values.session_id) {
            refType = "STOCKTAKE_SESSION";
            refId = values.session_id;
        }

        quickMoveMutation.mutate({
            p_move_type: values.move_type,
            p_item_name: values.model_name, // Use model_name as item_name
            p_qty: values.qty,
            p_occurred_at: new Date().toISOString(),
            p_party_id: null,
            p_master_id: values.master_id || null,
            p_variant_hint: values.material_code || null,
            p_unit: "EA",
            p_source: "MANUAL",
            p_memo: values.memo || null,
            p_meta: values.session_id ? { session_id: values.session_id } : {},
            p_idempotency_key: null,
            p_actor_person_id: null,
            p_note: refId ? `Linked to session` : null,
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
        quickMoveForm.setValue("labor_center_sell", selectedMaster.labor_center_sell || 0);
        quickMoveForm.setValue("labor_sub1_sell", selectedMaster.labor_sub1_sell || 0);
        quickMoveForm.setValue("labor_sub2_sell", selectedMaster.labor_sub2_sell || 0);

        // STRICT RULE: DO NOT copy weight fields
        // quickMoveForm.setValue("base_weight_g", ...) // FORBIDDEN
        // quickMoveForm.setValue("deduction_weight_g", ...) // FORBIDDEN

        toast.info("마스터 데이터 복사됨 (중량 제외)");
    };

    // ===================== STOCKTAKE TAB DATA =====================
    const { data: sessionsData = [] } = useQuery({
        queryKey: ["inventory", "stocktake", "sessions"],
        queryFn: async () => {
            const client = getSchemaClient();
            const { data, error } = await client
                .from(CONTRACTS.views.inventoryCountSessions)
                .select("*")
                .order("created_at", { ascending: false })
                .limit(20);
            if (error) throw error;
            return (data as SessionRow[]) ?? [];
        },
    });

    const { data: sessionLinesData = [] } = useQuery({
        queryKey: ["inventory", "stocktake", "lines", selectedSessionId],
        queryFn: async () => {
            if (!selectedSessionId) return [];
            const client = getSchemaClient();
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

    const finalizeMutation = useRpcMutation<any>({
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
        <div className="space-y-6">
            <ActionBar title="재고관리" subtitle="재고 현황, 입출고, 실사" />

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--panel-border)]">
                <button
                    onClick={() => setActiveTab("position")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "position"
                            ? "border-[var(--primary)] text-[var(--primary)]"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                >
                    현재재고 (Position)
                </button>
                <button
                    onClick={() => setActiveTab("moves")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "moves"
                            ? "border-[var(--primary)] text-[var(--primary)]"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                >
                    입출고 (Moves)
                </button>
                <button
                    onClick={() => setActiveTab("stocktake")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "stocktake"
                            ? "border-[var(--primary)] text-[var(--primary)]"
                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                >
                    실사 (Stocktake)
                </button>
            </div>

            {/* Position Tab */}
            {activeTab === "position" && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <ActionBar title="현재 재고" />
                                <Input
                                    placeholder="품목 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-64"
                                />
                            </div>
                        </CardHeader>
                        <CardBody>
                            {positionLoading ? (
                                <p className="text-sm text-[var(--muted)]">로딩 중...</p>
                            ) : filteredPosition.length === 0 ? (
                                <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                            ) : (
                                <div className="overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                            <tr>
                                                <th className="text-left pb-2">품목명</th>
                                                <th className="text-left pb-2">변종</th>
                                                <th className="text-right pb-2">재고</th>
                                                <th className="text-left pb-2">최종이동</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--panel-border)]">
                                            {filteredPosition.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-[var(--panel-hover)]">
                                                    <td className="py-2 font-medium">{row.item_name}</td>
                                                    <td className="py-2 text-xs text-[var(--muted)]">{row.variant_hint || "-"}</td>
                                                    <td className="py-2 text-right font-mono">
                                                        <span
                                                            className={cn(
                                                                "px-2 py-1 rounded text-xs font-semibold",
                                                                row.on_hand_qty < 0
                                                                    ? "bg-red-100 text-red-700"
                                                                    : row.on_hand_qty === 0
                                                                        ? "bg-gray-100 text-gray-600"
                                                                        : "bg-green-100 text-green-700"
                                                            )}
                                                        >
                                                            {row.on_hand_qty}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-xs text-[var(--muted)]">{formatKst(row.last_move_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Moves Tab */}
            {activeTab === "moves" && (
                <div className="grid grid-cols-10 gap-4">
                    {/* Left Panel: 50% = 5 cols - Moves History */}
                    <Card className="col-span-5">
                        <CardHeader>
                            <ActionBar title="입출고 이력" />
                        </CardHeader>
                        <CardBody>
                            {movesData.length === 0 ? (
                                <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                            ) : (
                                <div className="overflow-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                            <tr>
                                                <th className="text-left pb-2">시각</th>
                                                <th className="text-center pb-2">번호</th>
                                                <th className="text-left pb-2">모델명</th>
                                                <th className="text-center pb-2">타입</th>
                                                <th className="text-right pb-2">수량</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--panel-border)]">
                                            {movesData.map((move: any) => (
                                                <tr key={move.move_line_id || move.move_id} className="hover:bg-[var(--panel-hover)]">
                                                    <td className="py-2 text-xs text-[var(--muted)] whitespace-nowrap">{formatKst(move.occurred_at).split(' ')[0]}<br />{formatKst(move.occurred_at).split(' ')[1]}</td>
                                                    <td className="py-2 text-center text-xs text-[var(--muted)] font-mono">{move.move_no}</td>
                                                    <td className="py-2 font-medium">{move.master_model_name || move.item_name}</td>
                                                    <td className="py-2 text-center">
                                                        <span
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                                                                move.move_type === "RECEIPT"
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                    : move.move_type === "ISSUE"
                                                                        ? "bg-orange-50 text-orange-700 border-orange-200"
                                                                        : "bg-purple-50 text-purple-700 border-purple-200"
                                                            )}
                                                        >
                                                            {move.move_type}
                                                        </span>
                                                    </td>
                                                    <td className={cn("py-2 text-right font-mono", move.direction === 'IN' ? "text-blue-600" : "text-orange-600")}>
                                                        {move.direction === 'IN' ? '+' : '-'}{move.qty}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* Middle Panel: 20% = 2 cols - Master Detail */}
                    <Card className="col-span-2">
                        <CardHeader>
                            <ActionBar title="마스터 내용" />
                        </CardHeader>
                        <CardBody>
                            {!selectedMaster ? (
                                <p className="text-xs text-[var(--muted)] text-center py-8">
                                    마스터를 선택하세요
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Image */}
                                    <div className="aspect-square bg-gray-100 rounded overflow-hidden border border-[var(--panel-border)] relative group">
                                        {(() => {
                                            const imageUrl = getImageUrl(selectedMaster.photo_url || selectedMaster.image_path);
                                            return imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={selectedMaster.model_name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : null;
                                        })()}
                                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs p-1 text-center">
                                            {selectedMaster.model_name}
                                        </div>
                                    </div>

                                    {/* 2-Col Grid: Cost (Left) | Sell (Right) */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="col-span-2 font-semibold border-b pb-1">기본 정보</div>
                                        <div className="text-[var(--muted)]">재질: {selectedMaster.material_code_default}</div>
                                        <div className="text-[var(--muted)]">분류: {selectedMaster.category_code}</div>

                                        <div className="col-span-2 font-semibold border-b pb-1 mt-2">중량 (g)</div>
                                        <div>기본: {selectedMaster.weight_default_g}</div>
                                        <div>차감: {selectedMaster.deduction_weight_default_g}</div>

                                        <div className="col-span-2 font-semibold border-b pb-1 mt-2">스톤 (EA)</div>
                                        <div>Center: {selectedMaster.center_qty_default}</div>
                                        <div>Sub: {selectedMaster.sub1_qty_default} / {selectedMaster.sub2_qty_default}</div>

                                        <div className="col-span-2 font-semibold border-b pb-1 mt-2 flex justify-between">
                                            <span>공임/도금</span>
                                            <span className="flex gap-4"><span className="text-gray-500">원가</span> <span>판매</span></span>
                                        </div>

                                        {/* Cost (Left) | Sell (Right) */}
                                        <div className="text-gray-500">{selectedMaster.labor_base_cost?.toLocaleString() || 0}</div>
                                        <div>{selectedMaster.labor_base_sell?.toLocaleString() || 0}</div>

                                        <div className="text-gray-500">{selectedMaster.labor_center_cost?.toLocaleString() || 0}</div>
                                        <div>{selectedMaster.labor_center_sell?.toLocaleString() || 0}</div>

                                        <div className="text-gray-500">{(selectedMaster.plating_price_cost_default || 0).toLocaleString()}</div>
                                        <div>{(selectedMaster.plating_price_sell_default || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* Right Panel: 30% = 3 cols - Quick Input */}
                    <Card className="col-span-3">
                        <CardHeader>
                            <ActionBar title="빠른 입력" />
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={quickMoveForm.handleSubmit(onSubmitQuickMove)} className="space-y-4">
                                {/* Top Section: Basic Input */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">타입</label>
                                        <Select {...quickMoveForm.register("move_type")}>
                                            <option value="RECEIPT">입고</option>
                                            <option value="ISSUE">출고</option>
                                            <option value="ADJUST">조정</option>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">위치 (세션)</label>
                                        <Select {...quickMoveForm.register("session_id")}>
                                            <option value="">(선택 안함)</option>
                                            {sessionsData.map(s => (
                                                <option key={s.session_id} value={s.session_id}>
                                                    {s.location_code || s.session_code || `Session #${s.session_no}`}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="space-y-1 col-span-1">
                                        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">모델명</label>
                                        <div className="relative">
                                            <Input
                                                {...quickMoveForm.register("model_name")}
                                                onFocus={() => setShowMasterSearch(true)}
                                                onChange={(e) => {
                                                    quickMoveForm.setValue("model_name", e.target.value);
                                                    setMasterSearchQuery(e.target.value);
                                                    setShowMasterSearch(true);
                                                }}
                                                placeholder="Model..."
                                            />
                                            {showMasterSearch && masterSearchResults.length > 0 && (
                                                <div className="absolute z-10 w-full bg-[var(--card)] border border-[var(--panel-border)] shadow-lg rounded-md mt-1 max-h-48 overflow-auto">
                                                    {masterSearchResults.map((master: MasterItem, idx: number) => (
                                                        <button
                                                            key={`${master.master_id}-${idx}`}
                                                            type="button"
                                                            onClick={() => handleMasterSelect(master)}
                                                            className="w-full text-left p-2 hover:bg-[var(--panel-hover)] text-xs border-b border-[var(--panel-border)]"
                                                        >
                                                            <div className="font-semibold">{master.model_name}</div>
                                                            <div className="text-[10px] text-[var(--muted)]">{master.vendor_name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 col-span-1">
                                        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">수량</label>
                                        <Input type="number" {...quickMoveForm.register("qty", { valueAsNumber: true })} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">메모</label>
                                    <Input {...quickMoveForm.register("memo")} placeholder="Memo..." />
                                </div>

                                {/* Register Button Block - Visually matching image height? */}
                                <Button type="submit" variant="primary" className="w-full py-6 text-lg font-bold shadow-md">
                                    등 록
                                </Button>

                                <hr className="border-dashed border-[var(--panel-border)] my-4" />

                                {/* Bottom Section: Detailed Input (2 Cols: Cost | Sell) */}
                                <div className="space-y-3 p-3 bg-gray-50 rounded border border-[var(--panel-border)]">
                                    <div className="flex justify-between items-center">
                                        {/* Master Copy Button */}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCopyFromMaster}
                                            disabled={!selectedMaster}
                                            className="text-xs bg-white"
                                        >
                                            ⬇ 마스터 복사
                                        </Button>
                                        <span className="text-[10px] text-[var(--muted)]">중량은 복사되지 않음</span>
                                    </div>

                                    {/* 2-Col Grid */}
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                        {/* Headers */}
                                        <div className="text-center text-[var(--muted)] font-semibold border-b pb-1">원가 (Cost)</div>
                                        <div className="text-center text-[var(--muted)] font-semibold border-b pb-1">판매 (Sell)</div>

                                        {/* Material / Category */}
                                        <Input {...quickMoveForm.register("material_code")} placeholder="Material Code" />
                                        <Input {...quickMoveForm.register("category_code")} placeholder="Category Code" />

                                        {/* Weight */}
                                        <div className="col-span-2 text-center text-[var(--muted)] mt-1">- 중량 (g) -</div>
                                        <Input {...quickMoveForm.register("base_weight_g", { valueAsNumber: true })} placeholder="기본 중량 *" className="bg-yellow-50" />
                                        <Input {...quickMoveForm.register("deduction_weight_g", { valueAsNumber: true })} placeholder="차감 중량 *" className="bg-yellow-50" />

                                        {/* Stone */}
                                        <div className="col-span-2 text-center text-[var(--muted)] mt-1">- 스톤 (Qty) -</div>
                                        <Input {...quickMoveForm.register("sub1_qty", { valueAsNumber: true })} placeholder="Sub 1" />
                                        <Input {...quickMoveForm.register("center_qty", { valueAsNumber: true })} placeholder="Center" />

                                        {/* Plating */}
                                        <div className="col-span-2 text-center text-[var(--muted)] mt-1">- 도금 -</div>
                                        <Input {...quickMoveForm.register("plating_cost", { valueAsNumber: true })} placeholder="Cost" />
                                        <Input {...quickMoveForm.register("plating_sell", { valueAsNumber: true })} placeholder="Sell" />

                                        {/* Labor */}
                                        <div className="col-span-2 text-center text-[var(--muted)] mt-1">- 공임 -</div>
                                        <Input {...quickMoveForm.register("labor_base_cost", { valueAsNumber: true })} placeholder="Base Cost" />
                                        <Input {...quickMoveForm.register("labor_base_sell", { valueAsNumber: true })} placeholder="Base Sell" />
                                    </div>
                                </div>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}


            {/* Stocktake Tab */}
            {activeTab === "stocktake" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Session List */}
                    <Card>
                        <CardHeader>
                            <ActionBar title="실사 세션" />
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={sessionForm.handleSubmit(onCreateSession)} className="space-y-3 mb-4 pb-4 border-b">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                                        세션명 (이름)
                                    </label>
                                    <Input {...sessionForm.register("session_code")} placeholder="예: 사무실 금고, 1층 매장" />
                                </div>
                                <Button type="submit" className="w-full" disabled={createSessionMutation.isPending}>
                                    {createSessionMutation.isPending ? "생성 중..." : "새 세션 생성"}
                                </Button>
                            </form>

                            <div className="mb-2">
                                <Input
                                    placeholder="세션 검색 (이름, 번호)"
                                    value={sessionSearchQuery}
                                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                                    className="text-xs"
                                />
                            </div>

                            <div className="space-y-2 max-h-64 overflow-auto">
                                {sessionsData
                                    .filter(s => {
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
                                                "w-full text-left p-3 rounded border transition-colors",
                                                selectedSessionId === session.session_id
                                                    ? "border-[var(--primary)] bg-[var(--chip)]"
                                                    : "border-[var(--panel-border)] hover:bg-[var(--panel-hover)]"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold">
                                                    {session.session_code ? (
                                                        <>
                                                            {session.session_code} <span className="text-xs text-[var(--muted)] font-normal">#{session.session_no}</span>
                                                        </>
                                                    ) : (
                                                        `#${session.session_no}`
                                                    )}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-xs px-2 py-0.5 rounded font-semibold",
                                                        session.status === "FINALIZED"
                                                            ? "bg-green-100 text-green-700"
                                                            : session.status === "VOID"
                                                                ? "bg-red-100 text-red-700"
                                                                : "bg-yellow-100 text-yellow-700"
                                                    )}
                                                >
                                                    {session.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--muted)]">{formatKst(session.snapshot_at)}</p>
                                            <p className="text-xs text-[var(--muted)]">
                                                라인: {session.line_count} | 델타: {session.delta_line_count}
                                            </p>
                                        </button>
                                    ))}
                            </div>
                        </CardBody>
                    </Card>

                    {/* Session Detail */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <ActionBar title={selectedSession ? `세션 #${selectedSession.session_no}` : "세션 선택"} />
                                {selectedSession && (
                                    <div className="flex gap-2">
                                        {!isFinalized && (
                                            <>
                                                <Button onClick={onFinalize} disabled={finalizeMutation.isPending} size="sm">
                                                    {finalizeMutation.isPending ? "확정 중..." : "Finalize"}
                                                </Button>
                                                <Button
                                                    onClick={onVoidSession}
                                                    disabled={voidSessionMutation.isPending}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    취소
                                                </Button>
                                            </>
                                        )}
                                        {selectedSession.generated_move_id && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                ADJUST Move #{selectedSession.generated_move_status}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardBody>
                            {!selectedSessionId ? (
                                <p className="text-sm text-[var(--muted)]">왼쪽에서 세션을 선택하세요</p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Add Line Form */}
                                    {!isFinalized && (
                                        <form
                                            onSubmit={countLineForm.handleSubmit(onAddLine)}
                                            className="flex gap-2 pb-4 border-b border-[var(--panel-border)]"
                                        >
                                            <div className="flex-1 relative">
                                                <Input
                                                    {...countLineForm.register("item_name", { required: true })}
                                                    placeholder="품목명 (마스터 검색) *"
                                                    disabled={isFinalized}
                                                    autoComplete="off"
                                                    onFocus={() => {
                                                        setShowMasterSearch(true);
                                                        // Reuse existing master search logic, clearing if needed?
                                                        // Assuming masterSearchResults is shared state.
                                                    }}
                                                    onChange={(e) => {
                                                        countLineForm.setValue("item_name", e.target.value);
                                                        setMasterSearchQuery(e.target.value);
                                                        setShowMasterSearch(true);
                                                    }}
                                                />
                                                {showMasterSearch && masterSearchResults.length > 0 && activeTab === "stocktake" && (
                                                    <div className="absolute z-50 w-full bg-[var(--card)] border border-[var(--panel-border)] shadow-lg rounded-md mt-1 max-h-48 overflow-auto left-0">
                                                        {masterSearchResults.map((master: MasterItem, idx: number) => (
                                                            <button
                                                                key={`${master.master_id}-${idx}-st`}
                                                                type="button"
                                                                onClick={() => {
                                                                    countLineForm.setValue("item_name", master.model_name);
                                                                    countLineForm.setValue("master_id", master.master_id);
                                                                    setShowMasterSearch(false);
                                                                }}
                                                                className="w-full text-left p-2 hover:bg-[var(--panel-hover)] text-xs border-b border-[var(--panel-border)]"
                                                            >
                                                                <div className="font-semibold">{master.model_name}</div>
                                                                <div className="text-[10px] text-[var(--muted)]">{master.vendor_name}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Input
                                                type="number"
                                                {...countLineForm.register("counted_qty", { required: true, valueAsNumber: true })}
                                                placeholder="수량 *"
                                                className="w-24"
                                                disabled={isFinalized}
                                            />
                                            <Button type="submit" disabled={addLineMutation.isPending || isFinalized}>
                                                {addLineMutation.isPending ? "추가 중..." : "추가"}
                                            </Button>
                                        </form>
                                    )}

                                    {/* Lines Table */}
                                    {sessionLinesData.length === 0 ? (
                                        <p className="text-sm text-[var(--muted)]">라인이 없습니다</p>
                                    ) : (
                                        <div className="overflow-auto">
                                            <table className="w-full text-sm">
                                                <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                                    <tr>
                                                        <th className="text-left pb-2">#</th>
                                                        <th className="text-left pb-2">품목명</th>
                                                        <th className="text-right pb-2">실사</th>
                                                        <th className="text-right pb-2">시스템</th>
                                                        <th className="text-right pb-2">델타</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--panel-border)]">
                                                    {sessionLinesData
                                                        .filter((l) => !l.is_void)
                                                        .map((line) => (
                                                            <tr key={line.count_line_id} className="hover:bg-[var(--panel-hover)]">
                                                                <td className="py-2 text-xs font-mono">{line.line_no}</td>
                                                                <td className="py-2">{line.item_name}</td>
                                                                <td className="py-2 text-right font-mono">{line.counted_qty}</td>
                                                                <td className="py-2 text-right font-mono text-[var(--muted)]">
                                                                    {line.system_qty_asof ?? "-"}
                                                                </td>
                                                                <td className="py-2 text-right font-mono">
                                                                    {line.delta_qty !== null && line.delta_qty !== undefined ? (
                                                                        <span
                                                                            className={cn(
                                                                                "px-2 py-0.5 rounded text-xs font-semibold",
                                                                                line.delta_qty > 0
                                                                                    ? "bg-blue-100 text-blue-700"
                                                                                    : line.delta_qty < 0
                                                                                        ? "bg-red-100 text-red-700"
                                                                                        : "bg-gray-100 text-gray-600"
                                                                            )}
                                                                        >
                                                                            {line.delta_qty > 0 ? "+" : ""}
                                                                            {line.delta_qty}
                                                                        </span>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}
