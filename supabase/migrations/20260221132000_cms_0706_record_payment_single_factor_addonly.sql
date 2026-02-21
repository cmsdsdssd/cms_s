-- cms_0706: record_payment_v2 single-factor alignment (add-only)

begin;

create or replace function public.cms_fn_record_payment_v2(
  p_party_id uuid,
  p_paid_at timestamptz,
  p_tenders jsonb,
  p_memo text default null,
  p_shipment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_payment_id uuid;
  v_total numeric := 0;
  v_elem jsonb;
  v_method cms_e_payment_method;
  v_amount numeric;
  v_weight numeric;
  v_purity text;
  v_fine numeric;
  v_tick_id uuid;
  v_tick_price numeric;

  v_gold_tick_id uuid;
  v_gold_price numeric;
  v_silver_tick_id uuid;
  v_silver_price numeric;

  v_material_code public.cms_e_material_code;
  v_purity_rate numeric;
  v_material_adjust numeric;
  v_base_factor numeric;
begin
  if p_tenders is null or jsonb_typeof(p_tenders) <> 'array' then
    raise exception 'p_tenders must be a jsonb array';
  end if;

  if p_shipment_id is not null then
    select gold_tick_id, gold_krw_per_g_snapshot, silver_tick_id, silver_krw_per_g_snapshot
      into v_gold_tick_id, v_gold_price, v_silver_tick_id, v_silver_price
    from public.cms_shipment_valuation
    where shipment_id = p_shipment_id;
  end if;

  insert into public.cms_payment_header(party_id, paid_at, memo, total_amount_krw)
  values (p_party_id, p_paid_at, p_memo, 0)
  returning payment_id into v_payment_id;

  for v_elem in select * from jsonb_array_elements(p_tenders)
  loop
    v_method := (v_elem->>'method')::cms_e_payment_method;
    v_amount := (v_elem->>'amount_krw')::numeric;
    v_weight := (v_elem->>'weight_g')::numeric;
    v_purity := upper(btrim(coalesce(v_elem->>'purity','')));
    v_fine := null;
    v_tick_id := null;
    v_tick_price := null;
    v_material_code := null;
    v_base_factor := null;

    if v_method in ('GOLD','SILVER') then
      if v_weight is null or v_weight <= 0 then
        raise exception 'metal tender requires weight_g';
      end if;

      if v_method = 'GOLD' then
        v_tick_id := v_gold_tick_id;
        v_tick_price := v_gold_price;
        v_material_code := case
          when v_purity in ('14', '14K') then '14'::public.cms_e_material_code
          when v_purity in ('18', '18K') then '18'::public.cms_e_material_code
          when v_purity in ('24', '24K', 'PURE') then '24'::public.cms_e_material_code
          else null
        end;
      else
        v_tick_id := v_silver_tick_id;
        v_tick_price := v_silver_price;
        v_material_code := case
          when v_purity in ('925', 'S925') then '925'::public.cms_e_material_code
          when v_purity in ('999', 'S999') then '999'::public.cms_e_material_code
          else null
        end;
      end if;

      if v_material_code is null then
        raise exception 'metal tender requires valid purity';
      end if;

      select mf.purity_rate, mf.material_adjust_factor
        into v_purity_rate, v_material_adjust
      from public.cms_fn_get_material_factor_v2(v_material_code) mf;

      v_base_factor := greatest(coalesce(v_purity_rate, 0), 0) * greatest(coalesce(v_material_adjust, 1), 0);
      if v_base_factor <= 0 then
        raise exception 'invalid material factor for purity=%', v_purity;
      end if;

      v_fine := v_weight * v_base_factor;

      if v_tick_price is null or v_tick_id is null then
        raise exception 'metal tender requires pricing snapshot (shipment_id=%)', p_shipment_id;
      end if;

      if v_fine is null or v_fine <= 0 then
        raise exception 'metal tender requires valid factor conversion';
      end if;

      v_amount := round(v_fine * v_tick_price, 0);
    end if;

    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid amount_krw in tender: %', v_elem;
    end if;

    insert into public.cms_payment_tender_line(
      payment_id, method, amount_krw,
      weight_g, purity_code, fine_weight_g, tick_id, tick_krw_per_g, value_krw, meta
    )
    values (
      v_payment_id, v_method, v_amount,
      v_weight, nullif(v_purity,''), v_fine, v_tick_id, v_tick_price, v_amount,
      coalesce(v_elem->'meta', '{}'::jsonb)
    );

    v_total := v_total + v_amount;
  end loop;

  update public.cms_payment_header
  set total_amount_krw = round(v_total, 0)
  where payment_id = v_payment_id;

  insert into public.cms_ar_ledger(party_id, occurred_at, entry_type, amount_krw, payment_id, memo)
  values (p_party_id, p_paid_at, 'PAYMENT', -round(v_total,0), v_payment_id, p_memo);

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'total_amount_krw', round(v_total,0)
  );
end $$;

commit;
