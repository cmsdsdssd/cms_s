set search_path = public, pg_temp;

alter table public.price_sync_intent_v2
  add column if not exists decision_context_json jsonb not null default '{}'::jsonb;
