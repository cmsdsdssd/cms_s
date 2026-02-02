set search_path = public, pg_temp;

do $$ begin
  create type cms_e_commodity_type as enum ('gold','silver');
exception when duplicate_object then null; end $$;

create table if not exists public.cms_ar_invoice (
  ar_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.cms_party(party_id),
  shipment_id uuid references public.cms_shipment_header(shipment_id),
  shipment_line_id uuid references public.cms_shipment_line(shipment_line_id),
  occurred_at timestamptz not null,

  labor_cash_due_krw numeric not null default 0,
  commodity_type cms_e_commodity_type null,
  commodity_due_g numeric(18,6) not null default 0,
  commodity_price_snapshot_krw_per_g numeric not null default 0,
  material_cash_due_krw numeric not null default 0,
  total_cash_due_krw numeric not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists idx_cms_ar_invoice_party_occurred
  on public.cms_ar_invoice(party_id, occurred_at);

create index if not exists idx_cms_ar_invoice_shipment_line
  on public.cms_ar_invoice(shipment_line_id);

create table if not exists public.cms_ar_payment (
  payment_id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.cms_party(party_id),
  paid_at timestamptz not null,
  cash_krw numeric not null default 0,
  gold_g numeric(18,6) not null default 0,
  silver_g numeric(18,6) not null default 0,
  note text,
  created_by uuid references public.cms_person(person_id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint cms_ar_payment_cash_nonnegative check (cash_krw >= 0),
  constraint cms_ar_payment_gold_nonnegative check (gold_g >= 0),
  constraint cms_ar_payment_silver_nonnegative check (silver_g >= 0)
);

create unique index if not exists idx_cms_ar_payment_party_idempotency
  on public.cms_ar_payment(party_id, idempotency_key);

create index if not exists idx_cms_ar_payment_party_paid_at
  on public.cms_ar_payment(party_id, paid_at desc);

create table if not exists public.cms_ar_payment_alloc (
  alloc_id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.cms_ar_payment(payment_id) on delete cascade,
  ar_id uuid not null references public.cms_ar_invoice(ar_id) on delete cascade,
  alloc_cash_krw numeric not null default 0,
  alloc_gold_g numeric(18,6) not null default 0,
  alloc_silver_g numeric(18,6) not null default 0,
  alloc_value_krw numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint cms_ar_payment_alloc_cash_nonnegative check (alloc_cash_krw >= 0),
  constraint cms_ar_payment_alloc_gold_nonnegative check (alloc_gold_g >= 0),
  constraint cms_ar_payment_alloc_silver_nonnegative check (alloc_silver_g >= 0),
  constraint cms_ar_payment_alloc_value_nonnegative check (alloc_value_krw >= 0)
);

create index if not exists idx_cms_ar_payment_alloc_payment
  on public.cms_ar_payment_alloc(payment_id);

create index if not exists idx_cms_ar_payment_alloc_ar
  on public.cms_ar_payment_alloc(ar_id);

alter table public.cms_ar_invoice enable row level security;
alter table public.cms_ar_payment enable row level security;
alter table public.cms_ar_payment_alloc enable row level security;

drop policy if exists cms_select_authenticated on public.cms_ar_invoice;
drop policy if exists cms_select_authenticated on public.cms_ar_payment;
drop policy if exists cms_select_authenticated on public.cms_ar_payment_alloc;

create policy cms_select_authenticated on public.cms_ar_invoice
  for select to authenticated using (true);

create policy cms_select_anon on public.cms_ar_invoice
  for select to anon using (true);

create policy cms_select_authenticated on public.cms_ar_payment
  for select to authenticated using (true);

create policy cms_select_anon on public.cms_ar_payment
  for select to anon using (true);

create policy cms_select_authenticated on public.cms_ar_payment_alloc
  for select to authenticated using (true);

create policy cms_select_anon on public.cms_ar_payment_alloc
  for select to anon using (true);

grant select on public.cms_ar_invoice to authenticated;
grant select on public.cms_ar_payment to authenticated;
grant select on public.cms_ar_payment_alloc to authenticated;

grant select on public.cms_ar_invoice to anon;
grant select on public.cms_ar_payment to anon;
grant select on public.cms_ar_payment_alloc to anon;

create or replace view public.cms_v_ar_invoice_position_v1
with (security_invoker = true)
as
with alloc as (
  select
    ar_id,
    coalesce(sum(alloc_cash_krw), 0) as alloc_cash_krw,
    coalesce(sum(alloc_gold_g), 0) as alloc_gold_g,
    coalesce(sum(alloc_silver_g), 0) as alloc_silver_g,
    coalesce(sum(alloc_value_krw), 0) as alloc_value_krw
  from public.cms_ar_payment_alloc
  group by ar_id
), returns as (
  select
    shipment_line_id,
    coalesce(sum(final_return_amount_krw), 0) as return_amount_krw
  from public.cms_return_line
  group by shipment_line_id
)
select
  i.ar_id,
  i.party_id,
  i.shipment_id,
  i.shipment_line_id,
  i.occurred_at,
  i.labor_cash_due_krw,
  i.commodity_type,
  i.commodity_due_g,
  i.commodity_price_snapshot_krw_per_g,
  i.material_cash_due_krw,
  i.total_cash_due_krw,
  i.created_at,

  sl.model_name,
  sl.suffix,
  sl.color,
  sl.size,
  sl.qty,

  coalesce(a.alloc_cash_krw, 0) as alloc_cash_krw,
  coalesce(a.alloc_gold_g, 0) as alloc_gold_g,
  coalesce(a.alloc_silver_g, 0) as alloc_silver_g,
  coalesce(a.alloc_value_krw, 0) as alloc_value_krw,
  coalesce(r.return_amount_krw, 0) as return_amount_krw,

  case
    when coalesce(i.total_cash_due_krw, 0) > 0
      then coalesce(r.return_amount_krw, 0) * (coalesce(i.labor_cash_due_krw, 0) / i.total_cash_due_krw)
    else 0
  end as labor_return_krw,
  case
    when coalesce(i.total_cash_due_krw, 0) > 0
      then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
    else 0
  end as material_return_krw,
  case
    when coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0
      then (
        case
          when coalesce(i.total_cash_due_krw, 0) > 0
            then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
          else 0
        end
      ) / i.commodity_price_snapshot_krw_per_g
    else 0
  end as return_commodity_g,

  greatest(
    coalesce(i.labor_cash_due_krw, 0)
    - coalesce(a.alloc_cash_krw, 0)
    - (
      case
        when coalesce(i.total_cash_due_krw, 0) > 0
          then coalesce(r.return_amount_krw, 0) * (coalesce(i.labor_cash_due_krw, 0) / i.total_cash_due_krw)
        else 0
      end
    ),
    0
  ) as labor_cash_outstanding_krw,

  greatest(
    coalesce(i.material_cash_due_krw, 0)
    - coalesce(a.alloc_value_krw, 0)
    - (
      case
        when coalesce(i.total_cash_due_krw, 0) > 0
          then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
        else 0
      end
    )
    - greatest(coalesce(a.alloc_cash_krw, 0) - coalesce(i.labor_cash_due_krw, 0), 0),
    0
  ) as material_cash_outstanding_krw,

  case
    when i.commodity_type = 'gold' then
      greatest(
        coalesce(i.commodity_due_g, 0) - coalesce(a.alloc_gold_g, 0) - (
          case
            when coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0
              then (
                case
                  when coalesce(i.total_cash_due_krw, 0) > 0
                    then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
                  else 0
                end
              ) / i.commodity_price_snapshot_krw_per_g
            else 0
          end
        ),
        0
      )
    when i.commodity_type = 'silver' then
      greatest(
        coalesce(i.commodity_due_g, 0) - coalesce(a.alloc_silver_g, 0) - (
          case
            when coalesce(i.commodity_price_snapshot_krw_per_g, 0) > 0
              then (
                case
                  when coalesce(i.total_cash_due_krw, 0) > 0
                    then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
                  else 0
                end
              ) / i.commodity_price_snapshot_krw_per_g
            else 0
          end
        ),
        0
      )
    else 0
  end as commodity_outstanding_g,

  greatest(
    coalesce(i.labor_cash_due_krw, 0)
    - coalesce(a.alloc_cash_krw, 0)
    - (
      case
        when coalesce(i.total_cash_due_krw, 0) > 0
          then coalesce(r.return_amount_krw, 0) * (coalesce(i.labor_cash_due_krw, 0) / i.total_cash_due_krw)
        else 0
      end
    ),
    0
  )
  + greatest(
    coalesce(i.material_cash_due_krw, 0)
    - coalesce(a.alloc_value_krw, 0)
    - (
      case
        when coalesce(i.total_cash_due_krw, 0) > 0
          then coalesce(r.return_amount_krw, 0) * (coalesce(i.material_cash_due_krw, 0) / i.total_cash_due_krw)
        else 0
      end
    )
    - greatest(coalesce(a.alloc_cash_krw, 0) - coalesce(i.labor_cash_due_krw, 0), 0),
    0
  ) as total_cash_outstanding_krw
from public.cms_ar_invoice i
left join alloc a on a.ar_id = i.ar_id
left join returns r on r.shipment_line_id = i.shipment_line_id
left join public.cms_shipment_line sl on sl.shipment_line_id = i.shipment_line_id;

create or replace view public.cms_v_ar_position_by_party_v2
with (security_invoker = true)
as
select
  b.party_id,
  b.party_type,
  b.name,
  b.balance_krw,
  greatest(b.balance_krw, 0) as receivable_krw,
  greatest(-b.balance_krw, 0) as credit_krw,
  b.last_activity_at,
  coalesce(sum(p.labor_cash_outstanding_krw), 0) as labor_cash_outstanding_krw,
  coalesce(sum(p.material_cash_outstanding_krw), 0) as material_cash_outstanding_krw,
  coalesce(sum(p.total_cash_outstanding_krw), 0) as total_cash_outstanding_krw,
  coalesce(sum(case when p.commodity_type = 'gold' then p.commodity_outstanding_g else 0 end), 0) as gold_outstanding_g,
  coalesce(sum(case when p.commodity_type = 'silver' then p.commodity_outstanding_g else 0 end), 0) as silver_outstanding_g
from public.cms_v_ar_balance_by_party b
left join public.cms_v_ar_invoice_position_v1 p on p.party_id = b.party_id
group by b.party_id, b.party_type, b.name, b.balance_krw, b.last_activity_at;

create or replace view public.cms_v_ar_payment_alloc_detail_v1
with (security_invoker = true)
as
select
  p.payment_id,
  p.party_id,
  p.paid_at,
  p.cash_krw,
  p.gold_g,
  p.silver_g,
  p.note,
  p.created_at as payment_created_at,
  a.alloc_id,
  a.ar_id,
  a.alloc_cash_krw,
  a.alloc_gold_g,
  a.alloc_silver_g,
  a.alloc_value_krw,
  a.created_at as alloc_created_at,
  i.shipment_id,
  i.shipment_line_id,
  i.occurred_at as invoice_occurred_at,
  i.commodity_type,
  i.commodity_price_snapshot_krw_per_g,
  sl.model_name,
  sl.suffix,
  sl.color,
  sl.size
from public.cms_ar_payment p
left join public.cms_ar_payment_alloc a on a.payment_id = p.payment_id
left join public.cms_ar_invoice i on i.ar_id = a.ar_id
left join public.cms_shipment_line sl on sl.shipment_line_id = i.shipment_line_id;

grant select on public.cms_v_ar_invoice_position_v1 to authenticated;
grant select on public.cms_v_ar_position_by_party_v2 to authenticated;
grant select on public.cms_v_ar_payment_alloc_detail_v1 to authenticated;

grant select on public.cms_v_ar_invoice_position_v1 to anon;
grant select on public.cms_v_ar_position_by_party_v2 to anon;
grant select on public.cms_v_ar_payment_alloc_detail_v1 to anon;

create or replace function public.cms_fn_ar_create_from_shipment_confirm_v1(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_hdr public.cms_shipment_header%rowtype;
  v_valuation public.cms_shipment_valuation%rowtype;
  v_inserted int := 0;
begin
  select * into v_hdr
  from public.cms_shipment_header
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment not found: %', p_shipment_id;
  end if;

  if v_hdr.confirmed_at is null then
    raise exception 'shipment not confirmed: %', p_shipment_id;
  end if;

  select * into v_valuation
  from public.cms_shipment_valuation
  where shipment_id = p_shipment_id;

  if not found then
    raise exception 'shipment valuation not found: %', p_shipment_id;
  end if;

  insert into public.cms_ar_invoice(
    party_id,
    shipment_id,
    shipment_line_id,
    occurred_at,
    labor_cash_due_krw,
    commodity_type,
    commodity_due_g,
    commodity_price_snapshot_krw_per_g,
    material_cash_due_krw,
    total_cash_due_krw
  )
  select
    v_hdr.customer_party_id,
    p_shipment_id,
    sl.shipment_line_id,
    v_hdr.confirmed_at,
    greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0),
    case
      when sl.material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
      when sl.material_code = '925' then 'silver'::cms_e_commodity_type
      else null
    end,
    case
      when sl.material_code = '14' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
      when sl.material_code = '18' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
      when sl.material_code = '24' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
      when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
      else 0
    end,
    case
      when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
      when sl.material_code = '925' then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
      else 0
    end,
    (
      case
        when sl.material_code = '14' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
        when sl.material_code = '18' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
        when sl.material_code = '24' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
        when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
        else 0
      end
      *
      case
        when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when sl.material_code = '925' then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end
    ),
    (
      greatest(coalesce(sl.total_amount_sell_krw, 0) - coalesce(sl.material_amount_sell_krw, 0), 0)
      +
      (
        case
          when sl.material_code = '14' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.6435
          when sl.material_code = '18' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.825
          when sl.material_code = '24' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0))
          when sl.material_code = '925' then coalesce(sl.net_weight_g, greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)) * 0.925
          else 0
        end
        *
        case
          when sl.material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
          when sl.material_code = '925' then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
          else 0
        end
      )
    )
  from public.cms_shipment_line sl
  where sl.shipment_id = p_shipment_id
    and not exists (
      select 1 from public.cms_ar_invoice ai
      where ai.shipment_line_id = sl.shipment_line_id
    );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'inserted', v_inserted
  );
end $$;

alter function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid) to authenticated;

create or replace function public.cms_fn_confirm_shipment_v2(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_emit uuid;
  v_corr uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  v_result := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  perform public.cms_fn_ar_create_from_shipment_confirm_v1(p_shipment_id);

  if p_emit_inventory then
    v_emit := public.cms_fn_emit_inventory_issue_from_shipment_confirmed_v2(
      p_shipment_id,
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

alter function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_confirm_shipment_v2(uuid,uuid,text,boolean,uuid)
  to authenticated;

create or replace function public.cms_fn_ar_apply_payment_fifo_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_cash_krw numeric default 0,
  p_gold_g numeric default 0,
  p_silver_g numeric default 0,
  p_paid_at timestamptz default now(),
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_cash_remaining numeric := coalesce(p_cash_krw, 0);
  v_gold_remaining numeric := coalesce(p_gold_g, 0);
  v_silver_remaining numeric := coalesce(p_silver_g, 0);

  v_alloc_cash_total numeric := 0;
  v_alloc_gold_total numeric := 0;
  v_alloc_silver_total numeric := 0;
  v_alloc_value_total numeric := 0;

  v_cash_for_labor numeric;
  v_cash_for_material numeric;
  v_alloc_value numeric;

  r_invoice record;
begin
  if p_party_id is null then
    raise exception 'party_id is required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key is required';
  end if;

  if v_cash_remaining < 0 or v_gold_remaining < 0 or v_silver_remaining < 0 then
    raise exception 'payment values must be non-negative';
  end if;

  if v_cash_remaining = 0 and v_gold_remaining = 0 and v_silver_remaining = 0 then
    raise exception 'at least one payment value is required';
  end if;

  select payment_id
    into v_existing_payment_id
  from public.cms_ar_payment
  where party_id = p_party_id
    and idempotency_key = p_idempotency_key;

  if v_existing_payment_id is not null then
    return jsonb_build_object(
      'ok', true,
      'payment_id', v_existing_payment_id,
      'duplicate', true
    );
  end if;

  insert into public.cms_ar_payment(
    party_id,
    paid_at,
    cash_krw,
    gold_g,
    silver_g,
    note,
    created_by,
    idempotency_key
  )
  values (
    p_party_id,
    v_paid_at,
    v_cash_remaining,
    v_gold_remaining,
    v_silver_remaining,
    p_note,
    auth.uid(),
    p_idempotency_key
  )
  returning payment_id into v_payment_id;

  for r_invoice in
    select ar_id, commodity_outstanding_g, commodity_price_snapshot_krw_per_g
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'gold'
      and commodity_outstanding_g > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_gold_remaining <= 0;
    v_alloc_value := least(v_gold_remaining, r_invoice.commodity_outstanding_g);
    insert into public.cms_ar_payment_alloc(
      payment_id,
      ar_id,
      alloc_gold_g,
      alloc_value_krw
    )
    values (
      v_payment_id,
      r_invoice.ar_id,
      v_alloc_value,
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0)
    );
    v_alloc_gold_total := v_alloc_gold_total + v_alloc_value;
    v_alloc_value_total := v_alloc_value_total + (v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0));
    v_gold_remaining := v_gold_remaining - v_alloc_value;
  end loop;

  if v_gold_remaining > 0 then
    raise exception 'gold_g exceeds outstanding';
  end if;

  for r_invoice in
    select ar_id, commodity_outstanding_g, commodity_price_snapshot_krw_per_g
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'silver'
      and commodity_outstanding_g > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_silver_remaining <= 0;
    v_alloc_value := least(v_silver_remaining, r_invoice.commodity_outstanding_g);
    insert into public.cms_ar_payment_alloc(
      payment_id,
      ar_id,
      alloc_silver_g,
      alloc_value_krw
    )
    values (
      v_payment_id,
      r_invoice.ar_id,
      v_alloc_value,
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0)
    );
    v_alloc_silver_total := v_alloc_silver_total + v_alloc_value;
    v_alloc_value_total := v_alloc_value_total + (v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0));
    v_silver_remaining := v_silver_remaining - v_alloc_value;
  end loop;

  if v_silver_remaining > 0 then
    raise exception 'silver_g exceeds outstanding';
  end if;

  for r_invoice in
    select ar_id, labor_cash_outstanding_krw, material_cash_outstanding_krw
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and total_cash_outstanding_krw > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_cash_remaining <= 0;

    v_cash_for_labor := least(v_cash_remaining, coalesce(r_invoice.labor_cash_outstanding_krw, 0));
    v_cash_remaining := v_cash_remaining - v_cash_for_labor;

    v_cash_for_material := 0;
    if v_cash_remaining > 0 then
      v_cash_for_material := least(v_cash_remaining, coalesce(r_invoice.material_cash_outstanding_krw, 0));
      v_cash_remaining := v_cash_remaining - v_cash_for_material;
    end if;

    if (v_cash_for_labor + v_cash_for_material) > 0 then
      insert into public.cms_ar_payment_alloc(
        payment_id,
        ar_id,
        alloc_cash_krw
      )
      values (
        v_payment_id,
        r_invoice.ar_id,
        v_cash_for_labor + v_cash_for_material
      );
      v_alloc_cash_total := v_alloc_cash_total + v_cash_for_labor + v_cash_for_material;
    end if;
  end loop;

  insert into public.cms_ar_ledger(
    party_id,
    occurred_at,
    entry_type,
    amount_krw,
    payment_id,
    memo
  )
  values (
    p_party_id,
    v_paid_at,
    'PAYMENT',
    -round(coalesce(p_cash_krw, 0) + v_alloc_value_total, 0),
    v_payment_id,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'applied_cash_krw', v_alloc_cash_total,
    'applied_gold_g', v_alloc_gold_total,
    'applied_silver_g', v_alloc_silver_total,
    'applied_value_krw', v_alloc_value_total,
    'remaining_cash_krw', v_cash_remaining
  );
end $$;

alter function public.cms_fn_ar_apply_payment_fifo_v1(uuid,text,numeric,numeric,numeric,timestamptz,text)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ar_apply_payment_fifo_v1(uuid,text,numeric,numeric,numeric,timestamptz,text)
  to authenticated;
