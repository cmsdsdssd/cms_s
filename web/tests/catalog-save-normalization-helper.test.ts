import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCatalogSaveSnapshot } from "../src/lib/catalog/catalog-save-normalization.ts";

test("normalizeCatalogSaveSnapshot recalculates base labor, stone branches, and plating sell", async () => {
  const calls: string[] = [];

  const result = await normalizeCatalogSaveSnapshot(
    {
      laborBaseCost: 1100,
      laborCenterCost: 2100,
      laborSub1Cost: 3100,
      laborSub2Cost: 4100,
      platingCost: 5100,
      centerStoneSourceDefault: "SELF",
      sub1StoneSourceDefault: "FACTORY",
      sub2StoneSourceDefault: "SELF",
      centerSelfMargin: 120,
      sub1SelfMargin: 220,
      sub2SelfMargin: 320,
    },
    {
      resolveBaseLaborSell: async (costKrw) => {
        calls.push("base:" + String(costKrw));
        return costKrw + 10;
      },
      resolveStoneSell: async ({ role, source, costKrw, marginKrw }) => {
        calls.push("stone:" + role + ":" + source + ":" + String(costKrw) + ":" + String(marginKrw));
        return costKrw + marginKrw + (source === "SELF" ? 1 : 2);
      },
      resolvePlatingSell: async (costKrw) => {
        calls.push("plating:" + String(costKrw));
        return costKrw + 30;
      },
    }
  );

  assert.deepEqual(result, {
    laborBaseSell: 1110,
    laborCenterSell: 2221,
    laborSub1Sell: 3322,
    laborSub2Sell: 4421,
    platingSell: 5130,
  });
  assert.deepEqual(calls, [
    "base:1100",
    "stone:CENTER:SELF:2100:120",
    "stone:SUB1:FACTORY:3100:220",
    "stone:SUB2:SELF:4100:320",
    "plating:5100",
  ]);
});

test("normalizeCatalogSaveSnapshot surfaces recalculation failures", async () => {
  await assert.rejects(
    () =>
      normalizeCatalogSaveSnapshot(
        {
          laborBaseCost: 100,
          laborCenterCost: 200,
          laborSub1Cost: 300,
          laborSub2Cost: 400,
          platingCost: 500,
          centerStoneSourceDefault: "FACTORY",
          sub1StoneSourceDefault: "FACTORY",
          sub2StoneSourceDefault: "FACTORY",
          centerSelfMargin: 0,
          sub1SelfMargin: 0,
          sub2SelfMargin: 0,
        },
        {
          resolveBaseLaborSell: async () => 100,
          resolveStoneSell: async () => 200,
          resolvePlatingSell: async () => {
            throw new Error("pricing service unavailable");
          },
        }
      ),
    /pricing service unavailable/
  );
});
