import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const catalogSource = readFileSync(resolve(testDir, "../src/app/(app)/catalog/page.tsx"), "utf8");

function extractBlockFromSource(startToken: string) {
  const start = catalogSource.indexOf(startToken);
  assert.notEqual(start, -1, `expected to find ${startToken}`);

  const endToken = "\n  };";
  const end = catalogSource.indexOf(endToken, start);
  assert.notEqual(end, -1, `expected to find the end of ${startToken}`);

  return catalogSource.slice(start, end + endToken.length);
}

function extractHandleSaveSource() {
  return extractBlockFromSource("const handleSave = async () => {");
}

test("handleSave awaits a save-time normalization step before payload creation", () => {
  const handleSaveSource = extractHandleSaveSource();
  const payloadIndex = handleSaveSource.indexOf("const payload = {");

  assert.notEqual(payloadIndex, -1, "expected handleSave to build a payload");
  assert.match(
    handleSaveSource,
    /const\s+\w+\s*=\s*await\s+\w+\(/,
    "expected handleSave to await a dedicated save-time normalization helper"
  );

  const normalizationMatch = handleSaveSource.match(/const\s+(\w+)\s*=\s*await\s+\w+\(/);
  assert.ok(normalizationMatch, "expected to capture the normalized save state variable");
  const normalizationStatement = normalizationMatch[0];
  const normalizeCallIndex = handleSaveSource.indexOf(normalizationStatement);
  assert.ok(normalizeCallIndex < payloadIndex, "expected save-time normalization to happen before payload creation");
});

test("save-time normalization covers base labor, stone labor, and plating sell derivations", () => {
  assert.match(catalogSource, /applyGlobalLaborSellFromCost\("BASE_LABOR"/);
  assert.match(catalogSource, /applyStoneSellBySource\(/);
  assert.match(catalogSource, /applyGlobalPlatingSellFromCost\(/);
  assert.match(catalogSource, /normalize.*save|save.*normalize|normalized/i);
});

test("handleSave payload uses normalized sell values instead of directly wiring stale sell state", () => {
  const handleSaveSource = extractHandleSaveSource();
  const normalizationMatch = handleSaveSource.match(/const\s+(\w+)\s*=\s*await\s+\w+\(/);
  assert.ok(normalizationMatch, "expected a normalized state variable");
  const normalizedVar = normalizationMatch[1];

  assert.match(handleSaveSource, new RegExp(`labor_base_sell:\s*${normalizedVar}\.`));
  assert.match(handleSaveSource, new RegExp(`labor_center_sell:\s*${normalizedVar}\.`));
  assert.match(handleSaveSource, new RegExp(`labor_sub1_sell:\s*${normalizedVar}\.`));
  assert.match(handleSaveSource, new RegExp(`labor_sub2_sell:\s*${normalizedVar}\.`));
  assert.match(handleSaveSource, new RegExp(`plating_price_sell_default:\s*${normalizedVar}\.`));

  assert.equal(handleSaveSource.includes("labor_base_sell: laborBaseSell"), false);
  assert.equal(handleSaveSource.includes("labor_center_sell: laborCenterSell"), false);
  assert.equal(handleSaveSource.includes("labor_sub1_sell: laborSub1Sell"), false);
  assert.equal(handleSaveSource.includes("labor_sub2_sell: laborSub2Sell"), false);
  assert.equal(handleSaveSource.includes("plating_price_sell_default: platingSell"), false);
});
