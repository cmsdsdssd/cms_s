set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1111_sales_channel_product_integrity_trigger_fix_addonly
-- Allow inactive/historical rows while still preventing zero-active on live keys
-- -----------------------------------------------------------------------------

create or replace function public.cms_fn_enforce_sales_channel_product_integrity()
returns trigger
language plpgsql
as $$
declare
  v_has_conflict boolean;
  v_has_active boolean;
begin
  if tg_op = 'DELETE' then
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

  -- 1 master = 1 product (within channel)
  select exists(
    select 1
    from public.sales_channel_product p
    where p.channel_id = new.channel_id
      and p.external_product_no = new.external_product_no
      and p.master_item_id <> new.master_item_id
      and (tg_op <> 'UPDATE' or p.channel_product_id <> new.channel_product_id)
  ) into v_has_conflict;

  if v_has_conflict then
    raise exception using
      message = 'sales_channel_product integrity violation: same product_no cannot map to multiple master_item_id',
      errcode = '23514';
  end if;

  -- If this update/removal would drop OLD live key to zero active rows, block it.
  if tg_op = 'UPDATE' and old.is_active and (
    new.is_active = false
    or old.channel_id <> new.channel_id
    or old.external_product_no <> new.external_product_no
  ) then
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

  return new;
end;
$$;
