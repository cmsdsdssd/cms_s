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
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { SearchSelect } from "@/components/ui/search-select";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";

type RepairForm = {
  customer_party_id: string;
  received_at: string;
  model_name?: string;
  suffix?: string;
  material_code?: string;
  qty?: number;
  measured_weight_g?: number;
  is_paid?: boolean;
  repair_fee_krw?: number;
  is_plated?: boolean;
  plating_variant_id?: string;
  memo?: string;
};

const repairs = [
  {
    title: "소매A",
    subtitle: "접수 · 2건",
    meta: "2026-01-25",
    badge: { label: "접수", tone: "warning" as const },
  },
  {
    title: "소매B",
    subtitle: "출고 준비 · 1건",
    meta: "2026-01-24",
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

export default function RepairsPage() {
  const form = useForm<RepairForm>({
    defaultValues: { received_at: "", qty: 1 },
  });
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPlating, setSelectedPlating] = useState("");

  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.repairUpsert,
    successMessage: "접수 저장 완료",
  });
  const canSave = isFnConfigured(CONTRACTS.functions.repairUpsert);

  return (
    <div className="space-y-6" id="repairs.root">
      <ActionBar
        title="수리"
        subtitle="수리 접수"
        actions={<Button>+ 신규 수리</Button>}
        id="repairs.actionBar"
      />
      <FilterBar id="repairs.filterBar">
        <Input placeholder="모델명 검색" />
        <Select>
          <option>상태</option>
        </Select>
        <Select>
          <option>거래처</option>
        </Select>
        <Input type="date" placeholder="접수일" />
      </FilterBar>
      <div id="repairs.body">
        <SplitLayout
          left={
            <div className="space-y-3" id="repairs.listPanel">
              {repairs.map((repair) => (
                <ListCard key={repair.title} {...repair} />
              ))}
            </div>
          }
          right={
            <div id="repairs.detailPanel">
              <Card id="repairs.detail.basic">
                <CardHeader>
                  <ActionBar title="수리 상세" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-3"
                    onSubmit={form.handleSubmit((values) =>
                      mutation.mutate({
                        p_customer_party_id: values.customer_party_id,
                        p_model_name: values.model_name ?? null,
                        p_suffix: values.suffix ?? null,
                        p_color: null,
                        p_material_code: values.material_code ?? null,
                        p_qty: values.qty ?? 1,
                        p_measured_weight_g: values.measured_weight_g ?? null,
                        p_is_plated: values.is_plated ?? false,
                        p_plating_variant_id: values.plating_variant_id ?? null,
                        p_repair_fee_krw: values.repair_fee_krw ?? null,
                        p_received_at: values.received_at,
                        p_memo: values.memo ?? null,
                        p_repair_line_id: null,
                      })
                    )}
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
                    <Input type="date" placeholder="접수일*" {...form.register("received_at")} />
                    <Input placeholder="모델명" {...form.register("model_name")} />
                    <Input placeholder="종류" {...form.register("suffix")} />
                    <Select {...form.register("material_code")}>
                      <option>재질</option>
                      <option value="14">14</option>
                      <option value="18">18</option>
                      <option value="24">24</option>
                      <option value="925">925</option>
                      <option value="00">00</option>
                    </Select>
                    <Input type="number" min={1} placeholder="수량" {...form.register("qty", { valueAsNumber: true })} />
                    <Input type="number" min={0} placeholder="실측중량" {...form.register("measured_weight_g", { valueAsNumber: true })} />
                    <Input type="number" min={0} placeholder="수리비" {...form.register("repair_fee_krw", { valueAsNumber: true })} />
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
                    <Textarea placeholder="메모" {...form.register("memo")} />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!canSave || mutation.isPending}>
                        저장
                      </Button>
                      {!canSave ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          cms 계약의 수리 등록 RPC명이 필요합니다.
                        </p>
                      ) : null}
                    </div>
                  </form>
                </CardBody>
              </Card>
            </div>
          }
        />
      </div>
    </div>
  );
}
