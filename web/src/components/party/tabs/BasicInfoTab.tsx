import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import DaumPostcodeEmbed from "react-daum-postcode";
import { Search } from "lucide-react";
import { ActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import type { PartyForm } from "@/components/party/types";

type BasicInfoTabProps = {
  form: UseFormReturn<PartyForm>;
  isEdit: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSubmit: (values: PartyForm) => void;
};

const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
];

export function BasicInfoTab({ form, isEdit, canSave, isSaving, onSubmit }: BasicInfoTabProps) {
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);

  const handleComplete = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = "";

    if (data.addressType === "R") {
      if (data.bname !== "") {
        extraAddress += data.bname;
      }
      if (data.buildingName !== "") {
        extraAddress += extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName;
      }
      fullAddress += extraAddress !== "" ? ` (${extraAddress})` : "";
    }

    form.setValue("address", fullAddress);

    // Auto-detect region
    const sido = data.sido; // e.g., "서울", "경기"
    // Handle special cases if needed (e.g. Jeonbuk)
    // Daum returns "전북특별자치도" -> "전북"
    // "충청북도" -> "충북"? No, default Daum returns full names often?
    // Let's rely on startsWith but handle "전라북도" -> "전북" mapping if needed.
    // Map of common starts:
    const regionMap: Record<string, string> = {
      "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천", "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
      "경기": "경기", "강원": "강원", "충북": "충북", "충청북": "충북", "충남": "충남", "충청남": "충남",
      "전북": "전북", "전라북": "전북", "전남": "전남", "전라남": "전남", "경북": "경북", "경상북": "경북",
      "경남": "경남", "경상남": "경남", "제주": "제주"
    };

    let matched = "";
    for (const key in regionMap) {
      if (sido.startsWith(key)) {
        matched = regionMap[key];
        break;
      }
    }

    if (matched) {
      form.setValue("region", matched);
    }

    setIsPostcodeOpen(false);
  };

  const isVendor = form.watch("party_type") === "vendor";
  const maskCode = form.watch("mask_code");

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.startsWith("02")) {
      // 02-XXX-XXXX or 02-XXXX-XXXX
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    } else {
      // 010-XXXX-XXXX or 031-XXX-XXXX
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    form.setValue("phone", formatted);
  };

  return (
    <>
      <Card id="party.detail.basic">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ActionBar title="기본 정보" />
            {maskCode && (
              <span className="text-base font-normal text-[var(--muted)]">
                {maskCode}
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>

            <div className="flex gap-4">
              <div className="flex-1">
                <Input placeholder="거래처명*" {...form.register("name", { required: true })} />
              </div>
              <div className="w-32">
                <Select {...form.register("party_type", { required: true })} disabled={isEdit}>
                  <option value="customer">고객</option>
                  <option value="vendor">공장</option>
                </Select>
              </div>
            </div>

            {isVendor && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium w-20">Prefix:</span>
                <Input placeholder="공장 식별 코드 (예: G)" {...form.register("prefix")} className="w-32" />
                <p className="text-xs text-[var(--muted)]">제품 코드 생성 시 사용됩니다.</p>
              </div>
            )}

            <Input
              placeholder="연락처 (010-0000-0000)"
              {...form.register("phone")}
              onChange={handlePhoneChange}
            />

            <div className="flex gap-2">
              <Select {...form.register("region")} className="w-24 shrink-0">
                <option value="">지역 선택</option>
                {REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
              <div className="flex bg-[var(--panel)] border border-input rounded-md flex-1 items-center px-1 focus-within:ring-1 focus-within:ring-[var(--primary)]">
                <input
                  className="flex-1 bg-transparent border-none focus:outline-none h-9 px-2 text-sm placeholder:text-[var(--muted)]"
                  placeholder="주소 (요약)"
                  {...form.register("address")}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsPostcodeOpen(true)} className="h-7 w-7 p-0 rounded-full hover:bg-[var(--panel-hover)]">
                  <Search className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

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

      <Modal open={isPostcodeOpen} onClose={() => setIsPostcodeOpen(false)} title="주소 검색">
        <div className="h-[400px]">
          <DaumPostcodeEmbed onComplete={handleComplete} style={{ height: '100%' }} />
        </div>
      </Modal>
    </>
  );
}
