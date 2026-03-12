import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

type ActiveMappingInvariantInputRow = import("../src/lib/shop/mapping-integrity").ActiveMappingInvariantInputRow;

const require = createRequire(import.meta.url);
const {
  attachExistingChannelProductIds,
  validateActiveMappingInvariants,
} = require("../src/lib/shop/mapping-integrity.ts") as typeof import("../src/lib/shop/mapping-integrity");

function createSupabaseMock(rows: ActiveMappingInvariantInputRow[]) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        in() {
          return this;
        },
        eq() {
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
  };
}

test("validateActiveMappingInvariants allows updating an existing active variant when its channel_product_id is preserved", async () => {
  const existingRows: ActiveMappingInvariantInputRow[] = [
    {
      channel_product_id: "cp-1",
      channel_id: "channel-1",
      master_item_id: "master-1",
      external_product_no: "P0001",
      external_variant_code: "V1",
      is_active: true,
    },
  ];

  const withoutIdentity = await validateActiveMappingInvariants({
    sb: createSupabaseMock(existingRows) as never,
    rows: [
      {
        channel_id: "channel-1",
        master_item_id: "master-1",
        external_product_no: "P0001",
        external_variant_code: "V1",
        is_active: true,
      },
    ],
  });

  assert.equal(withoutIdentity.ok, false);
  if (withoutIdentity.ok) {
    assert.fail("expected duplicate variant conflict before preserving channel_product_id");
  }
  assert.equal(withoutIdentity.code, "ACTIVE_VARIANT_MAPPING_CONFLICT");

  const rowsWithIdentity = attachExistingChannelProductIds(
    [
      {
        channel_id: "channel-1",
        master_item_id: "master-1",
        external_product_no: "P0001",
        external_variant_code: "V1",
        is_active: true,
      },
    ],
    existingRows,
  );

  assert.equal(rowsWithIdentity[0]?.channel_product_id, "cp-1");

  const withIdentity = await validateActiveMappingInvariants({
    sb: createSupabaseMock(existingRows) as never,
    rows: rowsWithIdentity,
  });

  assert.deepEqual(withIdentity, { ok: true });
});

test("attachExistingChannelProductIds keeps unmatched rows unchanged", () => {
  const result = attachExistingChannelProductIds(
    [
      {
        channel_id: "channel-1",
        master_item_id: "master-1",
        external_product_no: "P0001",
        external_variant_code: "V2",
        is_active: true,
      },
    ],
    [
      {
        channel_product_id: "cp-1",
        channel_id: "channel-1",
        master_item_id: "master-1",
        external_product_no: "P0001",
        external_variant_code: "V1",
        is_active: true,
      },
    ],
  );

  assert.equal(result[0]?.channel_product_id, undefined);
  assert.equal(result[0]?.external_variant_code, "V2");
});
