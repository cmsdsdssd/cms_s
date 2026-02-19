"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { NumberText } from "@/components/ui/number-text";
import { cn } from "@/lib/utils";

export type ChinaExtraLaborItem = {
  id: string;
  label: string;
  basis: "PER_G" | "PER_PIECE";
  cnyAmount: string; // UI input (string)
};

type Props = {
  className?: string;

  // market data
  csOriginalKrwPerG: number; // China silver raw KRW/g
  cnyKrwPer1: number; // KRW per 1 CNY
  onRefreshMarket?: () => void;

  // weight
  netWeightG: number;

  // inputs
  basicCnyPerG: string;
  basicBasis: "PER_G" | "PER_PIECE";
  extraItems: ChinaExtraLaborItem[];
  onChangeBasic: (next: string) => void;
  onChangeBasicBasis: (next: "PER_G" | "PER_PIECE") => void;
  onAddExtra: () => void;
  onChangeExtra: (id: string, patch: Partial<Pick<ChinaExtraLaborItem, "label" | "basis" | "cnyAmount">>) => void;
  onRemoveExtra: (id: string) => void;
};

const toNum = (raw: string): number => {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

const reasonPresetOptions = [
  "기본공임",
  "중심공임",
  "보조1공임",
  "보조2공임",
  "도금공임",
  "부속공임",
] as const;

export function ChinaCostPanel({
  className,
  csOriginalKrwPerG,
  cnyKrwPer1,
  onRefreshMarket,
  netWeightG,
  basicCnyPerG,
  basicBasis,
  extraItems,
  onChangeBasic,
  onChangeBasicBasis,
  onAddExtra,
  onChangeExtra,
  onRemoveExtra,
}: Props) {
  void onRefreshMarket;
  const computed = useMemo(() => {
    const netG = Number.isFinite(netWeightG) ? Math.max(netWeightG, 0) : 0;

    const materialKrw = Math.round(netG * (Number.isFinite(csOriginalKrwPerG) ? csOriginalKrwPerG : 0));

    const basicCny = Math.max(toNum(basicCnyPerG), 0);
    const extraRows = extraItems.map((it) => {
      const cny = Math.max(toNum(it.cnyAmount), 0);
      const laborKrw = it.basis === "PER_PIECE"
        ? Math.round(cny * (Number.isFinite(cnyKrwPer1) ? cnyKrwPer1 : 0))
        : Math.round(netG * cny * (Number.isFinite(cnyKrwPer1) ? cnyKrwPer1 : 0));
      return {
        id: it.id,
        label: String(it.label ?? "").trim() || "기타공임",
        basis: it.basis,
        cny,
        laborKrw,
      };
    });
    const extraCnyPerG = extraRows.reduce((sum, row) => sum + (row.basis === "PER_G" ? row.cny : 0), 0);

    const basicLaborKrw = basicBasis === "PER_PIECE"
      ? Math.round(basicCny * (Number.isFinite(cnyKrwPer1) ? cnyKrwPer1 : 0))
      : Math.round(netG * basicCny * (Number.isFinite(cnyKrwPer1) ? cnyKrwPer1 : 0));
    const extraLaborKrw = extraRows.reduce((sum, row) => sum + row.laborKrw, 0);
    const laborKrw = basicLaborKrw + extraLaborKrw;
    const totalKrw = materialKrw + laborKrw;

    return {
      netG,
      materialKrw,
      laborKrw,
      totalKrw,
      basicCny,
      extraCnyPerG,
      basicLaborKrw,
      extraRows,
    };
  }, [basicCnyPerG, basicBasis, cnyKrwPer1, csOriginalKrwPerG, extraItems, netWeightG]);

  const marketReady = csOriginalKrwPerG > 0 && cnyKrwPer1 > 0;

  const copyTotal = async () => {
    try {
      await navigator.clipboard.writeText(String(computed.totalKrw));
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-[18px] border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">중국 원가</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-[auto_auto] items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5">
              <span className="text-xs text-[var(--muted)]">소재가격</span>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                <NumberText value={computed.materialKrw} />
              </span>
            </div>
            <div className="grid grid-cols-[auto_auto] items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5">
              <span className="text-xs text-[var(--muted)]">총원가</span>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                <NumberText value={computed.totalKrw} />
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
            <p className="text-[11px] text-[var(--muted)]">중국시세</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {csOriginalKrwPerG > 0 ? csOriginalKrwPerG.toFixed(2) : "-"}
            </p>
          </div>
          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
            <p className="text-[11px] text-[var(--muted)]">위안화 환율</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {cnyKrwPer1 > 0 ? cnyKrwPer1.toFixed(2) : "-"}
            </p>
          </div>
          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
            <p className="text-[11px] text-[var(--muted)]">순중량</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{computed.netG.toFixed(2)}</p>
          </div>
        </div>

        {!marketReady ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            시장값(중국 은시세/환율)을 불러오지 못했습니다.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="grid w-full grid-cols-[1fr_96px_92px_32px] gap-2 text-xs font-semibold text-[var(--muted)]">
                <span>사유</span>
                <span className="text-right">위안화</span>
                <span className="text-[var(--muted)]">기준</span>
                <span />
              </div>
              <Button variant="secondary" size="sm" type="button" onClick={onAddExtra}>
                + 추가
              </Button>
            </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_96px_92px_32px] gap-2 items-center">
                  <Input value="기본공임" readOnly />
                  <Input
                    type="number"
                  min={0}
                  step="0.01"
                  value={basicCnyPerG}
                  onChange={(e) => onChangeBasic(e.target.value)}
                    placeholder="0"
                    className="text-right"
                  />
                  <Select value={basicBasis} onChange={(e) => onChangeBasicBasis(e.target.value as "PER_G" | "PER_PIECE")}>
                    <option value="PER_G">g당</option>
                    <option value="PER_PIECE">개당</option>
                  </Select>
                  <span />
                </div>
                {extraItems.map((it) => (
                  <div key={it.id} className="grid grid-cols-[1fr_96px_92px_32px] gap-2 items-center">
                    <div className="space-y-1">
                      <Select
                      value={reasonPresetOptions.includes(it.label as (typeof reasonPresetOptions)[number]) ? it.label : "__custom__"}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "__custom__") {
                          onChangeExtra(it.id, { label: "" });
                          return;
                        }
                        onChangeExtra(it.id, { label: next });
                      }}
                    >
                      {reasonPresetOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__custom__">직접입력</option>
                    </Select>
                    {!reasonPresetOptions.includes(it.label as (typeof reasonPresetOptions)[number]) ? (
                      <Input
                        value={it.label}
                        onChange={(e) => onChangeExtra(it.id, { label: e.target.value })}
                        placeholder="사유 직접입력"
                      />
                    ) : null}
                  </div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.cnyAmount}
                      onChange={(e) => onChangeExtra(it.id, { cnyAmount: e.target.value })}
                      placeholder="0"
                      className="text-right"
                    />
                    <Select value={it.basis} onChange={(e) => onChangeExtra(it.id, { basis: e.target.value as "PER_G" | "PER_PIECE" })}>
                      <option value="PER_G">g당</option>
                      <option value="PER_PIECE">개당</option>
                    </Select>
                    <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => onRemoveExtra(it.id)}
                    className="h-8 px-0"
                  >
                    X
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <div className="space-y-2 text-sm">
              <div className="rounded border border-[var(--panel-border)] bg-[var(--subtle-bg)] p-2">
                <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">공임 상세 (KRW)</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span>기본 공임 ({basicBasis === "PER_PIECE" ? "개당" : "g당"})</span>
                    <span className="font-semibold"><NumberText value={computed.basicLaborKrw} /></span>
                  </div>
                  {computed.extraRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between">
                      <span>{row.label} ({row.basis === "PER_PIECE" ? "개당" : "g당"})</span>
                      <span className="font-semibold"><NumberText value={row.laborKrw} /></span>
                    </div>
                  ))}
                  {computed.extraRows.length === 0 ? (
                    <div className="text-[var(--muted)]">추가 공임 없음</div>
                  ) : null}
                </div>
              </div>

              <div className="h-px bg-[var(--panel-border)]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[var(--muted)]">총 공임 (KRW)</p>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  <NumberText value={computed.laborKrw} />
                </p>
              </div>

              <div className="flex items-end justify-end pt-1">
                <Button variant="secondary" size="sm" type="button" onClick={copyTotal}>
                  총원가 복사
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
