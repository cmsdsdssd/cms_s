set search_path = public, pg_temp;

-- cms_0267: Fix apply RPC (shipment_id alias bug) + write allocation back to cms_receipt_usage

create or replace function public.cms_fn_apply_receipt_pricing_snapshot_v1(
  p_receipt_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_force boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_snap public.cms_receipt_pricing_snapshot%rowtype;
  v_total_krw numeric;
  v_fx numeric;

  v_ship_ids uuid[];
  v_ship_id uuid;

  v_basis numeric;
  v_total_basis numeric := 0;

  v_remaining_krw numeric;
  v_remaining_basis numeric;
  v_alloc_krw numeric;

  v_cost_lines jsonb;
  v_apply_result jsonb;

  v_ship_cnt int := 0;
  v_line_cnt int := 0;

  v_allocations jsonb := '[]'::jsonb;
  v_applied_at timestamptz := now();

  v_alloc_original numeric;
  v_currency text;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select * into v_snap
  from public.cms_receipt_pricing_snapshot s
  where s.receipt_id = p_receipt_id;

  if v_snap.receipt_id is null then
    raise exception using errcode='P0001', message='pricing snapshot not found (save first)';
  end if;

  v_currency := upper(coalesce(v_snap.currency_code, 'KRW'));
  v_fx := v_snap.fx_rate_krw_per_unit;

  v_total_krw := coalesce(
    v_snap.total_amount_krw,
    case when v_currency='KRW' then v_snap.total_amount else null end
  );

  if v_total_krw is null or v_total_krw <= 0 then
    raise exception using errcode='P0001', message='total_amount_krw is required (save total amount first)';
  end if;

  if v_snap.applied_at is not null and not p_force then
    raise exception using errcode='P0001', message='already applied (use force=true to re-apply)';
  end if;

  -- ✅ linked shipments (avoid "shipment_id" alias issues by using sid everywhere)
  select array_agg(distinct sid order by sid::text)
    into v_ship_ids
  from (
    select
      case
        when u.entity_type='SHIPMENT_HEADER' then u.entity_id
        when u.entity_type='SHIPMENT_LINE' then sl.shipment_id
        else null
      end as sid
    from public.cms_receipt_usage u
    left join public.cms_shipment_line sl
      on sl.shipment_line_id = u.entity_id
     and u.entity_type='SHIPMENT_LINE'
    where u.receipt_id = p_receipt_id
      and u.entity_type in ('SHIPMENT_HEADER','SHIPMENT_LINE')
  ) t
  where sid is not null;

  if v_ship_ids is null or array_length(v_ship_ids,1) is null then
    raise exception using errcode='P0001', message='no linked shipments for this receipt';
  end if;

  -- total basis across shipments
  foreach v_ship_id in array v_ship_ids loop
    select
      case
        when coalesce(sum(sl.total_amount_cost_krw),0) > 0 then coalesce(sum(sl.total_amount_cost_krw),0)
        when coalesce(sum(sl.total_amount_sell_krw),0) > 0 then coalesce(sum(sl.total_amount_sell_krw),0)
        when coalesce(sum(sl.qty),0) > 0 then coalesce(sum(sl.qty),0)
        else 1
      end
      into v_basis
    from public.cms_shipment_line sl
    where sl.shipment_id = v_ship_id;

    v_total_basis := v_total_basis + coalesce(v_basis,0);
  end loop;

  if v_total_basis <= 0 then
    raise exception using errcode='P0001', message='cannot compute allocation basis (total_basis=0)';
  end if;

  v_remaining_krw := v_total_krw;
  v_remaining_basis := v_total_basis;

  -- allocate per shipment (ordered in v_ship_ids)
  foreach v_ship_id in array v_ship_ids loop
    -- basis for this shipment
    select
      case
        when coalesce(sum(sl.total_amount_cost_krw),0) > 0 then coalesce(sum(sl.total_amount_cost_krw),0)
        when coalesce(sum(sl.total_amount_sell_krw),0) > 0 then coalesce(sum(sl.total_amount_sell_krw),0)
        when coalesce(sum(sl.qty),0) > 0 then coalesce(sum(sl.qty),0)
        else 1
      end
      into v_basis
    from public.cms_shipment_line sl
    where sl.shipment_id = v_ship_id;

    if v_remaining_basis <= 0 then
      v_alloc_krw := v_remaining_krw;
    else
      v_alloc_krw := round(v_remaining_krw * v_basis / v_remaining_basis, 0);
    end if;

    v_remaining_krw := v_remaining_krw - v_alloc_krw;
    v_remaining_basis := v_remaining_basis - v_basis;

    -- build cost_lines (per line) inside this shipment
    with line_src as (
      select
        sl.shipment_line_id,
        sl.qty,
        case
          when sl.total_amount_cost_krw > 0 then sl.total_amount_cost_krw
          when sl.total_amount_sell_krw > 0 then sl.total_amount_sell_krw
          when sl.qty > 0 then sl.qty::numeric
          else 1
        end as basis
      from public.cms_shipment_line sl
      where sl.shipment_id = v_ship_id
    ),
    line_basis as (
      select coalesce(sum(basis),0) as total_basis from line_src
    ),
    line_alloc as (
      select
        s.shipment_line_id,
        s.qty,
        s.basis,
        lb.total_basis,
        case
          when lb.total_basis <= 0 then 0
          else round(v_alloc_krw * s.basis / lb.total_basis, 0)
        end as alloc_total_krw
      from line_src s
      cross join line_basis lb
    ),
    line_fix as (
      select
        a.*,
        (v_alloc_krw - coalesce(sum(a.alloc_total_krw) over (),0)) as delta
      from line_alloc a
    ),
    line_final as (
      select
        shipment_line_id,
        qty,
        case
          when shipment_line_id = (
            select shipment_line_id
            from line_fix
            order by basis desc, shipment_line_id::text asc
            limit 1
          )
          then alloc_total_krw + delta
          else alloc_total_krw
        end as alloc_total_krw
      from line_fix
    )
    select jsonb_agg(
      jsonb_build_object(
        'shipment_line_id', shipment_line_id,
        'unit_cost_krw', case when qty > 0 then (alloc_total_krw / qty::numeric) else null end
      )
      order by shipment_line_id::text
    )
    into v_cost_lines
    from line_final;

    v_ship_cnt := v_ship_cnt + 1;
    select count(*) into v_line_cnt from public.cms_shipment_line sl where sl.shipment_id = v_ship_id;
    v_line_cnt := coalesce(v_line_cnt,0);

    -- apply to shipment (this sets purchase_receipt_id when mode=RECEIPT and unit_cost provided)
    v_apply_result := public.cms_fn_apply_purchase_cost_to_shipment_v1(
      v_ship_id,
      'RECEIPT',
      p_receipt_id,
      coalesce(v_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      p_correlation_id,
      p_force
    );

    -- write allocation back to receipt_usage for SHIPMENT_HEADER links
    if v_currency = 'CNY' and v_fx is not null and v_fx > 0 then
      v_alloc_original := round(v_alloc_krw / v_fx, 2);
    else
      v_alloc_original := v_alloc_krw;
    end if;

    update public.cms_receipt_usage u
    set
      allocated_amount_original = v_alloc_original,
      allocated_amount_krw = v_alloc_krw,
      allocation_method = 'BASIS_COST',
      allocation_note = coalesce(p_note,'') || case when p_note is null then '' else ' ' end || ('[corr:' || p_correlation_id::text || ']')
    where u.receipt_id = p_receipt_id
      and u.entity_type = 'SHIPMENT_HEADER'
      and u.entity_id = v_ship_id;

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'shipment_id', v_ship_id,
        'basis', v_basis,
        'allocated_krw', v_alloc_krw,
        'allocated_original', v_alloc_original,
        'line_count', v_line_cnt,
        'apply_result', v_apply_result
      ))
    );
  end loop;

  update public.cms_receipt_pricing_snapshot
  set
    applied_at = v_applied_at,
    applied_by = p_actor_person_id,
    allocation_json = jsonb_strip_nulls(jsonb_build_object(
      'total_amount_krw', v_total_krw,
      'total_basis', v_total_basis,
      'shipments', v_allocations,
      'applied_at', v_applied_at,
      'correlation_id', p_correlation_id,
      'note', p_note
    )),
    meta = coalesce(meta,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'last_apply_at', v_applied_at,
      'last_apply_correlation_id', p_correlation_id
    )),
    updated_at = now()
  where receipt_id = p_receipt_id;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'total_amount_krw', v_total_krw,
    'shipment_count', v_ship_cnt,
    'allocations', v_allocations
  ));
end $$;

alter function public.cms_fn_apply_receipt_pricing_snapshot_v1(uuid,uuid,text,uuid,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_apply_receipt_pricing_snapshot_v1(uuid,uuid,text,uuid,boolean)
  to anon, authenticated, service_role;
