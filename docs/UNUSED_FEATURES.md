# CMS Project - Unused/Underutilized Features Analysis

## Executive Summary

**분석 기준일**: 2026-02-01  
**분석 대상**: cms_s (Jewelry Order Management System)  
**마이그레이션 총수**: 151개

본 문서는 프로젝트에서 현재 활발히 사용되지 않거나, 미완성 상태이거나, 중복된 기능을 식별하여 향후 리팩토링 및 정리 우선순위를 제시합니다.

---

## 1. Potentially Unused Tables

### 1.1 `cms_decision_log` (결정 로그)

**현재 상태**: ⚠️ 미미하게 사용됨

```sql
-- 테이블 구조
cms_decision_log (
  decision_id UUID PK,
  entity_type TEXT NOT NULL,      -- 'SHIPMENT_HEADER' 등
  entity_id UUID NOT NULL,
  decision_kind TEXT NOT NULL,    -- 'CONFIRM_SHIPMENT' 등
  before JSONB,
  after JSONB,
  actor_person_id UUID,
  occurred_at TIMESTAMPTZ,
  note TEXT
)
```

**현재 사용처**:
- `cms_fn_confirm_shipment` 함수에서만 INSERT
- shipment 확정 시 before/after 상태 기록

**문제점**:
- UI에서 조회/활용되지 않음
- 감사 로그(audit trail) 용도지만 실제 활용 계획 불분명
- JSONB 컬럼으로 인해 쿼리 성능 저하 가능성

**제안**:
- [ ] 감사 로그 UI 개발
- [ ] 또는: status_event 테이블과 통합 고려
- [ ] 또는: 로테이션 정책 수립 (오래된 로그 아카이브)

---

### 1.2 `cms_status_event` (상태 변경 이벤트)

**현재 상태**: ✅ 자동 기록됨, ❌ UI 미활용

```sql
-- 테이블 구조
cms_status_event (
  event_id UUID PK,
  entity_type cms_e_entity_type,  -- ORDER_LINE, REPAIR_LINE, SHIPMENT_HEADER, INVENTORY_MOVE
  entity_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_person_id UUID,
  reason TEXT,
  correlation_id UUID
)
```

**현재 사용처**:
- Trigger에 의해 자동 INSERT (order_line, repair_line, shipment_header status 변경시)
- INVENTORY_MOVE 추가됨 (0207 migration)

**문제점**:
- UI에서 이력 조회 기능 없음
- actor_person_id가 NULL인 경우 다수 (백엔드 RPC에서 설정 안함)
- correlation_id 활용 안함

**제안**:
- [ ] 각 엔티티 상세 페이지에 "변경 이력" 탭 추가
- [ ] actor_person_id 자동 설정 (RPC 함수 수정)

---

### 1.3 `cms_repair_line` (수리 관리)

**현재 상태**: ⚠️ 테이블 존재하나 기능 미완성

**현재 사용처**:
- 테이블 구조는 완성
- `cms_shipment_line`에서 repair_line_id FK로 참조 가능
- 그러나 `/repairs` 페이지는 존재하나 기능이 제한적

**문제점**:
```typescript
// nav-items.ts에서 Repairs는 "Other" 그룹에 분리됨
{ label: "Other", items: [{ label: "Repairs", href: "/repairs", icon: Wrench }] }
```
- 수리 접수 → 처리 → 출고 플로우 미완성
- 수리비 계산 로직은 존재 (cms_fn_confirm_shipment에서 repair_fee_krw 처리)
- UI/UX가 주문(orders)에 비해 빈약

**제안**:
- [ ] 수리 워크플로우 완성
- [ ] 또는: 현재 사용하지 않는다면 테이블 보존하되 문서화

---

### 1.4 Inventory System (재고 관리)

**현재 상태**: ⚠️ Phase 2에서 추가, 부분적 사용

**관련 테이블**:
```
cms_inventory_move_header   -- 입출고 헤더
cms_inventory_move_line     -- 입출고 라인
```

**현재 사용처**:
- `cms_fn_confirm_shipment`에서 `p_emit_inventory=true` 시 자동 생성
- `/inventory` 페이지 존재

**문제점**:
- 수동 재고 조정 UI가 복잡
- 재고 현황 집계 뷰 부재
- `location_code` 컬럼은 있으나 위치 관리 기능 미구현
- `idempotency_key` 활용 안함

**제안**:
- [ ] 재고 현황 대시보드 개발
- [ ] 위치(location) 관리 기능 구현
- [ ] 자동화/연동 로직 완성 (ref_doc_type/id 활용)

---

### 1.5 Parts System (부품 관리)

**현재 상태**: ⚠️ Phase 3에서 추가, 미흡한 통합

**관련 테이블**:
```
cms_part_item      -- 부품 마스터
cms_part_alias     -- 부품 별칭
```

**현재 사용처**:
- inventory_move_line에서 part_id로 참조 가능
- `/parts` 페이지 존재

**문제점**:
- 부품-제품(BOM) 연결 테이블 부재
- reorder_min/max_qty 기능 미구현
- last_unit_cost_krw 업데이트 로직 미확인
- QR 코드 기능 (qr_code 컬럼) 미사용

**제안**:
- [ ] BOM 연결 테이블 설계
- [ ] 재주문 알림 기능 개발
- [ ] QR 코드 스캔 기능 (모바일 앱 연동 고려)

---

## 2. Underutilized Columns

### 2.1 Master Item Columns

| Column | Usage | Recommendation |
|--------|-------|----------------|
| `labor_profile_mode` | 'MANUAL' 고정 사용 중 | BAND 모드 활성화 검토 |
| `labor_band_code` | 드물게 사용 | BAND 규칙 적용 확대 |
| `sub1_qty_default`, `sub2_qty_default` | 사용 여부 불명확 | UI에서 노출/편집 기능 확인 |
| `labor_bead_sell/cost` | 사용 여부 불명확 | 구슬 공임 계산 확인 |

### 2.2 Order Line Columns

| Column | Usage | Recommendation |
|--------|-------|----------------|
| `model_name_raw` | 원본 모델명 저장 | 사용 목적 문서화 |
| `source_channel` | NULL 다수 | 채널 구분 필요성 검토 |
| `correlation_id` | 미사용 | 트랜잭션 추적용으로 활용 고려 |
| `vendor_party_id_guess` | 자동 설정됨 | UI에서 확인/수정 기능 제공 |
| `matched_master_id` | 매칭 로직 확인 필요 | 자동 매칭 정확도 개선 |

### 2.3 Shipment Line Columns

| Column | Usage | Recommendation |
|--------|-------|----------------|
| `silver_adjust_factor` | 1.2 고정 | 설정값으로 변경 가능성 검토 |
| `price_calc_trace` | JSONB로 저장됨 | 디버깅용으로 활용 가능 |
| `is_priced_final` | 플래그 존재 | 가격 확정/재계산 플로우 명확화 |

### 2.4 Payment Columns

| Column | Usage | Recommendation |
|--------|-------|----------------|
| `meta` (JSONB) | payment_tender_line | 은행/계좌 정보 저장 활용 검토 |

---

## 3. Unused/Experimental Enums

### 3.1 `cms_e_match_state`

```sql
VALUES: 'UNMATCHED', 'AUTO_MATCHED', 'HUMAN_CONFIRMED', 'HUMAN_OVERRIDDEN'
```

**현재 상태**: order_line.match_state에 저장되나 UI 미활용

**제안**:
- [ ] 마스터 매칭 관리 UI 개발
- [ ] AUTO_MATCHED 정확도 개선

### 3.2 `cms_e_priority_code`

```sql
VALUES: 'NORMAL', 'URGENT', 'VVIP'
```

**현재 상태**: 저장됨, UI에서 우선순위 표시/정렬 미흡

**제안**:
- [ ] 주문 리스트에서 우선순위 시각화
- [ ] VVIP 주문 별도 알림/처리 플로우

---

## 4. Incomplete Features

### 4.1 BOM (Bill of Materials) 관리

**현재 상태**: `/bom` 페이지 존재하나 기능 미완성

**필요 기능**:
- [ ] 제품-부품 구성 관리
- [ ] 소요량 계산
- [ ] 자동 출고/차감 로직

**관련 테이블**: 현재 없음 (설계 필요)

### 4.2 Multi-location Inventory

**현재 상태**: `location_code` 컬럼만 존재

**미구현 기능**:
- [ ] 창고/위치 마스터
- [ ] 위치별 재고 집계
- [ ] 위치 간 이동

### 4.3 Advanced Pricing Features

**현재 상태**: 기본 가격 계산만 구현

**미구현 기능**:
- [ ] 대량 할인 (qty-based discount)
- [ ] 고객별 단가
- [ ] 시즌/프로모션 가격
- [ ] 환율 변동 연동 (multi-currency)

---

## 5. Redundant/Deprecated Features

### 5.1 Vendor Prefix Map

**현재 사용처**:
```typescript
// orders_main/page.tsx
const vendorPrefixes = useMemo(() => {
  return (vendorPrefixQuery.data ?? [])
    .filter((row) => row.prefix && row.vendor_party_id)
    .map((row) => ({
      prefix: String(row.prefix ?? ""),
      vendorPartyId: String(row.vendor_party_id ?? ""),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}, [vendorPrefixQuery.data]);
```

**문제점**:
- 모델명 앞자리로 벤더 추정하는 로직
- 정확도 불확실
- 유지보수 어려움 (접두사 규칙 변경 시)

**제안**:
- [ ] master_item에 vendor_party_id 직접 저장으로 대체
- [ ] 또는: AI/패턴 매칭으로 개선

### 5.2 Multiple Order Entry Pages

**현재 상황**:
- `/orders` - 주문 입력
- `/orders_main` - 주문 관리

**문제점**:
- 두 페이지의 역할이 모호하게 중복
- 사용자에게 혼란 유발 가능

**제안**:
- [ ] 페이지 통합 또는 역할 명확화
- [ ] `/orders` → 입력 전용
- [ ] `/orders_main` → 조회/관리 전용 (현재는 혼합)

### 5.3 Unused API Routes

**확인 필요**:
```
/web/src/app/api/
├── part-items/route.ts         -- 사용 확인 필요
├── master-items/route.ts       -- 사용 확인 필요  
├── purchase-cost-worklist/     -- 내부용?
└── shipped-models/             -- 사용 확인 필요
```

---

## 6. Technical Debt

### 6.1 Environment Variable Dependencies

```typescript
// shipments/page.tsx
const actorId = (process.env.NEXT_PUBLIC_CMS_ACTOR_ID || "").trim();
```

**문제점**:
- 클라이언트에서 ACTOR_ID 노출
- 보안/감사 추적에 적합하지 않음

**제안**:
- [ ] 서버사이드 세션/인증으로 대체
- [ ] Supabase Auth 연동

### 6.2 Hardcoded Constants

```typescript
// shipments/page.tsx
const silverAdjustFactor = 1.2;  -- should be configurable
```

### 6.3 Query Limits

```typescript
// orders_main/page.tsx
.limit(400)  -- 페이지네이션 없음
```

**제안**:
- [ ] 커서 기반 페이지네이션 구현
- [ ] 무한 스크롤 또는 페이지 번호

---

## 7. Database Optimization Opportunities

### 7.1 Unused Indexes

**검토 필요** (실제 사용 패턴 분석 후):
```sql
-- 추가 인덱스 검토
idx_cms_inventory_line_item_name  -- full-text search 고려
idx_cms_decision_log_entity       -- 감사 로그 조회용
```

### 7.2 Partitioning Candidates

| Table | Partition Key | Reason |
|-------|---------------|--------|
| `cms_market_tick` | observed_at | 시간대별 데이터 축적 |
| `cms_ar_ledger` | occurred_at | 장기간 거래 내역 |
| `cms_status_event` | occurred_at | 대량 이벤트 데이터 |

### 7.3 Archive Strategy

**대상 테이블**:
- `cms_status_event` (6개월+ 데이터)
- `cms_decision_log` (1년+ 데이터)
- 완료된 `cms_order_line` (2년+ 데이터)

---

## 8. Recommendations Summary

### Priority 1 (High) - Immediate Action

| Item | Action | Effort |
|------|--------|--------|
| Repair Module | 기능 완성 또는 제거 결정 | Medium |
| Status Event UI | 이력 조회 기능 개발 | Low |
| Page Consolidation | /orders vs /orders_main 명확화 | Low |

### Priority 2 (Medium) - Next Quarter

| Item | Action | Effort |
|------|--------|--------|
| Inventory Dashboard | 재고 현황 가시화 | Medium |
| BOM System | 설계 및 개발 | High |
| Parts Integration | BOM 연결 및 재고 연동 | High |

### Priority 3 (Low) - Future Consideration

| Item | Action | Effort |
|------|--------|--------|
| Multi-location | 창고 관리 시스템 | High |
| Advanced Pricing | 프로모션/할인 시스템 | Medium |
| QR Code | 모바일 스캔 기능 | Medium |
| Audit Log | decision_log 활용 개선 | Low |

---

## Appendix: Unused Code Search Results

### A.1 Unused Files Detection

```bash
# 다음 파일들의 사용 여부 확인 필요:
web/src/app/api/part-items/route.ts
web/src/app/api/shipped-models/route.ts
web/src/app/api/purchase-cost-worklist/route.ts
```

### A.2 Commented Code Blocks

**검색 결과**: `TODO`, `FIXME`, `XXX`, `HACK` 키워드 없음

**분석**: 코드베이스가 상대적으로 깔끔함

### A.3 Migration Cleanup

**151개 마이그레이션 중 검토 대상**:
- 중복된 fix 마이그레이션 (0252-0270) - 대부분 confirm_shipment 관련
- 버전 관리 고려: production 마이그레이션 vs 개발 마이그레이션 분리

---

*Document Version: 1.0*  
*Last Updated: 2026-02-01*  
*Analysis by: Codebase Exploration*
