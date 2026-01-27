# 거래처(Party) 페이지 PRD — CMS Phase1 (SoT=public.cms_*)

> 범위: **거래처(고객/공장) 관리 1페이지(리스트+상세)** > 전제: 현재 스키마는 `public.cms_*`가 SoT이며, **WRITE는 RPC만** 허용한다.

---

## 0) 목적 / 성공조건

### 0.1 목적
- 주문/출고/미수/수리에서 공통으로 쓰는 **거래처(고객/공장) 마스터**를 안정적으로 관리한다.
- 출고 시 `ship_to_address_id`로 연결 가능한 **주소(다중)**를 관리한다.
- 공장 자동추정(모델 prefix 기반 guess)용 **vendor prefix map**을 관리한다.
- 운영 흔들림(직접 테이블 수정, default 중복, vendor/customer 혼용)을 UI/백엔드 규약으로 차단한다.

### 0.2 성공조건(완료 정의)
- 고객/공장 신규등록/수정/비활성화가 UI에서 가능
- 고객 상세에서 **미수(AR) 포지션**을 즉시 확인 가능 (`cms_v_ar_position_by_party`)
- 출고 생성/편집 시 쓸 수 있게 **주소목록/기본주소**가 유지되며 default 단일성 보장
- 공장(prefix map) 등록/수정/삭제 가능 + prefix 정규화/중복 방지
- 모든 변경이 원칙적으로 `cms_decision_log`(선택이지만 강추) 또는 최소한 `updated_at`로 추적 가능

---

## 1) 헌법(절대 규칙) — 코딩 에이전트 통제용

### 1.1 SoT / 스키마
- **SoT는 `public.cms_*`만**이다.
- 같은 이름의 `ms_s.*`, `public.master_item` 등 **다른 스키마/테이블을 읽거나 섞지 않는다.**
- 이 페이지는 **거래처(Party) 도메인만** 다룬다.

### 1.2 Write 경로
- **INSERT/UPDATE/DELETE는 반드시 RPC(Function)로만 수행**
- UI에서 base table 직접 write(쿼리 빌더로 update/insert) 금지
- 즉, 주소/담당자/prefix map까지 UI에서 수정 가능하게 하려면 **반드시 RPC가 있어야 한다.**
  - RPC 없으면 기능을 “비활성(백엔드 필요)”로 막는다(우회 금지).

### 1.3 Read 경로
- SELECT는 허용하되, RLS 정책을 존중한다.
- 가능한 경우 View를 우선 사용(현재 party 전용 view는 제한적: AR position view 정도).

### 1.4 멱등/검증/오류
- 서버가 검증해야 하는 규칙(예: vendor prefix map은 vendor만)은 **UI에서만 막지 말고 RPC에서 강제**한다.
- default 단일성(주소/담당자)은 **UI+RPC에서 중복이 생기지 않도록** 설계한다.

---

## 2) 범위(Scope) / 비범위(Non-goals)

### 2.1 범위
- 거래처(고객/공장) CRUD(실삭제가 아닌 비활성화 중심)
- 거래처 주소 CRUD + default 1개 유지
- 거래처 담당자 CRUD(권장) + primary 1명 유지
- 공장 prefix map CRUD + prefix 중복 방지
- 고객의 AR 요약(잔액/미수/크레딧/최근활동) 조회

### 2.2 비범위(Phase1에서 안 함)
- 고급 중복 병합(동일 상호 병합), 히스토리 마이그레이션
- 권한 관리자 UI(roles/grants/RLS 자체를 편집하는 화면)
- 거래처별 가격정책/계약정책(Phase2)

---

## 3) 데이터 모델(SoT=public.cms_*)

## 3.1 Base Tables

### A) `public.cms_party` (거래처 헤더)
- `party_id uuid PK` (default: `gen_random_uuid()`)
- `party_type cms_e_party_type` : `customer | vendor`
- `name text` (필수)
- `phone text` (옵션)
- `region text` (옵션)
- `address text` *(요약 주소/레거시)* - `note text` (옵션)
- `is_active boolean` (default: true)
- `created_at, updated_at`

**정책(Phase1 고정)**
- `cms_party.address`는 “요약 주소(퀵뷰)”로만 취급.
- 출고 목적지(실제 선택/SoT)는 `cms_party_address`이며, 출고 헤더는 `ship_to_address_id`를 사용.

---

### B) `public.cms_party_address` (거래처 주소)
- `address_id uuid PK`
- `party_id uuid FK -> cms_party.party_id`
- `label text` (예: 매장, 사무실, 자택, 공장)
- `address_text text` (필수)
- `is_default boolean` (default: false)
- `created_at, updated_at`

**정책(Phase1 고정)**
- 거래처당 default(`is_default=true`)는 최대 1개
- 출고 화면에서 주소 선택은 항상 이 테이블을 사용

---

### C) `public.cms_person` (담당자)
- `person_id uuid PK`
- `name text`
- `phone text`
- `note text`
- `created_at, updated_at`

---

### D) `public.cms_party_person_link` (거래처-담당자 링크)
- `party_id uuid`
- `person_id uuid`
- `role text` (예: 대표, 매니저, 회계)
- `is_primary boolean` (default: false)
- `created_at`

**정책(Phase1 고정)**
- 거래처당 primary(`is_primary=true`) 담당자는 최대 1명

---

### E) `public.cms_vendor_prefix_map` (공장 prefix 매핑)
- `prefix text` (PK로 운용 권장)
- `vendor_party_id uuid FK -> cms_party.party_id`
- `note text`
- `created_at`

**정책(Phase1 고정)**
- `vendor_party_id`는 반드시 `cms_party.party_type='vendor'`
- `prefix`는 정규화(예: trim + upper) 후 중복 금지

---

## 3.2 Related Views (READ)

### `public.cms_v_ar_position_by_party`
- 필드: `party_id, party_type, name, balance_krw, receivable_krw, credit_krw, last_activity_at`
- 이 페이지에서는 **고객 탭에서 AR 요약 표시용**으로 사용

---

## 3.3 Enums (해당 페이지 관련)
- `cms_e_party_type`: `customer`, `vendor`

---

## 4) RPC(WRITE) — 현재 존재/필요

## 4.1 현재 존재(확정)
### `public.cms_fn_upsert_party_v1(...) returns jsonb`
- 시그니처:
  - `p_party_type cms_e_party_type`
  - `p_name text`
  - `p_phone text`
  - `p_region text`
  - `p_address text`
  - `p_memo text`
  - `p_party_id uuid`
- 사용 규칙:
  - 신규: `p_party_id=null`
  - 수정: `p_party_id=기존 party_id`
- UI 정책:
  - `party_type`은 신규 생성 시만 선택(수정은 readonly 권장)

> **반환 JSON 계약(요구사항)** > 백엔드가 아직 계약을 명확히 안 했으면, Phase1 안정성을 위해 아래 형태를 맞춰야 한다.
```json
{
  "ok": true,
  "party_id": "uuid",
  "action": "insert|update"
}
```
실패 시:
```json
{
  "ok": false,
  "error_code": "VALIDATION_ERROR|CONFLICT|FORBIDDEN|NOT_FOUND",
  "message": "..."
}
```

## 4.2 필수 추가(RPC v2: 없으면 UI 구현 불가)
아래 항목은 “내용 삭제 없이” 추가 요구사항이며, 코딩 에이전트가 프론트만으로 우회 구현하면 안 된다.

### 4.2.1 주소 관리 RPC(필수)
**주소 업서트**
`cms_fn_upsert_party_address_v1( p_party_id uuid, p_label text, p_address_text text, p_is_default boolean, p_address_id uuid default null ) returns jsonb`

*서버 규칙(필수):*
- `p_address_text` 빈값 금지
- `p_is_default=true`면 해당 party의 기존 default 주소를 모두 false로 내려 단일 default 보장
- party 존재하지 않으면 NOT_FOUND

**주소 삭제**
`cms_fn_delete_party_address_v1(p_address_id uuid, p_note text) returns jsonb`

*서버 규칙(필수):*
- 주소가 속한 party를 잠그고(for update) 안전하게 삭제
- 삭제 대상이 default였고 다른 주소가 남아있으면:
  - Phase1 권장: 남은 주소 중 1개를 자동 default로 승격 (정책 고정: default 없음 상태를 만들지 않는다)

**반환 JSON 계약(권장)**
`{ "ok": true, "address_id": "uuid", "action": "insert|update|delete", "party_id": "uuid" }`

### 4.2.2 담당자 관리 RPC(권장)
**담당자 업서트**
`cms_fn_upsert_person_v1(p_name text, p_phone text, p_note text, p_person_id uuid default null) returns jsonb`

**링크 업서트**
`cms_fn_upsert_party_person_link_v1(p_party_id uuid, p_person_id uuid, p_role text, p_is_primary boolean) returns jsonb`

*서버 규칙:*
- `p_is_primary=true`면 같은 party의 다른 primary 링크는 false로 내려 단일 primary 보장
- party/person 없으면 NOT_FOUND

**링크 삭제**
`cms_fn_delete_party_person_link_v1(p_party_id uuid, p_person_id uuid, p_note text) returns jsonb`

### 4.2.3 공장 prefix map RPC(필수)
**prefix 업서트**
`cms_fn_upsert_vendor_prefix_map_v1(p_prefix text, p_vendor_party_id uuid, p_note text) returns jsonb`

*서버 규칙(필수):*
- `p_prefix` 정규화(예: trim, upper) 후 저장
- 중복 prefix는 CONFLICT
- `vendor_party_id`가 vendor가 아니면 VALIDATION_ERROR

**prefix 삭제**
`cms_fn_delete_vendor_prefix_map_v1(p_prefix text, p_note text) returns jsonb`

## 4.3 변경 로그(선택이지만 강추)
위 v2 RPC들은 가능하면 `cms_decision_log`에 기록한다.
- `entity_type`: `party|party_address|person|party_person_link|vendor_prefix_map`
- `entity_id`: 해당 PK(또는 복합키는 대표키 규칙 정의)
- `decision_kind`: `UPSERT|DELETE|SET_DEFAULT|SET_PRIMARY` 등

---

## 5) 페이지 정보(라우팅/레이아웃)
### 5.1 라우팅(권장)
- `/party?type=customer`
- `/party?type=vendor`
- `type` 기본값은 `customer`

### 5.2 레이아웃(필수)
- 좌: 리스트(검색/필터 포함)
- 우: 상세(탭 구조)
- 모바일은 Phase1에서 최소 지원(스크롤 기반 스택) — 선택

---

## 6) UI 구성(컴포넌트 단위)

### 6.1 상단(전역 컨트롤)
- **Segmented control:** 고객(customer) / 공장(vendor)
- **검색 input:** name contains (디바운스 300~500ms)
- **필터:**
  - 활성만 보기(is_active=true 토글)
  - 지역(region) (옵션)
- **버튼:** `+ 거래처 추가`

### 6.2 리스트 패널(좌)
**표시 컬럼(고정)**
- 이름(name)
- 전화(phone)
- 지역(region)
- 활성(is_active)
- (customer 탭에서만) balance_krw (AR 잔액)
- 최근활동 last_activity_at (있으면)

**정렬 기본값**
- customer: `balance_krw desc nulls last`, `name asc`
- vendor: `name asc`

**페이징(권장)**
- Phase1 최소: 50개 단위 페이지네이션 또는 무한스크롤
- 검색/필터 변경 시 페이지 1로 리셋

**리스트 상태**
- empty state: “등록된 거래처가 없습니다. ‘거래처 추가’를 눌러 등록하세요.”
- loading skeleton
- error: “목록을 불러오지 못했습니다. 다시 시도”

### 6.3 상세 패널(우)
**탭 4개:**
1. 기본정보
2. 주소
3. 담당자
4. (vendor만) Prefix Map

**선택 행 없을 때:**
“좌측에서 거래처를 선택하세요.”

---

## 7) 기능 상세(READ/WRITE 규약 포함)

### 7.1 기본정보 탭
**필드**
- party_type (신규만 선택 / 수정은 readonly)
- name (필수)
- phone
- region
- address(요약)
- note
- is_active (토글)

**저장(WRITE)**
- `cms_fn_upsert_party_v1(...)`

**UI 검증(필수)**
- name 비어있으면 저장 불가
- customer/vender 전환 금지(수정에서는)

**고객일 때 추가 표시(READ)**
- `cms_v_ar_position_by_party`에서:
  - `balance_krw`, `receivable_krw`, `credit_krw`, `last_activity_at`
- **표시 규칙:**
  - 잔액(balance_krw) = “현재 포지션(미수-크레딧 합산)”으로 이해
  - receivable_krw/credit_krw를 분리 표시(가능하면)

### 7.2 주소 탭(Phase1 필수)
**리스트**
- label, address_text, default 배지
- [수정] [삭제]

**추가/수정 모달**
- label(옵션), address_text(필수), is_default(체크)

**저장(WRITE)**
- `cms_fn_upsert_party_address_v1(...)`

**삭제(WRITE)**
- `cms_fn_delete_party_address_v1(...)`

**UX/정책(필수)**
- default는 “체크 후 저장”으로만 변경
- 삭제 시 confirm: “이 주소를 삭제할까요? 출고지로 사용 중이면 영향이 있을 수 있습니다.”

### 7.3 담당자 탭(권장)
**리스트(링크 기준)**
- person.name / person.phone / role / primary 배지
- [수정] [삭제]

**추가 흐름(둘 다 제공)**
- A) 기존 담당자 검색 → 링크 생성
- B) 신규 담당자 생성 → 링크 생성

**WRITE**
- `cms_fn_upsert_person_v1`
- `cms_fn_upsert_party_person_link_v1`
- `cms_fn_delete_party_person_link_v1`

**UX/정책**
- primary 변경은 체크 후 저장(서버가 단일 primary 보장)

### 7.4 Prefix Map 탭(vendor 전용, Phase1 필수)
**리스트**
- prefix, note
- [삭제]

**추가 폼**
- prefix(필수), note(옵션)

**WRITE**
- `cms_fn_upsert_vendor_prefix_map_v1`
- `cms_fn_delete_vendor_prefix_map_v1`

**검증/정규화(필수)**
- prefix trim 후 빈값이면 저장 불가
- 서버 정규화 기준을 UI에도 반영(대문자 표기 등)
- 중복 prefix는 서버 에러 → UI 메시지: “이미 등록된 prefix입니다.”

---

## 8) 데이터 조회(READ) 설계 — 구체 사양

### 8.1 리스트 쿼리(권장 로직)
- 기본: `cms_party`에서 type/active/search로 필터
- 고객 탭: `cms_v_ar_position_by_party`를 party_id로 left join해서 balance 표시
- 검색은 `name ILIKE %q%` (또는 trigram 인덱스 고려)

### 8.2 상세 로딩(필수)
- `cms_party`(단건)
- `cms_party_address`(party_id로 리스트)
- `cms_party_person_link` + `cms_person`(party_id)
- `cms_vendor_prefix_map`(vendor일 때)

### 8.3 캐싱/동기화(권장)
- 업서트 성공 시:
  - 상세 패널은 서버 반환값으로 즉시 갱신
  - 리스트는 해당 row만 패치/업데이트(전체 리프레시 최소화)
- 탭 이동 시 불필요한 재요청 방지(메모이제이션)

---

## 9) 권한/RLS 전제(페이지가 지켜야 할 것)
- authenticated/staff 기준으로 동작(세부 role명은 프로젝트 규약을 따른다)
- WRITE는 RPC만 호출
- 주소/담당자/prefix map은 v2 RPC가 없으면 구현하지 않는다
- “백엔드 준비 필요” 배너/disable로 명확히 처리

---

## 10) 에러 처리(상세 사양)

### 10.1 공통
- RPC 에러: 토스트 + 폼 유지 + 사용자가 수정 가능하게 필드 표시 유지
- 네트워크 오류: “네트워크 문제로 실패했습니다. 다시 시도”
- 서버 검증 오류: message 노출(과도한 내부정보는 숨김)

### 10.2 대표 에러 매핑(필수)
- prefix 중복(CONFLICT): “이미 등록된 prefix입니다.”
- vendor 타입 아님(VALIDATION): “공장 거래처만 prefix를 등록할 수 있습니다.”
- address_text 빈값(VALIDATION): “주소를 입력하세요.”
- party_id 없음(NOT_FOUND): “거래처가 존재하지 않습니다. 새로고침 후 다시 시도하세요.”

---

## 11) 성능/운영 고려
- 리스트는 기본 50행 페이징 권장(거래처 많아질 것 대비)
- 검색은 디바운스 적용
- 조인/필터가 느려지면:
  - `cms_party(name)` 인덱스
  - `cms_party(party_type,is_active)`
  - `cms_party_address(party_id,is_default)`
  - `cms_vendor_prefix_map(prefix)` 유니크
- AR view는 내부 집계 비용 확인(필요 시 materialize 고려는 Phase2)

---

## 12) 접근성/UX 디테일(작지만 고정)
- default/primary는 색상만으로 구분하지 말고 라벨 텍스트 포함
- **키보드:** 리스트 위/아래 이동, Enter로 선택(가능하면)
- **폼:**
  - 저장 버튼 disabled 기준 명확히(필수값 누락)
  - 저장 성공 토스트 “저장되었습니다”
  - 삭제 성공 토스트 “삭제되었습니다”

---

## 13) 완료 체크리스트(고정 테스트 12개)
1. [ ] customer 신규 생성 → 리스트 즉시 반영
2. [ ] customer 수정(name/phone/region/address/note) → 반영
3. [ ] customer 비활성화 → 활성 필터에서 숨김
4. [ ] vendor 신규 생성 → vendor 탭에서만 노출
5. [ ] 주소 2개 등록 + default 변경 → default 단일 보장
6. [ ] default 주소 삭제 → 남은 주소 자동 default 승격(Phase1 정책)
7. [ ] 주소 address_text 빈값 저장 시 실패 + 메시지
8. [ ] vendor prefix 2개 등록 → 리스트 반영
9. [ ] prefix 중복 등록 → 실패 + 메시지
10. [ ] vendor 아닌 party에 prefix 등록 시도 → 실패 + 메시지
11. [ ] customer 상세에서 AR 포지션 수치가 cms_v_ar_position_by_party와 일치
12. [ ] RPC 없는 상태(v2 미구현)에서는 주소/담당자/prefix write UI가 disable되어 우회 불가

---

## 14) 시드/데모 데이터(권장 최소셋)
reset마다 재현 가능한 최소 구성을 권장한다.

- **고객 2개:** 소매A(customer), 소매B(customer)
- **공장 2개:** 공장AB(vendor), 공장CD(vendor)
- **주소:**
  - 소매A: 기본주소 1개 + 추가주소 1개
  - 소매B: 기본주소 1개
- **담당자(선택):** 소매A primary 담당자 1명
- **prefix:**
  - 공장AB: AB, ABX
  - 공장CD: CD

---

## 15) 코딩 에이전트 전달사항(요약 잠금)
- SoT는 `public.cms_*`만 사용
- WRITE는 RPC만
- 주소/담당자/prefix map은 v2 RPC 추가 없으면 “편집 기능 구현 금지”
- default/primary 단일성은 서버에서 강제(트랜잭션/잠금 포함 권장)
- 고객 상세 AR 요약은 `cms_v_ar_position_by_party`로 표시

---

# 거래처(Party) 페이지 PRD — 백엔드 상세 섹션
## 백엔드 PRD 섹션(추가): v2 RPC 6개 (DB에 바로 추가 가능)

> **목적:** Party 페이지에서 **주소/담당자/벤더 Prefix**를 “UI 직접 write 없이” **RPC만으로** 완결시키기.  
> **SoT:** **무조건 `public.cms_*`**. 다른 스키마 금지.

---

## 0) 공통 규약(모든 v2 RPC에 적용)

### 0.1 보안/스키마
- `SECURITY DEFINER`
- `SET search_path TO 'public', 'pg_temp'`
- **base table 직접 write는 UI에서 금지**(이 함수로만 변경)

### 0.2 감사로그(필수)
- 모든 v2 RPC는 **성공 시** `cms_decision_log`에 1건 이상 기록한다.
- `decision_log` 최소 필드:
  - `entity_type`: `'party_address' | 'person' | 'party_person_link' | 'vendor_prefix_map'`
  - `entity_id`: 해당 row의 PK(uuid) 또는 링크키를 대표하는 uuid(아래 함수별 규정)
  - `decision_kind`: `'UPSERT' | 'DELETE' | 'SET_DEFAULT' | 'SET_PRIMARY'`
  - `before`, `after`: jsonb 스냅샷(최소 변경 컬럼 포함)
  - `actor_person_id`, `note`

> **주의:** `cms_vendor_prefix_map`은 PK가 text(prefix)라 entity_id uuid가 애매함 → decision_log에는 `entity_id`에 **`vendor_party_id`**를 넣고, `before/after`에 prefix 포함(아래 함수 정의 참고).

### 0.3 동시성/잠금(필수)
- **party_id 단위로 default/primary 단일성 유지**를 위해, 아래 패턴을 고정:
  - `select 1 from cms_party where party_id = ... for update;`
- prefix upsert/delete는 경쟁 조건 방지를 위해:
  - `perform pg_advisory_xact_lock(hashtext(p_prefix));`

### 0.4 예외 코드/메시지 규격(고정)
- invalid input: `ERRCODE '22023'` (invalid_parameter_value)
- not found: `ERRCODE 'P0002'` (no_data_found)
- privilege/RLS: DB 기본(42501 등) 그대로
- 메시지 포맷(고정):
  - `CMS_V2_<FUNC>_<REASON>: <human message>`
  - 예: `CMS_V2_UPSERT_PARTY_ADDRESS_INVALID: party_id is required`

> Supabase/Next에서 에러 파싱이 쉬우려면 메시지 prefix를 그대로 사용한다.

### 0.5 반환 JSON 스키마(정규화, 성공 시 고정)
모든 v2 RPC는 성공 시 아래 형태로 반환:
```json
{
  "ok": true,
  "data": { ... }, 
  "error": null,
  "meta": {
    "correlation_id": "uuid|null",
    "occurred_at": "timestamptz"
  }
}
```
실패 시에는 `raise exception`으로 실패(“ok:false” 반환으로 뭉개지 않음)

---

## 1) v2 RPC 목록(6개)
1. `cms_fn_upsert_party_address_v2` (주소 추가/수정 + default 단일성)
2. `cms_fn_delete_party_address_v2` (주소 삭제 + default 승계)
3. `cms_fn_upsert_person_v2` (담당자(Person) 추가/수정)
4. `cms_fn_upsert_party_person_link_v2` (Party↔Person 링크 upsert + primary 단일성)
5. `cms_fn_unlink_party_person_v2` (Party↔Person 링크 삭제 + primary 승계)
6. `cms_fn_upsert_vendor_prefix_map_v2` (Vendor prefix upsert/delete)

---

## 2) 함수별 상세 PRD + “바로 실행 가능한 SQL”

### (1) cms_fn_upsert_party_address_v2
**목적**
- 거래처 주소를 추가/수정한다.
- `is_default=true` 요청 시 해당 party의 다른 주소 default를 전부 해제한다.
- **기본 정책(편의):** 해당 party에 default 주소가 아예 없으면, 이번 주소를 자동 default로 승격한다.

**시그니처(확정)**
```sql
public.cms_fn_upsert_party_address_v2(
  p_party_id uuid,
  p_address_text text,
  p_label text default null,
  p_is_default boolean default false,
  p_address_id uuid default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
) returns jsonb
```

**내부 검증(예외 코드/메시지)**
- `p_party_id is null` → 22023 `CMS_V2_UPSERT_PARTY_ADDRESS_INVALID: party_id is required`
- `p_address_text blank` → 22023 `...: address_text is required`
- `p_address_id`가 주어졌는데 row가 없거나 다른 party에 속함 → P0002 `...: address_id not found or not owned by party`

**잠금 포인트**
- `cms_party` (해당 party) FOR UPDATE 필수
- update 대상 주소 row FOR UPDATE(존재 시)

**반환 data(정규화)**
```json
{
  "address_id": "uuid",
  "party_id": "uuid",
  "is_default": true,
  "changed": { "default_reset": true }
}
```

**SQL (즉시 실행 가능)**
```sql
create or replace function public.cms_fn_upsert_party_address_v2(
  p_party_id uuid,
  p_address_text text,
  p_label text default null,
  p_is_default boolean default false,
  p_address_id uuid default null,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  v_addr_id uuid;
  v_before jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  v_has_default boolean;
  v_default_reset boolean := false;
begin
  if p_party_id is null then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_PARTY_ADDRESS_INVALID: party_id is required';
  end if;

  if nullif(trim(coalesce(p_address_text,'')),'') is null then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_PARTY_ADDRESS_INVALID: address_text is required';
  end if;

  -- party lock (default 단일성 보장)
  perform 1 from cms_party where party_id = p_party_id for update;
  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UPSERT_PARTY_ADDRESS_NOT_FOUND: party not found';
  end if;

  if p_address_id is not null then
    select to_jsonb(a) into v_before
    from cms_party_address a
    where a.address_id = p_address_id and a.party_id = p_party_id
    for update;

    if not found then
      raise exception using errcode='P0002',
        message='CMS_V2_UPSERT_PARTY_ADDRESS_NOT_FOUND: address_id not found or not owned by party';
    end if;

    update cms_party_address
      set label = p_label,
          address_text = p_address_text,
          updated_at = v_now
    where address_id = p_address_id;

    v_addr_id := p_address_id;
  else
    insert into cms_party_address(party_id, label, address_text, is_default, created_at, updated_at)
    values (p_party_id, p_label, p_address_text, false, v_now, v_now)
    returning address_id into v_addr_id;
  end if;

  -- default 처리
  if coalesce(p_is_default,false) = true then
    update cms_party_address
      set is_default = false,
          updated_at = v_now
    where party_id = p_party_id
      and address_id <> v_addr_id
      and is_default = true;

    v_default_reset := (found);

    update cms_party_address
      set is_default = true,
          updated_at = v_now
    where address_id = v_addr_id;
  end if;

  -- default가 전혀 없으면 자동 승격
  select exists(
    select 1 from cms_party_address
    where party_id = p_party_id and is_default = true
  ) into v_has_default;

  if v_has_default = false then
    update cms_party_address
      set is_default = true,
          updated_at = v_now
    where address_id = v_addr_id;
  end if;

  select to_jsonb(a) into v_after
  from cms_party_address a
  where a.address_id = v_addr_id;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'party_address',
    v_addr_id,
    'UPSERT',
    coalesce(v_before,'{}'::jsonb),
    jsonb_build_object('address', v_after, 'default_reset', v_default_reset),
    p_actor_person_id,
    v_now,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'address_id', v_addr_id,
      'party_id', p_party_id,
      'is_default', (v_after->>'is_default')::boolean,
      'changed', jsonb_build_object('default_reset', v_default_reset)
    ),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

### (2) cms_fn_delete_party_address_v2
**목적**
- 주소 row 삭제
- 삭제 대상이 default였다면 남아있는 주소 중 1개를 자동 default로 승계 (정책: `created_at asc` 1개)

**시그니처(확정)**
```sql
public.cms_fn_delete_party_address_v2(
  p_address_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
) returns jsonb
```

**검증**
- `p_address_id is null` → 22023
- 주소 미존재 → P0002

**잠금 포인트**
- 삭제 대상 주소 FOR UPDATE
- 해당 party FOR UPDATE (default 승계 일관성)

**SQL**
```sql
create or replace function public.cms_fn_delete_party_address_v2(
  p_address_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  r_addr record;
  v_before jsonb;
  v_new_default_id uuid;
begin
  if p_address_id is null then
    raise exception using errcode='22023', message='CMS_V2_DELETE_PARTY_ADDRESS_INVALID: address_id is required';
  end if;

  select * into r_addr
  from cms_party_address
  where address_id = p_address_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='CMS_V2_DELETE_PARTY_ADDRESS_NOT_FOUND: address not found';
  end if;

  v_before := to_jsonb(r_addr);

  -- party lock
  perform 1 from cms_party where party_id = r_addr.party_id for update;

  delete from cms_party_address where address_id = p_address_id;

  -- default 승계
  if coalesce((v_before->>'is_default')::boolean,false) = true then
    select a.address_id into v_new_default_id
    from cms_party_address a
    where a.party_id = r_addr.party_id
    order by a.created_at asc
    limit 1;

    if v_new_default_id is not null then
      update cms_party_address
        set is_default = true,
            updated_at = v_now
      where address_id = v_new_default_id;
    end if;
  end if;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'party_address',
    p_address_id,
    'DELETE',
    v_before,
    jsonb_build_object('new_default_address_id', v_new_default_id),
    p_actor_person_id,
    v_now,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'deleted_address_id', p_address_id,
      'party_id', r_addr.party_id,
      'new_default_address_id', v_new_default_id
    ),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

### (3) cms_fn_upsert_person_v2
**목적**
- cms_person 신규/수정

**시그니처(확정)**
```sql
public.cms_fn_upsert_person_v2(
  p_name text default null,
  p_phone text default null,
  p_note text default null,
  p_person_id uuid default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null
) returns jsonb
```

**검증**
- 신규 생성 시: name/phone 둘 다 비어있으면 22023 (연락처로서 무의미)
- 수정 시: person 미존재 → P0002

**잠금**
- 수정 대상 person row FOR UPDATE

**SQL**
```sql
create or replace function public.cms_fn_upsert_person_v2(
  p_name text default null,
  p_phone text default null,
  p_note text default null,
  p_person_id uuid default null,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
begin
  if p_person_id is null then
    if nullif(trim(coalesce(p_name,'')),'') is null
       and nullif(trim(coalesce(p_phone,'')),'') is null then
      raise exception using errcode='22023', message='CMS_V2_UPSERT_PERSON_INVALID: name or phone is required';
    end if;

    insert into cms_person(name, phone, note, created_at, updated_at)
    values (p_name, p_phone, p_note, v_now, v_now)
    returning person_id into v_id;
  else
    select to_jsonb(p) into v_before
    from cms_person p
    where p.person_id = p_person_id
    for update;

    if not found then
      raise exception using errcode='P0002', message='CMS_V2_UPSERT_PERSON_NOT_FOUND: person not found';
    end if;

    update cms_person
      set name = p_name,
          phone = p_phone,
          note = p_note,
          updated_at = v_now
    where person_id = p_person_id;

    v_id := p_person_id;
  end if;

  select to_jsonb(p) into v_after
  from cms_person p
  where p.person_id = v_id;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'person',
    v_id,
    'UPSERT',
    coalesce(v_before,'{}'::jsonb),
    v_after,
    p_actor_person_id,
    v_now,
    null
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('person_id', v_id, 'person', v_after),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

### (4) cms_fn_upsert_party_person_link_v2
**목적**
- `cms_party_person_link` (party_id, person_id) 링크를 생성/수정한다.
- `p_is_primary=true`면 동일 party의 다른 링크 `is_primary=false`로 리셋한다.
- **기본 정책(편의):** party에 primary가 아예 없으면 이번 링크를 자동 primary로 승격

**시그니처(확정)**
```sql
public.cms_fn_upsert_party_person_link_v2(
  p_party_id uuid,
  p_person_id uuid,
  p_role text default null,
  p_is_primary boolean default false,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
) returns jsonb
```

**검증**
- party_id/person_id null → 22023
- party/person 존재하지 않음 → P0002
- 링크가 이미 있는데 role/is_primary update 가능

**잠금**
- party row FOR UPDATE (primary 단일성)
- person row는 존재 확인만(잠금 불필요)
- 링크 row는 FOR UPDATE(존재 시)

**SQL**
```sql
create or replace function public.cms_fn_upsert_party_person_link_v2(
  p_party_id uuid,
  p_person_id uuid,
  p_role text default null,
  p_is_primary boolean default false,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  v_before jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  v_primary_reset boolean := false;
  v_has_primary boolean;
begin
  if p_party_id is null or p_person_id is null then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_PARTY_PERSON_LINK_INVALID: party_id and person_id are required';
  end if;

  perform 1 from cms_party where party_id = p_party_id for update;
  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UPSERT_PARTY_PERSON_LINK_NOT_FOUND: party not found';
  end if;

  perform 1 from cms_person where person_id = p_person_id;
  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UPSERT_PARTY_PERSON_LINK_NOT_FOUND: person not found';
  end if;

  -- 링크 before (있으면)
  select to_jsonb(l) into v_before
  from cms_party_person_link l
  where l.party_id = p_party_id and l.person_id = p_person_id
  for update;

  if found then
    update cms_party_person_link
      set role = p_role,
          is_primary = coalesce(p_is_primary,false)
    where party_id = p_party_id and person_id = p_person_id;
  else
    insert into cms_party_person_link(party_id, person_id, role, is_primary, created_at)
    values (p_party_id, p_person_id, p_role, coalesce(p_is_primary,false), v_now);
  end if;

  -- primary 처리
  if coalesce(p_is_primary,false) = true then
    update cms_party_person_link
      set is_primary = false
    where party_id = p_party_id
      and person_id <> p_person_id
      and is_primary = true;

    v_primary_reset := (found);

    update cms_party_person_link
      set is_primary = true
    where party_id = p_party_id and person_id = p_person_id;
  end if;

  -- primary가 전혀 없으면 자동 승격
  select exists(
    select 1 from cms_party_person_link
    where party_id = p_party_id and is_primary = true
  ) into v_has_primary;

  if v_has_primary = false then
    update cms_party_person_link
      set is_primary = true
    where party_id = p_party_id and person_id = p_person_id;
  end if;

  select to_jsonb(l) into v_after
  from cms_party_person_link l
  where l.party_id = p_party_id and l.person_id = p_person_id;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'party_person_link',
    p_person_id, -- 링크 PK가 uuid가 아니라서 대표로 person_id를 사용(상세는 after에 party_id 포함)
    'UPSERT',
    coalesce(v_before,'{}'::jsonb),
    jsonb_build_object('link', v_after, 'primary_reset', v_primary_reset),
    p_actor_person_id,
    v_now,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'party_id', p_party_id,
      'person_id', p_person_id,
      'link', v_after,
      'changed', jsonb_build_object('primary_reset', v_primary_reset)
    ),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

### (5) cms_fn_unlink_party_person_v2
**목적**
- party-person 링크 삭제
- 삭제 대상이 primary였다면 남은 링크 중 1개를 자동 primary로 승계(정책: `created_at asc`)

**시그니처(확정)**
```sql
public.cms_fn_unlink_party_person_v2(
  p_party_id uuid,
  p_person_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
) returns jsonb
```

**검증**
- party_id/person_id null → 22023
- 링크 미존재 → P0002

**잠금**
- party row FOR UPDATE
- 링크 row FOR UPDATE

**SQL**
```sql
create or replace function public.cms_fn_unlink_party_person_v2(
  p_party_id uuid,
  p_person_id uuid,
  p_actor_person_id uuid default null,
  p_note text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  r_link record;
  v_before jsonb;
  v_new_primary_person_id uuid;
begin
  if p_party_id is null or p_person_id is null then
    raise exception using errcode='22023', message='CMS_V2_UNLINK_PARTY_PERSON_INVALID: party_id and person_id are required';
  end if;

  perform 1 from cms_party where party_id = p_party_id for update;
  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UNLINK_PARTY_PERSON_NOT_FOUND: party not found';
  end if;

  select * into r_link
  from cms_party_person_link
  where party_id = p_party_id and person_id = p_person_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UNLINK_PARTY_PERSON_NOT_FOUND: link not found';
  end if;

  v_before := to_jsonb(r_link);

  delete from cms_party_person_link
  where party_id = p_party_id and person_id = p_person_id;

  -- primary 승계
  if coalesce((v_before->>'is_primary')::boolean,false) = true then
    select l.person_id into v_new_primary_person_id
    from cms_party_person_link l
    where l.party_id = p_party_id
    order by l.created_at asc
    limit 1;

    if v_new_primary_person_id is not null then
      update cms_party_person_link
        set is_primary = true
      where party_id = p_party_id and person_id = v_new_primary_person_id;
    end if;
  end if;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'party_person_link',
    p_person_id,
    'DELETE',
    v_before,
    jsonb_build_object('new_primary_person_id', v_new_primary_person_id),
    p_actor_person_id,
    v_now,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'party_id', p_party_id,
      'person_id', p_person_id,
      'new_primary_person_id', v_new_primary_person_id
    ),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

### (6) cms_fn_upsert_vendor_prefix_map_v2
**목적**
- 공장(vendor) prefix 매핑을 추가/수정/삭제한다.
- 경쟁 조건 방지를 위해 prefix 단위 advisory lock을 건다.
- 삭제는 `p_delete=true`로 처리(함수 1개로 upsert/delete 통합)

**시그니처(확정)**
```sql
public.cms_fn_upsert_vendor_prefix_map_v2(
  p_prefix text,
  p_vendor_party_id uuid,
  p_note text default null,
  p_delete boolean default false,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null
) returns jsonb
```

**검증**
- prefix blank → 22023
- vendor_party_id null → 22023 (삭제라도 vendor 기준 감사/일관성을 위해 받음)
- **vendor party 존재/타입 검증(권장):**
  - `cms_party.party_id = p_vendor_party_id` 존재
  - `party_type = 'vendor'` 아니면 22023

**잠금**
- `pg_advisory_xact_lock(hashtext(prefix))` 필수
- vendor party row FOR UPDATE(존재+타입 확인 겸)

**SQL**
```sql
create or replace function public.cms_fn_upsert_vendor_prefix_map_v2(
  p_prefix text,
  p_vendor_party_id uuid,
  p_note text default null,
  p_delete boolean default false,
  p_actor_person_id uuid default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_now timestamptz := now();
  v_prefix text := nullif(trim(coalesce(p_prefix,'')),'');
  v_before jsonb := '{}'::jsonb;
  v_after  jsonb := '{}'::jsonb;
  r_vendor record;
begin
  if v_prefix is null then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_VENDOR_PREFIX_INVALID: prefix is required';
  end if;
  if p_vendor_party_id is null then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_VENDOR_PREFIX_INVALID: vendor_party_id is required';
  end if;

  -- prefix 단위 경쟁 방지
  perform pg_advisory_xact_lock(hashtext(v_prefix));

  select * into r_vendor
  from cms_party
  where party_id = p_vendor_party_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='CMS_V2_UPSERT_VENDOR_PREFIX_NOT_FOUND: vendor party not found';
  end if;

  if (r_vendor.party_type::text) <> 'vendor' then
    raise exception using errcode='22023', message='CMS_V2_UPSERT_VENDOR_PREFIX_INVALID: party_type must be vendor';
  end if;

  -- before
  select to_jsonb(m) into v_before
  from cms_vendor_prefix_map m
  where m.prefix = v_prefix;

  if coalesce(p_delete,false) = true then
    delete from cms_vendor_prefix_map where prefix = v_prefix;

    insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
    values (
      'vendor_prefix_map',
      p_vendor_party_id,
      'DELETE',
      coalesce(v_before,'{}'::jsonb),
      jsonb_build_object('prefix', v_prefix),
      p_actor_person_id,
      v_now,
      p_note
    );

    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object('prefix', v_prefix, 'deleted', true),
      'error', null,
      'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
    );
  end if;

  -- upsert (unique 제약이 없을 수 있어 update->insert 패턴 고정)
  update cms_vendor_prefix_map
    set vendor_party_id = p_vendor_party_id,
        note = p_note
  where prefix = v_prefix;

  if not found then
    insert into cms_vendor_prefix_map(prefix, vendor_party_id, note, created_at)
    values (v_prefix, p_vendor_party_id, p_note, v_now);
  end if;

  select to_jsonb(m) into v_after
  from cms_vendor_prefix_map m
  where m.prefix = v_prefix;

  insert into cms_decision_log(entity_type, entity_id, decision_kind, before, after, actor_person_id, occurred_at, note)
  values (
    'vendor_prefix_map',
    p_vendor_party_id,
    'UPSERT',
    coalesce(v_before,'{}'::jsonb),
    v_after,
    p_actor_person_id,
    v_now,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('prefix', v_prefix, 'vendor_party_id', p_vendor_party_id, 'map', v_after),
    'error', null,
    'meta', jsonb_build_object('correlation_id', p_correlation_id, 'occurred_at', v_now)
  );
end
$$;
```

---

## 3) 권장 인덱스/제약(필수 권장)
아래가 없으면 데이터 무결성이 약해지고, “upsert”가 중복을 만들 수 있다.

```sql
-- 주소: party_id별 조회 최적화
create index if not exists idx_cms_party_address_party on public.cms_party_address(party_id);

-- 주소: default 단일성(강추) - 부분 unique 인덱스
create unique index if not exists ux_cms_party_address_default
on public.cms_party_address(party_id)
where is_default = true;

-- 링크: (party_id, person_id) 유니크(강추)
create unique index if not exists ux_cms_party_person_link
on public.cms_party_person_link(party_id, person_id);

-- 링크: party_id별 primary 단일성(강추)
create unique index if not exists ux_cms_party_person_primary
on public.cms_party_person_link(party_id)
where is_primary = true;

-- prefix: prefix 유니크(강추)
create unique index if not exists ux_cms_vendor_prefix
on public.cms_vendor_prefix_map(prefix);
```

---

## 4) GRANT(권장 템플릿)
“staff/authenticated는 RPC만” 원칙을 유지하려면, 이 함수들에 EXECUTE를 명시적으로 부여하고 base table write는 막아야 한다.

```sql
-- 예: authenticated 역할에 실행 권한
grant execute on function public.cms_fn_upsert_party_address_v2(uuid,text,text,boolean,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.cms_fn_delete_party_address_v2(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.cms_fn_upsert_person_v2(text,text,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.cms_fn_upsert_party_person_link_v2(uuid,uuid,text,boolean,uuid,text,uuid) to authenticated;
grant execute on function public.cms_fn_unlink_party_person_v2(uuid,uuid,uuid,text,uuid) to authenticated;
grant execute on function public.cms_fn_upsert_vendor_prefix_map_v2(text,uuid,text,boolean,uuid,uuid) to authenticated;

-- base table write는 역할 정책에 따라 revoke(이미 막혀있다면 생략)
-- revoke insert, update, delete on public.cms_party_address from authenticated;
-- revoke insert, update, delete on public.cms_person from authenticated;
-- revoke insert, update, delete on public.cms_party_person_link from authenticated;
-- revoke insert, update, delete on public.cms_vendor_prefix_map from authenticated;
```

---

## 5) UI 연결 포인트(요약)
- **주소 탭:**
  - 저장: `cms_fn_upsert_party_address_v2`
  - 삭제: `cms_fn_delete_party_address_v2`
- **담당자 탭:**
  - person 저장: `cms_fn_upsert_person_v2`
  - 링크 저장/primary: `cms_fn_upsert_party_person_link_v2`
  - 링크 삭제: `cms_fn_unlink_party_person_v2`
- **vendor prefix 탭:**
  - upsert: `cms_fn_upsert_vendor_prefix_map_v2(p_delete=false)`
  - delete: `cms_fn_upsert_vendor_prefix_map_v2(p_delete=true)`