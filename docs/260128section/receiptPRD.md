# PRD v1.0 — 영수증 인박스 기반 원가 추적 + 임시원가 출고 허용 + 부속(ACCESSORY) 통합

## Background
너의 우선순위는 명확함:
1. **데이터 분석 1순위:** 원가/근거(영수증)까지 추적 가능한 데이터가 쌓여야 한다.
2. **운영 안정성 2순위:** 입력이 번거로우면 사람들이 안 해서 데이터가 빈칸이 되고, 분석은 망한다.
3. 현재 “부속 탭”은 입력 채널만 늘려서 누락/중복을 부르는 구조.

**이상적인 미래 목표(자동화):**
스캐너 → 웹훅 업로드 → Storage 저장 → DB 인박스 등록
이후 OCR/ML로 영수증 라인을 출고라인/상품에 자동 매칭 → 원가 자동 확정

## 목표(Goals)
* 영수증 파일을 먼저 쌓는다(근거 확보).
* 출고는 막지 않는다: 임시원가(마스터 기준)로 출고 허용.
* 원가 빈칸은 절대 방치되지 않게: worklist(작업대)로 자동 노출.
* “부속”은 별도 탭 제거하고 마스터/카테고리(ACCESSORY)로 통합.
* 추후 자동화(OCR/ML)로 확장 가능한 형태로 trace/usage/log를 남긴다.

## 비목표(Non-goals, Phase1)
* 영수증 OCR 파싱/라인 아이템 자동매칭은 Phase2
* 공급업체 체계 미흡으로 “완전 자동 원가 확정”은 Phase2
* 부속 전용 고급 재고(단위/로케이션 특수 규칙)는 Phase2 (필요하면 다시 분리)

---

## 데이터/DB 계약(확정 근거)

### 1) Receipt Inbox
* **테이블:** `public.cms_receipt_inbox`
* **컬럼(너가 뽑은 SoT):**
    * `receipt_id uuid`
    * `received_at timestamptz`
    * `source text`
    * `file_bucket text`
    * `file_path text`
    * `file_sha256 text`
    * `file_size_bytes bigint`
    * `mime_type text`
    * `vendor_party_id uuid`
    * `issued_at date`
    * `total_amount_krw numeric`
    * `currency_code text`
    * `status (enum)`
    * `memo text`
    * `meta jsonb`
    * `created_at, updated_at timestamptz`
* **enum:** `public.cms_e_receipt_status`
    * `UPLOADED`
    * `LINKED`
    * `ARCHIVED`
* **RPC:** `public.cms_fn_upsert_receipt_inbox_v1(...) -> uuid (SECURITY DEFINER)`
    * 필수: `p_file_bucket`, `p_file_path`
    * 기본 status: `UPLOADED`
    * upsert 키:
        * sha256가 있으면 sha256로 먼저 찾고 update
        * 아니면 (file_bucket, file_path)로 upsert
    * 반환: `receipt_id`

### 2) Shipment 원가 필드(구매원가)
* **테이블:** `public.cms_shipment_line`에 이미 존재(SoT):
    * `purchase_unit_cost_krw numeric`
    * `purchase_total_cost_krw numeric`
    * `purchase_cost_status (enum/udt)`
    * `purchase_cost_source (enum/udt)`
    * `purchase_receipt_id uuid`
    * `purchase_cost_trace jsonb`
    * `purchase_cost_finalized_at timestamptz`
    * `purchase_cost_finalized_by uuid`
* **enum:** `public.cms_e_cost_status`
    * `PROVISIONAL`
    * `ACTUAL`
* **(그리고 함수 코드상 cost_source enum 값도 실사용 중)**
    * `RECEIPT`, `MANUAL`, `MASTER`, `NONE` (타입명은 pg에서 확인되지만, 값은 코드에 이미 고정되어 있으니 SoT로 취급)

### 3) Worklist View (원가 미확정 작업대)
* **뷰:** `public.cms_v_purchase_cost_worklist_v1` (너가 push 성공했고 컬럼도 SoT 확보)
* **컬럼:**
    * header: `shipment_id`, `customer_party_id`, `customer_name`, `ship_date`, `status`, `confirmed_at`
    * line: `shipment_line_id`, `master_id`, `model_name`, `category_code`, `qty`
    * totals: `total_amount_sell_krw`, `total_amount_cost_krw`
    * purchase cost: `purchase_unit_cost_krw`, `purchase_total_cost_krw`, `purchase_cost_status`, `purchase_cost_source`, `purchase_receipt_id`, `purchase_cost_trace`, `purchase_cost_finalized_at`, `purchase_cost_finalized_by`
    * `line_updated_at`

---

## 핵심 백엔드 로직(이미 존재/연결 규칙 확정)

### A) 원가 적용 RPC(사후정정/워크리스트용)
```sql
public.cms_fn_apply_purchase_cost_to_shipment_v1(
  p_shipment_id uuid,
  p_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]',
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default gen_random_uuid(),
  p_force boolean default false
) -> jsonb
```
* **입력 규칙(함수에서 강제)**
    * `p_shipment_id` 필수
    * `p_cost_lines`는 json array여야 함 아니면 에러
    * `p_mode='RECEIPT'`면 `p_receipt_id` 필수
    * `p_cost_lines` 포맷(함수에서 읽는 키):
        * `shipment_line_id` (uuid 문자열)
        * `unit_cost_krw` (숫자 문자열)
* **적용 규칙(중요, 운영/분석 모두에 영향)**
    * `v_mode = upper(p_mode)`
    * cost 계산:
        * `RECEIPT`/`MANUAL`: 입력된 `unit_cost_krw`가 있으면 그걸 `ACTUAL`로 확정
        * `PROVISIONAL`: `cms_master_item.provisional_unit_cost_krw`를 사용(있을 때)
        * `RECEIPT`인데 입력 unit_cost가 없으면 master_prov로 부분 fallback 가능(= `PROVISIONAL`로 남김)
    * ACTUAL로 확정된 라인은 기본적으로 잠김:
        * `p_force=false`면 `purchase_cost_status <> 'ACTUAL'`인 것만 업데이트
        * `p_force=true`면 `ACTUAL`도 덮어쓰기 허용
* **부가효과(분석/추적의 핵심)**
    * `purchase_cost_trace`에 applied_at/mode/receipt_id/correlation_id/note 기록(append merge)
    * inventory move(ISSUE) 헤더/라인이 있으면 같이 cost 반영
    * `cms_receipt_usage`에 링크 기록:
        * `receipt_id` + entity_type = `SHIPMENT_HEADER`
        * (있으면) entity_type = `INVENTORY_MOVE_HEADER`
    * receipt 상태 자동 변경:
        * `cms_receipt_inbox.status` = `LINKED`로 업데이트
    * `cms_decision_log`에 요약 로그 insert
* **✅ 결론:** 이 RPC 하나로 “임시원가/수기원가/영수증원가 + 링크/로그 + 재고 move 반영”까지 다 끝남.

### B) 출고 확정 + 원가 적용 래퍼 RPC(출고 화면 버튼용)
```sql
public.cms_fn_confirm_shipment_v3_cost_v1(
  p_shipment_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_emit_inventory boolean default true,
  p_correlation_id uuid default null,
  p_cost_mode text default 'PROVISIONAL',
  p_receipt_id uuid default null,
  p_cost_lines jsonb default '[]',
  p_force boolean default false
) -> jsonb
```
* **동작**
    * 먼저 `cms_fn_confirm_shipment_v2(...)` 실행 (출고 확정 + (옵션)재고 반영)
    * `p_cost_mode <> 'SKIP'`면,
    * 곧바로 `cms_fn_apply_purchase_cost_to_shipment_v1(...)` 호출
    * 결과에 purchase_cost와 correlation_id를 붙여 반환
* **✅ 결론:** 출고 화면에서는 이 함수만 호출하면 “출고 확정 + 원가(임시/수기/영수증) + 링크/로그”까지 처리 가능.

---

## 제품/부속(ACCESSORY) 설계 결정
**결론(냉정/객관):** “부속 탭”은 Phase1에서 제거(또는 숨김)하는 게 이득이 더 큼

**이유**
1. 입력 경로가 늘수록 누락/중복 확률이 상승 → 분석 데이터 품질 하락
2. 부속은 결국 “품목 + 재고 이동 + 원가”라는 동일 축으로 분석해야 해서, 탭 분리는 분석 모델을 깨뜨리기 쉬움
3. 이미 카테고리 코드에 ACCESSORY(부속)이 포함되어 있으니 마스터 기반 통합이 가장 단순하고 안정적

**구현 원칙**
* 부속도 `cms_master_item`에 등록
* 카테고리는 네 로직대로:
    * 모델명 `bk-1234-b` 처럼 마지막 세그먼트 letter를 기반
    * U => ACCESSORY
    * 발찌 => ANKLET 예외

**모델명 → 카테고리 코드 규칙(SoT=네 프론트 로직)**
* **기준 포맷**
    * 모델명: `bk-1234-b` (마지막 - 세그먼트가 카테고리 letter)
* **letter → category_code 매핑:**
    * R: RING
    * B: BRACELET
    * E: EARRING
    * N: NECKLACE
    * M: PENDANT
    * U: ACCESSORY (부속)
    * W: WATCH
    * K: KEYRING
    * S: SYMBOL
    * Z/기타: ETC
    * “발찌” 문자열이면 ANKLET
* **백엔드 일치(권장)**
    * 프론트에서 파싱하더라도, 저장 시점에는 DB에서도 동일 규칙을 적용(데이터 정합성)
    * 이미 `cms_fn_category_code_from_model_name` 계열 함수가 존재하니(0054), 저장 RPC에서 category_code를 서버측에서도 재검증하도록 명시

---

## UX / 화면 PRD

### 1) Receipt Inbox 페이지 (신규/또는 재고 탭 내 서브)
* **목적:** 영수증을 “원가 입력 전에” 먼저 저장해 근거를 남긴다.
* **리스트 기능**
    * 필터: status(UPLOADED/LINKED/ARCHIVED), vendor_party_id, issued_at 범위
    * 컬럼/카드:
        * 썸네일(이미지)
        * vendor
        * issued_at
        * total_amount_krw
        * status
        * memo
    * 액션:
        * 상태 변경: ARCHIVE
        * (Phase1) 상세 보기(이미지 크게)
        * (Phase2) OCR 결과 보기
* **업로드(스캐너 연동)**
    * 고속 스캐너 → 웹훅 → `/api/receipt-upload`
    * 성공 시 인박스에 즉시 UPLOADED로 표시

### 2) Shipments(출고 확정) 화면 — 버튼/원가 UX 고정
너가 말한 “입고/출고 버튼을 양 옆” 아이디어를 운영 안정성/분석 관점으로 재해석해서 이렇게 고정하는 걸 추천:

* **버튼 구성(권장)**
    * 왼쪽: 근거(영수증) 등록/선택
    * 오른쪽: 출고 확정
    * 왜냐면 “입고”라는 단어는 재고 개념(수량 입고)과 충돌해서, 실제론 네가 원하는 게 “영수증/원가 근거”쪽이기 때문.

* **출고 확정 모달/패널에 필수 섹션: “원가 모드”**
    * **p_cost_mode 선택(라디오/드롭다운):**
        * `PROVISIONAL`(기본): 마스터 임시원가 사용
        * `MANUAL`: 라인별 unit_cost_krw 직접 입력 → ACTUAL
        * `RECEIPT`: 영수증 선택 + 라인별 unit_cost_krw 입력 → ACTUAL(입력 누락 라인은 master_prov로 PROVISIONAL fallback 가능)
        * `SKIP`: 원가 적용 없이 출고 확정만 (단, 분석 품질 위해 관리자만 허용 추천)
    * **영수증 선택(p_receipt_id):**
        * RECEIPT일 때 필수(함수에서 강제)
        * 목록은 `cms_receipt_inbox.status=UPLOADED` 우선 + 검색
    * **cost_lines 입력 UI:**
        * 테이블: shipment_line_id, model_name, qty, unit_cost_krw
        * unit_cost_krw는 숫자 입력
    * **강제 덮어쓰기 토글(p_force):**
        * 기본 false
        * 권한자만 보이게(실수 방지)

* **호출 계약(프론트 → RPC)**
    * 출고 확정 버튼 클릭 시:
      ```sql
      cms_fn_confirm_shipment_v3_cost_v1(
        p_shipment_id,
        p_actor_person_id,
        p_note,
        p_emit_inventory=true,
        p_correlation_id=null,
        p_cost_mode,
        p_receipt_id,
        p_cost_lines,    -- jsonb array
        p_force=false
      )
      ```
    * `cost_lines` JSON 예시(그대로 이 구조)
      ```json
      [
        { "shipment_line_id": "UUID1", "unit_cost_krw": 12000 },
        { "shipment_line_id": "UUID2", "unit_cost_krw": 8000 }
      ]
      ```

* **성공/실패 UX**
    * 성공: RPC 반환 jsonb에서 `purchase_cost.updated_actual_cnt`, `updated_provisional_cnt`를 토스트/요약으로 보여줌
    * 실패(함수에서 실제로 던지는 메시지):
        * shipment_id required
        * cost_lines must be json array
        * receipt_id required when mode=RECEIPT
        * → 이 3개는 프론트에서 사전 검증으로 막아야 함(사용성)

### 3) Purchase Cost Worklist 페이지 (핵심: 빈값 메우기)
* **데이터 소스(READ)**
    * `select * from public.cms_v_purchase_cost_worklist_v1`
    * 필터:
        * 고객(customer_party_id)
        * 날짜(ship_date, confirmed_at)
        * 상태(status)
        * 카테고리(category_code)
        * 원가 상태(purchase_cost_status)
        * 원가 근거(purchase_cost_source)
* **행 단위 액션(WRITE)**
    * “임시원가로 채우기”:
        * `mode=PROVISIONAL`
        * cost_lines 비워도 됨(함수 내부에서 master_prov로 처리)
    * “수기 입력으로 확정”:
        * `mode=MANUAL`
        * cost_lines에 해당 라인의 unit_cost_krw 포함
    * “영수증 연결 + 확정”:
        * `mode=RECEIPT`
        * receipt_id 필수 + cost_lines 입력
* **호출 계약(워크리스트에서 WRITE)**
    ```sql
    cms_fn_apply_purchase_cost_to_shipment_v1(
      p_shipment_id,
      p_mode,
      p_receipt_id,
      p_cost_lines,
      p_actor_person_id,
      p_note,
      p_correlation_id,
      p_force
    )
    ```

---

## 백엔드(API) 구현 요구사항 (너가 “백엔드에서 뭐 만들어야 해?”에 대한 확정 답)

### 1) /api/receipt-upload (필수)
* **목적:** 스캐너/웹훅 업로드를 표준화하여 Receipt Inbox에 적재
* **처리 흐름**
    1. multipart file0 수신
    2. Storage 업로드:
        * bucket: `ocr_docs`
        * path: 예) `receipt_inbox/YYYY/MM/DD/<uuid>.jpg`
        * (가능하면) sha256/size/mime 계산
    3. RPC 호출:
       ```sql
       cms_fn_upsert_receipt_inbox_v1(
         p_file_bucket='ocr_docs',
         p_file_path=...,
         p_file_sha256=...,
         p_file_size_bytes=...,
         p_mime_type=...,
         p_source='SCANNER',
         p_vendor_party_id=null or provided,
         p_issued_at=null or provided,
         p_total_amount_krw=null or provided,
         p_status='UPLOADED',
         p_memo=null,
         p_meta={...}
       )
       ```
    4. 응답: `{ ok: true, receipt_id, file_bucket, file_path }`
* **운영 포인트**
    * 중복 업로드 방지:
        * sha256가 있으면 함수가 sha256로 update 처리해줌(이미 설계됨)
    * 나중에 OCR/ML 붙이기 쉬움:
        * meta에 scanner_model, batch_id, operator 같은 값을 누적 가능

### 2) (선택) /api/receipts 조회 라우트
* 프론트에서 인박스/검색을 편하게 하려면 API로 감싸도 되고,
* 아니면 Supabase client에서 직접 select해도 됨(읽기만이면 OK)

---

## 운영 정책(데이터 품질을 지키는 “현실적인” 룰)

### 1) 임시원가 출고 허용(너가 확정한 방향)
* 기본 모드 = `PROVISIONAL`
* 의미:
    * master의 `provisional_unit_cost_krw`가 있으면 purchase_cost가 채워짐
    * 없으면 unit_cost null로 남을 수 있음 → worklist로 떠야 함

### 2) ACTUAL 잠금(실수 방지)
* `ACTUAL`로 확정된 라인은 기본적으로 덮어쓰기 금지
* 수정하려면 관리자만 `p_force=true` 사용

### 3) 영수증 상태 전이 자동화
* 업로드: `UPLOADED`
* apply에서 receipt_id가 들어가면 자동 `LINKED` (함수에 구현됨)
* `ARCHIVED`는 UI에서 수동 처리(중복/폐기/완료 숨김)

---

## KPI / 분석(너 1순위)
* **최소 대시보드 지표:**
    * UPLOADED receipts count (미처리 근거)
    * LINKED receipts ratio (근거 연결률)
    * worklist rows count (원가 미확정 출고라인)
    * PROVISIONAL vs ACTUAL 비율(원가 확정률)
* **리드타임:**
    * confirmed_at → purchase_cost_finalized_at (ACTUAL 확정까지 걸린 시간)

---

## QA / 테스트 시나리오(필수)
1. **receipt-upload**로 파일 업로드 → `cms_receipt_inbox`에 UPLOADED 생성되는지
2. **출고 확정:**
    * `cost_mode=PROVISIONAL` → master_prov 있으면 PROVISIONAL 원가 채워지는지
    * `cost_mode=MANUAL` + cost_lines → ACTUAL로 확정되는지
    * `cost_mode=RECEIPT` + receipt_id + cost_lines → receipt가 LINKED로 바뀌는지 + usage 생성되는지
3. **worklist:**
    * 원가 null/receipt null이면 떠야 함
    * apply 후 사라져야 함
4. **ACTUAL 잠금:**
    * `p_force=false`로 ACTUAL 덮어쓰기 안 되는지
    * `p_force=true`면 덮어써지는지(관리자만)

---

## ✅ PRD에 반영되는 확정 운영 정책(Option A)

### 1) 기본값
* 출고 확정(Shipments Confirm)에서 기본 `p_cost_mode = 'PROVISIONAL'`
* 사용자가 아무 것도 안 건드리고 출고 확정을 눌러도:
    * `cms_master_item.provisional_unit_cost_krw`가 있으면
        * → `purchase_unit_cost_krw` / `purchase_total_cost_krw` 자동 채움
        * → `purchase_cost_status='PROVISIONAL'`, `purchase_cost_source='MASTER'`
    * 없으면
        * → purchase cost가 null로 남을 수 있음
        * → worklist에 자동으로 남아 후속 처리 대상이 됨

### 2) “SKIP”는 기본 금지(관리자 전용)
* SKIP는 운영상 데이터 품질을 깨기 쉬워서:
    * 기본 UI에 숨김
    * 관리자 전용 토글(혹은 환경변수)로만 노출

### 3) 데이터 품질 보장 장치(운영 안정성)
* 출고를 막지 않는다(운영).
* 대신 빈 원가/미연결 영수증은 무조건 Worklist에 노출(데이터 품질).
* ACTUAL 확정된 건 기본 잠금(실수 방지), 수정은 `p_force=true` 관리자만.
