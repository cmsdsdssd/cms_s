import type { BaseBreakdownRow, DetailedBaseBreakdown } from '@/lib/shop/base-breakdown-rows';

export type EditorRowCategory = 'MATERIAL' | 'SIZE' | 'COLOR_PLATING' | 'DECOR' | 'ADDON' | 'OTHER' | 'NOTICE';

export type GalleryDetailEditorRow = {
  entry_key: string;
  axis_index: number;
  option_name: string;
  option_value: string;
  category_key: EditorRowCategory | null;
  published_delta_krw: number;
  resolved_delta_krw: number;
  status: 'READY' | 'UNRESOLVED';
  unresolved_reason: string | null;
  material_registry_code: string | null;
  weight_g: number | null;
  combo_code: string | null;
  color_bucket_id: string | null;
  decor_master_id: string | null;
  addon_master_id: string | null;
  other_reason_code: string | null;
  explicit_delta_krw: number | null;
  notice_code: string | null;
};

export type GalleryDetailEditorGroup = {
  axis_index: number;
  option_name: string;
  rows: GalleryDetailEditorRow[];
};

export type GalleryDetailBaseBreakdown = {
  target_price_raw_krw: number | null;
  published_base_price_krw: number | null;
  publish_version: string | null;
  computed_at: string | null;
  snapshot_available: boolean;
  rows: BaseBreakdownRow[];
  detailed: DetailedBaseBreakdown | null;
};

export type GalleryDetailSummary = {
  base_price_krw: number | null;
  base_breakdown: GalleryDetailBaseBreakdown | null;
  master_material_code: string | null;
  mapping_count: number;
  option_rows: Array<{ option_axis_index: number; option_name: string; option_value: string; published_delta_krw: number }>;
  editor_rows: GalleryDetailEditorRow[];
  editor_groups: GalleryDetailEditorGroup[];
  variant_rows: Array<{ variantCode: string; finalPriceKrw: number; optionLabel: string }>;
  unresolved: boolean;
  unresolved_reasons: string[];
};

export const buildGalleryDetailSummary = (args: {
  basePriceKrw: number | null;
  baseBreakdown: GalleryDetailBaseBreakdown | null;
  masterMaterialCode: string | null;
  explicitMappingCount: number;
  optionEntries: Array<{ option_axis_index: number; option_name: string; option_value: string; published_delta_krw: number }>;
  editorRows: GalleryDetailEditorRow[];
  variants: Array<{ variantCode: string; finalPriceKrw: number; optionLabel: string }>;
  unresolvedReasons: string[];
}): GalleryDetailSummary => {
  const editorGroups = args.editorRows.reduce<GalleryDetailEditorGroup[]>((groups, row) => {
    const existing = groups.find((group) => group.axis_index === row.axis_index && group.option_name === row.option_name);
    if (existing) {
      existing.rows.push(row);
      return groups;
    }
    groups.push({ axis_index: row.axis_index, option_name: row.option_name, rows: [row] });
    return groups;
  }, []).sort((a, b) => a.axis_index - b.axis_index);

  for (const group of editorGroups) {
    group.rows.sort((a, b) => a.option_value.localeCompare(b.option_value, 'ko'));
  }

  return {
    base_price_krw: args.basePriceKrw,
    base_breakdown: args.baseBreakdown,
    master_material_code: args.masterMaterialCode,
    mapping_count: args.explicitMappingCount,
    option_rows: args.optionEntries,
    editor_rows: args.editorRows,
    editor_groups: editorGroups,
    variant_rows: args.variants,
    unresolved: (args.unresolvedReasons ?? []).length > 0 || args.editorRows.some((row) => row.status === 'UNRESOLVED'),
    unresolved_reasons: args.unresolvedReasons ?? [],
  };
};
