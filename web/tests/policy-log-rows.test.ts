import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPolicyLogInsertRows } from '../src/app/api/channel-product-option-mappings-v2-logs/route';

test('buildPolicyLogInsertRows accepts snake_case and camelCase rows', () => {
  const rows = buildPolicyLogInsertRows({
    channelId: 'ch',
    masterItemId: 'master',
    externalProductNo: '33',
    changeReason: 'AUTO',
    changedBy: 'tester',
    rowsRaw: [
      { axis_key: 'OPTION_AXIS_SELECTION', entry_key: '색상::핑크', category_key: 'COLOR_PLATING', axis1_value: '925', axis2_value: 'P+W' },
      { axisKey: 'OPTION_AXIS_SELECTION', entryKey: '색상::화이트', categoryKey: 'COLOR_PLATING', axis1Value: '925', axis2Value: '[도] W' },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.axis_value, '33::색상::핑크');
  assert.equal((rows[1]?.new_row as { axis2_value?: string | null })?.axis2_value, '[도] W');
});

test('buildPolicyLogInsertRows drops meaningless axis selection rows', () => {
  const rows = buildPolicyLogInsertRows({
    channelId: 'ch',
    masterItemId: 'master',
    externalProductNo: '33',
    changeReason: '',
    changedBy: null,
    rowsRaw: [
      { axis_key: 'OPTION_AXIS_SELECTION', entry_key: '색상::핑크', category_key: null, axis1_value: null, axis2_value: null, axis3_value: null },
    ],
  });

  assert.equal(rows.length, 0);
});
