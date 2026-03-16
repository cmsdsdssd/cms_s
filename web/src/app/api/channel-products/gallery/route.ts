import { NextResponse } from 'next/server';

import { getShopAdminClient, jsonError } from '@/lib/shop/admin';
import { buildGalleryCards } from '@/lib/shop/channel-products-gallery';
import { buildMasterImageUrl } from '@/lib/shop/master-image-url';
import { loadPublishedPriceStateByChannelProducts } from '@/lib/shop/publish-price-state';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get('channel_id') ?? '').trim();
  const query = String(searchParams.get('q') ?? '').trim().toLowerCase();
  if (!channelId) return jsonError('channel_id is required', 400);

  const mappingsRes = await sb
    .from('sales_channel_product')
    .select('channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, mapping_source, is_active, updated_at')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  if (mappingsRes.error) return jsonError(mappingsRes.error.message ?? 'gallery mappings lookup failed', 500);

  const mappings = mappingsRes.data ?? [];
  const masterIds = Array.from(new Set(mappings.map((row) => String(row.master_item_id ?? '').trim()).filter(Boolean)));
  const channelProductIds = Array.from(new Set(mappings.map((row) => String(row.channel_product_id ?? '').trim()).filter(Boolean)));
  const productNos = Array.from(new Set(mappings.map((row) => String(row.external_product_no ?? '').trim()).filter(Boolean)));

  const [masterRes, explicitMapRes, publishRes] = await Promise.all([
    masterIds.length > 0
      ? sb.from('cms_master_item').select('master_item_id, model_name, image_path').in('master_item_id', masterIds)
      : Promise.resolve({ data: [], error: null }),
    productNos.length > 0
      ? sb.from('channel_product_option_entry_mapping_v1').select('external_product_no').eq('channel_id', channelId).in('external_product_no', productNos).eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    loadPublishedPriceStateByChannelProducts({ sb, channelId, channelProductIds }),
  ]);

  if (masterRes.error) return jsonError(masterRes.error.message ?? 'gallery master lookup failed', 500);
  if (explicitMapRes.error) return jsonError(explicitMapRes.error.message ?? 'gallery explicit mapping lookup failed', 500);
  if (!publishRes.available) return jsonError('published price state unavailable', 500);

  const masterMetaById = Object.fromEntries((masterRes.data ?? []).map((row) => [
    String(row.master_item_id ?? '').trim(),
    {
      model_name: String(row.model_name ?? '').trim() || null,
      image_url: buildMasterImageUrl(sb, row.image_path ? String(row.image_path) : null),
    },
  ]));
  const publishedByChannelProductId = Object.fromEntries(Array.from(publishRes.rowsByChannelProduct.values()).map((row) => [
    row.channelProductId,
    {
      publishedBasePriceKrw: row.publishedBasePriceKrw,
      publishedAdditionalAmountKrw: row.publishedAdditionalAmountKrw,
      publishedTotalPriceKrw: row.publishedTotalPriceKrw,
    },
  ]));
  const mappingCountByProductNo = (explicitMapRes.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const productNo = String(row.external_product_no ?? '').trim();
    if (!productNo) return acc;
    acc[productNo] = (acc[productNo] ?? 0) + 1;
    return acc;
  }, {});

  let cards = buildGalleryCards({
    mappings: mappings as any,
    masterMetaById,
    publishedByChannelProductId,
    mappingCountByProductNo,
    unresolvedProductNos: new Set<string>(),
  });

  if (query) {
    cards = cards.filter((card) => {
      const haystack = [card.external_product_no, card.master_item_id, card.model_name ?? ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  return NextResponse.json({ data: cards }, { headers: { 'Cache-Control': 'no-store' } });
}
