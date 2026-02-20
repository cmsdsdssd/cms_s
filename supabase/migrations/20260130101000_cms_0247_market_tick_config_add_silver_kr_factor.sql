set search_path = public, pg_temp;
-- ------------------------------------------------------------
-- cms_0247: split silver correction factors (CN tick vs KR silver)
--
-- - cs_correction_factor: used by n8n when computing SILVER_CN_KRW_PER_G
-- - silver_kr_correction_factor: used for KR silver pricing adjustment (SILVER_KRW_PER_G)
--
-- NOTE: We keep config_key='DEFAULT' as the single SoT row.
-- ------------------------------------------------------------

alter table public.cms_market_tick_config
  add column if not exists silver_kr_correction_factor numeric(18,6) not null default 1.200000;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_market_tick_config_silver_kr_factor_range'
  ) then
    alter table public.cms_market_tick_config
      add constraint cms_market_tick_config_silver_kr_factor_range
      check (silver_kr_correction_factor > 0.000000 and silver_kr_correction_factor <= 3.000000);
  end if;
end $$;
-- Backfill DEFAULT row (keep behavior: if missing, mirror cs_correction_factor)
update public.cms_market_tick_config
set silver_kr_correction_factor = coalesce(silver_kr_correction_factor, cs_correction_factor, 1.200000),
    updated_at = now()
where config_key = 'DEFAULT'
  and (silver_kr_correction_factor is null);
comment on column public.cms_market_tick_config.silver_kr_correction_factor is
  'KR silver correction factor used by SILVER_KRW_PER_G pipeline (and shipment pricing snapshots when tick meta does not embed the factor).';
-- Recreate RPC with an optional KR factor parameter (avoid overload ambiguity)
drop function if exists public.cms_fn_upsert_market_tick_config_v1(numeric, numeric, uuid, uuid, text);
create or replace function public.cms_fn_upsert_market_tick_config_v1(
  p_fx_markup numeric,
  p_cs_correction_factor numeric,
  p_silver_kr_correction_factor numeric default null,
  p_actor_person_id uuid default null,
  p_session_id uuid default null,
  p_memo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fx numeric(18,6);
  v_cs numeric(18,6);
  v_kr numeric(18,6);
begin
  v_fx := round(p_fx_markup::numeric, 6);
  v_cs := round(p_cs_correction_factor::numeric, 6);
  v_kr := round(coalesce(p_silver_kr_correction_factor, v_cs)::numeric, 6);

  if v_fx < 0.500000 or v_fx > 2.000000 then
    raise exception 'fx_markup out of range: %', v_fx;
  end if;
  if v_cs <= 0.000000 or v_cs > 3.000000 then
    raise exception 'cs_correction_factor out of range: %', v_cs;
  end if;
  if v_kr <= 0.000000 or v_kr > 3.000000 then
    raise exception 'silver_kr_correction_factor out of range: %', v_kr;
  end if;

  insert into public.cms_market_tick_config (config_key, fx_markup, cs_correction_factor, silver_kr_correction_factor, updated_at)
  values ('DEFAULT', v_fx, v_cs, v_kr, now())
  on conflict (config_key) do update set
    fx_markup = excluded.fx_markup,
    cs_correction_factor = excluded.cs_correction_factor,
    silver_kr_correction_factor = excluded.silver_kr_correction_factor,
    updated_at = now();

  -- audit log (best-effort)
  begin
    insert into public.cms_audit_log (event, actor_person_id, session_id, memo, payload)
    values (
      'market_tick_config_upsert',
      p_actor_person_id,
      p_session_id,
      p_memo,
      jsonb_build_object(
        'config_key', 'DEFAULT',
        'fx_markup', v_fx,
        'cs_correction_factor', v_cs,
        'silver_kr_correction_factor', v_kr
      )
    );
  exception when others then
    -- ignore
  end;

  return jsonb_build_object(
    'ok', true,
    'config_key', 'DEFAULT',
    'fx_markup', v_fx,
    'cs_correction_factor', v_cs,
    'silver_kr_correction_factor', v_kr
  );
end;
$$;
grant execute on function public.cms_fn_upsert_market_tick_config_v1(numeric, numeric, numeric, uuid, uuid, text) to anon, authenticated;
