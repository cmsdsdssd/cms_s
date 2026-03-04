const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const out = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

async function main() {
  const env = loadEnv(path.resolve(__dirname, "../.env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const log = await sb
    .from("channel_option_apply_log_v1")
    .select("created_at,channel_id,external_product_no,master_item_id,action_type,result_status,error_message")
    .order("created_at", { ascending: false })
    .limit(80);
  if (log.error) throw new Error(log.error.message || "log query failed");

  const rows = log.data || [];
  const misses = rows.filter((r) => String(r.error_message || "").includes("master_item_id is required") || (r.action_type === "REQUESTED" && !r.master_item_id));
  console.log("recent_rows", rows.length);
  console.log("master_missing_related", misses.length);
  for (const r of misses.slice(0, 12)) console.log(JSON.stringify(r));

  const products = [...new Set(misses.map((r) => String(r.external_product_no || "").trim()).filter(Boolean))].slice(0, 40);
  if (products.length === 0) {
    console.log("no product candidates from logs");
  } else {
    const map = await sb
      .from("sales_channel_product")
      .select("channel_id,external_product_no,master_item_id,is_active,external_variant_code,updated_at")
      .in("external_product_no", products)
      .order("updated_at", { ascending: false });
    if (map.error) throw new Error(map.error.message || "mapping query failed");

    const grouped = new Map();
    for (const r of map.data || []) {
      const k = `${String(r.channel_id)}::${String(r.external_product_no)}`;
      const list = grouped.get(k) || [];
      list.push(r);
      grouped.set(k, list);
    }

    console.log("mapping_groups", grouped.size);
    for (const [k, v] of Array.from(grouped.entries()).slice(0, 30)) {
      const active = v.filter((x) => x.is_active === true);
      const masters = [...new Set(v.map((x) => x.master_item_id))];
      console.log(k, "rows", v.length, "active", active.length, "masters", masters.length);
    }
  }

  const all = await sb
    .from("sales_channel_product")
    .select("channel_id,external_product_no,master_item_id,is_active,external_variant_code,updated_at")
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (all.error) throw new Error(all.error.message || "all mapping query failed");

  const groupAll = new Map();
  for (const r of all.data || []) {
    const k = `${String(r.channel_id)}::${String(r.external_product_no)}`;
    const list = groupAll.get(k) || [];
    list.push(r);
    groupAll.set(k, list);
  }

  const noActive = [];
  const multiMaster = [];
  const summary = [];
  for (const [k, v] of groupAll.entries()) {
    const activeCnt = v.filter((x) => x.is_active === true).length;
    const masters = [...new Set(v.map((x) => String(x.master_item_id)))];
    summary.push({ key: k, rows: v.length, active: activeCnt, masters: masters.length });
    if (activeCnt === 0) noActive.push({ key: k, rows: v.length, masters: masters.length });
    if (masters.length > 1) multiMaster.push({ key: k, rows: v.length, masters: masters.length });
  }
  console.log("all_groups", groupAll.size);
  console.log("integrity_no_active", noActive.length);
  console.log("integrity_multi_master", multiMaster.length);
  for (const r of summary.slice(0, 30)) console.log("GROUP", JSON.stringify(r));
  for (const r of noActive.slice(0, 20)) console.log("NO_ACTIVE", JSON.stringify(r));
  for (const r of multiMaster.slice(0, 20)) console.log("MULTI_MASTER", JSON.stringify(r));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
