# 수리(Repair) 페이지 PRD — CMS Phase1 (SoT=public.cms_*)

* **문서 저장 경로:** `C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs\260127section\repairPRD.md`
* **Scope:** “수리 접수/진행/출고/정산”을 1줄(Repair Line) 단위로 관리한다.
* **SoT 고정:** `public.cms_*` 만 사용. base table 직접 write 금지(프론트/직원), RPC만 사용.

---

## 0) 헌법(절대 규칙, 위반 금지)

* **SoT=`public.cms_*` 고정:** 다른 스키마(`ms_s` 등) 참조/조인/쓰기 금지.
* **Write는 RPC-only:** UI는 `cms_fn_*` 호출만 한다.
* **직접 INSERT/UPDATE/DELETE 금지:** staff/authenticated는 base table write 권한 없어야 함.
* **상태 전이 로그는 DB가 책임:** status 변경은 반드시 DB에서 기록되도록(이미 `cms_fn_log_repair_status_change` 존재).
* **멱등/추적성:** v2 RPC에는 `p_correlation_id`, `p_actor_person_id`, `p_note` 포함(감사/디버깅).
* **금지 상태 수정 차단:** `SHIPPED`/`CANCELLED`는 수정 불가(이미 v2에서 강제).
* **출고는 출고 페이지에서:** 수리 페이지는 “출고라인 생성” 버튼만 제공하고, 실 출고 확정/가격결정은 출고 Confirm에서 일괄 처리.

---

## 1) 데이터 모델(수리 SoT)

### 1.1 Base Table: `public.cms_repair_line`
수리 1건(1줄) = 접수부터 출고까지 흐름의 기본 단위.

* **PK:** `repair_line_id` (uuid)
* **핵심 입력:**
    * `customer_party_id` (uuid, NOT NULL)
    * `received_at` (date, NOT NULL)
    * `model_name` (text) / `model_name_raw` (text)
    * `suffix` (text) / `color` (text)
    * `material_code` (`cms_e_material_code`)
    * `qty` (int)
    * `weight_received_g` (numeric) (v1 파라미터명 혼선 있었던 부분. v2에서는 weight_received_g로 정리)
    * `is_plated` (bool) / `plating_variant_id` (uuid)
    * `repair_fee_krw` (numeric)
    * `requested_due_date` (date)
    * `priority_code` (`cms_e_priority_code`: NORMAL/URGENT/VVIP)
    * `status` (`cms_e_repair_status`)
    * `memo` (text)
    * `source_channel` (text)
    * `correlation_id` (uuid)
* **시스템:** `created_at`, `updated_at`

### 1.2 Enriched View: `public.cms_v_repair_line_enriched_v1`
수리 리스트/상세 화면에서 조인/표시용으로 사용(쓰기 금지).

* **포함(확인된 컬럼):**
    * `repair_line_id`, `customer_party_id`, `customer_name`
    * `received_at`
    * `model_name`, `model_name_raw`, `suffix`, `material_code`, `color`, `qty`
    * `measured_weight_g` (뷰에서는 `measured_weight_g`로 보이는데 base는 `weight_received_g`임. UI에서는 “입력=`weight_received_g`”, “표시=뷰 컬럼명”으로 매핑)
    * `is_plated`, `plating_variant_id`, `plating_code`, `plating_display_name`
    * `repair_fee_krw`
    * `status`, `memo`, `source_channel`, `correlation_id`
    * `created_at`, `updated_at`
* **UI 원칙:**
    * 리스트/상세 조회는 `cms_v_repair_line_enriched_v1` 사용
    * 저장/수정은 `cms_fn_upsert_repair_line_v2`만 호출

---

## 2) ENUM(상태/우선순위)

### 2.1 우선순위: `cms_e_priority_code`
* NORMAL, URGENT, VVIP

### 2.2 수리상태: `cms_e_repair_status`
* `RECEIVED` → `IN_PROGRESS` → `READY_TO_SHIP` → `SHIPPED` → `CLOSED`
* 예외/중단: `CANCELLED`
* **정책(화면 제어):**
    * `SHIPPED`, `CANCELLED`는 편집 잠금(READ ONLY).
    * `CLOSED`는 기본적으로 편집 잠금(운영상 실수 방지) 권장. (필요하면 관리자만 메모 수정 허용)

---

## 3) RPC(Write API) — 확정: `cms_fn_upsert_repair_line_v2`

### 3.1 함수 시그니처(확정)

```sql
public.cms_fn_upsert_repair_line_v2(
  p_customer_party_id uuid,
  p_received_at date,
  p_model_name text,
  p_suffix text,
  p_color text,
  p_repair_line_id uuid,
  p_model_name_raw text,
  p_material_code cms_e_material_code,
  p_qty integer,
  p_weight_received_g numeric,
  p_is_plated boolean,
  p_plating_variant_id uuid,
  p_repair_fee_krw numeric,
  p_priority_code cms_e_priority_code,
  p_requested_due_date date,
  p_source_channel text,
  p_actor_person_id uuid,
  p_note text,
  p_correlation_id uuid
) returns uuid
```

### 3.2 입력 검증(필수/에러 메시지)
* **필수:**
    * `p_customer_party_id` NULL 금지 → "customer_party_id required"
    * `p_received_at` NULL 금지 → "received_at required"
    * `p_model_name` 공백/NULL 금지 → "model_name required"
    * `p_suffix` 공백/NULL 금지 → "suffix required"
    * `p_color` 공백/NULL 금지 → "color required"
    * `p_qty` <=0 금지 → "qty must be > 0"
* **상태 제약(수정 금지):**
    * 대상 row의 status가 `SHIPPED` 또는 `CANCELLED`면 예외:
    * "cannot modify repair_line in status=% (repair_line_id=%)"
* **도금 제약(권장 강제):**
    * `p_is_plated=true` 인데 `p_plating_variant_id` NULL이면 예외:
    * "plating_variant_id required when is_plated=true"
* **정규화:**
    * trim(model_name/suffix/color)
    * `p_model_name_raw` 없으면 model_name으로 대체(표준화)

### 3.3 반환
* uuid (repair_line_id) 단일 반환
* UI는 저장 후 즉시 `cms_v_repair_line_enriched_v1` 재조회.

### 3.4 감사/추적(권장 동작)
* v2 내부에서 아래 중 최소 1개는 남겨야 함(현재 로그 테이블 존재):
    * `cms_decision_log`에 before/after 기록(수정 내용)
    * `cms_status_event` (상태 변경 시) 기록
* **PRD 요구:** `p_actor_person_id`, `p_note`, `p_correlation_id`는 로그에 반드시 반영.

---

## 4) 화면 구성(수리 페이지)

### 4.1 탭 구조(권장)
* (A) 수리 리스트
* (B) 수리 상세/편집(우측 패널 또는 별도 라우트)
* (C) 출고 연동(“출고에 담기”)

---

## 5) 수리 리스트(Repair List)

### 5.1 데이터 소스
* `select * from public.cms_v_repair_line_enriched_v1`

### 5.2 필터/정렬(필수)
* 기간: `received_at` (기본 최근 30일)
* 상태: `cms_e_repair_status` 멀티 선택
* 우선순위: `cms_e_priority_code` 멀티 선택
* 거래처: `customer_party_id` (검색: party name)
* 키워드: `model_name` / `model_name_raw` / `memo`
* **정렬 기본:**
    * `priority_code` desc (VVIP>URGENT>NORMAL)
    * `received_at` desc
    * `updated_at` desc

### 5.3 리스트 컬럼(필수)
* received_at
* customer_name
* model_name
* suffix
* color
* material_code
* qty
* weight_received_g(or measured_weight_g)
* is_plated, plating_display_name
* repair_fee_krw
* status
* requested_due_date
* updated_at

### 5.4 Row Action(필수)
* 상세보기/편집
* 상태 변경(드롭다운) (상태변경 RPC가 아직 명시되지 않았으므로 “지금은 상세에서만 변경”으로 제한 가능)
* 출고에 담기 (출고 페이지용 shipment line 생성)

---

## 6) 수리 상세/편집(Repair Detail)

### 6.1 표시 모드
* status in (`SHIPPED`, `CANCELLED`) → 완전 읽기 전용
* 그 외 → 편집 가능

### 6.2 입력 폼(필수 필드 표시)
* 거래처(`customer_party_id`) (필수)
* 접수일(`received_at`) (필수)
* 모델명(`model_name`) (필수)
* suffix (필수)
* 색상(`color`) (필수)
* 재질(`material_code`)
* 수량(`qty`) (필수, default 1)
* 접수중량(`weight_received_g`)
* 도금 여부(`is_plated`)
* 도금 옵션(`plating_variant_id`) (`is_plated=true`면 필수)
* 수리비(`repair_fee_krw`) (무상=0 허용)
* 요청납기(`requested_due_date`)
* 우선순위(`priority_code`)
* 메모(`memo`)
* 소스(`source_channel`)

### 6.3 저장 동작(필수)
* 버튼: 저장
* 호출: `cms_fn_upsert_repair_line_v2(...)` -> `repair_line_id`
* **성공 후:**
    * toast: “저장 완료”
    * 상세 재조회(view)
    * 리스트 row 업데이트 반영

### 6.4 에러 처리(필수)
* RPC 예외 메시지를 그대로 사용자에게 노출하지 말고,
* 필수값 누락/형식 오류는 필드 하단에 매핑
* 상태 잠금 오류는 상단 경고 배너:
    * “이미 출고/취소된 수리건은 수정할 수 없습니다.”

---

## 7) 출고 연동(Repair → Shipment)

### 7.1 기능 목표
* 수리건을 출고에 포함시키기 위해 Shipment Line을 생성한다.

### 7.2 사용 RPC(이미 존재)
* `public.cms_fn_add_shipment_line_from_repair_v1(...)` returns uuid

### 7.3 UI 흐름(필수)
* 상세 화면에 출고에 담기 버튼
* 클릭 시:
    * “출고 헤더 선택(또는 새로 생성)” 모달
    * 새로 생성: `cms_fn_create_shipment_header_v1(customer_party_id, ship_date, memo)` 호출
    * 선택된 `shipment_id`로 `cms_fn_add_shipment_line_from_repair_v1` 호출
* 성공하면 “출고 페이지로 이동” 링크 제공

### 7.4 정책
* 수리건 status가 `CANCELLED`면 출고 담기 금지
* `SHIPPED`인 수리건은 중복 출고 방지(추적 필드 없으면 운영상 UI에서 차단)

---

## 8) 운영 엣지케이스(수리 페이지에서 반드시 방어)

* `is_plated=true`인데 `plating_variant_id`가 비어있음 → 저장 불가
* `qty`<=0 → 저장 불가
* `SHIPPED`/`CANCELLED` 상태 수정 시도 → 저장 불가(서버 에러 캐치)
* 무상수리(`repair_fee`=0) 허용하되, 출고에서 cost 정책(있는 경우)과 충돌 여부는 출고 Confirm에서 해결
* 모델명 정규화: `model_name_raw` 유지 + `model_name` 표준 필드로 운영

---

## 9) 권한/RLS 체크(수리 관련)

* **authenticated/staff:**
    * SELECT는 뷰만 허용(권장)
    * INSERT/UPDATE/DELETE on `cms_repair_line` 차단
    * EXECUTE on `cms_fn_upsert_repair_line_v2` 허용
    * EXECUTE on `cms_fn_add_shipment_line_from_repair_v1` 허용(출고 생성 권한과 함께)
* 관리자는 별도 role로 확장(추후)

---

## 10) 테스트 시나리오(고정 5개 중 수리 관련 포함)

1.  (수리) `SHIPPED` 상태인 repair_line 수정 시도 → 반드시 실패
2.  (수리) `is_plated=true` + `plating_variant_id` NULL 저장 → 반드시 실패
3.  (출고 연동) repair_line에서 shipment_line 생성 성공 → shipment 페이지에서 조회 가능
4.  (수리비) repair_fee만 있는 수리 라인 → 출고 confirm 시 cost policy 정상(트리거/정책 확인)
5.  (정규화) model_name 공백 포함 입력 → trim 반영 확인