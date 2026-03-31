import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "app", "api", "pricing", "recompute", "route.ts"), "utf8");

test("pricing recompute reads and applies base ending policy", () => {
  assert.equal(source.includes('base_price_ending_policy_json'), true);
  assert.equal(source.includes('resolveEndedBasePrice({'), true);
});

test("pricing recompute preserves exact overrides by bypassing ending policy", () => {
  assert.equal(source.includes('const finalTargetV2 = override'), true);
  assert.equal(source.includes('const legacyFinalTargetWithEnding = override'), true);
});


test("pricing recompute stores ended V2 final target in guardrail trace", () => {
  assert.equal(source.includes('final_target_price_v2_krw: Number(guardrailTrace.final_target_price_v2_krw ?? 0)'), true);
  assert.equal(source.includes('guardrailTrace.final_target_price_v2_krw = finalTargetV2;'), true);
});
