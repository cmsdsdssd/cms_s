"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { getSchemaClient } from "@/lib/supabase/client";

type TickConfigRow = {
  config_key: string;
  fx_markup: number;
  cs_correction_factor: number;
  updated_at: string | null;
};

export default function SettingsPage() {
  const [fxMarkup, setFxMarkup] = useState<string>("1.03");
  const [csCorrection, setCsCorrection] = useState<string>("1.00");

  const configQuery = useQuery({
    queryKey: ["cms_market_tick_config", "DEFAULT"],
    queryFn: async () => {
      const supabase = getSchemaClient();
      const { data, error } = await supabase
        .from("cms_market_tick_config")
        .select("config_key, fx_markup, cs_correction_factor, updated_at")
        .eq("config_key", "DEFAULT")
        .maybeSingle<TickConfigRow>();

      if (error) throw error;

      return (
        data ?? {
          config_key: "DEFAULT",
          fx_markup: 1.03,
          cs_correction_factor: 1.0,
          updated_at: null,
        }
      );
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setFxMarkup(String(configQuery.data.fx_markup ?? 1.03));
    setCsCorrection(String(configQuery.data.cs_correction_factor ?? 1.0));
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSchemaClient();

      const nextFx = Number(fxMarkup);
      const nextCorr = Number(csCorrection);

      if (!Number.isFinite(nextFx) || nextFx <= 0) {
        throw new Error("fx_markup은 0보다 큰 숫자여야 합니다.");
      }
      if (!Number.isFinite(nextCorr) || nextCorr <= 0) {
        throw new Error("보정계수는 0보다 큰 숫자여야 합니다.");
      }

      const { data, error } = await supabase
        .from("cms_market_tick_config")
        .upsert(
          {
            config_key: "DEFAULT",
            fx_markup: nextFx,
            cs_correction_factor: nextCorr,
          },
          { onConflict: "config_key" }
        )
        .select("config_key, fx_markup, cs_correction_factor, updated_at")
        .maybeSingle<TickConfigRow>();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success("저장 완료: CS 계산계수가 반영됩니다.");
      await configQuery.refetch();
    },
    onError: (e: any) => {
      toast.error(`저장 실패: ${e?.message ?? String(e)}`);
    },
  });

  const isBusy = configQuery.isLoading || saveMutation.isPending;

  return (
    <div className="space-y-6" id="settings.root">
      <ActionBar
        title="설정"
        subtitle="시세/도금/룰 조회"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => configQuery.refetch()}
              disabled={isBusy}
            >
              새로고침
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={isBusy}
            >
              저장
            </Button>
          </div>
        }
        id="settings.actionBar"
      />

      <div className="grid gap-4" id="settings.body">
        <Card>
          <CardHeader>
            <ActionBar
              title="CS(중국 은시세) 계산 설정"
              subtitle="n8n이 이 값을 읽어서 CS를 계산 후, 시세 테이블에 Upsert합니다."
            />
          </CardHeader>
          <CardBody>
            <div className="grid gap-4">
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
                <div className="font-medium">CS 계산식</div>
                <div className="mt-1 font-mono text-xs text-[var(--muted)]">
                  CS = (CNY→KRW 환율) × fx_markup × (중국 은 매도가 CNY/g) × 보정계수
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  ※ 출고확정 시점에 사용하는 시세는 테이블 값을 기준으로 하므로, 수정 후에는 반드시 n8n 실행/반영을 확인하세요.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">fx_markup</div>
                  <Input
                    inputMode="decimal"
                    value={fxMarkup}
                    onChange={(e) => setFxMarkup(e.target.value)}
                    placeholder="예: 1.03"
                  />
                  <div className="text-xs text-[var(--muted-weak)]">
                    CNY→KRW 원환율에 곱하는 마크업. (예: 1.03 = 3% 상향)
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">보정계수</div>
                  <Input
                    inputMode="decimal"
                    value={csCorrection}
                    onChange={(e) => setCsCorrection(e.target.value)}
                    placeholder="예: 1.00"
                  />
                  <div className="text-xs text-[var(--muted-weak)]">
                    최종 CS에 곱하는 추가 보정계수. (예: 1.015 = 1.5% 상향)
                  </div>
                </div>
              </div>

              <div className="text-xs text-[var(--muted)]">
                현재값: {configQuery.data ? `fx_markup=${configQuery.data.fx_markup}, 보정계수=${configQuery.data.cs_correction_factor}` : "-"}
                {configQuery.data?.updated_at ? ` (updated_at=${configQuery.data.updated_at})` : ""}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 아래는 기존 placeholder. 필요하면 추후 실제 데이터로 연결 */}
        <Card>
          <CardHeader>
            <ActionBar title="시세" />
          </CardHeader>
          <CardBody>
            <div className="text-xs text-[var(--muted)]">
              (TODO) 시세 테이블/뷰를 연결해서 KG/KS/CS 최신값을 표로 노출
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <ActionBar title="도금 옵션" />
          </CardHeader>
          <CardBody>
            <div className="text-xs text-[var(--muted)]">
              (TODO) 도금 옵션 조회/관리 연결
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <ActionBar title="공임 밴드 룰" />
          </CardHeader>
          <CardBody>
            <div className="text-xs text-[var(--muted)]">
              (TODO) 공임 룰 조회/관리 연결
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
