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
    subtitle: "RECEIVED · 2 items",
    meta: "2026-01-25",
    badge: { label: "RECEIVED", tone: "warning" as const },
  },
  {
    title: "소매B",
    subtitle: "READY_TO_SHIP · 1 item",
    meta: "2026-01-24",
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
        title="Repairs"
        subtitle="수리 접수"
        actions={<Button>+ New Repair</Button>}
        id="repairs.actionBar"
      />
      <FilterBar id="repairs.filterBar">
        <Input placeholder="Search model" />
        <Select>
          <option>Status</option>
        </Select>
        <Select>
          <option>Customer</option>
        </Select>
        <Input type="date" placeholder="received_at" />
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
                  <ActionBar title="Repair Detail" />
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
                    <Input type="date" placeholder="received_at*" {...form.register("received_at")} />
                    <Input placeholder="model_name" {...form.register("model_name")} />
                    <Input placeholder="suffix" {...form.register("suffix")} />
                    <Select {...form.register("material_code")}>
                      <option>material</option>
                      <option value="14">14</option>
                      <option value="18">18</option>
                      <option value="24">24</option>
                      <option value="925">925</option>
                      <option value="00">00</option>
                    </Select>
                    <Input type="number" min={1} placeholder="qty" {...form.register("qty", { valueAsNumber: true })} />
                    <Input type="number" min={0} placeholder="measured_weight" {...form.register("measured_weight_g", { valueAsNumber: true })} />
                    <Input type="number" min={0} placeholder="repair_fee_krw" {...form.register("repair_fee_krw", { valueAsNumber: true })} />
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
                    <Textarea placeholder="memo" {...form.register("memo")} />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!canSave || mutation.isPending}>
                        저장
                      </Button>
                      {!canSave ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          ms_s 계약의 repair upsert RPC명이 필요합니다.
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
