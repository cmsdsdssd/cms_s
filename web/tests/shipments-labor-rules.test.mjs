import test from "node:test";
import assert from "node:assert/strict";

import {
  isCoreVisibleEtcItem,
  isEtcSummaryEligibleItem,
  shouldKeepOnAutoMerge,
} from "../src/lib/shipments-labor-rules.js";

test("etc-visible classification excludes auto/evidence and stone-like items", () => {
  assert.equal(isCoreVisibleEtcItem({ type: "STONE_LABOR", label: "알공임" }), false);
  assert.equal(isCoreVisibleEtcItem({ type: "BOM_DEFAULT", label: "BOM" }), false);
  assert.equal(isCoreVisibleEtcItem({ type: "MATERIAL_MASTER:abc", label: "기타-소재" }), true);
  assert.equal(isCoreVisibleEtcItem({ type: "WARN", label: "warn" }), false);
  assert.equal(isCoreVisibleEtcItem({ type: "DECOR:abc", label: "[장식] 장식:A" }), true);
  assert.equal(isCoreVisibleEtcItem({ type: "PLATING_MASTER", label: "도금-마스터" }), true);
});

test("etc-summary classification excludes ADJUSTMENT", () => {
  assert.equal(isEtcSummaryEligibleItem({ type: "ADJUSTMENT", label: "알공임 조정(±)" }), false);
  assert.equal(isEtcSummaryEligibleItem({ type: "PLATING_MASTER", label: "도금-마스터" }), true);
});

test("auto-merge keep rules retain plating and drop policy-meta", () => {
  const autoManaged = (item) => String(item?.type ?? "").toUpperCase().startsWith("ABSORB:");

  assert.equal(
    shouldKeepOnAutoMerge({ type: "PLATING_MASTER", label: "도금-마스터", meta: {} }, autoManaged),
    true
  );

  assert.equal(
    shouldKeepOnAutoMerge(
      { type: "OTHER_ABSORB:POLICY_META", label: "공임-마스터", meta: { source: "pricing_policy_meta" } },
      autoManaged
    ),
    false
  );

  assert.equal(
    shouldKeepOnAutoMerge({ type: "ABSORB:abc", label: "[장식] 장식:X", meta: { source: "master_absorb_labor" } }, autoManaged),
    false
  );
});
