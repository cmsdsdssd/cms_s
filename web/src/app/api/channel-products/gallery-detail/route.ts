import { NextResponse } from 'next/server';

import { getShopAdminClient, isMissingSchemaObjectError, jsonError } from '@/lib/shop/admin';
import { buildBaseBreakdownRows, buildDetailedBaseBreakdown } from '@/lib/shop/base-breakdown-rows';
import { buildGalleryDetailSummary, type GalleryDetailEditorRow } from '@/lib/shop/channel-products-gallery-detail';
import { buildMasterImageUrl } from '@/lib/shop/master-image-url';
import { loadPublishedPriceStateByChannelProducts } from '@/lib/shop/publish-price-state';
import { createPersistedSizeGridLookup, resolvePersistedSizeGridCell } from '@/lib/shop/weight-grid-store.js';
import { ensureSharedSizeGridRowsForChannel } from '@/lib/shop/shared-size-grid-runtime';
import { resolveCentralOptionMapping } from '@/lib/shop/channel-option-central-control.js';
import { mappingOptionEntryKey } from '@/lib/shop/mapping-option-details';
import { buildGeneratedMaterialRegistrySeeds } from '@/lib/shop/option-workbench-sot';
import { cafe24ListProductVariants, ensureValidCafe24AccessToken, loadCafe24Account } from '@/lib/shop/cafe24';
import { normalizeMaterialCode } from '@/lib/material-factors';
import type { PricingSnapshotExplainRow } from '@/types/pricingSnapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BasePricingSnapshotRow = Partial<PricingSnapshotExplainRow> & {
  snapshot_id?: string | null;
  tick_as_of?: string | null;
  rounding_unit_used?: number | null;
  rounding_mode_used?: string | null;
  material_factor_multiplier_used?: number | null;
};

const inferMaterialRegistryCodeFromOptionValue = (optionValue: string): string | null => {
  const upper = String(optionValue ?? '').trim().toUpperCase();
  if (upper.includes('925')) return '925';
  if (upper.includes('999')) return '999';
  if (upper.includes('24')) return '24';
  if (upper.includes('18')) return '18';
  if (upper.includes('14')) return '14';
  const normalized = normalizeMaterialCode(optionValue);
  if (normalized && normalized !== '00') return normalized;
  return null;
};

const inferAxisIndex = (optionName: string): number => {
  const trimmed = String(optionName ?? '').trim();
  if (trimmed === '소재') return 1;
  if (trimmed === '사이즈') return 2;
  if (trimmed === '색상') return 3;
  if (trimmed === '장식') return 4;
  if (trimmed === '분류') return 5;
  return 99;
};

const toResolvedMaterialCode = (
  explicitMaterialCode: unknown,
  optionValue: string,
  fallbackMaterialCode: string | null,
): string | null => {
  const explicit = String(explicitMaterialCode ?? '').trim();
  if (explicit) return explicit;
  return inferMaterialRegistryCodeFromOptionValue(optionValue) || fallbackMaterialCode;
};

export async function GET(request: Request) {
  const sb = getShopAdminClient();
  if (!sb) return jsonError('Supabase server env missing', 500);

  const { searchParams } = new URL(request.url);
  const channelId = String(searchParams.get('channel_id') ?? '').trim();
  const masterItemId = String(searchParams.get('master_item_id') ?? '').trim();
  const externalProductNo = String(searchParams.get('external_product_no') ?? '').trim();
  if (!channelId || !masterItemId || !externalProductNo) {
    return jsonError('channel_id, master_item_id, external_product_no are required', 400);
  }

  const [mappingRes, masterRes, explicitRes, materialsRes, colorBucketRes, addonRes, noticeRes, reasonRes, optionEntryRes] = await Promise.all([
    sb.from('sales_channel_product').select('channel_product_id, external_product_no, external_variant_code, updated_at').eq('channel_id', channelId).eq('master_item_id', masterItemId).eq('external_product_no', externalProductNo).eq('is_active', true).order('updated_at', { ascending: false }),
    sb.from('cms_master_item').select('master_item_id, model_name, image_path, material_code_default').eq('master_item_id', masterItemId).maybeSingle(),
    sb.from('channel_product_option_entry_mapping_v1').select('*').eq('channel_id', channelId).eq('external_product_no', externalProductNo).eq('is_active', true).order('option_name', { ascending: true }).order('option_value', { ascending: true }),
    sb.from('channel_option_material_registry_v1').select('material_code, material_label, material_type, tick_source, factor_ref, is_active, sort_order').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }).order('material_code', { ascending: true }),
    sb.from('channel_option_color_bucket_v1').select('color_bucket_id, bucket_code, bucket_label, sell_delta_krw').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }),
    sb.from('channel_option_addon_master_v1').select('addon_master_id, addon_code, addon_name, base_amount_krw, extra_delta_krw').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }),
    sb.from('channel_option_notice_code_v1').select('notice_code, display_text').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }),
    sb.from('channel_option_other_reason_code_v1').select('reason_code, display_text').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }),
    sb.from('product_price_publish_option_entry_v1').select('option_axis_index, option_name, option_value, published_delta_krw, publish_version').eq('channel_id', channelId).eq('master_item_id', masterItemId).eq('external_product_no', externalProductNo).order('publish_version', { ascending: false }).order('option_axis_index', { ascending: true }),
  ]);

  if (mappingRes.error) return jsonError(mappingRes.error.message ?? 'gallery detail mapping lookup failed', 500);
  if (masterRes.error) return jsonError(masterRes.error.message ?? 'gallery detail master lookup failed', 500);
  if (explicitRes.error) return jsonError(explicitRes.error.message ?? 'gallery detail explicit lookup failed', 500);
  if (materialsRes.error) return jsonError(materialsRes.error.message ?? 'gallery detail material registry lookup failed', 500);
  if (colorBucketRes.error) return jsonError(colorBucketRes.error.message ?? 'gallery detail bucket lookup failed', 500);
  if (addonRes.error) return jsonError(addonRes.error.message ?? 'gallery detail addon lookup failed', 500);
  if (noticeRes.error) return jsonError(noticeRes.error.message ?? 'gallery detail notice lookup failed', 500);
  if (reasonRes.error) return jsonError(reasonRes.error.message ?? 'gallery detail reason lookup failed', 500);
  if (optionEntryRes.error) return jsonError(optionEntryRes.error.message ?? 'gallery detail option entry lookup failed', 500);

  const colorBucketDeltaById = Object.fromEntries(
    ((colorBucketRes.data ?? []) as Array<{ color_bucket_id?: string | null; sell_delta_krw?: number | null }>)
      .map((row) => [String(row.color_bucket_id ?? '').trim(), Math.max(0, Math.round(Number(row.sell_delta_krw ?? 0)))])
      .filter(([key]) => Boolean(key)),
  );

  const addonAmountById = Object.fromEntries(
    ((addonRes.data ?? []) as Array<{ addon_master_id?: string | null; base_amount_krw?: number | null; extra_delta_krw?: number | null }>)
      .map((row) => [
        String(row.addon_master_id ?? '').trim(),
        Math.max(0, Math.round(Number(row.base_amount_krw ?? 0)) + Math.round(Number(row.extra_delta_krw ?? 0))),
      ])
      .filter(([key]) => Boolean(key)),
  );

  const decorRuleRes = await sb
    .from('channel_option_labor_rule_v1')
    .select('rule_id, category_key, decoration_master_id, decoration_model_name, base_labor_cost_krw, additive_delta_krw, is_active')
    .eq('channel_id', channelId)
    .eq('master_item_id', masterItemId)
    .eq('external_product_no', externalProductNo)
    .eq('is_active', true)
    .eq('category_key', 'DECOR')
    .limit(5000);
  if (decorRuleRes.error && !isMissingSchemaObjectError(decorRuleRes.error, 'channel_option_labor_rule_v1')) {
    return jsonError(decorRuleRes.error.message ?? 'decor rule lookup failed', 500);
  }
  const decorRules = decorRuleRes.error ? [] : (decorRuleRes.data ?? []);

  let finalMaterials = materialsRes.data ?? [];
  if (finalMaterials.length === 0) {
    const generatedMaterialSeeds = buildGeneratedMaterialRegistrySeeds(channelId);
    const upsertMaterialRes = await sb.from('channel_option_material_registry_v1').upsert(generatedMaterialSeeds, { onConflict: 'channel_id,material_code' });
    if (upsertMaterialRes.error) return jsonError(upsertMaterialRes.error.message ?? 'gallery detail generated material registry upsert failed', 500);
    const refetchMaterialsRes = await sb.from('channel_option_material_registry_v1').select('material_code, material_label, material_type, tick_source, factor_ref, is_active, sort_order').eq('channel_id', channelId).eq('is_active', true).order('sort_order', { ascending: true }).order('material_code', { ascending: true });
    if (refetchMaterialsRes.error) return jsonError(refetchMaterialsRes.error.message ?? 'gallery detail refetch material registry failed', 500);
    finalMaterials = refetchMaterialsRes.data ?? [];
  }

  const activeMappings = mappingRes.data ?? [];
  const channelProductIds = activeMappings.map((row) => String(row.channel_product_id ?? '').trim()).filter(Boolean);
  const baseMapping = activeMappings.find((row) => !String(row.external_variant_code ?? '').trim()) ?? null;
  const baseChannelProductId = String(baseMapping?.channel_product_id ?? '').trim();
  const latestBasePublishRes = await loadPublishedPriceStateByChannelProducts({
    sb,
    channelId,
    channelProductIds: baseChannelProductId ? [baseChannelProductId] : channelProductIds,
  });
  if (!latestBasePublishRes.available) return jsonError('published price state unavailable', 500);
  const latestBasePublished = baseChannelProductId ? latestBasePublishRes.rowsByChannelProduct.get(baseChannelProductId) ?? null : null;
  const canonicalPublishVersion = latestBasePublished?.publishVersion ?? null;
  const publishRes = canonicalPublishVersion
    ? await loadPublishedPriceStateByChannelProducts({ sb, channelId, channelProductIds, publishVersions: [canonicalPublishVersion] })
    : latestBasePublishRes;
  if (!publishRes.available) return jsonError('published price state unavailable', 500);

  const basePublished = baseChannelProductId ? publishRes.rowsByChannelProduct.get(baseChannelProductId) ?? latestBasePublished ?? null : null;



  let baseSnapshot: BasePricingSnapshotRow | null = null;
  if (baseMapping) {
    if (baseChannelProductId) {
      const snapshotRes = await sb
        .from('pricing_snapshot')
        .select('*')
        .eq('channel_product_id', baseChannelProductId)
        .order('computed_at', { ascending: false })
        .limit(1);
      if (snapshotRes.error && !isMissingSchemaObjectError(snapshotRes.error, 'pricing_snapshot')) {
        return jsonError(snapshotRes.error.message ?? 'gallery detail base snapshot lookup failed', 500);
      }
      if (!snapshotRes.error) {
        baseSnapshot = ((snapshotRes.data ?? [])[0] ?? null) as BasePricingSnapshotRow | null;
      }
      const snapshotId = String(baseSnapshot?.snapshot_id ?? '').trim();
      if (snapshotId) {
        const laborComponentRes = await sb
          .from('pricing_snapshot_labor_component_v2')
          .select('component_key, labor_class, labor_cost_krw, labor_absorb_applied_krw, labor_absorb_raw_krw, labor_cost_plus_absorb_krw, labor_sell_krw, labor_sell_plus_absorb_krw')
          .eq('snapshot_id', snapshotId)
          .limit(100);
        if (laborComponentRes.error && !isMissingSchemaObjectError(laborComponentRes.error, 'pricing_snapshot_labor_component_v2')) {
          return jsonError(laborComponentRes.error.message ?? 'labor component lookup failed', 500);
        }
        if (!laborComponentRes.error && (laborComponentRes.data ?? []).length > 0 && baseSnapshot) {
          const laborComponentJson = Object.fromEntries((laborComponentRes.data ?? []).map((row) => [
            String(row.component_key ?? '').trim(),
            {
              labor_class: String(row.labor_class ?? '').trim() || undefined,
              labor_cost_krw: row.labor_cost_krw,
              labor_absorb_applied_krw: row.labor_absorb_applied_krw,
              labor_absorb_raw_krw: row.labor_absorb_raw_krw,
              labor_cost_plus_absorb_krw: row.labor_cost_plus_absorb_krw,
              labor_sell_krw: row.labor_sell_krw,
              labor_sell_plus_absorb_krw: row.labor_sell_plus_absorb_krw,
            },
          ]));
          baseSnapshot = { ...baseSnapshot, labor_component_json: laborComponentJson };
        }
      }
    }
  }

  const allPublishedOptionRows = (optionEntryRes.data ?? [])
    .filter((row) => !(String(row.option_name ?? '').trim() === '분류' && String(row.option_value ?? '').trim() === '분류'))
    .map((row) => ({
      publish_version: String(row.publish_version ?? '').trim() || null,
      option_axis_index: Math.max(0, Math.round(Number(row.option_axis_index ?? 0))),
      option_name: String(row.option_name ?? '').trim(),
      option_value: String(row.option_value ?? '').trim(),
      published_delta_krw: Math.max(0, Math.round(Number(row.published_delta_krw ?? 0))),
    }));
  const fallbackOptionEntryPublishVersion = allPublishedOptionRows.find((row) => row.publish_version)?.publish_version ?? null;
  const latestPublishVersion = canonicalPublishVersion && allPublishedOptionRows.some((row) => row.publish_version === canonicalPublishVersion)
    ? canonicalPublishVersion
    : fallbackOptionEntryPublishVersion;
  const publishedOptionRows = allPublishedOptionRows
    .filter((row) => !latestPublishVersion || row.publish_version === latestPublishVersion)
    .map((row) => ({
      option_axis_index: row.option_axis_index,
      option_name: row.option_name,
      option_value: row.option_value,
      published_delta_krw: row.published_delta_krw,
    }));

  const explicitByEntryKey = new Map((explicitRes.data ?? []).map((row) => [mappingOptionEntryKey(row.option_name, row.option_value), row]));
  const explicitOptionRows = (explicitRes.data ?? [])
    .filter((row) => !(String(row.option_name ?? '').trim() === '분류' && String(row.option_value ?? '').trim() === '분류'))
    .map((row) => ({
      option_axis_index: inferAxisIndex(String(row.option_name ?? '')),
      option_name: String(row.option_name ?? '').trim(),
      option_value: String(row.option_value ?? '').trim(),
      published_delta_krw: 0,
    }));
  const optionRows = publishedOptionRows.length > 0 ? publishedOptionRows : explicitOptionRows;
  const sharedGridRows = await ensureSharedSizeGridRowsForChannel({ sb, channelId });
  const sharedGridLookup = createPersistedSizeGridLookup(sharedGridRows);
  const masterMaterialCode = String(masterRes.data?.material_code_default ?? '').trim() || null;
  const sizeChoicesByMaterial = Object.fromEntries(Array.from(sharedGridLookup.choicesByMaterial.entries()));
  const sizeChoices = masterMaterialCode ? (sharedGridLookup.choicesByMaterial.get(masterMaterialCode) ?? []) : [];

  const explicitMaterialEntry = (explicitRes.data ?? []).find((row) => String(row.option_name ?? '').trim() === '소재') as Record<string, unknown> | undefined;
  const defaultEditorMaterialCode = toResolvedMaterialCode(
    explicitMaterialEntry?.material_registry_code,
    String(explicitMaterialEntry?.option_value ?? ''),
    masterMaterialCode,
  );

  const editorRows: GalleryDetailEditorRow[] = optionRows.map((row) => {
    const isMaterialAxis = String(row.option_name ?? '').trim() === '소재';
    const entryKey = mappingOptionEntryKey(row.option_name, row.option_value);
    const explicit = explicitByEntryKey.get(entryKey) as Record<string, unknown> | undefined;
    const explicitCategory = String(explicit?.category_key ?? '').trim().toUpperCase();
    const categoryKey = explicitCategory ? (explicitCategory as GalleryDetailEditorRow['category_key']) : null;
    const materialCodeForRow = isMaterialAxis
      ? toResolvedMaterialCode(explicit?.material_registry_code, row.option_value, defaultEditorMaterialCode)
      : toResolvedMaterialCode(explicit?.material_registry_code, '', defaultEditorMaterialCode);
    let resolvedDelta = isMaterialAxis || categoryKey === 'MATERIAL'
      ? 0
      : Math.max(0, Math.round(Number(explicit?.explicit_delta_krw ?? row.published_delta_krw ?? 0)));

    if (categoryKey === 'SIZE' && explicit?.weight_g != null && materialCodeForRow) {
      const sizeCell = resolvePersistedSizeGridCell({
        lookup: sharedGridLookup,
        materialCode: materialCodeForRow,
        additionalWeightG: Number(explicit.weight_g),
      });
      if (sizeCell.valid) resolvedDelta = Math.round(Number(sizeCell.computed_delta_krw ?? resolvedDelta));
    } else if (categoryKey === 'COLOR_PLATING') {
      const bucketDelta = Math.round(Number(colorBucketDeltaById[String(explicit?.color_bucket_id ?? '').trim()] ?? row.published_delta_krw ?? 0));
      resolvedDelta = Math.max(0, bucketDelta);
    } else if (categoryKey === 'DECOR') {
      const decorResolved = resolveCentralOptionMapping({
        category: 'DECOR',
        masterMaterialCode: materialCodeForRow,
        masterMaterialLabel: materialCodeForRow,
        rules: decorRules,
        persisted: {
          material_code_resolved: materialCodeForRow,
          decor_master_item_id_selected: String(explicit?.decor_master_id ?? '').trim() || null,
          decor_final_amount_krw: null,
          decor_extra_delta_krw: null,
          resolved_delta_krw: row.published_delta_krw ?? 0,
        },
      });
      resolvedDelta = Math.max(0, Math.round(Number(decorResolved.resolved_delta_krw ?? row.published_delta_krw ?? 0)));
    } else if (categoryKey === 'ADDON') {
      const addonDelta = Math.round(Number(addonAmountById[String(explicit?.addon_master_id ?? '').trim()] ?? row.published_delta_krw ?? 0));
      resolvedDelta = Math.max(0, addonDelta);
    }

    return {
      entry_key: entryKey,
      axis_index: row.option_axis_index,
      option_name: row.option_name,
      option_value: row.option_value,
      category_key: categoryKey,
      published_delta_krw: Math.max(0, Math.round(Number(row.published_delta_krw ?? 0))),
      resolved_delta_krw: resolvedDelta,
      status: !categoryKey
        ? 'UNRESOLVED'
        : categoryKey === 'DECOR' && !String(explicit?.decor_master_id ?? '').trim()
          ? 'UNRESOLVED'
          : categoryKey === 'COLOR_PLATING' && !String(explicit?.color_bucket_id ?? '').trim()
            ? 'UNRESOLVED'
            : categoryKey === 'ADDON' && !String(explicit?.addon_master_id ?? '').trim()
              ? 'UNRESOLVED'
              : 'READY',
      unresolved_reason: !categoryKey
        ? 'category required'
        : categoryKey === 'DECOR' && !String(explicit?.decor_master_id ?? '').trim()
          ? 'decor master required'
          : categoryKey === 'COLOR_PLATING' && !String(explicit?.color_bucket_id ?? '').trim()
            ? 'color bucket required'
            : categoryKey === 'ADDON' && !String(explicit?.addon_master_id ?? '').trim()
              ? 'addon master required'
              : null,
      material_registry_code: materialCodeForRow,
      weight_g: categoryKey === 'SIZE'
        ? (explicit?.weight_g == null ? null : Number(explicit.weight_g))
        : null,
      combo_code: categoryKey === 'COLOR_PLATING' ? (String(explicit?.combo_code ?? '').trim() || null) : null,
      color_bucket_id: categoryKey === 'COLOR_PLATING' ? (String(explicit?.color_bucket_id ?? '').trim() || null) : null,
      decor_master_id: categoryKey === 'DECOR' ? (String(explicit?.decor_master_id ?? '').trim() || null) : null,
      addon_master_id: categoryKey === 'ADDON' ? (String(explicit?.addon_master_id ?? '').trim() || null) : null,
      other_reason_code: categoryKey === 'OTHER' ? (String(explicit?.other_reason_code ?? '').trim() || null) : null,
      explicit_delta_krw: categoryKey === 'OTHER'
        ? Math.max(0, Math.round(Number(explicit?.explicit_delta_krw ?? row.published_delta_krw ?? 0)))
        : null,
      notice_code: categoryKey === 'NOTICE' ? (String(explicit?.notice_code ?? '').trim() || null) : null,
    };
  });

  const variantRows = activeMappings
    .filter((row) => String(row.external_variant_code ?? '').trim())
    .map((row) => {
      const state = publishRes.rowsByChannelProduct.get(String(row.channel_product_id ?? '').trim()) ?? null;
      return state
        ? {
            variantCode: state.externalVariantCode,
            finalPriceKrw: state.publishedTotalPriceKrw,
            optionLabel: state.externalVariantCode,
          }
        : null;
    })
    .filter((row): row is { variantCode: string; finalPriceKrw: number; optionLabel: string } => Boolean(row));

  const baseBreakdownRows = buildBaseBreakdownRows({
    publishedBasePriceKrw: basePublished?.publishedBasePriceKrw ?? null,
    targetPriceRawKrw: basePublished?.targetPriceRawKrw ?? null,
    snapshot: baseSnapshot,
  });
  const snapshotComputedAt = String(baseSnapshot?.tick_as_of ?? baseSnapshot?.computed_at ?? '').trim() || null;
  const baseBreakdown = basePublished || baseSnapshot || baseBreakdownRows.length > 0
    ? {
        target_price_raw_krw: basePublished?.targetPriceRawKrw ?? null,
        published_base_price_krw: basePublished?.publishedBasePriceKrw ?? null,
        publish_version: basePublished?.publishVersion ?? null,
        computed_at: snapshotComputedAt ?? basePublished?.computedAt ?? null,
        snapshot_available: Boolean(baseSnapshot),
        rows: baseBreakdownRows,
        detailed: buildDetailedBaseBreakdown({
          snapshot: baseSnapshot,
          publishedBasePriceKrw: basePublished?.publishedBasePriceKrw ?? null,
        }),
      }
    : null;

  const detail = buildGalleryDetailSummary({
    basePriceKrw: basePublished?.publishedBasePriceKrw ?? null,
    baseBreakdown,
    masterMaterialCode,
    explicitMappingCount: (explicitRes.data ?? []).length,
    optionEntries: optionRows,
    editorRows,
    variants: variantRows,
    unresolvedReasons: basePublished ? [] : ['published base price missing'],
  });

  return NextResponse.json({
    data: {
      card: {
        channel_id: channelId,
        master_item_id: masterItemId,
        external_product_no: externalProductNo,
        model_name: String(masterRes.data?.model_name ?? '').trim() || null,
        image_url: buildMasterImageUrl(sb, masterRes.data?.image_path ? String(masterRes.data.image_path) : null),
      },
      detail,
      explicit_mappings: explicitRes.data ?? [],
      central_registries: {
        materials: finalMaterials,
        color_buckets: colorBucketRes.data ?? [],
        addon_masters: addonRes.data ?? [],
        notice_codes: noticeRes.data ?? [],
        other_reason_codes: reasonRes.data ?? [],
      },
      shared_size_choices: sizeChoices,
      shared_size_choices_by_material: sizeChoicesByMaterial,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
