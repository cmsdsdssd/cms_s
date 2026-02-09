[목표/배경]
AP(운영) 화면은 “공장 미수(거래 후 미수 = POST_BALANCE)”와 “우리 결제 내역”만으로 운영이 가능해야 한다.
현재 /ap는 내부 FIFO 인보이스(증가분 SALE)까지 노출되어 운영자가 ‘당일 매입/증가분’과 ‘현재 잔액(POST)’을 혼동한다.
결제는 매우 민감하므로, AP 화면은 절대 혼란을 주면 안 되고, 정합성/감사는 AP Reconcile에서 구체적으로 확인한다.

[백엔드 전제 (이미 DB에 반영되어 있다고 가정)]
1) 신규 뷰/함수
- cms_v_ap_factory_latest_receipt_by_vendor_v1
- cms_v_ap_factory_post_balance_by_vendor_v1              (공장 POST 잔액)
- cms_v_ap_factory_recent_payment_by_vendor_v1           (공장 RECENT_PAYMENT)
- cms_v_ap_payment_history_by_vendor_v1                  (우리 결제내역)
- cms_v_ap_balance_by_vendor_v1                           (시스템 net balance)
- cms_fn_ap_run_reconcile_for_receipt_v2                  (reconcile 강화)
- cms_fn_upsert_factory_receipt_statement_v2              (4행저장 RPC v2: sync + reconcile v2)
- cms_fn_ap2_pay_and_fifo_guarded_v1                      (결제 가드: ERROR 있으면 결제 차단)
2) reconcile 이슈 타입 추가
- FACTORY_POST_NEQ_SYSTEM_ASOF
(기존 RECENT_PAYMENT_INCONSISTENT 등도 사용)

[요구사항(핵심)]
A) /ap (운영)
- 기본 탭/기본 뷰는 “공장 미수(POST)” 중심으로 구성
- 공장 기준 현재 미수(POST_BALANCE)와 기준 영수증(issued_at, bill_no) 표시
- 우리 결제 내역(날짜/메모/금/은/공임)을 리스트로 표시 (최근순)
- “현재 남은 미수”는 아래 2가지를 같이 보여서 혼선을 막기:
  1) 공장 POST 잔액(공장 기준)
  2) 시스템 잔액(우리 장부 기준; cms_v_ap_balance_by_vendor_v1 또는 기존 apPositionByVendorNamed)
  3) 차이(diff) 표시 + diff 있으면 “Reconcile 필요” 배지/링크
- 결제 입력은 기존대로 제공하되:
  - 결제 RPC는 반드시 cms_fn_ap2_pay_and_fifo_guarded_v1 사용(백엔드 차단)
  - 화면에서도 vendor에 OPEN/ACKED ERROR가 있으면 결제 UI를 disabled + 안내(이중 안전)
- 내부 FIFO 인보이스(증가분 SALE)는 운영 기본 화면에서 제거/숨김:
  - 원칙: 기본 탭에서 제거
  - 필요하면 ‘고급/감사(내부 FIFO)’ 접기 섹션으로만 노출 + 경고문구(운영용 아님)

B) /ap/reconcile (감사/정합)
- 신규 이슈 타입/검사 결과가 운영자가 이해되도록 라벨링/설명 추가:
  - FACTORY_POST_NEQ_SYSTEM_ASOF: “공장 POST(거래 후 미수)와 시스템 잔액(as-of) 불일치”
  - RECENT_PAYMENT_INCONSISTENT: “공장 최근결제와 시스템 결제내역 불일치”
  - FACTORY_SALE_NEQ_INTERNAL_CALC: “당일 합계(SALE)와 라인 계산 불일치”
- 이슈 상세에 expected/actual/diff leg(자산별) 테이블을 더 읽기 쉽게 표시(이미 issue_leg가 있으면 그걸 사용)
- 이슈가 ERROR이면 /ap 결제 버튼이 막히는 이유를 화면에서 안내(“결제 차단됨: reconcile ERROR 해결 필요”)

C) /new_receipt_line_workbench (4행 저장)
- 4행 저장 RPC는 v2로 전환:
  - CONTRACTS.functions.factoryReceiptStatementUpsert 를 v2로 바꾸거나
  - 환경변수 오버라이드 지원(충돌 방지): NEXT_PUBLIC_CMS_FN_FACTORY_RECEIPT_STATEMENT_UPSERT
- v2 응답 형태가 기존과 동일하게 result.reconcile.issue_counts 를 포함하므로,
  기존 UI(“warn/error 카운트 표시”)가 깨지지 않게 유지

[필수 수정 파일(권장 경로)]
1) web/src/lib/contracts.ts
- views 추가:
  - apFactoryLatestReceiptByVendor: "cms_v_ap_factory_latest_receipt_by_vendor_v1"
  - apFactoryPostBalanceByVendor: "cms_v_ap_factory_post_balance_by_vendor_v1"
  - apFactoryRecentPaymentByVendor: "cms_v_ap_factory_recent_payment_by_vendor_v1"
  - apPaymentHistoryByVendor: "cms_v_ap_payment_history_by_vendor_v1"
  - apBalanceByVendor: "cms_v_ap_balance_by_vendor_v1"
- functions 변경/추가(충돌 방지: env override 먼저, 없으면 v2/guarded 디폴트)
  - factoryReceiptStatementUpsert:
      process.env.NEXT_PUBLIC_CMS_FN_FACTORY_RECEIPT_STATEMENT_UPSERT || "cms_fn_upsert_factory_receipt_statement_v2"
  - apPayAndFifo:
      process.env.NEXT_PUBLIC_CMS_FN_AP_PAY_AND_FIFO || "cms_fn_ap2_pay_and_fifo_guarded_v1"

2) web/src/app/(app)/ap/page.tsx
- 현재 버그: summary가 전체 vendors 합산인데 상단 카드에서 selected vendor처럼 표시됨 → 반드시 수정
  - globalSummary(사이드바 “전체 공장미수(공임)”)는 전체 합산 유지
  - vendorSummary(상단 카드)는 selectedVendorId 기준으로 필터링 합산
- 탭 구성 변경:
  - 기본 탭: “공장 미수(POST)”
  - 탭2: “결제 내역”
  - 탭3: “결제 처리”
  - (옵션) 고급 접힘: “내부 FIFO(감사)” — 기존 invoiceQuery는 여기로 이동
- 신규 쿼리 추가(react-query):
  - factoryPostQuery: CONTRACTS.views.apFactoryPostBalanceByVendor, eq(vendor_party_id)
  - factoryRecentPaymentQuery: CONTRACTS.views.apFactoryRecentPaymentByVendor, eq(vendor_party_id)
  - paymentHistoryQuery: CONTRACTS.views.apPaymentHistoryByVendor, eq(vendor_party_id), order(paid_at desc)
  - systemBalanceQuery: CONTRACTS.views.apBalanceByVendor, eq(vendor_party_id)
  - reconcileOpenQuery: CONTRACTS.views.apReconcileOpenByVendorNamed, eq(vendor_party_id)  (error_count, warn_count)
- 결제 버튼 가드(프론트):
  - error_count>0 && status in OPEN/ACKED 이면 결제 submit disabled + “Reconcile로 이동” 버튼 제공
  - 그래도 backend에서도 막히므로, RPC 에러 메시지에 PAYMENT_BLOCKED가 포함되면 toast를 더 친절하게(링크 포함) 안내

3) web/src/app/(app)/ap/reconcile/page.tsx
- issue_type 라벨 매핑에 신규 타입 추가(사용자 친화적으로)
- 이슈 디테일에서 issue_leg(expected/actual/diff) 목록이 있으면 자산 라벨로 예쁘게 렌더링
- “AP 결제 차단”에 대한 안내 배지/도움말(선택 vendor에 ERROR 존재 시)

4) web/src/app/(app)/new_receipt_line_workbench/receipt-line-workbench.tsx
- factoryStatementUpsert RPC가 v2로 바뀐 계약명을 사용하도록(contracts 변경만으로 해결 가능)
- v2 응답 구조(result.reconcile.issue_counts)가 기존과 동일하게 반영되는지 확인
- (중요) 4행 저장 직후: reconcileQuery.invalidate/refetch 유지

[UI 텍스트/표기 규칙(운영 혼선 방지)]
- “SALE” 라는 용어는 운영(AP) 화면에서 노출 금지
  - 고급(감사) 섹션에서만 “증가분(당일 거래)” 같은 표현으로 바꿔 표시
- AP 상단 요약 카드: “공장 기준(POST)” / “시스템 기준(장부)” / “차이”를 항상 같이 보여라
- 결제 입력은 “결제는 Reconcile ERROR 없을 때만 가능” 문구를 기본 안내로 포함

[수용 기준(Acceptance Criteria)]
1) /ap에서 기본 화면에 “FIFO 인보이스(당일 증가분)”가 보이지 않는다.
2) /ap에서 공장 POST 잔액(금/은/공임)과 기준 영수증 날짜/번호가 보인다.
3) /ap에서 우리 결제 내역(날짜/금/은/공임)이 보인다.
4) vendor에 reconcile ERROR가 있으면 결제 버튼이 비활성화되고, backend도 결제를 막는다.
5) /ap/reconcile에서 신규 이슈 타입 라벨이 이해 가능하게 표시되고, expected/actual/diff가 읽기 좋다.
6) /new_receipt_line_workbench의 4행 저장이 v2 RPC로 동작하며, 저장 후 reconcile 카운트 표시가 깨지지 않는다.

[테스트 시나리오(수동)]
- 영수증 1개(R1): 4행 저장(OK) → /ap에서 공장 POST가 표시되는지 확인
- 결제 1회(P1) 입력 → /ap 결제내역에 나타나는지 + 시스템 잔액 변하는지 확인
- 영수증 2개(R2): PRE 틀리게 저장(에러) → /ap에서 결제 버튼 막히는지(프론트+백엔드) 확인
- reconcile에서 이슈 해결/조정 후 → /ap에서 결제 버튼 다시 활성화되는지 확인

[주의]
- 기존 v1 뷰/RPC는 다른 화면에서 쓰고 있을 수 있으므로 삭제/이름 변경 금지
- 변경은 “추가 + 계약명/기본 탭/표시 로직 변경”으로 최소화
- 모든 신규 계약명은 env override 가능한 형태로 넣어 운영 환경 충돌을 피할 것
