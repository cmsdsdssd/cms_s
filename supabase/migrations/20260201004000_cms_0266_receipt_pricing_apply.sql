set search_path = public, pg_temp;
-- -----------------------------------------------------------------------------
-- cms_0266: Receipt pricing snapshot + worklist view + auto allocation/apply
--
-- 요구사항 정리(핵심):
--  1) 영수증 1장이 여러 출고에 연결될 수 있다.
--  2) 영수증에는 라인이 여러 개일 수 있으나(지금 OCR 없음),
--     운영 편의를 위해 "총합 기반"으로만 입력한다.
--  3) 입력 필드 4개: 중량(weight_g), 기본공임(labor_basic), 기타공임(labor_other), 총금액(total_amount)
--  4) CNY는 CNY만, KRW는 KRW만 입력. 환율을 별도 입력/저장하지 않는다.
--     대신 적용 시점에 cms_market_tick(SILVER_CN_KRW_PER_G) meta의 krw_per_1_adj/raw를 참고해
--     총금액(KRW 환산)을 계산하고, 어떤 tick을 사용했는지 snapshot meta에 남긴다.
--  5) 출고들에 원가를 "자동 배분"한다.
--     - 기준: 출고확정 당시 내부원가 합(= cms_shipment_line.total_amount_cost_krw)
--     - 영수증 총액(KRW 환산)을 출고별/라인별로 비례 배분
--     - cms_fn_apply_purchase_cost_to_shipment_v1(mode='RECEIPT')로 라인 unit_cost_krw를 넣어 ACTUAL 반영
-- -----------------------------------------------------------------------------


-- (A) Receipt pricing snapshot table
create table if not exists public.cms_receipt_pricing_snapshot (
  receipt_id uuid primary key references public.cms_receipt_inbox(receipt_id) on delete cascade,

  -- user input
  currency_code text not null default 'KRW',
  total_amount numeric,
  weight_g numeric,
  labor_basic numeric,
  labor_other numeric,

  -- derived / audit
  total_amount_krw numeric,
  fx_rate_krw_per_unit numeric,
  fx_tick_id uuid references public.cms_market_tick(tick_id),
  meta jsonb not null default '{}'::jsonb,

  -- apply status
  applied_at timestamptz,
  applied_by uuid references public.cms_person(person_id),
  allocation_json jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- columns might already exist if 0264/0265 were applied in another branch
alter table public.cms_receipt_pricing_snapshot
  add column if not exists currency_code text;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists total_amount numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists weight_g numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists labor_basic numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists labor_other numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists total_amount_krw numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists fx_rate_krw_per_unit numeric;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists fx_tick_id uuid;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists meta jsonb;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists applied_at timestamptz;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists applied_by uuid;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists allocation_json jsonb;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists created_at timestamptz;
alter table public.cms_receipt_pricing_snapshot
  add column if not exists updated_at timestamptz;
-- updated_at trigger (reuse existing cms_fn_set_updated_at)
do $$ begin
  create trigger trg_cms_receipt_pricing_snapshot_updated_at
  before update on public.cms_receipt_pricing_snapshot
  for each row execute function public.cms_fn_set_updated_at();
exception when duplicate_object then null; end $$;
grant select, insert, update, delete on public.cms_receipt_pricing_snapshot to anon, authenticated, service_role;
-- (B) Upsert receipt pricing snapshot (compute total_amount_krw when currency=CNY)
create or replace function public.cms_fn_upsert_receipt_pricing_snapshot_v1(
  p_receipt_id uuid,
  p_currency_code text default null,
  p_total_amount numeric default null,
  p_weight_g numeric default null,
  p_labor_basic numeric default null,
  p_labor_other numeric default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_currency text;
  v_total_krw numeric;
  v_fx_rate numeric;
  v_fx_tick_id uuid;
  v_fx_observed_at timestamptz;
  v_fx_field text;
  v_meta jsonb := '{}'::jsonb;
  v_exists int;
begin
  if p_receipt_id is null then
    raise exception using errcode='P0001', message='receipt_id required';
  end if;

  select 1 into v_exists from public.cms_receipt_inbox r where r.receipt_id = p_receipt_id;
  if v_exists is null then
    raise exception using errcode='P0001', message='receipt not found';
  end if;

  -- currency: prefer explicit param, else receipt_inbox.currency_code, else KRW
  select upper(coalesce(nullif(trim(p_currency_code),''), r.currency_code, 'KRW'))
    into v_currency
  from public.cms_receipt_inbox r
  where r.receipt_id = p_receipt_id;

  if v_currency not in ('KRW','CNY') then
    raise exception using errcode='P0001', message='currency_code must be KRW or CNY';
  end if;

  if p_total_amount is not null and p_total_amount < 0 then
    raise exception using errcode='P0001', message='total_amount must be >= 0';
  end if;

  if v_currency = 'KRW' then
    v_total_krw := p_total_amount;
    v_fx_rate := null;
    v_fx_tick_id := null;
    v_fx_observed_at := null;
    v_fx_field := null;
  else
    -- fx from latest SILVER_CN_KRW_PER_G meta: { krw_per_1_adj | krw_per_1_raw }
    select t.tick_id,
           nullif((t.meta->>'krw_per_1_adj')::text,'')::numeric,
           t.observed_at
      into v_fx_tick_id, v_fx_rate, v_fx_observed_at
    from public.cms_market_tick t
    where t.symbol = 'SILVER_CN_KRW_PER_G'::public.cms_e_market_symbol
    order by t.observed_at desc
    limit 1;

    v_fx_field := 'krw_per_1_adj';

    if v_fx_rate is null then
      select nullif((t.meta->>'krw_per_1_raw')::text,'')::numeric
        into v_fx_rate
      from public.cms_market_tick t
      where t.tick_id = v_fx_tick_id;
      v_fx_field := 'krw_per_1_raw';
    end if;

    if v_fx_rate is null then
      raise exception using errcode='P0001', message='FX not available: market tick SILVER_CN_KRW_PER_G missing krw_per_1_adj/raw';
    end if;

    v_total_krw := case when p_total_amount is null then null else round(p_total_amount * v_fx_rate, 0) end;

    v_meta := jsonb_strip_nulls(jsonb_build_object(
      'fx_symbol', 'SILVER_CN_KRW_PER_G',
      'fx_tick_id', v_fx_tick_id,
      'fx_observed_at', v_fx_observed_at,
      'fx_field', v_fx_field,
      'fx_rate_krw_per_1', v_fx_rate,
      'correlation_id', p_correlation_id,
      'note', p_note
    ));
  end if;

  insert into public.cms_receipt_pricing_snapshot(
    receipt_id, currency_code, total_amount, weight_g, labor_basic, labor_other,
    total_amount_krw, fx_rate_krw_per_unit, fx_tick_id, meta
  ) values (
    p_receipt_id, v_currency, p_total_amount, p_weight_g, p_labor_basic, p_labor_other,
    v_total_krw, v_fx_rate, v_fx_tick_id, coalesce(v_meta,'{}'::jsonb)
  )
  on conflict (receipt_id) do update set
    currency_code = excluded.currency_code,
    total_amount = excluded.total_amount,
    weight_g = excluded.weight_g,
    labor_basic = excluded.labor_basic,
    labor_other = excluded.labor_other,
    total_amount_krw = excluded.total_amount_krw,
    fx_rate_krw_per_unit = excluded.fx_rate_krw_per_unit,
    fx_tick_id = excluded.fx_tick_id,
    meta = coalesce(public.cms_receipt_pricing_snapshot.meta,'{}'::jsonb) || coalesce(excluded.meta,'{}'::jsonb),
    updated_at = now();

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'currency_code', v_currency,
    'total_amount', p_total_amount,
    'total_amount_krw', v_total_krw,
    'fx_tick_id', v_fx_tick_id,
    'fx_rate_krw_per_unit', v_fx_rate
  ));
end $$;
alter function public.cms_fn_upsert_receipt_pricing_snapshot_v1(uuid,text,numeric,numeric,numeric,numeric,uuid,text,uuid)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_upsert_receipt_pricing_snapshot_v1(uuid,text,numeric,numeric,numeric,numeric,uuid,text,uuid)
  to anon, authenticated, service_role;
-- (C) Apply receipt total to linked shipments by proportional allocation
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
  v_ship_ids uuid[];
  v_ship_id uuid;
  v_basis numeric;
  v_total_basis numeric := 0;
  v_remaining_krw numeric;
  v_remaining_basis numeric;
  v_alloc numeric;
  v_ship_cnt int := 0;
  v_line_cnt int := 0;
  v_allocations jsonb := '[]'::jsonb;
  v_shipment_alloc jsonb;
  v_cost_lines jsonb;
  v_apply_result jsonb;
  v_applied_at timestamptz := now();
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

  v_total_krw := coalesce(v_snap.total_amount_krw, case when upper(v_snap.currency_code)='KRW' then v_snap.total_amount else null end);
  if v_total_krw is null or v_total_krw <= 0 then
    raise exception using errcode='P0001', message='total_amount_krw is required (save total amount first)';
  end if;

  if v_snap.applied_at is not null and not p_force then
    raise exception using errcode='P0001', message='already applied (use force=true to re-apply)';
  end if;

  -- linked shipments: from receipt_usage (SHIPMENT_HEADER or SHIPMENT_LINE)
  select array_agg(distinct shipment_id)
    into v_ship_ids
  from (
    select case
             when u.entity_type='SHIPMENT_HEADER' then u.entity_id
             when u.entity_type='SHIPMENT_LINE' then sl.shipment_id
             else null
           end as shipment_id
    from public.cms_receipt_usage u
    left join public.cms_shipment_line sl
      on sl.shipment_line_id = u.entity_id
     and u.entity_type='SHIPMENT_LINE'
    where u.receipt_id = p_receipt_id
      and u.entity_type in ('SHIPMENT_HEADER','SHIPMENT_LINE')
  ) x
  where shipment_id is not null;

  if v_ship_ids is null or array_length(v_ship_ids,1) is null then
    raise exception using errcode='P0001', message='no linked shipments for this receipt';
  end if;

  -- compute total basis across shipments
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

  -- allocate per shipment (stable order by uuid text)
  for v_ship_id in
    select unnest(v_ship_ids) as shipment_id
    order by shipment_id::text asc
  loop
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

    -- allocate (progressive remainder to guarantee exact sum)
    if v_remaining_basis <= 0 then
      v_alloc := v_remaining_krw;
    else
      v_alloc := round(v_remaining_krw * v_basis / v_remaining_basis, 0);
    end if;

    v_remaining_krw := v_remaining_krw - v_alloc;
    v_remaining_basis := v_remaining_basis - v_basis;

    -- build cost_lines inside this shipment by proportional allocation across lines
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
        -- NOTE: per-line total allocation (KRW)
        case
          when lb.total_basis <= 0 then 0
          else round(v_alloc * s.basis / lb.total_basis, 0)
        end as alloc_total_krw
      from line_src s
      cross join line_basis lb
    ),
    line_fix as (
      -- fix rounding remainders by pushing delta into the max-basis line
      select
        a.*,
        (v_alloc - coalesce(sum(a.alloc_total_krw) over (),0)) as delta
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

    -- line count for stats
    select count(*) into v_line_cnt from public.cms_shipment_line sl where sl.shipment_id = v_ship_id;
    v_line_cnt := coalesce(v_line_cnt,0);

    -- apply to shipment (updates shipment_line + inventory_move_line)
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

    v_allocations := v_allocations || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'shipment_id', v_ship_id,
        'basis', v_basis,
        'allocated_krw', v_alloc,
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
-- (D) Receipt worklist view (one row per receipt)
-- NOTE: Postgres cannot change view column names/order via CREATE OR REPLACE
-- so we DROP and recreate to avoid: "cannot change name of view column ..."

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
