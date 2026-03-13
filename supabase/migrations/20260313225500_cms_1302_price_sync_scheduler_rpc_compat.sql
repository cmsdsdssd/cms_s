set search_path = public, pg_temp;

create or replace function public.claim_price_sync_scheduler_lease_v1(
  p_channel_id uuid,
  p_lease_seconds integer,
  p_owner_token text
)
returns jsonb
language sql
as $$
  select public.claim_price_sync_scheduler_lease_v1(
    p_channel_id := p_channel_id,
    p_owner_token := p_owner_token,
    p_lease_seconds := p_lease_seconds
  );
$$;

create or replace function public.release_price_sync_scheduler_lease_v1(
  p_channel_id uuid,
  p_error text,
  p_owner_token text,
  p_status text
)
returns jsonb
language sql
as $$
  select public.release_price_sync_scheduler_lease_v1(
    p_channel_id := p_channel_id,
    p_owner_token := p_owner_token,
    p_status := p_status,
    p_error := p_error
  );
$$;
