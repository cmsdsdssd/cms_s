import { NextResponse } from 'next/server';

import { getShopAdminClient, jsonError, parseJsonObject } from '@/lib/shop/admin';
import { buildGeneratedColorBucketSeeds } from '@/lib/shop/color-bucket-generation';
import { buildGeneratedMaterialRegistrySeeds } from '@/lib/shop/option-workbench-sot';
import {
  normalizeCentralRegistryPayload,
  validateCentralRegistryPayload,
} from '@/lib/shop/option-central-registry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const toTrimmed = (value: unknown): string => String(value ?? '').trim();

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const { searchParams } = new URL(request.url);
  const channelId = toTrimmed(searchParams.get('channel_id'));
  if (!channelId) return jsonError('channel_id is required', 400);

  const [materialsRes, colorBucketsRes, addonMastersRes, noticeCodesRes, otherReasonCodesRes, colorComboRes, publishedColorRes] = await Promise.all([
    sb.from('channel_option_material_registry_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('material_code', { ascending: true }),
    sb.from('channel_option_color_bucket_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('bucket_code', { ascending: true }),
    sb.from('channel_option_addon_master_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('addon_code', { ascending: true }),
    sb.from('channel_option_notice_code_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('notice_code', { ascending: true }),
    sb.from('channel_option_other_reason_code_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('reason_code', { ascending: true }),
    sb.from('channel_color_combo_catalog_v1').select('base_delta_krw').eq('channel_id', channelId).eq('is_active', true),
    sb.from('product_price_publish_option_entry_v1').select('option_name, published_delta_krw').eq('channel_id', channelId).limit(5000),
  ]);

  for (const result of [materialsRes, colorBucketsRes, addonMastersRes, noticeCodesRes, otherReasonCodesRes, colorComboRes, publishedColorRes]) {
    if (result.error) return jsonError(result.error.message ?? 'central registry lookup failed', 500);
  }

  const existingMaterials = materialsRes.data ?? [];
  const existingMaterialCodes = new Set(existingMaterials.map((row) => String(row.material_code ?? '').trim()));
  const generatedMaterialSeeds = buildGeneratedMaterialRegistrySeeds(channelId).filter((row) => !existingMaterialCodes.has(row.material_code));
  if (generatedMaterialSeeds.length > 0) {
    const upsertMaterialRes = await sb.from('channel_option_material_registry_v1').upsert(generatedMaterialSeeds, { onConflict: 'channel_id,material_code' });
    if (upsertMaterialRes.error) return jsonError(upsertMaterialRes.error.message ?? 'generated material registry upsert failed', 500);
  }
  const finalMaterialsRes = generatedMaterialSeeds.length > 0
    ? await sb.from('channel_option_material_registry_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('material_code', { ascending: true })
    : materialsRes;
  if (finalMaterialsRes.error) return jsonError(finalMaterialsRes.error.message ?? 'final material registry lookup failed', 500);

  const existingBuckets = colorBucketsRes.data ?? [];
  const existingBucketCodes = new Set(existingBuckets.map((row) => String(row.bucket_code ?? '').trim()));
  const generatedBucketSeeds = buildGeneratedColorBucketSeeds({
    channelId,
    deltas: [
      ...(colorComboRes.data ?? []).map((row) => Number((row as { base_delta_krw?: unknown }).base_delta_krw ?? 0)),
      ...((publishedColorRes.data ?? []) as Array<{ option_name?: string | null; published_delta_krw?: unknown }>)
        .filter((row) => String(row.option_name ?? '').trim() === '색상')
        .map((row) => Number(row.published_delta_krw ?? 0)),
    ],
  }).filter((row) => !existingBucketCodes.has(row.bucket_code));

  if (generatedBucketSeeds.length > 0) {
    const upsertRes = await sb.from('channel_option_color_bucket_v1').upsert(generatedBucketSeeds, { onConflict: 'channel_id,bucket_code' });
    if (upsertRes.error) return jsonError(upsertRes.error.message ?? 'generated color bucket upsert failed', 500);
  }

  const finalColorBucketsRes = generatedBucketSeeds.length > 0
    ? await sb.from('channel_option_color_bucket_v1').select('*').eq('channel_id', channelId).order('sort_order', { ascending: true }).order('bucket_code', { ascending: true })
    : colorBucketsRes;
  if (finalColorBucketsRes.error) return jsonError(finalColorBucketsRes.error.message ?? 'final color bucket lookup failed', 500);

  return NextResponse.json({
    data: {
      materials: finalMaterialsRes.data ?? materialsRes.data ?? [],
      color_buckets: finalColorBucketsRes.data ?? [],
      addon_masters: addonMastersRes.data ?? [],
      notice_codes: noticeCodesRes.data ?? [],
      other_reason_codes: otherReasonCodesRes.data ?? [],
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const raw = await request.json().catch(() => null);
  const body = parseJsonObject(raw);
  if (!body) return jsonError('Invalid request body', 400);

  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (rawRows.length === 0) return jsonError('rows is required', 400);

  const normalizedRows = [];
  for (let index = 0; index < rawRows.length; index += 1) {
    const rawRow = parseJsonObject(rawRows[index]);
    if (!rawRow) return jsonError(`rows[${index}] must be object`, 400);
    let normalized;
    try {
      normalized = normalizeCentralRegistryPayload(rawRow);
    } catch (error) {
      return jsonError(`rows[${index}]: ${error instanceof Error ? error.message : 'invalid registry payload'}`, 400);
    }
    const validation = validateCentralRegistryPayload(normalized);
    if (!validation.ok) {
      return jsonError(`rows[${index}]: ${validation.errors[0] ?? 'invalid central registry payload'}`, 422, {
        errors: validation.errors,
      });
    }
    normalizedRows.push(normalized);
  }

  const changedBy =
    toTrimmed(request.headers.get('x-user-email'))
    || toTrimmed(request.headers.get('x-user-id'))
    || toTrimmed(request.headers.get('x-user'))
    || null;
  const changeReason = typeof body.change_reason === 'string' ? toTrimmed(body.change_reason) : null;

  const { data, error } = await sb.rpc('cms_fn_upsert_channel_option_central_registries_v1', {
    p_rows: normalizedRows,
    p_changed_by: changedBy,
    p_change_reason: changeReason,
  });
  if (error) return jsonError(error.message ?? 'central registry save failed', 400);

  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
