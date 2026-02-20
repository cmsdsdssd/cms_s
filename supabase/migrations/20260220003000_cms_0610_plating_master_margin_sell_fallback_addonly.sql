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

  -- If plating rule margin is 0, fallback to master plating sell default.
  v_new := replace(
    v_new,
    'v_plating_sell := greatest(v_plating_cost + v_plating_margin, 0);',
    'v_plating_sell := greatest(v_plating_cost + v_plating_margin, coalesce(v_master.plating_price_sell_default, 0), 0);'
  );

  -- Keep meta/policy margin aligned with final sell-cost relationship.
  v_new := replace(
    v_new,
    '''margin_krw'', v_plating_margin,',
    '''margin_krw'', greatest(v_plating_sell - v_plating_cost, 0),'
  );

  v_new := replace(
    v_new,
    '''plating_margin_krw'', v_plating_margin,',
    '''plating_margin_krw'', greatest(v_plating_sell - v_plating_cost, 0),'
  );

  if v_new <> v_def then
    execute v_new;
  end if;
end;
$$;
-- Backfill PLATING_MASTER meta margin for already-created shipment lines.
-- Scope: backend-generated policy_v2_plating entries only.
with patched as (
  select
    s.shipment_line_id,
    coalesce(
      jsonb_agg(
        case
          when upper(coalesce(item->>'type', '')) = 'PLATING_MASTER'
               and upper(coalesce(item #>> '{meta,engine}', '')) = 'POLICY_V2_PLATING'
            then
              item || jsonb_build_object(
                'meta',
                (
                  case
                    when jsonb_typeof(item->'meta') = 'object' then item->'meta'
                    else '{}'::jsonb
                  end
                ) || jsonb_build_object(
                  'sell_krw', vals.sell_krw,
                  'margin_krw', greatest(vals.sell_krw - vals.cost_krw, 0)
                )
              )
          else item
        end
      ) filter (where item is not null),
      '[]'::jsonb
    ) as items,
    bool_or(
      upper(coalesce(item->>'type', '')) = 'PLATING_MASTER'
      and upper(coalesce(item #>> '{meta,engine}', '')) = 'POLICY_V2_PLATING'
    ) as has_target
  from public.cms_shipment_line s
  left join lateral jsonb_array_elements(coalesce(s.extra_labor_items, '[]'::jsonb)) as item on true
  left join lateral (
    select
      greatest(
        coalesce(
          case
            when coalesce(item #>> '{meta,sell_krw}', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
              then (item #>> '{meta,sell_krw}')::numeric
            else null
          end,
          case
            when coalesce(item->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
              then (item->>'amount')::numeric
            else null
          end,
          0
        ),
        0
      ) as sell_krw,
      greatest(
        coalesce(
          case
            when coalesce(item #>> '{meta,cost_krw}', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
              then (item #>> '{meta,cost_krw}')::numeric
            else null
          end,
          0
        ),
        0
      ) as cost_krw
  ) vals on true
  group by s.shipment_line_id
)
update public.cms_shipment_line sl
set
  extra_labor_items = patched.items,
  updated_at = now()
from patched
where sl.shipment_line_id = patched.shipment_line_id
  and coalesce(patched.has_target, false);
