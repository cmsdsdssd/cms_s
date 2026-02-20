-- cms_0270: Shipment price recommendation engine (v1)
-- 목표: 출고(Shipment) 라인 단위로 "추천 판매가" + "근거" + "비정상(원가/공임) 징후"를 기록하고,
--       필요 시 추천값을 shipment_line에 적용하는 RPC 제공
-- 원칙: ADD-ONLY (새 오브젝트만 추가), 테이블 DML은 RPC로만

begin;
-- ------------------------------------------------------------
-- 1) 추천 결과 저장 테이블 (히스토리 누적)
-- ------------------------------------------------------------
create table if not exists public.cms_shipment_price_reco (
  reco_id uuid primary key default gen_random_uuid(),

  shipment_line_id uuid not null references public.cms_shipment_line(shipment_line_id),
  master_id uuid null references public.cms_master_item(master_id),

  model_name text not null,
  category_code text,
  material_code public.cms_e_material_code,

  -- 추천 가격 입력 방식은 기존 pricing_mode enum과 맞춤 (RULE/UNIT/AMOUNT_ONLY)
  reco_pricing_mode public.cms_e_pricing_mode not null,
  reco_unit_price_krw numeric,
  reco_total_amount_krw numeric,

  -- 추천의 의도/근거
  target_margin_rate numeric,               -- 0~1 (예: 0.25)
  estimated_total_cost_krw numeric,
  estimated_unit_cost_krw numeric,

  -- 사람이 바로 읽는 설명
  reason_md text,

  -- LLM/룰 기반 근거(비교샘플, 계산식, anomaly 등)
  evidence jsonb not null default '{}'::jsonb,

  -- 출처(예: GLM, RULE, MANUAL)
  source text not null default 'GLM',

  -- 누가 만들었는지(선택)
  created_by_person_id uuid null references public.cms_person(person_id),

  created_at timestamptz not null default now()
);
create index if not exists cms_shipment_price_reco__shipment_line_id__idx
  on public.cms_shipment_price_reco (shipment_line_id, created_at desc);
create index if not exists cms_shipment_price_reco__model_name__idx
  on public.cms_shipment_price_reco (model_name);
-- ------------------------------------------------------------
-- 2) RLS: read 정책만 (기존 cms_0008의 철학과 동일)
--    - authenticated SELECT 허용
--    - 쓰기(insert/update/delete)는 RPC에서 security definer로 처리
-- ------------------------------------------------------------
alter table public.cms_shipment_price_reco enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'cms_shipment_price_reco'
      and policyname = 'cms_select_authenticated'
  ) then
    execute '
      create policy cms_select_authenticated
      on public.cms_shipment_price_reco
      for select
      to authenticated
      using (true);
    ';
  end if;
end $$;
-- 명시적으로 select만 부여(기본권한/디폴트 권한이 있어도 안전하게)
grant select on public.cms_shipment_price_reco to authenticated, service_role;
-- ------------------------------------------------------------
-- 3) 최신 추천 1건만 보는 뷰
-- ------------------------------------------------------------
create or replace view public.cms_v_shipment_price_reco_latest_v1 as
select distinct on (r.shipment_line_id)
  r.reco_id,
  r.shipment_line_id,
  r.master_id,
  r.model_name,
  r.category_code,
  r.material_code,
  r.reco_pricing_mode,
  r.reco_unit_price_krw,
  r.reco_total_amount_krw,
  r.target_margin_rate,
  r.estimated_total_cost_krw,
  r.estimated_unit_cost_krw,
  r.reason_md,
  r.evidence,
  r.source,
  r.created_by_person_id,
  r.created_at
from public.cms_shipment_price_reco r
order by r.shipment_line_id, r.created_at desc;
grant select on public.cms_v_shipment_price_reco_latest_v1 to authenticated, service_role;
-- ------------------------------------------------------------
-- 4) 추천 컨텍스트 JSON 생성 RPC (LLM 입력용)
--    - 현재 라인/마스터/시세/최근 유사 출고/최근 동일 모델 출고를 한 번에 준다
-- ------------------------------------------------------------
create or replace function public.cms_fn_get_shipment_price_reco_context_v1(
  p_shipment_line_id uuid,
  p_recent_limit int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line jsonb;
  v_master jsonb;
  v_market jsonb;
  v_recent_same_model jsonb;
  v_recent_similar jsonb;
begin
  -- line + header + customer
  select to_jsonb(t) into v_line
  from (
    select
      sl.shipment_line_id,
      sl.shipment_id,
      sh.status as shipment_status,
      sh.ship_date,
      sh.customer_party_id,
      cp.name as customer_name,

      sl.master_id,
      sl.model_name,
      sl.category_code,
      sl.material_code,

      sl.qty,
      sl.net_weight_g,
      sl.is_plated,

      sl.pricing_mode,
      sl.unit_price_krw,
      sl.manual_total_amount_krw,
      sl.total_amount_sell_krw,
      sl.total_amount_cost_krw,

      sl.purchase_cost_status,
      sl.purchase_cost_source,
      sl.purchase_unit_cost_krw,
      sl.purchase_total_cost_krw,

      sl.material_amount_sell_krw,
      sl.labor_total_sell_krw,
      sl.plating_amount_sell_krw,

      -- 참고용: 현재 라인 기준 "원가 basis" & (이미 가격이 있으면) 현재 마진
      coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw) as basis_cost_krw,
      case
        when sl.total_amount_sell_krw is not null and sl.total_amount_sell_krw > 0
        then (sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw))
        else null
      end as current_margin_krw,
      case
        when sl.total_amount_sell_krw is not null and sl.total_amount_sell_krw > 0
        then round((sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw)) / sl.total_amount_sell_krw, 6)
        else null
      end as current_margin_rate
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    left join public.cms_party cp on cp.party_id = sh.customer_party_id
    where sl.shipment_line_id = p_shipment_line_id
  ) t;

  if v_line is null then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  -- master (있으면)
  select to_jsonb(t) into v_master
  from (
    select
      mi.master_id,
      mi.model_name,
      mi.category_code,
      mi.material_code,

      mi.labor_base_sell_krw,
      mi.labor_additional_sell_krw,
      mi.labor_total_sell_krw,

      mi.plating_amount_sell_krw,
      mi.material_amount_sell_krw,

      mi.provisional_unit_cost_krw,
      mi.note
    from public.cms_master_item mi
    where mi.master_id = (v_line->>'master_id')::uuid
  ) t;

  -- market ticks (이미 있는 ops view 활용)
  select to_jsonb(t) into v_market
  from (
    select * from public.cms_v_market_tick_latest_gold_silver_ops_v1
  ) t;

  -- 최근 동일 모델(confirmed 기준)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.ship_date desc), '[]'::jsonb)
  into v_recent_same_model
  from (
    select
      sh.ship_date,
      sh.customer_party_id,
      cp.name as customer_name,

      sl.shipment_line_id,
      sl.qty,
      sl.net_weight_g,
      sl.material_code,

      sl.total_amount_sell_krw,
      coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw) as basis_cost_krw,
      (sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw)) as margin_krw,
      case when sl.total_amount_sell_krw > 0
        then round((sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw))/sl.total_amount_sell_krw, 6)
      end as margin_rate,

      sl.pricing_mode,
      sl.unit_price_krw,
      sl.manual_total_amount_krw,

      sl.material_amount_sell_krw,
      sl.labor_total_sell_krw,
      sl.plating_amount_sell_krw,

      sl.purchase_cost_status,
      sl.purchase_cost_source,
      sl.purchase_total_cost_krw
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    left join public.cms_party cp on cp.party_id = sh.customer_party_id
    where sl.model_name = (v_line->>'model_name')
      and sl.shipment_line_id <> p_shipment_line_id
      and sh.status = 'CONFIRMED'
    order by sh.ship_date desc, sl.created_at desc
    limit p_recent_limit
  ) t;

  -- 최근 유사(같은 category + material) (confirmed 기준)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.ship_date desc), '[]'::jsonb)
  into v_recent_similar
  from (
    select
      sh.ship_date,
      sl.model_name,
      sl.shipment_line_id,
      sl.qty,
      sl.net_weight_g,
      sl.material_code,

      sl.total_amount_sell_krw,
      coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw) as basis_cost_krw,
      (sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw)) as margin_krw,
      case when sl.total_amount_sell_krw > 0
        then round((sl.total_amount_sell_krw - coalesce(sl.purchase_total_cost_krw, sl.total_amount_cost_krw))/sl.total_amount_sell_krw, 6)
      end as margin_rate
    from public.cms_shipment_line sl
    join public.cms_shipment_header sh on sh.shipment_id = sl.shipment_id
    where sl.category_code = (v_line->>'category_code')
      and sl.material_code = (v_line->>'material_code')::public.cms_e_material_code
      and sl.shipment_line_id <> p_shipment_line_id
      and sh.status = 'CONFIRMED'
    order by sh.ship_date desc, sl.created_at desc
    limit p_recent_limit
  ) t;

  return jsonb_build_object(
    'line', v_line,
    'master', coalesce(v_master, '{}'::jsonb),
    'market', coalesce(v_market, '{}'::jsonb),
    'recent_same_model', v_recent_same_model,
    'recent_similar', v_recent_similar,
    'meta', jsonb_build_object(
      'generated_at', now(),
      'recent_limit', p_recent_limit
    )
  );
end;
$$;
grant execute on function public.cms_fn_get_shipment_price_reco_context_v1(uuid,int)
to authenticated, service_role;
-- ------------------------------------------------------------
-- 5) 추천 저장 RPC (히스토리 누적 insert)
-- ------------------------------------------------------------
create or replace function public.cms_fn_insert_shipment_price_reco_v1(
  p_shipment_line_id uuid,
  p_reco_pricing_mode public.cms_e_pricing_mode,
  p_reco_unit_price_krw numeric default null,
  p_reco_total_amount_krw numeric default null,
  p_target_margin_rate numeric default null,
  p_estimated_total_cost_krw numeric default null,
  p_estimated_unit_cost_krw numeric default null,
  p_reason_md text default null,
  p_evidence jsonb default '{}'::jsonb,
  p_source text default 'GLM',
  p_created_by_person_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_reco_id uuid;
begin
  select sl.shipment_line_id, sl.master_id, sl.model_name, sl.category_code, sl.material_code
    into v_line
  from public.cms_shipment_line sl
  where sl.shipment_line_id = p_shipment_line_id;

  if not found then
    raise exception 'shipment_line not found: %', p_shipment_line_id;
  end if;

  insert into public.cms_shipment_price_reco (
    shipment_line_id,
    master_id,
    model_name,
    category_code,
    material_code,
    reco_pricing_mode,
    reco_unit_price_krw,
    reco_total_amount_krw,
    target_margin_rate,
    estimated_total_cost_krw,
    estimated_unit_cost_krw,
    reason_md,
    evidence,
    source,
    created_by_person_id
  )
  values (
    v_line.shipment_line_id,
    v_line.master_id,
    v_line.model_name,
    v_line.category_code,
    v_line.material_code,
    p_reco_pricing_mode,
    p_reco_unit_price_krw,
    p_reco_total_amount_krw,
    p_target_margin_rate,
    p_estimated_total_cost_krw,
    p_estimated_unit_cost_krw,
    p_reason_md,
    coalesce(p_evidence, '{}'::jsonb),
    coalesce(p_source, 'GLM'),
    p_created_by_person_id
  )
  returning reco_id into v_reco_id;

  return v_reco_id;
end;
$$;
grant execute on function public.cms_fn_insert_shipment_price_reco_v1(
  uuid, public.cms_e_pricing_mode, numeric, numeric, numeric, numeric, numeric, text, jsonb, text, uuid
) to authenticated, service_role;
-- ------------------------------------------------------------
-- 6) (옵션) 추천을 shipment_line에 "적용"하는 RPC
--    - DRAFT 상태의 shipment만 허용
-- ------------------------------------------------------------
create or replace function public.cms_fn_apply_shipment_price_reco_v1(
  p_reco_id uuid,
  p_created_by_person_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r record;
  v_sh_status text;
begin
  select *
    into v_r
  from public.cms_shipment_price_reco
  where reco_id = p_reco_id;

  if not found then
    raise exception 'reco not found: %', p_reco_id;
  end if;

  select sh.status
    into v_sh_status
  from public.cms_shipment_header sh
  join public.cms_shipment_line sl on sl.shipment_id = sh.shipment_id
  where sl.shipment_line_id = v_r.shipment_line_id;

  if v_sh_status is null then
    raise exception 'shipment not found for reco: %', p_reco_id;
  end if;

  if v_sh_status <> 'DRAFT' then
    raise exception 'only DRAFT shipment can be updated (current=%)', v_sh_status;
  end if;

  update public.cms_shipment_line sl
  set
    pricing_mode = v_r.reco_pricing_mode,
    unit_price_krw = case when v_r.reco_pricing_mode = 'UNIT' then v_r.reco_unit_price_krw else null end,
    manual_total_amount_krw = case when v_r.reco_pricing_mode = 'AMOUNT_ONLY' then v_r.reco_total_amount_krw else null end,
    -- 추적용: price_calc_trace에 reco_id 박아두기(있으면 병합)
    price_calc_trace = coalesce(sl.price_calc_trace, '{}'::jsonb) || jsonb_build_object('ai_reco_id', v_r.reco_id::text, 'ai_reco_applied_at', now()),
    updated_at = now()
  where sl.shipment_line_id = v_r.shipment_line_id;

  return v_r.shipment_line_id;
end;
$$;
grant execute on function public.cms_fn_apply_shipment_price_reco_v1(uuid,uuid)
to authenticated, service_role;
commit;
