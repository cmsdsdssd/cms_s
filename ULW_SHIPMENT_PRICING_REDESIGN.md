# ERP 미수/결제 로직 + 매장출고 시세 기준 재설계 (근거 기반)

## 1) 현 상태 분석 (근거: 경로/오브젝트)

### 1.1 출고 확정 흐름 (프론트 → RPC)
- 출고 확정 버튼은 `web/src/app/(app)/shipments/page.tsx`에서 `CONTRACTS.functions.shipmentConfirm` 호출로 트리거된다.
- 실제 RPC 체인은 `cms_fn_confirm_shipment_v3_cost_v1` → `cms_fn_confirm_shipment_v2` → `cms_fn_confirm_shipment`이며, 정의는 `supabase/migrations/20260201001000_cms_0262_realign_confirm_shipment_chain.sql`에 있다.

### 1.2 가격 확정 및 스냅샷 위치
- 가격 확정(시세 스냅샷)은 `cms_fn_confirm_shipment` 내부에서 수행된다.
- 최신 시세는 `cms_fn_latest_tick_by_role_v1('GOLD'|'SILVER')`로 조회하며, 정의는 `supabase/migrations/20260128130500_cms_0201_market_tick_rpcs.sql`에 있다.
- 스냅샷 저장 컬럼은 `cms_shipment_line`에 이미 존재:
  - `gold_tick_id`, `silver_tick_id`, `gold_tick_krw_per_g`, `silver_tick_krw_per_g`, `silver_adjust_factor`
  - 정의: `supabase/migrations/20260127124309_cms_0002_tables.sql`
- 실시간 시세 조회 API는 `web/src/app/api/market-ticks/route.ts`에서 `cms_market_tick_config`와 `cms_market_symbol_role`를 함께 사용한다.

### 1.3 미수(AR) 생성·잔액 구조
- 미수 원장은 `cms_ar_ledger`이며, 출고 확정 시 `entry_type = 'SHIPMENT'`로 원장 라인을 생성한다.
- 정의 및 FK 연결: `supabase/migrations/20260127124309_cms_0002_tables.sql`
- 잔액 집계 뷰: `cms_v_ar_balance_by_party` (`supabase/migrations/20260127124313_cms_0006_views.sql`)

### 1.4 결제(혼합 결제) 구조
- 결제 헤더/라인 구조는 이미 존재:
  - `cms_payment_header`, `cms_payment_tender_line` (`supabase/migrations/20260127124309_cms_0002_tables.sql`)
- 결제 RPC: `cms_fn_record_payment` (`supabase/migrations/20260126084020_cms_0007_functions.sql`)
- 결제 수단 enum: `cms_e_payment_method` = `BANK|CASH|GOLD|SILVER|OFFSET` (`supabase/migrations/20260127124308_cms_0001_types.sql`)
- 현재 결제 메타는 `cms_payment_tender_line.meta` (JSONB)에 저장되며, 금/은 중량·순도·시세 스냅샷은 표준화돼 있지 않다.

### 1.5 매장출고 개념 현황
- `cms_shipment_header`에는 `is_store_pickup`, `pricing_locked_at`, `pricing_source`가 없다.
- 출고 확정 시점과 가격 확정 시점은 사실상 동일(`cms_fn_confirm_shipment`).

## 2) 문제 정의 (왜 깨지는지)

1. **가격 확정 시점이 단일(출고확정)**
   - 매장출고(고객 수령 시점) 가격 확정 요구와 충돌.
2. **혼합 결제(현물/현금)의 정산 기준이 표준화되지 않음**
   - 결제 메타는 존재하지만 정산 기준(어느 시세 스냅샷 기준인지)이 명시되지 않는다.
3. **시세 스냅샷의 “기준 시점” 불명확**
   - 현재는 출고 확정 시점 기준만 존재.

## 3) 확정 설계 (스키마/프로세스/정책)

### 3.1 가격 확정 시점 분기 (필수)
**정책 확정**
- `is_store_pickup = true` → **매장출고 확정 RPC** 실행 시점에 `pricing_locked_at` 설정 + 시세 스냅샷 고정.
- `is_store_pickup = false` → 기존 **출고확정 RPC** 실행 시점에 동일 작업.

**스키마(확정안)**
- `cms_shipment_header`에 추가:
  - `is_store_pickup boolean not null default false`
  - `pricing_locked_at timestamptz null`
  - `pricing_source text null` (`CONFIRM_SHIPMENT` | `STORE_PICKUP_CONFIRM`)
  - `pricing_locked_at is not null`을 pricing lock 기준으로 사용 (별도 boolean 불필요).

### 3.2 출고별 valuation 스냅샷 (필수)
**새 테이블 권장: `cms_shipment_valuation`**
- 이유: 라인별 스냅샷 외에 **출고 단위 총액/시세 스냅샷을 명시적**으로 보관.

**컬럼**
- `shipment_id uuid primary key references cms_shipment_header(shipment_id)`
- `pricing_locked_at timestamptz not null`
- `pricing_source text not null`
- `gold_tick_id uuid references cms_market_tick(tick_id)`
- `silver_tick_id uuid references cms_market_tick(tick_id)`
- `gold_krw_per_g_snapshot numeric not null`
- `silver_krw_per_g_snapshot numeric not null`
- `silver_adjust_factor_snapshot numeric not null`
- `material_value_krw numeric not null`
- `labor_value_krw numeric not null`
- `total_value_krw numeric not null`
- `breakdown jsonb not null default '{}'::jsonb`

### 3.3 혼합 결제 정책 (확정안)
**기본 정책(권장)**
- 현물 결제의 원화 환산은 **출고의 `pricing_locked_at` 시점 스냅샷**을 사용.
- 이유: “가격 확정” 개념과 일치하며, 사후 변동에 의한 정산 왜곡 방지.

**대안/트레이드오프**
- 결제 시점 시세 사용: 현장 체감은 좋으나 출고 확정 가격과 불일치, AR 정합성 저하.

### 3.4 결제 레저 설계
**현행 테이블 재사용 + 필수 컬럼 보강**
- 기존 `cms_payment_header`, `cms_payment_tender_line` 유지.
- `cms_payment_tender_line`에 금/은 정산 필수 필드를 명시적으로 저장:
  - `weight_g numeric null`
  - `purity_code text null` (예: 14K/18K/24K/925)
  - `fine_weight_g numeric null`
  - `tick_id uuid null references cms_market_tick(tick_id)`
  - `tick_krw_per_g numeric null`
  - `value_krw numeric null` (method=GOLD/SILVER일 때 자동 계산 결과)
  - 기존 `amount_krw`는 최종 청구 금액으로 유지 (현금 결제 동일).

### 3.5 정산 계산 규칙 (고정)
- 925: `fine_weight_g = weight_g`
- 14K: `fine_weight_g = weight_g * 0.6435`
- 18K: `fine_weight_g = weight_g * 0.825`
- 24K: `fine_weight_g = weight_g`
- `value_krw = fine_weight_g * tick_krw_per_g` (소수점 반올림 규칙은 기존 `round(...,0)` 유지)

## 4) 구현 단계 (마이그레이션/RPC/프론트)

### 4.1 마이그레이션 (새 파일, ADD-ONLY)
**파일명 예시:** `supabase/migrations/20260202XXXX_cms_0290_store_pickup_pricing_lock.sql`

```sql
-- 1) shipment header: store pickup + pricing lock
alter table public.cms_shipment_header
  add column if not exists is_store_pickup boolean not null default false,
  add column if not exists pricing_locked_at timestamptz null,
  add column if not exists pricing_source text null;

comment on column public.cms_shipment_header.is_store_pickup is 'Store pickup (pricing locked at pickup confirm)';
comment on column public.cms_shipment_header.pricing_locked_at is 'Pricing lock timestamp (tick snapshot)';
comment on column public.cms_shipment_header.pricing_source is 'CONFIRM_SHIPMENT | STORE_PICKUP_CONFIRM';

-- 2) shipment valuation snapshot
create table if not exists public.cms_shipment_valuation (
  shipment_id uuid primary key references public.cms_shipment_header(shipment_id) on delete cascade,
  pricing_locked_at timestamptz not null,
  pricing_source text not null,

  gold_tick_id uuid references public.cms_market_tick(tick_id),
  silver_tick_id uuid references public.cms_market_tick(tick_id),
  gold_krw_per_g_snapshot numeric not null,
  silver_krw_per_g_snapshot numeric not null,
  silver_adjust_factor_snapshot numeric not null,

  material_value_krw numeric not null,
  labor_value_krw numeric not null,
  total_value_krw numeric not null,

  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_shipment_valuation_locked_at
  on public.cms_shipment_valuation(pricing_locked_at desc);

-- 3) payment tender line: metal settlement fields
alter table public.cms_payment_tender_line
  add column if not exists weight_g numeric null,
  add column if not exists purity_code text null,
  add column if not exists fine_weight_g numeric null,
  add column if not exists tick_id uuid null references public.cms_market_tick(tick_id),
  add column if not exists tick_krw_per_g numeric null,
  add column if not exists value_krw numeric null;

comment on column public.cms_payment_tender_line.value_krw is 'Computed metal value in KRW (snapshot-based)';

-- 4) grants (align with existing grant patterns)
grant select on public.cms_shipment_valuation to anon, authenticated;
```

### 4.2 RPC

#### A) 출고확정(기존) 수정
- `cms_fn_confirm_shipment` 내에서:
  - `pricing_locked_at` / `pricing_source = 'CONFIRM_SHIPMENT'` 업데이트
  - `cms_shipment_valuation` 업서트

```sql
-- inside cms_fn_confirm_shipment (after ticks computed, before return)
update public.cms_shipment_header
set pricing_locked_at = v_now,
    pricing_source = 'CONFIRM_SHIPMENT'
where shipment_id = p_shipment_id
  and coalesce(pricing_locked_at, 'epoch'::timestamptz) = coalesce(pricing_locked_at, 'epoch'::timestamptz); -- idempotent guard

insert into public.cms_shipment_valuation(
  shipment_id, pricing_locked_at, pricing_source,
  gold_tick_id, silver_tick_id, gold_krw_per_g_snapshot, silver_krw_per_g_snapshot, silver_adjust_factor_snapshot,
  material_value_krw, labor_value_krw, total_value_krw, breakdown
)
values (
  p_shipment_id, v_now, 'CONFIRM_SHIPMENT',
  v_gold_tick_id, v_silver_tick_id, v_gold_price, v_silver_price, v_silver_factor_snapshot,
  (select coalesce(sum(material_amount_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
  (select coalesce(sum(labor_total_sell_krw),0) from public.cms_shipment_line where shipment_id = p_shipment_id),
  v_total_sell,
  jsonb_build_object('source', 'confirm_shipment')
)
on conflict (shipment_id) do update
  set pricing_locked_at = excluded.pricing_locked_at,
      pricing_source = excluded.pricing_source,
      gold_tick_id = excluded.gold_tick_id,
      silver_tick_id = excluded.silver_tick_id,
      gold_krw_per_g_snapshot = excluded.gold_krw_per_g_snapshot,
      silver_krw_per_g_snapshot = excluded.silver_krw_per_g_snapshot,
      silver_adjust_factor_snapshot = excluded.silver_adjust_factor_snapshot,
      material_value_krw = excluded.material_value_krw,
      labor_value_krw = excluded.labor_value_krw,
      total_value_krw = excluded.total_value_krw,
      breakdown = excluded.breakdown;
```

#### B) 매장출고 확정 RPC (신규)
```sql
create or replace function public.cms_fn_confirm_store_pickup_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  -- 1) is_store_pickup guard
  update public.cms_shipment_header
  set is_store_pickup = true
  where shipment_id = p_shipment_id;

  -- 2) reuse confirm logic (pricing lock occurs here with pricing_source='STORE_PICKUP_CONFIRM')
  v_result := public.cms_fn_confirm_shipment(p_shipment_id, p_actor_person_id, p_note);

  update public.cms_shipment_header
  set pricing_source = 'STORE_PICKUP_CONFIRM'
  where shipment_id = p_shipment_id;

  update public.cms_shipment_valuation
  set pricing_source = 'STORE_PICKUP_CONFIRM'
  where shipment_id = p_shipment_id;

  return v_result;
end $$;
```

#### C) 결제 RPC (현물 자동 환산 포함)
```sql
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
begin
  -- resolve pricing snapshot (shipment-level)
  if p_shipment_id is not null then
    select gold_tick_id, gold_krw_per_g_snapshot into v_tick_id, v_tick_price
    from public.cms_shipment_valuation where shipment_id = p_shipment_id;
  end if;

  insert into public.cms_payment_header(party_id, paid_at, memo, total_amount_krw)
  values (p_party_id, p_paid_at, p_memo, 0)
  returning payment_id into v_payment_id;

  for v_elem in select * from jsonb_array_elements(p_tenders)
  loop
    v_method := (v_elem->>'method')::cms_e_payment_method;
    v_amount := (v_elem->>'amount_krw')::numeric;
    v_weight := (v_elem->>'weight_g')::numeric;
    v_purity := (v_elem->>'purity')::text;

    if v_method in ('GOLD','SILVER') then
      -- compute fine weight
      v_fine := case
        when v_purity = '14K' then v_weight * 0.6435
        when v_purity = '18K' then v_weight * 0.825
        when v_purity = '24K' then v_weight
        when v_purity = '925' then v_weight
        else null
      end;

      if v_fine is null or v_tick_price is null then
        raise exception 'metal tender requires purity/weight + pricing snapshot';
      end if;

      v_amount := round(v_fine * v_tick_price, 0);
    end if;

    insert into public.cms_payment_tender_line(
      payment_id, method, amount_krw,
      weight_g, purity_code, fine_weight_g, tick_id, tick_krw_per_g, value_krw, meta
    )
    values (
      v_payment_id, v_method, v_amount,
      v_weight, v_purity, v_fine, v_tick_id, v_tick_price, v_amount,
      coalesce(v_elem->'meta', '{}'::jsonb)
    );

    v_total := v_total + v_amount;
  end loop;

  update public.cms_payment_header
  set total_amount_krw = round(v_total,0)
  where payment_id = v_payment_id;

  insert into public.cms_ar_ledger(party_id, occurred_at, entry_type, amount_krw, payment_id, memo)
  values (p_party_id, p_paid_at, 'PAYMENT', -round(v_total,0), v_payment_id, p_memo);

  return jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'total_amount_krw', round(v_total,0));
end $$;
```

### 4.3 프론트(UI)
- 출고 화면 (`web/src/app/(app)/shipments/page.tsx`)
  - “매장출고” 체크박스 추가
  - 매장출고일 때 버튼을 “매장출고 확정”으로 변경 → `cms_fn_confirm_store_pickup_v1`
  - 일반 출고는 기존 `cms_fn_confirm_shipment_v3_cost_v1`
- 미수/결제 화면 (`web/src/app/(app)/ar/page.tsx`)
  - 결제 입력에 `weight_g`, `purity` 입력 UI 추가 (method=GOLD/SILVER일 때)
  - pricing snapshot 값 표시 (shipment_id 기준 조회)

## 5) 테스트 플랜 (필수 8케이스)

> 각 케이스 공통 검증 포인트
> - `cms_shipment_header.pricing_locked_at`/`pricing_source`
> - `cms_shipment_valuation` 스냅샷 값
> - `cms_shipment_line` 스냅샷 값
> - `cms_ar_ledger` 합계
> - `cms_payment_tender_line` 금/은 계산 필드

1) **매장출고 OFF + 전액 현금**
   - 입력: `is_store_pickup=false`, CASH 100%
   - 기대: `pricing_source=CONFIRM_SHIPMENT`, AR = total

2) **매장출고 OFF + silver 일부 + 현금**
   - 입력: SILVER(925) + CASH
   - 기대: `value_krw`는 스냅샷 시세로 계산, AR 잔액 감소

3) **매장출고 OFF + 14K gold 일부 + 현금**
   - 입력: GOLD(14K) + CASH
   - 기대: fine_weight=weight*0.6435 적용

4) **매장출고 ON + 전액 현금**
   - 입력: `is_store_pickup=true`, store_pickup_confirm 시점 가격 확정
   - 기대: `pricing_source=STORE_PICKUP_CONFIRM`, 시세 스냅샷이 pickup 시점으로 고정

5) **매장출고 ON + silver 일부 + 현금**
   - 입력: SILVER(925) + CASH
   - 기대: 스냅샷 시세(매장 픽업 확정 시점) 사용

6) **매장출고 ON + 18K gold 일부 + 현금**
   - 입력: GOLD(18K) + CASH
   - 기대: fine_weight=weight*0.825 적용

7) **매장출고 ON 설정 후 확정 전/후 시세 변경**
   - 입력: 시세 변경 전/후 확정
   - 기대: `pricing_locked_at` 시점 스냅샷 값 고정 (후속 시세 변경 무시)

8) **결제 취소/수정(레저 정합성)**
   - 입력: 결제 수정(취소 처리 또는 상계)
   - 기대: `cms_ar_ledger` 합계 = `total_value_krw - sum(payment)`
