"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { Factory, Phone, Save } from "lucide-react";

type MarketTickConfig = {
  fx_markup: number;
  cs_correction_factor: number;
  silver_kr_correction_factor: number;
  updated_at?: string | null;
};

type VendorFaxConfig = {
  config_id: string;
  vendor_party_id: string;
  vendor_name: string;
  fax_number: string | null;
  fax_provider: 'mock' | 'twilio' | 'sendpulse' | 'custom' | 'apiplex';
  is_active: boolean;
};

const FAX_PROVIDERS = ['mock', 'twilio', 'sendpulse', 'custom', 'apiplex'] as const;
type FaxProvider = typeof FAX_PROVIDERS[number];

function toFaxProvider(value: string | null | undefined): FaxProvider {
  return FAX_PROVIDERS.includes(value as FaxProvider) ? (value as FaxProvider) : "mock";
}

type VendorFaxConfigRow = {
  party_id: string;
  name: string;
  cms_vendor_fax_config?: {
    config_id: string;
    fax_number: string | null;
    fax_provider: string | null;
    is_active: boolean | null;
  }[];
};

export default function SettingsPage() {
  const sb = useMemo(() => getSchemaClient(), []);

  const cfgQuery = useQuery({
    queryKey: ["cms_market_tick_config", "DEFAULT"],
    queryFn: async (): Promise<MarketTickConfig> => {
      if (!sb) throw new Error("Supabase env is missing");
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
  });

  const [fxMarkup, setFxMarkup] = useState<string | null>(null);
  const [csFactor, setCsFactor] = useState<string | null>(null);
  const [silverKrFactor, setSilverKrFactor] = useState<string | null>(null);

  const displayFxMarkup = fxMarkup ?? String(cfgQuery.data?.fx_markup ?? 1.03);
  const displayCsFactor = csFactor ?? String(cfgQuery.data?.cs_correction_factor ?? 1.2);
  const displaySilverKrFactor =
    silverKrFactor ?? String(cfgQuery.data?.silver_kr_correction_factor ?? 1.2);

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
    const fx = Number(displayFxMarkup);
    const cs = Number(displayCsFactor);
    const kr = Number(displaySilverKrFactor);

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

  // ============================================
  // Vendor Fax Config Section
  // ============================================
  const queryClient = useQueryClient();
  
  const vendorsQuery = useQuery({
    queryKey: ["cms_vendor_fax_configs"],
    queryFn: async (): Promise<VendorFaxConfig[]> => {
      if (!sb) throw new Error("Supabase env is missing");
      
      // Get vendors from party table with fax config
      const { data, error } = await sb
        .from("cms_party")
        .select(`
          party_id,
          name,
          cms_vendor_fax_config!left(
            config_id,
            fax_number,
            fax_provider,
            is_active
          )
        `)
        .eq("party_type", "vendor")
        .order("name");

      if (error) throw error;

      return (data || []).map((v: VendorFaxConfigRow) => ({
        config_id: v.cms_vendor_fax_config?.[0]?.config_id || "",
        vendor_party_id: v.party_id,
        vendor_name: v.name,
        fax_number: v.cms_vendor_fax_config?.[0]?.fax_number || null,
        fax_provider: toFaxProvider(v.cms_vendor_fax_config?.[0]?.fax_provider),
        is_active: v.cms_vendor_fax_config?.[0]?.is_active ?? true,
      }));
    },
  });

  const [editingConfigs, setEditingConfigs] = useState<Record<string, {
    fax_number: string;
    fax_provider: string;
  }>>({});

  type VendorFaxConfigUpsertResponse = {
    ok?: boolean;
    vendor_party_id?: string;
    fax_number?: string | null;
    fax_provider?: string | null;
    is_active?: boolean;
  };

  const updateFaxConfigMutation = useRpcMutation<VendorFaxConfigUpsertResponse>({
    fn: CONTRACTS.functions.vendorFaxConfigUpsert,
    successMessage: "팩스 설정 저장 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms_vendor_fax_configs"] });
    },
  });

  const handleSaveFaxConfig = (vendor: VendorFaxConfig) => {
    const edit = editingConfigs[vendor.vendor_party_id];
    if (!edit) return;
    
    updateFaxConfigMutation.mutate({
      p_vendor_party_id: vendor.vendor_party_id,
      p_fax_number: edit.fax_number || null,
      p_fax_provider: edit.fax_provider,
      p_is_active: true,
      p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
    });
  };

  const setEditingConfig = (vendorPartyId: string, field: 'fax_number' | 'fax_provider', value: string) => {
    setEditingConfigs(prev => ({
      ...prev,
      [vendorPartyId]: {
        fax_number: prev[vendorPartyId]?.fax_number ?? vendorsQuery.data?.find(v => v.vendor_party_id === vendorPartyId)?.fax_number ?? "",
        fax_provider: prev[vendorPartyId]?.fax_provider ?? vendorsQuery.data?.find(v => v.vendor_party_id === vendorPartyId)?.fax_provider ?? "mock",
        [field]: value,
      }
    }));
  };

  return (
    // [변경됨] space-y-6 대신 Grid 시스템 적용 (큰 화면에서 2열 배치)
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
      {/* 왼쪽 컬럼: 시세 파이프라인 설정 */}
      <Card>
        <CardHeader>
          <div>
            <div className="text-sm font-semibold">시세 파이프라인 설정</div>
            <div className="text-xs text-[var(--muted)]">FX 마크업 · 중국 CS 보정계수 · 한국 실버 보정계수</div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* [변경됨] 카드가 반으로 줄어들었으므로 inputs를 세로로(grid-cols-1) 배치하여 가독성 확보 */}
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">FX 마크업 (예: 1.03)</div>
              <Input value={displayFxMarkup} onChange={(e) => setFxMarkup(e.target.value)} />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">중국 CS 보정계수 (예: 1.2)</div>
              <Input value={displayCsFactor} onChange={(e) => setCsFactor(e.target.value)} />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">한국 실버 보정계수 (예: 1.2)</div>
              <Input value={displaySilverKrFactor} onChange={(e) => setSilverKrFactor(e.target.value)} />
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

      {/* 오른쪽 컬럼: 공장 팩스 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-[var(--primary)]" />
            <div>
              <div className="text-sm font-semibold">공장 팩스 설정</div>
              <div className="text-xs text-[var(--muted)]">업체별 팩스 번호 및 전송 방식 설정</div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {vendorsQuery.isLoading ? (
            <div className="text-center py-8 text-[var(--muted)]">
              <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">공장 목록 로딩 중...</p>
            </div>
          ) : vendorsQuery.error ? (
            <div className="text-center py-8 text-red-500">
              <p className="text-sm">공장 목록을 불러올 수 없습니다</p>
              <p className="text-xs mt-1">{vendorsQuery.error instanceof Error ? vendorsQuery.error.message : "알 수 없는 오류"}</p>
            </div>
          ) : vendorsQuery.data?.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)]">
              <p className="text-sm">등록된 공장 업체가 없습니다</p>
              <p className="text-xs mt-1">거래처 관리에서 공장을 먼저 등록해주세요</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {vendorsQuery.data?.map((vendor) => {
                const edit = editingConfigs[vendor.vendor_party_id];
                const faxNumber = edit?.fax_number ?? vendor.fax_number ?? "";
                const faxProvider = edit?.fax_provider ?? vendor.fax_provider ?? "mock";
                const hasChanges = edit !== undefined;

                return (
                  <div
                    key={vendor.vendor_party_id}
                    className={`p-3 rounded-lg border transition-all ${
                      hasChanges 
                        ? "border-[var(--primary)] bg-[var(--primary)]/5" 
                        : "border-[var(--panel-border)] bg-[var(--panel)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{vendor.vendor_name}</span>
                      {hasChanges && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="h-7 text-xs"
                          onClick={() => handleSaveFaxConfig(vendor)}
                          disabled={updateFaxConfigMutation.isPending}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          저장
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--muted)] uppercase tracking-wider">팩스 번호</label>
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[var(--muted)]" />
                          <Input
                            value={faxNumber}
                            onChange={(e) => setEditingConfig(vendor.vendor_party_id, "fax_number", e.target.value)}
                            placeholder="02-1234-5678"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted)] uppercase tracking-wider">전송 방식</label>
                        <Select
                          value={faxProvider}
                          onChange={(e) => setEditingConfig(vendor.vendor_party_id, "fax_provider", e.target.value)}
                          className="h-8 text-sm"
                        >
                          <option value="mock">Mock (테스트용)</option>
                          <option value="twilio">Twilio (실제 팩스)</option>
                          <option value="sendpulse">SendPulse</option>
                          <option value="custom">Custom</option>
                          <option value="apiplex">API PLEX (국내 팩스)</option>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="text-xs text-[var(--muted-weak)] leading-relaxed pt-2 border-t border-[var(--border)] mt-2">
            <p className="mb-1">
              • <strong>Mock 모드:</strong> 실제 전송 없이 HTML 파일을 저장합니다 (테스트용)
            </p>
            <p className="mb-1">
              • <strong>Twilio:</strong> 실제 팩스 전송을 위해서는 Twilio 계정 설정이 필요합니다
            </p>
            <p>
              • 공장발주 시 설정된 팩스 번호로 자동 전송됩니다
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
