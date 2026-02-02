"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ShipmentHeaderRow = {
  shipment_id?: string;
  ship_date?: string | null;
  confirmed_at?: string | null;
  is_store_pickup?: boolean | null;
  memo?: string | null;
  customer?: { name?: string | null } | null;
  cms_shipment_line?: Array<{
    model_name?: string | null;
    qty?: number | null;
    total_amount_sell_krw?: number | null;
  }> | null;
};

type ShipmentRow = {
  shipmentId: string;
  customerName: string;
  shipDate: string | null;
  confirmedAt: string | null;
  memo: string | null;
  totalQty: number;
  totalAmount: number;
  models: string[];
};

const formatKrw = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `₩${new Intl.NumberFormat("ko-KR").format(Math.round(value))}`;
};

const formatDateTimeKst = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const getKstYmd = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
};

export default function ShipmentsPrintPage() {
  const schemaClient = getSchemaClient();
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [targetShipmentId, setTargetShipmentId] = useState<string | null>(null);

  const today = useMemo(() => getKstYmd(), []);

  const shipmentsQuery = useQuery({
    queryKey: ["shipments-print", today],
    queryFn: async () => {
      if (!schemaClient) throw new Error("Supabase env is missing");
      const { data, error } = await schemaClient
        .from("cms_shipment_header")
        .select(
          "shipment_id, ship_date, confirmed_at, is_store_pickup, memo, customer:cms_party(name), cms_shipment_line(model_name, qty, total_amount_sell_krw)"
        )
        .eq("status", "CONFIRMED")
        .eq("ship_date", today)
        .or("is_store_pickup.is.null,is_store_pickup.eq.false")
        .order("confirmed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShipmentHeaderRow[];
    },
    enabled: Boolean(schemaClient),
  });

  const shipments = useMemo<ShipmentRow[]>(() => {
    return (shipmentsQuery.data ?? [])
      .filter((row) => !row.is_store_pickup)
      .map((row) => {
        const lines = row.cms_shipment_line ?? [];
        const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
        const totalAmount = lines.reduce((sum, line) => sum + Number(line.total_amount_sell_krw ?? 0), 0);
        const models = lines
          .map((line) => (line.model_name ?? "-").trim())
          .filter(Boolean);

        return {
          shipmentId: row.shipment_id ?? "",
          customerName: row.customer?.name ?? "-",
          shipDate: row.ship_date ?? null,
          confirmedAt: row.confirmed_at ?? null,
          memo: row.memo ?? null,
          totalQty,
          totalAmount,
          models,
        };
      })
      .filter((row) => Boolean(row.shipmentId));
  }, [shipmentsQuery.data]);

  const unconfirmShipmentMutation = useRpcMutation<unknown>({
    fn: CONTRACTS.functions.shipmentUnconfirm,
    successMessage: "출고 초기화 완료",
    onSuccess: () => {
      setReasonModalOpen(false);
      setReasonText("");
      setTargetShipmentId(null);
      shipmentsQuery.refetch();
    },
  });

  const handleOpenReason = (shipmentId: string) => {
    setTargetShipmentId(shipmentId);
    setReasonText("");
    setReasonModalOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!targetShipmentId) return;
    const reason = reasonText.trim();
    if (!reason) return;
    await unconfirmShipmentMutation.mutateAsync({
      p_shipment_id: targetShipmentId,
      p_reason: reason,
      p_note: "unconfirm from shipments_print",
    });
  };

  const totalCount = shipments.length;
  const totalQty = shipments.reduce((sum, row) => sum + row.totalQty, 0);
  const totalAmount = shipments.reduce((sum, row) => sum + row.totalAmount, 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/80 backdrop-blur">
        <ActionBar
          title="출고 영수증(통상)"
          subtitle={`기준일: ${today} · 매장출고 제외 · 출고확정됨`}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => shipmentsQuery.refetch()}>
                새로고침
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                영수증 출력
              </Button>
            </div>
          }
        />
      </div>

      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">출고 건수</div>
              <div className="text-xl font-semibold tabular-nums">{totalCount}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 수량</div>
              <div className="text-xl font-semibold tabular-nums">{totalQty}</div>
            </CardBody>
          </Card>
          <Card className="border-[var(--panel-border)]">
            <CardBody className="p-4">
              <div className="text-xs text-[var(--muted)]">총 금액</div>
              <div className="text-xl font-semibold tabular-nums">{formatKrw(totalAmount)}</div>
            </CardBody>
          </Card>
        </div>

        <Card className="border-[var(--panel-border)]">
          <CardHeader className="border-b border-[var(--panel-border)] py-3">
            <div className="text-sm font-semibold">오늘 출고 대상</div>
          </CardHeader>
          <CardBody className="p-0">
            {shipmentsQuery.isLoading ? (
              <div className="p-6 text-sm text-[var(--muted)]">로딩 중...</div>
            ) : shipments.length === 0 ? (
              <div className="p-6 text-sm text-[var(--muted)]">대상 없음</div>
            ) : (
              <div className="divide-y divide-[var(--panel-border)]">
                {shipments.map((row) => (
                  <div key={row.shipmentId} className="p-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-4">
                    <div>
                      <div className="text-sm font-semibold">{row.customerName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {row.models.join(", ") || "-"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">ID: {row.shipmentId.slice(0, 8)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">확정시각</div>
                      <div className="text-sm font-medium">{formatDateTimeKst(row.confirmedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">수량/금액</div>
                      <div className="text-sm font-medium tabular-nums">
                        {row.totalQty}개 · {formatKrw(row.totalAmount)}
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenReason(row.shipmentId)}
                      >
                        출고 초기화
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        title="출고 초기화 사유"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">사유</label>
            <Textarea
              placeholder="예: 당일 발송 불가"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className={cn("text-xs", reasonText.trim() ? "text-[var(--muted)]" : "text-[var(--danger)]")}>
              사유를 입력해야 삭제됩니다.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setReasonModalOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmClear}
                disabled={!reasonText.trim() || unconfirmShipmentMutation.isPending}
              >
                {unconfirmShipmentMutation.isPending ? "처리 중..." : "초기화"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
