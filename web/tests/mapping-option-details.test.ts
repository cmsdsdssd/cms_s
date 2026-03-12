import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMappingOptionAllowlist,
  buildObservedOptionValuePool,
} from '../src/lib/shop/mapping-option-details.ts';

test('buildMappingOptionAllowlist exposes persisted size grid choices even without local SIZE rules', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    persistedSizeLookup: {
      choicesByMaterial: new Map([
        ['18', [{ value: '0.08', label: '0.08g', delta_krw: 3500 }]],
      ]),
    },
  });

  assert.deepEqual(allowlist.materials, [{ value: '18', label: '18' }]);
  assert.deepEqual(allowlist.sizes_by_material['18'], [
    { value: '0.08', label: '0.08g', delta_krw: 3500 },
  ]);
});

test('buildMappingOptionAllowlist seeds material and color choices from observed values', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    observedOptionValues: {
      materials: ['18'],
      sizes: [],
      colors: ['[도] G'],
      decors: [],
    },
  });

  assert.deepEqual(allowlist.materials, [{ value: '18', label: '18' }]);
  assert.deepEqual(allowlist.colors, [{ value: '[도] G', label: '[도] G' }]);
});

test('buildObservedOptionValuePool infers material and plating codes from raw option labels', () => {
  const observed = buildObservedOptionValuePool({
    variants: [
      {
        options: [
          { name: '소재', value: '925실버' },
          { name: '색상', value: '핑크' },
        ],
      },
      {
        options: [
          { name: '소재', value: '925실버' },
          { name: '색상', value: '백금도금' },
        ],
      },
      {
        options: [
          { name: '소재', value: '925실버' },
          { name: '색상', value: 'PW' },
        ],
      },
    ],
    savedOptionCategories: [],
  });

  assert.deepEqual(observed.materials, ['925']);
  assert.deepEqual(observed.colors, ['P', 'P+W', '[도] W']);
});

test('buildMappingOptionAllowlist synthesizes market-linked size choices from observed materials', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    observedOptionValues: {
      materials: ['925'],
      sizes: [],
      colors: [],
      decors: [],
    },
    sizeMarketContext: {
      goldTickKrwPerG: 200000,
      silverTickKrwPerG: 5000,
      materialFactors: {
        '925': {
          material_code: '925',
          purity_rate: 0.925,
          material_adjust_factor: 1.2,
          price_basis: 'SILVER',
        },
      },
    },
  });

  assert.equal(allowlist.sizes_by_material['925']?.[0]?.value, '0.00');
  assert.equal(allowlist.sizes_by_material['925']?.[1]?.value, '0.01');
  assert.equal(allowlist.sizes_by_material['925']?.[1]?.delta_krw, 100);
});
