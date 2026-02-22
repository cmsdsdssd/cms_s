-- cms_0728: ensure staged legacy guard revokes PUBLIC execute as well

begin;

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
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'public_revoked_count', v_public_revoked,
    'anon_revoked_count', v_anon_revoked,
    'authenticated_revoked_count', v_auth_revoked,
    'authenticated_granted_count', v_auth_granted
  );
end $$;

grant execute on function public.cms_fn_ar_apply_legacy_guard_phase(text, text) to service_role;

select public.cms_fn_ar_apply_legacy_guard_phase('warn', 'cms_0728_migration');

commit;
