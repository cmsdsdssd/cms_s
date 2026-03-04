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
  const productNo = String(process.argv[2] || "").trim();

  let q = sb
    .from("channel_option_apply_log_v1")
    .select("created_at,master_item_id,external_product_no,external_variant_code,action_type,result_status,expected_additional_amount_krw,actual_additional_amount_krw,error_message")
    .order("created_at", { ascending: false })
    .limit(120);
  if (productNo) q = q.eq("external_product_no", productNo);

  const res = await q;
  if (res.error) throw new Error(res.error.message || "log query failed");
  const rows = res.data || [];
  console.log("rows", rows.length, "product", productNo || "(all)");
  for (const r of rows.slice(0, 40)) {
    console.log(JSON.stringify(r));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
