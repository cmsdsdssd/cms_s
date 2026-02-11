"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { NumberText } from "@/components/ui/number-text";
import { cn } from "@/lib/utils";

export type ChinaExtraLaborItem = {
  id: string;
  label: string;
  cnyPerG: string; // UI input (string)
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
  extraItems: ChinaExtraLaborItem[];
  onChangeBasic: (next: string) => void;
  onAddExtra: () => void;
  onChangeExtra: (id: string, patch: Partial<Pick<ChinaExtraLaborItem, "label" | "cnyPerG">>) => void;
  onRemoveExtra: (id: string) => void;
};

const toNum = (raw: string): number => {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

export function ChinaCostPanel({
  className,
  csOriginalKrwPerG,
  cnyKrwPer1,
  onRefreshMarket,
  netWeightG,
  basicCnyPerG,
  extraItems,
  onChangeBasic,
  onAddExtra,
  onChangeExtra,
  onRemoveExtra,
}: Props) {
  const computed = useMemo(() => {
    const netG = Number.isFinite(netWeightG) ? Math.max(netWeightG, 0) : 0;

    const materialKrw = Math.round(netG * (Number.isFinite(csOriginalKrwPerG) ? csOriginalKrwPerG : 0));

    const basicCny = Math.max(toNum(basicCnyPerG), 0);
    const extraCny = extraItems.reduce((sum, it) => sum + Math.max(toNum(it.cnyPerG), 0), 0);
    const laborTotalCnyPerG = basicCny + extraCny;

    const laborKrw = Math.round(netG * laborTotalCnyPerG * (Number.isFinite(cnyKrwPer1) ? cnyKrwPer1 : 0));
    const totalKrw = materialKrw + laborKrw;

    return { netG, materialKrw, laborKrw, totalKrw, basicCny, extraCny, laborTotalCnyPerG };
  }, [basicCnyPerG, cnyKrwPer1, csOriginalKrwPerG, extraItems, netWeightG]);

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
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">중국 원가 계산 (예약공간)</p>
            <p className="text-[11px] text-[var(--muted)]">입력: g당 공임(CNY/g) + 기타공임 · 결과: 소재/공임/총원가(KRW)</p>
          </div>
          {onRefreshMarket ? (
            <Button variant="secondary" size="sm" type="button" onClick={onRefreshMarket}>
              새로고침
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
            <p className="text-[11px] text-[var(--muted)]">중국 은시세 (KRW/g)</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {csOriginalKrwPerG > 0 ? csOriginalKrwPerG.toFixed(2) : "-"}
            </p>
          </div>
          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] p-2">
            <p className="text-[11px] text-[var(--muted)]">위안 환율 (KRW/CNY)</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {cnyKrwPer1 > 0 ? cnyKrwPer1.toFixed(2) : "-"}
            </p>
          </div>
        </div>

        {!marketReady ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            시장값(중국 은시세/환율)을 불러오지 못했습니다. 새로고침 후 다시 확인하세요.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-1">
              <p className="text-xs font-semibold text-[var(--muted)]">순중량 (g)</p>
              <Input value={computed.netG.toFixed(2)} readOnly className="text-right" />
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-[var(--muted)]">기본 g당 공임 (CNY/g)</p>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={basicCnyPerG}
                onChange={(e) => onChangeBasic(e.target.value)}
                placeholder="예: 2.50"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--muted)]">기타 g당 공임</p>
              <Button variant="secondary" size="sm" type="button" onClick={onAddExtra}>
                + 추가
              </Button>
            </div>
            {extraItems.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">추가 공임이 없으면 비워두세요.</p>
            ) : (
              <div className="space-y-2">
                {extraItems.map((it) => (
                  <div key={it.id} className="grid grid-cols-[1fr_120px_40px] gap-2 items-center">
                    <Input
                      value={it.label}
                      onChange={(e) => onChangeExtra(it.id, { label: e.target.value })}
                      placeholder="항목명"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.cnyPerG}
                      onChange={(e) => onChangeExtra(it.id, { cnyPerG: e.target.value })}
                      placeholder="CNY/g"
                      className="text-right"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => onRemoveExtra(it.id)}
                    >
                      X
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[14px] border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <p className="text-[11px] text-[var(--muted)]">총 소재가격 (KRW)</p>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  <NumberText value={computed.materialKrw} />
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-[var(--muted)]">총 공임 (KRW)</p>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  <NumberText value={computed.laborKrw} />
                </p>
              </div>
              <div className="col-span-2 h-px bg-[var(--panel-border)]" />
              <div className="space-y-1">
                <p className="text-[11px] text-[var(--muted)]">총 원가 (KRW)</p>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  <NumberText value={computed.totalKrw} />
                </p>
              </div>
              <div className="flex items-end justify-end">
                <Button variant="secondary" size="sm" type="button" onClick={copyTotal}>
                  총원가 복사
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              계산식: 소재=은시세×순중량, 공임=(기본+기타)×순중량×환율
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
