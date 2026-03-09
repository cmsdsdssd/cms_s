const WEIGHT_MIN_CENTIGRAM = 0;
const WEIGHT_MAX_CENTIGRAM = 10000;

const toTrimmed = (value) => String(value ?? '').trim();

const toUpper = (value) => toTrimmed(value).toUpperCase();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRoundedKrw = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeWeightCentigram = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  const centigram = Math.round(parsed * 100);
  if (centigram < WEIGHT_MIN_CENTIGRAM || centigram > WEIGHT_MAX_CENTIGRAM) return null;
  return centigram;
};

const centigramToWeight = (centigram) => {
  const safe = Number(centigram);
  if (!Number.isFinite(safe)) return null;
  return Number((safe / 100).toFixed(2));
};

const centigramToWeightString = (centigram) => {
  const value = centigramToWeight(centigram);
  return value === null ? null : value.toFixed(2);
};

const normalizeRuleType = (value) => {
  const normalized = toUpper(value);
  if (normalized === 'COLOR_PLATING') return 'COLOR';
  if (normalized === 'MATERIAL' || normalized === 'SIZE' || normalized === 'COLOR' || normalized === 'DECOR' || normalized === 'OTHER' || normalized === 'NOTICE') {
    return normalized;
  }
  return null;
};

const normalizeRuleRow = (raw) => {
  const ruleType = normalizeRuleType(raw?.rule_type ?? raw?.category_key);
  if (!ruleType) return null;
  return {
    rule_id: toTrimmed(raw?.rule_id),
    rule_type: ruleType,
    material_code: toUpper(raw?.material_code ?? raw?.scope_material_code) || null,
    color_code: toUpper(raw?.color_code) || null,
    decor_master_item_id: toTrimmed(raw?.decor_master_item_id ?? raw?.decoration_master_id) || null,
    decor_model_name_snapshot: toTrimmed(raw?.decor_model_name_snapshot ?? raw?.decoration_model_name) || null,
    decor_material_code_snapshot: toUpper(raw?.decor_material_code_snapshot) || null,
    decor_weight_g_snapshot: toFiniteNumber(raw?.decor_weight_g_snapshot),
    decor_total_labor_cost_snapshot: toRoundedKrw(raw?.decor_total_labor_cost_snapshot ?? raw?.base_labor_cost_krw),
    delta_krw: toRoundedKrw(raw?.delta_krw ?? raw?.additive_delta_krw),
    weight_min_centigram: normalizeWeightCentigram(raw?.weight_min_g ?? raw?.additional_weight_min_g ?? raw?.additional_weight_g),
    weight_max_centigram: normalizeWeightCentigram(raw?.weight_max_g ?? raw?.additional_weight_max_g ?? raw?.additional_weight_g),
    is_active: raw?.is_active !== false,
  };
};

const createBaseResult = ({ category, masterMaterialCode, masterMaterialLabel, persisted }) => ({
  category,
  material_code_resolved: toUpper(persisted?.material_code_resolved) || toUpper(masterMaterialCode) || null,
  material_label_resolved: toTrimmed(persisted?.material_label_resolved) || toTrimmed(masterMaterialLabel) || null,
  size_weight_g_selected: toFiniteNumber(persisted?.size_weight_g_selected),
  color_code_selected: toUpper(persisted?.color_code_selected) || null,
  decor_master_item_id_selected: toTrimmed(persisted?.decor_master_item_id_selected) || null,
  decor_model_name_selected: toTrimmed(persisted?.decor_model_name_selected) || null,
  decor_material_code_snapshot: toUpper(persisted?.decor_material_code_snapshot) || null,
  decor_weight_g_snapshot: toFiniteNumber(persisted?.decor_weight_g_snapshot),
  decor_total_labor_cost_snapshot: toFiniteNumber(persisted?.decor_total_labor_cost_snapshot),
  other_delta_krw: toFiniteNumber(persisted?.other_delta_krw),
  other_reason: toTrimmed(persisted?.other_reason) || null,
  decor_extra_delta_krw: toFiniteNumber(persisted?.decor_extra_delta_krw),
  decor_final_amount_krw: toFiniteNumber(persisted?.decor_final_amount_krw),
  notice_value_selected: toTrimmed(persisted?.notice_value_selected) || null,
  resolved_delta_krw: toRoundedKrw(persisted?.resolved_delta_krw),
  source_rule_entry_ids: [],
  legacy_status: 'VALID',
  warnings: [],
});

const markLegacy = (result, warning) => ({
  ...result,
  legacy_status: 'LEGACY_OUT_OF_RANGE',
  warnings: warning ? [...result.warnings, warning] : result.warnings,
});

const markUnresolved = (result, warning) => ({
  ...result,
  legacy_status: 'UNRESOLVED',
  warnings: warning ? [...result.warnings, warning] : result.warnings,
});

const sortText = (values) => [...values].sort((left, right) => left.localeCompare(right));

export const collectAllowedSizeWeights = (rules, masterMaterialCode) => {
  const materialCode = toUpper(masterMaterialCode);
  const values = new Set();
  for (const raw of Array.isArray(rules) ? rules : []) {
    const rule = normalizeRuleRow(raw);
    if (!rule || !rule.is_active || rule.rule_type !== 'SIZE') continue;
    if ((rule.material_code ?? null) !== (materialCode || null)) continue;
    const min = Number(rule.weight_min_centigram);
    const max = Number(rule.weight_max_centigram);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) continue;
    for (let current = min; current <= max; current += 1) {
      const value = centigramToWeightString(current);
      if (value) values.add(value);
    }
  }
  return sortText(values);
};

export const collectAllowedColors = (rules, masterMaterialCode) => {
  const materialCode = toUpper(masterMaterialCode);
  const values = new Set();
  for (const raw of Array.isArray(rules) ? rules : []) {
    const rule = normalizeRuleRow(raw);
    if (!rule || !rule.is_active || rule.rule_type !== 'COLOR') continue;
    if ((rule.material_code ?? null) !== (materialCode || null)) continue;
    if (!rule.color_code) continue;
    values.add(rule.color_code);
  }
  return sortText(values);
};

export const resolveCentralOptionMapping = ({ category, masterMaterialCode, masterMaterialLabel, rules, persisted }) => {
  const normalizedCategory = normalizeRuleType(category);
  const base = createBaseResult({
    category: normalizedCategory ?? (toUpper(category) || 'OTHER'),
    masterMaterialCode,
    masterMaterialLabel,
    persisted,
  });
  const activeRules = (Array.isArray(rules) ? rules : [])
    .map((rule) => normalizeRuleRow(rule))
    .filter((rule) => rule && rule.is_active);

  if (normalizedCategory === 'MATERIAL') {
    if (!base.material_code_resolved) return markUnresolved(base, '마스터 소재를 찾지 못했습니다.');
    return { ...base, resolved_delta_krw: 0 };
  }

  if (normalizedCategory === 'SIZE') {
    const selectedCentigram = normalizeWeightCentigram(base.size_weight_g_selected);
    if (!base.material_code_resolved) return markUnresolved(base, '소재가 없어서 사이즈를 결정할 수 없습니다.');
    if (selectedCentigram === null) return markUnresolved(base, '추가중량을 선택해야 합니다.');
    if (selectedCentigram === 0) {
      return {
        ...base,
        resolved_delta_krw: 0,
        source_rule_entry_ids: [],
      };
    }
    const matched = activeRules.filter((rule) => {
      return rule.rule_type === 'SIZE'
        && rule.material_code === base.material_code_resolved
        && Number.isFinite(rule.weight_min_centigram)
        && Number.isFinite(rule.weight_max_centigram)
        && selectedCentigram >= rule.weight_min_centigram
        && selectedCentigram <= rule.weight_max_centigram;
    });
    if (matched.length === 0) {
      return markLegacy(base, '현재 선택한 추가중량이 중앙 허용 범위 밖입니다.');
    }
    return {
      ...base,
      resolved_delta_krw: matched.reduce((sum, rule) => sum + toRoundedKrw(rule.delta_krw), 0),
      source_rule_entry_ids: matched.map((rule) => rule.rule_id).filter(Boolean),
    };
  }

  if (normalizedCategory === 'COLOR') {
    if (!base.material_code_resolved) return markUnresolved(base, '소재가 없어서 색상을 결정할 수 없습니다.');
    if (!base.color_code_selected) return markUnresolved(base, '색상을 선택해야 합니다.');
    const matched = activeRules.filter((rule) => {
      return rule.rule_type === 'COLOR'
        && rule.material_code === base.material_code_resolved
        && rule.color_code === base.color_code_selected;
    });
    if (matched.length === 0) {
      return markLegacy(base, '현재 선택한 색상이 중앙 허용 범위 밖입니다.');
    }
    const allowedAmounts = [...new Set(matched.map((rule) => toRoundedKrw(rule.delta_krw)))].sort((left, right) => left - right);
    const persistedAmount = toFiniteNumber(persisted?.resolved_delta_krw);
    const selectedAmount = persistedAmount == null ? null : Math.round(persistedAmount);
    const resolvedAmount = selectedAmount != null && allowedAmounts.includes(selectedAmount)
      ? selectedAmount
      : (allowedAmounts[0] ?? 0);
    const sourceRuleEntryIds = matched
      .filter((rule) => toRoundedKrw(rule.delta_krw) === resolvedAmount)
      .map((rule) => rule.rule_id)
      .filter(Boolean);
    return {
      ...base,
      resolved_delta_krw: resolvedAmount,
      source_rule_entry_ids: sourceRuleEntryIds,
    };
  }

  if (normalizedCategory === 'DECOR') {
    if (!base.decor_master_item_id_selected) return markUnresolved(base, '장식 마스터를 선택해야 합니다.');
    const matched = activeRules.filter((rule) => {
      return rule.rule_type === 'DECOR' && rule.decor_master_item_id === base.decor_master_item_id_selected;
    });
    if (matched.length === 0) {
      return markLegacy(base, '현재 선택한 장식이 중앙 허용 범위 밖입니다.');
    }
    const primary = matched[0];
    const baseLabor = toRoundedKrw(primary.decor_total_labor_cost_snapshot);
    const extraDelta = toRoundedKrw(base.decor_extra_delta_krw ?? primary.delta_krw);
    const finalAmount = toRoundedKrw(base.decor_final_amount_krw ?? (baseLabor + extraDelta));
    return {
      ...base,
      decor_model_name_selected: primary.decor_model_name_snapshot,
      decor_material_code_snapshot: primary.decor_material_code_snapshot,
      decor_weight_g_snapshot: primary.decor_weight_g_snapshot,
      decor_total_labor_cost_snapshot: primary.decor_total_labor_cost_snapshot,
      decor_extra_delta_krw: extraDelta,
      decor_final_amount_krw: finalAmount,
      resolved_delta_krw: finalAmount,
      source_rule_entry_ids: matched.map((rule) => rule.rule_id).filter(Boolean),
    };
  }

  if (normalizedCategory === 'NOTICE') {
    const noticeValue = toTrimmed(base.notice_value_selected);
    if (!noticeValue) return markUnresolved({ ...base, resolved_delta_krw: 0 }, '공지 값을 선택해야 합니다.');
    return { ...base, notice_value_selected: noticeValue, resolved_delta_krw: 0 };
  }

  if (normalizedCategory === 'OTHER') {
    const delta = toRoundedKrw(base.other_delta_krw ?? base.resolved_delta_krw);
    const reason = toTrimmed(base.other_reason);
    if (!reason) {
      return markUnresolved({ ...base, resolved_delta_krw: delta }, '기타 카테고리는 사유가 필요합니다.');
    }
    return { ...base, other_reason: reason, resolved_delta_krw: delta };
  }

  return markUnresolved(base, '지원하지 않는 카테고리입니다.');
};
