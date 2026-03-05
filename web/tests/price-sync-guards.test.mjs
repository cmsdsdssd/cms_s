import test from "node:test";
import assert from "node:assert/strict";

import {
  CRON_TICK_ERROR_PREFIX,
  isCronTickError,
  parseCronTickReason,
  restoreVariantTargetFromRawDelta,
} from "../src/lib/shop/price-sync-guards.js";

test("parseCronTickReason parses prefixed reasons", () => {
  assert.equal(parseCronTickReason(`${CRON_TICK_ERROR_PREFIX}OVERLAP_RUNNING`), "OVERLAP_RUNNING");
  assert.equal(parseCronTickReason("CRON_TICK: INTERVAL_NOT_ELAPSED"), "INTERVAL_NOT_ELAPSED");
  assert.equal(parseCronTickReason("NO_TICK"), null);
});

test("isCronTickError matches only cron tick messages", () => {
  assert.equal(isCronTickError("CRON_TICK:EXECUTE_RUN_FAILED"), true);
  assert.equal(isCronTickError("FAILED"), false);
  assert.equal(isCronTickError(null), false);
});

test("restoreVariantTargetFromRawDelta preserves positive and negative deltas", () => {
  assert.equal(
    restoreVariantTargetFromRawDelta({
      targetPrice: 56000,
      baseFinalTarget: 56000,
      baseRawTarget: 54800,
      variantRawTarget: 55100,
    }),
    56300,
  );

  assert.equal(
    restoreVariantTargetFromRawDelta({
      targetPrice: 56000,
      baseFinalTarget: 56000,
      baseRawTarget: 54800,
      variantRawTarget: 54600,
    }),
    55800,
  );
});

test("restoreVariantTargetFromRawDelta keeps target unchanged when guard conditions fail", () => {
  assert.equal(
    restoreVariantTargetFromRawDelta({
      targetPrice: 57000,
      baseFinalTarget: 56000,
      baseRawTarget: 54800,
      variantRawTarget: 55100,
    }),
    57000,
  );

  assert.equal(
    restoreVariantTargetFromRawDelta({
      targetPrice: 56000,
      baseFinalTarget: 56000,
      baseRawTarget: 54800,
      variantRawTarget: 54800,
    }),
    56000,
  );
});
