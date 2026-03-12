import {
  DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
  resolveCurrentProductSyncProfileForWrite,
} from './current-product-sync-profile.js';

const trim = (value) => String(value ?? '').trim();

const normalizeOptionPriceMode = (value) =>
  trim(value).toUpperCase() === 'MANUAL' ? 'MANUAL' : 'SYNC';

const isActiveRow = (row) =>
  row?.is_active !== false && trim(row?.channel_id).length > 0 && trim(row?.master_item_id).length > 0;

const isBaseVariantCode = (value) => trim(value).length === 0;

const pairKeyOf = (row) => `${trim(row?.channel_id)}::${trim(row?.master_item_id)}`;

export function planMissingActiveBaseRows(args) {
  const existingActiveRows = (Array.isArray(args?.existingRows) ? args.existingRows : []).filter(isActiveRow);
  const incomingActiveRows = (Array.isArray(args?.incomingRows) ? args.incomingRows : []).filter(isActiveRow);
  const pairKeys = Array.from(new Set(incomingActiveRows.map(pairKeyOf).filter(Boolean)));
  const rows = [];

  for (const pairKey of pairKeys) {
    const [channelId, masterItemId] = pairKey.split('::');
    const scopedExistingRows = existingActiveRows.filter((row) => pairKeyOf(row) === pairKey);
    const scopedIncomingRows = incomingActiveRows.filter((row) => pairKeyOf(row) === pairKey);
    if (scopedIncomingRows.length === 0) continue;

    const existingBaseRows = scopedExistingRows.filter((row) => isBaseVariantCode(row.external_variant_code));
    if (existingBaseRows.length > 1) {
      return {
        ok: false,
        code: 'ACTIVE_BASE_MAPPING_CONFLICT',
        message: '동일 master_item_id에는 활성 base 매핑이 하나만 허용됩니다',
        detail: {
          channel_id: channelId,
          master_item_id: masterItemId,
          external_product_nos: existingBaseRows.map((row) => trim(row.external_product_no)).filter(Boolean),
        },
      };
    }

    if (existingBaseRows.length === 1 || scopedIncomingRows.some((row) => isBaseVariantCode(row.external_variant_code))) {
      continue;
    }

    const scopedRows = [...scopedExistingRows, ...scopedIncomingRows];
    const productNos = Array.from(new Set(scopedRows.map((row) => trim(row.external_product_no)).filter(Boolean)));
    if (productNos.length !== 1) {
      return {
        ok: false,
        code: 'ACTIVE_PRODUCT_NO_CONFLICT',
        message: '동일 master_item_id에는 활성 external_product_no가 하나만 허용됩니다',
        detail: {
          channel_id: channelId,
          master_item_id: masterItemId,
          external_product_nos: productNos,
        },
      };
    }

    const syncRows = scopedRows.filter((row) => normalizeOptionPriceMode(row.option_price_mode) === 'SYNC');
    const syncRuleSetIds = Array.from(new Set(syncRows.map((row) => trim(row.sync_rule_set_id)).filter(Boolean)));
    if (syncRows.length > 0 && syncRuleSetIds.length !== 1) {
      return {
        ok: false,
        code: 'SOT_RULESET_INCONSISTENT',
        message: '동일 master_item_id의 SYNC 매핑은 sync_rule_set_id가 단일값이어야 합니다',
        detail: {
          channel_id: channelId,
          master_item_id: masterItemId,
          sync_rule_set_ids: syncRuleSetIds,
        },
      };
    }

    rows.push({
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: productNos[0],
      external_variant_code: '',
      sync_rule_set_id: syncRuleSetIds[0] ?? null,
      option_material_code: null,
      option_color_code: null,
      option_decoration_code: null,
      option_size_value: null,
      material_multiplier_override: null,
      size_weight_delta_g: null,
      size_price_override_enabled: false,
      size_price_override_krw: null,
      option_price_delta_krw: null,
      option_price_mode: syncRows.length > 0 ? 'SYNC' : 'MANUAL',
      option_manual_target_krw: null,
      include_master_plating_labor: true,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: true,
      sync_rule_plating_enabled: true,
      sync_rule_decoration_enabled: true,
      sync_rule_margin_rounding_enabled: true,
      current_product_sync_profile: resolveCurrentProductSyncProfileForWrite({
        incomingProfile: undefined,
        hasIncomingProfile: false,
        existingRows: scopedRows.map((row) => ({
          current_product_sync_profile: trim(row.current_product_sync_profile) || DEFAULT_CURRENT_PRODUCT_SYNC_PROFILE,
        })),
      }),
      mapping_source: 'AUTO',
      is_active: true,
    });
  }

  return { ok: true, rows };
}
