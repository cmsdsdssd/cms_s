-- cms_0009: INPUT RPCs (create/update drafts) + grants
-- ?먯튃: DRAFT?먯꽌留??섏젙 媛?? CONFIRMED硫?李⑤떒
-- 紐⑹쟻: UI?먯꽌 "INSERT/UPDATE 吏곸젒" ?섏? ?딄퀬, RPC濡쒕쭔 ?낅젰/?섏젙 媛?ν븯寃?

-- ============================================================
-- 0) DROP (?쒓렇?덉쿂 蹂寃?以묐났 ?앹꽦 諛⑹?)
-- ============================================================

-- party/order/repair upsert (怨쇨굅 ?섎せ???쒓렇?덉쿂???ы븿)
drop function if exists public.cms_fn_upsert_party_v1(uuid, cms_e_party_type, text, text, text, text, text);
drop function if exists public.cms_fn_upsert_party_v1(cms_e_party_type, text, text, text, text, text, uuid);

drop function if exists public.cms_fn_upsert_order_line_v1(uuid, uuid, text, text, text, int, text, boolean, uuid, text);
drop function if exists public.cms_fn_upsert_order_line_v1(uuid, text, text, text, int, text, boolean, uuid, text, uuid);

drop function if exists public.cms_fn_upsert_repair_line_v1(uuid, uuid, text, text, text, cms_e_material_code, int, numeric, boolean, uuid, numeric, date, text);
drop function if exists public.cms_fn_upsert_repair_line_v1(uuid, text, text, text, cms_e_material_code, int, numeric, boolean, uuid, numeric, date, text, uuid);

-- shipment draft helpers / inputs
drop function if exists public.cms_fn_create_shipment_header_v1(uuid, date, text);
drop function if exists public.cms_fn__assert_shipment_draft(uuid);

drop function if exists public.cms_fn_add_shipment_line_from_order_v1(uuid, uuid, int, cms_e_pricing_mode, cms_e_category_code, cms_e_material_code, boolean, uuid, numeric, numeric, text);
drop function if exists public.cms_fn_add_shipment_line_from_repair_v1(uuid, uuid, int, cms_e_pricing_mode, cms_e_category_code, cms_e_material_code, boolean, uuid, numeric, numeric, numeric, text);

-- ad_hoc: (?대쾲???먮윭?щ뜕 ?쒓렇?덉쿂 ?ы븿?댁꽌) ?꾨? ?뺣━
drop function if exists public.cms_fn_add_shipment_line_ad_hoc_v1(
  uuid, text, text, text,
  text, int, cms_e_pricing_mode, cms_e_category_code,
  cms_e_material_code, boolean, uuid,
  numeric, numeric, numeric, numeric, numeric, text
);
drop function if exists public.cms_fn_add_shipment_line_ad_hoc_v1(
  uuid, text, text, text,
  cms_e_category_code,
  text, int, cms_e_pricing_mode,
  cms_e_material_code, boolean, uuid,
  numeric, numeric, numeric, numeric, numeric, text
);

drop function if exists public.cms_fn_update_shipment_line_v1(uuid, int, cms_e_category_code, cms_e_material_code, numeric, numeric, boolean, uuid, cms_e_pricing_mode, numeric, numeric, numeric, text);
drop function if exists public.cms_fn_delete_shipment_line_v1(uuid, text);

-- ============================================================
-- 1) 嫄곕옒泥?upsert (customer/vendor 怨듭슜)
--    ??default???ㅼそ?쇰줈留?
-- ============================================================
create or replace function public.cms_fn_upsert_party_v1(
  p_party_type cms_e_party_type,
  p_name text,
  p_phone text default null,
  p_region text default null,
  p_address text default null,
  p_memo text default null,
  p_party_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_party_type is null then raise exception 'party_type required'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name required'; end if;

  v_id := coalesce(p_party_id, gen_random_uuid());

  insert into public.cms_party(party_id, party_type, name, phone, region, address, memo)
  values (v_id, p_party_type, trim(p_name), p_phone, p_region, p_address, p_memo)
  on conflict (party_id) do update set
    party_type = excluded.party_type,
    name       = excluded.name,
    phone      = excluded.phone,
    region     = excluded.region,
    address    = excluded.address,
    memo       = excluded.memo;

  return v_id;
end $$;

-- ============================================================
-- 2) 二쇰Ц ?쇱씤 upsert (?ㅻ뜑 ?놁씠 ?쇱씤 ?⑥쐞)
-- ============================================================
create or replace function public.cms_fn_upsert_order_line_v1(
  p_customer_party_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_qty int default 1,
  p_size text default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_memo text default null,
  p_order_line_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  if p_model_name is null or length(trim(p_model_name)) = 0 then raise exception 'model_name required'; end if;
  if p_suffix is null or length(trim(p_suffix)) = 0 then raise exception 'suffix required'; end if;
  if p_color  is null or length(trim(p_color))  = 0 then raise exception 'color required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  v_id := coalesce(p_order_line_id, gen_random_uuid());

  insert into public.cms_order_line(
    order_line_id,
    customer_party_id,
    model_name, suffix, color, size,
    qty,
    is_plated, plating_variant_id,
    memo
  )
  values(
    v_id,
    p_customer_party_id,
    trim(p_model_name), trim(p_suffix), trim(p_color),
    nullif(trim(coalesce(p_size,'')),''),
    p_qty,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    p_memo
  )
  on conflict (order_line_id) do update set
    customer_party_id  = excluded.customer_party_id,
    model_name         = excluded.model_name,
    suffix             = excluded.suffix,
    color              = excluded.color,
    size               = excluded.size,
    qty                = excluded.qty,
    is_plated          = excluded.is_plated,
    plating_variant_id = excluded.plating_variant_id,
    memo               = excluded.memo;

  return v_id;
end $$;

-- ============================================================
-- 3) ?섎━ ?쇱씤 upsert (臾댁긽/?좎긽 + ?꾧툑 媛??
-- ============================================================
create or replace function public.cms_fn_upsert_repair_line_v1(
  p_customer_party_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_material_code cms_e_material_code default null,
  p_qty int default 1,
  p_measured_weight_g numeric default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_repair_fee_krw numeric default 0,
  p_received_at date default null,
  p_memo text default null,
  p_repair_line_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;
  if p_model_name is null or length(trim(p_model_name)) = 0 then raise exception 'model_name required'; end if;
  if p_suffix is null or length(trim(p_suffix)) = 0 then raise exception 'suffix required'; end if;
  if p_color  is null or length(trim(p_color))  = 0 then raise exception 'color required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  v_id := coalesce(p_repair_line_id, gen_random_uuid());

  insert into public.cms_repair_line(
    repair_line_id,
    customer_party_id,
    model_name, suffix, color,
    material_code,
    qty,
    measured_weight_g,
    is_plated, plating_variant_id,
    repair_fee_krw,
    received_at,
    memo
  )
  values(
    v_id,
    p_customer_party_id,
    trim(p_model_name), trim(p_suffix), trim(p_color),
    p_material_code,
    p_qty,
    p_measured_weight_g,
    coalesce(p_is_plated,false),
    p_plating_variant_id,
    coalesce(p_repair_fee_krw,0),
    coalesce(p_received_at, current_date),
    p_memo
  )
  on conflict (repair_line_id) do update set
    customer_party_id  = excluded.customer_party_id,
    model_name         = excluded.model_name,
    suffix             = excluded.suffix,
    color              = excluded.color,
    material_code      = excluded.material_code,
    qty                = excluded.qty,
    measured_weight_g  = excluded.measured_weight_g,
    is_plated          = excluded.is_plated,
    plating_variant_id = excluded.plating_variant_id,
    repair_fee_krw     = excluded.repair_fee_krw,
    received_at        = excluded.received_at,
    memo               = excluded.memo;

  return v_id;
end $$;

-- ============================================================
-- 4) 異쒓퀬臾몄꽌(DRAFT) ?앹꽦
-- ============================================================
create or replace function public.cms_fn_create_shipment_header_v1(
  p_customer_party_id uuid,
  p_ship_date date default null,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_customer_party_id is null then raise exception 'customer_party_id required'; end if;

  insert into public.cms_shipment_header(
    shipment_id, customer_party_id, ship_date, status, memo
  )
  values(
    gen_random_uuid(),
    p_customer_party_id,
    coalesce(p_ship_date, current_date),
    'DRAFT'::cms_e_shipment_status,
    p_memo
  )
  returning shipment_id into v_id;

  return v_id;
end $$;

-- ------------------------------------------------------------
-- ?대? ?ы띁: 異쒓퀬臾몄꽌 DRAFT ?좉툑 泥댄겕
-- ------------------------------------------------------------
create or replace function public.cms_fn__assert_shipment_draft(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_status cms_e_shipment_status;
begin
  select status into v_status
  from public.cms_shipment_header
  where shipment_id = p_shipment_id
  for update;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_status <> 'DRAFT'::cms_e_shipment_status then
    raise exception 'shipment not DRAFT: %, status=%', p_shipment_id, v_status;
  end if;
end $$;

-- ============================================================
-- 5) 異쒓퀬?쇱씤 異붽?: 二쇰Ц 湲곕컲
-- ============================================================
create or replace function public.cms_fn_add_shipment_line_from_order_v1(
  p_shipment_id uuid,
  p_order_line_id uuid,
  p_qty int default null,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o record;
  v_id uuid;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  select * into o
  from public.cms_order_line
  where order_line_id = p_order_line_id;

  if not found then
    raise exception 'order_line not found: %', p_order_line_id;
  end if;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    order_line_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    p_order_line_id,
    coalesce(p_pricing_mode, 'RULE'::cms_e_pricing_mode),
    p_category_code,
    p_material_code,
    coalesce(p_qty, o.qty, 1),
    o.model_name, o.suffix, o.color, o.size,
    coalesce(p_is_plated, o.is_plated, false),
    coalesce(p_plating_variant_id, o.plating_variant_id),
    p_unit_price_krw,
    p_manual_total_amount_krw,
    0
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;

-- ============================================================
-- 6) 異쒓퀬?쇱씤 異붽?: ?섎━ 湲곕컲
-- ============================================================
create or replace function public.cms_fn_add_shipment_line_from_repair_v1(
  p_shipment_id uuid,
  p_repair_line_id uuid,
  p_qty int default null,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_repair_fee_krw numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_id uuid;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  select * into r
  from public.cms_repair_line
  where repair_line_id = p_repair_line_id;

  if not found then
    raise exception 'repair_line not found: %', p_repair_line_id;
  end if;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    repair_line_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    measured_weight_g,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    p_repair_line_id,
    coalesce(p_pricing_mode, 'RULE'::cms_e_pricing_mode),
    p_category_code,
    coalesce(p_material_code, r.material_code),
    coalesce(p_qty, r.qty, 1),
    r.model_name, r.suffix, r.color, null,
    coalesce(p_is_plated, r.is_plated, false),
    coalesce(p_plating_variant_id, r.plating_variant_id),
    r.measured_weight_g,
    p_unit_price_krw,
    p_manual_total_amount_krw,
    coalesce(p_repair_fee_krw, r.repair_fee_krw, 0)
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;

-- ============================================================
-- 7) 異쒓퀬?쇱씤 異붽?: ?⑤룆(AD-HOC)
--    ??(?대쾲 ?먮윭) ?꾩닔 p_category_code瑜?default???욎뿉 諛곗튂
-- ============================================================
create or replace function public.cms_fn_add_shipment_line_ad_hoc_v1(
  p_shipment_id uuid,
  p_model_name text,
  p_suffix text,
  p_color text,

  p_category_code cms_e_category_code, -- ???꾩닔

  p_size text default null,
  p_qty int default 1,
  p_pricing_mode cms_e_pricing_mode default 'RULE'::cms_e_pricing_mode,
  p_material_code cms_e_material_code default null,
  p_is_plated boolean default false,
  p_plating_variant_id uuid default null,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_repair_fee_krw numeric default 0,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.cms_fn__assert_shipment_draft(p_shipment_id);

  if p_model_name is null or length(trim(p_model_name))=0 then raise exception 'model_name required'; end if;
  if p_suffix is null or length(trim(p_suffix))=0 then raise exception 'suffix required'; end if;
  if p_color  is null or length(trim(p_color))=0  then raise exception 'color required'; end if;
  if p_category_code is null then raise exception 'category_code required'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'qty must be > 0'; end if;

  insert into public.cms_shipment_line(
    shipment_line_id, shipment_id,
    pricing_mode,
    category_code,
    material_code,
    qty,
    model_name, suffix, color, size,
    is_plated, plating_variant_id,
    measured_weight_g,
    deduction_weight_g,
    unit_price_krw,
    manual_total_amount_krw,
    repair_fee_krw
  )
  values(
    gen_random_uuid(), p_shipment_id,
    coalesce(p_pricing_mode,'RULE'::cms_e_pricing_mode),
    p_category_code,
    p_material_code,
    p_qty,
    trim(p_model_name), trim(p_suffix), trim(p_color), nullif(trim(coalesce(p_size,'')),''),
    coalesce(p_is_plated,false), p_plating_variant_id,
    p_measured_weight_g,
    p_deduction_weight_g,
    p_unit_price_krw,
    p_manual_total_amount_krw,
    coalesce(p_repair_fee_krw,0)
  )
  returning shipment_line_id into v_id;

  return v_id;
end $$;

-- ============================================================
-- 8) 異쒓퀬?쇱씤 ?섏젙 (DRAFT?먯꽌留?
-- ============================================================
create or replace function public.cms_fn_update_shipment_line_v1(
  p_shipment_line_id uuid,
  p_qty int default null,
  p_category_code cms_e_category_code default null,
  p_material_code cms_e_material_code default null,
  p_measured_weight_g numeric default null,
  p_deduction_weight_g numeric default null,
  p_is_plated boolean default null,
  p_plating_variant_id uuid default null,
  p_pricing_mode cms_e_pricing_mode default null,
  p_unit_price_krw numeric default null,
  p_manual_total_amount_krw numeric default null,
  p_repair_fee_krw numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shipment_id uuid;
begin
  select shipment_id into v_shipment_id
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  perform public.cms_fn__assert_shipment_draft(v_shipment_id);

  update public.cms_shipment_line
  set
    qty = coalesce(p_qty, qty),
    category_code = coalesce(p_category_code, category_code),
    material_code = coalesce(p_material_code, material_code),
    measured_weight_g = coalesce(p_measured_weight_g, measured_weight_g),
    deduction_weight_g = coalesce(p_deduction_weight_g, deduction_weight_g),
    is_plated = coalesce(p_is_plated, is_plated),
    plating_variant_id = coalesce(p_plating_variant_id, plating_variant_id),
    pricing_mode = coalesce(p_pricing_mode, pricing_mode),
    unit_price_krw = coalesce(p_unit_price_krw, unit_price_krw),
    manual_total_amount_krw = coalesce(p_manual_total_amount_krw, manual_total_amount_krw),
    repair_fee_krw = coalesce(p_repair_fee_krw, repair_fee_krw)
  where shipment_line_id = p_shipment_line_id;

  return jsonb_build_object('ok', true, 'shipment_line_id', p_shipment_line_id);
end $$;

-- ============================================================
-- 9) 異쒓퀬?쇱씤 ??젣 (DRAFT?먯꽌留?
-- ============================================================
create or replace function public.cms_fn_delete_shipment_line_v1(
  p_shipment_line_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shipment_id uuid;
begin
  select shipment_id into v_shipment_id
  from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  perform public.cms_fn__assert_shipment_draft(v_shipment_id);

  delete from public.cms_shipment_line
  where shipment_line_id = p_shipment_line_id;

  return jsonb_build_object('ok', true, 'deleted', true, 'shipment_line_id', p_shipment_line_id);
end $$;

-- ============================================================
-- 10) GRANTS: cms_fn_* ?꾨? authenticated EXEC ?덉슜
-- ============================================================
do $$
declare r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'cms\_fn\_%' escape '\'
  loop
    execute format('grant execute on function public.%I(%s) to authenticated;', r.fn_name, r.args);
  end loop;
end $$;
