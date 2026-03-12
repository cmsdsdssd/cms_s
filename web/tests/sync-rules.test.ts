import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLATING_PREFIX,
  buildPlatingComboChoices,
  normalizePlatingCatalogComboKey,
} from '../src/lib/shop/sync-rules.ts';

test('normalizePlatingCatalogComboKey canonicalizes raw and prefixed combos separately', () => {
  assert.equal(normalizePlatingCatalogComboKey('PW'), 'P+W');
  assert.equal(normalizePlatingCatalogComboKey('WP'), 'P+W');
  assert.equal(normalizePlatingCatalogComboKey('P+W'), 'P+W');
  assert.equal(normalizePlatingCatalogComboKey(`${PLATING_PREFIX} PW`), `${PLATING_PREFIX} P+W`);
  assert.equal(normalizePlatingCatalogComboKey(`${PLATING_PREFIX} W+P`), `${PLATING_PREFIX} P+W`);
});

test('buildPlatingComboChoices keeps raw and plated variants with canonical ordering', () => {
  const choices = buildPlatingComboChoices({
    catalogRows: [
      { combo_key: 'PW', display_name: 'PW', sort_order: 60, base_delta_krw: 0 },
      { combo_key: `${PLATING_PREFIX} P`, display_name: `${PLATING_PREFIX} P`, sort_order: 1010, base_delta_krw: 700 },
      { combo_key: 'P', display_name: 'P', sort_order: 10, base_delta_krw: 0 },
    ],
    includeStandard: false,
  });

  assert.deepEqual(
    choices.map((choice) => ({ value: choice.value, label: choice.label, delta_krw: choice.delta_krw })),
    [
      { value: 'P', label: 'P', delta_krw: 0 },
      { value: 'P+W', label: 'P+W', delta_krw: 0 },
      { value: `${PLATING_PREFIX} P`, label: `${PLATING_PREFIX} P`, delta_krw: 700 },
    ],
  );
});

test('buildPlatingComboChoices appends missing standard raw and plated combos', () => {
  const choices = buildPlatingComboChoices({
    catalogRows: [],
    includeStandard: true,
    fallbackValues: [`${PLATING_PREFIX} WP`],
  });

  assert.equal(choices[0]?.value, 'P');
  assert.equal(choices[1]?.value, 'G');
  assert.equal(choices[4]?.value, 'P+G');
  assert.ok(choices.some((choice) => choice.value === `${PLATING_PREFIX} P`));
  assert.ok(choices.some((choice) => choice.value === `${PLATING_PREFIX} P+W`));
});
