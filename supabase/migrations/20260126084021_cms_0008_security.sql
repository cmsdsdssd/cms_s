-- cms_0008: SECURITY HARD LOCK (RPC-only writes)
-- 목표: 분석 1순위 + 운영 안정성 2순위
-- 원칙: 테이블 DML 금지(anon/authenticated) + RPC만 EXEC 허용 + RLS는 read만 열어두기

-- ------------------------------------------------------------
-- 1) 기본 권한: 전부 뺏고(read만 최소 부여)
-- ------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Phase1: 내부 운영 우선(권한 깨짐 방지) → authenticated는 SELECT 허용
-- (추후 필요하면 RLS 조건을 더 좁히는 방식으로 강화)
grant select on all tables in schema public to authenticated;

-- ------------------------------------------------------------
-- 2) 기본 권한(미래 객체): 새 테이블/함수 생겨도 같은 룰 적용
-- ------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter default privileges in schema public grant select on tables to authenticated;

-- ------------------------------------------------------------
-- 3) RLS: cms_* 베이스테이블에만 enable + authenticated read 정책
--    (pg_tables는 view 제외)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'cms\_%' escape '\'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);

    -- SELECT만 허용(Phase1 단순)
    execute format('drop policy if exists cms_select_authenticated on public.%I;', r.tablename);
    execute format(
      'create policy cms_select_authenticated on public.%I for select to authenticated using (true);',
      r.tablename
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4) 핵심 RPC 3종: SECURITY DEFINER + EXEC 허용(조건부)
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.cms_fn_confirm_shipment(uuid,uuid,text)') is not null then
    execute 'alter function public.cms_fn_confirm_shipment(uuid,uuid,text) security definer set search_path=public,pg_temp;';
    execute 'grant execute on function public.cms_fn_confirm_shipment(uuid,uuid,text) to authenticated;';
  end if;

  if to_regprocedure('public.cms_fn_record_payment(uuid,timestamptz,jsonb,text)') is not null then
    execute 'alter function public.cms_fn_record_payment(uuid,timestamptz,jsonb,text) security definer set search_path=public,pg_temp;';
    execute 'grant execute on function public.cms_fn_record_payment(uuid,timestamptz,jsonb,text) to authenticated;';
  end if;

  if to_regprocedure('public.cms_fn_record_return(uuid,int,timestamptz,numeric,text)') is not null then
    execute 'alter function public.cms_fn_record_return(uuid,int,timestamptz,numeric,text) security definer set search_path=public,pg_temp;';
    execute 'grant execute on function public.cms_fn_record_return(uuid,int,timestamptz,numeric,text) to authenticated;';
  end if;
end $$;
