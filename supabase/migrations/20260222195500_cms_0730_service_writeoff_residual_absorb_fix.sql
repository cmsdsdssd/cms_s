-- cms_0730: absorb tiny residuals in service writeoff allocation
-- Fixes false failure like: service_writeoff allocation incomplete. remaining=0.439999...

begin;

create or replace function public.cms_fn_ar_apply_service_writeoff_under_limit_v1(
  p_party_id uuid,
  p_idempotency_key text,
  p_limit_krw numeric default 1000,
  p_occurred_at timestamptz default null,
  p_reason_detail text default null,
  p_actor_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := coalesce(nullif(trim(p_idempotency_key), ''), '');
  v_limit numeric := coalesce(p_limit_krw, 1000);
  v_at timestamptz := coalesce(p_occurred_at, now());
  v_actor_candidate uuid := coalesce(p_actor_person_id, auth.uid());
  v_actor uuid := null;

  v_action_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_ar_ledger_id uuid;

  v_invoice_req numeric := 0;
  v_ledger_req numeric := 0;
  v_req numeric := 0;
  v_remaining numeric := 0;

  v_eps numeric := 0.000001;
  v_residual_absorb_eps numeric := 0.5;

  v_applied_cash numeric := 0;
  v_applied_labor numeric := 0;
  v_applied_material numeric := 0;
  v_applied_gold_g numeric := 0;
  v_applied_silver_g numeric := 0;

  v_last_labor_ar_id uuid := null;
  v_last_material_ar_id uuid := null;

  v_alloc_id uuid;

  r record;
  v_cash_for_labor numeric;
  v_cash_for_material numeric;
  v_alloc_gold numeric;
  v_alloc_silver numeric;
begin
  if v_key = '' then
    raise exception 'idempotency_key is required';
  end if;

  if v_actor_candidate is not null then
    if exists (
      select 1
      from public.cms_person p
      where p.person_id = v_actor_candidate
    ) then
      v_actor := v_actor_candidate;
    end if;
  end if;

  select action_id, payment_id, ar_ledger_id, writeoff_cash_krw
    into r
  from public.cms_ar_service_writeoff_action
  where party_id = p_party_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'deduped', true,
      'action_id', r.action_id,
      'payment_id', r.payment_id,
      'ar_ledger_id', r.ar_ledger_id,
      'writeoff_cash_krw', r.writeoff_cash_krw
    );
  end if;

  select coalesce(sum(total_cash_outstanding_krw), 0)
    into v_invoice_req
  from public.cms_v_ar_invoice_position_v1
  where party_id = p_party_id;

  select coalesce(sum(amount_krw), 0)
    into v_ledger_req
  from public.cms_ar_ledger
  where party_id = p_party_id;

  v_invoice_req := round(v_invoice_req, 6);
  v_ledger_req := round(v_ledger_req, 6);

  if abs(v_invoice_req - v_ledger_req) > 0.5 then
    raise exception 'ar_sot_mismatch: invoice_outstanding=% ledger_outstanding=% party_id=%',
      v_invoice_req,
      v_ledger_req,
      p_party_id;
  end if;

  v_req := greatest(v_ledger_req, 0);

  if v_req <= v_eps then
    raise exception 'no outstanding to write off. outstanding=%', v_req;
  end if;

  if v_req > v_limit + 0.5 then
    raise exception 'writeoff limit exceeded. outstanding=% limit=%', v_req, v_limit;
  end if;

  v_remaining := v_req;

  insert into public.cms_ar_payment(
    payment_id, party_id, paid_at,
    cash_krw, gold_g, silver_g,
    note, created_by,
    idempotency_key
  )
  values (
    v_payment_id, p_party_id, v_at,
    v_req, 0, 0,
    '[SERVICE_WRITEOFF<= '||round(v_limit, 0)||'] '||coalesce(p_reason_detail, ''),
    v_actor,
    'SERVICE_WRITEOFF:'||v_key
  );

  insert into public.cms_payment_header(
    payment_id, party_id, paid_at, memo, total_amount_krw
  )
  values (
    v_payment_id, p_party_id, v_at,
    '[SERVICE_WRITEOFF] '||coalesce(p_reason_detail, ''),
    round(v_req, 0)
  )
  on conflict (payment_id) do update
    set total_amount_krw = excluded.total_amount_krw,
        memo = excluded.memo,
        paid_at = excluded.paid_at,
        party_id = excluded.party_id;

  insert into public.cms_ar_ledger(
    party_id, occurred_at, entry_type, amount_krw, payment_id, memo
  )
  values (
    p_party_id, v_at, 'ADJUST', -v_req, v_payment_id,
    '[SERVICE_WRITEOFF] action_id='||v_action_id::text||' '||coalesce(p_reason_detail, '')
  )
  returning ar_ledger_id into v_ar_ledger_id;

  insert into public.cms_ar_service_writeoff_action(
    action_id, party_id, occurred_at,
    writeoff_cash_krw,
    writeoff_gold_g, writeoff_silver_g,
    reason_detail,
    payment_id, ar_ledger_id,
    idempotency_key,
    created_by
  )
  values (
    v_action_id, p_party_id, v_at,
    v_req,
    0, 0,
    p_reason_detail,
    v_payment_id, v_ar_ledger_id,
    v_key,
    v_actor
  );

  for r in
    select
      ar_id,
      coalesce(labor_cash_outstanding_krw, 0) as labor_out,
      occurred_at,
      created_at
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and coalesce(labor_cash_outstanding_krw, 0) > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_eps;

    v_cash_for_labor := least(v_remaining, r.labor_out);

    if v_cash_for_labor > 0 then
      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw,
        alloc_gold_g, alloc_silver_g,
        alloc_value_krw,
        alloc_labor_krw, alloc_material_krw
      )
      values (
        v_payment_id, r.ar_id,
        v_cash_for_labor,
        0, 0,
        0,
        v_cash_for_labor, 0
      )
      returning alloc_id into v_alloc_id;

      insert into public.cms_ar_service_writeoff_action_alloc(
        action_id, alloc_id, payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
        alloc_gold_g, alloc_silver_g
      )
      values (
        v_action_id, v_alloc_id, v_payment_id, r.ar_id,
        v_cash_for_labor, v_cash_for_labor, 0,
        0, 0
      );

      v_last_labor_ar_id := r.ar_id;
      v_applied_cash := v_applied_cash + v_cash_for_labor;
      v_applied_labor := v_applied_labor + v_cash_for_labor;
      v_remaining := v_remaining - v_cash_for_labor;
    end if;
  end loop;

  for r in
    select
      ar_id,
      coalesce(material_cash_outstanding_krw, 0) as material_out,
      commodity_type,
      coalesce(commodity_outstanding_g, 0) as commodity_out_g,
      coalesce(commodity_price_snapshot_krw_per_g, 0) as price,
      occurred_at,
      created_at
    from public.cms_v_ar_invoice_position_v1
    where party_id = p_party_id
      and coalesce(material_cash_outstanding_krw, 0) > 0
    order by occurred_at, created_at, ar_id
  loop
    exit when v_remaining <= v_eps;

    v_cash_for_material := least(v_remaining, r.material_out);

    if v_cash_for_material <= 0 then
      continue;
    end if;

    v_alloc_gold := 0;
    v_alloc_silver := 0;

    if r.commodity_type = 'gold' and r.price > 0 and r.commodity_out_g > 0 then
      if abs(v_cash_for_material - r.material_out) <= 0.5 then
        v_alloc_gold := r.commodity_out_g;
      else
        v_alloc_gold := least(r.commodity_out_g, round(v_cash_for_material / r.price, 6));
      end if;
    elsif r.commodity_type = 'silver' and r.price > 0 and r.commodity_out_g > 0 then
      if abs(v_cash_for_material - r.material_out) <= 0.5 then
        v_alloc_silver := r.commodity_out_g;
      else
        v_alloc_silver := least(r.commodity_out_g, round(v_cash_for_material / r.price, 6));
      end if;
    end if;

    insert into public.cms_ar_payment_alloc(
      payment_id, ar_id,
      alloc_cash_krw,
      alloc_gold_g, alloc_silver_g,
      alloc_value_krw,
      alloc_labor_krw, alloc_material_krw
    )
    values (
      v_payment_id, r.ar_id,
      v_cash_for_material,
      v_alloc_gold, v_alloc_silver,
      0,
      0, v_cash_for_material
    )
    returning alloc_id into v_alloc_id;

    insert into public.cms_ar_service_writeoff_action_alloc(
      action_id, alloc_id, payment_id, ar_id,
      alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
      alloc_gold_g, alloc_silver_g
    )
    values (
      v_action_id, v_alloc_id, v_payment_id, r.ar_id,
      v_cash_for_material, 0, v_cash_for_material,
      v_alloc_gold, v_alloc_silver
    );

    v_last_material_ar_id := r.ar_id;
    v_applied_cash := v_applied_cash + v_cash_for_material;
    v_applied_material := v_applied_material + v_cash_for_material;
    v_applied_gold_g := v_applied_gold_g + v_alloc_gold;
    v_applied_silver_g := v_applied_silver_g + v_alloc_silver;

    v_remaining := v_remaining - v_cash_for_material;
  end loop;

  -- absorb tiny residual (<= 0.5 KRW) into last alloc row target to prevent false failure
  if v_remaining > v_eps and v_remaining <= v_residual_absorb_eps then
    if v_last_material_ar_id is not null then
      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw,
        alloc_gold_g, alloc_silver_g,
        alloc_value_krw,
        alloc_labor_krw, alloc_material_krw
      )
      values (
        v_payment_id, v_last_material_ar_id,
        v_remaining,
        0, 0,
        0,
        0, v_remaining
      )
      returning alloc_id into v_alloc_id;

      insert into public.cms_ar_service_writeoff_action_alloc(
        action_id, alloc_id, payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
        alloc_gold_g, alloc_silver_g
      )
      values (
        v_action_id, v_alloc_id, v_payment_id, v_last_material_ar_id,
        v_remaining, 0, v_remaining,
        0, 0
      );

      v_applied_cash := v_applied_cash + v_remaining;
      v_applied_material := v_applied_material + v_remaining;
      v_remaining := 0;
    elsif v_last_labor_ar_id is not null then
      insert into public.cms_ar_payment_alloc(
        payment_id, ar_id,
        alloc_cash_krw,
        alloc_gold_g, alloc_silver_g,
        alloc_value_krw,
        alloc_labor_krw, alloc_material_krw
      )
      values (
        v_payment_id, v_last_labor_ar_id,
        v_remaining,
        0, 0,
        0,
        v_remaining, 0
      )
      returning alloc_id into v_alloc_id;

      insert into public.cms_ar_service_writeoff_action_alloc(
        action_id, alloc_id, payment_id, ar_id,
        alloc_cash_krw, alloc_labor_krw, alloc_material_krw,
        alloc_gold_g, alloc_silver_g
      )
      values (
        v_action_id, v_alloc_id, v_payment_id, v_last_labor_ar_id,
        v_remaining, v_remaining, 0,
        0, 0
      );

      v_applied_cash := v_applied_cash + v_remaining;
      v_applied_labor := v_applied_labor + v_remaining;
      v_remaining := 0;
    end if;
  end if;

  if v_remaining > 0.01 then
    raise exception 'service_writeoff allocation incomplete. remaining=%', v_remaining;
  end if;

  update public.cms_ar_service_writeoff_action
  set
    writeoff_gold_g = round(v_applied_gold_g, 6),
    writeoff_silver_g = round(v_applied_silver_g, 6)
  where action_id = v_action_id;

  return jsonb_build_object(
    'ok', true,
    'action_id', v_action_id,
    'payment_id', v_payment_id,
    'ar_ledger_id', v_ar_ledger_id,
    'writeoff_cash_krw', round(v_req, 6),
    'invoice_outstanding_krw', round(v_invoice_req, 6),
    'ledger_outstanding_krw', round(v_ledger_req, 6),
    'applied_cash_krw', round(v_applied_cash, 6),
    'unallocated_reconcile_krw', round(v_req - v_applied_cash, 6),
    'applied_labor_krw', round(v_applied_labor, 6),
    'applied_material_krw', round(v_applied_material, 6),
    'applied_gold_g', round(v_applied_gold_g, 6),
    'applied_silver_g', round(v_applied_silver_g, 6)
  );
end $$;

grant execute on function public.cms_fn_ar_apply_service_writeoff_under_limit_v1(
  uuid, text, numeric, timestamptz, text, uuid
) to authenticated;

commit;
