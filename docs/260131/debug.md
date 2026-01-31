# 출고(Shipment) + 영수증(Receipt) 연동/확정 디버깅 정리 (MD)

## 0) 목표(사용자 요구사항)
영수증 업로드 → OCR → 라인 자동 매칭 → 입고 자동화 + 영수증 메타데이터로 묶기 → 예상 출고가 자동화 → 사람이 최종 확인 후 출고확정

이를 위해:
* 여러 출고내역(Shipment) 과
* 출고내역과 연결된 영수증 데이터(Receipt) 가
* 화면/DB 모두에서 정합성 있게 연결되어야 함

## 1) 현재 관측된 핵심 문제 요약
* **DB 함수/테이블 스키마 불일치로 인한 RPC 400 연쇄**
    * `cms_fn_confirm_shipment_v3_cost_v1` 호출 시 내부에서 참조하는 컬럼/enum/테이블이 실제 DB에 없어서 400이 반복 발생
    * 에러 코드: `42703`, `42P01`, `22P02`
* **프론트에서 NULL 필터가 잘못 전송됨**
    * `cms_shipment_line?shipment_id=eq.null` 같은 요청이 발생 → PostgREST가 400 반환
* **영수증 프리뷰 렌더링 실패**
    * 프리뷰 API 응답이 이미지/PDF 바이너리로 안정적으로 내려오지 않거나,
    * 프론트가 `receipt_id` 기반 프리뷰 호출인데 서버는 `bucket/path`만 처리하는 구조로 어긋남

## 2) 오류 로그 타임라인(발생한 에러들 전체 목록)

### A. 출고 확정 RPC 호출 실패(공통)
공통 요청:
`POST /rest/v1/rpc/cms_fn_confirm_shipment_v3_cost_v1 → 400 Bad Request`

### B. 스키마/컬럼 미존재(42703)
```text
column t.symbol does not exist
record "r_master" has no field "material"
record "r_order" has no field "category_code"
column "gold_tick_id" of relation "cms_shipment_header" does not exist
record "r_master" has no field "labor_basic_sell_krw"
(현재 최신) column "part_id" of relation "cms_inventory_move_line" does not exist
```
* **의미:** DB 함수가 “없는 컬럼”을 읽거나 쓰는 중. 권한을 풀어도 해결되지 않음.

### C. 테이블 미존재(42P01 / 404)
```text
relation "public.cms_market_config" does not exist
```
* 출고확정 버튼 시 404 (Not Found) + RPC 에러로 표출
* **의미:** 함수가 참조하는 테이블/뷰가 DB에 없음(마이그레이션 미적용 or 이름 변경).

### D. Enum 불일치(22P02)
```text
invalid input value for enum cms_e_pricing_mode: "MANUAL"
```
* **의미:** DB enum(`cms_e_pricing_mode`) 라벨 목록에 `"MANUAL"`이 없음.
* 함수 내부에서 `'MANUAL'::cms_e_pricing_mode` 캐스팅 또는 비교가 존재하면 즉시 터짐.

### E. 프론트 요청이 잘못된 NULL 필터(400)
```text
GET /rest/v1/cms_shipment_line?...&shipment_id=eq.null... 400 (Bad Request)
```
* **의미:** `shipment_id`가 null일 때 `eq.null`로 보내면 PostgREST가 실패.
* (null 비교는 `is.null`이거나, 애초에 쿼리를 호출하지 않도록 방어해야 함)

## 3) 지금까지 “적용/시도한 수정” 정리(대화/로그 기반)

### 3.1 프론트(출고 페이지) 구조 개선
* **출고 페이지 레이아웃 목표:**
    * 검색창 클릭 시 출고대기 목록 노출
    * 주문 선택 → 중량/공임 입력 → 출고 저장
    * 모달에서 원가모드 선택(PROVISIONAL/MANUAL/RECEIPT)
    * RECEIPT 모드에서 영수증 업로드/선택 + 우측 프리뷰
    * 라인별 단가 입력은 “현재 출고 라인만” 기본 표시
* ✅ **UI/UX 방향은 만족** (사용자 피드백: 레이아웃은 마음에 듦)
* ❌ 다만 출고확정 RPC/미리보기/데이터 정합성 문제로 실제 완료가 안 됨

### 3.2 영수증 프리뷰 개선 시도
* **문제:** 영수증 선택 시 “사진 아이콘만 뜨고 실제 이미지가 안 나옴”
* **원인 후보(관측):**
    * 프론트는 `/api/receipt-preview?receipt_id=...` 방식인데,
    * 서버는 `bucket/path`만 지원하거나,
    * 바이너리 응답이 JSON/텍스트로 내려오며 `<img>`/`<iframe>`이 깨짐
* ✅ **수정 방향:** `receipt_id` → `cms_receipt_inbox`에서 `bucket/path` 조회 → storage download → 바이너리(`Uint8Array`)로 응답
* ❌ 실제로 적용되었는지/DB storage 정책과 함께 정상인지 최종 확인 필요

### 3.3 DB 마이그레이션 적용 이슈(중요)
* **사용자가 제보:**
    * “새로 안 만들고 기존 파일 수정하면 db push 제대로 안 되는 것 같음”
* **원인:**
    * Supabase는 마이그레이션 적용 이력을 관리 → 이미 적용된 migration 파일을 수정해도 재실행되지 않음
* **결론:**
    * 수정은 무조건 ‘새 migration 파일’을 추가해야 재적용됨
    * 또는 `supabase_migrations.schema_migrations` 리셋/재동기화가 필요하지만 운영 위험 큼

### 3.4 DB 함수/스키마 불일치 패치 시도
* **확인된 사실(사용자가 출력한 `pg_get_functiondef`):**
    * `public.cms_fn_confirm_shipment` 내부에서
    * `cms_fn_latest_tick_by_role_v1('SILVER_KR')` 같은 `role_code` 사용
    * `tick` 함수에서 `t.meta`를 읽으려 함
    * 이후에도 계속 새로운 “없는 컬럼” 참조 에러가 발생
* ✅ **정리:** 지금 DB는 레포(SQL) 기준과 다른 버전의 함수가 섞여 있고, 그 결과가 `42703`/`22P02` 연쇄로 터지는 상태

## 4) 현재 최신 오류(사용자 제공) — 반드시 해결해야 하는 것

### 4.1 출고 라인 조회가 shipment_id=null로 호출됨(프론트)
```http
GET /rest/v1/cms_shipment_line?...&shipment_id=eq.null... 400
```
* **해결 필요:**
    * `shipment_id`가 null/“null” 문자열이면 쿼리 실행 자체를 막거나
    * null 비교는 PostgREST 규칙대로 `is.null` 처리 필요

### 4.2 출고확정 RPC가 inventory move line part_id 때문에 실패(DB)
```json
{ "code": "42703", "message": "column \"part_id\" of relation \"cms_inventory_move_line\" does not exist" }
```
* **레포 기준 증거(스키마)**
    * 레포 ZIP의 `20260128200100_cms_0208_inventory_tables.sql`에는:
    * `public.cms_inventory_move_line` 테이블에 `part_id uuid` 컬럼이 정의되어 있음
* **의미**
    * 현재 연결된 실제 DB는:
    * `cms_inventory_move_line` 테이블은 존재하지만,
    * `part_id` 컬럼이 없는 상태(=inventory migrations 일부 미적용/구버전)
    * `cms_fn_confirm_shipment_v3_cost_v1`(또는 그 내부 호출)이 inventory move line에 `part_id`를 insert/update 하며 충돌

## 5) 남아있는 구조적 리스크(재발 방지 관점)
confirm/emit/inventory 관련 함수가 레포 스키마를 전제하고 있는데 실제 DB는 스키마/함수/enum이 뒤섞여 있음

→ “하나 고치면 다음 42703이 또 터지는” 상태가 계속 발생

✅ **따라서 “증상별 땜빵”보다,**
(1) DB 스키마가 레포 기준(`public.cms_*`)과 동일한지 먼저 정합성 복구
(2) confirm 함수 체인이 그 스키마와 정확히 맞는지 복구
가 우선순위가 되어야 함

## 6) 다음 액션 플랜(권장 순서)

**Step 1) DB 정합성 점검(최소 체크)**
* `cms_inventory_move_line`에 `part_id` 존재 여부 확인
* `cms_e_pricing_mode` enum 라벨 확인(RULE/UNIT/AMOUNT_ONLY 등)
* confirm 함수 체인이 참조하는 컬럼들이 실제 테이블에 존재하는지 확인
* `cms_market_config` vs `cms_market_tick_config` 등 실제 존재 테이블 기준으로 함수 참조 정리

**Step 2) 마이그레이션 적용 전략 확정**
* 이미 적용된 migration 수정 금지
* 모든 수정은:
    * `supabase/migrations/YYYMMDDHHMMSS_...sql` 형태의 새 파일 추가로만 진행

**Step 3) 프론트 null 필터 방어**
* `shipment_id`가 null일 때 `readView` 호출하지 않도록 방어
* `String(null)`로 "null"이 될 가능성까지 포함해서 방어 필요

## 7) 부록: 현재 사용자가 제공한 최신 로그(원문)

```http
GET [https://ptxmypzrqonokuikpqzr.supabase.co/rest/v1/cms_shipment_line?select=*&limit=50&shipment_id=eq.null&order=created_at.desc](https://ptxmypzrqonokuikpqzr.supabase.co/rest/v1/cms_shipment_line?select=*&limit=50&shipment_id=eq.null&order=created_at.desc) 400 (Bad Request)

POST [https://ptxmypzrqonokuikpqzr.supabase.co/rest/v1/rpc/cms_fn_confirm_shipment_v3_cost_v1](https://ptxmypzrqonokuikpqzr.supabase.co/rest/v1/rpc/cms_fn_confirm_shipment_v3_cost_v1) 400 (Bad Request)
```

```json
{code: '42703', message: 'column "part_id" of relation "cms_inventory_move_line" does not exist'}
```