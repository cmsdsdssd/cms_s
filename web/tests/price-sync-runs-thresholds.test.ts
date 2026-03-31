import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "app", "api", "price-sync-runs-v2", "route.ts"), "utf8");

test("price sync runs use persisted option threshold values instead of hardcoded defaults", () => {
  const optionPolicyBlock = source.match(/const optionSyncPolicyInput = normalizeOptionAdditionalSyncPolicy\([\s\S]*?\);/);
  assert.ok(optionPolicyBlock, 'option sync policy block should exist');
  const block = optionPolicyBlock[0];
  assert.equal(block.includes('min_change_krw: 2000'), false, 'option threshold should not be hardcoded to 2000');
  assert.equal(block.includes('min_change_rate: 0.02'), false, 'option threshold should not be hardcoded to 0.02');
  assert.equal(block.includes('policyRes.data?.option_sync_min_change_krw'), true);
  assert.equal(block.includes('policyRes.data?.option_sync_min_change_rate'), true);
});

test("manual runs still pass through threshold filtering branch", () => {
  assert.equal(source.includes('if (triggerType === "AUTO") {'), false, "threshold block should not be gated to AUTO only");
});


test("manual runs bypass interval gate while still using threshold logic", () => {
  assert.equal(source.includes('if (triggerType === "AUTO" && latestTerminal)'), true, 'manual runs should not be blocked by interval gate');
});


test("auto market uplift path uses the shared sanity guard", () => {
  assert.equal(source.includes('shouldAllowAutoMarketUplift({'), true, 'auto uplift should consult a shared sanity guard');
  assert.equal(source.includes('market_uplift_guard_block_count'), true, 'run summary should expose when the guard blocks auto uplift');
});
