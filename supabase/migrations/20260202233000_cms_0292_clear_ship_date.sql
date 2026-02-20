set search_path = public, pg_temp;
create or replace function public.cms_fn_clear_shipment_ship_date_v1(
  p_shipment_id uuid,
  p_reason text,
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
  v_reason text;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.status <> 'CONFIRMED' then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;

  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null then
    raise exception 'reason required';
  end if;

  update public.cms_shipment_header
  set ship_date = null,
      memo = trim(both from coalesce(memo, '') || case when coalesce(memo, '') = '' then '' else E'\n' end || '[SHIP_DATE_CLEARED] ' || v_reason)
  where shipment_id = p_shipment_id;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'ship_date', null,
    'reason', v_reason,
    'note', p_note
  );
end $$;
alter function public.cms_fn_clear_shipment_ship_date_v1(uuid, text, uuid, text) security definer;
grant execute on function public.cms_fn_clear_shipment_ship_date_v1(uuid, text, uuid, text) to authenticated;
