"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
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
type PartMasterRow = {
    part_id: string;
    part_name: string;
    part_kind: "PART" | "STONE";
    family_name?: string;
    spec_text?: string;
    unit_default: "EA" | "G" | "M";
    is_reusable: boolean;
    reorder_min?: number;
    reorder_max?: number;
    qr_code?: string;
    onhand_qty?: number;
    last_unit_cost_krw?: number;
    below_min?: boolean;
    is_active: boolean;
};

type PartMoveLineRow = {
    move_line_id: string;
    occurred_at: string;
    direction: "IN" | "OUT";
    qty: number;
    unit: string;
    unit_cost_krw?: number;
    amount_krw?: number;
    memo?: string;
    move_id: string;
    source?: string;
};

type UnlinkedWorklistRow = {
    item_name: string;
    total_qty: number;
    total_lines: number;
    last_occurred_at: string;
};

type UsageDailyRow = {
    day: string;
    part_id?: string;
    part_name?: string;
    item_name?: string;
    qty: number;
    amount_krw?: number;
};

type PartMasterForm = {
    part_name: string;
    part_kind: "PART" | "STONE";
    family_name?: string;
    spec_text?: string;
    unit_default: "EA" | "G" | "M";
    is_reusable: boolean;
    reorder_min?: number;
    reorder_max?: number;
    qr_code?: string;
    note?: string;
};

type ReceiptLine = {
    part_id?: string;
    part_name: string;
    qty: number;
    unit: string;
    unit_cost_krw?: number;
};

type ReceiptForm = {
    occurred_at: string;
    vendor_party_id?: string;
    location_code?: string;
    memo?: string;
    source: string;
    lines: ReceiptLine[];
};

type UsageLine = {
    part_id?: string;
    part_name: string;
    qty: number;
    unit: string;
    unit_cost_krw?: number;
};

type UsageForm = {
    occurred_at: string;
    use_kind?: string;
    ref_doc_type?: string;
    ref_doc_id?: string;
    location_code?: string;
    memo?: string;
    source: string;
    lines: UsageLine[];
};

type AliasForm = {
    alias_name: string;
};

type Mode = "parts" | "unlinked" | "analytics";
type ActiveTab = "info" | "aliases" | "ledger" | "analytics";

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

// ===================== MAIN COMPONENT =====================
export default function PartsPage() {
    const queryClient = useQueryClient();

    // ===================== STATE =====================
    const [mode, setMode] = useState<Mode>("parts");
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>("info");
    const [searchQuery, setSearchQuery] = useState("");
    const [kindFilter, setKindFilter] = useState<"ALL" | "PART" | "STONE">("ALL");
    const [unitFilter, setUnitFilter] = useState<"ALL" | "EA" | "G" | "M">("ALL");
    const [reorderFilter, setReorderFilter] = useState<"ALL" | "below_min" | "normal">("ALL");
    const [activeOnly, setActiveOnly] = useState(true);

    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showUsageModal, setShowUsageModal] = useState(false);
    const [showPartForm, setShowPartForm] = useState(false);

    // ===================== QUERIES =====================
    const { data: partsData = [], isLoading: partsLoading } = useQuery({
        queryKey: ["cms", "parts", "list", kindFilter, unitFilter, reorderFilter, activeOnly],
        queryFn: async () => {
            const client = getSchemaClient();
            let query = client.from(CONTRACTS.views.partMasterWithPosition).select("*");

            if (activeOnly) {
                query = query.eq("is_active", true);
            }

            const { data, error } = await query.order("part_name");
            if (error) throw error;
            return (data as PartMasterRow[]) ?? [];
        },
        placeholderData: keepPreviousData,
    });

    const { data: moveLinesData = [] } = useQuery({
        queryKey: ["cms", "parts", "moves", selectedPartId],
        queryFn: async () => {
            if (!selectedPartId) return [];
            const client = getSchemaClient();
            const { data, error } = await client
                .from(CONTRACTS.views.partMoveLines)
                .select("*")
                .eq("part_id", selectedPartId)
                .order("occurred_at", { ascending: false });
            if (error) throw error;
            return (data as PartMoveLineRow[]) ?? [];
        },
        enabled: !!selectedPartId && activeTab === "ledger",
    });

    const { data: unlinkedData = [] } = useQuery({
        queryKey: ["cms", "parts", "unlinked"],
        queryFn: async () => {
            const client = getSchemaClient();
            const { data, error } = await client
                .from(CONTRACTS.views.partUnlinkedWorklist)
                .select("*")
                .order("total_qty", { ascending: false });
            if (error) throw error;
            return (data as UnlinkedWorklistRow[]) ?? [];
        },
        enabled: mode === "unlinked",
    });

    const { data: analyticsData = [] } = useQuery({
        queryKey: ["cms", "parts", "analytics"],
        queryFn: async () => {
            const client = getSchemaClient();
            const { data, error } = await client
                .from(CONTRACTS.views.partUsageDaily)
                .select("*")
                .order("day", { ascending: false })
                .limit(100);
            if (error) throw error;
            return (data as UsageDailyRow[]) ?? [];
        },
        enabled: mode === "analytics",
    });

    // ===================== FORMS =====================
    const partMasterForm = useForm<PartMasterForm>({
        defaultValues: {
            part_name: "",
            part_kind: "PART",
            unit_default: "EA",
            is_reusable: false,
        },
    });

    const receiptForm = useForm<ReceiptForm>({
        defaultValues: {
            occurred_at: getKstNow(),
            source: "MANUAL",
            lines: [{ part_name: "", qty: 0, unit: "EA" }],
        },
    });

    const usageForm = useForm<UsageForm>({
        defaultValues: {
            occurred_at: getKstNow(),
            source: "MANUAL",
            lines: [{ part_name: "", qty: 0, unit: "EA" }],
        },
    });

    const aliasForm = useForm<AliasForm>({
        defaultValues: {
            alias_name: "",
        },
    });

    // ===================== MUTATIONS =====================
    const partUpsertMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.partItemUpsert,
        successMessage: "부속 저장 완료",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms", "parts"] });
            partMasterForm.reset();
            setShowPartForm(false);
        },
    });

    const aliasAddMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.partAliasAdd,
        successMessage: "별칭 추가 완료",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms", "parts"] });
            aliasForm.reset();
        },
    });

    const receiptRecordMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.partReceiptRecord,
        successMessage: "입고 기록 완료",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms", "parts"] });
            receiptForm.reset({
                occurred_at: getKstNow(),
                source: "MANUAL",
                lines: [{ part_name: "", qty: 0, unit: "EA" }],
            });
            setShowReceiptModal(false);
        },
    });

    const usageRecordMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.partUsageRecord,
        successMessage: "사용 기록 완료",
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cms", "parts"] });
            usageForm.reset({
                occurred_at: getKstNow(),
                source: "MANUAL",
                lines: [{ part_name: "", qty: 0, unit: "EA" }],
            });
            setShowUsageModal(false);
        },
    });

    // ===================== HANDLERS =====================
    const onSavePartMaster = (values: PartMasterForm) => {
        const correlationId = crypto.randomUUID();
        partUpsertMutation.mutate({
            p_part_id: selectedPartId || null,
            p_part_name: values.part_name,
            p_part_kind: values.part_kind,
            p_family_name: values.family_name || null,
            p_spec_text: values.spec_text || null,
            p_unit_default: values.unit_default,
            p_is_reusable: values.is_reusable,
            p_reorder_min_qty: values.reorder_min || null,
            p_reorder_max_qty: values.reorder_max || null,
            p_qr_code: values.qr_code || null,
            p_note: values.note || null,
            p_meta: {},
            p_actor_person_id: null,
            p_correlation_id: correlationId,
        });
    };

    const onAddAlias = (values: AliasForm) => {
        if (!selectedPartId) {
            toast.error("부속을 선택해주세요");
            return;
        }
        const correlationId = crypto.randomUUID();
        aliasAddMutation.mutate({
            p_part_id: selectedPartId,
            p_alias_name: values.alias_name,
            p_actor_person_id: null,
            p_note: null,
            p_correlation_id: correlationId,
        });
    };

    const onSaveReceipt = (values: ReceiptForm) => {
        const correlationId = crypto.randomUUID();
        const idempotencyKey = `parts:receipt:${correlationId}`;

        const linesJsonb = JSON.stringify(
            values.lines.map((line) => ({
                part_id: line.part_id || null,
                item_name: line.part_name,
                qty: line.qty,
                unit: line.unit,
                unit_cost_krw: line.unit_cost_krw || null,
            }))
        );

        receiptRecordMutation.mutate({
            p_occurred_at: values.occurred_at,
            p_location_code: values.location_code || null,
            p_vendor_party_id: values.vendor_party_id || null,
            p_memo: values.memo || null,
            p_source: values.source,
            p_lines: linesJsonb,
            p_idempotency_key: idempotencyKey,
            p_actor_person_id: null,
            p_note: null,
            p_correlation_id: correlationId,
        });
    };

    const onSaveUsage = (values: UsageForm) => {
        const correlationId = crypto.randomUUID();
        const idempotencyKey = `parts:usage:${correlationId}`;

        const linesJsonb = JSON.stringify(
            values.lines.map((line) => ({
                part_id: line.part_id || null,
                item_name: line.part_name,
                qty: line.qty,
                unit: line.unit,
                unit_cost_krw: line.unit_cost_krw || null,
            }))
        );

        usageRecordMutation.mutate({
            p_occurred_at: values.occurred_at,
            p_use_kind: values.use_kind || null,
            p_ref_doc_type: values.ref_doc_type || null,
            p_ref_doc_id: values.ref_doc_id || null,
            p_location_code: values.location_code || null,
            p_memo: values.memo || null,
            p_source: values.source,
            p_lines: linesJsonb,
            p_idempotency_key: idempotencyKey,
            p_actor_person_id: null,
            p_note: null,
            p_correlation_id: correlationId,
        });
    };

    // ===================== FILTERED DATA =====================
    const filteredParts = partsData.filter((part) => {
        const matchesSearch = part.part_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesKind = kindFilter === "ALL" || part.part_kind === kindFilter;
        const matchesUnit = unitFilter === "ALL" || part.unit_default === unitFilter;
        const matchesReorder =
            reorderFilter === "ALL" ||
            (reorderFilter === "below_min" && part.below_min) ||
            (reorderFilter === "normal" && !part.below_min);
        return matchesSearch && matchesKind && matchesUnit && matchesReorder;
    });

    const selectedPart = partsData.find((p) => p.part_id === selectedPartId);

    // ===================== RENDER =====================
    return (
        <div className="space-y-6">
            <ActionBar
                title="부속"
                subtitle="부자재/스톤 입고·사용 기록 및 분석"
                actions={
                    <>
                        <Button onClick={() => setShowPartForm(true)}>+ 부속 추가</Button>
                        <Button onClick={() => setShowReceiptModal(true)}>+ 입고 기록</Button>
                        <Button onClick={() => setShowUsageModal(true)}>+ 사용 기록</Button>
                    </>
                }
            />

            {/* FilterBar */}
            <Card>
                <CardBody>
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Mode Segments */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode("parts")}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap",
                                    mode === "parts"
                                        ? "bg-[var(--primary)] text-white"
                                        : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                                )}
                            >
                                부속
                            </button>
                            <button
                                onClick={() => setMode("unlinked")}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap",
                                    mode === "unlinked"
                                        ? "bg-[var(--primary)] text-white"
                                        : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                                )}
                            >
                                미등록정리
                            </button>
                            <button
                                onClick={() => setMode("analytics")}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap",
                                    mode === "analytics"
                                        ? "bg-[var(--primary)] text-white"
                                        : "bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-hover)]"
                                )}
                            >
                                분석
                            </button>
                        </div>

                        {/* Search and Filters */}
                        {mode === "parts" && (
                            <>
                                <Input
                                    placeholder="검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-48"
                                />
                                <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
                                    <option value="ALL">종류: 전체</option>
                                    <option value="PART">부자재</option>
                                    <option value="STONE">스톤</option>
                                </Select>
                                <Select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value as any)}>
                                    <option value="ALL">단위: 전체</option>
                                    <option value="EA">EA</option>
                                    <option value="G">G</option>
                                    <option value="M">M</option>
                                </Select>
                                <Select value={reorderFilter} onChange={(e) => setReorderFilter(e.target.value as any)}>
                                    <option value="ALL">재주문: 전체</option>
                                    <option value="below_min">하한 미달</option>
                                    <option value="normal">정상</option>
                                </Select>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={activeOnly}
                                        onChange={(e) => setActiveOnly(e.target.checked)}
                                    />
                                    활성만
                                </label>
                            </>
                        )}
                    </div>
                </CardBody>
            </Card>

            {/* Parts Mode */}
            {mode === "parts" && (
                <div className="grid grid-cols-10 gap-4">
                    {/* Left: Parts List */}
                    <Card className="col-span-3">
                        <CardHeader>
                            <ActionBar title="부속 목록" />
                        </CardHeader>
                        <CardBody>
                            {partsLoading && filteredParts.length === 0 ? (
                                <p className="text-sm text-[var(--muted)]">로딩 중...</p>
                            ) : filteredParts.length === 0 ? (
                                <p className="text-sm text-[var(--muted)]">데이터 없음</p>
                            ) : (
                                <div className={cn("space-y-2 max-h-[600px] overflow-auto", partsLoading && "opacity-50 pointer-events-none")}>
                                    {filteredParts.map((part) => (
                                        <button
                                            key={part.part_id}
                                            onClick={() => {
                                                setSelectedPartId(part.part_id);
                                                setActiveTab("info");
                                            }}
                                            className={cn(
                                                "w-full text-left p-3 rounded border transition-colors",
                                                selectedPartId === part.part_id
                                                    ? "border-[var(--primary)] bg-[var(--chip)]"
                                                    : "border-[var(--panel-border)] hover:bg-[var(--panel-hover)]"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="font-semibold text-sm">{part.part_name}</span>
                                                <div className="flex gap-1">
                                                    <span
                                                        className={cn(
                                                            "text-xs px-1.5 py-0.5 rounded",
                                                            part.part_kind === "STONE"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-blue-100 text-blue-700"
                                                        )}
                                                    >
                                                        {part.part_kind}
                                                    </span>
                                                    {part.below_min && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                                            재주문
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-[var(--muted)]">
                                                재고: {part.onhand_qty ?? 0} {part.unit_default}
                                            </div>
                                            {part.last_unit_cost_krw && (
                                                <div className="text-xs text-[var(--muted)]">
                                                    단가: {part.last_unit_cost_krw.toLocaleString()}원
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* Right: Parts Detail */}
                    <Card className="col-span-7">
                        <CardHeader>
                            <ActionBar
                                title={selectedPart ? selectedPart.part_name : "부속 상세"}
                                actions={selectedPart && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                receiptForm.reset({
                                                    occurred_at: getKstNow(),
                                                    source: "MANUAL",
                                                    lines: [
                                                        {
                                                            part_id: selectedPart.part_id,
                                                            part_name: selectedPart.part_name,
                                                            qty: 0,
                                                            unit: selectedPart.unit_default,
                                                            unit_cost_krw: selectedPart.last_unit_cost_krw,
                                                        },
                                                    ],
                                                });
                                                setShowReceiptModal(true);
                                            }}
                                        >
                                            + 입고
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                usageForm.reset({
                                                    occurred_at: getKstNow(),
                                                    source: "MANUAL",
                                                    lines: [
                                                        {
                                                            part_id: selectedPart.part_id,
                                                            part_name: selectedPart.part_name,
                                                            qty: 0,
                                                            unit: selectedPart.unit_default,
                                                        },
                                                    ],
                                                });
                                                setShowUsageModal(true);
                                            }}
                                        >
                                            - 사용
                                        </Button>
                                    </>
                                )}
                            />
                        </CardHeader>
                        <CardBody>
                            {!selectedPart ? (
                                <p className="text-sm text-[var(--muted)] text-center py-8">부속을 선택하세요</p>
                            ) : (
                                <div>
                                    {/* Tabs */}
                                    <div className="flex gap-2 border-b border-[var(--panel-border)] mb-4">
                                        {(["info", "aliases", "ledger", "analytics"] as ActiveTab[]).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={cn(
                                                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                                    activeTab === tab
                                                        ? "border-[var(--primary)] text-[var(--primary)]"
                                                        : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                                                )}
                                            >
                                                {tab === "info"
                                                    ? "기본정보"
                                                    : tab === "aliases"
                                                        ? "별칭"
                                                        : tab === "ledger"
                                                            ? "원장"
                                                            : "분석"}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content */}
                                    {activeTab === "info" && (
                                        <form onSubmit={partMasterForm.handleSubmit(onSavePartMaster)} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-semibold">부속명 *</label>
                                                    <Input
                                                        {...partMasterForm.register("part_name", { required: true })}
                                                        defaultValue={selectedPart.part_name}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold">종류 *</label>
                                                    <Select
                                                        {...partMasterForm.register("part_kind")}
                                                        defaultValue={selectedPart.part_kind}
                                                    >
                                                        <option value="PART">부자재</option>
                                                        <option value="STONE">스톤</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold">단위 *</label>
                                                    <Select
                                                        {...partMasterForm.register("unit_default")}
                                                        defaultValue={selectedPart.unit_default}
                                                    >
                                                        <option value="EA">EA</option>
                                                        <option value="G">G</option>
                                                        <option value="M">M</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold">재사용 가능</label>
                                                    <input
                                                        type="checkbox"
                                                        {...partMasterForm.register("is_reusable")}
                                                        defaultChecked={selectedPart.is_reusable}
                                                        className="ml-2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold">재주문 최소</label>
                                                    <Input
                                                        type="number"
                                                        {...partMasterForm.register("reorder_min", { valueAsNumber: true })}
                                                        defaultValue={selectedPart.reorder_min}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold">재주문 최대</label>
                                                    <Input
                                                        type="number"
                                                        {...partMasterForm.register("reorder_max", { valueAsNumber: true })}
                                                        defaultValue={selectedPart.reorder_max}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-xs font-semibold">패밀리명</label>
                                                    <Input
                                                        {...partMasterForm.register("family_name")}
                                                        defaultValue={selectedPart.family_name}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-xs font-semibold">사양</label>
                                                    <Textarea
                                                        {...partMasterForm.register("spec_text")}
                                                        defaultValue={selectedPart.spec_text}
                                                        rows={3}
                                                    />
                                                </div>
                                            </div>
                                            <Button type="submit">저장</Button>
                                        </form>
                                    )}

                                    {activeTab === "aliases" && (
                                        <div className="space-y-4">
                                            <form onSubmit={aliasForm.handleSubmit(onAddAlias)} className="flex gap-2">
                                                <Input
                                                    {...aliasForm.register("alias_name", { required: true })}
                                                    placeholder="별칭명"
                                                    className="flex-1"
                                                />
                                                <Button type="submit">별칭 추가</Button>
                                            </form>
                                            <p className="text-xs text-[var(--muted)]">별칭 목록은 향후 구현 예정</p>
                                        </div>
                                    )}

                                    {activeTab === "ledger" && (
                                        <div className="overflow-auto max-h-96">
                                            {moveLinesData.length === 0 ? (
                                                <p className="text-sm text-[var(--muted)]">원장 데이터 없음</p>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                                        <tr>
                                                            <th className="text-left pb-2">시각</th>
                                                            <th className="text-center pb-2">방향</th>
                                                            <th className="text-right pb-2">수량</th>
                                                            <th className="text-right pb-2">단가</th>
                                                            <th className="text-right pb-2">금액</th>
                                                            <th className="text-left pb-2">메모</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--panel-border)]">
                                                        {moveLinesData.map((line) => (
                                                            <tr key={line.move_line_id} className="hover:bg-[var(--panel-hover)]">
                                                                <td className="py-2">{formatKst(line.occurred_at)}</td>
                                                                <td className="py-2 text-center">
                                                                    <span
                                                                        className={cn(
                                                                            "px-2 py-0.5 rounded text-xs",
                                                                            line.direction === "IN"
                                                                                ? "bg-blue-100 text-blue-700"
                                                                                : "bg-orange-100 text-orange-700"
                                                                        )}
                                                                    >
                                                                        {line.direction}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    {line.qty} {line.unit}
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    {line.unit_cost_krw?.toLocaleString() || "-"}
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    {line.amount_krw?.toLocaleString() || "-"}
                                                                </td>
                                                                <td className="py-2 text-xs text-[var(--muted)]">{line.memo || "-"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === "analytics" && (
                                        <p className="text-xs text-[var(--muted)]">부속별 분석은 전체 분석 모드에서 확인하세요</p>
                                    )}
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Unlinked Mode */}
            {mode === "unlinked" && (
                <div className="grid grid-cols-10 gap-4">
                    <Card className="col-span-4">
                        <CardHeader>
                            <ActionBar title="미등록 품목" />
                        </CardHeader>
                        <CardBody>
                            {unlinkedData.length === 0 ? (
                                <p className="text-sm text-[var(--muted)]">미등록 품목 없음</p>
                            ) : (
                                <div className="space-y-2 max-h-[600px] overflow-auto">
                                    {unlinkedData.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                                        >
                                            <div className="font-semibold text-sm">{item.item_name}</div>
                                            <div className="text-xs text-[var(--muted)]">
                                                총 {item.total_qty} ({item.total_lines}건)
                                            </div>
                                            <div className="text-xs text-[var(--muted)]">
                                                최근: {formatKst(item.last_occurred_at)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    <Card className="col-span-6">
                        <CardHeader>
                            <ActionBar title="정리 작업" />
                        </CardHeader>
                        <CardBody>
                            <p className="text-sm text-[var(--muted)]">
                                왼쪽 목록에서 품목을 선택하여 부속 생성 또는 기존 부속에 별칭 추가 (향후 구현)
                            </p>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Analytics Mode */}
            {mode === "analytics" && (
                <Card>
                    <CardHeader>
                        <ActionBar title="일별 사용량 분석" />
                    </CardHeader>
                    <CardBody>
                        {analyticsData.length === 0 ? (
                            <p className="text-sm text-[var(--muted)]">분석 데이터 없음</p>
                        ) : (
                            <div className="overflow-auto max-h-96">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-[var(--panel-border)] text-xs text-[var(--muted)]">
                                        <tr>
                                            <th className="text-left pb-2">일자</th>
                                            <th className="text-left pb-2">부속명</th>
                                            <th className="text-right pb-2">수량</th>
                                            <th className="text-right pb-2">금액</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--panel-border)]">
                                        {analyticsData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-[var(--panel-hover)]">
                                                <td className="py-2">{row.day}</td>
                                                <td className="py-2">{row.part_name || row.item_name || "-"}</td>
                                                <td className="py-2 text-right">{row.qty}</td>
                                                <td className="py-2 text-right">{row.amount_krw?.toLocaleString() || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Part Form Modal */}
            {showPartForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg max-h-[80vh] overflow-auto">
                        <CardHeader>
                            <ActionBar
                                title="부속 추가"
                                actions={
                                    <Button onClick={() => setShowPartForm(false)} className="text-sm">
                                        닫기
                                    </Button>
                                }
                            />
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={partMasterForm.handleSubmit(onSavePartMaster)} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold">부속명 *</label>
                                    <Input {...partMasterForm.register("part_name", { required: true })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold">종류 *</label>
                                        <Select {...partMasterForm.register("part_kind")}>
                                            <option value="PART">부자재</option>
                                            <option value="STONE">스톤</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold">단위 *</label>
                                        <Select {...partMasterForm.register("unit_default")}>
                                            <option value="EA">EA</option>
                                            <option value="G">G</option>
                                            <option value="M">M</option>
                                        </Select>
                                    </div>
                                </div>
                                <Button type="submit">저장</Button>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Receipt Modal */}
            {showReceiptModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
                        <CardHeader>
                            <ActionBar
                                title="입고 기록"
                                actions={
                                    <Button onClick={() => setShowReceiptModal(false)} className="text-sm">
                                        닫기
                                    </Button>
                                }
                            />
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={receiptForm.handleSubmit(onSaveReceipt)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold">발생 시각 *</label>
                                        <Input type="datetime-local" {...receiptForm.register("occurred_at")} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold">위치</label>
                                        <Select {...receiptForm.register("location_code")}>
                                            <option value="">선택</option>
                                            <option value="MAIN">메인</option>
                                            <option value="WAREHOUSE">창고</option>
                                            <option value="SHOP">매장</option>
                                            <option value="FACTORY">공장</option>
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold">메모</label>
                                        <Textarea {...receiptForm.register("memo")} rows={2} />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">라인</h3>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                const currentLines = receiptForm.getValues("lines");
                                                receiptForm.setValue("lines", [...currentLines, { part_name: "", qty: 0, unit: "EA" }]);
                                            }}
                                        >
                                            + 행 추가
                                        </Button>
                                    </div>
                                    {receiptForm.watch("lines").map((_, idx) => (
                                        <div key={idx} className="grid grid-cols-5 gap-2 mb-2">
                                            <Input
                                                {...receiptForm.register(`lines.${idx}.part_name` as const)}
                                                placeholder="부속명"
                                            />
                                            <Input
                                                type="number"
                                                {...receiptForm.register(`lines.${idx}.qty` as const, { valueAsNumber: true })}
                                                placeholder="수량"
                                            />
                                            <Select {...receiptForm.register(`lines.${idx}.unit` as const)}>
                                                <option value="EA">EA</option>
                                                <option value="G">G</option>
                                                <option value="M">M</option>
                                            </Select>
                                            <Input
                                                type="number"
                                                {...receiptForm.register(`lines.${idx}.unit_cost_krw` as const, {
                                                    valueAsNumber: true,
                                                })}
                                                placeholder="단가"
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    const currentLines = receiptForm.getValues("lines");
                                                    receiptForm.setValue(
                                                        "lines",
                                                        currentLines.filter((_, i) => i !== idx)
                                                    );
                                                }}
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <Button type="submit">저장</Button>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}

            {/* Usage Modal */}
            {showUsageModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
                        <CardHeader>
                            <ActionBar
                                title="사용 기록"
                                actions={
                                    <Button onClick={() => setShowUsageModal(false)} className="text-sm">
                                        닫기
                                    </Button>
                                }
                            />
                        </CardHeader>
                        <CardBody>
                            <form onSubmit={usageForm.handleSubmit(onSaveUsage)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold">발생 시각 *</label>
                                        <Input type="datetime-local" {...usageForm.register("occurred_at")} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold">사용 종류</label>
                                        <Input {...usageForm.register("use_kind")} placeholder="예: 수리" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold">메모</label>
                                        <Textarea {...usageForm.register("memo")} rows={2} />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">라인</h3>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                const currentLines = usageForm.getValues("lines");
                                                usageForm.setValue("lines", [...currentLines, { part_name: "", qty: 0, unit: "EA" }]);
                                            }}
                                        >
                                            + 행 추가
                                        </Button>
                                    </div>
                                    {usageForm.watch("lines").map((_, idx) => (
                                        <div key={idx} className="grid grid-cols-5 gap-2 mb-2">
                                            <Input
                                                {...usageForm.register(`lines.${idx}.part_name` as const)}
                                                placeholder="부속명 (미등록 가능)"
                                            />
                                            <Input
                                                type="number"
                                                {...usageForm.register(`lines.${idx}.qty` as const, { valueAsNumber: true })}
                                                placeholder="수량"
                                            />
                                            <Select {...usageForm.register(`lines.${idx}.unit` as const)}>
                                                <option value="EA">EA</option>
                                                <option value="G">G</option>
                                                <option value="M">M</option>
                                            </Select>
                                            <Input
                                                type="number"
                                                {...usageForm.register(`lines.${idx}.unit_cost_krw` as const, {
                                                    valueAsNumber: true,
                                                })}
                                                placeholder="단가"
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    const currentLines = usageForm.getValues("lines");
                                                    usageForm.setValue(
                                                        "lines",
                                                        currentLines.filter((_, i) => i !== idx)
                                                    );
                                                }}
                                            >
                                                삭제
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <Button type="submit">저장</Button>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            )}
        </div>
    );
}
