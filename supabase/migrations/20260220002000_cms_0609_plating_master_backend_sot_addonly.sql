set search_path = public, pg_temp;
do $$
declare
  v_oid oid;
  v_def text;
  v_new text;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'cms_fn_receipt_line_match_confirm_v6_policy_v2'
  order by p.oid desc
  limit 1;

  if v_oid is null then
    raise exception 'function public.cms_fn_receipt_line_match_confirm_v6_policy_v2 not found';
  end if;

  select pg_get_functiondef(v_oid) into v_def;
  v_new := v_def;

  -- Backend SOT: emit plating line as PLATING_MASTER (not generic PLATING)
  v_new := replace(v_new, '''type'', ''PLATING''', '''type'', ''PLATING_MASTER''');
  v_new := replace(v_new, '''label'', ''도금''', '''label'', ''도금-마스터''');
  v_new := replace(
    v_new,
    '''engine'', ''policy_v2_plating'',',
    '''engine'', ''policy_v2_plating'', ''source'', ''master_plating'', ''item_type'', ''PLATING'', ''item_label'', ''도금-마스터'','
  );

  if v_new <> v_def then
    execute v_new;
  end if;
end;
$$;
-- Backfill existing backend-generated plating rows to PLATING_MASTER.
-- Scope is intentionally narrow: only rows with meta.engine=policy_v2_plating.
with patched as (
  select
    s.shipment_line_id,
    coalesce(
      jsonb_agg(
        case
          when upper(coalesce(item->>'type', '')) = 'PLATING'
               and upper(coalesce(item #>> '{meta,engine}', '')) = 'POLICY_V2_PLATING'
            then
              (item || jsonb_build_object('type', 'PLATING_MASTER', 'label', '도금-마스터'))
              || jsonb_build_object(
                'meta',
                (
                  case
                    when jsonb_typeof(item->'meta') = 'object' then item->'meta'
                    else '{}'::jsonb
                  end
                )
                || jsonb_build_object(
                  'source', 'master_plating',
                  'item_type', 'PLATING',
                  'item_label', '도금-마스터'
                )
              )
          else item
        end
      ) filter (where item is not null),
      '[]'::jsonb
    ) as items,
    bool_or(
      upper(coalesce(item->>'type', '')) = 'PLATING'
      and upper(coalesce(item #>> '{meta,engine}', '')) = 'POLICY_V2_PLATING'
    ) as has_target
  from public.cms_shipment_line s
  left join lateral jsonb_array_elements(coalesce(s.extra_labor_items, '[]'::jsonb)) as item on true
  group by s.shipment_line_id
)
update public.cms_shipment_line sl
set
  extra_labor_items = patched.items,
  updated_at = now()
from patched
where sl.shipment_line_id = patched.shipment_line_id
  and coalesce(patched.has_target, false);
