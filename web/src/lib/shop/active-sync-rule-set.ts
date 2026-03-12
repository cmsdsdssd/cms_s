import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveSyncRuleSet = {
  rule_set_id: string;
  channel_id: string;
  name: string;
};

export async function getActiveSyncRuleSet(
  sb: SupabaseClient,
  channelId: string,
): Promise<ActiveSyncRuleSet | null> {
  const normalizedChannelId = String(channelId ?? "").trim();
  if (!normalizedChannelId) return null;

  const { data, error } = await sb
    .from("sync_rule_set")
    .select("rule_set_id, channel_id, name")
    .eq("channel_id", normalizedChannelId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message ?? "active sync rule set lookup failed");

  const rows = (data ?? []) as Array<{ rule_set_id?: string | null; channel_id?: string | null; name?: string | null }>;
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error("multiple active sync rule sets found for channel");
  }

  const row = rows[0];
  const ruleSetId = String(row.rule_set_id ?? "").trim();
  const resolvedChannelId = String(row.channel_id ?? "").trim();
  const name = String(row.name ?? "").trim();
  if (!ruleSetId || !resolvedChannelId) return null;
  return { rule_set_id: ruleSetId, channel_id: resolvedChannelId, name };
}

export type SyncRuleSetAssignableRow = {
  channel_id: string;
  option_price_mode: string | null;
  sync_rule_set_id: string | null;
  is_active?: boolean | null;
};

export async function ensureActiveSyncRuleSetIdsForRows<T extends SyncRuleSetAssignableRow>(
  rows: readonly T[],
  ensureForChannel: (channelId: string) => Promise<ActiveSyncRuleSet>,
): Promise<T[]> {
  const channelIdsNeedingRuleSet = Array.from(new Set(
    rows
      .filter((row) => (
        row.is_active !== false
        && String(row.option_price_mode ?? "SYNC").trim().toUpperCase() === "SYNC"
        && !String(row.sync_rule_set_id ?? "").trim()
      ))
      .map((row) => String(row.channel_id ?? "").trim())
      .filter(Boolean),
  ));

  if (channelIdsNeedingRuleSet.length === 0) return [...rows];

  const activeRuleSetIdByChannel = new Map<string, string>();
  await Promise.all(channelIdsNeedingRuleSet.map(async (channelId) => {
    const activeRuleSet = await ensureForChannel(channelId);
    activeRuleSetIdByChannel.set(channelId, activeRuleSet.rule_set_id);
  }));

  return rows.map((row) => {
    if (row.is_active === false) return row;
    if (String(row.option_price_mode ?? "SYNC").trim().toUpperCase() !== "SYNC") return row;
    if (String(row.sync_rule_set_id ?? "").trim()) return row;

    return {
      ...row,
      sync_rule_set_id: activeRuleSetIdByChannel.get(String(row.channel_id ?? "").trim()) ?? null,
    } as T;
  });
}

export async function ensureActiveSyncRuleSet(
  sb: SupabaseClient,
  channelId: string,
): Promise<ActiveSyncRuleSet> {
  const existing = await getActiveSyncRuleSet(sb, channelId);
  if (existing) return existing;

  const normalizedChannelId = String(channelId ?? "").trim();
  if (!normalizedChannelId) throw new Error("channel_id is required");

  const { data, error } = await sb
    .from("sync_rule_set")
    .insert({
      channel_id: normalizedChannelId,
      name: "기본 룰세트",
      description: "자동 생성된 채널 기본 ruleset",
      is_active: true,
    })
    .select("rule_set_id, channel_id, name")
    .single();

  if (error) throw new Error(error.message ?? "default sync rule set bootstrap failed");

  return {
    rule_set_id: String(data.rule_set_id ?? "").trim(),
    channel_id: String(data.channel_id ?? "").trim(),
    name: String(data.name ?? "").trim(),
  };
}
