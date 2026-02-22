아래 내용은 **현재 코드베이스(특히 Supabase migrations의 스키마/제약조건/Stored Procedure, 그리고 web 프론트가 실제 호출하는 RPC)**를 기준으로, 주문 → 공장발주(PO) → 영수증/매칭 → 매칭확정(출고대기) → 출고확정 → 미수 → 결제 흐름에서 정합성이 깨질 수 있는 “구체적인” 상황을 단계별로 해부한 결과입니다.

(실제 운영 DB 데이터까지는 제가 접근할 수 없으므로, “현 구조/로직상 깨질 수 있는 지점” + “DB에서 바로 찾을 수 있는 점검 쿼리” 형태로 냉정하게 평가합니다.)

## 0) 총평(잘한 것 / 못한 것)

### 잘한 것(객관적으로 강점)
* **영수증 라인 ↔ 주문 라인 매칭(Receipt Line Matching) 구간은 설계가 상당히 탄탄합니다.**
    * `cms_receipt_line_match`는 `(receipt_id, receipt_line_uuid, order_line_id)` 복합 PK로 중복 제안 데이터 폭주를 구조적으로 차단했고,
    * “확정(Confirmed)”에 대해서는 부분 Unique Index로 **한 영수증 라인당 confirmed 1개**, **한 주문 라인당 confirmed 1개**를 강제합니다.
* **매칭확정 RPC는 트랜잭션 단일 호출**로 shipment draft 생성/링크/상태 변경을 묶어 부분 성공(half commit) 가능성을 낮춰 놓았습니다.
* **매칭 해제(cms_fn_receipt_line_match_clear_v1)**는 출고/AR/원가확정 이후에는 해제 못하게 가드가 상당히 빡세서, “뒤늦은 해제로 장부 뒤틀림”을 잘 막습니다.
* **출고확정 후 AR(미수) 정합성 쪽은 최근 버전(0700~0717)에서 방어가 꽤 잘 들어가 있습니다.**
    * `cms_fn_confirm_shipment_v3_cost_v1`가 **AR invoice 생성 → AR ledger 동기화 → 검증 → 원장 잠금(ar_principal_locked_at)**까지 수행.
    * `cms_fn_verify_shipment_ar_consistency_v1`는 invoice-first SOT 기준으로 ledger를 자동 보정(sanity sync) 시도 후에도 안 맞으면 예외로 중단합니다.
    * “잠금 이후 불일치”는 강하게 막습니다(`cms_fn_sync_ar_ledger_from_shipment_v1`에서 locked 상태 mismatch는 예외).

### 못한 것(냉정하게 문제)
* **공장발주(PO) 구간은 정합성 측면에서 취약합니다.** 특히 아래는 “구조적 결함/명백한 버그”로 분류됩니다.
    * **PO 취소 RPC의 버그:** `cms_fn_factory_po_cancel`이 “발송된 PO는 취소 불가” 체크를 잘못된 상태값(`'SENT_TO_VENDOR'`)으로 비교합니다. 그런데 PO status는 체크 제약상 `'DRAFT'|'SENT'|'CANCELLED'`입니다. ⇒ **결론: SENT 된 PO도 취소가 가능해집니다(명백한 버그).**
    * `cms_factory_po_line`에 `order_line_id` 단일 유니크 제약이 없습니다. 즉 한 주문 라인이 여러 PO에 들어갈 수 있고, 그 상태에서 “마크 sent/cancel”이 꼬이면 주문 상태/PO 관계가 쉽게 무너집니다.
    * `cms_fn_factory_po_mark_sent`는 PO에 묶인 주문들을 무조건 `SENT_TO_VENDOR`로 덮어씁니다(SHIPPED/CLOSED/CANCELLED만 제외). ⇒ `READY_TO_SHIP` 등 “더 진행된 상태”도 다시 `SENT_TO_VENDOR`로 되돌려버릴 수 있습니다(정합성 위험).
* **출고확정(Shipment Confirm) 이후 주문 상태(order_line.status)가 SHIPPED로 자동 동기화되지 않습니다(현재 코드 기준).**
    * `cms_fn_confirm_shipment_v3_cost_v1`/기저 `cms_fn_confirm_shipment` 어디에도 주문 상태를 SHIPPED로 올려주는 로직이 없습니다.
    * 그런데 출고 화면이 쓰는 `cms_v_unshipped_order_lines`는 `order_line.status` 기반 필터라서, 출고를 확정해도 주문이 계속 “미출고 목록”에 남을 수 있는 구조입니다. (이건 “화면 혼선” 수준이 아니라 운영 정합성의 핵심 축이 비어 있는 상태입니다.)
* **결제는 “두 갈래 길”이 공존해서 AR SOT가 흔들릴 수 있습니다.**
    * `cms_fn_ar_apply_payment_fifo_v3` 경로(AR payment + alloc + ledger + payment_header)와 `cms_fn_record_payment_v2` 경로(ledger + payment_header만)가 공존합니다.
    * 후자를 쓰면 invoice/alloc 기반 미수는 줄지 않는데 ledger만 줄어 “장부/미수표 불일치”가 쉽게 생깁니다.

### 요약 결론:
**매칭/출고확정/AR 생성은 “잘한 편”**인데, **공장발주(PO)와 주문 상태 동기화, 결제 경로 통일은 “못했다(정합성 리스크 큼)”** 입니다.

---

## 1) 단계별 SOT(단일 진실 원천) 정의: 지금 시스템은 무엇을 SOT로 삼고 있나?

* **주문/공장발주**
    * 주문 SOT: `cms_order_line`
    * PO SOT: `cms_factory_po` + `cms_factory_po_line`
    * 단, `cms_order_line.factory_po_id`라는 “중복 표현(denormalized 포인터)”이 있어서 SOT가 2개처럼 동작할 여지가 있습니다. 실제 연결이 `factory_po_line`과 `order_line.factory_po_id`가 불일치할 수 있음(제약 없음).
* **영수증**
    * 영수증 SOT: `cms_receipt_inbox`
    * 영수증 라인 SOT: `cms_receipt_pricing_snapshot.line_items`(JSON) + 이를 펼친 `cms_v_receipt_line_items_flat_v1`
* **매칭**
    * 매칭 SOT: `cms_receipt_line_match`
    * shipment/receipt 링크 추적: `cms_receipt_usage` (보조 링크 테이블)
* **출고**
    * 출고 SOT: `cms_shipment_header` + `cms_shipment_line`
    * 가격/환산 스냅샷: `cms_shipment_valuation` (confirm 시점 스냅샷)
* **미수(AR)**
    * 현재 구현은 “원장(ledger) SOT”가 아니라 **“invoice-first SOT”**입니다.
    * SOT(원칙): `cms_ar_invoice` (현금/금/은/재료대 등 원금 성격)
    * 결제 SOT: `cms_ar_payment` + `cms_ar_payment_alloc`
    * `cms_ar_ledger`는 “표시/요약용 원장”이고, invoice를 기준으로 동기화/검증합니다(`verify_shipment_ar_consistency`).
    * 즉, 질문에서 말한 “원장 SOT”는 현재 코드상 사실이 아닙니다. 오히려 invoice가 SOT이고 원장은 동기화 대상입니다.

---

## 2) 주문 → 공장 발주(PO): 정합성 깨짐 포인트

### (A) 한 주문 라인이 여러 PO에 포함될 수 있음(구조적 결함)
* `cms_factory_po_line`의 유니크는 `(po_id, order_line_id)` 뿐이라 `order_line_id` 단독 유니크가 없음.
* ⇒ 같은 주문 라인이 다른 `po_id`로 또 들어가는 것이 가능.
* 그 상태에서 `mark_sent`나 `cancel`이 `po_line` 기준으로 주문 상태를 업데이트하므로, 주문이 이미 다른 PO로 “갈아탄” 상태라도 예전 PO를 sent/cancel 하면서 주문 상태를 덮어쓰는 상황 발생 가능.
* **✅ “정합성 깨짐”의 전형적인 시나리오**
    1.  주문 A를 PO1에 넣음 → `order_line.factory_po_id = PO1`
    2.  어떤 이유로 다시 PO2에 넣음(가능) → `order_line.factory_po_id = PO2`
    3.  그런데 PO1을 `mark_sent` 하면, `po_line(PO1)`에 묶인 주문 A의 status가 `SENT_TO_VENDOR`로 바뀜.
    4.  주문 A는 PO2에 속해 있는데 PO1 sent가 주문 상태를 덮어씀.
    5.  ⇒ PO-주문 관계/상태가 틀어짐.

### (B) PO 취소 함수가 “발송된 PO도 취소 가능”한 명백한 버그
* `cms_fn_factory_po_cancel`에서 “이미 발송된 PO는 취소 불가”를 체크한다고 해놓고 비교값이 `'SENT_TO_VENDOR'` 입니다. 하지만 PO status는 `'SENT'` 입니다.
* **⇒ 결과:**
    * SENT 된 PO도 CANCELLED로 바꿔버릴 수 있음.
    * 주문 라인은 `ORDER_PENDING`으로 되돌리고, `factory_po_id`도 NULL로 만들고, `po_line`도 삭제합니다.
    * 이건 정합성 관점에서 치명적입니다. (실물은 공장에 발주가 나갔는데, 시스템상 “발주 취소+주문 대기”로 회귀 가능)

### (C) PO mark_sent가 “진행된 주문 상태를 되돌릴 수 있음”
* `cms_fn_factory_po_mark_sent`는 `po_line`에 묶인 주문 중 SHIPPED/CLOSED/CANCELLED가 아니면 무조건 `SENT_TO_VENDOR`로 세팅합니다.
* 따라서 어떤 주문이 이미 `READY_TO_SHIP`였어도, 같은 PO에 속해 있기만 하면 `mark_sent` 한 번으로 다시 `SENT_TO_VENDOR`가 됩니다.
* 현실적으로는 “발주 sent는 보통 먼저 하고, 그 다음 매칭”이라 덜 일어날 수 있지만, 수기 상태 변경, 운영 실수, PO 재발송/수정 등으로 충분히 발생 가능합니다.

### (D) vendor_prefix / vendor_party_id 세팅 실패 시 이후 단계 전체가 막힘
* PO 생성은 `order_line.vendor_prefix`에 크게 의존합니다.
* vendor_prefix는 모델명에서 `PREFIX-...` 형태로 추출하며, 영숫자만 허용하는 조건이 있습니다. 모델명이 규칙을 벗어나면 prefix가 NULL이 되고, PO 생성에서 제외될 수 있음.
* 또한 PO에 `vendor_party_id`가 NULL이면 매칭확정 RPC에서 “order has no vendor”로 실패합니다(주문-공장 vendor 정합성 검사 때문에).
* **⇒ 결과:** 발주/벤더 매핑이 흐트러지면, 영수증이 와도 매칭확정 자체가 막혀 출고 프로세스가 정지합니다.

---

## 3) 영수증/매칭: 정합성 깨짐 포인트

### (A) 영수증 vendor_party_id 없으면 매칭확정 불가
* 매칭확정(v5/v6)은 영수증 `vendor_party_id`가 NULL이면 예외로 중단합니다.
* ⇒ 영수증 업로드/등록 시 vendor가 누락되면 “매칭 제안은 되는데 확정이 안 되는” 케이스가 생깁니다.

### (B) PO vendor_party_id가 NULL이면(또는 불일치면) 매칭확정 불가
* 확정 시점에 영수증 `vendor_party_id`와 주문의 `factory_po.vendor_party_id`가 동일해야만 진행합니다.
* 즉, PO가 생성은 됐는데 `vendor_party_id`가 NULL이거나 vendor mapping이 잘못되어 PO vendor가 틀리면 영수증 라인 매칭확정이 구조적으로 불가능합니다.

### (C) 영수증 라인 qty와 주문 qty 정합성 검증이 거의 없음
* `cms_v_receipt_line_items_flat_v1`에는 qty가 존재합니다. 그런데 매칭확정 로직은 대체로 shipment line qty를 order.qty 기준으로 생성합니다.
* 즉, receipt line qty=2인데 order.qty=1인 상황이나 receipt line qty=1인데 order.qty=2인 상황을 “정합성 오류로 막거나, 부분 매칭으로 처리”하는 로직이 없습니다. 현업에서 대부분 qty=1이면 크게 문제 없지만, qty가 의미 있게 쓰이는 순간 정합성이 깨질 가능성이 있습니다.

### (D) 영수증 라인(스냅샷 JSON)의 “사후 수정”이 출고/원가에 영향을 줄 수 있음
* `cms_receipt_pricing_snapshot`은 JSON `line_items` 기반입니다. 스냅샷 upsert는 “null 덮어쓰기 방지” 정도만 있고, LINKED/CONFIRMED 이후 수정 불가 같은 강제는 약합니다.
* 매칭확정 후에도 영수증 `line_items`가 수정되면 purchase cost 계산, 분해, 기록 등 후속 로직이 “이미 링크된 shipment”와 다른 근거를 참조할 수 있음. (링크 무결성은 `cms_v_receipt_line_link_integrity_v1`로 일부 탐지하지만 금액/수량의 변경까지 자동 보정해주진 않습니다.)

---

## 4) 매칭확정(출고대기): 여기서의 정합성은 상대적으로 “잘했다”

매칭확정 RPC(`cms_fn_receipt_line_match_confirm_v6_policy_v2` → `v5`)가 하는 일은 명확합니다.
1.  `cms_receipt_line_match.status = CONFIRMED`
2.  draft `cms_shipment_header` + `cms_shipment_line` 생성
3.  shipment_line에 `purchase_receipt_id`, `purchase_receipt_line_uuid` 세팅
4.  `cms_receipt_usage` 추가
5.  `receipt_inbox.status`를 UPLOADED→LINKED로 전환
6.  `order_line.status`를 `SENT_TO_VENDOR`/`WAITING_INBOUND` → `READY_TO_SHIP`로 전환 + `inbound_at` 세팅

이 구간에서 깨질 수 있는 위험은 “대부분 입력 데이터 전제(벤더/마스터/상태) 불충족”이지, 트랜잭션/제약 자체는 꽤 튼튼합니다.

---

## 5) 출고확정(Shipment Confirm): AR 생성/정합성은 좋지만, 주문 상태 동기화가 빠져 있음

### (A) 출고확정 RPC는 AR invoice/ledger/lock까지 잘 한다
* `cms_fn_confirm_shipment_v3_cost_v1`는 confirm(가격 확정/valuation), AR invoice 생성, AR ledger 동기화, 검증, `ar_principal_locked_at` 잠금까지 수행합니다.
* 이 부분은 “잘했다” 입니다. (특히 invoice-first SOT + verify + lock 조합은 장부 정합성 방어로 매우 강력)

### (B) 그런데 주문(order_line) 상태는 SHIPPED로 안 바뀐다(현재 코드 기준)
* 문제는 여기입니다. 출고확정 후에도 `cms_order_line.status`가 자동으로 SHIPPED가 되지 않습니다.
* `cms_v_unshipped_order_lines`는 `order_line.status`로 미출고를 판단합니다.
* **따라서 발생 가능한 현상:**
    * 출고확정한 주문이 계속 “미출고/출고대기” 목록에 남음.
    * 같은 주문이 이미 CONFIRMED shipment_line을 갖고 있는데도 주문 리스트에서 계속 조회됨.
    * 운영자가 혼동하여 중복 처리 시도(다행히 shipment_upsert가 기존 shipment_line 재사용을 하긴 하지만, 화면 정합성은 깨짐).
* 이건 “단순 미관/UX”가 아니라, 업무 상태 머신(order status)이 출고 상태와 분리되어 SOT가 2개가 되어버린 상태입니다. 냉정한 평가: “출고확정 후 주문 상태 동기화”는 현재 구조에서 빠져 있어서 못했다고 보는 게 맞습니다.

### (C) 위험 확장: 주문이 SHIPPED가 안 되면, 다른 로직(PO 취소 등)이 이미 출고한 주문을 건드릴 수 있음
* 특히 앞서 말한 PO cancel 버그와 결합하면: 실제로 출고/AR 생성까지 끝난 주문도 status가 `READY_TO_SHIP`로 남아 있을 수 있고, PO cancel은 SHIPPED/CLOSED/CANCELLED만 제외하므로 출고된 주문을 `ORDER_PENDING`으로 되돌리는 업데이트가 가능해집니다(재앙급 정합성 혼선).

### (D) “기저 confirm_shipment”를 직접 호출하면 AR invoice 체인이 누락될 수 있음
* UI는 `confirm_shipment_v3_cost_v1`를 호출하지만, 기저 `cms_fn_confirm_shipment`도 실행 권한이 열려 있으면 shipment는 CONFIRMED가 되는데 invoice 생성/ledger sync/lock이 안 돌 수 있습니다. 현행 운영에서 UI만 쓴다면 덜하지만, 외부 호출로 기저 함수가 호출되면 AR SOT가 깨질 수 있는 구조입니다.

---

## 6) 미수(AR): “원장 SOT”가 아니라 “invoice-first SOT”다

질문에 직접 답하자면, 현재 구현은 원장(`cms_ar_ledger`)이 SOT가 아닙니다. SOT는 `cms_ar_invoice`이고, `cms_ar_ledger`는 invoice 기반으로 동기화/검증됩니다. 이것 자체는 나쁜 설계가 아닙니다(오히려 정합성 강제에 유리). 다만 “원장 SOT” 관점에서는 요구와 구현이 다릅니다.

---

## 7) 결제: 정합성 깨짐 포인트(가장 큰 문제는 “경로 이원화”)

### (A) AR FIFO 결제(v3)는 정합성 관점에서 좋은 편
* `cms_fn_ar_apply_payment_fifo_v3`는 `cms_ar_payment` 생성, `cms_ar_payment_alloc`으로 FIFO 배분, `cms_payment_header` 생성, `cms_ar_ledger` 기록까지 비교적 완결적입니다. (잘했다)

### (B) record_payment_v2는 “원장만 줄고, invoice 미수는 안 줄 수 있음”(정합성 흔들림)
* `cms_fn_record_payment_v2`는 `cms_payment_header`와 `cms_ar_ledger`에 기록까지는 하지만, `cms_ar_payment`/`alloc`을 만들지 않습니다.
* 따라서 ledger 기반 balance는 줄었는데 invoice outstanding은 그대로인 상태가 쉽게 만들어집니다. 이게 “선수금/예치금”을 의도한 것이라면 괜찮지만, 그렇지 않다면 SOT가 두 개가 되어 미수/결제 정합성이 깨집니다.
* **냉정한 평가:** 결제는 “한 경로로 통일”하지 않으면, 원장/미수표 불일치가 구조적으로 남습니다.

---

## 결론: “완벽하게 잘 돌아가나?”

아니오. 일부 구간은 매우 잘 되어 있지만, 핵심적으로 다음이 “완벽하지 않다/못했다”에 해당합니다.

* **치명(Critical)**
    * PO 취소 함수 버그로 SENT PO도 취소 가능
    * 출고확정 후 주문 status(SHIPPED) 자동 동기화 부재
    * PO-주문 연결의 유니크/정합성 강제가 약함(한 주문이 여러 PO 가능)
* **중대(Major)**
    * `factory_po_mark_sent`가 진행 상태를 되돌릴 수 있음(`READY_TO_SHIP` → `SENT_TO_VENDOR`)
    * 결제 경로 이원화로 invoice SOT vs ledger가 쉽게 어긋날 수 있음(`record_payment_v2`)
* **보완(Medium)**
    * 영수증 qty ↔ 주문 qty 검증 부재
    * 영수증 스냅샷의 사후 수정이 링크된 출고/원가에 영향 가능

---

## 8) 운영 DB에서 “정합성 깨짐”을 바로 찾는 점검 쿼리(추천)

### 8-1) PO와 주문 링크 불일치(가장 먼저 봐야 함)
```sql
-- po_line에 있는데 order_line.factory_po_id가 다른 경우(또는 NULL)
select
  pol.po_id,
  pol.order_line_id,
  ol.factory_po_id,
  ol.status
from cms_factory_po_line pol
join cms_order_line ol on ol.order_line_id = pol.order_line_id
where ol.factory_po_id is distinct from pol.po_id;
```

### 8-2) SENT_TO_VENDOR인데 PO/시간이 없는 주문(상태 정합성)
```sql
select order_line_id, status, factory_po_id, sent_to_vendor_at
from cms_order_line
where status = 'SENT_TO_VENDOR'
  and (factory_po_id is null or sent_to_vendor_at is null);
```

### 8-3) READY_TO_SHIP인데 confirmed 매칭이 없는 주문(출고대기 근거 붕괴)
```sql
select ol.order_line_id, ol.status, ol.inbound_at
from cms_order_line ol
left join cms_receipt_line_match m
  on m.order_line_id = ol.order_line_id
 and m.status = 'CONFIRMED'
where ol.status = 'READY_TO_SHIP'
  and m.order_line_id is null;
```

### 8-4) confirmed 매칭인데 shipment line 링크가 깨진 경우
```sql
-- 이미 cms_v_receipt_line_link_integrity_v1가 유사 체크를 제공
select *
from cms_v_receipt_line_link_integrity_v1
where issue <> 'OK';
```

### 8-5) 출고 CONFIRMED인데 주문 status가 아직 미출고 상태인 경우(현재 구조상 매우 많이 나올 가능성)
```sql
select distinct
  ol.order_line_id,
  ol.status as order_status,
  sl.shipment_id,
  sl.status as shipment_line_status
from cms_order_line ol
join cms_shipment_line sl
  on sl.order_line_id = ol.order_line_id
where sl.status = 'CONFIRMED'
  and ol.status in ('SENT_TO_VENDOR','WAITING_INBOUND','READY_TO_SHIP');
```

### 8-6) 출고 CONFIRMED인데 AR invoice가 없는 shipment
```sql
select sh.shipment_id
from cms_shipment_header sh
left join cms_ar_invoice ai on ai.shipment_id = sh.shipment_id
where sh.status = 'CONFIRMED'
group by sh.shipment_id
having count(ai.*) = 0;
```

### 8-7) payment_header는 있는데 ar_payment는 없는 결제(legacy 경로/정합성 흔들림 후보)
```sql
select ph.payment_id, ph.party_id, ph.paid_at, ph.total_amount_krw
from cms_payment_header ph
left join cms_ar_payment ap on ap.payment_id = ph.payment_id
where ap.payment_id is null;
```

---

## 9) 개선 권고(우선순위)

### 최우선(즉시)
1.  **`cms_fn_factory_po_cancel` 버그 수정:** `'SENT_TO_VENDOR'` 비교를 `'SENT'`로 수정. 추가로 “해당 PO의 주문 라인이 이미 매칭확정/출고/AR 생성되었으면 취소 금지” 가드 필요.
2.  **PO-주문 1:1 제약 강화:** `cms_factory_po_line(order_line_id)`에 unique index 추가. `order_line.factory_po_id`와 `po_line` 불일치 방지.
3.  **출고확정 시 주문 상태 SHIPPED 동기화:** `confirm_shipment_v3_cost_v1` 끝에 해당 shipment에 포함된 `order_line_id`들의 status 업데이트 + `shipped_at` 기록 로직 추가.

### 중요
1.  **결제 경로 통일:** `record_payment_v2`를 “예치금 전용”으로 명확히 분리하거나, 가능하면 `ar_apply_payment_fifo` 계열로 통일(alloc까지 생성).
2.  **상태 복구 제한:** `factory_po_mark_sent`가 `READY_TO_SHIP` 같은 진행 상태를 덮어쓰지 않도록 제한.