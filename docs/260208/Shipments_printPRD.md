# [CODING AGENT PROMPT] Shipments Print(영수증) 반품(-) 표기 + 미수요약 반영 + 인쇄 레이아웃 고정 (NO DB MIGRATION)

## 0) 절대 조건
- **DB migration / db push 절대 금지** (프론트엔드만 수정)
- 기존 출고/미수 계산 로직은 건드리지 말고, **표시(프린트/요약) 누락만 보완**
- 인쇄 버튼 클릭 시 **레이아웃이 위로 딸려 올라가거나 깨지지 않게** “현재 화면에서 보이는 고정 레이아웃” 그대로 인쇄되게 할 것
- Next.js App Router(클라이언트 컴포넌트) 패턴 유지, 기존 컴포넌트/훅 규칙 준수

## 1) 현재 문제 요약(재현)
- 영수증(Shipments Print)에서 **반품이 ‘오늘 처리된 반품(occurred_at=today)’임에도**:
  - 영수증 내역 표에 **- 반품 라인이 안 보이거나**
  - 미수 요약(요약행)에서 **반품이 반영되지 않고(당일 미수/증감이 0처럼 보임)** 혼란 발생
- 또한 최근 수정 과정에서 다음 런타임 에러가 발생:
  - `Cannot read properties of undefined (reading 'unconfirm_v1')`
  - 원인: `CONTRACTS.shipments.unconfirm_v1` 같은 **잘못된 계약 경로 사용**
- 인쇄 버튼 클릭 시:
  - 레이아웃이 위로 “딸려 올라가거나”, 카드/그리드 높이가 변하면서 **출력물이 깨짐**
  - 요구: 현재처럼 **고정된 프린트 시트(좌/우 2분할) 레이아웃이 인쇄에서도 그대로 유지**

## 2) 목표(원하는 동작)
### A. 반품 라인 표기 규칙
- **오늘 처리된 반품(occurred_at = today in KST)** 은,
  - 출고가 과거(예: 지난주 출고건)라도 **오늘 영수증에 포함**
  - 영수증 내역 표에서 **모델명 앞에 `-`로 표기** + “반품” 배지/색상 등으로 구분
  - 금/은/공임/총액도 **음수로 표시** (예: -₩78,608 / -1.11g 등)

### B. 미수 요약 반영 규칙
- 요약에는 최소 아래 5줄이 있으면 좋음:
  - 합계(현재 총 미수)
  - 이전 미수(= 합계 - 당일 순증감)
  - 당일 출고(+)
  - 당일 반품(-)
  - 당일 순증감(= 당일 출고 + 당일 반품)
- 반품이 존재하면 “당일 반품” 행이 **반드시 보이고** 값이 음수로 찍혀야 함.
- 요약행 **위에** 추가 정보 표기:
  - `환산 중량(합계): 순금 xxg · 순은 xxg`
  - `적용 시세: 순금시세 xxx/g · 순은시세 xxx/g`
  - 여기의 “적용 시세”는 **실제로 라인에 저장된 tick** 기준으로 표시(오늘 출고/반품 라인에서 추출)

### C. 인쇄 레이아웃 고정
- 인쇄 버튼 클릭 시 **화면에서 보이는 프린트 시트가 그대로 인쇄**
- 인쇄에서:
  - 페이지 크기: **A4 가로(landscape)**, 좌/우 동일 내용 2분할 유지
  - 상단 UI(필터, 리스트, 버튼 등)는 숨기고 **프린트 시트만 출력**
  - 시트 높이/폭이 인쇄 매체에서 변하지 않도록 **mm 기반 고정 크기** 또는 `@page`/`@media print`로 강제
  - “4행 고정된 것처럼” (즉, 상단/본문/요약의 상대 위치가) **인쇄 때도 동일**해야 함

## 3) 구현 범위(파일/컴포넌트)
- 주 작업 파일:
  - `web/src/app/(app)/shipments_print/page.tsx`
- 출력 컴포넌트:
  - `web/src/components/receipt/receipt-print.tsx` (ReceiptPrintHalf)

## 4) 구현 상세 지시

### 4-1) 반품 데이터 가져오기(프론트에서)
- `cms_return_line`을 조회하되, **occurred_at이 “오늘(KST)” 범위**인 것만 포함
  - KST 기준 `todayStartIso`, `todayEndIso` 사용
- 조인(가능한 만큼)으로 출고 라인/거래처 정보를 가져와서 “어느 거래처 영수증에 찍을지” 결정:
  - `cms_return_line -> cms_shipment_line -> cms_shipment_header -> cms_party`
- **핵심 조건**
  - “오늘 처리된 반품이면 과거 출고건이라도 오늘 영수증에 -로 표시”
  - 즉, shipment_header.ship_date/confirmed_at은 과거여도 OK. 판단은 `cms_return_line.occurred_at`만.

### 4-2) 영수증 내역 라인 생성 규칙
- 출고 라인(+)은 기존 로직 유지
- 반품 라인(-)은 다음처럼 만들어서 출력 lines 배열에 합치기:
  - `return_qty`만큼 반품된 경우:
    - 기존 출고 프린트가 “qty만큼 라인 분해”를 한다면,
      - 반품은 `return_qty`를 반영해 **한 줄로 합산**해서 표시(권장)
      - `net_weight_g`, `labor_total_sell_krw`, `total_amount_sell_krw`를 `return_qty`로 곱한 뒤 **음수로**
    - `final_return_amount_krw`가 있으면 총액은 그 값을 우선 사용(보정값)
  - 모델명 앞에는 `-` 프리픽스 + “반품” 배지 등으로 시각 구분
- 정렬:
  - 기본은 “당일 출고 라인들 먼저, 오늘 처리된 반품 라인들은 뒤쪽”으로 붙여도 OK
  - (중요) 반품이 누락되지 않는 것이 우선

### 4-3) 미수요약 계산(당일 출고/반품/순증감)
- 요약 계산은 **라인 기반**으로 계산(출고는 +, 반품은 -)
- 단가제(`is_unit_pricing`)는 기존 정책 유지:
  - 단가제는 중량/공임을 분리하지 않고 “총액”만 사용 (중량/공임은 0 처리)
- 금/은 환산 중량 규칙:
  - 14K: gold_g = net_weight_g * 0.6435
  - 18K: gold_g = net_weight_g * 0.825
  - 24K: gold_g = net_weight_g * 1
  - 925: silver_g = net_weight_g * 0.925
  - 999: silver_g = net_weight_g * 1
  - 반품 라인은 net_weight_g가 음수이므로 환산 중량도 음수로 내려가야 정상
- 요약 5행:
  - 합계: AR 포지션(기존 조회값) 그대로 사용
  - 당일 출고: (출고 라인만 합산)
  - 당일 반품: (반품 라인만 합산, 음수)
  - 당일 순증감: 출고+반품
  - 이전 미수: 합계 - 당일 순증감
- 요약행 위 추가 표기:
  - 적용 시세: 라인들에서 gold_tick_krw_per_g / silver_tick_krw_per_g 값들을 모아 표시
    - 같은 날 여러 tick이 섞이면 min~max 범위로 보여도 OK
  - 환산 중량(합계): “합계 행의 gold/silver”를 사용

### 4-4) 런타임 에러(Contracts/RPC) 수정 — 매우 중요
- 현재 에러:
  - `CONTRACTS.shipments.unconfirm_v1` 같은 경로를 쓰면 깨짐
- 이 프로젝트의 contracts 구조는:
  - `CONTRACTS.functions.*` 아래에 RPC 이름들이 있음
- 따라서 출고 초기화(RPC) 호출은:
  - `useRpcMutation({ fn: CONTRACTS.functions.shipmentUnconfirm, ... })`
  - 처럼 **정확한 키로** 연결할 것
- 또한 `useRpcMutation` 훅 시그니처는 (contract, client) 형태가 아니라:
  - `useRpcMutation({ fn, successMessage, onSuccess })` 형태임.
- 즉, 기존에 잘못 붙여넣은 `useRpcMutation(CONTRACTS..., schemaClient)` 패턴은 전부 제거하고,
  - 프로젝트 훅 정의에 맞게 정리해라.

### 4-5) 인쇄 레이아웃 “고정 출력” 처리(@media print)
- 요구: 인쇄 시 레이아웃이 위로 딸려 올라가거나 깨지지 않게 “프린트 시트”만 안정적으로 출력
- 구현 지침:
  1) 프린트 영역 래퍼에 클래스 지정(예: `print-sheet`, `print-only`, `no-print`)
  2) `@media print`에서:
     - `.no-print { display:none !important; }` 로 UI 숨김
     - `.print-only { display:block !important; }` 로 시트만 출력
     - `@page { size: A4 landscape; margin: 0; }`
     - 시트 크기를 **mm 단위로 고정**:
       - width: 297mm, height: 210mm
       - padding도 mm로 (예: 10mm)
     - 2분할은 각 half가 동일 폭이 되도록 고정(예: grid 2 cols + gap mm)
     - 페이지 넘김 방지:
       - 시트 컨테이너에 `break-inside: avoid; page-break-inside: avoid;`
       - 여러 거래처를 인쇄할 때는 거래처마다 `page-break-after: always;`
  3) 화면(preview)에서도 동일한 레이아웃을 유지하되,
     - 인쇄 전용 CSS가 화면 레이아웃을 망치지 않도록 `print:` 변형 또는 `@media print`로만 적용

## 5) 검증 시나리오(반드시 통과)
1) “오늘 반품 처리(occurred_at=today)”가 있고, 원 출고는 과거인 케이스
   - 오늘 영수증에 해당 거래처 라인으로 `- 모델명` + 반품 배지가 보인다
   - 금/은/공임/총액이 음수로 표시된다
2) 반품이 있는 날
   - 미수 요약에 “당일 반품” 행이 존재하고 값이 음수로 보인다
   - 당일 순증감 = 당일 출고 + 당일 반품으로 일치한다
3) 인쇄 버튼 클릭
   - 상단 UI/리스트는 출력되지 않는다(프린트 시트만 출력)
   - A4 가로 2분할(좌/우 동일 내용) 유지
   - 레이아웃이 위로 딸려 올라가지 않고(간격/높이 유지), 표/요약이 같은 위치에 나온다
4) 출고 초기화 버튼/모달
   - 런타임 에러 없이 동작(contracts 키/훅 시그니처 준수)

## 6) 제출물
- 수정된 파일 목록과 변경 요약
- (가능하면) 반품/요약/인쇄 CSS 관련 diff를 깔끔히 정리해서 제시
