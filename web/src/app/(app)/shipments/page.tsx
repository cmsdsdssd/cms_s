"use client";

import { useMemo, useState } from "react";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { SearchSelect } from "@/components/ui/search-select";
import { useQuery } from "@tanstack/react-query";
import { readView } from "@/lib/supabase/read";
import { CONFIRM_USE_LIVE, CONTRACTS } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type ShipReadyRow = {
  customer_name?: string;
  shipment_id?: string;
  line_count?: number;
  status?: string;
  ship_date?: string;
  customer_id?: string;
};

type ShipReadyLineRow = {
  order_line_id?: string;
  ref_key?: string;
  qty?: number;
  remaining_qty?: number;
  ship_status?: string;
  customer_name?: string;
};

const shipmentLines = [
  {
    id: "L-001",
    model: "AB-10293",
    qty: 2,
    material: "18",
    measuredWeight: null,
    plated: true,
    platingVariant: null,
    pricingMode: "RULE",
  },
  {
    id: "L-002",
    model: "GC-4410",
    qty: 1,
    material: "00",
    measuredWeight: 0,
    plated: false,
    platingVariant: null,
    pricingMode: "AMOUNT_ONLY",
  },
];

const customerOptions = [
  { label: "소매A", value: "11111111-1111-1111-1111-111111111111" },
  { label: "소매B", value: "11111111-1111-1111-1111-222222222222" },
];

export default function ShipmentsPage() {
  const [orderModal, setOrderModal] = useState(false);
  const [repairModal, setRepairModal] = useState(false);
  const [adHocModal, setAdHocModal] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const confirmFn = CONFIRM_USE_LIVE
    ? CONTRACTS.functions.confirmShipmentLineLive
    : CONTRACTS.functions.confirmShipmentLine;

  const confirmMutation = useRpcMutation<{ ok: boolean }>({
    fn: confirmFn,
    successMessage: "출고 확정 완료",
  });

  const lineView = process.env.NEXT_PUBLIC_MS_VIEW_SHIP_READY_LINE ?? "";
  const actorType = process.env.NEXT_PUBLIC_MS_ACTOR_TYPE ?? "staff";
  const actorId = process.env.NEXT_PUBLIC_MS_ACTOR_ID ?? "";
  const correlationId =
    process.env.NEXT_PUBLIC_MS_CORRELATION_ID ??
    (typeof crypto !== "undefined" ? crypto.randomUUID() : "");

  const readyQuery = useQuery({
    queryKey: ["ms_s", CONTRACTS.views.shipmentsReady],
    queryFn: () => readView<ShipReadyRow>(CONTRACTS.views.shipmentsReady, 50),
  });

  const readyLineQuery = useQuery({
    queryKey: ["ms_s", lineView],
    queryFn: () => (lineView ? readView<ShipReadyLineRow>(lineView, 100) : []),
    enabled: Boolean(lineView),
  });

  const toStatusLabel = (value?: string) => {
    switch (value) {
      case "READY":
        return "준비";
      case "CONFIRMED":
        return "확정";
      case "DRAFT":
        return "임시";
      default:
        return value ?? "준비";
    }
  };

  const pricingLabel = (value: string) => {
    switch (value) {
      case "RULE":
        return "룰";
      case "UNIT":
        return "단가";
      case "AMOUNT_ONLY":
        return "금액만";
      default:
        return value;
    }
  };

  const shipments = (readyQuery.data ?? []).map((row, index) => ({
    title: row.shipment_id ? String(row.shipment_id).slice(0, 10) : `S-${index + 1}`,
    subtitle: `${row.customer_name ?? "-"} · ${row.line_count ?? 0}라인`,
    meta: row.ship_date ?? "-",
    badge: { label: toStatusLabel(row.status), tone: "warning" as const },
  }));

  const lines = readyLineQuery.data ?? [];
  const selectedLine = lines.find((line) => line.order_line_id === selectedLineId);
  const canConfirm =
    Boolean(selectedLine?.order_line_id) &&
    typeof selectedLine?.qty === "number" &&
    Boolean(actorId) &&
    Boolean(correlationId) &&
    Boolean(lineView);
  const confirmDisabled = !canConfirm;

  const handleConfirm = () => {
    if (!selectedLine) return;
    confirmMutation.mutate({
      order_line_id: selectedLine.order_line_id,
      qty: selectedLine.qty,
      idempotency_key: `confirm-${Date.now()}`,
      actor_type: actorType,
      actor_id: actorId,
      correlation_id: correlationId,
    });
  };

  const confirmNote = useMemo(() => {
    if (!lineView) return "출고 확정 불가: 라인 뷰 계약 필요";
    if (!selectedLine) return "출고 확정 불가: 라인을 선택해 주세요";
    if (!actorId) return "출고 확정 불가: 담당자 ID 필요";
    return "확정 가능";
  }, [lineView, selectedLine, actorId]);

  return (
    <div className="space-y-6" id="shipments.root">
      <ActionBar
        title="출고"
        subtitle="출고 문서 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary">+ 신규 출고</Button>
            <Button variant="secondary">저장</Button>
            <Button disabled={confirmDisabled} onClick={handleConfirm}>
              출고 확정
            </Button>
            <Button variant="danger">삭제</Button>
          </div>
        }
        id="shipments.actionBar"
      />
      <FilterBar id="shipments.filterBar">
        <Input placeholder="출고 검색" />
        <Select>
          <option>상태</option>
        </Select>
        <Select>
          <option>거래처</option>
        </Select>
        <Input type="date" />
      </FilterBar>
      <div id="shipments.body">
        <SplitLayout
          left={
            <div className="space-y-3" id="shipments.listPanel">
              {shipments.map((shipment) => (
                <ListCard key={shipment.title} {...shipment} />
              ))}
              <Card className="mt-4" id="shipments.detail.lineSelect">
                <CardHeader>
                  <ActionBar title="출고 대기 라인" subtitle="ms_s 라인 뷰" />
                </CardHeader>
                <CardBody>
                  {!lineView ? (
                    <p className="text-sm text-[var(--muted)]">
                      ms_s 라인 뷰 이름을 `NEXT_PUBLIC_MS_VIEW_SHIP_READY_LINE`에 설정하세요.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lines.map((line) => (
                        <button
                          key={line.order_line_id}
                          type="button"
                          onClick={() => setSelectedLineId(line.order_line_id ?? null)}
                          className={cn(
                            "w-full rounded-[12px] border border-[var(--panel-border)] px-3 py-2 text-left text-xs",
                            line.order_line_id === selectedLineId
                              ? "bg-[#eef2f6]"
                              : "hover:bg-[#f6f7f9]"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[var(--foreground)]">
                              {line.ref_key ?? line.order_line_id}
                            </span>
                            <span className="text-[var(--muted)]">수량 {line.qty ?? 0}</span>
                          </div>
                          <div className="mt-1 text-[var(--muted)]">
                            {line.customer_name ?? "-"} · {toStatusLabel(line.ship_status)}
                          </div>
                        </button>
                      ))}
                      {lines.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">라인 데이터 없음</p>
                      ) : null}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          }
          right={
            <div className="space-y-4" id="shipments.detailPanel">
              <Card id="shipments.detail.header">
                <CardHeader>
                  <ActionBar title="출고 헤더" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <SearchSelect label="거래처*" placeholder="검색" options={customerOptions} />
                  <Input type="date" placeholder="출고일" />
                  <Input placeholder="배송지" />
                  <Textarea placeholder="메모" />
                </CardBody>
              </Card>
              <Card id="shipments.detail.addLines">
                <CardBody className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => setOrderModal(true)}>
                    주문에서 추가
                  </Button>
                  <Button variant="secondary" onClick={() => setRepairModal(true)}>
                    수리에서 추가
                  </Button>
                  <Button variant="secondary" onClick={() => setAdHocModal(true)}>
                    수동 추가
                  </Button>
                </CardBody>
              </Card>
              <Card id="shipments.detail.linesTable">
                <CardHeader>
                  <ActionBar title="출고 라인" />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    {shipmentLines.map((line) => (
                      <div key={line.id} className="rounded-[12px] border border-[var(--panel-border)] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{line.model}</p>
                          <Badge tone={line.pricingMode === "RULE" ? "neutral" : "warning"}>
                            {pricingLabel(line.pricingMode)}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                          <span>수량: {line.qty}</span>
                          <span>재질: {line.material}</span>
                          <span>실측중량: {line.measuredWeight ?? "-"}</span>
                          <span>도금: {line.plated ? "예" : "아니오"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card id="shipments.detail.summary">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--muted)]">라인 수</p>
                    <p className="text-xl font-semibold">{shipmentLines.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">예상 판매합계</p>
                    <p className="text-xl font-semibold">₩3,200,000</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">예상 원가합계</p>
                    <p className="text-xl font-semibold">₩2,180,000</p>
                  </div>
                </CardBody>
              </Card>
            <Card id="shipments.detail.confirm">
              <CardBody className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">{confirmNote}</p>
                <Button
                  disabled={confirmDisabled || !canConfirm}
                  onClick={handleConfirm}
                >
                  출고 확정
                </Button>
              </CardBody>
            </Card>
            </div>
          }
        />
      </div>
      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="주문에서 추가">
        <p className="text-sm text-[var(--muted)]">주문 검색 + 다중 선택 테이블</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOrderModal(false)}>확인</Button>
        </div>
      </Modal>
      <Modal open={repairModal} onClose={() => setRepairModal(false)} title="수리에서 추가">
        <p className="text-sm text-[var(--muted)]">수리 검색 + 다중 선택 테이블</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setRepairModal(false)}>확인</Button>
        </div>
      </Modal>
      <Modal open={adHocModal} onClose={() => setAdHocModal(false)} title="수동 라인 추가">
        <div className="grid gap-3">
          <Input placeholder="모델명*" />
          <Input placeholder="종류" />
          <Input type="number" min={1} placeholder="수량" />
          <Select>
            <option>가격모드</option>
            <option>룰</option>
            <option>단가</option>
            <option>금액만</option>
          </Select>
          <Input placeholder="단가(단가 모드)" />
          <Input placeholder="수기 금액(금액만)" />
          <div className="flex justify-end">
            <Button onClick={() => setAdHocModal(false)}>확인</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
