import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveMappingInvariantInputRow = {
  channel_product_id?: string | null;
  channel_id: string;
  master_item_id: string;
  external_product_no: string | null;
  external_variant_code: string | null;
  is_active?: boolean | null;
};

type ActiveMappingInvariantArgs = {
  sb: SupabaseClient;
  rows: ActiveMappingInvariantInputRow[];
  excludeChannelProductIds?: string[];
};

const trim = (value: unknown) => String(value ?? "").trim();

const activeMappingLogicalKey = (
  row: Pick<ActiveMappingInvariantInputRow, "channel_id" | "master_item_id" | "external_product_no" | "external_variant_code">,
) => `${trim(row.channel_id)}::${trim(row.master_item_id)}::${trim(row.external_product_no)}::${trim(row.external_variant_code)}`;

export function attachExistingChannelProductIds<T extends ActiveMappingInvariantInputRow>(
  rows: T[],
  existingRows: ActiveMappingInvariantInputRow[],
): Array<T & { channel_product_id?: string | null }> {
  const existingIdByLogicalKey = new Map<string, string>();
  for (const row of existingRows) {
    const channelProductId = trim(row.channel_product_id);
    if (!channelProductId) continue;
    const logicalKey = activeMappingLogicalKey(row);
    if (!existingIdByLogicalKey.has(logicalKey)) {
      existingIdByLogicalKey.set(logicalKey, channelProductId);
    }
  }

  const nextRows: Array<T & { channel_product_id?: string | null }> = [];
  for (const row of rows) {
    const preservedChannelProductId = trim(row.channel_product_id);
    if (preservedChannelProductId) {
      nextRows.push(row);
      continue;
    }
    const matchedChannelProductId = existingIdByLogicalKey.get(activeMappingLogicalKey(row));
    if (!matchedChannelProductId) {
      nextRows.push(row);
      continue;
    }
    nextRows.push({
      ...row,
      channel_product_id: matchedChannelProductId,
    });
  }

  return nextRows;
}

export async function validateActiveMappingInvariants(args: ActiveMappingInvariantArgs) {
  const candidateRows = args.rows
    .map((row) => ({
      channel_product_id: trim(row.channel_product_id),
      channel_id: trim(row.channel_id),
      master_item_id: trim(row.master_item_id),
      external_product_no: trim(row.external_product_no),
      external_variant_code: trim(row.external_variant_code),
      is_active: row.is_active !== false,
    }))
    .filter((row) => row.is_active && row.channel_id && row.master_item_id);

  if (candidateRows.length === 0) {
    return { ok: true as const };
  }

  const pairKeys = Array.from(new Set(candidateRows.map((row) => `${row.channel_id}::${row.master_item_id}`)));
  const channelIds = Array.from(new Set(candidateRows.map((row) => row.channel_id)));
  const masterItemIds = Array.from(new Set(candidateRows.map((row) => row.master_item_id)));
  const excludeIds = new Set((args.excludeChannelProductIds ?? []).map(trim).filter(Boolean));

  const existingRes = await args.sb
    .from("sales_channel_product")
    .select("channel_product_id, channel_id, master_item_id, external_product_no, external_variant_code, is_active")
    .in("channel_id", channelIds)
    .in("master_item_id", masterItemIds)
    .eq("is_active", true);
  if (existingRes.error) {
    throw new Error(existingRes.error.message ?? "active mapping invariant lookup failed");
  }

  const merged = new Map<string, ActiveMappingInvariantInputRow>();
  for (const row of (existingRes.data ?? []) as ActiveMappingInvariantInputRow[]) {
    const channelProductId = trim(row.channel_product_id);
    if (channelProductId && excludeIds.has(channelProductId)) continue;
    const key = channelProductId || `${trim(row.channel_id)}::${trim(row.master_item_id)}::${trim(row.external_product_no)}::${trim(row.external_variant_code)}`;
    merged.set(key, row);
  }
  for (const row of candidateRows) {
    const key = row.channel_product_id || `${row.channel_id}::${row.master_item_id}::${row.external_product_no}::${row.external_variant_code}`;
    merged.set(key, row);
  }

  const activeRows = Array.from(merged.values())
    .map((row) => ({
      channel_id: trim(row.channel_id),
      master_item_id: trim(row.master_item_id),
      external_product_no: trim(row.external_product_no),
      external_variant_code: trim(row.external_variant_code),
      is_active: row.is_active !== false,
    }))
    .filter((row) => row.is_active && row.channel_id && row.master_item_id);

  for (const pairKey of pairKeys) {
    const [channelId, masterItemId] = pairKey.split("::");
    const scoped = activeRows.filter((row) => row.channel_id === channelId && row.master_item_id === masterItemId);
    const baseRows = scoped.filter((row) => row.external_variant_code.length === 0);
    if (baseRows.length > 1) {
      return {
        ok: false as const,
        code: "ACTIVE_BASE_MAPPING_CONFLICT",
        message: "동일 master_item_id에는 활성 base 매핑이 하나만 허용됩니다",
        detail: { channel_id: channelId, master_item_id: masterItemId, external_product_nos: baseRows.map((row) => row.external_product_no) },
      };
    }
    const activeProductNos = Array.from(new Set(scoped.map((row) => row.external_product_no).filter(Boolean)));
    if (activeProductNos.length > 1) {
      return {
        ok: false as const,
        code: "ACTIVE_PRODUCT_NO_CONFLICT",
        message: "동일 master_item_id에는 활성 external_product_no가 하나만 허용됩니다",
        detail: { channel_id: channelId, master_item_id: masterItemId, external_product_nos: activeProductNos },
      };
    }
    const variantKeys = new Set<string>();
    for (const row of scoped) {
      if (!row.external_variant_code) continue;
      const variantKey = row.external_variant_code;
      if (variantKeys.has(variantKey)) {
        return {
          ok: false as const,
          code: "ACTIVE_VARIANT_MAPPING_CONFLICT",
          message: "동일 master_item_id에는 활성 variant 매핑이 중복될 수 없습니다",
          detail: { channel_id: channelId, master_item_id: masterItemId, external_variant_code: variantKey },
        };
      }
      variantKeys.add(variantKey);
    }
  }

  return { ok: true as const };
}
