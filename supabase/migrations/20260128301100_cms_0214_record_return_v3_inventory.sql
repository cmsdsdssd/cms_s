set search_path = public, pg_temp;

-- v3: record_return_v2 + (optional) emit inventory receipt
create or replace function public.cms_fn_record_return_v3(
  p_shipment_line_id uuid,
  p_return_qty int,
  p_occurred_at timestamptz,
  p_override_amount_krw numeric default null,
  p_reason text default null,
  p_emit_inventory boolean default true,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_return_id uuid;
  v_emit jsonb;
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  -- 1) 기존 반품 기록
  v_result := public.cms_fn_record_return_v2(
    p_shipment_line_id,
    p_return_qty,
    p_occurred_at,
    p_override_amount_krw,
    p_reason
  );

  v_return_id := nullif(v_result->>'return_line_id','')::uuid;

  -- 2) inventory receipt emit
  if p_emit_inventory and v_return_id is not null then
    v_emit := public.cms_fn_emit_inventory_receipt_from_return_v1(
      v_return_id,
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

alter function public.cms_fn_record_return_v3(uuid,int,timestamptz,numeric,text,boolean,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_record_return_v3(uuid,int,timestamptz,numeric,text,boolean,uuid,text,uuid) to authenticated;
