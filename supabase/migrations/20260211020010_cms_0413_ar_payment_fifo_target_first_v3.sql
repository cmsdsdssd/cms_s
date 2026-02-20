-- cms_0402: AR payment FIFO v3 with optional TARGET_FIRST allocation mode (add-only)

create or replace function public.cms_fn_ar_apply_payment_fifo_v3(
  p_party_id uuid,
  p_idempotency_key text,
  p_cash_krw numeric default 0,
  p_gold_g numeric default 0,
  p_silver_g numeric default 0,
  p_allow_cash_for_material boolean default false,
  p_allocation_mode text default 'GLOBAL_FIFO',
  p_target_ar_ids uuid[] default null,
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
  v_cash_remaining numeric := round(coalesce(p_cash_krw, 0), 6);
  v_gold_remaining numeric := round(coalesce(p_gold_g, 0), 6);
  v_silver_remaining numeric := round(coalesce(p_silver_g, 0), 6);
  v_gold_outstanding numeric := 0;
  v_silver_outstanding numeric := 0;
  v_epsilon numeric := 0.0001;

  v_alloc_cash_total numeric := 0;
  v_alloc_gold_total numeric := 0;
  v_alloc_silver_total numeric := 0;
  v_alloc_value_total numeric := 0;

  v_cash_for_labor numeric;
  v_cash_for_material_target numeric;
  v_cash_for_material numeric;
  v_alloc_commodity_g numeric;
  v_alloc_value numeric;
  v_mode text := upper(coalesce(p_allocation_mode, 'GLOBAL_FIFO'));

  r_invoice record;
begin
  if p_party_id is null then
    raise exception 'party_id is required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key is required';
  end if;

  if v_mode not in ('GLOBAL_FIFO', 'TARGET_FIRST') then
    raise exception 'allocation_mode must be GLOBAL_FIFO or TARGET_FIRST';
  end if;

  if v_mode = 'TARGET_FIRST' and (p_target_ar_ids is null or cardinality(p_target_ar_ids) = 0) then
    raise exception 'target_ar_ids are required for TARGET_FIRST mode';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_target_ar_ids, '{}')) as t(ar_id)
    left join public.cms_ar_invoice i on i.ar_id = t.ar_id
    where i.ar_id is null or i.party_id <> p_party_id
  ) then
    raise exception 'target_ar_ids contain invalid invoice ids for this party';
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
      'duplicate', true,
      'allocation_mode', v_mode
    );
  end if;

  select
    round(coalesce(sum(case when commodity_type = 'gold' then commodity_outstanding_g else 0 end), 0), 6),
    round(coalesce(sum(case when commodity_type = 'silver' then commodity_outstanding_g else 0 end), 0), 6)
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

  -- Commodity payment pass (gold)
  for r_invoice in
    select ar_id, commodity_outstanding_g, commodity_price_snapshot_krw_per_g
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'gold'
      and commodity_outstanding_g > 0
    order by
      case
        when v_mode = 'TARGET_FIRST' and p_target_ar_ids is not null and ar_id = any(p_target_ar_ids) then 0
        else 1
      end,
      occurred_at,
      created_at,
      ar_id
  loop
    exit when v_gold_remaining <= v_epsilon;
    v_alloc_value := least(v_gold_remaining, r_invoice.commodity_outstanding_g);
    insert into public.cms_ar_payment_alloc(
      payment_id,
      ar_id,
      alloc_gold_g,
      alloc_value_krw,
      alloc_material_krw
    )
    values (
      v_payment_id,
      r_invoice.ar_id,
      v_alloc_value,
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0),
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0)
    );
    v_alloc_gold_total := v_alloc_gold_total + v_alloc_value;
    v_alloc_value_total := v_alloc_value_total + (v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0));
    v_gold_remaining := round(v_gold_remaining - v_alloc_value, 6);
  end loop;

  if v_gold_remaining > v_epsilon then
    raise exception 'gold_g exceeds outstanding';
  end if;

  -- Commodity payment pass (silver)
  for r_invoice in
    select ar_id, commodity_outstanding_g, commodity_price_snapshot_krw_per_g
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and commodity_type = 'silver'
      and commodity_outstanding_g > 0
    order by
      case
        when v_mode = 'TARGET_FIRST' and p_target_ar_ids is not null and ar_id = any(p_target_ar_ids) then 0
        else 1
      end,
      occurred_at,
      created_at,
      ar_id
  loop
    exit when v_silver_remaining <= v_epsilon;
    v_alloc_value := least(v_silver_remaining, r_invoice.commodity_outstanding_g);
    insert into public.cms_ar_payment_alloc(
      payment_id,
      ar_id,
      alloc_silver_g,
      alloc_value_krw,
      alloc_material_krw
    )
    values (
      v_payment_id,
      r_invoice.ar_id,
      v_alloc_value,
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0),
      v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0)
    );
    v_alloc_silver_total := v_alloc_silver_total + v_alloc_value;
    v_alloc_value_total := v_alloc_value_total + (v_alloc_value * coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0));
    v_silver_remaining := round(v_silver_remaining - v_alloc_value, 6);
  end loop;

  if v_silver_remaining > v_epsilon then
    raise exception 'silver_g exceeds outstanding';
  end if;

  -- Cash pass #1: labor only (global FIFO or target-first FIFO)
  for r_invoice in
    select ar_id, labor_cash_outstanding_krw
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and labor_cash_outstanding_krw > 0
    order by
      case
        when v_mode = 'TARGET_FIRST' and p_target_ar_ids is not null and ar_id = any(p_target_ar_ids) then 0
        else 1
      end,
      occurred_at,
      created_at,
      ar_id
  loop
    exit when v_cash_remaining <= 0;

    v_cash_for_labor := least(v_cash_remaining, coalesce(r_invoice.labor_cash_outstanding_krw, 0));
    if v_cash_for_labor <= 0 then
      continue;
    end if;

    v_cash_remaining := round(v_cash_remaining - v_cash_for_labor, 6);

    insert into public.cms_ar_payment_alloc(
      payment_id,
      ar_id,
      alloc_cash_krw,
      alloc_labor_krw
    )
    values (
      v_payment_id,
      r_invoice.ar_id,
      v_cash_for_labor,
      v_cash_for_labor
    );

    v_alloc_cash_total := v_alloc_cash_total + v_cash_for_labor;
  end loop;

  -- Cash pass #2: material (optional)
  if p_allow_cash_for_material then
    for r_invoice in
      select
        ar_id,
        material_cash_outstanding_krw,
        commodity_type,
        commodity_outstanding_g,
        commodity_price_snapshot_krw_per_g
      from public.cms_v_ar_invoice_position_v1
      where party_id = p_party_id
        and material_cash_outstanding_krw > 0
      order by
        case
          when v_mode = 'TARGET_FIRST' and p_target_ar_ids is not null and ar_id = any(p_target_ar_ids) then 0
          else 1
        end,
        occurred_at,
        created_at,
        ar_id
    loop
      exit when v_cash_remaining <= 0;

      v_cash_for_material_target := least(v_cash_remaining, coalesce(r_invoice.material_cash_outstanding_krw, 0));
      if v_cash_for_material_target <= 0 then
        continue;
      end if;

      v_cash_for_material := v_cash_for_material_target;
      v_alloc_commodity_g := 0;

      if r_invoice.commodity_type in ('gold', 'silver')
         and coalesce(r_invoice.commodity_price_snapshot_krw_per_g, 0) > 0
         and coalesce(r_invoice.commodity_outstanding_g, 0) > 0
      then
        v_alloc_commodity_g := least(
          coalesce(r_invoice.commodity_outstanding_g, 0),
          round(v_cash_for_material_target / r_invoice.commodity_price_snapshot_krw_per_g, 6)
        );
        v_cash_for_material := round(v_alloc_commodity_g * r_invoice.commodity_price_snapshot_krw_per_g, 6);
      end if;

      if v_cash_for_material <= 0 then
        continue;
      end if;

      v_cash_remaining := round(v_cash_remaining - v_cash_for_material, 6);

      insert into public.cms_ar_payment_alloc(
        payment_id,
        ar_id,
        alloc_cash_krw,
        alloc_material_krw,
        alloc_gold_g,
        alloc_silver_g
      )
      values (
        v_payment_id,
        r_invoice.ar_id,
        v_cash_for_material,
        v_cash_for_material,
        case when r_invoice.commodity_type = 'gold' then v_alloc_commodity_g else 0 end,
        case when r_invoice.commodity_type = 'silver' then v_alloc_commodity_g else 0 end
      );

      v_alloc_cash_total := v_alloc_cash_total + v_cash_for_material;
      if r_invoice.commodity_type = 'gold' then
        v_alloc_gold_total := v_alloc_gold_total + v_alloc_commodity_g;
      elsif r_invoice.commodity_type = 'silver' then
        v_alloc_silver_total := v_alloc_silver_total + v_alloc_commodity_g;
      end if;
    end loop;
  end if;

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
    'remaining_cash_krw', v_cash_remaining,
    'allow_cash_for_material', p_allow_cash_for_material,
    'allocation_mode', v_mode,
    'target_count', coalesce(cardinality(p_target_ar_ids), 0)
  );
end $$;
alter function public.cms_fn_ar_apply_payment_fifo_v3(uuid,text,numeric,numeric,numeric,boolean,text,uuid[],timestamptz,text)
  security definer
  set search_path = public, pg_temp;
grant execute on function public.cms_fn_ar_apply_payment_fifo_v3(uuid,text,numeric,numeric,numeric,boolean,text,uuid[],timestamptz,text)
  to authenticated;
