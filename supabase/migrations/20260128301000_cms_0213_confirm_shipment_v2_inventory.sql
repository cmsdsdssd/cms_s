set search_path = public, pg_temp;
-- v2: confirm + (optional) emit inventory issue
create or replace function public.cms_fn_confirm_shipment_v2(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_emit jsonb;
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  -- 1) 기존 confirm 실행 (idempotent)
  v_result := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  -- 2) inventory issue emit (idempotent by correlation_id)
  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v1(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_result := v_result
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  return v_result;
end $$;
alter function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid) to authenticated;
