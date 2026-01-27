# 주문(라인) 페이지 PRD (Phase1) — “Sales / Orders”

---

> **PRD 원칙:** 입력 속도 최우선, 상태 전환의 명확성, 출고(Shipment)로의 자연스러운 연결, 운영 로그 및 라벨 데이터 축적.

## 1. 목표 (Why)
* **빠른 입력:** 거래처 주문을 라인 단위로 즉시 입력 (필수 4개 항목 집중).
* **가격 분리:** 주문 단계에서는 가격을 입력하지 않음 (출고 확정 시점에만 잠금 및 관리).
* **이력 관리:** 모든 주문 라인의 상태 전환은 로그(`cms_status_event`)로 남아야 함.
* **연결성:** 여러 주문 라인을 선택하여 거래처별 **“출고 만들기(Shipment Draft)”** 기능 제공.

---

## 2. 사용자 및 권한

### 2.1 Staff
* 주문 라인 생성/수정(본인 및 전체) 가능.
* 상태 전환 및 “출고 만들기” 기능 수행 가능.

### 2.2 Admin
* Staff의 모든 권한 포함.
* 예외 처리 및 데이터 오버라이드 허용 (단, `cms_decision_log`에 기록 필수).
* **참고:** Phase1에서는 앱 레벨 RBAC를 우선 적용하고, 안정화 후 DB 레벨 보안(RLS) 강화.

---

## 3. 화면 구성 및 레이아웃

### 3.1 상단: “빠른 주문 입력” 패널 (고정)
* **입력 방식:** 입력 후 `Enter` 또는 `저장` 버튼 클릭 시 즉시 하단 리스트에 반영.
* **연속 입력:** “거래처 유지” 토글 옵션을 제공하여 동일 거래처의 여러 모델을 빠르게 입력.
* **필수 입력 항목 (Phase1 LOCK):**
  * `customer_party_id` (거래처) ✅
  * `model_name` (모델명) ✅
  * `suffix` (종류) ✅
  * `color` (색상) ✅
* **옵션 입력 항목:**
  * `qty` (기본값 1)
  * `size` (선택 사항)
  * **도금 정보:** `is_plated` 체크 시 `plating_variant_id` 선택 활성화.
  * `requested_due_date` (납기) & `priority_code` (우선순위) : 리드타임 분석을 위해 Phase1 적용 권장.
  * `source_channel` (주문 경로: 전화/카톡/현장 등)
  * `memo`

### 3.2 하단: “주문 리스트 및 필터” 영역 (고정)
* **기본 소스:** `cms_v_order_worklist` (정렬: `created_at DESC`)
* **핵심 필터:**
  * 상태(`status`), 거래처(`customer`), 도금 여부(`is_plated`)
  * 납기 임박(`requested_due_date` 기준 정렬/필터)
  * 공장 추정(`vendor_guess`) 및 카테고리(Master 연동) 필터
* **주요 컬럼:** 생성일시, 거래처명, 모델명/S/C/S, 수량, 도금상태, 납기/우선순위, 상태, 매칭상태, 메모.

---

## 4. 데이터 계약 및 백엔드 요구사항

### 4.1 핵심 데이터 (cms_order_line)
* **직접 입력:** `customer_party_id`, `model_name`, `suffix`, `color`, `qty`, `size`, `is_plated`, `plating_variant_id`, `memo`.
* **시스템 필드:** `status`, `vendor_party_id_guess`, `matched_master_id`, `match_state`.

### 4.2 백엔드 의존성 (구현 갭 보완 필요)
> **중요:** 현재 `cms_fn_upsert_order_line_v1` 시그니처에는 납기, 우선순위, 채널 필드가 누락되어 있을 수 있음.
* **해결 방안:** 1. `cms_fn_upsert_order_line_v2` 생성 (v1 인자 + `requested_due_date`, `priority_code`, `source_channel` 포함).
  2. 또는 메타 데이터 업데이트 전용 RPC(`cms_fn_update_order_meta_v1`) 추가 구현.

---

## 5. 주요 유저 플로우

### 5.1 주문 라인 생성
1. 상단 폼 입력 후 저장 버튼 클릭.
2. `cms_fn_upsert_order_line_v1` (또는 v2) 호출.
3. 성공 시 리스트 리프레시 및 신규 행 하이라이트.
4. **검증:** `qty >= 1` 확인, 도금 체크 시 옵션 필수, 문자열 Trim 처리.

### 5.2 주문 라인 수정
1. 리스트 내 행 편집 클릭 → 값 수정 → 저장.
2. 동일 RPC를 사용하여 업데이트 수행 (단, `status` 변경은 별도 버튼 플로우 사용).

### 5.3 상태 변경 (Status Transition)
* **동작:** "ORDER_PENDING" 등의 상태를 버튼 클릭으로 전환.
* **기록:** 변경 시 반드시 `cms_status_event` 및 `cms_decision_log`에 이력 적재.
* **필요 RPC:** `cms_fn_set_order_line_status_v1` 신규 구현 권장.

### 5.4 출고 만들기 (Shipment Creation)
1. 리스트에서 N개 라인 선택 → **“출고 만들기”** 클릭.
2. 시스템 내부 동작:
   * 선택 라인을 `customer_party_id`별로 그룹화.
   * 그룹별 `cms_fn_create_shipment_header_v1` 호출.
   * 생성된 `shipment_id`에 주문 라인 추가(`cms_fn_add_shipment_line_from_order_v1`).
3. **권장:** 원자성 보장을 위해 `cms_fn_create_shipments_from_order_lines_v1` 단일 트랜잭션 RPC 구현.

---

## 6. 데이터 표시 규칙
* **가격 숨김:** 주문 페이지에서는 가격 관련 정보를 노출하지 않음 (출고 단계 전담).
* **가시성 강조:** `match_state`가 **UNMATCHED**인 경우 강조 표시하여 운영자 확인 유도.
* **메타 데이터:** 납기, 우선순위, 도금 여부를 직관적인 배지(Badge) 형태로 표시.

---

## 7. 수용 기준 (Acceptance Criteria)

* **AC-1 (입력 검증):** 필수 4요소(거래처/모델/종류/색상) 누락 시 저장 불가 처리.
* **AC-2 (필터링):** 상태 및 납기 임박 필터가 실시간으로 정확한 데이터를 반환해야 함.
* **AC-3 (출고 연동):** 선택된 주문들이 거래처별로 묶여 정확히 Shipment Draft로 전환되어야 함.
* **AC-4 (로그 적재):** 모든 상태 변경 이벤트가 DB 로그 테이블에 정상적으로 기록되어야 함.

---
# TASK: 주문 > 주문등록(Order Registration) 페이지 UX/데이터 연동 구현

## 목표(한 문장)
하단 그리드에서 거래처/모델명을 입력하고 셀을 벗어나면(blur) 즉시 데이터 조회 → 상단 기본정보/좌측 이미지/가격패널이 자동 갱신되며, 그리드 컬럼을 요구사항대로 개편한다.

---

## A) 필수 플로우 1 — 거래처 입력 → 기본정보에 미수/거래처 정보 표시

### 트리거
- 그리드의 `거래처(Client)` 셀에서 값 입력 후 다른 셀로 이동(blur)할 때

### 동작
1) 입력값으로 거래처를 조회해 `client_id`를 확정한다(정확 매칭 우선, 없으면 부분매칭 1건이면 자동 확정).
2) 거래처 확정 즉시 상단 `기본정보` 카드에 아래 정보를 표시한다:
   - 거래처명(client_name)
   - 미수금(balance_krw)
   - 마지막거래일(last_tx_at) (있으면)
   - (있으면) 미수건수/open_invoices_count, 한도/credit_limit_krw, 리스크 플래그/risk_flag

### 데이터 소스
- `cms_ar_ledger` 기반 집계 결과를 조회한다.
- 구현 방식은 둘 중 하나로:
  - (권장) 뷰: `v_cms_ar_client_summary` (key: client_id) 사용
  - 또는 RPC: `fn_cms_get_ar_summary_by_client(client_id)` 사용

### 제약(중요)
- 한 주문(헤더)은 거래처 1개 고정.
  - 첫 확정된 client_id를 헤더 client_id로 저장.
  - 이후 다른 행에서 다른 거래처를 입력하려 하면: 경고 후 롤백(또는 입력 자체를 잠금).
  - 가능하면 첫 행에서만 거래처 수정 가능하고 나머지 행은 자동 채움/읽기전용 처리.

### 실패 처리
- 거래처 미매칭이면:
  - 해당 셀 에러 표시 + 기본정보 카드 비움(또는 안내문)
  - client_id 확정 금지

---

## B) 필수 플로우 2 — 모델명 입력 → 좌측 이미지 + 소재/공임 정보 표시

### 트리거
- 그리드의 `모델번호(Model)` 셀 blur

### 동작
1) 입력된 모델명으로 `cms_master_item`에서 마스터를 조회한다.
2) 성공 시:
   - 좌측 이미지 박스에 `photo_url`로 이미지 프리뷰 표시
   - 화면 어딘가(기본정보 카드 하단 추천)에 가격 패널 표시/갱신:
     - 소재가격(material_price)
     - 기본공임(labor_basic)
     - 중심공임(labor_center)
     - 보조1공임(labor_side1)
     - 보조2공임(labor_side2)
   - 해당 row에도 아래 값을 캐시/저장(숨김 컬럼 가능):
     - master_item_id, photo_url, material_price, labor_basic/center/side1/side2
3) 실패(모델 미존재) 시:
   - 모델 셀 에러 표시
   - 좌측 이미지/가격패널은 비우기(이전 값 남기지 않기)

### 데이터 소스
- 뷰/함수 중 하나 사용:
  - 뷰: `v_cms_master_item_lookup` (key: model_no)
  - 또는 RPC: `fn_cms_get_master_item_by_model(model_no)`
- 반환 필수 컬럼:
  - master_item_id, model_no, photo_url, material_price, labor_basic, labor_center, labor_side1, labor_side2

### 성능/UX
- 같은 모델 재입력 시 캐시(Map)로 API 호출 최소화
- blur 이벤트에서 “이전 값과 동일”하면 조회 스킵
- 이미지 로딩 중 로더 표시(깜빡임 방지)

---

## C) 그리드 컬럼 개편(요구사항 고정)

### 1) `매입처` 컬럼 삭제
- UI에서 완전 제거. 저장 payload에도 포함하지 말 것.

### 2) 기존 `도금옵션(Plating)` 컬럼 제거하고 아래 컬럼 8개로 분해
(스톤/수량 6 + 도금 2)

#### 스톤/수량 6개
- 중심석 (dropdown/autocomplete)
- 중심개수 (int >= 0)
- 보조1석 (dropdown/autocomplete)
- 보조1개수 (int >= 0)
- 보조2석 (dropdown/autocomplete)
- 보조2개수 (int >= 0)

검증 규칙:
- 석이 선택되면 개수는 1 이상(저장 시 강제)
- 개수만 있고 석이 비면 저장 불가(에러)

데이터 소스:
- `v_cms_stone_catalog` 또는 이에 준하는 stone 목록 뷰/테이블

#### 도금 2개
- 도금여부 (checkbox)
- 도금색상 (dropdown)

검증/동작:
- 도금여부=false면 도금색상 disabled + 값 null 강제
- 도금여부=true면 도금색상 필수

도금색상 소스:
- `v_cms_plating_color` 또는 enum(화이트/옐로우/로즈/블랙/투톤 등)

### 3) 마지막열 `상태` → `비고`
- `상태` 컬럼 제거
- `비고(remark/memo)` 텍스트 컬럼 추가(한 줄)

---

## D) 저장(등록) 버튼 완료조건(수용기준)

1) 헤더에 client_id 확정되어 있어야 저장 가능
2) 최소 1개 라인이 유효해야 저장 가능:
   - model_no + master_item_id 존재
   - qty > 0
3) 도금여부=true인 행은 plating_color 필수
4) 스톤-개수 짝 검증 통과

저장은 “테이블 직접 write 금지” 원칙을 지키고 RPC/함수로 처리할 것(프로젝트 규칙 준수).

---

## E) 구현 산출물
- 주문등록 페이지에서 위 플로우가 실제로 동작하도록 프론트 이벤트/상태관리/데이터패칭 코드 적용
- 그리드 컬럼 변경 반영
- 에러/로딩 상태 UI 반영
