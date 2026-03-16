import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const helperPath = ['..', 'src', 'lib', 'shop', 'auto-price-preview-display.js'].join(String.fromCharCode(47));

const { buildAppliedTargetSummary, resolveColorPlatingDisplay, summarizeOptionStateMoments, buildPreviewTruthSections } = require(helperPath) as {
  buildAppliedTargetSummary: (args: {
    appliedKrw: number | null | undefined;
    targetKrw: number | null | undefined;
    thresholdNoPushNormal?: boolean | null | undefined;
    downsyncSuppressedNormal?: boolean | null | undefined;
  }) => {
    appliedKrw: number | null;
    targetKrw: number | null;
    deltaKrw: number | null;
    isMismatch: boolean;
    statusLabel: string;
    isThresholdNoPushNormal?: boolean;
    isDownsyncSuppressedNormal?: boolean;
  };
  resolveColorPlatingDisplay: (args: {
    candidateAmounts: Array<number | null | undefined>;
    fallbackDeltaKrw: number | null | undefined;
  }) => {
    resolvedDeltaKrw: number;
    sourceLabel: string;
  };
  summarizeOptionStateMoments: (rows: Array<{
    updated_at?: string | null | undefined;
    last_pushed_at?: string | null | undefined;
    last_verified_at?: string | null | undefined;
    last_push_status?: string | null | undefined;
    last_push_error?: string | null | undefined;
  }>) => {
    lastPushedAt: string | null;
    lastVerifiedAt: string | null;
    lastPushStatus: string | null;
    lastPushError: string | null;
  };
  buildPreviewTruthSections: (args: {
    appliedKrw: number | null | undefined;
    targetKrw: number | null | undefined;
    lastPushedAt?: string | null | undefined;
    lastVerifiedAt?: string | null | undefined;
    computedAt?: string | null | undefined;
  }) => {
    statusLabel: string;
    isMismatch: boolean;
    storeRows: Array<{ label: string; value: number | string | null }>;
    computeRows: Array<{ label: string; value: number | string | null }>;
  };
};

test('buildAppliedTargetSummary marks matching applied and target values as synced', () => {
  const result = buildAppliedTargetSummary({ appliedKrw: 37000, targetKrw: 37000 });

  assert.deepEqual(result, {
    appliedKrw: 37000,
    targetKrw: 37000,
    deltaKrw: 0,
    isMismatch: false,
    statusLabel: '일치',
    isThresholdNoPushNormal: false,
    isDownsyncSuppressedNormal: false,
  });
});

test('buildAppliedTargetSummary marks differing applied and target values as pending apply', () => {
  const result = buildAppliedTargetSummary({ appliedKrw: 37000, targetKrw: 42200 });

  assert.deepEqual(result, {
    appliedKrw: 37000,
    targetKrw: 42200,
    deltaKrw: 5200,
    isMismatch: true,
    statusLabel: '미적용',
    isThresholdNoPushNormal: false,
    isDownsyncSuppressedNormal: false,
  });
});

test('buildAppliedTargetSummary reports missing target cleanly', () => {
  const result = buildAppliedTargetSummary({ appliedKrw: 37000, targetKrw: null });

  assert.deepEqual(result, {
    appliedKrw: 37000,
    targetKrw: null,
    deltaKrw: null,
    isMismatch: false,
    statusLabel: '타겟없음',
  });
});

test('resolveColorPlatingDisplay prefers unique rule-backed amount', () => {
  const result = resolveColorPlatingDisplay({
    candidateAmounts: [3000],
    fallbackDeltaKrw: 0,
  });

  assert.deepEqual(result, {
    resolvedDeltaKrw: 3000,
    sourceLabel: '색상룰 기준',
  });
});

test('resolveColorPlatingDisplay falls back when no rule-backed amount exists', () => {
  const result = resolveColorPlatingDisplay({
    candidateAmounts: [],
    fallbackDeltaKrw: 0,
  });

  assert.deepEqual(result, {
    resolvedDeltaKrw: 0,
    sourceLabel: '기존 저장값',
  });
});


test('summarizeOptionStateMoments picks latest push and verify timestamps across rows', () => {
  const result = summarizeOptionStateMoments([
    {
      updated_at: '2026-03-13T03:57:10.000Z',
      last_pushed_at: '2026-03-13T03:56:58.000Z',
      last_verified_at: null,
      last_push_status: 'VERIFY_FAILED',
      last_push_error: 'verify pending or mismatch',
    },
    {
      updated_at: '2026-03-13T03:58:10.000Z',
      last_pushed_at: '2026-03-13T03:57:58.000Z',
      last_verified_at: '2026-03-13T03:58:05.000Z',
      last_push_status: 'SUCCEEDED',
      last_push_error: null,
    },
  ]);

  assert.deepEqual(result, {
    lastPushedAt: '2026-03-13T03:57:58.000Z',
    lastVerifiedAt: '2026-03-13T03:58:05.000Z',
    lastPushStatus: 'SUCCEEDED',
    lastPushError: null,
  });
});

test('summarizeOptionStateMoments returns null fields for empty input', () => {
  const result = summarizeOptionStateMoments([]);

  assert.deepEqual(result, {
    lastPushedAt: null,
    lastVerifiedAt: null,
    lastPushStatus: null,
    lastPushError: null,
  });
});


test('buildPreviewTruthSections separates store and compute rows', () => {
  const result = buildPreviewTruthSections({
    appliedKrw: 48000,
    targetKrw: 52000,
    lastPushedAt: '2026-03-13T03:56:58.000Z',
    lastVerifiedAt: null,
    computedAt: '2026-03-13T04:20:31.632Z',
  });

  assert.equal(result.statusLabel, '미적용');
  assert.equal(result.isMismatch, true);
  assert.deepEqual(result.storeRows, [
    { label: '실제 적용값', value: 48000 },
    { label: '마지막 옵션 push', value: '2026-03-13T03:56:58.000Z' },
    { label: '마지막 verify', value: null },
  ]);
  assert.deepEqual(result.computeRows, [
    { label: '타겟값', value: 52000 },
    { label: '차이', value: 4000 },
    { label: '마지막 계산', value: '2026-03-13T04:20:31.632Z' },
  ]);
});


test('buildAppliedTargetSummary marks threshold-filtered no-push as normal', () => {
  const result = buildAppliedTargetSummary({
    appliedKrw: 48000,
    targetKrw: 52000,
    thresholdNoPushNormal: true,
  });

  assert.deepEqual(result, {
    appliedKrw: 48000,
    targetKrw: 52000,
    deltaKrw: 4000,
    isMismatch: true,
    statusLabel: '정상(Threshold 미통과)',
    isThresholdNoPushNormal: true,
    isDownsyncSuppressedNormal: false,
  });
});


test('buildAppliedTargetSummary marks downsync-suppressed no-push as normal', () => {
  const result = buildAppliedTargetSummary({
    appliedKrw: 3523000,
    targetKrw: 3508000,
    downsyncSuppressedNormal: true,
  });

  assert.deepEqual(result, {
    appliedKrw: 3523000,
    targetKrw: 3508000,
    deltaKrw: -15000,
    isMismatch: true,
    statusLabel: '정상(다운싱크 억제)',
    isThresholdNoPushNormal: false,
    isDownsyncSuppressedNormal: true,
  });
});
