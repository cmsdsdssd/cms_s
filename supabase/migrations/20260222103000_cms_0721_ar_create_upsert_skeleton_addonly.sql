-- cms_0721: AR create upsert path skeleton (add-only)

begin;

create or replace function public.cms_fn_ar_can_use_upsert_path_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_unique_invoice_idx boolean := false;
  v_has_shipment boolean := false;
  v_dup_for_shipment int := 0;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  select exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'cms_ar_invoice'
      and i.indexname = 'idx_cms_ar_invoice_unique_shipment_line'
  )
  into v_has_unique_invoice_idx;

  select exists (
    select 1
    from public.cms_shipment_header sh
    where sh.shipment_id = p_shipment_id
  )
  into v_has_shipment;

  select count(*)
  into v_dup_for_shipment
  from (
    select ai.shipment_line_id
    from public.cms_ar_invoice ai
    where ai.shipment_id = p_shipment_id
      and ai.shipment_line_id is not null
    group by ai.shipment_line_id
    having count(*) > 1
  ) d;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'shipment_exists', v_has_shipment,
    'has_unique_invoice_index', v_has_unique_invoice_idx,
    'duplicate_invoice_line_count_for_shipment', v_dup_for_shipment,
    'can_use_upsert_path', (v_has_shipment and v_has_unique_invoice_idx and v_dup_for_shipment = 0)
  );
end;
$$;

create or replace function public.cms_fn_ar_create_from_shipment_confirm_upsert_skeleton_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gate jsonb;
begin
  if p_shipment_id is null then
    raise exception 'shipment_id required';
  end if;

  v_gate := public.cms_fn_ar_can_use_upsert_path_v1(p_shipment_id);

  -- Skeleton only: keep current production path unchanged.
  -- Final implementation should replace not-exists insert with
  -- insert .. on conflict (shipment_line_id) do update once uniqueness is enforced.
  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'mode', 'SKELETON',
    'gate', v_gate,
    'next', 'implement full UPSERT path and switch confirm chain after validation'
  );
end;
$$;

grant execute on function public.cms_fn_ar_can_use_upsert_path_v1(uuid) to authenticated, service_role;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_upsert_skeleton_v1(uuid) to authenticated, service_role;

commit;
