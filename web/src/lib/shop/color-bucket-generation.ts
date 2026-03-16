export const buildGeneratedColorBucketSeeds = (args: { channelId: string; deltas: number[] }) => {
  const uniqueDeltas = Array.from(new Set((args.deltas ?? []).map((value) => Math.max(0, Math.round(Number(value ?? 0)))))).sort((a, b) => a - b);
  return uniqueDeltas.map((delta, index) => ({
    channel_id: args.channelId,
    bucket_code: `AUTO_${delta}`,
    bucket_label: `${delta.toLocaleString()}원 자동버킷`,
    base_cost_krw: delta,
    sell_delta_krw: delta,
    sort_order: index,
    is_active: true,
  }));
};
