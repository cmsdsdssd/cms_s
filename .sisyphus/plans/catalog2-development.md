# Catalog2 페이지 개발 계획

## 프로젝트 개요

**목표**: 기존 카탈로그 페이지의 UI/UX를 완전히 개선한 `catalog2` 페이지 개발
**현재 문제**:
- 선택 상태가 불명확 (체크 표시만으로는 부족)
- 카드에 정보 과다 (금액, 중량, 공임 등 한꺼번에 표시)
- 수정 플로우 불편 (더블클릭 필요)
- 필터/정렬 기능이 기본적
- 레거시한 디자인

**개선 목표**:
- 모던하고 고급스러운 갤러리 디자인
- 명확한 선택 상태 표시
- 직관적인 수정/보기 플로우
- 강화된 필터링 및 정렬
- 그리드/리스트 뷰 전환

---

## TODO 목록

### Phase 1: 기본 페이지 구조

#### 1.1 catalog2 페이지 생성
- **파일**: `web/src/app/(app)/catalog2/page.tsx`
- **작업**:
  - [ ] 페이지 기본 구조 설정
  - [ ] 데이터 fetching 로직 (Supabase 연동)
  - [ ] 상태 관리 (useState, useCallback)
  - [ ] Product 타입 정의
- **완료 기준**:
  - [ ] 페이지가 `/catalog2` 경로에서 정상 로드
  - [ ] 제품 목록이 API에서 불러와짐
  - [ ] 로딩 상태 표시

#### 1.2 타입 정의
- **작업**:
  ```typescript
  type Product = {
    id: string;
    masterId: string;
    model: string;
    imageUrl?: string | null;
    categoryCode: string;
    materialCode: string;
    weightDefault: number;
    deductionWeight: number;
    vendorName?: string;
    laborTotalSell: number;
    platingSell: number;
    totalSell: number;
    centerQty: number;
    sub1Qty: number;
    sub2Qty: number;
    modifiedAt: string;
  };
  ```
- **완료 기준**:
  - [ ] 모든 필드가 cms_master_item 테이블과 매핑됨
  - [ ] CATEGORY_MAP, MATERIAL_MAP 상수 정의

### Phase 2: UI 컴포넌트 개발

#### 2.1 ProductCard 컴포넌트 (그리드 뷰)
- **파일**: 새로운 컴포넌트 또는 페이지 내 인라인
- **기능**:
  - [ ] 3D 틸트 효과 (기존 것 재사용 또는 개선)
  - [ ] 선택 상태 표시 (체크박스 + 링 하이라이트)
  - [ ] 호버 시 퀵 액션 버튼 (보기/수정)
  - [ ] 카테고리/소재 뱃지
  - [ ] 이미지 로딩/에러 처리
- **디자인**:
  - [ ] 그라데이션 배경 (소재별 색상)
  - [ ] 그림자 효과
  - [ ] 부드러운 애니메이션
- **완료 기준**:
  - [ ] 카드 클릭 시 선택/해제
  - [ ] 선택 시 시각적 피드백 (링 + 스케일)
  - [ ] 보기/수정 버튼이 호버 시 나타남
  - [ ] 반응형 (280px 기준 그리드)

#### 2.2 ProductListRow 컴포넌트 (리스트 뷰)
- **기능**:
  - [ ] 체크박스로 선택
  - [ ] 썸네일 이미지
  - [ ] 4컬럼 그리드 (정보/중량/공임/판가)
  - [ ] 작업 버튼 (보기/수정)
- **완료 기준**:
  - [ ] 리스트 뷰에서도 선택 가능
  - [ ] 정보가 한눈에 보임

#### 2.3 FilterBar 컴포넌트
- **기능**:
  - [ ] 검색 입력 (모델명, 벤더)
  - [ ] 카테고리 필터 (드롭다운)
  - [ ] 소재 필터 (드롭다운)
  - [ ] 정렬 토글 (모델명/가격/수정일)
  - [ ] 필터 초기화 버튼
  - [ ] 통계 표시 (전체/필터링/선택)
- **완료 기준**:
  - [ ] 모든 필터가 동시에 작동
  - [ ] URL query params 연동 (선택사항)
  - [ ] 필터링 결과 실시간 반영

### Phase 3: 메인 페이지 조립

#### 3.1 페이지 레이아웃
- **구조**:
  ```
  - Header (ActionBar)
    - 제목/부제목
    - 뷰 모드 토글 (그리드/리스트)
    - 일괄 작업 버튼
    - 신규 등록 버튼
  - FilterBar
  - Product Grid/List
  - Empty State
  - Loading State
  ```
- **완료 기준**:
  - [ ] 스크롤 시 헤더가 sticky로 고정
  - [ ] 뷰 모드 전환이 부드러움
  - [ ] 빈 상태일 때 안내 메시지

#### 3.2 뷰 모드 전환
- **작업**:
  - [ ] 그리드/리스트 토글 버튼
  - [ ] 상태에 따라 다른 컴포넌트 렌더링
  - [ ] 선택 상태가 뷰 전환 시 유지
- **완료 기준**:
  - [ ] 토글 시 애니메이션
  - [ ] 같은 데이터, 다른 레이아웃

### Phase 4: 모달 및 상세 기능

#### 4.1 상세 보기 모달
- **기능**:
  - [ ] 큰 이미지 표시
  - [ ] 제품 기본 정보
  - [ ] 가격 구성 세부내역
  - [ ] 수정 버튼
- **완료 기준**:
  - [ ] 카드 클릭 또는 보기 버튼으로 열림
  - [ ] 정보가 잘 정리되어 표시

#### 4.2 수정 모달
- **작업**:
  - [ ] 기존 catalog 페이지의 폼 재사용 고려
  - [ ] 또는 새로운 간단한 폼 작성
- **완료 기준**:
  - [ ] 수정 버튼 클릭 시 모달 열림
  - [ ] 저장 시 목록 갱신

#### 4.3 등록 모달
- **작업**:
  - [ ] 새 제품 등록 폼
  - [ ] 이미지 업로드
- **완료 기준**:
  - [ ] 등록 후 목록에 즉시 반영

### Phase 5: 선택 및 일괄 작업

#### 5.1 다중 선택
- **기능**:
  - [ ] Ctrl/Cmd + 클릭으로 다중 선택
  - [ ] Shift + 클릭으로 범위 선택
  - [ ] 전체 선택/해제
  - [ ] 선택된 항목 수 표시
- **완료 기준**:
  - [ ]直感的な 선택 UX
  - [ ] 선택된 항목이 시각적으로 구분됨

#### 5.2 일괄 작업
- **기능**:
  - [ ] 선택된 항목 일괄 수정
  - [ ] 선택된 항목 일괄 삭제
  - [ ] 선택된 항목보내기
- **완료 기준**:
  - [ ] 2개 이상 선택 시 일괄 작업 버튼 활성화

### Phase 6: 데이터 연동

#### 6.1 Supabase 연동
- **작업**:
  - [ ] cms_master_item 테이블에서 데이터 조회
  - [ ] cms_party (벤더 정보) join
  - [ ] cms_market_tick (시세) 연동
  - [ ] 이미지 URL 생성 (Supabase Storage)
- **쿼리**:
  ```sql
  SELECT 
    m.*,
    p.name as vendor_name
  FROM cms_master_item m
  LEFT JOIN cms_party p ON m.vendor_party_id = p.party_id
  WHERE m.is_active = true
  ```
- **완료 기준**:
  - [ ] 실제 데이터가 표시됨
  - [ ] 이미지가 제대로 로드됨

#### 6.2 실시간 갱신
- **작업**:
  - [ ] React Query 사용
  - [ ] 캐싱 및 리프레시
  - [ ] 낙관적 업데이트
- **완료 기준**:
  - [ ] 수정 후 목록 자동 갱신

### Phase 7: 테스트 및 다듬기

#### 7.1 반응형 테스트
- **브레이크포인트**:
  - [ ] Desktop (1920px+)
  - [ ] Laptop (1440px)
  - [ ] Tablet (768px)
  - [ ] Mobile (375px)
- **완료 기준**:
  - [ ] 모든 해상도에서 사용 가능
  - [ ] 모바일에서도 카드가 잘 보임

#### 7.2 성능 최적화
- **작업**:
  - [ ] 이미지 lazy loading
  - [ ] 가상 스크롤 (항목이 많을 경우)
  - [ ] React.memo 사용
- **완료 기준**:
  - [ ] 100개 이상 항목도 부드러움

#### 7.3 접근성
- **작업**:
  - [ ] 키보드 네비게이션
  - [ ] ARIA 레이블
  - [ ] 포커스 표시
- **완료 기준**:
  - [ ] 키보드만으로 조작 가능

---

## 파일 구조

```
web/src/app/(app)/catalog2/
├── page.tsx                    # 메인 페이지
├── components/
│   ├── ProductCard.tsx         # 그리드 뷰 카드
│   ├── ProductListRow.tsx      # 리스트 뷰 행
│   ├── FilterBar.tsx           # 필터/정렬 바
│   ├── ProductDetailModal.tsx  # 상세 보기 모달
│   └── ProductEditModal.tsx    # 수정 모달
├── hooks/
│   └── useProducts.ts          # 데이터 fetching 훅
└── types/
    └── product.ts              # 타입 정의
```

---

## 기술 스택

- **Framework**: Next.js 16 + React 19
- **Styling**: Tailwind CSS
- **State**: React Hooks (useState, useCallback, useMemo)
- **Data Fetching**: TanStack Query (React Query) 또는 Supabase Client
- **UI Components**: 기존 컴포넌트 재사용
  - Button, Card, Modal, Input, Select, Badge
- **Icons**: Lucide React

---

## 디자인 가이드라인

### 색상
- 카테고리별 색상:
  - BRACELET: #3b82f6 (파랑)
  - NECKLACE: #ec4899 (핑크)
  - EARRING: #f59e0b (주황)
  - RING: #ef4444 (빨강)
  - etc.

- 소재별 색상:
  - 14K: #f59e0b (금색)
  - 18K: #eab308 (금색)
  - 925: #64748b (은색)

### 카드 디자인
- border-radius: 16px (rounded-2xl)
- 그림자: shadow-lg
- 호버: translateY(-4px), shadow-xl
- 선택: ring-4 ring-primary/20

### 타이포그래피
- 모델명: font-semibold, 16px
- 가격: font-bold, primary color
- 메타정보: text-sm, muted color

---

## 완료 기준 (Definition of Done)

1. **기능적 완료**:
   - [ ] 모든 TODO 항목 완료
   - [ ] build 오류 없음
   - [ ] 런타임 오류 없음

2. **품질 기준**:
   - [ ] 기존 catalog 페이지 기능과 동등하거나 우수
   - [ ] 사용자 피드백 반영 (선택 상태 명확, 수정 편의)

3. **배포 준비**:
   - [ ] `/catalog2` 경로에서 동작
   - [ ] 기존 페이지와 충돌 없음

---

## 예상 작업 시간

| Phase | 예상 시간 | 우선순위 |
|-------|----------|---------|
| Phase 1 | 2시간 | P0 |
| Phase 2 | 4시간 | P0 |
| Phase 3 | 2시간 | P0 |
| Phase 4 | 3시간 | P1 |
| Phase 5 | 2시간 | P1 |
| Phase 6 | 2시간 | P0 |
| Phase 7 | 2시간 | P2 |
| **총계** | **17시간** | - |

---

## 참고 사항

- 기존 `CatalogGalleryCard`의 3D 틸트 효과는 유용하므로 재사용 고려
- `catalog/page.tsx`의 복잡한 폼은 단순화하거나 단계별로 나누기
- 이미지 업로드는 Supabase Storage 사용 (기존 로직 재사용)
- 실제 데이터 연동은 Phase 6에서 처리, 이전에는 mock 데이터 사용 가능
