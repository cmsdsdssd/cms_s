set search_path = public, pg_temp;

create or replace function public.cms_fn_assert_sales_channel_product_master_integrity(
  p_channel_id uuid,
  p_master_item_id uuid
)
returns void
language plpgsql
as $$
declare
  v_active_count integer;
  v_active_base_count integer;
  v_base_product_no text;
begin
  if p_channel_id is null or p_master_item_id is null then
    return;
  end if;

  select
    count(*),
    count(*) filter (where coalesce(btrim(external_variant_code), '') = ''),
    max(external_product_no) filter (where coalesce(btrim(external_variant_code), '') = '')
  into v_active_count, v_active_base_count, v_base_product_no
  from public.sales_channel_product
  where channel_id = p_channel_id
    and master_item_id = p_master_item_id
    and is_active = true;

  if v_active_count = 0 then
    return;
  end if;

  if v_active_base_count <> 1 then
    raise exception using
      message = 'sales_channel_product canonical integrity violation: expected exactly one active base row per master',
      errcode = '23514';
  end if;

  if exists(
    select 1
    from public.sales_channel_product p
    where p.channel_id = p_channel_id
      and p.master_item_id = p_master_item_id
      and p.is_active = true
      and coalesce(btrim(p.external_variant_code), '') <> ''
      and p.external_product_no <> v_base_product_no
  ) then
    raise exception using
      message = 'sales_channel_product canonical integrity violation: active variants must share the canonical base product number',
      errcode = '23514';
  end if;
end;
$$;

create or replace function public.cms_fn_assert_sales_channel_product_product_scope(
  p_channel_id uuid,
  p_external_product_no text
)
returns void
language plpgsql
as $$
begin
  if p_channel_id is null or coalesce(btrim(p_external_product_no), '') = '' then
    return;
  end if;

  if exists(
    select 1
    from public.sales_channel_product p
    where p.channel_id = p_channel_id
      and p.external_product_no = p_external_product_no
      and p.is_active = true
    group by p.channel_id, p.external_product_no
    having count(distinct p.master_item_id) > 1
  ) then
    raise exception using
      message = 'sales_channel_product canonical integrity violation: active product number cannot map to multiple masters',
      errcode = '23514';
  end if;
end;
$$;

create or replace function public.cms_fn_enforce_sales_channel_product_integrity()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.cms_fn_assert_sales_channel_product_master_integrity(old.channel_id, old.master_item_id);
    perform public.cms_fn_assert_sales_channel_product_product_scope(old.channel_id, old.external_product_no);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.cms_fn_assert_sales_channel_product_master_integrity(new.channel_id, new.master_item_id);
    perform public.cms_fn_assert_sales_channel_product_product_scope(new.channel_id, new.external_product_no);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sales_channel_product_integrity_iud on public.sales_channel_product;

create temporary table cms_tmp_canonical_base_product on commit drop as
select distinct on (scp.channel_id, scp.master_item_id)
  scp.channel_id,
  scp.master_item_id,
  scp.external_product_no as canonical_external_product_no
from public.sales_channel_product scp
where coalesce(btrim(scp.external_product_no), '') <> ''
order by
  scp.channel_id,
  scp.master_item_id,
  case when coalesce(btrim(scp.external_variant_code), '') = '' then 0 else 1 end,
  case when scp.external_product_no ~* '^P' then 0 else 1 end,
  scp.external_product_no asc,
  case when scp.is_active then 0 else 1 end,
  scp.updated_at desc,
  scp.created_at desc,
  scp.channel_product_id desc;

create temporary table cms_tmp_channel_product_keeper on commit drop as
select distinct on (scp.channel_id, scp.master_item_id, coalesce(btrim(scp.external_variant_code), ''))
  scp.channel_product_id,
  scp.channel_id,
  scp.master_item_id,
  coalesce(btrim(scp.external_variant_code), '') as external_variant_code,
  cb.canonical_external_product_no
from public.sales_channel_product scp
join cms_tmp_canonical_base_product cb
  on cb.channel_id = scp.channel_id
 and cb.master_item_id = scp.master_item_id
order by
  scp.channel_id,
  scp.master_item_id,
  coalesce(btrim(scp.external_variant_code), ''),
  case when scp.external_product_no = cb.canonical_external_product_no then 0 else 1 end,
  case when scp.is_active then 0 else 1 end,
  scp.updated_at desc,
  scp.created_at desc,
  scp.channel_product_id desc;

insert into public.sales_channel_product_alias_history (
  channel_id,
  canonical_channel_product_id,
  master_item_id,
  canonical_external_product_no,
  alias_external_product_no,
  external_variant_code,
  reason
)
select
  scp.channel_id,
  keeper.channel_product_id,
  scp.master_item_id,
  cb.canonical_external_product_no,
  scp.external_product_no,
  coalesce(btrim(scp.external_variant_code), ''),
  'CANONICAL_REBUILD'
from public.sales_channel_product scp
join cms_tmp_canonical_base_product cb
  on cb.channel_id = scp.channel_id
 and cb.master_item_id = scp.master_item_id
join cms_tmp_channel_product_keeper keeper
  on keeper.channel_id = scp.channel_id
 and keeper.master_item_id = scp.master_item_id
 and keeper.external_variant_code = coalesce(btrim(scp.external_variant_code), '')
where scp.is_active = true
  and scp.external_product_no <> cb.canonical_external_product_no
  and not exists (
    select 1
    from public.sales_channel_product_alias_history h
    where h.channel_id = scp.channel_id
      and coalesce(h.master_item_id, scp.master_item_id) = scp.master_item_id
      and h.canonical_external_product_no = cb.canonical_external_product_no
      and h.alias_external_product_no = scp.external_product_no
      and coalesce(btrim(h.external_variant_code), '') = coalesce(btrim(scp.external_variant_code), '')
      and h.reason = 'CANONICAL_REBUILD'
  );

delete from public.sales_channel_product scp
using cms_tmp_channel_product_keeper keeper
where scp.channel_id = keeper.channel_id
  and scp.master_item_id = keeper.master_item_id
  and coalesce(btrim(scp.external_variant_code), '') = keeper.external_variant_code
  and scp.external_product_no = keeper.canonical_external_product_no
  and scp.channel_product_id <> keeper.channel_product_id;

update public.sales_channel_product scp
set is_active = false,
    updated_at = now()
where scp.is_active = true
  and exists (
    select 1
    from cms_tmp_channel_product_keeper keeper
    where keeper.channel_id = scp.channel_id
      and keeper.master_item_id = scp.master_item_id
  )
  and not exists (
    select 1
    from cms_tmp_channel_product_keeper keeper
    where keeper.channel_product_id = scp.channel_product_id
  );

update public.sales_channel_product scp
set external_product_no = keeper.canonical_external_product_no,
    external_variant_code = keeper.external_variant_code,
    is_active = true,
    updated_at = now()
from cms_tmp_channel_product_keeper keeper
where scp.channel_product_id = keeper.channel_product_id
  and (
    scp.external_product_no <> keeper.canonical_external_product_no
    or scp.is_active <> true
    or scp.external_variant_code <> keeper.external_variant_code
  );

create temporary table cms_tmp_canonical_variant_target on commit drop as
select
  scp.channel_id,
  scp.master_item_id,
  coalesce(btrim(scp.external_variant_code), '') as external_variant_code,
  scp.channel_product_id,
  scp.external_product_no
from public.sales_channel_product scp
where scp.is_active = true
  and coalesce(btrim(scp.external_variant_code), '') <> '';

create temporary table cms_tmp_option_state_keeper on commit drop as
select distinct on (state.channel_id, state.master_item_id, coalesce(btrim(state.external_variant_code), ''))
  state.state_id,
  state.channel_id,
  state.master_item_id,
  coalesce(btrim(state.external_variant_code), '') as external_variant_code,
  target.channel_product_id as canonical_channel_product_id,
  target.external_product_no as canonical_external_product_no
from public.channel_option_current_state_v1 state
join cms_tmp_canonical_variant_target target
  on target.channel_id = state.channel_id
 and target.master_item_id = state.master_item_id
 and target.external_variant_code = coalesce(btrim(state.external_variant_code), '')
order by
  state.channel_id,
  state.master_item_id,
  coalesce(btrim(state.external_variant_code), ''),
  state.updated_at desc,
  state.created_at desc,
  state.state_id desc;

delete from public.channel_option_current_state_v1 state
using cms_tmp_option_state_keeper keeper
where state.channel_id = keeper.channel_id
  and state.master_item_id = keeper.master_item_id
  and coalesce(btrim(state.external_variant_code), '') = keeper.external_variant_code
  and state.state_id <> keeper.state_id;

update public.channel_option_current_state_v1 state
set channel_product_id = keeper.canonical_channel_product_id,
    external_product_no = keeper.canonical_external_product_no,
    updated_at = now()
from cms_tmp_option_state_keeper keeper
where state.state_id = keeper.state_id
  and (
    state.channel_product_id is distinct from keeper.canonical_channel_product_id
    or state.external_product_no <> keeper.canonical_external_product_no
  );

update public.channel_option_apply_log_v1 log
set channel_product_id = state.channel_product_id,
    external_product_no = state.external_product_no
from public.channel_option_current_state_v1 state
where log.state_id = state.state_id
  and (
    log.channel_product_id is distinct from state.channel_product_id
    or log.external_product_no <> state.external_product_no
  );

delete from public.price_sync_change_event;
delete from public.price_sync_push_task_v2;
delete from public.price_sync_intent_v2;
delete from public.price_sync_run_v2;
delete from public.price_sync_auto_state_v1;
delete from public.pricing_snapshot;

create unique index if not exists uq_sales_channel_product_active_base_per_master
  on public.sales_channel_product(channel_id, master_item_id)
  where is_active = true
    and coalesce(btrim(external_variant_code), '') = '';

create unique index if not exists uq_sales_channel_product_active_variant_per_master
  on public.sales_channel_product(channel_id, master_item_id, external_variant_code)
  where is_active = true
    and coalesce(btrim(external_variant_code), '') <> '';

drop trigger if exists trg_sales_channel_product_integrity_iud on public.sales_channel_product;

create trigger trg_sales_channel_product_integrity_iud
after insert or update or delete on public.sales_channel_product
for each row
execute function public.cms_fn_enforce_sales_channel_product_integrity();

do $$
declare
  v_bad_count integer;
begin
  select count(*)
  into v_bad_count
  from (
    select scp.channel_id, scp.master_item_id
    from public.sales_channel_product scp
    where scp.is_active = true
    group by scp.channel_id, scp.master_item_id
    having count(*) filter (where coalesce(btrim(scp.external_variant_code), '') = '') <> 1
  ) violations;

  if v_bad_count > 0 then
    raise exception using
      message = 'canonical rebuild verification failed: expected exactly one active base row per master',
      errcode = '23514';
  end if;

  select count(*)
  into v_bad_count
  from public.sales_channel_product scp
  join public.sales_channel_product base
    on base.channel_id = scp.channel_id
   and base.master_item_id = scp.master_item_id
   and base.is_active = true
   and coalesce(btrim(base.external_variant_code), '') = ''
  where scp.is_active = true
    and coalesce(btrim(scp.external_variant_code), '') <> ''
    and scp.external_product_no <> base.external_product_no;

  if v_bad_count > 0 then
    raise exception using
      message = 'canonical rebuild verification failed: active variants still reference non-canonical product numbers',
      errcode = '23514';
  end if;
end $$;
