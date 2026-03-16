export type CentralRegistryKind = 'MATERIAL' | 'COLOR_BUCKET' | 'ADDON' | 'NOTICE' | 'OTHER_REASON';

export type CentralRegistryPayload = {
  registry_kind: CentralRegistryKind;
  channel_id: string;
  material_code: string | null;
  material_label: string | null;
  material_type: string | null;
  tick_source: string | null;
  factor_ref: string | null;
  bucket_code: string | null;
  bucket_label: string | null;
  base_cost_krw: number | null;
  sell_delta_krw: number | null;
  addon_code: string | null;
  addon_name: string | null;
  base_amount_krw: number | null;
  extra_delta_krw: number | null;
  notice_code: string | null;
  notice_name: string | null;
  reason_code: string | null;
  reason_name: string | null;
  display_text: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

const trimOrNull = (value: unknown): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRegistryKind = (value: unknown): CentralRegistryKind => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (
    normalized === 'MATERIAL'
    || normalized === 'COLOR_BUCKET'
    || normalized === 'ADDON'
    || normalized === 'NOTICE'
    || normalized === 'OTHER_REASON'
  ) {
    return normalized;
  }
  throw new Error('registry_kind must be one of MATERIAL/COLOR_BUCKET/ADDON/NOTICE/OTHER_REASON');
};

export const normalizeCentralRegistryPayload = (raw: Record<string, unknown>): CentralRegistryPayload => ({
  registry_kind: normalizeRegistryKind(raw.registry_kind),
  channel_id: String(raw.channel_id ?? '').trim(),
  material_code: trimOrNull(raw.material_code),
  material_label: trimOrNull(raw.material_label),
  material_type: trimOrNull(raw.material_type),
  tick_source: trimOrNull(raw.tick_source),
  factor_ref: trimOrNull(raw.factor_ref),
  bucket_code: trimOrNull(raw.bucket_code),
  bucket_label: trimOrNull(raw.bucket_label),
  base_cost_krw: toNumberOrNull(raw.base_cost_krw),
  sell_delta_krw: toNumberOrNull(raw.sell_delta_krw),
  addon_code: trimOrNull(raw.addon_code),
  addon_name: trimOrNull(raw.addon_name),
  base_amount_krw: toNumberOrNull(raw.base_amount_krw),
  extra_delta_krw: toNumberOrNull(raw.extra_delta_krw),
  notice_code: trimOrNull(raw.notice_code),
  notice_name: trimOrNull(raw.notice_name),
  reason_code: trimOrNull(raw.reason_code),
  reason_name: trimOrNull(raw.reason_name),
  display_text: trimOrNull(raw.display_text),
  description: trimOrNull(raw.description),
  sort_order: Number.isFinite(Number(raw.sort_order)) ? Math.round(Number(raw.sort_order)) : 0,
  is_active: raw.is_active === false ? false : true,
});

export const validateCentralRegistryPayload = (
  payload: CentralRegistryPayload,
): { ok: true } | { ok: false; errors: string[] } => {
  const errors: string[] = [];
  if (!payload.channel_id) errors.push('channel_id is required');

  const rejectIfPresent = (field: keyof CentralRegistryPayload) => {
    const value = payload[field];
    if (value !== null && value !== false && value !== 0) errors.push(`${field} must be null for ${payload.registry_kind}`);
  };

  switch (payload.registry_kind) {
    case 'MATERIAL':
      if (!payload.material_code) errors.push('material_code is required for MATERIAL');
      if (!payload.material_label) errors.push('material_label is required for MATERIAL');
      if (!payload.material_type) errors.push('material_type is required for MATERIAL');
      if (!payload.tick_source) errors.push('tick_source is required for MATERIAL');
      if (!payload.factor_ref) errors.push('factor_ref is required for MATERIAL');
      rejectIfPresent('bucket_code');
      rejectIfPresent('bucket_label');
      rejectIfPresent('base_cost_krw');
      rejectIfPresent('sell_delta_krw');
      rejectIfPresent('addon_code');
      rejectIfPresent('addon_name');
      rejectIfPresent('base_amount_krw');
      rejectIfPresent('extra_delta_krw');
      rejectIfPresent('notice_code');
      rejectIfPresent('notice_name');
      rejectIfPresent('reason_code');
      rejectIfPresent('reason_name');
      rejectIfPresent('display_text');
      rejectIfPresent('description');
      break;
    case 'COLOR_BUCKET':
      if (!payload.bucket_code) errors.push('bucket_code is required for COLOR_BUCKET');
      if (!payload.bucket_label) errors.push('bucket_label is required for COLOR_BUCKET');
      if (payload.base_cost_krw === null) errors.push('base_cost_krw is required for COLOR_BUCKET');
      if (payload.sell_delta_krw === null) errors.push('sell_delta_krw is required for COLOR_BUCKET');
      rejectIfPresent('material_code');
      rejectIfPresent('material_label');
      rejectIfPresent('material_type');
      rejectIfPresent('tick_source');
      rejectIfPresent('factor_ref');
      rejectIfPresent('addon_code');
      rejectIfPresent('addon_name');
      rejectIfPresent('base_amount_krw');
      rejectIfPresent('extra_delta_krw');
      rejectIfPresent('notice_code');
      rejectIfPresent('notice_name');
      rejectIfPresent('reason_code');
      rejectIfPresent('reason_name');
      rejectIfPresent('display_text');
      rejectIfPresent('description');
      break;
    case 'ADDON':
      if (!payload.addon_code) errors.push('addon_code is required for ADDON');
      if (!payload.addon_name) errors.push('addon_name is required for ADDON');
      if (payload.base_amount_krw === null) errors.push('base_amount_krw is required for ADDON');
      if (payload.extra_delta_krw === null) errors.push('extra_delta_krw is required for ADDON');
      rejectIfPresent('material_code');
      rejectIfPresent('material_label');
      rejectIfPresent('material_type');
      rejectIfPresent('tick_source');
      rejectIfPresent('factor_ref');
      rejectIfPresent('bucket_code');
      rejectIfPresent('bucket_label');
      rejectIfPresent('base_cost_krw');
      rejectIfPresent('sell_delta_krw');
      rejectIfPresent('notice_code');
      rejectIfPresent('notice_name');
      rejectIfPresent('reason_code');
      rejectIfPresent('reason_name');
      rejectIfPresent('display_text');
      rejectIfPresent('description');
      break;
    case 'NOTICE':
      if (!payload.notice_code) errors.push('notice_code is required for NOTICE');
      if (!payload.notice_name) errors.push('notice_name is required for NOTICE');
      if (!payload.display_text) errors.push('display_text is required for NOTICE');
      if (!payload.description) errors.push('description is required for NOTICE');
      rejectIfPresent('material_code');
      rejectIfPresent('material_label');
      rejectIfPresent('material_type');
      rejectIfPresent('tick_source');
      rejectIfPresent('factor_ref');
      rejectIfPresent('bucket_code');
      rejectIfPresent('bucket_label');
      rejectIfPresent('base_cost_krw');
      rejectIfPresent('sell_delta_krw');
      rejectIfPresent('addon_code');
      rejectIfPresent('addon_name');
      rejectIfPresent('base_amount_krw');
      rejectIfPresent('extra_delta_krw');
      rejectIfPresent('reason_code');
      rejectIfPresent('reason_name');
      break;
    case 'OTHER_REASON':
      if (!payload.reason_code) errors.push('reason_code is required for OTHER_REASON');
      if (!payload.reason_name) errors.push('reason_name is required for OTHER_REASON');
      if (!payload.display_text) errors.push('display_text is required for OTHER_REASON');
      if (!payload.description) errors.push('description is required for OTHER_REASON');
      rejectIfPresent('material_code');
      rejectIfPresent('material_label');
      rejectIfPresent('material_type');
      rejectIfPresent('tick_source');
      rejectIfPresent('factor_ref');
      rejectIfPresent('bucket_code');
      rejectIfPresent('bucket_label');
      rejectIfPresent('base_cost_krw');
      rejectIfPresent('sell_delta_krw');
      rejectIfPresent('addon_code');
      rejectIfPresent('addon_name');
      rejectIfPresent('base_amount_krw');
      rejectIfPresent('extra_delta_krw');
      rejectIfPresent('notice_code');
      rejectIfPresent('notice_name');
      break;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
};
