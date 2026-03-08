import { NextResponse } from "next/server";
import { getShopAdminClient, jsonError, parseJsonObject } from "@/lib/shop/admin";
import { resolveCanonicalExternalProductNo, type SavedOptionCategoryRowWithDelta } from "@/lib/shop/mapping-option-details";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const toTrimmed = (value: unknown): string => String(value ?? "").trim();
const toUpper = (value: unknown): string => toTrimmed(value).toUpperCase();
const toRounded = (value: unknown): number => { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : 0; };

const normalizeSavedCategoryKey = (value: unknown): SavedOptionCategoryRowWithDelta["category_key"] => {
  const normalized = toUpper(value);
  if (normalized === "MATERIAL" || normalized === "SIZE" || normalized === "COLOR_PLATING" || normalized === "DECOR") return normalized;
  return "OTHER";
};

const categoryEntryKey = (row: Record<string, unknown>) => `${toTrimmed(row.option_name)}::${toTrimmed(row.option_value)}`;

const ruleSignature = (row: Record<string, unknown>) => [
  toUpper(row.category_key),
  toUpper(row.scope_material_code),
  row.additional_weight_g == null ? "" : String(row.additional_weight_g),
  row.additional_weight_min_g == null ? "" : String(row.additional_weight_min_g),
  row.additional_weight_max_g == null ? "" : String(row.additional_weight_max_g),
  row.plating_enabled == null ? "" : String(Boolean(row.plating_enabled)),
  toUpper(row.color_code),
  toTrimmed(row.decoration_master_id),
  toTrimmed(row.decoration_model_name),
  String(toRounded(row.base_labor_cost_krw)),
  String(toRounded(row.additive_delta_krw)),
  row.is_active === false ? "F" : "T",
].join("::");

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError("Supabase server env missing", 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError("Invalid request body", 400);

  const channelId = toTrimmed(body.channel_id);
  const masterItemId = toTrimmed(body.master_item_id);
  const requestedProductNo = toTrimmed(body.external_product_no);

  if (!channelId) return jsonError("channel_id is required", 400);
  if (!masterItemId) return jsonError("master_item_id is required", 400);

  const [activeProductRes, categoryRes, ruleRes] = await Promise.all([
    sb
      .from("sales_channel_product")
      .select("external_product_no")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    sb
      .from("channel_option_category_v2")
      .select("channel_id, master_item_id, external_product_no, option_name, option_value, category_key, sync_delta_krw")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId)
      .order("updated_at", { ascending: false }),
    sb
      .from("channel_option_labor_rule_v1")
      .select("channel_id, master_item_id, external_product_no, category_key, scope_material_code, additional_weight_g, additional_weight_min_g, additional_weight_max_g, plating_enabled, color_code, decoration_master_id, decoration_model_name, base_labor_cost_krw, additive_delta_krw, is_active, note")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterItemId),
  ]);

  if (activeProductRes.error) return jsonError(activeProductRes.error.message ?? "활성 상품번호 조회 실패", 500);
  if (categoryRes.error) return jsonError(categoryRes.error.message ?? "카테고리 백필 조회 실패", 500);
  if (ruleRes.error) return jsonError(ruleRes.error.message ?? "룰 백필 조회 실패", 500);

  const activeProductNos = (activeProductRes.data ?? []).map((row) => toTrimmed(row.external_product_no)).filter(Boolean);
  const fallbackProductNo = requestedProductNo || activeProductNos[0] || "";
  if (!fallbackProductNo) return jsonError("canonical product를 결정할 수 없습니다", 422);

  const canonicalExternalProductNo = resolveCanonicalExternalProductNo(activeProductNos, fallbackProductNo);

  const allCategoryRows = (categoryRes.data ?? []) as Array<Record<string, unknown>>;
  const canonicalCategoryKeys = new Set(
    allCategoryRows
      .filter((row) => toTrimmed(row.external_product_no) === canonicalExternalProductNo)
      .map((row) => categoryEntryKey(row)),
  );
  const latestCategoryRowByEntry = new Map<string, Record<string, unknown>>();
  for (const row of allCategoryRows) {
    const key = categoryEntryKey(row);
    if (!key || latestCategoryRowByEntry.has(key)) continue;
    latestCategoryRowByEntry.set(key, row);
  }
  const categoryBackfillRows = Array.from(latestCategoryRowByEntry.values())
    .filter((row) => toTrimmed(row.external_product_no) !== canonicalExternalProductNo)
    .filter((row) => !canonicalCategoryKeys.has(categoryEntryKey(row)))
    .map((row) => ({
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: canonicalExternalProductNo,
      option_name: toTrimmed(row.option_name),
      option_value: toTrimmed(row.option_value),
      category_key: normalizeSavedCategoryKey(row.category_key),
      sync_delta_krw: row.sync_delta_krw == null ? null : toRounded(row.sync_delta_krw),
    }))
    .filter((row) => row.option_name && row.option_value);

  if (categoryBackfillRows.length > 0) {
    const upsertCategoryRes = await sb
      .from("channel_option_category_v2")
      .upsert(categoryBackfillRows, { onConflict: "channel_id,master_item_id,external_product_no,option_name,option_value" });
    if (upsertCategoryRes.error) return jsonError(upsertCategoryRes.error.message ?? "카테고리 백필 저장 실패", 500);
  }

  const allRuleRows = (ruleRes.data ?? []) as Array<Record<string, unknown>>;
  const canonicalRuleSignatures = new Set(
    allRuleRows
      .filter((row) => toTrimmed(row.external_product_no) === canonicalExternalProductNo)
      .map((row) => ruleSignature(row)),
  );
  const latestRuleBySignature = new Map<string, Record<string, unknown>>();
  for (const row of allRuleRows) {
    const key = ruleSignature(row);
    if (!key || latestRuleBySignature.has(key)) continue;
    latestRuleBySignature.set(key, row);
  }
  const nowIso = new Date().toISOString();
  const ruleBackfillRows = Array.from(latestRuleBySignature.values())
    .filter((row) => toTrimmed(row.external_product_no) !== canonicalExternalProductNo)
    .filter((row) => !canonicalRuleSignatures.has(ruleSignature(row)))
    .map((row) => ({
      channel_id: channelId,
      master_item_id: masterItemId,
      external_product_no: canonicalExternalProductNo,
      category_key: toUpper(row.category_key),
      scope_material_code: toUpper(row.scope_material_code) || null,
      additional_weight_g: row.additional_weight_g == null ? null : Number(row.additional_weight_g),
      additional_weight_min_g: row.additional_weight_min_g == null ? null : Number(row.additional_weight_min_g),
      additional_weight_max_g: row.additional_weight_max_g == null ? null : Number(row.additional_weight_max_g),
      plating_enabled: row.plating_enabled == null ? null : Boolean(row.plating_enabled),
      color_code: toUpper(row.color_code) || null,
      decoration_master_id: toTrimmed(row.decoration_master_id) || null,
      decoration_model_name: toTrimmed(row.decoration_model_name) || null,
      base_labor_cost_krw: toRounded(row.base_labor_cost_krw),
      additive_delta_krw: toRounded(row.additive_delta_krw),
      is_active: row.is_active !== false,
      note: `${toTrimmed(row.note) || ""} [BACKFILL:${nowIso}]`.trim(),
    }))
    .filter((row) => ["MATERIAL", "SIZE", "COLOR_PLATING", "DECOR", "OTHER"].includes(row.category_key));

  if (ruleBackfillRows.length > 0) {
    const insertRuleRes = await sb
      .from("channel_option_labor_rule_v1")
      .insert(ruleBackfillRows);
    if (insertRuleRes.error) return jsonError(insertRuleRes.error.message ?? "룰 백필 저장 실패", 500);
  }

  return NextResponse.json({
    data: {
      channel_id: channelId,
      master_item_id: masterItemId,
      canonical_external_product_no: canonicalExternalProductNo,
      category_backfilled: categoryBackfillRows.length,
      rule_backfilled: ruleBackfillRows.length,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
