export type MaterialRegistrySeed = {
  channel_id: string;
  material_code: string;
  material_label: string;
  material_type: 'GOLD' | 'SILVER';
  tick_source: 'GOLD' | 'SILVER';
  factor_ref: string;
  sort_order: number;
  is_active: true;
};

type MaterialChoice = { material_code: string; material_label: string };
type SizeChoice = { value: string; label: string; delta_krw?: number | null };

const DEFAULT_MATERIALS: Array<Omit<MaterialRegistrySeed, 'channel_id'>> = [
  { material_code: '14', material_label: '14K', material_type: 'GOLD', tick_source: 'GOLD', factor_ref: '14', sort_order: 0, is_active: true },
  { material_code: '18', material_label: '18K', material_type: 'GOLD', tick_source: 'GOLD', factor_ref: '18', sort_order: 1, is_active: true },
  { material_code: '24', material_label: '24K', material_type: 'GOLD', tick_source: 'GOLD', factor_ref: '24', sort_order: 2, is_active: true },
  { material_code: '925', material_label: '925실버', material_type: 'SILVER', tick_source: 'SILVER', factor_ref: '925', sort_order: 3, is_active: true },
  { material_code: '999', material_label: '999실버', material_type: 'SILVER', tick_source: 'SILVER', factor_ref: '999', sort_order: 4, is_active: true },
];

export const normalizeWorkbenchMaterialCode = (raw: string | null | undefined): string | null => {
  const value = String(raw ?? '').trim().toUpperCase();
  if (!value) return null;
  if (value.includes('925')) return '925';
  if (value.includes('999')) return '999';
  if (value.includes('24')) return '24';
  if (value.includes('18')) return '18';
  if (value.includes('14')) return '14';
  return value;
};

export const buildGeneratedMaterialRegistrySeeds = (channelId: string): MaterialRegistrySeed[] => {
  return DEFAULT_MATERIALS.map((row) => ({ ...row, channel_id: channelId }));
};

export const inferUniqueMaterialCode = (label: string, choices: MaterialChoice[]): string | null => {
  const normalized = normalizeWorkbenchMaterialCode(label);
  if (!normalized) return null;
  const matches = (choices ?? []).filter((choice) => choice.material_code === normalized || normalizeWorkbenchMaterialCode(choice.material_label) === normalized);
  return matches.length === 1 ? matches[0]!.material_code : null;
};

export const inferUniqueWeightForMaterialContext = (
  label: string,
  activeMaterialCode: string | null,
  choicesByMaterial: Record<string, SizeChoice[]>,
): number | null => {
  if (!activeMaterialCode) return null;
  const materialChoices = choicesByMaterial[activeMaterialCode] ?? [];
  const match = String(label ?? '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const normalized = Number(match[0]).toFixed(2);
  const matches = materialChoices.filter((choice) => String(choice.value) === normalized);
  return matches.length === 1 ? Number(matches[0]!.value) : null;
};
