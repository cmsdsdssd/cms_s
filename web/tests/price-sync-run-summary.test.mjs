import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMissingActiveMappingSummary,
  buildThresholdProfileSummary,
  resolveNoIntentsReason,
  selectLatestMeaningfulSyncRun,
  selectPreviewComputeRequestId,
} from "../src/lib/shop/price-sync-run-summary.js";

test("buildMissingActiveMappingSummary counts only rows with channel_product_id and missing active mapping", () => {
  const snapshotRows = [
    { channel_product_id: "cp-1", master_item_id: "m-1", compute_request_id: "c-1" },
    { channel_product_id: "cp-2", master_item_id: "m-2", compute_request_id: "c-1" },
    { channel_product_id: "cp-2", master_item_id: "m-2", compute_request_id: "c-2" },
    { channel_product_id: "", master_item_id: "m-3", compute_request_id: "c-3" },
    { channel_product_id: null, master_item_id: "m-4", compute_request_id: "c-4" },
  ];
  const activeByChannelProduct = new Map([
    ["cp-1", { external_product_no: "1001", external_variant_code: "" }],
    ["cp-2", { external_product_no: "", external_variant_code: "" }],
  ]);

  const { summary, missingMappingRows } = buildMissingActiveMappingSummary({ snapshotRows, activeByChannelProduct });

  assert.equal(summary.snapshot_rows_with_channel_product_count, 3);
  assert.equal(summary.missing_active_mapping_row_count, 2);
  assert.equal(summary.missing_active_mapping_product_count, 1);
  assert.equal(summary.missing_active_mapping_master_count, 1);
  assert.equal(summary.missing_active_mapping_samples.length, 2);
  assert.deepEqual(summary.missing_active_mapping_samples[0], {
    channel_product_id: "cp-2",
    master_item_id: "m-2",
    compute_request_id: "c-1",
  });
  assert.equal(missingMappingRows.length, 2);
});

test("buildMissingActiveMappingSummary limits samples to 20", () => {
  const snapshotRows = Array.from({ length: 25 }, (_, index) => ({
    channel_product_id: `cp-${index + 1}`,
    master_item_id: `m-${index + 1}`,
    compute_request_id: "compute-a",
  }));

  const { summary } = buildMissingActiveMappingSummary({
    snapshotRows,
    activeByChannelProduct: new Map(),
  });

  assert.equal(summary.missing_active_mapping_row_count, 25);
  assert.equal(summary.missing_active_mapping_samples.length, 20);
});

test("resolveNoIntentsReason prioritizes option threshold and generic threshold reasons", () => {
  assert.equal(
    resolveNoIntentsReason({ optionThresholdFilteredCount: 1, thresholdFilteredCount: 1, missingActiveMappingProductCount: 99 }),
    "NO_INTENTS_AFTER_OPTION_MIN_CHANGE_THRESHOLD",
  );
  assert.equal(
    resolveNoIntentsReason({ optionThresholdFilteredCount: 0, thresholdFilteredCount: 1, missingActiveMappingProductCount: 99 }),
    "NO_INTENTS_AFTER_MIN_CHANGE_THRESHOLD",
  );
  assert.equal(
    resolveNoIntentsReason({ optionThresholdFilteredCount: 0, thresholdFilteredCount: 0, missingActiveMappingProductCount: 2 }),
    "NO_ACTIVE_MAPPING_FOR_SNAPSHOT_ROWS",
  );
  assert.equal(
    resolveNoIntentsReason({ optionThresholdFilteredCount: 0, thresholdFilteredCount: 0, missingActiveMappingProductCount: 0 }),
    "NO_INTENTS",
  );
});


test("buildThresholdProfileSummary separates channel and effective profiles", () => {
  const summary = buildThresholdProfileSummary({
    channelThresholdProfile: "GENERAL",
    effectiveThresholdProfile: "MARKET_LINKED",
  });

  assert.deepEqual(summary, {
    channelThresholdProfile: "GENERAL",
    effectiveThresholdProfile: "MARKET_LINKED",
    isOverrideActive: true,
  });
});


test("selectLatestMeaningfulSyncRun skips CRON_TICK cancelled rows", () => {
  const run = selectLatestMeaningfulSyncRun([
    { run_id: "cron", error_message: "CRON_TICK:INTERVAL_NOT_ELAPSED" },
    { run_id: "real", error_message: null },
  ]);

  assert.deepEqual(run, { run_id: "real", error_message: null });
});


test("selectPreviewComputeRequestId prefers latest meaningful run pinned compute id", () => {
  const computeRequestId = selectPreviewComputeRequestId({
    latestMeaningfulRun: { pinned_compute_request_id: "run-compute" },
    recentRunDetailQueries: [
      { data: { data: { run: { pinned_compute_request_id: "detail-compute" } } } },
    ],
  });

  assert.equal(computeRequestId, "run-compute");
});
