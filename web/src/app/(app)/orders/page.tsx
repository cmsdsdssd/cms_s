"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ListCard } from "@/components/ui/list-card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchSelect } from "@/components/ui/search-select";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";

type OrderForm = {
  customer_party_id: string;
  model_name: string;
  suffix: string;
  color: string;
  qty: number;
  is_plated?: boolean;
  plating_variant_id?: string;
  memo?: string;
};

const orders = [
  {
    title: "AB-10293R",
    subtitle: "ORDER_PENDING · Qty 2",
    meta: "소매A · 2026-01-26",
    badge: { label: "ORDER_PENDING", tone: "warning" as const },
  },
  {
    title: "GC-4410W",
    subtitle: "READY_TO_SHIP · Qty 1",
    meta: "소매B · 2026-01-25",
    badge: { label: "READY", tone: "active" as const },
  },
];

const customerOptions = [
  { label: "소매A", value: "11111111-1111-1111-1111-111111111111" },
  { label: "소매B", value: "11111111-1111-1111-1111-222222222222" },
];

const platingOptions = [
  { label: "G (Phase1)", value: "9f0c15f2-82df-4909-87d6-b13aa628571e" },
];

export default function OrdersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPlating, setSelectedPlating] = useState("");
  const form = useForm<OrderForm>({
    defaultValues: { qty: 1 },
  });

  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.orderUpsert,
    successMessage: "생성 완료",
  });
  const canCreate = isFnConfigured(CONTRACTS.functions.orderUpsert);

  return (
    <div className="space-y-6" id="orders.root">
      <ActionBar
        title="Orders"
        subtitle="주문 라인 관리"
        actions={<Button>+ New Order Line</Button>}
        id="orders.actionBar"
      />
      <FilterBar id="orders.filterBar">
        <Input placeholder="Search model" />
        <Select>
          <option>Status</option>
        </Select>
        <Select>
          <option>Customer</option>
        </Select>
        <Button variant="secondary">More Filters</Button>
      </FilterBar>
      <div id="orders.body">
        <SplitLayout
          left={
            <div className="space-y-4" id="orders.listPanel">
              <Card id="orders.quickCreate">
                <CardHeader>
                  <ActionBar title="Quick Create" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-3"
                    onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                  >
                    <SearchSelect
                      label="customer*"
                      placeholder="검색"
                      options={customerOptions}
                      value={selectedCustomer}
                      onChange={(value) => {
                        setSelectedCustomer(value);
                        form.setValue("customer_party_id", value);
                      }}
                    />
                    <Input placeholder="model_name*" {...form.register("model_name", { required: true })} />
                    <Input placeholder="suffix*" {...form.register("suffix", { required: true })} />
                    <Input placeholder="color*" {...form.register("color", { required: true })} />
                    <Input
                      type="number"
                      min={1}
                      placeholder="qty"
                      {...form.register("qty", { valueAsNumber: true })}
                    />
                    <SearchSelect
                      label="plating_variant"
                      placeholder="검색"
                      options={platingOptions}
                      value={selectedPlating}
                      onChange={(value) => {
                        setSelectedPlating(value);
                        form.setValue("plating_variant_id", value);
                      }}
                    />
                    <Button type="submit" disabled={!canCreate || mutation.isPending}>
                      생성
                    </Button>
                    {!canCreate ? (
                      <p className="text-xs text-[var(--muted)]">
                        ms_s 계약의 order upsert RPC명이 필요합니다.
                      </p>
                    ) : null}
                  </form>
                </CardBody>
              </Card>
              <div className="space-y-3">
                {orders.map((order) => (
                  <ListCard key={order.title} {...order} />
                ))}
              </div>
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Create Shipment from Selected
              </Button>
            </div>
          }
          right={
            <div id="orders.detailPanel">
              <Card id="orders.detail.basic">
                <CardHeader>
                  <ActionBar title="Order Detail" />
                </CardHeader>
                <CardBody>
                  <form className="grid gap-3">
                    <SearchSelect label="customer" placeholder="검색" options={customerOptions} />
                    <Input placeholder="model_name" />
                    <Input placeholder="suffix" />
                    <Input placeholder="color" />
                    <Input type="number" min={1} placeholder="qty" />
                    <Textarea placeholder="memo" />
                    <div className="flex justify-end">
                      <Button>저장</Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Shipment">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            선택된 라인을 거래처별로 묶어 출고 문서를 생성합니다.
          </p>
          <div className="rounded-[12px] border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            선택된 라인 요약 테이블 자리
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={() => setModalOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
