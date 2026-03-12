import test from 'node:test';
import assert from 'node:assert/strict';

import { stripPriceDeltaSuffix, formatOptionDisplayLabel } from '../src/lib/shop/option-labels.js';

test('stripPriceDeltaSuffix removes trailing KRW suffix decorations', () => {
  assert.equal(stripPriceDeltaSuffix('1호 (+1,000원)'), '1호');
  assert.equal(stripPriceDeltaSuffix('1호 (-1,000원)'), '1호');
  assert.equal(stripPriceDeltaSuffix('백금 (+11,000원)'), '백금');
  assert.equal(stripPriceDeltaSuffix('1호'), '1호');
});

test('formatOptionDisplayLabel decorates only non-zero deltas', () => {
  assert.equal(formatOptionDisplayLabel('1호', 1000), '1호 (+1,000원)');
  assert.equal(formatOptionDisplayLabel('1호', -1000), '1호 (-1,000원)');
  assert.equal(formatOptionDisplayLabel('1호', 0), '1호');
  assert.equal(formatOptionDisplayLabel('1호 (+1,000원)', 1000), '1호 (+1,000원)');
});
