-- Fix: ensure calc CTE exists during cost apply
-- Recreate cms_fn_apply_purchase_cost_to_shipment_v1 to avoid "relation calc does not exist" errors.

create or replace function public.cms_fn_apply_purchase_cost_to_shipment_v1(
  p_shipment_id uuid,
  p_mode text default 'PROVISIONAL',             -- PROVISIONAL | RECEIPT | MANUAL
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]'::jsonb,        -- [{shipment_line_id, unit_cost_krw}]
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_force boolean default false                 -- ACTUAL 이미 있더라도 덮어쓸지
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_mode text := upper(coalesce(p_mode,'PROVISIONAL'));
  v_move_id uuid;
  v_updated_actual int := 0;
  v_updated_prov int := 0;
begin
  if p_shipment_id is null then
    raise exception using errcode='P0001', message='shipment_id required';
  end if;

  if jsonb_typeof(coalesce(p_cost_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='cost_lines must be json array';
  end if;

  if v_mode = 'RECEIPT' and p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required when mode=RECEIPT';
  end if;

  -- issue move 찾기(있으면 같이 업데이트)
  select h.move_id into v_move_id
  from public.cms_inventory_move_header h
  where h.ref_doc_type = 'SHIPMENT'
    and h.ref_doc_id = p_shipment_id
    and h.move_type = 'ISSUE'::public.cms_e_inventory_move_type
  order by h.occurred_at desc
  limit 1;

  with inp as (
    select
      nullif((e->>'shipment_line_id')::text,'')::uuid as shipment_line_id,
      nullif((e->>'unit_cost_krw')::text,'')::numeric as unit_cost_krw
    from jsonb_array_elements(coalesce(p_cost_lines,'[]'::jsonb)) e
  ),
  src as (
    select
      sl.shipment_line_id,
      sl.qty,
      sl.master_id,
      i.unit_cost_krw as input_unit_cost,
      m.provisional_unit_cost_krw as master_prov
    from public.cms_shipment_line sl
    left join inp i on i.shipment_line_id = sl.shipment_line_id
    left join public.cms_master_item m on m.master_id = sl.master_id
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      shipment_line_id,
      qty,
      case
        when v_mode in ('RECEIPT','MANUAL') and input_unit_cost is not null then input_unit_cost
        when v_mode = 'PROVISIONAL' and master_prov is not null then master_prov
        when v_mode = 'RECEIPT' and input_unit_cost is null and master_prov is not null then master_prov   -- 일부 누락 fallback
        else null
      end as unit_cost,
      case
        when v_mode in ('RECEIPT','MANUAL') and input_unit_cost is not null then 'ACTUAL'::public.cms_e_cost_status
        when (v_mode = 'PROVISIONAL' and master_prov is not null) then 'PROVISIONAL'::public.cms_e_cost_status
        when (v_mode = 'RECEIPT' and input_unit_cost is null and master_prov is not null) then 'PROVISIONAL'::public.cms_e_cost_status
        else 'PROVISIONAL'::public.cms_e_cost_status
      end as cost_status,
      case
        when v_mode = 'RECEIPT' and input_unit_cost is not null then 'RECEIPT'::public.cms_e_cost_source
        when v_mode = 'MANUAL' and input_unit_cost is not null then 'MANUAL'::public.cms_e_cost_source
        when (master_prov is not null) then 'MASTER'::public.cms_e_cost_source
        else 'NONE'::public.cms_e_cost_source
      end as cost_source,
      case
        when v_mode = 'RECEIPT' and input_unit_cost is not null then p_receipt_id
        else null
      end as receipt_id
    from src
  ),
  upd as (
    update public.cms_shipment_line sl
    set
      purchase_unit_cost_krw = c.unit_cost,
      purchase_total_cost_krw = case when c.unit_cost is null then null else round(c.unit_cost * sl.qty, 0) end,
      purchase_cost_status = c.cost_status,
      purchase_cost_source = c.cost_source,
      purchase_receipt_id = c.receipt_id,
      purchase_cost_trace = coalesce(sl.purchase_cost_trace,'{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'applied_at', now(),
          'mode', v_mode,
          'receipt_id', c.receipt_id,
          'correlation_id', p_correlation_id,
          'note', p_note
        )),
      purchase_cost_finalized_at = case when c.cost_status='ACTUAL' then now() else sl.purchase_cost_finalized_at end,
      purchase_cost_finalized_by = case when c.cost_status='ACTUAL' then p_actor_person_id else sl.purchase_cost_finalized_by end
    from calc c
    where sl.shipment_line_id = c.shipment_line_id
      and (p_force or sl.purchase_cost_status <> 'ACTUAL'::public.cms_e_cost_status)
    returning (case when c.cost_status='ACTUAL' then 1 else 0 end) as is_actual
  )
  select
    coalesce(sum(is_actual),0),
    count(*) - coalesce(sum(is_actual),0)
  into v_updated_actual, v_updated_prov
  from upd;

  -- inventory move line에도 반영(존재할 때)
  if v_move_id is not null then
    with inp as (
      select
        nullif((e->>'shipment_line_id')::text,'')::uuid as shipment_line_id,
        nullif((e->>'unit_cost_krw')::text,'')::numeric as unit_cost_krw
      from jsonb_array_elements(coalesce(p_cost_lines,'[]'::jsonb)) e
    ),
    src as (
      select
        ml.move_line_id,
        ml.qty,
        ml.ref_entity_id as shipment_line_id,
        i.unit_cost_krw as input_unit_cost,
        m.provisional_unit_cost_krw as master_prov
      from public.cms_inventory_move_line ml
      left join inp i on i.shipment_line_id = ml.ref_entity_id
      left join public.cms_shipment_line sl on sl.shipment_line_id = ml.ref_entity_id
      left join public.cms_master_item m on m.master_id = sl.master_id
      where ml.move_id = v_move_id
        and ml.ref_entity_type = 'SHIPMENT_LINE'
        and ml.direction = 'OUT'::public.cms_e_inventory_direction
        and coalesce(ml.is_void,false) = false
    ),
    calc as (
      select
        move_line_id,
        case
          when v_mode in ('RECEIPT','MANUAL') and input_unit_cost is not null then input_unit_cost
          when v_mode = 'PROVISIONAL' and master_prov is not null then master_prov
          when v_mode = 'RECEIPT' and input_unit_cost is null and master_prov is not null then master_prov
          else null
        end as unit_cost,
        case
          when v_mode in ('RECEIPT','MANUAL') and input_unit_cost is not null then 'ACTUAL'::public.cms_e_cost_status
          else 'PROVISIONAL'::public.cms_e_cost_status
        end as cost_status,
        case
          when v_mode = 'RECEIPT' and input_unit_cost is not null then 'RECEIPT'::public.cms_e_cost_source
          when v_mode = 'MANUAL' and input_unit_cost is not null then 'MANUAL'::public.cms_e_cost_source
          when master_prov is not null then 'MASTER'::public.cms_e_cost_source
          else 'NONE'::public.cms_e_cost_source
        end as cost_source,
        case
          when v_mode = 'RECEIPT' and input_unit_cost is not null then p_receipt_id
          else null
        end as receipt_id
      from src
    )
    update public.cms_inventory_move_line ml
    set
      unit_cost_krw = c.unit_cost,
      amount_krw = case when c.unit_cost is null then ml.amount_krw else round(c.unit_cost * ml.qty, 0) end,
      cost_status = c.cost_status,
      cost_source = c.cost_source,
      cost_receipt_id = c.receipt_id,
      cost_snapshot = coalesce(ml.cost_snapshot,'{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'applied_at', now(),
          'mode', v_mode,
          'receipt_id', p_receipt_id,
          'correlation_id', p_correlation_id,
          'note', p_note
        )),
      cost_finalized_at = case when c.cost_status='ACTUAL' then now() else ml.cost_finalized_at end,
      cost_finalized_by = case when c.cost_status='ACTUAL' then p_actor_person_id else ml.cost_finalized_by end
    from calc c
    where ml.move_line_id = c.move_line_id
      and (p_force or ml.cost_status <> 'ACTUAL'::public.cms_e_cost_status);
  end if;

  -- receipt usage link & receipt status
  if p_receipt_id is not null then
    insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note, actor_person_id, correlation_id)
    values (p_receipt_id, 'SHIPMENT_HEADER', p_shipment_id, p_note, p_actor_person_id, p_correlation_id)
    on conflict do nothing;

    if v_move_id is not null then
      insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note, actor_person_id, correlation_id)
      values (p_receipt_id, 'INVENTORY_MOVE_HEADER', v_move_id, p_note, p_actor_person_id, p_correlation_id)
      on conflict do nothing;
    end if;

    update public.cms_receipt_inbox
    set status = 'LINKED'::public.cms_e_receipt_status
    where receipt_id = p_receipt_id;
  end if;

  -- decision log (요약)
  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'SHIPMENT_HEADER',
    p_shipment_id,
    'APPLY_PURCHASE_COST',
    jsonb_build_object('mode', v_mode),
    jsonb_build_object(
      'updated_actual_cnt', v_updated_actual,
      'updated_provisional_cnt', v_updated_prov,
      'receipt_id', p_receipt_id,
      'inventory_move_id', v_move_id,
      'correlation_id', p_correlation_id
    ),
    p_actor_person_id,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'mode', v_mode,
    'receipt_id', p_receipt_id,
    'updated_actual_cnt', v_updated_actual,
    'updated_provisional_cnt', v_updated_prov,
    'inventory_move_id', v_move_id
  );
end $$;

alter function public.cms_fn_apply_purchase_cost_to_shipment_v1(uuid,text,uuid,jsonb,uuid,text,uuid,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_apply_purchase_cost_to_shipment_v1(uuid,text,uuid,jsonb,uuid,text,uuid,boolean)
  to authenticated, service_role;
