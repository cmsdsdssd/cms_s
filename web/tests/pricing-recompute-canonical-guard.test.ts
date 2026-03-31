import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "app", "api", "pricing", "recompute", "route.ts"), "utf8");

test("pricing recompute uses canonical overwrite guard before replacing published variant deltas", () => {
  assert.equal(source.includes('canOverwriteCanonicalVariantPublishRows({'), true);
  assert.equal(source.includes('canonical_variant_guard_block_count'), true);
});


test("pricing recompute does not leak canonical guard count into pricing_snapshot rows", () => {
  assert.equal(source.includes(`target_source: useManual ? "MANUAL" : "SYNC",
      },
      compute_request_id: computeRequestId,
      canonical_variant_guard_block_count: 0,`), false);
});
