import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject, parseUuidArray } from "@/lib/shop/admin";
import {
  buildMaterialPurityMap,
  getMaterialPurityFromMap,
  isRangeMatched,
  isSilverMaterial,
  normalizePlatingComboCode,
  parseOptionRangeExpr,
  roundByRule,
  toNum,
  type SyncRuleR1Row,
  type SyncRuleR2Row,
  type SyncRuleR3Row,
  type SyncRuleR4Row,
} from "@/lib/shop/sync-rules";
import { normalizeMaterialCode } from "@/lib/material-factors";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const normalizeOptionalMaterialCode = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return normalizeMaterialCode(raw);
};

type MasterRow = {
  master_item_id: string;
  material_code_default: string | null;
  category_code: string | null;
  weight_default_g: number | null;
  deduction_weight_default_g: number | null;
  labor_base_sell: number | null;
  labor_center_sell: number | null;
  labor_sub1_sell: number | null;
  labor_sub2_sell: number | null;
  plating_price_sell_default: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
  model_name: string | null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_variant_code: string | null;
  sync_rule_set_id: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  material_multiplier_override: number | null;
  size_weight_delta_g: number | null;
  option_price_delta_krw: number | null;
  option_price_mode: "SYNC" | "MANUAL" | null;
  option_manual_target_krw: number | null;
  include_master_plating_labor: boolean | null;
  sync_rule_material_enabled: boolean | null;
  sync_rule_weight_enabled: boolean | null;
  sync_rule_plating_enabled: boolean | null;
  sync_rule_decoration_enabled: boolean | null;
  sync_rule_margin_rounding_enabled: boolean | null;
};

type OptionValuePolicyRow = {
  master_item_id: string;
  axis_key: string;
  axis_value: string;
  rule_type: "R1" | "R2" | "R3" | "R4";
  value_mode: "BASE" | "SYNC";
};

type AbsorbBucket = "BASE_LABOR" | "STONE_LABOR" | "PLATING" | "ETC";
type AbsorbLaborClass = "GENERAL" | "MATERIAL";

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

type BomRecipeWorklistRow = {
  bom_id: string;
  product_master_id: string;
  variant_key?: string | null;
};

type BomRecipeLineEnrichedRow = {
  bom_id: string;
  component_ref_type?: "MASTER" | "PART" | null;
  component_master_id?: string | null;
  qty_per_unit?: number | null;
  note?: string | null;
  is_void?: boolean | null;
};

const KNOWN_MATERIAL_CODES = new Set(["14", "18", "24", "925", "999"]);

const normalizeKnownMaterialCode = (value: unknown, fallbackCode: string): string => {
  const normalized = normalizeMaterialCode(String(value ?? ""));
  if (KNOWN_MATERIAL_CODES.has(normalized)) return normalized;
  return fallbackCode;
};

const ABSORB_STONE_ROLE_PREFIX = "STONE_ROLE:";
const LEGACY_BOM_AUTO_REASON = "BOM_AUTO_TOTAL";
const ACCESSORY_BASE_REASON = "ACCESSORY_LABOR";
const ACCESSORY_ETC_REASON_KEYWORD = "부속공임";
const BOM_DECOR_NOTE_PREFIX = "BOM_DECOR_LINE:";
const BOM_MATERIAL_NOTE_PREFIX = "BOM_MATERIAL_LINE:";
const BOM_DECOR_REASON_PREFIX = "장식:";
const BOM_MATERIAL_REASON_PREFIX = "기타-소재:";
const ABSORB_AUTO_EXCLUDED_REASONS = new Set([LEGACY_BOM_AUTO_REASON, ACCESSORY_BASE_REASON]);

const normalizeVariantKey = (value: string | null | undefined): string => String(value ?? "").trim();
const isDecorLine = (note: string | null | undefined): boolean => String(note ?? "").trim().toUpperCase().startsWith("LINE_KIND:DECOR");

const shouldExcludeEtcAbsorbItem = (item: AbsorbRow): boolean => {
  const normalizedReason = String(item.reason ?? "").trim().toUpperCase();
  if (ABSORB_AUTO_EXCLUDED_REASONS.has(normalizedReason)) return true;
  if (item.bucket !== "ETC") return false;
  const rawReason = String(item.reason ?? "").trim();
  const rawNote = String(item.note ?? "").trim();
  if (rawNote.startsWith(BOM_DECOR_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_DECOR_REASON_PREFIX)) return true;
  if (rawNote.startsWith(BOM_MATERIAL_NOTE_PREFIX)) return true;
  if (rawReason.startsWith(BOM_MATERIAL_REASON_PREFIX)) return true;
  return rawReason.includes(ACCESSORY_ETC_REASON_KEYWORD);
};

const parseAbsorbStoneRole = (note: string | null | undefined): "CENTER" | "SUB1" | "SUB2" | null => {
  const text = String(note ?? "").trim().toUpperCase();
  if (!text.startsWith(ABSORB_STONE_ROLE_PREFIX)) return null;
  const value = text.slice(ABSORB_STONE_ROLE_PREFIX.length);
  if (value === "CENTER" || value === "SUB1" || value === "SUB2") return value;
  return null;
};

const isMaterialAbsorbItem = (item: AbsorbRow): boolean => item.bucket === "ETC" && String(item.labor_class ?? "GENERAL").toUpperCase() === "MATERIAL";

const computeMasterLaborSellPerUnit = (
  masterRow: MasterRow | null | undefined,
  absorbItems: AbsorbRow[],
  includePlating: boolean,
): number => {
  if (!masterRow) return 0;
  const centerQty = Math.max(toNum(masterRow.center_qty_default, 0), 0);
  const sub1Qty = Math.max(toNum(masterRow.sub1_qty_default, 0), 0);
  const sub2Qty = Math.max(toNum(masterRow.sub2_qty_default, 0), 0);

  const platingBase = includePlating ? toNum(masterRow.plating_price_sell_default, 0) : 0;
  const baseSell =
    toNum(masterRow.labor_base_sell, 0)
    + toNum(masterRow.labor_center_sell, 0) * centerQty
    + toNum(masterRow.labor_sub1_sell, 0) * sub1Qty
    + toNum(masterRow.labor_sub2_sell, 0) * sub2Qty
    + platingBase;

  let baseLaborUnit = 0;
  let stoneCenterUnit = 0;
  let stoneSub1Unit = 0;
  let stoneSub2Unit = 0;
  let platingUnit = 0;
  let etc = 0;

  const activeAbsorbItems = absorbItems.filter((item) => item.is_active !== false && !shouldExcludeEtcAbsorbItem(item));
  for (const item of activeAbsorbItems) {
    const amount = toNum(item.amount_krw, 0);
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
      if (includePlating) platingUnit += amount;
      continue;
    }
    if (isMaterialAbsorbItem(item)) {
      const qtyPerUnit = Math.max(toNum(item.material_qty_per_unit, 1), 0);
      etc += applied * qtyPerUnit;
      continue;
    }
    etc += applied;
  }

  const absorbSell =
    baseLaborUnit
    + stoneCenterUnit * centerQty
    + stoneSub1Unit * sub1Qty
    + stoneSub2Unit * sub2Qty
    + platingUnit
    + etc;

  return baseSell + absorbSell;
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = String(body.channel_id ?? "").trim();
  const masterItemIds = parseUuidArray(body.master_item_ids);
  const factorSetOverride = typeof body.factor_set_id === "string" ? body.factor_set_id.trim() : null;
  if (!channelId) return jsonError("channel_id is required", 400);

  const policyRes = await sb
    .from("pricing_policy")
    .select("policy_id, margin_multiplier, rounding_unit, rounding_mode, option_18k_weight_multiplier, material_factor_set_id")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (policyRes.error) return jsonError(policyRes.error.message ?? "정책 조회 실패", 500);
  const policy = policyRes.data;
  if (!policy) return jsonError("활성 정책이 없습니다", 422);

  const selectedFactorSetId = factorSetOverride || policy.material_factor_set_id || null;

  const mapQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_variant_code, sync_rule_set_id, option_material_code, option_color_code, option_decoration_code, option_size_value, material_multiplier_override, size_weight_delta_g, option_price_delta_krw, option_price_mode, option_manual_target_krw, include_master_plating_labor, sync_rule_material_enabled, sync_rule_weight_enabled, sync_rule_plating_enabled, sync_rule_decoration_enabled, sync_rule_margin_rounding_enabled")
    .eq("channel_id", channelId)
    .eq("is_active", true);
  if (masterItemIds && masterItemIds.length > 0) mapQuery.in("master_item_id", masterItemIds);

  const mappingRes = await mapQuery;
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "매핑 조회 실패", 500);
  const mappings = (mappingRes.data ?? []) as MappingRow[];
  if (mappings.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: 0, reason: "NO_MAPPINGS" }, { headers: { "Cache-Control": "no-store" } });
  }

  const derivedRuleSetByMaster = new Map<string, string>();
  const ruleSetVotesByMaster = new Map<string, Map<string, number>>();
  for (const row of mappings) {
    const masterId = String(row.master_item_id ?? "").trim();
    const variantCode = String(row.external_variant_code ?? "").trim();
    const ruleSetId = String(row.sync_rule_set_id ?? "").trim();
    if (!masterId || !variantCode || !ruleSetId) continue;
    const voteMap = ruleSetVotesByMaster.get(masterId) ?? new Map<string, number>();
    voteMap.set(ruleSetId, (voteMap.get(ruleSetId) ?? 0) + 1);
    ruleSetVotesByMaster.set(masterId, voteMap);
  }
  for (const [masterId, voteMap] of ruleSetVotesByMaster.entries()) {
    const picked = Array.from(voteMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    if (picked) derivedRuleSetByMaster.set(masterId, picked);
  }

  const uniqueMasterIds = [...new Set(mappings.map((m) => m.master_item_id))];

  const optionPolicyRes = await sb
    .from("channel_option_value_policy")
    .select("master_item_id, axis_key, axis_value, rule_type, value_mode")
    .eq("channel_id", channelId)
    .in("master_item_id", uniqueMasterIds)
    .eq("rule_type", "R1")
    .eq("value_mode", "BASE");
  if (optionPolicyRes.error) return jsonError(optionPolicyRes.error.message ?? "옵션값 정책 조회 실패", 500);
  const r1BaseMaterialByMaster = new Map<string, string>();
  for (const row of (optionPolicyRes.data ?? []) as OptionValuePolicyRow[]) {
    const masterId = String(row.master_item_id ?? "");
    const materialCode = normalizeMaterialCode(String(row.axis_value ?? ""));
    if (!masterId || !KNOWN_MATERIAL_CODES.has(materialCode)) continue;
    if (!r1BaseMaterialByMaster.has(masterId)) r1BaseMaterialByMaster.set(masterId, materialCode);
  }

  const inferredR1BaseMaterialByMaster = new Map<string, string>();
  const mappingsByMaster = new Map<string, MappingRow[]>();
  for (const m of mappings) {
    const key = String(m.master_item_id ?? "");
    if (!key) continue;
    const prev = mappingsByMaster.get(key) ?? [];
    prev.push(m);
    mappingsByMaster.set(key, prev);
  }
  for (const [masterId, group] of mappingsByMaster.entries()) {
    const counts = new Map<string, number>();
    const preferRows = group.filter((m) => String(m.external_variant_code ?? "").trim() && m.sync_rule_material_enabled === false);
    const sourceRows = preferRows.length > 0 ? preferRows : group.filter((m) => String(m.external_variant_code ?? "").trim());
    for (const m of sourceRows) {
      const code = normalizeMaterialCode(String(m.option_material_code ?? ""));
      if (!KNOWN_MATERIAL_CODES.has(code)) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    const inferred = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    if (inferred) inferredR1BaseMaterialByMaster.set(masterId, inferred);
  }

  const masterRes = await sb
    .from("cms_master_item")
    .select("master_item_id, material_code_default, category_code, weight_default_g, deduction_weight_default_g, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, plating_price_sell_default, center_qty_default, sub1_qty_default, sub2_qty_default, model_name")
    .in("master_item_id", uniqueMasterIds);
  if (masterRes.error) return jsonError(masterRes.error.message ?? "마스터 조회 실패", 500);
  const masterMap = new Map((masterRes.data ?? []).map((row) => [String((row as MasterRow).master_item_id), row as MasterRow]));

  const recipeRes = await sb
    .from(CONTRACTS.views.bomRecipeWorklist)
    .select("bom_id, product_master_id, variant_key")
    .in("product_master_id", uniqueMasterIds)
    .order("variant_key", { ascending: true });
  if (recipeRes.error) return jsonError(recipeRes.error.message ?? "BOM 레시피 조회 실패", 500);
  const recipes = (recipeRes.data ?? []) as BomRecipeWorklistRow[];
  const recipesByMaster = new Map<string, BomRecipeWorklistRow[]>();
  for (const row of recipes) {
    const masterId = String(row.product_master_id ?? "").trim();
    if (!masterId) continue;
    const prev = recipesByMaster.get(masterId) ?? [];
    prev.push(row);
    recipesByMaster.set(masterId, prev);
  }

  const selectedRecipeByMaster = new Map<string, BomRecipeWorklistRow>();
  for (const masterId of uniqueMasterIds) {
    const rows = recipesByMaster.get(masterId) ?? [];
    if (rows.length === 0) continue;
    const defaultRow = rows.find((row) => normalizeVariantKey(row.variant_key) === "") ?? rows[0];
    if (defaultRow) selectedRecipeByMaster.set(masterId, defaultRow);
  }

  const selectedBomIds = Array.from(new Set(
    Array.from(selectedRecipeByMaster.values())
      .map((row) => String(row.bom_id ?? "").trim())
      .filter((value) => value.length > 0),
  ));

  const decorLinesByMaster = new Map<string, Array<{ component_master_id: string; qty_per_unit: number }>>();
  let componentMasterMap = new Map<string, MasterRow>();
  const componentMasterIds = new Set<string>();

  if (selectedBomIds.length > 0) {
    const lineRes = await sb
      .from(CONTRACTS.views.bomRecipeLinesEnriched)
      .select("bom_id, component_ref_type, component_master_id, qty_per_unit, note, is_void")
      .in("bom_id", selectedBomIds)
      .eq("is_void", false);
    if (lineRes.error) return jsonError(lineRes.error.message ?? "BOM 라인 조회 실패", 500);

    const masterIdByBomId = new Map<string, string>();
    for (const [masterId, recipe] of selectedRecipeByMaster.entries()) {
      const bomId = String(recipe.bom_id ?? "").trim();
      if (!bomId) continue;
      masterIdByBomId.set(bomId, masterId);
    }

    for (const line of (lineRes.data ?? []) as BomRecipeLineEnrichedRow[]) {
      const bomId = String(line.bom_id ?? "").trim();
      const masterId = masterIdByBomId.get(bomId) ?? "";
      if (!masterId) continue;
      if (!isDecorLine(line.note)) continue;
      if (String(line.component_ref_type ?? "").trim().toUpperCase() !== "MASTER") continue;
      const componentMasterId = String(line.component_master_id ?? "").trim();
      if (!componentMasterId) continue;
      const qtyPerUnit = Math.max(toNum(line.qty_per_unit, 0), 0);
      const prev = decorLinesByMaster.get(masterId) ?? [];
      prev.push({ component_master_id: componentMasterId, qty_per_unit: qtyPerUnit });
      decorLinesByMaster.set(masterId, prev);
      componentMasterIds.add(componentMasterId);
    }
  }

  const allAbsorbMasterIds = Array.from(new Set([...uniqueMasterIds, ...componentMasterIds]));
  let absorbByMasterId = new Map<string, AbsorbRow[]>();
  if (allAbsorbMasterIds.length > 0) {
    const absorbRes = await sb
      .from("cms_master_absorb_labor_item_v1")
      .select("master_id, bucket, reason, amount_krw, is_active, note, labor_class, material_qty_per_unit")
      .in("master_id", allAbsorbMasterIds)
      .order("priority", { ascending: true });
    if (absorbRes.error) return jsonError(absorbRes.error.message ?? "흡수공임 조회 실패", 500);
    for (const row of (absorbRes.data ?? []) as AbsorbRow[]) {
      const masterId = String(row.master_id ?? "").trim();
      if (!masterId) continue;
      const prev = absorbByMasterId.get(masterId) ?? [];
      prev.push(row);
      absorbByMasterId.set(masterId, prev);
    }
  }

  if (componentMasterIds.size > 0) {
    const componentRes = await sb
      .from("cms_master_item")
      .select("master_item_id, material_code_default, category_code, weight_default_g, deduction_weight_default_g, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, plating_price_sell_default, center_qty_default, sub1_qty_default, sub2_qty_default, model_name")
      .in("master_item_id", Array.from(componentMasterIds));
    if (componentRes.error) return jsonError(componentRes.error.message ?? "컴포넌트 마스터 조회 실패", 500);
    componentMasterMap = new Map(
      ((componentRes.data ?? []) as MasterRow[]).map((row) => [String(row.master_item_id ?? ""), row]),
    );
  }

  const tickRes = await sb
    .from("cms_v_market_tick_latest_gold_silver_ops_v1")
    .select("gold_price_krw_per_g, silver_price_krw_per_g")
    .maybeSingle();
  if (tickRes.error) return jsonError(tickRes.error.message ?? "시세 조회 실패", 500);
  const goldTick = toNum(tickRes.data?.gold_price_krw_per_g, 0);
  const silverTick = toNum(tickRes.data?.silver_price_krw_per_g, 0);

  let factorMap = new Map<string, number>();
  if (selectedFactorSetId) {
    const factorRes = await sb
      .from("material_factor")
      .select("material_code, multiplier")
      .eq("factor_set_id", selectedFactorSetId);
    if (factorRes.error) return jsonError(factorRes.error.message ?? "팩터 조회 실패", 500);
    factorMap = new Map((factorRes.data ?? []).map((r) => [String(r.material_code), toNum(r.multiplier, 1)]));
  }

  const purityRes = await sb
    .from("cms_material_factor_config")
    .select("material_code, purity_rate, material_adjust_factor, gold_adjust_factor, price_basis");
  if (purityRes.error) return jsonError(purityRes.error.message ?? "소재 함량 조회 실패", 500);
  const purityMap = buildMaterialPurityMap(
    (purityRes.data ?? []).map((r) => ({
      material_code: normalizeMaterialCode(String(r.material_code ?? "")),
      purity_rate: Number(r.purity_rate ?? 0),
      material_adjust_factor: Number(r.material_adjust_factor ?? Number.NaN),
      gold_adjust_factor: Number(r.gold_adjust_factor ?? Number.NaN),
    })),
  );
  const materialAdjustMap = new Map<string, number>();
  const materialBasisMap = new Map<string, "GOLD" | "SILVER" | "NONE">();
  for (const row of purityRes.data ?? []) {
    const code = normalizeMaterialCode(String(row.material_code ?? ""));
    if (!code) continue;
    const adjust = Number(row.material_adjust_factor ?? Number.NaN);
    materialAdjustMap.set(code, Number.isFinite(adjust) && adjust > 0 ? adjust : 1);
    const basisRaw = String(row.price_basis ?? "").toUpperCase();
    const basis = basisRaw === "SILVER" ? "SILVER" : basisRaw === "NONE" ? "NONE" : "GOLD";
    materialBasisMap.set(code, basis);
  }
  const tickByMaterialCode = (materialCodeRaw: string): number => {
    const code = normalizeMaterialCode(materialCodeRaw);
    const basis = materialBasisMap.get(code);
    if (basis === "NONE") return 0;
    if (basis === "SILVER") return silverTick;
    if (basis === "GOLD") return goldTick;
    return isSilverMaterial(code) ? silverTick : goldTick;
  };

  const ruleSetIds = [...new Set(
    mappings
      .map((m) => String(m.sync_rule_set_id ?? "").trim())
      .filter((v) => v.length > 0),
  )];

  const [r1Res, r2Res, r3Res, r4Res] = await Promise.all([
    ruleSetIds.length > 0
      ? sb
        .from("sync_rule_r1_material_delta")
        .select("rule_id, rule_set_id, source_material_code, target_material_code, match_category_code, weight_min_g, weight_max_g, option_weight_multiplier, rounding_unit, rounding_mode, priority, is_active")
        .in("rule_set_id", ruleSetIds)
        .eq("is_active", true)
        .order("priority", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ruleSetIds.length > 0
      ? sb
        .from("sync_rule_r2_size_weight")
        .select("rule_id, rule_set_id, linked_r1_rule_id, match_material_code, match_category_code, weight_min_g, weight_max_g, option_range_expr, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active")
        .in("rule_set_id", ruleSetIds)
        .eq("is_active", true)
        .order("priority", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ruleSetIds.length > 0
      ? sb
        .from("sync_rule_r3_color_margin")
        .select("rule_id, rule_set_id, color_code, margin_min_krw, margin_max_krw, delta_krw, rounding_unit, rounding_mode, priority, is_active")
        .in("rule_set_id", ruleSetIds)
        .eq("is_active", true)
        .order("priority", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    ruleSetIds.length > 0
      ? sb
        .from("sync_rule_r4_decoration")
        .select("rule_id, rule_set_id, linked_r1_rule_id, match_decoration_code, match_material_code, match_color_code, match_category_code, delta_krw, rounding_unit, rounding_mode, priority, is_active")
        .in("rule_set_id", ruleSetIds)
        .eq("is_active", true)
        .order("priority", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (r1Res.error) return jsonError(r1Res.error.message ?? "R1 룰 조회 실패", 500);
  if (r2Res.error) return jsonError(r2Res.error.message ?? "R2 룰 조회 실패", 500);
  if (r3Res.error) return jsonError(r3Res.error.message ?? "R3 룰 조회 실패", 500);
  if (r4Res.error) return jsonError(r4Res.error.message ?? "R4 룰 조회 실패", 500);

  const r1BySet = new Map<string, SyncRuleR1Row[]>();
  for (const row of (r1Res.data ?? []) as SyncRuleR1Row[]) {
    const key = String(row.rule_set_id ?? "");
    const prev = r1BySet.get(key) ?? [];
    prev.push(row);
    r1BySet.set(key, prev);
  }
  const r2BySet = new Map<string, SyncRuleR2Row[]>();
  for (const row of (r2Res.data ?? []) as SyncRuleR2Row[]) {
    const key = String(row.rule_set_id ?? "");
    const prev = r2BySet.get(key) ?? [];
    prev.push(row);
    r2BySet.set(key, prev);
  }
  const r3BySet = new Map<string, SyncRuleR3Row[]>();
  for (const row of (r3Res.data ?? []) as SyncRuleR3Row[]) {
    const key = String(row.rule_set_id ?? "");
    const prev = r3BySet.get(key) ?? [];
    prev.push(row);
    r3BySet.set(key, prev);
  }
  const r4BySet = new Map<string, SyncRuleR4Row[]>();
  for (const row of (r4Res.data ?? []) as SyncRuleR4Row[]) {
    const key = String(row.rule_set_id ?? "");
    const prev = r4BySet.get(key) ?? [];
    prev.push(row);
    r4BySet.set(key, prev);
  }

  const nowIso = new Date().toISOString();
  const adjRes = await sb
    .from("pricing_adjustment")
    .select("adjustment_id, channel_product_id, master_item_id, apply_to, stage, amount_type, amount_value, is_active, valid_from, valid_to")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .or(`valid_from.is.null,valid_from.lte.${nowIso}`)
    .or(`valid_to.is.null,valid_to.gte.${nowIso}`);
  if (adjRes.error) return jsonError(adjRes.error.message ?? "조정 조회 실패", 500);
  const adjustments = adjRes.data ?? [];

  const ovrRes = await sb
    .from("pricing_override")
    .select("override_id, master_item_id, override_price_krw, reason, valid_from, valid_to, is_active")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .or(`valid_from.is.null,valid_from.lte.${nowIso}`)
    .or(`valid_to.is.null,valid_to.gte.${nowIso}`);
  if (ovrRes.error) return jsonError(ovrRes.error.message ?? "오버라이드 조회 실패", 500);
  const overrideMap = new Map((ovrRes.data ?? []).map((o) => [String(o.master_item_id), o]));

  const baseAdjRes = await sb
    .from("channel_base_price_adjustment_log")
    .select("master_item_id, delta_krw")
    .eq("channel_id", channelId);
  if (baseAdjRes.error) return jsonError(baseAdjRes.error.message ?? "기본가격 조정 로그 조회 실패", 500);
  const baseDeltaByMaster = new Map<string, number>();
  for (const row of baseAdjRes.data ?? []) {
    const key = String(row.master_item_id ?? "");
    if (!key) continue;
    const prev = baseDeltaByMaster.get(key) ?? 0;
    baseDeltaByMaster.set(key, prev + toNum(row.delta_krw, 0));
  }

  const laborAdjRes = await sb
    .from("channel_labor_price_adjustment_log")
    .select("master_item_id, delta_krw")
    .eq("channel_id", channelId);
  if (laborAdjRes.error) return jsonError(laborAdjRes.error.message ?? "공임 조정 로그 조회 실패", 500);
  const laborDeltaByMaster = new Map<string, number>();
  for (const row of laborAdjRes.data ?? []) {
    const key = String(row.master_item_id ?? "");
    if (!key) continue;
    const prev = laborDeltaByMaster.get(key) ?? 0;
    laborDeltaByMaster.set(key, prev + toNum(row.delta_krw, 0));
  }

  const blockedByMissingRules: Array<{ channel_product_id: string; missing_rules: string[] }> = [];
  const recomputeAt = new Date().toISOString();
  const computeRequestId = crypto.randomUUID();

  const rows = mappings.flatMap((m) => {
    const master = masterMap.get(m.master_item_id);
    if (!master) return [];

    const materialCode = normalizeMaterialCode(String(master.material_code_default ?? ""));
    const weight = toNum(master.weight_default_g, 0);
    const deduction = toNum(master.deduction_weight_default_g, 0);
    const baseNetWeight = Math.max(weight - deduction, 0);
    const applyRule1 = false;
    const applyRule2 = m.sync_rule_weight_enabled !== false;
    const applyRule3 = m.sync_rule_plating_enabled !== false;
    const applyRuleDecor = m.sync_rule_decoration_enabled !== false;
    const applyRule4 = true;
    const sizeWeightDelta = toNum(m.size_weight_delta_g, 0);
    const sizeWeightDeltaApplied = applyRule2 ? sizeWeightDelta : 0;
    const netWeight = Math.max(baseNetWeight + sizeWeightDeltaApplied, 0);

    const optionMaterialCode = normalizeKnownMaterialCode(m.option_material_code, materialCode);
    const optionColorCode = normalizePlatingComboCode(String(m.option_color_code ?? ""));
    const optionDecorationCode = String(m.option_decoration_code ?? "").trim().toUpperCase();
    const optionSizeValue = m.option_size_value == null ? null : Number(m.option_size_value);

    const targetTick = tickByMaterialCode(optionMaterialCode);
    const materialRaw = netWeight * targetTick;
    const factor = factorMap.get(optionMaterialCode) ?? 1;
    const hasVariant = String(m.external_variant_code ?? "").trim().length > 0;
    const needsR1 = false;
    const needsR2 = applyRule2 && hasVariant && optionSizeValue !== null && Number.isFinite(optionSizeValue);
    const needsR3 = applyRule3 && hasVariant && optionColorCode.length > 0;
    const needsR4Decor = applyRuleDecor && hasVariant && optionDecorationCode.length > 0;
    const option18Multiplier = Math.max(toNum(policy.option_18k_weight_multiplier, 1.2), 0.000001);
    const rawMaterialMultiplierOverride = toNum(m.material_multiplier_override, Number.NaN);
    const effectiveMaterialMultiplier = Number.isFinite(rawMaterialMultiplierOverride) && rawMaterialMultiplierOverride > 0
      ? rawMaterialMultiplierOverride
      : option18Multiplier;
    const optionMaterialMultiplier = hasVariant ? effectiveMaterialMultiplier : 1;

    const optionMode = String(m.option_price_mode ?? "SYNC").toUpperCase();
    const hasVariantCode = String(m.external_variant_code ?? "").trim().length > 0;
    const mappingRuleSetId = String(m.sync_rule_set_id ?? "").trim();
    const effectiveRuleSetId = mappingRuleSetId || (!hasVariantCode ? (derivedRuleSetByMaster.get(m.master_item_id) ?? "") : "");
    const useRuleSetEngine = optionMode === "SYNC" && effectiveRuleSetId.length > 0;

    const missingRules: string[] = [];

    const baseMaterialCode = normalizeMaterialCode(materialCode);
    const configuredR1BaseMaterialCode = r1BaseMaterialByMaster.get(m.master_item_id) ?? "";
    const inferredR1BaseMaterialCode = inferredR1BaseMaterialByMaster.get(m.master_item_id) ?? "";
    const primaryR1BaseMaterialCode = configuredR1BaseMaterialCode || baseMaterialCode;
    let r1SourceMaterialCodeUsed = primaryR1BaseMaterialCode;
    const basePurity = getMaterialPurityFromMap(purityMap, baseMaterialCode, 0);
    const baseAdjust = materialAdjustMap.get(baseMaterialCode) ?? 1;
    const baseTick = tickByMaterialCode(baseMaterialCode);
    const baseMaterialPrice = basePurity * baseAdjust * baseNetWeight * baseTick;

    let r1Delta = 0;
    let r2Delta = 0;
    let r3Delta = 0;
    let r4Delta = 0;
    let effectiveMaterialCode = materialCode;
    let matchedR4Rule: SyncRuleR4Row | null = null;
    const ruleHitTrace: Array<{ rule_type: "R1" | "R2" | "R3" | "R4"; rule_id: string }> = [];

    const applyRuleSetPricing = useRuleSetEngine;

    if (useRuleSetEngine) {
      const setId = effectiveRuleSetId;
      const targetPurity = getMaterialPurityFromMap(purityMap, optionMaterialCode, 0);
      const targetAdjust = materialAdjustMap.get(optionMaterialCode) ?? 1;
      const r1SourceCandidates = Array.from(
        new Set([primaryR1BaseMaterialCode, inferredR1BaseMaterialCode, baseMaterialCode].filter((value) => value && value !== "00")),
      );

      if (applyRule1) {
        outerR1: for (const sourceMaterialCode of r1SourceCandidates) {
          const sourcePurity = getMaterialPurityFromMap(purityMap, sourceMaterialCode, 0);
          const sourceAdjust = materialAdjustMap.get(sourceMaterialCode) ?? 1;
          for (const rule of (r1BySet.get(setId) ?? [])) {
            const src = normalizeOptionalMaterialCode(rule.source_material_code);
            const tgt = normalizeOptionalMaterialCode(rule.target_material_code);
            const cat = String(rule.match_category_code ?? "").trim();
            const category = String(master.category_code ?? "").trim();
            if (!src) continue;
            if (src !== sourceMaterialCode) continue;
            if (tgt !== optionMaterialCode) continue;
            if (cat && cat !== category) continue;
            if (!isRangeMatched(rule.weight_min_g, rule.weight_max_g, netWeight)) continue;

            const ruleMul = Math.max(toNum(rule.option_weight_multiplier, 1), 0.000001);
            const target18kMul = optionMaterialCode === "18" ? option18Multiplier : 1;
            const mul = Math.max(ruleMul * target18kMul, 0.000001);
            const sourceTick = tickByMaterialCode(sourceMaterialCode);
            const targetTick = tickByMaterialCode(optionMaterialCode);
            const sourceWeight = baseNetWeight;
            const targetWeight = baseNetWeight * mul;
            const sourceMaterialPrice = sourcePurity * sourceAdjust * sourceWeight * sourceTick;
            const targetMaterialPrice = targetPurity * targetAdjust * targetWeight * targetTick;
            r1Delta = roundByRule(targetMaterialPrice - sourceMaterialPrice, rule.rounding_unit, rule.rounding_mode);
            r1SourceMaterialCodeUsed = sourceMaterialCode;
            effectiveMaterialCode = tgt || optionMaterialCode || sourceMaterialCode;
            ruleHitTrace.push({ rule_type: "R1", rule_id: rule.rule_id });
            break outerR1;
          }
        }
      }

      for (const rule of (r2BySet.get(setId) ?? [])) {
        if (rule.linked_r1_rule_id && ruleHitTrace.find((h) => h.rule_type === "R1")?.rule_id !== rule.linked_r1_rule_id) continue;
        const mat = normalizeOptionalMaterialCode(rule.match_material_code);
        const cat = String(rule.match_category_code ?? "").trim();
        const category = String(master.category_code ?? "").trim();
        if (!mat) continue;
        if (mat !== materialCode) continue;
        if (cat && cat !== category) continue;
        if (netWeight < Number(rule.weight_min_g) || netWeight > Number(rule.weight_max_g)) continue;
        const hasMarginBand = rule.margin_min_krw !== null && rule.margin_max_krw !== null;
        const singleMarginMode = hasMarginBand && Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
        if (hasMarginBand) {
          if (!singleMarginMode && (r1Delta < Number(rule.margin_min_krw) || r1Delta > Number(rule.margin_max_krw))) continue;
        } else {
          const matcher = parseOptionRangeExpr(rule.option_range_expr);
          if (!matcher(optionSizeValue)) continue;
        }

        let r2BaseDelta = Number(rule.delta_krw ?? 0);
        if (singleMarginMode && r2BaseDelta === 0) {
          r2BaseDelta = Number(rule.margin_min_krw ?? 0);
        }
        r2Delta = roundByRule(r2BaseDelta, rule.rounding_unit, rule.rounding_mode);
        ruleHitTrace.push({ rule_type: "R2", rule_id: rule.rule_id });
        break;
      }

      for (const rule of (r3BySet.get(setId) ?? [])) {
        const cc = normalizePlatingComboCode(String(rule.color_code ?? ""));
        if (cc && cc !== optionColorCode) continue;
        const singleMarginMode = Number(rule.margin_min_krw) === Number(rule.margin_max_krw);
        let r3BaseDelta = Number(rule.delta_krw ?? 0);
        if (singleMarginMode && r3BaseDelta === 0) {
          r3BaseDelta = Number(rule.margin_min_krw ?? 0);
        }
        r3Delta = roundByRule(r3BaseDelta, rule.rounding_unit, rule.rounding_mode);
        ruleHitTrace.push({ rule_type: "R3", rule_id: rule.rule_id });
        break;
      }

      for (const rule of (r4BySet.get(setId) ?? [])) {
        if (rule.linked_r1_rule_id && ruleHitTrace.find((h) => h.rule_type === "R1")?.rule_id !== rule.linked_r1_rule_id) continue;
        const deco = String(rule.match_decoration_code ?? "").trim().toUpperCase();
        const mat = normalizeOptionalMaterialCode(rule.match_material_code);
        const clr = normalizePlatingComboCode(String(rule.match_color_code ?? ""));
        const cat = String(rule.match_category_code ?? "").trim();
        const category = String(master.category_code ?? "").trim();
        if (deco && deco !== optionDecorationCode) continue;
        if (mat && mat !== effectiveMaterialCode) continue;
        if (clr && clr !== optionColorCode) continue;
        if (cat && cat !== category) continue;

        matchedR4Rule = rule;
        ruleHitTrace.push({ rule_type: "R4", rule_id: rule.rule_id });
        break;
      }

      if (needsR1 && ruleHitTrace.findIndex((h) => h.rule_type === "R1") < 0) missingRules.push("R1");
      if (needsR2 && ruleHitTrace.findIndex((h) => h.rule_type === "R2") < 0) missingRules.push("R2");
      if (needsR3 && ruleHitTrace.findIndex((h) => h.rule_type === "R3") < 0) missingRules.push("R3");
      if (needsR4Decor && ruleHitTrace.findIndex((h) => h.rule_type === "R4") < 0) missingRules.push("R4");
      if (missingRules.length > 0) {
        blockedByMissingRules.push({
          channel_product_id: m.channel_product_id,
          missing_rules: missingRules,
        });
      }
    }

    const materialFinal = applyRuleSetPricing
      ? baseMaterialPrice
      : (applyRule1 ? materialRaw * factor * optionMaterialMultiplier : 0);

    const includePlating = m.include_master_plating_labor !== false;
    const masterAbsorbItems = absorbByMasterId.get(m.master_item_id) ?? [];
    const masterLaborSell = computeMasterLaborSellPerUnit(master, masterAbsorbItems, includePlating);
    const decorLines = decorLinesByMaster.get(m.master_item_id) ?? [];
    const decorLaborSell = decorLines.reduce((sum, line) => {
      const componentMaster = componentMasterMap.get(line.component_master_id) ?? null;
      if (!componentMaster) return sum;
      const componentAbsorbItems = absorbByMasterId.get(line.component_master_id) ?? [];
      const componentSellPerUnit = computeMasterLaborSellPerUnit(componentMaster, componentAbsorbItems, includePlating);
      return sum + componentSellPerUnit * Math.max(line.qty_per_unit, 0);
    }, 0);
    const laborRawBase = masterLaborSell + decorLaborSell;
    const laborBaseDelta = laborDeltaByMaster.get(m.master_item_id) ?? 0;
    const laborRaw = laborRawBase + laborBaseDelta;

    if (matchedR4Rule) {
      r4Delta = roundByRule(laborRawBase, matchedR4Rule.rounding_unit, matchedR4Rule.rounding_mode);
    }

    const adjForLine = adjustments.filter((a) =>
      (a.channel_product_id && String(a.channel_product_id) === m.channel_product_id)
      || (a.master_item_id && String(a.master_item_id) === m.master_item_id),
    );

    const toAdjKrw = (amountType: unknown, amountValue: unknown, base: number): number => {
      const v = toNum(amountValue, 0);
      if (String(amountType) === "PERCENT") return (base * v) / 100;
      return v;
    };

    const laborPre = adjForLine
      .filter((a) => a.apply_to === "LABOR" && a.stage === "PRE_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, laborRaw), 0);

    const laborPost = adjForLine
      .filter((a) => a.apply_to === "LABOR" && a.stage === "POST_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, laborRaw), 0);

    const laborPreFinal = laborRaw + laborPre;

    const totalPre = adjForLine
      .filter((a) => a.apply_to === "TOTAL" && a.stage === "PRE_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, materialFinal + laborPreFinal), 0);

    const basePre = materialFinal + laborPreFinal + totalPre;
    const marginMultiplier = applyRule4 ? toNum(policy.margin_multiplier, 1) : 1;
    const afterMargin = basePre * marginMultiplier;

    const totalPost = adjForLine
      .filter((a) => a.apply_to === "TOTAL" && a.stage === "POST_MARGIN")
      .reduce((sum, a) => sum + toAdjKrw(a.amount_type, a.amount_value, afterMargin), 0);

    const optionExtraDelta = toNum(m.option_price_delta_krw, 0);
    const optionPriceDelta = applyRuleSetPricing
      ? (r1Delta + r2Delta + r3Delta + r4Delta + optionExtraDelta)
      : optionExtraDelta;
    const basePriceDelta = baseDeltaByMaster.get(m.master_item_id) ?? 0;
    const targetRawSync = applyRule4
      ? afterMargin + laborPost + totalPost + basePriceDelta + optionPriceDelta
      : basePre;
    const roundingUnit = Number(policy.rounding_unit ?? 1000);
    const roundingMode = String(policy.rounding_mode ?? "CEIL");
    const roundedSync = applyRule4
      ? roundByRule(targetRawSync, roundingUnit, roundingMode)
      : Math.round(targetRawSync);

    const manualTarget = toNum(m.option_manual_target_krw, Number.NaN);
    const useManual = hasVariant && optionMode === "MANUAL" && Number.isFinite(manualTarget) && manualTarget >= 0;
    const rounded = useManual ? Math.round(manualTarget) : roundedSync;
    const targetRaw = useManual ? manualTarget : targetRawSync;

    const override = overrideMap.get(m.master_item_id);
    const finalTarget = override ? toNum(override.override_price_krw, rounded) : rounded;

    return [{
      channel_id: m.channel_id,
      master_item_id: m.master_item_id,
      channel_product_id: m.channel_product_id,
      computed_at: recomputeAt,
      tick_as_of: recomputeAt,
      tick_source: "cms_v_market_tick_latest_gold_silver_ops_v1",
      tick_gold_krw_g: goldTick,
      tick_silver_krw_g: silverTick,
      net_weight_g: netWeight,
      material_raw_krw: materialRaw,
      factor_set_id_used: selectedFactorSetId,
      material_factor_multiplier_used: factor,
      material_final_krw: materialFinal,
      labor_raw_krw: laborRaw,
      labor_pre_margin_adj_krw: laborPre,
      labor_post_margin_adj_krw: laborPost,
      total_pre_margin_adj_krw: totalPre,
      total_post_margin_adj_krw: totalPost,
      base_total_pre_margin_krw: basePre,
      margin_multiplier_used: marginMultiplier,
      total_after_margin_krw: afterMargin,
      target_price_raw_krw: targetRaw,
      rounding_unit_used: roundingUnit,
      rounding_mode_used: roundingMode,
      rounded_target_price_krw: rounded,
      override_price_krw: override ? toNum(override.override_price_krw, rounded) : null,
      final_target_price_krw: finalTarget,
      applied_adjustment_ids: adjForLine.map((a) => a.adjustment_id),
      breakdown_json: {
        model_name: master.model_name,
        material_code: materialCode,
        option_material_code: optionMaterialCode,
        r1_source_material_code_used: r1SourceMaterialCodeUsed,
        r1_base_material_policy_code: configuredR1BaseMaterialCode || null,
        r1_base_material_inferred_code: inferredR1BaseMaterialCode || null,
        effective_material_code: effectiveMaterialCode,
        r2_match_material_code_used: materialCode,
        option_color_code: optionColorCode || null,
        option_decoration_code: optionDecorationCode || null,
        option_size_value: optionSizeValue,
        sync_rule_set_id: effectiveRuleSetId || null,
        use_rule_set_engine: useRuleSetEngine,
        rule_set_engine_applied: applyRuleSetPricing,
        rule_hit_trace: ruleHitTrace,
        missing_rules: missingRules,
        channel_product_id: m.channel_product_id,
        option_material_multiplier: optionMaterialMultiplier,
        size_weight_delta_g: sizeWeightDeltaApplied,
        include_master_plating_labor: includePlating,
        labor_sot_master_sell_krw: masterLaborSell,
        labor_sot_decor_sell_krw: decorLaborSell,
        labor_sot_total_sell_krw: laborRawBase,
        r4_labor_delta_source_krw: matchedR4Rule ? laborRawBase : 0,
        labor_base_price_delta_krw: laborBaseDelta,
        base_price_delta_krw: applyRule4 ? basePriceDelta : 0,
        option_price_delta_krw: applyRule4 ? optionPriceDelta : 0,
        option_price_mode: optionMode,
        option_manual_target_krw: Number.isFinite(manualTarget) ? manualTarget : null,
        sync_rule_material_enabled: needsR1,
        sync_rule_weight_enabled: needsR2,
        sync_rule_plating_enabled: needsR3,
        sync_rule_decoration_enabled: needsR4Decor,
        sync_rule_margin_rounding_enabled: applyRule4,
        target_source: useManual ? "MANUAL" : "SYNC",
      },
      compute_request_id: computeRequestId,
    }];
  });

  if (rows.length === 0) {
    const allBlocked = blockedByMissingRules.length > 0 && blockedByMissingRules.length >= mappings.length;
    return NextResponse.json({
      ok: true,
      inserted: 0,
      skipped: mappings.length,
      reason: allBlocked ? "BLOCKED_BY_MISSING_RULES" : "NO_MASTER_ROWS",
      blocked_by_missing_rules_count: blockedByMissingRules.length,
      blocked_by_missing_rules: blockedByMissingRules.slice(0, 50),
      channel_id: channelId,
      factor_set_id_used: selectedFactorSetId,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const insertRes = await sb.from("pricing_snapshot").insert(rows).select("snapshot_id");
  if (insertRes.error) return jsonError(insertRes.error.message ?? "스냅샷 저장 실패", 500);

  return NextResponse.json({
    ok: true,
    inserted: insertRes.data?.length ?? 0,
    skipped: mappings.length - (insertRes.data?.length ?? 0),
    blocked_by_missing_rules_count: blockedByMissingRules.length,
    blocked_by_missing_rules: blockedByMissingRules.slice(0, 50),
    channel_id: channelId,
    factor_set_id_used: selectedFactorSetId,
  }, { headers: { "Cache-Control": "no-store" } });
}
