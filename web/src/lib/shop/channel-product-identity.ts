type IdentityInsertInput = {
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string;
  current_product_sync_profile?: 'GENERAL' | 'MARKET_LINKED' | null;
  mapping_source?: 'MANUAL' | 'CSV' | 'AUTO' | string | null;
  is_active?: boolean;
};

export const toChannelProductIdentityInsertRow = (input: IdentityInsertInput) => ({
  channel_id: input.channel_id,
  master_item_id: input.master_item_id,
  external_product_no: input.external_product_no,
  external_variant_code: input.external_variant_code,
  sync_rule_set_id: null,
  option_material_code: null,
  option_color_code: null,
  option_decoration_code: null,
  option_size_value: null,
  option_price_mode: 'SYNC' as const,
  current_product_sync_profile: input.current_product_sync_profile ?? null,
  mapping_source: ((input.mapping_source === 'CSV' || input.mapping_source === 'AUTO') ? input.mapping_source : 'MANUAL') as 'MANUAL' | 'CSV' | 'AUTO',
  is_active: input.is_active !== false,
});

export const toChannelProductIdentityPatch = (input: Record<string, unknown>) => {
  const patch: Record<string, unknown> = {};
  if (input.master_item_id !== undefined) patch.master_item_id = String(input.master_item_id ?? '').trim();
  if (input.external_product_no !== undefined) patch.external_product_no = String(input.external_product_no ?? '').trim();
  if (input.external_variant_code !== undefined) patch.external_variant_code = String(input.external_variant_code ?? '').trim();
  if (input.mapping_source !== undefined) patch.mapping_source = String(input.mapping_source ?? 'MANUAL').trim().toUpperCase();
  if (input.current_product_sync_profile !== undefined) patch.current_product_sync_profile = String(input.current_product_sync_profile ?? '').trim().toUpperCase() || null;
  if (input.is_active !== undefined) patch.is_active = input.is_active === true;
  return patch;
};
