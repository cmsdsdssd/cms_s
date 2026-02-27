"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_code: string; channel_name: string };
type Policy = {
  policy_id: string;
  channel_id: string;
  policy_name: string;
  margin_multiplier: number;
  rounding_unit: number;
  rounding_mode: "CEIL" | "ROUND" | "FLOOR";
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
  const [policyFactorSetId, setPolicyFactorSetId] = useState("");

  useEffect(() => {
    setMarginMultiplier(String(activePolicy?.margin_multiplier ?? 1));
    setRoundingUnit(String(activePolicy?.rounding_unit ?? 1000));
    setRoundingMode((activePolicy?.rounding_mode ?? "CEIL") as "CEIL" | "ROUND" | "FLOOR");
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
          is_active: true,
        });
      }
      return shopApiSend<{ data: Policy }>("/api/pricing-policies", "POST", {
        channel_id: channelId,
        policy_name: "DEFAULT_POLICY",
        margin_multiplier: Number(marginMultiplier),
        rounding_unit: Number(roundingUnit),
        rounding_mode: roundingMode,
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

  const [factorRowsJson, setFactorRowsJson] = useState(
    '[{"material_code":"14","multiplier":1.0},{"material_code":"18","multiplier":1.0},{"material_code":"925","multiplier":1.0}]',
  );

  const saveFactorRows = useMutation({
    mutationFn: async () => {
      if (!selectedFactorSetId) throw new Error("factor set을 선택하세요");
      const parsed = JSON.parse(factorRowsJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error("JSON 배열 형식이어야 합니다");
      return shopApiSend<{ data: FactorSet }>(`/api/material-factor-sets/${selectedFactorSetId}`, "PUT", {
        factors: parsed,
      });
    },
    onSuccess: () => toast.success("factor row 저장 완료"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <ActionBar title="정책/팩터 관리" subtitle="채널별 마진/라운딩 및 소재 factor set" />

      <Card>
        <CardHeader title="채널 정책" description="margin / rounding / factor set 연결" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">채널 선택</option>
              {channels.map((ch) => (
                <option key={ch.channel_id} value={ch.channel_id}>
                  {ch.channel_name}
                </option>
              ))}
            </Select>
            <Input value={marginMultiplier} onChange={(e) => setMarginMultiplier(e.target.value)} placeholder="margin multiplier" />
            <Input value={roundingUnit} onChange={(e) => setRoundingUnit(e.target.value)} placeholder="rounding unit" />
            <Select value={roundingMode} onChange={(e) => setRoundingMode(e.target.value as "CEIL" | "ROUND" | "FLOOR") }>
              <option value="CEIL">CEIL</option>
              <option value="ROUND">ROUND</option>
              <option value="FLOOR">FLOOR</option>
            </Select>
            <Select value={policyFactorSetId} onChange={(e) => setPolicyFactorSetId(e.target.value)}>
              <option value="">factor set 선택</option>
              {(factorSetsQuery.data ?? []).map((fs) => (
                <option key={fs.factor_set_id} value={fs.factor_set_id}>
                  {fs.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => upsertPolicy.mutate()} disabled={upsertPolicy.isPending || !channelId}>
            {upsertPolicy.isPending ? "저장 중..." : "정책 저장"}
          </Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Factor Set 생성" description="GLOBAL 또는 CHANNEL scope" />
          <CardBody className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Select value={newFactorScope} onChange={(e) => setNewFactorScope(e.target.value as "GLOBAL" | "CHANNEL") }>
                <option value="GLOBAL">GLOBAL</option>
                <option value="CHANNEL">CHANNEL</option>
              </Select>
              <Input value={newFactorSetName} onChange={(e) => setNewFactorSetName(e.target.value)} placeholder="factor set name" />
              <Input value={newFactorDescription} onChange={(e) => setNewFactorDescription(e.target.value)} placeholder="description" />
            </div>
            <Button
              onClick={() => createFactorSet.mutate()}
              disabled={createFactorSet.isPending || !newFactorSetName.trim() || (newFactorScope === "CHANNEL" && !channelId)}
            >
              {createFactorSet.isPending ? "생성 중..." : "Factor Set 생성"}
            </Button>

            <div className="max-h-60 overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">name</th>
                    <th className="px-3 py-2">scope</th>
                    <th className="px-3 py-2">active</th>
                    <th className="px-3 py-2">default</th>
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
                      <td className="px-3 py-2">{row.scope}</td>
                      <td className="px-3 py-2">{row.is_active ? "Y" : "N"}</td>
                      <td className="px-3 py-2">{row.is_global_default ? "Y" : "N"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Factor Rows JSON 편집" description="선택 factor set에 material_code/multiplier upsert" />
          <CardBody className="space-y-2">
            <Textarea
              value={factorRowsJson}
              onChange={(e) => setFactorRowsJson(e.target.value)}
              rows={12}
            />
            <Button onClick={() => saveFactorRows.mutate()} disabled={saveFactorRows.isPending || !selectedFactorSetId}>
              {saveFactorRows.isPending ? "저장 중..." : "Factor Rows 저장"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
