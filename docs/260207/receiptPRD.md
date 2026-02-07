# [CODING AGENT PROMPT] 영수증 라인 워크벤치 “알수 배분 + 공장원가 vs 추천가 비교 + v4 옵션 연결” (프론트엔드만)

## 0) 절대 준수(비기능 요구사항)
* **프론트엔드만 수정** (DB migration/SQL/RPC 수정 금지)
* **기존 페이지/기능/UI 동작 절대 깨지지 않게:** 변경 범위는 `new_receipt_line_workbench` 중심으로 최소화
* **기본 호출 RPC는 v3 유지**(현재 운영 깨지면 안 됨).
    * 단, 환경변수로 v4를 “옵션”으로 전환 가능하게만 만들 것.
* **타입/빌드 에러 0, 런타임 에러 0**

## 1) 현재 코드 베이스 확인(경로)
* **워크벤치:** `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
* **RPC contracts:** `web/src/lib/contracts.ts`
* **모델명 suggest API(서비스 롤):** `web/src/app/api/new-receipt-workbench/model-name-suggest/route.ts`
* **현재 프론트는 매칭확정 RPC를 이렇게 씀:**
    * `CONTRACTS.functions.receiptLineMatchConfirm = "cms_fn_receipt_line_match_confirm_v3"`
    * `handleConfirm()`에서 `receiptLineMatchConfirm` 호출

## 2) 목표 UX/업무 플로우(현실 반영)
공장은 영수증에 “중/보(=알공임/세팅 총공임)”처럼 합산 값만 주고, 중심/보조1/보조2 개수도 안 주는 경우가 많다.

그래서 프론트에서 다음을 빠르게 입력/보정할 수 있어야 한다:

### (A) 알수 입력 방식
* 사용자는 보통 영수증 보고 “총 알수(total)”만 먼저 앎
* 그 다음:
    * “메인(center) 개수”만 알면 입력
    * 나머지(보조1/sub1, 보조2/sub2)는 자동 배분
* 배분 기준은 “해당 주문/마스터의 기본 비율(기성 패턴)”을 최대한 활용하되, 극한 예외는 사용자가 직접 override 하면 됨

### (B) 제품 1개에서 공급이 역할별로 섞일 수 있음(중요)
* 예: 메인=FACTORY, 보조1=SELF(자입), 보조2=PROVIDED(타입/외부스톤)
* → 프론트는 “역할별 stone source”를 보여주고, SELF인 역할만 unit cost 입력 누락을 강하게 경고해야 함.

### (C) 공장원가 vs 우리 추천가 비교(검증)
* **공장 영수증에 찍힌:**
    * 기본공임(= labor_basic_cost_krw)
    * 중/보(= 사실상 세팅/알공임 총액, 현재 labor_other_cost_krw로 입력 중)
* **사용자가 입력한:**
    * 총 알수/배분된 알수(= stone_*_qty)
    * 자입(SELF)인 역할의 stone unit cost(= stone_*_unit_cost_krw)
* 그리고 **“마스터의 개당 마진(diff)”**를 이용해 **추천 판매가**(= 매칭확정 시 shipment line에 들어갈 값) 를 프론트에서 미리 계산해 보여주기
* **주의:** 현재 v4 RPC 안에서도 같은 계산을 하고 있지만, **프론트에서 “미리보기”**를 보여주는 게 목적이라, 백엔드 변경 없이 프론트에서 동일 공식으로 재현한다.

## 3) 구현 1: v4 연결은 “옵션”으로만 추가(기본 v3 유지)
* **수정:** `web/src/lib/contracts.ts`
* **현재:**
```typescript
receiptLineMatchConfirm: "cms_fn_receipt_line_match_confirm_v3",
```
* **변경(기본 v3, env 있으면 v4):**
```typescript
receiptLineMatchConfirm:
  process.env.NEXT_PUBLIC_CMS_FN_RECEIPT_LINE_MATCH_CONFIRM ||
  "cms_fn_receipt_line_match_confirm_v3",
```
* 운영에서 v4 쓰려면 배포 환경에: `NEXT_PUBLIC_CMS_FN_RECEIPT_LINE_MATCH_CONFIRM=cms_fn_receipt_line_match_confirm_v4`
* env 없으면 무조건 v3 → 기존 기능 충돌 0
* ✅ 이 변경 외에 `handleConfirm()` payload는 그대로 둔다. (시그니처 동일)

## 4) 구현 2: “총 알수 + 메인 입력 → 자동배분” UI 추가 (매칭 패널 중심)
* **왜 매칭 패널인가?**
    * 배분 기준(기성 비율)을 가장 정확히 얻는 곳이 선택된 후보 주문(`selectedCandidate`) 이고,
    * 후보 주문에는 `center_stone_qty`/`sub1_stone_qty`/`sub2_stone_qty`가 이미 있다(비율 기준으로 사용 가능)
* **추가할 UI 위치**
    * `receipt-line-workbench.tsx`의 매칭 패널(선택된 미매칭 라인 + 후보 주문 보여주는 영역)에
    * 총 알수(total) input
    * 메인(center) input
    * 버튼: `[자동배분 적용]`
    * 표시: 결과: center / sub1 / sub2 + 합계 검증
* **동작 규칙(정수 배분)**
    * **입력:**
        * `totalCount` (필수, 0 이상 정수)
        * `centerCount` (선택, 0 이상 정수)
    * **비율 기준:**
        * `dC = selectedCandidate.center_stone_qty ?? 0`
        * `d1 = selectedCandidate.sub1_stone_qty ?? 0`
        * `d2 = selectedCandidate.sub2_stone_qty ?? 0`
    * **로직:**
        * `center = (centerCount가 입력되면 그 값) else (dC > 0 ? min(dC,total) : 0)`
        * `remaining = max(0, total - center)`
        * **sub1/sub2 배분:**
            * if `(d1+d2) == 0` → `sub1=remaining`, `sub2=0`
            * else
                * `sub1 = round(remaining * d1/(d1+d2))`
                * `sub2 = remaining - sub1`
        * `center`/`sub1`/`sub2`는 모두 0 이상 정수
* **적용 버튼을 누르면:**
    * 현재 선택된 `selectedUnlinked.receipt_line_uuid`에 해당하는 `lineItems` 엔트리를 찾아서 `stone_center_qty`, `stone_sub1_qty`, `stone_sub2_qty`를 문자열로 업데이트
* **“저장/매칭확정” 충돌 방지(중요)**
    * 배분 적용 후 바로 매칭확정 누르는 경우가 많으니, `handleConfirm()`에서 다음을 추가:
    * 만약 `lineItemsDirty === true`이면:
        * 먼저 `saveLines()`(= upsertSnapshot) 자동 실행
        * 성공 후 `matchConfirm.mutateAsync()` 진행
    * 헤더 저장이 필요하면 기존 로직대로 막기

## 5) 구현 3: 역할별 stone source 표시 + SELF인 경우 unit cost 경고
이미 `selectedOrderStoneSourceQuery`가 있으니 그 데이터로 표시한다.

* **표시(UI)**
    * “메인/보조1/보조2 공급”을 뱃지로 표기: `FACTORY` / `SELF(자입)` / `PROVIDED(타입/외부스톤)`
    * 혼재면(서로 다르면) 경고 뱃지 표시
* **검증(매칭확정 직전)**
    * 선택된 라인의 stone qty가 0보다 큰 역할이 SELF인데, 해당 `stone_*_unit_cost_krw`가 0이면:
        * hard block은 하지 말고(업무 예외 대비), 확정 버튼 옆에 경고 + `confirmNote`에 자동 텍스트 추가 또는 토스트 경고를 띄운다.

## 6) 구현 4: “공장원가 vs 추천가” 프리뷰 카드(매칭 패널)
백엔드 수정 없이 프론트에서 계산한다.

* **필요한 값 소스**
    * **공장 원가 입력(영수증 라인 저장값):** `lineItems`에서 해당 라인 찾기
        * `labor_basic_cost_krw` (기본공임)
        * `labor_other_cost_krw` (중/보 = 세팅/알공임 총액으로 운영; 라벨만 명확히)
        * `stone_*_qty`, `stone_*_unit_cost_krw`
    * **주문(역할별 source + qty 기본비율):** `selectedCandidate`, `selectedOrderStoneSourceQuery`
    * **마스터(개당 마진 diff):** 서비스 롤 API로 조회(프론트만 추가)
        * 신규 API route 만들기: `web/src/app/api/new-receipt-workbench/master-pricing/route.ts`
        * 입력: `{ item_id }` 또는 query param
        * supabase service key로 `cms_master_item`에서 아래 필드 select:
            * `labor_base_sell`, `labor_base_cost`
            * `labor_center_sell`, `labor_center_cost`
            * `labor_sub1_sell`, `labor_sub1_cost`
            * `labor_sub2_sell`, `labor_sub2_cost`
            * `labor_bead_sell`, `labor_bead_cost`
            * `setting_addon_margin_krw_per_piece`
            * `stone_addon_margin_krw_per_piece`
            * (가능하면 `weight_default_g`, `deduction_weight_default_g`도 같이)
* **계산은 v4 로직과 최대한 동일하게:**
    * `base_diff = labor_base_sell - labor_base_cost`
    * `base_sell = basic_cost + base_diff`
    * `self_stone_cost_total = Σ( role가 SELF인 경우 qty_total * unit_cost )`
    * `extra_cost_total = setting_fee_cost_total(= labor_other_cost_krw) + self_stone_cost_total`
    * `stone_margin_total = Σ(qty_total * (labor_role_sell - labor_role_cost))`
    * `bead_margin_total = (labor_bead_sell - labor_bead_cost) * qty`
    * `addon_margin_total = (setting_addon_margin + stone_addon_margin) * qty`
    * `extra_sell = extra_cost_total + (stone_margin_total + bead_margin_total + addon_margin_total)`
* **프리뷰 카드에 표시:**
    * 공장원가(기본+중/보 + 자입원석원가(SELF))
    * 추천가(기본 sell + extra sell)
    * 차이(추천-원가)
    * 경고(SELF unit cost 0, 혼재 공급, 중량 허용범위 초과 등)
* 이 프리뷰는 “설명/검증용”이고, 실제 확정 시에는 (v3면 v3, v4면 v4) RPC가 최종 값을 만든다.
* 프리뷰 카드에 “(v4 기준 프리뷰)” 같은 라벨을 작게 달아 혼선을 방지.

## 7) 라벨/용어 정리(혼선 제거)
현재 입력 UI에서 사용자 혼란이 큰 부분만 “문구”를 바꾼다(기능 변경 없음).

* `labor_other_cost_krw` 라벨: **“중/보(세팅/알공임 총액)”** 으로 표기(기존 “기타공임” 같은 애매한 표현 제거)
* `calcStoneFactoryCost()`로 보여주던 readOnly 값 라벨: **“자입 원석원가(SELF)”** 또는 **“자입원석 합계(개수×단가)”** 로 표기 (공장 중/보와 이름이 겹치지 않게)

## 8) QA 체크리스트(필수)
* [ ] **env 미설정 상태에서:** 기존과 동일하게 v3로 매칭확정 OK
* [ ] **env를 v4로 설정하면:** v4로 매칭확정 OK (payload 동일)
* [ ] **“총 알수/메인 입력 → 자동배분 적용” 후:**
    * lineItems state의 `stone_*_qty`가 바뀌고
    * 매칭확정 누르면 자동으로 라인 저장 후 확정까지 진행(헤더 저장 필요 시는 기존대로 막힘)
* [ ] **혼재 공급**(메인/보조별 source 다름)인 주문에서 UI 경고 표시
* [ ] **SELF인데 unit cost 0이면** 경고 표시(확정은 가능)
* [ ] 어떤 경우에도 다른 페이지(orders/shipments/repairs)에 영향 없음

## 9) 구현 범위 요약(수정 파일)
* **수정:**
    * `web/src/lib/contracts.ts` (env로 match confirm 함수명 오버라이드)
    * `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
* **추가(프론트 API):**
    * `web/src/app/api/new-receipt-workbench/master-pricing/route.ts`
