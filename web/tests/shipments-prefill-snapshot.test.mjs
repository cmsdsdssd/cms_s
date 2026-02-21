import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLaborHydrationPatch,
  buildLaborSnapshotHash,
  materializeSnapshotPolicyItems,
  normalizeExtraLaborItemsWithStableIds,
  sumRoundedExtraLaborAmounts,
  toStableExtraLaborItemId,
  upsertLegacyEtcRemainderItem,
} from "../src/lib/shipments-prefill-snapshot.js";

test("stable extra labor id is deterministic for same payload", () => {
  const raw = {
    type: "ABSORB:abc",
    label: "[장식] 장식:A",
    amount: 3200,
    meta: {
      source: "master_absorb_labor",
      absorb_item_id: "abc",
      bucket: "ETC",
    },
  };

  const id1 = toStableExtraLaborItemId(raw, 0);
  const id2 = toStableExtraLaborItemId(raw, 0);
  assert.equal(id1, id2);
});

test("dirty-lock prevents hydration overwrite for user-edited fields", () => {
  const current = {
    baseLabor: "4100",
    otherLaborCost: "900",
    extraLaborItems: [{ id: "row-1", type: "ADJUSTMENT", label: "기타", amount: "900" }],
  };
  const patch = {
    baseLabor: "1200",
    otherLaborCost: "0",
    extraLaborItems: [{ id: "row-2", type: "STONE_LABOR", label: "알공임", amount: "300" }],
  };

  const next = applyLaborHydrationPatch({
    current,
    patch,
    dirty: { base: true, other: false, extra: true },
  });

  assert.equal(next.baseLabor, "4100");
  assert.equal(next.otherLaborCost, "900");
  assert.deepEqual(next.extraLaborItems, current.extraLaborItems);
});

test("normalized persisted items and snapshot hash stay stable after reload", () => {
  const persisted = [
    {
      type: "ABSORB:row-a",
      label: "[장식] 장식:A",
      amount: 5000,
      meta: { source: "master_absorb_labor", absorb_item_id: "row-a", bucket: "ETC" },
    },
    {
      type: "STONE_LABOR",
      label: "알공임",
      amount: 1200,
      meta: { source: "stone_sell_from_master_v1" },
    },
  ];

  const round1 = normalizeExtraLaborItemsWithStableIds(persisted);
  const round2 = normalizeExtraLaborItemsWithStableIds(round1);

  assert.deepEqual(
    round1.map((item) => item.id),
    round2.map((item) => item.id)
  );

  const hash1 = buildLaborSnapshotHash({
    source: "SHIPMENT_LINE",
    base_labor_sell_krw: 10000,
    extra_labor_sell_krw: 6200,
    extra_labor_items: round1,
  });
  const hash2 = buildLaborSnapshotHash({
    source: "SHIPMENT_LINE",
    base_labor_sell_krw: 10000,
    extra_labor_sell_krw: 6200,
    extra_labor_items: round2,
  });
  assert.equal(hash1, hash2);
});

test("normalize keeps pre-existing ids unchanged", () => {
  const persisted = [
    {
      id: "manual-fixed-id",
      type: "ADJUSTMENT",
      label: "기타",
      amount: 700,
      meta: { source: "manual" },
    },
  ];

  const normalized = normalizeExtraLaborItemsWithStableIds(persisted);
  assert.equal(normalized[0]?.id, "manual-fixed-id");
});

test("other dirty blocks only other field, not base or extra", () => {
  const current = {
    baseLabor: "1000",
    otherLaborCost: "500",
    extraLaborItems: [{ id: "cur", type: "STONE_LABOR", label: "알공임", amount: "300" }],
  };

  const patch = {
    baseLabor: "2000",
    otherLaborCost: "0",
    extraLaborItems: [{ id: "next", type: "ADJUSTMENT", label: "기타", amount: "1200" }],
  };

  const next = applyLaborHydrationPatch({
    current,
    patch,
    dirty: { base: false, other: true, extra: false },
  });

  assert.equal(next.baseLabor, "2000");
  assert.equal(next.otherLaborCost, "500");
  assert.deepEqual(next.extraLaborItems, patch.extraLaborItems);
});

test("materializeSnapshotPolicyItems injects only plating policy row", () => {
  const seeded = materializeSnapshotPolicyItems({
    items: [],
    policyMeta: {
      plating_sell_krw: 1200,
      plating_cost_krw: 400,
      absorb_plating_krw: 300,
      absorb_etc_total_krw: 700,
      absorb_decor_total_krw: 500,
      absorb_other_total_krw: 200,
    },
  });

  assert.equal(seeded.some((item) => String(item.type).toUpperCase() === "PLATING_MASTER"), true);
  const plating = seeded.find((item) => String(item.type).toUpperCase() === "PLATING_MASTER");
  assert.equal(String(plating?.amount ?? ""), "1200");
  assert.equal(seeded.some((item) => String(item.type).toUpperCase() === "OTHER_ABSORB:POLICY_ETC"), false);
  assert.equal(seeded.some((item) => String(item.type).toUpperCase() === "OTHER_ABSORB:POLICY_DECOR"), false);
  assert.equal(seeded.some((item) => String(item.type).toUpperCase() === "OTHER_ABSORB:POLICY_OTHER"), false);
});

test("upsertLegacyEtcRemainderItem keeps a single remainder row", () => {
  const once = upsertLegacyEtcRemainderItem({
    items: [],
    amount: 900,
    label: "legacy",
  });
  const twice = upsertLegacyEtcRemainderItem({
    items: once,
    amount: 1400,
    label: "legacy",
  });

  const rows = twice.filter((item) => String(item.type).toUpperCase() === "LEGACY_ETC_REMAINDER");
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0]?.amount ?? ""), "1400");
});

test("sumRoundedExtraLaborAmounts sums numeric amounts robustly", () => {
  const total = sumRoundedExtraLaborAmounts([
    { amount: "1000" },
    { amount: 550 },
    { amount: "1,450" },
  ]);

  assert.equal(total, 3000);
});
