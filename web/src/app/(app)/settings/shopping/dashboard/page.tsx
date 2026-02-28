"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActionBar } from "@/components/layout/action-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { shopApiGet, shopApiSend } from "@/lib/shop/http";

type Channel = { channel_id: string; channel_name: string; channel_code: string };

type DashboardRow = {
  channel_id: string;
  channel_product_id: string;
  master_item_id: string;
  model_name: string | null;
  external_product_no: string;
  external_variant_code: string | null;
  category_code: string | null;
  material_code: string | null;
  net_weight_g: number | null;
  labor_raw_krw: number | null;
  final_target_price_krw: number | null;
  current_channel_price_krw: number | null;
  diff_krw: number | null;
  diff_pct: number | null;
  price_state: "OK" | "OUT_OF_SYNC" | "ERROR" | "UNMAPPED";
  active_adjustment_count: number;
  active_override_id: string | null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL" | null;
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
  sync_rule_margin_rounding_enabled: boolean;
  mapping_source: "MANUAL" | "CSV" | "AUTO";
  is_active: boolean;
};

type BaseAdjustmentLog = {
  adjustment_log_id: string;
  channel_id: string;
  master_item_id: string;
  delta_krw: number;
  reason: string;
  created_at: string;
};

type SummaryData = {
  channel_id: string;
  counts: {
    total: number;
    ok: number;
    out_of_sync: number;
    error: number;
    override: number;
    adjustment: number;
  };
};

type MasterRow = {
  master_item_id: string;
  model_name: string | null;
  category_code: string | null;
  material_code: string | null;
  product_no: string;
  base_current_krw: number | null;
  base_target_krw: number | null;
  base_diff_krw: number | null;
  margin_pct: number | null;
  total_weight_g: number | null;
  total_labor_krw: number | null;
  final_price_krw: number | null;
  master_original_krw: number | null;
  price_state: DashboardRow["price_state"];
  include_master_plating_labor: boolean;
  option_count: number;
};

type MasterMetaRow = {
  master_id: string;
  image_url: string | null;
};

type VariantMetaRow = {
  variant_code: string;
  option_label: string;
  options?: Array<{ name: string; value: string }>;
};

type OptionEditDraft = {
  option_price_mode: "SYNC" | "MANUAL";
  sync_rule_set_id: string;
  option_material_code: string;
  option_color_code: string;
  option_decoration_code: string;
  option_size_value: string;
  option_manual_target_krw: string;
  sync_rule_material_enabled: boolean;
  sync_rule_weight_enabled: boolean;
  sync_rule_plating_enabled: boolean;
  sync_rule_decoration_enabled: boolean;
};

type OptionValueItem = {
  axis: string;
  value: string;
  variant_codes: string[];
};

type OptionValueDraft = {
  option_price_mode: "SYNC" | "MANUAL";
  sync_rule_set_id: string;
  apply_rule: "R1" | "R2" | "R3" | "R4";
  selected_rule_id: string;
  manual_delta_krw: string;
};

type OptionAxisGroup = {
  axis: string;
  values: OptionValueItem[];
};

type SyncPreviewResult = {
  total_candidates: number;
  affected: number;
  blocked: number;
  matched_sample_count: number;
  unmatched_sample_count: number;
  matched_samples: Array<{
    channel_product_id: string;
    total_delta_krw: number;
    r1_delta_krw: number;
    r2_delta_krw: number;
    r3_delta_krw: number;
    r4_delta_krw?: number;
  }>;
  unmatched_samples: Array<{
    channel_product_id: string;
    missing_rules: string[];
  }>;
};

const fmt = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");

const syncRuleSummary = (m: MappingRow) => {
  const parts: string[] = [];
  if (m.sync_rule_material_enabled) parts.push("소재 시세 차액 룰");
  if (m.sync_rule_weight_enabled) parts.push("사이즈/중량 구간 룰");
  if (m.sync_rule_plating_enabled) parts.push("색상 도금/마진 룰");
  if (m.sync_rule_decoration_enabled) parts.push("장식 룰");
  return parts.length > 0 ? parts.join(",") : "없음";
};

const toStateKo = (value: DashboardRow["price_state"]) => {
  if (value === "OK") return "정상";
  if (value === "OUT_OF_SYNC") return "불일치";
  if (value === "ERROR") return "오류";
  return "미매핑";
};

export default function ShoppingDashboardPage() {
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

  const [priceState, setPriceState] = useState("");
  const [modelName, setModelName] = useState("");
  const [selectedMasters, setSelectedMasters] = useState<Record<string, boolean>>({});
  const [detailMasterId, setDetailMasterId] = useState("");
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [baseDeltaAmount, setBaseDeltaAmount] = useState("");
  const [baseDeltaReason, setBaseDeltaReason] = useState("");
  const [editingChannelProductId, setEditingChannelProductId] = useState<string | null>(null);
  const [optionEditDraft, setOptionEditDraft] = useState<OptionEditDraft | null>(null);
  const [selectedOptionValueKey, setSelectedOptionValueKey] = useState<string>("");
  const [selectedOptionAxis, setSelectedOptionAxis] = useState<string>("");
  const [optionValueDraft, setOptionValueDraft] = useState<OptionValueDraft | null>(null);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewResult | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["shop-dashboard", channelId, priceState, modelName],
    enabled: Boolean(channelId),
    queryFn: () => {
      const query = new URLSearchParams();
      query.set("channel_id", channelId);
      query.set("include_unmapped", "false");
      query.set("limit", "1000");
      if (priceState) query.set("price_state", priceState);
      if (modelName.trim()) query.set("model_name", modelName.trim());
      return shopApiGet<{ data: DashboardRow[] }>(`/api/channel-price-dashboard?${query.toString()}`);
    },
  });

  const mappingQuery = useQuery({
    queryKey: ["shop-mappings", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: MappingRow[] }>(`/api/channel-products?channel_id=${encodeURIComponent(channelId)}`),
  });

  const syncRuleSetQuery = useQuery({
    queryKey: ["shop-sync-rule-sets", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: Array<{ rule_set_id: string; name: string }> }>(`/api/sync-rule-sets?channel_id=${encodeURIComponent(channelId)}&only_active=true`),
  });

  const summaryQuery = useQuery({
    queryKey: ["shop-dashboard-summary", channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: SummaryData }>(`/api/channel-price-summary?channel_id=${encodeURIComponent(channelId)}`),
  });

  const baseAdjustAllQuery = useQuery({
    queryKey: ["shop-base-adjust-all", channelId],
    enabled: Boolean(channelId),
    queryFn: () =>
      shopApiGet<{ data: BaseAdjustmentLog[] }>(
        `/api/channel-base-price-adjustments?channel_id=${encodeURIComponent(channelId)}&limit=500`,
      ),
  });

  const rows = dashboardQuery.data?.data ?? [];
  const mappings = mappingQuery.data?.data ?? [];
  const baseAdjustLogsAll = baseAdjustAllQuery.data?.data ?? [];

  const baseDeltaByMaster = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of baseAdjustLogsAll) {
      const masterId = String(row.master_item_id ?? "").trim();
      if (!masterId) continue;
      const prev = map.get(masterId) ?? 0;
      map.set(masterId, prev + Number(row.delta_krw ?? 0));
    }
    return map;
  }, [baseAdjustLogsAll]);

  const rowsByChannelProduct = useMemo(() => {
    const map = new Map<string, DashboardRow>();
    for (const row of rows) map.set(row.channel_product_id, row);
    return map;
  }, [rows]);

  const masterRows = useMemo<MasterRow[]>(() => {
    const grouped = new Map<string, MappingRow[]>();
    for (const m of mappings) {
      const key = m.master_item_id;
      const prev = grouped.get(key) ?? [];
      prev.push(m);
      grouped.set(key, prev);
    }

    const out: MasterRow[] = [];
    for (const [masterId, group] of grouped.entries()) {
      const rowsForMaster = group
        .map((m) => rowsByChannelProduct.get(m.channel_product_id))
        .filter((r): r is DashboardRow => Boolean(r));
      const optionRows = rowsForMaster.filter((r) => String(r.external_variant_code ?? "").trim().length > 0);
      const baseRow =
        rowsForMaster.find((r) => !String(r.external_variant_code ?? "").trim())
        ?? rowsForMaster[0]
        ?? null;
      if (!baseRow) continue;

      const marginPct =
        typeof baseRow.current_channel_price_krw === "number"
        && baseRow.current_channel_price_krw > 0
        && typeof baseRow.final_target_price_krw === "number"
        && baseRow.final_target_price_krw > 0
        ? (baseRow.current_channel_price_krw / baseRow.final_target_price_krw) * 100
        : null;

      out.push({
        master_item_id: masterId,
        model_name: baseRow.model_name,
        category_code: baseRow.category_code,
        material_code: baseRow.material_code,
        product_no: baseRow.external_product_no,
        base_current_krw: baseRow.current_channel_price_krw,
        base_target_krw: baseRow.final_target_price_krw,
        base_diff_krw: baseRow.diff_krw,
        margin_pct: marginPct,
        total_weight_g: baseRow.net_weight_g,
        total_labor_krw: baseRow.labor_raw_krw,
        final_price_krw: baseRow.final_target_price_krw,
        master_original_krw:
          typeof baseRow.final_target_price_krw === "number"
            ? baseRow.final_target_price_krw - (baseDeltaByMaster.get(masterId) ?? 0)
            : null,
        price_state: baseRow.price_state,
        include_master_plating_labor: group.every((m) => m.include_master_plating_labor !== false),
        option_count: optionRows.length,
      });
    }

    return out.sort((a, b) => {
      const am = a.model_name ?? "";
      const bm = b.model_name ?? "";
      return am.localeCompare(bm) || a.master_item_id.localeCompare(b.master_item_id);
    });
  }, [mappings, rowsByChannelProduct, baseDeltaByMaster]);

  useEffect(() => {
    setSelectedMasters({});
    if (masterRows.length > 0) setDetailMasterId(masterRows[0].master_item_id);
    else setDetailMasterId("");
  }, [channelId, priceState, modelName, masterRows.length]);

  const detailMappings = useMemo(
    () => mappings.filter((m) => m.master_item_id === detailMasterId),
    [mappings, detailMasterId],
  );

  const detailMasterRow = useMemo(
    () => masterRows.find((m) => m.master_item_id === detailMasterId) ?? null,
    [masterRows, detailMasterId],
  );

  const selectedMasterIds = useMemo(
    () => masterRows.filter((r) => selectedMasters[r.master_item_id]).map((r) => r.master_item_id),
    [masterRows, selectedMasters],
  );

  const selectedChannelProductIds = useMemo(() => {
    if (selectedMasterIds.length === 0) return [] as string[];
    const idSet = new Set(selectedMasterIds);
    return mappings
      .filter((m) => idSet.has(m.master_item_id))
      .map((m) => m.channel_product_id);
  }, [mappings, selectedMasterIds]);

  const masterMetaQuery = useQuery({
    queryKey: ["shop-dashboard-master-meta", channelId, masterRows.map((m) => m.master_item_id).join(",")],
    enabled: Boolean(channelId && masterRows.length > 0),
    queryFn: () => {
      const ids = masterRows.map((m) => m.master_item_id).filter(Boolean).join(",");
      return shopApiGet<{ data: MasterMetaRow[] }>(`/api/master-items?master_ids=${encodeURIComponent(ids)}`);
    },
  });

  const masterImageById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of masterMetaQuery.data?.data ?? []) {
      map.set(String(row.master_id), row.image_url ?? null);
    }
    return map;
  }, [masterMetaQuery.data?.data]);

  const detailOptionMappings = useMemo(() => {
    const out = new Map<string, MappingRow>();
    for (const row of detailMappings) {
      const variantCode = String(row.external_variant_code ?? "").trim();
      if (!variantCode) continue;
      if (!out.has(variantCode)) out.set(variantCode, row);
    }
    return Array.from(out.values()).sort((a, b) => String(a.external_variant_code ?? "").localeCompare(String(b.external_variant_code ?? "")));
  }, [detailMappings]);

  const detailProductNo = useMemo(() => {
    const fromMapping = String(detailMappings[0]?.external_product_no ?? "").trim();
    if (fromMapping) return fromMapping;
    const fromMaster = masterRows.find((m) => m.master_item_id === detailMasterId)?.product_no ?? "";
    return String(fromMaster).trim();
  }, [detailMappings, detailMasterId, masterRows]);

  const variantMetaQuery = useQuery({
    queryKey: ["shop-dashboard-variant-meta", channelId, detailMasterId, detailProductNo],
    enabled: Boolean(channelId && detailMasterId && detailProductNo),
    queryFn: () =>
      shopApiGet<{ data: { variants: VariantMetaRow[] } }>(
        `/api/channel-products/variants?channel_id=${encodeURIComponent(channelId)}&external_product_no=${encodeURIComponent(detailProductNo)}`,
      ),
  });

  const optionLabelByVariantCode = useMemo(() => {
    const map = new Map<string, string>();
    const variants = variantMetaQuery.data?.data?.variants ?? [];
    for (const v of variants) {
      const code = String(v.variant_code ?? "").trim();
      if (!code) continue;
      map.set(code, String(v.option_label ?? "").trim());
    }
    return map;
  }, [variantMetaQuery.data?.data?.variants]);

  const variantOptionsByCode = useMemo(() => {
    const map = new Map<string, Array<{ name: string; value: string }>>();
    for (const v of variantMetaQuery.data?.data?.variants ?? []) {
      const code = String(v.variant_code ?? "").trim();
      if (!code) continue;
      const opts = Array.isArray(v.options) ? v.options : [];
      map.set(code, opts.map((o) => ({ name: String(o.name ?? "").trim(), value: String(o.value ?? "").trim() })).filter((o) => o.name && o.value));
    }
    return map;
  }, [variantMetaQuery.data?.data?.variants]);

  const optionValueItems = useMemo<OptionValueItem[]>(() => {
    const axisMap = new Map<string, Map<string, Set<string>>>();
    for (const [variantCode, opts] of variantOptionsByCode.entries()) {
      for (const o of opts) {
        const axis = o.name;
        const value = o.value;
        if (!axisMap.has(axis)) axisMap.set(axis, new Map());
        const valueMap = axisMap.get(axis)!;
        if (!valueMap.has(value)) valueMap.set(value, new Set());
        valueMap.get(value)!.add(variantCode);
      }
    }

    const out: OptionValueItem[] = [];
    for (const [axis, valueMap] of axisMap.entries()) {
      for (const [value, codes] of valueMap.entries()) {
        out.push({ axis, value, variant_codes: Array.from(codes).sort() });
      }
    }
    return out.sort((a, b) => a.axis.localeCompare(b.axis) || a.value.localeCompare(b.value));
  }, [variantOptionsByCode]);

  const optionAxisGroups = useMemo<OptionAxisGroup[]>(() => {
    const map = new Map<string, OptionValueItem[]>();
    for (const item of optionValueItems) {
      const prev = map.get(item.axis) ?? [];
      prev.push(item);
      map.set(item.axis, prev);
    }
    return Array.from(map.entries())
      .map(([axis, values]) => ({ axis, values: values.sort((a, b) => a.value.localeCompare(b.value)) }))
      .sort((a, b) => a.axis.localeCompare(b.axis));
  }, [optionValueItems]);

  const selectedAxisValues = useMemo(() => {
    if (!selectedOptionAxis) return [] as OptionValueItem[];
    return optionAxisGroups.find((g) => g.axis === selectedOptionAxis)?.values ?? [];
  }, [optionAxisGroups, selectedOptionAxis]);

  useEffect(() => {
    if (!selectedOptionAxis && optionAxisGroups.length > 0) {
      setSelectedOptionAxis(optionAxisGroups[0].axis);
    }
    if (selectedOptionAxis && !optionAxisGroups.some((g) => g.axis === selectedOptionAxis)) {
      setSelectedOptionAxis(optionAxisGroups[0]?.axis ?? "");
    }
  }, [optionAxisGroups, selectedOptionAxis]);

  const r1RulesQuery = useQuery({
    queryKey: ["sync-r1-rules", optionValueDraft?.sync_rule_set_id],
    enabled: Boolean(optionValueDraft?.sync_rule_set_id && optionValueDraft?.apply_rule === "R1"),
    queryFn: () => shopApiGet<{ data: Array<{ rule_id: string; target_material_code: string }> }>(`/api/sync-rules/r1?rule_set_id=${encodeURIComponent(optionValueDraft?.sync_rule_set_id ?? "")}`),
  });
  const r2RulesQuery = useQuery({
    queryKey: ["sync-r2-rules", optionValueDraft?.sync_rule_set_id],
    enabled: Boolean(optionValueDraft?.sync_rule_set_id && optionValueDraft?.apply_rule === "R2"),
    queryFn: () => shopApiGet<{ data: Array<{ rule_id: string; option_range_expr: string; weight_min_g: number; weight_max_g: number }> }>(`/api/sync-rules/r2?rule_set_id=${encodeURIComponent(optionValueDraft?.sync_rule_set_id ?? "")}`),
  });
  const r3RulesQuery = useQuery({
    queryKey: ["sync-r3-rules", optionValueDraft?.sync_rule_set_id],
    enabled: Boolean(optionValueDraft?.sync_rule_set_id && optionValueDraft?.apply_rule === "R3"),
    queryFn: () => shopApiGet<{ data: Array<{ rule_id: string; color_code: string; margin_min_krw: number; margin_max_krw: number }> }>(`/api/sync-rules/r3?rule_set_id=${encodeURIComponent(optionValueDraft?.sync_rule_set_id ?? "")}`),
  });
  const r4RulesQuery = useQuery({
    queryKey: ["sync-r4-rules", optionValueDraft?.sync_rule_set_id],
    enabled: Boolean(optionValueDraft?.sync_rule_set_id && optionValueDraft?.apply_rule === "R4"),
    queryFn: () => shopApiGet<{ data: Array<{ rule_id: string; match_decoration_code: string }> }>(`/api/sync-rules/r4?rule_set_id=${encodeURIComponent(optionValueDraft?.sync_rule_set_id ?? "")}`),
  });

  const baseLogsQuery = useQuery({
    queryKey: ["shop-base-adjust-logs", channelId, detailMasterId],
    enabled: Boolean(channelId && detailMasterId),
    queryFn: () =>
      shopApiGet<{ data: BaseAdjustmentLog[] }>(
        `/api/channel-base-price-adjustments?channel_id=${encodeURIComponent(channelId)}&master_item_id=${encodeURIComponent(detailMasterId)}&limit=50`,
      ),
  });

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["shop-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["shop-mappings"] }),
      qc.invalidateQueries({ queryKey: ["shop-dashboard-summary"] }),
      qc.invalidateQueries({ queryKey: ["shop-base-adjust-logs"] }),
      qc.invalidateQueries({ queryKey: ["shop-base-adjust-all"] }),
      qc.invalidateQueries({ queryKey: ["shop-dashboard-variant-meta"] }),
      qc.invalidateQueries({ queryKey: ["shop-sync-jobs"] }),
    ]);
  };

  const doRecompute = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number }>("/api/pricing/recompute", "POST", {
        channel_id: channelId,
        master_item_ids: selectedMasterIds.length > 0 ? selectedMasterIds : undefined,
      }),
    onSuccess: async (res) => {
      toast.success(`재계산 완료: ${res.inserted}건`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPull = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; inserted: number; success: number; failed: number }>("/api/channel-prices/pull", "POST", {
        channel_id: channelId,
        channel_product_ids: selectedChannelProductIds.length > 0 ? selectedChannelProductIds : undefined,
      }),
    onSuccess: async (res) => {
      if ((res.failed ?? 0) > 0) toast.error(`기본가격 pull 부분 실패: 성공 ${res.success} / 실패 ${res.failed}`);
      else toast.success(`기본가격 pull 완료: ${res.inserted}건`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doPush = useMutation({
    mutationFn: () =>
      shopApiSend<{ ok: boolean; job_id: string; success: number; failed: number; skipped: number; label_sync?: { failed?: number } }>("/api/channel-prices/push", "POST", {
        channel_id: channelId,
        channel_product_ids: selectedChannelProductIds.length > 0 ? selectedChannelProductIds : undefined,
        sync_option_labels: true,
      }),
    onSuccess: async (res) => {
      if ((res.failed ?? 0) > 0) toast.error(`push 완료(실패 있음): 성공 ${res.success} / 실패 ${res.failed}`);
      else if ((res.label_sync?.failed ?? 0) > 0) toast.error(`push 완료, 옵션명 동기화 일부 실패: ${res.label_sync?.failed ?? 0}건`);
      else toast.success(`push 완료: 성공 ${res.success} / 건너뜀 ${res.skipped}`);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePlating = useMutation({
    mutationFn: (payload: { master_item_id: string; include_master_plating_labor: boolean }) =>
      shopApiSend<{ ok: boolean }>("/api/channel-products/master-toggle", "POST", {
        channel_id: channelId,
        master_item_id: payload.master_item_id,
        include_master_plating_labor: payload.include_master_plating_labor,
      }),
    onSuccess: async () => {
      toast.success("도금공임 포함 설정 저장 완료");
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addBaseAdjustment = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const amount = Number(baseDeltaAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("조정 금액은 0보다 커야 합니다");
      if (!baseDeltaReason.trim()) throw new Error("사유를 입력하세요");
      return shopApiSend<{ data: BaseAdjustmentLog }>("/api/channel-base-price-adjustments", "POST", {
        channel_id: channelId,
        master_item_id: detailMasterId,
        delta_krw: Math.round(amount) * sign,
        reason: baseDeltaReason.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("기본가격 조정 로그 저장 완료");
      setBaseDeltaAmount("");
      setBaseDeltaReason("");
      await doRecompute.mutateAsync();
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveOptionEdit = useMutation({
    mutationFn: async () => {
      if (!editingChannelProductId || !optionEditDraft) throw new Error("수정할 옵션이 없습니다");

      const toNullableNumber = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        if (!Number.isFinite(num)) throw new Error("숫자 형식이 올바르지 않습니다");
        return num;
      };

      if (optionEditDraft.option_price_mode === "MANUAL" && !optionEditDraft.option_manual_target_krw.trim()) {
        throw new Error("직접작성 모드에서는 수동 목표가가 필수입니다");
      }
      if (
        optionEditDraft.option_price_mode === "SYNC"
        && !optionEditDraft.sync_rule_set_id.trim()
      ) {
        throw new Error("SYNC 모드에서는 룰셋 선택이 필수입니다");
      }

      if (optionEditDraft.option_price_mode === "SYNC") {
        const precheck = await shopApiSend<{ data: SyncPreviewResult }>("/api/sync-rules/preview", "POST", {
          channel_id: channelId,
          rule_set_id: optionEditDraft.sync_rule_set_id,
          channel_product_id: editingChannelProductId,
          sample_limit: 1,
        });
        const missing = precheck.data.unmatched_samples?.[0]?.missing_rules ?? [];
        if (precheck.data.blocked > 0 || missing.length > 0) {
          throw new Error(`등록된 룰이 없어 동기화할 수 없습니다: ${missing.join(", ") || "R1/R2/R3/R4"}`);
        }
      }

      await shopApiSend(`/api/channel-products/${encodeURIComponent(editingChannelProductId)}`, "PUT", {
        option_price_mode: optionEditDraft.option_price_mode,
        sync_rule_set_id: optionEditDraft.sync_rule_set_id || null,
        option_material_code: optionEditDraft.option_material_code || null,
        option_color_code: optionEditDraft.option_color_code || null,
        option_decoration_code: optionEditDraft.option_decoration_code || null,
        option_size_value: toNullableNumber(optionEditDraft.option_size_value),
        option_manual_target_krw: toNullableNumber(optionEditDraft.option_manual_target_krw),
        sync_rule_material_enabled: optionEditDraft.sync_rule_material_enabled,
        sync_rule_weight_enabled: optionEditDraft.sync_rule_weight_enabled,
        sync_rule_plating_enabled: optionEditDraft.sync_rule_plating_enabled,
        sync_rule_decoration_enabled: optionEditDraft.sync_rule_decoration_enabled,
      });

      await shopApiSend("/api/pricing/recompute", "POST", {
        channel_id: channelId,
        master_item_ids: detailMasterId ? [detailMasterId] : undefined,
      });
    },
    onSuccess: async () => {
      toast.success("옵션 설정 저장 및 재계산 완료");
      setEditingChannelProductId(null);
      setOptionEditDraft(null);
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewSyncRule = useMutation({
    mutationFn: async ({ ruleSetId, channelProductId }: { ruleSetId: string; channelProductId?: string }) => {
      if (!ruleSetId.trim()) throw new Error("룰셋을 선택하세요");
      const res = await shopApiSend<{ data: SyncPreviewResult }>("/api/sync-rules/preview", "POST", {
        channel_id: channelId,
        rule_set_id: ruleSetId,
        channel_product_id: channelProductId,
        sample_limit: 5,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSyncPreview(data);
      if (data.blocked > 0) {
        const missing = data.unmatched_samples[0]?.missing_rules?.join(", ") ?? "룰"
        toast.error(`미등록/미매칭 룰이 있습니다: ${missing}`);
      } else {
        toast.success(`미리보기 완료: 영향 ${data.affected}/${data.total_candidates}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveOptionValueConfig = useMutation({
    mutationFn: async () => {
      if (!optionValueDraft || !selectedOptionValueKey) throw new Error("설정할 옵션값을 선택하세요");
      const [axis, value] = selectedOptionValueKey.split("::");
      const item = optionValueItems.find((it) => it.axis === axis && it.value === value);
      if (!item) throw new Error("옵션값 정보를 찾지 못했습니다");

      const affectedMappings = detailOptionMappings.filter((m) => item.variant_codes.includes(String(m.external_variant_code ?? "").trim()));
      if (affectedMappings.length === 0) throw new Error("적용 대상 옵션이 없습니다");

      const manualDelta = optionValueDraft.manual_delta_krw.trim() ? Number(optionValueDraft.manual_delta_krw) : 0;
      if (!Number.isFinite(manualDelta)) throw new Error("직접 추가금은 숫자여야 합니다");

      if (optionValueDraft.option_price_mode === "SYNC" && !optionValueDraft.selected_rule_id) {
        throw new Error("SYNC 모드에서는 룰을 선택해야 합니다");
      }

      const selectedR1 = (r1RulesQuery.data?.data ?? []).find((r) => r.rule_id === optionValueDraft.selected_rule_id);
      const selectedR2 = (r2RulesQuery.data?.data ?? []).find((r) => r.rule_id === optionValueDraft.selected_rule_id);
      const selectedR3 = (r3RulesQuery.data?.data ?? []).find((r) => r.rule_id === optionValueDraft.selected_rule_id);
      const selectedR4 = (r4RulesQuery.data?.data ?? []).find((r) => r.rule_id === optionValueDraft.selected_rule_id);

      const rows = affectedMappings.map((m) => {
        const dashboard = rowsByChannelProduct.get(m.channel_product_id);
        const currentTarget = Number(dashboard?.final_target_price_krw ?? 0);
        const nextManualTarget = Math.max(Math.round(currentTarget + manualDelta), 0);
        const axisValue = value;

        const parsedSize = (() => {
          const onlyNumber = axisValue.replace(/[^0-9.+-]/g, "");
          if (!onlyNumber) return m.option_size_value;
          const n = Number(onlyNumber);
          return Number.isFinite(n) ? n : m.option_size_value;
        })();

        return {
          channel_id: m.channel_id,
          master_item_id: m.master_item_id,
          external_product_no: m.external_product_no,
          external_variant_code: String(m.external_variant_code ?? ""),
          option_price_mode: optionValueDraft.option_price_mode,
          sync_rule_set_id: optionValueDraft.option_price_mode === "SYNC" ? (optionValueDraft.sync_rule_set_id || null) : (m.sync_rule_set_id ?? null),
          option_material_code: optionValueDraft.apply_rule === "R1"
            ? (selectedR1?.target_material_code ?? axisValue.toUpperCase())
            : m.option_material_code,
          option_color_code: optionValueDraft.apply_rule === "R3"
            ? (selectedR3?.color_code ?? axisValue.toUpperCase())
            : m.option_color_code,
          option_decoration_code: optionValueDraft.apply_rule === "R4"
            ? (selectedR4?.match_decoration_code ?? axisValue.toUpperCase())
            : m.option_decoration_code,
          option_size_value: optionValueDraft.apply_rule === "R2" ? parsedSize : m.option_size_value,
          option_manual_target_krw: optionValueDraft.option_price_mode === "MANUAL" ? nextManualTarget : null,
          include_master_plating_labor: m.include_master_plating_labor,
          sync_rule_material_enabled: optionValueDraft.apply_rule === "R1",
          sync_rule_weight_enabled: optionValueDraft.apply_rule === "R2",
          sync_rule_plating_enabled: optionValueDraft.apply_rule === "R3",
          sync_rule_decoration_enabled: optionValueDraft.apply_rule === "R4",
          mapping_source: m.mapping_source ?? "MANUAL",
          is_active: m.is_active !== false,
        };
      });

      await shopApiSend("/api/channel-products/bulk", "POST", { rows });
      await shopApiSend("/api/pricing/recompute", "POST", {
        channel_id: channelId,
        master_item_ids: detailMasterId ? [detailMasterId] : undefined,
      });
    },
    onSuccess: async () => {
      toast.success("옵션값 설정 저장 및 재계산 완료");
      await refreshAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startOptionValueEdit = (item: OptionValueItem) => {
    setSelectedOptionValueKey(`${item.axis}::${item.value}`);
    const affectedMappings = detailOptionMappings.filter((m) => item.variant_codes.includes(String(m.external_variant_code ?? "").trim()));
    const first = affectedMappings[0];
    const axisName = item.axis.toLowerCase();
    const guessedRule: OptionValueDraft["apply_rule"] =
      axisName.includes("소재") || axisName.includes("material") ? "R1"
        : axisName.includes("사이즈") || axisName.includes("size") ? "R2"
          : axisName.includes("색") || axisName.includes("color") ? "R3"
            : axisName.includes("장식") || axisName.includes("decoration") ? "R4"
              : "R2";

    setOptionValueDraft({
      option_price_mode: first?.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC",
      sync_rule_set_id: first?.sync_rule_set_id ?? "",
      apply_rule: first?.sync_rule_material_enabled ? "R1" : first?.sync_rule_weight_enabled ? "R2" : first?.sync_rule_plating_enabled ? "R3" : first?.sync_rule_decoration_enabled ? "R4" : guessedRule,
      selected_rule_id: "",
      manual_delta_krw: "0",
    });
  };

  const startOptionEdit = (m: MappingRow) => {
    setEditingChannelProductId(m.channel_product_id);
    setOptionEditDraft({
      option_price_mode: m.option_price_mode === "MANUAL" ? "MANUAL" : "SYNC",
      sync_rule_set_id: m.sync_rule_set_id ?? "",
      option_material_code: m.option_material_code ?? "",
      option_color_code: m.option_color_code ?? "",
      option_decoration_code: m.option_decoration_code ?? "",
      option_size_value: m.option_size_value == null ? "" : String(m.option_size_value),
      option_manual_target_krw: m.option_manual_target_krw == null ? "" : String(m.option_manual_target_krw),
      sync_rule_material_enabled: m.sync_rule_material_enabled !== false,
      sync_rule_weight_enabled: m.sync_rule_weight_enabled !== false,
      sync_rule_plating_enabled: m.sync_rule_plating_enabled !== false,
      sync_rule_decoration_enabled: m.sync_rule_decoration_enabled !== false,
    });
  };

  const cancelOptionEdit = () => {
    setEditingChannelProductId(null);
    setOptionEditDraft(null);
    setSyncPreview(null);
  };

  return (
    <div className="space-y-4">
      <ActionBar
        title="가격 대시보드"
        subtitle="마스터 1행 + 상세 옵션 관리"
        actions={(
          <>
            <Button variant="secondary" onClick={() => doPull.mutate()} disabled={!channelId || doPull.isPending}>
              {doPull.isPending ? "불러오는 중..." : "현재가 불러오기(기본가)"}
            </Button>
            <Button variant="secondary" onClick={() => doRecompute.mutate()} disabled={!channelId || doRecompute.isPending}>
              {doRecompute.isPending ? "재계산 중..." : "재계산"}
            </Button>
            <Button onClick={() => doPush.mutate()} disabled={!channelId || doPush.isPending}>
              {doPush.isPending ? "반영 중..." : "선택 마스터 전체 push"}
            </Button>
          </>
        )}
      />

      <Card>
        <CardHeader title="요약" description={`전체 ${fmt(summaryQuery.data?.data.counts.total)} / 불일치 ${fmt(summaryQuery.data?.data.counts.out_of_sync)} / 오류 ${fmt(summaryQuery.data?.data.counts.error)}`} />
        <CardBody className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">채널 선택</option>
            {channels.map((ch) => (
              <option key={ch.channel_id} value={ch.channel_id}>{ch.channel_name}</option>
            ))}
          </Select>
          <Select value={priceState} onChange={(e) => setPriceState(e.target.value)}>
            <option value="">상태 전체</option>
            <option value="OK">정상</option>
            <option value="OUT_OF_SYNC">불일치</option>
            <option value="ERROR">오류</option>
          </Select>
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="모델명 검색" />
          <Button
            variant="secondary"
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const row of masterRows) next[row.master_item_id] = true;
              setSelectedMasters(next);
            }}
          >
            마스터 전체 선택
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="마스터 갤러리" description={`마스터 ${masterRows.length}건 / 선택 ${selectedMasterIds.length}건`} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const row of masterRows) next[row.master_item_id] = true;
                setSelectedMasters(next);
              }}
            >
              전체 선택
            </Button>
            <Button variant="secondary" onClick={() => setSelectedMasters({})}>선택 해제</Button>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {masterRows.map((row) => {
              const imageUrl = masterImageById.get(row.master_item_id) ?? null;
              const isSelected = selectedMasters[row.master_item_id] ?? false;
              return (
                <div
                  key={row.master_item_id}
                  className={`relative overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] transition hover:border-[var(--primary)] ${detailMasterId === row.master_item_id ? "ring-2 ring-[var(--primary)]" : ""}`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setDetailMasterId(row.master_item_id);
                      setIsDetailDrawerOpen(true);
                    }}
                  >
                    <div className="relative aspect-square bg-[var(--subtle-bg)]">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={row.model_name ?? row.product_no} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">이미지 없음</div>
                      )}
                      <div className="absolute right-2 top-2 rounded-full bg-[var(--panel)]/90 px-2 py-1 text-xs">
                        {toStateKo(row.price_state)}
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="truncate text-sm font-semibold">{row.model_name ?? "-"}</div>
                      <div className="text-xs text-[var(--muted)]">{row.product_no} / 옵션 {row.option_count}개</div>
                      <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] px-2 py-2 text-xs">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          <div>
                            <div className="text-[var(--muted)]">총중량</div>
                            <div className="font-semibold">{fmt(row.total_weight_g)}</div>
                          </div>
                          <div>
                            <div className="text-[var(--muted)]">총공임</div>
                            <div className="font-semibold">{fmt(row.total_labor_krw)}</div>
                          </div>
                          <div>
                            <div className="text-[var(--muted)]">마스터</div>
                            <div className="font-semibold">{fmt(row.master_original_krw ?? row.final_price_krw)}</div>
                          </div>
                          <div>
                            <div className="text-[var(--muted)]">쇼핑몰</div>
                            <div className="font-semibold">{fmt(row.base_current_krw)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                  <label className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[var(--panel)]/90 px-2 py-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => setSelectedMasters((prev) => ({ ...prev, [row.master_item_id]: e.target.checked }))}
                    />
                    선택
                  </label>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Sheet
        open={Boolean(detailMasterId) && isDetailDrawerOpen}
        onOpenChange={(open) => {
          setIsDetailDrawerOpen(open);
        }}
        title="마스터 상세"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <div className="text-sm font-semibold">옵션 상세</div>
            <div className="text-xs text-[var(--muted)]">master_item_id: {detailMasterId || "-"}</div>
          </div>
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {detailMasterId ? (
              <>
                <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3 text-sm">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-[var(--muted)]">마스터 원본 기준가</div>
                      <div className="font-semibold">{fmt(detailMasterRow?.master_original_krw ?? null)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">운영 목표가</div>
                      <div className="font-semibold">{fmt(detailMasterRow?.final_price_krw ?? null)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted)]">쇼핑몰 현재가</div>
                      <div className="font-semibold">{fmt(detailMasterRow?.base_current_krw ?? null)}</div>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={detailMappings.every((m) => m.include_master_plating_labor !== false)}
                    onChange={(e) =>
                      togglePlating.mutate({
                        master_item_id: detailMasterId,
                        include_master_plating_labor: e.target.checked,
                      })
                    }
                  />
                  마스터 도금공임 포함
                </label>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_auto_auto]">
                  <Input value={baseDeltaAmount} onChange={(e) => setBaseDeltaAmount(e.target.value)} placeholder="조정금액" />
                  <Input value={baseDeltaReason} onChange={(e) => setBaseDeltaReason(e.target.value)} placeholder="사유(필수)" />
                  <Button variant="secondary" onClick={() => addBaseAdjustment.mutate(1)} disabled={addBaseAdjustment.isPending}>+ 적용</Button>
                  <Button variant="secondary" onClick={() => addBaseAdjustment.mutate(-1)} disabled={addBaseAdjustment.isPending}>- 적용</Button>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  R1=소재시세차액, R2=사이즈/중량구간, R3=색상도금마진, R4=장식
                </div>

                {syncPreview ? (
                  <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-2 text-xs">
                    <div>미리보기 영향: {fmt(syncPreview.affected)} / {fmt(syncPreview.total_candidates)} (차단 {fmt(syncPreview.blocked)})</div>
                    <div>적용 샘플: {syncPreview.matched_samples.map((s) => `${s.channel_product_id.slice(0, 8)}:${fmt(s.total_delta_krw)}`).join(", ") || "없음"}</div>
                    <div>미등록 샘플: {syncPreview.unmatched_samples.map((s) => `${s.channel_product_id.slice(0, 8)}:${s.missing_rules.join("/")}`).join(", ") || "없음"}</div>
                  </div>
                ) : null}

                <div className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                  <div className="mb-2 text-sm font-semibold">옵션값 설정 (2+3+3)</div>
                  <div className="mb-2 text-xs text-[var(--muted)]">1) 옵션축(예: 소재, 색상) 선택 -&gt; 2) 해당 값(예: 14K/18K) 상세에서 Sync 또는 직접작성 설정</div>

                  <div className="mb-3 max-h-[180px] overflow-auto rounded border border-[var(--hairline)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--panel)] text-left">
                        <tr>
                          <th className="px-3 py-2">옵션 카테고리</th>
                          <th className="px-3 py-2">값 개수</th>
                          <th className="px-3 py-2">상세</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optionAxisGroups.map((group) => {
                          const selected = group.axis === selectedOptionAxis;
                          return (
                            <tr key={group.axis} className="border-t border-[var(--hairline)]">
                              <td className="px-3 py-2">{group.axis}</td>
                              <td className="px-3 py-2">{fmt(group.values.length)}</td>
                              <td className="px-3 py-2">
                                <Button variant="secondary" onClick={() => setSelectedOptionAxis(group.axis)}>
                                  {selected ? "열림" : "상세보기"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selectedOptionAxis ? (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-[var(--muted)]">{selectedOptionAxis} 값 목록</div>
                      <div className="max-h-[220px] overflow-auto rounded border border-[var(--hairline)]">
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--panel)] text-left">
                            <tr>
                              <th className="px-3 py-2">옵션값</th>
                              <th className="px-3 py-2">적용 조합수</th>
                              <th className="px-3 py-2">설정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAxisValues.map((item) => {
                              const key = `${item.axis}::${item.value}`;
                              const selected = key === selectedOptionValueKey;
                              return (
                                <tr key={key} className="border-t border-[var(--hairline)]">
                                  <td className="px-3 py-2">{item.value}</td>
                                  <td className="px-3 py-2">{fmt(item.variant_codes.length)}</td>
                                  <td className="px-3 py-2">
                                    <Button variant="secondary" onClick={() => startOptionValueEdit(item)}>{selected ? "설정중" : "설정"}</Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {optionValueDraft ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_150px_1fr_1fr_120px_auto]">
                          <Select
                            value={optionValueDraft.option_price_mode}
                            onChange={(e) => setOptionValueDraft((prev) => prev ? { ...prev, option_price_mode: e.target.value === "MANUAL" ? "MANUAL" : "SYNC" } : prev)}
                          >
                            <option value="SYNC">동기화</option>
                            <option value="MANUAL">직접작성</option>
                          </Select>
                          <Select
                            value={optionValueDraft.apply_rule}
                            onChange={(e) => setOptionValueDraft((prev) => prev ? { ...prev, apply_rule: e.target.value as OptionValueDraft["apply_rule"], selected_rule_id: "" } : prev)}
                            disabled={optionValueDraft.option_price_mode !== "SYNC"}
                          >
                            <option value="R1">소재 룰</option>
                            <option value="R2">사이즈 룰</option>
                            <option value="R3">색상 룰</option>
                            <option value="R4">장식 룰</option>
                          </Select>
                          <Select
                            value={optionValueDraft.sync_rule_set_id}
                            onChange={(e) => setOptionValueDraft((prev) => prev ? { ...prev, sync_rule_set_id: e.target.value, selected_rule_id: "" } : prev)}
                            disabled={optionValueDraft.option_price_mode !== "SYNC"}
                          >
                            <option value="">룰셋 선택</option>
                            {(syncRuleSetQuery.data?.data ?? []).map((rs) => (
                              <option key={rs.rule_set_id} value={rs.rule_set_id}>{rs.name}</option>
                            ))}
                          </Select>
                          <Select
                            value={optionValueDraft.selected_rule_id}
                            onChange={(e) => setOptionValueDraft((prev) => prev ? { ...prev, selected_rule_id: e.target.value } : prev)}
                            disabled={optionValueDraft.option_price_mode !== "SYNC"}
                          >
                            <option value="">룰 선택</option>
                            {optionValueDraft.apply_rule === "R1" ? (r1RulesQuery.data?.data ?? []).map((r) => (
                              <option key={r.rule_id} value={r.rule_id}>{r.target_material_code}</option>
                            )) : null}
                            {optionValueDraft.apply_rule === "R2" ? (r2RulesQuery.data?.data ?? []).map((r) => (
                              <option key={r.rule_id} value={r.rule_id}>{`${r.option_range_expr} / ${fmt(r.weight_min_g)}~${fmt(r.weight_max_g)}g`}</option>
                            )) : null}
                            {optionValueDraft.apply_rule === "R3" ? (r3RulesQuery.data?.data ?? []).map((r) => (
                              <option key={r.rule_id} value={r.rule_id}>{`${r.color_code} / ${fmt(r.margin_min_krw)}~${fmt(r.margin_max_krw)}`}</option>
                            )) : null}
                            {optionValueDraft.apply_rule === "R4" ? (r4RulesQuery.data?.data ?? []).map((r) => (
                              <option key={r.rule_id} value={r.rule_id}>{r.match_decoration_code}</option>
                            )) : null}
                          </Select>
                          <Input
                            value={optionValueDraft.manual_delta_krw}
                            onChange={(e) => setOptionValueDraft((prev) => prev ? { ...prev, manual_delta_krw: e.target.value } : prev)}
                            placeholder="직접 추가금"
                            disabled={optionValueDraft.option_price_mode !== "MANUAL"}
                          />
                          <Button onClick={() => saveOptionValueConfig.mutate()} disabled={saveOptionValueConfig.isPending}>저장</Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="max-h-[320px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        <th className="px-3 py-2">옵션코드</th>
                        <th className="px-3 py-2">옵션명(결과)</th>
                        <th className="px-3 py-2">목표가</th>
                        <th className="px-3 py-2">현재가</th>
                        <th className="px-3 py-2">룰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOptionMappings.map((m) => {
                        const row = rowsByChannelProduct.get(m.channel_product_id);
                        return (
                          <tr key={m.channel_product_id} className="border-t border-[var(--hairline)]">
                            <td className="px-3 py-2">{m.external_variant_code}</td>
                            <td className="px-3 py-2">{optionLabelByVariantCode.get(String(m.external_variant_code ?? "").trim()) || "-"}</td>
                            <td className="px-3 py-2">{fmt(row?.final_target_price_krw ?? null)}</td>
                            <td className="px-3 py-2">{fmt(row?.current_channel_price_krw ?? null)}</td>
                            <td className="px-3 py-2 text-xs">{syncRuleSummary(m)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="max-h-[200px] overflow-auto rounded-[var(--radius)] border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--panel)] text-left">
                      <tr>
                        <th className="px-3 py-2">시각</th>
                        <th className="px-3 py-2">delta</th>
                        <th className="px-3 py-2">사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(baseLogsQuery.data?.data ?? []).map((log) => (
                        <tr key={log.adjustment_log_id} className="border-t border-[var(--hairline)]">
                          <td className="px-3 py-2 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2">{fmt(log.delta_krw)}</td>
                          <td className="px-3 py-2">{log.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--muted)]">마스터를 선택하면 옵션 상세가 표시됩니다.</div>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
