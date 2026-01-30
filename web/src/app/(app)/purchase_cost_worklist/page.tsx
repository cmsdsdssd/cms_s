"use client";

import { useEffect, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useQuery } from "@tanstack/react-query";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { toast } from "sonner";

type WorklistRow = {
    shipment_id: string;
    shipment_line_id: string;
    customer_party_id?: string;
    customer_name?: string;
    ship_date?: string;
    confirmed_at?: string;
    model_name?: string;
    qty?: number;
    total_amount_sell_krw?: number;
    purchase_unit_cost_krw?: number;
    purchase_total_cost_krw?: number;
    purchase_cost_status?: string;
    purchase_cost_source?: string;
    purchase_receipt_id?: string;
    updated_at?: string;
};

type ReceiptRow = {
    receipt_id: string;
    received_at: string;
    file_path: string;
    file_bucket: string;
    mime_type?: string;
    status: string;
};

export default function PurchaseCostWorklistPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<WorklistRow | null>(null);
    const [actionType, setActionType] = useState<"PROVISIONAL" | "MANUAL" | "RECEIPT">("PROVISIONAL");
    const [manualCost, setManualCost] = useState("");
    const [receiptId, setReceiptId] = useState<string | null>(null);

    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptFileInputKey, setReceiptFileInputKey] = useState(0);

    const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

    const { data: rows, isLoading, refetch } = useQuery({
        queryKey: ["cms", "purchase_cost_worklist"],
        queryFn: async () => {
            const res = await fetch("/api/purchase-cost-worklist");
            const json = await res.json();
            return (json.data ?? []) as WorklistRow[];
        },
    });

    const { data: receipts } = useQuery({
        queryKey: ["receipts", "uploaded_or_linked"],
        queryFn: async () => {
            const res = await fetch("/api/receipts?status=UPLOADED,LINKED&limit=50");
            const json = await res.json();
            return (json.data ?? []) as ReceiptRow[];
        },
        enabled: modalOpen && actionType === "RECEIPT",
    });

    const applyMutation = useRpcMutation(CONTRACTS.functions.applyPurchaseCost);

    const handleUploadReceipt = async () => {
        if (!modalOpen) return;
        if (actionType !== "RECEIPT") setActionType("RECEIPT");

        if (!receiptFile) {
            toast.error("업로드할 영수증 파일을 선택해주세요.");
            return;
        }

        setReceiptUploading(true);
        try {
            const fd = new FormData();
            fd.append("file0", receiptFile);

            const res = await fetch("/api/receipt-upload", { method: "POST", body: fd });
            const json = await res.json();

            if (!res.ok || !json?.ok || !json.receipt_id) {
                throw new Error(json?.error ?? `upload failed (${res.status})`);
            }

            setReceiptId(String(json.receipt_id));
            toast.success("영수증 업로드 완료");

            setReceiptFile(null);
            setReceiptFileInputKey((k) => k + 1);
        } catch (e: any) {
            toast.error("영수증 업로드 실패", { description: e.message || String(e) });
        } finally {
            setReceiptUploading(false);
        }
    };

    // Receipt Preview (inline)
    const [receiptPreviewSrc, setReceiptPreviewSrc] = useState<string | null>(null);
    const [receiptPreviewKind, setReceiptPreviewKind] = useState<"pdf" | "image" | null>(null);
    const [receiptPreviewTitle, setReceiptPreviewTitle] = useState<string>("");

    // Local preview (before upload)
    useEffect(() => {
        if (!modalOpen || actionType !== "RECEIPT") return;
        if (!receiptFile) return;

        const objUrl = URL.createObjectURL(receiptFile);
        setReceiptPreviewSrc(objUrl);
        setReceiptPreviewKind(receiptFile.type === "application/pdf" ? "pdf" : "image");
        setReceiptPreviewTitle(receiptFile.name);

        return () => URL.revokeObjectURL(objUrl);
    }, [modalOpen, actionType, receiptFile]);

    // Remote preview (after upload / selection)
    useEffect(() => {
        if (!modalOpen || actionType !== "RECEIPT") return;
        if (receiptFile) return;

        if (!receiptId) {
            setReceiptPreviewSrc(null);
            setReceiptPreviewKind(null);
            setReceiptPreviewTitle("");
            return;
        }

        const r = (receipts ?? []).find((x) => x.receipt_id === receiptId);
        if (!r) return;

        const mime = (r as any).mime_type as string | undefined;
        setReceiptPreviewKind(mime?.includes("pdf") ? "pdf" : "image");
        setReceiptPreviewTitle(r.file_path.split("/").pop() ?? "receipt");

        const previewUrl = `/api/receipt-preview?bucket=${encodeURIComponent(r.file_bucket)}&path=${encodeURIComponent(
            r.file_path
        )}&mime=${encodeURIComponent(mime ?? "")}`;

        setReceiptPreviewSrc(previewUrl);
    }, [modalOpen, actionType, receiptFile, receiptId, receipts]);

    const openReceiptInNewTab = () => {
        if (!receiptPreviewSrc) return;
        window.open(receiptPreviewSrc, "_blank", "noopener,noreferrer");
    };

    const handleSubmit = async () => {
        if (!selectedRow) return;
        if (!actorId) {
            toast.error("NEXT_PUBLIC_CMS_ACTOR_ID 설정이 필요합니다.");
            return;
        }

        const cost = Number(manualCost);
        const hasCost = !Number.isNaN(cost) && cost >= 0;

        const costLines =
            actionType === "PROVISIONAL"
                ? []
                : hasCost
                    ? [
                        {
                            shipment_line_id: selectedRow.shipment_line_id,
                            unit_cost_krw: cost,
                        },
                    ]
                    : [];

        try {
            await applyMutation.mutateAsync({
                p_shipment_id: selectedRow.shipment_id,
                p_mode: actionType,
                p_receipt_id: actionType === "RECEIPT" ? receiptId : null,
                p_cost_lines: costLines,
                p_actor_person_id: actorId,
                p_note: "worklist apply from web",
            });

            setModalOpen(false);
            setSelectedRow(null);
            refetch();
        } catch (e: any) {
            toast.error(e.message || "Apply failed");
        }
    };

    return (
        <div className="space-y-4">
            <ActionBar title="원가 작업대" subtitle="임시/누락 원가를 영수증/수기로 확정하세요." />
            <FilterBar />

            <Card>
                <CardBody className="space-y-2">
                    {isLoading ? (
                        <div className="text-sm text-[var(--muted)]">로딩 중...</div>
                    ) : (rows ?? []).length === 0 ? (
                        <div className="text-sm text-[var(--muted)]">작업대가 비어 있습니다.</div>
                    ) : (
                        (rows ?? []).map((row) => (
                            <div
                                key={`${row.shipment_id}-${row.shipment_line_id}`}
                                className="flex items-center justify-between rounded-[12px] border border-[var(--panel-border)] bg-white p-3"
                            >
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold">
                                        {row.customer_name} · {row.model_name} · Qty {row.qty}
                                    </div>
                                    <div className="text-xs text-[var(--muted)]">
                                        상태: {row.purchase_cost_status ?? "-"} · 출처: {row.purchase_cost_source ?? "-"}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setSelectedRow(row);
                                            setActionType("RECEIPT");
                                            setManualCost("");
                                            setReceiptId(null);
                                            setReceiptFile(null);
                                            setReceiptFileInputKey((k) => k + 1);
                                            setModalOpen(true);
                                        }}
                                    >
                                        영수증 확정
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setSelectedRow(row);
                                            setActionType("MANUAL");
                                            setManualCost("");
                                            setReceiptId(null);
                                            setReceiptFile(null);
                                            setReceiptFileInputKey((k) => k + 1);
                                            setModalOpen(true);
                                        }}
                                    >
                                        수기 확정
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardBody>
            </Card>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="원가 확정">
                <div className="space-y-4">
                    {(actionType === "MANUAL" || actionType === "RECEIPT") && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">
                                {actionType === "RECEIPT" ? "영수증 기준 원가(단가) 입력" : "원가(단가) 입력"}
                            </label>
                            <Input
                                placeholder="예: 12000"
                                value={manualCost}
                                onChange={(e) => setManualCost(e.target.value)}
                            />
                            <p className="text-xs text-[var(--muted)]">
                                RECEIPT 모드에서 단가를 입력해야 출고라인(purchase_receipt_id)과 영수증이 실제로 연결됩니다.
                            </p>
                        </div>
                    )}

                    {actionType === "RECEIPT" && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">영수증 업로드</label>
                                <Input
                                    key={receiptFileInputKey}
                                    type="file"
                                    accept="application/pdf,image/*"
                                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                                />
                                <div className="flex gap-2 items-center">
                                    <Button
                                        variant="secondary"
                                        onClick={handleUploadReceipt}
                                        disabled={receiptUploading || !receiptFile}
                                    >
                                        {receiptUploading ? "업로드 중..." : "업로드"}
                                    </Button>
                                    <span className="text-xs text-[var(--muted)]">PDF/JPG/PNG/WebP (최대 20MB)</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">영수증 선택</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <SearchSelect
                                            placeholder="영수증 검색..."
                                            options={(receipts ?? []).map((r) => ({
                                                label: `${r.received_at.slice(0, 10)} (${r.file_path.split("/").pop()})`,
                                                value: r.receipt_id,
                                            }))}
                                            value={receiptId ?? undefined}
                                            onChange={setReceiptId}
                                        />
                                    </div>
                                    <Button variant="secondary" onClick={openReceiptInNewTab} disabled={!receiptPreviewSrc}>
                                        새 창
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-semibold">영수증 미리보기</div>
                                <div className="rounded-[12px] border border-[var(--panel-border)] bg-white overflow-hidden h-[60vh]">
                                    {receiptPreviewSrc ? (
                                        receiptPreviewKind === "pdf" ? (
                                            <iframe
                                                title={receiptPreviewTitle || "receipt"}
                                                src={receiptPreviewSrc}
                                                className="w-full h-full"
                                            />
                                        ) : (
                                            <div className="w-full h-full overflow-auto">
                                                <img
                                                    src={receiptPreviewSrc}
                                                    alt={receiptPreviewTitle || "receipt"}
                                                    className="block w-full h-auto"
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-sm text-[var(--muted)]">
                                            영수증을 업로드하거나 선택하면 여기에 표시됩니다.
                                        </div>
                                    )}
                                </div>
                                {receiptPreviewTitle ? (
                                    <div className="text-xs text-[var(--muted)] truncate">{receiptPreviewTitle}</div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSubmit} disabled={applyMutation.isPending}>
                            {applyMutation.isPending ? "적용 중..." : "적용"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
