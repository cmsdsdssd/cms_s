set search_path = public, pg_temp;

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
  ) as total_cash_outstanding_krw,
  sl.material_code as material_code
from public.cms_ar_invoice i
left join alloc a on a.ar_id = i.ar_id
left join returns r on r.shipment_line_id = i.shipment_line_id
left join public.cms_shipment_line sl on sl.shipment_line_id = i.shipment_line_id;

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
  v_gold_outstanding numeric := 0;
  v_silver_outstanding numeric := 0;
  v_epsilon numeric := 0.000001;

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

  select
    coalesce(sum(case when commodity_type = 'gold' then commodity_outstanding_g else 0 end), 0),
    coalesce(sum(case when commodity_type = 'silver' then commodity_outstanding_g else 0 end), 0)
  into v_gold_outstanding, v_silver_outstanding
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  if v_gold_remaining > v_gold_outstanding + v_epsilon then
    raise exception 'gold_g exceeds outstanding';
  end if;

  if v_silver_remaining > v_silver_outstanding + v_epsilon then
    raise exception 'silver_g exceeds outstanding';
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
    exit when v_gold_remaining <= v_epsilon;
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

  if v_gold_remaining > v_epsilon then
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
    exit when v_silver_remaining <= v_epsilon;
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

  if v_silver_remaining > v_epsilon then
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

  insert into public.cms_payment_header(
    payment_id,
    party_id,
    paid_at,
    memo,
    total_amount_krw
  )
  values (
    v_payment_id,
    p_party_id,
    v_paid_at,
    p_note,
    round(coalesce(p_cash_krw, 0) + v_alloc_value_total, 0)
  )
  on conflict (payment_id) do update
    set total_amount_krw = excluded.total_amount_krw,
        memo = excluded.memo,
        paid_at = excluded.paid_at,
        party_id = excluded.party_id;

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
