"use client";

import { useForm } from "react-hook-form";
import { ActionBar } from "@/components/layout/action-bar";
import { FilterBar } from "@/components/layout/filter-bar";
import { SplitLayout } from "@/components/layout/split-layout";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ListCard } from "@/components/ui/list-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { CONTRACTS, isFnConfigured } from "@/lib/contracts";

type PartyForm = {
  name: string;
  party_type: string;
  phone?: string;
  region?: string;
  address?: string;
  note?: string;
};

const parties = [
  {
    title: "소매A",
    subtitle: "고객",
    meta: "서울 · 010-1111-1111",
    badge: { label: "활성", tone: "active" as const },
  },
  {
    title: "소매B",
    subtitle: "고객",
    meta: "부산 · 010-2222-2222",
    badge: { label: "활성", tone: "active" as const },
  },
  {
    title: "공장AB",
    subtitle: "공장",
    meta: "중국 · 010-9999-0000",
    badge: { label: "공장", tone: "neutral" as const },
  },
];

export default function PartyPage() {
  const form = useForm<PartyForm>({
    defaultValues: { party_type: "customer" },
  });

  const mutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.partyUpsert,
    successMessage: "저장 완료",
  });
  const canSave = isFnConfigured(CONTRACTS.functions.partyUpsert);

  return (
    <div className="space-y-6" id="party.root">
      <ActionBar
        title="거래처"
        subtitle="거래처 명부"
        actions={<Button>+ 새 거래처</Button>}
        id="party.actionBar"
      />
      <FilterBar id="party.filterBar">
        <Select>
          <option>고객</option>
          <option>공장</option>
        </Select>
        <Select>
          <option>지역</option>
        </Select>
        <Select>
          <option>활성</option>
        </Select>
        <Input placeholder="이름 / 연락처" />
      </FilterBar>
      <div id="party.body">
        <SplitLayout
          className="pt-2"
          left={
            <div className="space-y-3" id="party.listPanel">
              {parties.map((party) => (
                <ListCard key={party.title} {...party} />
              ))}
            </div>
          }
          right={
            <div id="party.detailPanel">
              <Card id="party.detail.basic">
                <CardHeader>
                  <ActionBar title="기본 정보" />
                </CardHeader>
                <CardBody>
                  <form
                    className="grid gap-4"
                    onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                  >
                    <Input placeholder="거래처명*" {...form.register("name", { required: true })} />
                    <Select {...form.register("party_type", { required: true })}>
                      <option value="customer">고객</option>
                      <option value="vendor">공장</option>
                    </Select>
                    <Input placeholder="연락처" {...form.register("phone")} />
                    <Input placeholder="지역" {...form.register("region")} />
                    <Input placeholder="주소" {...form.register("address")} />
                    <Textarea placeholder="메모" {...form.register("note")} />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!canSave || mutation.isPending}>
                        저장
                      </Button>
                      {!canSave ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          ms_s 계약의 거래처 등록 RPC명이 필요합니다.
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
