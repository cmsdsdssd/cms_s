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
      ].join(String.fromCharCode(10)),
    );
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkArray(items, chunkSize) {
  const xs = Array.isArray(items) ? items : [];
  const size = Math.max(1, Math.floor(Number(chunkSize) || 1));
  const out = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const raw = String(args[i] || "");
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
    const hasInlineValue = eq >= 0;
    const inlineValue = hasInlineValue ? raw.slice(eq + 1) : null;
    if (!key) continue;

    const next = i + 1 < args.length ? String(args[i + 1] || "") : "";
    const nextLooksValue = next && !next.startsWith("--");

    if (hasInlineValue) {
      out[key] = inlineValue;
      continue;
    }
    if (nextLooksValue) {
      out[key] = next;
      i += 1;
      continue;
    }
    out[key] = true;
  }
  return out;
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "1" || s === "true" || s === "y" || s === "yes";
}

function toNullableInt(v) {
  if (v === true) return null;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function usage() {
  return [
    "verify-auto-price-v2-run.js",
    "",
    "Usage:",
    "  node web/scripts/verify-auto-price-v2-run.js --channel-id <channel_id> [options]",
    "",
    "Required:",
    "  --channel-id <id>            Sales channel id (required)",
    "",
    "Options:",
    "  --base-url <url>             Default: http://localhost:3000",
    "  --compute-request-id <id>    Pin compute_request_id (optional)",
    "  --force-full-sync            Force full sync (skip interval gating)",
    "  --min-change-krw <n>         Override min change threshold (KRW)",
    "  --execute-loops <n>          Default: 12 (0 = create only)",
    "  --poll-ms <n>                Default: 1000",
    "  --mall-id <id>               Also call storefront option breakdown",
    "  --product-no <no>            Also call storefront option breakdown",
    "  --token <token>              Optional token for storefront breakdown",
    "",
    "Examples:",
    "  CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --force-full-sync",
    "  CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --execute-loops 0",
    "  CMS_E2E_BYPASS_AUTH=1 pnpm -C web verify:auto-price-v2 -- --channel-id <channel_id> --mall-id <mall_id> --product-no <product_no>",
    "",
    "Notes:",
    "  - /api/* endpoints are auth-guarded unless CMS_E2E_BYPASS_AUTH=1.",
    "  - Requires web/.env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
    "",
  ].join("\n");
}

function normalizeBaseUrl(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function httpJson(method, url, payload, headers) {
  if (typeof fetch !== "function") {
    throw new Error("global fetch is not available (requires Node 18+)");
  }
  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  };
  if (payload !== undefined && method !== "GET" && method !== "HEAD") init.body = JSON.stringify(payload);

  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  const json = (() => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  })();
  return { ok: res.ok, status: res.status, json };
}

function pickMissingMappingSummary(obj) {
  const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  return {
    snapshot_rows_with_channel_product_count: Number(o.snapshot_rows_with_channel_product_count ?? 0) || 0,
    missing_active_mapping_row_count: Number(o.missing_active_mapping_row_count ?? 0) || 0,
    missing_active_mapping_product_count: Number(o.missing_active_mapping_product_count ?? 0) || 0,
    missing_active_mapping_master_count: Number(o.missing_active_mapping_master_count ?? 0) || 0,
  };
}

function printMissingMapping(label, obj) {
  const s = pickMissingMappingSummary(obj);
  console.log(
    label,
    "snapshot_rows_with_cp",
    s.snapshot_rows_with_channel_product_count,
    "missing_rows",
    s.missing_active_mapping_row_count,
    "missing_products",
    s.missing_active_mapping_product_count,
    "missing_masters",
    s.missing_active_mapping_master_count,
  );

  const samples = pickMissingMappingSamples(obj);
  console.log(label, 'missing_samples', samples.length);
  for (const s of samples.slice(0, 3)) console.log(label, 'missing_sample', JSON.stringify(s));
}

function pickMissingMappingSamples(obj) {
  const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  const raw = o.missing_active_mapping_samples;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => v && typeof v === "object");
}

function printMissingMappingSamples(label, obj) {
  const samples = pickMissingMappingSamples(obj);
  if (samples.length === 0) {
    console.log(label, "missing_samples", 0);
    return;
  }
  console.log(label, "missing_samples", samples.length);
  for (const s of samples.slice(0, 3)) console.log(label, "missing_sample", JSON.stringify(s));
}

function summarizeRunPayloadSummary(runRow) {
  const payload =
    runRow && typeof runRow.request_payload === "object" && runRow.request_payload && !Array.isArray(runRow.request_payload)
      ? runRow.request_payload
      : null;
  const summary =
    payload && typeof payload.summary === "object" && payload.summary && !Array.isArray(payload.summary)
      ? payload.summary
      : null;
  return summary || null;
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

  const baseUrl = normalizeBaseUrl(args["base-url"]);
  const computeRequestId = String(args["compute-request-id"] ?? "").trim();
  const forceFullSync = toBool(args["force-full-sync"] ?? false);
  const minChangeKrw = toNullableInt(args["min-change-krw"]);
  const executeLoops = Math.max(0, toNullableInt(args["execute-loops"]) ?? 12);
  const pollMs = Math.max(0, toNullableInt(args["poll-ms"]) ?? 1000);

  const mallId = String(args["mall-id"] ?? "").trim();
  const productNo = String(args["product-no"] ?? "").trim();
  const token = String(args.token ?? "").trim();

  const env = loadEnv(path.resolve(__dirname, "../.env.local"));
  const sbUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    throw new Error(
      [
        'missing Supabase env in web/.env.local',
        'required:',
        '  NEXT_PUBLIC_SUPABASE_URL',
        '  SUPABASE_SERVICE_ROLE_KEY',
      ].join(String.fromCharCode(10)),
    );
  }
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  console.log("base_url", baseUrl);
  console.log("env_source", "web/.env.local");
  console.log("channel_id", channelId);
  if (computeRequestId) console.log("compute_request_id", computeRequestId);
  console.log("force_full_sync", forceFullSync);
  if (minChangeKrw !== null) console.log("min_change_krw", minChangeKrw);
  console.log("execute_loops", executeLoops, "poll_ms", pollMs);

  const createPayload = {
    channel_id: channelId,
    ...(computeRequestId ? { compute_request_id: computeRequestId } : {}),
    ...(minChangeKrw !== null ? { min_change_krw: minChangeKrw } : {}),
    force_full_sync: forceFullSync,
  };

  const createRes = await httpJson("POST", `${baseUrl}/api/price-sync-runs-v2`, createPayload);
  if (!createRes.ok) {
    console.log("create_status", createRes.status);
    console.log("create_body", JSON.stringify(createRes.json));
    if (createRes.status === 401) {
      throw new Error("unauthorized: set CMS_E2E_BYPASS_AUTH=1 (or run with a logged-in session) to call /api/*");
    }
    throw new Error("create failed");
  }

  const createJson = createRes.json && typeof createRes.json === "object" ? createRes.json : {};
  const runId = String(createJson.run_id ?? "").trim();
  const skipped = createJson.skipped === true;
  const skipReason = String(createJson.skip_reason ?? "").trim();
  const totalCount = Number(createJson.total_count ?? 0);

  console.log(
    "create_ok",
    true,
    "run_id",
    runId || "(missing)",
    "skipped",
    skipped ? "yes" : "no",
    skipReason ? `reason=${skipReason}` : "",
  );
  if (Number.isFinite(totalCount)) console.log("create_total_count", Math.max(0, Math.floor(totalCount)));
  if (Array.isArray(createJson.compute_request_ids)) console.log("create_compute_request_ids", createJson.compute_request_ids.length);
  printMissingMapping("missing_mapping_create", createJson);
  printMissingMappingSamples("missing_mapping_create", createJson);
  printMissingMappingSamples("missing_mapping_create", createJson);
  printMissingMappingSamples("missing_mapping_create", createJson);
  printMissingMappingSamples("missing_mapping_create", createJson);
  printMissingMappingSamples("missing_mapping_create", createJson);
  if (!runId) throw new Error("run_id missing in create response");

  const runBefore = await sb
    .from("price_sync_run_v2")
    .select(
      "run_id, channel_id, status, total_count, success_count, failed_count, skipped_count, started_at, finished_at, error_message, pinned_compute_request_id, request_payload, created_at",
    )
    .eq("run_id", runId)
    .maybeSingle();
  if (runBefore.error) throw new Error(runBefore.error.message || "run query failed");
  if (!runBefore.data) throw new Error("run row not found");

  const persistedSummary = summarizeRunPayloadSummary(runBefore.data);
  printMissingMapping("missing_mapping_persisted", persistedSummary || {});
  printMissingMappingSamples("missing_mapping_persisted", persistedSummary || {});
  printMissingMappingSamples("missing_mapping_persisted", persistedSummary || {});
  printMissingMappingSamples("missing_mapping_persisted", persistedSummary || {});
  printMissingMappingSamples("missing_mapping_persisted", persistedSummary || {});
  printMissingMappingSamples("missing_mapping_persisted", persistedSummary || {});
  if (persistedSummary) {
    const minChange = Number(persistedSummary.threshold_min_change_krw ?? Number.NaN);
    const evaluated = Number(persistedSummary.threshold_evaluated_count ?? Number.NaN);
    const filtered = Number(persistedSummary.threshold_filtered_count ?? Number.NaN);
    const forced = Number(persistedSummary.market_gap_forced_count ?? Number.NaN);
    const downsync = Number(persistedSummary.downsync_suppressed_count ?? Number.NaN);
    if (Number.isFinite(minChange)) console.log("persisted_threshold_min_change_krw", Math.round(minChange));
    if (Number.isFinite(evaluated)) console.log("persisted_threshold_evaluated_count", Math.max(0, Math.floor(evaluated)));
    if (Number.isFinite(filtered)) console.log("persisted_threshold_filtered_count", Math.max(0, Math.floor(filtered)));
    if (Number.isFinite(forced)) console.log("persisted_market_gap_forced_count", Math.max(0, Math.floor(forced)));
    if (Number.isFinite(downsync)) console.log("persisted_downsync_suppressed_count", Math.max(0, Math.floor(downsync)));
  }

  if (!skipped && executeLoops > 0) {
    for (let round = 0; round < executeLoops; round += 1) {
      const execRes = await httpJson(
        "POST",
        `${baseUrl}/api/price-sync-runs-v2/${encodeURIComponent(runId)}/execute`,
        {},
      );
      if (!execRes.ok) {
        console.log("execute_status", execRes.status, "round", round + 1);
        console.log("execute_body", JSON.stringify(execRes.json));
        if (execRes.status === 401) {
          throw new Error("unauthorized: set CMS_E2E_BYPASS_AUTH=1 (or run with a logged-in session) to call /api/*");
        }
        throw new Error("execute failed");
      }

      const execJson = execRes.json && typeof execRes.json === "object" ? execRes.json : {};
      const status = String(execJson.status ?? "").trim().toUpperCase() || "(missing)";
      const pending = Number(execJson.pending ?? Number.NaN);
      const success = Number(execJson.success ?? Number.NaN);
      const failed = Number(execJson.failed ?? Number.NaN);
      const skippedCnt = Number(execJson.skipped ?? Number.NaN);
      const processed = Number(execJson.processed_pending_batch ?? Number.NaN);

      const parts = ["execute", `round=${round + 1}`, `status=${status}`];
      if (Number.isFinite(pending)) parts.push(`pending=${Math.max(0, Math.floor(pending))}`);
      if (Number.isFinite(processed)) parts.push(`processed=${Math.max(0, Math.floor(processed))}`);
      if (Number.isFinite(success)) parts.push(`success=${Math.max(0, Math.floor(success))}`);
      if (Number.isFinite(failed)) parts.push(`failed=${Math.max(0, Math.floor(failed))}`);
      if (Number.isFinite(skippedCnt)) parts.push(`skipped=${Math.max(0, Math.floor(skippedCnt))}`);
      console.log(parts.join(" "));

      if (status !== "RUNNING") break;
      if (Number.isFinite(pending) && pending <= 0) break;
      if (pollMs > 0) await sleep(pollMs);
    }
  } else {
    if (skipped) console.log("execute_skipped", skipReason || "(no reason)");
    else console.log("execute_skipped", "execute_loops=0");
  }

  const runAfter = await sb
    .from("price_sync_run_v2")
    .select(
      "run_id, channel_id, status, total_count, success_count, failed_count, skipped_count, started_at, finished_at, error_message, pinned_compute_request_id, request_payload",
    )
    .eq("run_id", runId)
    .maybeSingle();
  if (runAfter.error) throw new Error(runAfter.error.message || "run(after) query failed");
  if (!runAfter.data) throw new Error("run(after) row not found");
  console.log(
    "run",
    `status=${String(runAfter.data.status ?? "").trim() || "(missing)"}`,
    `total=${Number(runAfter.data.total_count ?? 0) || 0}`,
    `success=${Number(runAfter.data.success_count ?? 0) || 0}`,
    `failed=${Number(runAfter.data.failed_count ?? 0) || 0}`,
    `skipped=${Number(runAfter.data.skipped_count ?? 0) || 0}`,
  );
  if (runAfter.data.error_message) console.log("run_error", String(runAfter.data.error_message));

  const intentRes = await sb
    .from("price_sync_intent_v2")
    .select("intent_id, state")
    .eq("run_id", runId);
  if (intentRes.error) throw new Error(intentRes.error.message || "intent query failed");
  const intents = (intentRes.data || [])
    .map((r) => ({ intent_id: String(r.intent_id ?? "").trim(), state: String(r.state ?? "").trim().toUpperCase() }))
    .filter((r) => r.intent_id);

  const intentStateCounts = new Map();
  for (const row of intents) {
    const state = row.state || "(missing)";
    intentStateCounts.set(state, (intentStateCounts.get(state) || 0) + 1);
  }
  console.log("intents", intents.length);
  for (const [k, v] of Array.from(intentStateCounts.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log("intent_state", k, v);
  }

  const intentIds = intents.map((r) => r.intent_id);
  const tasks = [];
  for (const chunk of chunkArray(intentIds, 500)) {
    if (chunk.length === 0) continue;
    const taskRes = await sb
      .from("price_sync_push_task_v2")
      .select("intent_id, state, attempt_count, http_status, last_error, updated_at")
      .in("intent_id", chunk)
      .order("updated_at", { ascending: false });
    if (taskRes.error) throw new Error(taskRes.error.message || "task query failed");
    tasks.push(...(taskRes.data || []));
  }

  const taskByIntent = new Map();
  for (const row of tasks) {
    const id = String(row.intent_id ?? "").trim();
    if (!id || taskByIntent.has(id)) continue;
    taskByIntent.set(id, row);
  }

  const taskStateCounts = new Map();
  const failedSamples = [];
  for (const [intentId, row] of taskByIntent.entries()) {
    const state = String(row.state ?? "").trim().toUpperCase() || "(missing)";
    taskStateCounts.set(state, (taskStateCounts.get(state) || 0) + 1);
    if (state === "FAILED" && failedSamples.length < 8) {
      failedSamples.push({
        intent_id: intentId,
        http_status: row.http_status ?? null,
        attempt_count: row.attempt_count ?? null,
        last_error: String(row.last_error ?? "").trim() || null,
      });
    }
  }
  console.log("push_tasks", taskByIntent.size);
  for (const [k, v] of Array.from(taskStateCounts.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    console.log("push_task_state", k, v);
  }
  for (const s of failedSamples) console.log("push_task_failed_sample", JSON.stringify(s));

  if (mallId && productNo) {
    const qp = new URLSearchParams({ mall_id: mallId, product_no: productNo });
    if (token) qp.set("token", token);
    const breakdownUrl = `${baseUrl}/api/public/storefront-option-breakdown?${qp.toString()}`;
    const breakdownRes = await httpJson("GET", breakdownUrl);
    if (!breakdownRes.ok) {
      console.log("breakdown_status", breakdownRes.status);
      console.log("breakdown_body", JSON.stringify(breakdownRes.json));
    } else {
      const bj = breakdownRes.json && typeof breakdownRes.json === "object" ? breakdownRes.json : {};
      console.log(
        "breakdown",
        `ok=${bj.ok === true ? "yes" : "no"}`,
        `resolved_product_no=${String(bj.resolved_product_no ?? "").trim() || "(missing)"}`,
        `base_price_krw=${Number(bj.base_price_krw ?? 0) || 0}`,
      );
      const axis = bj.axis && typeof bj.axis === "object" ? bj.axis : null;
      const first = axis && axis.first && typeof axis.first === "object" ? axis.first : null;
      const second = axis && axis.second && typeof axis.second === "object" ? axis.second : null;
      if (first) console.log("breakdown_axis_first", String(first.name ?? "").trim() || "(missing)", "values", Array.isArray(first.values) ? first.values.length : 0);
      if (second) console.log("breakdown_axis_second", String(second.name ?? "").trim() || "(missing)", "values", Array.isArray(second.values) ? second.values.length : 0);
    }
  } else if (mallId || productNo) {
    console.log("breakdown_skipped", "requires --mall-id and --product-no");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
