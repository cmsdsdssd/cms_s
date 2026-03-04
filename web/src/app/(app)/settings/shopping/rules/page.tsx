"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { ShoppingPageHeader } from "@/components/layout/shopping-page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_name: string; channel_code: string };
type RuleSet = { rule_set_id: string; channel_id: string; name: string; description: string | null; is_active: boolean };
type RuleSection = "MATERIAL" | "SIZE" | "PLATING" | "DECORATION";
type PlatingOption = { color_code: string; display_name: string };

type RulePoolMaster = {
  master_item_id: string;
  model_name: string | null;
  category_code: string | null;
  material_code_default: string;
  total_labor_sell_krw: number;
};

type RulePools = {
  categories: string[];
  materials: string[];
  colors: string[];
  decoration_names: string[];
  masters: RulePoolMaster[];
};

type R1Rule = {
  rule_id: string;
  source_material_code: string | null;
  target_material_code: string;
  match_category_code: string | null;
  option_weight_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
};

type R2Rule = {
  rule_id: string;
  linked_r1_rule_id: string | null;
  match_material_code: string | null;
  match_category_code: string | null;
  margin_min_krw: number | null;
  margin_max_krw: number | null;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
};

type R3Rule = {
  rule_id: string;
  color_code: string;
  margin_min_krw: number;
  margin_max_krw: number;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
};

type R4Rule = {
  rule_id: string;
  linked_r1_rule_id: string | null;
  match_decoration_code: string;
  match_material_code: string | null;
  match_color_code: string | null;
  match_category_code: string | null;
  delta_krw: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
};

type LaborLog = {
  adjustment_log_id: string;
  master_item_id: string;
  delta_krw: number;
  reason: string;
  created_at: string;
};

const parseN = (value: string, fallback = 0) => {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
};

const ROUNDING_UNIT_OPTIONS = Array.from({ length: 100 }, (_, idx) => String((idx + 1) * 100));
const ROUNDING_MODE_OPTIONS: Array<{ value: "CEIL" | "ROUND" | "FLOOR"; label: string }> = [
  { value: "CEIL", label: "올림" },
  { value: "ROUND", label: "반올림" },
  { value: "FLOOR", label: "내림" },
];
const ROUNDING_MODE_LABEL: Record<"CEIL" | "ROUND" | "FLOOR", string> = {
  CEIL: "올림",
  ROUND: "반올림",
  FLOOR: "내림",
};
const MAJOR_AMOUNT_OPTIONS = Array.from({ length: 1001 }, (_, idx) => String(idx));
const MINOR_AMOUNT_OPTIONS = Array.from({ length: 100 }, (_, idx) => String(idx * 100));

const toAmountKrw = (majorRaw: string, minorRaw: string): number => {
  const major = Math.max(0, parseN(majorRaw, 0));
  const minor = Math.max(0, parseN(minorRaw, 0));
  return major * 10000 + minor;
};

const splitAmountKrw = (amountRaw: number | null | undefined): { major: string; minor: string } => {
  const amount = Math.max(0, Math.round(Number(amountRaw ?? 0)));
  const major = Math.floor(amount / 10000);
  const minor = amount % 10000;
  return { major: String(major), minor: String(minor) };
};

const DEFAULT_RULESET_NAME = "DEFAULT";

const CATEGORY_LABEL_KO: Record<string, string> = {
  BRACELET: "팔찌",
  ANKLET: "발찌",
  NECKLACE: "목걸이",
  EARRING: "귀걸이",
  RING: "반지",
  PIERCING: "피어싱",
  PENDANT: "팬던트",
  WATCH: "시계",
  KEYRING: "키링",
  SYMBOL: "심볼",
  ACCESSORY: "부속",
  ETC: "기타",
  CHAIN: "체인",
  BANGLE: "뱅글",
  COUPLING: "커플링",
  SET: "세트",
};

const categoryLabel = (code: string): string => CATEGORY_LABEL_KO[code] ?? code;

export default function ShoppingRulesPage() {
  const qc = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].channel_id);
  }, [channelId, channels]);

  const ruleSetsQuery = useQuery({
    queryKey: ["sync-rule-sets", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: RuleSet[] }>(`/api/sync-rule-sets?channel_id=${encodeURIComponent(channelId)}&only_active=false`),
  });
  const ruleSets = ruleSetsQuery.data?.data ?? [];

  const categoryPoolQuery = useQuery({
    queryKey: ["master-category-pool"],
    queryFn: () => shopApiGet<{ data: string[] }>("/api/master-categories"),
  });
  const categoryPool = categoryPoolQuery.data?.data ?? [];

  const [selectedRuleSetId, setSelectedRuleSetId] = useState("");
  useEffect(() => {
    if (!selectedRuleSetId && ruleSets.length > 0) {
      setSelectedRuleSetId(ruleSets[0].rule_set_id);
      return;
    }
    if (selectedRuleSetId && !ruleSets.some((r) => r.rule_set_id === selectedRuleSetId)) {
      setSelectedRuleSetId(ruleSets[0]?.rule_set_id ?? "");
    }
  }, [selectedRuleSetId, ruleSets]);

  const createRuleSet = useMutation({
    mutationFn: (name: string) =>
      shopApiSend<{ data: RuleSet }>("/api/sync-rule-sets", "POST", {
        channel_id: channelId,
        name,
        description: name === DEFAULT_RULESET_NAME ? "채널 기본 룰셋(자동 생성)" : "수동 생성 룰셋",
        is_active: true,
      }),
    onSuccess: async (res) => {
      setSelectedRuleSetId(res.data.rule_set_id);
      await qc.invalidateQueries({ queryKey: ["sync-rule-sets", channelId] });
    },
    onError: async (e: Error) => {
      if (!String(e.message ?? "").toLowerCase().includes("duplicate")) {
        toast.error(e.message);
      }
      await qc.invalidateQueries({ queryKey: ["sync-rule-sets", channelId] });
    },
  });

  useEffect(() => {
    if (!channelId) return;
    if (selectedRuleSetId) return;
    if (ruleSetsQuery.isLoading || ruleSetsQuery.isFetching) return;
    if (ruleSets.length > 0) {
      setSelectedRuleSetId(ruleSets[0].rule_set_id);
      return;
    }
    if (createRuleSet.isPending) return;
    createRuleSet.mutate(DEFAULT_RULESET_NAME);
  }, [channelId, selectedRuleSetId, ruleSets, ruleSetsQuery.isLoading, ruleSetsQuery.isFetching, createRuleSet.isPending]);

  const [includeAllDecorationMaster, setIncludeAllDecorationMaster] = useState(false);
  const poolsQuery = useQuery({
    queryKey: ["master-rule-pools", includeAllDecorationMaster],
    queryFn: () =>
      shopApiGet<{ data: RulePools }>(
        `/api/master-rule-pools?include_all_decoration_master=${includeAllDecorationMaster ? "true" : "false"}`,
      ),
  });

  const pools = poolsQuery.data?.data;
  const materials = pools?.materials ?? [];
  const decorationNames = pools?.decoration_names ?? [];
  const masters = pools?.masters ?? [];
  const platingOptionsQuery = useQuery({
    queryKey: ["plating-options"],
    queryFn: () => shopApiGet<PlatingOption[]>("/api/plating-options"),
  });
  const platingColorOptions = useMemo(
    () => Array.from(new Map((platingOptionsQuery.data ?? []).map((opt) => [String(opt.color_code ?? "").trim().toUpperCase(), opt])).entries())
      .map(([code, opt]) => ({
        color_code: code,
        display_name: String(opt.display_name ?? "").trim() || code,
      }))
      .filter((opt) => Boolean(opt.color_code))
      .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [platingOptionsQuery.data],
  );
  const platingLabelByCode = useMemo(
    () => new Map(platingColorOptions.map((opt) => [opt.color_code, `${opt.display_name} (${opt.color_code})`])),
    [platingColorOptions],
  );

  const [activeSection, setActiveSection] = useState<RuleSection>("MATERIAL");

  const r1Query = useQuery({
    queryKey: ["sync-r1", selectedRuleSetId],
    enabled: Boolean(selectedRuleSetId),
    queryFn: () => shopApiGet<{ data: R1Rule[] }>(`/api/sync-rules/r1?rule_set_id=${encodeURIComponent(selectedRuleSetId)}`),
  });
  const r2Query = useQuery({
    queryKey: ["sync-r2", selectedRuleSetId],
    enabled: Boolean(selectedRuleSetId),
    queryFn: () => shopApiGet<{ data: R2Rule[] }>(`/api/sync-rules/r2?rule_set_id=${encodeURIComponent(selectedRuleSetId)}`),
  });
  const r3Query = useQuery({
    queryKey: ["sync-r3", selectedRuleSetId],
    enabled: Boolean(selectedRuleSetId),
    queryFn: () => shopApiGet<{ data: R3Rule[] }>(`/api/sync-rules/r3?rule_set_id=${encodeURIComponent(selectedRuleSetId)}`),
  });
  const r4Query = useQuery({
    queryKey: ["sync-r4", selectedRuleSetId],
    enabled: Boolean(selectedRuleSetId),
    queryFn: () => shopApiGet<{ data: R4Rule[] }>(`/api/sync-rules/r4?rule_set_id=${encodeURIComponent(selectedRuleSetId)}`),
  });

  const [sourceTabCode, setSourceTabCode] = useState("");
  useEffect(() => {
    if (!sourceTabCode && materials.length > 0) setSourceTabCode(materials[0]);
    if (sourceTabCode && !materials.includes(sourceTabCode)) setSourceTabCode(materials[0] ?? "");
  }, [sourceTabCode, materials]);
  const r1TargetOptions = materials.filter((m) => m !== sourceTabCode);

  const [r1Target, setR1Target] = useState("");
  useEffect(() => {
    if (r1TargetOptions.length === 0) {
      setR1Target("");
      return;
    }
    if (!r1Target || !r1TargetOptions.includes(r1Target)) {
      setR1Target(r1TargetOptions[0]);
    }
  }, [r1Target, r1TargetOptions]);
  const [r1Mul, setR1Mul] = useState("1");
  const [r1RoundUnit, setR1RoundUnit] = useState("100");
  const [r1RoundMode, setR1RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");
  const [editingR1RuleId, setEditingR1RuleId] = useState("");

  const createR1 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r1", "POST", {
        rule_set_id: selectedRuleSetId,
        source_material_code: sourceTabCode,
        target_material_code: r1Target,
        match_category_code: null,
        weight_min_g: null,
        weight_max_g: null,
        option_weight_multiplier: parseN(r1Mul, 1),
        rounding_unit: parseN(r1RoundUnit, 100),
        rounding_mode: r1RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R1 룰 추가 완료");
      await qc.invalidateQueries({ queryKey: ["sync-r1", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateR1 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r1", "PUT", {
        rule_id: editingR1RuleId,
        source_material_code: sourceTabCode,
        target_material_code: r1Target,
        match_category_code: null,
        weight_min_g: null,
        weight_max_g: null,
        option_weight_multiplier: parseN(r1Mul, 1),
        rounding_unit: parseN(r1RoundUnit, 100),
        rounding_mode: r1RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R1 룰 수정 완료");
      setEditingR1RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r1", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteR1 = useMutation({
    mutationFn: (ruleId: string) => shopApiSend("/api/sync-rules/r1", "DELETE", { rule_id: ruleId }),
    onSuccess: async () => {
      toast.success("R1 룰 삭제 완료");
      setEditingR1RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r1", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditR1 = (rule: R1Rule) => {
    setEditingR1RuleId(rule.rule_id);
    setSourceTabCode(rule.source_material_code ?? materials[0] ?? "");
    setR1Target(rule.target_material_code);
    setR1Mul(String(Number(rule.option_weight_multiplier ?? 1)));
    setR1RoundUnit(String(Number(rule.rounding_unit ?? 100)));
    setR1RoundMode(rule.rounding_mode ?? "CEIL");
  };

  const cancelEditR1 = () => {
    setEditingR1RuleId("");
  };

  const [r2SourceMaterial, setR2SourceMaterial] = useState("");
  useEffect(() => {
    if (!r2SourceMaterial && materials.length > 0) setR2SourceMaterial(materials[0]);
    if (r2SourceMaterial && !materials.includes(r2SourceMaterial)) setR2SourceMaterial(materials[0] ?? "");
  }, [r2SourceMaterial, materials]);
  const [r2Category, setR2Category] = useState("");
  useEffect(() => {
    if (!r2Category && categoryPool.length > 0) setR2Category(categoryPool[0]);
    if (r2Category && !categoryPool.includes(r2Category)) setR2Category(categoryPool[0] ?? "");
  }, [r2Category, categoryPool]);
  const [r2MarginMajor, setR2MarginMajor] = useState("0");
  const [r2MarginMinor, setR2MarginMinor] = useState("0");
  const [r2RoundUnit, setR2RoundUnit] = useState("100");
  const [r2RoundMode, setR2RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");
  const [editingR2RuleId, setEditingR2RuleId] = useState("");

  const createR2 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r2", "POST", {
        rule_set_id: selectedRuleSetId,
        linked_r1_rule_id: null,
        match_material_code: r2SourceMaterial || null,
        match_category_code: r2Category || null,
        margin_min_krw: toAmountKrw(r2MarginMajor, r2MarginMinor),
        margin_max_krw: toAmountKrw(r2MarginMajor, r2MarginMinor),
        delta_krw: 0,
        rounding_unit: parseN(r2RoundUnit, 100),
        rounding_mode: r2RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R2 룰 추가 완료");
      await qc.invalidateQueries({ queryKey: ["sync-r2", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateR2 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r2", "PUT", {
        rule_id: editingR2RuleId,
        linked_r1_rule_id: null,
        match_material_code: r2SourceMaterial || null,
        match_category_code: r2Category || null,
        margin_min_krw: toAmountKrw(r2MarginMajor, r2MarginMinor),
        margin_max_krw: toAmountKrw(r2MarginMajor, r2MarginMinor),
        delta_krw: 0,
        rounding_unit: parseN(r2RoundUnit, 100),
        rounding_mode: r2RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R2 룰 수정 완료");
      setEditingR2RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r2", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteR2 = useMutation({
    mutationFn: (ruleId: string) => shopApiSend("/api/sync-rules/r2", "DELETE", { rule_id: ruleId }),
    onSuccess: async () => {
      toast.success("R2 룰 삭제 완료");
      setEditingR2RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r2", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditR2 = (rule: R2Rule) => {
    const split = splitAmountKrw(rule.margin_min_krw ?? rule.margin_max_krw ?? 0);
    setEditingR2RuleId(rule.rule_id);
    setR2SourceMaterial(rule.match_material_code ?? materials[0] ?? "");
    setR2Category(rule.match_category_code ?? categoryPool[0] ?? "");
    setR2MarginMajor(split.major);
    setR2MarginMinor(split.minor);
    setR2RoundUnit(String(Number(rule.rounding_unit ?? 100)));
    setR2RoundMode(rule.rounding_mode ?? "CEIL");
  };

  const cancelEditR2 = () => setEditingR2RuleId("");

  const [r3Color, setR3Color] = useState("");
  const [editingR3RuleId, setEditingR3RuleId] = useState("");
  useEffect(() => {
    const codes = platingColorOptions.map((opt) => opt.color_code);
    if (!r3Color && codes.length > 0) setR3Color(codes[0]);
    if (r3Color && !codes.includes(r3Color)) setR3Color(codes[0] ?? "");
  }, [r3Color, platingColorOptions]);
  const [r3MarginMajor, setR3MarginMajor] = useState("0");
  const [r3MarginMinor, setR3MarginMinor] = useState("0");
  const [r3RoundUnit, setR3RoundUnit] = useState("100");
  const [r3RoundMode, setR3RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");

  const createR3 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r3", "POST", {
        rule_set_id: selectedRuleSetId,
        color_code: r3Color,
        margin_min_krw: toAmountKrw(r3MarginMajor, r3MarginMinor),
        margin_max_krw: toAmountKrw(r3MarginMajor, r3MarginMinor),
        delta_krw: 0,
        rounding_unit: parseN(r3RoundUnit, 100),
        rounding_mode: r3RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R3 룰 추가 완료");
      await qc.invalidateQueries({ queryKey: ["sync-r3", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateR3 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r3", "PUT", {
        rule_id: editingR3RuleId,
        color_code: r3Color,
        margin_min_krw: toAmountKrw(r3MarginMajor, r3MarginMinor),
        margin_max_krw: toAmountKrw(r3MarginMajor, r3MarginMinor),
        delta_krw: 0,
        rounding_unit: parseN(r3RoundUnit, 100),
        rounding_mode: r3RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R3 룰 수정 완료");
      setEditingR3RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r3", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteR3 = useMutation({
    mutationFn: (ruleId: string) => shopApiSend("/api/sync-rules/r3", "DELETE", { rule_id: ruleId }),
    onSuccess: async () => {
      toast.success("R3 룰 삭제 완료");
      setEditingR3RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r3", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditR3 = (rule: R3Rule) => {
    const split = splitAmountKrw(rule.margin_min_krw ?? rule.margin_max_krw);
    setEditingR3RuleId(rule.rule_id);
    setR3Color(rule.color_code);
    setR3MarginMajor(split.major);
    setR3MarginMinor(split.minor);
    setR3RoundUnit(String(Number(rule.rounding_unit ?? 100)));
    setR3RoundMode(rule.rounding_mode ?? "CEIL");
  };

  const cancelEditR3 = () => setEditingR3RuleId("");

  const [r4Decoration, setR4Decoration] = useState("");
  const decorationOptions = useMemo(() => {
    return decorationNames.map((name) => {
      const matchedMaster = masters.find((m) => (m.model_name ?? "").trim() === name) ?? null;
      return {
        name,
        totalLaborSellKrw: matchedMaster?.total_labor_sell_krw ?? null,
      };
    });
  }, [decorationNames, masters]);
  const selectedDecorationOption = decorationOptions.find((opt) => opt.name === r4Decoration) ?? null;
  useEffect(() => {
    if (!r4Decoration && decorationOptions.length > 0) setR4Decoration(decorationOptions[0].name);
    if (r4Decoration && !decorationOptions.some((opt) => opt.name === r4Decoration)) setR4Decoration(decorationOptions[0]?.name ?? "");
  }, [r4Decoration, decorationOptions]);
  const [r4Delta, setR4Delta] = useState("0");
  const [r4Multiplier, setR4Multiplier] = useState("0");
  const [r4AdjustMode, setR4AdjustMode] = useState<"DELTA" | "MULTIPLIER">("DELTA");
  const [r4RoundUnit, setR4RoundUnit] = useState("100");
  const [r4RoundMode, setR4RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");
  const [editingR4RuleId, setEditingR4RuleId] = useState("");

  const r4ComputedDelta = useMemo(() => {
    if (r4AdjustMode === "DELTA") return parseN(r4Delta, 0);
    const labor = selectedDecorationOption?.totalLaborSellKrw ?? 0;
    const ratio = parseN(r4Multiplier, 0) / 100;
    const raw = labor * ratio;
    return Math.round(raw / 100) * 100;
  }, [r4AdjustMode, r4Delta, r4Multiplier, selectedDecorationOption]);

  const createR4 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r4", "POST", {
        rule_set_id: selectedRuleSetId,
        linked_r1_rule_id: null,
        match_material_code: null,
        match_color_code: null,
        match_decoration_code: r4Decoration,
        match_category_code: null,
        delta_krw: r4ComputedDelta,
        rounding_unit: parseN(r4RoundUnit, 100),
        rounding_mode: r4RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R4 룰 추가 완료");
      await qc.invalidateQueries({ queryKey: ["sync-r4", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateR4 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r4", "PUT", {
        rule_id: editingR4RuleId,
        linked_r1_rule_id: null,
        match_material_code: null,
        match_color_code: null,
        match_decoration_code: r4Decoration,
        match_category_code: null,
        delta_krw: r4ComputedDelta,
        rounding_unit: parseN(r4RoundUnit, 100),
        rounding_mode: r4RoundMode,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("R4 룰 수정 완료");
      setEditingR4RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r4", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteR4 = useMutation({
    mutationFn: (ruleId: string) => shopApiSend("/api/sync-rules/r4", "DELETE", { rule_id: ruleId }),
    onSuccess: async () => {
      toast.success("R4 룰 삭제 완료");
      setEditingR4RuleId("");
      await qc.invalidateQueries({ queryKey: ["sync-r4", selectedRuleSetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditR4 = (rule: R4Rule) => {
    setEditingR4RuleId(rule.rule_id);
    setR4Decoration(rule.match_decoration_code);
    setR4AdjustMode("DELTA");
    setR4Delta(String(Number(rule.delta_krw ?? 0)));
    setR4Multiplier("0");
    setR4RoundUnit(String(Number(rule.rounding_unit ?? 100)));
    setR4RoundMode(rule.rounding_mode ?? "CEIL");
  };

  const cancelEditR4 = () => setEditingR4RuleId("");

  const [laborMasterId, setLaborMasterId] = useState("");
  const [laborDelta, setLaborDelta] = useState("0");
  const [laborReason, setLaborReason] = useState("");
  useEffect(() => {
    if (!laborMasterId && masters.length > 0) setLaborMasterId(masters[0].master_item_id);
    if (laborMasterId && !masters.some((m) => m.master_item_id === laborMasterId)) setLaborMasterId(masters[0]?.master_item_id ?? "");
  }, [laborMasterId, masters]);
  const selectedLaborMaster = masters.find((m) => m.master_item_id === laborMasterId) ?? null;

  const laborLogQuery = useQuery({
    queryKey: ["channel-labor-price-adjustments", channelId, laborMasterId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: LaborLog[] }>(`/api/channel-labor-price-adjustments?channel_id=${encodeURIComponent(channelId)}&master_item_id=${encodeURIComponent(laborMasterId)}&limit=30`),
  });

  const addLaborAdjustment = useMutation({
    mutationFn: () =>
      shopApiSend("/api/channel-labor-price-adjustments", "POST", {
        channel_id: channelId,
        master_item_id: laborMasterId,
        delta_krw: parseN(laborDelta, 0),
        reason: laborReason.trim(),
      }),
    onSuccess: async () => {
      toast.success("총공임 조정 로그 저장 완료");
      setLaborReason("");
      await qc.invalidateQueries({ queryKey: ["channel-labor-price-adjustments", channelId, laborMasterId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coreDisabledReason = !channelId
    ? "채널을 선택하세요"
    : !selectedRuleSetId
      ? "기본 룰셋 자동 생성 중입니다"
      : "";

  return (
    <div className="space-y-4">
      <ActionBar title="옵션 룰 설정" subtitle="채널 기본 룰셋 자동 생성 + 마스터 풀 선택 운영" />

      <ShoppingPageHeader
        purpose="옵션 룰(R1~R4)과 총공임 조정을 통해 옵션 가격 계산 규칙을 명확하게 운영합니다."
        status={[
          { label: "룰셋", value: `${ruleSets.length}개` },
          { label: "선택 룰셋", value: selectedRuleSetId ? "선택됨" : "자동생성 대기", tone: selectedRuleSetId ? "good" : "warn" },
          { label: "작업 가능", value: coreDisabledReason ? "대기" : "가능", tone: coreDisabledReason ? "warn" : "good" },
        ]}
        nextActions={[
          { label: "자동 가격으로", href: "/settings/shopping/auto-price" },
          { label: "정책/팩터로", href: "/settings/shopping/factors" },
        ]}
      />

      <Card>
        <CardHeader title="채널" description="룰셋은 채널별 기본값으로 자동 생성됩니다" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">채널</div>
              <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">채널 선택</option>
                {channels.map((c) => <option key={c.channel_id} value={c.channel_id}>{c.channel_name}</option>)}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">적용 룰셋</div>
              <Input value={(ruleSets.find((r) => r.rule_set_id === selectedRuleSetId)?.name ?? "") || "자동 생성 중"} disabled />
            </div>
          </div>
          {coreDisabledReason ? <div className="text-xs text-[var(--muted)]">{coreDisabledReason}</div> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="총공임 기준 조정" description="마스터 총공임 판매값 기준으로 + / - 조정, 사유 로그 필수" />
        <CardBody className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">마스터</div>
              <Select value={laborMasterId} onChange={(e) => setLaborMasterId(e.target.value)}>
                <option value="">마스터 선택</option>
                {masters.map((m) => <option key={m.master_item_id} value={m.master_item_id}>{m.model_name ?? m.master_item_id}</option>)}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">총공임 판매값(기준)</div>
              <Input value={selectedLaborMaster ? selectedLaborMaster.total_labor_sell_krw.toLocaleString() : "-"} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">조정 금액(+/-)</div>
              <Input type="number" step={100} value={laborDelta} onChange={(e) => setLaborDelta(e.target.value)} placeholder="예: 5000 / -3000" />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">사유</div>
              <Input value={laborReason} onChange={(e) => setLaborReason(e.target.value)} placeholder="사유 필수" />
            </div>
          </div>
          <Button onClick={() => addLaborAdjustment.mutate()} disabled={!channelId || !laborMasterId || !laborReason.trim() || parseN(laborDelta, 0) === 0 || addLaborAdjustment.isPending}>총공임 조정 로그 저장</Button>
          <div className="max-h-[160px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">시각</th><th className="px-3 py-2">조정</th><th className="px-3 py-2">사유</th></tr></thead>
              <tbody>{(laborLogQuery.data?.data ?? []).map((row) => <tr key={row.adjustment_log_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td><td className="px-3 py-2">{Number(row.delta_krw).toLocaleString()}</td><td className="px-3 py-2">{row.reason}</td></tr>)}</tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="flex min-h-[620px] overflow-hidden rounded border border-[var(--hairline)] bg-[var(--panel)]">
        <div className="w-60 border-r border-[var(--hairline)] p-2">
          {([
            { key: "MATERIAL", label: "소재룰", desc: "R1 소재 전환" },
            { key: "SIZE", label: "사이즈룰", desc: "R2 단일 마진" },
            { key: "PLATING", label: "도금룰", desc: "R3 색상+마진" },
            { key: "DECORATION", label: "장식룰", desc: "R4 소재/색상/장식" },
          ] as Array<{ key: RuleSection; label: string; desc: string }>).map((item) => (
            <button key={item.key} onClick={() => setActiveSection(item.key)} className={`mb-2 w-full rounded border p-3 text-left ${activeSection === item.key ? "border-[var(--primary)] bg-[var(--chip)]" : "border-[var(--hairline)]"}`}>
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="text-xs text-[var(--muted)]">{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeSection === "MATERIAL" ? (
            <Card>
              <CardHeader title="소재룰 (R1)" description="Source/Target은 마스터/시세 소재 전체 풀" />
              <CardBody className="space-y-3">
                <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  등록 {r1Query.data?.data?.length ?? 0}건 · Source→Target 전환만 관리합니다.
                </div>
                <div className="flex flex-wrap gap-2">{materials.map((code) => <Button key={code} variant="secondary" onClick={() => setSourceTabCode(code)} className={sourceTabCode === code ? "ring-2 ring-[var(--primary)]" : ""}>Source {code}</Button>)}</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">Source</div><Input value={sourceTabCode} disabled /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">Target</div><Select value={r1Target} onChange={(e) => setR1Target(e.target.value)}>{r1TargetOptions.map((code) => <option key={code} value={code}>{code}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">중량보정계수</div><Input value={r1Mul} onChange={(e) => setR1Mul(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r1RoundUnit} onChange={(e) => setR1RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div className="space-y-1"><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => (editingR1RuleId ? updateR1.mutate() : createR1.mutate())} disabled={Boolean(coreDisabledReason) || !sourceTabCode || !r1Target || createR1.isPending || updateR1.isPending}>{editingR1RuleId ? "R1 수정 저장" : "R1 추가"}</Button>{editingR1RuleId ? <Button variant="ghost" onClick={cancelEditR1}>수정 취소</Button> : null}</div>
                </div>
                <Select value={r1RoundMode} onChange={(e) => setR1RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>{ROUNDING_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">중량보정</th><th className="px-3 py-2">라운딩</th><th className="px-3 py-2">관리</th></tr></thead><tbody>{(r1Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.source_material_code ?? "*"}</td><td className="px-3 py-2">{r.target_material_code}</td><td className="px-3 py-2">{r.option_weight_multiplier}</td><td className="px-3 py-2">{r.rounding_unit}/{ROUNDING_MODE_LABEL[r.rounding_mode]}</td><td className="px-3 py-2"><div className="flex gap-1"><Button variant="secondary" onClick={() => startEditR1(r)}>수정</Button><Button variant="ghost" onClick={() => deleteR1.mutate(r.rule_id)} disabled={deleteR1.isPending}>삭제</Button></div></td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "SIZE" ? (
            <Card>
              <CardHeader title="사이즈룰 (R2)" description="Source 소재 + 카테고리 기준, 단일 마진과 추가금 운영" />
              <CardBody className="space-y-2">
                <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  등록 {r2Query.data?.data?.length ?? 0}건 · 소재+카테고리 단일 마진 규칙입니다.
                </div>
                <div className="flex flex-wrap gap-2">{materials.map((code) => <Button key={code} variant="secondary" onClick={() => setR2SourceMaterial(code)} className={r2SourceMaterial === code ? "ring-2 ring-[var(--primary)]" : ""}>Source {code}</Button>)}</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">Source</div><Input value={r2SourceMaterial} disabled /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">카테고리</div><Select value={r2Category} onChange={(e) => setR2Category(e.target.value)}>{categoryPool.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">단일 마진 (만원/원)</div><div className="flex gap-1"><Select value={r2MarginMajor} onChange={(e) => setR2MarginMajor(e.target.value)}>{MAJOR_AMOUNT_OPTIONS.map((v) => <option key={`r2-margin-major-${v}`} value={v}>{v}만원</option>)}</Select><Select value={r2MarginMinor} onChange={(e) => setR2MarginMinor(e.target.value)}>{MINOR_AMOUNT_OPTIONS.map((v) => <option key={`r2-margin-minor-${v}`} value={v}>{v}원</option>)}</Select></div></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r2RoundUnit} onChange={(e) => setR2RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div className="space-y-1"><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => (editingR2RuleId ? updateR2.mutate() : createR2.mutate())} disabled={Boolean(coreDisabledReason) || createR2.isPending || updateR2.isPending}>{editingR2RuleId ? "R2 수정 저장" : "R2 추가"}</Button>{editingR2RuleId ? <Button variant="ghost" onClick={cancelEditR2}>수정 취소</Button> : null}</div>
                </div>
                <Select value={r2RoundMode} onChange={(e) => setR2RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>{ROUNDING_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">카테고리</th><th className="px-3 py-2">단일 마진</th><th className="px-3 py-2">라운딩</th><th className="px-3 py-2">관리</th></tr></thead><tbody>{(r2Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.match_material_code ?? "*"}</td><td className="px-3 py-2">{r.match_category_code ? categoryLabel(r.match_category_code) : "*"}</td><td className="px-3 py-2">{(r.margin_min_krw ?? r.margin_max_krw ?? 0).toLocaleString()}</td><td className="px-3 py-2">{r.rounding_unit}/{ROUNDING_MODE_LABEL[r.rounding_mode]}</td><td className="px-3 py-2"><div className="flex gap-1"><Button variant="secondary" onClick={() => startEditR2(r)}>수정</Button><Button variant="ghost" onClick={() => deleteR2.mutate(r.rule_id)} disabled={deleteR2.isPending}>삭제</Button></div></td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "PLATING" ? (
            <Card>
              <CardHeader title="도금룰 (R3)" description="활성 도금코드별 단일 마진 운영" />
              <CardBody className="space-y-2">
                <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  등록 {r3Query.data?.data?.length ?? 0}건 · 현재 등록 가능한 도금코드: {platingColorOptions.map((opt) => opt.color_code).join(", ") || "없음"}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">도금 코드</div><Select value={r3Color} onChange={(e) => setR3Color(e.target.value)}>{platingColorOptions.map((opt) => <option key={opt.color_code} value={opt.color_code}>{opt.display_name} ({opt.color_code})</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">단일 마진 (만원/원)</div><div className="flex gap-1"><Select value={r3MarginMajor} onChange={(e) => setR3MarginMajor(e.target.value)}>{MAJOR_AMOUNT_OPTIONS.map((v) => <option key={`r3-margin-major-${v}`} value={v}>{v}만원</option>)}</Select><Select value={r3MarginMinor} onChange={(e) => setR3MarginMinor(e.target.value)}>{MINOR_AMOUNT_OPTIONS.map((v) => <option key={`r3-margin-minor-${v}`} value={v}>{v}원</option>)}</Select></div></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r3RoundUnit} onChange={(e) => setR3RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 모드</div><Select value={r3RoundMode} onChange={(e) => setR3RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>{ROUNDING_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select></div>
                  <div className="space-y-1"><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => (editingR3RuleId ? updateR3.mutate() : createR3.mutate())} disabled={Boolean(coreDisabledReason) || !r3Color || createR3.isPending || updateR3.isPending}>{editingR3RuleId ? "R3 수정 저장" : "R3 추가"}</Button>{editingR3RuleId ? <Button variant="ghost" onClick={cancelEditR3}>수정 취소</Button> : null}</div>
                </div>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">도금 코드</th><th className="px-3 py-2">단일 마진</th><th className="px-3 py-2">라운딩</th><th className="px-3 py-2">관리</th></tr></thead><tbody>{(r3Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{platingLabelByCode.get(r.color_code) ?? r.color_code}</td><td className="px-3 py-2">{(r.margin_min_krw ?? r.margin_max_krw).toLocaleString()}</td><td className="px-3 py-2">{r.rounding_unit}/{ROUNDING_MODE_LABEL[r.rounding_mode]}</td><td className="px-3 py-2"><div className="flex gap-1"><Button variant="secondary" onClick={() => startEditR3(r)}>수정</Button><Button variant="ghost" onClick={() => deleteR3.mutate(r.rule_id)} disabled={deleteR3.isPending}>삭제</Button></div></td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "DECORATION" ? (
            <Card>
              <CardHeader title="장식룰 (R4)" description="장식 선택 후 총공임(판매) 기준으로 +/- 또는 마진 배율 적용" />
              <CardBody className="space-y-2">
                <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  등록 {r4Query.data?.data?.length ?? 0}건 · 장식별 추가금 규칙입니다.
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input id="all-master-toggle" type="checkbox" checked={includeAllDecorationMaster} onChange={(e) => setIncludeAllDecorationMaster(e.target.checked)} />
                  <label htmlFor="all-master-toggle">전체 마스터에서 장식이름 찾기 (기본: ACCESSORY만)</label>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
                  <div className="md:col-span-2"><div className="mb-1 text-xs text-[var(--muted)]">장식이름</div><Select value={r4Decoration} onChange={(e) => setR4Decoration(e.target.value)}>{decorationOptions.map((d) => <option key={d.name} value={d.name}>{d.totalLaborSellKrw == null ? d.name : `${d.name} / 총공임 ${d.totalLaborSellKrw.toLocaleString()}원`}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">적용 방식</div><Select value={r4AdjustMode} onChange={(e) => setR4AdjustMode(e.target.value as "DELTA" | "MULTIPLIER") }><option value="DELTA">고정 추가금(+/-)</option><option value="MULTIPLIER">마진 배율(%)</option></Select></div>
                  {r4AdjustMode === "DELTA" ? <div><div className="mb-1 text-xs text-[var(--muted)]">추가금(100원 단위)</div><Input type="number" step={100} value={r4Delta} onChange={(e) => setR4Delta(e.target.value)} /></div> : <div><div className="mb-1 text-xs text-[var(--muted)]">마진 배율(%)</div><Input type="number" step={0.1} value={r4Multiplier} onChange={(e) => setR4Multiplier(e.target.value)} placeholder="예: 10 / -5" /></div>}
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r4RoundUnit} onChange={(e) => setR4RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div className="space-y-1"><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => (editingR4RuleId ? updateR4.mutate() : createR4.mutate())} disabled={Boolean(coreDisabledReason) || !r4Decoration || createR4.isPending || updateR4.isPending}>{editingR4RuleId ? "R4 수정 저장" : "R4 추가"}</Button>{editingR4RuleId ? <Button variant="ghost" onClick={cancelEditR4}>수정 취소</Button> : null}</div>
                </div>
                <div className="text-xs text-[var(--muted)]">선택 장식 총공임 판매값: {selectedDecorationOption?.totalLaborSellKrw == null ? "-" : `${selectedDecorationOption.totalLaborSellKrw.toLocaleString()}원`}</div>
                <div className="text-xs text-[var(--muted)]">계산된 추가금: {r4ComputedDelta.toLocaleString()}원</div>
                <Select value={r4RoundMode} onChange={(e) => setR4RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>{ROUNDING_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">장식이름</th><th className="px-3 py-2">추가금</th><th className="px-3 py-2">라운딩</th><th className="px-3 py-2">관리</th></tr></thead><tbody>{(r4Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.match_decoration_code}</td><td className="px-3 py-2">{r.delta_krw.toLocaleString()}</td><td className="px-3 py-2">{r.rounding_unit}/{ROUNDING_MODE_LABEL[r.rounding_mode]}</td><td className="px-3 py-2"><div className="flex gap-1"><Button variant="secondary" onClick={() => startEditR4(r)}>수정</Button><Button variant="ghost" onClick={() => deleteR4.mutate(r.rule_id)} disabled={deleteR4.isPending}>삭제</Button></div></td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
