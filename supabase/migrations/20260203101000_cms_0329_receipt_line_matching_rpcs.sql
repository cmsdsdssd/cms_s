set search_path = public, pg_temp;

-- =========================================================
-- Receipt Line Matching (Workbench) - RPCs
--
-- - cms_fn_receipt_line_match_suggest_v1: propose top N order lines
-- - cms_fn_receipt_line_match_confirm_v1: confirm match + create shipment draft immediately
--
-- SoT(진실의 원천) 관련 (가이드 반영)
--   - 이 RPC들은 결제 SoT를 생성/수정하지 않는다.
--   - shipment draft 생성은 "근거 링크"를 만들 뿐이며,
--     AR/AP 잔액/완납 판정은 기존 alloc/consume 로그에서 파생되는 뷰를 SoT로 유지한다.
--
-- Matching rules (V1):
--  - Candidate pool: same vendor, last 60 days, status in WAITING_INBOUND/READY_TO_SHIP.
--  - Score priority:
--      1) model_name (highest)
--      2) customer factory code (receipt line code) == order.customer mask_code
--      3) vendor_seq_no (memo prefix '/12/' or vendor_seq_no)
--      4) material_code, size, color (lower)
--
-- Weight check (warn only, never blocks):
--  - 기준 Weight = (cms_master_item.weight_default_g - cms_master_item.deduction_weight_default_g)
--  - abs(selected_weight - 기준Weight) / 기준Weight > 10% => warn=true
--
-- Idempotency:
--  - receipt_id + receipt_line_uuid 가 이미 CONFIRMED 상태면
--    동일 order_line_id 요청은 기존 shipment_id/line_id를 반환 (중복 draft 방지)
-- =========================================================

-- Normalize tokens for matching (A-Z/0-9 only)
create or replace function public.cms_fn_norm_token_v1(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(coalesce(p_text, '')), '[^A-Z0-9]+', '', 'g');
$$;

-- Backward compatible alias (kept because some code may call it)
create or replace function public.cms_fn_norm_model_token_v1(p_text text)
returns text
language sql
immutable
as $$
  select public.cms_fn_norm_token_v1(p_text);
$$;

-- Infer vendor sequence number from order line fields
-- Priority: order.vendor_seq_no > memo prefix '/12/' > memo prefix '/12' > numeric suffix
create or replace function public.cms_fn_infer_vendor_seq_no_from_order_v1(
  p_vendor_seq_no int,
  p_memo text,
  p_suffix text
)
returns int
language sql
immutable
as $$
  select coalesce(
    p_vendor_seq_no,
    nullif(substring(coalesce(p_memo, '') from '^/(\d{1,4})/'), '')::int,
    nullif(substring(coalesce(p_memo, '') from '^/(\d{1,4})'), '')::int,
    nullif(regexp_replace(coalesce(p_suffix, ''), '[^0-9]+', '', 'g'), '')::int
  );
$$;

-- =========================================================
-- Suggest candidates (top N)
-- =========================================================
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

  -- If already confirmed, return that (idempotent / no re-suggest)
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
        (case when v_norm_customer <> '' and o.norm_customer_code <> '' and o.norm_customer_code = v_norm_customer then 25 else 0 end)
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
  -- clear previous suggestions not in current topN
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
        'order_line_id', t.order_line_id,
        'customer_party_id', t.customer_party_id,
        'customer_mask_code', t.customer_mask_code,
        'model_name', t.model_name,
        'size', t.size,
        'color', t.color,
        'material_code', t.material_code,
        'status', t.status,
        'vendor_seq_no', t.vendor_seq_no,
        'match_score', t.match_score,
        'match_reason', t.match_reason
      )
      order by t.match_score desc
    ),
    '[]'::jsonb
  )
  into v_candidates
  from topn t;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'already_confirmed', false,
    'candidates', v_candidates
  );
end $$;

-- =========================================================
-- Confirm match -> create shipment draft immediately
-- =========================================================
create or replace function public.cms_fn_receipt_line_match_confirm_v1(
  p_receipt_id uuid,
  p_receipt_line_uuid uuid,
  p_order_line_id uuid,
  p_selected_weight_g numeric default null,
  p_selected_material_code public.cms_e_material_code default null,
  p_selected_factory_labor_basic_cost_krw numeric default null,
  p_selected_factory_labor_other_cost_krw numeric default null,
  p_selected_factory_total_cost_krw numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;

  v_vendor_party_id uuid;
  v_factory_weight numeric;
  v_factory_basic numeric;
  v_factory_other numeric;
  v_factory_total numeric;
  v_receipt_material public.cms_e_material_code;
  v_receipt_model text;
  v_receipt_seq int;
  v_receipt_customer_code text;

  v_order record;
  v_master record;

  v_selected_weight numeric;
  v_selected_material public.cms_e_material_code;
  v_basic_cost numeric;
  v_other_cost numeric;
  v_total_amount numeric;

  v_base_diff numeric;
  v_extra_diff numeric;
  v_base_sell numeric;
  v_extra_sell numeric;

  v_master_effective_weight numeric;
  v_weight_warn boolean := false;
  v_weight_deviation_pct numeric := null;

  v_shipment_id uuid;
  v_shipment_line_id uuid;

  v_overridden jsonb := '{}'::jsonb;
begin
  if p_receipt_id is null or p_receipt_line_uuid is null or p_order_line_id is null then
    raise exception 'receipt_id, receipt_line_uuid, order_line_id required';
  end if;

  -- Idempotency: if already confirmed, return existing (no duplicate shipment draft)
  select * into v_existing
  from public.cms_receipt_line_match
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'CONFIRMED'::public.cms_e_receipt_line_match_status
  limit 1;

  if found then
    if v_existing.order_line_id <> p_order_line_id then
      raise exception 'receipt line already confirmed to another order_line (existing=%, requested=%)', v_existing.order_line_id, p_order_line_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'receipt_id', p_receipt_id,
      'receipt_line_uuid', p_receipt_line_uuid,
      'order_line_id', p_order_line_id,
      'shipment_id', v_existing.shipment_id,
      'shipment_line_id', v_existing.shipment_line_id,
      'selected_weight_g', v_existing.selected_weight_g,
      'selected_material_code', v_existing.selected_material_code
    );
  end if;

  -- receipt line
  select vendor_party_id, model_name, material_code, vendor_seq_no, customer_factory_code,
         factory_weight_g, factory_labor_basic_cost_krw, factory_labor_other_cost_krw, factory_total_amount_krw
    into v_vendor_party_id, v_receipt_model, v_receipt_material, v_receipt_seq, v_receipt_customer_code,
         v_factory_weight, v_factory_basic, v_factory_other, v_factory_total
  from public.cms_v_receipt_line_items_flat_v1
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid;

  if not found then
    raise exception 'receipt line not found: receipt_id=%, line=%', p_receipt_id, p_receipt_line_uuid;
  end if;

  if v_vendor_party_id is null then
    raise exception 'receipt vendor_party_id required for confirm (receipt_id=%)', p_receipt_id;
  end if;

  -- order line + vendor
  select
    ol.*,
    po.vendor_party_id as po_vendor_party_id
  into v_order
  from public.cms_order_line ol
  left join public.cms_factory_po po on po.po_id = ol.factory_po_id
  where ol.order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  if v_order.po_vendor_party_id is distinct from v_vendor_party_id then
    raise exception 'vendor mismatch (receipt vendor %, order vendor %)', v_vendor_party_id, v_order.po_vendor_party_id;
  end if;

  if v_order.status not in (
    'WAITING_INBOUND'::public.cms_e_order_status,
    'READY_TO_SHIP'::public.cms_e_order_status
  ) then
    raise exception 'order_line status not matchable: %, status=%', p_order_line_id, v_order.status;
  end if;

  if v_order.matched_master_id is null then
    raise exception 'order_line.matched_master_id required (strict master mode): %', p_order_line_id;
  end if;

  -- master (effective weight = weight_default_g - deduction_weight_default_g)
  select
    m.master_id,
    m.weight_default_g,
    m.deduction_weight_default_g,
    m.material_code_default,
    m.labor_base_sell, m.labor_base_cost,
    (m.labor_center_sell + m.labor_sub1_sell + m.labor_sub2_sell + m.labor_bead_sell) as extra_sell_sum,
    (m.labor_center_cost + m.labor_sub1_cost + m.labor_sub2_cost + m.labor_bead_cost) as extra_cost_sum
  into v_master
  from public.cms_master_item m
  where m.master_id = v_order.matched_master_id;

  if not found then
    raise exception 'master not found: %', v_order.matched_master_id;
  end if;

  -- pick selected values (weight uses 2dp UI convention; this is NOT commodity grams)
  v_selected_weight := round(coalesce(p_selected_weight_g, v_factory_weight)::numeric, 2);
  if v_selected_weight is null or v_selected_weight <= 0 then
    raise exception 'selected_weight_g required and must be > 0';
  end if;

  v_selected_material := coalesce(
    p_selected_material_code,
    v_receipt_material,
    v_order.material_code,
    v_master.material_code_default
  );
  if v_selected_material is null then
    raise exception 'material_code required at match time (receipt_line=%)', p_receipt_line_uuid;
  end if;

  v_basic_cost := coalesce(p_selected_factory_labor_basic_cost_krw, v_factory_basic, 0);
  v_other_cost := coalesce(p_selected_factory_labor_other_cost_krw, v_factory_other, 0);
  v_total_amount := coalesce(p_selected_factory_total_cost_krw, v_factory_total);

  -- overrides tracking
  if p_selected_weight_g is not null and v_factory_weight is not null and round(p_selected_weight_g::numeric, 2) <> round(v_factory_weight::numeric, 2) then
    v_overridden := v_overridden || jsonb_build_object('weight_g', true);
  end if;
  if p_selected_material_code is not null and v_receipt_material is not null and p_selected_material_code <> v_receipt_material then
    v_overridden := v_overridden || jsonb_build_object('material_code', true);
  end if;
  if p_selected_factory_labor_basic_cost_krw is not null and v_factory_basic is not null and p_selected_factory_labor_basic_cost_krw <> v_factory_basic then
    v_overridden := v_overridden || jsonb_build_object('labor_basic_cost_krw', true);
  end if;
  if p_selected_factory_labor_other_cost_krw is not null and v_factory_other is not null and p_selected_factory_labor_other_cost_krw <> v_factory_other then
    v_overridden := v_overridden || jsonb_build_object('labor_other_cost_krw', true);
  end if;
  if p_selected_factory_total_cost_krw is not null and v_factory_total is not null and p_selected_factory_total_cost_krw <> v_factory_total then
    v_overridden := v_overridden || jsonb_build_object('total_cost_krw', true);
  end if;

  -- weight deviation warning (effective weight 기준 ±10%)
  if v_master.weight_default_g is not null then
    v_master_effective_weight := greatest(coalesce(v_master.weight_default_g, 0) - coalesce(v_master.deduction_weight_default_g, 0), 0);
    v_master_effective_weight := round(v_master_effective_weight::numeric, 2);
    if v_master_effective_weight > 0 then
      v_weight_deviation_pct := abs(v_selected_weight - v_master_effective_weight) / v_master_effective_weight;
      if v_weight_deviation_pct > 0.10 then
        v_weight_warn := true;
      end if;
    end if;
  end if;

  -- labor sell derivation: (factory cost) + (master sell - master cost) as margin (base/extra split)
  v_base_diff := coalesce(v_master.labor_base_sell, 0) - coalesce(v_master.labor_base_cost, 0);
  v_extra_diff := coalesce(v_master.extra_sell_sum, 0) - coalesce(v_master.extra_cost_sum, 0);

  v_base_sell := greatest(v_basic_cost + v_base_diff, 0);
  v_extra_sell := greatest(v_other_cost + v_extra_diff, 0);

  -- create shipment draft (1 order_line -> 1 shipment_header)
  v_shipment_id := public.cms_fn_create_shipment_header_v1(v_order.customer_party_id, current_date, null);

  v_shipment_line_id := public.cms_fn_add_shipment_line_from_order_v1(
    v_shipment_id,
    p_order_line_id,
    coalesce(v_order.qty, 1),
    'RULE'::public.cms_e_pricing_mode,
    null,
    v_selected_material,
    null,
    null,
    null,
    null,
    p_note
  );

  -- set weight + labor on shipment line (sell side)
  perform public.cms_fn_shipment_update_line_v1(
    v_shipment_line_id,
    v_selected_weight,
    0,
    v_base_sell,
    v_extra_sell,
    jsonb_build_array(
      jsonb_build_object('kind','RECEIPT','base_cost_krw', v_basic_cost, 'extra_cost_krw', v_other_cost),
      jsonb_build_object('kind','MASTER_DIFF','base_diff_krw', v_base_diff, 'extra_diff_krw', v_extra_diff)
    )
  );

  -- link receipt to shipment line
  update public.cms_shipment_line
  set purchase_receipt_id = p_receipt_id,
      purchase_receipt_line_uuid = p_receipt_line_uuid,
      material_code = v_selected_material,
      updated_at = now()
  where shipment_line_id = v_shipment_line_id;

  -- receipt usage link (for receipt inbox UI)
  insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note)
  values
    (p_receipt_id, 'SHIPMENT_HEADER', v_shipment_id, p_note),
    (p_receipt_id, 'SHIPMENT_LINE', v_shipment_line_id, p_note)
  on conflict do nothing;

  -- receipt status -> LINKED (best effort)
  update public.cms_receipt_inbox
  set status = 'LINKED'::public.cms_e_receipt_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and status = 'UPLOADED'::public.cms_e_receipt_status;

  -- order status: WAITING_INBOUND -> READY_TO_SHIP (inbound_at set)
  update public.cms_order_line
  set status = 'READY_TO_SHIP'::public.cms_e_order_status,
      inbound_at = coalesce(inbound_at, now()),
      updated_at = now()
  where order_line_id = p_order_line_id
    and status = 'WAITING_INBOUND'::public.cms_e_order_status;

  -- match row: set confirmed + selected values + link shipment ids
  insert into public.cms_receipt_line_match(
    receipt_id, receipt_line_uuid, order_line_id,
    status,
    shipment_id, shipment_line_id,
    selected_weight_g, selected_material_code,
    selected_factory_labor_basic_cost_krw, selected_factory_labor_other_cost_krw, selected_factory_total_cost_krw,
    overridden_fields,
    note,
    confirmed_at, confirmed_by
  )
  values(
    p_receipt_id, p_receipt_line_uuid, p_order_line_id,
    'CONFIRMED'::public.cms_e_receipt_line_match_status,
    v_shipment_id, v_shipment_line_id,
    v_selected_weight, v_selected_material,
    v_basic_cost, v_other_cost, v_total_amount,
    v_overridden,
    p_note,
    now(), p_actor_person_id
  )
  on conflict (receipt_id, receipt_line_uuid, order_line_id) do update
    set status = 'CONFIRMED'::public.cms_e_receipt_line_match_status,
        shipment_id = excluded.shipment_id,
        shipment_line_id = excluded.shipment_line_id,
        selected_weight_g = excluded.selected_weight_g,
        selected_material_code = excluded.selected_material_code,
        selected_factory_labor_basic_cost_krw = excluded.selected_factory_labor_basic_cost_krw,
        selected_factory_labor_other_cost_krw = excluded.selected_factory_labor_other_cost_krw,
        selected_factory_total_cost_krw = excluded.selected_factory_total_cost_krw,
        overridden_fields = excluded.overridden_fields,
        note = excluded.note,
        confirmed_at = excluded.confirmed_at,
        confirmed_by = excluded.confirmed_by,
        updated_at = now();

  -- reject other suggested candidates for same receipt line
  update public.cms_receipt_line_match
  set status = 'REJECTED'::public.cms_e_receipt_line_match_status,
      updated_at = now()
  where receipt_id = p_receipt_id
    and receipt_line_uuid = p_receipt_line_uuid
    and status = 'SUGGESTED'::public.cms_e_receipt_line_match_status
    and order_line_id <> p_order_line_id;

  return jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'receipt_id', p_receipt_id,
    'receipt_line_uuid', p_receipt_line_uuid,
    'order_line_id', p_order_line_id,
    'shipment_id', v_shipment_id,
    'shipment_line_id', v_shipment_line_id,
    'selected_weight_g', v_selected_weight,
    'selected_material_code', v_selected_material,
    'base_labor_sell_krw', v_base_sell,
    'extra_labor_sell_krw', v_extra_sell,
    'master_effective_weight_g', v_master_effective_weight,
    'weight_deviation_pct', v_weight_deviation_pct,
    'weight_deviation_warn', v_weight_warn
  );
end $$;

-- Grants
grant execute on function public.cms_fn_norm_token_v1(text) to authenticated;
grant execute on function public.cms_fn_norm_model_token_v1(text) to authenticated;
grant execute on function public.cms_fn_infer_vendor_seq_no_from_order_v1(int, text, text) to authenticated;
grant execute on function public.cms_fn_receipt_line_match_suggest_v1(uuid, uuid, int) to authenticated;
grant execute on function public.cms_fn_receipt_line_match_confirm_v1(uuid, uuid, uuid, numeric, public.cms_e_material_code, numeric, numeric, numeric, uuid, text) to authenticated;

grant execute on function public.cms_fn_norm_token_v1(text) to service_role;
grant execute on function public.cms_fn_norm_model_token_v1(text) to service_role;
grant execute on function public.cms_fn_infer_vendor_seq_no_from_order_v1(int, text, text) to service_role;
grant execute on function public.cms_fn_receipt_line_match_suggest_v1(uuid, uuid, int) to service_role;
grant execute on function public.cms_fn_receipt_line_match_confirm_v1(uuid, uuid, uuid, numeric, public.cms_e_material_code, numeric, numeric, numeric, uuid, text) to service_role;
