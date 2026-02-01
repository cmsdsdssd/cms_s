# CMS Jewelry/Accessory Order Management System - Project Structure

## Overview

**프로젝트명**: cms_s (Contract Management System for Jewelry)  
**유형**: 주얼리/액세서리 도매 주문 관리 시스템  
**기술 스택**:
- Frontend: Next.js 16.1.4 + React 19.2.3 + TypeScript 5.x
- Styling: Tailwind CSS v4 + class-variance-authority
- Database: PostgreSQL (Supabase)
- ORM/Client: @supabase/supabase-js
- State Management: TanStack Query (React Query) v5
- Forms: React Hook Form + Zod
- UI Components: Custom components with Lucide icons

---

## Directory Structure

```
cms_s/
├── web/                          # Next.js 16 frontend application
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── (app)/            # Grouped routes with layout
│   │   │   │   ├── orders/       # 주문 입력 페이지
│   │   │   │   ├── orders_main/  # 주문 관리/조회 페이지
│   │   │   │   ├── shipments/    # 출고 관리
│   │   │   │   ├── shipments_main/ # 출고 내역
│   │   │   │   ├── repairs/      # 수리 관리
│   │   │   │   ├── ar/           # 미수금(AR) 관리
│   │   │   │   ├── catalog/      # 마스터 아이템(제품) 카탈로그
│   │   │   │   ├── party/        # 거래처(고객/벤더) 관리
│   │   │   │   ├── inventory/    # 재고 관리
│   │   │   │   ├── parts/        # 부품 관리
│   │   │   │   ├── bom/          # BOM(자재명세서)
│   │   │   │   ├── market/       # 시세(금/은) 관리
│   │   │   │   ├── purchase_cost_worklist/ # 원가 작업대
│   │   │   │   ├── settings/     # 설정
│   │   │   │   └── dashboard/    # 대시보드
│   │   │   ├── api/              # API Routes (Next.js)
│   │   │   │   ├── order-lookup/
│   │   │   │   ├── order-upsert/
│   │   │   │   ├── shipment-prefill/
│   │   │   │   ├── receipts/     # 영수증 관리
│   │   │   │   ├── receipt-upload/
│   │   │   │   ├── receipt-preview/
│   │   │   │   ├── master-items/
│   │   │   │   ├── parties/
│   │   │   │   ├── vendors/
│   │   │   │   ├── market-ticks/
│   │   │   │   └── plating-options/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── providers.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── layout/           # 레이아웃 컴포넌트
│   │   │   │   ├── app-shell.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── sidebar-nav.tsx
│   │   │   │   ├── top-nav.tsx
│   │   │   │   ├── action-bar.tsx
│   │   │   │   ├── filter-bar.tsx
│   │   │   │   ├── split-layout.tsx
│   │   │   │   ├── command-palette.tsx
│   │   │   │   └── nav-items.ts  # 네비게이션 정의
│   │   │   ├── ui/               # 기본 UI 컴포넌트
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── field.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── modal.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── search-select.tsx
│   │   │   │   ├── list-card.tsx
│   │   │   │   ├── kpi-card.tsx
│   │   │   │   ├── theme-toggle.tsx
│   │   │   │   └── market-ticker.tsx
│   │   │   ├── party/            # 거래처 관련 컴포넌트
│   │   │   │   ├── PartyList.tsx
│   │   │   │   ├── PartyDetail.tsx
│   │   │   │   └── tabs/
│   │   │   └── catalog/          # 카탈로그 컴포넌트
│   │   │       ├── CatalogGalleryCard.tsx
│   │   │       └── CatalogGalleryGrid.tsx
│   │   ├── lib/                  # 유틸리티 라이브러리
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts     # Supabase 클라이언트
│   │   │   │   ├── rpc.ts        # RPC 함수 호출
│   │   │   │   └── read.ts       # 데이터 조회 유틸
│   │   │   ├── contracts.ts      # API contracts/constants
│   │   │   ├── model-name.ts     # 모델명 파싱 유틸
│   │   │   ├── image-utils.ts    # 이미지 처리
│   │   │   └── utils.ts          # 일반 유틸
│   │   └── hooks/                # React Hooks
│   │       └── use-rpc-mutation.ts
│   ├── scripts/                  # 유틸리티 스크립트
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│
├── supabase/                     # Supabase 관련 파일
│   ├── migrations/               # 151개의 DB 마이그레이션
│   │   ├── 20260127124308_cms_0001_types.sql      # Enums
│   │   ├── 20260127124309_cms_0002_tables.sql     # Core tables
│   │   ├── 20260127124310_cms_0003_indexes.sql    # Indexes
│   │   ├── 20260127124311_cms_0004_triggers.sql   # Triggers
│   │   ├── 20260127124312_cms_0005_refdata.sql    # Reference data
│   │   ├── 20260127124313_cms_0006_views.sql      # Views
│   │   ├── 20260127124314_cms_0007_functions.sql  # Core functions
│   │   ├── 20260127124315_cms_0008_security.sql   # RLS policies
│   │   ├── 20260128200000_cms_0207_inventory_types.sql    # Inventory enums
│   │   ├── 20260128200100_cms_0208_inventory_tables.sql   # Inventory tables
│   │   ├── 20260128503000_cms_0224_parts_tables.sql       # Parts tables
│   │   └── ... (151 total migrations)
│   └── snippets/                 # SQL 스니펫
│
├── docs/                         # 문서 디렉토리
├── package.json                  # Root package (supabase CLI)
└── README.md
```

---

## Database Schema Overview

### Core Business Tables

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENTITY RELATIONSHIP MAP                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  cms_person  │◄────┤cms_party_    │────►│  cms_party   │
│  (담당자)    │     │person_link   │     │  (거래처)    │
└──────────────┘     │(N:M 연결)    │     └──────────────┘
                     └──────────────┘            │
                                                  │
                     ┌──────────────┐            │
                     │cms_party_    │◄───────────┘
                     │address       │     (1:N)
                     │(주소)        │
                     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│cms_vendor_   │────►│ cms_master_  │◄────┤cms_plating_  │
│prefix_map    │     │item          │     │variant       │
│(벤더 접두사)  │     │(마스터 제품)  │     │(도금 종류)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            │
                     ┌──────┴───────┐
                     │cms_labor_band │
                     │_rule          │
                     │(공임 밴드규칙) │
                     └──────────────┘
```

### Order & Shipment Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     ORDER LIFECYCLE FLOW                        │
└────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │  주문접수   │◄──────────────────────────────────────────┐
  │ORDER_PENDING│                                           │
  └──────┬──────┘                                           │
         │                                                  │
         ▼                                                  │
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
  │ 공장발주    │────►│ 입고대기    │────►│ 출고대기    │  │
  │SENT_TO_VENDOR│   │WAITING_     │     │READY_TO_SHIP│  │
  └─────────────┘    │INBOUND      │     └──────┬──────┘  │
                     └─────────────┘            │         │
                                                ▼         │
                                          ┌─────────────┐ │
                                          │   출고완료  │─┘
                                          │  SHIPPED    │
                                          └─────────────┘
                                                │
                                                ▼
                                          ┌─────────────┐
                                          │   종료     │
                                          │  CLOSED    │
                                          └─────────────┘


┌────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: Order → Shipment → AR            │
└────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │  cms_order_line │◄──────────────────────────────┐
  │  (주문 라인)     │                               │
  │                 │                               │
  │ • customer_     │                               │
  │   party_id      │                               │
  │ • model_name    │                               │
  │ • qty           │                               │
  │ • status        │                               │
  └────────┬────────┘                               │
           │                                        │
           │ 참조                                   │
           ▼                                        │
  ┌─────────────────┐                              │
  │ cms_shipment_   │                              │
  │ line            │                              │
  │ (출고 라인)      │                              │
  │                 │                              │
  │ • order_line_id ┘                              │
  │ • shipment_id   ┐                              │
  │ • qty           │                              │
  │ • measured_     │                              │
  │   weight_g      │                              │
  │ • material_     │                              │
  │   amount_krw    │                              │
  │ • labor_total_  │                              │
  │   sell_krw      │                              │
  │ • total_amount_ │                              │
  │   sell_krw      │                              │
  └────────┬────────┘                              │
           │                                       │
           │ shipment_id                           │
           ▼                                       │
  ┌─────────────────┐     ┌─────────────────┐     │
  │ cms_shipment_   │────►│   cms_ar_ledger │     │
  │ header          │     │  (미수금 원장)   │     │
  │ (출고 헤더)      │     │                 │     │
  │                 │     │ • party_id      │◄────┘
  │ • customer_     │     │ • entry_type    │
  │   party_id      │     │ • amount_krw    │
  │ • ship_date     │     │ • shipment_id   │
  │ • status        │     │                 │
  │   (DRAFT/       │     │ entry_type:     │
  │    CONFIRMED)   │     │ - SHIPMENT (+)  │
  └─────────────────┘     │ - PAYMENT (-)   │
                          │ - RETURN (-)    │
                          │ - OFFSET        │
                          │ - ADJUST        │
                          └─────────────────┘
```

### Inventory & Parts System

```
┌─────────────────────────────────────────────────────────────────┐
│              INVENTORY MANAGEMENT (Added in Phase 2)            │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────┐
  │ cms_inventory_move_     │
  │ header                  │
  │ (입출고 헤더)            │
  │                         │
  │ • move_no (auto)        │
  │ • move_type             │
  │   (RECEIPT/ISSUE/ADJUST)│
  │ • status                │
  │   (DRAFT/POSTED/VOID)   │
  │ • party_id              │
  │ • ref_doc_type/id       │
  └───────────┬─────────────┘
              │
              │ move_id
              ▼
  ┌─────────────────────────┐
  │ cms_inventory_move_     │
  │ line                    │
  │ (입출고 라인)            │
  │                         │
  │ • direction (IN/OUT)    │
  │ • qty                   │
  │ • item_ref_type         │
  │   (MASTER/PART/UNLINKED)│
  │ • master_id ────────────┼──► cms_master_item
  │ • part_id ──────────────┼──► cms_part_item
  │ • unit_cost_krw         │
  │ • amount_krw            │
  └─────────────────────────┘

  ┌─────────────────────────┐
  │ cms_part_item           │
  │ (부품 마스터)            │
  │                         │
  │ • part_name (unique)    │
  │ • part_kind             │
  │   (PART/STONE)          │
  │ • family_name           │
  │ • unit_default          │
  │   (EA/G/M)              │
  │ • last_unit_cost_krw    │
  └───────────┬─────────────┘
              │
              │ part_id
              ▼
  ┌─────────────────────────┐
  │ cms_part_alias          │
  │ (부품 별칭)              │
  │ • alias_name (unique)   │
  └─────────────────────────┘
```

---

## Table Definitions

### 1. Party Management (거래처 관리)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_person` | 담당자/연락처 정보 | person_id (PK), name, phone, note |
| `cms_party` | 거래처(고객/벤더) | party_id (PK), party_type (customer/vendor), name, phone, region, is_active |
| `cms_party_person_link` | 거래처-담당자 N:M | party_id, person_id (composite PK), role, is_primary |
| `cms_party_address` | 거래처 주소 | address_id (PK), party_id (FK), address_text, is_default |
| `cms_vendor_prefix_map` | 벤더 모델 접두사 | prefix (PK), vendor_party_id (FK) |

**Data Flow Example**:
```
[고객 등록]
cms_party (party_type='customer', name='금거래처A')
  └─► cms_party_address (address_text='서울시...', is_default=true)
  └─► cms_party_person_link 
      └─► cms_person (name='김담당', phone='010-...')
```

### 2. Master Item (마스터 제품)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_master_item` | 제품 마스터 | master_id (PK), model_name (unique), category_code, material_code_default |
| `cms_labor_band_rule` | 공임 밴드 규칙 | band_id (PK), category_code, band_code, effective_from |
| `cms_plating_variant` | 도금 종류 | plating_variant_id (PK), plating_type (P/W/G), color_code |
| `cms_plating_price_rule` | 도금 가격 규칙 | rule_id (PK), plating_variant_id, category_code, material_code |
| `cms_market_tick` | 시세 기록 | tick_id (PK), symbol (GOLD/SILVER), price, observed_at |

**cms_master_item 주요 컬럼**:
```sql
model_name              -- 모델명 (unique)
category_code           -- 카테고리 (BRACELET, NECKLACE, EARRING, RING, etc.)
material_code_default   -- 기본 소재 (14, 18, 24, 925, 00)
weight_default_g        -- 기본 중량
deduction_weight_default_g  -- 기본 공제중량
center/sub1/sub2_qty_default  -- 원석 수량 기본값

-- 공임 판가/원가
labor_base_sell/cost    -- 기본 공임
center/sub1/sub2/bead_sell/cost  -- 원석별 공임

labor_profile_mode      -- MANUAL or BAND
labor_band_code         -- 밴드 규칙 코드 (BAND 모드시)

plating_price_sell/cost_default  -- 도금 기본가
```

### 3. Order Management (주문 관리)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_order_line` | 주문 라인 | order_line_id (PK), customer_party_id, model_name, qty, status |
| `cms_repair_line` | 수리 라인 | repair_line_id (PK), customer_party_id, received_at, status |

**cms_order_line 데이터 흐름**:
```
[주문 입력]
├─ customer_party_id  → cms_party (FK)
├─ model_name         → cms_master_item 매칭 시도
├─ suffix             -- 제품 suffix
├─ color              -- 색상
├─ size               -- 사이즈
├─ qty                -- 수량
├─ is_plated          -- 도금 여부
├─ plating_variant_id → cms_plating_variant (FK)
├─ requested_due_date -- 희망 납기일
├─ priority_code      -- NORMAL/URGENT/VVIP
├─ memo               -- 메모
├─ status             -- ORDER_PENDING → SENT_TO_VENDOR → ...
├─ vendor_party_id_guess  -- 모델 prefix로 추정된 벤더
├─ matched_master_id  -- 매칭된 마스터 ID
└─ match_state        -- UNMATCHED/AUTO_MATCHED/HUMAN_CONFIRMED
```

**Status 변경 시**:
- `cms_status_event` 테이블에 자동 기록 (trigger)
- OLD.status → NEW.status + timestamp 저장

### 4. Shipment Management (출고 관리)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_shipment_header` | 출고 헤더 | shipment_id (PK), customer_party_id, ship_date, status |
| `cms_shipment_line` | 출고 라인 | shipment_line_id (PK), shipment_id, order_line_id/repair_line_id |

**출고 확정 시 데이터 흐름** (`cms_fn_confirm_shipment`):

```
1. 입력 (shipment_line)
   ├─ measured_weight_g     -- 실측 중량
   ├─ deduction_weight_g    -- 차감중량 (마스터 기본값 or 수기)
   ├─ net_weight_g          -- 계산됨 (measured - deduction)
   └─ pricing_mode          -- RULE/UNIT/AMOUNT_ONLY

2. 가격 계산
   ├─ material_amount_sell/cost_krw
   │   └─ 금시세 * 순중량 * 퍼센티지 (14K=0.6435, 18K=0.8250, 24K=1.0)
   │   └─ 은시세 * 순중량 * 0.925 * 1.2
   │
   ├─ labor_total_sell/cost_krw
   │   └─ MANUAL: master_item 값 직접 사용
   │   └─ BAND: labor_band_rule에서 조회
   │
   ├─ plating_amount_sell/cost_krw
   │   └─ plating_price_rule 적용 (fixed + per_g)
   │
   └─ repair_fee_krw        -- 수리비 (if repair_line)

3. 총액 계산
   ├─ total_amount_sell_krw = material + labor + plating + repair_fee
   └─ total_amount_cost_krw = material + labor + plating

4. AR Ledger 생성
   └─ entry_type='SHIPMENT', amount_krw=+total_amount_sell_krw

5. Order/Repair 상태 업데이트
   └─ shipped qty 누적 → SHIPPED or READY_TO_SHIP
```

### 5. Payment & AR (결제/미수금)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_payment_header` | 결제 헤더 | payment_id (PK), party_id, paid_at, total_amount_krw |
| `cms_payment_tender_line` | 결제 수단 라인 | tender_line_id (PK), payment_id, method, amount_krw |
| `cms_return_line` | 반품 라인 | return_line_id (PK), shipment_line_id, return_qty, final_return_amount_krw |
| `cms_ar_ledger` | 미수금 원장 | ar_ledger_id (PK), party_id, entry_type, amount_krw |

**AR Ledger Entry Types**:
- `SHIPMENT`: +금액 (미수금 증가)
- `PAYMENT`: -금액 (미수금 감소)
- `RETURN`: -금액 (반품으로 미수금 감소)
- `OFFSET`: 상계
- `ADJUST`: 조정

**잔액 계산** (cms_v_ar_balance_by_party view):
```sql
SELECT party_id, SUM(amount_krw) as balance_krw
FROM cms_ar_ledger
GROUP BY party_id
```

### 6. Inventory Management (재고)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_inventory_move_header` | 입출고 헤더 | move_id (PK), move_no (seq), move_type, status |
| `cms_inventory_move_line` | 입출고 라인 | move_line_id (PK), move_id, direction, qty, item_ref_type |

**Move Types**:
- `RECEIPT`: 입고
- `ISSUE`: 출고
- `ADJUST`: 조정

**Item Ref Types**:
- `MASTER`: cms_master_item 연결
- `PART`: cms_part_item 연결
- `UNLINKED`: 미연결 (기록만)

### 7. Parts Management (부품)

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `cms_part_item` | 부품 마스터 | part_id (PK), part_name (unique), part_kind, family_name |
| `cms_part_alias` | 부품 별칭 | alias_id (PK), part_id, alias_name (unique) |

**Part Kinds**:
- `PART`: 일반 부품
- `STONE`: 원석/보석

---

## Key Business Logic Functions (RPC)

### 1. cms_fn_confirm_shipment (출고 확정)
```sql
FUNCTION cms_fn_confirm_shipment(
  p_shipment_id UUID,
  p_actor_person_id UUID,
  p_note TEXT
)
RETURNS JSONB

-- 수행 작업:
-- 1. shipment_line 가격 계산 (금속+공임+도금)
-- 2. AR ledger에 SHIPMENT 기록
-- 3. order_line/repair_line 상태 업데이트
-- 4. decision_log 기록
```

### 2. cms_fn_record_payment (결제 기록)
```sql
FUNCTION cms_fn_record_payment(
  p_party_id UUID,
  p_paid_at TIMESTAMPTZ,
  p_tenders JSONB,  -- [{method, amount_krw, meta}, ...]
  p_memo TEXT
)
RETURNS JSONB

-- 수행 작업:
-- 1. payment_header 생성
-- 2. payment_tender_line 생성
-- 3. AR ledger에 PAYMENT 기록 (-금액)
```

### 3. cms_fn_record_return (반품 기록)
```sql
FUNCTION cms_fn_record_return(
  p_shipment_line_id UUID,
  p_return_qty INT,
  p_occurred_at TIMESTAMPTZ,
  p_override_amount_krw NUMERIC,
  p_reason TEXT
)
RETURNS JSONB

-- 수행 작업:
-- 1. return_line 생성
-- 2. AR ledger에 RETURN 기록 (-금액)
-- 3. 자동 계산: (출고단가 * 반품수량)
```

### 4. Inventory Functions
```sql
-- 재고 입고/출고/조정
FUNCTION cms_fn_inventory_post_move(p_move_id UUID)
FUNCTION cms_fn_inventory_void_move(p_move_id UUID, p_reason TEXT)

-- 원가 적용
FUNCTION cms_fn_apply_purchase_cost_to_shipment_line(...)
FUNCTION cms_fn_upsert_receipt_usage_alloc_v1(...)
```

---

## Frontend Architecture

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│                     APP SHELL                                 │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────────────────────────┐  │
│  │  Sidebar     │  │           Main Content               │  │
│  │              │  │                                      │  │
│  │ • Orders     │  │   [ActionBar]                        │  │
│  │ • Shipments  │  │   ┌──────────────────────────────┐   │  │
│  │ • AR         │  │   │                              │   │  │
│  │ • Catalog    │  │   │     Page Content...          │   │  │
│  │ • Inventory  │  │   │                              │   │  │
│  │              │  │   └──────────────────────────────┘   │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Navigation Groups

| Group | Pages | Description |
|-------|-------|-------------|
| **Operations** | /orders, /orders_main, /shipments, /ar | 주문-출고-미수금 메인 업무 |
| **Cost & Receipts** | /purchase_cost_worklist | 원가 확정 작업대 |
| **Masters** | /catalog, /party, /bom | 기준 정보 관리 |
| **Stock** | /inventory | 재고 관리 |
| **Market** | /market | 시세 관리 |
| **Other** | /repairs | 수리 관리 |

### State Management Pattern

```typescript
// Data Fetching with TanStack Query
const ordersQuery = useQuery({
  queryKey: ["cms", "orders", "main"],
  queryFn: async () => {
    const { data } = await schemaClient
      .from("cms_order_line")
      .select("...")
      .order("created_at", { ascending: false })
      .limit(400);
    return data;
  },
});

// Mutations with custom hook
const shipmentUpsertMutation = useRpcMutation({
  fn: CONTRACTS.functions.shipmentUpsertFromOrder,
  successMessage: "출고 저장 완료",
  onSuccess: (data) => { ... },
});
```

---

## Enums Reference

### Party & Product
```typescript
cms_e_party_type: 'customer' | 'vendor'
cms_e_category_code: 'BRACELET' | 'NECKLACE' | 'EARRING' | 'RING' | 'PIERCING' | 'PENDANT' | 'WATCH' | 'KEYRING' | 'SYMBOL' | 'ETC'
cms_e_material_code: '14' | '18' | '24' | '925' | '00'
cms_e_plating_type: 'P' | 'W' | 'G'  // Pink, White, Gold
```

### Order & Shipment Status
```typescript
cms_e_order_status: 
  'ORDER_PENDING' → 'SENT_TO_VENDOR' → 'WAITING_INBOUND' → 
  'READY_TO_SHIP' → 'SHIPPED' → 'CLOSED' | 'CANCELLED'

cms_e_repair_status:
  'RECEIVED' → 'IN_PROGRESS' → 'READY_TO_SHIP' → 
  'SHIPPED' → 'CLOSED' | 'CANCELLED'

cms_e_shipment_status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
```

### Pricing & Payment
```typescript
cms_e_pricing_mode: 'RULE' | 'UNIT' | 'AMOUNT_ONLY'
cms_e_payment_method: 'BANK' | 'CASH' | 'GOLD' | 'SILVER' | 'OFFSET'
cms_e_ar_entry_type: 'SHIPMENT' | 'PAYMENT' | 'RETURN' | 'OFFSET' | 'ADJUST'
cms_e_match_state: 'UNMATCHED' | 'AUTO_MATCHED' | 'HUMAN_CONFIRMED' | 'HUMAN_OVERRIDDEN'
```

### Inventory
```typescript
cms_e_inventory_move_type: 'RECEIPT' | 'ISSUE' | 'ADJUST'
cms_e_inventory_move_status: 'DRAFT' | 'POSTED' | 'VOID'
cms_e_inventory_direction: 'IN' | 'OUT'
cms_e_inventory_item_ref_type: 'MASTER' | 'PART' | 'UNLINKED'
cms_e_part_kind: 'PART' | 'STONE'
```

---

## Key Workflows

### 1. 주문 → 출고 → 결제 플로우

```
Step 1: 주문 입력 (/orders)
  └─ cms_order_line INSERT (status='ORDER_PENDING')

Step 2: 주문 처리 (/orders_main)
  └─ status 업데이트 (SENT_TO_VENDOR → WAITING_INBOUND → READY_TO_SHIP)

Step 3: 출고 작성 (/shipments)
  ├─ 주문 선택 (order_line_id)
  ├─ 중량/공임 입력
  ├─ shipment_line INSERT
  └─ modal 열림 (confirm)

Step 4: 출고 확정 (modal)
  ├─ 원가 모드 선택 (PROVISIONAL/MANUAL)
  ├─ 영수증 연결 (선택)
  └─ cms_fn_confirm_shipment RPC 호출
     ├─ 가격 계산 (material + labor + plating)
     ├─ AR ledger에 기록
     └─ order_line status 업데이트

Step 5: 결제 기록 (/ar 또는 자동)
  └─ cms_fn_record_payment RPC 호출
     ├─ payment_header/tender_line 생성
     └─ AR ledger에 PAYMENT 기록
```

### 2. 시세 연동

```
시세 등록 (/market)
  └─ cms_market_tick INSERT
      ├─ symbol: 'GOLD_KRW_PER_G' or 'SILVER_KRW_PER_G'
      ├─ price: 시세
      └─ observed_at: 시점

출고 확정 시 자동 적용
  └─ cms_fn_confirm_shipment에서
      ├─ cms_fn_latest_tick('GOLD_KRW_PER_G') 조회
      ├─ gold_tick_id, gold_tick_krw_per_g 저장
      └─ material_amount 계산에 사용
```

### 3. 재고 연동

```
출고 확정 → 재고 자동 차감
  ├─ cms_fn_confirm_shipment에서
  │   └─ p_emit_inventory=true시
  │       └─ inventory_move_header/line 자동 생성
  │           (move_type='ISSUE', direction='OUT')
  │
  └─ 또는 수동 재고 조정
      └─ /inventory 페이지에서
          ├─ 입고 (RECEIPT/IN)
          ├─ 출고 (ISSUE/OUT)
          └─ 조정 (ADJUST)
```

---

## Views (조회용)

| View | Purpose |
|------|---------|
| `cms_v_ar_balance_by_party` | 거래처별 미수금 잔액 |
| `cms_v_order_worklist` | 주문 워크리스트 (고객명, 마스터정보 포함) |

---

## Indexes (성능 최적화)

| Index | Table | Columns |
|-------|-------|---------|
| `idx_cms_party_type_name` | cms_party | party_type, name |
| `idx_cms_order_customer_status` | cms_order_line | customer_party_id, status |
| `idx_cms_order_model_name` | cms_order_line | model_name |
| `idx_cms_order_created_at` | cms_order_line | created_at desc |
| `idx_cms_shipment_line_shipid` | cms_shipment_line | shipment_id |
| `idx_cms_ar_party_occurred` | cms_ar_ledger | party_id, occurred_at desc |
| `idx_cms_tick_symbol_time` | cms_market_tick | symbol, observed_at desc |

---

## Migration History Summary

| Phase | Migrations | Description |
|-------|------------|-------------|
| Phase 1 | 0001-0019 | Core system (orders, shipments, AR) |
| Phase 2 | 0200-0228 | Market tick, Inventory system |
| Phase 3 | 0224-0230 | Parts management |
| Phase 4 | 0250-0270 | Receipt/cost allocation, pricing engine |

---

*Document Version: 1.0*  
*Last Updated: 2026-02-01*  
*Total Tables: 30+*  
*Total Migrations: 151*
