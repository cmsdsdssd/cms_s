-- =============================================================
-- cms_0604_margin_engine_backend_api_compat_addonly
--
-- 목적:
--  - 0603(backend SQL patch)까지 DB push 완료된 상태에서,
--    Next.js backend patch(cms_backend_patch.zip)가 기대하는 "컬럼명/형식"을
--    DB 스키마에 ADD-ONLY로 100% 맞춘다.
--
-- 포함:
--  1) cms_buy_margin_profile_v1  : profile_name alias + name/profile_name 동기화
--  2) cms_plating_markup_rule_v1 : API 호환 컬럼(min/max/markup_kind/value/vendor) 추가 + 동기화
--
-- 주의:
--  - DROP/RENAME 없음 (ADD-ONLY + CREATE OR REPLACE만 사용)
--  - 이미 존재하면 no-op (IF NOT EXISTS / 중복 예외 처리)
-- =============================================================

set search_path = public, pg_temp;
-- =============================================================
-- 1) BUY 마진 프로파일: profile_name alias 추가
--    - Backend API expects: profile_name, margin_center_krw, margin_sub1_krw, margin_sub2_krw
--    - Engine table had:   name, center_margin_krw_per_stone, ...
--    - 0603에서 margin_* 동기화는 이미 처리됨. 여기서는 profile_name만 추가/동기화.
-- =============================================================

alter table if exists public.cms_buy_margin_profile_v1
  add column if not exists profile_name text;
-- 안전: (혹시 0603이 누락된 환경에서 실행돼도) margin_* 컬럼이 없다면 추가
alter table if exists public.cms_buy_margin_profile_v1
  add column if not exists margin_center_krw numeric,
  add column if not exists margin_sub1_krw numeric,
  add column if not exists margin_sub2_krw numeric;
-- 기존 데이터 backfill
update public.cms_buy_margin_profile_v1
set profile_name = name
where profile_name is null or btrim(profile_name) = '';
-- 0603에서 만든 sync function을 "profile_name<->name"까지 포함하도록 보강
-- (trigger는 기존 것을 그대로 재사용)
create or replace function public.cms_fn_sync_buy_margin_profile_api_cols_v1()
returns trigger
language plpgsql
as $$
begin
  -- profile_code 안전장치 (0603과 동일)
  if new.profile_code is null or btrim(new.profile_code) = '' then
    new.profile_code := 'profile_' || substring(md5(gen_random_uuid()::text), 1, 8);
  end if;

  -- name/profile_name 동기화
  if new.profile_name is not null and btrim(new.profile_name) <> '' then
    new.name := new.profile_name;
  end if;

  if new.name is null or btrim(new.name) = '' then
    new.name := coalesce(nullif(btrim(new.profile_name), ''), 'BUY_PROFILE');
  end if;

  new.profile_name := new.name;

  -- API -> engine
  new.center_margin_krw_per_stone := coalesce(new.margin_center_krw, new.center_margin_krw_per_stone, 0);
  new.sub1_margin_krw_per_stone   := coalesce(new.margin_sub1_krw,   new.sub1_margin_krw_per_stone,   0);
  new.sub2_margin_krw_per_stone   := coalesce(new.margin_sub2_krw,   new.sub2_margin_krw_per_stone,   0);

  -- engine -> API (항상 동일값 유지)
  new.margin_center_krw := new.center_margin_krw_per_stone;
  new.margin_sub1_krw   := new.sub1_margin_krw_per_stone;
  new.margin_sub2_krw   := new.sub2_margin_krw_per_stone;

  return new;
end;
$$;
-- trigger가 없으면 생성(있으면 no-op)
do $$
begin
  create trigger trg_cms_buy_margin_profile_v1_api_sync
  before insert or update on public.cms_buy_margin_profile_v1
  for each row execute function public.cms_fn_sync_buy_margin_profile_api_cols_v1();
exception when duplicate_object then
  null;
end $$;
-- =============================================================
-- 2) 도금 마진 룰: Next.js API 호환 컬럼 추가
--    - Backend API expects:
--        vendor_party_id, min_cost_krw, max_cost_krw, markup_kind, markup_value_krw
--    - Engine(v0602) table had:
--        effective_from, margin_fixed_krw, margin_per_g_krw (and no cost band)
--
--    정책:
--      - markup_kind는 현재 'ADD_KRW'만 지원(기존 type 활용)
--      - markup_value_krw <-> margin_fixed_krw 동기화 (fixed margin에 매핑)
--      - min/max/vendor는 일단 저장/관리 가능하게만 제공 (기존 calc 함수는 영향 없음)
-- =============================================================

alter table if exists public.cms_plating_markup_rule_v1
  add column if not exists vendor_party_id uuid references public.cms_party(party_id),
  add column if not exists min_cost_krw numeric not null default 0,
  add column if not exists max_cost_krw numeric,
  add column if not exists markup_kind public.cms_e_pricing_rule_markup_kind not null default 'ADD_KRW',
  add column if not exists markup_value_krw numeric not null default 0;
-- 기존 데이터: 새 API 컬럼을 기존 margin_fixed_krw 기반으로 채움
update public.cms_plating_markup_rule_v1
set
  markup_kind = coalesce(markup_kind, 'ADD_KRW'::public.cms_e_pricing_rule_markup_kind),
  -- 기존 fixed margin을 API alias로 노출
  markup_value_krw = case
    when coalesce(markup_value_krw, 0) = 0 and coalesce(margin_fixed_krw, 0) <> 0 then margin_fixed_krw
    else coalesce(markup_value_krw, 0)
  end,
  min_cost_krw = greatest(coalesce(min_cost_krw, 0), 0)
where true;
-- API insert/update 시 fixed margin 동기화
create or replace function public.cms_fn_sync_plating_markup_rule_api_cols_v1()
returns trigger
language plpgsql
as $$
begin
  -- normalize
  new.min_cost_krw := greatest(coalesce(new.min_cost_krw, 0), 0);
  if new.max_cost_krw is not null and new.max_cost_krw < new.min_cost_krw then
    -- 방어적으로 clamp (API에서도 검증하지만 DB 레벨에서도 안전)
    new.max_cost_krw := new.min_cost_krw;
  end if;

  if new.markup_kind is null then
    new.markup_kind := 'ADD_KRW'::public.cms_e_pricing_rule_markup_kind;
  end if;

  -- 현재 시스템은 ADD_KRW만 지원 (enum 자체도 ADD_KRW만 있는 환경이 많음)
  -- 미래 확장 시 여기서 분기하면 됨.
  new.markup_value_krw := greatest(coalesce(new.markup_value_krw, new.margin_fixed_krw, 0), 0);

  -- API alias -> engine fixed margin
  new.margin_fixed_krw := new.markup_value_krw;

  -- engine -> API alias (항상 일치)
  new.markup_value_krw := new.margin_fixed_krw;

  return new;
end;
$$;
do $$
begin
  create trigger trg_cms_plating_markup_rule_v1_api_sync
  before insert or update on public.cms_plating_markup_rule_v1
  for each row execute function public.cms_fn_sync_plating_markup_rule_api_cols_v1();
exception when duplicate_object then
  null;
end $$;
-- 품질 방어 체크(중복이면 무시)
do $$
begin
  alter table public.cms_plating_markup_rule_v1
    add constraint cms_plating_markup_rule_v1_api_cols_check
    check (
      min_cost_krw >= 0
      and (max_cost_krw is null or max_cost_krw >= min_cost_krw)
      and markup_value_krw >= 0
    );
exception when duplicate_object then
  null;
end $$;
create index if not exists idx_cms_plating_markup_rule_v1_vendor_party_id
  on public.cms_plating_markup_rule_v1(vendor_party_id);
create index if not exists idx_cms_plating_markup_rule_v1_cost_band
  on public.cms_plating_markup_rule_v1(plating_variant_id, vendor_party_id, min_cost_krw, max_cost_krw);
-- 끝.;
