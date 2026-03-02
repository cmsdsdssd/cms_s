import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { POST as recomputePost } from "../src/app/api/pricing/recompute/route";
import { POST as pushPost } from "../src/app/api/channel-prices/push/route";
import { cafe24GetVariantPrice, cafe24ListProductVariants, ensureValidCafe24AccessToken, loadCafe24Account } from "../src/lib/shop/cafe24";

const MASTER_ITEM_ID = "4551f046-607f-4bf0-85db-9eafab542cd0";

type PlanRow = {
  variantCode: string;
  material: "14" | "18";
  color: "P" | "G" | "W" | "B";
  materialLabel: string;
  colorLabel: string;
};

const mapMaterialCode = (value: string): "14" | "18" | null => {
  const v = value.trim().toUpperCase();
  if (v.includes("14")) return "14";
  if (v.includes("18")) return "18";
  return null;
};

const mapColorCode = (value: string): "P" | "G" | "W" | "B" | null => {
  const upper = value.trim().toUpperCase();
  const codeInParen = upper.match(/\(([PGWYB])\)/)?.[1] ?? "";
  if (codeInParen === "P") return "P";
  if (codeInParen === "W") return "W";
  if (codeInParen === "B") return "B";
  if (codeInParen === "Y" || codeInParen === "G") return "G";

  if (upper.includes("핑크") || upper.includes("로즈")) return "P";
  if (upper.includes("화이트")) return "W";
  if (upper.includes("블랙")) return "B";
  if (upper.includes("옐로우")) return "G";
  if (upper.includes("골드")) return "G";
  return null;
};

type MappingRow = {
  channel_product_id: string;
  channel_id: string;
  external_product_no: string | null;
  external_variant_code: string | null;
  updated_at: string;
};

const main = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing Supabase env");
  const sb = createClient(url, key);

  const channelRes = await sb
    .from("sales_channel")
    .select("channel_id, channel_name")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (channelRes.error) throw new Error(channelRes.error.message);
  const channelId = channelRes.data.channel_id as string;

  const mapRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, external_product_no, external_variant_code, updated_at")
    .eq("channel_id", channelId)
    .eq("master_item_id", MASTER_ITEM_ID)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (mapRes.error) throw new Error(mapRes.error.message);
  const mappings = (mapRes.data ?? []) as MappingRow[];

  const baseRow = mappings.find((r) => String(r.external_variant_code ?? "").trim() === "");
  if (!baseRow) throw new Error("Base mapping row not found");
  const externalProductNo = String(baseRow.external_product_no ?? "").trim();
  if (!externalProductNo) throw new Error("external_product_no missing");

  const rowsByVariant = new Map<string, MappingRow[]>();
  for (const row of mappings) {
    const variant = String(row.external_variant_code ?? "").trim();
    if (!variant) continue;
    const prev = rowsByVariant.get(variant) ?? [];
    prev.push(row);
    rowsByVariant.set(variant, prev);
  }

  const account = await loadCafe24Account(sb, channelId);
  if (!account) throw new Error("Cafe24 account missing");
  const token = await ensureValidCafe24AccessToken(sb, account);
  const variantsRes = await cafe24ListProductVariants(account, token, externalProductNo);
  if (!variantsRes.ok) throw new Error(variantsRes.error ?? `Cafe24 variant list failed: HTTP_${variantsRes.status}`);

  const planRows: PlanRow[] = [];
  for (const variant of variantsRes.variants) {
    const variantCode = String(variant.variantCode ?? "").trim();
    if (!variantCode) continue;
    if (!rowsByVariant.has(variantCode)) continue;

    const materialOpt = variant.options.find((o) => String(o.name ?? "").includes("14K") || String(o.name ?? "").includes("소재")) ?? variant.options[0];
    const colorOpt = variant.options.find((o) => String(o.name ?? "").includes("색상")) ?? variant.options[1];
    const materialLabel = String(materialOpt?.value ?? "").trim();
    const colorLabel = String(colorOpt?.value ?? "").trim();
    const material = mapMaterialCode(materialLabel);
    const color = mapColorCode(colorLabel);
    if (!material || !color) continue;

    planRows.push({ variantCode, material, color, materialLabel, colorLabel });
  }

  if (planRows.length === 0) {
    throw new Error("No variant rows mapped from Cafe24 option categories");
  }

  const materialSet = new Set(planRows.map((p) => p.material));
  if (!materialSet.has("14") || !materialSet.has("18")) {
    throw new Error("Expected both material categories (14,18) from option values");
  }

  const colorSet = new Set(planRows.map((p) => p.color));
  if (colorSet.size < 2) {
    throw new Error("Expected at least two color categories from option values");
  }

  for (const plan of planRows) {
    if (!rowsByVariant.has(plan.variantCode)) {
      throw new Error(`Variant mapping missing: ${plan.variantCode}`);
    }
  }

  const ruleSetName = `PUSH-2x3-${Date.now()}`;
  const ruleSetRes = await sb
    .from("sync_rule_set")
    .insert({ channel_id: channelId, name: ruleSetName, description: "2x3 final push", is_active: true })
    .select("rule_set_id")
    .single();
  if (ruleSetRes.error) throw new Error(ruleSetRes.error.message);
  const ruleSetId = ruleSetRes.data.rule_set_id as string;

  const r1Res = await sb.from("sync_rule_r1_material_delta").insert([
    {
      rule_set_id: ruleSetId,
      source_material_code: "14",
      target_material_code: "14",
      match_category_code: null,
      weight_min_g: 0,
      weight_max_g: 999999,
      option_weight_multiplier: 1,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    },
    {
      rule_set_id: ruleSetId,
      source_material_code: "14",
      target_material_code: "18",
      match_category_code: null,
      weight_min_g: 0,
      weight_max_g: 999999,
      option_weight_multiplier: 1,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 110,
      is_active: true,
    },
  ]);
  if (r1Res.error) throw new Error(r1Res.error.message);

  const r3Res = await sb.from("sync_rule_r3_color_margin").insert([
    {
      rule_set_id: ruleSetId,
      color_code: "P",
      margin_min_krw: 0,
      margin_max_krw: 0,
      delta_krw: 2000,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 100,
      is_active: true,
    },
    {
      rule_set_id: ruleSetId,
      color_code: "G",
      margin_min_krw: 0,
      margin_max_krw: 0,
      delta_krw: 4000,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 110,
      is_active: true,
    },
    {
      rule_set_id: ruleSetId,
      color_code: "W",
      margin_min_krw: 0,
      margin_max_krw: 0,
      delta_krw: 1000,
      rounding_unit: 100,
      rounding_mode: "CEIL",
      priority: 120,
      is_active: true,
    },
  ]);
  if (r3Res.error) throw new Error(r3Res.error.message);

  const selectedIds = new Set<string>();
  for (const plan of planRows) {
    const rows = rowsByVariant.get(plan.variantCode) ?? [];
    const ids = rows.map((r) => r.channel_product_id);
    selectedIds.add(ids[0]);
    const upd = await sb
      .from("sales_channel_product")
      .update({
        sync_rule_set_id: ruleSetId,
        option_price_mode: "SYNC",
        option_material_code: plan.material,
        option_color_code: plan.color,
        option_decoration_code: null,
        option_size_value: null,
        size_weight_delta_g: 0,
        sync_rule_material_enabled: true,
        sync_rule_weight_enabled: false,
        sync_rule_plating_enabled: true,
        sync_rule_decoration_enabled: false,
      })
      .in("channel_product_id", ids);
    if (upd.error) throw new Error(`update failed(${plan.variantCode}): ${upd.error.message}`);
  }

  const baseUpd = await sb
    .from("sales_channel_product")
    .update({
      sync_rule_set_id: ruleSetId,
      option_price_mode: "SYNC",
      option_material_code: "14",
      option_color_code: null,
      option_decoration_code: null,
      option_size_value: null,
      size_weight_delta_g: 0,
      sync_rule_material_enabled: true,
      sync_rule_weight_enabled: false,
      sync_rule_plating_enabled: false,
      sync_rule_decoration_enabled: false,
    })
    .eq("channel_product_id", baseRow.channel_product_id);
  if (baseUpd.error) throw new Error(baseUpd.error.message);

  const recomputeReq = new Request("http://local/api/pricing/recompute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel_id: channelId, master_item_ids: [MASTER_ITEM_ID] }),
  });
  const recomputeRes = await recomputePost(recomputeReq);
  const recomputeBody = await recomputeRes.json();
  if (!recomputeRes.ok) throw new Error(`recompute failed: ${JSON.stringify(recomputeBody)}`);

  const pushIds = [baseRow.channel_product_id, ...Array.from(selectedIds)];
  const pushReq = new Request("http://local/api/channel-prices/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel_id: channelId,
      channel_product_ids: pushIds,
      run_type: "MANUAL",
      dry_run: false,
      sync_option_labels: false,
    }),
  });
  const pushRes = await pushPost(pushReq);
  const pushBody = await pushRes.json();
  if (!pushRes.ok) throw new Error(`push failed: ${JSON.stringify(pushBody)}`);
  const jobId = String((pushBody as { job_id?: string }).job_id ?? "");
  if (!jobId) throw new Error("push job_id missing");

  const itemRes = await sb
    .from("price_sync_job_item")
    .select("channel_product_id, external_variant_code, target_price_krw, after_price_krw, status, error_code, error_message")
    .eq("job_id", jobId);
  if (itemRes.error) throw new Error(itemRes.error.message);

  const dashboardRes = await sb
    .from("v_channel_price_dashboard")
    .select("channel_product_id, external_variant_code, final_target_price_krw")
    .eq("channel_id", channelId)
    .eq("master_item_id", MASTER_ITEM_ID)
    .in("channel_product_id", Array.from(selectedIds));
  if (dashboardRes.error) throw new Error(dashboardRes.error.message);
  const targetByVariant = new Map<string, number>();
  for (const row of dashboardRes.data ?? []) {
    const code = String(row.external_variant_code ?? "").trim();
    const target = Number(row.final_target_price_krw ?? Number.NaN);
    if (code && Number.isFinite(target)) targetByVariant.set(code, Math.round(target));
  }

  const verifyResults: Array<{ variant_code: string; expected: number | null; current: number | null; ok: boolean; error?: string }> = [];
  for (const plan of planRows) {
    const expected = targetByVariant.get(plan.variantCode) ?? null;
    const v = await cafe24GetVariantPrice(account, token, externalProductNo, plan.variantCode);
    const current = v.currentPriceKrw ?? null;
    verifyResults.push({
      variant_code: plan.variantCode,
      expected,
      current,
      ok: expected !== null && current === expected,
      error: v.ok ? undefined : (v.error ?? `HTTP_${v.status}`),
    });
  }

  console.log(
    JSON.stringify(
      {
        channel_id: channelId,
        master_item_id: MASTER_ITEM_ID,
        external_product_no: externalProductNo,
        rule_set_id: ruleSetId,
        recompute: recomputeBody,
        push: pushBody,
        job_id: jobId,
        option_category_plan: planRows,
        verify_results: verifyResults,
      },
      null,
      2,
    ),
  );
};

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
