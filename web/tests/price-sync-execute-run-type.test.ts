import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "app", "api", "price-sync-runs-v2", "[run_id]", "execute", "route.ts"), "utf8");

test("execute route passes actual run trigger type into push", () => {
  assert.equal(source.includes('run_type: "AUTO"'), false, 'execute route should not hardcode AUTO');
  assert.equal(source.includes('run_type: runTriggerType'), true, 'execute route should forward the real run trigger type');
});
