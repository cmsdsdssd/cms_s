-- 20260128132500_cms_0201a_market_tick_roles.sql
-- MARKET SYMBOL ROLE mapping (GOLD/SILVER roles -> actual enum label)
-- Avoid hardcoding enum label 'GOLD'/'SILVER' in views.
-- ADD-ONLY. public.cms_* only.

set search_path = public;

create table if not exists public.cms_market_symbol_role (
  role_code text primary key, -- e.g. 'GOLD', 'SILVER'
  symbol public.cms_e_market_symbol not null unique,
  is_active boolean not null default true,
  note text null,
  correlation_id uuid null,
  created_by_person_id uuid null references public.cms_person(person_id),
  updated_by_person_id uuid null references public.cms_person(person_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cms_market_symbol_role_active
on public.cms_market_symbol_role(is_active, role_code);

comment on table public.cms_market_symbol_role
is 'Maps business roles (GOLD/SILVER) to actual cms_e_market_symbol enum labels.';

-- Role view
drop view if exists public.cms_v_market_symbol_role_v1;
create view public.cms_v_market_symbol_role_v1 as
select
  role_code,
  symbol,
  is_active,
  note,
  correlation_id,
  created_by_person_id,
  updated_by_person_id,
  created_at,
  updated_at
from public.cms_market_symbol_role;

comment on view public.cms_v_market_symbol_role_v1
is 'Read view for market symbol role mapping.';

-- Set role mapping (RPC)
create or replace function public.cms_fn_set_market_symbol_role_v1(
  p_role_code text,
  p_symbol public.cms_e_market_symbol,
  p_actor_person_id uuid,
  p_correlation_id uuid,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := upper(btrim(coalesce(p_role_code,'')));
  v_before jsonb;
  v_after jsonb;
begin
  if v_role not in ('GOLD','SILVER') then
    raise exception 'cms_fn_set_market_symbol_role_v1: role_code must be GOLD or SILVER (got %)', v_role;
  end if;

  select jsonb_build_object(
    'role_code', r.role_code,
    'symbol', r.symbol::text,
    'is_active', r.is_active,
    'note', r.note
  )
  into v_before
  from public.cms_market_symbol_role r
  where r.role_code = v_role
  for update;

  insert into public.cms_market_symbol_role(
    role_code, symbol, is_active, note, correlation_id,
    created_by_person_id, updated_by_person_id
  )
  values (
    v_role, p_symbol, true, p_note, p_correlation_id,
    p_actor_person_id, p_actor_person_id
  )
  on conflict (role_code) do update
    set symbol = excluded.symbol,
        is_active = true,
        note = excluded.note,
        correlation_id = excluded.correlation_id,
        updated_by_person_id = excluded.updated_by_person_id,
        updated_at = now();

  v_after := jsonb_build_object(
    'role_code', v_role,
    'symbol', p_symbol::text,
    'is_active', true,
    'note', p_note,
    'correlation_id', p_correlation_id
  );

  insert into public.cms_decision_log(
    entity_type, entity_id, decision_kind, "before", "after",
    actor_person_id, occurred_at, note
  ) values (
    'MARKET_SYMBOL_ROLE', gen_random_uuid(), 'SET_ROLE_MAPPING',
    coalesce(v_before, '{}'::jsonb), v_after,
    p_actor_person_id, now(), p_note
  );
end;
$$;

comment on function public.cms_fn_set_market_symbol_role_v1(text, public.cms_e_market_symbol, uuid, uuid, text)
is 'Set mapping: role_code (GOLD/SILVER) -> cms_e_market_symbol. Writes cms_decision_log.';

-- Upsert tick (RPC)
create or replace function public.cms_fn_upsert_market_tick_v1(
  p_symbol public.cms_e_market_symbol,
  p_price_krw_per_g numeric,
  p_observed_at timestamptz,
  p_source text,
  p_meta jsonb,
  p_actor_person_id uuid,
  p_correlation_id uuid,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_src text := coalesce(p_source, 'MANUAL');
begin
  if p_price_krw_per_g is null or p_price_krw_per_g <= 0 then
    raise exception 'price must be > 0';
  end if;

  insert into public.cms_market_tick(
    symbol, price, observed_at, source, meta, correlation_id
  )
  values (
    p_symbol, p_price_krw_per_g, p_observed_at, v_src, coalesce(p_meta, '{}'::jsonb), p_correlation_id
  )
  on conflict (symbol, observed_at, source) where is_void = false
  do update set
    price = excluded.price,
    meta = excluded.meta,
    correlation_id = excluded.correlation_id,
    updated_at = now()
  returning tick_id into v_id;

  return v_id;
end;
$$;

comment on function public.cms_fn_upsert_market_tick_v1(public.cms_e_market_symbol, numeric, timestamptz, text, jsonb, uuid, uuid, text)
is 'Upsert market tick. De-duplicates by (symbol, observed_at, source) for active ticks.';

-- Get symbol by role (RPC)
create or replace function public.cms_fn_get_market_symbol_by_role_v1(
  p_role_code text
) returns public.cms_e_market_symbol
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := upper(btrim(coalesce(p_role_code,'')));
  v_symbol public.cms_e_market_symbol;
begin
  select r.symbol into v_symbol
  from public.cms_market_symbol_role r
  where r.role_code = v_role
    and r.is_active = true;

  if v_symbol is null then
    raise exception 'Market symbol role mapping is missing for role %. Set via cms_fn_set_market_symbol_role_v1().', v_role;
  end if;

  return v_symbol;
end;
$$;

comment on function public.cms_fn_get_market_symbol_by_role_v1(text)
is 'Resolve role_code (GOLD/SILVER) to actual cms_e_market_symbol enum label.';

-- Convenience: upsert tick by role (RPC)
create or replace function public.cms_fn_upsert_market_tick_by_role_v1(
  p_role_code text,
  p_price_krw_per_g numeric,
  p_observed_at timestamptz,
  p_source text,
  p_meta jsonb,
  p_actor_person_id uuid,
  p_correlation_id uuid,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_symbol public.cms_e_market_symbol;
begin
  v_symbol := public.cms_fn_get_market_symbol_by_role_v1(p_role_code);
  return public.cms_fn_upsert_market_tick_v1(
    v_symbol,
    p_price_krw_per_g,
    p_observed_at,
    p_source,
    p_meta,
    p_actor_person_id,
    p_correlation_id,
    p_note
  );
end;
$$;

comment on function public.cms_fn_upsert_market_tick_by_role_v1(text, numeric, timestamptz, text, jsonb, uuid, uuid, text)
is 'Upsert tick using role_code (GOLD/SILVER) instead of enum label. price is KRW per g.';

-- Convenience: latest tick by role (RPC)
create or replace function public.cms_fn_latest_tick_by_role_v1(
  p_role_code text
) returns table(
  tick_id uuid,
  price numeric,
  observed_at timestamptz,
  symbol public.cms_e_market_symbol
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_symbol public.cms_e_market_symbol;
begin
  v_symbol := public.cms_fn_get_market_symbol_by_role_v1(p_role_code);
  return query
  select t.tick_id, t.price, t.observed_at, t.symbol
  from public.cms_fn_latest_tick(v_symbol) t;
end;
$$;

comment on function public.cms_fn_latest_tick_by_role_v1(text)
is 'Latest tick by role_code (GOLD/SILVER).';

-- Auto-init mapping
do $$
begin
  if not exists (select 1 from public.cms_market_symbol_role where role_code='GOLD') then
    if exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='GOLD_KRW_PER_G'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('GOLD', 'GOLD_KRW_PER_G'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='GOLD'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('GOLD', 'GOLD'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='XAU'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('GOLD', 'XAU'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='AU'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('GOLD', 'AU'::public.cms_e_market_symbol, 'auto-init');
    end if;
  end if;

  if not exists (select 1 from public.cms_market_symbol_role where role_code='SILVER') then
    if exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='SILVER_KRW_PER_G'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('SILVER', 'SILVER_KRW_PER_G'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='SILVER'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('SILVER', 'SILVER'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='XAG'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('SILVER', 'XAG'::public.cms_e_market_symbol, 'auto-init');
    elsif exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname='public' and t.typname='cms_e_market_symbol' and e.enumlabel='AG'
    ) then
      insert into public.cms_market_symbol_role(role_code, symbol, note) values ('SILVER', 'AG'::public.cms_e_market_symbol, 'auto-init');
    end if;
  end if;
end $$;
