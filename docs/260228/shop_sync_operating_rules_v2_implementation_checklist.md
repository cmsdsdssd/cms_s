# Shopping Sync 운영 규칙 v2 구현 체크리스트 (260228)

## A. 문서/스펙
- [x] 운영 규칙 v2 문서 작성 (`shop_sync_operating_rules_v2.md`)
- [x] 구현 범위를 v2 기준으로 재동기화

## B. DB/마이그레이션
- [x] `sync_rule_r2_size_weight.linked_r1_rule_id` 컬럼 추가(FK)
- [x] 관련 인덱스 추가
- [x] 제약조건/무결성 확인

## C. API (룰 관리)
- [x] `GET/POST /api/sync-rules/r2`에 `linked_r1_rule_id` 입출력 반영
- [x] `linked_r1_rule_id` 유효성 검증(존재/활성)
- [x] 룰 preview 응답에 matched/unmatched/missing_rules 유지

## D. 저장 검증 (옵션 매핑)
- [x] `PUT /api/channel-products/[id]`에서 SYNC preflight 강화
- [x] R1 미매칭 시 저장 차단 (`SYNC_RULE_R1_REQUIRED`)
- [x] R2는 R1 소재 컨텍스트로만 매칭
- [x] R2에서 `linked_r1_rule_id` 지정 시 해당 R1 hit와 일치 강제
- [x] R3 미매칭 시 저장 차단

## E. 계산 엔진
- [x] recompute에서 R1 먼저 계산해 `effective_material_code` 확정
- [x] R2는 `effective_material_code` 기준 매칭
- [x] `linked_r1_rule_id` 조건 반영
- [x] 미매칭 옵션 차단 + `blocked_by_missing_rules` 반환
- [x] `breakdown_json`에 `effective_material_code`, `missing_rules` 기록

## F. Dashboard UX
- [x] SYNC 상세행의 안내문구를 v2 규칙 기준으로 통일
- [x] 저장 전 preview precheck에서 미등록 룰 발견 시 저장 차단
- [x] 미등록 샘플에 missing_rules 명시

## G. 검증
- [x] LSP diagnostics 0
- [x] migration 적용 성공
- [x] `npm run build` 성공
- [x] `npm run test:shipments-regression` 성공

## H. 마무리
- [x] 변경사항과 v2 문서의 필드/검증/에러코드 일치 확인
- [x] 체크리스트 전 항목 완료 처리
