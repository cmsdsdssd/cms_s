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

  const masterIds = process.argv.slice(2).map((v) => String(v || "").trim()).filter(Boolean);
  if (masterIds.length === 0) {
    console.error("usage: node scripts/measure-apply-latency.js <master_id...>");
    process.exit(1);
  }

  const logsRes = await sb
    .from("channel_option_apply_log_v1")
    .select("created_at, master_item_id, external_product_no, external_variant_code, action_type, result_status")
    .in("master_item_id", masterIds)
    .order("created_at", { ascending: false })
    .limit(3000);
  if (logsRes.error) throw new Error(logsRes.error.message || "log query failed");
  const logs = logsRes.data || [];

  const groups = new Map();
  for (const row of logs) {
    const key = `${row.master_item_id || ""}::${row.external_product_no || ""}::${row.external_variant_code || ""}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  for (const masterId of masterIds) {
    const perMaster = [];
    for (const [key, list] of groups.entries()) {
      if (!key.startsWith(`${masterId}::`)) continue;
      const requested = list.find((x) => x.action_type === "REQUESTED");
      const done = list.find((x) => x.action_type === "VERIFIED" || x.action_type === "FAILED");
      if (!requested || !done) continue;
      const t1 = Date.parse(requested.created_at);
      const t2 = Date.parse(done.created_at);
      if (!Number.isFinite(t1) || !Number.isFinite(t2) || t2 < t1) continue;
      perMaster.push({
        key,
        ms: t2 - t1,
        requested_at: requested.created_at,
        done_at: done.created_at,
        status: done.result_status,
      });
    }

    perMaster.sort((a, b) => b.done_at.localeCompare(a.done_at));
    const top = perMaster.slice(0, 12);
    const avg = top.length > 0 ? Math.round(top.reduce((s, x) => s + x.ms, 0) / top.length) : 0;
    const max = top.length > 0 ? Math.max(...top.map((x) => x.ms)) : 0;

    console.log(`master=${masterId} samples=${top.length} avg_ms=${avg} max_ms=${max}`);
    for (const item of top) {
      console.log(JSON.stringify(item));
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
