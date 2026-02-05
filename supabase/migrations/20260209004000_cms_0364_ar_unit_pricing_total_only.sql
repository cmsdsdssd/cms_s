-- supabase/migrations/20260209004000_cms_0364_ar_unit_pricing_total_only.sql
-- ADD-ONLY.
-- 목적: 단가제(master.is_unit_pricing=true) 라인은 미수(AR)에서 "총액 현금"만 잡히도록 한다.
--  - 기존: 소재(금/은) 중량/환산 + 공임(현금) + 총액(현금)
--  - 변경: 단가제면 commodity/material/labor 분해는 0(NULL)로 만들고, total을 현금 due로만 잡는다.
--
-- 설계 포인트:
--  - shipment_line.master_id 우선으로 master join (정확도/안정성)
--  - master_id가 없으면 trim(model_name)=master.model_name fallback (기존 백필 방식과 동일)

set search_path = public, pg_temp;

begin;

-- 안전망(이미 있으면 아무 변화 없음)
alter table public.cms_master_item
  add column if not exists is_unit_pricing boolean not null default false;

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
  v_updated int := 0;
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

  -- 1) UPDATE existing invoices (idempotent upsert)
  with line_base as (
    select
      v_hdr.customer_party_id as party_id,
      p_shipment_id as shipment_id,
      sl.shipment_line_id,
      v_hdr.confirmed_at as occurred_at,

      coalesce(mi1.is_unit_pricing, mi2.is_unit_pricing, false) as is_unit_pricing,

      greatest(coalesce(sl.total_amount_sell_krw, 0), 0) as total_sell_krw,
      greatest(coalesce(sl.material_amount_sell_krw, 0), 0) as material_amount_sell_krw,

      sl.material_code,
      coalesce(
        sl.net_weight_g,
        greatest(coalesce(sl.measured_weight_g, 0) - coalesce(sl.deduction_weight_g, 0), 0)
      ) as net_w
    from public.cms_shipment_line sl
    left join public.cms_master_item mi1
      on mi1.master_id = sl.master_id
    left join public.cms_master_item mi2
      on sl.master_id is null
     and sl.model_name is not null
     and trim(sl.model_name) = mi2.model_name
    where sl.shipment_id = p_shipment_id
  ),
  calc as (
    select
      party_id,
      shipment_id,
      shipment_line_id,
      occurred_at,

      -- 단가제면 total을 전부 현금으로
      case
        when is_unit_pricing then total_sell_krw
        else greatest(total_sell_krw - material_amount_sell_krw, 0)
      end as labor_cash_due_krw,

      case
        when is_unit_pricing then null
        when material_code in ('14','18','24') then 'gold'::cms_e_commodity_type
        when material_code in ('925','999')    then 'silver'::cms_e_commodity_type
        else null
      end as commodity_type,

      case
        when is_unit_pricing then 0
        when material_code = '14'  then net_w * 0.6435
        when material_code = '18'  then net_w * 0.825
        when material_code = '24'  then net_w
        when material_code = '925' then net_w * 0.925
        when material_code = '999' then net_w
        else 0
      end as commodity_due_g,

      case
        when is_unit_pricing then 0
        when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
        when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
        else 0
      end as commodity_price_snapshot_krw_per_g,

      case
        when is_unit_pricing then 0
        else
          (
            case
              when material_code = '14'  then net_w * 0.6435
              when material_code = '18'  then net_w * 0.825
              when material_code = '24'  then net_w
              when material_code = '925' then net_w * 0.925
              when material_code = '999' then net_w
              else 0
            end
          )
          *
          (
            case
              when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
              when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
              else 0
            end
          )
      end as material_cash_due_krw,

      case
        when is_unit_pricing then total_sell_krw
        else
          (
            greatest(total_sell_krw - material_amount_sell_krw, 0)
            +
            (
              (
                case
                  when material_code = '14'  then net_w * 0.6435
                  when material_code = '18'  then net_w * 0.825
                  when material_code = '24'  then net_w
                  when material_code = '925' then net_w * 0.925
                  when material_code = '999' then net_w
                  else 0
                end
              )
              *
              (
                case
                  when material_code in ('14','18','24') then coalesce(v_valuation.gold_krw_per_g_snapshot, 0)
                  when material_code in ('925','999')    then coalesce(v_valuation.silver_krw_per_g_snapshot, 0) * coalesce(v_valuation.silver_adjust_factor_snapshot, 1)
                  else 0
                end
              )
            )
          )
      end as total_cash_due_krw
    from line_base
  ),
  upd as (
    update public.cms_ar_invoice ai
    set
      party_id = c.party_id,
      shipment_id = c.shipment_id,
      occurred_at = c.occurred_at,
      labor_cash_due_krw = c.labor_cash_due_krw,
      commodity_type = c.commodity_type,
      commodity_due_g = c.commodity_due_g,
      commodity_price_snapshot_krw_per_g = c.commodity_price_snapshot_krw_per_g,
      material_cash_due_krw = c.material_cash_due_krw,
      total_cash_due_krw = c.total_cash_due_krw
    from calc c
    where ai.shipment_line_id = c.shipment_line_id
    returning 1
  )
  select count(*) into v_updated from upd;

  -- 2) INSERT missing invoices
  insert into public.cms_ar_invoice (
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
    c.party_id,
    c.shipment_id,
    c.shipment_line_id,
    c.occurred_at,
    c.labor_cash_due_krw,
    c.commodity_type,
    c.commodity_due_g,
    c.commodity_price_snapshot_krw_per_g,
    c.material_cash_due_krw,
    c.total_cash_due_krw
  from calc c
  where not exists (
    select 1 from public.cms_ar_invoice ai
    where ai.shipment_line_id = c.shipment_line_id
  );

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'updated', v_updated,
    'inserted', v_inserted
  );
end $$;

alter function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid)
  security definer
  set search_path = public, pg_temp;

grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid) to authenticated;
grant execute on function public.cms_fn_ar_create_from_shipment_confirm_v1(uuid) to service_role;

commit;
