# Codex 구현 프롬프트 (AP 4행 저장 + 정합 큐 + 결제/FIFO) — “기존 워크벤치에 붙이기”

## 0) 목표 요약
우리는 공장 AP를 AR과 동일한 패턴으로 구축한다.

* **AP는 자산 분리:** 금(XAU_G), 은(XAG_G), 공임현금(KRW_LABOR), (미래용) 소재현금대체(KRW_MATERIAL)
* **공장 영수증 하단 4행:** 최근결제/전미수/판매/후미수 값이 있으며, 이 값은 팩트 스냅샷으로 “그대로” 저장해야 한다.
* **정합 분리:** PRE/POST 정합이 안 맞아도 저장/출고업무를 막지 않는다. 대신 정합 이슈를 큐에 쌓고 사후 처리한다.
* **결제 상계:** 결제는 자산별 FIFO로 상계한다.

### 중요한 구현 원칙
1.  `new_receipt_line_workbench` 화면을 새로 만들지 말고, 거기에 기능을 추가한다.
2.  정합은 “감사/대사 업무”이므로 워크벤치에서 막지 않고 배지/링크로만 노출한다.

---

## 1) 작업 범위(라우팅/페이지 정책)
1.  **new_receipt_line_workbench (기존 화면)** — 반드시 여기에 붙이기
    * 이 화면에 공장 4행 입력/저장 섹션 + 정합 배지 추가
    * 기존 “라인 저장” 이후 AP 동기화 RPC 추가 호출
2.  **/ap (AP 대시보드/결제)**
    * 기존 페이지/탭이 있으면 거기에 섹션 추가
    * 없으면 새로 만들어도 됨 (단, `new_` 네이밍 규칙이 레포에 있으면 그 규칙을 따름)
3.  **/ap/reconcile (정합 큐)**
    * 기존 있으면 확장, 없으면 새로 생성

---

## 2) 사용해야 하는 DB RPC / View (절대 변경 금지: 이름 그대로 호출)

### 2.1 워크벤치에서 호출할 RPC
**A) 공장 4행 저장 + (내부) SALE invoice 업서트 + (내부) reconcile 이슈 생성**
* `cms_fn_upsert_factory_receipt_statement_v1(receipt_id, statement_json, note)`
* `statement_json` 형식:
```json
{
  "rows": [
    {
      "row_code": "RECENT_PAYMENT",
      "ref_date": "2026-02-05",
      "note": "optional",
      "legs": [
        { "asset_code": "XAU_G", "qty": 0.000000, "input_unit": "g",   "input_qty": 0.000000 },
        { "asset_code": "XAG_G", "qty": 0.000000, "input_unit": "g",   "input_qty": 0.000000 },
        { "asset_code": "KRW_LABOR", "qty": 0.00, "input_unit": "krw", "input_qty": 0.00 }
      ]
    },
    { "row_code": "PRE_BALANCE",  "legs": [ ... ] },
    { "row_code": "SALE",         "legs": [ ... ] },
    { "row_code": "POST_BALANCE", "legs": [ ... ] }
  ]
}
```

**B) 라인 저장 성공 후 AP 동기화(내부 calc 포함 시도)**
* `cms_fn_ensure_ap_from_receipt_v1(receipt_id, note)`
* 라인 저장이 성공하면 무조건 이 RPC를 호출한다.
* 실패해도 “라인 저장” 자체는 성공으로 유지하고, AP 동기화 실패 배지/재시도 버튼만 제공.

### 2.2 AP 결제/FIFO RPC
* `cms_fn_ap2_pay_and_fifo_v1(vendor_party_id, paid_at, legs_json, note, idempotency_key)`
* `legs_json` 예시:
```json
[
  { "asset_code": "XAU_G", "qty": 1.250000 },
  { "asset_code": "KRW_LABOR", "qty": 350000.00 }
]
```
* **옵션 수동배정(있으면 구현):** `cms_fn_ap2_manual_alloc_v1(payment_id, ap_id, asset_code, qty, note)`

### 2.3 정합 큐 처리 RPC
* **ACK/IGNORE:** `cms_fn_ap_set_reconcile_issue_status_v1(issue_id, status, note)` (IGNORE는 note 필수)
* **추천 조정 생성:** `cms_fn_ap_create_adjustment_from_issue_v1(issue_id, note)` (이슈 diff 그대로 ADJUSTMENT invoice 생성 + issue RESOLVED)

### 2.4 조회 View(리스트/대시보드)
* **정합 큐:**
    * `cms_v_ap_reconcile_open_by_vendor_v1`
    * `cms_v_ap_reconcile_issue_list_v1`
    * `cms_ap_reconcile_issue_leg` (테이블 직접 조회)
* **AP 대시보드:**
    * `cms_v_ap_position_by_vendor_v1`
    * `cms_v_ap_invoice_position_v1`
    * `cms_v_ap_payment_unallocated_v1`
    * `cms_v_ap_payment_alloc_detail_v1`

---

## 3) new_receipt_line_workbench에 추가할 UI/동작(상세)

### 3.1 어디에 붙일지(레이아웃)
기존 워크벤치 오른쪽 패널(영수증 상세 영역)에 아래 순서로 배치:
1.  (기존) 영수증 기본 정보/헤더
2.  (기존) 라인 입력/수정 테이블 + 라인 저장 버튼
3.  ✅ **(신규) “공장 영수증 하단 4행” 입력 카드**
4.  ✅ **(신규) “정합 상태 배지” + “정합 큐 이동” 버튼**
5.  (기존) 매칭/출고대기 후보 영역

### 3.2 공장 4행 입력 카드(필수)
* **행 4개 고정:**
    1.  최근결제(RECENT_PAYMENT): 입력 - 날짜(ref_date) + 금/은/현금
    2.  거래전미수(PRE_BALANCE): 금/은/현금
    3.  판매(SALE): 금/은/현금 (당일 출고에 따른 증가분)
    4.  거래후미수(POST_BALANCE): 금/은/현금
* **각 행의 필드:**
    * 금(XAU_G): 숫자 + 단위 선택(g / don)
    * 은(XAG_G): 숫자 + 단위 선택(g / don)
    * 공임현금(KRW_LABOR): 숫자(원)
* **단위 변환 규칙(필수):**
    * don → g 환산: `g = don * 3.75`
    * RPC 전송 시: 항상 `qty`는 g(정규화)로 보낸다.
    * don 입력 시: `input_unit: "don"`, `input_qty: (don 값)`, `qty: (don*3.75)`
    * g 입력 시: `input_unit: "g"`, `input_qty: (g 값)`, `qty: (g 값)`
* **저장 버튼(필수):**
    * 클릭 시 `cms_fn_upsert_factory_receipt_statement_v1` 호출.
    * 성공 시 toast(“저장됨”) 및 리턴의 `reconcile.issue_counts` 기반 배지 갱신.
    * 실패 시 toast(“저장 실패”) 및 에러 표시.
    * **절대 저장 차단/강제 정합 금지** (PRE/POST mismatch는 경고로만 취급).

### 3.3 정합 배지 + 링크(필수)
* 배지 표시: ✅ OK (error=0 & warn=0), ⚠️ WARN (warn>0), ❌ ERROR (error>0).
* **CTA 버튼:** “정합 큐 열기” → `/ap/reconcile?vendor_party_id=<vendor>&status=OPEN,ACKED`
* 워크벤치에서는 링크만 제공하고 출고/매칭 흐름을 절대 막지 않는다.

### 3.4 라인 저장 이후 AP 동기화(필수)
* 기존 “라인 저장” 성공 시 즉시 `cms_fn_ensure_ap_from_receipt_v1` 호출.
* 실패해도 라인 저장 성공 유지, 상단에 “AP 동기화 실패(재시도)” 배지 및 버튼 제공.

---

## 4) /ap 화면(결제/FIFO) 요구사항
1.  **Vendor 선택:** 기존 AR 패턴 재사용.
2.  **포지션 카드:** `cms_v_ap_position_by_vendor_v1` 조회. 자산별 outstanding / credit 표시. (KRW_MATERIAL 숨김 가능)
3.  **인보이스 리스트:** `cms_v_ap_invoice_position_v1` 조회. `occurred_at` 오름차순(FIFO). 자산별 outstanding 표시.
4.  **결제 입력 폼:**
    * `paid_at`(기본 현재), 금(g), 은(g), 공임현금(원), note.
    * `idempotency_key` 자동 생성: `${vendorId}-${YYYYMMDDHHmmss}-${random4}`.
    * 제출 시 `cms_fn_ap2_pay_and_fifo_v1` 호출.
    * 결과: allocations 목록 즉시 표시 및 unallocated(“미배정 크레딧”) 표시. 포지션/인보이스 리프레시.

---

## 5) /ap/reconcile 정합 큐 요구사항
1.  **좌측 vendor 리스트:** `cms_v_ap_reconcile_open_by_vendor_v1` (open/error/warn 카운트).
2.  **중앙 issue 리스트:** `cms_v_ap_reconcile_issue_list_v1`. 필터: vendor_party_id, status(OPEN/ACKED), severity.
3.  **우측 issue 상세:** `cms_ap_reconcile_issue_leg` 조회.
    * 버튼: ACK, IGNORE(note 필수), 추천 조정 생성(RESOLVE).

---

## 6) UX/검증 규칙(반드시 지킬 것)
* PRE/POST mismatch는 경고만, 저장 막지 말 것.
* 숫자 포맷: g(소수 6자리), KRW(정수 중심).
* 로딩/에러/재시도 UX 포함.
* 기존 워크벤치(매칭/출고대기) UX 절대 깨지지 않게 구현.

---

## 7) 완료 조건(Acceptance Criteria)
1.  `new_receipt_line_workbench`에서 4행 입력 후 저장 시 DB 저장 및 정합 배지 표시, 정합 큐 이동 가능.
2.  라인 저장 성공 후 `ensure_ap` 호출 확인 (실패 시 재시도 가능).
3.  `/ap`에서 결제 입력 시 FIFO 상계 수행 및 결과 표시.
4.  `/ap/reconcile`에서 이슈를 ACK/IGNORE/추천조정으로 처리 가능.

---

## 8) 구현 시 주의(실수 방지 체크리스트)
* 4행 저장 payload에서 `qty`는 항상 정규화(g/원)로 보낼 것.
* don 입력은 반드시 `qty = don * 3.75` 변환 후 저장.
* `issue_counts`는 워크벤치 배지에 즉시 반영.
* `/ap/reconcile` 링크에 `vendor_party_id`를 반드시 포함.