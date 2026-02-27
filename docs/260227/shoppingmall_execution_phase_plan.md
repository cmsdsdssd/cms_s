# 쇼핑몰 가격관리 구현 실행 플랜 (Phase/주차/담당/시간)

## 0) 문서 메타
- 기준 문서:
  - `docs/260227/shoppingmall_prd_final.md`
  - `docs/260227/shoppingmall_erd_final.md`
  - `docs/260227/shoppingmall_implementation_master_checklist.md`
- 목적: 마스터 체크리스트를 실제 실행 일정/담당/공수 계획으로 변환
- 기준 인력:
  - BE(백엔드)
  - FE(프론트엔드)
  - DBA(데이터베이스)
  - QA(테스트)
  - PM(운영/릴리즈)

---

## 1) 체크리스트 최신화 운영 규칙 (필수)
- 모든 작업은 "작업 시작 전 -> in-progress 표기, 작업 완료 후 -> 체크([x]) + 완료일 + 담당자"를 같은 날 반영한다.
- PR/MR이 merge되기 전이라도, 로컬/스테이징에서 검증된 항목은 "조건부 완료"로 체크하고 비고에 `staging-pass`를 남긴다.
- 작업 증거는 반드시 남긴다.
  - 코드: 커밋/PR 링크
  - DB: 마이그레이션 파일명
  - 검증: 테스트 로그/스크린샷/쿼리 결과
- 매일 EOD(업무 종료 시) 체크리스트 최신화 담당:
  - BE 영역: BE 담당
  - FE 영역: FE 담당
  - 통합 상태 최종 반영: PM 담당

표기 규칙 예시:

```text
- [x] `DB-CH-001` `sales_channel` 테이블 생성 (2026-03-03, @dba, migration: 20260227110100_...)
- [ ] `API-PUSH-006` item별 before/after/status 저장 구현
```

---

## 2) 전체 일정 요약 (권장 6주)
- Phase 0 (0.5주): 착수 게이트/영향도 점검/환경 준비
- Phase 1 (1.5주): DB 1차 구축 (enum/테이블/인덱스/기초 뷰)
- Phase 2 (1.5주): Backend 핵심 (Pricing Engine + Cafe24 Connector + 핵심 API)
- Phase 3 (1.0주): Frontend 핵심 (채널/매핑/정책/Factor)
- Phase 4 (1.0주): 대시보드/동기화로그/Drawer/운영 UX
- Phase 5 (0.5주): 통합검증/성능/보안/릴리즈

총 예상 공수(가이드):
- BE 180h
- FE 130h
- DBA 70h
- QA 80h
- PM 35h

---

## 3) Phase 상세 계획

## Phase 0 - 착수/준비 (0.5주)

목표:
- 구현 전제/권한/외부 연동 준비 완료
- 체크리스트 업데이트 체계 정착

담당/예상시간:
- PM 10h, BE 8h, DBA 6h

필수 태스크:
- `GATE-001`~`GATE-012`
- `DISC-001`~`DISC-015`

완료 기준:
- 카페24 테스트 계정 연결 가능 상태
- 역할/권한/로그 정책 문서화 완료
- 마스터 체크리스트 업데이트 담당자 확정

---

## Phase 1 - DB 1차 구축 (1.5주)

목표:
- ERD 핵심 테이블/인덱스/뷰 생성
- Add-only 마이그레이션 안전 적용

담당/예상시간:
- DBA 44h, BE 22h, PM 4h

필수 태스크:
- `DB-ENUM-*`
- `DB-CH-*`
- `DB-POL-*`, `DB-FAC-*`, `DB-ADJ-*`, `DB-OVR-*`
- `DB-SNP-*`, `DB-CPR-*`, `DB-JOB-*`, `DB-BKT-*`
- `DB-VIEW-*`, `DB-RPC-*` (최소 필요범위)

주간 마일스톤:
- W1-D2: enum + channel/mapping 테이블 완료
- W1-D4: policy/factor/adjustment/override 완료
- W1-D5: snapshot/pull/push job 테이블 + 핵심 인덱스 완료
- W2-D1: `v_channel_price_dashboard` 1차 완성

완료 기준:
- 스테이징에 마이그레이션 순차 적용 성공
- rollback/재적용 절차 문서화
- 기본 샘플 데이터 삽입/조회 성공

---

## Phase 2 - Backend 핵심 (1.5주)

목표:
- 가격 계산 SoT 엔진 완성
- 카페24 연동 pull/push 백엔드 완성

담당/예상시간:
- BE 78h, DBA 10h, QA 12h

필수 태스크:
- `ENG-001`~`ENG-025`
- `CAF-001`~`CAF-014`
- `API-CH-*`, `API-AC-*`, `API-MAP-*`
- `API-POL-*`, `API-FAC-*`, `API-ADJ-*`, `API-OVR-*`
- `API-PRC-*`, `API-PULL-*`, `API-PUSH-*`, `API-JOB-*`
- `BE-QLT-*`

주간 마일스톤:
- W2-D3: 엔진 계산/스냅샷 저장 통합 통과
- W2-D5: pull API + snapshot 저장 통과
- W3-D2: push job/item 저장 + 부분실패 처리 통과
- W3-D3: 권한/보안 1차 통과

완료 기준:
- 단위 테스트/통합 테스트 핵심 케이스 pass
- 401/429/5xx 예외 처리 동작 검증

---

## Phase 3 - Frontend 핵심 (1.0주)

목표:
- 채널/매핑/정책/Factor 관리 UX 완성

담당/예상시간:
- FE 52h, BE 12h, QA 10h

필수 태스크:
- `FE-IA-*`
- `FE-CH-*`
- `FE-MAP-*`
- `FE-POL-*`, `FE-FAC-*`

주간 마일스톤:
- W3-D5: 채널설정/매핑 페이지 end-to-end 연결
- W4-D1: 정책/Factor 관리 페이지 연결

완료 기준:
- 운영자 기준 핵심 관리 플로우 수행 가능
- 입력 검증/에러 메시지/권한 가드 정상 동작

---

## Phase 4 - 대시보드/동기화 로그 (1.0주)

목표:
- 가격 대시보드 핵심 화면 + 상세 Drawer + 동기화 로그 완성

담당/예상시간:
- FE 56h, BE 26h, QA 18h

필수 태스크:
- `FE-DASH-*`
- `FE-DRW-*`
- `FE-LOG-*`
- `AUD-*`

주간 마일스톤:
- W4-D3: 대시보드 테이블/필터/정렬 완료
- W4-D4: Drawer(브레이크다운/adjustment/override) 완료
- W4-D5: 동기화 로그/에러 상세 완료

완료 기준:
- 대시보드에서 재계산/현재가조회/선택반영까지 1화면 운영 가능
- pull/push 이력 추적 가능

---

## Phase 5 - 통합검증/배포 (0.5주)

목표:
- 성능/보안/릴리즈 조건 충족 후 go-live 승인

담당/예상시간:
- QA 40h, BE 18h, FE 12h, PM 21h, DBA 10h

필수 태스크:
- `UT-*`, `IT-*`, `E2E-*`
- `PERF-*`
- `REL-*`
- `FG-*`
- `DOD-*`

완료 기준:
- FG 전항목 체크
- DOD 전항목 체크
- 운영 인수인계 완료

---

## 4) 주차별 운영 캘린더(예시)

Week 1
- Mon: Phase0 완료
- Tue~Fri: Phase1 DB 1차

Week 2
- Mon: Phase1 마감 + 스테이징 검증
- Tue~Fri: Phase2 Backend 1차

Week 3
- Mon~Wed: Phase2 Backend 마감
- Thu~Fri: Phase3 Frontend 핵심

Week 4
- Mon~Fri: Phase4 대시보드/로그

Week 5
- Mon~Wed: 통합 테스트 + 성능 튜닝
- Thu~Fri: 릴리즈/운영 전환

---

## 5) 리스크 및 완화 계획

1) 카페24 rate limit/응답 불안정
- 완화: backoff/retry + batch size 조절 + 비동기 job

2) 마스터 데이터 품질 이슈(중량/공임 null)
- 완화: 사전 데이터 품질 점검 + 계산 가드 + 에러 상태 분리

3) 대시보드 성능 저하
- 완화: latest 보조뷰 + 인덱스 + 페이지네이션

4) 권한/RLS 누락
- 완화: 권한별 테스트케이스 강제(`IT-010`)

5) 체크리스트 미갱신으로 상태 불명확
- 완화: EOD 갱신 의무 + PM 최종 확인

---

## 6) 산출물 체크 (이 문서 기준)
- [x] Phase별 일정 정의
- [x] 역할별 담당/시간 정의
- [x] 마일스톤 정의
- [x] 체크리스트 최신화 규칙 정의
- [x] 리스크/완화 계획 정의
