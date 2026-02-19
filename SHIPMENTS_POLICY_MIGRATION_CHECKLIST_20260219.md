# Shipments Pricing Policy Migration + Frontend Checklist

작성일: 2026-02-19

## Goal

- 출고 가격을 `영수증 원가 기반 + 마스터 마진 기반`으로 고정한다.
- DB 함수와 프론트 계산/표시를 1:1로 맞춘다.

## Final Policy (Locked)

1. 기본공임(판매) = 영수증 기본공임 원가 + 마스터 기본공임 마진
2. 알공임(판매) = 중심/보조1/보조2 각각 (영수증 알개수 x 마스터 알 판매단가)
3. 도금 자동행 = 도금 원가 + 도금 마진
4. 장식 자동행 = 항목별 원가 + 마진
5. 부속 공임 = 자동합산 금지(참고표시만)
6. prefill 단계부터 위 정책으로 자동 채움(사용자 override 허용)
7. SQL 함수와 프론트 계산식/저장 payload 정합성 1:1

## Execution Checklist

- [ ] Add-only 최신 타임스탬프 migration 생성
- [ ] `cms_fn_receipt_line_match_confirm_v6` 생성(정책 강제)
- [ ] 기존 `v5` 유지, 프론트 기본 호출 함수를 `v6`로 전환(환경변수 override 유지)
- [ ] v6에서 BASE_LABOR pricing_v5 rule 가산 제거(마스터 마진 기반으로 대체)
- [ ] v6에서 stone sell을 receipt qty x master stone sell 단가로 계산
- [ ] v6에서 plating/decor auto item 생성(부속/BOM reason 자동합산 제외)
- [ ] `extra_labor_items` evidence/meta를 프론트 해석 가능한 형태로 정규화
- [ ] `shipments/page.tsx` prefill 계산식과 auto-item 주입 규칙 동기화
- [ ] `shipment-receipt-prefill` API에서 필요한 receipt breakdown 필드 보강
- [ ] 저장 payload(`p_base_labor_krw`, `p_extra_labor_krw`, `p_extra_labor_items`) 정책 정합성 검증
- [ ] LSP diagnostics(수정 파일) clean 확인
- [ ] 타입체크/빌드/관련 테스트 실행 및 결과 기록

## Verification Scenarios

- [ ] BASE_LABOR rule(+20,000) 존재 환경에서도 기본공임이 `receipt + master margin`으로 계산됨
- [ ] 알공임이 role별 qty x unit sell 합계와 일치함
- [ ] 도금/장식 행이 자동 생성되고 합계에 반영됨
- [ ] 부속(BOM) 항목은 화면 참고표시만 되고 합계 자동반영되지 않음
- [ ] 저장 -> 재진입 시 값이 동일하게 복원됨
- [ ] 동일 입력으로 SQL 결과와 프론트 표시값이 동일함
