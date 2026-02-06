# [CODING AGENT PROMPT] Shipments 페이지 “보석/기타공임 계산 근거 패널” 추가 (레이아웃 깨짐/짤림 0, 출고정보입력 영역 변경 금지)

### 0) 절대 조건
* **Shipments 페이지 레이아웃이 절대 짤리면 안 됨.**
* **“출고 정보 입력” 카드(중앙 큰 입력 영역)는 UI/DOM 구조/필드 배치 포함해서 절대 수정하지 말 것.** (해당 컴포넌트 내부 코드도 건드리지 말 것)
* 새 UI는 기존 남는 영역만 사용해서 추가:
    * 좌측 “선택된 주문/매칭정보” 패널 하단
    * 또는 우측 상단 “마스터 정보” 카드 하단(여백 영역)
    * 또는 “기타공임 내역” 라인 아래 (단, 입력 필드/버튼 밀지 말 것)
* 새 UI는 접기/펼치기(Accordion/Details) 기본으로, 펼쳐도 레이아웃이 밀리지 않게:
    * 내부는 max-height + overflow:auto로 자체 스크롤 만들기
    * 모바일/작은 해상도에서도 가로 스크롤/짤림 금지 → 표는 overflow-x:auto 컨테이너 안에 넣고, 기본은 카드형 요약이 먼저 보이게.

### 1) 추가할 UI: “계산 근거(보석/기타공임) 패널” (신규 컴포넌트)
* **컴포넌트명 예시:** `ShipmentPricingEvidencePanel.tsx`
* **렌더 위치:** 출고정보입력 카드 바깥의 남는 영역(좌측 패널 하단이 1순위)

**(A) 요약(항상 보임, 한 줄/두 줄로 압축)**
* 기타공임 판매가(Extra Sell): `{extra_labor_sell_krw}`
* 기타공임 원가(Extra Cost): `{extra_labor_cost_krw}`
    * 공식: `factory_other_cost_base` + `stone_cost_included_self`
* 기타공임 마진(Extra Margin): `{extra_sell - extra_cost}`
* 요약 영역은 한 줄에 다 넣지 말고, 2줄 카드 형태로 해서 레이아웃 절대 안 깨지게.

**(B) 상세(Accordion 펼치면 보임)**
* **보석 역할별 테이블(중심/보조1/보조2)**
    * 컬럼(최소):
        * 역할(센터/보조1/보조2)
        * 자입/타입 (SELF/PROVIDED)
        * qty (출처 배지: receipt/order/master)
        * unit_cost (출처 배지: receipt)
        * 원가 포함액 (SELF만 qty×unit_cost, 타입은 0 + “단가 무시” 배지)
        * 마진/개 (master sell-cost)
        * 마진합 (qty×마진/개)
        * qty×(unit_cost+마진) (가독성용)
    * 표는 overflow-x:auto 안에 넣고, 모바일은 카드 리스트로 degrade.
* **extra_labor_items 리스트(그대로 표시)**
    * DB가 넣어준 `shipment_line.extra_labor_items`를 그대로 render
    * 각 항목: label + amount
    * meta 있으면 “펼치기”로 qty/unit_margin/supply/unit_cost 표시
* **경고 배지**
    * SELF인데 unit_cost=0 → “자입 단가 0”
    * PROVIDED인데 unit_cost 입력됨 → “타입이라 단가 무시”
    * receipt qty vs order qty 불일치 → “수량 불일치”
    * 경고는 요약 영역 오른쪽에 작은 badge로도 표시

### 2) 데이터 소스 / 계산 규칙 (프론트에서 “재계산” 하지 말 것)
* 프론트는 DB에서 이미 계산된 값을 “표시”만 한다.
* **사용 가능한 소스:**
    * `shipment_line`의 금액 필드(현재 페이지가 쓰는 값)
    * `shipment_line.extra_labor_items` (breakdown)
    * (가능하면) 주문 라인에서 `stone_source` / `stone_qty`
    * (가능하면) receipt line json에서 `stone qty`/`unit_cost`
* 단, 표에 필요한 값이 다 없으면:
    * “값 없음”으로 표시하고, 출처/경고만 정확히 표시
    * 절대 임의 추정으로 재계산하지 말 것(정합성 사고 위험)

### 3) 레이아웃 구현 지침(짤림 방지)
* **신규 패널은:**
    * `min-width: 0;`
    * 내부 테이블 컨테이너 `overflow-x:auto;`
    * 상세 영역 `max-height: 320px; overflow:auto;`
* **페이지 전체 그리드/플렉스에 영향 주지 않게:**
    * 기존 wrapper className 유지
    * 새 컴포넌트는 기존 섹션 하단에 “추가”만
* **출고정보입력 카드 높이가 늘어나지 않도록:**
    * 패널은 좌측 컬럼(또는 상단 마스터정보 아래) 에 배치
    * 중앙 입력영역 아래에 붙이면 절대 안 됨(스크롤/짤림 위험)

### 4) 구현 파일 포인트(예시)
* `web/src/app/(app)/shipments/[id]/page.tsx` (또는 현재 shipments 라우트)
    * 레이아웃을 유지한 채, 좌측 패널 렌더 아래에 `<ShipmentPricingEvidencePanel .../>`만 추가
* `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx` 신규
* **타입:**
```typescript
StoneSource = "SELF" | "PROVIDED"
ExtraLaborItem = { id?: string; type?: string; label: string; amount: number; meta?: any }
```

### 5) 스모크 테스트 체크리스트(필수)
* [ ] 화면 가로 1280/1440에서 레이아웃 밀림/짤림 없음
* [ ] 창 너비 좁혀도(예: 1024) 테이블은 가로 스크롤로 처리되고 전체 페이지는 깨지지 않음
* [ ] 출고정보입력 카드의 입력 필드/버튼 위치가 전혀 변하지 않음
* [ ] Accordion 닫힌 상태에서 화면이 기존과 거의 동일
* [ ] Accordion 펼쳐도 다른 카드들이 밀리지 않고 내부만 스크롤됨

### 6) 완료 기준(DoD)
* “계산 근거 패널”이 shipments 페이지에 추가됨
* 레이아웃/출고정보입력 영역 회귀 0
* 보석/기타공임이 “왜 이 금액인지” 요약+상세로 확인 가능
* 경고 배지로 데이터 이상을 즉시 확인 가능