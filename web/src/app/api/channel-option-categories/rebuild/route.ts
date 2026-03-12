import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import {
  ensureValidCafe24AccessToken,
  loadCafe24Account,
  cafe24ListProductVariants,
} from "@/lib/shop/cafe24";
import { resolveCanonicalProductNo } from "@/lib/shop/canonical-mapping";
import { normalizeMaterialCode } from "@/lib/material-factors";
import { normalizePlatingComboCode } from "@/lib/shop/sync-rules";
import { stripPriceDeltaSuffix } from "@/lib/shop/option-labels.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MappingRow = {
  channel_product_id: string | null;
  master_item_id: string | null;
  external_product_no: string | null;
  external_variant_code: string | null;
  option_material_code: string | null;
  option_color_code: string | null;
  option_decoration_code: string | null;
  option_size_value: number | null;
  is_active: boolean | null;
};

type ExistingCategoryRow = {
  external_product_no: string | null;
  option_name: string | null;
  option_value: string | null;
  category_key: string | null;
  sync_delta_krw: number | null;
  updated_at?: string | null;
};

const toTrimmed = (value: unknown) => String(value ?? "").trim();
const normalizeVariantCode = (value: unknown) => toTrimmed(value);
const normalizeOptionValue = (value: unknown) => stripPriceDeltaSuffix(toTrimmed(value));
const entryKey = (name: unknown, value: unknown) => {
  const n = toTrimmed(name);
  const v = normalizeOptionValue(value);
  return n && v ? `${n}::${v}` : "";
};

const normalizeCategoryKey = (value: unknown): "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER" => {
  const key = toTrimmed(value).toUpperCase();
  if (key === "MATERIAL" || key === "SIZE" || key === "COLOR_PLATING" || key === "DECOR") return key;
  return "OTHER";
};

const inferAxisCategory = (records: Array<{
  optionValue: string;
  materialCode: string | null;
  colorCode: string | null;
  decorCode: string | null;
  sizeValue: string | null;
}>): "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER" => {
  const byValue = new Map<string, typeof records>();
  for (const record of records) {
    const bucket = byValue.get(record.optionValue) ?? [];
    bucket.push(record);
    byValue.set(record.optionValue, bucket);
  }

  const score = (selector: (row: typeof records[number]) => string | null) => {
    const groupValues: string[] = [];
    for (const rows of byValue.values()) {
      const distinct = Array.from(new Set(rows.map((row) => selector(row) ?? "__NONE__")));
      if (distinct.length !== 1) return { consistent: false, distinctCount: 0 };
      groupValues.push(distinct[0] ?? "");
    }
    return { consistent: true, distinctCount: Array.from(new Set(groupValues)).length };
  };

  const material = score((row) => row.materialCode);
  const size = score((row) => row.sizeValue);
  const color = score((row) => row.colorCode);
  const decor = score((row) => row.decorCode);

  const ranked = [
    { key: "SIZE" as const, ...size },
    { key: "COLOR_PLATING" as const, ...color },
    { key: "MATERIAL" as const, ...material },
    { key: "DECOR" as const, ...decor },
  ]
    .filter((row) => row.consistent && row.distinctCount > 1)
    .sort((left, right) => right.distinctCount - left.distinctCount);

  if (ranked.length === 0) {
    const normalizedMaterials = Array.from(new Set(
      records
        .map((record) => normalizeMaterialCode(record.optionValue))
        .filter((value): value is string => Boolean(value)),
    ));
    if (normalizedMaterials.length > 1) return "MATERIAL";
  }

  return ranked[0]?.key ?? "OTHER";
};

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw) ?? {};
  const channelId = toTrimmed(body.channel_id);
  const requestedMasterItemId = toTrimmed(body.master_item_id);
  if (!channelId) return jsonError("channel_id is required", 400);

  const mappingsRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, master_item_id, external_product_no, external_variant_code, option_material_code, option_color_code, option_decoration_code, option_size_value, is_active")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .order("master_item_id", { ascending: true })
    .order("external_product_no", { ascending: true })
    .order("external_variant_code", { ascending: true });
  if (mappingsRes.error) return jsonError(mappingsRes.error.message ?? "active mapping lookup failed", 500);

  const mappings = ((mappingsRes.data ?? []) as MappingRow[]).filter((row) =>
    !requestedMasterItemId || toTrimmed(row.master_item_id) === requestedMasterItemId,
  );

  const mappingsByMaster = new Map<string, MappingRow[]>();
  for (const row of mappings) {
    const masterId = toTrimmed(row.master_item_id);
    if (!masterId) continue;
    const bucket = mappingsByMaster.get(masterId) ?? [];
    bucket.push(row);
    mappingsByMaster.set(masterId, bucket);
  }

  const account = await loadCafe24Account(sb, channelId);
  if (!account) return jsonError("Cafe24 account is missing", 422);

  let accessToken: string;
  try {
    accessToken = await ensureValidCafe24AccessToken(sb, account);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Cafe24 token refresh failed", 422);
  }

  const existingCategoryRes = await sb
    .from("channel_option_category_v2")
    .select("master_item_id, external_product_no, option_name, option_value, category_key, sync_delta_krw, updated_at")
    .eq("channel_id", channelId)
    .order("updated_at", { ascending: false });
  if (existingCategoryRes.error) return jsonError(existingCategoryRes.error.message ?? "existing categories lookup failed", 500);
  const existingCategories = (existingCategoryRes.data ?? []) as Array<ExistingCategoryRow & { master_item_id?: string | null }>;

  const replaceGroups: Array<{
    master_item_id: string;
    canonical_external_product_no: string;
    rows: Array<Record<string, unknown>>;
  }> = [];
  const summaries: Array<Record<string, unknown>> = [];

  for (const [masterItemId, masterRows] of mappingsByMaster.entries()) {
    const canonicalProductNo = resolveCanonicalProductNo(
      masterRows.map((row) => toTrimmed(row.external_product_no)),
      toTrimmed(masterRows[0]?.external_product_no),
    );
    if (!canonicalProductNo) continue;

    let variantsRes = await cafe24ListProductVariants(account, accessToken, canonicalProductNo);
    if (!variantsRes.ok && variantsRes.status === 401) {
      try {
        accessToken = await ensureValidCafe24AccessToken(sb, account);
        variantsRes = await cafe24ListProductVariants(account, accessToken, canonicalProductNo);
      } catch {
        // Keep original result.
      }
    }
    if (!variantsRes.ok) {
      summaries.push({
        master_item_id: masterItemId,
        canonical_external_product_no: canonicalProductNo,
        error: variantsRes.error ?? "variant lookup failed",
      });
      continue;
    }

    const mappingByVariant = new Map<string, MappingRow>();
    for (const row of masterRows) {
      const code = normalizeVariantCode(row.external_variant_code);
      if (!code || mappingByVariant.has(code)) continue;
      mappingByVariant.set(code, row);
    }

    const axisRecords = new Map<string, Array<{
      optionValue: string;
      materialCode: string | null;
      colorCode: string | null;
      decorCode: string | null;
      sizeValue: string | null;
    }>>();

    for (const variant of variantsRes.variants ?? []) {
      const mapping = mappingByVariant.get(normalizeVariantCode(variant.variantCode));
      if (!mapping) continue;
      for (const option of variant.options ?? []) {
        const optionName = toTrimmed(option.name);
        const optionValue = normalizeOptionValue(option.value);
        if (!optionName || !optionValue) continue;
        const bucket = axisRecords.get(optionName) ?? [];
        bucket.push({
          optionValue,
          materialCode: normalizeMaterialCode(mapping.option_material_code),
          colorCode: normalizePlatingComboCode(mapping.option_color_code),
          decorCode: toTrimmed(mapping.option_decoration_code) || null,
          sizeValue: Number.isFinite(Number(mapping.option_size_value)) ? Number(mapping.option_size_value).toFixed(2) : null,
        });
        axisRecords.set(optionName, bucket);
      }
    }

    const axisCategoryByName = new Map<string, "MATERIAL" | "SIZE" | "COLOR_PLATING" | "DECOR" | "OTHER">();
    for (const [optionName, records] of axisRecords.entries()) {
      axisCategoryByName.set(optionName, inferAxisCategory(records));
    }

    const existingByEntryAndCategory = new Map<string, ExistingCategoryRow>();
    for (const row of existingCategories) {
      if (toTrimmed((row as { master_item_id?: string | null }).master_item_id) !== masterItemId) continue;
      const key = `${entryKey(row.option_name, row.option_value)}::${normalizeCategoryKey(row.category_key)}`;
      if (!existingByEntryAndCategory.has(key)) existingByEntryAndCategory.set(key, row);
    }

    const nextRows: Array<Record<string, unknown>> = [];
    for (const variant of variantsRes.variants ?? []) {
      for (const option of variant.options ?? []) {
        const optionName = toTrimmed(option.name);
        const optionValue = normalizeOptionValue(option.value);
        if (!optionName || !optionValue) continue;
        const categoryKey = axisCategoryByName.get(optionName) ?? "OTHER";
        const previous = existingByEntryAndCategory.get(`${entryKey(optionName, optionValue)}::${categoryKey}`);
        nextRows.push({
          channel_id: channelId,
          master_item_id: masterItemId,
          external_product_no: canonicalProductNo,
          option_name: optionName,
          option_value: optionValue,
          category_key: categoryKey,
          sync_delta_krw: previous?.sync_delta_krw == null ? 0 : Math.round(Number(previous.sync_delta_krw)),
          updated_by: "CATEGORY_REBUILD_FROM_MAPPINGS",
          created_by: "CATEGORY_REBUILD_FROM_MAPPINGS",
        });
      }
    }

    const deduped = Array.from(new Map(nextRows.map((row) => [`${row.option_name}::${row.option_value}`, row])).values());
    if (deduped.length > 0) {
      replaceGroups.push({
        master_item_id: masterItemId,
        canonical_external_product_no: canonicalProductNo,
        rows: deduped,
      });
    }
    summaries.push({
      master_item_id: masterItemId,
      canonical_external_product_no: canonicalProductNo,
      rebuilt_rows: deduped.length,
      axis_categories: Object.fromEntries(axisCategoryByName),
    });
  }

  let rebuiltCount = 0;
  for (const group of replaceGroups) {
    const deleteRes = await sb
      .from("channel_option_category_v2")
      .delete()
      .eq("channel_id", channelId)
      .eq("master_item_id", group.master_item_id)
      .eq("external_product_no", group.canonical_external_product_no);
    if (deleteRes.error) return jsonError(deleteRes.error.message ?? "category rebuild delete failed", 500);

    const insertRes = await sb
      .from("channel_option_category_v2")
      .insert(group.rows);
    if (insertRes.error) return jsonError(insertRes.error.message ?? "category rebuild insert failed", 500);

    rebuiltCount += group.rows.length;
  }

  return NextResponse.json({
    ok: true,
    rebuilt: rebuiltCount,
    masters: summaries.length,
    summaries,
  }, { headers: { "Cache-Control": "no-store" } });
}
