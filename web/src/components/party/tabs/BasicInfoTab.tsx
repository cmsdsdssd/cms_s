import type { UseFormReturn } from "react-hook-form";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { PartyForm } from "@/components/party/types";

type BasicInfoTabProps = {
  form: UseFormReturn<PartyForm>;
  isEdit: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (values: PartyForm) => void;
};

export function BasicInfoTab({ form, isEdit, canSave, isSaving, onSubmit }: BasicInfoTabProps) {
  return (
    <Card id="party.detail.basic">
      <CardHeader>
        <ActionBar title="기본 정보" />
      </CardHeader>
      <CardBody>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Input placeholder="거래처명*" {...form.register("name", { required: true })} />
          <Select {...form.register("party_type", { required: true })} disabled={isEdit}>
            <option value="customer">고객</option>
            <option value="vendor">공장</option>
          </Select>
          <Input placeholder="연락처" {...form.register("phone")} />
          <Input placeholder="지역" {...form.register("region")} />
          <Input placeholder="주소 (요약)" {...form.register("address")} />
          <Textarea placeholder="메모" {...form.register("note")} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" {...form.register("is_active")} />
            <label htmlFor="is_active" className="text-sm text-[var(--muted)]">
              활성
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSave || isSaving}>
              저장
            </Button>
            {!canSave && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                cms 계약의 거래처 등록 RPC명이 필요합니다.
              </p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
