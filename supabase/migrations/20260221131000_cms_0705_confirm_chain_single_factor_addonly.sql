-- cms_0705: confirm chain single-factor alignment (add-only)

begin;

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
  v_emit uuid;
  v_already_confirmed_at timestamptz;
begin
  select confirmed_at
    into v_already_confirmed_at
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if v_already_confirmed_at is not null and not coalesce(p_force, false) then
    raise exception using
      errcode = 'P0001',
      message = format('shipment already confirmed: %s (forward-only guard; use p_force=true to override)', p_shipment_id);
  end if;

  v_confirm := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

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

  begin
    perform public.cms_fn_apply_unit_pricing_floor_v1(p_shipment_id, p_actor_person_id, p_note);
  exception when undefined_function then
    null;
  end;

  perform public.cms_fn_apply_rule_rounding_by_master_unit_pricing_v1(p_shipment_id, p_actor_person_id, p_note);
  perform public.cms_fn_sync_repair_line_sell_totals_v1(p_shipment_id, p_note);
  perform public.cms_fn_sync_ar_ledger_from_shipment_v1(p_shipment_id, p_note);
  perform public.cms_fn_verify_shipment_ar_consistency_v1(p_shipment_id);
  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
      p_actor_person_id,
      p_note,
      v_corr
    );

    v_confirm := v_confirm
      || jsonb_build_object(
        'inventory_emit', v_emit,
        'inventory_correlation_id', v_corr
      );
  end if;

  if v_mode <> 'SKIP' then
    return v_confirm || jsonb_build_object('purchase_cost', v_cost, 'correlation_id', v_corr);
  end if;

  return v_confirm || jsonb_build_object('correlation_id', v_corr);
end $$;

commit;
