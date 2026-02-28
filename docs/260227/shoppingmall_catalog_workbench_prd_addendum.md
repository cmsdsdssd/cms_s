# PRD Addendum: Catalog-Style 쇼핑몰 가격 운영 워크벤치

- 문서 버전: v1.0
- 작성일: 2026-02-27
- 기준 문서:
  - `docs/260227/shoppingmall_prd_final.md`
  - `docs/260227/shoppingmall_erd_final.md`
- 목적: 기존 쇼핑몰 가격 대시보드를 운영용 Catalog 스타일 워크벤치로 고도화

---

## 1. 배경

현재 대시보드는 기능은 있으나 운영자 관점에서 다음이 부족하다.

1. 대량 상품 스캔/정렬/선택/일괄반영 흐름이 느리다.
2. 상단에서 시세/기준 factor/default 적용 상태를 한눈에 보기 어렵다.
3. "전체 쇼핑몰 기본값"과 "쇼핑몰별 override"가 동시에 보이는 구조가 약하다.
4. 배치 반영 전 검증(diff preview, 제외 사유, 실패 재처리) 가이드가 약하다.

---

## 2. 목표

1. `catalog` 페이지 수준의 리스트 UX를 쇼핑몰 가격 운영에 도입한다.
2. 상단 Summary + Filters + Batch Action Bar + 대형 Table + Detail Drawer의 5영역 구조를 확정한다.
3. 설정 fallback 규칙을 명확히 한다.
   - Global default -> Channel default -> Item override 순으로 적용
4. 10분 자동 동기화 운영과 수동 일괄반영 운영을 동일 화면에서 추적한다.

---

## 3. 비목표

1. 타 채널(네이버/쿠팡) 실연동 구현
2. 옵션(variant)별 독립 가격관리
3. 승인 워크플로우(결재선) 정식 구현

---

## 4. 핵심 사용자 시나리오

1. 운영자가 채널 선택 후 상단 시세/기준값 확인
2. 테이블에서 diff 큰 항목 우선 정렬 후 다중 선택
3. 일괄 적용 전 "변경 예정 diff"와 "제외 항목" 검토
4. 일괄 push 실행 후 성공/실패를 행 단위로 즉시 확인
5. 실패만 필터링해 재시도

---

## 5. UX/IA 요구사항

## 5.1 상단 Summary Bar

- 표시 항목
  - 금/은 시세 (as-of timestamp 포함)
  - 적용 정책: margin, rounding
  - 적용 factor set: global/channel 출처
  - 데이터 freshness: last pull / last recompute / last push
- 규칙
  - 값은 항상 "현재 필터 기준"인지 명시
  - 로딩은 spinner 대신 skeleton 사용

## 5.2 Filter + Query Zone

- 기본 필터
  - channel, price_state, model_name, diff 임계값, override만, adjustment만, 실패만
- 확장 필터
  - material_code, weight range, computed_at range
- 테이블 헤더 정렬
  - diff_krw, diff_pct, model_name, computed_at

## 5.3 Table Zone (Catalog-style)

- 기본 컬럼
  - 선택, 모델, product_no, target, current, diff, diff%, state, adjustment_count, override_flag
- 확장 컬럼
  - material_code, net_weight_g, factor source(global/channel), tick_as_of, last_sync_status
- 사용성 규칙
  - 숫자 우측 정렬 + tabular numerals
  - 페이지네이션 기본 20건
  - 일괄 선택 시 batch action bar 활성화
  - batch mode에서는 row 단일 액션 비활성화

## 5.4 Batch Action Bar

- 표시 조건: 선택 row >= 1
- 액션
  - pull selected
  - recompute selected
  - push selected
  - deselect all
- 안전장치
  - apply 전 preview step 강제
  - 제외 대상(가격 없음, 매핑 없음, 권한 없음) 사유 노출

## 5.5 Detail Drawer

- 행 클릭 시 우측 Drawer 오픈
- 필수 섹션
  - 산식 breakdown
  - active adjustment 목록 + CRUD
  - override 상태 + CRUD
  - 최근 pull/push 로그
  - 실패 원인(raw error 요약)

---

## 6. 기본값/Override 정책 (요구사항 고정)

"Default는 settings에서 저장된 값" 규칙을 다음 우선순위로 고정한다.

1. Item override (있는 경우)
2. Channel 정책 값 (`pricing_policy`, channel factor set)
3. Global default factor set (`material_factor_set.is_global_default=true`)
4. 시스템 기본값 (1.0, rounding 1000 CEIL)

---

## 7. 기능 요구사항 (Addendum)

- FRW-001: Summary API 추가(시세/정책/freshness 집계)
- FRW-002: 대시보드 정렬/필터 고도화(diff, 상태, 실패)
- FRW-003: Batch preview API(적용 예정/제외 사유)
- FRW-004: Batch mode UX(선택/해제/일괄액션)
- FRW-005: Drawer 기반 adjustment/override 운영
- FRW-006: 작업 결과 레퍼런스(job_id, change_set_id) 표기
- FRW-007: 자동동기화(10분) 상태를 화면에서 확인

---

## 8. 수용 기준

1. 운영자가 500건 목록에서 diff 상위 상품 선별 후 3클릭 내 일괄 push 가능
2. push 전 preview에 변경건/제외건/사유가 100% 표시
3. 실패 row는 코드/메시지와 재시도 경로를 제공
4. factor fallback 출처(global/channel/item)가 각 row에서 확인 가능
5. 상단 Summary의 시세/기준값 시각이 pull/recompute 결과와 일치

---

## 9. 리스크 및 완화

1. 대량 조회 성능 저하
   - 해결: 최신 스냅샷 전용 view + 인덱스 + 페이지네이션 고정
2. 운영자 오조작
   - 해결: batch preview, 부분 실패 명확화, deselect/undo UX
3. 설정 충돌(global vs channel)
   - 해결: 우선순위와 출처를 row/summary에 모두 표시

---

## 10. 구현 우선순위

1. Summary + 정렬/필터 고도화
2. Batch preview + batch mode UX
3. Drawer 운영 기능(adjustment/override)
4. 자동동기화 상태 표시 + 실패 재처리 UX

---

## 11. 구현 앵커(기존 Catalog 패턴 재사용)

아래 파일 패턴을 우선 재사용한다.

1. `web/src/app/(app)/catalog/page.tsx`
   - ActionBar + Filter + Selection mode + Pagination 구조
2. `web/src/components/layout/action-bar.tsx`
   - 상단 고정 액션영역 레이아웃
3. `web/src/components/layout/split-layout.tsx`
   - 리스트/상세 분할 레이아웃
4. `web/src/app/(app)/factory_po_history/_components/PoList.tsx`
   - TanStack Table 정렬/헤더 패턴(필요 시)
