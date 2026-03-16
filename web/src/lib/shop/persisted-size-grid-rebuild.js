import { buildMaterialFactorMap, normalizeMaterialCode } from "../material-factors.ts";
import { buildSharedSizeGridSeedsFromLegacySources } from "./shared-size-grid-bootstrap.ts";
import { loadEffectiveMarketTicks } from "./effective-market-ticks.js";
import { normalizeMaterialScopeCode } from "./option-labor-rules.ts";
import { rebuildPersistedSizeGridForScope, loadSharedSizeGridRowsForChannel, upsertPersistedSizeGridRows } from "./weight-grid-store.js";

const SIZE_GRID_SCOPE_SELECT = [
  "channel_id",
  "master_item_id",
  "external_product_no",
  "category_key",
  "scope_material_code",
  "is_active",
].join(", ");

const SIZE_GRID_RULE_SELECT = [
  "rule_id",
  "channel_id",
  "master_item_id",
  "external_product_no",
  "category_key",
  "scope_material_code",
  "additional_weight_g",
  "additional_weight_min_g",
  "additional_weight_max_g",
  "size_price_mode",
  "formula_multiplier",
  "formula_offset_krw",
  "rounding_unit_krw",
  "rounding_mode",
  "fixed_delta_krw",
  "additive_delta_krw",
  "is_active",
].join(", ");

const toTrimmed = (value) => String(value ?? "").trim();
const unique = (values) => Array.from(new Set(values));

export const collectAffectedSizeGridScopes = (rows, materialCodes = null) => {
  const normalizedMaterialCodes = new Set(
    unique((materialCodes ?? []).map((code) => normalizeMaterialScopeCode(code)).filter(Boolean)),
  );
  const filterByMaterial = normalizedMaterialCodes.size > 0;
  const seen = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    if (toTrimmed(row.category_key).toUpperCase() !== "SIZE") continue;
    if (row.is_active === false) continue;

    const materialCode = normalizeMaterialScopeCode(row.scope_material_code);
    if (filterByMaterial && (!materialCode || !normalizedMaterialCodes.has(materialCode))) continue;

    const channelId = toTrimmed(row.channel_id);
    const masterItemId = toTrimmed(row.master_item_id);
    const externalProductNo = toTrimmed(row.external_product_no);
    if (!channelId || !masterItemId || !externalProductNo) continue;

    const key = `${channelId}::${masterItemId}::${externalProductNo}`;
    if (seen.has(key)) continue;
    seen.set(key, { channelId, masterItemId, externalProductNo });
  }

  return Array.from(seen.values()).sort((left, right) => {
    const channelCompare = left.channelId.localeCompare(right.channelId);
    if (channelCompare !== 0) return channelCompare;
    const masterCompare = left.masterItemId.localeCompare(right.masterItemId);
    if (masterCompare !== 0) return masterCompare;
    return left.externalProductNo.localeCompare(right.externalProductNo);
  });
};

export const loadSizeGridMarketContext = async (sb) => {
  const [materialFactorRes, effectiveTicks] = await Promise.all([
    sb
      .from("cms_material_factor_config")
      .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis"),
    loadEffectiveMarketTicks(sb),
  ]);
  if (materialFactorRes.error) throw new Error(materialFactorRes.error.message ?? "소재 팩터 조회 실패");

  return {
    goldTickKrwPerG: Math.round(Number(effectiveTicks.goldTickKrwPerG ?? 0)),
    silverTickKrwPerG: Math.round(Number(effectiveTicks.silverTickKrwPerG ?? 0)),
    materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
  };
};

export const syncPersistedSizeGridForScope = async ({
  sb,
  channelId,
  masterItemId,
  externalProductNo,
  marketContext,
}) => {
  const scopeRes = await sb
    .from("channel_option_labor_rule_v1")
    .select(SIZE_GRID_RULE_SELECT)
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("external_product_no", externalProductNo)
    .eq("is_active", true);

  if (scopeRes.error) throw new Error(scopeRes.error.message ?? "사이즈 규칙 조회 실패");

  const scopeRows = scopeRes.data ?? [];
  const hasSizeRules = scopeRows.some((row) => toTrimmed(row.category_key).toUpperCase() === "SIZE");
  if (!hasSizeRules) {
    const deleteRes = await sb
      .from("channel_option_weight_grid_v1")
      .delete()
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("external_product_no", externalProductNo);
    if (deleteRes.error) throw new Error(deleteRes.error.message ?? "사이즈 그리드 삭제 실패");
    return;
  }

  await rebuildPersistedSizeGridForScope({
    sb,
    channelId,
    masterItemId,
    externalProductNo,
    rules: scopeRows,
    marketContext: marketContext ?? await loadSizeGridMarketContext(sb),
  });
};

export const listAffectedSizeGridScopes = async ({ sb, materialCodes = null }) => {
  const normalizedMaterialCodes = unique((materialCodes ?? []).map((code) => normalizeMaterialScopeCode(code)).filter(Boolean));

  let query = sb
    .from("channel_option_labor_rule_v1")
    .select(SIZE_GRID_SCOPE_SELECT)
    .eq("category_key", "SIZE")
    .eq("is_active", true);

  if (normalizedMaterialCodes.length === 1) {
    query = query.eq("scope_material_code", normalizedMaterialCodes[0]);
  } else if (normalizedMaterialCodes.length > 1) {
    query = query.in("scope_material_code", normalizedMaterialCodes);
  }

  const res = await query;
  if (res.error) throw new Error(res.error.message ?? "사이즈 그리드 scope 조회 실패");

  return collectAffectedSizeGridScopes(res.data ?? [], normalizedMaterialCodes);
};

export const rebuildAffectedSizeGridsForSourceChange = async ({ sb, materialCodes = null }) => {
  const scopes = await listAffectedSizeGridScopes({ sb, materialCodes });
  if (scopes.length === 0) return { scopes, rebuiltCount: 0 };

  const marketContext = await loadSizeGridMarketContext(sb);
  for (const scope of scopes) {
    await syncPersistedSizeGridForScope({
      sb,
      channelId: scope.channelId,
      masterItemId: scope.masterItemId,
      externalProductNo: scope.externalProductNo,
      marketContext,
    });
  }

  return { scopes, rebuiltCount: scopes.length };
};


export const ensureSharedSizeGridRowsForChannel = async ({ sb, channelId }) => {
  let sharedRows = await loadSharedSizeGridRowsForChannel({ sb, channelId });
  if (sharedRows.length > 0) return sharedRows;

  await rebuildAffectedSizeGridsForSourceChange({ sb, materialCodes: null });
  sharedRows = await loadSharedSizeGridRowsForChannel({ sb, channelId });
  if (sharedRows.length > 0) return sharedRows;

  const [legacyMappingRes, masterRes, publishSizeRes] = await Promise.all([
    sb.from('sales_channel_product').select('master_item_id, external_product_no, option_size_value').eq('channel_id', channelId).eq('is_active', true).not('option_size_value', 'is', null),
    sb.from('cms_master_item').select('master_item_id, material_code_default'),
    sb.from('product_price_publish_option_entry_v1').select('master_item_id, external_product_no, option_name, published_delta_krw').eq('channel_id', channelId),
  ]);
  if (legacyMappingRes.error) throw new Error(legacyMappingRes.error.message ?? 'legacy size mapping lookup failed');
  if (masterRes.error) throw new Error(masterRes.error.message ?? 'master material lookup failed');
  if (publishSizeRes.error) throw new Error(publishSizeRes.error.message ?? 'publish size lookup failed');

  const masterMaterialById = new Map((masterRes.data ?? []).map((row) => [String(row.master_item_id ?? '').trim(), normalizeMaterialCode(String(row.material_code_default ?? ''))]));
  const weightsByMaster = new Map();
  const productNoByMaster = new Map();
  for (const row of (legacyMappingRes.data ?? [])) {
    const masterItemId = String(row.master_item_id ?? '').trim();
    const externalProductNo = String(row.external_product_no ?? '').trim();
    const weight = Number(row.option_size_value ?? Number.NaN);
    if (!masterItemId || !externalProductNo || !Number.isFinite(weight)) continue;
    const bucket = weightsByMaster.get(masterItemId) ?? [];
    bucket.push(weight);
    weightsByMaster.set(masterItemId, bucket);
    if (!productNoByMaster.has(masterItemId)) productNoByMaster.set(masterItemId, externalProductNo);
  }
  const deltasByMaster = new Map();
  for (const row of (publishSizeRes.data ?? [])) {
    if (String(row.option_name ?? '').trim() !== '사이즈') continue;
    const masterItemId = String(row.master_item_id ?? '').trim();
    const delta = Number(row.published_delta_krw ?? Number.NaN);
    if (!masterItemId || !Number.isFinite(delta)) continue;
    const bucket = deltasByMaster.get(masterItemId) ?? [];
    bucket.push(delta);
    deltasByMaster.set(masterItemId, bucket);
  }

  const bootstrapRows = Array.from(weightsByMaster.keys()).flatMap((masterItemId) => {
    const materialCode = masterMaterialById.get(masterItemId) ?? '';
    const externalProductNo = productNoByMaster.get(masterItemId) ?? '';
    const weights = weightsByMaster.get(masterItemId) ?? [];
    const deltas = deltasByMaster.get(masterItemId) ?? [];
    if (!materialCode || !externalProductNo || weights.length === 0 || deltas.length === 0) return [];
    return buildSharedSizeGridSeedsFromLegacySources({
      channelId,
      masterItemId,
      externalProductNo,
      materialCode,
      weights,
      deltas,
    });
  });

  if (bootstrapRows.length > 0) {
    await upsertPersistedSizeGridRows({ sb, rows: bootstrapRows });
  }

  sharedRows = await loadSharedSizeGridRowsForChannel({ sb, channelId });
  return sharedRows;
};
