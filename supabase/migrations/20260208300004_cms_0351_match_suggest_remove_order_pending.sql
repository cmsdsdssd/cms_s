create or replace function public.cms_fn_receipt_line_match_suggest_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_limit int default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor_party_id uuid;
  v_model_name text;
  v_size text;
  v_color text;
  v_material public.cms_e_material_code;
  v_seq int;
  v_customer_code text;

  v_norm_model text;
  v_norm_customer text;

  v_candidates jsonb := '[]'::jsonb;
  v_confirmed record;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null then
    raise exception 'receipt_id and receipt_line_uuid required';
  end if;
  if p_limit is null or p_limit <= 0 then
    p_limit := 3;
  end if;

  select * into v_confirmed
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'already_confirmed', true,
      'confirmed', jsonb_build_object(
        'order_line_id', v_confirmed.order_line_id,
        'shipment_id', v_confirmed.shipment_id,
        'shipment_line_id', v_confirmed.shipment_line_id,
        'confirmed_at', v_confirmed.confirmed_at,
        'match_score', v_confirmed.match_score,
        'match_reason', v_confirmed.match_reason
      ),
      'candidates', '[]'::jsonb
    );
  end if;

  select vendor_party_id, model_name, size, color, material_code, vendor_seq_no, customer_factory_code
    into v_vendor_party_id, v_model_name, v_size, v_color, v_material, v_seq, v_customer_code
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid;

  if not found then
    raise exception 'receipt line not found: receipt_id=%, line=%', p_receipt_id, p_receipt_line_uuid;
  end if;

  if v_vendor_party_id is null then
    raise exception 'receipt vendor_party_id required for matching (receipt_id=%)', p_receipt_id;
  end if;

  v_norm_model := public.cms_fn_norm_token_v1(v_model_name);
  v_norm_customer := public.cms_fn_norm_token_v1(v_customer_code);

  with orders as (
    select
      ol.order_line_id,
      ol.customer_party_id,
      cp.mask_code as customer_mask_code,
      ol.model_name,
      ol.size,
      ol.color,
      ol.material_code,
      ol.status,
      ol.sent_to_vendor_at,
      ol.created_at,
      public.cms_fn_infer_vendor_seq_no_from_order_v1(ol.vendor_seq_no, ol.memo, ol.suffix) as vendor_seq_no,
      public.cms_fn_norm_token_v1(ol.model_name) as norm_model,
      public.cms_fn_norm_token_v1(cp.mask_code) as norm_customer_code
    from public.cms_order_line ol
    left join public.cms_party cp on cp.party_id = ol.customer_party_id
    left join public.cms_factory_po po on po.po_id = ol.factory_po_id
    where po.vendor_party_id = v_vendor_party_id
      and ol.status in (
        'SENT_TO_VENDOR'::public.cms_e_order_status,
        'WAITING_INBOUND'::public.cms_e_order_status,
        'READY_TO_SHIP'::public.cms_e_order_status
      )
      and coalesce(ol.sent_to_vendor_at, ol.created_at) >= now() - interval '60 days'
      and not exists (
        select 1
        from public.cms_receipt_line_match m
        where m.order_line_id = ol.order_line_id
          and m.status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
      )
  ),
  scored as (
    select
      o.*,
      (
        (case
          when v_norm_model <> '' and o.norm_model = v_norm_model then 60
          when v_norm_model <> '' and (o.norm_model like v_norm_model || '%' or v_norm_model like o.norm_model || '%') then 45
          when v_norm_model <> '' and (o.norm_model like '%'||v_norm_model||'%' or v_norm_model like '%'||o.norm_model||'%') then 30
          else 0 end)
        +
        (case
          when v_norm_customer <> '' and o.norm_customer_code <> '' and o.norm_customer_code = v_norm_customer then 25
          when v_norm_customer <> '' and o.norm_customer_code <> ''
            and (o.norm_customer_code like v_norm_customer || '%' or v_norm_customer like o.norm_customer_code || '%') then 18
          when v_norm_customer <> '' and o.norm_customer_code <> ''
            and (o.norm_customer_code like '%'||v_norm_customer||'%' or v_norm_customer like '%'||o.norm_customer_code||'%') then 10
          else 0 end)
        +
        (case when v_seq is not null and o.vendor_seq_no is not null and o.vendor_seq_no = v_seq then 20 else 0 end)
        +
        (case when v_material is not null and o.material_code is not null and o.material_code = v_material then 10 else 0 end)
        +
        (case when v_size is not null and o.size is not null and o.size = v_size then 5 else 0 end)
        +
        (case when v_color is not null and o.color is not null and upper(o.color)=upper(v_color) then 5 else 0 end)
      )::numeric as match_score,
      jsonb_build_object(
        'model_name', jsonb_build_object(
          'receipt', v_model_name,
          'order', o.model_name,
          'exact', (v_norm_model <> '' and o.norm_model = v_norm_model)
        ),
        'customer_factory_code', jsonb_build_object(
          'receipt', v_customer_code,
          'order_customer_mask_code', o.customer_mask_code,
          'match', (v_norm_customer <> '' and o.norm_customer_code <> '' and o.norm_customer_code = v_norm_customer)
        ),
        'vendor_seq_no', jsonb_build_object(
          'receipt', v_seq,
          'order', o.vendor_seq_no,
          'match', (v_seq is not null and o.vendor_seq_no is not null and o.vendor_seq_no = v_seq)
        ),
        'material_code_match', (v_material is not null and o.material_code is not null and o.material_code = v_material),
        'size_match', (v_size is not null and o.size is not null and o.size = v_size),
        'color_match', (v_color is not null and o.color is not null and upper(o.color)=upper(v_color))
      ) as match_reason
    from orders o
    where
      (v_norm_model = ''
        or o.norm_model like '%'||v_norm_model||'%'
        or v_norm_model like '%'||o.norm_model||'%')
      and (v_norm_customer = ''
        or o.norm_customer_code like '%'||v_norm_customer||'%'
        or v_norm_customer like '%'||o.norm_customer_code||'%')
  ),
  topn as (
    select *
    from scored
    order by match_score desc, sent_to_vendor_at desc nulls last, created_at desc
    limit p_limit
  ),
  upserted as (
    insert into public.cms_receipt_line_match(
      receipt_id, receipt_line_uuid, order_line_id,
      status, match_score, match_reason, suggested_at
    )
    select
      p_receipt_id,
      p_receipt_line_uuid,
      t.order_line_id,
      'SUGGESTED'::public.cms_e_receipt_line_match_status,
      t.match_score,
      t.match_reason,
      now()
    from topn t
    on conflict (receipt_id, receipt_line_uuid, order_line_id) do update
      set status = 'SUGGESTED'::public.cms_e_receipt_line_match_status,
          match_score = excluded.match_score,
          match_reason = excluded.match_reason,
          suggested_at = now(),
          updated_at = now()
    returning order_line_id
  )
  update public.cms_receipt_line_match m
    set status = 'CLEARED'::public.cms_e_receipt_line_match_status,
        updated_at = now()
  where m.receipt_id = p_receipt_id
    and m.receipt_line_uuid = p_receipt_line_uuid
    and m.status = 'SUGGESTED'::public.cms_e_receipt_line_match_status
    and m.order_line_id not in (select order_line_id from upserted);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_line_id', m.order_line_id,
        'customer_party_id', ol.customer_party_id,
        'customer_mask_code', cp.mask_code,
        'customer_name', cp.name,
        'model_name', ol.model_name,
        'size', ol.size,
        'color', ol.color,
        'material_code', ol.material_code,
        'is_plated', ol.is_plated,
        'plating_color_code', ol.plating_color_code,
        'status', ol.status,
        'vendor_seq_no', public.cms_fn_infer_vendor_seq_no_from_order_v1(ol.vendor_seq_no, ol.memo, ol.suffix),
        'memo', ol.memo,
        'match_score', m.match_score,
        'match_reason', m.match_reason
      )
      order by m.match_score desc, m.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_candidates
  from public.cms_receipt_line_match m
  left join public.cms_order_line ol on ol.order_line_id = m.order_line_id
  left join public.cms_party cp on cp.party_id = ol.customer_party_id
  where m.receipt_id = p_receipt_id
    and m.receipt_line_uuid = p_receipt_line_uuid
    and m.status = 'SUGGESTED'::public.cms_e_receipt_line_match_status;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'candidates', v_candidates
  );
end $$;

alter function public.cms_fn_receipt_line_match_suggest_v1(uuid,uuid,int)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_receipt_line_match_suggest_v1(uuid,uuid,int)
  to authenticated, service_role;
