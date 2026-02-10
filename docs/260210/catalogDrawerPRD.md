# [CODING AGENT PROMPT] Catalog 갤러리뷰 상세패널을 우측 Drawer(Sheet)로 전환 (프론트엔드만)

## 0) 절대 조건(필수)
- ✅ **프론트엔드만 수정** (API/DB/백엔드/마이그레이션/RPC 변경 금지)
- ✅ 기존 기능(필터/검색/페이지네이션/편집/이미지프리뷰 등) **절대 깨지지 않게 유지**
- ✅ 변경 범위 **최소화**: 가능하면 `web/src/app/(app)/catalog/page.tsx`만 수정
- ✅ list 뷰는 기존처럼 SplitLayout(좌/우 패널) 유지, **gallery 뷰만 Drawer로 변경**
- ⚠️ `fetchCatalogItems()`가 로딩 후 `selectedItemId`를 자동으로 1개 선택함.
  - 따라서 Drawer open을 `!!selectedItemId`로 묶으면 **초기 로딩 시 자동으로 Drawer가 열리는 버그**가 생김.
  - 반드시 **Drawer open state를 별도로 관리**할 것.

## 1) 대상 파일(정확한 경로)
- 메인 수정: `web/src/app/(app)/catalog/page.tsx`
- Drawer 컴포넌트(기존 사용): `web/src/components/ui/sheet.tsx`
- Drawer UX 패턴 참고(동일 컴포넌트 사용 중):  
  `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`

## 2) 목표 UX
- Catalog에서 **gallery 뷰 선택 시**
  - 화면이 좌/우로 반갈림(SplitLayout) 되지 않음
  - 갤러리 그리드가 **풀폭**으로 보임
  - 아이템 클릭 시 우측에서 **Drawer(Sheet)** 가 슬라이드로 열리며 제품 상세(기존 우측 패널 내용)를 표시
  - ESC/오버레이 클릭/닫기 버튼으로 Drawer 닫힘
- list 뷰는 기존처럼 SplitLayout 유지(변경 최소)

## 3) 구현 방식(필수 설계)
### 3.1 Drawer state를 별도로 둔다 (중요)
`page.tsx`에 아래 state 추가:
- `const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);`

핵심:
- `selectedItemId`는 “선택된 항목” 상태로 유지
- `isDetailDrawerOpen`은 “Drawer 표시 여부”로 유지
- 초기 로딩에서 `selectedItemId`가 자동으로 잡혀도 Drawer는 **자동 오픈 금지**

### 3.2 갤러리 아이템 클릭 시 “선택 + Drawer 오픈”
갤러리 그리드에 넘기는 콜백을 교체:
- 기존: `setSelectedItemId={setSelectedItemId}`
- 변경: `setSelectedItemId={openDetailDrawer}` 형태로 함수 주입

`openDetailDrawer(id)` 동작:
- `setSelectedItemId(id);`
- `setIsDetailDrawerOpen(true);`

닫기 함수:
- `closeDetailDrawer()`:
  - `setIsDetailDrawerOpen(false);`
  - (선택 유지 권장) `selectedItemId`는 기본 유지
  - 단, 선택 항목이 사라졌을 때(필터/페이지 변경으로)만 안전하게 정리할 수 있음(아래 3.5)

### 3.3 JSX 구조 분기: gallery 뷰는 SplitLayout 제거
현재 `page.tsx`는 gallery 그리드가 `SplitLayout.left` 안에 있고 `SplitLayout.right`가 항상 떠서 반갈림이 발생함.

필수 변경:
- `view === "gallery"` 인 경우:
  - SplitLayout을 쓰지 말고 “풀폭 레이아웃”으로 렌더
  - 그리고 Drawer(Sheet)로 상세를 띄움
- `view === "list"` 인 경우:
  - 기존 SplitLayout 구조 **그대로 유지** (리스크 최소)

### 3.4 “기존 우측 상세 패널” 콘텐츠 재사용(중요)
`page.tsx`에서 우측 패널에는 (대략) 다음 두 블록이 있음:
- (1) 필터/검색 UI 블록
- (2) `{/* 2. 메인 컨텐츠 영역 */}` 이하 “상세/이미지/가격/부속(BOM) 등” 메인 내용

목표는 “(2) 메인 컨텐츠 영역”을 Drawer 안에 그대로 보여주는 것.
따라서 리팩토링 최소화 전략:
- `const DetailMainContent = ( ...기존 우측 패널의 메인 컨텐츠 영역 JSX... );`
  - 즉, 주석 `{/* 2. 메인 컨텐츠 영역 */}` 아래 div부터 내부를 최대한 그대로 변수화
- list 뷰 우측 패널에는 기존처럼 필터 + DetailMainContent 표시
- gallery 뷰에서는 Drawer 안에 DetailMainContent 표시

### 3.5 안정성 처리(완성도 필수)
아래 상황에서 Drawer가 “깨진 상태(null 참조 등)”로 남지 않게 처리:
- gallery 뷰에서 필터/검색/페이지 변경 → 선택 항목이 목록에서 사라질 수 있음
- 최소한 아래를 보장:
  - `selectedItemId`로 `selectedItem`이 없으면 Drawer 내용은 안전하게 “선택된 항목 없음” UI 표시 + 자동 닫기(선호)
권장 구현:
- `useEffect(() => { if (view !== "gallery") setIsDetailDrawerOpen(false); }, [view]);`
- `useEffect(() => { if (isDetailDrawerOpen && !selectedItemId) setIsDetailDrawerOpen(false); }, [isDetailDrawerOpen, selectedItemId]);`
- 또한 `selectedItem`이 현재 `pageItems`/`mapped`에 없으면 자동 닫기(또는 안내 표시)

## 4) Drawer(Sheet) 내부 UI (workbench 스타일로 통일)
`Sheet` 사용:
- import: `import { Sheet } from "@/components/ui/sheet";`
- gallery 뷰에서 렌더:
  - `<Sheet open={isDetailDrawerOpen} onClose={closeDetailDrawer} title="제품 상세" className="w-[96vw] lg:w-[1100px]">`

Drawer children 레이아웃(필수):
- 상단 헤더(고정):
  - 좌: 모델명/식별자(가능하면 `selectedItem?.modelName` or 기존 변수 사용)
  - 우: 닫기 버튼(필수), 필요하면 기존 편집 버튼/액션 유지
- 본문 스크롤:
  - `className="flex h-full min-h-0 flex-col"`
  - 본문 컨테이너에 `min-h-0` + `overflow-y-auto` 필수
- 참고 패턴: `new_receipt_line_workbench/receipt-line-workbench.tsx`의 `<Sheet>` 내부 구조와 동일한 방식

## 5) 갤러리뷰에서 필터 UI 유지(반드시 유지)
현재 필터 UI가 우측 패널에 있어서 gallery에서 SplitLayout.right를 제거하면 필터가 사라짐.
해결:
- 필터 UI를 JSX 변수로 뽑아서 gallery 뷰 상단(그리드 위)에 배치하되,
- 기존 state/핸들러(`setMaterialCodeFilter`, `setCreatedAtSort`, `setFilterQuery`, `setPage(1)` 등)는 그대로 재사용

구현 가이드:
- `const FilterBar = (...)`로 필터 3종(Select/Select/Input)을 변수화
- list 뷰: 기존 위치(우측 패널 상단)에 그대로 렌더
- gallery 뷰: 페이지 상단(그리드 위)에 sticky로 렌더(선택) 또는 일반 렌더

## 6) 유지해야 하는 기존 동작(깨지면 실패)
- `handleOpenEdit` (더블클릭 편집 등) 동작 유지
- `setPreviewImage` (이미지 프리뷰/모달) 동작 유지
- 페이지네이션/정렬/검색 동작 유지
- `fetchCatalogItems()`의 `setSelectedItemId((prev)=>...)` 로직은 유지(단, Drawer open과 분리)

## 7) 완료 기준(검수 시나리오)
1) gallery 뷰에서 화면이 더 이상 반으로 갈라지지 않고 그리드가 풀폭으로 나온다  
2) gallery 카드 클릭 시 Drawer가 열리고 기존 우측 상세 패널의 핵심 내용이 그대로 보인다  
3) ESC/오버레이 클릭/닫기 버튼으로 Drawer가 닫히며 배경 스크롤 락/포커스 복원이 정상이다  
4) list 뷰는 기존 SplitLayout 그대로 동작한다(회귀 없음)  
5) 필터/검색/페이지 변경 시 예외 없이 안전하며, 선택 항목이 사라진 경우 Drawer는 적절히 닫히거나 안내가 뜬다  

## 8) 산출물 요구
- PR 형태로 **최소 diff** 제공
- 수정한 파일 목록과 핵심 변경 요약 포함
- (중요) “초기 로딩 시 selectedItemId 자동 선택” 때문에 Drawer가 자동 오픈되지 않음을 명확히 보장

끝.
