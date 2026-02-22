-- cms_0735: fix effective execute view using OID-based privilege checks

begin;

create or replace view public.cms_v_ar_legacy_guard_effective_execute_v1 as
select
  r.function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('public', p.oid, 'EXECUTE') as can_public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as can_anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as can_authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as can_service_role_execute
from public.cms_ar_legacy_function_registry r
join pg_proc p on p.proname = r.function_name
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where r.enabled
order by r.function_name, args;

grant select on public.cms_v_ar_legacy_guard_effective_execute_v1 to authenticated, service_role;

commit;
