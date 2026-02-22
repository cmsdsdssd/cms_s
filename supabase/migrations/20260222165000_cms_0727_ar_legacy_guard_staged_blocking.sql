-- cms_0727: staged blocking for legacy AR mutation paths
-- Goal:
-- - Introduce DB-level phased guard controls (WARN/HARD)
-- - Apply safe default now: block anon on legacy AR functions
-- - Keep authenticated/service_role available to avoid immediate app breakage

begin;

create table if not exists public.cms_ar_legacy_guard_settings (
  id boolean primary key default true,
  guard_mode text not null default 'warn' check (guard_mode in ('off','warn','hard')),
  block_anon boolean not null default true,
  block_authenticated boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'cms_0727_migration'
);

insert into public.cms_ar_legacy_guard_settings(id)
values (true)
on conflict (id) do nothing;

create table if not exists public.cms_ar_legacy_function_registry (
  function_name text primary key,
  deprecated_tier smallint not null default 1,
  block_in_warn boolean not null default false,
  block_in_hard boolean not null default true,
  reason text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.cms_ar_legacy_function_registry(
  function_name,
  deprecated_tier,
  block_in_warn,
  block_in_hard,
  reason,
  enabled
)
values
  ('create_ar_from_shipment', 1, true, true, 'legacy trigger helper; must not be callable in app paths', true),
  ('cms_fn_ar_create_from_shipment_confirm_v1', 2, false, true, 'legacy resync path, keep during WARN for compatibility', true),
  ('cms_fn_ar_apply_payment_fifo_v2', 2, false, true, 'legacy payment path, prefer v3 advanced', true)
on conflict (function_name) do update
set
  deprecated_tier = excluded.deprecated_tier,
  block_in_warn = excluded.block_in_warn,
  block_in_hard = excluded.block_in_hard,
  reason = excluded.reason,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function public.cms_fn_ar_apply_legacy_guard_phase(
  p_mode text,
  p_updated_by text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  sig record;
  v_mode text := lower(coalesce(p_mode, ''));
  v_anon_revoked int := 0;
  v_auth_revoked int := 0;
  v_auth_granted int := 0;
begin
  if v_mode not in ('off','warn','hard') then
    raise exception 'invalid mode: %, allowed: off|warn|hard', p_mode;
  end if;

  update public.cms_ar_legacy_guard_settings
  set
    guard_mode = v_mode,
    block_anon = (v_mode in ('warn','hard')),
    block_authenticated = (v_mode = 'hard'),
    updated_at = now(),
    updated_by = coalesce(nullif(trim(p_updated_by), ''), 'manual');

  for r in
    select function_name, block_in_warn, block_in_hard
    from public.cms_ar_legacy_function_registry
    where enabled
  loop
    for sig in
      select pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = r.function_name
    loop
      if v_mode in ('warn','hard') then
        execute format('revoke execute on function public.%I(%s) from anon', r.function_name, sig.args);
        v_anon_revoked := v_anon_revoked + 1;
      end if;

      if v_mode = 'hard' and r.block_in_hard then
        execute format('revoke execute on function public.%I(%s) from authenticated', r.function_name, sig.args);
        v_auth_revoked := v_auth_revoked + 1;
      elsif v_mode in ('off','warn') then
        execute format('grant execute on function public.%I(%s) to authenticated', r.function_name, sig.args);
        v_auth_granted := v_auth_granted + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'anon_revoked_count', v_anon_revoked,
    'authenticated_revoked_count', v_auth_revoked,
    'authenticated_granted_count', v_auth_granted
  );
end $$;

grant execute on function public.cms_fn_ar_apply_legacy_guard_phase(text, text) to service_role;

create or replace view public.cms_v_ar_legacy_guard_status as
select
  s.guard_mode,
  s.block_anon,
  s.block_authenticated,
  s.updated_at,
  s.updated_by,
  r.function_name,
  r.deprecated_tier,
  r.block_in_warn,
  r.block_in_hard,
  r.reason,
  r.enabled
from public.cms_ar_legacy_guard_settings s
cross join public.cms_ar_legacy_function_registry r
order by r.deprecated_tier, r.function_name;

grant select on public.cms_v_ar_legacy_guard_status to authenticated;

-- Apply safe default phase now.
-- WARN = block anon for legacy functions, keep authenticated path alive.
select public.cms_fn_ar_apply_legacy_guard_phase('warn', 'cms_0727_migration');

commit;
