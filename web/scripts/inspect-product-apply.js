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
  const productNo = String(process.argv[2] || "").trim();
  if (!productNo) {
    console.error("usage: node scripts/inspect-product-apply.js <product_no>");
    process.exit(1);
  }
  const env = loadEnv(path.resolve(__dirname, "../.env.local"));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const logsRes = await sb
    .from("channel_option_apply_log_v1")
    .select("created_at,master_item_id,external_product_no,external_variant_code,action_type,result_status,expected_additional_amount_krw,actual_additional_amount_krw,error_message")
    .eq("external_product_no", productNo)
    .order("created_at", { ascending: false })
    .limit(80);
  if (logsRes.error) throw new Error(logsRes.error.message || "log query failed");

  const rows = logsRes.data || [];
  console.log("rows", rows.length);
  for (const r of rows.slice(0, 20)) {
    console.log(JSON.stringify(r));
  }

  const stateRes = await sb
    .from("channel_option_current_state_v1")
    .select("external_variant_code,last_push_status,last_pushed_additional_amount_krw,last_push_error,last_pushed_at,last_verified_at")
    .eq("external_product_no", productNo)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (stateRes.error) throw new Error(stateRes.error.message || "state query failed");
  console.log("state_rows", (stateRes.data || []).length);
  for (const r of (stateRes.data || []).slice(0, 20)) {
    console.log(JSON.stringify(r));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
