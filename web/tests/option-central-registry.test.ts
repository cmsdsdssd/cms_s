import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCentralRegistryPayload,
  validateCentralRegistryPayload,
} from '../src/lib/shop/option-central-registry.ts';

test('normalizeCentralRegistryPayload normalizes a color bucket row', () => {
  const normalized = normalizeCentralRegistryPayload({
    registry_kind: 'color_bucket',
    channel_id: ' ch-1 ',
    bucket_code: ' bucket-5000 ',
    bucket_label: ' 5000원 버킷 ',
    base_cost_krw: '5000',
    sell_delta_krw: '9000',
  });

  assert.equal(normalized.registry_kind, 'COLOR_BUCKET');
  assert.equal(normalized.channel_id, 'ch-1');
  assert.equal(normalized.bucket_code, 'bucket-5000');
  assert.equal(normalized.base_cost_krw, 5000);
  assert.equal(normalized.sell_delta_krw, 9000);
});

test('validateCentralRegistryPayload requires material pricing context for MATERIAL registry', () => {
  const result = validateCentralRegistryPayload(normalizeCentralRegistryPayload({
    registry_kind: 'MATERIAL',
    channel_id: 'ch-1',
    material_code: '14',
    material_label: '14K',
  }));

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors.join(' '), /material_type/);
  assert.match(result.errors.join(' '), /tick_source/);
  assert.match(result.errors.join(' '), /factor_ref/);
});

test('validateCentralRegistryPayload accepts addon rows with base and extra amounts', () => {
  const result = validateCentralRegistryPayload(normalizeCentralRegistryPayload({
    registry_kind: 'ADDON',
    channel_id: 'ch-1',
    addon_code: 'giftbox',
    addon_name: '곰돌이 선물상자',
    base_amount_krw: 3000,
    extra_delta_krw: 1000,
  }));

  assert.equal(result.ok, true);
});

test('validateCentralRegistryPayload rejects mixed fields across registry kinds', () => {
  const result = validateCentralRegistryPayload(normalizeCentralRegistryPayload({
    registry_kind: 'NOTICE',
    channel_id: 'ch-1',
    notice_code: 'MADE_TO_ORDER',
    notice_name: '주문제작',
    display_text: '주문제작 상품',
    description: 'notice',
    bucket_code: 'bucket-5000',
  }));

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors.join(' '), /bucket_code/);
});
