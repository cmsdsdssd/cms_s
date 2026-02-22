-- cms_0734: lock remaining AR legacy/service-role bypass and harden direct AR table DML

begin;

alter table if exists public.cms_ar_legacy_function_registry
  add column if not exists block_service_role_in_hard boolean not null default true;

update public.cms_ar_legacy_function_registry
set
  block_in_warn = true,
  block_in_hard = true,
  block_service_role_in_hard = true,
  updated_at = now()
where function_name in (
  'create_ar_from_shipment',
  'cms_fn_ar_create_from_shipment_confirm_v1',
  'cms_fn_ar_apply_payment_fifo_v2',
  'cms_fn_record_payment_v2'
);

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
  v_public_revoked int := 0;
  v_anon_revoked int := 0;
  v_auth_revoked int := 0;
  v_auth_granted int := 0;
  v_service_revoked int := 0;
  v_service_granted int := 0;
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
    select
      function_name,
      block_in_warn,
      block_in_hard,
      coalesce(block_service_role_in_hard, true) as block_service_role_in_hard
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
        execute format('revoke execute on function public.%I(%s) from public', r.function_name, sig.args);
        execute format('revoke execute on function public.%I(%s) from anon', r.function_name, sig.args);
        v_public_revoked := v_public_revoked + 1;
        v_anon_revoked := v_anon_revoked + 1;
      end if;

      if v_mode = 'hard' and r.block_in_hard then
        execute format('revoke execute on function public.%I(%s) from authenticated', r.function_name, sig.args);
        v_auth_revoked := v_auth_revoked + 1;
      elsif v_mode in ('off','warn') then
        execute format('grant execute on function public.%I(%s) to authenticated', r.function_name, sig.args);
        v_auth_granted := v_auth_granted + 1;
      end if;

      if v_mode = 'hard' and r.block_service_role_in_hard then
        execute format('revoke execute on function public.%I(%s) from service_role', r.function_name, sig.args);
        v_service_revoked := v_service_revoked + 1;
      elsif v_mode in ('off','warn') then
        execute format('grant execute on function public.%I(%s) to service_role', r.function_name, sig.args);
        v_service_granted := v_service_granted + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'public_revoked_count', v_public_revoked,
    'anon_revoked_count', v_anon_revoked,
    'authenticated_revoked_count', v_auth_revoked,
    'authenticated_granted_count', v_auth_granted,
    'service_role_revoked_count', v_service_revoked,
    'service_role_granted_count', v_service_granted
  );
end $$;

grant execute on function public.cms_fn_ar_apply_legacy_guard_phase(text, text) to service_role;

create or replace view public.cms_v_ar_legacy_guard_effective_execute_v1 as
with fns as (
  select
    r.function_name,
    pg_get_function_identity_arguments(p.oid) as args,
    format('public.%I(%s)', r.function_name, pg_get_function_identity_arguments(p.oid)) as signature
  from public.cms_ar_legacy_function_registry r
  join pg_proc p on p.proname = r.function_name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where r.enabled
)
select
  function_name,
  args,
  has_function_privilege('public', signature, 'EXECUTE') as can_public_execute,
  has_function_privilege('anon', signature, 'EXECUTE') as can_anon_execute,
  has_function_privilege('authenticated', signature, 'EXECUTE') as can_authenticated_execute,
  has_function_privilege('service_role', signature, 'EXECUTE') as can_service_role_execute
from fns
order by function_name, args;

grant select on public.cms_v_ar_legacy_guard_effective_execute_v1 to authenticated, service_role;

-- Block direct DML on AR SoT tables for app roles.
-- AR mutations must go through vetted SECURITY DEFINER RPCs.
revoke insert, update, delete, truncate on table public.cms_ar_ledger from anon, authenticated, service_role;
revoke insert, update, delete, truncate on table public.cms_ar_invoice from anon, authenticated, service_role;
revoke insert, update, delete, truncate on table public.cms_ar_payment from anon, authenticated, service_role;
revoke insert, update, delete, truncate on table public.cms_ar_payment_alloc from anon, authenticated, service_role;
revoke insert, update, delete, truncate on table public.cms_ar_service_writeoff_action from anon, authenticated, service_role;
revoke insert, update, delete, truncate on table public.cms_ar_service_writeoff_action_alloc from anon, authenticated, service_role;

select public.cms_fn_ar_apply_legacy_guard_phase('hard', 'cms_0734_migration');

commit;
