-- Add-only: RAW 원가 분석 입력값 저장 필드
-- - cn_raw_cost_date: 분석 기준 날짜
-- - cn_raw_total_price_cny: 총가격(CNY)
-- - cn_raw_silver_price_cny: 은시세(CNY/g)
-- - cn_raw_labor_basis: 공임 기준(PER_G | PER_PIECE)

alter table public.cms_master_item
  add column if not exists cn_raw_cost_date date;
alter table public.cms_master_item
  add column if not exists cn_raw_total_price_cny numeric not null default 0;
alter table public.cms_master_item
  add column if not exists cn_raw_silver_price_cny numeric not null default 0;
alter table public.cms_master_item
  add column if not exists cn_raw_labor_basis text not null default 'PER_G';
comment on column public.cms_master_item.cn_raw_cost_date
  is 'RAW cost analysis date';
comment on column public.cms_master_item.cn_raw_total_price_cny
  is 'RAW cost analysis: total price in CNY';
comment on column public.cms_master_item.cn_raw_silver_price_cny
  is 'RAW cost analysis: silver price in CNY per gram';
comment on column public.cms_master_item.cn_raw_labor_basis
  is 'RAW cost analysis labor basis: PER_G or PER_PIECE';
do $$
begin
  alter table public.cms_master_item
    add constraint cms_master_item_cn_raw_total_price_nonneg
    check (cn_raw_total_price_cny >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item
    add constraint cms_master_item_cn_raw_silver_price_nonneg
    check (cn_raw_silver_price_cny >= 0);
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter table public.cms_master_item
    add constraint cms_master_item_cn_raw_labor_basis_valid
    check (cn_raw_labor_basis in ('PER_G', 'PER_PIECE'));
exception
  when duplicate_object then null;
end $$;
