"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CONTRACTS } from "@/lib/contracts";
import { getSchemaClient } from "@/lib/supabase/client";
import { useRpcMutation } from "@/hooks/use-rpc-mutation";
import { cn } from "@/lib/utils";
import { buildMaterialFactorMap, type MaterialCode } from "@/lib/material-factors";
import {
  applyVendorImmediateSettleTag,
  hasVendorImmediateSettleTag,
  stripVendorImmediateSettleTag,
} from "@/lib/vendor-immediate-settle";
import {
  applyVendorNoFactoryReceiptTag,
  hasVendorNoFactoryReceiptTag,
  stripVendorNoFactoryReceiptTag,
} from "@/lib/vendor-no-factory-receipt";
import { Factory, Phone, Settings, DollarSign, TrendingUp } from "lucide-react";

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
  phone: string | null;
  region: string | null;
  address: string | null;
  is_active: boolean;
  note: string | null;
  fax_number: string | null;
  fax_provider: 'mock' | 'twilio' | 'sendpulse' | 'custom' | 'apiplex' | 'uplus_print';
  no_factory_receipt_vendor: boolean;
};

type MaterialFactorConfigRow = {
  material_code: MaterialCode;
  purity_rate: number;
  material_adjust_factor: number;
  price_basis: "GOLD" | "SILVER" | "NONE";
  updated_at?: string | null;
  note?: string | null;
};

const MATERIAL_FACTOR_CODES: MaterialCode[] = ["14", "18", "24", "925", "999", "00"];
const PRICE_BASIS_OPTIONS: Array<"GOLD" | "SILVER" | "NONE"> = ["GOLD", "SILVER", "NONE"];

const FAX_PROVIDERS = ['mock', 'twilio', 'sendpulse', 'custom', 'apiplex', 'uplus_print'] as const;
type FaxProvider = typeof FAX_PROVIDERS[number];

function toFaxProvider(value: string | null | undefined): FaxProvider {
  return FAX_PROVIDERS.includes(value as FaxProvider) ? (value as FaxProvider) : "mock";
}

type VendorFaxConfigRow = {
  party_id: string;
  name: string;
  phone: string | null;
  region: string | null;
  address: string | null;
  is_active: boolean | null;
  note: string | null;
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

const PLATING_FILTER_ALL = "__ALL__";

type GlobalRuleTab = "BASE_FACTORY" | "STONE_FACTORY" | "BUY_SELF" | "PLATING_GLOBAL";

const GLOBAL_RULE_TAB_LABEL: Record<GlobalRuleTab, string> = {
  BASE_FACTORY: "기본공임",
  STONE_FACTORY: "알공임(공입)",
  BUY_SELF: "BUY마진(자입)",
  PLATING_GLOBAL: "도금 글로벌",
};

const GLOBAL_RULE_TAB_HELP: Record<GlobalRuleTab, string> = {
  BASE_FACTORY: "기본공임 원가 구간별 가산 마진",
  STONE_FACTORY: "공입 알공임 원가 구간별 가산 마진",
  BUY_SELF: "자입 알공임 원가 구간별 가산 마진",
  PLATING_GLOBAL: "도금 원가 구간별 가산 마진",
};

const MAX_RULE_KRW = 500000;
const MANWON_OPTIONS = Array.from({ length: 51 }, (_, index) => index * 10000);
const HUNDRED_OPTIONS = Array.from({ length: 100 }, (_, index) => index * 100);

const GLOBAL_RULE_MAPPING: Record<GlobalRuleTab, { component: PricingRuleComponent; scope: PricingRuleScope; apply_unit: PricingRuleApplyUnit; stone_role: PricingRuleStoneRole | null }> = {
  BASE_FACTORY: { component: "BASE_LABOR", scope: "FACTORY", apply_unit: "PER_PIECE", stone_role: null },
  STONE_FACTORY: { component: "STONE", scope: "FACTORY", apply_unit: "PER_PIECE", stone_role: null },
  BUY_SELF: { component: "STONE", scope: "SELF", apply_unit: "PER_PIECE", stone_role: null },
  PLATING_GLOBAL: { component: "SETTING", scope: "FACTORY", apply_unit: "PER_PIECE", stone_role: null },
};

const GLOBAL_RULE_TABS: GlobalRuleTab[] = ["BASE_FACTORY", "STONE_FACTORY", "BUY_SELF", "PLATING_GLOBAL"];

function tabFromRule(rule: PricingRuleRow): GlobalRuleTab {
  if (rule.component === "BASE_LABOR") return "BASE_FACTORY";
  if (rule.component === "STONE" && rule.scope === "SELF") return "BUY_SELF";
  if (rule.component === "STONE") return "STONE_FACTORY";
  if (rule.component === "SETTING") return "PLATING_GLOBAL";
  return "BASE_FACTORY";
}

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
  const [materialFactorEdits, setMaterialFactorEdits] = useState<
    Partial<Record<MaterialCode, { purity_rate: string; material_adjust_factor: string; price_basis: "GOLD" | "SILVER" | "NONE" }>>
  >({});
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

  const materialFactorsQuery = useQuery({
    queryKey: ["cms_material_factor_config"],
    queryFn: async (): Promise<MaterialFactorConfigRow[]> => {
      if (!sb) throw new Error("Supabase env is missing");
      const { data, error } = await sb.rpc(CONTRACTS.functions.materialFactorConfigList as never, {} as never);
      if (error) throw error;
      const dataRows = (data ?? []) as MaterialFactorConfigRow[];
      const map = buildMaterialFactorMap(dataRows);
      return MATERIAL_FACTOR_CODES.map((code) => ({
        material_code: code,
        purity_rate: Number(map[code]?.purity_rate ?? 0),
        material_adjust_factor: Number(map[code]?.material_adjust_factor ?? 1),
        price_basis: (map[code]?.price_basis ??
          (code === "00" ? "NONE" : code === "925" || code === "999" ? "SILVER" : "GOLD")) as "GOLD" | "SILVER" | "NONE",
        updated_at: dataRows.find((row) => row.material_code === code)?.updated_at ?? null,
        note: dataRows.find((row) => row.material_code === code)?.note ?? null,
      }));
    },
  });

  const upsertMaterialFactors = useRpcMutation<{ ok?: boolean }>({
    fn: CONTRACTS.functions.materialFactorConfigUpsert,
    successMessage: "소재 함량/보정 저장 완료",
    onSuccess: () => {
      materialFactorsQuery.refetch();
      setMaterialFactorEdits({});
    },
  });

  const defaultFactorMap = buildMaterialFactorMap(null);
  const factorRows: MaterialFactorConfigRow[] = materialFactorsQuery.data ?? MATERIAL_FACTOR_CODES.map((code) => ({
    ...defaultFactorMap[code],
    price_basis: (defaultFactorMap[code]?.price_basis ??
      (code === "00" ? "NONE" : code === "925" || code === "999" ? "SILVER" : "GOLD")) as "GOLD" | "SILVER" | "NONE",
    updated_at: null,
    note: null,
  }));
  const materialOrder = new Map(MATERIAL_FACTOR_CODES.map((code, index) => [code, index]));
  const orderedFactorRows = [...factorRows].sort((a, b) => {
    const aOrder = materialOrder.get(a.material_code) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = materialOrder.get(b.material_code) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.material_code).localeCompare(String(b.material_code));
  });
  const goldRows = orderedFactorRows.filter((row) => row.price_basis === "GOLD");
  const silverRows = orderedFactorRows.filter((row) => row.price_basis === "SILVER");
  const otherRows = orderedFactorRows.filter((row) => row.price_basis === "NONE");
  const getFactorInputValue = (
    code: MaterialCode,
    field: "purity_rate" | "material_adjust_factor",
    fallback: number
  ) => {
    const edited = materialFactorEdits[code]?.[field];
    return edited ?? String(fallback);
  };

  const getFactorBasisValue = (
    code: MaterialCode,
    fallback: "GOLD" | "SILVER" | "NONE"
  ) => {
    return materialFactorEdits[code]?.price_basis ?? fallback;
  };

  const setFactorInputValue = (
    code: MaterialCode,
    field: "purity_rate" | "material_adjust_factor",
    value: string
  ) => {
    setMaterialFactorEdits((prev) => ({
      ...prev,
      [code]: {
        purity_rate: prev[code]?.purity_rate ?? String(factorRows.find((row) => row.material_code === code)?.purity_rate ?? 0),
        material_adjust_factor:
          prev[code]?.material_adjust_factor ??
          String(factorRows.find((row) => row.material_code === code)?.material_adjust_factor ?? 1),
        price_basis: prev[code]?.price_basis ?? (factorRows.find((row) => row.material_code === code)?.price_basis ?? "NONE"),
        [field]: value,
      },
    }));
  };

  const setFactorBasisValue = (code: MaterialCode, value: "GOLD" | "SILVER" | "NONE") => {
    setMaterialFactorEdits((prev) => ({
      ...prev,
      [code]: {
        purity_rate: prev[code]?.purity_rate ?? String(factorRows.find((row) => row.material_code === code)?.purity_rate ?? 0),
        material_adjust_factor:
          prev[code]?.material_adjust_factor ??
          String(factorRows.find((row) => row.material_code === code)?.material_adjust_factor ?? 1),
        price_basis: value,
      },
    }));
  };

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

  const onSaveMaterialFactors = async () => {
    const rows = factorRows.map((row) => {
      const purity = Number(getFactorInputValue(row.material_code, "purity_rate", row.purity_rate));
      const adjust = Number(
        getFactorInputValue(row.material_code, "material_adjust_factor", row.material_adjust_factor)
      );
      const priceBasis = getFactorBasisValue(row.material_code, row.price_basis);
      return {
        material_code: row.material_code,
        purity_rate: purity,
        material_adjust_factor: adjust,
        price_basis: priceBasis,
      };
    });

    for (const row of rows) {
      if (!Number.isFinite(row.purity_rate) || row.purity_rate < 0 || row.purity_rate > 1) {
        toast.error(`${row.material_code}: 함량은 0~1 범위여야 합니다.`);
        return;
      }
      if (!Number.isFinite(row.material_adjust_factor) || row.material_adjust_factor < 0.5 || row.material_adjust_factor > 2) {
        toast.error(`${row.material_code}: 소재 보정계수는 0.5~2.0 범위여야 합니다.`);
        return;
      }
      if (!PRICE_BASIS_OPTIONS.includes(row.price_basis)) {
        toast.error(`${row.material_code}: 가격 기준이 올바르지 않습니다.`);
        return;
      }
    }

    try {
      await upsertMaterialFactors.mutateAsync({
        p_rows: rows,
        p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null,
        p_session_id: null,
        p_memo: "settings: material factor upsert",
      });
    } catch {
      // useRpcMutation.onError handles toast
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
          phone,
          region,
          address,
          is_active,
          note,
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
        phone: v.phone ?? null,
        region: v.region ?? null,
        address: v.address ?? null,
        is_active: v.is_active ?? true,
        note: v.note ?? null,
        fax_number: v.cms_vendor_fax_config?.[0]?.fax_number || null,
        fax_provider: toFaxProvider(v.cms_vendor_fax_config?.[0]?.fax_provider),
        no_factory_receipt_vendor: hasVendorNoFactoryReceiptTag(v.note),
      }));
    },
  });

  const [editingConfigs, setEditingConfigs] = useState<Record<string, {
    fax_number: string;
    fax_provider: string;
  }>>({});
  const [editingNoFactoryReceipt, setEditingNoFactoryReceipt] = useState<Record<string, boolean>>({});

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

  const setEditingNoFactoryReceiptMode = (vendorPartyId: string, enabled: boolean) => {
    setEditingNoFactoryReceipt((prev) => ({
      ...prev,
      [vendorPartyId]: enabled,
    }));
  };

  const vendorModeMutation = useRpcMutation<string>({
    fn: CONTRACTS.functions.partyUpsert,
    successMessage: "공장 모드 저장 완료",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms_vendor_fax_configs"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-parties"] });
    },
  });

  const handleSaveNoFactoryReceiptMode = (vendor: VendorFaxConfig) => {
    const targetEnabled = editingNoFactoryReceipt[vendor.vendor_party_id] ?? vendor.no_factory_receipt_vendor;
    const cleanNote = stripVendorNoFactoryReceiptTag(stripVendorImmediateSettleTag(vendor.note));
    const withImmediateTag = applyVendorImmediateSettleTag(cleanNote, hasVendorImmediateSettleTag(vendor.note));
    const nextNote = applyVendorNoFactoryReceiptTag(withImmediateTag, targetEnabled);

    vendorModeMutation.mutate({
      p_party_type: "vendor",
      p_name: vendor.vendor_name,
      p_phone: vendor.phone,
      p_region: vendor.region,
      p_address: vendor.address,
      p_memo: nextNote || null,
      p_party_id: vendor.vendor_party_id,
      p_is_active: vendor.is_active,
    });
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

  // ── AR/V2-style sidebar navigation ──
  type SettingsSection = "margins" | "market" | "fax";
  type MarginSubTab = "pricing_rules" | "buy_profiles" | "plating";
  const [activeSection, setActiveSection] = useState<SettingsSection>("margins");
  const [activeMarginSubTab, setActiveMarginSubTab] = useState<MarginSubTab>("pricing_rules");

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [activeGlobalRuleTab, setActiveGlobalRuleTab] = useState<GlobalRuleTab>("BASE_FACTORY");
  const [ruleVendorPartyId, setRuleVendorPartyId] = useState("");
  const [ruleMinCost, setRuleMinCost] = useState("0");
  const [ruleMaxCost, setRuleMaxCost] = useState("");
  const [ruleMinManwon, setRuleMinManwon] = useState("0");
  const [ruleMinHundred, setRuleMinHundred] = useState("0");
  const [ruleMaxManwon, setRuleMaxManwon] = useState("");
  const [ruleMaxHundred, setRuleMaxHundred] = useState("0");
  const [ruleMarkupValue, setRuleMarkupValue] = useState("0");
  const [ruleMarkupManwon, setRuleMarkupManwon] = useState("0");
  const [ruleMarkupHundred, setRuleMarkupHundred] = useState("0");
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleNote, setRuleNote] = useState("");
  const [ruleDeleteId, setRuleDeleteId] = useState<string | null>(null);

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
    setRuleVendorPartyId("");
    setRuleMinCost("0");
    setRuleMaxCost("");
    setRuleMinManwon("0");
    setRuleMinHundred("0");
    setRuleMaxManwon("");
    setRuleMaxHundred("0");
    setRuleMarkupValue("0");
    setRuleMarkupManwon("0");
    setRuleMarkupHundred("0");
    setRuleIsActive(true);
    setRuleNote("");
  };

  const activeRuleMapping = GLOBAL_RULE_MAPPING[activeGlobalRuleTab];

  const globalRuleStatsByTab = useMemo(() => {
    const source = pricingRulesQuery.data ?? [];
    return GLOBAL_RULE_TABS.reduce((acc, tab) => {
      const mapping = GLOBAL_RULE_MAPPING[tab];
      const rules = source.filter(
        (rule) =>
          rule.component === mapping.component
          && rule.scope === mapping.scope
          && rule.apply_unit === mapping.apply_unit
      );
      const sorted = [...rules]
        .map((rule) => ({
          scope: rule.vendor_party_id ?? "__ALL__",
          min: Number(rule.min_cost_krw),
          max: rule.max_cost_krw === null ? Number.POSITIVE_INFINITY : Number(rule.max_cost_krw),
        }))
        .sort((a, b) => {
          if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
          return a.min - b.min;
        });
      let overlap = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].scope === sorted[i - 1].scope && sorted[i].min <= sorted[i - 1].max) overlap += 1;
      }
      acc[tab] = {
        count: rules.length,
        overlap,
        openEnded: rules.filter((rule) => rule.max_cost_krw === null).length,
      };
      return acc;
    }, {} as Record<GlobalRuleTab, { count: number; overlap: number; openEnded: number }>);
  }, [pricingRulesQuery.data]);

  const filteredGlobalRules = useMemo(
    () =>
      (pricingRulesQuery.data ?? []).filter(
        (rule) =>
          rule.component === activeRuleMapping.component
          && rule.scope === activeRuleMapping.scope
          && rule.apply_unit === activeRuleMapping.apply_unit
      ),
    [activeRuleMapping.apply_unit, activeRuleMapping.component, activeRuleMapping.scope, pricingRulesQuery.data]
  );


  const sortedGlobalRules = useMemo(
    () =>
      [...filteredGlobalRules].sort((a, b) => {
        const scopeA = a.vendor_party_id ?? "";
        const scopeB = b.vendor_party_id ?? "";
        if (scopeA !== scopeB) return scopeA.localeCompare(scopeB);
        return Number(a.min_cost_krw) - Number(b.min_cost_krw);
      }),
    [filteredGlobalRules]
  );

  const overlappingRuleIds = useMemo(() => {
    const groups = new Map<string, PricingRuleRow[]>();
    for (const rule of sortedGlobalRules) {
      const key = rule.vendor_party_id ?? "__ALL__";
      const group = groups.get(key) ?? [];
      group.push(rule);
      groups.set(key, group);
    }
    const overlapSet = new Set<string>();
    for (const rules of groups.values()) {
      let prev: PricingRuleRow | null = null;
      let prevMax = -1;
      for (const rule of rules) {
        const min = Number(rule.min_cost_krw);
        const max = rule.max_cost_krw === null ? MAX_RULE_KRW : Number(rule.max_cost_krw);
        if (prev && min <= prevMax) {
          overlapSet.add(prev.rule_id);
          overlapSet.add(rule.rule_id);
        }
        prev = rule;
        prevMax = Math.max(prevMax, max);
      }
    }
    return overlapSet;
  }, [sortedGlobalRules]);

  const ruleDeltaById = useMemo(() => {
    const groups = new Map<string, PricingRuleRow[]>();
    for (const rule of sortedGlobalRules) {
      const key = rule.vendor_party_id ?? "__ALL__";
      const group = groups.get(key) ?? [];
      group.push(rule);
      groups.set(key, group);
    }
    const result: Record<string, number | null> = {};
    for (const rules of groups.values()) {
      let previousMarkup: number | null = null;
      for (const rule of rules) {
        const currentMarkup = Number(rule.markup_value_krw);
        result[rule.rule_id] = previousMarkup === null ? null : currentMarkup - previousMarkup;
        previousMarkup = currentMarkup;
      }
    }
    return result;
  }, [sortedGlobalRules]);

  const rangeMapItems = useMemo(
    () =>
      sortedGlobalRules.map((rule) => {
        const start = Math.min(MAX_RULE_KRW, Math.max(0, Number(rule.min_cost_krw)));
        const endSource = rule.max_cost_krw === null ? MAX_RULE_KRW : Number(rule.max_cost_krw);
        const end = Math.min(MAX_RULE_KRW, Math.max(start, endSource));
        const left = (start / MAX_RULE_KRW) * 100;
        const width = Math.max(2, ((end - start) / MAX_RULE_KRW) * 100);
        return {
          rule,
          left,
          width,
          isOverlap: overlappingRuleIds.has(rule.rule_id),
          openEnded: rule.max_cost_krw === null,
        };
      }),
    [overlappingRuleIds, sortedGlobalRules]
  );

  const overlapCount = useMemo(() => overlappingRuleIds.size, [overlappingRuleIds]);

  const startEditGlobalRule = (rule: PricingRuleRow) => {
    setEditingRuleId(rule.rule_id);
    setActiveGlobalRuleTab(tabFromRule(rule));
    setRuleVendorPartyId(rule.vendor_party_id ?? "");
    setRuleMinCost(String(rule.min_cost_krw));
    setRuleMaxCost(rule.max_cost_krw === null ? "" : String(rule.max_cost_krw));
    {
      const minSplit = splitKrw(String(rule.min_cost_krw));
      setRuleMinManwon(minSplit.manwon);
      setRuleMinHundred(minSplit.hundred);
    }
    if (rule.max_cost_krw === null) {
      setRuleMaxManwon("");
      setRuleMaxHundred("0");
    } else {
      const maxSplit = splitKrw(String(rule.max_cost_krw));
      setRuleMaxManwon(maxSplit.manwon);
      setRuleMaxHundred(maxSplit.hundred);
    }
    setRuleMarkupValue(String(rule.markup_value_krw));
    {
      const markupSplit = splitKrw(String(rule.markup_value_krw));
      setRuleMarkupManwon(markupSplit.manwon);
      setRuleMarkupHundred(markupSplit.hundred);
    }
    setRuleIsActive(Boolean(rule.is_active));
    setRuleNote(rule.note ?? "");
  };

  const normalizeHundred = (value: string, allowEmpty = false): string => {
    const trimmed = value.trim();
    if (allowEmpty && trimmed === "") return "";
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return allowEmpty ? "" : "0";
    const clamped = Math.min(MAX_RULE_KRW, Math.max(0, parsed));
    const rounded = Math.round(clamped / 100) * 100;
    return String(rounded);
  };

  const splitKrw = (value: string): { manwon: string; hundred: string } => {
    const normalized = Number(normalizeHundred(value));
    const manwon = Math.floor(normalized / 10000) * 10000;
    const hundred = normalized - manwon;
    return { manwon: String(manwon), hundred: String(hundred) };
  };

  const composeKrw = (manwon: string, hundred: string): string => {
    const major = Number(manwon || "0");
    const minor = Number(hundred || "0");
    const normalized = Math.min(MAX_RULE_KRW, Math.max(0, major + minor));
    return String(normalized);
  };

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const minCost = Number(normalizeHundred(ruleMinCost));
      const maxCost = ruleMaxCost.trim() === "" ? null : Number(normalizeHundred(ruleMaxCost, true));
      const markupValue = Number(normalizeHundred(ruleMarkupValue));

      if (!Number.isFinite(minCost) || minCost < 0) throw new Error("최소 원가는 0 이상 숫자여야 합니다.");
      if (minCost > MAX_RULE_KRW) throw new Error("시작 원가는 50만원 이하여야 합니다.");
      if (minCost % 100 !== 0) throw new Error("시작 원가는 100원 단위로 입력해 주세요.");
      if (maxCost !== null && (!Number.isFinite(maxCost) || maxCost < minCost)) throw new Error("최대 원가는 최소 원가 이상이어야 합니다.");
      if (maxCost !== null && maxCost > MAX_RULE_KRW) throw new Error("종료 원가는 50만원 이하여야 합니다.");
      if (maxCost !== null && maxCost % 100 !== 0) throw new Error("종료 원가는 100원 단위로 입력해 주세요.");
      if (!Number.isFinite(markupValue) || markupValue < 0) throw new Error("마크업은 0 이상 숫자여야 합니다.");
      if (markupValue > MAX_RULE_KRW) throw new Error("가산 마진은 50만원 이하여야 합니다.");
      if (markupValue % 100 !== 0) throw new Error("가산 마진은 100원 단위로 입력해 주세요.");
      const response = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_id: editingRuleId,
          component: activeRuleMapping.component,
          scope: activeRuleMapping.scope,
          apply_unit: activeRuleMapping.apply_unit,
          stone_role: activeRuleMapping.stone_role,
          vendor_party_id: ruleVendorPartyId || null,
          min_cost_krw: minCost,
          max_cost_krw: maxCost,
          markup_value_krw: markupValue,
          priority: 100,
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
          component: activeRuleMapping.component,
          scope: activeRuleMapping.scope,
          apply_unit: activeRuleMapping.apply_unit,
          stone_role: activeRuleMapping.stone_role,
          vendor_party_id: testVendorPartyId || null,
          cost_basis_krw: costBasis,
        }),
      });

      const json = (await response.json()) as {
        data?: { picked_rule_id?: string | null; markup_krw?: number | null } | Array<{ picked_rule_id?: string | null; markup_krw?: number | null }>;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "룰 테스트 실패");

      const data = Array.isArray(json.data) ? json.data[0] : json.data;
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

  const applyRuleBulkDeltaMutation = useMutation({
    mutationFn: async () => {
      const delta = Number(bulkDelta);
      if (!Number.isFinite(delta) || delta === 0) throw new Error("일괄 Δ는 0이 아닌 숫자여야 합니다.");

      const targetRules = (pricingRulesQuery.data ?? []).filter((rule) => {
        if (rule.component !== activeRuleMapping.component) return false;
        if (rule.scope !== activeRuleMapping.scope) return false;
        if ((rule.vendor_party_id ?? "") !== (ruleVendorPartyId || "")) return false;
        if (rule.apply_unit !== activeRuleMapping.apply_unit) return false;
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

  // Section definitions for sidebar
  const SECTIONS: { key: SettingsSection; label: string; desc: string; icon: React.ReactNode; badge?: string }[] = [
    {
      key: "margins",
      label: "글로벌 마진",
      desc: "원가구간 기반 글로벌 마진 룰",
      icon: <TrendingUp className="w-4 h-4" />,
      badge: `${(pricingRulesQuery.data ?? []).length + (buyProfilesQuery.data ?? []).length + (platingMarkupRulesQuery.data ?? []).length}개 룰`,
    },
    {
      key: "market",
      label: "시세 설정",
      desc: "FX · 실버해리 · 올림단위",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      key: "fax",
      label: "공장 팩스",
      desc: "업체별 팩스 번호 · 전송방식",
      icon: <Factory className="w-4 h-4" />,
      badge: `${(vendorsQuery.data ?? []).length}개 공장`,
    },
  ];

  const MARGIN_SUB_TABS: { key: MarginSubTab; label: string }[] = [
    { key: "pricing_rules", label: "글로벌 가격 룰" },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)]">
      {/* ─── LEFT SIDEBAR ─── */}
      <div className="w-80 flex-none border-r border-[var(--panel-border)] flex flex-col bg-[var(--panel)] z-20 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-[var(--panel-border)] bg-[var(--panel)]">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            설정
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">시스템 설정 및 마진 룰을 관리합니다</p>
        </div>

        {/* Section List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {SECTIONS.map((section) => {
            const isSelected = activeSection === section.key;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all border group relative",
                  isSelected
                    ? "bg-[var(--chip)] border-[var(--primary)] shadow-sm"
                    : "border-transparent hover:bg-[var(--panel-hover)]"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn("font-bold text-sm flex items-center gap-2", isSelected ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>
                    {section.icon}
                    {section.label}
                  </span>
                  {section.badge && (
                    <span className="text-[11px] text-[var(--muted)] tabular-nums">{section.badge}</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--muted)] pl-6">{section.desc}</div>
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--primary)] rounded-l-lg" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── RIGHT MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--background)]">

        {/* ══════════ SECTION: 글로벌 마진 ══════════ */}
        {activeSection === "margins" && (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">글로벌 마진</h1>
              </div>
              <p className="text-sm text-[var(--muted)]">기본공임·알공임(공입/자입)·도금을 모두 공임 룰 카테고리에서 관리하되, 룰 데이터는 탭별로 분리되어 적용됩니다</p>
            </div>

            {/* Sub-Tab Navigation */}
            <div className="flex border-b border-[var(--panel-border)] px-6 bg-[var(--panel)] sticky top-0">
              {MARGIN_SUB_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveMarginSubTab(tab.key)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeMarginSubTab === tab.key
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* ── 가격 룰 ── */}
              {activeMarginSubTab === "pricing_rules" && (
                <div className="space-y-4">
                  <div className="space-y-4 min-w-0">
                    <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-2">
                      <div className="text-xs font-semibold">공임 룰 카테고리</div>
                      <div className="text-xs text-[var(--muted)]">카테고리를 선택하면 아래에서 구간을 바로 조절합니다.</div>
                      <div className="text-[11px] text-[var(--muted)]">도금 글로벌은 STONE(알공임)과 다른 룰셋(SETTING/FACTORY/PER_PIECE)으로 분리 적용됩니다.</div>
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 pt-1">
                        {GLOBAL_RULE_TABS.map((tab) => {
                          const stats = globalRuleStatsByTab[tab];
                          return (
                            <button
                              key={tab}
                              type="button"
                              className={`rounded-md border px-3 py-2 text-left transition ${activeGlobalRuleTab === tab
                                ? "border-[var(--primary)] bg-[var(--surface)]"
                                : "border-[var(--panel-border)] bg-[var(--panel)] hover:bg-[var(--surface)]"
                                }`}
                              onClick={() => {
                                setActiveGlobalRuleTab(tab);
                                setEditingRuleId(null);
                                setRuleDeleteId(null);
                              }}
                            >
                              <div className="text-sm font-semibold">{GLOBAL_RULE_TAB_LABEL[tab]}</div>
                              <div className="text-[11px] text-[var(--muted)]">{GLOBAL_RULE_TAB_HELP[tab]}</div>
                              <div className="mt-1 text-[11px] text-[var(--muted)]">구간 {stats?.count ?? 0} · 겹침 {stats?.overlap ?? 0}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4 min-w-0">

                      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold">구간 마진 맵</div>
                          <div className="text-[11px] text-[var(--muted)]">0원 ~ 500,000원</div>
                        </div>
                        <div className="relative h-8 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] overflow-hidden">
                          {rangeMapItems.map((item) => (
                            <button
                              key={`range-track-${item.rule.rule_id}`}
                              type="button"
                              title={`${Number(item.rule.min_cost_krw).toLocaleString()} ~ ${item.rule.max_cost_krw === null ? "∞" : Number(item.rule.max_cost_krw).toLocaleString()} / +${Number(item.rule.markup_value_krw).toLocaleString()}원`}
                              onClick={() => startEditGlobalRule(item.rule)}
                              className={`absolute top-0 h-full ${item.isOverlap ? "bg-[var(--danger)]" : "bg-[var(--primary)]"} ${item.rule.is_active ? "opacity-80" : "opacity-35"}`}
                              style={{ left: `${item.left}%`, width: `${item.width}%` }}
                            />
                          ))}
                          <div className="absolute left-2 top-1 text-[10px] text-[var(--muted)]">0</div>
                          <div className="absolute right-2 top-1 text-[10px] text-[var(--muted)]">500,000</div>
                        </div>
                        {rangeMapItems.length === 0 ? (
                          <div className="text-xs text-[var(--muted)]">구간이 아직 없어 맵이 비어 있습니다.</div>
                        ) : (
                          <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-[var(--primary)]" />정상</span>
                            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-[var(--danger)]" />겹침</span>
                            <span className="text-[var(--muted-weak)]">막대를 클릭하면 해당 구간을 수정합니다.</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)] gap-4">
                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3">
                          <div className="text-xs font-semibold">구간 추가/수정</div>
                          <div className="text-xs text-[var(--muted)]">0원~50만원 범위에서, 만원 단위 선택 후 100원 단위로 세부 조절할 수 있습니다.</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <label className="space-y-1 md:col-span-2">
                              <div className="text-xs text-[var(--muted)]">공장(선택)</div>
                              <Select value={ruleVendorPartyId} onChange={(e) => setRuleVendorPartyId(e.target.value)}>
                                <option value="">전체 공장</option>
                                {vendorChoices.map((vendor) => (
                                  <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                                ))}
                              </Select>
                            </label>
                            <label className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">시작 원가</div>
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  value={ruleMinManwon}
                                  onChange={(e) => {
                                    const nextManwon = e.target.value;
                                    setRuleMinManwon(nextManwon);
                                    setRuleMinCost(composeKrw(nextManwon, ruleMinHundred));
                                  }}
                                >
                                  {MANWON_OPTIONS.map((value) => (
                                    <option key={`min-manwon-${value}`} value={String(value)}>{(value / 10000).toLocaleString()}만원</option>
                                  ))}
                                </Select>
                                <Select
                                  value={ruleMinHundred}
                                  onChange={(e) => {
                                    const nextHundred = e.target.value;
                                    setRuleMinHundred(nextHundred);
                                    setRuleMinCost(composeKrw(ruleMinManwon, nextHundred));
                                  }}
                                >
                                  {HUNDRED_OPTIONS.map((value) => (
                                    <option key={`min-hundred-${value}`} value={String(value)}>{value.toLocaleString()}원</option>
                                  ))}
                                </Select>
                              </div>
                              <Input
                                value={ruleMinCost}
                                onChange={(e) => setRuleMinCost(e.target.value)}
                                onBlur={() => {
                                  const normalized = normalizeHundred(ruleMinCost);
                                  setRuleMinCost(normalized);
                                  const split = splitKrw(normalized);
                                  setRuleMinManwon(split.manwon);
                                  setRuleMinHundred(split.hundred);
                                }}
                                inputMode="numeric"
                                placeholder="직접 입력 (0원~500,000원, 100원 단위)"
                              />
                            </label>
                            <label className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">종료 원가(비우면 상한없음)</div>
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  value={ruleMaxManwon}
                                  onChange={(e) => {
                                    const nextManwon = e.target.value;
                                    setRuleMaxManwon(nextManwon);
                                    if (nextManwon === "") {
                                      setRuleMaxCost("");
                                      return;
                                    }
                                    setRuleMaxCost(composeKrw(nextManwon, ruleMaxHundred));
                                  }}
                                >
                                  <option value="">상한없음</option>
                                  {MANWON_OPTIONS.map((value) => (
                                    <option key={`max-manwon-${value}`} value={String(value)}>{(value / 10000).toLocaleString()}만원</option>
                                  ))}
                                </Select>
                                <Select
                                  value={ruleMaxHundred}
                                  disabled={ruleMaxManwon === ""}
                                  onChange={(e) => {
                                    const nextHundred = e.target.value;
                                    setRuleMaxHundred(nextHundred);
                                    if (ruleMaxManwon === "") return;
                                    setRuleMaxCost(composeKrw(ruleMaxManwon, nextHundred));
                                  }}
                                >
                                  {HUNDRED_OPTIONS.map((value) => (
                                    <option key={`max-hundred-${value}`} value={String(value)}>{value.toLocaleString()}원</option>
                                  ))}
                                </Select>
                              </div>
                              <Input
                                value={ruleMaxCost}
                                onChange={(e) => setRuleMaxCost(e.target.value)}
                                onBlur={() => {
                                  const normalized = normalizeHundred(ruleMaxCost, true);
                                  setRuleMaxCost(normalized);
                                  if (normalized === "") {
                                    setRuleMaxManwon("");
                                    setRuleMaxHundred("0");
                                    return;
                                  }
                                  const split = splitKrw(normalized);
                                  setRuleMaxManwon(split.manwon);
                                  setRuleMaxHundred(split.hundred);
                                }}
                                inputMode="numeric"
                                placeholder="직접 입력 (0원~500,000원, 100원 단위)"
                              />
                            </label>
                            <label className="space-y-1">
                              <div className="text-xs text-[var(--muted)]">가산 마진(원)</div>
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  value={ruleMarkupManwon}
                                  onChange={(e) => {
                                    const nextManwon = e.target.value;
                                    setRuleMarkupManwon(nextManwon);
                                    setRuleMarkupValue(composeKrw(nextManwon, ruleMarkupHundred));
                                  }}
                                >
                                  {MANWON_OPTIONS.map((value) => (
                                    <option key={`markup-manwon-${value}`} value={String(value)}>{(value / 10000).toLocaleString()}만원</option>
                                  ))}
                                </Select>
                                <Select
                                  value={ruleMarkupHundred}
                                  onChange={(e) => {
                                    const nextHundred = e.target.value;
                                    setRuleMarkupHundred(nextHundred);
                                    setRuleMarkupValue(composeKrw(ruleMarkupManwon, nextHundred));
                                  }}
                                >
                                  {HUNDRED_OPTIONS.map((value) => (
                                    <option key={`markup-hundred-${value}`} value={String(value)}>{value.toLocaleString()}원</option>
                                  ))}
                                </Select>
                              </div>
                              <Input
                                value={ruleMarkupValue}
                                onChange={(e) => setRuleMarkupValue(e.target.value)}
                                onBlur={() => {
                                  const normalized = normalizeHundred(ruleMarkupValue);
                                  setRuleMarkupValue(normalized);
                                  const split = splitKrw(normalized);
                                  setRuleMarkupManwon(split.manwon);
                                  setRuleMarkupHundred(split.hundred);
                                }}
                                inputMode="numeric"
                                placeholder="직접 입력 (0원~500,000원, 100원 단위)"
                              />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                              <div className="text-xs text-[var(--muted)]">메모(선택)</div>
                              <Input value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} />
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs md:col-span-2">
                              <input type="checkbox" checked={ruleIsActive} onChange={(e) => setRuleIsActive(e.target.checked)} className="h-4 w-4" />
                              활성화
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending}>
                              {editingRuleId ? "수정 저장" : "구간 저장"}
                            </Button>
                            {editingRuleId ? (
                              <Button variant="secondary" onClick={resetRuleForm}>취소</Button>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 border-t border-[var(--panel-border)] pt-3">
                            <Input value={bulkDelta} onChange={(e) => setBulkDelta(e.target.value)} placeholder="예: 1000 또는 -1000" inputMode="numeric" />
                            <Button
                              variant="secondary"
                              onClick={() => applyRuleBulkDeltaMutation.mutate()}
                              disabled={applyRuleBulkDeltaMutation.isPending}
                            >
                              현재 카테고리에 일괄 반영
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 space-y-3 min-w-0">
                          <div className="text-xs font-semibold">구간 목록</div>
                          <div className="overflow-x-auto">
                            <table className="min-w-[680px] w-full text-xs">
                              <thead className="text-[var(--muted)]">
                                <tr>
                                  <th className="text-left py-1">활성</th>
                                  <th className="text-left py-1">상태</th>
                                  <th className="text-left py-1">공장</th>
                                  <th className="text-left py-1">원가 구간</th>
                                  <th className="text-left py-1">마크업</th>
                                  <th className="text-left py-1">마진 Δ</th>
                                  <th className="text-left py-1">수정일시</th>
                                  <th className="text-left py-1">작업</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedGlobalRules.map((rule) => {
                                  const vendorName = vendorChoices.find((vendor) => vendor.value === rule.vendor_party_id)?.label ?? "전체";
                                  const isDeleteArmed = ruleDeleteId === rule.rule_id;
                                  const isOverlap = overlappingRuleIds.has(rule.rule_id);
                                  const delta = ruleDeltaById[rule.rule_id];
                                  return (
                                    <tr key={rule.rule_id} className="border-t border-[var(--panel-border)]">
                                      <td className="py-1">{rule.is_active ? "Y" : "N"}</td>
                                      <td className="py-1">
                                        {isOverlap ? (
                                          <span className="rounded px-1.5 py-0.5 text-[10px] bg-[color:color-mix(in srgb,var(--danger) 12%,transparent)] text-[var(--danger)]">겹침</span>
                                        ) : rule.is_active ? (
                                          <span className="rounded px-1.5 py-0.5 text-[10px] bg-[color:color-mix(in srgb,var(--primary) 14%,transparent)] text-[var(--primary)]">정상</span>
                                        ) : (
                                          <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--panel)] text-[var(--muted)]">비활성</span>
                                        )}
                                      </td>
                                      <td className="py-1 truncate max-w-[120px]" title={vendorName}>{vendorName}</td>
                                      <td className="py-1">{Number(rule.min_cost_krw).toLocaleString()} ~ {rule.max_cost_krw === null ? "∞" : Number(rule.max_cost_krw).toLocaleString()}</td>
                                      <td className="py-1">+{Number(rule.markup_value_krw).toLocaleString()}</td>
                                      <td className="py-1">
                                        {delta === null ? "-" : (
                                          <span className={delta >= 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}>
                                            {delta >= 0 ? "+" : ""}{delta.toLocaleString()}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1">{rule.updated_at ? new Date(rule.updated_at).toLocaleString() : "-"}</td>
                                      <td className="py-1">
                                        <div className="flex items-center gap-1">
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => startEditGlobalRule(rule)}
                                          >
                                            수정
                                          </Button>
                                          {!isDeleteArmed ? (
                                            <Button size="sm" variant="secondary" onClick={() => setRuleDeleteId(rule.rule_id)}>삭제</Button>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="secondary"
                                              onClick={() => deleteRuleMutation.mutate(rule.rule_id)}
                                              disabled={deleteRuleMutation.isPending}
                                              className="text-[var(--danger)]"
                                            >
                                              삭제확정
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {sortedGlobalRules.length === 0 ? (
                                  <tr className="border-t border-[var(--panel-border)]">
                                    <td className="py-3 text-[var(--muted)]" colSpan={8}>아직 등록된 구간이 없습니다. 왼쪽 카테고리를 선택한 뒤 구간을 추가해 주세요.</td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-3">
                        <div className="text-xs font-semibold">즉시 테스트</div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                            유형: {GLOBAL_RULE_TAB_LABEL[activeGlobalRuleTab]} / {activeRuleMapping.scope} / {activeRuleMapping.apply_unit}
                          </div>
                          <Select value={testVendorPartyId} onChange={(e) => setTestVendorPartyId(e.target.value)}>
                            <option value="">전체 공장</option>
                            {vendorChoices.map((vendor) => (
                              <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                            ))}
                          </Select>
                          <Input value={testCostBasis} onChange={(e) => setTestCostBasis(e.target.value)} placeholder="원가 기준" inputMode="numeric" />
                          <Button onClick={() => runRuleTestMutation.mutate()} disabled={runRuleTestMutation.isPending}>테스트 실행</Button>
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          선택된 룰 ID: {testResult?.picked_rule_id ?? "-"} / 적용 가산마진: {testResult?.markup_krw ?? "-"}원
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── BUY 마진 프로파일 ── */}
              {activeMarginSubTab === "buy_profiles" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold">BUY 마진 프로파일</div>
                    <div className="text-xs text-[var(--muted)] mt-1">자입(SELF) 알공임 센터/보조 마진 프로파일</div>
                  </div>
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
                </div>
              )}

              {/* ── 도금 마진 ── */}
              {activeMarginSubTab === "plating" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] p-3">
                    <div className="text-sm font-semibold">도금 마진 룰</div>
                    <div className="text-xs text-[var(--muted)] mt-1">Variant별 fixed/per-g 마진 룰</div>
                  </div>
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
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ SECTION: 시세 설정 ══════════ */}
        {activeSection === "market" && (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">시세 설정</h1>
              </div>
              <p className="text-sm text-[var(--muted)]">FX 마크업, 보정계수, 실버 해리 및 올림단위를 설정합니다</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 시세 파이프라인 */}
              <div className="hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>

              {/* RULE 올림단위 */}
              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold">소재 함량/보정계수</div>
                  <div className="text-xs text-[var(--muted)]">
                    소재 SoT: purity x material-adjust. 각 소재별로 독립 설정됩니다.
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-2">
                    <div className="text-xs font-semibold">금 소재</div>
                    <div className="grid grid-cols-5 gap-2 text-[11px] text-[var(--muted)]">
                      <div>소재</div>
                      <div>함량</div>
                      <div>소재 보정계수</div>
                      <div>가격 기준</div>
                      <div>적용계수 미리보기</div>
                    </div>
                    {goldRows.map((row) => {
                      const purityValue = getFactorInputValue(row.material_code, "purity_rate", row.purity_rate);
                      const adjustValue = getFactorInputValue(
                        row.material_code,
                        "material_adjust_factor",
                        row.material_adjust_factor
                      );
                      const priceBasisValue = getFactorBasisValue(row.material_code, row.price_basis);
                      const purity = Number(purityValue);
                      const adjust = Number(adjustValue || "1");
                      const effective = purity * adjust;
                      return (
                        <div key={row.material_code} className="grid grid-cols-5 gap-2 items-center">
                          <div className="text-xs font-medium">{row.material_code}</div>
                          <Input
                            value={purityValue}
                            onChange={(event) => setFactorInputValue(row.material_code, "purity_rate", event.target.value)}
                            className="h-8"
                          />
                          <Input
                            value={adjustValue}
                            onChange={(event) =>
                              setFactorInputValue(row.material_code, "material_adjust_factor", event.target.value)
                            }
                            className="h-8"
                          />
                          <Select
                            value={priceBasisValue}
                            onChange={(event) =>
                              setFactorBasisValue(
                                row.material_code,
                                event.target.value as "GOLD" | "SILVER" | "NONE"
                              )
                            }
                            className="h-8"
                          >
                            <option value="GOLD">GOLD</option>
                            <option value="SILVER">SILVER</option>
                            <option value="NONE">NONE</option>
                          </Select>
                          <div className="text-xs tabular-nums">{Number.isFinite(effective) ? effective.toFixed(6) : "0.000000"}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-2">
                    <div className="text-xs font-semibold">은 소재</div>
                    <div className="grid grid-cols-5 gap-2 text-[11px] text-[var(--muted)]">
                      <div>소재</div>
                      <div>함량</div>
                      <div>소재 보정계수</div>
                      <div>가격 기준</div>
                      <div>적용계수 미리보기</div>
                    </div>
                    {silverRows.map((row) => {
                      const purityValue = getFactorInputValue(row.material_code, "purity_rate", row.purity_rate);
                      const adjustValue = getFactorInputValue(
                        row.material_code,
                        "material_adjust_factor",
                        row.material_adjust_factor
                      );
                      const priceBasisValue = getFactorBasisValue(row.material_code, row.price_basis);
                      const purity = Number(purityValue);
                      const adjust = Number(adjustValue || "1");
                      const effective = purity * adjust;
                      return (
                        <div key={row.material_code} className="grid grid-cols-5 gap-2 items-center">
                          <div className="text-xs font-medium">{row.material_code}</div>
                          <Input
                            value={purityValue}
                            onChange={(event) => setFactorInputValue(row.material_code, "purity_rate", event.target.value)}
                            className="h-8"
                          />
                          <Input
                            value={adjustValue}
                            onChange={(event) =>
                              setFactorInputValue(row.material_code, "material_adjust_factor", event.target.value)
                            }
                            className="h-8"
                          />
                          <Select
                            value={priceBasisValue}
                            onChange={(event) =>
                              setFactorBasisValue(
                                row.material_code,
                                event.target.value as "GOLD" | "SILVER" | "NONE"
                              )
                            }
                            className="h-8"
                          >
                            <option value="GOLD">GOLD</option>
                            <option value="SILVER">SILVER</option>
                            <option value="NONE">NONE</option>
                          </Select>
                          <div className="text-xs tabular-nums">{Number.isFinite(effective) ? effective.toFixed(6) : "0.000000"}</div>
                        </div>
                      );
                    })}
                  </div>

                  {otherRows.length > 0 ? (
                    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--surface)] p-3 space-y-2">
                      <div className="text-xs font-semibold">기타/비정산 소재</div>
                      <div className="grid grid-cols-5 gap-2 text-[11px] text-[var(--muted)]">
                        <div>소재</div>
                        <div>함량</div>
                        <div>소재 보정계수</div>
                        <div>가격 기준</div>
                        <div>적용계수 미리보기</div>
                      </div>
                      {otherRows.map((row) => {
                        const purityValue = getFactorInputValue(row.material_code, "purity_rate", row.purity_rate);
                        const adjustValue = getFactorInputValue(
                          row.material_code,
                          "material_adjust_factor",
                          row.material_adjust_factor
                        );
                        const priceBasisValue = getFactorBasisValue(row.material_code, row.price_basis);
                        const purity = Number(purityValue);
                        const adjust = Number(adjustValue || "1");
                        const effective = purity * adjust;
                        return (
                          <div key={row.material_code} className="grid grid-cols-5 gap-2 items-center">
                            <div className="text-xs font-medium">{row.material_code}</div>
                            <Input
                              value={purityValue}
                              onChange={(event) => setFactorInputValue(row.material_code, "purity_rate", event.target.value)}
                              className="h-8"
                            />
                            <Input
                              value={adjustValue}
                              onChange={(event) =>
                                setFactorInputValue(row.material_code, "material_adjust_factor", event.target.value)
                              }
                              className="h-8"
                            />
                            <Select
                              value={priceBasisValue}
                              onChange={(event) =>
                                setFactorBasisValue(
                                  row.material_code,
                                  event.target.value as "GOLD" | "SILVER" | "NONE"
                                )
                              }
                              className="h-8"
                            >
                              <option value="GOLD">GOLD</option>
                              <option value="SILVER">SILVER</option>
                              <option value="NONE">NONE</option>
                            </Select>
                            <div className="text-xs tabular-nums">{Number.isFinite(effective) ? effective.toFixed(6) : "0.000000"}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={onSaveMaterialFactors}
                    disabled={upsertMaterialFactors.isPending || materialFactorsQuery.isFetching}
                  >
                    저장
                  </Button>
                  <span className="text-xs text-[var(--muted)]">
                    저장 시 소재 계산 전역(출고/AR/미리보기)에 동일 SoT가 적용됩니다.
                  </span>
                </div>
              </div>

              {/* RULE 올림단위 */}
              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold">RULE 올림 단위 (확정 시 적용)</div>
                  <div className="text-xs text-[var(--muted)]">확정 시점에만 적용됩니다.</div>
                </div>

                <label className="space-y-1 max-w-xs">
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
              </div>
            </div>
          </>
        )}

        {/* ══════════ SECTION: 공장 팩스 ══════════ */}
        {activeSection === "fax" && (
          <>
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm z-10">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">공장 팩스 설정</h1>
              </div>
              <p className="text-sm text-[var(--muted)]">업체별 팩스 번호 및 전송 방식을 관리합니다</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-4">
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
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {vendorsQuery.data?.map((vendor) => {
                      const edit = editingConfigs[vendor.vendor_party_id];
                      const faxNumber = edit?.fax_number ?? vendor.fax_number ?? "";
                      const faxProvider = edit?.fax_provider ?? vendor.fax_provider ?? "mock";
                      const hasChanges = edit !== undefined;
                      const noFactoryReceiptEnabled =
                        editingNoFactoryReceipt[vendor.vendor_party_id] ?? vendor.no_factory_receipt_vendor;
                      const hasModeChanges =
                        editingNoFactoryReceipt[vendor.vendor_party_id] !== undefined
                        && editingNoFactoryReceipt[vendor.vendor_party_id] !== vendor.no_factory_receipt_vendor;

                      return (
                        <div
                          key={vendor.vendor_party_id}
                          className={`p-2 rounded-lg border transition-all ${hasChanges
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
                            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--surface)] px-2 py-1.5">
                              <label className="inline-flex items-center gap-2 text-xs text-[var(--foreground)]">
                                <input
                                  type="checkbox"
                                  checked={noFactoryReceiptEnabled}
                                  onChange={(event) => setEditingNoFactoryReceiptMode(vendor.vendor_party_id, event.target.checked)}
                                  className="h-4 w-4"
                                />
                                무영수증 공장 (영수증 하단4행 정합성 강제 제외)
                              </label>
                              <Button
                                size="sm"
                                variant={hasModeChanges ? "primary" : "secondary"}
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveNoFactoryReceiptMode(vendor)}
                                disabled={!hasModeChanges || vendorModeMutation.isPending}
                              >
                                모드 저장
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
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

