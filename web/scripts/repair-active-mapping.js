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
  const targets = process.argv.slice(2).map((v) => String(v || "").trim()).filter(Boolean);
  const effectiveTargets = targets.length > 0 ? targets : ["13"];

  const before = await sb
    .from("sales_channel_product")
    .select("channel_product_id,channel_id,external_product_no,master_item_id,is_active")
    .in("external_product_no", effectiveTargets)
    .order("updated_at", { ascending: false });
  if (before.error) throw new Error(before.error.message || "before query failed");

  const rows = before.data || [];
  if (rows.length === 0) {
    console.log("no rows found for targets", effectiveTargets.join(","));
    return;
  }

  const keepActiveIds = new Set();
  for (const r of rows) {
    const variant = String(r.external_variant_code || "");
    const key = `${r.channel_id}::${r.master_item_id}::${variant}`;
    if (!keepActiveIds.has(key)) {
      keepActiveIds.add(key);
    }
  }

  const selectedChannelProductIds = new Set();
  const seen = new Set();
  for (const r of rows) {
    const variant = String(r.external_variant_code || "");
    const key = `${r.channel_id}::${r.master_item_id}::${variant}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selectedChannelProductIds.add(r.channel_product_id);
  }

  const activateIds = Array.from(selectedChannelProductIds);
  const upd = await sb
    .from("sales_channel_product")
    .update({ is_active: true })
    .in("channel_product_id", activateIds)
    .select("channel_product_id,channel_id,external_product_no,master_item_id,external_variant_code,is_active");
  if (upd.error) throw new Error(upd.error.message || "activate failed");

  const after = await sb
    .from("sales_channel_product")
    .select("channel_id,external_product_no,master_item_id,is_active")
    .in("external_product_no", effectiveTargets)
    .order("updated_at", { ascending: false });
  if (after.error) throw new Error(after.error.message || "after query failed");

  const summary = new Map();
  for (const r of after.data || []) {
    const k = `${r.channel_id}::${r.external_product_no}`;
    const s = summary.get(k) || { rows: 0, active: 0, masters: new Set() };
    s.rows += 1;
    if (r.is_active === true) s.active += 1;
    s.masters.add(String(r.master_item_id));
    summary.set(k, s);
  }

  console.log("updated_rows", (upd.data || []).length);
  for (const [k, s] of summary.entries()) {
    console.log("GROUP", k, "rows", s.rows, "active", s.active, "masters", s.masters.size);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
