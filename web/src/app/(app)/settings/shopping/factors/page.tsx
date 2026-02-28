"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_code: string; channel_name: string };
type Policy = {
  policy_id: string;
  channel_id: string;
  policy_name: string;
  margin_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
  option_18k_weight_multiplier: number;
  material_factor_set_id: string | null;
  is_active: boolean;
};
type FactorSet = {
  factor_set_id: string;
  scope: "GLOBAL" | "CHANNEL";
  channel_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  is_global_default: boolean;
};

type FactorRow = {
  material_code: string;
  multiplier: string;
};

type FactorSetDetail = {
  data: {
    factor_set: FactorSet;
    factors: Array<{
      factor_id: string;
      factor_set_id: string;
      material_code: string;
      multiplier: number;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>;
  };
};

type MaterialConfig = {
  material_code: string;
  purity_rate: number;
  material_adjust_factor: number;
  price_basis: "GOLD" | "SILVER" | "NONE";
};

const STANDARD_MATERIAL_CODES = ["14", "18", "24", "925", "999", "00"] as const;

export default function ShoppingFactorsPage() {
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

  const policiesQuery = useQuery({
    queryKey: ["shop-policies", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: Policy[] }>(`/api/pricing-policies?channel_id=${encodeURIComponent(channelId)}`),
  });

  const activePolicy = useMemo(
    () => (policiesQuery.data?.data ?? []).find((p) => p.is_active) ?? null,
    [policiesQuery.data?.data],
  );

  const [marginMultiplier, setMarginMultiplier] = useState("1");
  const [roundingUnit, setRoundingUnit] = useState("1000");
  const [roundingMode, setRoundingMode] = useState<"CEIL" | "ROUND" | "FLOOR">("CEIL");
  const [option18kWeightMultiplier, setOption18kWeightMultiplier] = useState("1.2");
  const [policyFactorSetId, setPolicyFactorSetId] = useState("");

  useEffect(() => {
    setMarginMultiplier(String(activePolicy?.margin_multiplier ?? 1));
    setRoundingUnit(String(activePolicy?.rounding_unit ?? 1000));
    setRoundingMode((activePolicy?.rounding_mode ?? "CEIL") as "CEIL" | "ROUND" | "FLOOR");
    setOption18kWeightMultiplier(String(activePolicy?.option_18k_weight_multiplier ?? 1.2));
    setPolicyFactorSetId(activePolicy?.material_factor_set_id ?? "");
  }, [activePolicy?.policy_id]);

  const factorSetsQuery = useQuery({
    queryKey: ["shop-factor-sets", channelId],
    enabled: Boolean(channelId),
    queryFn: async () => {
      const [globalRes, channelRes] = await Promise.all([
        shopApiGet<{ data: FactorSet[] }>("/api/material-factor-sets?scope=GLOBAL"),
        shopApiGet<{ data: FactorSet[] }>(`/api/material-factor-sets?scope=CHANNEL&channel_id=${encodeURIComponent(channelId)}`),
      ]);
      return [...globalRes.data, ...channelRes.data];
    },
  });

  const [newFactorSetName, setNewFactorSetName] = useState("");
  const [newFactorScope, setNewFactorScope] = useState<"GLOBAL" | "CHANNEL">("GLOBAL");
  const [newFactorDescription, setNewFactorDescription] = useState("");

  const createFactorSet = useMutation({
    mutationFn: () =>
      shopApiSend<{ data: FactorSet }>("/api/material-factor-sets", "POST", {
        scope: newFactorScope,
        channel_id: newFactorScope === "CHANNEL" ? channelId : null,
        name: newFactorSetName,
        description: newFactorDescription || null,
        is_active: true,
        is_global_default: false,
      }),
    onSuccess: async () => {
      toast.success("factor set 생성 완료");
      setNewFactorSetName("");
      setNewFactorDescription("");
      await qc.invalidateQueries({ queryKey: ["shop-factor-sets", channelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const upsertPolicy = useMutation({
    mutationFn: async () => {
      if (activePolicy) {
        return shopApiSend<{ data: Policy }>(`/api/pricing-policies/${activePolicy.policy_id}`, "PUT", {
          margin_multiplier: Number(marginMultiplier),
          rounding_unit: Number(roundingUnit),
          rounding_mode: roundingMode,
          material_factor_set_id: policyFactorSetId || null,
          option_18k_weight_multiplier: Number(option18kWeightMultiplier),
          is_active: true,
        });
      }
      return shopApiSend<{ data: Policy }>("/api/pricing-policies", "POST", {
        channel_id: channelId,
        policy_name: "DEFAULT_POLICY",
        margin_multiplier: Number(marginMultiplier),
        rounding_unit: Number(roundingUnit),
        rounding_mode: roundingMode,
        option_18k_weight_multiplier: Number(option18kWeightMultiplier),
        material_factor_set_id: policyFactorSetId || null,
        is_active: true,
      });
    },
    onSuccess: async () => {
      toast.success("정책 저장 완료");
      await qc.invalidateQueries({ queryKey: ["shop-policies", channelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [selectedFactorSetId, setSelectedFactorSetId] = useState("");
  useEffect(() => {
    if (!selectedFactorSetId && (factorSetsQuery.data?.length ?? 0) > 0) {
      setSelectedFactorSetId(factorSetsQuery.data?.[0]?.factor_set_id ?? "");
    }
  }, [selectedFactorSetId, factorSetsQuery.data]);

  const factorDetailQuery = useQuery({
    queryKey: ["shop-factor-set-detail", selectedFactorSetId],
    enabled: Boolean(selectedFactorSetId),
    queryFn: () => shopApiGet<FactorSetDetail>(`/api/material-factor-sets/${selectedFactorSetId}`),
  });

  const materialConfigQuery = useQuery({
    queryKey: ["shop-material-config"],
    queryFn: () => shopApiGet<{ data: MaterialConfig[] }>("/api/material-factor-config"),
  });

  const materialConfigMap = useMemo(() => {
    const map = new Map<string, MaterialConfig>();
    for (const row of materialConfigQuery.data?.data ?? []) {
      map.set(String(row.material_code), row);
    }
    return map;
  }, [materialConfigQuery.data?.data]);

  const [factorRows, setFactorRows] = useState<FactorRow[]>([]);
  useEffect(() => {
    const existingRows = (factorDetailQuery.data?.data.factors ?? []).map((row) => ({
      material_code: row.material_code,
      multiplier: String(row.multiplier),
    }));

    const map = new Map<string, FactorRow>();
    for (const row of existingRows) {
      const code = String(row.material_code ?? "").trim();
      if (!code) continue;
      map.set(code, { material_code: code, multiplier: row.multiplier });
    }

    for (const code of STANDARD_MATERIAL_CODES) {
      if (!map.has(code)) {
        map.set(code, { material_code: code, multiplier: "1" });
      }
    }

    setFactorRows(Array.from(map.values()));
  }, [factorDetailQuery.data?.data.factor_set.factor_set_id, factorDetailQuery.data?.data.factors]);

  const saveFactorRows = useMutation({
    mutationFn: async () => {
      if (!selectedFactorSetId) throw new Error("팩터 세트를 선택하세요");
      const parsed = factorRows
        .map((row) => {
          const materialCode = String(row.material_code ?? "").trim();
          const multiplier = Number(row.multiplier);
          if (!materialCode) return null;
          if (!Number.isFinite(multiplier) || multiplier <= 0) {
            throw new Error(`배수(multiplier)는 0보다 커야 합니다: ${materialCode}`);
          }
          return {
            material_code: materialCode,
            multiplier,
          };
        })
        .filter((v): v is { material_code: string; multiplier: number } => Boolean(v));

      if (parsed.length === 0) {
        throw new Error("최소 1개의 소재 코드를 입력하세요");
      }

      return shopApiSend<{ data: FactorSet }>(`/api/material-factor-sets/${selectedFactorSetId}`, "PUT", {
        factors: parsed,
        replace_all: true,
      });
    },
    onSuccess: async () => {
      toast.success("팩터 행 저장 완료");
      await qc.invalidateQueries({ queryKey: ["shop-factor-set-detail", selectedFactorSetId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateFactorRow = (idx: number, key: keyof FactorRow, value: string) => {
    setFactorRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const addFactorRow = () => {
    setFactorRows((prev) => [...prev, { material_code: "", multiplier: "1" }]);
  };

  const removeFactorRow = (idx: number) => {
    setFactorRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const rowByCode = useMemo(() => {
    const map = new Map<string, FactorRow>();
    for (const row of factorRows) {
      const code = String(row.material_code ?? "").trim();
      if (!code) continue;
      map.set(code, row);
    }
    return map;
  }, [factorRows]);

  const groupedCodes = {
    gold: ["14", "18", "24"],
    silver: ["925", "999"],
    other: ["00"],
  } as const;

  const basisLabel = (basis: "GOLD" | "SILVER" | "NONE") => {
    if (basis === "GOLD") return "GOLD";
    if (basis === "SILVER") return "SILVER";
    return "NONE";
  };

  const renderMaterialGroup = (title: string, codes: readonly string[]) => (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1">소재</th>
              <th className="px-2 py-1">함량</th>
              <th className="px-2 py-1">소재 보정계수</th>
              <th className="px-2 py-1">가격 기준</th>
              <th className="px-2 py-1">적용계수 미리보기</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => {
              const cfg = materialConfigMap.get(code);
              const row = rowByCode.get(code);
              const purity = Number(cfg?.purity_rate ?? (code === "00" ? 0 : 1));
              const multiplier = Number(row?.multiplier ?? 1);
              const preview = Number.isFinite(purity * multiplier) ? (purity * multiplier).toFixed(6) : "0.000000";
              return (
                <tr key={code} className="border-t border-[var(--hairline)]">
                  <td className="px-2 py-2 font-semibold">{code}</td>
                  <td className="px-2 py-2">
                    <Input value={String(purity)} disabled />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row?.multiplier ?? "1"}
                      onChange={(e) => {
                        const idx = factorRows.findIndex((r) => String(r.material_code).trim() === code);
                        if (idx >= 0) updateFactorRow(idx, "multiplier", e.target.value);
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={basisLabel(cfg?.price_basis ?? "NONE")} disabled />
                  </td>
                  <td className="px-2 py-2 tabular-nums">{preview}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-4">
      <ActionBar title="정책/팩터 관리" subtitle="채널별 마진/반올림/소재 배수(Factor Set) 설정" />

      <Card>
        <CardHeader title="채널 정책" description="마진/반올림/팩터 세트 연결" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">채널(channel_id)</div>
              <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">채널 선택</option>
                {channels.map((ch) => (
                  <option key={ch.channel_id} value={ch.channel_id}>
                    {ch.channel_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">마진 배수(margin_multiplier)</div>
              <Input value={marginMultiplier} onChange={(e) => setMarginMultiplier(e.target.value)} placeholder="예: 1" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">반올림 단위(rounding_unit)</div>
              <Input value={roundingUnit} onChange={(e) => setRoundingUnit(e.target.value)} placeholder="예: 1000" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">반올림 방식(rounding_mode)</div>
              <Select value={roundingMode} onChange={(e) => setRoundingMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>
                <option value="CEIL">올림 (CEIL)</option>
                <option value="ROUND">반올림 (ROUND)</option>
                <option value="FLOOR">내림 (FLOOR)</option>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">팩터 세트(material_factor_set_id)</div>
              <Select value={policyFactorSetId} onChange={(e) => setPolicyFactorSetId(e.target.value)}>
                <option value="">팩터 세트 선택</option>
                {(factorSetsQuery.data ?? []).map((fs) => (
                  <option key={fs.factor_set_id} value={fs.factor_set_id}>
                    {fs.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted)]">18K 옵션 중량배수(option_18k_weight_multiplier)</div>
              <Input value={option18kWeightMultiplier} onChange={(e) => setOption18kWeightMultiplier(e.target.value)} placeholder="예: 1.2" />
            </div>
          </div>
          <Button onClick={() => upsertPolicy.mutate()} disabled={upsertPolicy.isPending || !channelId}>
            {upsertPolicy.isPending ? "저장 중..." : "정책 저장"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="소재 함량/보정계수" description="소재별 함량은 settings 값을 따르고, 보정계수(multiplier)는 여기서 저장합니다. 18K 옵션 중량배수는 채널 정책에서 조정합니다." />
        <CardBody className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {renderMaterialGroup("금 소재", groupedCodes.gold)}
          {renderMaterialGroup("은 소재", groupedCodes.silver)}
          {renderMaterialGroup("기타/비정산 소재", groupedCodes.other)}
          <div className="xl:col-span-3 flex gap-2">
            <Button onClick={() => saveFactorRows.mutate()} disabled={saveFactorRows.isPending || !selectedFactorSetId}>
              {saveFactorRows.isPending ? "저장 중..." : "저장"}
            </Button>
            <div className="text-xs text-[var(--muted)] self-center">
              저장 시 현재 선택한 팩터 세트에만 반영됩니다.
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="팩터 세트 생성" description="전체(GLOBAL) 또는 채널(CHANNEL) 범위" />
          <CardBody className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Select value={newFactorScope} onChange={(e) => setNewFactorScope(e.target.value as "GLOBAL" | "CHANNEL") }>
                <option value="GLOBAL">전체 공통 (GLOBAL)</option>
                <option value="CHANNEL">채널 전용 (CHANNEL)</option>
              </Select>
              <Input value={newFactorSetName} onChange={(e) => setNewFactorSetName(e.target.value)} placeholder="팩터 세트 이름(name)" />
              <Input value={newFactorDescription} onChange={(e) => setNewFactorDescription(e.target.value)} placeholder="설명(description)" />
            </div>
            <Button
              onClick={() => createFactorSet.mutate()}
              disabled={createFactorSet.isPending || !newFactorSetName.trim() || (newFactorScope === "CHANNEL" && !channelId)}
            >
              {createFactorSet.isPending ? "생성 중..." : "팩터 세트 생성"}
            </Button>

            <div className="max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">세트명(name)</th>
                    <th className="px-3 py-2">범위(scope)</th>
                    <th className="px-3 py-2">활성(is_active)</th>
                    <th className="px-3 py-2">기본(is_global_default)</th>
                  </tr>
                </thead>
                <tbody>
                  {(factorSetsQuery.data ?? []).map((row) => (
                    <tr
                      key={row.factor_set_id}
                      className={`border-t border-[var(--hairline)] ${selectedFactorSetId === row.factor_set_id ? "bg-[var(--panel)]" : ""}`}
                      onClick={() => setSelectedFactorSetId(row.factor_set_id)}
                    >
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.scope === "GLOBAL" ? "전체 공통" : "채널 전용"}</td>
                      <td className="px-3 py-2">{row.is_active ? "활성" : "비활성"}</td>
                      <td className="px-3 py-2">{row.is_global_default ? "기본" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="직접 코드 추가" description="표에 없는 소재코드는 여기서 추가할 수 있습니다" />
          <CardBody className="space-y-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={addFactorRow} disabled={!selectedFactorSetId}>
                소재코드 행 추가
              </Button>
            </div>
            {factorRows
              .filter((row) => !STANDARD_MATERIAL_CODES.includes(row.material_code as (typeof STANDARD_MATERIAL_CODES)[number]))
              .map((row, idx) => (
                <div key={`extra-${idx}`} className="flex gap-2">
                  <Input
                    value={row.material_code}
                    onChange={(e) => {
                      const targetIdx = factorRows.findIndex((r) => r === row);
                      if (targetIdx >= 0) updateFactorRow(targetIdx, "material_code", e.target.value);
                    }}
                    placeholder="소재코드"
                  />
                  <Input
                    value={row.multiplier}
                    onChange={(e) => {
                      const targetIdx = factorRows.findIndex((r) => r === row);
                      if (targetIdx >= 0) updateFactorRow(targetIdx, "multiplier", e.target.value);
                    }}
                    placeholder="보정계수"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const targetIdx = factorRows.findIndex((r) => r === row);
                      if (targetIdx >= 0) removeFactorRow(targetIdx);
                    }}
                  >
                    삭제
                  </Button>
                </div>
              ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
