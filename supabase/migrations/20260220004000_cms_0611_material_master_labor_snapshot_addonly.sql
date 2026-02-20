set search_path = public, pg_temp;
alter table public.cms_master_absorb_labor_item_v1
  add column if not exists labor_class text,
  add column if not exists material_qty_per_unit numeric,
  add column if not exists material_cost_krw numeric;
update public.cms_master_absorb_labor_item_v1
set
  labor_class = coalesce(nullif(upper(trim(labor_class)), ''), 'GENERAL'),
  material_qty_per_unit = greatest(coalesce(material_qty_per_unit, 1), 0),
  material_cost_krw = greatest(coalesce(material_cost_krw, 0), 0)
where
  labor_class is null
  or material_qty_per_unit is null
  or material_cost_krw is null;
update public.cms_master_absorb_labor_item_v1
set labor_class = 'MATERIAL'
where upper(coalesce(bucket::text, '')) = 'ETC'
  and upper(coalesce(labor_class, 'GENERAL')) = 'GENERAL'
  and (
    coalesce(reason, '') like '기타-소재%'
    or coalesce(reason, '') like '소재%'
  );
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

  v_new := replace(
    v_new,
    '      coalesce(a.amount_krw, 0) as amount_krw,' || E'\n' ||
    '      coalesce(a.is_per_piece, true) as is_per_piece',
    '      coalesce(a.amount_krw, 0) as amount_krw,' || E'\n' ||
    '      coalesce(a.is_per_piece, true) as is_per_piece,' || E'\n' ||
    '      coalesce(nullif(upper(trim(a.labor_class)), ''''), ''GENERAL'') as labor_class,' || E'\n' ||
    '      greatest(coalesce(a.material_qty_per_unit, 1), 0) as material_qty_per_unit,' || E'\n' ||
    '      greatest(coalesce(a.material_cost_krw, 0), 0) as material_cost_krw'
  );

  v_new := replace(
    v_new,
    '    v_absorb_amount := coalesce(v_absorb_row.amount_krw, 0)' || E'\n' ||
    '      * case when v_absorb_row.is_per_piece then v_qty else 1 end;',
    '    v_absorb_amount := coalesce(v_absorb_row.amount_krw, 0)' || E'\n' ||
    '      * case when v_absorb_row.is_per_piece then v_qty else 1 end' || E'\n' ||
    '      * case when coalesce(v_absorb_row.labor_class, ''GENERAL'') = ''MATERIAL'' then greatest(coalesce(v_absorb_row.material_qty_per_unit, 1), 0) else 1 end;'
  );

  v_new := replace(
    v_new,
    '    else' || E'\n' ||
    '      v_absorb_etc_total := v_absorb_etc_total + v_absorb_amount;' || E'\n' ||
    E'\n' ||
    '      if position(''장식'' in v_absorb_reason) > 0 or position(''DECOR'' in upper(v_absorb_reason)) > 0 then',
    '    else' || E'\n' ||
    '      v_absorb_etc_total := v_absorb_etc_total + v_absorb_amount;' || E'\n' ||
    E'\n' ||
    '      if coalesce(v_absorb_row.labor_class, ''GENERAL'') = ''MATERIAL'' then' || E'\n' ||
    '        v_absorb_other_total := v_absorb_other_total + v_absorb_amount;' || E'\n' ||
    '        v_extra_items := v_extra_items || jsonb_build_array(' || E'\n' ||
    '          jsonb_build_object(' || E'\n' ||
    '            ''type'', ''MATERIAL_MASTER:'' || coalesce(v_absorb_row.absorb_item_id::text, md5(v_absorb_reason || v_absorb_amount::text)),' || E'\n' ||
    '            ''label'', v_absorb_reason || ''-마스터'',' || E'\n' ||
    '            ''amount'', v_absorb_amount,' || E'\n' ||
    '            ''meta'', jsonb_build_object(' || E'\n' ||
    '              ''engine'', ''policy_v2_absorb_bucket'',' || E'\n' ||
    '              ''bucket'', v_absorb_bucket,' || E'\n' ||
    '              ''class'', ''MATERIAL_MASTER'',' || E'\n' ||
    '              ''absorb_item_id'', v_absorb_row.absorb_item_id,' || E'\n' ||
    '              ''cost_krw'', greatest(coalesce(v_absorb_row.material_cost_krw, 0), 0)' || E'\n' ||
    '                * case when v_absorb_row.is_per_piece then v_qty else 1 end' || E'\n' ||
    '                * greatest(coalesce(v_absorb_row.material_qty_per_unit, 1), 0),' || E'\n' ||
    '              ''sell_krw'', v_absorb_amount,' || E'\n' ||
    '              ''margin_krw'', greatest(' || E'\n' ||
    '                v_absorb_amount - (' || E'\n' ||
    '                  greatest(coalesce(v_absorb_row.material_cost_krw, 0), 0)' || E'\n' ||
    '                  * case when v_absorb_row.is_per_piece then v_qty else 1 end' || E'\n' ||
    '                  * greatest(coalesce(v_absorb_row.material_qty_per_unit, 1), 0)' || E'\n' ||
    '                ),' || E'\n' ||
    '                0' || E'\n' ||
    '              ),' || E'\n' ||
    '              ''is_per_piece'', v_absorb_row.is_per_piece,' || E'\n' ||
    '              ''qty_applied'', (case when v_absorb_row.is_per_piece then v_qty else 1 end) * greatest(coalesce(v_absorb_row.material_qty_per_unit, 1), 0),' || E'\n' ||
    '              ''unit_qty_per_piece'', greatest(coalesce(v_absorb_row.material_qty_per_unit, 1), 0),' || E'\n' ||
    '              ''source'', ''master_material_labor''' || E'\n' ||
    '            )' || E'\n' ||
    '          )' || E'\n' ||
    '        );' || E'\n' ||
    E'\n' ||
    '      elsif position(''장식'' in v_absorb_reason) > 0 or position(''DECOR'' in upper(v_absorb_reason)) > 0 then'
  );

  if v_new = v_def then
    raise exception '0611 patch not applied: target text not found in function body';
  end if;

  execute v_new;
end;
$$;
with patched as (
  select
    sl.shipment_line_id,
    coalesce(
      jsonb_agg(
        case
          when upper(coalesce(item->>'type', '')) like 'OTHER_ABSORB:%'
            and upper(coalesce(item #>> '{meta,bucket}', '')) = 'ETC'
            and upper(coalesce(a.labor_class, 'GENERAL')) = 'MATERIAL'
          then
            item || jsonb_build_object(
              'type', 'MATERIAL_MASTER:' || coalesce(a.absorb_item_id::text, ''),
              'label', coalesce(nullif(a.reason, ''), '기타-소재') || '-마스터',
              'meta', (
                case when jsonb_typeof(item->'meta') = 'object' then item->'meta' else '{}'::jsonb end
              ) || jsonb_build_object(
                'class', 'MATERIAL_MASTER',
                'source', 'master_material_labor',
                'unit_qty_per_piece', greatest(coalesce(a.material_qty_per_unit, 1), 0),
                'cost_krw', greatest(coalesce(a.material_cost_krw, 0), 0)
                  * greatest(
                    coalesce(
                      case
                        when coalesce(item #>> '{meta,qty_applied}', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                          then (item #>> '{meta,qty_applied}')::numeric
                        else 1
                      end,
                      1
                    ),
                    0
                  ),
                'sell_krw', greatest(
                  coalesce(
                    case
                      when coalesce(item->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                        then (item->>'amount')::numeric
                      else 0
                    end,
                    0
                  ),
                  0
                ),
                'margin_krw', greatest(
                  greatest(
                    coalesce(
                      case
                        when coalesce(item->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                          then (item->>'amount')::numeric
                        else 0
                      end,
                      0
                    ),
                    0
                  ) - (
                    greatest(coalesce(a.material_cost_krw, 0), 0)
                    * greatest(
                      coalesce(
                        case
                          when coalesce(item #>> '{meta,qty_applied}', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                            then (item #>> '{meta,qty_applied}')::numeric
                          else 1
                        end,
                        1
                      ),
                      0
                    )
                  ),
                  0
                )
              )
            )
          else item
        end
      ) filter (where item is not null),
      '[]'::jsonb
    ) as items,
    bool_or(
      upper(coalesce(item->>'type', '')) like 'OTHER_ABSORB:%'
      and upper(coalesce(item #>> '{meta,bucket}', '')) = 'ETC'
      and upper(coalesce(a.labor_class, 'GENERAL')) = 'MATERIAL'
    ) as has_target
  from public.cms_shipment_line sl
  left join lateral jsonb_array_elements(coalesce(sl.extra_labor_items, '[]'::jsonb)) as item on true
  left join public.cms_master_absorb_labor_item_v1 a
    on a.absorb_item_id::text = nullif(item #>> '{meta,absorb_item_id}', '')
  group by sl.shipment_line_id
)
update public.cms_shipment_line sl
set
  extra_labor_items = patched.items,
  updated_at = now()
from patched
where sl.shipment_line_id = patched.shipment_line_id
  and coalesce(patched.has_target, false);
