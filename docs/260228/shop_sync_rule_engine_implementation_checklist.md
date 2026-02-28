# Shopping SYNC Rule Engine 구현 체크리스트 (260228)

## A. 계획/범위
- [x] PRD(`shop_sync_rule_engine_prd.md`) 기준 범위 확정
- [x] 구현 단위 태스크 세분화

## B. DB 스키마
- [x] `sync_rule_set` 테이블 생성
- [x] `sync_rule_r1_material_delta` 테이블 생성
- [x] `sync_rule_r2_size_weight` 테이블 생성
- [x] `sync_rule_r3_color_margin` 테이블 생성
- [x] `sales_channel_product.sync_rule_set_id` 추가
- [x] 인덱스/제약조건/권한(grant) 반영

## C. API
- [x] `GET/POST /api/sync-rule-sets`
- [x] `PUT/DELETE /api/sync-rule-sets/[id]`
- [x] `GET/POST /api/sync-rules/r1`
- [x] `GET/POST /api/sync-rules/r2`
- [x] `GET/POST /api/sync-rules/r3`
- [x] `POST /api/sync-rules/bulk-adjust`
- [x] `POST /api/sync-rules/preview`

## D. 계산 엔진
- [x] recompute에서 `SYNC` 시 룰셋 기반 R1 계산 적용
- [x] recompute에서 `SYNC` 시 룰셋 기반 R2 계산 적용
- [x] recompute에서 `SYNC` 시 룰셋 기반 R3 계산 적용
- [x] R4 전역 정책(마진/라운딩) 분리 적용 보장
- [x] `breakdown_json.rule_hit_trace` 기록

## E. Dashboard UX
- [x] 옵션 편집에서 배수/증분/고정추가 직접입력 제거
- [x] `SYNC` 모드에서 룰셋 선택 UI 추가
- [x] `MANUAL` 모드에서 수동 목표가만 편집 가능
- [x] 룰 미리보기(적용 delta/매칭룰) 표시

## F. 검증
- [x] 신규 migration 적용
- [x] 수정 파일 LSP diagnostics 0
- [x] `npm run build` 성공
- [x] 관련 테스트 성공

## G. 운영 반영
- [x] 문서와 실제 구현 필드/엔드포인트 이름 일치 점검
- [x] 남은 TODO 없음 확인
