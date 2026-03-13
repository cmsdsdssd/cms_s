import test from "node:test";
import assert from "node:assert/strict";

import {
  collectAffectedSizeGridScopes,
  loadSizeGridMarketContext,
} from "../src/lib/shop/persisted-size-grid-rebuild.js";

test("collectAffectedSizeGridScopes dedupes active SIZE scopes", () => {
  const scopes = collectAffectedSizeGridScopes([
    {
      channel_id: "channel-1",
      master_item_id: "master-1",
      external_product_no: "P100",
      category_key: "SIZE",
      scope_material_code: "18",
      is_active: true,
    },
    {
      channel_id: "channel-1",
      master_item_id: "master-1",
      external_product_no: "P100",
      category_key: "SIZE",
      scope_material_code: "925",
      is_active: true,
    },
    {
      channel_id: "channel-1",
      master_item_id: "master-2",
      external_product_no: "P200",
      category_key: "SIZE",
      scope_material_code: "925",
      is_active: false,
    },
    {
      channel_id: "channel-1",
      master_item_id: "master-3",
      external_product_no: "P300",
      category_key: "COLOR_PLATING",
      scope_material_code: "18",
      is_active: true,
    },
  ]);

  assert.deepEqual(scopes, [
    {
      channelId: "channel-1",
      masterItemId: "master-1",
      externalProductNo: "P100",
    },
  ]);
});

test("collectAffectedSizeGridScopes filters to matching material codes", () => {
  const scopes = collectAffectedSizeGridScopes(
    [
      {
        channel_id: "channel-1",
        master_item_id: "master-1",
        external_product_no: "P100",
        category_key: "SIZE",
        scope_material_code: "18",
        is_active: true,
      },
      {
        channel_id: "channel-1",
        master_item_id: "master-2",
        external_product_no: "P200",
        category_key: "SIZE",
        scope_material_code: "925",
        is_active: true,
      },
    ],
    ["925"],
  );

  assert.deepEqual(scopes, [
    {
      channelId: "channel-1",
      masterItemId: "master-2",
      externalProductNo: "P200",
    },
  ]);
});

test("loadSizeGridMarketContext applies market config to silver tick", async () => {
  const materialFactorRows = [
    {
      material_code: "925",
      purity_rate: 0.925,
      material_adjust_factor: 1.2,
      gold_adjust_factor: 1.2,
      price_basis: "SILVER",
    },
  ];

  const tableResponses = new Map<string, { data: unknown; error: unknown }>([
    [
      "cms_material_factor_config",
      {
        data: materialFactorRows,
        error: null,
      },
    ],
    [
      "cms_market_tick_config",
      {
        data: {
          fx_markup: 1.031,
          cs_correction_factor: 1.21,
          silver_kr_correction_factor: 1.3,
        },
        error: null,
      },
    ],
    [
      "cms_v_market_tick_latest_gold_silver_ops_v1",
      {
        data: {
          gold_price_krw_per_g: 238666.666,
          silver_price_krw_per_g: 5317.333,
        },
        error: null,
      },
    ],
    [
      "cms_v_market_symbol_role_v1",
      {
        data: [
          { role_code: "GOLD", symbol: "GOLD_ROLE", is_active: true },
          { role_code: "SILVER", symbol: "SILVER_ROLE", is_active: true },
        ],
        error: null,
      },
    ],
    [
      "cms_v_market_tick_latest_by_symbol_ops_v1",
      {
        data: [
          { symbol: "KRX_GOLD_TICK", price_krw_per_g: 287733.333, meta: null },
          { symbol: "GOLD_ROLE", price_krw_per_g: 238666.666, meta: null },
          { symbol: "SILVER_ROLE", price_krw_per_g: 5317.333, meta: null },
        ],
        error: null,
      },
    ],
  ]);

  const sb = {
    from(tableName: string) {
      const state = {
        tableName,
        filters: [] as Array<{ op: string; column: string; value: unknown }>,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          state.filters.push({ op: "eq", column, value });
          return builder;
        },
        in(column: string, value: unknown) {
          state.filters.push({ op: "in", column, value });
          return builder;
        },
        limit() {
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(tableResponses.get(state.tableName) ?? { data: null, error: null });
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(tableResponses.get(state.tableName) ?? { data: null, error: null }).then(resolve);
        },
      };

      return builder;
    },
  };

  const marketContext = await loadSizeGridMarketContext(sb as never);

  assert.equal(marketContext.goldTickKrwPerG, 287733);
  assert.equal(marketContext.silverTickKrwPerG, 6913);
  assert.deepEqual(marketContext.materialFactors["925"], {
    material_code: "925",
    purity_rate: 0.925,
    material_adjust_factor: 1.2,
    gold_adjust_factor: 1.2,
    price_basis: "SILVER",
  });
});
