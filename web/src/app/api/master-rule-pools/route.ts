import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError } from "@/lib/shop/admin";
import { normalizeMaterialCode } from "@/lib/material-factors";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MasterRow = {
  master_item_id: string;
  model_name: string | null;
  category_code: string | null;
  material_code_default: string | null;
  labor_base_sell: number | null;
  labor_center_sell: number | null;
  labor_sub1_sell: number | null;
  labor_sub2_sell: number | null;
  center_qty_default: number | null;
  sub1_qty_default: number | null;
  sub2_qty_default: number | null;
  plating_price_sell_default: number | null;
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

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const { searchParams } = new URL(request.url);
  const categoryCode = String(searchParams.get("category_code") ?? "").trim().toUpperCase();
  const includeAllDecorationMaster = searchParams.get("include_all_decoration_master") === "true";

  const [masterRes, platingRes, mappedColorRes, matCfgRes] = await Promise.all([
    sb
      .from("cms_master_item")
      .select("master_item_id, model_name, category_code, material_code_default, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_sell_default")
      .limit(5000),
    sb
      .from("cms_plating_variant")
      .select("color_code")
      .limit(5000),
    sb
      .from("sales_channel_product")
      .select("option_color_code")
      .not("option_color_code", "is", null)
      .limit(5000),
    sb
      .from("cms_material_factor_config")
      .select("material_code")
      .limit(5000),
  ]);

  for (const res of [masterRes, platingRes, mappedColorRes, matCfgRes]) {
    if (res.error) return jsonError(res.error.message ?? "룰 풀 조회 실패", 500);
  }

  const allMasters = ((masterRes.data ?? []) as MasterRow[])
    .map((row) => ({
      ...row,
      master_item_id: String(row.master_item_id ?? ""),
      model_name: String(row.model_name ?? "").trim() || null,
      category_code: String(row.category_code ?? "").trim().toUpperCase() || null,
      material_code_default: normalizeMaterialCode(String(row.material_code_default ?? "")),
    }))
    .filter((row) => row.master_item_id.length > 0);

  const masters = allMasters.filter((row) => {
    if (!categoryCode) return true;
    return row.category_code === categoryCode;
  });

  const targetMasterIds = masters.map((row) => row.master_item_id).filter((v) => v.length > 0);
  const decorLinesByProductId = new Map<string, Array<{ component_master_id: string; qty_per_unit: number }>>();
  if (targetMasterIds.length > 0) {
    const recipeRes = await sb
      .from(CONTRACTS.views.bomRecipeWorklist)
      .select("bom_id, product_master_id, variant_key")
      .in("product_master_id", targetMasterIds)
      .order("variant_key", { ascending: true });
    if (recipeRes.error) return jsonError(recipeRes.error.message ?? "BOM 레시피 조회 실패", 500);

    const recipes = (recipeRes.data ?? []) as BomRecipeWorklistRow[];
    const recipesByProductId = new Map<string, BomRecipeWorklistRow[]>();
    for (const row of recipes) {
      const productId = String(row.product_master_id ?? "").trim();
      if (!productId) continue;
      const prev = recipesByProductId.get(productId) ?? [];
      prev.push(row);
      recipesByProductId.set(productId, prev);
    }

    const selectedRecipeByProductId = new Map<string, BomRecipeWorklistRow>();
    for (const productId of targetMasterIds) {
      const rows = recipesByProductId.get(productId) ?? [];
      if (rows.length === 0) continue;
      const defaultRow = rows.find((row) => normalizeVariantKey(row.variant_key) === "") ?? rows[0];
      if (defaultRow) selectedRecipeByProductId.set(productId, defaultRow);
    }

    const selectedBomIds = Array.from(
      new Set(
        Array.from(selectedRecipeByProductId.values())
          .map((row) => String(row.bom_id ?? "").trim())
          .filter((v) => v.length > 0),
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
      for (const [productId, recipe] of selectedRecipeByProductId.entries()) {
        const bomId = String(recipe.bom_id ?? "").trim();
        if (!bomId) continue;
        productIdByBomId.set(bomId, productId);
      }

      const lines = (lineRes.data ?? []) as BomRecipeLineEnrichedRow[];
      for (const line of lines) {
        const bomId = String(line.bom_id ?? "").trim();
        const productId = productIdByBomId.get(bomId) ?? "";
        if (!productId) continue;
        if (!isDecorLine(line.note)) continue;
        if (String(line.component_ref_type ?? "").trim().toUpperCase() !== "MASTER") continue;
        const componentMasterId = String(line.component_master_id ?? "").trim();
        if (!componentMasterId) continue;
        const qtyPerUnit = toNum(line.qty_per_unit);
        const prev = decorLinesByProductId.get(productId) ?? [];
        prev.push({ component_master_id: componentMasterId, qty_per_unit: qtyPerUnit });
        decorLinesByProductId.set(productId, prev);
      }
    }
  }

  const componentMasterIds = Array.from(
    new Set(
      Array.from(decorLinesByProductId.values())
        .flatMap((rows) => rows.map((row) => row.component_master_id))
        .filter((v) => v.length > 0),
    ),
  );

  let componentMasterMap = new Map<string, MasterRow>();
  if (componentMasterIds.length > 0) {
    const componentRes = await sb
      .from("cms_master_item")
      .select("master_item_id, model_name, category_code, material_code_default, labor_base_sell, labor_center_sell, labor_sub1_sell, labor_sub2_sell, center_qty_default, sub1_qty_default, sub2_qty_default, plating_price_sell_default")
      .in("master_item_id", componentMasterIds);
    if (componentRes.error) return jsonError(componentRes.error.message ?? "컴포넌트 마스터 조회 실패", 500);
    componentMasterMap = new Map(
      ((componentRes.data ?? []) as MasterRow[]).map((row) => [String(row.master_item_id ?? ""), row]),
    );
  }

  const absorbMasterIds = Array.from(new Set([...targetMasterIds, ...componentMasterIds]));
  let absorbByMasterId = new Map<string, AbsorbRow[]>();
  if (absorbMasterIds.length > 0) {
    const absorbRes = await sb
      .from("cms_master_absorb_labor_item_v1")
      .select("master_id, bucket, reason, amount_krw, is_active, note, labor_class, material_qty_per_unit")
      .in("master_id", absorbMasterIds)
      .order("priority", { ascending: true });
    if (absorbRes.error) return jsonError(absorbRes.error.message ?? "흡수공임 조회 실패", 500);

    absorbByMasterId = new Map();
    for (const row of (absorbRes.data ?? []) as AbsorbRow[]) {
      const masterId = String(row.master_id ?? "").trim();
      if (!masterId) continue;
      const prev = absorbByMasterId.get(masterId) ?? [];
      prev.push(row);
      absorbByMasterId.set(masterId, prev);
    }
  }

  const mastersWithTotalLabor = masters.map((row) => {
    const ownAbsorb = absorbByMasterId.get(row.master_item_id) ?? [];
    const baseSell = computeMasterLaborSellPerUnit(row, ownAbsorb);
    const decorRows = decorLinesByProductId.get(row.master_item_id) ?? [];
    const decorSell = decorRows.reduce((sum, decor) => {
      const componentMaster = componentMasterMap.get(decor.component_master_id) ?? null;
      if (!componentMaster) return sum;
      const componentAbsorb = absorbByMasterId.get(decor.component_master_id) ?? [];
      const componentSellPerUnit = computeMasterLaborSellPerUnit(componentMaster, componentAbsorb);
      return sum + componentSellPerUnit * Math.max(decor.qty_per_unit, 0);
    }, 0);
    return {
      ...row,
      total_labor_sell_krw: Math.round(baseSell + decorSell),
    };
  });

  const categories = Array.from(
    new Set(
      allMasters
        .map((row) => row.category_code ?? "")
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const materials = Array.from(
    new Set([
      ...masters.map((row) => normalizeMaterialCode(row.material_code_default ?? "")),
      ...allMasters.map((row) => normalizeMaterialCode(row.material_code_default ?? "")),
      ...(matCfgRes.data ?? []).map((row) => normalizeMaterialCode(String(row.material_code ?? ""))),
    ].filter((v) => v.length > 0)),
  ).sort((a, b) => a.localeCompare(b));

  const colors = Array.from(
    new Set([
      ...(platingRes.data ?? []).map((row) => String((row as { color_code?: string | null }).color_code ?? "").trim().toUpperCase()),
      ...(mappedColorRes.data ?? []).map((row) => String((row as { option_color_code?: string | null }).option_color_code ?? "").trim().toUpperCase()),
    ].filter((v) => v.length > 0)),
  ).sort((a, b) => a.localeCompare(b));

  const decorationNames = Array.from(
    new Set(
      masters
        .concat(allMasters)
        .filter((row) => includeAllDecorationMaster || row.category_code === "ACCESSORY")
        .map((row) => (row.model_name ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json(
    {
      data: {
        categories,
        materials,
        colors,
        decoration_names: decorationNames,
        masters: mastersWithTotalLabor,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
