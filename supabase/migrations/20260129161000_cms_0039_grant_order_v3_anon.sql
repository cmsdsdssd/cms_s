do $$
declare
  r record;
begin
  for r in
    select oid::regprocedure as signature
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'cms_fn_upsert_order_line_v3'
  loop
    execute format('grant execute on function %s to anon, authenticated, service_role', r.signature);
  end loop;
end $$;
