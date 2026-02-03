set search_path = public, pg_temp;

create or replace function public.cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
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
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
  v_confirm jsonb;
  v_cost jsonb;
  v_mode text := upper(coalesce(p_cost_mode,'PROVISIONAL'));
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  update public.cms_shipment_line
  set
    manual_labor_krw = case
      when coalesce(manual_labor_krw, 0) > 0 then manual_labor_krw
      else coalesce(base_labor_krw, 0) + coalesce(extra_labor_krw, 0)
    end,
    labor_total_sell_krw = case
      when coalesce(manual_labor_krw, 0) > 0 then manual_labor_krw
      else coalesce(base_labor_krw, 0) + coalesce(extra_labor_krw, 0)
    end,
    total_amount_sell_krw = coalesce(material_amount_sell_krw, 0) + case
      when coalesce(manual_labor_krw, 0) > 0 then manual_labor_krw
      else coalesce(base_labor_krw, 0) + coalesce(extra_labor_krw, 0)
    end
  where shipment_id = p_shipment_id
    and (
      (coalesce(manual_labor_krw, 0) = 0 and (coalesce(base_labor_krw, 0) + coalesce(extra_labor_krw, 0)) > 0)
      or (coalesce(manual_labor_krw, 0) > 0 and coalesce(labor_total_sell_krw, 0) = 0)
    );

  v_confirm := public.cms_fn_confirm_shipment_v2(
    p_shipment_id,
    p_actor_person_id,
    p_note,
    p_emit_inventory,
    v_corr
  );

  perform public.cms_fn_apply_repair_fee_to_shipment_v1(p_shipment_id, p_note);

  if v_mode <> 'SKIP' then
    v_cost := public.cms_fn_apply_purchase_cost_to_shipment_v1(
      p_shipment_id,
      v_mode,
      p_receipt_id,
      coalesce(p_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      v_corr,
      p_force
    );
  end if;

  perform public.cms_fn_apply_silver_factor_fix_v1(p_shipment_id);

  if v_mode <> 'SKIP' then
    return v_confirm
      || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm
    || jsonb_build_object('correlation_id', v_corr);
end $$;

alter function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v3_cost_v1(uuid,uuid,text,boolean,uuid,text,uuid,jsonb,boolean)
  to authenticated;
