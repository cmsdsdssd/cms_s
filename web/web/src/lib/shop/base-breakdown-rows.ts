type SnapshotLike = {
  material_final_krw?: unknown;
  labor_sell_total_plus_absorb_krw?: unknown;
  fixed_pre_fee_krw?: unknown;
  candidate_price_krw?: unknown;
  guardrail_price_krw?: unknown;
  guardrail_reason_code?: unknown;
  rounded_target_price_krw?: unknown;
  material_code_effective?: unknown;
};

export type BaseBreakdownRow = {
  label: string;
  amountKrw: number;
  detail: string | null;
};

const toRoundedInt = (value: unknown): number | null => {
  const numeric = Number(value ?? Number.NaN);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

export function buildBaseBreakdownRows(args: {
  publishedBasePriceKrw: number | null | undefined;
  targetPriceRawKrw?: number | null | undefined;
  snapshot?: SnapshotLike | null | undefined;
}): BaseBreakdownRow[] {
  const rows: BaseBreakdownRow[] = [];
  const publishedBasePriceKrw = toRoundedInt(args.publishedBasePriceKrw);
  const targetPriceRawKrw = toRoundedInt(args.targetPriceRawKrw);
  const snapshot = args.snapshot ?? null;

  const pushRow = (label: string, amount: unknown, detail?: string | null) => {
    const amountKrw = toRoundedInt(amount);
    if (amountKrw === null) return;
    rows.push({ label, amountKrw, detail: detail ?? null });
  };

  if (snapshot) {
    const materialCode = String(snapshot.material_code_effective ?? '').trim();
    pushRow('소재 구성', snapshot.material_final_krw, materialCode ? materialCode + ' 기준' : null);
    pushRow('공임 구성', snapshot.labor_sell_total_plus_absorb_krw);
    pushRow('고정 구성', snapshot.fixed_pre_fee_krw);
    pushRow('후보 기준가', snapshot.candidate_price_krw);
    pushRow('가드레일', snapshot.guardrail_price_krw, String(snapshot.guardrail_reason_code ?? '').trim() || null);
    pushRow('반올림', snapshot.rounded_target_price_krw);
  } else if (targetPriceRawKrw !== null) {
    pushRow('계산 목표가', targetPriceRawKrw, 'publish raw target');
  }

  if (publishedBasePriceKrw !== null) {
    pushRow('게시 기준가', publishedBasePriceKrw);
  }

  return rows;
}
