import { NextResponse } from "next/server";
import {
  normalizeAdditionalWeightValue,
  normalizeKrwInteger,
  normalizeMaterialScopeCode,
  normalizeOptionLaborColorCode,
  normalizeOptionLaborRuleCategory,
} from "@/lib/shop/option-labor-rules";
import { PLATING_PREFIX, buildPlatingComboChoices, getPlatingComboSortOrder, isPlatingComboCode } from "@/lib/shop/sync-rules";
import { getShopAdminClient, isMissingSchemaObjectError, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { buildMaterialFactorMap } from "@/lib/material-factors";
import { rebuildPersistedSizeGridForScope } from "@/lib/shop/weight-grid-store.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CategoryKey = "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER";
type AbsorbBucket = "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
type AbsorbLaborClass = "GENERAL" | "MATERIAL";

type MasterRow = {
  master_item_id: string;
  model_name: string | null;
  labor_base_cost: number | null;
  labor_center_cost: number | null;
  labor_sub1_cost: number | null;
  labor_sub2_cost: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
  plating_price_cost_default: number | null;
};

type AbsorbRow = {
  master_id: string;
  bucket: AbsorbBucket;
  reason: string;
  amount_krw: number;
  is_active: boolean;
  note: string | null;
  labor_class?: AbsorbLaborClass | null;
  material_qty_per_unit?: number | null;
};

const INTEGER_MIN_KRW = -1_000_000;
const INTEGER_MAX_KRW = 1_000_000;
const ABSORB_STONE_ROLE_PREFIX = "STONE_ROLE:";
const LEGACY_BOM_AUTO_REASON = "BOM_AUTO_TOTAL";
const ACCESSORY_BASE_REASON = "ACCESSORY_LABOR";
const ACCESSORY_ETC_REASON_KEYWORD = "부속공임";
const BOM_DECOR_NOTE_PREFIX = "BOM_DECOR_LINE:";
const BOM_MATERIAL_NOTE_PREFIX = "BOM_MATERIAL_LINE:";
const BOM_DECOR_REASON_PREFIX = "장식:";
const BOM_MATERIAL_REASON_PREFIX = "기타-소재:";
const ABSORB_AUTO_EXCLUDED_REASONS = new Set([LEGACY_BOM_AUTO_REASON, ACCESSORY_BASE_REASON]);

const RULE_SELECT = [
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
  "plating_enabled",
  "color_code",
  "decoration_master_id",
  "decoration_model_name",
  "base_labor_cost_krw",
  "additive_delta_krw",
  "is_active",
  "note",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
].join(", ");

const resolveCanonicalExternalProductNo = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  masterItemId: string,
  requestedExternalProductNo: string,
): Promise<string> => {
  const requested = String(requestedExternalProductNo ?? "").trim();
  if (!requested || !masterItemId) return requested;

  const aliasRes = await sb
    .from("sales_channel_product")
    .select("external_product_no")
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (aliasRes.error) throw new Error(aliasRes.error.message ?? "활성 별칭 매핑 조회 실패");

  const activeProductNos = Array.from(
    new Set((aliasRes.data ?? []).map((row) => String(row.external_product_no ?? "").trim()).filter(Boolean)),
  );
  if (activeProductNos.length === 0) return requested;
  if (activeProductNos.includes(requested)) return requested;
  return activeProductNos.find((value) => /^P/i.test(value)) ?? activeProductNos[0] ?? requested;
};

const isValidMoney = (value: number) =>
  Number.isFinite(value) && value >= INTEGER_MIN_KRW && value <= INTEGER_MAX_KRW;

const normalizeNote = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const toUpper = (value: unknown): string => toTrimmed(value).toUpperCase();
const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const shouldExcludeEtcAbsorbItem = (item: AbsorbRow): boolean => {
  const normalizedReason = toUpper(item.reason);
  if (ABSORB_AUTO_EXCLUDED_REASONS.has(normalizedReason)) return true;
  if (item.bucket !== "ETC") return false;
  const rawReason = toTrimmed(item.reason);
  const rawNote = toTrimmed(item.note);
  if (rawNote.startsWith(BOM_DECOR_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_DECOR_REASON_PREFIX)) return true;
  if (rawNote.startsWith(BOM_MATERIAL_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_MATERIAL_REASON_PREFIX)) return true;
  return rawReason.includes(ACCESSORY_ETC_REASON_KEYWORD);
};

const parseAbsorbStoneRole = (note: string | null | undefined): "CENTER" | "SUB1" | "SUB2" | null => {
  const text = toUpper(note);
  if (!text.startsWith(ABSORB_STONE_ROLE_PREFIX)) return null;
  const value = text.slice(ABSORB_STONE_ROLE_PREFIX.length);
  if (value === "CENTER" || value === "SUB1" || value === "SUB2") return value;
  return null;
};

const isMaterialAbsorbItem = (item: AbsorbRow): boolean => item.bucket === "ETC" && toUpper(item.labor_class ?? "GENERAL") === "MATERIAL";

const computeMasterLaborCostPerUnit = (masterRow: MasterRow | null | undefined, absorbItems: AbsorbRow[]): number => {
  if (!masterRow) return 0;
  const centerQty = Math.max(toNum(masterRow.center_qty_default), 0);
  const sub1Qty = Math.max(toNum(masterRow.sub1_qty_default), 0);
  const sub2Qty = Math.max(toNum(masterRow.sub2_qty_default), 0);

  const baseCost =
    toNum(masterRow.labor_base_cost)
    + toNum(masterRow.labor_center_cost) * centerQty
    + toNum(masterRow.labor_sub1_cost) * sub1Qty
    + toNum(masterRow.labor_sub2_cost) * sub2Qty
    + toNum(masterRow.plating_price_cost_default);

  let baseLaborUnit = 0;
  let stoneCenterUnit = 0;
  let stoneSub1Unit = 0;
  let stoneSub2Unit = 0;
  let platingUnit = 0;
  let etc = 0;

  const activeAbsorbItems = absorbItems.filter((item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item));
  for (const item of activeAbsorbItems) {
    const amount = toNum(item.amount_krw);
    if (!amount) continue;
    const role = parseAbsorbStoneRole(item.note);
    let applied = amount;

    if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") applied = amount * Math.max(sub1Qty, 1);
      else if (role === "SUB2") applied = amount * Math.max(sub2Qty, 1);
      else applied = amount * Math.max(centerQty, 1);
    }

    if (item.bucket === "BASE_LABOR") {
      baseLaborUnit += amount;
      continue;
    }
    if (item.bucket === "STONE_LABOR") {
      if (role === "SUB1") stoneSub1Unit += amount;
      else if (role === "SUB2") stoneSub2Unit += amount;
      else stoneCenterUnit += amount;
      continue;
    }
    if (item.bucket === "PLATING") {
      platingUnit += amount;
      continue;
    }
    if (isMaterialAbsorbItem(item)) {
      const qtyPerUnit = Math.max(toNum(item.material_qty_per_unit), 0);
      etc += applied * qtyPerUnit;
      continue;
    }
    etc += applied;
  }

  const absorbCost =
    baseLaborUnit
    + stoneCenterUnit * centerQty
    + stoneSub1Unit * sub1Qty
    + stoneSub2Unit * sub2Qty
    + platingUnit
    + etc;

  return baseCost + absorbCost;
};

const resolveDecorMasterCost = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  row: Record<string, unknown>,
  rowIndex: number,
): Promise<{ decorationMasterId: string; decorationModelName: string | null; baseLaborCostKrw: number } | Response> => {
  const decorationMasterId = toTrimmed(row.decoration_master_id);
  const decorationModelName = toTrimmed(row.decoration_model_name);

  let masterQuery = sb
    .from("cms_master_item")
    .select("master_item_id, model_name, labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_cost_default")
    .limit(2);

  if (decorationMasterId) masterQuery = masterQuery.eq("master_item_id", decorationMasterId);
  else if (decorationModelName) masterQuery = masterQuery.eq("model_name", decorationModelName);
  else return jsonError(`rows[${rowIndex}] requires decoration_master_id or decoration_model_name`, 400);

  const masterRes = await masterQuery;
  if (masterRes.error) return jsonError(masterRes.error.message ?? "장식 마스터 조회 실패", 500);

  const masters = (masterRes.data ?? []) as MasterRow[];
  if (masters.length === 0) {
    return jsonError(`rows[${rowIndex}] decoration master not found`, 400);
  }
  if (!decorationMasterId && masters.length > 1) {
    return jsonError(`rows[${rowIndex}] decoration_model_name is ambiguous`, 400);
  }

  const master = masters[0];
  const resolvedMasterId = toTrimmed(master.master_item_id);
  const absorbRes = await sb
    .from("cms_master_absorb_labor_item_v1")
    .select("master_id, bucket, reason, amount_krw, is_active, note, labor_class, material_qty_per_unit")
    .eq("master_id", resolvedMasterId)
    .order("priority", { ascending: true });
  if (absorbRes.error) return jsonError(absorbRes.error.message ?? "장식 흡수공임 조회 실패", 500);

  return {
    decorationMasterId: resolvedMasterId,
    decorationModelName: toTrimmed(master.model_name) || null,
    baseLaborCostKrw: Math.round(computeMasterLaborCostPerUnit(master, (absorbRes.data ?? []) as AbsorbRow[])),
  };
};

type SizeGridMarketContext = {
  goldTickKrwPerG: number;
  silverTickKrwPerG: number;
  materialFactors: ReturnType<typeof buildMaterialFactorMap>;
};

const loadSizeGridMarketContext = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
): Promise<SizeGridMarketContext> => {
  const [materialFactorRes, tickRes] = await Promise.all([
    sb
      .from("cms_material_factor_config")
      .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis"),
    sb
      .from("cms_v_market_tick_latest_gold_silver_ops_v1")
      .select("gold_price_krw_per_g, silver_price_krw_per_g")
      .maybeSingle(),
  ]);
  if (materialFactorRes.error) throw new Error(materialFactorRes.error.message ?? "소재 팩터 조회 실패");
  if (tickRes.error) throw new Error(tickRes.error.message ?? "시세 조회 실패");
  return {
    goldTickKrwPerG: Math.round(Number(tickRes.data?.gold_price_krw_per_g ?? 0)),
    silverTickKrwPerG: Math.round(Number(tickRes.data?.silver_price_krw_per_g ?? 0)),
    materialFactors: buildMaterialFactorMap(materialFactorRes.data ?? []),
  };
};

const syncPersistedSizeGridForScope = async ({
  sb,
  channelId,
  masterItemId,
  externalProductNo,
}: {
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>;
  channelId: string;
  masterItemId: string;
  externalProductNo: string;
}): Promise<void> => {
  const scopeRes = await sb
    .from("channel_option_labor_rule_v1")
    .select(RULE_SELECT)
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("external_product_no", externalProductNo)
    .eq("is_active", true);
  if (scopeRes.error) throw new Error(scopeRes.error.message ?? "사이즈 규칙 조회 실패");
  const scopeRows = ((scopeRes.data ?? []) as unknown) as Array<Record<string, unknown>>;
  const hasSizeRules = scopeRows.some((row) => String(row.category_key ?? "").trim().toUpperCase() === "SIZE");
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
  const marketContext = await loadSizeGridMarketContext(sb);
  await rebuildPersistedSizeGridForScope({
    sb,
    channelId,
    masterItemId,
    externalProductNo,
    rules: scopeRows,
    marketContext,
  });
};

const readActor = (request: Request, body: Record<string, unknown>): string => {
  const fromHeaders = String(
    request.headers.get("x-user-email")
      ?? request.headers.get("x-user-id")
      ?? request.headers.get("x-user")
      ?? "",
  ).trim();
  return fromHeaders || String(body.actor ?? "SYSTEM").trim() || "SYSTEM";
};

const readRequiredBoolean = (value: unknown, fieldName: string, rowIndex: number): boolean | Response => {
  if (typeof value === "boolean") return value;
  return jsonError(`rows[${rowIndex}].${fieldName} must be boolean`, 400);
};

const buildRuleDedupKey = (row: {
  category_key: CategoryKey;
  scope_material_code: string | null;
  additional_weight_g: string | null;
  additional_weight_min_g?: string | null;
  additional_weight_max_g?: string | null;
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  note?: string | null;
}): string => {
  switch (row.category_key) {
    case "MATERIAL":
      return row.category_key;
    case "SIZE":
      return [
        row.category_key,
        row.scope_material_code ?? "",
        row.additional_weight_min_g ?? row.additional_weight_g ?? "",
        row.additional_weight_max_g ?? row.additional_weight_g ?? "",
      ].join("::");
    case "COLOR_PLATING":
      return [
        row.category_key,
        row.scope_material_code ?? "",
        row.plating_enabled === true ? "1" : "0",
        row.color_code ?? "",
      ].join("::");
    case "DECOR":
      return [
        row.category_key,
        row.decoration_master_id ? `id:${row.decoration_master_id}` : `name:${String(row.decoration_model_name ?? "").toLowerCase()}`,
      ].join("::");
    case "OTHER":
      return [row.category_key, String(row.note ?? "").toLowerCase()].join("::");
  }
};

const ensureColorComboExists = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  channelId: string,
  colorCode: string,
  rowIndex: number,
): Promise<null | Response> => {
  const normalizedColorCode = normalizeOptionLaborColorCode(colorCode);
  if (!normalizedColorCode) return jsonError(`rows[${rowIndex}].color_code is required`, 400);
  const comboRes = await sb
    .from("channel_color_combo_catalog_v1")
    .select("combo_key, display_name, base_delta_krw, sort_order")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .limit(5000);
  if (comboRes.error) {
    if (isMissingSchemaObjectError(comboRes.error, "channel_color_combo_catalog_v1")) return null;
    return jsonError(comboRes.error.message ?? "색상 조합 중앙목록 조회 실패", 500);
  }
  const allowedColorCodes = new Set(
    buildPlatingComboChoices({
      catalogRows: (comboRes.data ?? []) as Array<{ combo_key?: string | null; display_name?: string | null; base_delta_krw?: number | null; sort_order?: number | null }>,
      includeStandard: false,
    }).map((choice) => choice.value),
  );
  if (allowedColorCodes.has(normalizedColorCode)) {
    return null;
  }
  const standardChoices = new Set(
    buildPlatingComboChoices({
      catalogRows: [],
      includeStandard: true,
    }).map((choice) => choice.value),
  );
  if (!standardChoices.has(normalizedColorCode)) {
    return jsonError(`rows[${rowIndex}].color_code must exist in channel color combo catalog`, 400);
  }
  const componentCodes = normalizedColorCode.replace(/^\[도\]\s*/u, "").split("+").filter(Boolean);
  const platingEnabled = normalizedColorCode.startsWith(`${PLATING_PREFIX} `);
  const upsertRes = await sb
    .from("channel_color_combo_catalog_v1")
    .upsert({
      channel_id: channelId,
      combo_key: normalizedColorCode,
      component_codes: componentCodes,
      plating_enabled: platingEnabled,
      display_name: normalizedColorCode,
      base_delta_krw: 0,
      sort_order: getPlatingComboSortOrder(normalizedColorCode),
      is_active: true,
      created_by: "OPTION_LABOR_RULE_AUTO_SEED",
      updated_by: "OPTION_LABOR_RULE_AUTO_SEED",
    }, { onConflict: "channel_id,combo_key" })
    .select("combo_id")
    .maybeSingle();
  if (upsertRes.error) {
    return jsonError(upsertRes.error.message ?? "색상 조합 중앙목록 자동 보정 실패", 500);
  }
  if (!upsertRes.data?.combo_id) {
    return jsonError(`rows[${rowIndex}].color_code must exist in channel color combo catalog`, 400);
  }
  return null;
};

type RuleDedupRow = {
  category_key: CategoryKey;
  scope_material_code: string | null;
  additional_weight_g: string | null;
  additional_weight_min_g?: string | null;
  additional_weight_max_g?: string | null;
  plating_enabled: boolean | null;
  color_code: string | null;
  decoration_master_id: string | null;
  decoration_model_name: string | null;
  base_labor_cost_krw?: number | null;
  additive_delta_krw?: number | null;
  note?: string | null;
  [key: string]: unknown;
};

const validateAndNormalizeRuleRow = (
  input: Record<string, unknown>,
  rowIndex: number,
): Record<string, unknown> | Response => {
  const categoryKey = normalizeOptionLaborRuleCategory(input.category_key) as CategoryKey | null;
  if (!categoryKey) return jsonError(`rows[${rowIndex}].category_key is invalid`, 400);

  const scopeMaterialCode = normalizeMaterialScopeCode(input.scope_material_code);
  const additionalWeightValue = normalizeAdditionalWeightValue(input.additional_weight_g);
  const additionalWeightMinValue = normalizeAdditionalWeightValue(input.additional_weight_min_g);
  const additionalWeightMaxValue = normalizeAdditionalWeightValue(input.additional_weight_max_g);
  const colorCode = normalizeOptionLaborColorCode(input.color_code);
  const sizePriceMode = categoryKey === "SIZE" ? "MARKET_LINKED" : null;
  const formulaMultiplier = Number.isFinite(Number(input.formula_multiplier)) && Number(input.formula_multiplier) > 0 ? Number(input.formula_multiplier) : 1;
  const formulaOffsetKrw = normalizeKrwInteger(input.formula_offset_krw, 0);
  const roundingUnitKrw = Math.max(1, normalizeKrwInteger(input.rounding_unit_krw, 100));
  const roundingModeRaw = String(input.rounding_mode ?? "UP").trim().toUpperCase();
  const roundingMode = roundingModeRaw === "DOWN" || roundingModeRaw === "FLOOR" ? "DOWN" : roundingModeRaw === "NEAREST" || roundingModeRaw === "ROUND" ? "NEAREST" : "UP";
  const fixedDelta = null;
  const decorationMasterId = String(input.decoration_master_id ?? "").trim() || null;
  const decorationModelName = String(input.decoration_model_name ?? "").trim() || null;
  const note = normalizeNote(input.note);
  const baseLaborCost = normalizeKrwInteger(input.base_labor_cost_krw, 0);
  const additiveDelta = normalizeKrwInteger(input.additive_delta_krw, 0);
  const isActive = input.is_active !== false;

  if (!isValidMoney(baseLaborCost)) return jsonError(`rows[${rowIndex}].base_labor_cost_krw is invalid`, 400);
  if (!isValidMoney(additiveDelta)) return jsonError(`rows[${rowIndex}].additive_delta_krw is invalid`, 400);

  if (categoryKey === "MATERIAL") {
    if (scopeMaterialCode || additionalWeightValue || additionalWeightMinValue || additionalWeightMaxValue || input.plating_enabled != null || colorCode || decorationMasterId || decorationModelName) {
      return jsonError(`rows[${rowIndex}] has invalid MATERIAL shape`, 400);
    }
    if (baseLaborCost !== 0 || additiveDelta !== 0) {
      return jsonError(`rows[${rowIndex}] has invalid MATERIAL costs`, 400);
    }
  }

  if (categoryKey === "SIZE") {
    if (!scopeMaterialCode) return jsonError(`rows[${rowIndex}].scope_material_code is required`, 400);
    const effectiveMin = additionalWeightMinValue ?? additionalWeightValue;
    const effectiveMax = additionalWeightMaxValue ?? additionalWeightValue;
    if (!effectiveMin || !effectiveMax) {
      return jsonError(`rows[${rowIndex}].additional_weight_min_g/additional_weight_max_g is invalid`, 400);
    }
    if (Number(effectiveMin) < 0.01 || Number(effectiveMax) < 0.01) {
      return jsonError(`rows[${rowIndex}] SIZE range must be 0.01g or greater`, 400);
    }
    if (Number(effectiveMin) > Number(effectiveMax)) {
      return jsonError(`rows[${rowIndex}] has invalid SIZE range`, 400);
    }
    if (input.plating_enabled != null || colorCode || decorationMasterId || decorationModelName) {
      return jsonError(`rows[${rowIndex}] has invalid SIZE shape`, 400);
    }
    if (baseLaborCost !== 0) return jsonError(`rows[${rowIndex}].base_labor_cost_krw must be 0 for SIZE`, 400);
    if (sizePriceMode === "MARKET_LINKED" && formulaMultiplier <= 0) return jsonError(`rows[${rowIndex}].formula_multiplier must be > 0`, 400);
  }

  let platingEnabled: boolean | null = null;
  if (categoryKey === "COLOR_PLATING") {
    const parsedBoolean = readRequiredBoolean(input.plating_enabled, "plating_enabled", rowIndex);
    if (parsedBoolean instanceof Response) return parsedBoolean;
    platingEnabled = parsedBoolean;
    if (!scopeMaterialCode) {
      return jsonError(`rows[${rowIndex}].scope_material_code is required`, 400);
    }
    if (!colorCode) {
      return jsonError(`rows[${rowIndex}].color_code is required`, 400);
    }
    if (additionalWeightValue || additionalWeightMinValue || additionalWeightMaxValue || decorationMasterId || decorationModelName) {
      return jsonError(`rows[${rowIndex}] has invalid COLOR_PLATING shape`, 400);
    }
    if (baseLaborCost !== 0) {
      return jsonError(`rows[${rowIndex}].base_labor_cost_krw must be 0 for COLOR_PLATING`, 400);
    }
  }

  if (categoryKey === "DECOR") {
    if (!decorationMasterId && !decorationModelName) {
      return jsonError(`rows[${rowIndex}] requires decoration_master_id or decoration_model_name`, 400);
    }
    if (scopeMaterialCode || additionalWeightValue || additionalWeightMinValue || additionalWeightMaxValue || input.plating_enabled != null || colorCode) {
      return jsonError(`rows[${rowIndex}] has invalid DECOR shape`, 400);
    }
    if (baseLaborCost < 0) return jsonError(`rows[${rowIndex}].base_labor_cost_krw is invalid`, 400);
  }

  if (categoryKey === "OTHER") {
    if (scopeMaterialCode || additionalWeightValue || additionalWeightMinValue || additionalWeightMaxValue || input.plating_enabled != null || colorCode || decorationMasterId || decorationModelName) {
      return jsonError(`rows[${rowIndex}] has invalid OTHER shape`, 400);
    }
    if (baseLaborCost !== 0) return jsonError(`rows[${rowIndex}].base_labor_cost_krw must be 0 for OTHER`, 400);
    if (!note) return jsonError(`rows[${rowIndex}].note is required for OTHER`, 400);
  }

  return {
    category_key: categoryKey,
    scope_material_code: categoryKey === "SIZE" || categoryKey === "COLOR_PLATING" ? scopeMaterialCode : null,
    additional_weight_g: categoryKey === "SIZE" ? (additionalWeightValue ?? additionalWeightMinValue ?? additionalWeightMaxValue) : null,
    additional_weight_min_g: categoryKey === "SIZE" ? (additionalWeightMinValue ?? additionalWeightValue) : null,
    additional_weight_max_g: categoryKey === "SIZE" ? (additionalWeightMaxValue ?? additionalWeightValue) : null,
    plating_enabled: categoryKey === "COLOR_PLATING" ? platingEnabled : null,
    color_code: categoryKey === "COLOR_PLATING" ? colorCode : null,
    decoration_master_id: categoryKey === "DECOR" ? decorationMasterId : null,
    decoration_model_name: categoryKey === "DECOR" ? decorationModelName : null,
    base_labor_cost_krw: baseLaborCost,
    additive_delta_krw: categoryKey === "SIZE" ? 0 : additiveDelta,
    size_price_mode: categoryKey === "SIZE" ? sizePriceMode : null,
    formula_multiplier: categoryKey === "SIZE" ? formulaMultiplier : null,
    formula_offset_krw: categoryKey === "SIZE" ? formulaOffsetKrw : null,
    rounding_unit_krw: categoryKey === "SIZE" ? roundingUnitKrw : null,
    rounding_mode: categoryKey === "SIZE" ? roundingMode : null,
    fixed_delta_krw: categoryKey === "SIZE" ? fixedDelta : null,
    is_active: isActive,
    note,
  };
};

const hydrateServerManagedRuleFields = async (
  sb: NonNullable<ReturnType<typeof getShopAdminClient>>,
  row: Record<string, unknown>,
  rowIndex: number,
): Promise<Record<string, unknown> | Response> => {
  if (row.category_key !== "DECOR") return row;
  const resolved = await resolveDecorMasterCost(sb, row, rowIndex);
  if (resolved instanceof Response) return resolved;
  return {
    ...row,
    decoration_master_id: resolved.decorationMasterId,
    decoration_model_name: resolved.decorationModelName,
    base_labor_cost_krw: resolved.baseLaborCostKrw,
  };
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get("channel_id") ?? "").trim();
  const masterItemId = String(searchParams.get("master_item_id") ?? "").trim();
  let externalProductNo = String(searchParams.get("external_product_no") ?? "").trim();

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId && !externalProductNo) return jsonError("external_product_no is required", 400);

  if (masterItemId && externalProductNo) {
    try {
      externalProductNo = await resolveCanonicalExternalProductNo(sb, channelId, masterItemId, externalProductNo);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "활성 별칭 매핑 조회 실패", 500);
    }
  }

  let query = sb
    .from("channel_option_labor_rule_v1")
    .select(RULE_SELECT)
    .eq("channel_id", channelId)
    .order("category_key", { ascending: true })
    .order("external_product_no", { ascending: true })
    .order("scope_material_code", { ascending: true })
    .order("additional_weight_min_g", { ascending: true })
    .order("additional_weight_max_g", { ascending: true })
    .order("plating_enabled", { ascending: true })
    .order("color_code", { ascending: true })
    .order("decoration_model_name", { ascending: true })
    .order("note", { ascending: true })
    .order("updated_at", { ascending: false });

  if (masterItemId) query = query.eq("master_item_id", masterItemId);
  else query = query.eq("external_product_no", externalProductNo);

  const res = await query;
  if (res.error) return jsonError(res.error.message ?? "옵션 공임 규칙 조회 실패", 500);

  return NextResponse.json({ data: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  let masterItemId = String(body.master_item_id ?? "").trim();
  const externalProductNo = String(body.external_product_no ?? "").trim();
  const actor = readActor(request, body);
  const rowsRaw = body.rows;

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!externalProductNo) return jsonError("external_product_no is required", 400);
  if (!Array.isArray(rowsRaw)) {
    const normalized = validateAndNormalizeRuleRow(body, 0);
    if (normalized instanceof Response) return normalized;
    const serverManaged = await hydrateServerManagedRuleFields(sb, normalized, 0);
    if (serverManaged instanceof Response) return serverManaged;
    if (serverManaged.category_key === "COLOR_PLATING") {
      const comboValidation = await ensureColorComboExists(sb, channelId, String(serverManaged.color_code ?? ""), 0);
      if (comboValidation instanceof Response) return comboValidation;
      serverManaged.plating_enabled = isPlatingComboCode(String(serverManaged.color_code ?? ""));
    }

    const resolvedExternalProductNo = await resolveCanonicalExternalProductNo(
      sb,
      channelId,
      masterItemId,
      externalProductNo,
    );
    const insertRes = await sb
      .from("channel_option_labor_rule_v1")
      .insert({
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: resolvedExternalProductNo,
        ...serverManaged,
        created_by: actor,
        updated_by: actor,
      })
      .select(RULE_SELECT)
      .maybeSingle();
    if (insertRes.error) return jsonError(insertRes.error.message ?? "옵션 공임 규칙 생성 실패", 400);

    if (String(serverManaged.category_key ?? "").trim().toUpperCase() === "SIZE") {
      await syncPersistedSizeGridForScope({
        sb,
        channelId,
        masterItemId,
        externalProductNo: resolvedExternalProductNo,
      });
    }

    return NextResponse.json({ data: insertRes.data }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!masterItemId) {
    const mapRes = await sb
      .from("sales_channel_product")
      .select("master_item_id")
      .eq("channel_id", channelId)
      .eq("external_product_no", externalProductNo)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mapRes.error) return jsonError(mapRes.error.message ?? "master_item_id 추론 실패", 500);
    masterItemId = String(mapRes.data?.master_item_id ?? "").trim();
  }

  if (!masterItemId) {
    const prevRes = await sb
      .from("channel_option_labor_rule_v1")
      .select("master_item_id")
      .eq("channel_id", channelId)
      .eq("external_product_no", externalProductNo)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevRes.error) return jsonError(prevRes.error.message ?? "기존 저장값 기반 master_item_id 추론 실패", 500);
    masterItemId = String(prevRes.data?.master_item_id ?? "").trim();
  }

  if (!masterItemId) return jsonError("master_item_id is required (매핑 없음)", 422);

  let resolvedExternalProductNo = externalProductNo;
  try {
    resolvedExternalProductNo = await resolveCanonicalExternalProductNo(sb, channelId, masterItemId, externalProductNo);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "활성 별칭 매핑 조회 실패", 500);
  }

  const dedup = new Map<string, RuleDedupRow>();
  for (let i = 0; i < rowsRaw.length; i += 1) {
    const row = parseJsonObject(rowsRaw[i]);
    if (!row) return jsonError(`rows[${i}] must be object`, 400);

    const normalized = validateAndNormalizeRuleRow(row, i);
    if (normalized instanceof Response) return normalized;
    const serverManaged = await hydrateServerManagedRuleFields(sb, normalized, i);
    if (serverManaged instanceof Response) return serverManaged;
    if (serverManaged.category_key === "COLOR_PLATING") {
      const comboValidation = await ensureColorComboExists(sb, channelId, String(serverManaged.color_code ?? ""), i);
      if (comboValidation instanceof Response) return comboValidation;
      serverManaged.plating_enabled = isPlatingComboCode(String(serverManaged.color_code ?? ""));
    }

    const insertRow = {
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: resolvedExternalProductNo,
      ...(serverManaged as RuleDedupRow),
      updated_by: actor,
      created_by: actor,
    } satisfies RuleDedupRow;

    dedup.set(buildRuleDedupKey(insertRow), insertRow);
  }

  const deleteRes = await sb
    .from("channel_option_labor_rule_v1")
    .delete()
    .eq("channel_id", channelId)
    .eq("master_item_id", masterItemId)
    .eq("external_product_no", resolvedExternalProductNo);
  if (deleteRes.error) return jsonError(deleteRes.error.message ?? "옵션 공임 규칙 기존값 삭제 실패", 500);

  if (dedup.size === 0) {
    await syncPersistedSizeGridForScope({
      sb,
      channelId,
      masterItemId,
      externalProductNo: resolvedExternalProductNo,
    });
    return NextResponse.json({ ok: true, data: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const insertRes = await sb.from("channel_option_labor_rule_v1").insert(Array.from(dedup.values())).select(RULE_SELECT);
  if (insertRes.error) return jsonError(insertRes.error.message ?? "옵션 공임 규칙 저장 실패", 500);

  await syncPersistedSizeGridForScope({
    sb,
    channelId,
    masterItemId,
    externalProductNo: resolvedExternalProductNo,
  });

  return NextResponse.json({ ok: true, data: insertRes.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleId = String(body.rule_id ?? "").trim();
  if (!ruleId) return jsonError("rule_id is required", 400);

  const existingRes = await sb
    .from("channel_option_labor_rule_v1")
    .select(RULE_SELECT)
    .eq("rule_id", ruleId)
    .maybeSingle();
  if (existingRes.error) return jsonError(existingRes.error.message ?? "기존 옵션 공임 규칙 조회 실패", 500);
  if (!existingRes.data) return jsonError("rule_id not found", 404);

  const merged = { ...(existingRes.data as unknown as Record<string, unknown>), ...body } as Record<string, unknown>;
  const normalized = validateAndNormalizeRuleRow(merged, 0);
  if (normalized instanceof Response) return normalized;
  const serverManaged = await hydrateServerManagedRuleFields(sb, normalized, 0);
  if (serverManaged instanceof Response) return serverManaged;
  if (serverManaged.category_key === "COLOR_PLATING") {
    const comboValidation = await ensureColorComboExists(sb, String(merged.channel_id ?? "").trim(), String(serverManaged.color_code ?? ""), 0);
    if (comboValidation instanceof Response) return comboValidation;
    serverManaged.plating_enabled = isPlatingComboCode(String(serverManaged.color_code ?? ""));
  }

  const actor = readActor(request, body);
  const resolvedExternalProductNo = await resolveCanonicalExternalProductNo(
    sb,
    String(merged.channel_id ?? "").trim(),
    String(merged.master_item_id ?? "").trim(),
    String(merged.external_product_no ?? "").trim(),
  );

  const updateRes = await sb
    .from("channel_option_labor_rule_v1")
    .update({
      channel_id: String(merged.channel_id ?? "").trim(),
      master_item_id: String(merged.master_item_id ?? "").trim(),
      external_product_no: resolvedExternalProductNo,
      ...serverManaged,
      updated_by: actor,
    })
    .eq("rule_id", ruleId)
    .select(RULE_SELECT)
    .maybeSingle();
  if (updateRes.error) return jsonError(updateRes.error.message ?? "옵션 공임 규칙 수정 실패", 400);

  await syncPersistedSizeGridForScope({
    sb,
    channelId: String(merged.channel_id ?? "").trim(),
    masterItemId: String(merged.master_item_id ?? "").trim(),
    externalProductNo: resolvedExternalProductNo,
  });

  return NextResponse.json({ data: updateRes.data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const ruleId = String(body.rule_id ?? "").trim();
  if (!ruleId) return jsonError("rule_id is required", 400);

  const existingRes = await sb
    .from("channel_option_labor_rule_v1")
    .select(RULE_SELECT)
    .eq("rule_id", ruleId)
    .maybeSingle();
  if (existingRes.error) return jsonError(existingRes.error.message ?? "기존 옵션 공임 규칙 조회 실패", 500);
  if (!existingRes.data) return jsonError("rule_id not found", 404);
  const existingRow = (existingRes.data as unknown) as Record<string, unknown>;

  const deleteRes = await sb
    .from("channel_option_labor_rule_v1")
    .delete()
    .eq("rule_id", ruleId)
    .select("rule_id")
    .maybeSingle();
  if (deleteRes.error) return jsonError(deleteRes.error.message ?? "옵션 공임 규칙 삭제 실패", 400);
  if (!deleteRes.data) return jsonError("rule_id not found", 404);

  await syncPersistedSizeGridForScope({
    sb,
    channelId: String(existingRow.channel_id ?? "").trim(),
    masterItemId: String(existingRow.master_item_id ?? "").trim(),
    externalProductNo: String(existingRow.external_product_no ?? "").trim(),
  });

  return NextResponse.json({ ok: true, rule_id: ruleId }, { headers: { "Cache-Control": "no-store" } });
}
