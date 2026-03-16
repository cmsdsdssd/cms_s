import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routeSource = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'pricing', 'recompute', 'route.ts'),
  'utf8',
);

const unsupportedSnapshotRateFields = [
  "fee_rate: feeRate.value",
  "min_margin_rate_total: minMarginRateTotal.value",
  "gm_material_rate: gmMaterialRate.value",
  "gm_labor_rate: gmLaborRate.value",
  "gm_fixed_rate: gmFixedRate.value",
];

test('pricing recompute snapshot payload omits unsupported snapshot rate fields', () => {
  for (const field of unsupportedSnapshotRateFields) {
    assert.equal(routeSource.includes(field), false, field + " should not be written to pricing_snapshot");
  }

  assert.equal(routeSource.includes("candidate_price_krw: Number(guardrail.candidate_price_krw ?? 0)"), true);
  assert.equal(routeSource.includes("guardrail_price_krw: Number(guardrail.guardrail_price_krw ?? 0)"), true);
  assert.equal(routeSource.includes('final_target_price_v2_krw: pricingAlgoVersion === "REVERSE_FEE_V2" ? finalTargetV2 : null'), true);
});
