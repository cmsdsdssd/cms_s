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

type ShipReadyRow = {
  customer_name?: string;
  shipment_id?: string;
  line_count?: number;
  status?: string;
  ship_date?: string;
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

  const confirmFn = CONFIRM_USE_LIVE
    ? CONTRACTS.functions.confirmShipmentLineLive
    : CONTRACTS.functions.confirmShipmentLine;

  const confirmMutation = useRpcMutation<{ ok: boolean }>({
    fn: confirmFn,
    successMessage: "출고 확정 완료",
  });

  const readyQuery = useQuery({
    queryKey: ["ms_s", CONTRACTS.views.shipmentsReady],
    queryFn: () => readView<ShipReadyRow>(CONTRACTS.views.shipmentsReady, 50),
  });

  const shipments = (readyQuery.data ?? []).map((row, index) => ({
    title: row.shipment_id ? String(row.shipment_id).slice(0, 10) : `S-${index + 1}`,
    subtitle: `${row.customer_name ?? "-"} · ${row.line_count ?? 0} lines`,
    meta: row.ship_date ?? "-",
    badge: { label: row.status ?? "READY", tone: "warning" as const },
  }));

  const hasLines = shipmentLines.length > 0;
  const missingWeight = shipmentLines.some(
    (line) => ["14", "18", "24"].includes(line.material) && line.pricingMode === "RULE" && !line.measuredWeight
  );
  const missingPlating = shipmentLines.some((line) => line.plated && !line.platingVariant);
  const confirmDisabled = !hasLines || missingWeight || missingPlating;

  const confirmNote = useMemo(() => {
    if (!hasLines) return "출고 확정 불가: 라인이 없습니다";
    if (missingWeight) return "출고 확정 불가: 실측중량이 필요합니다";
    if (missingPlating) return "출고 확정 불가: 도금 Variant를 선택해 주세요";
    return "확정 가능";
  }, [hasLines, missingWeight, missingPlating]);

  return (
    <div className="space-y-6" id="shipments.root">
      <ActionBar
        title="Shipments"
        subtitle="출고 문서 관리"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary">+ New Shipment</Button>
            <Button variant="secondary">Save</Button>
            <Button disabled={confirmDisabled} onClick={() => confirmMutation.mutate({ shipment_id: "" })}>
              Confirm Shipment
            </Button>
            <Button variant="danger">Delete</Button>
          </div>
        }
        id="shipments.actionBar"
      />
      <FilterBar id="shipments.filterBar">
        <Input placeholder="Search shipment" />
        <Select>
          <option>Status</option>
        </Select>
        <Select>
          <option>Customer</option>
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
            </div>
          }
          right={
            <div className="space-y-4" id="shipments.detailPanel">
              <Card id="shipments.detail.header">
                <CardHeader>
                  <ActionBar title="Shipment Header" />
                </CardHeader>
                <CardBody className="grid gap-3">
                  <SearchSelect label="customer*" placeholder="검색" options={customerOptions} />
                  <Input type="date" placeholder="ship_date" />
                  <Input placeholder="ship_to_address" />
                  <Textarea placeholder="memo" />
                </CardBody>
              </Card>
              <Card id="shipments.detail.addLines">
                <CardBody className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => setOrderModal(true)}>
                    Add from Order
                  </Button>
                  <Button variant="secondary" onClick={() => setRepairModal(true)}>
                    Add from Repair
                  </Button>
                  <Button variant="secondary" onClick={() => setAdHocModal(true)}>
                    Add Ad-hoc
                  </Button>
                </CardBody>
              </Card>
              <Card id="shipments.detail.linesTable">
                <CardHeader>
                  <ActionBar title="Lines" />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3">
                    {shipmentLines.map((line) => (
                      <div key={line.id} className="rounded-[12px] border border-[var(--panel-border)] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{line.model}</p>
                          <Badge tone={line.pricingMode === "RULE" ? "neutral" : "warning"}>{line.pricingMode}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                          <span>qty: {line.qty}</span>
                          <span>material: {line.material}</span>
                          <span>measured: {line.measuredWeight ?? "-"}</span>
                          <span>plated: {line.plated ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card id="shipments.detail.summary">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--muted)]">line_count</p>
                    <p className="text-xl font-semibold">{shipmentLines.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">estimated_total_sell</p>
                    <p className="text-xl font-semibold">₩3,200,000</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">estimated_total_cost</p>
                    <p className="text-xl font-semibold">₩2,180,000</p>
                  </div>
                </CardBody>
              </Card>
              <Card id="shipments.detail.confirm">
                <CardBody className="flex items-center justify-between">
                  <p className="text-sm text-[var(--muted)]">{confirmNote}</p>
                  <Button disabled={confirmDisabled}>Confirm Shipment</Button>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="Add From Orders">
        <p className="text-sm text-[var(--muted)]">주문 검색 + 다중 선택 테이블</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOrderModal(false)}>Confirm</Button>
        </div>
      </Modal>
      <Modal open={repairModal} onClose={() => setRepairModal(false)} title="Add From Repairs">
        <p className="text-sm text-[var(--muted)]">수리 검색 + 다중 선택 테이블</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setRepairModal(false)}>Confirm</Button>
        </div>
      </Modal>
      <Modal open={adHocModal} onClose={() => setAdHocModal(false)} title="Add Ad-hoc Line">
        <div className="grid gap-3">
          <Input placeholder="model_name*" />
          <Input placeholder="suffix" />
          <Input type="number" min={1} placeholder="qty" />
          <Select>
            <option>pricing_mode</option>
            <option>RULE</option>
            <option>UNIT</option>
            <option>AMOUNT_ONLY</option>
          </Select>
          <Input placeholder="unit_price (UNIT)" />
          <Input placeholder="manual_total (AMOUNT_ONLY)" />
          <div className="flex justify-end">
            <Button onClick={() => setAdHocModal(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
