"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  rule_rounding_unit_krw?: number | null;
  updated_at?: string | null;
};

type VendorFaxConfig = {
  config_id: string;
  vendor_party_id: string;
  vendor_name: string;
  fax_number: string | null;
  fax_provider: 'mock' | 'twilio' | 'sendpulse' | 'custom' | 'apiplex' | 'uplus_print';
  is_active: boolean;
};

const FAX_PROVIDERS = ['mock', 'twilio', 'sendpulse', 'custom', 'apiplex', 'uplus_print'] as const;
type FaxProvider = typeof FAX_PROVIDERS[number];

const RULE_COMPONENT_OPTIONS: PricingRuleComponent[] = ["SETTING", "STONE", "PACKAGE"];
const RULE_SCOPE_OPTIONS: PricingRuleScope[] = ["ANY", "SELF", "PROVIDED", "FACTORY"];

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

type PricingRuleComponent = "SETTING" | "STONE" | "PACKAGE";
type PricingRuleScope = "ANY" | "SELF" | "PROVIDED" | "FACTORY";

type PricingRuleRow = {
  rule_id: string;
  component: PricingRuleComponent;
  scope: PricingRuleScope;
  vendor_party_id: string | null;
  min_cost_krw: number;
  max_cost_krw: number | null;
  markup_kind: string;
  markup_value_krw: number;
  priority: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

export default function SettingsPage() {
  const sb = useMemo(() => getSchemaClient(), []);

  const cfgQuery = useQuery({
    queryKey: ["cms_market_tick_config", "DEFAULT"],
    queryFn: async (): Promise<MarketTickConfig> => {
      if (!sb) throw new Error("Supabase env is missing");
      const { data, error } = await sb
        .from("cms_market_tick_config")
        .select("fx_markup, cs_correction_factor, silver_kr_correction_factor, rule_rounding_unit_krw, updated_at")
        .eq("config_key", "DEFAULT")
        .maybeSingle();

      if (error) throw error;

      return (
        data ?? {
          fx_markup: 1.03,
          cs_correction_factor: 1.2,
          silver_kr_correction_factor: 1.2,
          rule_rounding_unit_krw: 0,
          updated_at: null,
        }
      );
    },
  });

  const [fxMarkup, setFxMarkup] = useState<string | null>(null);
  const [csFactor, setCsFactor] = useState<string | null>(null);
  const [silverKrFactor, setSilverKrFactor] = useState<string | null>(null);
  const [ruleRoundingUnit, setRuleRoundingUnit] = useState<string | null>(null);

  const displayFxMarkup = fxMarkup ?? String(cfgQuery.data?.fx_markup ?? 1.03);
  const displayCsFactor = csFactor ?? String(cfgQuery.data?.cs_correction_factor ?? 1.2);
  const displaySilverKrFactor =
    silverKrFactor ?? String(cfgQuery.data?.silver_kr_correction_factor ?? 1.2);
  const displayRuleRoundingUnit =
    ruleRoundingUnit ?? String(cfgQuery.data?.rule_rounding_unit_krw ?? 0);

  type UpsertMarketTickConfigResponse = {
    ok?: boolean;
    config_key?: string;
    fx_markup?: number;
    cs_correction_factor?: number;
    silver_kr_correction_factor?: number;
    rule_rounding_unit_krw?: number | null;
  };

  const upsertCfg = useRpcMutation<UpsertMarketTickConfigResponse>({
    fn: CONTRACTS.functions.marketTickConfigUpsert,
    successMessage: "저장 완료",
  });

  const setRuleRoundingUnitMutation = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.setRuleRoundingUnit,
    successMessage: "저장 완료",
    onSuccess: () => {
      cfgQuery.refetch();
    },
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

  const currentRoundingUnit = Number(cfgQuery.data?.rule_rounding_unit_krw ?? 0);
  const nextRoundingUnit = Number(displayRuleRoundingUnit);
  const hasRoundingUnitChange = Number.isFinite(nextRoundingUnit)
    ? nextRoundingUnit !== currentRoundingUnit
    : false;
  const canSaveRoundingUnit =
    Number.isInteger(nextRoundingUnit) && nextRoundingUnit >= 0 && hasRoundingUnitChange;

  const onSaveRoundingUnit = async () => {
    if (!Number.isInteger(nextRoundingUnit) || nextRoundingUnit < 0) {
      toast.error("올림 단위는 0 이상의 정수여야 합니다.");
      return;
    }

    try {
      await setRuleRoundingUnitMutation.mutateAsync({
        p_rounding_unit_krw: nextRoundingUnit,
        p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
        p_session_id: null,
        p_memo: null,
      });
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

  const pricingRulesQuery = useQuery({
    queryKey: ["cms_pricing_rules"],
    queryFn: async (): Promise<PricingRuleRow[]> => {
      const response = await fetch("/api/pricing-rules", { cache: "no-store" });
      const json = (await response.json()) as { data?: PricingRuleRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "룰 조회 실패");
      return json.data ?? [];
    },
  });

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleComponent, setRuleComponent] = useState<PricingRuleComponent>("SETTING");
  const [ruleScope, setRuleScope] = useState<PricingRuleScope>("ANY");
  const [ruleVendorPartyId, setRuleVendorPartyId] = useState("");
  const [ruleMinCost, setRuleMinCost] = useState("0");
  const [ruleMaxCost, setRuleMaxCost] = useState("");
  const [ruleMarkupValue, setRuleMarkupValue] = useState("0");
  const [rulePriority, setRulePriority] = useState("100");
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleNote, setRuleNote] = useState("");
  const [ruleDeleteId, setRuleDeleteId] = useState<string | null>(null);

  const [testComponent, setTestComponent] = useState<PricingRuleComponent>("SETTING");
  const [testScope, setTestScope] = useState<PricingRuleScope>("ANY");
  const [testVendorPartyId, setTestVendorPartyId] = useState("");
  const [testCostBasis, setTestCostBasis] = useState("0");
  const [testResult, setTestResult] = useState<{ picked_rule_id?: string | null; markup_krw?: number | null } | null>(null);

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleComponent("SETTING");
    setRuleScope("ANY");
    setRuleVendorPartyId("");
    setRuleMinCost("0");
    setRuleMaxCost("");
    setRuleMarkupValue("0");
    setRulePriority("100");
    setRuleIsActive(true);
    setRuleNote("");
  };

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const minCost = Number(ruleMinCost);
      const maxCost = ruleMaxCost.trim() === "" ? null : Number(ruleMaxCost);
      const markupValue = Number(ruleMarkupValue);
      const priority = Number(rulePriority);

      if (!Number.isFinite(minCost) || minCost < 0) throw new Error("최소 원가는 0 이상 숫자여야 합니다.");
      if (maxCost !== null && (!Number.isFinite(maxCost) || maxCost < minCost)) throw new Error("최대 원가는 최소 원가 이상이어야 합니다.");
      if (!Number.isFinite(markupValue) || markupValue < 0) throw new Error("마크업은 0 이상 숫자여야 합니다.");
      if (!Number.isInteger(priority)) throw new Error("우선순위는 정수여야 합니다.");

      const response = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: editingRuleId,
          component: ruleComponent,
          scope: ruleScope,
          vendor_party_id: ruleVendorPartyId || null,
          min_cost_krw: minCost,
          max_cost_krw: maxCost,
          markup_value_krw: markupValue,
          priority,
          is_active: ruleIsActive,
          note: ruleNote || null,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "저장 실패");
    },
    onSuccess: () => {
      toast.success("룰 저장 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_pricing_rules"] });
      resetRuleForm();
    },
    onError: (error) => {
      toast.error("저장 실패", {
        description: error instanceof Error ? error.message : "룰 저장 중 오류가 발생했습니다.",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/pricing-rules?rule_id=${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "삭제 실패");
    },
    onSuccess: () => {
      toast.success("룰 삭제 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_pricing_rules"] });
      setRuleDeleteId(null);
      if (editingRuleId === ruleDeleteId) resetRuleForm();
    },
    onError: (error) => {
      toast.error("삭제 실패", {
        description: error instanceof Error ? error.message : "룰 삭제 중 오류가 발생했습니다.",
      });
    },
  });

  const runRuleTestMutation = useMutation({
    mutationFn: async () => {
      const costBasis = Number(testCostBasis);
      if (!Number.isFinite(costBasis) || costBasis < 0) throw new Error("원가 기준은 0 이상 숫자여야 합니다.");

      const response = await fetch("/api/pricing-rule-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component: testComponent,
          scope: testScope,
          vendor_party_id: testVendorPartyId || null,
          cost_basis_krw: costBasis,
        }),
      });

      const json = (await response.json()) as {
        data?: { picked_rule_id?: string | null; markup_krw?: number | null };
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "룰 테스트 실패");

      const data = json.data;
      const row = (data ?? {}) as { picked_rule_id?: string | null; markup_krw?: number | null };
      setTestResult({
        picked_rule_id: row.picked_rule_id ?? null,
        markup_krw: row.markup_krw ?? null,
      });
    },
    onError: (error) => {
      toast.error("룰 테스트 실패", {
        description: error instanceof Error ? error.message : "룰 테스트 중 오류가 발생했습니다.",
      });
    },
  });

  const vendorChoices = useMemo(
    () => (vendorsQuery.data ?? []).map((vendor) => ({ value: vendor.vendor_party_id, label: vendor.vendor_name })),
    [vendorsQuery.data]
  );

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

      <Card>
        <CardHeader>
          <div>
            <div className="text-sm font-semibold">RULE 올림 단위 (확정 시 적용)</div>
            <div className="text-xs text-[var(--muted)]">확정 시점에만 적용됩니다.</div>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="space-y-1">
            <div className="text-xs text-[var(--muted)]">올림 단위 (원)</div>
            <Select
              value={displayRuleRoundingUnit}
              onChange={(event) => setRuleRoundingUnit(event.target.value)}
            >
              <option value="0">미적용</option>
              <option value="1000">1,000</option>
              <option value="5000">5,000</option>
              <option value="10000">10,000</option>
              <option value="50000">50,000</option>
            </Select>
          </label>

          <div className="text-xs text-[var(--muted-weak)] leading-relaxed">
            <p>확정 시점에만 적용됩니다.</p>
            <p>대상: RULE + (마스터 단가제 체크) + 총액 덮어쓰기 아님</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={onSaveRoundingUnit}
              disabled={!canSaveRoundingUnit || setRuleRoundingUnitMutation.isPending}
            >
              저장
            </Button>
            <div className="text-xs text-[var(--muted)]">
              현재 값: {Number.isFinite(currentRoundingUnit) ? currentRoundingUnit.toLocaleString() : "-"}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <div className="text-sm font-semibold">가격 룰(글로벌)</div>
            <div className="text-xs text-[var(--muted)]">물림/원석/패키지 구간별 마크업 룰 관리</div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
              <div className="text-xs font-semibold">룰 생성/수정</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">Component</div>
                  <Select value={ruleComponent} onChange={(e) => setRuleComponent(e.target.value as PricingRuleComponent)}>
                    {RULE_COMPONENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">Scope</div>
                  <Select value={ruleScope} onChange={(e) => setRuleScope(e.target.value as PricingRuleScope)}>
                    {RULE_SCOPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">Vendor (선택)</div>
                  <Select value={ruleVendorPartyId} onChange={(e) => setRuleVendorPartyId(e.target.value)}>
                    <option value="">전체 공장</option>
                    {vendorChoices.map((vendor) => (
                      <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">최소 원가</div>
                  <Input value={ruleMinCost} onChange={(e) => setRuleMinCost(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">최대 원가(옵션)</div>
                  <Input value={ruleMaxCost} onChange={(e) => setRuleMaxCost(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">마크업(원)</div>
                  <Input value={ruleMarkupValue} onChange={(e) => setRuleMarkupValue(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">우선순위</div>
                  <Input value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} />
                </label>
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">노트</div>
                  <Input value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 text-xs col-span-2">
                  <input type="checkbox" checked={ruleIsActive} onChange={(e) => setRuleIsActive(e.target.checked)} className="h-4 w-4" />
                  활성화
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending}>
                  {editingRuleId ? "수정 저장" : "룰 저장"}
                </Button>
                {editingRuleId ? (
                  <Button variant="secondary" onClick={resetRuleForm}>취소</Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3 min-w-0">
              <div className="text-xs font-semibold">룰 목록</div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-xs">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-1">Active</th>
                      <th className="text-left py-1">Component</th>
                      <th className="text-left py-1">Scope</th>
                      <th className="text-left py-1">Vendor</th>
                      <th className="text-left py-1">Range</th>
                      <th className="text-left py-1">Markup</th>
                      <th className="text-left py-1">Priority</th>
                      <th className="text-left py-1">Updated</th>
                      <th className="text-left py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pricingRulesQuery.data ?? []).map((rule) => {
                      const vendorName = vendorChoices.find((vendor) => vendor.value === rule.vendor_party_id)?.label ?? "전체";
                      const isDeleteArmed = ruleDeleteId === rule.rule_id;
                      return (
                        <tr key={rule.rule_id} className="border-t border-[var(--panel-border)]">
                          <td className="py-1">{rule.is_active ? "Y" : "N"}</td>
                          <td className="py-1">{rule.component}</td>
                          <td className="py-1">{rule.scope}</td>
                          <td className="py-1 truncate max-w-[120px]" title={vendorName}>{vendorName}</td>
                          <td className="py-1">{Number(rule.min_cost_krw).toLocaleString()} ~ {rule.max_cost_krw === null ? "∞" : Number(rule.max_cost_krw).toLocaleString()}</td>
                          <td className="py-1">+{Number(rule.markup_value_krw).toLocaleString()}</td>
                          <td className="py-1">{rule.priority}</td>
                          <td className="py-1">{rule.updated_at ? new Date(rule.updated_at).toLocaleString() : "-"}</td>
                          <td className="py-1">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingRuleId(rule.rule_id);
                                  setRuleComponent(rule.component);
                                  setRuleScope(rule.scope);
                                  setRuleVendorPartyId(rule.vendor_party_id ?? "");
                                  setRuleMinCost(String(rule.min_cost_krw));
                                  setRuleMaxCost(rule.max_cost_krw === null ? "" : String(rule.max_cost_krw));
                                  setRuleMarkupValue(String(rule.markup_value_krw));
                                  setRulePriority(String(rule.priority));
                                  setRuleIsActive(Boolean(rule.is_active));
                                  setRuleNote(rule.note ?? "");
                                }}
                              >
                                Edit
                              </Button>
                              {!isDeleteArmed ? (
                                <Button size="sm" variant="secondary" onClick={() => setRuleDeleteId(rule.rule_id)}>Delete</Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => deleteRuleMutation.mutate(rule.rule_id)}
                                  disabled={deleteRuleMutation.isPending}
                                  className="text-[var(--danger)]"
                                >
                                  Confirm
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-3">
            <div className="text-xs font-semibold">룰 테스트</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Select value={testComponent} onChange={(e) => setTestComponent(e.target.value as PricingRuleComponent)}>
                {RULE_COMPONENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Select value={testScope} onChange={(e) => setTestScope(e.target.value as PricingRuleScope)}>
                {RULE_SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Select value={testVendorPartyId} onChange={(e) => setTestVendorPartyId(e.target.value)}>
                <option value="">전체 공장</option>
                {vendorChoices.map((vendor) => (
                  <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                ))}
              </Select>
              <Input value={testCostBasis} onChange={(e) => setTestCostBasis(e.target.value)} placeholder="원가 기준" />
              <Button onClick={() => runRuleTestMutation.mutate()} disabled={runRuleTestMutation.isPending}>테스트 실행</Button>
            </div>
            <div className="text-xs text-[var(--muted)]">
              picked_rule_id: {testResult?.picked_rule_id ?? "-"} / markup_krw: {testResult?.markup_krw ?? "-"}
            </div>
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
                          <option value="uplus_print">U+ Webfax (인쇄 전송)</option>
                        </Select>
                        {faxProvider === "uplus_print" && (
                          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] leading-relaxed text-amber-900">
                            <p>PC에 U+ 간편팩스 2.0 설치 + 프린터 목록에 &#39;U+Webfax&#39;가 있어야 함</p>
                            <p>발주서 화면에서 인쇄 → 프린터 &#39;U+Webfax&#39; 선택 → U+ 팩스창에서 수신번호/제목 확인 후 전송</p>
                          </div>
                        )}
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
            <p className="mt-1">
              • <strong>U+ Webfax (인쇄 전송):</strong> 자동 API 전송이 아닌 인쇄 방식이며, 전송 후 공장발주 화면에서 전송완료처리를 눌러 상태를 확정합니다
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
