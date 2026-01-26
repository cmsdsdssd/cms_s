# docs/PHASE1_UI_CONTRACT_LOCK.md — Phase1 UI/UX 구현 “최종 고정 계약” (LOCK)

저장 경로(권장):  
`C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs\PHASE1_UI_CONTRACT_LOCK.md`

참고 문서/레퍼런스(필요할 때만 열어보기):  
- `C:\Users\RICH\.gemini\antigravity\scratch\cms_s\docs\` 폴더 내 기존 MD 전부  
- 레퍼런스 디자인 이미지: `ref_1.png`, `ref_2.png` (동일 폴더)

---

## 0) 목적(한 문장)

산발적으로 존재하는 DB 오브젝트(뷰/함수) 중 **Phase1 UI가 “실제로 사용할 것만” 고정**해서, 코딩 에이전트가 **그대로 구현만** 하도록 만든다.

---

## 1) 전역 헌법(LOCK) — 어기면 전부 반려

### 1.1 DB 접근(READ/WRITE)
- **READ(조회)**: `v_*` 뷰만 사용
- **WRITE(쓰기)**: `fn_*` RPC만 사용 (`rpc()` 호출만)
- ❌ base table 직접 insert/update/delete 금지
- ❌ UI에서 가격/확정/정산 로직 재구현 금지(서버 함수/뷰 결과만)

### 1.2 “계약만 사용” 원칙(산발성 봉인)
- 이 문서에 **명시된 뷰/함수만** UI에서 호출/조회 가능
- 문서에 없는 뷰/함수는 **존재하더라도 사용 금지**
- `_live`는 원칙적으로 최소화하되, **Shipments는 현재 확정 계약이 `_live`**라 예외 허용(아래 참조)

### 1.3 UI/UX 규범(레퍼런스 고정)
- 레퍼런스(`ref_1.png`, `ref_2.png`)처럼 **모던/고급/리툴 스타일**
- “컨테이너 여러 개”를 **카드/패널**로 붙여서 깔끔하게 구성
- 12-col 그리드 기반(좌 리스트 + 우 상세 패널 스택)

### 1.4 에러/로딩/토스트(공통)
- 모든 네트워크 액션: 로딩 스피너가 아니라 **스켈레톤/부분 로딩** 우선
- 모든 RPC: 성공/실패 토스트 표준 문구 사용(아래 템플릿)
- 배치 작업(다중 Confirm 등): 진행률 표시 + 부분 실패 요약 토스트 필수

---

## 2) Supabase 클라이언트 “스키마 고정” 규약(중요)

현재 클라우드에서 “실제로 존재/사용 가능한” 스키마는 `ms_s`이며,
Phase1 UI는 **ms_s 계약을 사용**한다.

> ❗️중요: Supabase JS에서 `ms_s`를 쓰려면 `schema('ms_s')`를 고정해서 호출한다.  
> (`from('ms_s.xxx')` 같이 schema를 테이블명에 섞지 말 것)

### 2.1 READ 예시
```ts
const db = supabase.schema('ms_s')

const { data, error } = await db
  .from('v_staff_sales_order_list_v1')
  .select('*')
  .limit(50)
