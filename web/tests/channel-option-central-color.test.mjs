import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveCentralOptionMapping } = await import('../src/lib/shop/channel-option-central-control.js');

test('color resolution preserves explicit persisted delta over zero combo base delta', () => {
  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '14',
    rules: [],
    persisted: { color_code_selected: 'P', resolved_delta_krw: 4000 },
    colorBaseDeltaByCode: { P: 0 },
  });

  assert.equal(result.resolved_delta_krw, 4000);
});

test('color resolution still uses combo base delta when no persisted delta exists', () => {
  const result = resolveCentralOptionMapping({
    category: 'COLOR',
    masterMaterialCode: '14',
    rules: [],
    persisted: { color_code_selected: 'P' },
    colorBaseDeltaByCode: { P: 4000 },
  });

  assert.equal(result.resolved_delta_krw, 4000);
});
