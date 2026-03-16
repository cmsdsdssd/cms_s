import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMappingOptionAllowlist,
  buildObservedOptionValuePool,
  validateMappingOptionSelection,
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

test('buildMappingOptionAllowlist does not synthesize size choices without persisted grid', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    observedOptionValues: {
      materials: ['925'],
      sizes: [],
      colors: [],
      decors: [],
    },
  });

  assert.deepEqual(allowlist.sizes_by_material['925'], []);
});

test('validateMappingOptionSelection rejects size values outside persisted grid choices', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    persistedSizeLookup: {
      choicesByMaterial: new Map([
        ['925', [{ value: '1.00', label: '1.00g', delta_krw: 7000 }]],
      ]),
    },
  });
  const result = validateMappingOptionSelection({
    allowlist,
    current: {
      option_material_code: '925',
      option_size_value: 2,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors[0] ?? '', /option_size_value/);
});

test('validateMappingOptionSelection rejects unchanged stale size values', () => {
  const allowlist = buildMappingOptionAllowlist([], {
    persistedSizeLookup: {
      choicesByMaterial: new Map([
        ['925', [{ value: '1.00', label: '1.00g', delta_krw: 7000 }]],
      ]),
    },
  });
  const result = validateMappingOptionSelection({
    allowlist,
    current: {
      option_material_code: '925',
      option_size_value: 2,
    },
    previous: {
      option_material_code: '925',
      option_size_value: 2,
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors[0] ?? '', /option_size_value/);
});
