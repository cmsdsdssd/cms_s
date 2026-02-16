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
import { Factory, Phone } from "lucide-react";

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

const RULE_COMPONENT_OPTIONS: PricingRuleComponent[] = ["BASE_LABOR", "SETTING", "STONE", "PACKAGE"];
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

type PricingRuleComponent = "BASE_LABOR" | "SETTING" | "STONE" | "PACKAGE";
type PricingRuleScope = "ANY" | "SELF" | "PROVIDED" | "FACTORY";
type PricingRuleApplyUnit = "PER_PIECE" | "PER_STONE" | "PER_G";
type PricingRuleStoneRole = "CENTER" | "SUB1" | "SUB2" | "BEAD";

type BuyMarginProfileRow = {
  profile_id: string;
  profile_name: string;
  margin_center_krw: number;
  margin_sub1_krw: number;
  margin_sub2_krw: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

type PlatingMarkupRuleRow = {
  rule_id: string;
  plating_variant_id: string;
  effective_from: string;
  category_code: string | null;
  material_code: string | null;
  margin_fixed_krw: number;
  margin_per_g_krw: number;
  priority: number;
  is_active: boolean;
  note: string | null;
  updated_at?: string | null;
};

type PricingRuleRow = {
  rule_id: string;
  component: PricingRuleComponent;
  scope: PricingRuleScope;
  apply_unit: PricingRuleApplyUnit;
  stone_role: PricingRuleStoneRole | null;
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

const RULE_APPLY_UNIT_OPTIONS: PricingRuleApplyUnit[] = ["PER_PIECE", "PER_STONE", "PER_G"];
const RULE_STONE_ROLE_OPTIONS: PricingRuleStoneRole[] = ["CENTER", "SUB1", "SUB2", "BEAD"];
const PLATING_FILTER_ALL = "__ALL__";

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
  const [isMarketAdvancedOpen, setIsMarketAdvancedOpen] = useState(false);

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
      toast.error("한국 실버 해리는 0 ~ 3.0 범위여야 합니다.");
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

  const buyProfilesQuery = useQuery({
    queryKey: ["cms_buy_margin_profiles"],
    queryFn: async (): Promise<BuyMarginProfileRow[]> => {
      const response = await fetch("/api/buy-margin-profiles", { cache: "no-store" });
      const json = (await response.json()) as { data?: BuyMarginProfileRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "BUY 프로파일 조회 실패");
      return json.data ?? [];
    },
  });

  const platingMarkupRulesQuery = useQuery({
    queryKey: ["cms_plating_markup_rules"],
    queryFn: async (): Promise<PlatingMarkupRuleRow[]> => {
      const response = await fetch("/api/plating-markup-rules", { cache: "no-store" });
      const json = (await response.json()) as { data?: PlatingMarkupRuleRow[]; error?: string };
      if (!response.ok) throw new Error(json.error ?? "도금 룰 조회 실패");
      return json.data ?? [];
    },
  });

  const platingOptionsQuery = useQuery({
    queryKey: ["cms_plating_options_for_settings"],
    queryFn: async (): Promise<Array<{ plating_variant_id: string; display_name: string }>> => {
      const response = await fetch("/api/plating-options", { cache: "no-store" });
      const json = (await response.json()) as {
        data?: Array<{ plating_variant_id?: string; display_name?: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "도금 옵션 조회 실패");
      return (json.data ?? [])
        .map((row) => ({
          plating_variant_id: String(row.plating_variant_id ?? "").trim(),
          display_name: String(row.display_name ?? "").trim() || String(row.plating_variant_id ?? "").trim(),
        }))
        .filter((row) => row.plating_variant_id);
    },
  });

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleComponent, setRuleComponent] = useState<PricingRuleComponent>("BASE_LABOR");
  const [ruleScope, setRuleScope] = useState<PricingRuleScope>("ANY");
  const [ruleApplyUnit, setRuleApplyUnit] = useState<PricingRuleApplyUnit>("PER_PIECE");
  const [ruleStoneRole, setRuleStoneRole] = useState<PricingRuleStoneRole | "">("");
  const [ruleVendorPartyId, setRuleVendorPartyId] = useState("");
  const [ruleMinCost, setRuleMinCost] = useState("0");
  const [ruleMaxCost, setRuleMaxCost] = useState("");
  const [ruleMarkupValue, setRuleMarkupValue] = useState("0");
  const [rulePriority, setRulePriority] = useState("100");
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleNote, setRuleNote] = useState("");
  const [ruleDeleteId, setRuleDeleteId] = useState<string | null>(null);

  const [testComponent, setTestComponent] = useState<PricingRuleComponent>("BASE_LABOR");
  const [testScope, setTestScope] = useState<PricingRuleScope>("ANY");
  const [testApplyUnit, setTestApplyUnit] = useState<PricingRuleApplyUnit>("PER_PIECE");
  const [testStoneRole, setTestStoneRole] = useState<PricingRuleStoneRole | "">("");
  const [testVendorPartyId, setTestVendorPartyId] = useState("");
  const [testCostBasis, setTestCostBasis] = useState("0");
  const [testResult, setTestResult] = useState<{ picked_rule_id?: string | null; markup_krw?: number | null } | null>(null);
  const [isGlobalRulePanelOpen, setIsGlobalRulePanelOpen] = useState(false);
  const [bulkDelta, setBulkDelta] = useState("0");

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileCenterMargin, setProfileCenterMargin] = useState("0");
  const [profileSub1Margin, setProfileSub1Margin] = useState("0");
  const [profileSub2Margin, setProfileSub2Margin] = useState("0");
  const [profileIsActive, setProfileIsActive] = useState(true);
  const [profileNote, setProfileNote] = useState("");
  const [profileDelta, setProfileDelta] = useState("0");

  const [editingPlatingRuleId, setEditingPlatingRuleId] = useState<string | null>(null);
  const [platingVariantId, setPlatingVariantId] = useState("");
  const [platingEffectiveFrom, setPlatingEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [platingCategoryCode, setPlatingCategoryCode] = useState("");
  const [platingMaterialCode, setPlatingMaterialCode] = useState("");
  const [platingMarginFixed, setPlatingMarginFixed] = useState("0");
  const [platingMarginPerG, setPlatingMarginPerG] = useState("0");
  const [platingPriority, setPlatingPriority] = useState("100");
  const [platingIsActive, setPlatingIsActive] = useState(true);
  const [platingNote, setPlatingNote] = useState("");
  const [platingFilterVariantId, setPlatingFilterVariantId] = useState(PLATING_FILTER_ALL);

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleComponent("BASE_LABOR");
    setRuleScope("ANY");
    setRuleApplyUnit("PER_PIECE");
    setRuleStoneRole("");
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
      const shouldUseStoneRole = ruleComponent === "STONE" && ruleApplyUnit === "PER_STONE";

      if (!Number.isFinite(minCost) || minCost < 0) throw new Error("최소 원가는 0 이상 숫자여야 합니다.");
      if (maxCost !== null && (!Number.isFinite(maxCost) || maxCost < minCost)) throw new Error("최대 원가는 최소 원가 이상이어야 합니다.");
      if (!Number.isFinite(markupValue) || markupValue < 0) throw new Error("마크업은 0 이상 숫자여야 합니다.");
      if (!Number.isInteger(priority)) throw new Error("우선순위는 정수여야 합니다.");
      if (ruleComponent === "BASE_LABOR" && ruleApplyUnit !== "PER_PIECE") {
        throw new Error("BASE_LABOR는 PER_PIECE만 허용됩니다.");
      }
      if (shouldUseStoneRole && !ruleStoneRole) {
        throw new Error("STONE + PER_STONE은 StoneRole이 필요합니다.");
      }

      const response = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: editingRuleId,
          component: ruleComponent,
          scope: ruleScope,
          apply_unit: ruleApplyUnit,
          stone_role: shouldUseStoneRole ? ruleStoneRole : null,
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
          apply_unit: testApplyUnit,
          stone_role: testComponent === "STONE" && testApplyUnit === "PER_STONE" ? testStoneRole || null : null,
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

  const filteredPlatingRules = useMemo(
    () =>
      (platingMarkupRulesQuery.data ?? []).filter(
        (row) => platingFilterVariantId === PLATING_FILTER_ALL || row.plating_variant_id === platingFilterVariantId
      ),
    [platingFilterVariantId, platingMarkupRulesQuery.data]
  );

  const canEditRuleStoneRole = ruleComponent === "STONE" && ruleApplyUnit === "PER_STONE";
  const canEditTestStoneRole = testComponent === "STONE" && testApplyUnit === "PER_STONE";

  const applyRuleBulkDeltaMutation = useMutation({
    mutationFn: async () => {
      const delta = Number(bulkDelta);
      if (!Number.isFinite(delta) || delta === 0) throw new Error("일괄 Δ는 0이 아닌 숫자여야 합니다.");

      const targetRules = (pricingRulesQuery.data ?? []).filter((rule) => {
        if (rule.component !== ruleComponent) return false;
        if (rule.scope !== ruleScope) return false;
        if ((rule.vendor_party_id ?? "") !== (ruleVendorPartyId || "")) return false;
        if (rule.apply_unit !== ruleApplyUnit) return false;
        if ((rule.stone_role ?? "") !== (canEditRuleStoneRole ? ruleStoneRole : "")) return false;
        return true;
      });

      if (targetRules.length === 0) {
        throw new Error("현재 필터에 해당하는 룰이 없습니다.");
      }

      for (const rule of targetRules) {
        const response = await fetch("/api/pricing-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rule_id: rule.rule_id,
            component: rule.component,
            scope: rule.scope,
            apply_unit: rule.apply_unit,
            stone_role: rule.stone_role,
            vendor_party_id: rule.vendor_party_id,
            min_cost_krw: rule.min_cost_krw,
            max_cost_krw: rule.max_cost_krw,
            markup_value_krw: Math.max(0, Number(rule.markup_value_krw) + delta),
            priority: rule.priority,
            is_active: rule.is_active,
            note: rule.note,
          }),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(json.error ?? "룰 일괄 조정 실패");
      }
    },
    onSuccess: () => {
      toast.success("룰 일괄 Δ 적용 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_pricing_rules"] });
    },
    onError: (error) => {
      toast.error("룰 일괄 Δ 실패", {
        description: error instanceof Error ? error.message : "룰 일괄 조정 중 오류가 발생했습니다.",
      });
    },
  });

  const resetProfileForm = () => {
    setEditingProfileId(null);
    setProfileName("");
    setProfileCenterMargin("0");
    setProfileSub1Margin("0");
    setProfileSub2Margin("0");
    setProfileIsActive(true);
    setProfileNote("");
  };

  const saveBuyProfileMutation = useMutation({
    mutationFn: async () => {
      const center = Number(profileCenterMargin);
      const sub1 = Number(profileSub1Margin);
      const sub2 = Number(profileSub2Margin);
      if (!profileName.trim()) throw new Error("프로파일명을 입력해 주세요.");
      if (!Number.isFinite(center) || center < 0) throw new Error("센터 마진은 0 이상 숫자여야 합니다.");
      if (!Number.isFinite(sub1) || sub1 < 0) throw new Error("보조1 마진은 0 이상 숫자여야 합니다.");
      if (!Number.isFinite(sub2) || sub2 < 0) throw new Error("보조2 마진은 0 이상 숫자여야 합니다.");

      const response = await fetch("/api/buy-margin-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: editingProfileId,
          profile_name: profileName.trim(),
          margin_center_krw: center,
          margin_sub1_krw: sub1,
          margin_sub2_krw: sub2,
          is_active: profileIsActive,
          note: profileNote.trim() || null,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "BUY 프로파일 저장 실패");
    },
    onSuccess: () => {
      toast.success("BUY 프로파일 저장 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_buy_margin_profiles"] });
      resetProfileForm();
    },
    onError: (error) => {
      toast.error("BUY 프로파일 저장 실패", {
        description: error instanceof Error ? error.message : "BUY 프로파일 저장 중 오류가 발생했습니다.",
      });
    },
  });

  const deleteBuyProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await fetch(`/api/buy-margin-profiles?profile_id=${encodeURIComponent(profileId)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "BUY 프로파일 삭제 실패");
    },
    onSuccess: () => {
      toast.success("BUY 프로파일 삭제 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_buy_margin_profiles"] });
      resetProfileForm();
    },
  });

  const applyProfileDeltaMutation = useMutation({
    mutationFn: async () => {
      const delta = Number(profileDelta);
      if (!Number.isFinite(delta) || delta === 0) throw new Error("일괄 Δ는 0이 아닌 숫자여야 합니다.");
      if (!editingProfileId) throw new Error("수정 중인 프로파일이 없습니다.");

      const center = Math.max(0, Number(profileCenterMargin) + delta);
      const sub1 = Math.max(0, Number(profileSub1Margin) + delta);
      const sub2 = Math.max(0, Number(profileSub2Margin) + delta);

      setProfileCenterMargin(String(center));
      setProfileSub1Margin(String(sub1));
      setProfileSub2Margin(String(sub2));
    },
    onError: (error) => {
      toast.error("프로파일 일괄 Δ 실패", {
        description: error instanceof Error ? error.message : "프로파일 조정 중 오류가 발생했습니다.",
      });
    },
  });

  const resetPlatingRuleForm = () => {
    setEditingPlatingRuleId(null);
    setPlatingVariantId("");
    setPlatingEffectiveFrom(new Date().toISOString().slice(0, 10));
    setPlatingCategoryCode("");
    setPlatingMaterialCode("");
    setPlatingMarginFixed("0");
    setPlatingMarginPerG("0");
    setPlatingPriority("100");
    setPlatingIsActive(true);
    setPlatingNote("");
  };

  const savePlatingRuleMutation = useMutation({
    mutationFn: async () => {
      const marginFixed = Number(platingMarginFixed);
      const marginPerG = Number(platingMarginPerG);
      const priority = Number(platingPriority);
      if (!platingVariantId) throw new Error("도금 variant를 선택해 주세요.");
      if (!Number.isFinite(marginFixed) || marginFixed < 0) throw new Error("고정 마진은 0 이상이어야 합니다.");
      if (!Number.isFinite(marginPerG) || marginPerG < 0) throw new Error("g당 마진은 0 이상이어야 합니다.");
      if (!Number.isInteger(priority)) throw new Error("우선순위는 정수여야 합니다.");

      const response = await fetch("/api/plating-markup-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: editingPlatingRuleId,
          plating_variant_id: platingVariantId,
          effective_from: platingEffectiveFrom,
          category_code: platingCategoryCode.trim() || null,
          material_code: platingMaterialCode.trim() || null,
          margin_fixed_krw: marginFixed,
          margin_per_g_krw: marginPerG,
          priority,
          is_active: platingIsActive,
          note: platingNote.trim() || null,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "도금 룰 저장 실패");
    },
    onSuccess: () => {
      toast.success("도금 룰 저장 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_plating_markup_rules"] });
      resetPlatingRuleForm();
    },
    onError: (error) => {
      toast.error("도금 룰 저장 실패", {
        description: error instanceof Error ? error.message : "도금 룰 저장 중 오류가 발생했습니다.",
      });
    },
  });

  const deletePlatingRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/plating-markup-rules?rule_id=${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "도금 룰 삭제 실패");
    },
    onSuccess: () => {
      toast.success("도금 룰 삭제 완료");
      queryClient.invalidateQueries({ queryKey: ["cms_plating_markup_rules"] });
      resetPlatingRuleForm();
    },
  });

  return (
    // [변경됨] space-y-6 대신 Grid 시스템 적용 (큰 화면에서 2열 배치)
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
      {/* 왼쪽 컬럼: 시세 파이프라인 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">시세 파이프라인 설정</div>
              <div className="text-xs text-[var(--muted)]">한국 실버 해리 우선 설정</div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setIsMarketAdvancedOpen((prev) => !prev)}
            >
              {isMarketAdvancedOpen ? "나머지 접기" : "나머지 펼치기"}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-[var(--muted)]">한국 실버 해리 (예: 1.2)</div>
              <Input value={displaySilverKrFactor} onChange={(e) => setSilverKrFactor(e.target.value)} />
            </label>

            {isMarketAdvancedOpen ? (
              <>
                <label className="space-y-1">
                  <div className="text-sm text-[var(--muted)]">FX 마크업 (예: 1.03)</div>
                  <Input value={displayFxMarkup} onChange={(e) => setFxMarkup(e.target.value)} />
                </label>

                <label className="space-y-1">
                  <div className="text-sm text-[var(--muted)]">중국 CS 보정계수 (예: 1.2)</div>
                  <Input value={displayCsFactor} onChange={(e) => setCsFactor(e.target.value)} />
                </label>
              </>
            ) : null}
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

          {isMarketAdvancedOpen ? (
            <div className="text-xs text-[var(--muted-weak)] leading-relaxed pt-2 border-t border-[var(--border)] mt-2">
              <p className="mb-1">
                • <strong>SILVER_CN_KRW_PER_G</strong>: (중국 은시세 × 환율 × FX 마크업) × CS 보정계수
              </p>
              <p className="mb-1">
                • <strong>한국 실버 해리</strong>: 국내 은시세 파이프라인 및 출고확정 계산용
              </p>
              <p>
                • 출고확정 시 현재 설정된 시세와 보정계수가 주문 라인에 스냅샷으로 저장됩니다.
              </p>
            </div>
          ) : null}
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

      <Card className="lg:col-span-2 order-last lg:order-last">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">가격 룰(글로벌)</div>
              <div className="text-xs text-[var(--muted)]">기본공임/세팅/알공임/패키지 마크업 룰 관리</div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setIsGlobalRulePanelOpen((prev) => !prev)}
            >
              {isGlobalRulePanelOpen ? "접기" : "펼치기"}
            </Button>
          </div>
        </CardHeader>
        {isGlobalRulePanelOpen ? (
          <CardBody className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
              <div className="text-xs font-semibold">룰 생성/수정</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">Component</div>
                  <Select
                    value={ruleComponent}
                    onChange={(e) => {
                      const nextComponent = e.target.value as PricingRuleComponent;
                      setRuleComponent(nextComponent);
                      if (nextComponent === "BASE_LABOR") {
                        setRuleApplyUnit("PER_PIECE");
                        setRuleStoneRole("");
                      }
                    }}
                  >
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
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">ApplyUnit</div>
                  <Select
                    value={ruleApplyUnit}
                    onChange={(e) => {
                      const nextUnit = e.target.value as PricingRuleApplyUnit;
                      setRuleApplyUnit(nextUnit);
                      if (nextUnit !== "PER_STONE") setRuleStoneRole("");
                    }}
                  >
                    {RULE_APPLY_UNIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">StoneRole</div>
                  <Select
                    value={ruleStoneRole}
                    onChange={(e) => setRuleStoneRole(e.target.value as PricingRuleStoneRole | "")}
                    disabled={!canEditRuleStoneRole}
                  >
                    <option value="">-</option>
                    {RULE_STONE_ROLE_OPTIONS.map((option) => (
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
              <div className="flex items-center gap-2 border-t border-[var(--panel-border)] pt-3">
                <Input value={bulkDelta} onChange={(e) => setBulkDelta(e.target.value)} placeholder="일괄 Δ" />
                <Button
                  variant="secondary"
                  onClick={() => applyRuleBulkDeltaMutation.mutate()}
                  disabled={applyRuleBulkDeltaMutation.isPending}
                >
                  현재 필터에 일괄 적용
                </Button>
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
                      <th className="text-left py-1">ApplyUnit</th>
                      <th className="text-left py-1">StoneRole</th>
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
                          <td className="py-1">{rule.apply_unit}</td>
                          <td className="py-1">{rule.stone_role ?? "-"}</td>
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
                                  setRuleApplyUnit(rule.apply_unit);
                                  setRuleStoneRole(rule.stone_role ?? "");
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
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              <Select
                value={testComponent}
                onChange={(e) => {
                  const nextComponent = e.target.value as PricingRuleComponent;
                  setTestComponent(nextComponent);
                  if (nextComponent === "BASE_LABOR") {
                    setTestApplyUnit("PER_PIECE");
                    setTestStoneRole("");
                  }
                }}
              >
                {RULE_COMPONENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Select value={testScope} onChange={(e) => setTestScope(e.target.value as PricingRuleScope)}>
                {RULE_SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Select
                value={testApplyUnit}
                onChange={(e) => {
                  const nextUnit = e.target.value as PricingRuleApplyUnit;
                  setTestApplyUnit(nextUnit);
                  if (nextUnit !== "PER_STONE") setTestStoneRole("");
                }}
              >
                {RULE_APPLY_UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
              <Select
                value={testStoneRole}
                onChange={(e) => setTestStoneRole(e.target.value as PricingRuleStoneRole | "")}
                disabled={!canEditTestStoneRole}
              >
                <option value="">StoneRole(-)</option>
                {RULE_STONE_ROLE_OPTIONS.map((option) => (
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
        ) : null}
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <div className="text-sm font-semibold">BUY 마진 프로파일</div>
            <div className="text-xs text-[var(--muted)]">자입(SELF) 알공임 센터/보조 마진 프로파일</div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
              <div className="text-xs font-semibold">프로파일 생성/수정</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">프로파일명</div>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">센터 마진</div>
                  <Input value={profileCenterMargin} onChange={(e) => setProfileCenterMargin(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">보조1 마진</div>
                  <Input value={profileSub1Margin} onChange={(e) => setProfileSub1Margin(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">보조2 마진</div>
                  <Input value={profileSub2Margin} onChange={(e) => setProfileSub2Margin(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">일괄 Δ(센터/보조1/보조2)</div>
                  <div className="flex items-center gap-2">
                    <Input value={profileDelta} onChange={(e) => setProfileDelta(e.target.value)} />
                    <Button
                      variant="secondary"
                      onClick={() => applyProfileDeltaMutation.mutate()}
                      disabled={applyProfileDeltaMutation.isPending}
                    >
                      적용
                    </Button>
                  </div>
                </label>
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">노트</div>
                  <Input value={profileNote} onChange={(e) => setProfileNote(e.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 text-xs col-span-2">
                  <input type="checkbox" checked={profileIsActive} onChange={(e) => setProfileIsActive(e.target.checked)} className="h-4 w-4" />
                  활성화
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => saveBuyProfileMutation.mutate()} disabled={saveBuyProfileMutation.isPending}>
                  {editingProfileId ? "수정 저장" : "프로파일 저장"}
                </Button>
                {editingProfileId ? <Button variant="secondary" onClick={resetProfileForm}>취소</Button> : null}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3 min-w-0">
              <div className="text-xs font-semibold">프로파일 목록</div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-xs">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-1">Active</th>
                      <th className="text-left py-1">프로파일명</th>
                      <th className="text-left py-1">센터</th>
                      <th className="text-left py-1">보조1</th>
                      <th className="text-left py-1">보조2</th>
                      <th className="text-left py-1">Updated</th>
                      <th className="text-left py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(buyProfilesQuery.data ?? []).map((profile) => (
                      <tr key={profile.profile_id} className="border-t border-[var(--panel-border)]">
                        <td className="py-1">{profile.is_active ? "Y" : "N"}</td>
                        <td className="py-1">{profile.profile_name}</td>
                        <td className="py-1">+{Number(profile.margin_center_krw).toLocaleString()}</td>
                        <td className="py-1">+{Number(profile.margin_sub1_krw).toLocaleString()}</td>
                        <td className="py-1">+{Number(profile.margin_sub2_krw).toLocaleString()}</td>
                        <td className="py-1">{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : "-"}</td>
                        <td className="py-1">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingProfileId(profile.profile_id);
                                setProfileName(profile.profile_name);
                                setProfileCenterMargin(String(profile.margin_center_krw));
                                setProfileSub1Margin(String(profile.margin_sub1_krw));
                                setProfileSub2Margin(String(profile.margin_sub2_krw));
                                setProfileIsActive(Boolean(profile.is_active));
                                setProfileNote(profile.note ?? "");
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => deleteBuyProfileMutation.mutate(profile.profile_id)}
                              disabled={deleteBuyProfileMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <div className="text-sm font-semibold">도금 마진 룰</div>
            <div className="text-xs text-[var(--muted)]">Variant별 fixed/per-g 마진 룰</div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
              <div className="text-xs font-semibold">도금 룰 생성/수정</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">Plating Variant</div>
                  <Select value={platingVariantId} onChange={(e) => setPlatingVariantId(e.target.value)}>
                    <option value="">선택</option>
                    {(platingOptionsQuery.data ?? []).map((option) => (
                      <option key={option.plating_variant_id} value={option.plating_variant_id}>{option.display_name}</option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">effective_from</div>
                  <Input type="date" value={platingEffectiveFrom} onChange={(e) => setPlatingEffectiveFrom(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">priority</div>
                  <Input value={platingPriority} onChange={(e) => setPlatingPriority(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">margin_fixed_krw</div>
                  <Input value={platingMarginFixed} onChange={(e) => setPlatingMarginFixed(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">margin_per_g_krw</div>
                  <Input value={platingMarginPerG} onChange={(e) => setPlatingMarginPerG(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">category_code (옵션)</div>
                  <Input value={platingCategoryCode} onChange={(e) => setPlatingCategoryCode(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-[var(--muted)]">material_code (옵션)</div>
                  <Input value={platingMaterialCode} onChange={(e) => setPlatingMaterialCode(e.target.value)} />
                </label>
                <label className="space-y-1 col-span-2">
                  <div className="text-xs text-[var(--muted)]">노트</div>
                  <Input value={platingNote} onChange={(e) => setPlatingNote(e.target.value)} />
                </label>
                <label className="inline-flex items-center gap-2 text-xs col-span-2">
                  <input type="checkbox" checked={platingIsActive} onChange={(e) => setPlatingIsActive(e.target.checked)} className="h-4 w-4" />
                  활성화
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => savePlatingRuleMutation.mutate()} disabled={savePlatingRuleMutation.isPending}>
                  {editingPlatingRuleId ? "수정 저장" : "룰 저장"}
                </Button>
                {editingPlatingRuleId ? <Button variant="secondary" onClick={resetPlatingRuleForm}>취소</Button> : null}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">도금 룰 목록</div>
                <Select value={platingFilterVariantId} onChange={(e) => setPlatingFilterVariantId(e.target.value)} className="w-[280px]">
                  <option value={PLATING_FILTER_ALL}>전체 variant</option>
                  {(platingOptionsQuery.data ?? []).map((option) => (
                    <option key={option.plating_variant_id} value={option.plating_variant_id}>{option.display_name}</option>
                  ))}
                </Select>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[920px] w-full text-xs">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      <th className="text-left py-1">Active</th>
                      <th className="text-left py-1">Variant</th>
                      <th className="text-left py-1">Date</th>
                      <th className="text-left py-1">Fixed</th>
                      <th className="text-left py-1">Per-g</th>
                      <th className="text-left py-1">Category</th>
                      <th className="text-left py-1">Material</th>
                      <th className="text-left py-1">Priority</th>
                      <th className="text-left py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlatingRules.map((rule) => (
                      <tr key={rule.rule_id} className="border-t border-[var(--panel-border)]">
                        <td className="py-1">{rule.is_active ? "Y" : "N"}</td>
                        <td className="py-1">{(platingOptionsQuery.data ?? []).find((option) => option.plating_variant_id === rule.plating_variant_id)?.display_name ?? rule.plating_variant_id}</td>
                        <td className="py-1">{rule.effective_from}</td>
                        <td className="py-1">+{Number(rule.margin_fixed_krw).toLocaleString()}</td>
                        <td className="py-1">+{Number(rule.margin_per_g_krw).toLocaleString()}</td>
                        <td className="py-1">{rule.category_code ?? "-"}</td>
                        <td className="py-1">{rule.material_code ?? "-"}</td>
                        <td className="py-1">{rule.priority}</td>
                        <td className="py-1">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingPlatingRuleId(rule.rule_id);
                                setPlatingVariantId(rule.plating_variant_id);
                                setPlatingEffectiveFrom(rule.effective_from);
                                setPlatingCategoryCode(rule.category_code ?? "");
                                setPlatingMaterialCode(rule.material_code ?? "");
                                setPlatingMarginFixed(String(rule.margin_fixed_krw));
                                setPlatingMarginPerG(String(rule.margin_per_g_krw));
                                setPlatingPriority(String(rule.priority));
                                setPlatingIsActive(Boolean(rule.is_active));
                                setPlatingNote(rule.note ?? "");
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => deletePlatingRuleMutation.mutate(rule.rule_id)}
                              disabled={deletePlatingRuleMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {vendorsQuery.data?.map((vendor) => {
                const edit = editingConfigs[vendor.vendor_party_id];
                const faxNumber = edit?.fax_number ?? vendor.fax_number ?? "";
                const faxProvider = edit?.fax_provider ?? vendor.fax_provider ?? "mock";
                const hasChanges = edit !== undefined;

                return (
                  <div
                    key={vendor.vendor_party_id}
                    className={`p-2 rounded-lg border transition-all ${
                      hasChanges 
                        ? "border-[var(--primary)] bg-[var(--primary)]/5" 
                        : "border-[var(--panel-border)] bg-[var(--panel)]"
                    }`}
                  >
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[560px] grid-cols-[140px_minmax(0,1fr)_96px_60px] items-center gap-1.5">
                        <span className="truncate text-sm font-medium" title={vendor.vendor_name}>{vendor.vendor_name}</span>
                        <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-[var(--muted)]" />
                        <Input
                          value={faxNumber}
                          onChange={(e) => setEditingConfig(vendor.vendor_party_id, "fax_number", e.target.value)}
                          placeholder="02-1234-5678"
                          className="h-7 py-0 text-xs"
                        />
                        </div>
                        <Select
                          value={faxProvider}
                          onChange={(e) => setEditingConfig(vendor.vendor_party_id, "fax_provider", e.target.value)}
                          className="h-7 w-[96px] min-w-[96px] px-2 pr-6 py-0 text-xs leading-5"
                        >
                          <option value="mock">mock</option>
                          <option value="twilio">twilio</option>
                          <option value="sendpulse">sendpulse</option>
                          <option value="custom">custom</option>
                          <option value="apiplex">apiplex</option>
                          <option value="uplus_print">uplus</option>
                        </Select>
                        <Button
                          size="sm"
                          variant={hasChanges ? "primary" : "secondary"}
                          className="h-7 px-2 text-xs"
                          onClick={() => handleSaveFaxConfig(vendor)}
                          disabled={!hasChanges || updateFaxConfigMutation.isPending}
                        >
                          저장
                        </Button>
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
