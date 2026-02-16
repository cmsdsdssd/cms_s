# PRD: 마진 엔진 고도화 (기본공임/알공임/도금/흡수공임) — 설정·카탈로그·출고확정 연동
**문서버전:** v1.0 (2026-02-16)

## 목적
“판매가 먼저 정하고 원가 빼서 마진 추적” → “원가 + 마진룰(글로벌/팩토리/프로파일/흡수)로 판매가를 결정” 방식으로 완전 전환.

## 핵심 요구
글로벌 룰만 바꾸면 자동으로 전체 SKU에 일괄 반영되고, SKU별 예외(흡수공임) 도 사유와 함께 관리되도록.

## 0) 전제 조건 (DB 상태 / 이번 작업 범위)
### DB 전제(이미 PUSH 완료라고 가정)
* 0602~0604 기반의 Margin Engine 스키마/함수/트리거 존재
* `cms_fn_receipt_line_match_confirm_v5` 존재
* `cms_fn_pick_pricing_rule_markup_v2` 존재
* `cms_buy_margin_profile_v1`, `cms_pricing_rule_v1`, `cms_plating_markup_rule_v1`, `cms_master_absorb_labor_item_v1` 및 컬럼 alias(compat 컬럼) 존재

### 이번 PRD 범위(코드 작업)
* **Receipt match confirm**가 반드시 v5를 호출하도록 고정
* **설정(Settings) UI**에서:
    * 기본공임 글로벌 마진룰 (BASE_LABOR)
    * 알공임(공장=FACTORY) 룰 (STONE + vendor + role + cost band)
    * 자입(BUY=SELF) 알공임 프로파일 (buy margin profile)
    * 도금(Plating) 마진룰
    * 을 CRUD + 테스트(Pick) + 한 번에 조정(일괄 Δ) 가능하게 제공
* **카탈로그(Catalog) UI**에서:
    * SKU별 알공임 소스(자입/공장/지급) 기본값 설정(중심/보조1/보조2)
    * SKU별 자입(BUY=SELF) 마진 프로파일 선택
    * SKU별 흡수공임(예외 마진) CRUD + 사유 저장
* **(선택/권장) 출고(Shipments) UI**에서:
    * confirm에서 자동 생성된 증빙 라인(COST_BASIS/MARGINS/WARN) 은 기본 접힘 + 읽기전용
    * 흡수공임(ABSORB) 은 “자동(흡수공임)” 섹션으로 표시(기본 읽기전용)

**결론적으로:** DB 추가 PUSH는 없어도 되고, “UI/백엔드(Next API)”만으로 완결되도록 구성.

---

## 1) 문제 정의 (현재 방식의 Pain Point)
### 현재
* 판매가를 먼저 정하고, 원가를 정해서 뺀 값이 마진
* 나중에 “기본공임 마진을 +5,000 올리자” 같은 정책 변경 시 2만 SKU를 일일이 수정해야 함 → 사실상 불가능
* 알공임은 “자입(우리가 구매)” vs “공장 제공”에 따라 마진 정책이 달라야 하는데, SKU/공장/마진 변경 추적이 어렵고 일괄 조정이 어려움

### 목표
* 마진을 “원가 + 룰/프로파일/예외”로 계산해서 판매가가 결정되도록 구조화
* 룰/프로파일만 바꾸면 전체 SKU/전체 출고확정에 자동 반영(미래분)
* SKU 특수 케이스는 흡수공임(예외) 으로 사유와 함께 누적 관리

---

## 2) 용어 / 개념 매핑 (중요)
| 사용자 표현 | 시스템 표현(DB) | 의미 |
| :--- | :--- | :--- |
| **BUY 알공임** | stone_source = 'SELF' | “자입(우리가 구매)” — buy margin profile 적용 |
| **FACTORY 알공임** | stone_source = 'FACTORY' | 공장 제공 — factory stone pricing rule 적용 |
| **고객지급** | stone_source = 'PROVIDED' | 비용 0/마진 0 취급(원칙) |
| **기본공임** | BASE_LABOR | 영수증 기본공임(cost) + BASE_LABOR 룰(markup) |
| **알공임** | STONE | 중심/보조1/보조2 각각 수량×단가 기반 + 마진(룰/프로파일) |
| **도금 공임(기타공임 중)** | PLATING | 도금 cost rule + 도금 markup rule |
| **흡수공임** | master_absorb_labor_item | SKU별 예외 마진/공임 — 사유/금액/공장스코프 가능 |

---

## 3) 가격 결정 정책 (정확한 계산 책임)
### 총판매가(대외)
* **총판매가 = 소재가격 + 총공임(판매가)**
* 소재가격은 기존대로 유지(이번 범위 아님)
* 이번 범위는 **총공임(판매가)** 를 룰/프로파일/예외로 계산

### 총공임 구성(개념)
1.  **기본공임(BASE_LABOR sell)** = 영수증 기본공임(cost) + BASE_LABOR 룰(마진)
2.  **기타공임(EXTRA sell)** = (세팅/패키지/알공임/도금 등) cost + 각각의 룰/프로파일 마진 + 흡수공임 + (레거시 addon margin)
3.  **수기 기타공임** = 출고확정 전에 사용자가 추가(기존 유지)

`cms_fn_receipt_line_match_confirm_v5`가 “shipment draft 생성” 시점에 위 로직으로 값을 스냅샷(그 시점 룰 기준)하여 shipment_line에 기록.

---

## 4) 사용자 시나리오 (User Stories)
### A. 기본공임 글로벌 마진 변경
1. Settings에서 BASE_LABOR 룰(markup_value_krw) 을 40,000 → 45,000으로 수정
2. 그 이후 새로 receipt 매칭 confirm 되는 건부터 기본공임 판매가가 일괄 상승
3. 기존에 이미 draft 생성된 건은 그대로(재확정/재생성 기능은 이번 범위 제외)

### B. 알공임 정책: 자입(BUY=SELF) vs 공장(FACTORY)
1. 카탈로그에서 SKU별로 중심/보조1/보조2 각각 “자입/공장/지급” 기본값 설정
2. **자입(SELF)일 때:**
    * Settings에서 관리하는 buy margin profile을 선택(예: “BUY_기본”, “BUY_상향”)
    * profile 수정만으로 전체 자입 SKU가 일괄 반영
3. **공장(FACTORY)일 때:**
    * Settings의 STONE 룰에서 factory별(vendor_party_id) + role별(CENTER/SUB1/SUB2) + cost band별 마진 설정
    * 공장 A는 1,000원 원가 → +200원, 공장 B는 1,000원 → +300원 같은 정책이 가능

### C. 도금 글로벌 룰
1. 도금 마진룰(plating markup rule)을 Settings에서 수정하면 이후 출고확정(매칭 confirm) 시 도금 마진이 자동 반영

### D. SKU별 예외(흡수공임)
1. 특정 SKU는 기본공임 마진을 더 붙여야 함
2. Catalog에서 SKU에 흡수공임 추가:
    * bucket=BASE_LABOR
    * reason=“기본공임 마진 추가”
    * amount=10,000
    * vendor_party_id=특정 공장 or null(전체)
3. 이후 영수증 매칭 confirm 시 shipment_line.extra_labor_items에 자동으로 “흡수공임” 라인이 붙어서 내려옴 (추적/근거/사유를 남기는 목적)

---

## 5) 기능 요구사항 (Functional Requirements)

### 5.1 Settings: Pricing Rules(기본공임/공장 알공임/세팅/패키지)
* **화면 요구**
    * 기존 “글로벌 룰” 패널을 확장
    * 룰 생성/수정 폼에 추가 필드
        * `apply_unit`: PER_PIECE / PER_STONE / PER_G
        * `stone_role`: CENTER / SUB1 / SUB2 / BEAD (apply_unit=PER_STONE일 때만 노출)
    * 룰 목록 테이블 컬럼 추가: ApplyUnit, StoneRole
* **데이터 규칙(검증)**
    * component=BASE_LABOR → apply_unit=PER_PIECE, stone_role=null 강제
    * component=STONE & apply_unit=PER_STONE → stone_role 필수
    * min_cost_krw ≥ 0, max_cost_krw null 또는 min 이상
    * markup_value_krw ≥ 0, priority 정수
* **“한번에 조정” 요구(일괄 Δ)**
    * 리스트 상단에 “현재 필터 조건(예: component=BASE_LABOR, vendor=전체) 기준으로 markup_value_krw에 일괄 +Δ 적용”
    * UI에서 Δ 입력 후 적용 버튼
    * 구현: 클라이언트에서 대상 rule들을 순회하며 POST(upsert) 호출(서버에 bulk endpoint 없어도 됨)

### 5.2 Settings: BUY(자입=SELF) 마진 프로파일 관리
* **테이블/개념**
    * `cms_buy_margin_profile_v1`
    * UI는 alias 컬럼 사용: `profile_name`, `margin_center_krw`, `margin_sub1_krw`, `margin_sub2_krw`
* **화면 요구**
    * 프로파일 CRUD
    * 프로파일 리스트 + 활성화 토글
    * 프로파일 상세 편집 시 “일괄 조정” 제공: center/sub1/sub2 모두에 +Δ 적용 버튼 또는 role별 Δ도 가능(선택)
* **검증**
    * profile_name 필수
    * margin_* ≥ 0

### 5.3 Settings: 도금(Plating) 마진 룰 관리
* **테이블/개념**
    * `cms_plating_markup_rule_v1`
    * 핵심 입력:
        * `plating_variant_id` (필수)
        * `effective_from` (기본=오늘)
        * `margin_fixed_krw`
        * `margin_per_g_krw`
        * `category_code`/`material_code` (옵션, null이면 전체)
        * `is_active`, `priority`
* **화면 요구**
    * plating variant 선택 드롭다운(기존 /api/plating-options 재사용 가능)
    * 룰 CRUD
    * (권장) 필터: plating_variant_id로 검색
    * “한번에 조정”: 특정 plating_variant_id의 룰들에 margin_fixed/per_g 일괄 +Δ (선택)

### 5.4 Catalog: SKU별 알공임 소스/BUY 프로파일/흡수공임
#### 5.4.1 SKU별 알공임 소스 기본값
* `cms_master_item`에 아래 필드를 편집 가능해야 함
    * `center_stone_source_default`
    * `sub1_stone_source_default`
    * `sub2_stone_source_default`
* UI 라벨은 사용자 친화적으로: SELF = “자입(BUY: 우리가 구매)”, FACTORY = “공장”, PROVIDED = “고객지급”

#### 5.4.2 SKU별 BUY 마진 프로파일
* `cms_master_item.buy_margin_profile_id` 선택
* 동작 규칙: (권장) 중심/보조 중 하나라도 source_default가 SELF이면 프로파일 선택 UI 활성화. 모두 FACTORY/PROVIDED이면 프로파일은 null로 유지(선택 불가 또는 안내)

#### 5.4.3 SKU별 흡수공임 관리
* `cms_master_absorb_labor_item_v1` CRUD
* 최소 입력:
    * `bucket` (BASE_LABOR / STONE_LABOR / PLATING / ETC)
    * `reason` (사유)
    * `amount_krw`
    * `is_per_piece` (true면 수량만큼 곱)
    * `vendor_party_id` (옵션: 특정 공장 한정)
    * `priority`, `is_active`, `note`
* **UI 요구(카탈로그 상세 패널)**
    * “흡수공임” 섹션: 리스트 테이블(사유, 금액, 버킷, 공장스코프, per-piece, active, priority), 추가/수정/비활성/삭제
    * 입력 가이드: 예) bucket=BASE_LABOR / reason=”기본공임 마진 추가” / amount=10000

### 5.5 Receipt Workbench: confirm는 반드시 v5 사용
* **요구**
    * 클라이언트가 호출하는 RPC 이름을 `cms_fn_receipt_line_match_confirm_v5` 로 고정
* **구현 방식(택1)**
    * `web/src/lib/contracts.ts`의 default를 v5로 변경
    * `.env`에서 `NEXT_PUBLIC_CMS_FN_RECEIPT_MATCH_CONFIRM=cms_fn_receipt_line_match_confirm_v5` 설정
    * PRD에서는 둘 다 권장(운영 안전장치)

### 5.6 Shipments UI(권장 개선)
* confirm v5가 extra_labor_items에 아래를 자동 삽입: COST_BASIS, MARGINS, WARN, ABSORB(흡수공임)
* **요구**
    * Shipments에서 “기타공임” 편집 UI에 자동 라인이 섞여 나오면 운영자가 실수로 수정할 수 있음
    * 따라서:
        * type이 COST_BASIS, MARGINS, WARN → 기본 접힘(고급정보) + read-only
        * type이 ABSORB(또는 label에 흡수/ABSORB) → “자동(흡수공임)” 그룹으로 표시 + read-only(권장)

---

## 6) 백엔드(Next.js API) 요구사항
* **원칙:** 서비스 롤 키로 서버에서만 write 수행. UI는 /api/...로만 CRUD.

### 6.1 기존 API 수정
**(1) GET/POST/DELETE /api/pricing-rules**
* 확장 필드 추가 수용: `apply_unit`, `stone_role`
* POST payload 예시:
```json
{
  "rule_id": null,
  "component": "STONE",
  "scope": "FACTORY",
  "apply_unit": "PER_STONE",
  "stone_role": "CENTER",
  "vendor_party_id": "uuid-or-null",
  "min_cost_krw": 0,
  "max_cost_krw": 1000,
  "markup_value_krw": 200,
  "priority": 10,
  "is_active": true,
  "note": "공장A 센터석 마진"
}
```

**(2) POST /api/pricing-rule-pick**
* v2 함수 호출로 변경: `cms_fn_pick_pricing_rule_markup_v2`
* body에 apply_unit/stone_role 추가
```json
{
  "component": "STONE",
  "scope": "FACTORY",
  "apply_unit": "PER_STONE",
  "stone_role": "CENTER",
  "vendor_party_id": "uuid-or-null",
  "cost_basis_krw": 1000
}
```
* response: `{ "data": { "picked_rule_id": "uuid-or-null", "markup_krw": 200 } }`

### 6.2 신규 API 추가
**(A) /api/buy-margin-profiles (GET/POST/DELETE)**
* GET: 전체 프로파일 조회
* POST: upsert
```json
{
  "profile_id": null,
  "profile_name": "BUY_기본",
  "margin_center_krw": 5000,
  "margin_sub1_krw": 2000,
  "margin_sub2_krw": 2000,
  "is_active": true,
  "note": "기본 자입 마진"
}
```
* DELETE: ?profile_id=...

**(B) /api/plating-markup-rules (GET/POST/DELETE)**
* GET: 룰 조회(옵션 필터: plating_variant_id)
* POST: upsert (핵심 필드)
```json
{
  "rule_id": null,
  "plating_variant_id": "uuid",
  "effective_from": "2026-02-16",
  "category_code": null,
  "material_code": null,
  "margin_fixed_krw": 1000,
  "margin_per_g_krw": 0,
  "priority": 100,
  "is_active": true,
  "note": "도금 기본 마진"
}
```
* DELETE: ?rule_id=...

**(C) /api/master-absorb-labor-items (GET/POST/DELETE)**
* GET: ?master_id=... 로 해당 SKU의 흡수공임 리스트 조회
* POST: upsert
```json
{
  "absorb_item_id": null,
  "master_id": "uuid",
  "bucket": "BASE_LABOR",
  "reason": "기본공임 마진 추가",
  "amount_krw": 10000,
  "is_per_piece": true,
  "vendor_party_id": null,
  "priority": 100,
  "is_active": true,
  "note": ""
}
```
* DELETE: ?absorb_item_id=...

### 6.3 기존 API 보강
* **/api/master-item (POST)**
    * upsert 후 추가 patch(update)로 아래 컬럼 반영: `center_stone_source_default`, `sub1_stone_source_default`, `sub2_stone_source_default`, `buy_margin_profile_id`
* **/api/order-upsert (POST) (선택/권장)**
    * DB upsert 함수 v6에 파라미터가 없으므로: body에 `p_buy_margin_profile_id`가 오면 upsert 후 `cms_order_line.buy_margin_profile_id`를 update로 patch. UI에서 “주문 라인 단 override” 필요할 때 사용 가능.

---

## 7) 프론트엔드 요구사항 (UI/UX)
### 7.1 Settings Page 고도화
* **섹션 구성(권장)**
    * [기존] 시세 파이프라인 설정
    * [기존] RULE 올림 단위
    * [신규] 마진 엔진 설정(접힘 패널)
        * Pricing Rules (BASE_LABOR / STONE / SETTING / PACKAGE)
        * BUY 마진 프로파일
        * 도금 마진 룰
        * 룰 테스트(픽 테스트)
* **룰 테스트 UX**
    * 컴포넌트=STONE 선택 시: apply_unit=PER_STONE 자동 선택, stone_role 선택 드롭다운 노출. 결과로 picked_rule_id와 markup_krw 표시.

### 7.2 Catalog Page 고도화
* **“알공임 정책” 블록 추가(마스터 상세)**
    * 중심/보조1/보조2 각각: (기존) stone name, (신규) `stone_source_default` 선택(SELF/FACTORY/PROVIDED)
    * “자입(BUY) 마진 프로파일”: source_default 중 하나라도 SELF면 활성화. `buy_margin_profile_id` 드롭다운(활성 프로파일만). 현재 선택된 프로파일의 margin 요약 표시(센터/보조1/보조2)
* **“흡수공임” 블록 추가**
    * 리스트 + add/edit 폼. vendor scope 선택(전체/특정 공장). 저장 시 즉시 반영.

### 7.3 Shipments Page(권장)
* **extra_labor_items 표시를 아래로 재구성:**
    * “사용자 입력 기타공임” (editable)
    * “자동 계산 내역(고급)” (COST_BASIS/MARGINS/WARN, read-only, 접힘)
    * “자동 흡수공임(고급)” (ABSORB, read-only, 접힘)

---

## 8) 구현 체크리스트 (코딩 에이전트용 To-do)
### 8.1 반드시 해야 함 (최소 완결)
* [ ] `web/src/lib/contracts.ts`에서 receipt match confirm 기본값을 `cms_fn_receipt_line_match_confirm_v5`로 변경
* [ ] `/api/pricing-rules` 확장: `apply_unit`/`stone_role` 지원
* [ ] `/api/pricing-rule-pick`에서 `cms_fn_pick_pricing_rule_markup_v2` 호출로 변경 + 파라미터 확장
* [ ] 신규 API 3개 생성:
    * `/api/buy-margin-profiles`
    * `/api/plating-markup-rules`
    * `/api/master-absorb-labor-items`
* [ ] `/api/master-item`에서 `stone_source_default` + `buy_margin_profile_id` patch 반영
* [ ] **Settings UI:** pricing rules 폼/테이블에 `apply_unit`/`stone_role` 추가 + buy profile + plating markup 섹션 추가
* [ ] **Catalog UI:** `stone_source_default` + `buy_margin_profile_id` + 흡수공임 CRUD UI 추가

### 8.2 권장(운영 실수 방지)
* [ ] Shipments UI에서 자동 라인 read-only/접힘 처리

---

## 9) 인수 기준 (Acceptance Criteria)
1. **기본공임 룰:** Settings에서 BASE_LABOR 룰의 markup을 40,000 → 45,000 변경 후 다음 receipt confirm 생성되는 shipment_line에서 기본공임 sell이 +5,000 증가해야 함
2. **공장 알공임 룰:** STONE/FACTORY/PER_STONE/CENTER 룰을 공장A에 +200 설정하면 공장A 영수증으로 confirm 시 센터석(FACTORY) 수량×200 만큼 마진 증가해야 함
3. **자입 알공임 프로파일:** buy margin profile의 센터 margin을 5,000 → 6,000 변경하면 stone_source=SELF인 주문/SKU confirm 시 센터석 수량×(증가분) 만큼 sell 증가해야 함
4. **도금 룰:** plating markup rule fixed를 +1,000 올리면 도금 있는 SKU confirm 시 extra sell에 반영되어야 함
5. **흡수공임:** 특정 SKU에 흡수공임(사유/금액)을 추가하면 그 SKU confirm 시 shipment_line.extra_labor_items에 해당 라인이 자동 포함되어야 함. vendor_party_id가 지정된 흡수공임은 해당 공장 receipt일 때만 적용되어야 함.

---

## 10) 주의사항 / 운영 가이드
* 룰/프로파일 변경은 **“이후 생성되는 shipment draft/confirm에 적용”** (이미 생성된 draft는 자동 재계산되지 않음)
* SKU 예외는 반드시 흡수공임으로 남겨서 “왜 이 SKU만 비싸냐”를 추적 가능하게 유지
* confirm v5가 생성한 extra_labor_items에는 증빙(COST_BASIS/MARGINS/WARN)이 포함될 수 있으니, Shipments UI에서 숨김/접힘 처리 권장