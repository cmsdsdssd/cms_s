import test from "node:test";
import assert from "node:assert/strict";

import {
  parsePriceEndingPolicy,
  validatePriceEndingPolicy,
  resolveEndedBasePrice,
} from "../src/lib/shop/price-ending-policy.ts";

test("parsePriceEndingPolicy normalizes valid bands", () => {
  const bands = parsePriceEndingPolicy([
    { min_krw: 0, max_krw: 2999999, allowed_endings: [800], direction: "UP" },
    { min_krw: 3000000, max_krw: null, allowed_endings: [900, 800], direction: "UP" },
  ]);

  assert.deepEqual(bands, [
    { min_krw: 0, max_krw: 2999999, allowed_endings: [800], direction: "UP" },
    { min_krw: 3000000, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
  ]);
});



test("parsePriceEndingPolicy rejects invalid direction values", () => {
  assert.throws(() => parsePriceEndingPolicy([
    { min_krw: 0, max_krw: null, allowed_endings: [800], direction: "DOWN" },
  ]));
});

test("validatePriceEndingPolicy rejects overlapping bands and invalid endings", () => {
  const overlap = validatePriceEndingPolicy([
    { min_krw: 0, max_krw: 3000000, allowed_endings: [800], direction: "UP" },
    { min_krw: 3000000, max_krw: null, allowed_endings: [900], direction: "UP" },
  ]);
  assert.equal(overlap.ok, false);

  const invalidEnding = validatePriceEndingPolicy([
    { min_krw: 0, max_krw: null, allowed_endings: [1200], direction: "UP" },
  ]);
  assert.equal(invalidEnding.ok, false);
});

test("resolveEndedBasePrice keeps existing 800 ending when safe target stays below it", () => {
  const result = resolveEndedBasePrice({
    safeTargetKrw: 3452790,
    bands: [
      { min_krw: 0, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
    ],
  });

  assert.equal(result.finalEndedPriceKrw, 3452800);
  assert.equal(result.appliedEndingKrw, 800);
});

test("resolveEndedBasePrice moves to 900 when safe target crosses 800", () => {
  const result = resolveEndedBasePrice({
    safeTargetKrw: 3452801,
    bands: [
      { min_krw: 0, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
    ],
  });

  assert.equal(result.finalEndedPriceKrw, 3452900);
  assert.equal(result.appliedEndingKrw, 900);
});

test("resolveEndedBasePrice jumps to next 800 after passing 900", () => {
  const result = resolveEndedBasePrice({
    safeTargetKrw: 3452901,
    bands: [
      { min_krw: 0, max_krw: null, allowed_endings: [800, 900], direction: "UP" },
    ],
  });

  assert.equal(result.finalEndedPriceKrw, 3453800);
  assert.equal(result.appliedEndingKrw, 800);
});

test("resolveEndedBasePrice returns safe target unchanged when no band matches", () => {
  const result = resolveEndedBasePrice({
    safeTargetKrw: 3452901,
    bands: [
      { min_krw: 0, max_krw: 1000000, allowed_endings: [800], direction: "UP" },
    ],
  });

  assert.equal(result.finalEndedPriceKrw, 3452901);
  assert.equal(result.applied, false);
});
