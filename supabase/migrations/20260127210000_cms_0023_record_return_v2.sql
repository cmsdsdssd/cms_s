-- 0023: record return v2 (remaining qty enforcement)

set search_path = public, pg_temp;
create or replace function cms_fn_record_return_v2(
  p_shipment_line_id uuid,
  p_return_qty int,
  p_occurred_at timestamptz,
  p_override_amount_krw numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
as $$
declare
  r_sl record;
  v_auto numeric;
  v_final numeric;
  v_return_id uuid;
  v_returned_before int;
  v_remaining int;
  v_remaining_after int;
begin
  if p_return_qty is null or p_return_qty <= 0 then
    raise exception 'return_qty must be > 0';
  end if;

  select sl.*, sh.customer_party_id
  into r_sl
  from cms_shipment_line sl
  join cms_shipment_header sh on sh.shipment_id = sl.shipment_id
  where sl.shipment_line_id = p_shipment_line_id
  for update;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  if r_sl.qty is null or r_sl.qty <= 0 then
    raise exception 'invalid shipment_line.qty for %', p_shipment_line_id;
  end if;

  v_returned_before := coalesce(
    (select sum(return_qty)::int from cms_return_line where shipment_line_id = p_shipment_line_id),
    0
  );
  v_remaining := r_sl.qty - v_returned_before;

  if p_return_qty > v_remaining then
    raise exception 'return_qty exceeds remaining qty (remaining=%) for %', v_remaining, p_shipment_line_id;
  end if;

  v_auto := round((coalesce(r_sl.total_amount_sell_krw, 0) / r_sl.qty) * p_return_qty, 0);
  v_final := round(coalesce(p_override_amount_krw, v_auto), 0);
  v_remaining_after := v_remaining - p_return_qty;

  insert into cms_return_line(
    party_id, shipment_line_id, return_qty,
    auto_return_amount_krw, final_return_amount_krw,
    reason, occurred_at
  )
  values (
    r_sl.customer_party_id, p_shipment_line_id, p_return_qty,
    v_auto, v_final,
    p_reason, p_occurred_at
  )
  returning return_line_id into v_return_id;

  insert into cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw,
    shipment_id, shipment_line_id, return_line_id, memo
  )
  values (
    r_sl.customer_party_id, p_occurred_at, 'RETURN', -v_final,
    r_sl.shipment_id, p_shipment_line_id, v_return_id, p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'return_line_id', v_return_id,
    'auto_amount_krw', v_auto,
    'final_amount_krw', v_final,
    'remaining_qty', v_remaining_after
  );
end $$;
alter function public.cms_fn_record_return_v2(uuid,int,timestamptz,numeric,text)
  security definer set search_path=public,pg_temp;
grant execute on function public.cms_fn_record_return_v2(uuid,int,timestamptz,numeric,text) to authenticated;
