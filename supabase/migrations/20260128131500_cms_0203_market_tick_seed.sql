-- 20260128134000_cms_0203_market_tick_seed_v2.sql
-- Seed/demo generator v2 (uses role mapping).

set search_path = public;
create or replace function public.cms_fn_seed_market_tick_demo_v1(
  p_actor_person_id uuid,
  p_correlation_id uuid,
  p_reset boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_now_kst timestamp := timezone('Asia/Seoul', now());
  v_day_start_kst timestamp;
  v_observed_at timestamptz;
  v_gold numeric;
  v_silver numeric;
  v_ins int := 0;
  d int;
  hh int;
  v_hours int[] := array[9, 12, 15];
  v_gold_symbol public.cms_e_market_symbol;
  v_silver_symbol public.cms_e_market_symbol;
begin
  -- require role mapping
  v_gold_symbol := public.cms_fn_get_market_symbol_by_role_v1('GOLD');
  v_silver_symbol := public.cms_fn_get_market_symbol_by_role_v1('SILVER');

  if coalesce(p_reset, false) = true then
    update public.cms_market_tick
       set is_void = true,
           void_reason = 'DEMO_RESET',
           voided_at = now(),
           voided_by_person_id = p_actor_person_id,
           correlation_id = v_corr,
           updated_at = now()
     where is_void = false
       and coalesce(source, 'MANUAL') = 'DEMO';
  end if;

  for d in 0..6 loop
    v_day_start_kst := date_trunc('day', v_now_kst) - make_interval(days => d);

    v_gold := 110000 + (6 - d) * 800;
    v_silver := 1500 + (6 - d) * 25;

    foreach hh in array v_hours loop
      v_observed_at := (v_day_start_kst + make_interval(hours => hh)) at time zone 'Asia/Seoul';

      perform public.cms_fn_upsert_market_tick_v1(
        v_gold_symbol, v_gold, v_observed_at, 'DEMO',
        jsonb_build_object('seed', true, 'tz', 'Asia/Seoul'),
        p_actor_person_id, v_corr, 'seed demo'
      );
      v_ins := v_ins + 1;

      perform public.cms_fn_upsert_market_tick_v1(
        v_silver_symbol, v_silver, v_observed_at, 'DEMO',
        jsonb_build_object('seed', true, 'tz', 'Asia/Seoul'),
        p_actor_person_id, v_corr, 'seed demo'
      );
      v_ins := v_ins + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'correlation_id', v_corr,
    'inserted_or_upserted', v_ins,
    'latest', (select row_to_json(t) from public.cms_v_market_tick_latest_gold_silver_v1 t)
  );
end;
$$;
