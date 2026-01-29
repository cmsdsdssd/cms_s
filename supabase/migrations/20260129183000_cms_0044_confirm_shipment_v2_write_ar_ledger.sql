set search_path = public, pg_temp;

-- 0044: confirm_shipment_v2가 AR ledger(SHIPMENT)를 항상 찍도록 보강
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

  v_party_id uuid;
  v_occurred_at timestamptz;
  v_total_sell numeric := 0;
begin
  -- 1) 기존 confirm 실행 (idempotent)
  v_result := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  -- 2) AR ledger 보장 (idempotent)
  select sh.customer_party_id,
         coalesce(sh.confirmed_at, now())
    into v_party_id, v_occurred_at
  from public.cms_shipment_header sh
  where sh.shipment_id = p_shipment_id;

  if v_party_id is null then
    raise exception 'shipment_header not found: %', p_shipment_id;
  end if;

  select coalesce(sum(sl.total_amount_sell_krw), 0)
    into v_total_sell
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id;

  if not exists (
    select 1
    from public.cms_ar_ledger l
    where l.entry_type = 'SHIPMENT'
      and l.shipment_id = p_shipment_id
  ) then
    insert into public.cms_ar_ledger(
      party_id, occurred_at, entry_type, amount_krw,
      shipment_id, memo
    )
    values (
      v_party_id, v_occurred_at, 'SHIPMENT', v_total_sell,
      p_shipment_id, p_note
    );
  end if;

  -- 3) inventory issue emit (idempotent by correlation_id)
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

  -- 디버그용(선택): ledger 보장 여부/금액을 같이 반환
  v_result := v_result
    || jsonb_build_object(
      'ar_ledger_entry_type', 'SHIPMENT',
      'ar_amount_krw', v_total_sell
    );

  return v_result;
end $$;

alter function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid) to authenticated;
