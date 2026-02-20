set search_path = public, pg_temp;

do $$
declare
  v_relkind "char";
begin
  select c.relkind
    into v_relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'cms_part_item'
  limit 1;

  if v_relkind is null or v_relkind = 'v' then
    execute $view$
      create or replace view public.cms_part_item
      as
      with avg_cost as (
        select
          l.master_id as part_id,
          sum(l.qty * l.unit_cost_krw)
            filter (
              where h.move_type = 'RECEIPT'
                and l.direction = 'IN'
                and l.unit_cost_krw is not null
            )
          / nullif(
              sum(l.qty)
                filter (
                  where h.move_type = 'RECEIPT'
                    and l.direction = 'IN'
                    and l.unit_cost_krw is not null
                ),
              0
            ) as last_unit_cost_krw
        from public.cms_inventory_move_line l
        join public.cms_inventory_move_header h on h.move_id = l.move_id
        where h.status = 'POSTED'
          and coalesce(l.is_void, false) = false
          and l.item_ref_type = 'MASTER'
          and l.master_id is not null
        group by l.master_id
      )
      select
        m.master_id as part_id,
        m.model_name as part_name,
        case
          when m.master_kind = 'STONE'::public.cms_e_master_kind then 'STONE'
          else 'PART'
        end as part_kind,
        m.family_name,
        m.spec_text,
        m.unit as unit_default,
        m.is_reusable,
        m.reorder_min_qty,
        m.reorder_max_qty,
        a.last_unit_cost_krw,
        m.qr_code,
        m.note,
        m.is_active,
        '{}'::jsonb as meta,
        m.created_at,
        m.updated_at
      from public.cms_master_item m
      left join avg_cost a on a.part_id = m.master_id
      where m.master_kind in ('PART'::public.cms_e_master_kind, 'STONE'::public.cms_e_master_kind)
    $view$;
  end if;
end $$;

grant select on public.cms_part_item to anon, authenticated, service_role;
