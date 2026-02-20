set search_path = public, pg_temp;
-- ------------------------------------------------------------
-- cms_0256 (REPLACE CONTENT):
-- 목적:
-- 1) 기존 함수 public.cms_fn_latest_tick_by_role_v1(text)의 "리턴 타입"을 바꾸지 않는다.
--    (create or replace로 OUT 파라미터 변경 시 42P13 발생)
-- 2) 대신 새 함수 public.cms_fn_latest_tick_by_role_v2(text)를 만든다.
--    v2는 (tick_id, symbol, price, observed_at, meta)를 반환한다.
-- 3) 이미 적용된 cms_0255에서 만든 public.cms_fn_confirm_shipment가 v1을 호출하므로,
--    confirm 함수 정의를 DB에서 읽어 v1 호출을 v2로 치환한다.
-- ------------------------------------------------------------

-- 1) v2 생성 (새 시그니처)
create or replace function public.cms_fn_latest_tick_by_role_v2(
  p_role_code text
) returns table(
  tick_id uuid,
  symbol public.cms_e_market_symbol,
  price numeric,
  observed_at timestamptz,
  meta jsonb
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_symbol public.cms_e_market_symbol;
begin
  v_symbol :=
    case upper(coalesce(p_role_code,''))
      when 'GOLD' then 'GOLD_KRW_PER_G'::public.cms_e_market_symbol
      when 'SILVER_CN' then 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol
      when 'SILVER_KR' then 'SILVER_KRW_PER_G'::public.cms_e_market_symbol
      else null
    end;

  if v_symbol is null then
    raise exception 'invalid role_code: %', p_role_code;
  end if;

  return query
  select
    t.tick_id,
    v_symbol as symbol,
    t.price,
    t.observed_at,
    t.meta
  from public.cms_market_tick t
  where t.symbol = v_symbol
  order by t.observed_at desc
  limit 1;
end $$;
-- 2) confirm 함수가 v1을 호출하면(0255에서 생성), v2로 바꿔치기
do $$
declare
  v_def text;
begin
  -- confirm 함수가 없으면 아무것도 하지 않음
  if to_regprocedure('public.cms_fn_confirm_shipment(uuid,uuid,text)') is null then
    return;
  end if;

  v_def := pg_get_functiondef('public.cms_fn_confirm_shipment(uuid,uuid,text)'::regprocedure);

  -- v1 호출을 v2로 치환
  v_def := regexp_replace(
    v_def,
    '\bcms_fn_latest_tick_by_role_v1\b',
    'cms_fn_latest_tick_by_role_v2',
    'g'
  );

  execute v_def;
end $$;
