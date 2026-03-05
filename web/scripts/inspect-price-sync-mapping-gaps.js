const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    throw new Error(
      [
        `env file not found: ${filePath}`,
        "expected web/.env.local to include:",
        "  NEXT_PUBLIC_SUPABASE_URL=...",
        "  SUPABASE_SERVICE_ROLE_KEY=...",
      ].join("\n"),
    );
  }

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv) {
  const out = { _: [] };
  const xs = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < xs.length; i += 1) {
    const raw = String(xs[i] || "");
    if (!raw) continue;
    if (raw === "--help" || raw === "-h") {
      out.help = true;
      continue;
    }
    if (!raw.startsWith("--")) {
      out._.push(raw);
      continue;
    }

    const eq = raw.indexOf("=");
    const key = (eq >= 0 ? raw.slice(2, eq) : raw.slice(2)).trim();
    if (!key) continue;

    if (eq >= 0) {
      out[key] = raw.slice(eq + 1);
      continue;
    }

    const next = i + 1 < xs.length ? String(xs[i + 1] || "") : "";
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
      continue;
    }

    out[key] = true;
  }
  return out;
}

function toInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function usage() {
  return [
    "inspect-price-sync-mapping-gaps.js",
    "",
    "Usage:",
    "  node web/scripts/inspect-price-sync-mapping-gaps.js --channel-id <channel_id> [options]",
    "",
    "Required:",
    "  --channel-id <id>             Sales channel id",
    "",
    "Options:",
    "  --compute-request-id <id>     Inspect this compute request id only",
    "  --snapshot-limit <n>          Snapshot rows fetched before analysis (default: 12000)",
    "  --sample-limit <n>            Missing sample rows to print (default: 12)",
    "",
    "Notes:",
    "  - Reads Supabase creds from web/.env.local",
    "  - If --compute-request-id is omitted, prefers latest compute_request_id seen in snapshot rows",
    "    then latest pricing_compute_cursor.compute_request_id that exists in snapshot rows,",
    "    and finally falls back to most frequent compute_request_id in fetched snapshot rows",
    "",
    "Examples:",
    "  node web/scripts/inspect-price-sync-mapping-gaps.js --channel-id <channel_id>",
    "  node web/scripts/inspect-price-sync-mapping-gaps.js --channel-id <channel_id> --compute-request-id <id>",
    "",
  ].join("\n");
}

function chunk(items, size) {
  const xs = Array.isArray(items) ? items : [];
  const out = [];
  const step = Math.max(1, Math.floor(Number(size) || 1));
  for (let i = 0; i < xs.length; i += step) out.push(xs.slice(i, i + step));
  return out;
}

function isTruthyText(v) {
  return String(v ?? "").trim().length > 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const channelId = String(args["channel-id"] ?? "").trim();
  if (!channelId) {
    console.log(usage());
    throw new Error("--channel-id is required");
  }

  const computeRequestIdInput = String(args["compute-request-id"] ?? "").trim();
  const snapshotLimit = toInt(args["snapshot-limit"], 12000);
  const sampleLimit = toInt(args["sample-limit"], 12);

  const env = loadEnv(path.resolve(__dirname, "../.env.local"));
  const sbUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const sbKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sbUrl || !sbKey) throw new Error("missing supabase env");

  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  console.log("channel_id", channelId);
  console.log("snapshot_limit", snapshotLimit);

  const snapRes = await sb
    .from("pricing_snapshot")
    .select("compute_request_id,channel_product_id,master_item_id,computed_at")
    .eq("channel_id", channelId)
    .not("channel_product_id", "is", null)
    .order("computed_at", { ascending: false })
    .limit(snapshotLimit);
  if (snapRes.error) throw new Error(snapRes.error.message || "pricing_snapshot query failed");

  const fetchedRows = (snapRes.data || []).map((r) => ({
    compute_request_id: String(r.compute_request_id ?? "").trim(),
    channel_product_id: String(r.channel_product_id ?? "").trim(),
    master_item_id: String(r.master_item_id ?? "").trim(),
    computed_at: String(r.computed_at ?? "").trim(),
  }));

  if (fetchedRows.length === 0) {
    console.log("snapshot_rows", 0);
    console.log("no snapshot rows found for this channel");
    return;
  }

  let computeRequestId = computeRequestIdInput;
  let computeRequestSource = computeRequestIdInput ? "arg" : "";
  if (!computeRequestId) {
    const latestSnapshotRow = fetchedRows.find((r) => isTruthyText(r.compute_request_id));
    if (latestSnapshotRow) {
      computeRequestId = latestSnapshotRow.compute_request_id;
      computeRequestSource = "snapshot_latest";
    }
  }
  if (!computeRequestId) {
    const cursorRes = await sb
      .from("pricing_compute_cursor")
      .select("compute_request_id,computed_at")
      .eq("channel_id", channelId)
      .order("computed_at", { ascending: false })
      .limit(2000);
    if (cursorRes.error) throw new Error(cursorRes.error.message || "pricing_compute_cursor query failed");

    const fetchedSet = new Set(fetchedRows.map((r) => r.compute_request_id).filter(Boolean));
    const cursorIds = (cursorRes.data || [])
      .map((r) => String(r.compute_request_id ?? "").trim())
      .filter(Boolean);
    const matchedCursor = cursorIds.find((id) => fetchedSet.has(id));
    if (matchedCursor) {
      computeRequestId = matchedCursor;
      computeRequestSource = "pricing_compute_cursor";
    } else if (cursorIds.length > 0) {
      computeRequestId = cursorIds[0];
      computeRequestSource = "pricing_compute_cursor_unseen_in_snapshot_window";
    }
  }
  if (!computeRequestId) {
    const byComputeId = new Map();
    for (const row of fetchedRows) {
      const id = row.compute_request_id || "(missing)";
      byComputeId.set(id, (byComputeId.get(id) || 0) + 1);
    }
    const computeCandidate = Array.from(byComputeId.entries()).sort((a, b) => b[1] - a[1])[0];
    computeRequestId = computeCandidate ? computeCandidate[0] : "";
    computeRequestSource = "snapshot_frequency";
  }
  const effectiveRows = fetchedRows.filter((r) => (computeRequestId ? r.compute_request_id === computeRequestId : true));

  console.log("snapshot_rows_fetched", fetchedRows.length);
  console.log("compute_request_id", computeRequestId || "(missing)");
  console.log("compute_request_source", computeRequestSource || "(none)");
  console.log("snapshot_rows_effective", effectiveRows.length);
  if (effectiveRows.length === 0) {
    console.log("no rows for selected compute_request_id");
    return;
  }

  const uniqueChannelProductIds = Array.from(new Set(effectiveRows.map((r) => r.channel_product_id).filter(Boolean)));
  console.log("snapshot_unique_channel_products", uniqueChannelProductIds.length);

  const activeRows = [];
  for (const ids of chunk(uniqueChannelProductIds, 500)) {
    const mapRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id,is_active,external_product_no,external_variant_code,master_item_id,updated_at")
      .eq("channel_id", channelId)
      .in("channel_product_id", ids);
    if (mapRes.error) throw new Error(mapRes.error.message || "sales_channel_product(active) query failed");
    activeRows.push(...(mapRes.data || []));
  }

  const activeByChannelProductId = new Map();
  for (const row of activeRows) {
    if (row.is_active !== true) continue;
    if (!isTruthyText(row.external_product_no)) continue;
    const cp = String(row.channel_product_id ?? "").trim();
    if (!cp) continue;
    const list = activeByChannelProductId.get(cp) || [];
    list.push(row);
    activeByChannelProductId.set(cp, list);
  }

  const missingRows = effectiveRows.filter((row) => !activeByChannelProductId.has(row.channel_product_id));
  const missingProductIds = Array.from(new Set(missingRows.map((r) => r.channel_product_id).filter(Boolean)));
  const missingMasterIds = Array.from(new Set(missingRows.map((r) => r.master_item_id).filter(Boolean)));

  console.log("missing_active_mapping_row_count", missingRows.length);
  console.log("missing_active_mapping_product_count", missingProductIds.length);
  console.log("missing_active_mapping_master_count", missingMasterIds.length);

  for (const row of missingRows.slice(0, sampleLimit)) {
    console.log(
      "missing_sample",
      JSON.stringify({
        channel_product_id: row.channel_product_id,
        master_item_id: row.master_item_id || null,
        compute_request_id: row.compute_request_id || null,
      }),
    );
  }

  if (missingProductIds.length === 0) {
    console.log("no missing active mapping detected for selected snapshot scope");
    return;
  }

  const allRowsForMissing = [];
  for (const ids of chunk(missingProductIds, 500)) {
    const mapRes = await sb
      .from("sales_channel_product")
      .select("channel_product_id,is_active,external_product_no,external_variant_code,master_item_id,updated_at")
      .eq("channel_id", channelId)
      .in("channel_product_id", ids)
      .order("updated_at", { ascending: false });
    if (mapRes.error) throw new Error(mapRes.error.message || "sales_channel_product(missing) query failed");
    allRowsForMissing.push(...(mapRes.data || []));
  }

  const byProduct = new Map();
  for (const row of allRowsForMissing) {
    const cp = String(row.channel_product_id ?? "").trim();
    if (!cp) continue;
    const list = byProduct.get(cp) || [];
    list.push(row);
    byProduct.set(cp, list);
  }

  const repairCandidates = new Set();
  for (const cp of missingProductIds) {
    const rows = byProduct.get(cp) || [];
    const activeCount = rows.filter((r) => r.is_active === true).length;
    const withExternal = rows.filter((r) => isTruthyText(r.external_product_no));
    const externalProducts = Array.from(new Set(withExternal.map((r) => String(r.external_product_no).trim())));
    for (const no of externalProducts) repairCandidates.add(no);
    console.log(
      "missing_mapping_detail",
      JSON.stringify({
        channel_product_id: cp,
        rows: rows.length,
        active_count: activeCount,
        external_product_no_candidates: externalProducts,
      }),
    );
  }

  const candidateList = Array.from(repairCandidates).sort((a, b) => a.localeCompare(b));
  if (candidateList.length > 0) {
    console.log("repair_external_product_no_candidates", candidateList.join(","));
    console.log(
      "repair_command_hint",
      `node web/scripts/repair-active-mapping.js ${candidateList.map((v) => `"${v}"`).join(" ")}`,
    );
  } else {
    console.log("repair_external_product_no_candidates", "(none)");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
