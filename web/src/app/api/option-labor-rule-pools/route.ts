import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { OPTION_LABOR_RULE_CATEGORIES } from "@/lib/shop/option-labor-rules";
import { normalizeMaterialCode } from "@/lib/material-factors";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MappingRow = {
  channel_product_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  option_color_code: string | null;
};

type MasterRow = {
  master_item_id: string;
  model_name: string | null;
  category_code: string | null;
  material_code_default: string | null;
  labor_base_sell: number | null;
  labor_center_sell: number | null;
  labor_sub1_sell: number | null;
  labor_sub2_sell: number | null;
  labor_base_cost: number | null;
  labor_center_cost: number | null;
  labor_sub1_cost: number | null;
  labor_sub2_cost: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
  plating_price_sell_default: number | null;
  plating_price_cost_default: number | null;
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

const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const toUpper = (value: unknown): string => toTrimmed(value).toUpperCase();
const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeVariantKey = (value: string | null | undefined): string => String(value ?? "").trim();
const isDecorLine = (note: string | null | undefined): boolean => String(note ?? "").trim().toUpperCase().startsWith("LINE_KIND:DECOR");

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

const normalizeMaster = (row: MasterRow): MasterRow => ({
  ...row,
  master_item_id: toTrimmed(row.master_item_id),
  model_name: toTrimmed(row.model_name) || null,
  category_code: toUpper(row.category_code) || null,
  material_code_default: normalizeMaterialCode(toTrimmed(row.material_code_default)),
});

const computeMasterLaborSellPerUnit = (masterRow: MasterRow | null | undefined, absorbItems: AbsorbRow[]): number => {
  if (!masterRow) return 0;
  const centerQty = Math.max(toNum(masterRow.center_qty_default), 0);
  const sub1Qty = Math.max(toNum(masterRow.sub1_qty_default), 0);
  const sub2Qty = Math.max(toNum(masterRow.sub2_qty_default), 0);

  const baseSell =
    toNum(masterRow.labor_base_sell)
    + toNum(masterRow.labor_center_sell) * centerQty
    + toNum(masterRow.labor_sub1_sell) * sub1Qty
    + toNum(masterRow.labor_sub2_sell) * sub2Qty
    + toNum(masterRow.plating_price_sell_default);

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

  const absorbSell =
    baseLaborUnit
    + stoneCenterUnit * centerQty
    + stoneSub1Unit * sub1Qty
    + stoneSub2Unit * sub2Qty
    + platingUnit
    + etc;

  return baseSell + absorbSell;
};

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

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get("channel_id"));
  const masterItemId = toTrimmed(searchParams.get("master_item_id"));
  const externalProductNo = toTrimmed(searchParams.get("external_product_no"));

  if (!channelId) return jsonError("channel_id is required", 400);

  let mappingQuery = sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, external_product_no, external_variant_code, option_color_code")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("master_item_id", { ascending: true })
    .order("external_product_no", { ascending: true })
    .order("external_variant_code", { ascending: true });

  if (masterItemId) mappingQuery = mappingQuery.eq("master_item_id", masterItemId);
  if (externalProductNo) mappingQuery = mappingQuery.eq("external_product_no", externalProductNo);

  const mappingRes = await mappingQuery;
  if (mappingRes.error) return jsonError(mappingRes.error.message ?? "옵션 공임 풀 조회 실패", 500);

  const mappings = (mappingRes.data ?? []) as MappingRow[];
  const targetMasterIds = Array.from(new Set(mappings.map((row) => toTrimmed(row.master_item_id)).filter(Boolean)));

  const [masterRes, platingRes, matCfgRes] = await Promise.all([
    targetMasterIds.length > 0
      ? sb
          .from("cms_master_item")
          .select("master_item_id, model_name, category_code, material_code_default, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_sell_default, plating_price_cost_default")
          .in("master_item_id", targetMasterIds)
      : Promise.resolve({ data: [], error: null }),
    sb
      .from("cms_plating_variant")
      .select("color_code")
      .eq("is_active", true)
      .limit(5000),
    sb
      .from("cms_material_factor_config")
      .select("material_code")
      .limit(5000),
  ]);

  for (const res of [masterRes, platingRes, matCfgRes]) {
    if (res.error) return jsonError(res.error.message ?? "옵션 공임 풀 조회 실패", 500);
  }

  const masters = ((masterRes.data ?? []) as MasterRow[])
    .map(normalizeMaster)
    .filter((row) => row.master_item_id.length > 0);
  const masterMap = new Map(masters.map((row) => [row.master_item_id, row]));

  const productContexts = Array.from(
    new Map(
      mappings
        .filter((row) => toTrimmed(row.master_item_id) && toTrimmed(row.external_product_no))
        .map((row) => {
          const normalizedMasterId = toTrimmed(row.master_item_id);
          const normalizedExternalProductNo = toTrimmed(row.external_product_no);
          const key = `${normalizedMasterId}::${normalizedExternalProductNo}`;
          const variantCode = toTrimmed(row.external_variant_code);
          const master = masterMap.get(normalizedMasterId) ?? null;
          return [
            key,
            {
              channel_product_id: toTrimmed(row.channel_product_id),
              master_item_id: normalizedMasterId,
              external_product_no: normalizedExternalProductNo,
              model_name: toTrimmed(master?.model_name) || null,
              category_code: toUpper(master?.category_code) || null,
              material_code_default: normalizeMaterialCode(toTrimmed(master?.material_code_default)),
              has_variants: Boolean(variantCode),
            },
          ];
        }),
    ).values(),
  );

  const recipeByProductId = new Map<string, BomRecipeWorklistRow>();
  if (targetMasterIds.length > 0) {
    const recipeRes = await sb
      .from(CONTRACTS.views.bomRecipeWorklist)
      .select("bom_id, product_master_id, variant_key")
      .in("product_master_id", targetMasterIds)
      .order("variant_key", { ascending: true });
    if (recipeRes.error) return jsonError(recipeRes.error.message ?? "BOM 레시피 조회 실패", 500);

    const recipesByProductId = new Map<string, BomRecipeWorklistRow[]>();
    for (const row of (recipeRes.data ?? []) as BomRecipeWorklistRow[]) {
      const productId = toTrimmed(row.product_master_id);
      if (!productId) continue;
      const prev = recipesByProductId.get(productId) ?? [];
      prev.push(row);
      recipesByProductId.set(productId, prev);
    }

    for (const productId of targetMasterIds) {
      const rows = recipesByProductId.get(productId) ?? [];
      if (rows.length === 0) continue;
      const selected = rows.find((row) => normalizeVariantKey(row.variant_key) === "") ?? rows[0];
      if (selected) recipeByProductId.set(productId, selected);
    }
  }

  const decorLinesByProductId = new Map<string, Array<{ component_master_id: string; qty_per_unit: number }>>();
  const selectedBomIds = Array.from(
    new Set(
      Array.from(recipeByProductId.values())
        .map((row) => toTrimmed(row.bom_id))
        .filter(Boolean),
    ),
  );

  if (selectedBomIds.length > 0) {
    const lineRes = await sb
      .from(CONTRACTS.views.bomRecipeLinesEnriched)
      .select("bom_id, component_ref_type, component_master_id, qty_per_unit, note")
      .in("bom_id", selectedBomIds)
      .eq("is_void", false);
    if (lineRes.error) return jsonError(lineRes.error.message ?? "BOM 라인 조회 실패", 500);

    const productIdByBomId = new Map<string, string>();
    for (const [productId, recipe] of recipeByProductId.entries()) {
      const bomId = toTrimmed(recipe.bom_id);
      if (!bomId) continue;
      productIdByBomId.set(bomId, productId);
    }

    for (const line of (lineRes.data ?? []) as BomRecipeLineEnrichedRow[]) {
      const bomId = toTrimmed(line.bom_id);
      const productId = productIdByBomId.get(bomId) ?? "";
      if (!productId) continue;
      if (!isDecorLine(line.note)) continue;
      if (toUpper(line.component_ref_type) !== "MASTER") continue;
      const componentMasterId = toTrimmed(line.component_master_id);
      if (!componentMasterId) continue;
      const prev = decorLinesByProductId.get(productId) ?? [];
      prev.push({ component_master_id: componentMasterId, qty_per_unit: toNum(line.qty_per_unit) });
      decorLinesByProductId.set(productId, prev);
    }
  }

  const decorationMasterIds = Array.from(
    new Set(
      Array.from(decorLinesByProductId.values())
        .flatMap((rows) => rows.map((row) => row.component_master_id))
        .filter(Boolean),
    ),
  );

  let decorationMasterMap = new Map<string, MasterRow>();
  if (decorationMasterIds.length > 0) {
    const decorationMasterRes = await sb
      .from("cms_master_item")
      .select("master_item_id, model_name, category_code, material_code_default, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, labor_base_cost, labor_center_cost, labor_sub1_cost, labor_sub2_cost, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_sell_default, plating_price_cost_default")
      .in("master_item_id", decorationMasterIds);
    if (decorationMasterRes.error) return jsonError(decorationMasterRes.error.message ?? "장식 마스터 조회 실패", 500);

    decorationMasterMap = new Map(
      ((decorationMasterRes.data ?? []) as MasterRow[])
        .map(normalizeMaster)
        .map((row) => [row.master_item_id, row]),
    );
  }

  const absorbMasterIds = Array.from(new Set([...targetMasterIds, ...decorationMasterIds]));
  const absorbByMasterId = new Map<string, AbsorbRow[]>();
  if (absorbMasterIds.length > 0) {
    const absorbRes = await sb
      .from("cms_master_absorb_labor_item_v1")
      .select("master_id, bucket, reason, amount_krw, is_active, note, labor_class, material_qty_per_unit")
      .in("master_id", absorbMasterIds)
      .order("priority", { ascending: true });
    if (absorbRes.error) return jsonError(absorbRes.error.message ?? "흡수공임 조회 실패", 500);

    for (const row of (absorbRes.data ?? []) as AbsorbRow[]) {
      const masterId = toTrimmed(row.master_id);
      if (!masterId) continue;
      const prev = absorbByMasterId.get(masterId) ?? [];
      prev.push(row);
      absorbByMasterId.set(masterId, prev);
    }
  }

  const mastersWithTotalLabor = masters.map((row) => {
    const ownAbsorb = absorbByMasterId.get(row.master_item_id) ?? [];
    const baseSell = computeMasterLaborSellPerUnit(row, ownAbsorb);
    const baseCost = computeMasterLaborCostPerUnit(row, ownAbsorb);
    const decorRows = decorLinesByProductId.get(row.master_item_id) ?? [];
    const decorTotals = decorRows.reduce(
      (sum, decor) => {
        const componentMaster = decorationMasterMap.get(decor.component_master_id) ?? null;
        if (!componentMaster) return sum;
        const componentAbsorb = absorbByMasterId.get(decor.component_master_id) ?? [];
        const qtyPerUnit = Math.max(decor.qty_per_unit, 0);
        return {
          sell: sum.sell + computeMasterLaborSellPerUnit(componentMaster, componentAbsorb) * qtyPerUnit,
          cost: sum.cost + computeMasterLaborCostPerUnit(componentMaster, componentAbsorb) * qtyPerUnit,
        };
      },
      { sell: 0, cost: 0 },
    );

    return {
      ...row,
      total_labor_sell_krw: Math.round(baseSell + decorTotals.sell),
      total_labor_cost_krw: Math.round(baseCost + decorTotals.cost),
    };
  }).sort((a, b) => (a.model_name ?? "").localeCompare(b.model_name ?? "") || a.master_item_id.localeCompare(b.master_item_id));

  const decorationMasters = decorationMasterIds
    .map((masterId) => decorationMasterMap.get(masterId) ?? null)
    .filter((row): row is MasterRow => Boolean(row))
    .map((row) => {
      const absorbItems = absorbByMasterId.get(row.master_item_id) ?? [];
      return {
        ...row,
        total_labor_sell_krw: Math.round(computeMasterLaborSellPerUnit(row, absorbItems)),
        total_labor_cost_krw: Math.round(computeMasterLaborCostPerUnit(row, absorbItems)),
      };
    })
    .sort((a, b) => (a.model_name ?? "").localeCompare(b.model_name ?? "") || a.master_item_id.localeCompare(b.master_item_id));

  const materials = Array.from(
    new Set(
      [
        ...masters.map((row) => normalizeMaterialCode(row.material_code_default ?? "")),
        ...(matCfgRes.data ?? []).map((row) => normalizeMaterialCode(toTrimmed((row as { material_code?: string | null }).material_code))),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const colors = Array.from(
    new Set(
      [
        ...(platingRes.data ?? []).map((row) => toUpper((row as { color_code?: string | null }).color_code)),
        ...mappings.map((row) => toUpper(row.option_color_code)),
      ].filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((colorCode) => ({ color_code: colorCode, display_name: colorCode }));

  const categoryCodes = Array.from(new Set(masters.map((row) => toUpper(row.category_code)).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return NextResponse.json(
    {
      data: {
        categories: OPTION_LABOR_RULE_CATEGORIES,
        category_codes: categoryCodes,
        contexts: productContexts,
        product_contexts: productContexts,
        materials,
        colors,
        decoration_masters: decorationMasters,
        master_options: mastersWithTotalLabor,
        masters: mastersWithTotalLabor,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
