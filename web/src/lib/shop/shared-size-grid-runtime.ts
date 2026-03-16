import { buildMaterialFactorMap } from '@/lib/material-factors';
import { loadEffectiveMarketTicks } from '@/lib/shop/effective-market-ticks.js';
import { loadSharedSizeGridRowsForChannel, rebuildPersistedSizeGridForScope } from '@/lib/shop/weight-grid-store.js';
import { buildDefaultSizeRuleSeeds } from '@/lib/shop/shared-size-grid-seed';

type SizeRuleRow = {
  channel_id?: string | null;
  master_item_id?: string | null;
  external_product_no?: string | null;
  category_key?: string | null;
  scope_material_code?: string | null;
  additional_weight_g?: number | null;
  additional_weight_min_g?: number | null;
  additional_weight_max_g?: number | null;
  size_price_mode?: string | null;
  formula_multiplier?: number | null;
  formula_offset_krw?: number | null;
  rounding_unit_krw?: number | null;
  rounding_mode?: string | null;
  fixed_delta_krw?: number | null;
  additive_delta_krw?: number | null;
  is_active?: boolean | null;
};

export const ensureSharedSizeGridRowsForChannel = async ({ sb, channelId }: { sb: any; channelId: string }) => {
  let sharedRows = await loadSharedSizeGridRowsForChannel({ sb, channelId });
  if (sharedRows.length > 0) return sharedRows;

  const sizeRuleRes = await sb
    .from('channel_option_labor_rule_v1')
    .select('channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, size_price_mode, formula_multiplier, formula_offset_krw, rounding_unit_krw, rounding_mode, fixed_delta_krw, additive_delta_krw, is_active')
    .eq('channel_id', channelId)
    .eq('category_key', 'SIZE')
    .eq('is_active', true);
  if (sizeRuleRes.error) throw new Error(sizeRuleRes.error.message ?? 'size rule lookup failed');

  let scopeRows = (sizeRuleRes.data ?? []) as SizeRuleRow[];
  if (scopeRows.length === 0) {
    const [materialsRes, mappingRes] = await Promise.all([
      sb.from('channel_option_material_registry_v1').select('material_code').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }),
      sb.from('sales_channel_product').select('master_item_id, external_product_no').eq('channel_id', channelId).eq('is_active', true).order('updated_at', { ascending: false }).limit(1),
    ]);
    if (materialsRes.error) throw new Error(materialsRes.error.message ?? 'material registry lookup failed');
    if (mappingRes.error) throw new Error(mappingRes.error.message ?? 'active mapping lookup failed');
    const first = (mappingRes.data ?? [])[0] ?? null;
    if (!first) return [];
    const generatedRules = buildDefaultSizeRuleSeeds({
      channelId,
      masterItemId: String(first.master_item_id ?? '').trim(),
      externalProductNo: String(first.external_product_no ?? '').trim(),
      materials: (materialsRes.data ?? []).map((row: { material_code?: string | null }) => String(row.material_code ?? '').trim()),
    });
    const insertRes = await sb.from('channel_option_labor_rule_v1').insert(generatedRules);
    if (insertRes.error) throw new Error(insertRes.error.message ?? 'default size rule insert failed');
    const refetchRulesRes = await sb
      .from('channel_option_labor_rule_v1')
      .select('channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, size_price_mode, formula_multiplier, formula_offset_krw, rounding_unit_krw, rounding_mode, fixed_delta_krw, additive_delta_krw, is_active')
      .eq('channel_id', channelId)
      .eq('category_key', 'SIZE')
      .eq('is_active', true);
    if (refetchRulesRes.error) throw new Error(refetchRulesRes.error.message ?? 'refetch size rule lookup failed');
    scopeRows = (refetchRulesRes.data ?? []) as SizeRuleRow[];
  }

  const [materialFactorRes, effectiveTicks] = await Promise.all([
    sb.from('cms_material_factor_config').select('material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis'),
    loadEffectiveMarketTicks(sb),
  ]);
  if (materialFactorRes.error) throw new Error(materialFactorRes.error.message ?? 'material factor lookup failed');

  const marketContext = {
    goldTickKrwPerG: Math.round(Number(effectiveTicks.goldTickKrwPerG ?? 0)),
    silverTickKrwPerG: Math.round(Number(effectiveTicks.silverTickKrwPerG ?? 0)),
    materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
  };
  const scopeKeys: string[] = Array.from(new Set(scopeRows
    .map((row) => `${String(row.master_item_id ?? '').trim()}::${String(row.external_product_no ?? '').trim()}`)
    .filter((key) => key.length > 2 && !key.endsWith('::'))));

  for (const scopeKey of scopeKeys) {
    const [masterItemId, externalProductNo] = scopeKey.split('::');
    if (!masterItemId || !externalProductNo) continue;
    await rebuildPersistedSizeGridForScope({
      sb,
      channelId,
      masterItemId,
      externalProductNo,
      rules: scopeRows,
      marketContext,
    });
  }

  sharedRows = await loadSharedSizeGridRowsForChannel({ sb, channelId });
  return sharedRows;
};
