create unique index if not exists uq_sync_rule_set_active_per_channel
  on public.sync_rule_set(channel_id)
  where is_active = true;
