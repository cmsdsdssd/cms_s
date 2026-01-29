-- 20260129160000_cms_0038_autolink_master_by_model_trim.sql
-- 목적:
-- 1) 주문: matched_master_id 없으면 model_name(공백정리/trim)로 master 자동 매칭(유니크 1개일 때만)
-- 2) 출고라인: master_id 없으면 order_line.matched_master_id로 자동 채움
-- 3) 기존 데이터 백필

begin;

----------------------------------------------------------------------
-- 0) normalize helper (공백/대소문자/양끝 trim 정리)
--    "05_벤뎅이줄   " vs "05_벤뎅이줄" 같은 케이스를 안정적으로 맞추기 위함
----------------------------------------------------------------------
create or replace function public.cms_fn_norm_model_name(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p,''))), '\s+', ' ', 'g'), '');
$$;

----------------------------------------------------------------------
-- 1) 주문 자동 매칭 트리거:
--    matched_master_id가 null이면,
--    cms_master_item.model_name과 norm 비교해서 "정확히 1개" 매칭될 때만 채움
--    match_state는 AUTO_MATCHED로 세팅 (이미 HUMAN_*면 건드리지 않음)
----------------------------------------------------------------------
create or replace function public.cms_trg_order_line_autolink_master_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_norm text;
  v_master_id uuid;
  v_cnt int;
begin
  -- 이미 master가 들어있으면 손대지 않음
  if new.matched_master_id is not null then
    return new;
  end if;

  -- model 후보: model_name_raw 우선, 없으면 model_name
  v_norm := public.cms_fn_norm_model_name(coalesce(new.model_name_raw, new.model_name));

  if v_norm is null then
    return new;
  end if;

  -- 유니크 1개 매칭일 때만 자동 연결 (복수매칭이면 건드리지 않음)
  select count(*)
    into v_cnt
  from public.cms_master_item m
  where public.cms_fn_norm_model_name(m.model_name) = v_norm;

  if v_cnt = 1 then
    select m.master_id
      into v_master_id
    from public.cms_master_item m
    where public.cms_fn_norm_model_name(m.model_name) = v_norm
    limit 1;

    new.matched_master_id := v_master_id;

    -- match_state는 "경로 표시" 용도. 강제로 운영하려면 AUTO_MATCHED로 박는 게 제일 안전.
    if new.match_state is null or new.match_state = 'UNMATCHED' then
      new.match_state := 'AUTO_MATCHED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cms_order_line_autolink_master on public.cms_order_line;

create trigger trg_cms_order_line_autolink_master
before insert or update of model_name, model_name_raw, matched_master_id
on public.cms_order_line
for each row
execute function public.cms_trg_order_line_autolink_master_v1();

----------------------------------------------------------------------
-- 2) 출고라인 자동 master_id 트리거:
--    master_id가 null인데 order_line_id가 있으면
--    order_line.matched_master_id로 채움 (match_state는 안 봄)
----------------------------------------------------------------------
create or replace function public.cms_trg_shipment_line_fill_master_id_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_mid uuid;
begin
  if new.master_id is not null then
    return new;
  end if;

  if new.order_line_id is null then
    return new;
  end if;

  select o.matched_master_id
    into v_mid
  from public.cms_order_line o
  where o.order_line_id = new.order_line_id;

  if v_mid is not null then
    new.master_id := v_mid;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cms_shipment_line_fill_master_id on public.cms_shipment_line;

create trigger trg_cms_shipment_line_fill_master_id
before insert or update of order_line_id, master_id
on public.cms_shipment_line
for each row
execute function public.cms_trg_shipment_line_fill_master_id_v1();

----------------------------------------------------------------------
-- 3) 기존 데이터 백필 (현재 테스트/운영 데이터 모두 정리)
-- 3-1) 주문: matched_master_id 없는 애들 자동 매칭(유니크 1개만)
----------------------------------------------------------------------
with cand as (
  select
    o.order_line_id,
    public.cms_fn_norm_model_name(coalesce(o.model_name_raw, o.model_name)) as norm
  from public.cms_order_line o
  where o.matched_master_id is null
),
uniq as (
  select
    c.order_line_id,
    min(m.master_id) as master_id
  from cand c
  join public.cms_master_item m
    on public.cms_fn_norm_model_name(m.model_name) = c.norm
  group by c.order_line_id
  having count(*) = 1
)
update public.cms_order_line o
set matched_master_id = u.master_id,
    match_state = case
      when o.match_state is null or o.match_state = 'UNMATCHED' then 'AUTO_MATCHED'
      else o.match_state
    end
from uniq u
where o.order_line_id = u.order_line_id;

----------------------------------------------------------------------
-- 3-2) 출고라인: master_id 없는 애들 order_line.matched_master_id로 백필
----------------------------------------------------------------------
update public.cms_shipment_line sl
set master_id = o.matched_master_id
from public.cms_order_line o
where sl.master_id is null
  and sl.order_line_id = o.order_line_id
  and o.matched_master_id is not null;

commit;
