set search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- cms_1209_operational_snapshot_retention_addonly
-- Keep deterministic replay buffers short-lived while preserving current SoT.
-- -----------------------------------------------------------------------------

create or replace function public.cleanup_operational_snapshot_history_v1(
  p_pricing_snapshot_retention_days integer default 3,
  p_channel_price_snapshot_retention_days integer default 7,
  p_option_apply_log_retention_days integer default 14
)
returns jsonb
language plpgsql
as $$
declare
  v_pricing_snapshot_deleted integer := 0;
  v_channel_price_snapshot_deleted integer := 0;
  v_option_apply_log_deleted integer := 0;
begin
  with deleted as (
    delete from public.pricing_snapshot
    where computed_at < now() - make_interval(days => greatest(p_pricing_snapshot_retention_days, 1))
    returning 1
  )
  select count(*) into v_pricing_snapshot_deleted from deleted;

  with deleted as (
    delete from public.channel_price_snapshot
    where fetched_at < now() - make_interval(days => greatest(p_channel_price_snapshot_retention_days, 1))
    returning 1
  )
  select count(*) into v_channel_price_snapshot_deleted from deleted;

  with deleted as (
    delete from public.channel_option_apply_log_v1
    where created_at < now() - make_interval(days => greatest(p_option_apply_log_retention_days, 1))
    returning 1
  )
  select count(*) into v_option_apply_log_deleted from deleted;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'pricing_snapshot', v_pricing_snapshot_deleted,
      'channel_price_snapshot', v_channel_price_snapshot_deleted,
      'channel_option_apply_log_v1', v_option_apply_log_deleted
    ),
    'retention_days', jsonb_build_object(
      'pricing_snapshot', p_pricing_snapshot_retention_days,
      'channel_price_snapshot', p_channel_price_snapshot_retention_days,
      'channel_option_apply_log_v1', p_option_apply_log_retention_days
    )
  );
end;
$$;

comment on function public.cleanup_operational_snapshot_history_v1(integer, integer, integer)
  is '운영 정합성용 current_state는 유지하고, 단기 재현용 snapshot/apply log만 짧게 정리한다.';
