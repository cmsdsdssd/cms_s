# 채널 옵션 중앙 제어 구현 체크리스트

- 상태 기준
  - `[ ]` 미시작
  - `[-]` 진행중
  - `[x]` 완료

## 문서 고정

- [x] PRD 문서 고정: `docs/plans/2026-03-07-channel-option-central-control-prd.md`
- [x] ERD 문서 고정: `docs/plans/2026-03-07-channel-option-central-control-erd.md`
- [x] 구현 계획 문서 고정: `docs/plans/2026-03-07-channel-option-central-control-implementation-plan.md`

## 설계 기준

- [x] 중앙 규칙 스코프는 채널별
- [x] 상품 화면은 허용값만 선택
- [x] 규칙 겹침은 누적 가산
- [x] legacy 값은 유지 + 경고
- [x] 색상/장식/기타 금액은 100원~1,000,000원 / 100원 단위
- [x] 기타는 사유 필수 + 이력 저장

## 구현 태스크

- [x] 기존 `rules` / `option-labor-rules` 재사용 지점 확정
- [x] 중앙 규칙 canonical helper 추가
- [x] 신규 central-control 테스트 파일 추가
- [x] 중앙 규칙 API 추가
- [x] 상품 옵션 매핑 API 추가
- [x] 매핑 로그 API 추가
- [x] resolution trace 저장 경로 추가
- [x] legacy backfill을 `channel_option_category_v2`와 `channel_option_labor_rule_v1` 둘 다에서 수행
- [x] `rules/page.tsx`를 중앙 규칙 UI로 재편
- [x] `auto-price/page.tsx`를 새 매핑 모델 소비형으로 전환
- [x] variant 추가금 계산을 canonical resolved mapping 기반으로 교체
- [x] legacy warning UI 추가
- [x] 기타 사유 저장/표시 추가

## 검증

- [x] 수정 파일 LSP diagnostics 0
- [x] `web/tests/channel-option-central-control.test.mjs` 통과
- [x] 영향 기존 테스트 통과
- [x] `npm run build` 통과
- [x] 문서 체크리스트 최신화 완료
