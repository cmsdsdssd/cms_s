import { buildMaterialFactorMap } from "../material-factors.ts";
import { loadEffectiveMarketTicks } from "./effective-market-ticks.js";
import { normalizeMaterialScopeCode } from "./option-labor-rules.ts";
import { rebuildPersistedSizeGridForScope } from "./weight-grid-store.js";

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
