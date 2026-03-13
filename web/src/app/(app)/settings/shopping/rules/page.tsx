'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { shopApiGet, shopApiSend } from '@/lib/shop/http';
import { cn } from '@/lib/utils';

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

type ColorCatalogFilter = 'ALL' | 'PLATING' | 'STANDARD';

type RulesSection =
  | 'rule-material'
  | 'rule-size'
  | 'rule-color-catalog'
  | 'rule-color-policy'
  | 'rule-decor'
  | 'rule-other'
  | 'context'
  | 'bulk-adjust'
  | 'labor-log'
  | 'status-intro';

type RulesSectionItem = {
  key: RulesSection;
  label: string;
  desc: string;
};

type RulesSectionGroup = {
  key: string;
  label: string;
  icon: ReactNode;
  items: RulesSectionItem[];
};

const RULES_SECTION_GROUPS: RulesSectionGroup[] = [
  {
    key: 'global-rules',
    label: '글로벌 옵션룰',
    icon: <Sparkles className="h-4 w-4" />,
    items: [
      { key: 'rule-material', label: '1. 소재', desc: 'MATERIAL 분류 규칙' },
      { key: 'rule-size', label: '2. 사이즈', desc: '사이즈 구간 규칙 + 자동 계산 안내' },
      { key: 'rule-color-catalog', label: '3. 색상 중앙 기본금액', desc: '중앙 color/plating SoT' },
      { key: 'rule-color-policy', label: '4. 색상 예외 규칙 사용 안 함', desc: '예외 비활성 정책' },
      { key: 'rule-decor', label: '5. 장식', desc: '장식 마스터 기본 공임 + 수동 조정 저장' },
      { key: 'rule-other', label: '6. 기타', desc: '수동 override 금액 직접 저장' },
    ],
  },
  {
    key: 'operations',
    label: '운영',
    icon: <Settings2 className="h-4 w-4" />,
    items: [
      { key: 'context', label: '채널 / 상품 컨텍스트', desc: '작업 대상 상품 선택' },
      { key: 'bulk-adjust', label: '규칙 일괄 조정', desc: 'SIZE additive 일괄 조정' },
      { key: 'labor-log', label: '공임 조정 로그', desc: '마스터 공임 조정 내역' },
    ],
  },
  {
    key: 'status',
    label: '안내 / 상태',
    icon: <Activity className="h-4 w-4" />,
    items: [
      { key: 'status-intro', label: '이 화면에서 하는 일', desc: '현재 운영 원칙과 흐름' },
    ],
  },
];

const RULES_SECTION_META: Record<RulesSection, { title: string; desc: string }> = {
  'rule-material': {
    title: '1. 소재',
    desc: 'MATERIAL은 분류 상태만 기록하고 추가 금액 없이 SoT 기준 소재를 맞춥니다.',
  },
  'rule-size': {
    title: '2. 사이즈',
    desc: 'SIZE는 소재와 사이즈 구간만 정의하고, 최종 금액은 settings 시세/소재 계수를 기준으로 자동 계산합니다.',
  },
  'rule-color-catalog': {
    title: '3. 색상 중앙 기본금액',
    desc: '색상/도금 금액은 중앙 catalog에서만 관리하고 모든 소재에 동일하게 적용합니다.',
  },
  'rule-color-policy': {
    title: '4. 색상 예외 규칙 사용 안 함',
    desc: 'COLOR_PLATING 예외는 운영하지 않고 preview/runtime/sync가 중앙 금액만 참조하도록 고정합니다.',
  },
  'rule-decor': {
    title: '5. 장식',
    desc: 'DECOR는 선택한 장식 마스터의 기본 공임원가를 읽고, 운영자가 수동 조정금액을 더한 저장 결과를 관리합니다.',
  },
  'rule-other': {
    title: '6. 기타',
    desc: 'OTHER는 자동 계산 없이 운영자가 메모와 수동 override 금액을 직접 저장하는 소스 규칙입니다.',
  },
  context: {
    title: '채널 / 상품 컨텍스트',
    desc: '채널별 상품 컨텍스트를 선택하고 현재 상품에 연결된 기준 정보를 확인합니다.',
  },
  'bulk-adjust': {
    title: '규칙 일괄 조정',
    desc: '조건에 맞는 SIZE 규칙 additive 금액을 한 번에 조정합니다.',
  },
  'labor-log': {
    title: '공임 조정 로그',
    desc: '마스터별 기본 공임 조정과 최근 로그를 확인합니다.',
  },
  'status-intro': {
    title: '이 화면에서 하는 일',
    desc: '중앙 color/plating SoT와 상품별 option labor rule 운영 흐름을 한 화면에서 정리합니다.',
  },
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
const isPlatingCatalogCode = (value: string): boolean => normalizeColorCode(value).startsWith('[도]');

const summarizeColorRuleScope = (count: number): string => {
  if (count <= 0) return '예외 없음';
  if (count === 1) return '예외 1건';
  return `예외 ${count}건`;
};

const buildSeedColorCatalogRowId = (comboKey: string): string => `seed:${normalizeColorCode(comboKey)}`;

const isSeedColorCatalogRow = (row: Pick<ColorCatalogRow, 'combo_id'>): boolean => String(row.combo_id ?? '').startsWith('seed:');

const buildSeededColorCatalogRows = (catalogRows: ColorCatalogRow[], fallbackColors: ColorOption[]): ColorCatalogRow[] => {
  const merged = new Map<string, ColorCatalogRow>();

  fallbackColors.forEach((color, index) => {
    const comboKey = normalizeColorCode(color.color_code);
    if (!comboKey || merged.has(comboKey)) return;
    merged.set(comboKey, {
      combo_id: buildSeedColorCatalogRowId(comboKey),
      combo_key: comboKey,
      display_name: String(color.display_name ?? '').trim() || comboKey,
      base_delta_krw: parseAmount(String(color.base_delta_krw ?? 0)),
      sort_order: (index + 1) * 10,
      is_active: true,
    });
  });

  catalogRows.forEach((row, index) => {
    const comboKey = normalizeColorCode(row.combo_key);
    if (!comboKey) return;
    const existing = merged.get(comboKey);
    const parsedSortOrder = Number(row.sort_order);
    merged.set(comboKey, {
      combo_id: String(row.combo_id ?? '').trim() || existing?.combo_id || buildSeedColorCatalogRowId(comboKey),
      combo_key: comboKey,
      display_name: String(row.display_name ?? '').trim() || existing?.display_name || comboKey,
      base_delta_krw: parseAmount(String(row.base_delta_krw ?? existing?.base_delta_krw ?? 0)),
      sort_order: Number.isFinite(parsedSortOrder) && parsedSortOrder > 0 ? Math.round(parsedSortOrder) : existing?.sort_order ?? (catalogRows.length + index + 1) * 10,
      is_active: row.is_active !== false,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    const nameCompare = left.display_name.localeCompare(right.display_name);
    if (nameCompare !== 0) return nameCompare;
    return left.combo_key.localeCompare(right.combo_key);
  });
};

const areColorCatalogRowsEqual = (left: ColorCatalogRow[], right: ColorCatalogRow[]): boolean => {
  if (left.length !== right.length) return false;
  const normalize = (rows: ColorCatalogRow[]) =>
    [...rows]
      .map((row) => ({
        combo_id: String(row.combo_id ?? '').trim(),
        combo_key: normalizeColorCode(row.combo_key),
        display_name: String(row.display_name ?? '').trim(),
        base_delta_krw: parseAmount(String(row.base_delta_krw ?? 0)),
        sort_order: Number(row.sort_order ?? 0),
        is_active: row.is_active !== false,
      }))
      .sort((a, b) => a.combo_key.localeCompare(b.combo_key) || a.combo_id.localeCompare(b.combo_id));

  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.every((row, index) => {
    const other = normalizedRight[index];
    return row.combo_id === other.combo_id
      && row.combo_key === other.combo_key
      && row.display_name === other.display_name
      && row.base_delta_krw === other.base_delta_krw
      && row.sort_order === other.sort_order
      && row.is_active === other.is_active;
  });
};

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
  const [activeSection, setActiveSection] = useState<RulesSection>('rule-material');
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
  const [colorCatalogFilter, setColorCatalogFilter] = useState<ColorCatalogFilter>('ALL');
  const [colorCatalogSearch, setColorCatalogSearch] = useState('');
  const seededColorCatalogRows = useMemo(
    () => buildSeededColorCatalogRows(colorCatalogQuery.data?.data ?? [], colors),
    [colorCatalogQuery.data?.data, colors],
  );
  useEffect(() => {
    setColorCatalogRows(seededColorCatalogRows);
  }, [seededColorCatalogRows]);
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
  const initialColorCatalogRows = colorCatalogQuery.data?.data ?? [];
  const hasUnsavedColorCatalogChanges = useMemo(
    () => !areColorCatalogRowsEqual(colorCatalogRows, initialColorCatalogRows),
    [colorCatalogRows, initialColorCatalogRows],
  );
  const missingColorCatalogRowCount = useMemo(
    () => colorCatalogRows.filter((row) => isSeedColorCatalogRow(row)).length,
    [colorCatalogRows],
  );
  const colorRuleCountByCode = useMemo(() => {
    const next = new Map<string, number>();
    for (const rule of colorRules) {
      const key = normalizeColorCode(rule.color_code ?? '');
      if (!key) continue;
      next.set(key, (next.get(key) ?? 0) + 1);
    }
    return next;
  }, [colorRules]);
  const colorCatalogStats = useMemo(() => {
    const activeRows = colorCatalogRows.filter((row) => row.is_active !== false);
    const platingRows = activeRows.filter((row) => isPlatingCatalogCode(String(row.combo_key ?? '')));
    const rowsWithExceptions = activeRows.filter((row) => (colorRuleCountByCode.get(normalizeColorCode(row.combo_key)) ?? 0) > 0);
    return {
      total: colorCatalogRows.length,
      active: activeRows.length,
      plating: platingRows.length,
      withExceptions: rowsWithExceptions.length,
    };
  }, [colorCatalogRows, colorRuleCountByCode]);
  const filteredColorCatalogRows = useMemo(() => {
    const query = colorCatalogSearch.trim().toLowerCase();
    return colorCatalogRows.filter((row) => {
      const comboKey = normalizeColorCode(row.combo_key);
      const displayName = String(row.display_name ?? '').trim();
      const exceptionCount = colorRuleCountByCode.get(comboKey) ?? 0;
      if (colorCatalogFilter === 'PLATING' && !isPlatingCatalogCode(comboKey)) return false;
      if (colorCatalogFilter === 'STANDARD' && isPlatingCatalogCode(comboKey)) return false;
      if (!query) return true;
      return comboKey.toLowerCase().includes(query) || displayName.toLowerCase().includes(query);
    });
  }, [colorCatalogRows, colorCatalogFilter, colorCatalogSearch, colorRuleCountByCode]);

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

  const refreshPageData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shop-channels'] }),
      queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', effectiveChannelId] }),
      queryClient.invalidateQueries({ queryKey: ['channel-color-combos', effectiveChannelId] }),
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
      sizeDraft.ruleId ? '사이즈 규칙 수정' : '사이즈 규칙 추가',
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
        additive_delta_krw: 0,
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
  const bulkCandidateCount = useMemo(() => { if (bulkCategory === "SIZE") {
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
  }).length; }, [bulkCategory, bulkColorCode, bulkMaterialCode, bulkSizeMaxG, bulkSizeMinG, colorRules, sizeRules]);
  const selectedColorCatalogRow = colorCatalogByCode.get(normalizeColorCode(colorDraft.colorCode)) ?? null;
  const selectedColorBaseKrw = parseAmount(String(selectedColorCatalogRow?.base_delta_krw ?? 0));
  const sizeRuleMaterialCount = useMemo(
    () => new Set(sizeRules.map((rule) => String(rule.scope_material_code ?? '').trim()).filter(Boolean)).size,
    [sizeRules],
  );
  const sizeRuleGuideLabel = '최종 추가금액은 settings 시세/소재 계수로 자동 계산';
  const activeSectionMeta = RULES_SECTION_META[activeSection];
  const showRuleSectionContextNotice = activeSection.startsWith('rule-') && !selectedContext;

  const statusIntroSection = (
    <Card>
      <CardHeader
        title='이 화면에서 하는 일'
        description='중앙 color/plating SoT와 상품별 option labor rule 운영 흐름을 한 번에 확인합니다.'
      />
      <CardBody className='space-y-4'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3'>
            <div className='text-[11px] text-[var(--muted)]'>선택 채널</div>
            <div className='mt-1 text-sm font-semibold'>{channels.find((row) => row.channel_id === effectiveChannelId)?.channel_name ?? '미선택'}</div>
          </div>
          <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3'>
            <div className='text-[11px] text-[var(--muted)]'>작업 가능한 컨텍스트</div>
            <div className='mt-1 text-sm font-semibold'>{contexts.length.toLocaleString()}</div>
          </div>
          <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3'>
            <div className='text-[11px] text-[var(--muted)]'>활성 색상 조합</div>
            <div className='mt-1 text-sm font-semibold'>{colorCatalogStats.active.toLocaleString()}</div>
          </div>
          <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3'>
            <div className='text-[11px] text-[var(--muted)]'>선택 상태</div>
            <div className='mt-1 text-sm font-semibold'>{selectedContext ? '컨텍스트 선택됨' : '컨텍스트 선택 필요'}</div>
          </div>
        </div>

        <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3 text-sm text-[var(--muted)]'>
          <p>1) 먼저 `채널 / 상품 컨텍스트`에서 상품을 선택하고, 2) 좌측 `글로벌 옵션룰`에서 소재/사이즈/색상/장식/기타 규칙을 각각 관리하며, 3) 색상/도금은 항상 `색상 중앙 기본금액`만 SoT로 사용합니다.</p>
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          <div className='rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-3'>
            <div className='text-sm font-semibold'>현재 운영 원칙</div>
            <div className='mt-2 space-y-1 text-xs text-[var(--muted)]'>
              <div>- 색상/도금 금액은 중앙 catalog에서만 관리</div>
              <div>- 소재별 색상 예외는 사용 안 함</div>
              <div>- SIZE/DECOR/OTHER는 선택한 상품 컨텍스트 기준으로 저장</div>
            </div>
          </div>
          <div className='rounded border border-[var(--hairline)] bg-[var(--panel)] px-3 py-3'>
            <div className='text-sm font-semibold'>바로 가기</div>
            <div className='mt-2 flex flex-wrap gap-2'>
              <Button size='sm' variant='secondary' onClick={() => setActiveSection('context')}>채널 / 상품 컨텍스트</Button>
              <Button size='sm' variant='secondary' onClick={() => setActiveSection('rule-color-catalog')}>색상 중앙 기본금액</Button>
              <Button size='sm' variant='secondary' onClick={() => setActiveSection('rule-size')}>사이즈 규칙</Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const contextSection = (
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
                        <td className={'px-3 py-2 text-xs'}>{'소재 ' + String(row.material_option_count ?? 0) + ' / 사이즈 ' + String(row.size_option_count ?? 0) + ' / 색상 ' + String(row.color_option_count ?? 0) + ' / 장식 ' + String(row.decor_option_count ?? 0)}</td>
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
  );

  const bulkAdjustSection = (
    <Card>
      <CardHeader
        title='규칙 일괄 조정'
        description='조건에 맞는 SIZE 규칙의 additive 금액을 한 번에 조정합니다.'
      />
      <CardBody className='space-y-3'>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-6'>
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
          <>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>사이즈 최소</div>
              <Select value={bulkSizeMinG} onChange={(event) => setBulkSizeMinG(event.target.value)}>
                {BULK_WEIGHT_OPTIONS.map((weight) => (
                  <option key={'bulk-min-' + weight} value={weight}>{weight}g</option>
                ))}
              </Select>
            </div>
            <div>
              <div className='mb-1 text-xs text-[var(--muted)]'>사이즈 최대</div>
              <Select value={bulkSizeMaxG} onChange={(event) => setBulkSizeMaxG(event.target.value)}>
                {BULK_WEIGHT_OPTIONS.map((weight) => (
                  <option key={'bulk-max-' + weight} value={weight}>{weight}g</option>
                ))}
              </Select>
            </div>
          </>
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
  );

  const laborLogSection = laborMasters.length > 0 ? (
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
  ) : (
    <Card>
      <CardHeader title='공임 조정 로그' description='조정 가능한 마스터가 아직 없습니다.' />
      <CardBody>
        <div className='rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3 text-sm text-[var(--muted)]'>
          현재 채널에서 공임 조정 대상 마스터를 찾지 못했습니다. 채널과 컨텍스트를 먼저 확인해주세요.
        </div>
      </CardBody>
    </Card>
  );

  const materialRuleSection = (
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
  );

  const sizeRuleSection = (
    <Card>
      <CardHeader title='2. 사이즈 구간 규칙' description='운영자는 소재와 사이즈 구간만 정의하고, 최종 추가금액은 settings 시세/소재 계수 기준으로 자동 계산됩니다.' />
      <CardBody className="space-y-3">
        <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          소재별 사이즈 시작/종료 구간을 정의하면 저장된 규칙을 기준으로 persisted size grid와 runtime 계산값이 다시 만들어집니다.
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          자동 계산 결과 안내: 여기서는 수동 최종금액을 입력하지 않습니다. `settings`에서 시세/소재팩터를 저장하면 이 구간 규칙을 기준으로 persisted size grid와 runtime 계산값만 다시 재빌드됩니다.
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">활성 사이즈 규칙</div>
            <div className="text-base font-semibold">{sizeRules.length}</div>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">규칙 적용 소재 수</div>
            <div className="text-base font-semibold">{sizeRuleMaterialCount}</div>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">계산 방식</div>
            <div className="text-sm font-medium">자동 계산</div>
          </div>
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
            <div className='mb-1 text-xs text-[var(--muted)]'>사이즈 시작</div>
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
            <div className='mb-1 text-xs text-[var(--muted)]'>사이즈 종료</div>
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
            <div className='mb-1 text-xs text-[var(--muted)]'>자동 계산 결과 안내</div>
            <Input value={sizeRuleGuideLabel} disabled />
          </div>
          <div className="space-y-2">
            <div className='mb-1 text-xs text-[var(--muted)]'>작업</div>
            <Button onClick={handleSaveSize} disabled={Boolean(disabledReason) || !sizeDraft.materialCode || Number(sizeDraft.weightMinG) < 0.01 || Number(sizeDraft.weightMaxG) < 0.01 || Number(sizeDraft.weightMinG) > Number(sizeDraft.weightMaxG) || isRuleMutating}>
              {isSizeEditing ? '사이즈 규칙 수정 저장' : '사이즈 규칙 추가'}
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
            현재 편집 중: 소재 {sizeDraft.materialCode || '-'} / {sizeDraft.weightMinG}g ~ {sizeDraft.weightMaxG}g / 최종 추가금액은 자동 계산됩니다.
          </div>
        ) : null}

        <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--panel)] text-left">
              <tr>
                <th className='px-3 py-2'>소재</th>
                <th className='px-3 py-2'>추가 사이즈 구간</th>
                <th className='px-3 py-2'>자동 계산 결과 안내</th>
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
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">{sizeRuleGuideLabel}</td>
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
                            });
                          }}
                        >
                          {isEditingRow ? '편집 중' : '편집'}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRule('사이즈 규칙', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sizeRules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                    아직 사이즈 규칙이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );

  const colorCatalogSection = (
    <Card>
      <CardHeader title='3. 색상 중앙 기본금액' description='색상/도금 금액은 중앙 catalog에서만 관리하고 모든 소재에 동일하게 적용합니다.' />
      <CardBody className="space-y-3">
        <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          운영 원칙: 색상/도금 금액은 중앙 catalog에서만 관리합니다. 소재별 색상 예외는 사용하지 않으며 모든 동기화는 중앙 금액만 참조합니다.
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">전체 조합</div>
            <div className="text-base font-semibold">{colorCatalogStats.total}</div>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">활성 조합</div>
            <div className="text-base font-semibold">{colorCatalogStats.active}</div>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">도금 조합</div>
            <div className="text-base font-semibold">{colorCatalogStats.plating}</div>
          </div>
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2">
            <div className="text-[11px] text-[var(--muted)]">미등록 조합</div>
            <div className="text-base font-semibold">{missingColorCatalogRowCount}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className='mb-1 text-xs text-[var(--muted)]'>필터</div>
            <Select value={colorCatalogFilter} onChange={(event) => setColorCatalogFilter(event.target.value as ColorCatalogFilter)}>
              <option value='ALL'>전체 조합</option>
              <option value='STANDARD'>일반 색상만</option>
              <option value='PLATING'>도금 조합만</option>
            </Select>
          </div>
          <div>
            <div className='mb-1 text-xs text-[var(--muted)]'>조합 검색</div>
            <Input
              value={colorCatalogSearch}
              onChange={(event) => setColorCatalogSearch(event.target.value)}
              placeholder='조합명 또는 코드 검색'
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] md:justify-end">
            <Badge tone='neutral'>{filteredColorCatalogRows.length}개 표시</Badge>
            {missingColorCatalogRowCount > 0 ? <Badge tone='warning'>미등록 {missingColorCatalogRowCount}개</Badge> : null}
            {hasUnsavedColorCatalogChanges ? <Badge tone='warning'>저장 필요</Badge> : <Badge tone='active'>저장됨</Badge>}
          </div>
        </div>

        {missingColorCatalogRowCount > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            중앙 catalog에 아직 저장되지 않은 조합이 {missingColorCatalogRowCount}개 있습니다. 아래에서 금액을 확인한 뒤 저장하면 preview/runtime에서도 같은 SOT 조합으로 바로 사용됩니다.
          </div>
        ) : null}

        <div className="max-h-[420px] overflow-auto rounded border border-[var(--hairline)] bg-[var(--background)] p-3">
          {filteredColorCatalogRows.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredColorCatalogRows.map((row) => {
                const comboKey = normalizeColorCode(row.combo_key);
                const isSeedRow = isSeedColorCatalogRow(row);
                return (
                  <div key={row.combo_id} className="rounded border border-[var(--hairline)] bg-[var(--panel)] p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-medium">{row.display_name}</div>
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                            <input
                              type="checkbox"
                              checked={row.is_active !== false}
                              onChange={(event) => updateColorCatalogRow(row.combo_id, { is_active: event.target.checked })}
                            />
                            사용
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs">
                          <Badge tone='neutral'>{comboKey}</Badge>
                          <Badge tone={isPlatingCatalogCode(comboKey) ? 'warning' : 'neutral'}>{isPlatingCatalogCode(comboKey) ? '도금' : '일반'}</Badge>
                          {isSeedRow ? <Badge tone='warning'>중앙 미등록</Badge> : <Badge tone='active'>중앙 등록됨</Badge>}
                        </div>
                      </div>
                      <div>
                        <div className='mb-1 text-xs text-[var(--muted)]'>추가금액</div>
                        <Select
                          value={String(row.base_delta_krw ?? 0)}
                          onChange={(event) => updateColorCatalogRow(row.combo_id, { base_delta_krw: parseAmount(event.target.value) })}
                        >
                          {COLOR_AMOUNT_OPTIONS.map((amount) => (
                            <option key={`${row.combo_id}-${amount}`} value={amount}>{formatWon(Number(amount))}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">조건에 맞는 중앙 색상 조합이 없습니다.</div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveColorCatalogMutation.mutate()} disabled={saveColorCatalogMutation.isPending || !effectiveChannelId || !hasUnsavedColorCatalogChanges}>
            {saveColorCatalogMutation.isPending ? '저장 중...' : '중앙 기본금액 저장'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );

  const colorPolicySection = (
    <Card>
      <CardHeader title='4. 색상 예외 규칙 사용 안 함' description='색상/도금은 중앙 catalog 금액만 사용하며 소재별 COLOR_PLATING 예외는 적용하지 않습니다.' />
      <CardBody className="space-y-3">
        <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-3 text-sm text-[var(--muted)]">
          색상/도금 금액은 모든 소재에 공통으로 적용됩니다. 예외 규칙은 더 이상 생성하거나 편집하지 않으며 preview/runtime/sync도 중앙 금액만 사용합니다.
        </div>
        {colorRules.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            기존 COLOR_PLATING 규칙 {colorRules.length}건이 남아 있지만 현재 가격 계산과 동기화에는 반영되지 않습니다.
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  const decorRuleSection = (
    <Card>
      <CardHeader title='5. 장식' description='DECOR는 선택한 장식 마스터의 기본 공임원가를 읽고, 운영자가 수동 조정금액을 더해 저장 결과를 관리하는 소스 규칙입니다.' />
      <CardBody className="space-y-3">
        <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          기본적으로 장식 마스터 목록을 사용하고, 필요하면 전체 마스터 목록으로 넓혀 선택할 수 있습니다. 선택한 장식 마스터의 기본 공임원가는 마스터에서 읽고, 여기서는 운영자가 수동 조정금액만 추가로 저장합니다.
        </div>
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          저장 결과 안내: 저장 결과 금액은 `기본 공임원가 + 수동 조정금액`으로 계산됩니다. preview/runtime은 이 저장 결과를 그대로 반영합니다.
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
            <div className='mb-1 text-xs text-[var(--muted)]'>수동 조정금액</div>
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
            <div className='mb-1 text-xs text-[var(--muted)]'>저장 결과 금액</div>
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
                <th className='px-3 py-2'>수동 조정금액</th>
                <th className='px-3 py-2'>저장 결과 금액</th>
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
  );

  const otherRuleSection = (
    <Card>
      <CardHeader title='6. 기타' description='OTHER는 자동 계산 없이 운영자가 메모와 수동 override 금액을 직접 저장하는 소스 규칙입니다.' />
      <CardBody className="space-y-3">
        <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          별도 분류가 어려운 요청이나 예외 비용을 기록할 때 사용합니다. SIZE나 DECOR처럼 계산 결과를 안내하는 섹션이 아니라, 여기 입력한 메모와 수동 override 금액 자체가 곧 저장 소스 규칙입니다.
        </div>
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          저장 결과 안내: 운영자가 직접 입력한 수동 override 금액이 별도 계산 없이 preview/runtime에 그대로 합산됩니다.
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
            <div className='mb-1 text-xs text-[var(--muted)]'>수동 override 금액</div>
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
                <th className='px-3 py-2'>수동 override 저장금액</th>
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
  );

  const sectionContent: Record<RulesSection, ReactNode> = {
    'rule-material': materialRuleSection,
    'rule-size': sizeRuleSection,
    'rule-color-catalog': colorCatalogSection,
    'rule-color-policy': colorPolicySection,
    'rule-decor': decorRuleSection,
    'rule-other': otherRuleSection,
    context: contextSection,
    'bulk-adjust': bulkAdjustSection,
    'labor-log': laborLogSection,
    'status-intro': statusIntroSection,
  };
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]'>
        <aside className='overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)]'>
          <div className='border-b border-[var(--hairline)] px-4 py-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]'>Shopping / Rules</div>
            <div className='mt-1 text-lg font-semibold tracking-tight'>옵션 공임 규칙</div>
            <p className='mt-2 text-xs leading-5 text-[var(--muted)]'>채널 공통 색상 기본금액과 상품별 사이즈/장식 규칙, 공임 조정을 함께 관리합니다.</p>
          </div>

          <div className='space-y-4 p-3'>
            {RULES_SECTION_GROUPS.map((group) => (
              <div key={group.key} className='rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--background)] p-2'>
                <div className='flex items-center gap-2 px-2 py-1 text-xs font-semibold text-[var(--muted)]'>
                  {group.icon}
                  <span>{group.label}</span>
                </div>
                <div className='mt-1 space-y-1'>
                  {group.items.map((item) => {
                    const isActive = item.key === activeSection;
                    return (
                      <button
                        key={item.key}
                        type='button'
                        onClick={() => setActiveSection(item.key)}
                        className={cn(
                          'w-full rounded-[calc(var(--radius)-4px)] border px-3 py-2 text-left transition-colors',
                          isActive
                            ? 'border-[var(--primary)] bg-[var(--panel)] shadow-sm'
                            : 'border-transparent hover:border-[var(--hairline)] hover:bg-[var(--panel)]',
                        )}
                      >
                        <div className={cn('text-sm font-medium', isActive ? 'text-[var(--fg)]' : 'text-[var(--fg)]')}>{item.label}</div>
                        <div className='mt-1 text-[11px] text-[var(--muted)]'>{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className='min-w-0 space-y-4'>
          <div className='flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--panel)] p-5 md:flex-row md:items-start md:justify-between'>
            <div>
              <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]'>Section</div>
              <h1 className='mt-2 text-2xl font-semibold tracking-tight'>{activeSectionMeta.title}</h1>
              <p className='mt-2 max-w-3xl text-sm text-[var(--muted)]'>{activeSectionMeta.desc}</p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge tone={colorCatalogStats.active > 0 ? 'active' : 'warning'}>중앙 색상 {colorCatalogStats.active}</Badge>
              <Badge tone='neutral'>컨텍스트 {contexts.length}</Badge>
              <Badge tone={selectedContext ? 'active' : 'warning'}>{selectedContext ? '선택됨' : '선택 필요'}</Badge>
              <Button variant='secondary' onClick={() => void refreshPageData()}>
                새로고침
              </Button>
            </div>
          </div>

          {hasPageError ? (
            <Card>
              <CardBody>
                <div className='rounded border border-red-300/50 bg-red-500/5 px-3 py-3 text-sm text-red-700'>
                  {pageError}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {showRuleSectionContextNotice ? (
            <Card>
              <CardBody>
                <div className='rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900'>
                  글로벌 옵션룰을 수정하려면 먼저 `채널 / 상품 컨텍스트`에서 작업 대상을 선택해야 합니다.
                  <div className='mt-3'>
                    <Button size='sm' variant='secondary' onClick={() => setActiveSection('context')}>
                      채널 / 상품 컨텍스트로 이동
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {sectionContent[activeSection]}
        </div>
      </div>
    </div>
  );
}






