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
  const target = String(process.argv[2] || "13").trim();
  const env = loadEnv(path.resolve(__dirname, "../.env.local"));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const rowsRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id,channel_id,external_product_no,master_item_id,external_variant_code,is_active,updated_at")
    .eq("external_product_no", target)
    .order("updated_at", { ascending: false });
  if (rowsRes.error) throw new Error(rowsRes.error.message || "rows query failed");
  const rows = rowsRes.data || [];
  console.log("target", target, "rows", rows.length);
  const keys = new Set(rows.map((r) => `${r.channel_id}::${r.master_item_id}::${String(r.external_variant_code || "")}`));

  const allRes = await sb
    .from("sales_channel_product")
    .select("channel_product_id,channel_id,external_product_no,master_item_id,external_variant_code,is_active,updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (allRes.error) throw new Error(allRes.error.message || "active query failed");
  const conflicts = (allRes.data || []).filter((r) => keys.has(`${r.channel_id}::${r.master_item_id}::${String(r.external_variant_code || "")}`));
  for (const c of conflicts) console.log("CONFLICT", JSON.stringify(c));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
