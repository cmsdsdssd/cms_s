'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ActionBar } from '@/components/layout/action-bar';
import { ShoppingPageHeader } from '@/components/layout/shopping-page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { shopApiGet, shopApiSend } from '@/lib/shop/http';

type NumberLike = number | string | null | undefined;
type Category = 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'OTHER';

type Channel = {
  channel_id: string;
  channel_name: string;
  channel_code: string;
};

type ContextRow = {
  channel_product_id: string;
  master_item_id: string;
  external_product_no: string;
  model_name: string | null;
  material_code_default: string | null;
  has_variants?: boolean;
  row_count?: number;
  variant_count?: number;
  base_channel_product_id?: string;
  material_option_count?: number;
  size_option_count?: number;
  color_option_count?: number;
  decor_option_count?: number;
  rule_count?: number;
};

type PoolMaster = {
  master_item_id: string;
  model_name: string | null;
  total_labor_cost_krw?: NumberLike;
  total_labor_sell_krw?: NumberLike;
};

type ColorOption = {
  color_code: string;
  display_name: string;
  base_delta_krw?: NumberLike;
};

type ColorCatalogRow = {
  combo_id: string;
  combo_key: string;
  display_name: string;
  base_delta_krw: number;
  sort_order: number;
  is_active: boolean;
};

type PoolsData = {
  contexts?: ContextRow[];
  materials?: string[];
  colors?: ColorOption[];
  decoration_masters?: PoolMaster[];
  master_options?: PoolMaster[];
  masters?: PoolMaster[];
};

type Rule = {
  rule_id: string;
  category_key: Category;
  scope_material_code: string | null;
  additional_weight_g: NumberLike;
  additional_weight_min_g?: NumberLike;
  additional_weight_max_g?: NumberLike;
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  base_labor_cost_krw: NumberLike;
  additive_delta_krw: NumberLike;
  note?: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type RulePayload = {
  rule_id?: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  category_key: Category;
  scope_material_code?: string | null;
  additional_weight_g?: number | null;
  additional_weight_min_g?: number | null;
  additional_weight_max_g?: number | null;
  plating_enabled?: boolean | null;
  color_code?: string | null;
  decoration_master_id?: string | null;
  decoration_model_name?: string | null;
  base_labor_cost_krw?: number;
  additive_delta_krw: number;
  size_price_mode?: string | null;
  formula_multiplier?: number | null;
  formula_offset_krw?: number | null;
  rounding_unit_krw?: number | null;
  rounding_mode?: string | null;
  fixed_delta_krw?: number | null;
  note?: string | null;
  is_active: boolean;
};

type LaborLog = {
  adjustment_log_id: string;
  delta_krw: NumberLike;
  reason: string;
  created_at: string;
};

type SizeDraft = {
  ruleId: string;
  materialCode: string;
  weightMinG: string;
  weightMaxG: string;
  additiveKrw: string;
};

type ColorDraft = {
  ruleId: string;
  materialCode: string;
  colorCode: string;
  additiveKrw: string;
};

type DecorDraft = {
  ruleId: string;
  decorationMasterId: string;
  additiveKrw: string;
};

type OtherDraft = {
  ruleId: string;
  note: string;
  additiveKrw: string;
};

type SaveRuleInput = {
  label: string;
  payload: RulePayload;
};

type DraftSlot<T> = {
  resetKey: string;
  value: T;
};

type DeleteRuleInput = {
  label: string;
  ruleId: string;
};

const RULE_WEIGHT_OPTIONS = Array.from({ length: 10_000 }, (_, index) => ((index + 1) / 100).toFixed(2));
const BULK_WEIGHT_OPTIONS = Array.from({ length: 10_001 }, (_, index) => (index / 100).toFixed(2));
const LABOR_AMOUNT_OPTIONS = Array.from({ length: 10_001 }, (_, index) => String(index * 100));
const COLOR_AMOUNT_OPTIONS = Array.from({ length: 201 }, (_, index) => String(index * 1000));

const toNumber = (value: NumberLike): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseAmount = (value: string): number => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeColorCode = (value: string): string => String(value ?? "").trim().toUpperCase();

const buildMergedColorChoices = (baseColors: ColorOption[], colorRules: Rule[], currentColorCode: string): ColorOption[] => {
  const merged = new Map<string, ColorOption>();

  for (const color of baseColors) {
    const colorCode = normalizeColorCode(color.color_code);
    if (!colorCode || merged.has(colorCode)) continue;
    const displayName = String(color.display_name ?? '').trim() || colorCode;
    merged.set(colorCode, { color_code: colorCode, display_name: displayName });
  }

  for (const rule of colorRules) {
    const colorCode = normalizeColorCode(rule.color_code ?? '');
    if (!colorCode || merged.has(colorCode)) continue;
    merged.set(colorCode, { color_code: colorCode, display_name: colorCode });
  }

  const typedColorCode = normalizeColorCode(currentColorCode);
  if (typedColorCode && !merged.has(typedColorCode)) {
    merged.set(typedColorCode, { color_code: typedColorCode, display_name: typedColorCode });
  }

  return Array.from(merged.values()).sort((left, right) => {
    const nameCompare = left.display_name.localeCompare(right.display_name);
    if (nameCompare !== 0) return nameCompare;
    return left.color_code.localeCompare(right.color_code);
  });
};

const formatWon = (value: NumberLike): string => {
  if (value === null || value === undefined || value === '') return '-';
  return `${Math.round(toNumber(value)).toLocaleString()}원`;
};

const formatWhen = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : '-';
};

const laborOf = (master: PoolMaster | null | undefined): number => {
  if (!master) return 0;
  const cost = master.total_labor_cost_krw;
  const sell = master.total_labor_sell_krw;
  return toNumber(cost ?? sell ?? 0);
};

const contextKeyOf = (row: ContextRow): string => `${row.master_item_id}::${row.external_product_no}`;

const describeError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return '요청 처리 중 오류가 발생했습니다.';
};

const createEmptySizeDraft = (materials: string[]): SizeDraft => ({
  ruleId: '',
  materialCode: materials[0] ?? '',
  weightMinG: RULE_WEIGHT_OPTIONS[0] ?? '0.01',
  weightMaxG: RULE_WEIGHT_OPTIONS[0] ?? '0.01',
  additiveKrw: '0',
});

const createEmptyColorDraft = (materials: string[], colors: ColorOption[]): ColorDraft => ({
  ruleId: '',
  materialCode: materials[0] ?? '',
  colorCode: colors[0]?.color_code ?? '',
  additiveKrw: '0',
});

const createEmptyDecorDraft = (masters: PoolMaster[]): DecorDraft => ({
  ruleId: '',
  decorationMasterId: masters[0]?.master_item_id ?? '',
  additiveKrw: '0',
});

const createEmptyOtherDraft = (): OtherDraft => ({
  ruleId: '',
  note: '',
  additiveKrw: '0',
});

export default function ShoppingRulesPage() {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['shop-channels'],
    queryFn: () => shopApiGet<{ data: Channel[] }>('/api/channels'),
  });
  const channels = useMemo(() => channelsQuery.data?.data ?? [], [channelsQuery.data?.data]);

  const [channelId, setChannelId] = useState('');
  const effectiveChannelId = channelId || channels[0]?.channel_id || '';

  const poolsQuery = useQuery({
    queryKey: ['option-labor-rule-pools', effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: PoolsData }>(`/api/option-labor-rule-pools?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });

  const pools = poolsQuery.data?.data ?? null;
  const contexts = useMemo(() => pools?.contexts ?? [], [pools?.contexts]);
  const materials = useMemo(() => pools?.materials ?? [], [pools?.materials]);
  const colors = useMemo(() => pools?.colors ?? [], [pools?.colors]);
  const decorationMasters = useMemo(() => pools?.decoration_masters ?? [], [pools?.decoration_masters]);
  const poolMasterOptions = useMemo(() => pools?.master_options ?? [], [pools?.master_options]);
  const poolMasters = useMemo(() => pools?.masters ?? [], [pools?.masters]);
  const masterSource = useMemo(
    () => (poolMasterOptions.length ? poolMasterOptions : poolMasters),
    [poolMasterOptions, poolMasters],
  );

  const colorCatalogQuery = useQuery({
    queryKey: ['channel-color-combos', effectiveChannelId],
    enabled: Boolean(effectiveChannelId),
    queryFn: () => shopApiGet<{ data: ColorCatalogRow[] }>(`/api/channel-color-combos?channel_id=${encodeURIComponent(effectiveChannelId)}`),
  });
  const [colorCatalogRows, setColorCatalogRows] = useState<ColorCatalogRow[]>([]);
  useEffect(() => {
    setColorCatalogRows(colorCatalogQuery.data?.data ?? []);
  }, [colorCatalogQuery.data?.data]);
  const saveColorCatalogMutation = useMutation({
    mutationFn: () => shopApiSend<{ data: ColorCatalogRow[] }>('/api/channel-color-combos', 'POST', {
      channel_id: effectiveChannelId,
      rows: colorCatalogRows.map((row) => ({
        combo_key: row.combo_key,
        display_name: row.display_name,
        base_delta_krw: parseAmount(String(row.base_delta_krw ?? 0)),
        sort_order: row.sort_order,
        is_active: row.is_active,
      })),
    }),
    onSuccess: async () => {
      toast.success('색상 중앙금액 저장 완료');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['channel-color-combos', effectiveChannelId] }),
        queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', effectiveChannelId] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const laborMasters = useMemo(() => {
    const entries = [...masterSource, ...decorationMasters];
    const map = new Map<string, PoolMaster>();
    for (const entry of entries) {
      if (!entry.master_item_id || map.has(entry.master_item_id)) continue;
      map.set(entry.master_item_id, entry);
    }
    return Array.from(map.values()).sort((left, right) => {
      const leftName = left.model_name ?? left.master_item_id;
      const rightName = right.model_name ?? right.master_item_id;
      return leftName.localeCompare(rightName) || left.master_item_id.localeCompare(right.master_item_id);
    });
  }, [decorationMasters, masterSource]);

  const [contextKey, setContextKey] = useState('');
  const [contextSearch, setContextSearch] = useState('');
  const effectiveContextKey = useMemo(() => {
    if (contextKey && contexts.some((row) => contextKeyOf(row) === contextKey)) return contextKey;
    return contexts[0] ? contextKeyOf(contexts[0]) : '';
  }, [contextKey, contexts]);

  const selectedContext = useMemo(
    () => contexts.find((row) => contextKeyOf(row) === effectiveContextKey) ?? null,
    [effectiveContextKey, contexts],
  );
  const filteredContexts = useMemo(() => {
    const q = contextSearch.trim().toLowerCase();
    if (!q) return contexts;
    return contexts.filter((row) =>
      String(row.model_name ?? "").toLowerCase().includes(q)
      || String(row.external_product_no ?? "").toLowerCase().includes(q)
      || String(row.master_item_id ?? "").toLowerCase().includes(q)
      || String(row.base_channel_product_id ?? row.channel_product_id ?? "").toLowerCase().includes(q),
    );
  }, [contextSearch, contexts]);
  const contextSelectRows = useMemo(() => {
    const next = new Map<string, ContextRow>();
    if (selectedContext) {
      next.set(contextKeyOf(selectedContext), selectedContext);
    }
    for (const row of filteredContexts) {
      next.set(contextKeyOf(row), row);
      if (next.size >= 200) break;
    }
    return Array.from(next.values());
  }, [filteredContexts, selectedContext]);

  const rulesQuery = useQuery({
    queryKey: [
      'option-labor-rules',
      effectiveChannelId,
      selectedContext?.master_item_id ?? '',
      selectedContext?.external_product_no ?? '',
    ],
    enabled: Boolean(effectiveChannelId && selectedContext),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('channel_id', effectiveChannelId);
      params.set('master_item_id', selectedContext?.master_item_id ?? '');
      params.set('external_product_no', selectedContext?.external_product_no ?? '');
      return shopApiGet<{ data: Rule[] }>(`/api/option-labor-rules?${params.toString()}`);
    },
  });

  const rules = useMemo(() => rulesQuery.data?.data ?? [], [rulesQuery.data?.data]);
  const materialRule = useMemo(() => rules.find((rule) => rule.category_key === 'MATERIAL') ?? null, [rules]);
  const sizeRules = useMemo(
    () =>
      [...rules]
        .filter((rule) => rule.category_key === 'SIZE')
        .sort((left, right) => {
          const materialCompare = (left.scope_material_code ?? '').localeCompare(right.scope_material_code ?? '');
          if (materialCompare !== 0) return materialCompare;
          const leftMin = toNumber(left.additional_weight_min_g ?? left.additional_weight_g);
          const rightMin = toNumber(right.additional_weight_min_g ?? right.additional_weight_g);
          if (leftMin !== rightMin) return leftMin - rightMin;
          return toNumber(left.additional_weight_max_g ?? left.additional_weight_g) - toNumber(right.additional_weight_max_g ?? right.additional_weight_g);
        }),
    [rules],
  );
  const colorRules = useMemo(
    () =>
      [...rules]
        .filter((rule) => rule.category_key === 'COLOR_PLATING')
        .sort((left, right) => {
          const platingCompare = Number(left.plating_enabled === true) - Number(right.plating_enabled === true);
          if (platingCompare !== 0) return platingCompare;
          return (left.color_code ?? '').localeCompare(right.color_code ?? '');
        }),
    [rules],
  );
  const decorRules = useMemo(
    () =>
      [...rules]
        .filter((rule) => rule.category_key === 'DECOR')
        .sort((left, right) => {
          const leftName = left.decoration_model_name ?? left.decoration_master_id ?? '';
          const rightName = right.decoration_model_name ?? right.decoration_master_id ?? '';
          return leftName.localeCompare(rightName);
        }),
    [rules],
  );
  const otherRules = useMemo(
    () =>
      [...rules]
        .filter((rule) => rule.category_key === 'OTHER')
        .sort((left, right) => (left.note ?? '').localeCompare(right.note ?? '')),
    [rules],
  );


  const basePayload = selectedContext
    ? {
        channel_id: effectiveChannelId,
        master_item_id: selectedContext.master_item_id,
        external_product_no: selectedContext.external_product_no,
        is_active: true,
      }
    : null;

  const sizeDraftResetKey = `${effectiveContextKey}::${materials.join('|')}`;
  const defaultSizeDraft = useMemo(() => createEmptySizeDraft(materials), [materials]);
  const [sizeDraftSlot, setSizeDraftSlot] = useState<DraftSlot<SizeDraft>>({ resetKey: '', value: createEmptySizeDraft([]) });
  const sizeDraft = sizeDraftSlot.resetKey === sizeDraftResetKey ? sizeDraftSlot.value : defaultSizeDraft;
  const setSizeDraft = (next: SizeDraft | ((current: SizeDraft) => SizeDraft)) => {
    const current = sizeDraftSlot.resetKey === sizeDraftResetKey ? sizeDraftSlot.value : defaultSizeDraft;
    const value = typeof next === 'function' ? next(current) : next;
    setSizeDraftSlot({ resetKey: sizeDraftResetKey, value });
  };
  const resetSizeDraft = () => {
    setSizeDraftSlot({ resetKey: sizeDraftResetKey, value: defaultSizeDraft });
  };

  const [colorDraftSlot, setColorDraftSlot] = useState<DraftSlot<ColorDraft>>({ resetKey: '', value: createEmptyColorDraft([], []) });
  const colorDraftContextKey = `${effectiveContextKey}::${materials.join('|')}`;
  const colorDraftMatchesContext = colorDraftSlot.resetKey.startsWith(`${colorDraftContextKey}::`);
  const currentTypedColorCode = colorDraftMatchesContext ? colorDraftSlot.value.colorCode : '';
  const activeColorCatalogChoices = useMemo(
    () => colorCatalogRows.filter((row) => row.is_active !== false).map((row) => ({ color_code: row.combo_key, display_name: row.display_name, base_delta_krw: row.base_delta_krw })),
    [colorCatalogRows],
  );
  const colorCatalogByCode = useMemo(() => {
    const map = new Map<string, ColorCatalogRow>();
    for (const row of colorCatalogRows) {
      const key = normalizeColorCode(row.combo_key);
      if (!key || map.has(key)) continue;
      map.set(key, row);
    }
    return map;
  }, [colorCatalogRows]);
  const mergedColorChoices = useMemo(
    () => buildMergedColorChoices(activeColorCatalogChoices.length > 0 ? activeColorCatalogChoices : colors, colorRules, currentTypedColorCode),
    [activeColorCatalogChoices, colorRules, colors, currentTypedColorCode],
  );
  const colorDraftResetKey = `${colorDraftContextKey}::${mergedColorChoices.map((row) => row.color_code).join('|')}`;
  const defaultColorDraft = useMemo(() => createEmptyColorDraft(materials, mergedColorChoices), [materials, mergedColorChoices]);
  const colorDraft = colorDraftMatchesContext ? colorDraftSlot.value : defaultColorDraft;
  const setColorDraft = (next: ColorDraft | ((current: ColorDraft) => ColorDraft)) => {
    const current = colorDraftMatchesContext ? colorDraftSlot.value : defaultColorDraft;
    const value = typeof next === 'function' ? next(current) : next;
    setColorDraftSlot({ resetKey: colorDraftResetKey, value });
  };
  const resetColorDraft = () => {
    setColorDraftSlot({ resetKey: colorDraftResetKey, value: defaultColorDraft });
  };
  const updateColorCatalogRow = (comboId: string, patch: Partial<ColorCatalogRow>) => {
    setColorCatalogRows((prev) => prev.map((row) => (row.combo_id === comboId ? { ...row, ...patch } : row)));
  };

  const [includeAllDecorMasters, setIncludeAllDecorMasters] = useState(false);
  const decorMasterChoices = useMemo(
    () => (includeAllDecorMasters ? laborMasters : decorationMasters),
    [decorationMasters, includeAllDecorMasters, laborMasters],
  );
  const decorDraftResetKey = `${effectiveContextKey}::${includeAllDecorMasters ? 'ALL' : 'DECOR'}::${decorMasterChoices.map((row) => row.master_item_id).join('|')}`;
  const defaultDecorDraft = useMemo(() => createEmptyDecorDraft(decorMasterChoices), [decorMasterChoices]);
  const [decorDraftSlot, setDecorDraftSlot] = useState<DraftSlot<DecorDraft>>({ resetKey: '', value: createEmptyDecorDraft([]) });
  const decorDraft = decorDraftSlot.resetKey === decorDraftResetKey ? decorDraftSlot.value : defaultDecorDraft;
  const setDecorDraft = (next: DecorDraft | ((current: DecorDraft) => DecorDraft)) => {
    const current = decorDraftSlot.resetKey === decorDraftResetKey ? decorDraftSlot.value : defaultDecorDraft;
    const value = typeof next === 'function' ? next(current) : next;
    setDecorDraftSlot({ resetKey: decorDraftResetKey, value });
  };
  const resetDecorDraft = () => {
    setDecorDraftSlot({ resetKey: decorDraftResetKey, value: defaultDecorDraft });
  };

  const otherDraftResetKey = effectiveContextKey;
  const defaultOtherDraft = useMemo(() => createEmptyOtherDraft(), []);
  const [otherDraftSlot, setOtherDraftSlot] = useState<DraftSlot<OtherDraft>>({ resetKey: '', value: createEmptyOtherDraft() });
  const otherDraft = otherDraftSlot.resetKey === otherDraftResetKey ? otherDraftSlot.value : defaultOtherDraft;
  const setOtherDraft = (next: OtherDraft | ((current: OtherDraft) => OtherDraft)) => {
    const current = otherDraftSlot.resetKey === otherDraftResetKey ? otherDraftSlot.value : defaultOtherDraft;
    const value = typeof next === 'function' ? next(current) : next;
    setOtherDraftSlot({ resetKey: otherDraftResetKey, value });
  };
  const resetOtherDraft = () => {
    setOtherDraftSlot({ resetKey: otherDraftResetKey, value: defaultOtherDraft });
  };

  const [laborMasterId, setLaborMasterId] = useState('');
  const preferredLaborMasterId = useMemo(() => {
    if (!laborMasters.length) return '';
    const preferred = selectedContext?.master_item_id ?? '';
    if (preferred && laborMasters.some((row) => row.master_item_id === preferred)) return preferred;
    return laborMasters[0]?.master_item_id ?? '';
  }, [laborMasters, selectedContext?.master_item_id]);
  const effectiveLaborMasterId = useMemo(() => {
    if (laborMasterId && laborMasters.some((row) => row.master_item_id === laborMasterId)) return laborMasterId;
    return preferredLaborMasterId;
  }, [laborMasterId, laborMasters, preferredLaborMasterId]);

  const currentLaborMaster = useMemo(
    () => laborMasters.find((row) => row.master_item_id === effectiveLaborMasterId) ?? null,
    [effectiveLaborMasterId, laborMasters],
  );
  const selectedDecorMaster = laborMasters.find((row) => row.master_item_id === decorDraft.decorationMasterId)
    ?? decorationMasters.find((row) => row.master_item_id === decorDraft.decorationMasterId)
    ?? null;

  const [laborDelta, setLaborDelta] = useState('0');
  const [laborReason, setLaborReason] = useState('');
  const [bulkCategory, setBulkCategory] = useState<'SIZE' | 'COLOR_PLATING'>('SIZE');
  const [bulkMaterialCode, setBulkMaterialCode] = useState('');
  const [bulkSizeMinG, setBulkSizeMinG] = useState('0.00');
  const [bulkSizeMaxG, setBulkSizeMaxG] = useState('0.00');
  const [bulkColorCode, setBulkColorCode] = useState('');
  const [bulkDeltaKrw, setBulkDeltaKrw] = useState('0');

  const laborLogQuery = useQuery({
    queryKey: ['channel-labor-price-adjustments', effectiveChannelId, effectiveLaborMasterId],
    enabled: Boolean(effectiveChannelId && effectiveLaborMasterId),
    queryFn: () =>
      shopApiGet<{ data: LaborLog[] }>(
        `/api/channel-labor-price-adjustments?channel_id=${encodeURIComponent(effectiveChannelId)}&master_item_id=${encodeURIComponent(effectiveLaborMasterId)}&limit=30`,
      ),
  });

  const refreshRules = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          'option-labor-rules',
          effectiveChannelId,
          selectedContext?.master_item_id ?? '',
          selectedContext?.external_product_no ?? '',
        ],
      }),
      queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', effectiveChannelId] }),
    ]);
  };

  const refreshPricingPreview = async (): Promise<void> => {
    if (!effectiveChannelId || !selectedContext?.master_item_id) return;
    await shopApiSend('/api/pricing/recompute', 'POST', {
      channel_id: effectiveChannelId,
      master_item_ids: [selectedContext.master_item_id],
    });
  };


  const saveRuleMutation = useMutation({
    mutationFn: ({ payload }: SaveRuleInput) =>
      shopApiSend('/api/option-labor-rules', payload.rule_id ? 'PUT' : 'POST', payload),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: ({ ruleId }: DeleteRuleInput) =>
      shopApiSend('/api/option-labor-rules', 'DELETE', { rule_id: ruleId }),
  });

  const laborLogMutation = useMutation({
    mutationFn: () =>
      shopApiSend('/api/channel-labor-price-adjustments', 'POST', {
        channel_id: effectiveChannelId,
        master_item_id: effectiveLaborMasterId,
        delta_krw: parseAmount(laborDelta),
        reason: laborReason.trim(),
      }),
  });

  const bulkAdjustMutation = useMutation({
    mutationFn: async () => {
      if (!basePayload) throw new Error('먼저 상품 컨텍스트를 선택해주세요.');
      const delta = parseAmount(bulkDeltaKrw);
      if (delta === 0) throw new Error('변경 금액은 0일 수 없습니다.');

      const targetRows = bulkCategory === 'SIZE'
        ? sizeRules.filter((rule) => {
            const materialMatched = !bulkMaterialCode || String(rule.scope_material_code ?? '') === bulkMaterialCode;
            if (!materialMatched) return false;
            const min = Number(rule.additional_weight_min_g ?? rule.additional_weight_g);
            const max = Number(rule.additional_weight_max_g ?? rule.additional_weight_g);
            const from = Number(bulkSizeMinG);
            const to = Number(bulkSizeMaxG);
            if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(from) || !Number.isFinite(to)) return false;
            const ruleMin = Math.min(min, max);
            const ruleMax = Math.max(min, max);
            const targetMin = Math.min(from, to);
            const targetMax = Math.max(from, to);
            return ruleMax >= targetMin && ruleMin <= targetMax;
          })
        : colorRules.filter((rule) => {
            const materialMatched = !bulkMaterialCode || String(rule.scope_material_code ?? '') === bulkMaterialCode;
            const colorMatched = !bulkColorCode || String(rule.color_code ?? '') === bulkColorCode;
            return materialMatched && colorMatched;
          });

      if (targetRows.length === 0) throw new Error('조건에 맞는 규칙이 없습니다.');

      await Promise.all(targetRows.map((rule) =>
        shopApiSend('/api/option-labor-rules', 'PUT', {
          rule_id: rule.rule_id,
          additive_delta_krw: Math.round(toNumber(rule.additive_delta_krw) + delta),
        })
      ));

      return { updated: targetRows.length };
    },
  });

  const handleSaveRule = (label: string, payload: RulePayload, afterSuccess?: () => void) => {
    saveRuleMutation.mutate(
      { label, payload },
      {
        onSuccess: async () => {
          toast.success(`${label} 저장됨`);
          afterSuccess?.();
          await refreshPricingPreview();
          await refreshRules();
        },
        onError: (error) => {
          toast.error(describeError(error));
        },
      },
    );
  };

  const handleDeleteRule = (label: string, ruleId: string) => {
    deleteRuleMutation.mutate(
      { label, ruleId },
      {
        onSuccess: async () => {
          toast.success(`${label} 삭제됨`);
          await refreshPricingPreview();
          await refreshRules();
        },
        onError: (error) => {
          toast.error(describeError(error));
        },
      },
    );
  };

  const handleSaveMaterial = () => {
    if (!basePayload) return;
    handleSaveRule('소재 분류 규칙', {
      ...basePayload,
      rule_id: materialRule?.rule_id,
      category_key: 'MATERIAL',
      scope_material_code: null,
      additional_weight_g: null,
      plating_enabled: null,
      color_code: null,
      decoration_master_id: null,
      decoration_model_name: null,
      base_labor_cost_krw: 0,
      additive_delta_krw: 0,
    });
  };

  const handleSaveSize = () => {
    if (!basePayload) return;
    const weightMin = Number(sizeDraft.weightMinG);
    const weightMax = Number(sizeDraft.weightMaxG);
    handleSaveRule(
      sizeDraft.ruleId ? '중량 규칙 수정' : '중량 규칙 추가',
      {
        ...basePayload,
        rule_id: sizeDraft.ruleId || undefined,
        category_key: 'SIZE',
        scope_material_code: sizeDraft.materialCode || null,
        additional_weight_g: weightMin,
        additional_weight_min_g: weightMin,
        additional_weight_max_g: weightMax,
        plating_enabled: null,
        color_code: null,
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: parseAmount(sizeDraft.additiveKrw),
      },
      resetSizeDraft,
    );
  };

  const handleSaveColor = () => {
    if (!basePayload) return;
    const normalizedColorCode = normalizeColorCode(colorDraft.colorCode);
    if (!normalizedColorCode) return;
    const selectedColorCatalog = colorCatalogByCode.get(normalizedColorCode) ?? null;
    handleSaveRule(
      colorDraft.ruleId ? '도금/색상 규칙 수정' : '도금/색상 규칙 추가',
      {
        ...basePayload,
        rule_id: colorDraft.ruleId || undefined,
        category_key: 'COLOR_PLATING',
        scope_material_code: colorDraft.materialCode || null,
        additional_weight_g: null,
        plating_enabled: selectedColorCatalog?.display_name?.startsWith('[도]') ?? normalizedColorCode.startsWith('[도]'),
        color_code: normalizedColorCode || null,
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: parseAmount(colorDraft.additiveKrw),
      },
      resetColorDraft,
    );
  };

  const handleSaveDecor = () => {
    if (!basePayload || !selectedDecorMaster) return;
    handleSaveRule(
      decorDraft.ruleId ? '장식 규칙 수정' : '장식 규칙 추가',
      {
        ...basePayload,
        rule_id: decorDraft.ruleId || undefined,
        category_key: 'DECOR',
        scope_material_code: null,
        additional_weight_g: null,
        additional_weight_min_g: null,
        additional_weight_max_g: null,
        plating_enabled: null,
        color_code: null,
        decoration_master_id: selectedDecorMaster.master_item_id,
        decoration_model_name: selectedDecorMaster.model_name,
        base_labor_cost_krw: laborOf(selectedDecorMaster),
        additive_delta_krw: parseAmount(decorDraft.additiveKrw),
        size_price_mode: null,
        formula_multiplier: null,
        formula_offset_krw: null,
        rounding_unit_krw: null,
        rounding_mode: null,
        fixed_delta_krw: null,
        note: null,
      },
      resetDecorDraft,
    );
  };

  const handleSaveOther = () => {
    if (!basePayload || !otherDraft.note.trim()) return;
    handleSaveRule(
      otherDraft.ruleId ? '기타 규칙 수정' : '기타 규칙 추가',
      {
        ...basePayload,
        rule_id: otherDraft.ruleId || undefined,
        category_key: 'OTHER',
        scope_material_code: null,
        additional_weight_g: null,
        additional_weight_min_g: null,
        additional_weight_max_g: null,
        plating_enabled: null,
        color_code: null,
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: parseAmount(otherDraft.additiveKrw),
        note: otherDraft.note.trim(),
      },
      resetOtherDraft,
    );
  };

  const handleSaveLaborLog = () => {
    laborLogMutation.mutate(undefined, {
      onSuccess: async () => {
        toast.success('공임 조정 로그가 저장되었습니다.');
        setLaborDelta('0');
        setLaborReason('');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['channel-labor-price-adjustments', effectiveChannelId, effectiveLaborMasterId] }),
          queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', effectiveChannelId] }),
        ]);
      },
      onError: (error) => {
        toast.error(describeError(error));
      },
    });
  };

  const handleBulkAdjust = () => {
    bulkAdjustMutation.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(`일괄 조정이 적용되었습니다. (${result.updated}건)`);
        await refreshPricingPreview();
        await refreshRules();
      },
      onError: (error) => {
        toast.error(describeError(error));
      },
    });
  };

  const colorNameMap = useMemo(() => {
      return new Map(mergedColorChoices.map((row) => [row.color_code, `${row.display_name} (${row.color_code})`]));
    }, [mergedColorChoices]);

  const decorationNameMap = useMemo(() => {
    return new Map(
      decorationMasters.map((row) => [row.master_item_id, row.model_name ?? row.master_item_id]),
    );
  }, [decorationMasters]);

  const disabledReason = !effectiveChannelId ? '채널을 선택해주세요.' : !selectedContext ? '상품 컨텍스트를 선택해주세요.' : '';
  const pageError = channelsQuery.error
    ? describeError(channelsQuery.error)
    : poolsQuery.error
      ? describeError(poolsQuery.error)
      : rulesQuery.error
        ? describeError(rulesQuery.error)
        : laborLogQuery.error
          ? describeError(laborLogQuery.error)
          : '';
  const hasPageError = Boolean(channelsQuery.error || poolsQuery.error || rulesQuery.error || laborLogQuery.error);
  const isRuleMutating = saveRuleMutation.isPending || deleteRuleMutation.isPending || bulkAdjustMutation.isPending;
  const isSizeEditing = Boolean(sizeDraft.ruleId);
  const isColorEditing = Boolean(colorDraft.ruleId);
  const isDecorEditing = Boolean(decorDraft.ruleId);
  const isOtherEditing = Boolean(otherDraft.ruleId);
  const bulkCandidateCount = useMemo(() => {
    if (bulkCategory === "SIZE") {
      const from = Number(bulkSizeMinG);
      const to = Number(bulkSizeMaxG);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
      const targetMin = Math.min(from, to);
      const targetMax = Math.max(from, to);
      return sizeRules.filter((rule) => {
        const materialMatched = !bulkMaterialCode || String(rule.scope_material_code ?? "") === bulkMaterialCode;
        if (!materialMatched) return false;
        const min = Number(rule.additional_weight_min_g ?? rule.additional_weight_g);
        const max = Number(rule.additional_weight_max_g ?? rule.additional_weight_g);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
        const ruleMin = Math.min(min, max);
        const ruleMax = Math.max(min, max);
        return ruleMax >= targetMin && ruleMin <= targetMax;
      }).length;
    }
    return colorRules.filter((rule) => {
      const materialMatched = !bulkMaterialCode || String(rule.scope_material_code ?? "") === bulkMaterialCode;
      const colorMatched = !bulkColorCode || String(rule.color_code ?? "") === bulkColorCode;
      return materialMatched && colorMatched;
    }).length;
  }, [bulkCategory, bulkColorCode, bulkMaterialCode, bulkSizeMaxG, bulkSizeMinG, colorRules, sizeRules]);

  return (
    <div className="space-y-4">
      <ActionBar
        title='옵션 공임 규칙'
        subtitle='채널 상품 컨텍스트별 옵션 공임 규칙을 관리하고, 공임 조정 로그를 확인합니다.'
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['shop-channels'] }),
                queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', effectiveChannelId] }),
                queryClient.invalidateQueries({
                  queryKey: [
                    'option-labor-rules',
          effectiveChannelId,
                    selectedContext?.master_item_id ?? '',
                    selectedContext?.external_product_no ?? '',
                  ],
                }),
                queryClient.invalidateQueries({ queryKey: ['channel-labor-price-adjustments', effectiveChannelId, effectiveLaborMasterId] }),
              ]);
            }}
          >
            새로고침
          </Button>
        }
      />

      <ShoppingPageHeader
        purpose='MATERIAL 분류, SIZE 중량 구간, COLOR_PLATING 도금/색상, DECOR 장식 공임, OTHER 메모성 규칙을 한 화면에서 관리합니다.'
        status={[
          { label: '컨텍스트', value: `${contexts.length}` },
          { label: '선택 상태', value: selectedContext ? '선택됨' : '대기', tone: selectedContext ? 'good' : 'warn' },
          { label: '규칙 수', value: `${rules.length}`, tone: rules.length > 0 ? 'good' : 'neutral' },
        ]}
        nextActions={[
          { label: '상품 매핑', href: '/settings/shopping/mappings' },
          { label: '작업 흐름', href: '/settings/shopping/workflow' },
        ]}
      />

      {hasPageError ? (
        <Card>
          <CardBody>
            <div className="rounded border border-red-300/50 bg-red-500/5 px-3 py-3 text-sm text-red-700">
              {pageError}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title='채널 / 상품 컨텍스트'
          description='채널별 상품 컨텍스트를 선택하고, 현재 상품에 연결된 기준 정보를 확인합니다.'
        />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>채널</div>
              <Select value={effectiveChannelId} onChange={(event) => setChannelId(event.target.value)}>
                <option value=''>채널 선택</option>
                {channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channel.channel_name + ' (' + channel.channel_code + ')'}
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>상품 컨텍스트</div>
              <Select
                value={effectiveContextKey}
                onChange={(event) => setContextKey(event.target.value)}
                disabled={!effectiveChannelId || contexts.length === 0}
              >
                <option value=''>상품 컨텍스트 선택</option>
                {contextSelectRows.map((row) => (
                  <option key={contextKeyOf(row)} value={contextKeyOf(row)}>
                    {(row.model_name ?? row.master_item_id) + ' / ' + row.external_product_no}
                  </option>
                ))}
              </Select>
              {contexts.length > contextSelectRows.length ? (
                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  드롭다운은 검색 결과 기준 {contextSelectRows.length}개만 표시합니다. 아래 검색/목록에서 바로 선택할 수 있습니다.
                </div>
              ) : null}
            </div>
            <div>
 <div className={'mb-1 text-xs text-[var(--muted)]'}>모델명</div>
              <Input value={selectedContext?.model_name ?? selectedContext?.master_item_id ?? '-'} disabled />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>외부상품번호</div>
              <Input value={selectedContext?.external_product_no ?? '-'} disabled />
            </div>
          </div>

          {selectedContext ? (
            <div className="grid grid-cols-1 gap-2 rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] md:grid-cols-3">
 <div>기본 소재: {selectedContext.material_code_default ?? '-'}</div>
 <div>연결된 규칙 {rules.length} / 검색 결과 {filteredContexts.length}</div>
              <div>
 조회 상태: {channelsQuery.isFetching || poolsQuery.isFetching || rulesQuery.isFetching ? '로딩 중' : '준비됨'}
              </div>
            </div>
          ) : null}

          {contexts.length > 0 ? (
            <div className="space-y-3 rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>컨텍스트 검색</div>
                  <Input
                    value={contextSearch}
                    onChange={(event) => setContextSearch(event.target.value)}
 placeholder='모델명 / 외부상품번호 / 마스터ID / channel_product_id'
                  />
                </div>
                <div>
                <div className='mb-1 text-xs text-[var(--muted)]'>검색 결과</div>
                  <Input value={filteredContexts.length + ' / ' + contexts.length} disabled />
                </div>
                <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>선택 상품 채널 ID</div>
                  <Input value={selectedContext?.base_channel_product_id ?? selectedContext?.channel_product_id ?? '-'} disabled />
                </div>
              </div>

              <div className="max-h-[280px] overflow-auto rounded border border-[var(--hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--panel)] text-left">
                    <tr>
 <th className='px-3 py-2'>상품</th>
 <th className='px-3 py-2'>외부상품번호</th>
 <th className='px-3 py-2'>채널 ID</th>
 <th className='px-3 py-2'>SKU/행 수</th>
 <th className='px-3 py-2'>옵션 구성</th>
 <th className='px-3 py-2'>규칙 수</th>
 <th className='px-3 py-2'>선택</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContexts.map((row) => {
                      const isSelected = contextKeyOf(row) === effectiveContextKey;
                      return (
                        <tr key={contextKeyOf(row)} className={'border-t border-[var(--hairline)] ' + (isSelected ? 'bg-sky-50' : '')}> 
                          <td className="px-3 py-2">{row.model_name ?? row.master_item_id}</td>
                          <td className="px-3 py-2">{row.external_product_no}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.base_channel_product_id ?? row.channel_product_id}</td>
                          <td className={'px-3 py-2'}>{String(row.variant_count ?? 0) + ' variants / ' + String(row.row_count ?? 0) + ' rows'}</td>
                          <td className={'px-3 py-2 text-xs'}>{'소재 ' + String(row.material_option_count ?? 0) + ' / 중량 ' + String(row.size_option_count ?? 0) + ' / 색상 ' + String(row.color_option_count ?? 0) + ' / 장식 ' + String(row.decor_option_count ?? 0)}</td>
                          <td className={'px-3 py-2'}>{String(row.rule_count ?? 0)}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant={isSelected ? 'secondary' : 'ghost'}
                              onClick={() => setContextKey(contextKeyOf(row))}
                              disabled={isSelected}
                            >
                              {isSelected ? '선택됨' : '선택'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredContexts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">
                          조건에 맞는 컨텍스트가 없습니다.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {disabledReason ? <div className="text-xs text-[var(--muted)]">{disabledReason}</div> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title='규칙 일괄 조정'
          description='조건에 맞는 SIZE/COLOR 규칙의 additive 금액을 한 번에 조정합니다.'
        />
        <CardBody className='space-y-3'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-7'>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>카테고리</div>
              <Select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value as 'SIZE' | 'COLOR_PLATING')}>
                <option value='SIZE'>SIZE</option>
                <option value='COLOR_PLATING'>COLOR</option>
              </Select>
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>소재</div>
              <Select value={bulkMaterialCode} onChange={(event) => setBulkMaterialCode(event.target.value)}>
                <option value=''>전체 소재</option>
                {materials.map((materialCode) => (
                  <option key={'bulk-material-' + materialCode} value={materialCode}>
                    {materialCode}
                  </option>
                ))}
              </Select>
            </div>
            {bulkCategory === 'SIZE' ? (
              <>
                <div>
                  <div className='mb-1 text-xs text-[var(--muted)]'>중량 최소</div>
                  <Select value={bulkSizeMinG} onChange={(event) => setBulkSizeMinG(event.target.value)}>
                    {BULK_WEIGHT_OPTIONS.map((weight) => (
                      <option key={'bulk-min-' + weight} value={weight}>{weight}g</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <div className='mb-1 text-xs text-[var(--muted)]'>중량 최대</div>
                  <Select value={bulkSizeMaxG} onChange={(event) => setBulkSizeMaxG(event.target.value)}>
                    {BULK_WEIGHT_OPTIONS.map((weight) => (
                      <option key={'bulk-max-' + weight} value={weight}>{weight}g</option>
                    ))}
                  </Select>
                </div>
              </>
            ) : (
              <div>
                 <div className='mb-1 text-xs text-[var(--muted)]'>색상</div>
                <Select value={bulkColorCode} onChange={(event) => setBulkColorCode(event.target.value)}>
                  <option value=''>전체 색상</option>
                  {mergedColorChoices.map((color) => (
                    <option key={'bulk-color-' + color.color_code} value={color.color_code}>
                      {color.display_name + ' (' + color.color_code + ')'}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>변경 금액 (+/-)</div>
              <Input type='number' value={bulkDeltaKrw} onChange={(event) => setBulkDeltaKrw(event.target.value)} placeholder='예: 500' />
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>대상 규칙 수</div>
              <Input value={String(bulkCandidateCount)} disabled />
            </div>
            <div className='flex items-end'>
              <Button
                onClick={handleBulkAdjust}
                disabled={Boolean(disabledReason) || bulkCandidateCount <= 0 || parseAmount(bulkDeltaKrw) === 0 || bulkAdjustMutation.isPending}
              >
                일괄 적용
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {laborMasters.length > 0 ? (
        <Card>
          <CardHeader
            title='공임 조정 로그'
            description='상품별 기본 공임을 조정하고, 최근 조정 내역을 함께 확인합니다.'
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <div className='mb-1 text-xs text-[var(--muted)]'>마스터</div>
                <Select value={effectiveLaborMasterId} onChange={(event) => setLaborMasterId(event.target.value)}>
                  <option value=''>마스터 선택</option>
                  {laborMasters.map((master) => (
                    <option key={master.master_item_id} value={master.master_item_id}>
                      {master.model_name ?? master.master_item_id}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>기본 공임</div>
                <Input value={formatWon(laborOf(currentLaborMaster))} disabled />
              </div>
              <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>조정 금액(+/-)</div>
                <Input
                  type="number"
                  autoFormat={false}
                  step={100}
                  value={laborDelta}
                  onChange={(event) => setLaborDelta(event.target.value)}
 placeholder='예: 5000 또는 -3000'
                />
              </div>
              <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>사유</div>
                <Input
                  value={laborReason}
                  onChange={(event) => setLaborReason(event.target.value)}
 placeholder='조정 사유'
                />
              </div>
            </div>

            <Button
              onClick={handleSaveLaborLog}
              disabled={
                !effectiveChannelId
                || !effectiveLaborMasterId
                || !laborReason.trim()
                || parseAmount(laborDelta) === 0
                || laborLogMutation.isPending
              }
            >
 공임 조정 로그 저장
            </Button>

            <div className="max-h-[220px] overflow-auto rounded border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
 <th className='px-3 py-2'>일시</th>
 <th className='px-3 py-2'>금액</th>
 <th className='px-3 py-2'>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {(laborLogQuery.data?.data ?? []).map((log) => (
                    <tr key={log.adjustment_log_id} className="border-t border-[var(--hairline)]">
                      <td className="px-3 py-2">{formatWhen(log.created_at)}</td>
                      <td className="px-3 py-2">{formatWon(log.delta_krw)}</td>
                      <td className="px-3 py-2">{log.reason}</td>
                    </tr>
                  ))}
                  {!laborLogQuery.isFetching && (laborLogQuery.data?.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-[var(--muted)]">
 아직 공임 조정 로그가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
 <CardHeader title='1. 소재' description='MATERIAL은 분류 전용 규칙입니다. 추가 금액 없이 소재 기준만 저장합니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
 소재 카드는 분류 상태만 기록합니다. 현재 컨텍스트의 기본 소재값을 기준으로 MATERIAL 규칙 존재 여부를 관리합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>기본 소재</div>
              <Input value={selectedContext?.material_code_default ?? '-'} disabled />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>규칙 상태</div>
 <Input value={materialRule ? '등록됨' : '미등록'} disabled />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>최근 변경</div>
              <Input value={formatWhen(materialRule?.updated_at ?? materialRule?.created_at)} disabled />
            </div>
            <div className="space-y-2">
 <div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
              <Button onClick={handleSaveMaterial} disabled={Boolean(disabledReason) || isRuleMutating}>
 {materialRule ? '분류 규칙 업데이트' : '분류 규칙 저장'}
              </Button>
              {materialRule ? (
                <Button
                  variant="ghost"
 onClick={() => handleDeleteRule('소재 분류 규칙', materialRule.rule_id)}
                  disabled={deleteRuleMutation.isPending}
                >
 분류 규칙 삭제
                </Button>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
 <CardHeader title='2. 중량' description='SIZE는 소재와 추가 중량 구간별 additive 금액을 관리합니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            소재별로 중량 구간을 나누고, 각 구간에 적용할 SIZE additive 금액을 설정합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>소재 분류</div>
              <Select
                value={sizeDraft.materialCode}
                onChange={(event) => setSizeDraft((current) => ({ ...current, materialCode: event.target.value }))}
                disabled={materials.length === 0}
              >
                <option value=''>소재 선택</option>
                {materials.map((materialCode) => (
                  <option key={materialCode} value={materialCode}>
                    {materialCode}
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>중량 시작</div>
              <Select
                value={sizeDraft.weightMinG}
                onChange={(event) => setSizeDraft((current) => ({ ...current, weightMinG: event.target.value }))}
              >
                {RULE_WEIGHT_OPTIONS.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}g
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>중량 종료</div>
              <Select
                value={sizeDraft.weightMaxG}
                onChange={(event) => setSizeDraft((current) => ({ ...current, weightMaxG: event.target.value }))}
              >
                {RULE_WEIGHT_OPTIONS.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}g
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>추가 금액</div>
              <Select
                value={sizeDraft.additiveKrw}
                onChange={(event) => setSizeDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
              >
                {LABOR_AMOUNT_OPTIONS.map((amount) => (
                  <option key={amount} value={amount}>
                    {formatWon(Number(amount))}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
<div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
              <Button onClick={handleSaveSize} disabled={Boolean(disabledReason) || !sizeDraft.materialCode || Number(sizeDraft.weightMinG) < 0.01 || Number(sizeDraft.weightMaxG) < 0.01 || Number(sizeDraft.weightMinG) > Number(sizeDraft.weightMaxG) || isRuleMutating}>
 {isSizeEditing ? '중량 규칙 수정 저장' : '중량 규칙 추가'}
              </Button>
              {isSizeEditing ? (
                <Button variant="ghost" onClick={resetSizeDraft}>
편집 취소
                </Button>
              ) : null}
            </div>
          </div>

          {isSizeEditing ? (
            <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              현재 편집 중: 소재 {sizeDraft.materialCode || '-'} / {sizeDraft.weightMinG}g ~ {sizeDraft.weightMaxG}g / {formatWon(parseAmount(sizeDraft.additiveKrw))}
            </div>
          ) : null}

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
 <th className='px-3 py-2'>소재</th>
 <th className='px-3 py-2'>추가 중량 구간</th>
 <th className='px-3 py-2'>추가 금액</th>
 <th className='px-3 py-2'>작업</th>
                </tr>
              </thead>
              <tbody>
                {sizeRules.map((rule) => {
                  const isEditingRow = sizeDraft.ruleId === rule.rule_id;
                  return (
                  <tr key={rule.rule_id} className={"border-t border-[var(--hairline)] " + (isEditingRow ? 'bg-sky-50/80' : '')}>
                    <td className="px-3 py-2">{rule.scope_material_code ?? '-'}</td>
                    <td className={'px-3 py-2'}>{toNumber(rule.additional_weight_min_g ?? rule.additional_weight_g).toFixed(2) + 'g ~ ' + toNumber(rule.additional_weight_max_g ?? rule.additional_weight_g).toFixed(2) + 'g'}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSizeDraft({
                              ruleId: rule.rule_id,
                              materialCode: rule.scope_material_code ?? materials[0] ?? '',
                              weightMinG: toNumber(rule.additional_weight_min_g ?? rule.additional_weight_g).toFixed(2),
                              weightMaxG: toNumber(rule.additional_weight_max_g ?? rule.additional_weight_g).toFixed(2),
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
{isEditingRow ? '편집 중' : '편집'}
                        </Button>
                        <Button
                          variant="ghost"
 onClick={() => handleDeleteRule('중량 규칙', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
 삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );})}
                {sizeRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
 아직 중량 규칙이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title='3. 색상 중앙 기본금액' description='도금/색상 조합의 기본금액을 중앙에서 통제합니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            combo는 중앙 catalog에서만 관리합니다. rules의 도금/색상 추가 금액은 여기 기본금액 위에 더해집니다.
          </div>
          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className='px-3 py-2'>조합</th>
                  <th className='px-3 py-2'>기본금액</th>
                  <th className='px-3 py-2'>활성</th>
                </tr>
              </thead>
              <tbody>
                {colorCatalogRows.map((row) => (
                  <tr key={row.combo_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{row.display_name}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={String(row.base_delta_krw ?? 0)}
                        onChange={(e) => updateColorCatalogRow(row.combo_id, { base_delta_krw: parseAmount(e.target.value) })}
                      >
                        {COLOR_AMOUNT_OPTIONS.map((amount) => (
                          <option key={`${row.combo_id}-${amount}`} value={amount}>{formatWon(Number(amount))}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.is_active !== false}
                          onChange={(e) => updateColorCatalogRow(row.combo_id, { is_active: e.target.checked })}
                        />
                        사용
                      </label>
                    </td>
                  </tr>
                ))}
                {colorCatalogRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-[var(--muted)]">아직 중앙 색상 조합이 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveColorCatalogMutation.mutate()} disabled={saveColorCatalogMutation.isPending || !effectiveChannelId}>
              {saveColorCatalogMutation.isPending ? '저장 중...' : '중앙 색상금액 저장'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title='4. 도금 / 색상' description='COLOR_PLATING은 소재와 도금 여부, 색상 코드 조합으로 관리합니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
 도금 여부와 색상 코드를 함께 저장합니다. 목록에 없는 색상 코드도 직접 입력해 저장할 수 있습니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>소재</div>
              <Select
                value={colorDraft.materialCode}
                onChange={(event) => setColorDraft((current) => ({ ...current, materialCode: event.target.value }))}
                disabled={materials.length === 0}
              >
                <option value=''>소재 선택</option>
                {materials.map((materialCode) => (
                  <option key={materialCode} value={materialCode}>
                    {materialCode}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>색상 조합</div>
              <Select
                value={colorDraft.colorCode}
                onChange={(event) => setColorDraft((current) => ({ ...current, colorCode: event.target.value }))}
              >
                <option value=''>색상 조합 선택</option>
                {mergedColorChoices.map((color) => (
                  <option key={'draft-color-' + color.color_code} value={color.color_code}>
                    {color.display_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>중앙 기본금액</div>
              <Input
                value={formatWon(colorCatalogByCode.get(normalizeColorCode(colorDraft.colorCode))?.base_delta_krw ?? 0)}
                disabled
              />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>추가 금액</div>
              <Select
                value={colorDraft.additiveKrw}
                onChange={(event) => setColorDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
              >
                {COLOR_AMOUNT_OPTIONS.map((amount) => (
                  <option key={amount} value={amount}>
                    {formatWon(Number(amount))}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>최종 색상금액</div>
              <Input
                value={formatWon((colorCatalogByCode.get(normalizeColorCode(colorDraft.colorCode))?.base_delta_krw ?? 0) + parseAmount(colorDraft.additiveKrw))}
                disabled
              />
            </div>
            <div className="space-y-2">
 <div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
              <Button onClick={handleSaveColor} disabled={Boolean(disabledReason) || !colorDraft.materialCode || !normalizeColorCode(colorDraft.colorCode) || isRuleMutating}>
 {isColorEditing ? '도금/색상 규칙 저장' : '도금/색상 규칙 추가'}
              </Button>
              {isColorEditing ? (
                <Button variant="ghost" onClick={resetColorDraft}>
 편집 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
 <th className='px-3 py-2'>소재</th>
 <th className='px-3 py-2'>색상 조합</th>
 <th className='px-3 py-2'>중앙 기본금액</th>
 <th className='px-3 py-2'>추가 금액</th>
 <th className='px-3 py-2'>최종 색상금액</th>
 <th className='px-3 py-2'>작업</th>
                </tr>
              </thead>
              <tbody>
                {colorRules.map((rule) => (
                  <tr key={rule.rule_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{rule.scope_material_code ?? '-'}</td>
                    <td className='px-3 py-2'>{rule.color_code ? (colorCatalogByCode.get(normalizeColorCode(rule.color_code))?.display_name ?? colorNameMap.get(rule.color_code) ?? rule.color_code) : '전체 색상'}</td>
                    <td className='px-3 py-2'>{formatWon(colorCatalogByCode.get(normalizeColorCode(rule.color_code ?? ''))?.base_delta_krw ?? 0)}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">{formatWon((colorCatalogByCode.get(normalizeColorCode(rule.color_code ?? ''))?.base_delta_krw ?? 0) + toNumber(rule.additive_delta_krw))}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setColorDraft({
                              ruleId: rule.rule_id,
                              materialCode: rule.scope_material_code ?? materials[0] ?? '',
                              colorCode: rule.color_code ?? '',
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
 편집
                        </Button>
                        <Button
                          variant="ghost"
 onClick={() => handleDeleteRule('도금/색상 규칙', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
 삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {colorRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
 아직 도금/색상 규칙이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
 <CardHeader title='5. 장식' description='DECOR는 장식 마스터별 총공임원가(흡수공임 포함)와 추가 금액 합계를 관리합니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            기본적으로 장식 마스터 목록을 사용하고, 필요하면 전체 마스터 목록으로 넓혀 선택할 수 있습니다. 선택한 장식의 기본 공임과 additive 금액을 함께 저장합니다.
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={includeAllDecorMasters}
              onChange={(event) => setIncludeAllDecorMasters(event.target.checked)}
            />
            장식 전용 마스터 대신 전체 마스터 보기
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>장식 마스터</div>
              <Select
                value={decorDraft.decorationMasterId}
                onChange={(event) => setDecorDraft((current) => ({ ...current, decorationMasterId: event.target.value }))}
                disabled={decorMasterChoices.length === 0}
              >
                <option value=''>장식 마스터 선택</option>
                {decorMasterChoices.map((master) => (
                  <option key={master.master_item_id} value={master.master_item_id}>
                    {master.model_name ?? master.master_item_id}
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>총공임원가</div>
              <Input value={formatWon(laborOf(selectedDecorMaster))} disabled />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>추가 금액</div>
              <Select
                value={decorDraft.additiveKrw}
                onChange={(event) => setDecorDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
              >
                {LABOR_AMOUNT_OPTIONS.map((amount) => (
                  <option key={amount} value={amount}>
                    {formatWon(Number(amount))}
                  </option>
                ))}
              </Select>
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>최종 장식금액</div>
              <Input value={formatWon(laborOf(selectedDecorMaster) + parseAmount(decorDraft.additiveKrw))} disabled />
            </div>
            <div className="space-y-2">
 <div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
              <Button onClick={handleSaveDecor} disabled={Boolean(disabledReason) || !selectedDecorMaster || isRuleMutating}>
 {isDecorEditing ? '장식 규칙 저장' : '장식 규칙 추가'}
              </Button>
              {isDecorEditing ? (
                <Button variant="ghost" onClick={resetDecorDraft}>
 편집 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
 <th className='px-3 py-2'>장식 마스터</th>
 <th className='px-3 py-2'>총공임원가</th>
 <th className='px-3 py-2'>추가 금액</th>
 <th className='px-3 py-2'>최종 장식금액</th>
 <th className='px-3 py-2'>작업</th>
                </tr>
              </thead>
              <tbody>
                {decorRules.map((rule) => (
                  <tr key={rule.rule_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">
                      {decorationNameMap.get(rule.decoration_master_id ?? '')
                        ?? rule.decoration_model_name
                        ?? rule.decoration_master_id
                        ?? '-'}
                    </td>
                    <td className="px-3 py-2">{formatWon(rule.base_labor_cost_krw)}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">{formatWon(toNumber(rule.base_labor_cost_krw) + toNumber(rule.additive_delta_krw))}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDecorDraft({
                              ruleId: rule.rule_id,
                              decorationMasterId: rule.decoration_master_id ?? '',
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
 편집
                        </Button>
                        <Button
                          variant="ghost"
 onClick={() => handleDeleteRule('장식 규칙', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
 삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {decorRules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
 아직 장식 규칙이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
 <CardHeader title='6. 기타' description='OTHER는 메모(note)와 override 금액만 저장하는 보조 규칙입니다.' />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
 별도 분류가 어려운 요청이나 예외 비용을 기록할 때 사용합니다. 메모 내용과 추가 금액만 관리합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>메모</div>
              <Input
                value={otherDraft.note}
                onChange={(event) => setOtherDraft((current) => ({ ...current, note: event.target.value }))}
 placeholder='예: 급행 요청 / 별도 가공'
              />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>override 금액</div>
              <Input
                value={otherDraft.additiveKrw}
                onChange={(event) => setOtherDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
                type="number"
                placeholder="예: 15000"
              />
            </div>
            <div>
 <div className='mb-1 text-xs text-[var(--muted)]'>규칙 개수</div>
              <Input value={String(otherRules.length)} disabled />
            </div>
            <div className="space-y-2">
 <div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
              <Button onClick={handleSaveOther} disabled={Boolean(disabledReason) || !otherDraft.note.trim() || isRuleMutating}>
 {isOtherEditing ? '기타 규칙 저장' : '기타 규칙 추가'}
              </Button>
              {isOtherEditing ? (
                <Button variant="ghost" onClick={resetOtherDraft}>
 편집 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
 <th className='px-3 py-2'>메모</th>
 <th className='px-3 py-2'>추가 금액</th>
 <th className='px-3 py-2'>최근 변경</th>
 <th className='px-3 py-2'>작업</th>
                </tr>
              </thead>
              <tbody>
                {otherRules.map((rule) => (
                  <tr key={rule.rule_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{rule.note ?? "-"}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">{formatWhen(rule.updated_at ?? rule.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setOtherDraft({
                              ruleId: rule.rule_id,
                              note: rule.note ?? "",
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
 편집
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRule('기타 규칙', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
 삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {otherRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
 아직 기타 규칙이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}






