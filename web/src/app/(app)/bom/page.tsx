"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";

type MasterSummary = {
    master_id: string;
    model_name: string;
    category_code?: string | null;
    material_code_default?: string | null;
    image_url?: string | null;
};

type PartSummary = {
    part_id: string;
    part_name: string;
    unit_default?: string | null;
    part_kind?: string | null;
    family_name?: string | null;
    spec_text?: string | null;
};

type BomRecipeRow = {
    bom_id: string;
    product_master_id: string;
    product_model_name: string;
    variant_key?: string | null;
    is_active: boolean;
    note?: string | null;
    line_count: number;
};

type BomLineRow = {
    bom_id: string;
    bom_line_id: string;
    line_no: number;
    component_ref_type: "MASTER" | "PART";
    component_master_id?: string | null;
    component_master_model_name?: string | null;
    component_part_id?: string | null;
    component_part_name?: string | null;
    qty_per_unit: number;
    unit: string;
    note?: string | null;
    is_void: boolean;
    void_reason?: string | null;
    created_at: string;
};

function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="space-y-1">
            <div className="text-sm font-semibold">{title}</div>
            {subtitle ? <div className="text-xs text-[var(--muted)]">{subtitle}</div> : null}
        </div>
    );
}

async function fetchJson<T>(url: string) {
    const res = await fetch(url);
    const json = (await res.json()) as T;
    if (!res.ok) {
        const errorPayload = json as { error?: string; hint?: string };
        const error = new Error(errorPayload?.error ?? "요청 실패");
        (error as Error & { hint?: string }).hint = errorPayload?.hint;
        throw error;
    }
    return json;
}

export default function BomPage() {
    const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

    const [productQuery, setProductQuery] = useState("");
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    const [recipeVariantKey, setRecipeVariantKey] = useState("");
    const [recipeNote, setRecipeNote] = useState("");

    const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

    const [componentType, setComponentType] = useState<"PART" | "MASTER">("MASTER");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [componentQuery, setComponentQuery] = useState("");
    const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

    const [qtyPerUnit, setQtyPerUnit] = useState("1");
    const [unit, setUnit] = useState<"EA" | "G" | "M">("EA");
    const [lineNote, setLineNote] = useState("");

    const [voidConfirmId, setVoidConfirmId] = useState<string | null>(null);
    const toastShownRef = useRef(false);

    const schema = getSchemaClient();

    // --- product search ---
    const productQueryKey = useMemo(() => ["bom", "productSearch", productQuery], [productQuery]);
    const productSearchQuery = useQuery({
        queryKey: productQueryKey,
        enabled: productQuery.trim().length > 0,
        queryFn: async () => {
            const json = await fetchJson<{ data: MasterSummary[] }>(
                `/api/master-items?model=${encodeURIComponent(productQuery.trim())}`
            );
            return json.data ?? [];
        },
    });

    const productOptions = useMemo(() => {
        const data = productSearchQuery.data ?? [];
        return data.map((m) => ({ label: m.model_name, value: m.master_id }));
    }, [productSearchQuery.data]);

    const selectedProduct = useMemo(() => {
        const data = productSearchQuery.data ?? [];
        return data.find((m) => m.master_id === selectedProductId) ?? null;
    }, [productSearchQuery.data, selectedProductId]);

    // --- recipes ---
    const recipesQuery = useQuery({
        queryKey: ["bom", "recipes", selectedProductId],
        enabled: Boolean(schema) && Boolean(selectedProductId),
        queryFn: async () => {
            if (!schema || !selectedProductId) return [];
            const view = CONTRACTS.views.bomRecipeWorklist;
            const { data, error } = await schema
                .from(view)
                .select("*")
                .eq("product_master_id", selectedProductId)
                .order("variant_key", { ascending: true });
            if (error) throw error;
            return (data ?? []) as BomRecipeRow[];
        },
    });

    const recipeOptions = useMemo(() => {
        const rows = recipesQuery.data ?? [];
        return rows.map((r) => ({
            label: `${r.variant_key ? r.variant_key : "(DEFAULT)"}  · lines=${r.line_count}${r.is_active ? "" : " · INACTIVE"
                }`,
            value: r.bom_id,
        }));
    }, [recipesQuery.data]);

    // --- recipe lines ---
    const linesQuery = useQuery({
        queryKey: ["bom", "lines", selectedRecipeId],
        enabled: Boolean(schema) && Boolean(selectedRecipeId),
        queryFn: async () => {
            if (!schema || !selectedRecipeId) return [];
            const view = CONTRACTS.views.bomRecipeLinesEnriched;
            const { data, error } = await schema
                .from(view)
                .select("*")
                .eq("bom_id", selectedRecipeId)
                .eq("is_void", false)
                .order("line_no", { ascending: true });
            if (error) throw error;
            return (data ?? []) as BomLineRow[];
        },
    });

    // --- component search (PART / MASTER) ---
    const componentSearchQuery = useQuery({
        queryKey: ["bom", "componentSearch", componentType, componentQuery],
        enabled: componentQuery.trim().length > 0,
        queryFn: async () => {
            if (componentType === "PART") {
                const json = await fetchJson<{ data: PartSummary[] }>(
                    `/api/part-items?q=${encodeURIComponent(componentQuery.trim())}`
                );
                return json.data ?? [];
            }
            const json = await fetchJson<{ data: MasterSummary[] }>(
                `/api/master-items?model=${encodeURIComponent(componentQuery.trim())}`
            );
            return json.data ?? [];
        },
    });

    const componentOptions = useMemo(() => {
        const data = componentSearchQuery.data ?? [];
        if (componentType === "PART") {
            return (data as PartSummary[]).map((p) => ({
                label: `${p.part_name}${p.spec_text ? ` (${p.spec_text})` : ""}`,
                value: p.part_id,
            }));
        }
        return (data as MasterSummary[]).map((m) => ({ label: m.model_name, value: m.master_id }));
    }, [componentSearchQuery.data, componentType]);

    const selectedComponent = useMemo(() => {
        if (!selectedComponentId) return null;
        const data = componentSearchQuery.data ?? [];
        if (componentType === "PART") {
            return (data as PartSummary[]).find(p => p.part_id === selectedComponentId);
        } else {
            return (data as MasterSummary[]).find(m => m.master_id === selectedComponentId);
        }
    }, [componentSearchQuery.data, selectedComponentId, componentType]);

    const envError = useMemo(() => {
        const errors = [productSearchQuery.error, componentSearchQuery.error].filter(Boolean) as Error[];
        const match = errors.find((error) => {
            const message = error?.message ?? "";
            const hint = (error as Error & { hint?: string })?.hint ?? "";
            return (
                message.includes("Supabase server env missing") ||
                message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
                hint.includes("SUPABASE_SERVICE_ROLE_KEY")
            );
        });
        if (!match) return null;
        return {
            message: match.message,
            hint: (match as Error & { hint?: string }).hint,
        };
    }, [productSearchQuery.error, componentSearchQuery.error]);

    // --- mutations ---
    const upsertRecipeMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.bomRecipeUpsert,
        successMessage: "레시피 저장 완료",
        onSuccess: (result) => {
            if (typeof result === "string") setSelectedRecipeId(result);
            recipesQuery.refetch();
        },
    });

    const addLineMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.bomRecipeLineAdd,
        successMessage: "구성품 추가 완료",
        onSuccess: () => {
            setSelectedComponentId(null);
            setQtyPerUnit("1");
            setLineNote("");
            linesQuery.refetch();
            recipesQuery.refetch();
        },
    });

    const voidLineMutation = useRpcMutation<string>({
        fn: CONTRACTS.functions.bomRecipeLineVoid,
        successMessage: "구성품 제거(VOID) 완료",
        onSuccess: () => {
            linesQuery.refetch();
            recipesQuery.refetch();
        },
    });

    const canWrite =
        Boolean(actorId) &&
        isFnConfigured(CONTRACTS.functions.bomRecipeUpsert) &&
        isFnConfigured(CONTRACTS.functions.bomRecipeLineAdd) &&
        isFnConfigured(CONTRACTS.functions.bomRecipeLineVoid);

    const isActorMissing = !actorId;

    const writeDisabledReason =
        "쓰기 기능 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 미설정 또는 CONTRACTS.functions RPC 미설정";

    const notifyWriteDisabled = () => {
        if (toastShownRef.current) return;
        toast.error("쓰기 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 또는 RPC 설정을 확인하세요.");
        toastShownRef.current = true;
    };

    useEffect(() => {
        if (!canWrite && !toastShownRef.current) {
            notifyWriteDisabled();
        }
    }, [canWrite]);

    const handleCreateRecipe = async () => {
        if (!selectedProductId) return toast.error("제품(마스터)을 먼저 선택해 주세요.");
        if (!canWrite) return notifyWriteDisabled();

        await upsertRecipeMutation.mutateAsync({
            p_product_master_id: selectedProductId,
            p_variant_key: recipeVariantKey.trim() ? recipeVariantKey.trim() : null,
            p_is_active: true,
            p_note: recipeNote.trim() ? recipeNote.trim() : null,
            p_meta: {},
            p_bom_id: null,
            p_actor_person_id: actorId,
            p_note2: "upsert from web",
        });
    };

    const handleAddLine = async () => {
        if (!selectedRecipeId) return toast.error("레시피를 먼저 선택해 주세요.");
        if (!selectedComponentId) return toast.error("구성품을 먼저 선택해 주세요.");
        if (!canWrite) return notifyWriteDisabled();

        const qty = Number(qtyPerUnit);
        if (Number.isNaN(qty) || qty <= 0) return toast.error("수량(1개당 사용량)은 0보다 커야 합니다.");

        await addLineMutation.mutateAsync({
            p_bom_id: selectedRecipeId,
            p_component_ref_type: componentType,
            p_component_master_id: componentType === "MASTER" ? selectedComponentId : null,
            p_component_part_id: componentType === "PART" ? selectedComponentId : null,
            p_qty_per_unit: qty,
            p_unit: unit,
            p_note: lineNote.trim() ? lineNote.trim() : null,
            p_meta: {},
            p_actor_person_id: actorId,
            p_note2: "add line from web",
        });
    };

    const handleVoidConfirm = async () => {
        if (!voidConfirmId) return;
        if (!canWrite) return notifyWriteDisabled();
        
        await voidLineMutation.mutateAsync({
            p_bom_line_id: voidConfirmId,
            p_void_reason: "void from web",
            p_actor_person_id: actorId,
            p_note: "void from web",
        });
        setVoidConfirmId(null);
    };

    const createRecipeDisabled = !selectedProductId || upsertRecipeMutation.isPending || !canWrite;
    const addLineDisabled = !selectedRecipeId || !selectedComponentId || addLineMutation.isPending || !canWrite;
    const voidActionDisabled = voidLineMutation.isPending || !canWrite;

    return (
        <div className="space-y-4">
            <ActionBar
                title="조합(BOM)"
                subtitle="출고 확정 시 자동 차감(부속/메달 등) 기반 데이터 분석용"
                actions={
                    <span
                        className="inline-flex"
                        title={
                            !selectedProductId
                                ? "제품(마스터)을 먼저 선택해 주세요."
                                : !canWrite
                                  ? writeDisabledReason
                                  : undefined
                        }
                    >
                        <Button onClick={handleCreateRecipe} disabled={createRecipeDisabled}>
                            레시피 저장
                        </Button>
                    </span>
                }
            />

            {isActorMissing ? (
                <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    환경 경고: NEXT_PUBLIC_CMS_ACTOR_ID 미설정으로 생성/추가/VOID가 차단됩니다.
                </div>
            ) : null}

            {envError ? (
                <Card className="border-red-200 bg-red-50">
                    <CardBody className="space-y-2 text-red-900">
                        <div className="text-sm font-semibold">환경변수 설정 필요</div>
                        <div className="text-sm">
                            SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL이 없어 검색이 동작하지 않습니다.
                            서버 환경변수(.env.local) 설정 후 다시 시도하세요.
                        </div>
                        <div className="text-xs text-red-700">Missing: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL</div>
                    </CardBody>
                </Card>
            ) : null}

            <SplitLayout
                left={
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle title="1) 제품(마스터) 선택" subtitle="모델명을 기준으로 BOM을 연결합니다." />
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <Input
                                    placeholder="모델명 검색 (예: BRACELET...)"
                                    value={productQuery}
                                    onChange={(e) => setProductQuery(e.target.value)}
                                />

                                <SearchSelect
                                    label="검색 결과"
                                    placeholder="위에서 모델명 입력"
                                    options={productOptions}
                                    value={selectedProductId ?? undefined}
                                    onChange={(v) => {
                                        setSelectedProductId(v);
                                        setSelectedRecipeId(null);
                                    }}
                                />

                                {selectedProduct ? (
                                    <div className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold">{selectedProduct.model_name}</div>
                                            <div className="truncate text-xs text-[var(--muted)]">master_id: {selectedProduct.master_id}</div>
                                        </div>
                                        <Badge tone="active">선택됨</Badge>
                                    </div>
                                ) : null}
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle
                                    title="2) 레시피(Variant) 관리"
                                    subtitle="variant_key가 있으면 EXACT 매칭, 없으면 DEFAULT가 적용됩니다."
                                />
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <SearchSelect
                                    label="레시피 선택"
                                    placeholder="제품을 먼저 선택"
                                    options={recipeOptions}
                                    value={selectedRecipeId ?? undefined}
                                    onChange={(v) => setSelectedRecipeId(v)}
                                />
                            </CardBody>
                        </Card>
                    </div>
                }
                right={
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle
                                    title="레시피 상세"
                                    subtitle="제품을 선택한 뒤 variant_key/메모를 입력하고 상단에서 저장하세요."
                                />
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <Input
                                    placeholder="variant_key (예: suffix / color / size). 비우면 DEFAULT"
                                    value={recipeVariantKey}
                                    onChange={(e) => setRecipeVariantKey(e.target.value)}
                                />
                                <Textarea placeholder="메모(선택)" value={recipeNote} onChange={(e) => setRecipeNote(e.target.value)} />
                                <div className="text-xs text-[var(--muted)]">
                                    현재 선택된 제품 기준으로 레시피를 저장합니다.
                                </div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle title="3) 구성품(부속/메달 등) 등록" subtitle="출고 확정 시 자동 OUT 기록에 사용됩니다." />
                                    <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none hover:text-[var(--foreground)] transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={showAdvanced}
                                            onChange={(e) => {
                                                setShowAdvanced(e.target.checked);
                                                if (!e.target.checked) {
                                                    setComponentType("MASTER");
                                                    setSelectedComponentId(null);
                                                    setComponentQuery("");
                                                }
                                            }}
                                            className="rounded border-[var(--panel-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                                        />
                                        Advanced: PART
                                    </label>
                                </div>
                            </CardHeader>
                            <CardBody className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {showAdvanced ? (
                                        <Select
                                            aria-label="구성품 타입"
                                            value={componentType}
                                            onChange={(e) => {
                                                const v = (e.target.value as "PART" | "MASTER") ?? "MASTER";
                                                setComponentType(v);
                                                setSelectedComponentId(null);
                                                setComponentQuery("");
                                            }}
                                        >
                                            <option value="MASTER">MASTER (메달/완제품)</option>
                                            <option value="PART">PART (부속/스톤)</option>
                                        </Select>
                                    ) : (
                                        <div className="flex items-center px-3 text-sm font-medium text-[var(--muted-strong)] bg-[var(--subtle-bg)] border border-[var(--panel-border)] rounded-[var(--radius)] h-10 select-none">
                                            MASTER (메달/완제품)
                                        </div>
                                    )}

                                    <Select aria-label="단위" value={unit} onChange={(e) => setUnit(e.target.value as "EA" | "G" | "M")}>
                                        <option value="EA">EA</option>
                                        <option value="G">G</option>
                                        <option value="M">M</option>
                                    </Select>
                                </div>

                                <Input
                                    placeholder={componentType === "PART" ? "부속명 검색" : "마스터 모델명 검색"}
                                    value={componentQuery}
                                    onChange={(e) => setComponentQuery(e.target.value)}
                                />

                                <SearchSelect
                                    label="구성품 선택"
                                    placeholder="위에서 검색어 입력"
                                    options={componentOptions}
                                    value={selectedComponentId ?? undefined}
                                    onChange={(v) => setSelectedComponentId(v)}
                                />

                                {selectedComponent && (
                                    <div className="rounded-[12px] border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Badge tone="neutral">{componentType}</Badge>
                                            {componentType === "MASTER" && (selectedComponent as MasterSummary).category_code && (
                                                <Badge tone="primary">{(selectedComponent as MasterSummary).category_code}</Badge>
                                            )}
                                            {componentType === "PART" && (selectedComponent as PartSummary).part_kind && (
                                                <Badge tone="warning">{(selectedComponent as PartSummary).part_kind}</Badge>
                                            )}
                                        </div>
                                        <div className="font-semibold text-[var(--foreground)]">
                                            {componentType === "MASTER" ? (selectedComponent as MasterSummary).model_name : (selectedComponent as PartSummary).part_name}
                                        </div>
                                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                                            <div>
                                                unit_default: {componentType === "PART" ? (selectedComponent as PartSummary).unit_default ?? "-" : "-"}
                                            </div>
                                            <div>
                                                spec_text: {componentType === "PART" ? (selectedComponent as PartSummary).spec_text ?? "-" : "-"}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <Input aria-label="1개당 사용량" value={qtyPerUnit} onChange={(e) => setQtyPerUnit(e.target.value)} />
                                    <Input aria-label="메모(선택)" value={lineNote} onChange={(e) => setLineNote(e.target.value)} />
                                </div>

                                <span className="inline-flex" title={!canWrite ? writeDisabledReason : undefined}>
                                    <Button onClick={handleAddLine} disabled={addLineDisabled}>
                                        구성품 추가
                                    </Button>
                                </span>

                                <div className="text-xs text-[var(--muted)]">
                                    출고 확정 시(Shipment Confirm) 해당 레시피가 있으면 구성품이 자동 OUT 기록됩니다. (정합성 강요 X, 누락 0 + 분석용)
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle title="현재 구성품 목록" subtitle="삭제 대신 VOID로만 처리합니다(분석/감사 로그 유지)." />
                            </CardHeader>
                            <CardBody className="space-y-2">
                                {!selectedRecipeId ? (
                                    <p className="text-sm text-[var(--muted)]">레시피를 선택하면 구성품이 표시됩니다.</p>
                                ) : linesQuery.isLoading ? (
                                    <p className="text-sm text-[var(--muted)]">불러오는 중...</p>
                                ) : (linesQuery.data ?? []).length === 0 ? (
                                    <p className="text-sm text-[var(--muted)]">등록된 구성품이 없습니다.</p>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-12 gap-3 px-3 text-xs text-[var(--muted)]">
                                            <div className="col-span-5">구성품</div>
                                            <div className="col-span-2">qty_per_unit</div>
                                            <div className="col-span-1">unit</div>
                                            <div className="col-span-3">note</div>
                                            <div className="col-span-1 text-right">VOID</div>
                                        </div>
                                        {(linesQuery.data ?? []).map((line) => {
                                            const name =
                                                line.component_ref_type === "PART"
                                                    ? line.component_part_name ?? "(unknown part)"
                                                    : line.component_master_model_name ?? "(unknown master)";
                                            return (
                                                <div
                                                    key={line.bom_line_id}
                                                    className="grid grid-cols-12 gap-3 items-center rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                                                >
                                                    <div className="col-span-5 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <Badge tone={line.component_ref_type === "MASTER" ? "primary" : "neutral"}>
                                                                {line.component_ref_type}
                                                            </Badge>
                                                            <div className="truncate text-sm font-semibold">{name}</div>
                                                        </div>
                                                        <div className="truncate text-xs text-[var(--muted)]">
                                                            line_no={line.line_no}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 text-sm">{line.qty_per_unit}</div>
                                                    <div className="col-span-1 text-sm">{line.unit}</div>
                                                    <div className="col-span-3 text-xs text-[var(--muted)] truncate">
                                                        {line.note ? line.note : "-"}
                                                    </div>
                                                    <div className="col-span-1 flex justify-end">
                                                        <span className="inline-flex" title={!canWrite ? writeDisabledReason : undefined}>
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => setVoidConfirmId(line.bom_line_id)}
                                                                disabled={voidActionDisabled}
                                                                className="shrink-0"
                                                            >
                                                                VOID
                                                            </Button>
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle title="구성품 재고 요약" subtitle="가능하면 재고 연동 요약을 표시합니다." />
                            </CardHeader>
                            <CardBody className="text-sm text-[var(--muted)]">
                                구성품 재고 요약 영역(준비중)
                            </CardBody>
                        </Card>
                    </div>
                }
            />

            <Modal
                open={!!voidConfirmId}
                onClose={() => setVoidConfirmId(null)}
                title="구성품 VOID"
            >
                <div className="space-y-6">
                    <div className="text-sm text-[var(--foreground)]">
                        <p>이 구성품 라인을 VOID 처리합니다. 되돌릴 수 없으며 감사/분석 로그로 유지됩니다.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setVoidConfirmId(null)}>취소</Button>
                        <Button 
                            variant="danger"
                            onClick={handleVoidConfirm}
                            disabled={voidActionDisabled}
                        >
                            VOID 처리
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
