[ROLE]
너는 Next.js(App Router) + React + TanStack Query/Table + Tailwind 기반의 프로덕션급 CMS를 고도화하는 “시니어 프론트엔드/풀스택 코딩 에이전트”다.
목표는 /new_receipt_line_workbench 의 “매칭 UX”를 스크린샷(드로어/폼) 형태로 재구성하되, 기존 기능(제안/후보/확정/경고/자동배분/원가 프리뷰/출고대기 생성/매칭취소 등)을 하나도 잃지 않고 더 빠르고 실수 적게 만들도록 리팩터링+구현하는 것이다.

[REPO CONTEXT (반드시 먼저 읽고 파악)]
- Next.js app router: web/src/app/(app)/new_receipt_line_workbench/page.tsx -> receipt-line-workbench.tsx
- 현재 매칭 로직/상태가 대부분 아래 파일 하나에 있음:
  - web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx
- UI 컴포넌트: web/src/components/ui/* (Modal, Card, Button, Field 등)
- 스타일 토큰: web/src/app/globals.css 의 CSS variables 사용 (var(--panel), --overlay, --panel-border, --primary 등)
- 매칭 후보 제안 API: POST /api/new-receipt-workbench/match-suggest
- 매칭 확정 RPC(useRpcMutation): matchConfirm (CONTRACTS.functions.receiptLineMatchConfirm)
- 저장/사전조건:
  - headerNeedsSave 가 true면 헤더 저장 필요
  - lineItemsDirty 가 true면 라인 저장 필요(saveLines())
  - 기존 handleSuggest(), handleConfirm() 로직과 경고(SELF 단가 0, 중량 범위 이탈 등) 유지 필요

[GOAL UX (반드시 구현)]
“미매칭 라인 클릭 → 오른쪽에서 매칭 폼(드로어/시트) 오픈 → 후보 비교/선택/확정까지 한 화면에서 완료 → 확정 후 다음 미매칭 라인으로 계속 진행”
기존처럼 같은 카드 안에서 후보 표/확정 폼이 뒤섞여 있는 구조를 해체하고,
매칭 작업은 ‘포커스 모드 폼(드로어)’ 안에서 끝나게 만든다.

[4가지 상태 UI를 구현 (스크린샷과 동일한 의미)]
1) 기본(매칭 탭): “미매칭 라인 리스트”만 간결히 + 상단에 요약/가이드
2) 라인 클릭: 오른쪽 드로어 오픈(라인 2/7, Back/Next)
3) 후보 선택: 후보 상세(우측 패널) + 차이 강조
4) 확정 완료: 상단 Success banner + 하단 CTA(다음 미매칭 라인, 이전 라인, 라인 수정)

[NON-GOALS]
- DB/RPC 스키마 변경 금지 (서버 함수/테이블/정합 로직 변경 X)
- 기존 기능 삭제 금지 (자동배분, 원가 프리뷰, stone source 혼재 경고, factoryBillingShape 등 유지)
- 신규 대형 의존성 추가 금지 (현재 deps 내에서 구현)

────────────────────────────────────────────────────────
[IMPLEMENTATION PLAN (에이전트 작업 순서)]
A) 구조 리팩터링 (가독성/유지보수)
1. receipt-line-workbench.tsx에서 “매칭 UI 블록”을 분리 컴포넌트로 추출:
   - 예: web/src/components/receipt/matching/MatchDrawer.tsx
   - 예: web/src/components/receipt/matching/UnmatchedList.tsx
   - 예: web/src/components/receipt/matching/CandidateList.tsx
   - 예: web/src/components/receipt/matching/CandidateDetails.tsx
   - 예: web/src/components/receipt/matching/ConfirmStickyBar.tsx
   (파일 분리는 권장, 단 너무 과하면 최소 2~3개로 나눠도 됨)

2. 타입/유틸은 가능한 기존 파일에서 그대로 import/이관:
   - UnlinkedLineRow, MatchCandidate, StoneSource/Allocation 관련 helper 유지
   - 불필요한 타입 재정의 금지(중복 줄이기)

B) UI 인프라: “Sheet/Drawer” 컴포넌트 추가
1. 기존 Modal은 center 고정이므로, 오른쪽 슬라이드 드로어 컴포넌트를 새로 만든다:
   - 파일: web/src/components/ui/sheet.tsx (혹은 drawer.tsx)
   - props:
     - open: boolean
     - onClose(): void
     - title?: string
     - children
     - width presets (예: "lg:w-[1100px] w-[95vw]" 같이 className로)
   - 기능:
     - overlay 클릭/ESC 닫기
     - open 시 body scroll lock(간단 구현)
     - focus trap은 라이브러리 없이 최소한: 오픈 시 첫 포커스 가능한 요소로 이동, 닫힐 때 트리거로 복귀
     - animation: translate-x + opacity, duration var(--duration-normal), easing var(--ease-out)

C) 매칭 탭 UI 재배치 (핵심)
1. 매칭 탭 본문은 기본적으로:
   - 상단: “미매칭 라인 N건” + 간단 안내(클릭하면 매칭 폼 열림)
   - 리스트: 2줄 카드 형태 (모델/소재/색상/사이즈 / 거래처/중량/원석요약/비고)
   - 각 아이템 클릭 → setSelectedUnlinked(line) + 드로어 open
   - 기존 “확장/축소” 포커스 모드(카드 220% 확대)는 제거하거나, “드로어 기반”으로 대체한다.
     (레거시 토글은 feature flag로 남겨도 되지만 기본은 드로어)

2. 드로어(매칭 폼) 레이아웃(Desktop 기준):
   - Header bar:
     - "Line X of Y" (현재 선택 라인이 미매칭 리스트에서 몇 번째인지)
     - 좌우 네비: Prev/Next (미매칭 라인 기준)
     - Close
   - Body: 3 컬럼 grid
     - Left: Selected Line Card (영수증 라인 요약 + “라인 수정 열기” 버튼)
     - Middle: Match Candidates (리스트/테이블)
     - Right: Candidate Details (선택 후보 상세 + Score breakdown)
   - Footer: Sticky Confirm Bar (항상 하단 고정)
     - weight 입력(기본값 자동 채움)
     - 허용범위 표시 + 범위 이탈 시 즉시 빨간 경고(확정 버튼 disable)
     - factoryBillingShape(필요할 때만)
     - note 입력(간단)
     - [확정] 버튼 + (확정 성공 후) [다음 미매칭 라인] CTA

3. Responsive:
   - <lg: 드로어는 full-screen(상단 헤더 + 세로 스택)
     - SelectedLine -> CandidateList -> CandidateDetails -> StickyBar
   - StickyBar는 모바일에서도 항상 하단 고정

D) 동작/로직 (기능 유지 + 개선)
1. “드로어 오픈 시 자동 제안”:
   - open되면 현재 라인에 대해 handleSuggest(line)를 자동 호출(단, 이미 suggestions가 해당 라인의 결과면 재호출 X)
   - 자동 호출은 debounce(예: 200ms)로 중복 방지
   - 로딩 상태 표시(중앙에 skeleton)

2. “저장 필요 상태를 막지 말고, 드로어 내에서 해결”:
   - 드로어 상단(헤더 아래)에 “Blocking Banner” 영역 추가:
     - headerNeedsSave: “헤더 저장이 필요합니다” + [헤더 저장] CTA
       - CTA 클릭 시 기존 헤더 저장 로직을 호출 (현재 headerUpdate/useRpcMutation 흐름 재사용)
     - lineItemsDirty: “라인 저장이 필요합니다” + [라인 저장] CTA
       - CTA 클릭 시 saveLines() 호출
   - 기존처럼 확정 버튼 누르면 토스트로 막히는 경험을 줄인다.
   - 단, API 호출(제안/확정) 직전에도 최종 가드로 headerNeedsSave/lineItemsDirty 체크는 유지.

3. “후보 비교 UX 개선(차이 강조)”:
   - CandidateList row에는 핵심 필드만 노출:
     - score, order_no, status, model/material, weight range, customer
   - SelectedLine과 다른 값은 highlight:
     - 예: model/material/color/size/customer mismatch 배지 표시
   - Score breakdown은 CandidateDetails에서 펼침(기존 score_detail_json 활용)

4. “확정 입력 고도화”:
   - weight 기본값 자동 주입 규칙(우선순위):
     1) targetLine.factory_weight_g
     2) targetLine.weight_raw_g - targetLine.weight_deduct_g (calcWeightTotal 로직 재사용)
     3) selectedCandidate.effective_weight_g
   - material_code === "00"이면 weight는 0 허용(기존 로직 유지)
   - 허용범위(min/max) UI를 weight input 바로 옆에 표시
   - SELF 단가 0 경고 로직: note 자동 추가/토스트 유지

5. “자동배분/원가 프리뷰 등 고급 기능은 드로어에서 ‘접기/펼치기’로 제공”:
   - Confirm 영역을 2단으로:
     - 기본(항상): weight + note + confirm
     - 고급(접힘): stone source 배지, 자동배분(총알수), 원가 프리뷰(v4)
   - 접기/펼치기 토글은 간단한 state로 구현(별도 라이브러리 X)

6. “확정 성공 후 UX”:
   - matchConfirm onSuccess 결과(confirmResult)가 오면:
     - 드로어 상단에 green success banner: “Matched! Line X Confirmed”
     - Footer CTA를:
       - [Next Unmatched Line] (기본)
       - [Previous Line]
       - [Edit Line] (중앙 라인 입력 영역으로 스크롤/포커스)
   - next line 이동 시:
     - selectedCandidate, confirmNote 등은 초기화
     - 자동 suggest 재실행

7. URL deep-link(선택 구현, 강추):
   - 드로어 open 상태를 URL 쿼리로 유지: ?match=<receipt_line_uuid>
   - 새로고침해도 동일 라인 드로어가 열리도록
   - 닫으면 쿼리 제거

E) 접근성/품질
- 드로어는 role="dialog" aria-modal="true"
- ESC 닫기
- 버튼/입력 focus ring 유지
- 키보드 네비(최소):
  - 미매칭 리스트에서 Enter로 드로어 오픈
  - 드로어에서 Ctrl+Enter로 확정
  - 드로어에서 Alt+ArrowLeft/Right로 Prev/Next 라인 이동

F) 성능/안정성
- 드로어 내부 컴포넌트는 memo/useMemo로 불필요 rerender 줄이기
- suggestion 결과는 receiptLineUuid 단위로 캐시(Map)해도 됨(선택)
- React Query invalidate는 기존과 동일하게 유지(confirmed/unlinked/receipts/reconcile/integrity)

────────────────────────────────────────────────────────
[DELIVERABLES (PR 산출물)]
1) 새로운 드로어 UI 컴포넌트 추가:
   - web/src/components/ui/sheet.tsx (or drawer.tsx)
2) 매칭 탭을 “리스트 중심 + 드로어”로 개편
   - receipt-line-workbench.tsx에서 기존 매칭 UI 블록 교체
3) MatchDrawer(폼) 구현 + 기존 기능(제안/후보/확정/경고/고급기능) 모두 이관
4) 타입스크립트 에러/린트 0
   - web에서 npm run lint / npm run build 통과
5) 최소 수동 테스트 시나리오(README에 체크리스트로 남겨라):
   - 헤더 저장 필요 상태에서 드로어 열기 → 배너 CTA로 해결 → 자동 제안 진행
   - 라인 dirty 상태에서 확정 시도 → 배너에서 저장 후 확정 성공
   - 중량 범위 이탈 → 경고 + 확정 disable
   - 확정 성공 → 다음 미매칭 라인 이동
   - 후보 없음 → “후보 없음” 상태 UI가 깨지지 않음

[ACCEPTANCE CRITERIA]
- “미매칭 라인 클릭 → 드로어 → 후보 선택 → 확정”이 기존보다 클릭 수 감소 + 한 화면 흐름 유지
- 기존 경고/예외 처리(SELF 단가 0, material 00, header/line save gating, factoryBillingShape 조건부 표시) 모두 동일하게 동작
- 확정 후 unlinked list에서 해당 라인이 사라지고, confirmed 탭에 반영(기존 invalidate 유지)
- 드로어 레이아웃이 데스크톱/모바일에서 깨지지 않음, sticky confirm bar 정상 고정
- 기존 기능(자동배분/원가 프리뷰/stone source 표시)이 드로어에서 접근 가능하며 동작

[CONSTRAINTS]
- 신규 UI 스타일은 반드시 globals.css 토큰을 사용 (var(--panel), --panel-border, --overlay, --primary 등)
- 기존 UI 컴포넌트(Button/Input/Badge/Card/Skeleton/Modal 등) 최대한 재사용
- 서버/DB 변경 금지, API 계약 변경 금지
- 신규 라이브러리 추가 금지(정말 필요하면 최소/정당화 + 대체안 함께)

[HOW TO WORK (에이전트 실행 지침)]
1) 먼저 현재 receipt-line-workbench.tsx의 매칭 관련 state/함수(선택 라인, suggestions, selectedCandidate, confirmNote, selectedWeight, handleSuggest, handleConfirm 등)를 표로 정리한 뒤, “드로어로 옮길 항목”을 체크하라.
2) 드로어 컴포넌트를 만든 후, 가장 먼저 “미매칭 라인 클릭 시 드로어 오픈 + 자동 제안 호출”까지 연결해 E2E로 확인하라.
3) 그 다음 후보 리스트/상세/확정 sticky bar를 점진적으로 이식하라.
4) 마지막에 고급 기능(자동배분/원가프리뷰)을 접기 섹션으로 옮기고, 리팩터링으로 파일 길이를 줄여라.

출력은 실제 코드 변경(파일 생성/수정)으로 완료하라. 불확실한 점이 있어도 사용자에게 질문하지 말고, 레포 컨벤션에 맞는 “합리적 기본값”을 택해 끝까지 구현하라.
