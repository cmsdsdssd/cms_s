export const buildMissingActiveMappingSummary = ({ snapshotRows, activeByChannelProduct }) => {
  const rows = Array.isArray(snapshotRows) ? snapshotRows : [];
  const activeMap = activeByChannelProduct instanceof Map ? activeByChannelProduct : new Map();

  const snapshotRowsWithChannelProduct = rows.filter((row) => String(row?.channel_product_id ?? '').trim().length > 0);
  const missingMappingRows = snapshotRowsWithChannelProduct.filter((row) => {
    const channelProductId = String(row?.channel_product_id ?? '').trim();
    if (!channelProductId) return false;
    const mapping = activeMap.get(channelProductId);
    return !mapping || !String(mapping.external_product_no ?? '').trim();
  });

  const missingMappingProductIds = Array.from(
    new Set(missingMappingRows.map((row) => String(row?.channel_product_id ?? '').trim()).filter(Boolean)),
  );
  const missingMappingMasterItemIds = Array.from(
    new Set(missingMappingRows.map((row) => String(row?.master_item_id ?? '').trim()).filter(Boolean)),
  );
  const missingMappingSamples = missingMappingRows
    .map((row) => ({
      channel_product_id: String(row?.channel_product_id ?? '').trim(),
      master_item_id: String(row?.master_item_id ?? '').trim() || null,
      compute_request_id: String(row?.compute_request_id ?? '').trim() || null,
    }))
    .filter((row) => row.channel_product_id)
    .slice(0, 20);

  return {
    missingMappingRows,
    summary: {
      snapshot_rows_with_channel_product_count: snapshotRowsWithChannelProduct.length,
      missing_active_mapping_row_count: missingMappingRows.length,
      missing_active_mapping_product_count: missingMappingProductIds.length,
      missing_active_mapping_master_count: missingMappingMasterItemIds.length,
      missing_active_mapping_samples: missingMappingSamples,
    },
  };
};

export const resolveNoIntentsReason = ({ thresholdFilteredCount, optionThresholdFilteredCount, missingActiveMappingProductCount }) => {
  if (Number(optionThresholdFilteredCount) > 0) return 'NO_INTENTS_AFTER_OPTION_MIN_CHANGE_THRESHOLD';
  if (Number(thresholdFilteredCount) > 0) return 'NO_INTENTS_AFTER_MIN_CHANGE_THRESHOLD';
  if (Number(missingActiveMappingProductCount) > 0) return 'NO_ACTIVE_MAPPING_FOR_SNAPSHOT_ROWS';
  return 'NO_INTENTS';
};


export const buildThresholdProfileSummary = ({ channelThresholdProfile, effectiveThresholdProfile }) => ({
  channelThresholdProfile: typeof channelThresholdProfile === 'string' && channelThresholdProfile.trim() ? channelThresholdProfile.trim() : null,
  effectiveThresholdProfile: typeof effectiveThresholdProfile === 'string' && effectiveThresholdProfile.trim() ? effectiveThresholdProfile.trim() : null,
  isOverrideActive: Boolean(
    typeof channelThresholdProfile === 'string' && channelThresholdProfile.trim()
    && typeof effectiveThresholdProfile === 'string' && effectiveThresholdProfile.trim()
    && channelThresholdProfile.trim() !== effectiveThresholdProfile.trim(),
  ),
});


export const selectLatestMeaningfulSyncRun = (rows) => {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  for (const row of normalizedRows) {
    const reason = String(row?.error_message ?? '').trim().toUpperCase();
    if (reason.startsWith('CRON_TICK:')) continue;
    return row;
  }
  return normalizedRows[0] ?? null;
};


export const selectPreviewComputeRequestId = ({ latestMeaningfulRun, recentRunDetailQueries }) => {
  const fromRun = String(latestMeaningfulRun?.pinned_compute_request_id ?? '').trim();
  if (fromRun) return fromRun;
  for (const query of Array.isArray(recentRunDetailQueries) ? recentRunDetailQueries : []) {
    const computeRequestId = String(query?.data?.data?.run?.pinned_compute_request_id ?? '').trim();
    if (computeRequestId) return computeRequestId;
  }
  return '';
};
