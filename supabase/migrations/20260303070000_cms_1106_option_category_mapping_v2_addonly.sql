set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1106_option_category_mapping_v2_addonly
-- Option value category mapping (material/size/color+plating/decor/other)
-- -----------------------------------------------------------------------------

create table if not exists public.channel_option_category_v2 (
  category_id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.sales_channel(channel_id) on delete cascade,
  master_item_id uuid not null references public.cms_master_item(master_item_id),
  external_product_no text not null,
  option_name text not null,
  option_value text not null,
  category_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);

do $$
begin
  alter table public.channel_option_category_v2
    add constraint channel_option_category_v2_category_enum
    check (category_key in ('MATERIAL', 'SIZE', 'COLOR_PLATING', 'DECOR', 'OTHER'));
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter table public.channel_option_category_v2
    add constraint channel_option_category_v2_non_blank
    check (
      btrim(external_product_no) <> ''
      and btrim(option_name) <> ''
      and btrim(option_value) <> ''
    );
exception when duplicate_object then
  null;
end $$;

create unique index if not exists uq_channel_option_category_v2_item
  on public.channel_option_category_v2(channel_id, master_item_id, external_product_no, option_name, option_value);

create index if not exists idx_channel_option_category_v2_lookup
  on public.channel_option_category_v2(channel_id, master_item_id, external_product_no, updated_at desc);

do $$
begin
  if to_regprocedure('public.cms_fn_set_updated_at()') is not null then
    begin
      create trigger trg_channel_option_category_v2_updated_at
      before update on public.channel_option_category_v2
      for each row execute function public.cms_fn_set_updated_at();
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
