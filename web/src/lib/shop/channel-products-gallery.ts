export type GalleryMappingRow = {
  channel_product_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  external_variant_code: string | null;
  mapping_source: string;
  is_active: boolean;
  updated_at: string;
};

export type GalleryMasterMeta = {
  model_name: string | null;
  image_url: string | null;
};

export type GalleryPublishedState = {
  publishedBasePriceKrw: number;
  publishedAdditionalAmountKrw: number;
  publishedTotalPriceKrw: number;
};

export type GalleryCard = {
  card_id: string;
  channel_id: string;
  master_item_id: string;
  external_product_no: string;
  model_name: string | null;
  thumbnail_url: string | null;
  variant_count: number;
  base_count: number;
  active_count: number;
  mapping_count: number;
  has_unresolved: boolean;
  publish_status: 'PUBLISHED' | 'UNPUBLISHED' | 'UNRESOLVED';
  published_base_price_krw: number | null;
  published_min_price_krw: number | null;
  published_max_price_krw: number | null;
  updated_at: string | null;
};

const normalizeVariantCode = (value: string | null | undefined) => String(value ?? '').trim();
const cardIdOf = (channelId: string, masterItemId: string, externalProductNo: string) => [channelId, masterItemId, externalProductNo].join('::');

export const buildGalleryCards = (args: {
  mappings: GalleryMappingRow[];
  masterMetaById: Record<string, GalleryMasterMeta>;
  publishedByChannelProductId: Record<string, GalleryPublishedState>;
  mappingCountByProductNo: Record<string, number>;
  unresolvedProductNos: Set<string>;
}): GalleryCard[] => {
  const grouped = new Map<string, GalleryMappingRow[]>();
  for (const row of args.mappings ?? []) {
    const key = cardIdOf(row.channel_id, row.master_item_id, row.external_product_no);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([card_id, rows]) => {
    const sorted = [...rows].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    const sample = sorted[0]!;
    const publishedStates = sorted
      .map((row) => args.publishedByChannelProductId[row.channel_product_id])
      .filter((row): row is GalleryPublishedState => Boolean(row));
    const publishedTotals = publishedStates.map((row) => row.publishedTotalPriceKrw).filter((value) => Number.isFinite(value));
    const baseState = sorted
      .find((row) => !normalizeVariantCode(row.external_variant_code))
      ?.channel_product_id;
    const publishedBase = baseState ? args.publishedByChannelProductId[baseState]?.publishedBasePriceKrw ?? null : null;
    const unresolved = args.unresolvedProductNos.has(sample.external_product_no);
    return {
      card_id,
      channel_id: sample.channel_id,
      master_item_id: sample.master_item_id,
      external_product_no: sample.external_product_no,
      model_name: args.masterMetaById[sample.master_item_id]?.model_name ?? null,
      thumbnail_url: args.masterMetaById[sample.master_item_id]?.image_url ?? null,
      variant_count: sorted.filter((row) => Boolean(normalizeVariantCode(row.external_variant_code))).length,
      base_count: sorted.filter((row) => !normalizeVariantCode(row.external_variant_code)).length,
      active_count: sorted.filter((row) => row.is_active).length,
      mapping_count: args.mappingCountByProductNo[sample.external_product_no] ?? sorted.length,
      has_unresolved: unresolved,
      publish_status: (unresolved ? 'UNRESOLVED' : (publishedStates.length > 0 ? 'PUBLISHED' : 'UNPUBLISHED')) as 'UNRESOLVED' | 'PUBLISHED' | 'UNPUBLISHED',
      published_base_price_krw: publishedBase,
      published_min_price_krw: publishedTotals.length > 0 ? Math.min(...publishedTotals) : publishedBase,
      published_max_price_krw: publishedTotals.length > 0 ? Math.max(...publishedTotals) : publishedBase,
      updated_at: sample.updated_at ?? null,
    };
  }).sort((a, b) => Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? ''));
};
