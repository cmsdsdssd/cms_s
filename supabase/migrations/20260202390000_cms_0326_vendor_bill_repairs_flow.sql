set search_path = public, pg_temp;
do $$ begin
  create type public.cms_e_ap_entry_type as enum ('BILL','PAYMENT','OFFSET','ADJUST');
exception when duplicate_object then null; end $$;
create table if not exists public.cms_ap_ledger (
  ap_ledger_id uuid primary key default gen_random_uuid(),
  vendor_party_id uuid not null references public.cms_party(party_id),
  occurred_at timestamptz not null default now(),
  entry_type public.cms_e_ap_entry_type not null,
  amount_krw numeric not null,
  receipt_id uuid references public.cms_receipt_inbox(receipt_id),
  bill_no text,
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cms_ap_ledger_vendor_occurred
  on public.cms_ap_ledger(vendor_party_id, occurred_at desc);
create unique index if not exists uq_cms_ap_ledger_bill_receipt
  on public.cms_ap_ledger(receipt_id)
  where receipt_id is not null and entry_type = 'BILL'::public.cms_e_ap_entry_type;
alter table public.cms_ap_ledger enable row level security;
drop policy if exists cms_select_authenticated on public.cms_ap_ledger;
create policy cms_select_authenticated on public.cms_ap_ledger for select to authenticated using (true);
alter table public.cms_receipt_inbox
  add column if not exists bill_no text;
create unique index if not exists uq_cms_receipt_inbox_vendor_bill_no
  on public.cms_receipt_inbox(vendor_party_id, bill_no)
  where bill_no is not null;
create table if not exists public.cms_vendor_bill_allocation (
  allocation_id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.cms_receipt_inbox(receipt_id) on delete cascade,
  shipment_id uuid not null references public.cms_shipment_header(shipment_id) on delete cascade,
  allocated_cost_krw numeric not null,
  allocation_method text not null default 'PROVISIONAL',
  created_at timestamptz not null default now(),
  created_by uuid references public.cms_person(person_id)
);
create unique index if not exists uq_cms_vendor_bill_allocation
  on public.cms_vendor_bill_allocation(bill_id, shipment_id);
create index if not exists idx_cms_vendor_bill_allocation_bill
  on public.cms_vendor_bill_allocation(bill_id);
alter table public.cms_vendor_bill_allocation enable row level security;
drop policy if exists cms_select_authenticated on public.cms_vendor_bill_allocation;
create policy cms_select_authenticated on public.cms_vendor_bill_allocation for select to authenticated using (true);
alter table public.cms_repair_line
  add column if not exists issue_desc text,
  add column if not exists repair_fee_reason text;
alter table public.cms_shipment_header
  add column if not exists source_type text,
  add column if not exists source_id uuid;
alter table public.cms_shipment_line
  add column if not exists repair_fee_reason text;
drop view if exists public.cms_v_repair_line_enriched_v1 cascade;
create view public.cms_v_repair_line_enriched_v1 as
select
  r.repair_line_id,
  r.customer_party_id,
  p.name as customer_name,
  r.received_at,
  r.model_name,
  r.model_name_raw,
  r.suffix,
  r.material_code,
  r.color,
  r.qty,
  r.weight_received_g as measured_weight_g,
  r.is_plated,
  r.plating_variant_id,
  concat_ws('-', rtrim(pv.plating_type::text), nullif(pv.color_code,''), nullif(pv.thickness_code,'')) as plating_code,
  pv.display_name as plating_display_name,
  r.repair_fee_krw,
  r.repair_fee_reason,
  r.issue_desc,
  r.status,
  r.memo,
  r.source_channel,
  r.correlation_id,
  r.created_at,
  r.updated_at
from public.cms_repair_line r
left join public.cms_party p on p.party_id = r.customer_party_id
left join public.cms_plating_variant pv on pv.plating_variant_id = r.plating_variant_id;
grant select on public.cms_v_repair_line_enriched_v1 to authenticated;
create or replace view public.cms_v_shipment_cost_apply_candidates_v1 as
select
  sh.shipment_id,
  sh.ship_date,
  sh.status,
  sh.customer_party_id,
  cp.name as customer_name,
  count(sl.shipment_line_id) as line_cnt,
  coalesce(sum(sl.qty),0) as total_qty,
  coalesce(sum(sl.total_amount_cost_krw),0) as total_cost_krw,
  coalesce(sum(sl.total_amount_sell_krw),0) as total_sell_krw,
  bool_and(sl.purchase_cost_status = 'ACTUAL'::public.cms_e_cost_status) as cost_confirmed,
  bool_or(sl.purchase_receipt_id is not null) as has_receipt,
  string_agg(distinct nullif(trim(sl.model_name),''), ', ') as model_names,
  (array_agg(sl.purchase_receipt_id order by sl.purchase_receipt_id::text desc)
    filter (where sl.purchase_receipt_id is not null))[1] as purchase_receipt_id
from public.cms_shipment_header sh
join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
left join public.cms_party cp on cp.party_id = sh.customer_party_id
group by sh.shipment_id, sh.ship_date, sh.status, sh.customer_party_id, cp.name;
grant select on public.cms_v_shipment_cost_apply_candidates_v1 to authenticated, service_role;
drop view if exists public.cms_v_receipt_inbox_open_v1 cascade;
create view public.cms_v_receipt_inbox_open_v1 as
with linked_sh as (
  select distinct
    u.receipt_id,
    case
      when u.entity_type='SHIPMENT_HEADER' then u.entity_id
      when u.entity_type='SHIPMENT_LINE' then sl.shipment_id
      else null
    end as shipment_id
  from public.cms_receipt_usage u
  left join public.cms_shipment_line sl
    on sl.shipment_line_id = u.entity_id
   and u.entity_type='SHIPMENT_LINE'
  where u.entity_type in ('SHIPMENT_HEADER','SHIPMENT_LINE')
),
ship_rows as (
  select
    l.receipt_id,
    h.shipment_id,
    h.ship_date,
    h.status as shipment_status,
    h.customer_party_id,
    cp.name as customer_name,
    (select coalesce(sum(sl.total_amount_cost_krw),0)
       from public.cms_shipment_line sl
      where sl.shipment_id=h.shipment_id) as basis_cost_krw,
    (select count(*)
       from public.cms_shipment_line sl
      where sl.shipment_id=h.shipment_id) as line_cnt
  from linked_sh l
  join public.cms_shipment_header h on h.shipment_id = l.shipment_id
  left join public.cms_party cp on cp.party_id = h.customer_party_id
  where l.shipment_id is not null
),
ship_agg as (
  select
    receipt_id,
    count(distinct shipment_id) as linked_shipment_cnt,
    coalesce(sum(basis_cost_krw),0) as linked_basis_cost_krw,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'shipment_id', shipment_id,
        'ship_date', ship_date,
        'shipment_status', shipment_status,
        'customer_party_id', customer_party_id,
        'customer_name', customer_name,
        'basis_cost_krw', basis_cost_krw,
        'line_cnt', line_cnt
      )
      order by ship_date desc, shipment_id::text
    ), '[]'::jsonb) as linked_shipments
  from ship_rows
  group by receipt_id
)
select
  r.receipt_id,
  r.received_at,
  r.source,
  r.status,
  r.vendor_party_id,
  vp.name as vendor_name,
  r.bill_no,
  r.issued_at,
  r.currency_code as inbox_currency_code,
  r.total_amount_krw as inbox_total_amount_krw,
  r.file_bucket,
  r.file_path,
  r.file_sha256,
  r.file_size_bytes,
  r.mime_type,
  r.memo,
  r.meta,
  s.currency_code as pricing_currency_code,
  s.total_amount as pricing_total_amount,
  s.weight_g,
  s.labor_basic,
  s.labor_other,
  s.total_amount_krw as pricing_total_amount_krw,
  s.fx_rate_krw_per_unit,
  s.fx_tick_id,
  s.applied_at,
  s.applied_by,
  s.allocation_json,
  coalesce(a.linked_shipment_cnt,0) as linked_shipment_cnt,
  coalesce(a.linked_basis_cost_krw,0) as linked_basis_cost_krw,
  coalesce(a.linked_shipments,'[]'::jsonb) as linked_shipments
from public.cms_receipt_inbox r
left join public.cms_party vp on vp.party_id = r.vendor_party_id
left join public.cms_receipt_pricing_snapshot s on s.receipt_id = r.receipt_id
left join ship_agg a on a.receipt_id = r.receipt_id
where r.status <> 'ARCHIVED'::public.cms_e_receipt_status;
grant select on public.cms_v_receipt_inbox_open_v1 to authenticated, service_role;
create or replace function public.cms_fn_upsert_receipt_usage_alloc_v1(
  p_receipt_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;
  if p_entity_type is null or length(trim(p_entity_type)) = 0 then
    raise exception using errcode='P0001', message='entity_type required';
  end if;
  if p_entity_id is null then
    raise exception using errcode='P0001', message='entity_id required';
  end if;

  insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note, actor_person_id, correlation_id)
  values (p_receipt_id, p_entity_type, p_entity_id, p_note, p_actor_person_id, p_correlation_id)
  on conflict do nothing;

  update public.cms_receipt_inbox
  set status = 'LINKED'::public.cms_e_receipt_status
  where receipt_id = p_receipt_id;
end $$;
alter function public.cms_fn_upsert_receipt_usage_alloc_v1(uuid,text,uuid,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_upsert_receipt_usage_alloc_v1(uuid,text,uuid,uuid,text,uuid)
  to authenticated, service_role;
create or replace function public.cms_fn_create_vendor_bill_v1(
  p_vendor_party_id uuid,
  p_bill_no text default null,
  p_bill_date date default null,
  p_memo text default null,
  p_total_amount_krw numeric default null,
  p_lines jsonb default '[]'::jsonb,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_bill_no text := nullif(trim(p_bill_no), '');
  v_total numeric := p_total_amount_krw;
  v_weight numeric := 0;
  v_labor_basic numeric := 0;
  v_labor_other numeric := 0;
  v_total_from_lines numeric := null;
  v_file_bucket text := 'vendor_bill';
  v_file_path text;
  v_line_meta jsonb := jsonb_build_object('line_items', coalesce(p_lines,'[]'::jsonb));
begin
  if p_vendor_party_id is null then
    raise exception using errcode='P0001', message='vendor_party_id required';
  end if;

  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='lines must be json array';
  end if;

  select
    coalesce(sum(coalesce(nullif((e->>'weight_g')::text,'')::numeric,0) * coalesce(nullif((e->>'qty')::text,'')::numeric,1)),0),
    coalesce(sum(coalesce(nullif((e->>'labor_basic')::text,'')::numeric,0) * coalesce(nullif((e->>'qty')::text,'')::numeric,1)),0),
    coalesce(sum(coalesce(nullif((e->>'labor_other')::text,'')::numeric,0) * coalesce(nullif((e->>'qty')::text,'')::numeric,1)),0),
    coalesce(sum((coalesce(nullif((e->>'labor_basic')::text,'')::numeric,0) + coalesce(nullif((e->>'labor_other')::text,'')::numeric,0)) * coalesce(nullif((e->>'qty')::text,'')::numeric,1)),0)
  into v_weight, v_labor_basic, v_labor_other, v_total_from_lines
  from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) e;

  if v_total is null then
    v_total := v_total_from_lines;
  end if;

  if v_total is null then
    raise exception using errcode='P0001', message='total_amount_krw required';
  end if;

  if v_total < 0 then
    raise exception using errcode='P0001', message='total_amount_krw must be >= 0';
  end if;

  if v_bill_no is not null then
    select receipt_id into v_id
    from public.cms_receipt_inbox
    where vendor_party_id = p_vendor_party_id
      and bill_no = v_bill_no
    limit 1;
  end if;

  if v_id is null then
    v_file_path := format(
      'manual/%s/%s',
      p_vendor_party_id,
      coalesce(regexp_replace(v_bill_no, '[^a-zA-Z0-9_-]', '_', 'g'), gen_random_uuid()::text)
    );

    insert into public.cms_receipt_inbox(
      file_bucket, file_path, source, vendor_party_id, issued_at, total_amount_krw, status, memo, meta, bill_no
    ) values (
      v_file_bucket, v_file_path, 'MANUAL', p_vendor_party_id, coalesce(p_bill_date, current_date), v_total, 'UPLOADED', p_memo, v_line_meta, v_bill_no
    )
    returning receipt_id into v_id;
  else
    update public.cms_receipt_inbox
    set vendor_party_id = p_vendor_party_id,
        issued_at = coalesce(p_bill_date, issued_at),
        total_amount_krw = coalesce(v_total, total_amount_krw),
        memo = coalesce(p_memo, memo),
        meta = coalesce(meta,'{}'::jsonb) || v_line_meta,
        bill_no = coalesce(v_bill_no, bill_no)
    where receipt_id = v_id;
  end if;

  perform public.cms_fn_upsert_receipt_pricing_snapshot_v1(
    v_id,
    'KRW',
    v_total,
    nullif(v_weight,0),
    nullif(v_labor_basic,0),
    nullif(v_labor_other,0),
    p_actor_person_id,
    p_memo,
    p_correlation_id
  );

  if not exists (
    select 1
    from public.cms_ap_ledger
    where receipt_id = v_id
      and entry_type = 'BILL'::public.cms_e_ap_entry_type
  ) then
    insert into public.cms_ap_ledger(
      vendor_party_id, occurred_at, entry_type, amount_krw, receipt_id, bill_no, memo
    ) values (
      p_vendor_party_id,
      now(),
      'BILL'::public.cms_e_ap_entry_type,
      v_total,
      v_id,
      v_bill_no,
      p_memo
    );
  end if;

  return v_id;
end $$;
alter function public.cms_fn_create_vendor_bill_v1(uuid,text,date,text,numeric,jsonb,uuid,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_create_vendor_bill_v1(uuid,text,date,text,numeric,jsonb,uuid,uuid)
  to authenticated, service_role;
create or replace function public.cms_fn_update_vendor_bill_header_v1(
  p_receipt_id uuid,
  p_vendor_party_id uuid default null,
  p_bill_no text default null,
  p_bill_date date default null,
  p_memo text default null,
  p_lines jsonb default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_bill_no text := nullif(trim(p_bill_no), '');
  v_meta jsonb := case
    when p_lines is null then null
    else jsonb_build_object('line_items', p_lines)
  end;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  if p_lines is not null and jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='lines must be json array';
  end if;

  update public.cms_receipt_inbox
  set vendor_party_id = coalesce(p_vendor_party_id, vendor_party_id),
      bill_no = coalesce(v_bill_no, bill_no),
      issued_at = coalesce(p_bill_date, issued_at),
      memo = coalesce(p_memo, memo),
      meta = case when v_meta is null then meta else coalesce(meta,'{}'::jsonb) || v_meta end
  where receipt_id = p_receipt_id;

  if not found then
    raise exception using errcode='P0001', message='receipt not found';
  end if;
end $$;
alter function public.cms_fn_update_vendor_bill_header_v1(uuid,uuid,text,date,text,jsonb)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_update_vendor_bill_header_v1(uuid,uuid,text,date,text,jsonb)
  to authenticated, service_role;
create or replace function public.cms_fn_apply_vendor_bill_to_shipments_v1(
  p_bill_id uuid,
  p_allocations jsonb,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_force boolean default false,
  p_allocation_method text default 'PROVISIONAL'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_total_krw numeric;
  v_alloc_sum numeric := 0;
  v_alloc_cnt int := 0;
  r_alloc record;
  v_cost_lines jsonb;
  v_results jsonb := '[]'::jsonb;
  v_snap public.cms_receipt_pricing_snapshot%rowtype;
begin
  if p_bill_id is null then
    raise exception using errcode='P0001', message='bill_id required';
  end if;

  if jsonb_typeof(coalesce(p_allocations,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='allocations must be json array';
  end if;

  select * into v_snap
  from public.cms_receipt_pricing_snapshot
  where receipt_id = p_bill_id;

  v_total_krw := coalesce(v_snap.total_amount_krw, (select total_amount_krw from public.cms_receipt_inbox where receipt_id = p_bill_id));
  if v_total_krw is null then
    raise exception using errcode='P0001', message='bill total not found';
  end if;

  for r_alloc in
    select
      nullif((e->>'shipment_id')::text,'')::uuid as shipment_id,
      nullif((e->>'allocated_cost_krw')::text,'')::numeric as allocated_cost_krw
    from jsonb_array_elements(coalesce(p_allocations,'[]'::jsonb)) e
  loop
    if r_alloc.shipment_id is null then
      raise exception using errcode='P0001', message='shipment_id required in allocations';
    end if;
    if r_alloc.allocated_cost_krw is null then
      raise exception using errcode='P0001', message='allocated_cost_krw required in allocations';
    end if;
    if r_alloc.allocated_cost_krw < 0 then
      raise exception using errcode='P0001', message='allocated_cost_krw must be >= 0';
    end if;

    v_alloc_sum := v_alloc_sum + r_alloc.allocated_cost_krw;
    v_alloc_cnt := v_alloc_cnt + 1;
  end loop;

  if v_alloc_cnt <= 0 then
    raise exception using errcode='P0001', message='allocations required';
  end if;

  if abs(coalesce(v_alloc_sum,0) - v_total_krw) > 1 then
    raise exception using errcode='P0001', message='allocation sum must equal bill total';
  end if;

  for r_alloc in
    select
      nullif((e->>'shipment_id')::text,'')::uuid as shipment_id,
      nullif((e->>'allocated_cost_krw')::text,'')::numeric as allocated_cost_krw
    from jsonb_array_elements(coalesce(p_allocations,'[]'::jsonb)) e
  loop
    if not p_force and exists (
      select 1
      from public.cms_vendor_bill_allocation
      where bill_id = p_bill_id
        and shipment_id = r_alloc.shipment_id
    ) then
      raise exception using errcode='P0001', message='allocation already exists';
    end if;

    insert into public.cms_vendor_bill_allocation(
      bill_id, shipment_id, allocated_cost_krw, allocation_method, created_by
    ) values (
      p_bill_id, r_alloc.shipment_id, r_alloc.allocated_cost_krw, coalesce(nullif(trim(p_allocation_method),''), 'PROVISIONAL'), p_actor_person_id
    )
    on conflict (bill_id, shipment_id) do update set
      allocated_cost_krw = excluded.allocated_cost_krw,
      allocation_method = excluded.allocation_method,
      created_by = excluded.created_by,
      created_at = now();

    with line_src as (
      select shipment_line_id, qty
      from public.cms_shipment_line
      where shipment_id = r_alloc.shipment_id
    ),
    line_basis as (
      select coalesce(sum(qty),0) as total_qty from line_src
    ),
    line_alloc as (
      select
        s.shipment_line_id,
        s.qty,
        lb.total_qty,
        case
          when lb.total_qty <= 0 then 0
          else round(r_alloc.allocated_cost_krw * s.qty / lb.total_qty, 0)
        end as alloc_total_krw
      from line_src s
      cross join line_basis lb
    ),
    line_fix as (
      select
        a.*,
        (r_alloc.allocated_cost_krw - coalesce(sum(a.alloc_total_krw) over (),0)) as delta
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
            order by qty desc, shipment_line_id::text asc
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

    perform public.cms_fn_apply_purchase_cost_to_shipment_v1(
      r_alloc.shipment_id,
      'RECEIPT',
      p_bill_id,
      coalesce(v_cost_lines,'[]'::jsonb),
      p_actor_person_id,
      p_note,
      p_correlation_id,
      p_force
    );

    insert into public.cms_receipt_usage(receipt_id, entity_type, entity_id, note, actor_person_id, correlation_id)
    values (p_bill_id, 'SHIPMENT_HEADER', r_alloc.shipment_id, p_note, p_actor_person_id, p_correlation_id)
    on conflict do nothing;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'shipment_id', r_alloc.shipment_id,
        'allocated_cost_krw', r_alloc.allocated_cost_krw
      )
    );
  end loop;

  update public.cms_receipt_pricing_snapshot
  set
    applied_at = now(),
    applied_by = p_actor_person_id,
    allocation_json = jsonb_strip_nulls(jsonb_build_object(
      'total_amount_krw', v_total_krw,
      'allocation_method', p_allocation_method,
      'shipments', v_results,
      'correlation_id', p_correlation_id,
      'note', p_note
    )),
    updated_at = now()
  where receipt_id = p_bill_id;

  update public.cms_receipt_inbox
  set status = 'LINKED'::public.cms_e_receipt_status
  where receipt_id = p_bill_id;

  return jsonb_build_object(
    'ok', true,
    'bill_id', p_bill_id,
    'total_amount_krw', v_total_krw,
    'allocations', v_results
  );
end $$;
alter function public.cms_fn_apply_vendor_bill_to_shipments_v1(uuid,jsonb,uuid,text,uuid,boolean,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_apply_vendor_bill_to_shipments_v1(uuid,jsonb,uuid,text,uuid,boolean,text)
  to authenticated, service_role;
create or replace function public.cms_fn_create_repair_v1(
  p_party_id uuid,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_first_id uuid;
  v_new_id uuid;
  r_line record;
begin
  if p_party_id is null then
    raise exception using errcode='P0001', message='party_id required';
  end if;

  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='P0001', message='lines must be json array';
  end if;

  for r_line in
    select
      nullif((e->>'model_name')::text,'') as model_name,
      nullif((e->>'suffix')::text,'') as suffix,
      nullif((e->>'material_code')::text,'') as material_code,
      nullif((e->>'qty')::text,'')::int as qty,
      nullif((e->>'issue_desc')::text,'') as issue_desc,
      nullif((e->>'memo')::text,'') as memo
    from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) e
  loop
    if r_line.model_name is null then
      raise exception using errcode='P0001', message='model_name required';
    end if;
    if r_line.issue_desc is null then
      raise exception using errcode='P0001', message='issue_desc required';
    end if;
    if coalesce(r_line.qty,0) <= 0 then
      raise exception using errcode='P0001', message='qty must be > 0';
    end if;

    insert into public.cms_repair_line(
      customer_party_id,
      received_at,
      model_name,
      suffix,
      material_code,
      qty,
      memo,
      issue_desc,
      status,
      correlation_id
    ) values (
      p_party_id,
      current_date,
      r_line.model_name,
      r_line.suffix,
      r_line.material_code::public.cms_e_material_code,
      r_line.qty,
      coalesce(r_line.memo, p_notes),
      r_line.issue_desc,
      'RECEIVED'::public.cms_e_repair_status,
      p_correlation_id
    )
    returning repair_line_id into v_new_id;

    if v_first_id is null then
      v_first_id := v_new_id;
    end if;
  end loop;

  if v_first_id is null then
    raise exception using errcode='P0001', message='at least one line required';
  end if;

  return v_first_id;
end $$;
alter function public.cms_fn_create_repair_v1(uuid,text,jsonb,uuid,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_create_repair_v1(uuid,text,jsonb,uuid,uuid)
  to authenticated, service_role;
drop function if exists public.cms_fn_set_repair_status_v1(uuid,public.cms_e_repair_status,uuid,text,uuid);
create function public.cms_fn_set_repair_status_v1(
  p_repair_id uuid,
  p_status public.cms_e_repair_status,
  p_actor_person_id uuid default null,
  p_reason text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_repair_id is null then
    raise exception using errcode='P0001', message='repair_id required';
  end if;
  if p_status is null then
    raise exception using errcode='P0001', message='status required';
  end if;

  update public.cms_repair_line
  set status = p_status,
      memo = coalesce(p_reason, memo)
  where repair_line_id = p_repair_id;

  if not found then
    raise exception using errcode='P0001', message='repair not found';
  end if;
end $$;
alter function public.cms_fn_set_repair_status_v1(uuid,public.cms_e_repair_status,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_set_repair_status_v1(uuid,public.cms_e_repair_status,uuid,text,uuid)
  to authenticated, service_role;
create or replace function public.cms_fn_send_repair_to_shipment_v1(
  p_repair_id uuid,
  p_extra_fee_krw numeric default 0,
  p_extra_fee_reason text default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r_repair public.cms_repair_line%rowtype;
  v_shipment_id uuid;
  v_line_id uuid;
begin
  if p_repair_id is null then
    raise exception using errcode='P0001', message='repair_id required';
  end if;

  select * into r_repair
  from public.cms_repair_line
  where repair_line_id = p_repair_id
  for update;

  if r_repair.repair_line_id is null then
    raise exception using errcode='P0001', message='repair not found';
  end if;

  if r_repair.status in ('CANCELLED','SHIPPED','CLOSED') then
    raise exception using errcode='P0001', message='repair not eligible for shipment';
  end if;

  if coalesce(p_extra_fee_krw,0) > 0 and coalesce(nullif(trim(p_extra_fee_reason),''),'') is null then
    raise exception using errcode='P0001', message='extra_fee_reason required when extra_fee_krw > 0';
  end if;

  select shipment_id into v_shipment_id
  from public.cms_shipment_line
  where repair_line_id = p_repair_id
  limit 1;

  if v_shipment_id is not null then
    return v_shipment_id;
  end if;

  v_shipment_id := public.cms_fn_create_shipment_header_v1(
    r_repair.customer_party_id,
    current_date,
    coalesce(p_note, 'repair shipment')
  );

  update public.cms_shipment_header
  set source_type = 'REPAIR',
      source_id = p_repair_id
  where shipment_id = v_shipment_id;

  v_line_id := public.cms_fn_add_shipment_line_from_repair_v1(
    v_shipment_id,
    p_repair_id,
    r_repair.qty,
    'RULE'::public.cms_e_pricing_mode,
    null,
    r_repair.material_code,
    r_repair.is_plated,
    r_repair.plating_variant_id,
    null,
    null,
    coalesce(p_extra_fee_krw,0),
    p_note
  );

  update public.cms_shipment_line
  set repair_fee_reason = p_extra_fee_reason
  where shipment_line_id = v_line_id;

  update public.cms_repair_line
  set status = 'READY_TO_SHIP'::public.cms_e_repair_status,
      repair_fee_krw = coalesce(p_extra_fee_krw,0),
      repair_fee_reason = p_extra_fee_reason
  where repair_line_id = p_repair_id;

  insert into public.cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, note)
  values (
    'REPAIR_LINE',
    p_repair_id,
    'SEND_TO_SHIPMENT',
    jsonb_build_object('status', r_repair.status),
    jsonb_build_object('shipment_id', v_shipment_id, 'extra_fee_krw', p_extra_fee_krw, 'extra_fee_reason', p_extra_fee_reason),
    p_actor_person_id,
    p_note
  );

  return v_shipment_id;
end $$;
alter function public.cms_fn_send_repair_to_shipment_v1(uuid,numeric,text,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_send_repair_to_shipment_v1(uuid,numeric,text,uuid,text,uuid)
  to authenticated, service_role;
