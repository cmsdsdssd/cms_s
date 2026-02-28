"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_name: string; channel_code: string };
type RuleSet = { rule_set_id: string; channel_id: string; name: string; description: string | null; is_active: boolean };
type RuleSection = "MATERIAL" | "SIZE" | "PLATING" | "DECORATION";

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
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const RULESET_PREFIX = "CAT::";
const ROUNDING_UNIT_OPTIONS = Array.from({ length: 100 }, (_, idx) => String((idx + 1) * 100));

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

  const [selectedCategoryCode, setSelectedCategoryCode] = useState("");
  useEffect(() => {
    if (!selectedCategoryCode && categoryPool.length > 0) setSelectedCategoryCode(categoryPool[0]);
  }, [selectedCategoryCode, categoryPool]);

  const desiredRuleSetName = selectedCategoryCode ? `${RULESET_PREFIX}${selectedCategoryCode}` : "";
  const selectedRuleSetId = useMemo(() => {
    if (!desiredRuleSetName) return "";
    return ruleSets.find((r) => r.name === desiredRuleSetName)?.rule_set_id ?? "";
  }, [desiredRuleSetName, ruleSets]);

  const ensureCategoryRuleSet = useMutation({
    mutationFn: () =>
      shopApiSend<{ data: RuleSet }>("/api/sync-rule-sets", "POST", {
        channel_id: channelId,
        name: desiredRuleSetName,
        description: `카테고리 자동 룰셋(${selectedCategoryCode})`,
        is_active: true,
      }),
    onSuccess: async () => {
      toast.success("카테고리 룰셋 생성 완료");
      await qc.invalidateQueries({ queryKey: ["sync-rule-sets", channelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [includeAllDecorationMaster, setIncludeAllDecorationMaster] = useState(false);
  const poolsQuery = useQuery({
    queryKey: ["master-rule-pools", selectedCategoryCode, includeAllDecorationMaster],
    enabled: Boolean(selectedCategoryCode),
    queryFn: () =>
      shopApiGet<{ data: RulePools }>(
        `/api/master-rule-pools?category_code=${encodeURIComponent(selectedCategoryCode)}&include_all_decoration_master=${includeAllDecorationMaster ? "true" : "false"}`,
      ),
  });

  const pools = poolsQuery.data?.data;
  const materials = pools?.materials ?? [];
  const colors = pools?.colors ?? [];
  const decorationNames = pools?.decoration_names ?? [];
  const masters = pools?.masters ?? [];

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

  const createR1 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r1", "POST", {
        rule_set_id: selectedRuleSetId,
        source_material_code: sourceTabCode,
        target_material_code: r1Target,
        match_category_code: selectedCategoryCode || null,
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

  const [r2LinkedR1, setR2LinkedR1] = useState("");
  const [r2Material, setR2Material] = useState("");
  const [r2MarginMin, setR2MarginMin] = useState("0");
  const [r2MarginMax, setR2MarginMax] = useState("1000000");
  const [r2Delta, setR2Delta] = useState("0");
  const [r2RoundUnit, setR2RoundUnit] = useState("100");
  const [r2RoundMode, setR2RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");

  const createR2 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r2", "POST", {
        rule_set_id: selectedRuleSetId,
        linked_r1_rule_id: r2LinkedR1 || null,
        match_material_code: r2Material || null,
        match_category_code: selectedCategoryCode || null,
        margin_min_krw: parseN(r2MarginMin, 0),
        margin_max_krw: parseN(r2MarginMax, 1000000),
        delta_krw: parseN(r2Delta, 0),
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

  const [r3Color, setR3Color] = useState("");
  useEffect(() => {
    if (!r3Color && colors.length > 0) setR3Color(colors[0]);
  }, [r3Color, colors]);
  const [r3MarginMin, setR3MarginMin] = useState("0");
  const [r3MarginMax, setR3MarginMax] = useState("10000");
  const [r3Delta, setR3Delta] = useState("0");
  const [r3RoundUnit, setR3RoundUnit] = useState("100");
  const [r3RoundMode, setR3RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");

  const createR3 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r3", "POST", {
        rule_set_id: selectedRuleSetId,
        color_code: r3Color,
        margin_min_krw: parseN(r3MarginMin, 0),
        margin_max_krw: parseN(r3MarginMax, 10000),
        delta_krw: parseN(r3Delta, 0),
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

  const [r4LinkedR1, setR4LinkedR1] = useState("");
  const [r4Material, setR4Material] = useState("");
  const [r4Color, setR4Color] = useState("");
  const [r4Decoration, setR4Decoration] = useState("");
  useEffect(() => {
    if (!r4Color && colors.length > 0) setR4Color(colors[0]);
    if (!r4Decoration && decorationNames.length > 0) setR4Decoration(decorationNames[0]);
  }, [r4Color, r4Decoration, colors, decorationNames]);
  const [r4Delta, setR4Delta] = useState("0");
  const [r4RoundUnit, setR4RoundUnit] = useState("100");
  const [r4RoundMode, setR4RoundMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");

  const createR4 = useMutation({
    mutationFn: () =>
      shopApiSend("/api/sync-rules/r4", "POST", {
        rule_set_id: selectedRuleSetId,
        linked_r1_rule_id: r4LinkedR1 || null,
        match_material_code: r4Material || null,
        match_color_code: r4Color || null,
        match_decoration_code: r4Decoration,
        match_category_code: selectedCategoryCode || null,
        delta_krw: parseN(r4Delta, 0),
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
    : !selectedCategoryCode
      ? "카테고리를 선택하세요"
      : !selectedRuleSetId
        ? "카테고리 룰셋이 없습니다"
        : "";

  return (
    <div className="space-y-4">
      <ActionBar title="옵션 룰 설정" subtitle="카테고리 기반 자동 룰셋 + 마스터 풀 선택 운영" />

      <Card>
        <CardHeader title="채널/카테고리" description="룰셋은 카테고리별 자동 이름(CAT::카테고리)으로 사용" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">채널</div>
              <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">채널 선택</option>
                {channels.map((c) => <option key={c.channel_id} value={c.channel_id}>{c.channel_name}</option>)}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">카테고리(마스터 전체 풀)</div>
              <Select value={selectedCategoryCode} onChange={(e) => setSelectedCategoryCode(e.target.value)}>
                <option value="">카테고리 선택</option>
                {categoryPool.map((code) => <option key={code} value={code}>{code}</option>)}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">룰셋 이름</div>
              <Input value={desiredRuleSetName} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">룰셋 생성/연결</div>
              <Button onClick={() => ensureCategoryRuleSet.mutate()} disabled={ensureCategoryRuleSet.isPending || !channelId || !selectedCategoryCode || Boolean(selectedRuleSetId)}>
                {selectedRuleSetId ? "연결됨" : "카테고리 룰셋 생성"}
              </Button>
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
            { key: "SIZE", label: "사이즈룰", desc: "R2 마진밴드" },
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
                <div className="flex flex-wrap gap-2">{materials.map((code) => <Button key={code} variant="secondary" onClick={() => setSourceTabCode(code)} className={sourceTabCode === code ? "ring-2 ring-[var(--primary)]" : ""}>Source {code}</Button>)}</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">Source</div><Input value={sourceTabCode} disabled /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">Target</div><Select value={r1Target} onChange={(e) => setR1Target(e.target.value)}>{r1TargetOptions.map((code) => <option key={code} value={code}>{code}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">카테고리</div><Input value={selectedCategoryCode} disabled /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">중량보정계수</div><Input value={r1Mul} onChange={(e) => setR1Mul(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r1RoundUnit} onChange={(e) => setR1RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => createR1.mutate()} disabled={Boolean(coreDisabledReason) || !sourceTabCode || !r1Target || createR1.isPending}>R1 추가</Button></div>
                </div>
                <Select value={r1RoundMode} onChange={(e) => setR1RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }><option value="CEIL">CEIL</option><option value="ROUND">ROUND</option><option value="FLOOR">FLOOR</option></Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">카테고리</th><th className="px-3 py-2">중량보정</th><th className="px-3 py-2">라운딩</th></tr></thead><tbody>{(r1Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.source_material_code ?? "*"}</td><td className="px-3 py-2">{r.target_material_code}</td><td className="px-3 py-2">{r.match_category_code ?? "*"}</td><td className="px-3 py-2">{r.option_weight_multiplier}</td><td className="px-3 py-2">{r.rounding_unit}/{r.rounding_mode}</td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "SIZE" ? (
            <Card>
              <CardHeader title="사이즈룰 (R2)" description="사이즈식 제거, R1 결과 마진밴드 기준" />
              <CardBody className="space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">R1 링크</div><Select value={r2LinkedR1} onChange={(e) => setR2LinkedR1(e.target.value)}><option value="">링크 없음</option>{(r1Query.data?.data ?? []).map((r) => <option key={r.rule_id} value={r.rule_id}>{`${r.source_material_code ?? "*"} -> ${r.target_material_code}`}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">소재(선택)</div><Select value={r2Material} onChange={(e) => setR2Material(e.target.value)}><option value="">전체 소재</option>{materials.map((m) => <option key={m} value={m}>{m}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">R1 마진 최소(100원 단위)</div><Input type="number" step={100} value={r2MarginMin} onChange={(e) => setR2MarginMin(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">R1 마진 최대(100원 단위)</div><Input type="number" step={100} value={r2MarginMax} onChange={(e) => setR2MarginMax(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">추가금(100원 단위)</div><Input type="number" step={100} value={r2Delta} onChange={(e) => setR2Delta(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r2RoundUnit} onChange={(e) => setR2RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => createR2.mutate()} disabled={Boolean(coreDisabledReason) || createR2.isPending}>R2 추가</Button></div>
                </div>
                <Select value={r2RoundMode} onChange={(e) => setR2RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }><option value="CEIL">CEIL</option><option value="ROUND">ROUND</option><option value="FLOOR">FLOOR</option></Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">소재</th><th className="px-3 py-2">마진밴드</th><th className="px-3 py-2">추가금</th><th className="px-3 py-2">R1 링크</th></tr></thead><tbody>{(r2Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.match_material_code ?? "*"}</td><td className="px-3 py-2">{r.margin_min_krw ?? "-"} ~ {r.margin_max_krw ?? "-"}</td><td className="px-3 py-2">{r.delta_krw.toLocaleString()}</td><td className="px-3 py-2">{r.linked_r1_rule_id?.slice(0, 8) ?? "-"}</td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "PLATING" ? (
            <Card>
              <CardHeader title="도금룰 (R3)" description="색상 풀(마스터/도금)에서 선택 + 마진밴드" />
              <CardBody className="space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">색상</div><Select value={r3Color} onChange={(e) => setR3Color(e.target.value)}>{colors.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">마진 최소(100원 단위)</div><Input type="number" step={100} value={r3MarginMin} onChange={(e) => setR3MarginMin(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">마진 최대(100원 단위)</div><Input type="number" step={100} value={r3MarginMax} onChange={(e) => setR3MarginMax(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">추가금(100원 단위)</div><Input type="number" step={100} value={r3Delta} onChange={(e) => setR3Delta(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r3RoundUnit} onChange={(e) => setR3RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 모드</div><Select value={r3RoundMode} onChange={(e) => setR3RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }><option value="CEIL">CEIL</option><option value="ROUND">ROUND</option><option value="FLOOR">FLOOR</option></Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => createR3.mutate()} disabled={Boolean(coreDisabledReason) || !r3Color || createR3.isPending}>R3 추가</Button></div>
                </div>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">색상</th><th className="px-3 py-2">마진</th><th className="px-3 py-2">추가금</th></tr></thead><tbody>{(r3Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.color_code}</td><td className="px-3 py-2">{r.margin_min_krw.toLocaleString()} ~ {r.margin_max_krw.toLocaleString()}</td><td className="px-3 py-2">{r.delta_krw.toLocaleString()}</td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}

          {activeSection === "DECORATION" ? (
            <Card>
              <CardHeader title="장식룰 (R4)" description="소재 | 색상 | 장식이름 선택, 장식 기본은 ACCESSORY 풀" />
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input id="all-master-toggle" type="checkbox" checked={includeAllDecorationMaster} onChange={(e) => setIncludeAllDecorationMaster(e.target.checked)} />
                  <label htmlFor="all-master-toggle">전체 마스터에서 장식이름 찾기 (기본: ACCESSORY만)</label>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
                  <div><div className="mb-1 text-xs text-[var(--muted)]">R1 링크</div><Select value={r4LinkedR1} onChange={(e) => setR4LinkedR1(e.target.value)}><option value="">링크 없음</option>{(r1Query.data?.data ?? []).map((r) => <option key={r.rule_id} value={r.rule_id}>{`${r.source_material_code ?? "*"} -> ${r.target_material_code}`}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">소재</div><Select value={r4Material} onChange={(e) => setR4Material(e.target.value)}><option value="">전체 소재</option>{materials.map((m) => <option key={m} value={m}>{m}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">색상</div><Select value={r4Color} onChange={(e) => setR4Color(e.target.value)}><option value="">전체 색상</option>{colors.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
                  <div className="md:col-span-2"><div className="mb-1 text-xs text-[var(--muted)]">장식이름</div><Select value={r4Decoration} onChange={(e) => setR4Decoration(e.target.value)}>{decorationNames.map((d) => <option key={d} value={d}>{d}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">추가금(100원 단위)</div><Input type="number" step={100} value={r4Delta} onChange={(e) => setR4Delta(e.target.value)} /></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">라운딩 단위(100원 단위)</div><Select value={r4RoundUnit} onChange={(e) => setR4RoundUnit(e.target.value)}>{ROUNDING_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</Select></div>
                  <div><div className="mb-1 text-xs text-[var(--muted)]">저장</div><Button onClick={() => createR4.mutate()} disabled={Boolean(coreDisabledReason) || !r4Decoration || createR4.isPending}>R4 추가</Button></div>
                </div>
                <Select value={r4RoundMode} onChange={(e) => setR4RoundMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }><option value="CEIL">CEIL</option><option value="ROUND">ROUND</option><option value="FLOOR">FLOOR</option></Select>
                <div className="max-h-[240px] overflow-auto rounded border border-[var(--hairline)]"><table className="w-full text-sm"><thead className="bg-[var(--panel)] text-left"><tr><th className="px-3 py-2">소재</th><th className="px-3 py-2">색상</th><th className="px-3 py-2">장식이름</th><th className="px-3 py-2">추가금</th></tr></thead><tbody>{(r4Query.data?.data ?? []).map((r) => <tr key={r.rule_id} className="border-t border-[var(--hairline)]"><td className="px-3 py-2">{r.match_material_code ?? "*"}</td><td className="px-3 py-2">{r.match_color_code ?? "*"}</td><td className="px-3 py-2">{r.match_decoration_code}</td><td className="px-3 py-2">{r.delta_krw.toLocaleString()}</td></tr>)}</tbody></table></div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
