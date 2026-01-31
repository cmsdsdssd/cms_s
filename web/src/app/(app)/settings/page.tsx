"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";

type MarketTickConfig = {
  fx_markup: number;
  cs_correction_factor: number;
  silver_kr_correction_factor: number;
  updated_at?: string | null;
};

export default function SettingsPage() {
  const sb = useMemo(() => getSchemaClient(), []);

  const cfgQuery = useQuery({
    queryKey: ["cms_market_tick_config", "DEFAULT"],
    queryFn: async (): Promise<MarketTickConfig> => {
      const { data, error } = await sb
        .from("cms_market_tick_config")
        .select("fx_markup, cs_correction_factor, silver_kr_correction_factor, updated_at")
        .eq("config_key", "DEFAULT")
        .maybeSingle();

      if (error) throw error;

      return (
        data ?? {
          fx_markup: 1.03,
          cs_correction_factor: 1.2,
          silver_kr_correction_factor: 1.2,
          updated_at: null,
        }
      );
    },
    onSuccess: (data) => {
      setFxMarkup(String(data.fx_markup ?? 1.03));
      setCsFactor(String(data.cs_correction_factor ?? 1.2));
      setSilverKrFactor(String(data.silver_kr_correction_factor ?? 1.2));
    },
  });

  const [fxMarkup, setFxMarkup] = useState("1.03");
  const [csFactor, setCsFactor] = useState("1.2");
  const [silverKrFactor, setSilverKrFactor] = useState("1.2");

  type UpsertMarketTickConfigResponse = {
    ok?: boolean;
    config_key?: string;
    fx_markup?: number;
    cs_correction_factor?: number;
    silver_kr_correction_factor?: number;
  };

  const upsertCfg = useRpcMutation<UpsertMarketTickConfigResponse>({
    fn: CONTRACTS.functions.marketTickConfigUpsert,
    successMessage: "저장 완료",
  });

  const onSave = async () => {
    const fx = Number(fxMarkup);
    const cs = Number(csFactor);
    const kr = Number(silverKrFactor);

    if (!Number.isFinite(fx) || !Number.isFinite(cs) || !Number.isFinite(kr)) {
      toast.error("숫자 형식이 올바르지 않아요.");
      return;
    }

    if (fx < 0.5 || fx > 2.0) {
      toast.error("FX 마크업은 0.5 ~ 2.0 범위여야 합니다.");
      return;
    }
    if (cs <= 0 || cs > 3.0) {
      toast.error("중국 CS 보정계수는 0 ~ 3.0 범위여야 합니다.");
      return;
    }
    if (kr <= 0 || kr > 3.0) {
      toast.error("한국 실버 보정계수는 0 ~ 3.0 범위여야 합니다.");
      return;
    }

    try {
      await upsertCfg.mutateAsync({
        p_fx_markup: fx,
        p_cs_correction_factor: cs,
        p_silver_kr_correction_factor: kr,
      });
      cfgQuery.refetch();
    } catch {
      // useRpcMutation.onError에서 토스트 처리됨
    }

  };

  return (
    // [변경됨] space-y-6 대신 Grid 시스템 적용 (큰 화면에서 2열 배치)
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
      {/* 왼쪽 컬럼: 시세 파이프라인 설정 */}
      <Card>
        <CardHeader
          title="시세 파이프라인 설정"
          subtitle="FX 마크업 · 중국 CS 보정계수 · 한국 실버 보정계수"
        />
        <CardBody className="space-y-4">
          {/* [변경됨] 카드가 반으로 줄어들었으므로 inputs를 세로로(grid-cols-1) 배치하여 가독성 확보 */}
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">FX 마크업 (예: 1.03)</div>
              <Input value={fxMarkup} onChange={(e) => setFxMarkup(e.target.value)} />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">중국 CS 보정계수 (예: 1.2)</div>
              <Input value={csFactor} onChange={(e) => setCsFactor(e.target.value)} />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">한국 실버 보정계수 (예: 1.2)</div>
              <Input value={silverKrFactor} onChange={(e) => setSilverKrFactor(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={onSave} disabled={upsertCfg.isPending || cfgQuery.isFetching}>
              저장
            </Button>
            <div className="text-xs text-[var(--muted)]">
              {cfgQuery.data?.updated_at
                ? `최근 업데이트: ${new Date(cfgQuery.data.updated_at).toLocaleString()}`
                : ""}
            </div>
          </div>

          <div className="text-xs text-[var(--muted-weak)] leading-relaxed pt-2 border-t border-[var(--border)] mt-2">
            <p className="mb-1">
              • <strong>SILVER_CN_KRW_PER_G</strong>: (중국 은시세 × 환율 × FX 마크업) × CS 보정계수
            </p>
            <p className="mb-1">
              • <strong>한국 실버 보정계수</strong>: 국내 은시세 파이프라인 및 출고확정 계산용
            </p>
            <p>
              • 출고확정 시 현재 설정된 시세와 보정계수가 주문 라인에 스냅샷으로 저장됩니다.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 오른쪽 컬럼: 계정 (향후 추가) */}
      <Card>
        <CardHeader title="계정" subtitle="사용자 정보 및 권한 관리" />
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)] space-y-2">
            <span className="text-2xl opacity-20">🏗️</span>
            <span>기능 준비 중입니다.</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
