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
  const targets = process.argv.slice(2).map((v) => String(v || "").trim()).filter(Boolean);
  const productNos = targets.length > 0 ? targets : ["13", "14"];

  for (const targetNo of productNos) {
    const targetRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id,channel_id,external_product_no,master_item_id,external_variant_code,is_active,updated_at")
      .eq("external_product_no", targetNo)
      .order("updated_at", { ascending: false });
    if (targetRes.error) throw new Error(`[${targetNo}] target query failed: ${targetRes.error.message}`);
    const targetRows = targetRes.data || [];
    if (targetRows.length === 0) {
      console.log(`[${targetNo}] no target rows`);
      continue;
    }

    const masters = [...new Set(targetRows.map((r) => String(r.master_item_id)))];
    if (masters.length !== 1) throw new Error(`[${targetNo}] expected single master, got ${masters.length}`);
    const channelIds = [...new Set(targetRows.map((r) => String(r.channel_id)))];
    if (channelIds.length !== 1) throw new Error(`[${targetNo}] expected single channel, got ${channelIds.length}`);

    const channelId = channelIds[0];
    const masterId = masters[0];
    const variantSet = new Set(targetRows.map((r) => String(r.external_variant_code || "")));

    const activeRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id,channel_id,external_product_no,master_item_id,external_variant_code,is_active,updated_at")
      .eq("channel_id", channelId)
      .eq("master_item_id", masterId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (activeRes.error) throw new Error(`[${targetNo}] active query failed: ${activeRes.error.message}`);

    const matchingActive = (activeRes.data || []).filter((r) => variantSet.has(String(r.external_variant_code || "")));
    const sourceNos = [...new Set(matchingActive.map((r) => String(r.external_product_no)))].filter((v) => v !== targetNo);
    if (sourceNos.length !== 1) {
      throw new Error(`[${targetNo}] expected exactly one active source product_no, got ${sourceNos.join(",") || "none"}`);
    }
    const sourceNo = sourceNos[0];

    const inactiveTargetRows = targetRows.filter((r) => r.is_active !== true);
    for (const row of inactiveTargetRows) {
      const suffix = String(row.channel_product_id).replace(/-/g, "").slice(0, 8);
      const legacyNo = `LEGACY_${targetNo}_${suffix}`;
      const upd = await sb
        .from("sales_channel_product")
        .update({ external_product_no: legacyNo })
        .eq("channel_product_id", row.channel_product_id);
      if (upd.error) throw new Error(`[${targetNo}] legacy quarantine failed: ${upd.error.message}`);
    }

    for (const row of matchingActive) {
      const upd = await sb
        .from("sales_channel_product")
        .update({ external_product_no: targetNo })
        .eq("channel_product_id", row.channel_product_id);
      if (upd.error) throw new Error(`[${targetNo}] active remap failed: ${upd.error.message}`);
    }

    console.log(`[${targetNo}] source ${sourceNo} -> target remapped, variants=${matchingActive.length}, quarantined=${inactiveTargetRows.length}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
