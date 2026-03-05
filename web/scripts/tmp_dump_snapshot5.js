const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const toInt = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

async function main() {
  const channel = '9d7c22c7-8cf5-46e7-950b-59eced8b316e';

  const runRes = await sb
    .from('price_sync_run_v2')
    .select('run_id,pinned_compute_request_id,started_at,error_message')
    .eq('channel_id', channel)
    .not('error_message', 'like', 'CRON_TICK:%')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runRes.error) throw runRes.error;
  if (!runRes.data) {
    console.log(JSON.stringify({ error: 'NO_RUN' }, null, 2));
    return;
  }

  const run = runRes.data;
  const compute = String(run.pinned_compute_request_id ?? '').trim();
  if (!compute) {
    console.log(JSON.stringify({ error: 'NO_COMPUTE_REQUEST_ID', run }, null, 2));
    return;
  }

  const snapsRes = await sb
    .from('pricing_snapshot')
    .select('channel_id,master_item_id,channel_product_id,base_total_pre_margin_krw,margin_multiplier_used,material_raw_krw,material_final_krw,labor_raw_krw,labor_pre_margin_adj_krw,labor_post_margin_adj_krw,total_pre_margin_adj_krw,total_post_margin_adj_krw,total_after_margin_krw,target_price_raw_krw,rounded_target_price_krw,override_price_krw,floor_price_krw,final_target_before_floor_krw,floor_clamped,final_target_price_krw,tick_gold_krw_g,tick_silver_krw_g,delta_material_krw,delta_size_krw,delta_color_krw,delta_decor_krw,delta_other_krw,delta_total_krw,compute_request_id,computed_at,breakdown_json')
    .eq('channel_id', channel)
    .eq('compute_request_id', compute)
    .order('computed_at', { ascending: false });
  if (snapsRes.error) throw snapsRes.error;

  const snapshotRows = snapsRes.data ?? [];
  if (snapshotRows.length === 0) {
    console.log(JSON.stringify({ error: 'NO_SNAPSHOT_ROWS_FOR_COMPUTE', compute_request_id: compute }, null, 2));
    return;
  }

  const productIds = [...new Set(snapshotRows.map((r) => String(r.channel_product_id ?? '').trim()).filter(Boolean))];
  const mapRes = productIds.length
    ? await sb.from('sales_channel_product').select('channel_product_id,external_variant_code').in('channel_product_id', productIds)
    : { data: [], error: null };
  if (mapRes.error) throw mapRes.error;
  const variantByCp = new Map((mapRes.data ?? []).map((row) => [String(row.channel_product_id ?? ''), String(row.external_variant_code ?? '').trim() || null]));

  const byMaster = new Map();
  for (const row of snapshotRows) {
    const mid = String(row.master_item_id ?? '').trim();
    if (!mid) continue;
    const cp = String(row.channel_product_id ?? '').trim();
    const variant = variantByCp.get(cp);
    const prev = byMaster.get(mid);
    if (!prev) {
      byMaster.set(mid, row);
      continue;
    }
    const prevCp = String(prev.channel_product_id ?? '').trim();
    const prevVariant = variantByCp.get(prevCp);
    if (prevVariant && !variant) {
      byMaster.set(mid, row);
      continue;
    }
  }

  const selected = Array.from(byMaster.values()).slice(0, 5);
  const masterIds = selected.map((r) => String(r.master_item_id ?? '').trim()).filter(Boolean);

  const masterRes = masterIds.length
    ? await sb
      .from('cms_master_item')
      .select('master_item_id,labor_base_sell,labor_center_sell,labor_sub1_sell,labor_sub2_sell,plating_price_sell_default,labor_base_cost,labor_center_cost,labor_sub1_cost,labor_sub2_cost,plating_price_cost_default,center_qty_default,sub1_qty_default,sub2_qty_default')
      .in('master_item_id', masterIds)
    : { data: [], error: null };
  if (masterRes.error) throw masterRes.error;
  const masterById = new Map((masterRes.data ?? []).map((m) => [String(m.master_item_id ?? ''), m]));

  const absorbRes = masterIds.length
    ? await sb
      .from('cms_master_absorb_labor_item_v1')
      .select('master_id,bucket,amount_krw,labor_class,is_active')
      .in('master_id', masterIds)
      .eq('is_active', true)
    : { data: [], error: null };
  if (absorbRes.error) throw absorbRes.error;

  const absorbByMaster = new Map();
  for (const row of absorbRes.data ?? []) {
    const mid = String(row.master_id ?? '').trim();
    if (!mid) continue;
    const arr = absorbByMaster.get(mid) ?? [];
    arr.push(row);
    absorbByMaster.set(mid, arr);
  }

  const data = selected.map((source) => {
    const mid = String(source.master_item_id ?? '').trim();
    const cp = String(source.channel_product_id ?? '').trim();
    const breakdown = source.breakdown_json && typeof source.breakdown_json === 'object' ? source.breakdown_json : {};
    const mm = masterById.get(mid) ?? {};
    const masterCenterQty = Math.max(0, toInt(mm.center_qty_default));
    const masterSub1Qty = Math.max(0, toInt(mm.sub1_qty_default));
    const masterSub2Qty = Math.max(0, toInt(mm.sub2_qty_default));

    const masterLaborSellProfile =
      toInt(mm.labor_base_sell)
      + toInt(mm.labor_center_sell) * masterCenterQty
      + toInt(mm.labor_sub1_sell) * masterSub1Qty
      + toInt(mm.labor_sub2_sell) * masterSub2Qty
      + toInt(mm.plating_price_sell_default);

    const masterLaborCostProfile =
      toInt(mm.labor_base_cost)
      + toInt(mm.labor_center_cost) * masterCenterQty
      + toInt(mm.labor_sub1_cost) * masterSub1Qty
      + toInt(mm.labor_sub2_cost) * masterSub2Qty
      + toInt(mm.plating_price_cost_default);

    const absorbRows = absorbByMaster.get(mid) ?? [];
    let absorbTotal = 0;
    let absorbBaseLabor = 0;
    let absorbStoneLabor = 0;
    let absorbPlating = 0;
    let absorbEtc = 0;
    let absorbGeneralClass = 0;
    let absorbMaterialClass = 0;

    for (const row of absorbRows) {
      const amount = toInt(row.amount_krw);
      absorbTotal += amount;
      const bucket = String(row.bucket ?? '').trim().toUpperCase();
      if (bucket === 'BASE_LABOR') absorbBaseLabor += amount;
      else if (bucket === 'STONE_LABOR') absorbStoneLabor += amount;
      else if (bucket === 'PLATING') absorbPlating += amount;
      else absorbEtc += amount;

      const laborClass = String(row.labor_class ?? 'GENERAL').trim().toUpperCase();
      if (laborClass === 'MATERIAL') absorbMaterialClass += amount;
      else absorbGeneralClass += amount;
    }

    return {
      channel_id: String(source.channel_id ?? channel),
      master_item_id: mid,
      channel_product_id: cp,
      external_variant_code: variantByCp.get(cp) ?? null,
      master_base_price_krw: toInt(source.base_total_pre_margin_krw),
      shop_margin_multiplier: Number(source.margin_multiplier_used ?? 1) || 1,
      material_raw_krw: toInt(source.material_raw_krw),
      material_final_krw: toInt(source.material_final_krw),
      labor_raw_krw: toInt(source.labor_raw_krw),
      labor_pre_margin_adj_krw: toInt(source.labor_pre_margin_adj_krw),
      labor_post_margin_adj_krw: toInt(source.labor_post_margin_adj_krw),
      labor_sell_total_krw: toInt(breakdown.labor_sot_total_sell_krw),
      labor_sell_master_krw: toInt(breakdown.labor_sot_master_sell_krw),
      labor_sell_decor_krw: toInt(breakdown.labor_sot_decor_sell_krw),
      master_labor_base_sell_krw: toInt(mm.labor_base_sell),
      master_labor_center_sell_krw: toInt(mm.labor_center_sell),
      master_labor_sub1_sell_krw: toInt(mm.labor_sub1_sell),
      master_labor_sub2_sell_krw: toInt(mm.labor_sub2_sell),
      master_plating_sell_krw: toInt(mm.plating_price_sell_default),
      master_labor_base_cost_krw: toInt(mm.labor_base_cost),
      master_labor_center_cost_krw: toInt(mm.labor_center_cost),
      master_labor_sub1_cost_krw: toInt(mm.labor_sub1_cost),
      master_labor_sub2_cost_krw: toInt(mm.labor_sub2_cost),
      master_plating_cost_krw: toInt(mm.plating_price_cost_default),
      master_center_qty: masterCenterQty,
      master_sub1_qty: masterSub1Qty,
      master_sub2_qty: masterSub2Qty,
      master_labor_sell_profile_krw: masterLaborSellProfile,
      master_labor_cost_profile_krw: masterLaborCostProfile,
      absorb_item_count: absorbRows.length,
      absorb_total_krw: absorbTotal,
      absorb_base_labor_krw: absorbBaseLabor,
      absorb_stone_labor_krw: absorbStoneLabor,
      absorb_plating_krw: absorbPlating,
      absorb_etc_krw: absorbEtc,
      absorb_general_class_krw: absorbGeneralClass,
      absorb_material_class_krw: absorbMaterialClass,
      total_pre_margin_adj_krw: toInt(source.total_pre_margin_adj_krw),
      total_post_margin_adj_krw: toInt(source.total_post_margin_adj_krw),
      price_after_margin_krw: toInt(source.total_after_margin_krw),
      base_adjust_krw: toInt(breakdown.base_price_delta_krw),
      delta_material_krw: toInt(source.delta_material_krw),
      delta_size_krw: toInt(source.delta_size_krw),
      delta_color_krw: toInt(source.delta_color_krw),
      delta_decor_krw: toInt(source.delta_decor_krw),
      delta_other_krw: toInt(source.delta_other_krw),
      delta_total_krw: toInt(source.delta_total_krw),
      target_price_raw_krw: toInt(source.target_price_raw_krw),
      rounded_target_price_krw: toInt(source.rounded_target_price_krw),
      override_price_krw: source.override_price_krw == null ? null : toInt(source.override_price_krw),
      floor_price_krw: toInt(source.floor_price_krw),
      final_target_before_floor_krw: toInt(source.final_target_before_floor_krw),
      floor_clamped: Boolean(source.floor_clamped),
      final_target_price_krw: toInt(source.final_target_price_krw),
      tick_gold_krw_g: toInt(source.tick_gold_krw_g),
      tick_silver_krw_g: toInt(source.tick_silver_krw_g),
      compute_request_id: String(source.compute_request_id ?? compute),
      computed_at: String(source.computed_at ?? ''),
    };
  });

  console.log(JSON.stringify({
    run_id: run.run_id,
    compute_request_id: compute,
    rows: data,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
