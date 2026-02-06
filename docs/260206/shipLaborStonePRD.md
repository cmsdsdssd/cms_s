# [CODING AGENT PROMPT] Shipments 페이지 “매칭정보 입력” 제거 → “계산근거(기본공임 + 보석/기타공임)” 패널로 대체 (레이아웃/출고정보입력 무변경)

### 0) 절대 조건 (Regression 0)
* Shipments 페이지 레이아웃이 절대 짤리면 안 됨
* 중앙 “출고 정보 입력” 카드(입력 필드/버튼 포함) DOM/레이아웃/로직 절대 변경 금지
* 변경 범위는 좌측 패널 내 “매칭정보 입력” 섹션만:
    * 해당 섹션을 완전히 제거하거나 숨기고
    * **동일 위치에 “계산근거 패널”**로 대체한다
* 새 패널은 기본 닫힘(Accordion) + 펼쳐도 레이아웃이 밀리지 않게:
    * 상세 영역은 max-height + overflow:auto로 자체 스크롤
    * 표는 overflow-x:auto 컨테이너 내부에 렌더링

### 1) 목표: “기본공임”과 “보석/기타공임”이 왜 그 금액인지 한눈에
현재 화면은 숫자만 보여서 분석 불가. 아래 근거를 계산식 그대로 보여줘야 한다.

### 2) 새 컴포넌트: ShipmentPricingEvidencePanel
* 렌더 위치: 좌측 패널의 기존 “매칭정보 입력” 자리에 삽입
* 이름: “계산 근거”
* **(A) 요약(항상 표시, 2줄)**
    * 기본공임 판매가: {base_labor_sell_krw}
    * 기본공임 원가: {factory_basic_cost_krw}
    * 기본공임 마진: {base_labor_sell_krw - factory_basic_cost_krw}
    * 기타공임 판매가: {extra_labor_sell_krw}
    * 기타공임 원가: {extra_labor_cost_krw} (= 공장 other_cost_base + 자입석원가)
    * 기타공임 마진: {extra_labor_sell_krw - extra_labor_cost_krw}
* 요약은 “값 + 간단한 식” 형태로 표시:
    * 예) 120,000 = 100,000(공장기본) + 20,000(기본마진)

### 3) 기본공임 계산근거(Accordion 섹션 1)
* **표시해야 할 항목**
    * 공장 기본공임 원가(Factory Basic Cost)
        * 소스: receipt/match에서 저장된 기본공임 원가 (selected_factory_labor_basic_cost_krw 등)
        * 화면 라벨: 공장 기본공임(원가)
    * 마스터 기본공임 마진(Base Diff)
        * 소스: master labor_base_sell - labor_base_cost
        * 화면 라벨: 마스터 기본공임 마진
    * 기본공임 판매가(Base Sell)
        * 공식: 기본공임 판매가 = 공장 기본공임(원가) + 마스터 기본공임 마진
        * 화면 라벨: 기본공임 판매가
* **추가(권장) “출처 배지”**
    * 각 행에 배지로 출처 표시: [영수증/매칭] [마스터] [오버라이드]
* **경고(선택)**
    * 공장 기본공임이 0인데 sell이 잡혀있으면 “기본공임 원가 0” 경고 배지

### 4) 보석/기타공임 계산근거(Accordion 섹션 2)
* **(A) 기타공임 원가 구성**
    * 공장 기타공임 원가(other_cost_base)
    * 자입석 원가 포함액(SELF만) = Σ qty × unit_cost (SELF만)
    * 기타공임 원가 합계 = other_cost_base + 자입석원가
* **(B) 보석 마진 구성(마스터 기반)**
    * 중심/보조1/보조2 각각:
        * 마진/개 = master (labor_role_sell - labor_role_cost)
        * 마진합 = qty × 마진/개
* **(C) 기타공임 판매가**
    * 공식: 기타공임 판매가 = 기타공임 원가 + (중심+보조1+보조2 마진합) + bead/기타마진(있으면)
* **(D) 보석 역할별 테이블(필수)**
    * 표는 아래 컬럼으로 렌더(테이블은 overflow-x:auto):
        1. 역할 (CENTER/SUB1/SUB2)
        2. 자입/타입(SELF/PROVIDED)
        3. qty (+ 출처 배지: receipt/order)
        4. unit_cost (receipt)
        5. 원가 포함액 (SELF만 qty × unit_cost, PROVIDED는 0 + “단가 무시” 배지)
        6. 마진/개 (master)
        7. 마진합 (qty × 마진/개)
        8. qty × (unit_cost + 마진) (참고값)
* **(E) extra_labor_items 그대로 표시**
    * shipment_line.extra_labor_items 배열을 리스트로 출력:
        * label / amount
        * meta가 있으면 펼쳐보기( qty, unit_margin, supply, unit_cost 등 )
    * 이 리스트는 “UI가 표시하는 공식 근거”로 쓰이므로 반드시 안정적으로 렌더
* **(F) 경고 배지(필수)**
    * SELF인데 unit_cost=0 → “자입 단가 0”
    * PROVIDED인데 unit_cost 존재 → “타입이라 단가 무시”
    * receipt qty vs order qty 불일치(둘 다 있을 때) → “수량 불일치”

### 5) 데이터 소스 규칙(프론트 재계산 금지)
* 금액은 DB가 계산한 값(shipment_line에 저장된 값)을 우선 표시
* 근거 표시용으로만 아래 데이터 사용:
    * master labor 값
    * order stone source/qty
    * receipt line json stone qty/unit_cost
    * extra_labor_items meta
* 값이 없으면 — 처리 + “출처 없음” 배지 표시
* 절대 프론트에서 임의 추정으로 재계산하지 말 것

### 6) 레이아웃/UX 가이드(짤림 방지)
* 패널 폭은 좌측 패널 폭에 맞추고 min-width:0
* 섹션 펼쳐도 좌측 패널 내부만 스크롤:
    * 상세 컨테이너 max-height: 320px; overflow:auto
    * 테이블은 overflow-x:auto
* 기본 상태(접힘)에서는 기존 화면과 거의 동일한 높이 유지

### 7) 구현 파일 힌트
* shipments page 레이아웃 파일에서 좌측 패널의 “매칭정보 입력” 섹션 컴포넌트 위치를 찾고:
    * 그 섹션을 제거/숨김
    * 동일 위치에 `<ShipmentPricingEvidencePanel shipmentId={...} />` 삽입
* 신규 컴포넌트 파일: `web/src/components/shipments/ShipmentPricingEvidencePanel.tsx`

### 8) 스모크 테스트 체크리스트(필수)
* [ ] “매칭정보 입력” 섹션이 사라지고 “계산근거” 패널이 같은 위치에 나타남
* [ ] 중앙 출고정보입력 카드의 입력/버튼 위치가 1px도 안 바뀜
* [ ] 기본공임: sell = factory_basic_cost + base_diff가 화면에 보임
* [ ] 기타공임: sell = other_cost_base + self_stone_cost + stone_margin_total + bead_diff가 화면에 보임
* [ ] SELF/PROVIDED 케이스에서 원가 포함액이 0/비0로 정확히 갈림
* [ ] 화면 너비 줄여도(1024) 짤림 없이 테이블만 가로 스크롤

### 추가 요구(중요)
* **“출고정보입력”에 있는 숫자와 “계산근거 요약 숫자”가 불일치하면 안 됨.**
    * 불일치 시 빨간 배지 “표시값 불일치(데이터 확인)” 띄우고 디버그 정보(meta) 출력.