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
    subtitle: "대기 · 수량 2",
    meta: "소매A · 2026-01-26",
    badge: { label: "대기", tone: "warning" as const },
  },
  {
    title: "GC-4410W",
    subtitle: "출고 준비 · 수량 1",
    meta: "소매B · 2026-01-25",
    badge: { label: "준비", tone: "active" as const },
  },
];

const customerOptions = [
  { label: "소매A", value: "11111111-1111-1111-1111-111111111111" },
  { label: "소매B", value: "11111111-1111-1111-1111-222222222222" },
];

const platingOptions = [
  { label: "G (1차)", value: "9f0c15f2-82df-4909-87d6-b13aa628571e" },
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
        title="주문"
        subtitle="주문 라인 관리"
        actions={<Button>+ 신규 주문</Button>}
        id="orders.actionBar"
      />
      <FilterBar id="orders.filterBar">
        <Input placeholder="모델명 검색" />
        <Select>
          <option>상태</option>
        </Select>
        <Select>
          <option>거래처</option>
        </Select>
        <Button variant="secondary">추가 필터</Button>
      </FilterBar>
      <div id="orders.body">
        <SplitLayout
          left={
            <div className="space-y-4" id="orders.listPanel">
              <Card id="orders.quickCreate">
                <CardHeader>
                  <ActionBar title="빠른 등록" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-3"
                    onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                  >
                    <SearchSelect
                      label="거래처*"
                      placeholder="검색"
                      options={customerOptions}
                      value={selectedCustomer}
                      onChange={(value) => {
                        setSelectedCustomer(value);
                        form.setValue("customer_party_id", value);
                      }}
                    />
                    <Input placeholder="모델명*" {...form.register("model_name", { required: true })} />
                    <Input placeholder="종류*" {...form.register("suffix", { required: true })} />
                    <Input placeholder="색상*" {...form.register("color", { required: true })} />
                    <Input
                      type="number"
                      min={1}
                      placeholder="수량"
                      {...form.register("qty", { valueAsNumber: true })}
                    />
                    <SearchSelect
                      label="도금 옵션"
                      placeholder="검색"
                      options={platingOptions}
                      value={selectedPlating}
                      onChange={(value) => {
                        setSelectedPlating(value);
                        form.setValue("plating_variant_id", value);
                      }}
                    />
                    <Button type="submit" disabled={!canCreate || mutation.isPending}>
                      등록
                    </Button>
                    {!canCreate ? (
                      <p className="text-xs text-[var(--muted)]">
                        ms_s 계약의 주문 등록 RPC명이 필요합니다.
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
                선택 항목 출고 생성
              </Button>
            </div>
          }
          right={
            <div id="orders.detailPanel">
              <Card id="orders.detail.basic">
                <CardHeader>
                  <ActionBar title="주문 상세" />
                </CardHeader>
                <CardBody>
                  <form className="grid gap-3">
                    <SearchSelect label="거래처" placeholder="검색" options={customerOptions} />
                    <Input placeholder="모델명" />
                    <Input placeholder="종류" />
                    <Input placeholder="색상" />
                    <Input type="number" min={1} placeholder="수량" />
                    <Textarea placeholder="메모" />
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="출고 생성">
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
            <Button onClick={() => setModalOpen(false)}>확인</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
