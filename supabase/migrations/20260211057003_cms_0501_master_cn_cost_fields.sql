-- Add-only: 중국 원가(공임) 입력값 저장 필드
-- - cn_labor_basic_cny_per_g : 기본 g당 공임(CNY/g)
-- - cn_labor_extra_items     : 기타 g당 공임 리스트(JSONB)

alter table public.cms_master_item
  add column if not exists cn_labor_basic_cny_per_g numeric not null default 0;

alter table public.cms_master_item
  add column if not exists cn_labor_extra_items jsonb not null default '[]'::jsonb;

comment on column public.cms_master_item.cn_labor_basic_cny_per_g
  is 'China cost input: base labor in CNY per gram (CNY/g)';

comment on column public.cms_master_item.cn_labor_extra_items
  is 'China cost input: extra labor items array. Each: {label: text, cny_per_g: number}';

-- Constraints (idempotent)
do $$
begin
  alter table public.cms_master_item
    add constraint cms_master_item_cn_labor_basic_nonneg
    check (cn_labor_basic_cny_per_g >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.cms_master_item
    add constraint cms_master_item_cn_labor_extra_items_is_array
    check (jsonb_typeof(cn_labor_extra_items) = 'array');
exception
  when duplicate_object then null;
end $$;
