set search_path = public, pg_temp;
create or replace function public.cms_fn_confirm_store_pickup_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null::uuid,
  p_note text default null::text,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,

  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  update public.cms_shipment_header
  set is_store_pickup = true,
      ship_date = current_date
  where shipment_id = p_shipment_id;

  v_result := public.cms_fn_confirm_shipment_v3_cost_v1(
    p_shipment_id,
    p_actor_person_id,
    p_note,
    p_emit_inventory,
    p_correlation_id,
    p_cost_mode,
    p_receipt_id,
    p_cost_lines,
    p_force
  );

  return v_result;
end $$;
alter function public.cms_fn_confirm_store_pickup_v1(uuid, uuid, text, boolean, uuid, text, uuid, jsonb, boolean) security definer;
grant execute on function public.cms_fn_confirm_store_pickup_v1(uuid, uuid, text, boolean, uuid, text, uuid, jsonb, boolean)
  to anon, authenticated, service_role;
