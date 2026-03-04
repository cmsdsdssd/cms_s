set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1110_sales_channel_product_strict_integrity_addonly
-- Enforce strict no-fallback mapping integrity for channel_id + external_product_no
-- -----------------------------------------------------------------------------

create index if not exists idx_sales_channel_product_channel_product_master
  on public.sales_channel_product(channel_id, external_product_no, master_item_id);

create or replace function public.cms_fn_enforce_sales_channel_product_integrity()
returns trigger
language plpgsql
as $$
declare
  v_channel_id uuid;
  v_external_product_no text;
  v_master_item_id uuid;
  v_has_conflict boolean;
  v_has_active boolean;
begin
  if tg_op = 'DELETE' then
    v_channel_id := old.channel_id;
    v_external_product_no := old.external_product_no;

    if old.is_active then
      select exists(
        select 1
        from public.sales_channel_product p
        where p.channel_id = old.channel_id
          and p.external_product_no = old.external_product_no
          and p.channel_product_id <> old.channel_product_id
          and p.is_active = true
      ) into v_has_active;

      if not v_has_active then
        raise exception using
          message = 'sales_channel_product integrity violation: product_no must keep at least one active mapping',
          errcode = '23514';
      end if;
    end if;

    return old;
  end if;

  v_channel_id := new.channel_id;
  v_external_product_no := new.external_product_no;
  v_master_item_id := new.master_item_id;

  -- 1 master = 1 product (within channel)
  select exists(
    select 1
    from public.sales_channel_product p
    where p.channel_id = v_channel_id
      and p.external_product_no = v_external_product_no
      and p.master_item_id <> v_master_item_id
      and (tg_op <> 'UPDATE' or p.channel_product_id <> new.channel_product_id)
  ) into v_has_conflict;

  if v_has_conflict then
    raise exception using
      message = 'sales_channel_product integrity violation: same product_no cannot map to multiple master_item_id',
      errcode = '23514';
  end if;

  -- disallow creating/updating a product to zero active rows
  if new.is_active = false then
    select exists(
      select 1
      from public.sales_channel_product p
      where p.channel_id = v_channel_id
        and p.external_product_no = v_external_product_no
        and p.is_active = true
        and (tg_op <> 'UPDATE' or p.channel_product_id <> new.channel_product_id)
    ) into v_has_active;

    if not v_has_active then
      raise exception using
        message = 'sales_channel_product integrity violation: product_no must keep at least one active mapping',
        errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_channel_product_integrity_iud on public.sales_channel_product;

create trigger trg_sales_channel_product_integrity_iud
before insert or update or delete on public.sales_channel_product
for each row
execute function public.cms_fn_enforce_sales_channel_product_integrity();
