set search_path = public, pg_temp;

-- cms_0008: SECURITY HARD LOCK (RPC-only writes)
-- 紐⑺몴: 遺꾩꽍 1?쒖쐞 + ?댁쁺 ?덉젙??2?쒖쐞
-- ?먯튃: ?뚯씠釉?DML 湲덉?(anon/authenticated) + RPC留?EXEC ?덉슜 + RLS??read留??댁뼱?먭린

-- ------------------------------------------------------------
-- 1) 湲곕낯 沅뚰븳: ?꾨? 類뤾퀬(read留?理쒖냼 遺??
-- ------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Phase1: ?대? ?댁쁺 ?곗꽑(沅뚰븳 源⑥쭚 諛⑹?) ??authenticated??SELECT ?덉슜
-- (異뷀썑 ?꾩슂?섎㈃ RLS 議곌굔????醫곹엳??諛⑹떇?쇰줈 媛뺥솕)
grant select on all tables in schema public to authenticated;

-- ------------------------------------------------------------
-- 2) 湲곕낯 沅뚰븳(誘몃옒 媛앹껜): ???뚯씠釉??⑥닔 ?앷꺼??媛숈? 猷??곸슜
-- ------------------------------------------------------------
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter default privileges in schema public grant select on tables to authenticated;

-- ------------------------------------------------------------
-- 3) RLS: cms_* 踰좎씠?ㅽ뀒?대툝?먮쭔 enable + authenticated read ?뺤콉
--    (pg_tables??view ?쒖쇅)
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

    -- SELECT留??덉슜(Phase1 ?⑥닚)
    execute format('drop policy if exists cms_select_authenticated on public.%I;', r.tablename);
    execute format(
      'create policy cms_select_authenticated on public.%I for select to authenticated using (true);',
      r.tablename
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4) ?듭떖 RPC 3醫? SECURITY DEFINER + EXEC ?덉슜(議곌굔遺)
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
