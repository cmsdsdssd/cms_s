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
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const targets = ["13", "14"];

  const before = await sb
    .from("sales_channel_product")
    .select("channel_product_id,channel_id,external_product_no,master_item_id,is_active,external_variant_code")
    .in("external_product_no", targets)
    .order("updated_at", { ascending: false });
  if (before.error) throw new Error(before.error.message || "before query failed");

  const rows = before.data || [];
  console.log("legacy_rows", rows.length);
  const active = rows.filter((r) => r.is_active === true);
  if (active.length > 0) {
    throw new Error(`legacy rows still active: ${active.length}. stop cleanup for safety`);
  }

  if (rows.length === 0) {
    console.log("nothing to cleanup");
    return;
  }

  const ids = rows.map((r) => r.channel_product_id);
  const del = await sb.from("sales_channel_product").delete().in("channel_product_id", ids);
  if (del.error) throw new Error(del.error.message || "delete failed");
  console.log("deleted_rows", ids.length);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
