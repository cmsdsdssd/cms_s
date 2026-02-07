# [CODING AGENT PROMPT] 변형 플래그 + 공장오차/단가인상 흡수 + 출고단계 자입원석 분리입력 (Front-end only, 충돌 0)

## 0) 목표 (현실 최적/운영 최저부담)
* 주문 입력 시점에 “변형”을 명시적으로 체크해서 실수 방지
* 변형이면 마스터 자동계산(추천/근거)은 참고만, 실제 판매가는 출고(Shipments) 단계에서 변형 마진/조정으로 마감
* 변형이 아니면 공장 영수증(알공임/세팅공임)과 마스터 기준 계산 결과가 달라도:
    1.  공장 오차/실수
    2.  단가 인상/정책 변화
    를 출고 화면에서 Δ(델타)로 흡수하고, 사유가 데이터로 남게 만들기
* 자입 원석 원가를 “공장 영수증 라인원가/AP”에 절대 섞지 않음
→ 자입은 **Shipments(출고정보입력)**에서 역할별(메인/보조1/보조2)로 원가+마진 입력(또는 총 판매가 입력)해서 extra_labor_items meta로만 저장 (학습/분석 가능)
* ✅ 전제: “극한 예외”는 override로 처리한다. 여기서는 운영 95% 커버가 목표.

## 1) 절대 조건 (충돌/리스크 제로)
* 백엔드(DB/RPC/마이그레이션 수정 금지). 이번 작업은 프론트엔드만.
* 기존 흐름(주문입력, 공장발주서 팩스, 출고확정, 매장출고 확정시점 등) UI/UX 깨지면 실패.
* 데이터 저장은 기존 컬럼/JSON을 그대로 활용:
    * “변형”은 memo에 태그로만 저장해서 DB 변경 없이 전파
    * Shipments의 추가금/조정은 기존 `cms_shipment_line.extra_labor_items`에 새 item type + meta 추가로만 저장
    * 기존에 이미 있는 `extra_labor_items` 구조(배열, `{id,type,label,amount}`)를 깨지 않기
    * → meta는 옵셔널로 추가하되, 기존 normalize/렌더링이 망가지지 않게 방어적으로 처리

## 2) 구현 규칙 (데이터 표준)

### 2.1 변형 태그 표준
* 태그 문자열: `"[변형]"` (맨 앞에 붙이는 규칙)
* memo 규칙:
    * 변형 체크 ON → memo 앞에 `"[변형] "`를 항상 붙인다
    * 변형 체크 OFF → memo에서 `"[변형]"` prefix 제거
* 이 태그가 있으면:
    * Orders/Orders_main/Shipments/Shipments_main/Factory PO 출력에서 “변형” 배지 표시
    * Shipments(출고정보입력)에서 변형 모드 자동 ON (토글 가능하되, 끄면 경고)

### 2.2 Shipments 추가 아이템 타입(Front에서만)
`cms_shipment_line.extra_labor_items`에 아래 type을 추가로 쓸 것. (기존 타입 유지)
* **STONE_LABOR** : (기존) 알공임(세팅/원석 포함) — 그대로 유지
* **VENDOR_DELTA** : 공장오차/단가인상 흡수 Δ
    * amount: 음수 허용
    * meta: `{ reason: "ERROR" | "POLICY", note?: string }`
* **CUSTOM_VARIATION** : 변형 주문 추가 마진/조정
    * meta: `{ note?: string }`
* **SELF_STONE_SELL** : 자입 원석 판매가(역할별) (공장원가/AP와 분리)
    * amount: “고객에게 청구되는 자입원석 판매가(총액)”
    * meta 예: `{ role: "CENTER"|"SUB1"|"SUB2", cost_total_krw: number, margin_total_krw: number, qty_used?: number, stone_name?: string }`

## 3) 공통 유틸 추가 (필수)
* 새 파일 추가: `web/src/lib/variation-tag.ts`
* 구현 함수(간단/순수함수):
```typescript
const VARIATION_TAG = "[변형]";
hasVariationTag(memo?: string|null): boolean
ensureVariationTag(memo: string): string  // 맨 앞에 [변형] 없으면 붙임
removeVariationTag(memo: string): string
toggleVariationTag(memo: string, on: boolean): string
```
주의: memo가 빈 문자열이어도 태그만 남을 수 있음. 그 경우도 허용.

## 4) 주문 입력 UI에 “변형” 체크 추가 (실수 방지)
* **대상 파일:** `web/src/app/(app)/orders/page.tsx`
* **요구사항:**
    * 주문 입력 row에 “변형” 체크 UI 추가 (권장 위치: memo 입력 근처 또는 row 주요 필드 옆)
    * 체크 ON/OFF 시:
        * `row.memo`가 `variation-tag.ts` 규칙대로 자동 업데이트
        * 화면에서 `model_name` 옆에 작은 Badge로 변형 표시
    * 저장 시 이미 memo가 그대로 올라가므로 백엔드 변경 없음
* **힌트(코드 위치):**
    * memo는 이미 `updateRow(row.id, { memo: e.target.value })`로 관리되고 있음
    * → 여기 옆에 `isVariation` 파생 상태를 두거나, 그냥 memo 기반으로 체크박스를 “derived UI”로 처리해도 됨

## 5) Orders_main / Shipments_main 목록에도 “변형” 배지 표시
* **대상 파일:**
    * `web/src/app/(app)/orders_main/page.tsx`
    * `web/src/app/(app)/shipments_main/page.tsx`
* **요구사항:**
    * `row.memo`에 `[변형]` 있으면:
        * `model_name` 옆에 `Badge("변형")`
        * memo 텍스트에는 태그가 보여도 되지만, 가능하면 UX상 tag는 숨기고 배지만 보여도 좋음(선택)

## 6) 공장 발주서(Fax/Preview)에도 변형 표시
* **대상 파일:** `web/src/components/factory-order/factory-order-wizard.tsx`
* **요구사항:**
    * 생성되는 팩스 HTML에서 `model_name` 출력할 때:
        * memo에 `[변형]` 있으면 모델명 옆에 `"(변형)"` 문자열을 붙여서 공장도 한눈에 알게
        * 예: `AB-1234 (변형)`
    * (이 파일은 이미 memo를 표에 찍고 있음. 거기에 더해 모델명 출력에도 반영)

## 7) Shipments “출고정보입력”에 3가지 흡수 로직을 UI로 박기
* **대상 파일:** `web/src/app/(app)/shipments/page.tsx`
* **보조(라벨링):** `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx` (선택)

### 7.1 Shipments에서 “변형 모드” 자동 토글
* selected order의 memo(또는 prefill/orderLineDetail의 memo)에서 `[변형]` 감지 시:
    * 출고 입력 영역 상단에 `Badge: 변형 주문`
    * “변형 모드” 토글 ON (기본)
* **변형 모드 ON일 때 정책:**
    * 마스터 기반 자동 추천/근거 패널은 “참고용”으로만 표시 (비활성화/설명 추가)
    * 변형 관련 조정 입력을 강제:
        * `CUSTOM_VARIATION` 아이템(amount) 입력란 노출
        * 값이 비어있으면 저장시 경고(막을지/경고만 할지 선택. 운영 안전을 위해 막는 것 권장)

### 7.2 공장 오차/실수 vs 단가인상/정책변화 Δ 입력 (변형 아닌 경우 핵심)
* “Δ(차이 흡수)” 섹션 추가:
    * 사유 선택: 공장 오차/실수(ERROR) / 단가 인상/정책변화(POLICY)
    * 금액 입력: Δ원 (음수 허용)
    * 메모 입력(옵션): “왜 그런지”
* 저장 시 `extra_labor_items`에 단 1개의 `VENDOR_DELTA` 아이템으로 반영 (중복 생성 금지)
    * 이미 있으면 update
    * 없으면 insert
    * Δ=0 또는 빈 값이면 제거

### 7.3 자입 원석은 Shipments에서만 입력 (AP/영수증 원가와 분리)
* stone role별 source는 이미 화면에서 조회 가능(증거패널도 있음):
    * `orderLineDetailQuery.data?.center_stone_source/sub1/sub2`
* source가 **SELF(자입)**인 role에 대해서만 입력 UI 노출:
    * 자입 원가(총액) / 자입 마진(총액) → 합산해서 자입 판매가(총액) 자동 계산
* 저장 시 `SELF_STONE_SELL` item 생성:
    * label 예: `보조1(자입) 원석`
    * amount = `sell_total`
    * meta에 `cost_total_krw`, `margin_total_krw`, `role`, (가능하면 `stone_name`/`qty_used`) 저장
* source가 PROVIDED(타입)은 기본적으로 “자입 입력 UI 없음”(원가 0이므로)
    * 단, 운영상 타입에서도 추가 마진을 받고 싶으면 `VENDOR_DELTA`/`OTHER`로 처리 가능

## 8) Shipments 저장 검증 로직 수정 (음수 허용 범위 정확히)
* **대상 파일:** `web/src/app/(app)/shipments/page.tsx`
* 현재는 `extraLaborItems` validation에서 `< 0`이면 막고 있음.
* **요구 변경:**
    * `VENDOR_DELTA` 타입만 음수 허용
    * 그 외는 기존대로 `amount >= 0`
* 또한 `extraLaborPayload` 생성 시:
    * 기존 `{id,type,label,amount}` 유지
    * item에 `meta`가 있으면 `meta`도 같이 포함
    * `normalizeExtraLaborItems`도 `meta`를 보존(모르면 null로)

## 9) Evidence 패널(선택) 라벨 개선
* **대상 파일(선택):** `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx`
* `evidenceSectionLabel()`에 아래 케이스 추가하면 UX 좋아짐:
    * `VENDOR_DELTA` → “공장 차이(Δ)”
    * `CUSTOM_VARIATION` → “변형 조정”
    * `SELF_STONE_SELL` → “자입 원석”
    * (안 해도 동작은 함. 그냥 OTHER로 뭉칠 뿐)

## 10) “v4 receipt match confirm” 관련 주의 (이번 작업에서 건드리지 말 것)
* 현재 프론트 contracts는 `cms_fn_receipt_line_match_confirm_v3`를 바라봄:
    * `web/src/lib/contracts.ts` 에서 `receiptLineMatchConfirm: "cms_fn_receipt_line_match_confirm_v3"`
* 이번 작업 범위는 “변형/Δ/자입 분리입력”이므로 여기는 변경하지 말 것 (충돌 리스크 때문)
* v4로 전환은 별도 PR에서, 검증 끝나고 하자

## 11) 완료 기준(수동 테스트 체크리스트)
* [ ] Orders 입력에서 변형 체크 ON → memo가 `[변형] ...`로 저장됨
* [ ] Orders_main/Shipments_main 목록에서 변형 배지 보임
* [ ] Factory PO preview/fax에서 모델명에 `(변형)` 표기됨
* [ ] Shipments에서 해당 주문 선택 시 자동으로 변형 모드 ON됨
* [ ] 변형 모드 ON에서 `CUSTOM_VARIATION` 금액 없이 저장 시 경고/차단 동작
* [ ] 변형 아닌 주문에서 Δ 입력:
    * [ ] ERROR/POLICY 선택 가능
    * [ ] 음수 Δ 저장 가능
    * [ ] 저장 후 다시 열면 값이 유지됨
* [ ] 자입 role이 있는 주문에서:
    * [ ] 해당 role에만 자입 원가/마진 입력 UI 노출
    * [ ] 저장 후 다시 열면 meta 포함으로 복원됨
* [ ] 기존 extra labor(도금/기타/STONE_LABOR) 추가/삭제/저장 기능이 그대로 동작

---

### (이 기능이 적용되면 실제로 어떻게 되냐) 이해용 예시

**예시 A) “변형 아님 + 공장 오차”**
* 주문: 반지 A, 보조1/보조2 알이 사이즈 때문에 조금 달라져서 공장이 알공임을 10,000원 덜/더 받았음
* 출고화면:
    * 기존처럼 STONE_LABOR(알공임)는 영수증/매칭값 기반으로 들어가 있음(또는 수동 입력)
    * Δ 섹션에서
        * 사유: 공장 오차/실수(ERROR)
        * Δ: -10,000
    * 저장 → `extra_labor_items`에 `VENDOR_DELTA(-10000, meta.reason=ERROR)`가 남음
* ⇒ 나중에 “공장 실수 빈도/규모”가 데이터로 남고, 판매가도 깔끔하게 맞음

**예시 B) “변형 아님 + 단가 인상”**
* 공장이 최근 세팅 단가를 올렸음(정책 변화)
* 출고화면 Δ:
    * 사유: POLICY
    * Δ: +30,000
    * 저장
* ⇒ 나중에 정책 변화가 누적되면, 그 데이터를 보고 “마스터 단가/마진”을 업데이트할 근거가 됨

**예시 C) “변형 주문”**
* 주문 입력에서 변형 체크 ON → memo 앞에 `[변형]`
* Shipments에서 자동으로 변형 모드 ON
* 기존 마스터 추천은 참고만, 대신
    * `CUSTOM_VARIATION`에 예: +80,000 입력(변형 작업 난이도 반영)
    * 저장
* ⇒ 변형이 마스터 자동계산을 오염시키지 않고, 변형 마진이 명시적으로 남음