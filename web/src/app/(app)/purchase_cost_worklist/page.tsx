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

    const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();

    const { data: rows, isLoading, refetch } = useQuery({
        queryKey: ["worklist", "purchase_cost"],
        queryFn: () => readView<WorklistRow>(CONTRACTS.views.purchaseCostWorklist, 100)
    });

    const { data: receipts } = useQuery({
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
        successMessage: "원가 적용 완료"
    });

    const handleOpenAction = (row: WorklistRow, type: "PROVISIONAL" | "MANUAL" | "RECEIPT") => {
        setSelectedRow(row);
        setActionType(type);
        setManualCost("");
        setReceiptId(null);
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedRow || !actorId) return;

        if (actionType === "RECEIPT" && !receiptId) {
            toast.error("영수증을 선택해주세요.");
            return;
        }
        if (actionType === "MANUAL" && (!manualCost || isNaN(Number(manualCost)))) {
            toast.error("원가를 입력해주세요.");
            return;
        }

        const costLines = [];
        if (actionType === "MANUAL" || (actionType === "RECEIPT" && manualCost)) {
            costLines.push({
                shipment_line_id: selectedRow.shipment_line_id,
                unit_cost_krw: Number(manualCost)
            });
        }

        try {
            await applyMutation.mutateAsync({
                p_shipment_id: selectedRow.shipment_id,
                p_mode: actionType,
                p_receipt_id: receiptId,
                p_cost_lines: costLines,
                p_actor_person_id: actorId,
                p_force: true
            });

            setModalOpen(false);
            refetch();
        } catch (e: any) {
            toast.error(e.message || "Action failed");
        }
    };

    const previewReceipt = async () => {
        if (!receiptId || !receipts) return;
        const r = receipts.find(x => x.receipt_id === receiptId);
        if (r) {
            const res = await fetch(`/api/receipt-file?bucket=${r.file_bucket}&path=${encodeURIComponent(r.file_path)}`);
            const json = await res.json();
            if (json.signedUrl) window.open(json.signedUrl, "_blank");
        }
    };

    return (
        <div className="space-y-6">
            <ActionBar title="원가 마감" subtitle="미확정 매입 내역" />

            <Card>
                <CardBody className="p-0 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3">SHIP DATE</th>
                                <th className="px-4 py-3">CUSTOMER</th>
                                <th className="px-4 py-3">MODEL</th>
                                <th className="px-4 py-3 text-right">QTY</th>
                                <th className="px-4 py-3 text-center">STATUS</th>
                                <th className="px-4 py-3 text-center">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows?.map(row => (
                                <tr key={row.shipment_line_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">{row.ship_date}</td>
                                    <td className="px-4 py-3">{row.customer_name}</td>
                                    <td className="px-4 py-3">
                                        <div>{row.model_name}</div>
                                        <div className="text-xs text-gray-500">{row.shipment_id.slice(0, 8)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">{row.qty}</td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge tone={row.purchase_cost_status === 'ACTUAL' ? 'active' : 'warning'}>
                                            {row.purchase_cost_status || 'NONE'}
                                        </Badge>
                                        <div className="text-xs text-gray-400 mt-1">{row.purchase_cost_source || '-'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center space-x-2">
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenAction(row, "PROVISIONAL")}>임시</Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenAction(row, "MANUAL")}>수기</Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenAction(row, "RECEIPT")}>영수증</Button>
                                    </td>
                                </tr>
                            ))}
                            {isLoading && <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>}
                            {!isLoading && rows?.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No pending items</td></tr>}
                        </tbody>
                    </table>
                </CardBody>
            </Card>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`원가 적용 (${actionType})`}>
                <div className="space-y-4">
                    <div className="text-sm">
                        <span className="text-gray-500">Target:</span> {selectedRow?.model_name} ({selectedRow?.qty}ea)
                    </div>

                    {actionType === "PROVISIONAL" && (
                        <p className="text-sm">마스터 정보의 임시원가(Provisional Cost)를 적용합니다.</p>
                    )}

                    {actionType === "RECEIPT" && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">영수증 선택</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchSelect
                                        placeholder="영수증 검색..."
                                        options={(receipts ?? []).map(r => ({
                                            label: `${r.received_at.slice(0, 10)} (${r.file_path.split('/').pop()})`,
                                            value: r.receipt_id
                                        }))}
                                        value={receiptId ?? undefined}
                                        onChange={setReceiptId}
                                    />
                                </div>
                                <Button variant="secondary" onClick={previewReceipt} disabled={!receiptId}>보기</Button>
                            </div>
                        </div>
                    )}

                    {(actionType === "MANUAL" || actionType === "RECEIPT") && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">단가 입력 {actionType === "RECEIPT" && "(선택)"}</label>
                            <Input
                                placeholder="Unit Cost KRW"
                                value={manualCost}
                                onChange={e => setManualCost(e.target.value)}
                                type="number"
                            />
                            {actionType === "RECEIPT" && <p className="text-xs text-gray-500">비워두면 마스터 임시원가 + 영수증 연결만 수행</p>}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
                        <Button onClick={handleSubmit} disabled={applyMutation.isPending}>
                            {applyMutation.isPending ? "처리 중..." : "적용"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
