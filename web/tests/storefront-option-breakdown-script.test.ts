import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const scriptSource = readFileSync(
  join(process.cwd(), "public", "storefront-option-breakdown.js"),
  "utf8",
);

test("storefront option breakdown script uses published display labels without delta fallback", () => {
  assert.equal(scriptSource.includes("formatWithDelta"), false, "client script should not synthesize suffixes from deltas");
  assert.equal(scriptSource.includes("buildConditionalDeltaMap"), false, "client script should not derive conditional deltas from variant totals");
  assert.equal(scriptSource.includes("buildDirectDeltaMap"), false, "client script should not use direct delta maps for label rendering");
  assert.equal(scriptSource.includes("display_label"), true, "client script should still read published display labels");
});


test("storefront option breakdown script can fall back to its own script origin for apiBase", () => {
  assert.equal(scriptSource.includes("document.currentScript"), true, "client script should read its own script tag origin");
  assert.equal(scriptSource.includes("scriptUrl?.origin"), true, "client script should default apiBase to the script origin");
});


test("storefront option breakdown script supports Cafe24 detail query-string product numbers", () => {
  assert.equal(scriptSource.includes('searchParams.get("product_no")'), true, 'client script should support product_no query-string detection');
});


test("storefront option breakdown script supports mall_id override from script src", () => {
  assert.equal(scriptSource.includes('searchParams.get("mall_id")'), true, 'client script should support mall_id override from script src');
});
