# [CODING AGENT PROMPT - HARD ENFORCE] new_receipt_line_workbench 라인 상세입력 “고객코드/모델명” 자동완성(포함검색 드롭다운) — UI 위치/레이아웃까지 강제

## 0) 작업 범위(오해 0%로 만들기)
✅ 이번 작업은 오직 1곳:
- `new_receipt_line_workbench`에서 **영수증 선택 → 라인 클릭 → 확장된 상세 입력(tr detail)** 안의
  - 고객코드 Input (`item.customer_factory_code`)
  - 모델명 Input (`item.model_name`)
  이 두 Input에만 “자동완성(포함검색 결과 드롭다운)”을 추가한다.

🚫 절대 건드리지 말 것(수정/리팩토링/재활용 금지):
- 우측 패널의 **미매칭라인 매칭제안** UI/상태/로직
- `handleSuggest`, `handleSuggestOrdersInput`, `suggestions`, `selectedCandidate`, `isSuggesting` 등 match 관련 state
- 아래 API 호출/수정/재사용 금지:
  - `/api/new-receipt-workbench/match-suggest`
  - `/api/new-receipt-workbench/match-suggest-input`

> “고객코드/모델명 자동완성”은 **좌측 테이블의 ‘라인 상세 입력’**에서만 동작해야 한다.  
> 우측 패널(매칭)과 코드/상태를 **한 줄도** 섞지 마라.

---

## 1) 수정 파일 / 정확한 위치
- 파일: `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
- 위치: 라인 목록 테이블에서 `expandedLineId === item.line_uuid` 인 경우 렌더하는 `<tr ... key={`${item.line_uuid}-detail`}>` 내부
- 현재 Input 2개가 존재한다(그대로 찾을 수 있음):
  - 고객코드 Input: `value={item.customer_factory_code}`
  - 모델명 Input: `value={item.model_name}`

이 두 Input을 “자동완성 Input”으로 교체한다.

---

## 2) 데이터 소스(풀 제한) + 반드시 이 API만 사용
### 고객코드 자동완성
- API: `POST /api/new-receipt-workbench/customer-code-suggest`
- body: `{ q: string, limit?: number }`
- response: `{ data: Array<{ party_id, name, mask_code }> }`
- 원천: `cms_party.mask_code` (포함검색)

### 모델명 자동완성
- API: `POST /api/new-receipt-workbench/model-name-suggest`
- body: `{ q: string, limit?: number }`
- response: `{ data: Array<{ master_item_id, model_name }> }`
- 원천: `cms_master_item.model_name` (포함검색)

요청 limit:
- 프론트 요청은 `limit: 30` 고정(최대 50 이하)

---

## 3) “UI/레이아웃” 강제 요구사항 (여기 어기면 실패)
### 3-1. 드롭다운은 **무조건 Input 바로 아래** + **절대 레이아웃을 밀면 안 됨**
- 드롭다운은 **absolute overlay**로 떠야 한다 (DOM 흐름에 포함되면 실패)
- Input을 감싸는 wrapper는 반드시 `relative` 여야 한다
- 드롭다운 컨테이너는 반드시 아래 Tailwind 규격 준수:

**드롭다운 컨테이너 클래스(그대로 사용 권장):**
- `absolute left-0 right-0 top-full mt-1 z-[9999]`
- `max-h-60 overflow-y-auto`
- `rounded-[12px] border border-[var(--panel-border)] bg-[var(--panel)] shadow-lg`

추가:
- 항목이 0개면 “검색 결과 없음” 메시지를 같은 박스 안에 표시
- 로딩 중이면 상단/하단에 `text-xs text-[var(--muted)]`로 “검색 중…” 표시(최소 1줄)

### 3-2. “확장행이 접히면 안 된다” (최우선)
현재 구현은 onBlur에서 `data-line-id`로 확장행 유지/해제를 판단한다.

따라서 자동완성 드롭다운의 **모든 클릭 가능한 요소(버튼/항목)** 에는 무조건:
- `data-line-id={item.line_uuid}`

또한 blur를 원천 봉쇄하기 위해, **항목 버튼에는 반드시**:
- `onMouseDown={(e) => e.preventDefault()}`

> 위 2개 중 하나라도 빠지면 “항목 클릭 순간 blur → 확장행 닫힘” 버그가 난다.  
> 이 작업은 그 버그가 0%여야 한다.

### 3-3. 드롭다운 항목 스타일 강제
- 항목은 `<button type="button">` 사용
- 항목 클래스(권장 그대로):
  - `flex w-full items-center justify-between px-2 py-2 text-left text-[11px]`
  - `hover:bg-[var(--muted)]/10`
  - 활성(키보드 선택 중) 상태가 있으면 `bg-[var(--primary)]/10`

표시 텍스트:
- 고객코드 항목: `mask_code` + (가능하면) `name`
  - 예: `1001  |  (주)루미너스`
- 모델명 항목: `model_name`만

선택 시:
- 고객코드 input에 들어가는 값은 **mask_code만**
- 모델명 input에 들어가는 값은 **model_name만**

---

## 4) 입력 이벤트/IME 대응 강제 (기존 동작 유지)
현재 고객코드/모델명 Input은 IME/한글 조합 안정성을 위해
- onChange / onInput / onKeyUp / onCompositionEnd
여러 이벤트에서 updateLine을 호출하고 있다.

자동완성 적용 후에도 아래 규칙을 지켜라:
- 위 이벤트 흐름을 깨지 말 것(사용자가 한글 입력 시 누락/지연되면 실패)
- 다만 중복 호출을 줄이기 위해, 내부적으로는 모든 이벤트에서 **동일 핸들러**를 호출하도록 묶어라:
  - `handleCustomerChange(nextValue)`
  - `handleModelChange(nextValue)`
- 각 핸들러는 반드시 2가지를 수행:
  1) `updateLine(item.line_uuid, "<field>", nextValue)`
  2) 디바운스(150ms)로 suggest API 호출하여 드롭다운 갱신

디바운스 강제:
- 150ms
- 타이머는 필드별로 독립 (customer/model)
- 레이스컨디션 방지:
  - 마지막 query를 ref에 저장하고, 응답 도착 시 현재 query와 다르면 결과를 버린다.

---

## 5) 상태 분리 강제(우측패널과 “절대” 섞지 말기)
`receipt-line-workbench.tsx` 안에 아래 state를 새로 만들되,
이름도 match-suggest 계열과 혼동되지 않게 만든다:

권장:
- `activeLineSuggest: { lineId: string; field: "customer" | "model" } | null`
- `customerCodeSuggest: Array<{ party_id; name; mask_code }>`
- `modelNameSuggest: Array<{ master_item_id; model_name }>`
- `isCustomerSuggestLoading: boolean`
- `isModelSuggestLoading: boolean`

🚫 금지:

- `suggestions`, `selectedCandidate`, `isSuggesting` 같은 기존 match 관련 state 재사용 금지
- `handleSuggest*` 함수 호출 금지

---

## 6) 구현 방식(강제 권장)
### 6-1. 재사용 컴포넌트 생성(권장)
새 파일 생성:
- `web/src/components/ui/inline-suggest-input.tsx`

컴포넌트는 “Input + 아래 absolute dropdown”을 포함해야 하고,
반드시 아래 props를 지원:
- `value: string`
- `lineId: string`  // data-line-id 주입용 (Input + 옵션 버튼들)
- `placeholder?: string`
- `inputClassName?: string`
- `fetcher: (q: string) => Promise<any[]>`  // API 호출은 부모에서 만들어 넘겨도 됨
- `renderItem: (item) => ReactNode`
- `getItemValue: (item) => string`
- `onValueCommit: (nextValue: string) => void` // updateLine 호출은 여기로 통일
- `onBlur?: (e) => void` // 기존 확장행 닫힘 로직 그대로 연결
- `minQueryLength?: number` 기본 1

컴포넌트 내부 강제 규칙:
- wrapper: `relative`
- dropdown: `absolute ... z-[9999] ...`
- option button: `data-line-id={lineId}` + `onMouseDown(e.preventDefault)`
- 빈 query면 드롭다운 닫기
- fetch 에러는 콘솔 로그만(토스트 남발 금지)

### 6-2. 최소 변경(파일 내부 컴포넌트)도 가능
단, 같은 규칙(absolute, data-line-id, onMouseDown preventDefault, 상태 분리)을 100% 지켜야 함.

---

## 7) 교체 작업(정확)
### 고객코드 필드 교체
- 기존 Input 자리에 InlineSuggestInput을 넣고,
- fetcher는 다음을 호출:
  - `fetch("/api/new-receipt-workbench/customer-code-suggest", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ q, limit: 30 }) })`
- item 표시: `mask_code` + `name`
- 선택값: `mask_code`
- 커밋: `updateLine(item.line_uuid, "customer_factory_code", next)`

### 모델명 필드 교체
- API: `/api/new-receipt-workbench/model-name-suggest`
- 표시/선택값: `model_name`
- 커밋: `updateLine(item.line_uuid, "model_name", next)`

---

## 8) “절대 실패하면 안 되는” QA 시나리오(이거 통과 못하면 PR 반려)
1) 영수증 선택 → 라인 클릭 → 확장행 열린 상태
2) 고객코드에 `1` 입력 → **Input 바로 아래** 드롭다운이 떠야 함(레이아웃 밀면 실패)
3) 드롭다운 항목 클릭 → 값이 input에 들어가야 함 + **확장행이 절대 닫히면 안 됨**
4) 모델명에 `루` 입력 → 동일하게 드롭다운 표시/선택/확장행 유지
5) 우측 패널 “미매칭라인 매칭제안” 탭/버튼/로직이 기존과 완전히 동일 (변경 흔적 0)
6) 빠르게 타이핑(`aaaa...`)해도 결과가 엉키지 않음(레이스컨디션 방지 확인)

---

## 9) 금지사항(마지막으로 다시)
- match-suggest API/상태/로직에 손대지 말 것
- 우측 패널 UI를 건드리지 말 것
- 드롭다운을 relative가 아닌 흐름(div 아래에 그냥 렌더)으로 구현 금지 (레이아웃 밀림)
- option에 data-line-id 누락 금지
- option 클릭 시 blur 발생하게 두는 것 금지(onMouseDown preventDefault 필수)
