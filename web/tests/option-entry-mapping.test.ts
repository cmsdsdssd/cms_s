import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeOptionEntryMappingPayload,
  sanitizeOptionEntryMappingPayload,
  validateOptionEntryMappingPayload,
} from '../src/lib/shop/option-entry-mapping.ts';

test('normalizeOptionEntryMappingPayload normalizes a COLOR_PLATING row', () => {
  const normalized = normalizeOptionEntryMappingPayload({
    channel_id: ' ch-1 ',
    external_product_no: ' 33 ',
    option_name: '색상',
    option_value: '[도] P',
    category_key: 'color_plating',
    combo_code: ' P ',
    color_bucket_id: ' bucket-1 ',
    label_snapshot: '핑크도금',
  });

  assert.equal(normalized.channel_id, 'ch-1');
  assert.equal(normalized.external_product_no, '33');
  assert.equal(normalized.category_key, 'COLOR_PLATING');
  assert.equal(normalized.combo_code, 'P');
  assert.equal(normalized.color_bucket_id, 'bucket-1');
  assert.equal(normalized.weight_g, null);
});

test('validateOptionEntryMappingPayload requires weight_g for SIZE rows', () => {
  const result = validateOptionEntryMappingPayload(normalizeOptionEntryMappingPayload({
    channel_id: 'ch-1',
    external_product_no: '33',
    option_name: '사이즈',
    option_value: '0.01g',
    category_key: 'SIZE',
  }));

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors[0] ?? '', /weight_g/);
});

test('validateOptionEntryMappingPayload rejects mixed category keys', () => {
  const result = validateOptionEntryMappingPayload(normalizeOptionEntryMappingPayload({
    channel_id: 'ch-1',
    external_product_no: '33',
    option_name: '색상',
    option_value: '[도] P',
    category_key: 'COLOR_PLATING',
    combo_code: 'P',
    color_bucket_id: 'bucket-1',
    weight_g: 0.01,
  }));

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected invalid result');
  assert.match(result.errors.join(' '), /weight_g/);
});

test('validateOptionEntryMappingPayload accepts OTHER rows with explicit reason and delta', () => {
  const result = validateOptionEntryMappingPayload(normalizeOptionEntryMappingPayload({
    channel_id: 'ch-1',
    external_product_no: '33',
    option_name: '기타',
    option_value: '특수요청',
    category_key: 'OTHER',
    other_reason_code: 'GIFT_SPECIAL',
    explicit_delta_krw: 3000,
  }));

  assert.equal(result.ok, true);
});


test('sanitizeOptionEntryMappingPayload strips disallowed material code from SIZE rows', () => {
  const sanitized = sanitizeOptionEntryMappingPayload(normalizeOptionEntryMappingPayload({
    channel_id: 'ch-1',
    external_product_no: '33',
    option_name: '사이즈',
    option_value: '2호',
    category_key: 'SIZE',
    material_registry_code: '14',
    weight_g: 0.02,
  }));

  assert.equal(sanitized.material_registry_code, null);
  const result = validateOptionEntryMappingPayload(sanitized);
  assert.equal(result.ok, true);
});
