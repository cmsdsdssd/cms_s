function toRoundedKrw(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
}

export function buildAppliedTargetSummary({ appliedKrw, targetKrw, thresholdNoPushNormal = false }) {
  const applied = toRoundedKrw(appliedKrw);
  const target = toRoundedKrw(targetKrw);

  if (target == null) {
    return {
      appliedKrw: applied,
      targetKrw: null,
      deltaKrw: null,
      isMismatch: false,
      statusLabel: '타겟없음',
    };
  }

  if (applied == null) {
    return {
      appliedKrw: null,
      targetKrw: target,
      deltaKrw: null,
      isMismatch: false,
      statusLabel: '실제값없음',
    };
  }

  const delta = target - applied;
  return {
    appliedKrw: applied,
    targetKrw: target,
    deltaKrw: delta,
    isMismatch: delta !== 0,
    statusLabel: delta === 0 ? '일치' : (thresholdNoPushNormal ? '정상(Threshold 미통과)' : '미적용'),
    isThresholdNoPushNormal: delta !== 0 && thresholdNoPushNormal,
  };
}

export function resolveColorPlatingDisplay({ candidateAmounts, fallbackDeltaKrw }) {
  const normalized = Array.from(new Set((Array.isArray(candidateAmounts) ? candidateAmounts : [])
    .map((value) => toRoundedKrw(value))
    .filter((value) => value != null)));

  if (normalized.length === 1) {
    return {
      resolvedDeltaKrw: normalized[0],
      sourceLabel: '색상룰 기준',
    };
  }

  return {
    resolvedDeltaKrw: toRoundedKrw(fallbackDeltaKrw) ?? 0,
    sourceLabel: '기존 저장값',
  };
}


const toLatestIso = (values) => {
  let latest = null;
  let latestMs = -1;
  for (const value of Array.isArray(values) ? values : []) {
    const iso = typeof value === 'string' ? value.trim() : '';
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latest = iso;
      latestMs = ms;
    }
  }
  return latest;
};

export function summarizeOptionStateMoments(rows) {
  const normalizedRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
  const latestUpdatedRow = normalizedRows.reduce((best, row) => {
    const iso = typeof row.updated_at === 'string' ? row.updated_at.trim() : '';
    const ms = iso ? Date.parse(iso) : Number.NaN;
    if (!Number.isFinite(ms)) return best;
    if (!best) return row;
    const bestIso = typeof best.updated_at === 'string' ? best.updated_at.trim() : '';
    const bestMs = bestIso ? Date.parse(bestIso) : Number.NaN;
    if (!Number.isFinite(bestMs) || ms > bestMs) return row;
    return best;
  }, null);

  return {
    lastPushedAt: toLatestIso(normalizedRows.map((row) => row.last_pushed_at)),
    lastVerifiedAt: toLatestIso(normalizedRows.map((row) => row.last_verified_at)),
    lastPushStatus: latestUpdatedRow && typeof latestUpdatedRow.last_push_status === 'string' ? latestUpdatedRow.last_push_status.trim() || null : null,
    lastPushError: latestUpdatedRow && typeof latestUpdatedRow.last_push_error === 'string' ? latestUpdatedRow.last_push_error.trim() || null : null,
  };
}


export function buildPreviewTruthSections({
  appliedKrw,
  targetKrw,
  lastPushedAt,
  lastVerifiedAt,
  computedAt,
  thresholdNoPushNormal = false,
}) {
  const summary = buildAppliedTargetSummary({ appliedKrw, targetKrw, thresholdNoPushNormal });
  const computeRows = [
    { label: '타겟값', value: summary.targetKrw },
    ...(summary.isMismatch && summary.deltaKrw != null ? [{ label: '차이', value: summary.deltaKrw }] : []),
    { label: '마지막 계산', value: typeof computedAt === 'string' && computedAt.trim() ? computedAt.trim() : null },
  ];
  return {
    statusLabel: summary.statusLabel,
    isMismatch: summary.isMismatch,
    storeRows: [
      { label: '실제 적용값', value: summary.appliedKrw },
      { label: '마지막 옵션 push', value: typeof lastPushedAt === 'string' && lastPushedAt.trim() ? lastPushedAt.trim() : null },
      { label: '마지막 verify', value: typeof lastVerifiedAt === 'string' && lastVerifiedAt.trim() ? lastVerifiedAt.trim() : null },
    ],
    computeRows,
  };
}
