# Shipments 기타원가+마진 구현 계획

작성일: 2026-02-19

## 1) 목표

- `shipments`에서 `기타원가`를 prefill로 가져온 뒤,
- `기타원가` 옆에 `마진(원)` 입력칸을 추가하고,
- `기타공임(원)+마진`이 `기타원가 + 마진` 기준으로 계산/표시/저장되게 한다.

---

## 2) 현재 동작(근거)

### 2-1. 기타원가 prefill

- 상태값: `otherLaborCost` (`web/src/app/(app)/shipments/page.tsx:540`)
- prefill 우선순위:
  1. `shipment_extra_labor_items`에서 기타공임 추출 (`extractEtcLaborAmount`) -> `setOtherLaborCost` (`web/src/app/(app)/shipments/page.tsx:1073`, `web/src/app/(app)/shipments/page.tsx:1075`)
  2. `shipment_extra_labor_krw - stone_labor` (`web/src/app/(app)/shipments/page.tsx:1076`, `web/src/app/(app)/shipments/page.tsx:1079`)
  3. `selected_factory_labor_other_cost_krw` (`web/src/app/(app)/shipments/page.tsx:1080`, `web/src/app/(app)/shipments/page.tsx:1082`)
  4. `receipt_labor_other_cost_krw` (`web/src/app/(app)/shipments/page.tsx:1083`, `web/src/app/(app)/shipments/page.tsx:1085`)
- prefill API 노출 필드:
  - `shipment_extra_labor_krw`, `shipment_extra_labor_items`, `receipt_labor_other_cost_krw` (`web/src/app/api/shipment-receipt-prefill/route.ts:126`, `web/src/app/api/shipment-receipt-prefill/route.ts:127`, `web/src/app/api/shipment-receipt-prefill/route.ts:137`)

### 2-2. 기타공임 계산

- `resolvedEtcLaborItemsTotal = userEditableExtraLaborItems 합` (`web/src/app/(app)/shipments/page.tsx:2643`)
- `resolvedOtherLaborCost = parseNumber(otherLaborCost)` (`web/src/app/(app)/shipments/page.tsx:2673`)
- `resolvedEtcLaborTotal = 항목합 + 기타원가 + 자동장식공임` (`web/src/app/(app)/shipments/page.tsx:2675`)
- 현재 UI 마진 표시: `resolvedEtcLaborTotal - resolvedOtherLaborCost` (`web/src/app/(app)/shipments/page.tsx:3824`, `web/src/app/(app)/shipments/page.tsx:4288`)

### 2-3. 저장 payload

- 저장/확정 시 `p_extra_labor_krw`, `p_extra_labor_items` 전송
  - 업서트: `web/src/app/(app)/shipments/page.tsx:1775`, `web/src/app/(app)/shipments/page.tsx:1776`
  - 라인업데이트: `web/src/app/(app)/shipments/page.tsx:1845`, `web/src/app/(app)/shipments/page.tsx:1846`
  - 확정직전 업데이트: `web/src/app/(app)/shipments/page.tsx:2270`, `web/src/app/(app)/shipments/page.tsx:2271`

---

## 3) 목표 동작(정의)

- 새 입력: `기타원가 마진(원)`
- 최종 공식:
  - `기타공임(원)+마진 = 기타원가 + 기타원가마진`
- 기존 `기타공임 내역` 조정항목은 유지하되, 운영 규칙을 명확히 고정:
  - 옵션 A(권장): 조정항목은 별도 가감으로 유지, `기타원가마진`은 원가기반 마진 전용
  - 옵션 B: 조정항목 중 일부를 마진으로 흡수(비권장: 이중계상 위험)

본 계획은 옵션 A를 기준으로 한다.

---

## 4) 구현 방식 결정

### 4-1. 마이그레이션 여부

- 1차 릴리즈: **No migration**
- 이유:
  - 현재 저장 구조(`p_extra_labor_items` JSONB)로 마진값 직렬화 가능
  - 기존 DB/API 계약 변경 최소화

### 4-2. 직렬화 방식

- `extraLaborItems` 내 전용 marker item 추가
  - `type`: `ADJUSTMENT`
  - `meta.kind`: `ETC_COST_MARGIN`
  - `amount`: margin 값
- 저장 시 기존 payload 형식 유지 + marker 라인 포함

### 4-3. 역직렬화 방식

- prefill/hydration에서 marker 존재 시 해당 값을 `etcCostMargin` 상태로 복원
- marker 없으면 기존 방식 fallback:
  - `etcCostMargin = max(0, resolvedEtcLaborTotal - resolvedOtherLaborCost - (조정항목합 + 자동장식공임))`

---

## 5) 상세 구현 단계

### Phase 0: 안전 가시화

1. 상태 추가
   - `etcCostMargin`, `setEtcCostMargin`
2. UI만 추가(읽기 전용)
   - 데스크톱 `기타원가` 칩 옆에 `마진(원)` 필드
   - 모바일 동일 구조 반영
3. 값은 기존 계산식 기반으로 초기화(동작 변화 없음)

### Phase 1: 편집 가능 전환

1. `etcCostMargin` 입력 가능
2. 계산식 변경:
   - `etcCostWithMargin = resolvedOtherLaborCost + etcCostMargin`
   - `resolvedEtcLaborTotal` 산식에서 `resolvedOtherLaborCost` 대신 `etcCostWithMargin` 반영
3. `기타공임(원)+마진` UI는 위 새 합계 사용

### Phase 2: 저장/복원 일관화

1. `extraLaborPayload` 생성 시 `ETC_COST_MARGIN` marker 반영
2. prefill 로딩 시 marker 파싱하여 `etcCostMargin` 복원
3. marker가 없을 때 fallback 계산 적용

### Phase 3: 운영 보호장치

1. 이중계상 방지 검증
   - marker + 조정항목 중복 반영 여부 체크
2. `useManualLabor` 모드와 충돌 방지
   - 수동총공임 모드에서도 입력값은 유지하되 계산 우선순위 명시

---

## 6) 리스크 및 대응

1. **이중계상**
   - 원인: 조정항목/자동장식/마진 marker 중복
   - 대응: `meta.kind`로 분류하고 합산 규칙 고정

2. **기존 데이터 회귀**
   - 원인: marker 없는 과거 데이터
   - 대응: fallback 초기화 로직 유지

3. **수동총공임 모드 충돌**
   - 원인: 자동합산과 수동값 동시 반영
   - 대응: 저장 직전 우선순위 재검증

---

## 7) 검증 체크리스트

### 기능

- [ ] prefill 시 `기타원가`가 기존 우선순위대로 로드된다.
- [ ] `마진(원)` 입력 시 `기타공임(원)+마진`이 즉시 `원가+마진`으로 반영된다.
- [ ] 데스크톱/모바일 모두 동일하게 보인다.
- [ ] `기타공임 조정` 항목과 마진 marker가 중복 합산되지 않는다.

### 저장/복원

- [ ] 저장 후 재진입 시 `마진(원)` 값이 유지된다.
- [ ] marker 없는 기존 데이터도 정상 표시된다.
- [ ] 확정 직전 업데이트/확정 후 재조회에서 값이 일치한다.

### 회귀

- [ ] `useManualLabor` on/off 전환 시 값이 깨지지 않는다.
- [ ] 알공임/기본공임/총공임 계산에 신규 오류가 없다.
- [ ] 기존 build 에러를 제외하고 신규 타입/LSP 에러가 없다.

---

## 8) 적용 파일 목록

- `web/src/app/(app)/shipments/page.tsx`
  - 상태, 계산식, 데스크톱/모바일 UI, payload 직렬화/역직렬화
- (필요 시) `web/src/app/api/shipment-receipt-prefill/route.ts`
  - 기존 필드 유지(1차는 구조 변경 없음)

---

## 9) 릴리즈 권장 순서

1. Phase 0(읽기 전용 표시) 배포
2. Phase 1(편집 + 계산 반영) 배포
3. Phase 2(직렬화/복원 강화) 배포
4. 운영 데이터 점검 후 필요하면 DB 정식 컬럼 도입(Phase 4, 별도)
