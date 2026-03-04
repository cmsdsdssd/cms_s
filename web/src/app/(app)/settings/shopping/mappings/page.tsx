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

type Channel = {
  channel_id: string;
  channel_code: string;
  channel_name: string;
};

type Mapping = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  sync_rule_set_id?: string | null;
  option_price_mode?: "SYNC" | "MANUAL" | null;
  option_material_code?: string | null;
  option_color_code?: string | null;
  option_decoration_code?: string | null;
  option_size_value?: number | null;
  material_multiplier_override?: number | null;
  size_weight_delta_g?: number | null;
  option_price_delta_krw?: number | null;
  option_manual_target_krw?: number | null;
  include_master_plating_labor?: boolean | null;
  sync_rule_material_enabled?: boolean | null;
  sync_rule_weight_enabled?: boolean | null;
  sync_rule_plating_enabled?: boolean | null;
  sync_rule_decoration_enabled?: boolean | null;
  mapping_source: string;
  is_active: boolean;
  updated_at: string;
};

type SyncRuleSet = {
  rule_set_id: string;
  channel_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type MasterSuggest = {
  master_item_id: string;
  model_name: string;
};

type VariantOption = {
  name: string;
  value: string;
};

type VariantCandidate = {
  variant_code: string;
  custom_variant_code: string | null;
  options: VariantOption[];
  option_label: string;
  additional_amount: number | null;
};

type VariantLookupResponse = {
  data: {
    channel_id: string;
    requested_product_no: string;
    resolved_product_no: string;
    total: number;
    variants: VariantCandidate[];
  };
};

type BulkMappingResponse = {
  data: Mapping[];
  requested: number;
  deduplicated: number;
  saved: number;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");
const roundTo100 = (v: number) => Math.round(v / 100) * 100;
const makeDeltaOptions = (selectedValues: number[]) => {
  const base: number[] = [];
  for (let v = -20000; v <= 20000; v += 100) base.push(v);
  for (const v of selectedValues) {
    if (!Number.isFinite(v)) continue;
    const rv = roundTo100(v);
    if (!base.includes(rv)) base.push(rv);
  }
  return base.sort((a, b) => a - b);
};
const parseOptionalNumber = (raw: string): number | null => {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function ShoppingMappingsPage() {
  const qc = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ["shop-channels"],
    queryFn: () => shopApiGet<{ data: Channel[] }>("/api/channels"),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState("");
  const effectiveChannelId = channelId || channels[0]?.channel_id || "";

  const mappingsQuery = useQuery({
    queryKey: ["shop-mappings", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: Mapping[] }>(`/api/channel-products?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });

  const [masterItemId, setMasterItemId] = useState("");
  const [masterQuery, setMasterQuery] = useState("");
  const [masterQueryDebounced, setMasterQueryDebounced] = useState("");
  const [syncRuleSetId, setSyncRuleSetId] = useState("");
  const [externalProductNo, setExternalProductNo] = useState("");
  const [externalVariantCode, setExternalVariantCode] = useState("");
  const [materialMultiplierOverride, setMaterialMultiplierOverride] = useState("");
  const [sizeWeightDeltaG, setSizeWeightDeltaG] = useState("");
  const [optionPriceDeltaKrw, setOptionPriceDeltaKrw] = useState("");

  const [loadedVariants, setLoadedVariants] = useState<VariantCandidate[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});
  const [variantDeltaByCode, setVariantDeltaByCode] = useState<Record<string, string>>({});
  const [resolvedProductNo, setResolvedProductNo] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  const syncRuleSetQuery = useQuery({
    queryKey: ["shop-sync-rule-sets", effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () =>
      shopApiGet<{ data: SyncRuleSet[] }>(
        `/api/sync-rule-sets?channel_id=${encodeURIComponent(effectiveChannelId)}&only_active=true`,
      ),
  });

  const masterSuggestQuery = useQuery({
    queryKey: ["shop-master-suggest", masterQueryDebounced],
    enabled: masterQueryDebounced.trim().length >= 1,
    queryFn: () =>
      shopApiSend<{ data: MasterSuggest[] }>(
        "/api/new-receipt-workbench/model-name-suggest",
        "POST",
        { q: masterQueryDebounced.trim(), limit: 20 },
      ),
  });

  useEffect(() => {
    const t = setTimeout(() => setMasterQueryDebounced(masterQuery.trim()), 180);
    return () => clearTimeout(t);
  }, [masterQuery]);

  const effectiveSyncRuleSetId =
    syncRuleSetId
    || syncRuleSetQuery.data?.data?.[0]?.rule_set_id
    || "";

  const upsertMapping = useMutation({
    mutationFn: () => {
      if (!effectiveSyncRuleSetId) {
        throw new Error("활성 Sync 룰셋이 없습니다. 먼저 쇼핑 > 룰에서 룰셋을 생성/활성화하세요.");
      }
      return shopApiSend<{ data: Mapping }>("/api/channel-products", "POST", {
        channel_id: effectiveChannelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        external_variant_code: externalVariantCode || "",
        sync_rule_set_id: effectiveSyncRuleSetId,
        option_price_mode: "SYNC",
        material_multiplier_override: parseOptionalNumber(materialMultiplierOverride),
        size_weight_delta_g: parseOptionalNumber(sizeWeightDeltaG),
        option_price_delta_krw: parseOptionalNumber(optionPriceDeltaKrw),
        mapping_source: "MANUAL",
        is_active: true,
      });
    },
    onSuccess: async () => {
      toast.success("매핑 저장 완료");
      setEditingRowId(null);
      setMasterItemId("");
      setExternalProductNo("");
      setExternalVariantCode("");
      setMaterialMultiplierOverride("");
      setSizeWeightDeltaG("");
      setOptionPriceDeltaKrw("");
      await qc.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMapping = useMutation({
    mutationFn: (id: string) => shopApiSend<{ ok: boolean }>(`/api/channel-products/${id}`, "DELETE"),
    onSuccess: async () => {
      toast.success("매핑 삭제 완료");
      await qc.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const loadVariants = useMutation({
    mutationFn: async () => {
      const res = await shopApiGet<VariantLookupResponse>(
        `/api/channel-products/variants?channel_id=${encodeURIComponent(effectiveChannelId)}&external_product_no=${encodeURIComponent(externalProductNo.trim())}`,
      );
      return res.data;
    },
    onSuccess: (payload) => {
      setResolvedProductNo(payload.resolved_product_no || externalProductNo.trim());
      setLoadedVariants(payload.variants ?? []);

      const mappedSet = new Set(
        (mappingsQuery.data?.data ?? [])
          .filter((row) => row.external_product_no === (payload.resolved_product_no || externalProductNo.trim()))
          .map((row) => String(row.external_variant_code ?? "").trim())
          .filter(Boolean),
      );

      const initialSelection: Record<string, boolean> = {};
      const initialDelta: Record<string, string> = {};
      for (const row of payload.variants ?? []) {
        initialSelection[row.variant_code] = !mappedSet.has(row.variant_code);
        const amount = Number(row.additional_amount);
        initialDelta[row.variant_code] = Number.isFinite(amount) ? String(roundTo100(amount)) : "0";
      }
      setSelectedVariants(initialSelection);
      setVariantDeltaByCode(initialDelta);
      toast.success(`옵션 ${payload.total}건 불러오기 완료`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const upsertBulkMappings = useMutation({
    mutationFn: async () => {
      const productNoForSave = (resolvedProductNo || externalProductNo).trim();
      const selectedCodes = loadedVariants
        .filter((v) => selectedVariants[v.variant_code])
        .map((v) => v.variant_code);
      const existingByVariantCode = new Map(
        (mappingsQuery.data?.data ?? [])
          .filter((row) => row.external_product_no === productNoForSave)
          .map((row) => [String(row.external_variant_code ?? "").trim(), row] as const),
      );

      if (!productNoForSave) throw new Error("상품번호(product_no)를 먼저 입력하세요");
      if (!masterItemId.trim()) throw new Error("마스터 아이템 ID(master_item_id)를 입력하세요");
      if (!effectiveSyncRuleSetId) throw new Error("활성 Sync 룰셋이 없습니다. 먼저 쇼핑 > 룰에서 룰셋을 생성/활성화하세요.");
      if (selectedCodes.length === 0) throw new Error("저장할 옵션코드를 선택하세요");

      const rows = selectedCodes.map((variantCode) => {
        const variant = loadedVariants.find((x) => x.variant_code === variantCode);
        const additional = Number(variant?.additional_amount);
        const existing = existingByVariantCode.get(variantCode);
        const selectedDeltaRaw = Number(variantDeltaByCode[variantCode]);
        const selectedDelta = Number.isFinite(selectedDeltaRaw)
          ? roundTo100(selectedDeltaRaw)
          : (Number.isFinite(additional) ? roundTo100(additional) : 0);
        return {
          channel_id: effectiveChannelId,
          master_item_id: masterItemId.trim(),
          external_product_no: productNoForSave,
          external_variant_code: variantCode,
          sync_rule_set_id: effectiveSyncRuleSetId,
          option_price_mode: "SYNC",
          option_material_code: existing?.option_material_code ?? null,
          option_color_code: existing?.option_color_code ?? null,
          option_decoration_code: existing?.option_decoration_code ?? null,
          option_size_value: existing?.option_size_value ?? null,
          material_multiplier_override: existing?.material_multiplier_override ?? null,
          size_weight_delta_g: existing?.size_weight_delta_g ?? null,
          option_price_delta_krw: selectedDelta,
          option_manual_target_krw: existing?.option_manual_target_krw ?? null,
          include_master_plating_labor: existing?.include_master_plating_labor !== false,
          sync_rule_material_enabled: existing?.sync_rule_material_enabled !== false,
          sync_rule_weight_enabled: existing?.sync_rule_weight_enabled !== false,
          sync_rule_plating_enabled: existing?.sync_rule_plating_enabled !== false,
          sync_rule_decoration_enabled: existing?.sync_rule_decoration_enabled !== false,
          sync_rule_margin_rounding_enabled: true,
          mapping_source: "AUTO",
          is_active: true,
        };
      });

      return shopApiSend<BulkMappingResponse>("/api/channel-products/bulk", "POST", { rows });
    },
    onSuccess: async (res) => {
      toast.success(`일괄 매핑 저장 완료: 요청 ${res.requested} / 중복제거 ${res.deduplicated} / 저장 ${res.saved}`);
      await qc.invalidateQueries({ queryKey: ["shop-mappings", effectiveChannelId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deltaOptions = useMemo(() => {
    const selected = loadedVariants.map((v) => Number(variantDeltaByCode[v.variant_code]));
    return makeDeltaOptions(selected);
  }, [loadedVariants, variantDeltaByCode]);

  const mappedVariantSet = new Set(
    (mappingsQuery.data?.data ?? [])
      .filter((row) => row.external_product_no === (resolvedProductNo || externalProductNo).trim())
      .map((row) => String(row.external_variant_code ?? "").trim())
      .filter(Boolean),
  );

  const optionAmountSummary = useMemo(() => {
    const map = new Map<string, { optionName: string; optionValue: string; amounts: Set<string> }>();

    for (const v of loadedVariants) {
      const amountValue = Number(v.additional_amount);
      const amountKey = Number.isFinite(amountValue) ? String(Math.round(amountValue)) : "null";
      for (const opt of v.options ?? []) {
        const optionName = String(opt.name ?? "").trim();
        const optionValue = String(opt.value ?? "").trim();
        if (!optionName && !optionValue) continue;
        const key = `${optionName}::${optionValue}`;
        const prev = map.get(key) ?? { optionName, optionValue, amounts: new Set<string>() };
        prev.amounts.add(amountKey);
        map.set(key, prev);
      }
    }

    return Array.from(map.values())
      .map((row) => {
        const keys = Array.from(row.amounts);
        if (keys.length === 1) {
          const k = keys[0];
          return {
            ...row,
            amountLabel: k === "null" ? "-" : fmt(Number(k)),
            isMixed: false,
          };
        }
        return {
          ...row,
          amountLabel: `혼합(${keys.length})`,
          isMixed: true,
        };
      })
      .sort((a, b) => `${a.optionName}:${a.optionValue}`.localeCompare(`${b.optionName}:${b.optionValue}`));
  }, [loadedVariants]);

  const groupedMappings = useMemo(() => {
    const groups = new Map<
      string,
      {
        master_item_id: string;
        rows: Mapping[];
        productNos: Set<string>;
        variantCount: number;
      }
    >();

    for (const row of mappingsQuery.data?.data ?? []) {
      const key = row.master_item_id;
      const prev = groups.get(key) ?? {
        master_item_id: row.master_item_id,
        rows: [],
        productNos: new Set<string>(),
        variantCount: 0,
      };
      prev.rows.push(row);
      prev.productNos.add(row.external_product_no);
      if (String(row.external_variant_code ?? "").trim()) prev.variantCount += 1;
      groups.set(key, prev);
    }

    return Array.from(groups.values())
      .map((g) => ({
        master_item_id: g.master_item_id,
        rows: g.rows.sort((a, b) => {
          const pa = `${a.external_product_no}:${a.external_variant_code ?? ""}`;
          const pb = `${b.external_product_no}:${b.external_variant_code ?? ""}`;
          return pa.localeCompare(pb);
        }),
        productCount: g.productNos.size,
        variantCount: g.variantCount,
        rowCount: g.rows.length,
      }))
      .sort((a, b) => a.master_item_id.localeCompare(b.master_item_id));
  }, [mappingsQuery.data?.data]);

  const effectiveSelectedMasterId =
    groupedMappings.some((g) => g.master_item_id === selectedMasterId)
      ? selectedMasterId
      : (groupedMappings[0]?.master_item_id ?? "");
  const selectedMasterGroup = groupedMappings.find((g) => g.master_item_id === effectiveSelectedMasterId) ?? null;

  return (
    <div className="space-y-4">
      <ActionBar title="상품 매핑" subtitle="마스터 모델과 쇼핑몰 상품번호(product_no) 연결" />

      <ShoppingPageHeader
        purpose="상품번호/옵션코드를 마스터와 정확히 연결해 이후 재계산/반영의 기준 데이터를 만듭니다."
        status={[
          { label: "등록 매핑", value: `${mappingsQuery.data?.data?.length ?? 0}건` },
          { label: "마스터 그룹", value: `${groupedMappings.length}개` },
          { label: "옵션 로드", value: `${loadedVariants.length}건`, tone: loadedVariants.length > 0 ? "good" : "neutral" },
        ]}
        nextActions={[
          { label: "자동 가격으로", href: "/settings/shopping/auto-price" },
          { label: "정책/팩터로", href: "/settings/shopping/factors" },
        ]}
      />

      <Card>
        <CardHeader title="매핑 입력" description="옵션 없는 상품은 variant 없이 저장, 옵션상품은 불러오기 후 일괄 저장" />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Select value={effectiveChannelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">채널 선택</option>
              {channels.map((ch) => (
                <option key={ch.channel_id} value={ch.channel_id}>
                  {ch.channel_name} ({ch.channel_code})
                </option>
              ))}
            </Select>
            <Input
              value={masterQuery}
              onChange={(e) => setMasterQuery(e.target.value)}
              placeholder="마스터 모델명 검색 (예: MS-553)"
            />
            <Select
              value={masterItemId}
              onChange={(e) => setMasterItemId(e.target.value)}
              disabled={masterSuggestQuery.isFetching && (masterSuggestQuery.data?.data?.length ?? 0) === 0}
            >
              <option value="">검색 결과에서 마스터 선택</option>
              {(masterSuggestQuery.data?.data ?? []).map((m) => (
                <option key={m.master_item_id} value={m.master_item_id}>
                  {m.model_name}
                </option>
              ))}
            </Select>
            <Input value={externalProductNo} onChange={(e) => setExternalProductNo(e.target.value)} placeholder="쇼핑몰 상품번호(external_product_no)" />
            <Input value={externalVariantCode} onChange={(e) => setExternalVariantCode(e.target.value)} placeholder="옵션 코드(external_variant_code, 선택)" />
          </div>
          <div className="text-xs text-[var(--muted)]">
            마스터 ID와 Sync 룰셋 ID는 화면에 숨기고 내부에서 자동 처리합니다.
          </div>
          <Button
            onClick={() => upsertMapping.mutate()}
            disabled={upsertMapping.isPending || !effectiveChannelId || !masterItemId.trim() || !externalProductNo.trim() || !effectiveSyncRuleSetId}
          >
            {upsertMapping.isPending ? "저장 중..." : editingRowId ? "매핑 수정 저장" : "매핑 저장"}
          </Button>
          {editingRowId ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingRowId(null);
                setMasterItemId("");
                setMasterQuery("");
                setExternalProductNo("");
                setExternalVariantCode("");
                setMaterialMultiplierOverride("");
                setSizeWeightDeltaG("");
                setOptionPriceDeltaKrw("");
                setSyncRuleSetId("");
              }}
            >
              수정 취소
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => loadVariants.mutate()}
              disabled={loadVariants.isPending || !effectiveChannelId || !externalProductNo.trim()}
            >
              {loadVariants.isPending ? "옵션 조회 중..." : "상품번호로 옵션 불러오기"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const v of loadedVariants) {
                  if (!mappedVariantSet.has(v.variant_code)) next[v.variant_code] = true;
                }
                setSelectedVariants(next);
              }}
              disabled={loadedVariants.length === 0}
            >
              미매핑 옵션 전체선택
            </Button>
            <Button
              onClick={() => upsertBulkMappings.mutate()}
              disabled={
                upsertBulkMappings.isPending
                || !effectiveChannelId
                || !masterItemId.trim()
                || !effectiveSyncRuleSetId
                || loadedVariants.length === 0
                || loadedVariants.filter((v) => selectedVariants[v.variant_code]).length === 0
              }
            >
              {upsertBulkMappings.isPending ? "일괄 저장 중..." : "선택 옵션 일괄 매핑 저장"}
            </Button>
          </div>
          {resolvedProductNo ? (
            <div className="text-xs text-[var(--muted)]">
              조회 상품번호: {externalProductNo.trim()} / 실제 반영 상품번호: {resolvedProductNo}
            </div>
          ) : null}
          <div className="text-xs text-[var(--muted)]">옵션 없는 상품 등록은 옵션코드를 비워두고 `매핑 저장`을 누르세요. 옵션상품은 `상품번호로 옵션 불러오기` 후 체크된 항목만 `일괄 저장`하세요. 일괄 저장 시 카페24 추가금(additional_amount)을 고정 추가금으로 초기 반영합니다.</div>

          {loadedVariants.length > 0 ? (
            <div className="max-h-[340px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">선택</th>
                    <th className="px-3 py-2">옵션코드(variant_code)</th>
                    <th className="px-3 py-2">커스텀코드(custom_variant_code)</th>
                    <th className="px-3 py-2">옵션값(options)</th>
                    <th className="px-3 py-2">추가금(additional_amount)</th>
                    <th className="px-3 py-2">적용 추가금(100원)</th>
                    <th className="px-3 py-2">매핑상태</th>
                  </tr>
                </thead>
                <tbody>
                  {loadedVariants.map((v) => {
                    const alreadyMapped = mappedVariantSet.has(v.variant_code);
                    return (
                      <tr key={v.variant_code} className="border-t border-[var(--hairline)]">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedVariants[v.variant_code] ?? false}
                            disabled={alreadyMapped}
                            onChange={(e) =>
                              setSelectedVariants((prev) => ({ ...prev, [v.variant_code]: e.target.checked }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">{v.variant_code}</td>
                        <td className="px-3 py-2">{v.custom_variant_code ?? "-"}</td>
                        <td className="px-3 py-2 text-xs">{v.option_label || "-"}</td>
                        <td className="px-3 py-2">{fmt(v.additional_amount)}</td>
                        <td className="px-3 py-2">
                          <Select
                            value={variantDeltaByCode[v.variant_code] ?? "0"}
                            disabled={alreadyMapped}
                            onChange={(e) => setVariantDeltaByCode((prev) => ({ ...prev, [v.variant_code]: e.target.value }))}
                          >
                            {deltaOptions.map((value) => (
                              <option key={value} value={String(value)}>{value.toLocaleString()}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-2">{alreadyMapped ? "이미 매핑됨" : "매핑 가능"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {optionAmountSummary.length > 0 ? (
            <div className="max-h-[280px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">옵션분류</th>
                    <th className="px-3 py-2">옵션값</th>
                    <th className="px-3 py-2">관측 추가금</th>
                  </tr>
                </thead>
                <tbody>
                  {optionAmountSummary.map((row) => (
                    <tr key={`${row.optionName}:${row.optionValue}`} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{row.optionName || "-"}</td>
                      <td className="px-3 py-2">{row.optionValue || "-"}</td>
                      <td className="px-3 py-2">{row.amountLabel}{row.isMixed ? " (조합별 상이)" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="매핑 목록" description={`마스터 ${groupedMappings.length}개 / 매핑 ${(mappingsQuery.data?.data?.length ?? 0)}건`} />
        <CardBody>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
            <div className="max-h-[560px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">마스터 그룹</th>
                    <th className="px-3 py-2">상품수</th>
                    <th className="px-3 py-2">옵션수</th>
                    <th className="px-3 py-2">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedMappings.map((group) => (
                    <tr
                      key={group.master_item_id}
                      className={`border-t border-[var(--hairline)] ${effectiveSelectedMasterId === group.master_item_id ? "bg-[var(--panel)]" : ""}`}
                    >
                      <td className="px-3 py-2">마스터 그룹</td>
                      <td className="px-3 py-2">{group.productCount}</td>
                      <td className="px-3 py-2">{group.variantCount}</td>
                      <td className="px-3 py-2">
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedMasterId(group.master_item_id)}
                        >
                          상세
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {groupedMappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                        매핑 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="max-h-[560px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">상품번호(product_no)</th>
                    <th className="px-3 py-2">옵션코드(variant)</th>
                    <th className="px-3 py-2">매핑소스(source)</th>
                    <th className="px-3 py-2">활성(active)</th>
                    <th className="px-3 py-2">동작(action)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedMasterGroup?.rows ?? []).map((row) => (
                    <tr key={row.channel_product_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{row.external_product_no}</td>
                      <td className="px-3 py-2">{row.external_variant_code ?? "-"}</td>
                      <td className="px-3 py-2">{row.mapping_source}</td>
                      <td className="px-3 py-2">{row.is_active ? "활성" : "비활성"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingRowId(row.channel_product_id);
                              setMasterItemId(row.master_item_id);
                              setMasterQuery("");
                              if (row.sync_rule_set_id) setSyncRuleSetId(row.sync_rule_set_id);
                              setExternalProductNo(row.external_product_no);
                              setExternalVariantCode(String(row.external_variant_code ?? ""));
                              setMaterialMultiplierOverride(row.material_multiplier_override == null ? "" : String(row.material_multiplier_override));
                              setSizeWeightDeltaG(row.size_weight_delta_g == null ? "" : String(row.size_weight_delta_g));
                              setOptionPriceDeltaKrw(row.option_price_delta_krw == null ? "" : String(row.option_price_delta_krw));
                            }}
                          >
                            수정
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => deleteMapping.mutate(row.channel_product_id)}
                            disabled={deleteMapping.isPending}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {selectedMasterGroup === null ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                        좌측에서 마스터 아이템을 선택하세요.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
