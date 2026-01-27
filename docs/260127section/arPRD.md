# CMS Phase1 PRD — 미수(AR) 페이지 (SoT = public.cms_*)

- **문서버전:** v1.0 (2026-01-27)
- **스코프:** **미수/수금/반품에 따른 AR(Accounts Receivable) 포지션 조회 + 결제/반품 등록**
- **SoT(단일 진실원천):** **Postgres public 스키마의 `cms_*` 테이블/뷰/RPC**
- **쓰기 정책:** **UI는 base table 직접 INSERT/UPDATE/DELETE 금지, RPC(Function)로만 write**
- **읽기 정책:** **뷰/테이블 SELECT는 허용**(단, 운영 정책상 staff는 뷰만 쓰도록 권장)
- **이번 PRD 반영 수정사항(확정):** **반품 RPC는 누적반품수량 검증이 있는 `cms_fn_record_return_v2`를 사용**

---

## 0) 목표

### 0.1 이 페이지가 해결해야 하는 것
1. 거래처(고객)별 **현재 미수 잔액**을 즉시 파악
2. 고객별 **미수 포지션(미수/크레딧 분리)**와 최근 활동을 한 화면에서 확인
3. 고객에 대해
    - **수금(결제) 등록**
    - **반품 등록(출고 라인 기준, 누적 반품수량 검증 포함)**
4. 모든 변경은 **원장(cms_ar_ledger)**에 남아야 하며, 조회 뷰는 원장 기반으로 일관되게 움직여야 한다

### 0.2 비목표(Phase1에서 안 함)
- OFFSET/ADJUST 엔트리 직접 입력 UI (enum은 존재하지만, 현재 전용 RPC가 없음)
- AR의 임의 수정/삭제(원장 성격상 add-only를 전제)

---

## 1) 도메인 “헌법”(절대 규칙)

1. **SoT = `public.cms_*`**
2. UI는 **RPC만 write**
    - **금지:** `insert/update/delete public.cms_*` 직접 실행
3. **원장 부호 규칙(LOCK)**
    - `amount_krw`는 “미수 증가 = +, 미수 감소 = -”
    - **PAYMENT/RETURN은 음수로 기록**(이미 RPC 구현이 그렇게 동작)
    - SHIPMENT는 +로 기록되어야 함(출고 확정 RPC에서 생성되는 것이 정상)
4. **반품은 “출고 라인” 단위로 관리한다**
    - **누적 반품수량이 출고수량을 절대 초과하면 안 됨**(서버에서 막음)

---

## 2) 사용자/권한

### 2.1 역할
- **Staff(실사용자):** 고객 미수 조회, 수금 등록, 반품 등록
- **Admin(운영/관리):** Staff 기능 + 데이터 점검(Phase1에서는 UI 차등 최소화 가능)

### 2.2 권한 원칙
- `Staff`/`authenticated`는 **RPC 실행만 허용(쓰기)**
- base table 직접 write는 **DB 권한/RLS로 차단**(운영 전 필수 점검 항목에 포함)

---

## 3) 데이터 모델(AR 관련 SoT)

### 3.1 핵심 테이블

#### 3.1.1 `cms_ar_ledger` (원장: 단일 진실)
- **PK:** `ar_ledger_id`
- **핵심 컬럼:**
  - `party_id` (고객)
  - `occurred_at`
  - `entry_type` (`cms_e_ar_entry_type`: SHIPMENT/PAYMENT/RETURN/OFFSET/ADJUST)
  - `amount_krw` (원장 금액, 부호 규칙 적용)
  - **참조:** `shipment_id`, `shipment_line_id`, `payment_id`, `return_line_id`
  - `memo`
- **원칙:** **미수 포지션/잔액 계산은 원장 기반**

#### 3.1.2 결제
- **`cms_payment_header`**
  - `payment_id`, `party_id`, `paid_at`, `total_amount_krw`, `memo`
- **`cms_payment_tender_line`**
  - `tender_line_id`, `payment_id`, `method`, `amount_krw`, `meta`

#### 3.1.3 반품
- **`cms_return_line`**
  - `return_line_id`, `party_id`, `shipment_line_id`, `return_qty`
  - `auto_return_amount_krw`, `final_return_amount_krw`
  - `reason`, `occurred_at`

#### 3.1.4 고객(거래처)
- **`cms_party`** (+ 주소/담당자 링크)
  - `party_type` = `cms_e_party_type` (customer/vendor)
  - AR 페이지는 기본적으로 **customer만** 대상

### 3.2 조회 뷰(AR 페이지 기본 데이터소스)
- **`cms_v_ar_balance_by_party`**
  - `party_id, party_type, name, balance_krw, last_activity_at`
- **`cms_v_ar_position_by_party`**
  - `party_id, party_type, name, balance_krw, receivable_krw, credit_krw, last_activity_at`
  - **UI는 기본적으로 이 뷰를 “고객 목록/요약” 메인 소스로 사용**

### 3.3 enum (UI에서 그대로 사용)
- `cms_e_ar_entry_type`: `SHIPMENT | PAYMENT | RETURN | OFFSET | ADJUST`
- `cms_e_payment_method`: `BANK | CASH | GOLD | SILVER | OFFSET`
- `cms_e_party_type`: `customer | vendor`

---

## 4) 페이지 IA / 화면 구성 (미수 페이지 단독)

### 4.1 상단 요약(Sticky Summary Bar)
- **전체 요약 KPI(선택):**
  - 총 미수합(= Σ receivable_krw)
  - 총 크레딧합(= Σ credit_krw)
  - 총 잔액합(= Σ balance_krw)
- **데이터:** `cms_v_ar_position_by_party`에서 `party_type='customer'` 필터 후 합산

### 4.2 좌측(또는 상단) 고객 리스트 패널
#### 4.2.1 데이터 소스
- `cms_v_ar_position_by_party`
- **필터:**
  - `party_type = 'customer'`
  - (선택) `balance_krw != 0` 토글
  - **검색:** 고객명(name), 전화(phone는 party 테이블 조인 필요 시 추가 조회)

#### 4.2.2 컬럼(필수)
- 고객명
- `balance_krw`
- `receivable_krw`
- `credit_krw`
- `last_activity_at`

#### 4.2.3 표시 규칙
- `balance_krw > 0` → “미수”
- `balance_krw < 0` → “크레딧(선수금/환불대기 성격)”
  - 실제 수치는 `credit_krw`로 보여주고, balance는 음수 표시/배지로 처리

### 4.3 우측(또는 하단) 고객 상세 패널
고객 선택 시 아래 탭 구성 권장:

#### 탭 A) 원장(AR Ledger)
##### 4.3.1 데이터 소스
- `cms_ar_ledger`를 `party_id`로 조회(정렬: `occurred_at desc, created_at desc`)
- **필터(선택):**
  - 기간(from/to)
  - `entry_type` 멀티 선택

##### 4.3.2 컬럼(필수)
- occurred_at
- entry_type
- amount_krw (부호 포함)
- memo
- **참조 링크:**
  - `payment_id` 있으면 “결제 상세”로 드릴다운(또는 모달)
  - `return_line_id` 있으면 “반품 상세”로 드릴다운
  - `shipment_id`/`line_id` 있으면 “출고 상세”로 드릴다운

#### 탭 B) 수금(결제) 등록
- **버튼:** **[수금 등록]**
- **모달/폼 항목:**
  - `paid_at` (datetime, 기본값 now)
  - `memo` (선택)
  - **Tender Lines(복수):**
    - `method`: `cms_e_payment_method`
    - `amount_krw`: 숫자(>0)
    - `meta`: 선택(예: 계좌번호, 은행명, 입금자명 등)
  - **합계 표시:** Σ amount_krw

#### 탭 C) 반품 등록
- **버튼:** **[반품 등록]**
- **핵심:** 반품은 반드시 **출고 라인(shipment_line)**을 선택해야 한다.
- **데이터소스(선택 UI 구현 방법):**
  - **최소 구현:** `cms_shipment_line` + `cms_shipment_header` 조인하여
    - `customer_party_id = 선택 고객`
    - (권장) `shipment_header.status = CONFIRMED` 또는 `confirmed_at not null` 조건
  - **리스트에 보여줄 최소 컬럼:**
    - `ship_date` / `shipment_id`
    - `model_name` / `suffix` / `color` / `size`
    - `shipped_qty` (sl.qty)
    - `line_total_sell` (sl.total_amount_sell_krw)
- **모달/폼 항목:**
  - shipment_line 선택
  - **잔여 반품 가능 수량 표시**
    - 서버 응답(`returned_qty_before`, `remaining_qty`) 기반으로 표시하는 걸 권장
    - 또는 UI가 `cms_return_line` 합산해서 선계산해도 됨(정확성은 서버가 최종 보장)
  - `return_qty` (정수, 1..remaining)
  - `occurred_at` (datetime, 기본값 now)
  - `override_amount_krw` (선택, 비워두면 자동)
  - `reason` (선택)

---

## 5) RPC 계약(쓰기 = RPC only)

### 5.1 수금 등록 RPC
#### 함수
- `public.cms_fn_record_payment(p_party_id uuid, p_paid_at timestamptz, p_tenders jsonb, p_memo text) returns jsonb`

#### 입력 JSON (p_tenders)
```json
[
  { "method": "BANK", "amount_krw": 1000000, "meta": { "bank": "국민", "account_last4": "1234" } },
  { "method": "CASH", "amount_krw": 50000, "meta": {} }
]
```

#### 서버 검증(이미 구현)
- `p_tenders`는 jsonb array여야 함
- 각 라인의 `amount_krw > 0`
- `method`는 enum 캐스팅으로 검증됨

#### DB 부작용(정상 동작 정의)
- `cms_payment_header` 생성
- `cms_payment_tender_line` 여러 줄 생성
- `cms_ar_ledger`에 `entry_type=PAYMENT`, `amount_krw = -total` 로 1줄 기록

#### UI 후처리
- **성공 시:**
  - 고객 리스트(뷰) refresh
  - 고객 상세 원장 refresh
  - 모달 close + toast

### 5.2 반품 등록 RPC (수정사항 반영: v2 사용)
#### 함수(필수 사용)
- **`public.cms_fn_record_return_v2(...) returns jsonb`**
- (현재 DB에 아직 없으면, 이전에 준 SQL로 먼저 생성해야 함)
- **만약 `cms_fn_record_return`만 존재하고 v2가 아직 없다면:** v2를 추가한 뒤 UI는 v2로 전환이 Phase1 기준

#### 서버 검증(요구사항/확정)
- `return_qty > 0`
- `return_qty <= shipped_qty` (기존)
- **누적 반품수량 합산 + 초과 차단 (v2의 핵심)**
  - `SUM(cms_return_line.return_qty where shipment_line_id=...) + p_return_qty <= shipped_qty`

#### 금액 계산(현 로직 유지)
- **auto:** `(shipment_line.total_amount_sell_krw / shipment_line.qty) * return_qty` (round)
- **final:** `override` 있으면 override, 없으면 auto

#### DB 부작용
- `cms_return_line` 생성
- `cms_ar_ledger`에 `entry_type=RETURN`, `amount_krw = -final` 로 1줄 기록

#### UI 에러 처리(필수 매핑)
- **예외 메시지에 “exceeds remaining qty”가 포함되면:**
  - “잔여 반품 가능 수량을 초과했습니다.”로 변환 표시
  - 나머지는 일반 오류로 표준 처리

---

## 6) UX 디테일(운영용)

### 6.1 입력 기본값
- `paid_at` / `occurred_at`: 기본 now(Asia/Seoul 표시)
- `return_qty`: 기본 1 (단, remaining=0이면 버튼 비활성)

### 6.2 표시 단위/포맷
- **KRW:** 천단위 콤마, 소수점 0자리(round) 기준
- **날짜/시간:** YYYY-MM-DD HH:mm

### 6.3 링크/드릴다운
원장 행에 참조 ID가 있으면 해당 도메인 페이지로 이동:
- **출고 페이지:** `shipment_id`
- **결제 상세(간단 모달 가능):** `payment_id` + tender lines
- **반품 상세(간단 모달 가능):** `return_line_id`

---

## 7) 운영 안정성 요구사항

### 7.1 동시성(중요)
- 반품은 `shipment_line`을 `FOR UPDATE`로 잠가야 함
- v2 구현에 포함(권장/필수)

### 7.2 멱등성
- 결제/반품 RPC는 현재 `idempotency_key`가 없음
- Phase1에서는 운영 프로세스상 **“중복 클릭 방지(UI)”**로 1차 방어
- Phase1.1에서 idempotency 확장 고려(결제/반품에 키 추가)

---

## 8) 고정 회귀 테스트(AR 페이지 전용 5개)
1. **결제 멀티 텐더 합산 정확**
   - BANK 100,000 + CASH 50,000 입력
   - `cms_payment_header.total_amount_krw=150,000`
   - `cms_ar_ledger(PAYMENT).amount_krw=-150,000`
2. **반품 자동금액 계산**
   - shipped_qty=10, line_total_sell=1,000,000
   - return_qty=2 → auto=200,000 (round)
   - ledger RETURN amount=-200,000
3. **반품 override 금액 적용**
   - `override_amount_krw=123,456`
   - `return_line.final_return_amount_krw=123,456`
   - ledger RETURN amount=-123,456
4. **누적 반품 초과 차단(v2 핵심)**
   - shipped_qty=5
   - 1차 return_qty=3 성공
   - 2차 return_qty=3 시도 → 서버 예외로 실패(remaining=2)
5. **잔액/포지션 정상(결제+반품 조합)**
   - SHIPMENT +500,000
   - PAYMENT -300,000
   - RETURN -100,000
   - **최종 balance=100,000 (receivable 100,000 / credit 0 형태로 일관)**

---

## 9) 코딩 에이전트 구현 지시(미수 페이지 범위)

- **READ:**
  - 고객 목록/요약: `cms_v_ar_position_by_party` (customer만)
  - 고객 원장: `cms_ar_ledger where party_id = :selected`
- **WRITE:**
  - 수금 등록: `cms_fn_record_payment`
  - 반품 등록: `cms_fn_record_return_v2` (누적 초과 차단 포함)
- **금지:**
  - `insert/update/delete`로 base table 직접 변경
  - OFFSET/ADJUST UI 구현(Phase1 비범위)
- **필수 UX:**
  - 반품 모달에 `shipped_qty` / `returned_before` / `remaining` 표시
  - 실패 메시지(누적초과)는 사용자 친화 문구로 변환