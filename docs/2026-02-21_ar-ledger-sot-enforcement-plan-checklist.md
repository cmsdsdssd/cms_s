# AR 원장 SOT 강제 구현 계획서 (ADDONLY)

작성일: 2026-02-21

## 1) 목표

- 확정/잠금된 출고 건의 금액/중량 표시는 AR 원장 스냅샷(`cms_ar_invoice`)만 사용한다.
- UI/리포트에서 shipment 기반 추정/역산 fallback을 제거한다.
- snapshot 결손은 추정값으로 대체하지 않고 `결손 상태`로 명시한다.

## 2) 비목표

- 과거 전표를 자동으로 재산정하지 않는다.
- 잠금 이후 원본 principal을 수정하지 않는다.

## 3) 현재 리스크(근거)

- AR 상세에 invoice fallback 존재:
  - `web/src/app/(app)/ar/page.tsx`
  - `web/src/app/(app)/ar/v2/page.tsx`
- 영수증 식에 inferred rate fallback 존재:
  - `web/src/components/receipt/receipt-print.tsx`

## 4) 구현 원칙

- 잠금건(`confirmed + ar_principal_locked`)은 `invoice snapshot only`.
- snapshot 필드 누락 시 `표시 차단 + 결손 안내`.
- draft/미확정 프리뷰만 추정 허용.

## 5) 작업 체크리스트

### A. 문서/정책

- [ ] A1. SOT 상태 정책 확정: DRAFT / LOCKED
- [ ] A2. snapshot 필수 필드 정의
- [ ] A3. null/0 의미 정의

### B. AR 상세 화면

- [ ] B1. `ar/page.tsx`에서 `invoiceWeight ?? ...` fallback 제거
- [ ] B2. `ar/page.tsx`에서 `invoicePrice ?? ...` fallback 제거
- [ ] B3. snapshot 결손 경고 UI 추가
- [ ] B4. `ar/v2/page.tsx` 동일 수정

### C. 영수증 화면

- [ ] C1. `receipt-print.tsx` inferred rate(`materialSell / pureWeight`) 제거
- [ ] C2. `receipt-print.tsx` 계산식 표시를 snapshot 기반으로 고정
- [ ] C3. snapshot 결손 시 `원장 스냅샷 없음` 문구 노출

### D. 영수증 데이터 공급자

- [ ] D1. `shipments_print/page.tsx`에서 line별 AR invoice snapshot 조회/병합
- [ ] D2. `receipts/daily/page.tsx`에서 line별 AR invoice snapshot 조회/병합
- [ ] D3. Receipt line 타입에 snapshot 필드 추가

### E. 검증

- [ ] E1. LSP diagnostics clean (수정 파일 전부)
- [ ] E2. 회귀 테스트 실행 (`npm run test:shipments-regression`)
- [ ] E3. 스모크: 잠금건 20건 샘플에서
  - `material_cash_due_krw == commodity_due_g * commodity_price_snapshot_krw_per_g`
  - UI 계산식이 shipment fallback을 쓰지 않음

## 6) 완료 기준 (DoD)

- 잠금건에서 AR 상세/영수증의 금속 계산 근거가 AR snapshot 100%.
- fallback 추정식 코드 제거 확인.
- snapshot 결손 케이스는 추정 대신 결손 경고로 처리.
- 회귀 테스트/스모크 결과를 운영 보고서에 첨부.
