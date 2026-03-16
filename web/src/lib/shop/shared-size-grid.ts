import { normalizeMaterialCode } from '@/lib/material-factors';

const toWeightText = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '';
};

export const collapseSharedSizeGridRows = (rows: Array<Record<string, unknown>>) => {
  const deduped = new Map<string, Record<string, unknown>>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const materialCode = normalizeMaterialCode(String(row?.material_code ?? ""));
    const weightText = toWeightText(row?.weight_g);
    if (!materialCode || !weightText) continue;
    const key = `${materialCode}::${weightText}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }
  return Array.from(deduped.values());
};
