# [CODING AGENT PROMPT] Frontend-only Fix: Prevent AP overstatement from stone unit cost in new_receipt_line_workbench

## 0) 목표 (한 문장)
`new_receipt_line_workbench`에서 라인 저장 시, `total_amount_krw`가 비어있을 때 자동 계산되는 총액에 **원석 단가 합(개수×단가)** 이 포함되어 **snapshot.total_amount_krw → AP(BILL KRW)** 가 과대계상되는 문제를, **백엔드 수정 없이 프론트만**으로 완전히 차단한다.

---

## 1) 핵심 배경/문제 정의 (반드시 이해하고 반영)
현재 `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx` 에서:
- 라인별 `total_amount_krw`가 비어 있으면
  - `labor_basic + labor_other + (center/sub1/sub2 qty * unit_cost)` 형태로 자동 계산해 `total_amount_krw`로 저장하는 경향이 있다.
- 그리고 헤더 `p_total_amount`(snapshot 총액)도 라인 합계를 올린다.
- DB 함수 `cms_fn_ensure_ap_from_receipt_v1` 는 snapshot total을 우선 사용하므로,
  - 사용자가 “자입 원석 단가(참고)”를 입력했는데 “공장 청구 총액(total_amount_krw)”를 비워두면,
  - 원석 단가가 total에 합산되어 AP가 과대계상될 수 있다.

따라서 프론트에서 “total_amount_krw 자동 계산”에서 **원석 단가 합을 절대로 포함하지 않도록** 바꿔야 한다.

---

## 2) 절대 제약(엄수)
- ✅ **백엔드/SQL/RPC/마이그레이션 수정 금지**
- ✅ 변경 범위는 기본적으로 아래 파일 1개:
  - `web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`
- ✅ 기존 기능(저장/매칭추천/자동배분/라인확장/접기/포맷팅) 깨지면 안 됨
- ✅ 타입/컴파일/린트 에러 0
- ✅ UI에서 “원석단가 입력” 자체는 유지하되, **AP로 쓰는 total 자동 계산에만 제외**한다.

---

## 3) 구현 요구사항 (정확히 이대로)
### 3.1 저장/스냅샷 총액 계산 로직 변경
다음 모든 지점에서 `total_amount_krw` 기본값 산출 시 stone unit cost 합을 더하는 로직이 있으면 제거한다.

- BEFORE(개념): `laborBasic + laborOther + stoneFactoryCost`
- AFTER(필수): `laborBasic + laborOther`

즉, `total_amount_krw`가 비어있을 때:
- 공장 청구 총액의 기본값은 **기본공임 + 중/보(알공임/세팅 등 other 포함)** 로만 잡는다.
- 원석 단가 합(개수×단가)은 “참고값”으로만 화면에 표시할 수 있으나 저장 total에는 자동 포함 금지.

### 3.2 “공장청구총액(저장/AP)” 입력란 UI 추가
라인 상세(확장 영역)에 다음 UI 블록을 추가한다:

- 입력 필드: `total_amount_krw` (텍스트/숫자 입력, 기존 updateLineNumber 재사용)
- 옆에 ReadOnly 필드: 자동계산값(= `laborBasic + laborOther`)
- 설명 문구:
  - “비우면 기본공임+중/보 합(자동계산값)으로 저장된다”
  - “원석단가 입력합은 총액에 자동 포함하지 않는다”

목표는 사용자가 예외적으로 공장 청구서 총액이 다를 때 직접 override 할 수 있게 하는 것.

### 3.3 레이블/문구 정정(혼동 방지)
- “마스터 비율로 자동배분” → 실제 동작은 후보 주문 비율(d1:d2) 기반이므로:
  - 버튼/라벨 문구를 “후보 비율로 자동배분” 으로 변경

- “자입원석 합계” 등 오해 소지가 있는 문구는:
  - “원석단가 입력합(참고)” 류로 변경 (AP/총액에 들어가는 값이 아님을 암시)

### 3.4 자동배분 버튼 동작 유지(중요)
`allocateStoneCounts` 로직은 그대로 둔다.
단, 자동배분 적용 후 `total_amount_krw`를 빈 문자열로 지우는 기존 동작이 있다면:
- 유지하되, 이후 total 재계산이 stone unit cost를 포함하지 않도록(= 3.1이 적용되어야 함)

### 3.5 숫자 포맷팅/입력 UX
- 기존 프로젝트에서 쓰는 `Input`, `autoFormat`, `formatNumber`, `parseNumber`, `updateLineNumber` 패턴을 그대로 유지한다.
- 새로 추가하는 total 입력은:
  - `autoFormat={false}` 또는 프로젝트 스타일에 맞게 숫자 문자열이 깨지지 않게 한다.
  - 우측 정렬(className text-right)
  - disabled 조건(`inputDisabled`) 존중

---

## 4) 변경 위치 가이드(정확히)
파일:
`web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx`

아래 3곳을 반드시 찾아 수정:
1) 라인 total 계산하는 부분
2) 라인 목록/요약에서 total 계산하는 부분
3) 상세 패널에서 보여주는 factory total cost(기본+중/보+원석단가) 같은 계산식

수정 방향:
- `stoneFactoryCost` / `stoneFactory` 를 total 계산에 더하던 부분을 제거
- 필요하면 stone 합은 별도의 “참고” 값으로만 표시

또한 라인 상세 확장 영역에 “공장청구총액(저장/AP)” + “자동계산(기본+중/보)” UI 블록 추가

---

## 5) 수용 기준(Acceptance Criteria)
아래 시나리오를 **반드시 모두 통과**해야 한다.

### A) 원석 단가 입력해도 AP 총액이 불어나지 않아야 함
1. center/sub1/sub2 qty 입력
2. stone unit cost 입력(임의 값)
3. `total_amount_krw`는 비워둠
4. 저장
✅ 결과: 저장 payload의 `p_total_amount`(snapshot 총액)는 **labor_basic + labor_other 기반 합계**여야 한다. (원석단가 합 미포함)

### B) total_amount_krw 직접 입력 시 override가 유지되어야 함
1. `total_amount_krw`에 공장 청구 총액을 직접 입력
2. 저장
✅ 결과: 스냅샷/저장 총액은 입력값을 사용한다.

### C) 기존 기능 유지
- 라인 추가/삭제/확장/접기 정상
- 후보 선택/매칭추천/자동배분 정상
- 숫자 포맷/입력 UX 깨짐 없음
- 타입/린트/빌드 에러 0

---

## 6) 구현 후 셀프 체크(필수)
- `pnpm lint` / `pnpm typecheck` / `pnpm build` (프로젝트 명령어에 맞게)
- 최소 수동 테스트:
  - (A)와 (B) 시나리오 직접 재현
  - 자동배분 후 total 공란 저장 시에도 stone unit cost가 total에 포함되지 않는지 확인

---

## 7) PR 설명(간단히)
- Why: stone unit cost 입력이 snapshot total/AP 과대계상으로 이어질 수 있어, total 자동 계산에서 제외
- What: total 기본값 = labor_basic + labor_other, total override 입력 UI 제공, 문구 정정(“후보 비율”)

---

## 8) 주의: 백엔드 금지
다시 강조: 백엔드/SQL/RPC 수정 제안하지 말고, 프론트 변경만으로 요구사항 달성할 것.
