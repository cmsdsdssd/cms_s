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
  master_item_id: string;
  external_product_no: string;
  model_name: string | null;
  material_code_default: string | null;
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
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  base_labor_cost_krw: NumberLike;
  additive_delta_krw: NumberLike;
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
  plating_enabled?: boolean | null;
  color_code?: string | null;
  decoration_master_id?: string | null;
  decoration_model_name?: string | null;
  base_labor_cost_krw?: number;
  additive_delta_krw: number;
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
  weightG: string;
  additiveKrw: string;
};

type ColorDraft = {
  ruleId: string;
  platingEnabled: string;
  colorCode: string;
  additiveKrw: string;
};

type DecorDraft = {
  ruleId: string;
  decorationMasterId: string;
  additiveKrw: string;
};

type SaveRuleInput = {
  label: string;
  payload: RulePayload;
};

type DeleteRuleInput = {
  label: string;
  ruleId: string;
};

const WEIGHT_OPTIONS = Array.from({ length: 10_000 }, (_, index) => ((index + 1) / 100).toFixed(2));

const toNumber = (value: NumberLike): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseAmount = (value: string): number => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
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
  weightG: WEIGHT_OPTIONS[0] ?? '0.01',
  additiveKrw: '0',
});

const createEmptyColorDraft = (colors: ColorOption[]): ColorDraft => ({
  ruleId: '',
  platingEnabled: 'true',
  colorCode: colors[0]?.color_code ?? '',
  additiveKrw: '0',
});

const createEmptyDecorDraft = (masters: PoolMaster[]): DecorDraft => ({
  ruleId: '',
  decorationMasterId: masters[0]?.master_item_id ?? '',
  additiveKrw: '0',
});

export default function ShoppingRulesPage() {
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['shop-channels'],
    queryFn: () => shopApiGet<{ data: Channel[] }>('/api/channels'),
  });
  const channels = channelsQuery.data?.data ?? [];

  const [channelId, setChannelId] = useState('');
  useEffect(() => {
    if (!channels.length) {
      if (channelId) setChannelId('');
      return;
    }
    if (!channels.some((channel) => channel.channel_id === channelId)) {
      setChannelId(channels[0]?.channel_id ?? '');
    }
  }, [channelId, channels]);

  const poolsQuery = useQuery({
    queryKey: ['option-labor-rule-pools', channelId],
    enabled: Boolean(channelId),
    queryFn: () => shopApiGet<{ data: PoolsData }>(`/api/option-labor-rule-pools?channel_id=${encodeURIComponent(channelId)}`),
  });

  const pools = poolsQuery.data?.data ?? {};
  const contexts = pools.contexts ?? [];
  const materials = pools.materials ?? [];
  const colors = pools.colors ?? [];
  const decorationMasters = pools.decoration_masters ?? [];
  const masterSource = pools.master_options?.length ? pools.master_options : (pools.masters ?? []);

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
  useEffect(() => {
    if (!contexts.length) {
      if (contextKey) setContextKey('');
      return;
    }
    if (!contexts.some((row) => contextKeyOf(row) === contextKey)) {
      setContextKey(contextKeyOf(contexts[0]));
    }
  }, [contextKey, contexts]);

  const selectedContext = useMemo(
    () => contexts.find((row) => contextKeyOf(row) === contextKey) ?? null,
    [contextKey, contexts],
  );

  const rulesQuery = useQuery({
    queryKey: [
      'option-labor-rules',
      channelId,
      selectedContext?.master_item_id ?? '',
      selectedContext?.external_product_no ?? '',
    ],
    enabled: Boolean(channelId && selectedContext),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('channel_id', channelId);
      params.set('master_item_id', selectedContext?.master_item_id ?? '');
      params.set('external_product_no', selectedContext?.external_product_no ?? '');
      return shopApiGet<{ data: Rule[] }>(`/api/option-labor-rules?${params.toString()}`);
    },
  });

  const rules = rulesQuery.data?.data ?? [];
  const materialRule = rules.find((rule) => rule.category_key === 'MATERIAL') ?? null;
  const sizeRules = rules
    .filter((rule) => rule.category_key === 'SIZE')
    .sort((left, right) => {
      const materialCompare = (left.scope_material_code ?? '').localeCompare(right.scope_material_code ?? '');
      if (materialCompare !== 0) return materialCompare;
      return toNumber(left.additional_weight_g) - toNumber(right.additional_weight_g);
    });
  const colorRules = rules
    .filter((rule) => rule.category_key === 'COLOR_PLATING')
    .sort((left, right) => {
      const platingCompare = Number(left.plating_enabled === true) - Number(right.plating_enabled === true);
      if (platingCompare !== 0) return platingCompare;
      return (left.color_code ?? '').localeCompare(right.color_code ?? '');
    });
  const decorRules = rules
    .filter((rule) => rule.category_key === 'DECOR')
    .sort((left, right) => {
      const leftName = left.decoration_model_name ?? left.decoration_master_id ?? '';
      const rightName = right.decoration_model_name ?? right.decoration_master_id ?? '';
      return leftName.localeCompare(rightName);
    });
  const otherRule = rules.find((rule) => rule.category_key === 'OTHER') ?? null;

  const basePayload = selectedContext
    ? {
        channel_id: channelId,
        master_item_id: selectedContext.master_item_id,
        external_product_no: selectedContext.external_product_no,
        is_active: true,
      }
    : null;

  const [sizeDraft, setSizeDraft] = useState<SizeDraft>(() => createEmptySizeDraft([]));
  const [colorDraft, setColorDraft] = useState<ColorDraft>(() => createEmptyColorDraft([]));
  const [decorDraft, setDecorDraft] = useState<DecorDraft>(() => createEmptyDecorDraft([]));
  const [otherAdditive, setOtherAdditive] = useState('0');

  useEffect(() => {
    setSizeDraft(createEmptySizeDraft(materials));
  }, [selectedContext?.master_item_id, selectedContext?.external_product_no, materials]);

  useEffect(() => {
    setColorDraft(createEmptyColorDraft(colors));
  }, [selectedContext?.master_item_id, selectedContext?.external_product_no, colors]);

  useEffect(() => {
    setDecorDraft(createEmptyDecorDraft(decorationMasters));
  }, [decorationMasters, selectedContext?.master_item_id, selectedContext?.external_product_no]);

  useEffect(() => {
    setOtherAdditive(String(toNumber(otherRule?.additive_delta_krw)));
  }, [otherRule?.additive_delta_krw, selectedContext?.master_item_id, selectedContext?.external_product_no]);

  const [laborMasterId, setLaborMasterId] = useState('');
  useEffect(() => {
    if (!laborMasters.length) {
      if (laborMasterId) setLaborMasterId('');
      return;
    }
    const preferred = selectedContext?.master_item_id;
    const preferredExists = preferred ? laborMasters.some((row) => row.master_item_id === preferred) : false;
    if (!laborMasters.some((row) => row.master_item_id === laborMasterId)) {
      setLaborMasterId(preferredExists ? preferred ?? '' : laborMasters[0]?.master_item_id ?? '');
    }
  }, [laborMasterId, laborMasters, selectedContext?.master_item_id]);

  const currentLaborMaster = laborMasters.find((row) => row.master_item_id === laborMasterId) ?? null;
  const selectedDecorMaster = decorationMasters.find((row) => row.master_item_id === decorDraft.decorationMasterId) ?? null;

  const [laborDelta, setLaborDelta] = useState('0');
  const [laborReason, setLaborReason] = useState('');

  const laborLogQuery = useQuery({
    queryKey: ['channel-labor-price-adjustments', channelId, laborMasterId],
    enabled: Boolean(channelId && laborMasterId),
    queryFn: () =>
      shopApiGet<{ data: LaborLog[] }>(
        `/api/channel-labor-price-adjustments?channel_id=${encodeURIComponent(channelId)}&master_item_id=${encodeURIComponent(laborMasterId)}&limit=30`,
      ),
  });

  const refreshRules = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          'option-labor-rules',
          channelId,
          selectedContext?.master_item_id ?? '',
          selectedContext?.external_product_no ?? '',
        ],
      }),
      queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', channelId] }),
    ]);
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
        channel_id: channelId,
        master_item_id: laborMasterId,
        delta_krw: parseAmount(laborDelta),
        reason: laborReason.trim(),
      }),
  });

  const handleSaveRule = (label: string, payload: RulePayload, afterSuccess?: () => void) => {
    saveRuleMutation.mutate(
      { label, payload },
      {
        onSuccess: async () => {
          toast.success(`${label} 저장 완료`);
          afterSuccess?.();
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
          toast.success(`${label} 삭제 완료`);
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
    handleSaveRule('소재 분류 기준', {
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
    handleSaveRule(
      sizeDraft.ruleId ? '사이즈 룰 수정' : '사이즈 룰',
      {
        ...basePayload,
        rule_id: sizeDraft.ruleId || undefined,
        category_key: 'SIZE',
        scope_material_code: sizeDraft.materialCode || null,
        additional_weight_g: Number(sizeDraft.weightG),
        plating_enabled: null,
        color_code: null,
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: parseAmount(sizeDraft.additiveKrw),
      },
      () => setSizeDraft(createEmptySizeDraft(materials)),
    );
  };

  const handleSaveColor = () => {
    if (!basePayload) return;
    handleSaveRule(
      colorDraft.ruleId ? '색상/도금 룰 수정' : '색상/도금 룰',
      {
        ...basePayload,
        rule_id: colorDraft.ruleId || undefined,
        category_key: 'COLOR_PLATING',
        scope_material_code: null,
        additional_weight_g: null,
        plating_enabled: colorDraft.platingEnabled === 'true',
        color_code: colorDraft.colorCode || null,
        decoration_master_id: null,
        decoration_model_name: null,
        base_labor_cost_krw: 0,
        additive_delta_krw: parseAmount(colorDraft.additiveKrw),
      },
      () => setColorDraft(createEmptyColorDraft(colors)),
    );
  };

  const handleSaveDecor = () => {
    if (!basePayload || !selectedDecorMaster) return;
    handleSaveRule(
      decorDraft.ruleId ? '장식 룰 수정' : '장식 룰',
      {
        ...basePayload,
        rule_id: decorDraft.ruleId || undefined,
        category_key: 'DECOR',
        scope_material_code: null,
        additional_weight_g: null,
        plating_enabled: null,
        color_code: null,
        decoration_master_id: selectedDecorMaster.master_item_id,
        decoration_model_name: selectedDecorMaster.model_name,
        base_labor_cost_krw: laborOf(selectedDecorMaster),
        additive_delta_krw: parseAmount(decorDraft.additiveKrw),
      },
      () => setDecorDraft(createEmptyDecorDraft(decorationMasters)),
    );
  };

  const handleSaveOther = () => {
    if (!basePayload) return;
    handleSaveRule('기타 추가 공임', {
      ...basePayload,
      rule_id: otherRule?.rule_id,
      category_key: 'OTHER',
      scope_material_code: null,
      additional_weight_g: null,
      plating_enabled: null,
      color_code: null,
      decoration_master_id: null,
      decoration_model_name: null,
      base_labor_cost_krw: 0,
      additive_delta_krw: parseAmount(otherAdditive),
    });
  };

  const handleSaveLaborLog = () => {
    laborLogMutation.mutate(undefined, {
      onSuccess: async () => {
        toast.success('총공임 조정 로그 저장 완료');
        setLaborDelta('0');
        setLaborReason('');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['channel-labor-price-adjustments', channelId, laborMasterId] }),
          queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', channelId] }),
        ]);
      },
      onError: (error) => {
        toast.error(describeError(error));
      },
    });
  };

  const colorNameMap = useMemo(() => {
    return new Map(colors.map((row) => [row.color_code, `${row.display_name} (${row.color_code})`]));
  }, [colors]);

  const decorationNameMap = useMemo(() => {
    return new Map(
      decorationMasters.map((row) => [row.master_item_id, row.model_name ?? row.master_item_id]),
    );
  }, [decorationMasters]);

  const disabledReason = !channelId ? '채널을 선택하세요.' : !selectedContext ? '매핑 컨텍스트를 선택하세요.' : '';
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
  const isRuleMutating = saveRuleMutation.isPending || deleteRuleMutation.isPending;
  const isSizeEditing = Boolean(sizeDraft.ruleId);
  const isColorEditing = Boolean(colorDraft.ruleId);
  const isDecorEditing = Boolean(decorDraft.ruleId);

  return (
    <div className="space-y-4">
      <ActionBar
        title="옵션 공임 룰 매니저"
        subtitle="채널과 상품 컨텍스트 기준으로 옵션 공임 룰, 장식 기준 공임, 총공임 조정 로그를 운영합니다."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['shop-channels'] }),
                queryClient.invalidateQueries({ queryKey: ['option-labor-rule-pools', channelId] }),
                queryClient.invalidateQueries({
                  queryKey: [
                    'option-labor-rules',
                    channelId,
                    selectedContext?.master_item_id ?? '',
                    selectedContext?.external_product_no ?? '',
                  ],
                }),
                queryClient.invalidateQueries({ queryKey: ['channel-labor-price-adjustments', channelId, laborMasterId] }),
              ]);
            }}
          >
            새로고침
          </Button>
        }
      />

      <ShoppingPageHeader
        purpose="MATERIAL 분류 기준, SIZE 소재+중량, COLOR_PLATING 도금+색상, DECOR 장식 총공임+추가 공임, OTHER 공통 추가 공임을 한 화면에서 관리합니다."
        status={[
          { label: '컨텍스트', value: `${contexts.length}개` },
          { label: '선택 상태', value: selectedContext ? '선택됨' : '대기', tone: selectedContext ? 'good' : 'warn' },
          { label: '저장 룰', value: `${rules.length}건`, tone: rules.length > 0 ? 'good' : 'neutral' },
        ]}
        nextActions={[
          { label: '상품 매핑으로', href: '/settings/shopping/mappings' },
          { label: '운영 워크플로우로', href: '/settings/shopping/workflow' },
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
          title="채널 / 적용 컨텍스트"
          description="채널과 특정 매핑 상품 컨텍스트를 선택하면 해당 상품의 옵션 공임 룰만 조회하고 수정합니다."
        />
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">채널</div>
              <Select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                <option value="">채널 선택</option>
                {channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {`${channel.channel_name} (${channel.channel_code})`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">매핑 컨텍스트</div>
              <Select
                value={contextKey}
                onChange={(event) => setContextKey(event.target.value)}
                disabled={!channelId || contexts.length === 0}
              >
                <option value="">매핑 컨텍스트 선택</option>
                {contexts.map((row) => (
                  <option key={contextKeyOf(row)} value={contextKeyOf(row)}>
                    {`${row.model_name ?? row.master_item_id} / ${row.external_product_no}`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">마스터</div>
              <Input value={selectedContext?.model_name ?? selectedContext?.master_item_id ?? '-'} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">쇼핑몰 상품번호</div>
              <Input value={selectedContext?.external_product_no ?? '-'} disabled />
            </div>
          </div>

          {selectedContext ? (
            <div className="grid grid-cols-1 gap-2 rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] md:grid-cols-3">
              <div>기본 소재: {selectedContext.material_code_default ?? '-'}</div>
              <div>불러온 룰: {rules.length}건</div>
              <div>
                조회 상태: {channelsQuery.isFetching || poolsQuery.isFetching || rulesQuery.isFetching ? '갱신 중' : '준비됨'}
              </div>
            </div>
          ) : null}

          {disabledReason ? <div className="text-xs text-[var(--muted)]">{disabledReason}</div> : null}
        </CardBody>
      </Card>

      {laborMasters.length > 0 ? (
        <Card>
          <CardHeader
            title="총공임 기준 조정 로그"
            description="선택한 마스터의 총공임 기준값을 확인하고, 로그 기반으로 증감 이력을 남깁니다."
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <div className="mb-1 text-xs text-[var(--muted)]">마스터</div>
                <Select value={laborMasterId} onChange={(event) => setLaborMasterId(event.target.value)}>
                  <option value="">마스터 선택</option>
                  {laborMasters.map((master) => (
                    <option key={master.master_item_id} value={master.master_item_id}>
                      {master.model_name ?? master.master_item_id}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs text-[var(--muted)]">총공임 기준값</div>
                <Input value={formatWon(laborOf(currentLaborMaster))} disabled />
              </div>
              <div>
                <div className="mb-1 text-xs text-[var(--muted)]">조정 금액(+/-)</div>
                <Input
                  type="number"
                  autoFormat={false}
                  step={100}
                  value={laborDelta}
                  onChange={(event) => setLaborDelta(event.target.value)}
                  placeholder="예: 5000 또는 -3000"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-[var(--muted)]">사유</div>
                <Input
                  value={laborReason}
                  onChange={(event) => setLaborReason(event.target.value)}
                  placeholder="사유 필수"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveLaborLog}
              disabled={
                !channelId
                || !laborMasterId
                || !laborReason.trim()
                || parseAmount(laborDelta) === 0
                || laborLogMutation.isPending
              }
            >
              총공임 조정 로그 저장
            </Button>

            <div className="max-h-[220px] overflow-auto rounded border border-[var(--hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--panel)] text-left">
                  <tr>
                    <th className="px-3 py-2">시각</th>
                    <th className="px-3 py-2">조정</th>
                    <th className="px-3 py-2">사유</th>
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
                        저장된 총공임 조정 로그가 없습니다.
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
        <CardHeader title="1. 소재" description="MATERIAL은 분류 기준만 저장하는 classification-only 섹션입니다." />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            소재 룰은 가격 데이터를 갖지 않습니다. 현재 컨텍스트의 기본 소재를 기준으로 MATERIAL 행만 유지합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">기준 소재</div>
              <Input value={selectedContext?.material_code_default ?? '-'} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">등록 상태</div>
              <Input value={materialRule ? '등록됨' : '미등록'} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">최종 갱신</div>
              <Input value={formatWhen(materialRule?.updated_at ?? materialRule?.created_at)} disabled />
            </div>
            <div className="space-y-2">
              <div className="mb-1 text-xs text-[var(--muted)]">관리</div>
              <Button onClick={handleSaveMaterial} disabled={Boolean(disabledReason) || isRuleMutating}>
                {materialRule ? '분류 기준 재저장' : '분류 기준 등록'}
              </Button>
              {materialRule ? (
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteRule('소재 분류 기준', materialRule.rule_id)}
                  disabled={deleteRuleMutation.isPending}
                >
                  분류 기준 제거
                </Button>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="2. 사이즈" description="SIZE는 소재 + 추가 중량 조합별 추가 공임을 저장합니다." />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            자동 소재 분류기와 추가 중량(0.01g ~ 100.00g) 조합으로 SIZE 룰을 단건 저장합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">자동 소재 분류기</div>
              <Select
                value={sizeDraft.materialCode}
                onChange={(event) => setSizeDraft((current) => ({ ...current, materialCode: event.target.value }))}
                disabled={materials.length === 0}
              >
                <option value="">소재 선택</option>
                {materials.map((materialCode) => (
                  <option key={materialCode} value={materialCode}>
                    {materialCode}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">추가 중량</div>
              <Select
                value={sizeDraft.weightG}
                onChange={(event) => setSizeDraft((current) => ({ ...current, weightG: event.target.value }))}
              >
                {WEIGHT_OPTIONS.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight}g
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">추가 공임</div>
              <Input
                type="number"
                autoFormat={false}
                step={100}
                value={sizeDraft.additiveKrw}
                onChange={(event) => setSizeDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
                placeholder="예: 3000"
              />
            </div>
            <div className="space-y-2">
              <div className="mb-1 text-xs text-[var(--muted)]">저장</div>
              <Button onClick={handleSaveSize} disabled={Boolean(disabledReason) || !sizeDraft.materialCode || isRuleMutating}>
                {isSizeEditing ? '사이즈 룰 수정 저장' : '사이즈 룰 추가'}
              </Button>
              {isSizeEditing ? (
                <Button variant="ghost" onClick={() => setSizeDraft(createEmptySizeDraft(materials))}>
                  수정 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">소재</th>
                  <th className="px-3 py-2">추가 중량</th>
                  <th className="px-3 py-2">추가 공임</th>
                  <th className="px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {sizeRules.map((rule) => (
                  <tr key={rule.rule_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{rule.scope_material_code ?? '-'}</td>
                    <td className="px-3 py-2">{`${toNumber(rule.additional_weight_g).toFixed(2)}g`}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSizeDraft({
                              ruleId: rule.rule_id,
                              materialCode: rule.scope_material_code ?? materials[0] ?? '',
                              weightG: toNumber(rule.additional_weight_g).toFixed(2),
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRule('사이즈 룰', rule.rule_id)}
                          disabled={deleteRuleMutation.isPending}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sizeRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                      등록된 사이즈 룰이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="3. 색상 / 도금" description="COLOR_PLATING은 도금 여부 + 색상 조합별 추가 공임을 저장합니다." />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            도금 여부를 필수로 선택하고, 색상은 전체 또는 특정 색상으로 세분화해 저장합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">도금 여부</div>
              <Select
                value={colorDraft.platingEnabled}
                onChange={(event) => setColorDraft((current) => ({ ...current, platingEnabled: event.target.value }))}
              >
                <option value="true">도금 있음</option>
                <option value="false">도금 없음</option>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">색상</div>
              <Select
                value={colorDraft.colorCode}
                onChange={(event) => setColorDraft((current) => ({ ...current, colorCode: event.target.value }))}
              >
                <option value="">전체 색상</option>
                {colors.map((color) => (
                  <option key={color.color_code} value={color.color_code}>
                    {`${color.display_name} (${color.color_code})`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">추가 공임</div>
              <Input
                type="number"
                autoFormat={false}
                step={100}
                value={colorDraft.additiveKrw}
                onChange={(event) => setColorDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
                placeholder="예: 2000"
              />
            </div>
            <div className="space-y-2">
              <div className="mb-1 text-xs text-[var(--muted)]">저장</div>
              <Button onClick={handleSaveColor} disabled={Boolean(disabledReason) || isRuleMutating}>
                {isColorEditing ? '색상/도금 룰 수정 저장' : '색상/도금 룰 추가'}
              </Button>
              {isColorEditing ? (
                <Button variant="ghost" onClick={() => setColorDraft(createEmptyColorDraft(colors))}>
                  수정 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">도금 여부</th>
                  <th className="px-3 py-2">색상</th>
                  <th className="px-3 py-2">추가 공임</th>
                  <th className="px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {colorRules.map((rule) => (
                  <tr key={rule.rule_id} className="border-t border-[var(--hairline)]">
                    <td className="px-3 py-2">{rule.plating_enabled === false ? '도금 없음' : '도금 있음'}</td>
                    <td className="px-3 py-2">{rule.color_code ? (colorNameMap.get(rule.color_code) ?? rule.color_code) : '전체 색상'}</td>
                    <td className="px-3 py-2">{formatWon(rule.additive_delta_krw)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setColorDraft({
                              ruleId: rule.rule_id,
                              platingEnabled: rule.plating_enabled === false ? 'false' : 'true',
                              colorCode: rule.color_code ?? '',
                              additiveKrw: String(toNumber(rule.additive_delta_krw)),
                            });
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRule('색상/도금 룰', rule.rule_id)}
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
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                      등록된 색상/도금 룰이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="4. 장식" description="DECOR는 선택한 장식 마스터의 총공임 + 추가 공임 합산값을 관리합니다." />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            장식 마스터의 총공임은 읽기 전용이며, 저장 시 해당 총공임과 additive 값이 함께 보존됩니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">장식 마스터</div>
              <Select
                value={decorDraft.decorationMasterId}
                onChange={(event) => setDecorDraft((current) => ({ ...current, decorationMasterId: event.target.value }))}
                disabled={decorationMasters.length === 0}
              >
                <option value="">장식 마스터 선택</option>
                {decorationMasters.map((master) => (
                  <option key={master.master_item_id} value={master.master_item_id}>
                    {master.model_name ?? master.master_item_id}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">총공임 기준</div>
              <Input value={formatWon(laborOf(selectedDecorMaster))} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">추가 공임</div>
              <Input
                type="number"
                autoFormat={false}
                step={100}
                value={decorDraft.additiveKrw}
                onChange={(event) => setDecorDraft((current) => ({ ...current, additiveKrw: event.target.value }))}
                placeholder="예: 1500"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">적용 총액</div>
              <Input value={formatWon(laborOf(selectedDecorMaster) + parseAmount(decorDraft.additiveKrw))} disabled />
            </div>
            <div className="space-y-2">
              <div className="mb-1 text-xs text-[var(--muted)]">저장</div>
              <Button onClick={handleSaveDecor} disabled={Boolean(disabledReason) || !selectedDecorMaster || isRuleMutating}>
                {isDecorEditing ? '장식 룰 수정 저장' : '장식 룰 추가'}
              </Button>
              {isDecorEditing ? (
                <Button variant="ghost" onClick={() => setDecorDraft(createEmptyDecorDraft(decorationMasters))}>
                  수정 취소
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded border border-[var(--hairline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--panel)] text-left">
                <tr>
                  <th className="px-3 py-2">장식 마스터</th>
                  <th className="px-3 py-2">총공임</th>
                  <th className="px-3 py-2">추가 공임</th>
                  <th className="px-3 py-2">적용 총액</th>
                  <th className="px-3 py-2">관리</th>
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
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRule('장식 룰', rule.rule_id)}
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
                      등록된 장식 룰이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="5. 기타" description="OTHER는 컨텍스트 단위의 공통 additive 공임만 저장합니다." />
        <CardBody className="space-y-3">
          <div className="rounded border border-[var(--hairline)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            다른 섹션에 속하지 않는 공통 추가 공임을 OTHER 단일 행으로 관리합니다.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">기타 추가 공임</div>
              <Input
                type="number"
                autoFormat={false}
                step={100}
                value={otherAdditive}
                onChange={(event) => setOtherAdditive(event.target.value)}
                placeholder="예: 1000"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">등록 상태</div>
              <Input value={otherRule ? '등록됨' : '미등록'} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">최종 갱신</div>
              <Input value={formatWhen(otherRule?.updated_at ?? otherRule?.created_at)} disabled />
            </div>
            <div className="space-y-2">
              <div className="mb-1 text-xs text-[var(--muted)]">저장</div>
              <Button onClick={handleSaveOther} disabled={Boolean(disabledReason) || isRuleMutating}>
                {otherRule ? '기타 공임 수정 저장' : '기타 공임 등록'}
              </Button>
              {otherRule ? (
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteRule('기타 추가 공임', otherRule.rule_id)}
                  disabled={deleteRuleMutation.isPending}
                >
                  삭제
                </Button>
              ) : null}
            </div>
          </div>

          {otherRule ? (
            <div className="rounded border border-[var(--hairline)] px-3 py-3 text-sm">
              현재 저장값: {formatWon(otherRule.additive_delta_krw)}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
