set search_path = public, pg_temp;

-- cms_0269: allow 'BASIS_COST' in cms_receipt_usage_allocation_method_chk
do $$
declare
  v_conname text := 'cms_receipt_usage_allocation_method_chk';
  v_def text;
  v_expr text;
  v_newdef text;
begin
  select pg_get_constraintdef(c.oid, true)
    into v_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'cms_receipt_usage'
    and c.conname = v_conname;

  if v_def is null then
    raise notice 'constraint % not found, skip', v_conname;
    return;
  end if;

  if v_def ilike '%BASIS_COST%' then
    raise notice 'constraint already allows BASIS_COST, skip';
    return;
  end if;

  -- Extract inside CHECK(...)
  v_expr := regexp_replace(v_def, '^CHECK\s*\((.*)\)\s*$', '\1', 1, 1, 'i');

  -- Try to inject into IN (...) list
  if v_def ~* '\sIN\s*\(' then
    v_newdef := regexp_replace(v_def, '\sIN\s*\(', ' IN (''BASIS_COST'', ', 1, 1, 'i');

  -- Try to inject into ANY (ARRAY[...]) list
  elsif v_def ~* 'ANY\s*\(\s*ARRAY\s*\[' then
    v_newdef := regexp_replace(v_def, 'ANY\s*\(\s*ARRAY\s*\[', 'ANY (ARRAY[''BASIS_COST''::text, ', 1, 1, 'i');

  else
    -- Fallback: OR the original expression
    v_newdef := 'CHECK ((''BASIS_COST''::text = allocation_method) OR (' || v_expr || '))';
  end if;

  execute format('alter table public.cms_receipt_usage drop constraint %I', v_conname);
  execute format('alter table public.cms_receipt_usage add constraint %I %s', v_conname, v_newdef);

  raise notice 'updated constraint % to allow BASIS_COST', v_conname;
end $$;
