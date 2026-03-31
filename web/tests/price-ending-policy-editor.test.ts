import test from "node:test";
import assert from "node:assert/strict";

import {
  priceEndingPolicyBandsToEditorRows,
  priceEndingPolicyEditorRowsToBands,
} from "../src/lib/shop/price-ending-policy-editor.ts";

test("priceEndingPolicyBandsToEditorRows converts UP bands into editable rows", () => {
  const rows = priceEndingPolicyBandsToEditorRows([
    { min_krw: 0, max_krw: 2999999, allowed_endings: [800], direction: "UP" },
    { min_krw: 3000000, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
  ]);

  assert.deepEqual(rows, [
    { min_krw: "0", max_krw: "2999999", allowed_endings: "800" },
    { min_krw: "3000000", max_krw: "", allowed_endings: "800, 900" },
  ]);
});

test("priceEndingPolicyEditorRowsToBands converts rows into validated UP bands", () => {
  const bands = priceEndingPolicyEditorRowsToBands([
    { min_krw: "0", max_krw: "2999999", allowed_endings: "800" },
    { min_krw: "3000000", max_krw: "", allowed_endings: "900, 800, 900" },
  ]);

  assert.deepEqual(bands, [
    { min_krw: 0, max_krw: 2999999, allowed_endings: [800], direction: "UP" },
    { min_krw: 3000000, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
  ]);
});

test("priceEndingPolicyEditorRowsToBands ignores fully blank rows but rejects partial rows", () => {
  const bands = priceEndingPolicyEditorRowsToBands([
    { min_krw: "", max_krw: "", allowed_endings: "" },
    { min_krw: "0", max_krw: "", allowed_endings: "800" },
  ]);

  assert.deepEqual(bands, [
    { min_krw: 0, max_krw: null, allowed_endings: [800], direction: "UP" },
  ]);

  assert.throws(
    () => priceEndingPolicyEditorRowsToBands([{ min_krw: "1000", max_krw: "", allowed_endings: "" }]),
    /allowed_endings/,
  );
});
