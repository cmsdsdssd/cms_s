"use client";

import { useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { useQuery } from "@tanstack/react-query";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { readView } from "@/lib/supabase/read";
import { toast } from "sonner";
import { format } from "date-fns";

type WorklistRow = {
    shipment_id: string;
    customer_party_id: string;
    customer_name: string;
    ship_date: string;
    confirmed_at: string;
    shipment_line_id: string;
    model_name: string;
    qty: number;
    total_amount_sell_krw: number;
    purchase_unit_cost_krw: number | null;
    purchase_total_cost_krw: number | null;
    purchase_cost_status: string | null;
    purchase_cost_source: string | null;
    purchase_receipt_id: string | null;
    line_updated_at: string;
};

type ReceiptRow = {
    receipt_id: string;
    received_at: string;
    file_path: string;
    file_bucket: string;
    status: string;
};

export default function PurchaseCostWorklistPage() {
    const [selectedRow, setSelectedRow] = useState<WorklistRow | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionType, setActionType] = useState<"PROVISIONAL" | "MANUAL" | "RECEIPT">("PROVISIONAL");
    const [manualCost, setManualCost] = useState("");
    const [receiptId, setReceiptId] = useState<string | null>(null);

    // Receipt upload (inbox)
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptFileInputKey, setReceiptFileInputKey] = useState(0);

    const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

    const { data: rows, isLoading, refetch } = useQuery({
        queryKey: ["worklist", "purchase_cost"],
        queryFn: () => readView<WorklistRow>(CONTRACTS.views.purchaseCostWorklist, 100),
    });

    const { data: receipts, refetch: refetchReceipts } = useQuery({
        queryKey: ["receipts", "uploaded"],
        queryFn: async () => {
            const res = await fetch("/api/receipts?status=UPLOADED&limit=50");
            const json = await res.json();
            return (json.data ?? []) as ReceiptRow[];
        },
        enabled: modalOpen && actionType === "RECEIPT",
    });

    const applyMutation = useRpcMutation<{ ok: boolean }>({
        fn: CONTRACTS.functions.applyPurchaseCost,
        successMessage: "원가 적용 완료",
    });

    const handleOpenAction = (row: WorklistRow, type: "PROVISIONAL" | "MANUAL" | "RECEIPT") => {
        setSelectedRow(row);
        setActionType(type);
        setManualCost("");
        setReceiptId(null);
        setReceiptFile(null);
        setReceiptFileInputKey((k) => k + 1);
        setReceiptUploading(false);
        setModalOpen(true);
    };

    const handleUploadReceipt = async () => {
        if (!modalOpen) return;
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

            if (!res.ok || !json?.ok) {
                const msg = json?.error ? String(json.error) : `upload failed (${res.status})`;
                throw new Error(msg);
            }

            await refetchReceipts();
            setReceiptId(String(json.receipt_id));

            toast.success("영수증 업로드 완료");
            setReceiptFile(null);
            setReceiptFileInputKey((k) => k + 1);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error("영수증 업로드 실패", { description: message });
        } finally {
            setReceiptUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedRow || !actorId) return;

        if (actionType === "RECEIPT" && !receiptId) {
            toast.error("영수증을 선택해주세요.");
            return;
        }

        if ((actionType === "MANUAL" || actionType === "RECEIPT") && (!manualCost || isNaN(Number(manualCost)))) {
            toast.error("원가(단가)를 입력해주세요.");
            return;
        }
        const costLines =
            actionType === "MANUAL" || actionType === "RECEIPT"
                ? [
                    {
                        shipment_line_id: selectedRow.shipment_line_id,
                        unit_cost_krw: Number(manualCost),
                    },
                ]
                : [];

        try {
            await applyMutation.mutateAsync({
                p_shipment_id: selectedRow.shipment_id,
                p_mode: actionType,
                p_receipt_id: receiptId,
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

    const previewReceipt = async () => {
        if (!receiptId || !receipts) return;
        const r = receipts.find((x) => x.receipt_id === receiptId);
        if (r) {
            const res = await fetch(
                `/api/receipt-file?bucket=${r.file_bucket}&path=${encodeURIComponent(r.file_path)}`
            );
            const json = await res.json();
            if (json.signedUrl) {
                window.open(json.signedUrl, "_blank");
            }
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
                                        출고일: {row.ship_date ? format(new Date(row.ship_date), "yyyy-MM-dd") : "-"} · 상태:{" "}
                                        {row.purchase_cost_status ?? "-"} · 출처: {row.purchase_cost_source ?? "-"}
                                    </div>
                                    <div className="text-xs text-[var(--muted)]">
                                        판매금액: {row.total_amount_sell_krw?.toLocaleString()}원 · 원가(단가):{" "}
                                        {row.purchase_unit_cost_krw?.toLocaleString() ?? "-"}원
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => handleOpenAction(row, "PROVISIONAL")}>
                                        임시원가
                                    </Button>
                                    <Button variant="secondary" onClick={() => handleOpenAction(row, "MANUAL")}>
                                        수기
                                    </Button>
                                    <Button onClick={() => handleOpenAction(row, "RECEIPT")}>영수증</Button>
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
                                    <Button variant="secondary" onClick={previewReceipt} disabled={!receiptId}>
                                        보기
                                    </Button>
                                </div>
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
