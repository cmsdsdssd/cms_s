# 공장발주(팩스) → 출고대기 → 출고 워크플로우 테스트 체크리스트

## 1. 데이터베이스 마이그레이션 검증

### 1.1 테이블 생성 확인
```sql
-- 새 테이블 확인
SELECT * FROM cms_factory_po LIMIT 1;
SELECT * FROM cms_factory_po_line LIMIT 1;
SELECT * FROM cms_fax_log LIMIT 1;
SELECT * FROM cms_vendor_fax_config LIMIT 1;

-- 뷰 확인
SELECT * FROM cms_v_unshipped_order_lines LIMIT 1;
SELECT * FROM cms_v_factory_po_summary LIMIT 1;
```

### 1.2 컬럼 추가 확인
```sql
-- cms_order_line 컬럼 확인
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cms_order_line' 
AND column_name IN ('factory_po_id', 'sent_to_vendor_at', 'inbound_at', 'shipped_at', 'vendor_prefix');
```

**예상 결과**: 5개 컬럼 모두 존재

### 1.3 인덱스 확인
```sql
-- 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('cms_order_line', 'cms_factory_po', 'cms_factory_po_line', 'cms_fax_log');
```

**예상 결과**: 
- idx_cms_order_line_vendor_prefix
- idx_cms_order_line_factory_po_id
- idx_cms_order_line_status_sent_at
- idx_cms_factory_po_vendor_prefix
- idx_cms_factory_po_status
- idx_cms_factory_po_line_po_id
- idx_cms_factory_po_line_order_line_id

### 1.4 트리거 확인
```sql
-- 트리거 확인
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'cms_trg_order_line_extract_prefix';
```

## 2. RPC 함수 검증

### 2.1 공장발주 생성 테스트
```sql
-- 테스트용 주문 라인 ID 준비 (ORDER_PENDING 상태)
SELECT order_line_id 
FROM cms_order_line 
WHERE status = 'ORDER_PENDING' 
AND factory_po_id IS NULL 
AND vendor_prefix IS NOT NULL
LIMIT 5;

-- RPC 호출 테스트
SELECT cms_fn_factory_po_create_from_order_lines(
    ARRAY['{order_line_id_1}', '{order_line_id_2}']::uuid[],
    NULL -- actor_person_id
);
```

**검증 포인트**:
- [ ] 정상적으로 PO가 생성됨
- [ ] vendor_prefix별로 그룹핑됨
- [ ] cms_factory_po_line에 연결 레코드 생성됨
- [ ] cms_order_line.factory_po_id가 업데이트됨

### 2.2 PO 전송 마킹 테스트
```sql
-- 생성된 PO ID 확인
SELECT po_id FROM cms_factory_po WHERE status = 'DRAFT' LIMIT 1;

-- 전송 마킹 테스트
SELECT cms_fn_factory_po_mark_sent(
    '{po_id}'::uuid,
    '{"success": true, "provider": "mock", "payload_url": "https://example.com/fax.pdf"}'::jsonb,
    NULL
);
```

**검증 포인트**:
- [ ] PO 상태가 'SENT_TO_VENDOR'로 변경됨
- [ ] cms_order_line.status가 'SENT_TO_VENDOR'로 업데이트됨
- [ ] sent_to_vendor_at 타임스탬프 기록됨
- [ ] cms_fax_log에 로그 생성됨
- [ ] cms_decision_log에 감사 기록 생성됨

### 2.3 영수증 연결 테스트
```sql
-- receipt_id와 연결할 order_line_id 준비
SELECT cms_fn_receipt_attach_to_order_lines(
    '{receipt_id}'::uuid,
    ARRAY['{order_line_id}']::uuid[],
    now(),
    NULL
);
```

**검증 포인트**:
- [ ] inbound_at이 설정됨
- [ ] status가 'READY_TO_SHIP'으로 변경됨
- [ ] 이미 SHIPPED된 라인은 업데이트되지 않음

### 2.4 출고 마킹 테스트
```sql
SELECT cms_fn_mark_shipped(
    ARRAY['{order_line_id}']::uuid[],
    now(),
    NULL
);
```

**검증 포인트**:
- [ ] status가 'SHIPPED'으로 변경됨
- [ ] shipped_at 타임스탬프 기록됨

## 3. 프론트엔드 통합 테스트

### 3.1 주문관리 페이지 (orders_main)

**접속**: `/orders_main`

- [ ] 상단 툴바에 "공장발주" 버튼 표시됨
- [ ] 버튼에 미발주 주문 개수 배지 표시됨
- [ ] 버튼 클릭 시 Factory Order Wizard 모달 열림
- [ ] 모달 로딩 중 스피너 표시됨

### 3.2 Factory Order Wizard

**기능 테스트**:
- [ ] 공장(vendor_prefix)별 탭 표시됨
- [ ] 좌측에 주문 라인 목록 표시됨 (거래처/모델/색상/사이즈/수량/도금/비고)
- [ ] 색상/도금이 컬러칩으로 표시됨
- [ ] 행 클릭 시 석 상세 정보 확장됨
- [ ] 우측에 팩스 미리보기 렌더링됨 (표 형태)
- [ ] "인쇄" 버튼 클릭 시 브라우저 인쇄 다이얼로그 열림
- [ ] "팩스 전송" 버튼 클릭 시 API 호출됨
- [ ] 전송 성공 시 토스트 메시지 표시됨
- [ ] 전송 성공 시 주문 상태가 'SENT_TO_VENDOR'로 변경됨

### 3.3 출고관리 페이지 (shipments_main)

**접속**: `/shipments_main`

- [ ] 미출고 내역 카운트 정확히 표시됨
  - 전체 미출고
  - 공장발주완료 (SENT_TO_VENDOR)
  - 출고대기 (WAITING_INBOUND + READY_TO_SHIP)
- [ ] cms_v_unshipped_order_lines 뷰에서 데이터 로드됨
- [ ] 상태별 필터 작동함
- [ ] 고객별 필터 작동함
- [ ] 행 클릭 시 선택/해제됨
- [ ] 다중 선택 후 "출고 생성" 버튼 활성화됨
- [ ] 각 행에 상태 뱃지 표시됨
  - 공장발주완료: 파란색
  - 입고대기: 노란색
  - 출고대기: 초록색

### 3.4 출고 입력 페이지 연동

**접속**: `/shipments?order_line_ids={ids}`

- [ ] URL 파라미터로 전달된 order_line_ids가 출고라인으로 추가됨
- [ ] 선택된 주문들이 출고헤더에 자동으로 연결됨

## 4. API 엔드포인트 테스트

### 4.1 팩스 전송 API

**Endpoint**: `POST /api/fax-send`

```bash
curl -X POST http://localhost:3000/api/fax-send \
  -H "Content-Type: application/json" \
  -d '{
    "po_id": "{po_uuid}",
    "vendor_prefix": "A",
    "html_content": "<html><body>Test</body></html>",
    "provider": "mock"
  }'
```

**예상 응답**:
```json
{
  "success": true,
  "po_id": "...",
  "fax_result": {
    "success": true,
    "provider": "mock",
    "payload_url": "..."
  }
}
```

**검증 포인트**:
- [ ] mock 모드에서는 PDF/Storage에 저장됨
- [ ] 실제 provider(twilio 등)는 환경변수로 설정 가능
- [ ] 실패 시 적절한 에러 응답 반환

## 5. 엣지 케이스 테스트

### 5.1 중복 발주 방지
- [ ] 이미 factory_po_id가 있는 주문은 PO 생성 시 제외됨
- [ ] PO 생성 시 이미 다른 PO에 포함된 라인은 경고/제외됨

### 5.2 팩스번호 누락
- [ ] cms_vendor_fax_config에 팩스번호가 없으면 전송 버튼 비활성화
- [ ] UI에 "설정에서 팩스번호 등록 필요" 안내 표시

### 5.3 팩스 전송 실패
- [ ] 전송 실패 시 상태 전환되지 않음
- [ ] cms_fax_log에 실패 로그 남음
- [ ] 재시도 가능한 UI 제공

### 5.4 이미 출고된 주문 처리
- [ ] SHIPPED 상태 주문은 PO 생성 대상에서 제외됨
- [ ] 영수증 등록 시 이미 SHIPPED된 주문은 inbound_at만 업데이트, status는 변경하지 않음

## 6. 성능 검증

### 6.1 쿼리 성능
```sql
-- 뷰 쿼리 성능 체크
EXPLAIN ANALYZE
SELECT * FROM cms_v_unshipped_order_lines
WHERE customer_party_id = '{some_id}'
LIMIT 100;
```

**기준**: 100ms 이내

### 6.2 인덱스 사용 확인
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM cms_order_line
WHERE vendor_prefix = 'A'
AND status = 'ORDER_PENDING';
```

**검증**: Index Scan 사용 확인

## 7. 보안 및 권한 검증

### 7.1 RLS 정책 (필요시 추가)
- [ ] authenticated 롤이 모든 테이블에 접근 가능
- [ ] service_role이 관리 작업 가능

### 7.2 RPC 권한
```sql
-- 권한 확인
SELECT has_function_privilege('authenticated', 'cms_fn_factory_po_create_from_order_lines(uuid[], uuid)', 'EXECUTE');
```

## 8. 마이그레이션 롤백 테스트 (개발 환경)

**주의**: 프로덕션에서는 실행하지 마세요

```sql
-- 테스트용 롤백 (개발 환경 전용)
-- DROP TABLE IF EXISTS cms_factory_po_line CASCADE;
-- DROP TABLE IF EXISTS cms_factory_po CASCADE;
-- DROP TABLE IF EXISTS cms_fax_log CASCADE;
-- DROP TABLE IF EXISTS cms_vendor_fax_config CASCADE;
-- DROP VIEW IF EXISTS cms_v_unshipped_order_lines CASCADE;
-- DROP VIEW IF EXISTS cms_v_factory_po_summary CASCADE;
```

## 9. 통합 시나리오 테스트

### 시나리오 1: 정상 플로우
1. [ ] 주문 등록 (ORDER_PENDING)
2. [ ] 공장발주 생성 (DRAFT)
3. [ ] 팩스 전송 (SENT_TO_VENDOR)
4. [ ] 영수증 등록 (READY_TO_SHIP)
5. [ ] 출고 확정 (SHIPPED)
6. [ ] 각 단계별 타임스탬프 확인

### 시나리오 2: 다중 공장
1. [ ] A-001, A-002 (공장 A)
2. [ ] B-001, B-002 (공장 B)
3. [ ] 공장발주 시 자동으로 2개 PO 생성됨
4. [ ] 각 PO별로 개별 팩스 전송 가능

### 시나리오 3: 부분 출고
1. [ ] 주문 수량: 10개
2. [ ] 1차 출고: 3개 (status: READY_TO_SHIP 유지)
3. [ ] 2차 출고: 7개 (status: SHIPPED)
4. [ ] 누적 출고량 추적 확인

## 10. 문서 및 로깅 확인

- [ ] cms_decision_log에 모든 상태 변경 기록됨
- [ ] cms_fax_log에 팩스 전송 이력 기록됨
- [ ] cms_status_event에 상태 전환 이력 기록됨 (기존 테이블)

---

## 테스트 완료 확인

- [ ] 모든 마이그레이션 SQL 실행 완료
- [ ] 모든 RPC 함수 생성 완료
- [ ] 프론트엔드 컴포넌트 배포 완료
- [ ] API 라우트 테스트 완료
- [ ] 통합 시나리오 테스트 완료
- [ ] 성능 테스트 완료
- [ ] 문서 업데이트 완료

**최종 확인일**: ___________
**테스트 담당자**: ___________
