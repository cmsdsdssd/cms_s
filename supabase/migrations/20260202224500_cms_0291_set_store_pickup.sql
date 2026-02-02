set search_path = public, pg_temp;

create or replace function public.cms_fn_set_shipment_store_pickup_v1(
  p_shipment_id uuid,
  p_is_store_pickup boolean,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  update public.cms_shipment_header
  set is_store_pickup = p_is_store_pickup
  where shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'is_store_pickup', p_is_store_pickup,
    'note', p_note
  );
end $$;

alter function public.cms_fn_set_shipment_store_pickup_v1(uuid, boolean, uuid, text) security definer;
grant execute on function public.cms_fn_set_shipment_store_pickup_v1(uuid, boolean, uuid, text) to authenticated;
