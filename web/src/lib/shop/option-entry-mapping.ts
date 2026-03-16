export type OptionEntryCategoryKey = 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'ADDON' | 'OTHER' | 'NOTICE';

export type OptionEntryMappingPayload = {
  channel_id: string;
  external_product_no: string;
  option_name: string;
  option_value: string;
  category_key: OptionEntryCategoryKey;
  material_registry_code: string | null;
  weight_g: number | null;
  combo_code: string | null;
  color_bucket_id: string | null;
  decor_master_id: string | null;
  addon_master_id: string | null;
  other_reason_code: string | null;
  explicit_delta_krw: number | null;
  notice_code: string | null;
  label_snapshot: string | null;
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

const normalizeCategoryKey = (value: unknown): OptionEntryCategoryKey => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (
    normalized === 'MATERIAL'
    || normalized === 'SIZE'
    || normalized === 'COLOR_PLATING'
    || normalized === 'DECOR'
    || normalized === 'ADDON'
    || normalized === 'OTHER'
    || normalized === 'NOTICE'
  ) {
    return normalized;
  }
  throw new Error('category_key must be one of MATERIAL/SIZE/COLOR_PLATING/DECOR/ADDON/OTHER/NOTICE');
};

export const normalizeOptionEntryMappingPayload = (raw: Record<string, unknown>): OptionEntryMappingPayload => ({
  channel_id: String(raw.channel_id ?? '').trim(),
  external_product_no: String(raw.external_product_no ?? '').trim(),
  option_name: String(raw.option_name ?? '').trim(),
  option_value: String(raw.option_value ?? '').trim(),
  category_key: normalizeCategoryKey(raw.category_key),
  material_registry_code: trimOrNull(raw.material_registry_code),
  weight_g: toNumberOrNull(raw.weight_g),
  combo_code: trimOrNull(raw.combo_code),
  color_bucket_id: trimOrNull(raw.color_bucket_id),
  decor_master_id: trimOrNull(raw.decor_master_id),
  addon_master_id: trimOrNull(raw.addon_master_id),
  other_reason_code: trimOrNull(raw.other_reason_code),
  explicit_delta_krw: toNumberOrNull(raw.explicit_delta_krw),
  notice_code: trimOrNull(raw.notice_code),
  label_snapshot: trimOrNull(raw.label_snapshot),
  is_active: raw.is_active === false ? false : true,
});


export const sanitizeOptionEntryMappingPayload = (
  payload: OptionEntryMappingPayload,
): OptionEntryMappingPayload => {
  const base = {
    channel_id: payload.channel_id,
    external_product_no: payload.external_product_no,
    option_name: payload.option_name,
    option_value: payload.option_value,
    category_key: payload.category_key,
    label_snapshot: payload.label_snapshot,
    is_active: payload.is_active,
    material_registry_code: null,
    weight_g: null,
    combo_code: null,
    color_bucket_id: null,
    decor_master_id: null,
    addon_master_id: null,
    other_reason_code: null,
    explicit_delta_krw: null,
    notice_code: null,
  } satisfies OptionEntryMappingPayload;

  switch (payload.category_key) {
    case 'MATERIAL':
      return { ...base, material_registry_code: payload.material_registry_code };
    case 'SIZE':
      return { ...base, weight_g: payload.weight_g };
    case 'COLOR_PLATING':
      return {
        ...base,
        combo_code: payload.combo_code,
        color_bucket_id: payload.color_bucket_id,
      };
    case 'DECOR':
      return { ...base, decor_master_id: payload.decor_master_id };
    case 'ADDON':
      return { ...base, addon_master_id: payload.addon_master_id };
    case 'OTHER':
      return {
        ...base,
        other_reason_code: payload.other_reason_code,
        explicit_delta_krw: payload.explicit_delta_krw,
      };
    case 'NOTICE':
      return { ...base, notice_code: payload.notice_code };
  }
};

export const validateOptionEntryMappingPayload = (
  payload: OptionEntryMappingPayload,
): { ok: true } | { ok: false; errors: string[] } => {
  const errors: string[] = [];

  if (!payload.channel_id) errors.push('channel_id is required');
  if (!payload.external_product_no) errors.push('external_product_no is required');
  if (!payload.option_name) errors.push('option_name is required');
  if (!payload.option_value) errors.push('option_value is required');

  const rejectIfPresent = (field: keyof OptionEntryMappingPayload) => {
    const value = payload[field];
    if (value !== null && value !== false) errors.push(`${field} must be null for ${payload.category_key}`);
  };

  switch (payload.category_key) {
    case 'MATERIAL':
      if (!payload.material_registry_code) errors.push('material_registry_code is required for MATERIAL');
      rejectIfPresent('weight_g');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      rejectIfPresent('notice_code');
      break;
    case 'SIZE':
      if (payload.weight_g === null) errors.push('weight_g is required for SIZE');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      rejectIfPresent('notice_code');
      break;
    case 'COLOR_PLATING':
      if (!payload.combo_code) errors.push('combo_code is required for COLOR_PLATING');
      if (!payload.color_bucket_id) errors.push('color_bucket_id is required for COLOR_PLATING');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('weight_g');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      rejectIfPresent('notice_code');
      break;
    case 'DECOR':
      if (!payload.decor_master_id) errors.push('decor_master_id is required for DECOR');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('weight_g');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      rejectIfPresent('notice_code');
      break;
    case 'ADDON':
      if (!payload.addon_master_id) errors.push('addon_master_id is required for ADDON');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('weight_g');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      rejectIfPresent('notice_code');
      break;
    case 'OTHER':
      if (!payload.other_reason_code) errors.push('other_reason_code is required for OTHER');
      if (payload.explicit_delta_krw === null) errors.push('explicit_delta_krw is required for OTHER');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('weight_g');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('notice_code');
      break;
    case 'NOTICE':
      if (!payload.notice_code) errors.push('notice_code is required for NOTICE');
      rejectIfPresent('material_registry_code');
      rejectIfPresent('weight_g');
      rejectIfPresent('combo_code');
      rejectIfPresent('color_bucket_id');
      rejectIfPresent('decor_master_id');
      rejectIfPresent('addon_master_id');
      rejectIfPresent('other_reason_code');
      rejectIfPresent('explicit_delta_krw');
      break;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
};
