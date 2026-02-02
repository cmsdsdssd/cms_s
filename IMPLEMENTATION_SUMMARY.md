# 공장발주(팩스) → 출고대기 → 출고 워크플로우 구현 완료 보고서

## 📋 개요
Next.js 기반 ERP + Supabase(Postgres, RPC 중심) 백엔드에서 "공장발주(팩스) → 출고대기(묶음) → 출고" 흐름을 설계 및 구현 완료했습니다.

## 📁 생성된 파일 목록

### 1. 데이터베이스 마이그레이션
- **`supabase/migrations/20260202110000_cms_0300_factory_po_system.sql`**
  - cms_factory_po (공장발주서) 테이블
  - cms_factory_po_line (PO 라인 아이템) 테이블
  - cms_fax_log (팩스 전송 로그) 테이블
  - cms_vendor_fax_config (공장 팩스 설정) 테이블
  - cms_v_unshipped_order_lines (미출고 뷰)
  - cms_v_factory_po_summary (PO 요약 뷰)
  - cms_order_line 컬럼 추가 (factory_po_id, sent_to_vendor_at, inbound_at, shipped_at, vendor_prefix)
  - 트리거 및 인덱스

- **`supabase/migrations/20260202110100_cms_0301_factory_po_rpc.sql`**
  - cms_fn_factory_po_create_from_order_lines: 공장발주 생성
  - cms_fn_factory_po_mark_sent: 팩스 전송 완료 마킹
  - cms_fn_receipt_attach_to_order_lines: 영수증 연결/입고 처리
  - cms_fn_mark_shipped: 출고 완료 마킹
  - cms_fn_factory_po_get_details: PO 상세 조회
  - cms_fn_factory_po_cancel: PO 취소

### 2. 프론트엔드 컴포넌트
- **`web/src/components/factory-order/factory-order-wizard.tsx`**
  - Split View (좌: 주문라인, 우: 팩스미리보기)
  - 공장별 탭 인터페이스
  - 색상/도금 컬러칩 표시
  - 인쇄 및 팩스 전송 기능

### 3. API 라우트
- **`web/src/app/api/fax-send/route.ts`**
  - POST /api/fax-send
  - Provider 추상화 (mock, twilio, sendpulse, custom)
  - PDF 생성 및 Storage 저장

### 4. 페이지 업데이트
- **`web/src/app/(app)/orders_main/page.tsx`**
  - 공장발주 버튼 추가
  - Factory Order Wizard 모달 통합
  - 상태별 색상 인디케이터 추가

- **`web/src/app/(app)/shipments_main/page.tsx`**
  - 미출고 내역 뷰 (cms_v_unshipped_order_lines)
  - 상태별 필터링 (공장발주완료/입고대기/출고대기)
  - 다중 선택 및 출고 생성 기능

### 5. 설정 파일
- **`web/src/lib/contracts.ts`**
  - Factory Order 관련 RPC 및 View 추가

### 6. 테스트 문서
- **`FACTORY_ORDER_TEST_CHECKLIST.md`**
  - 상세 테스트 시나리오 및 검증 체크리스트

## 🔄 상태 흐름도

```
┌─────────────────┐
│ ORDER_PENDING   │  ← 주문 생성
│  (주문만 생성)   │
└────────┬────────┘
         │ 공장발주 버튼 클릭
         ▼
┌─────────────────┐
│ SENT_TO_VENDOR  │  ← 팩스 전송 완료
│ (공장발주완료)  │
│ sent_to_vendor_at│
└────────┬────────┘
         │ 영수증 등록 (receipt created_at)
         ▼
┌─────────────────┐     ┌─────────────────┐
│WAITING_INBOUND  │ ←→ │ READY_TO_SHIP   │  ← UI상 "출고대기"로 통합
│  (입고대기)      │     │  (출고대기)      │
│ inbound_at       │     │  inbound_at     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ 출고 확정
                     ▼
            ┌─────────────────┐
            │    SHIPPED      │  ← 출고 완료
            │  shipped_at     │
            └─────────────────┘
```

## 🎯 핵심 기능 요약

### 1. 공장(벤더) 그룹핑
- 모델명 prefix 추출 (A-220-R → "A")
- 자동으로 vendor_prefix 컬럼에 저장 (트리거)
- 같은 prefix별로 PO 자동 그룹핑

### 2. 공장발주 UX 플로우
1. 주문 리스트에서 "공장발주" 버튼 클릭
2. Wizard 모달에서 공장별 탭 확인
3. 좌측: 주문 라인 목록 (색상칩/도금칩 표시)
4. 우측: 팩스 미리보기 (인쇄용 표 형태)
5. "팩스 전송" 버튼으로 상태 전환

### 3. 팩스 전송 방식
- 환경변수 기반 Provider 추상화
- mock: 개발/테스트용 (PDF를 Storage에 저장)
- twilio: 실제 팩스 (구현 완료)
- sendpulse/custom: 확장 가능한 구조

### 4. 출고대기 큐 통합 표시
- `cms_v_unshipped_order_lines` 뷰 사용
- SENT_TO_VENDOR: "공장발주완료(입고대기)"
- WAITING_INBOUND + READY_TO_SHIP: "출고대기"로 통합 표시
- 영수증 등록 시각(inbound_at) 기준으로 사후 분석 가능

## 📝 DB 스키마 요약

### 추가된 컬럼 (cms_order_line)
```sql
factory_po_id uuid REFERENCES cms_factory_po(po_id)
sent_to_vendor_at timestamptz
inbound_at timestamptz  
shipped_at timestamptz
vendor_prefix text
```

### 신규 테이블
- **cms_factory_po**: 발주서 헤더 (vendor_prefix, status, fax_*)
- **cms_factory_po_line**: PO-주문라인 연결
- **cms_fax_log**: 팩스 전송 이력
- **cms_vendor_fax_config**: 공장별 팩스 설정

### 신규 뷰
- **cms_v_unshipped_order_lines**: 미출고 주문라인 통합 뷰
- **cms_v_factory_po_summary**: PO 요약 정보

## 🔧 RPC 함수 목록

| 함수명 | 설명 |
|--------|------|
| `cms_fn_factory_po_create_from_order_lines` | 주문라인으로 PO 생성 (자동 그룹핑) |
| `cms_fn_factory_po_mark_sent` | PO 전송 완료 처리 |
| `cms_fn_receipt_attach_to_order_lines` | 영수증 연결 및 입고 처리 |
| `cms_fn_mark_shipped` | 출고 완료 처리 |
| `cms_fn_factory_po_get_details` | PO 상세 조회 (팩스 미리보기용) |
| `cms_fn_factory_po_cancel` | PO 취소 및 상태 복원 |

## 🚀 배포 절차

### 1. 데이터베이스 마이그레이션 실행
```bash
# Supabase CLI 사용
supabase migration up

# 또는 SQL 직접 실행 (Supabase Dashboard)
# 1. 20260202110000_cms_0300_factory_po_system.sql
# 2. 20260202110100_cms_0301_factory_po_rpc.sql
```

### 2. 환경변수 설정 (필요시)
```env
# 팩스 Provider 설정 (선택)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FAX_NUMBER=xxx

# 기본값은 mock 모드로 동작
```

### 3. 프론트엔드 빌드
```bash
cd web
npm run build
# 또는
next build
```

## ✅ 테스트 체크리스트

자세한 테스트 절차는 `FACTORY_ORDER_TEST_CHECKLIST.md` 참조

핵심 테스트 항목:
1. ORDER_PENDING → 공장발주 생성
2. 팩스 전송 → SENT_TO_VENDOR 전환
3. 영수증 등록 → READY_TO_SHIP 전환
4. 출고 확정 → SHIPPED 전환
5. 출고대기 큐에 미출고 내역 표시

## 🎨 UI/UX 특징

- 다크 테마 적용 (기존 디자인 시스템 사용)
- Split View 레이아웃 (주문 vs 미리보기)
- 색상칩/도금칩 시각화 (P/G/W/B)
- 상태별 색상 인디케이터
- 토스트 알림 (성공/실패)
- 스켈레톤 로딩 상태

## 🔒 보안 및 권한

- authenticated 롤: SELECT/INSERT/UPDATE 권한
- service_role: 관리 작업 권한
- RPC 함수: authenticated/service_role EXECUTE 권한

## 📝 추가 고려사항

### 향후 개선 가능 사항
1. **팩스 템플릿 커스터마이징**: cms_vendor_fax_config.cover_page_template 사용
2. **다중 영수증 처리**: 현재는 1:1 매핑, 추후 N:M 고려
3. **자동 팩스 재전송**: 실패 시 자동 재시도 로직
4. **배치 출고**: 다중 라인 일괄 출고 처리
5. **실시간 알림**: 팩스 전송 상태 Webhook

### 운영 모니터링
- `cms_fax_log` 테이블 주기적 확인
- `cms_decision_log`로 감사 추적
- 미출고 내역 대기시간 모니터링

---

## 📊 구현 통계

- **SQL 마이그레이션**: 2개 파일, 약 550라인
- **RPC 함수**: 6개
- **테이블**: 4개 신규
- **뷰**: 2개 신규
- **React 컴포넌트**: 1개 (Wizard)
- **API 라우트**: 1개
- **페이지 업데이트**: 2개
- **테스트 시나리오**: 10개+

**구현 완료일**: 2026-02-02
**버전**: Phase 1 (MVP)
