begin;

create table if not exists public.cms_shipment_line_material_master_audit (
  audit_id uuid primary key default gen_random_uuid(),
  shipment_line_id uuid not null,
  shipment_id uuid,
  action text not null,
  stripped_items jsonb not null default '[]'::jsonb,
  stripped_total_krw numeric not null default 0,
  before_extra_labor_items jsonb,
  after_extra_labor_items jsonb,
  before_extra_labor_krw numeric,
  after_extra_labor_krw numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_shipment_line_material_master_audit_line
  on public.cms_shipment_line_material_master_audit (shipment_line_id, created_at desc);

create or replace function public.cms_fn_is_material_master_extra_item_v1(p_item jsonb)
returns boolean
language sql
immutable
as $$
  select (
    left(upper(coalesce(p_item->>'type', '')), 16) = 'MATERIAL_MASTER:'
    or upper(coalesce(p_item #>> '{meta,class}', '')) = 'MATERIAL_MASTER'
    or upper(coalesce(p_item #>> '{meta,source}', '')) = 'MASTER_MATERIAL_LABOR'
  );
$$;

create or replace function public.cms_fn_sum_valid_extra_labor_amount_v1(p_items jsonb)
returns numeric
language sql
stable
as $$
  with arr as (
    select case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end as items
  )
  select coalesce(
    sum(
      case
        when coalesce(item->>'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$' then (item->>'amount')::numeric
        else 0
      end
    ),
    0
  )
  from arr
  left join lateral jsonb_array_elements(arr.items) as item on true;
$$;

create or replace function public.cms_fn_shipment_line_strip_material_master_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_items jsonb := case when jsonb_typeof(new.extra_labor_items) = 'array' then new.extra_labor_items else '[]'::jsonb end;
  v_hdr record;
  v_before_items jsonb := v_items;
  v_before_extra numeric := coalesce(new.extra_labor_krw, 0);
  v_kept jsonb;
  v_stripped jsonb;
  v_after_extra numeric;
  v_stripped_total numeric;
  v_total_labor numeric;
begin
  select h.status, h.confirmed_at, h.ar_principal_locked_at
    into v_hdr
  from public.cms_shipment_header h
  where h.shipment_id = new.shipment_id;

  if coalesce(v_hdr.confirmed_at, null) is not null
     or coalesce(v_hdr.ar_principal_locked_at, null) is not null
     or coalesce(v_hdr.status::text, '') = 'CONFIRMED' then
    return new;
  end if;

  with exploded as (
    select item, ord
    from jsonb_array_elements(v_items) with ordinality as e(item, ord)
  ), partitioned as (
    select
      coalesce(jsonb_agg(item order by ord) filter (where not public.cms_fn_is_material_master_extra_item_v1(item)), '[]'::jsonb) as kept,
      coalesce(jsonb_agg(item order by ord) filter (where public.cms_fn_is_material_master_extra_item_v1(item)), '[]'::jsonb) as stripped
    from exploded
  )
  select kept, stripped into v_kept, v_stripped
  from partitioned;

  if v_kept is null then v_kept := '[]'::jsonb; end if;
  if v_stripped is null then v_stripped := '[]'::jsonb; end if;

  if v_kept is distinct from v_before_items then
    v_after_extra := public.cms_fn_sum_valid_extra_labor_amount_v1(v_kept);
    v_stripped_total := greatest(v_before_extra - v_after_extra, 0);

    new.extra_labor_items := v_kept;
    new.extra_labor_krw := v_after_extra;
    v_total_labor := coalesce(new.base_labor_krw, 0) + coalesce(new.extra_labor_krw, 0);
    new.manual_labor_krw := v_total_labor;
    new.labor_total_sell_krw := v_total_labor;
    if coalesce(new.pricing_mode::text, 'RULE') not in ('AMOUNT_ONLY', 'MANUAL') then
      new.total_amount_sell_krw := coalesce(new.material_amount_sell_krw, 0) + v_total_labor;
    end if;

    insert into public.cms_shipment_line_material_master_audit (
      shipment_line_id,
      shipment_id,
      action,
      stripped_items,
      stripped_total_krw,
      before_extra_labor_items,
      after_extra_labor_items,
      before_extra_labor_krw,
      after_extra_labor_krw
    ) values (
      new.shipment_line_id,
      new.shipment_id,
      case when tg_op = 'INSERT' then 'TRIGGER_INSERT_STRIP' else 'TRIGGER_UPDATE_STRIP' end,
      v_stripped,
      v_stripped_total,
      v_before_items,
      v_kept,
      v_before_extra,
      v_after_extra
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cms_shipment_line_strip_material_master_v1 on public.cms_shipment_line;
create trigger trg_cms_shipment_line_strip_material_master_v1
before insert or update of extra_labor_items
on public.cms_shipment_line
for each row
execute function public.cms_fn_shipment_line_strip_material_master_v1();

with target as (
  select
    sl.shipment_line_id,
    sl.shipment_id,
    sl.extra_labor_items as before_items,
    sl.extra_labor_krw as before_extra,
    sl.base_labor_krw,
    sl.material_amount_sell_krw,
    sl.pricing_mode,
    coalesce(
      jsonb_agg(item order by ord) filter (where not public.cms_fn_is_material_master_extra_item_v1(item)),
      '[]'::jsonb
    ) as kept_items,
    coalesce(
      jsonb_agg(item order by ord) filter (where public.cms_fn_is_material_master_extra_item_v1(item)),
      '[]'::jsonb
    ) as stripped_items
  from public.cms_shipment_line sl
  join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  left join lateral jsonb_array_elements(
    case when jsonb_typeof(sl.extra_labor_items) = 'array' then sl.extra_labor_items else '[]'::jsonb end
  ) with ordinality as e(item, ord) on true
  where coalesce(sh.confirmed_at, null) is null
    and coalesce(sh.ar_principal_locked_at, null) is null
    and coalesce(sh.status::text, '') <> 'CONFIRMED'
  group by
    sl.shipment_line_id,
    sl.shipment_id,
    sl.extra_labor_items,
    sl.extra_labor_krw,
    sl.base_labor_krw,
    sl.material_amount_sell_krw,
    sl.pricing_mode
), changed as (
  select
    t.*,
    public.cms_fn_sum_valid_extra_labor_amount_v1(t.kept_items) as after_extra,
    greatest(coalesce(t.before_extra, 0) - public.cms_fn_sum_valid_extra_labor_amount_v1(t.kept_items), 0) as stripped_total
  from target t
  where t.kept_items is distinct from t.before_items
), updated as (
  update public.cms_shipment_line sl
     set extra_labor_items = c.kept_items,
         extra_labor_krw = c.after_extra,
         manual_labor_krw = coalesce(c.base_labor_krw, 0) + c.after_extra,
         labor_total_sell_krw = coalesce(c.base_labor_krw, 0) + c.after_extra,
         total_amount_sell_krw = case
           when coalesce(c.pricing_mode::text, 'RULE') in ('AMOUNT_ONLY', 'MANUAL') then sl.total_amount_sell_krw
           else coalesce(c.material_amount_sell_krw, 0) + coalesce(c.base_labor_krw, 0) + c.after_extra
         end
   from changed c
  where sl.shipment_line_id = c.shipment_line_id
  returning c.*
)
insert into public.cms_shipment_line_material_master_audit (
  shipment_line_id,
  shipment_id,
  action,
  stripped_items,
  stripped_total_krw,
  before_extra_labor_items,
  after_extra_labor_items,
  before_extra_labor_krw,
  after_extra_labor_krw
)
select
  u.shipment_line_id,
  u.shipment_id,
  'BACKFILL_STRIP',
  u.stripped_items,
  u.stripped_total,
  u.before_items,
  u.kept_items,
  u.before_extra,
  u.after_extra
from updated u;

commit;
