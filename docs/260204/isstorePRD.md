# [CODEX 5.2 medium] 매장출고(Store Pickup) 시세/스냅샷 확정 시점 버그 수정 (Shipments에서 확정 금지, Workbench에서만 확정)

## 0) 목표(한 줄 요약)
**매장출고(is_store_pickup=true)의 “시세/valuation 스냅샷(pricing_locked_at 등) 확정”은 오직 Workbench(당일출고)에서 `선택 영수증 확정`을 누를 때만 발생해야 한다.** 따라서 **Shipments(특히 prefill 단계)에서 매장출고 체크 후 ‘출고확정’을 눌러도 DB에서 확정(confirm) RPC가 호출되면 안 된다.** Shipments에서는 **DRAFT 저장 + is_store_pickup=true 세팅만** 하고 끝내야 한다.

---

## 1) 문제 현상 (재현)
1) `Shipments` 페이지에서 prefill 단계에서 매장출고 체크
2) “출고확정” 버튼 클릭
3) **클릭한 시점에 시세가 확정(pricing_locked_at/valuation 스냅샷)** 됨  
→ 기대: **Workbench(당일출고)에서 ‘선택 영수증 확정’ 클릭 시점에만 확정되어야 함**

---

## 2) 원인 (현재 코드)
다음 파일에서 **매장출고 체크 시 `shipmentConfirmStorePickup` RPC를 호출**하고 있어서,
그 순간에 `cms_fn_confirm_store_pickup_v1` → `cms_fn_confirm_shipment_v3_cost_v1` 흐름으로 들어가며 **latest tick을 가져와 스냅샷을 저장**한다.

### A. Shipments 페이지
- 파일: `web/src/app/(app)/shipments/page.tsx`
- 문제 지점:
  - `handleSaveShipment()`에서 매장출고인 경우에도 confirm을 실행함
  - `handleFinalConfirm()`(모달 확정)에서도 매장출고인 경우 confirm을 실행함

### B. Inline shipment panel(다른 UI 경로)
- 파일: `web/src/components/shipment/inline-shipment-panel.tsx`
- 문제 지점:
  - 매장출고인 경우 `shipmentConfirmStorePickup` 호출

> **해결 원칙:** Workbench만 `shipmentConfirmStorePickup`(또는 confirm 계열)을 호출할 수 있다.  
> Shipments/Inline Panel 등 다른 UI는 **매장출고에서는 confirm 금지**.

---

## 3) 요구사항(정답 동작 정의)
### 3.1 Shipments에서 매장출고 체크 시
- 해야 할 것:
  1) shipment 라인 upsert/저장(현재 로직 유지)
  2) `cms_fn_set_shipment_store_pickup_v1`(contracts: `shipmentSetStorePickup`) 호출로 `is_store_pickup=true` 세팅
  3) **여기서 종료(return)** - 하면 안 되는 것:
  - `shipmentConfirm` / `shipmentConfirmStorePickup` 어떤 confirm RPC도 호출 금지
  - “force store pickup after confirm” 같은 후처리도 당연히 제거

### 3.2 Workbench에서만 확정
- 파일: `web/src/app/(app)/workbench/[partyId]/page.tsx`
- 이 파일은 현재 `shipmentConfirmStorePickup`을 사용하여 당일출고 확정한다.
- **이 동작은 그대로 유지**(여기가 유일한 매장출고 확정 지점)

### 3.3 Inline shipment panel에서 매장출고 체크 시
- confirm 버튼을 누르더라도:
  - `shipmentSetStorePickup`만 호출
  - confirm RPC 호출 금지
  - 사용자에게 “Workbench에서 확정 필요” 안내 토스트 표시

---

## 4) 구현 범위(수정해야 하는 파일)
### 필수
1) `web/src/app/(app)/shipments/page.tsx`
2) `web/src/components/shipment/inline-shipment-panel.tsx`

### 수정 금지(의도적으로 유지)
- `web/src/app/(app)/workbench/[partyId]/page.tsx` (여기만 확정 허용)

---

## 5) 구체 구현 지시 (Shipments 페이지)

### 5.1 `handleSaveShipment()` 수정
현재 구조:
- upsert → set_store_pickup → confirmHandler(=confirmStorePickup or confirm) → (store_pickup이면 force set_store_pickup)

**변경:** `shouldStorePickup === true`이면  
- upsert 성공 후
- `shipmentSetStorePickupMutation` 1회 호출
- 토스트 띄우고 입력 상태 리셋(아래 UX 참고)
- **return;** 그리고 아래 confirm 호출부는 **매장출고에서는 절대 실행되지 않게** 분기.

#### 패치 스켈레톤(의도)
```ts
if (shouldStorePickup) {
  await shipmentSetStorePickupMutation.mutateAsync({...});

  toast.success("매장출고로 저장 완료", {
    description: "확정(시세 스냅샷)은 Workbench(당일출고)에서 ‘선택 영수증 확정’ 시점에만 진행됩니다.",
  });

  // UX: 입력값/선택값 리셋(단, isStorePickup 체크는 유지 권장)
  resetCreateFormButKeepStorePickup(); // 아래에서 함수로 만들거나 기존 reset 로직 재사용

  return; // ✅ 핵심: shipments에서 confirm 금지
}
```

### 5.2 handleFinalConfirm()(모달 확정) 수정
현재 구조:
(라인 업데이트 등) → confirmHandler(=confirmStorePickup or confirm) → store_pickup이면 force set_store_pickup

**변경:** 모달에서 `isStorePickup === true`이면
- (라인 업데이트 저장은 그대로 허용)
- `shipmentSetStorePickupMutation` 호출(필요 시)
- 모달 닫기 + 안내 토스트
- **return;**
- confirm RPC 호출 금지.

#### 패치 스켈레톤(의도)
```ts
// 라인 업데이트/검증 로직은 유지한 뒤...
if (shouldStorePickup) {
  await shipmentSetStorePickupMutation.mutateAsync({...});
  toast.success("매장출고로 저장 완료", {
    description: "확정은 Workbench(당일출고)에서 진행하세요.",
  });
  setConfirmModalOpen(false);
  return; // ✅ confirm 금지
}

// non-store pickup만 아래 confirmMutation 실행
await confirmMutation.mutateAsync({...});
```

### 5.3 Shipments UI 문구/버튼 변경(실수 방지)
Shipments에서 store pickup 체크되어 있으면,
- 메인 버튼 텍스트:
  - 기존: “출고확정”
  - 변경: “매장출고 저장 (워크벤치에서 확정)”
- 모달 버튼 텍스트도 동일하게 바꿈
- 모달 상단에 Warning Banner 추가(가능하면):
  - “매장출고는 Shipments에서 확정되지 않습니다. Workbench(당일출고)에서 ‘선택 영수증 확정’으로 확정하세요.”
- 단순히 코드에서 confirm만 막으면 사용자가 계속 눌러서 혼란이 생김. UI 레벨에서 확실히 안내해야 함.

### 5.4 중복 리셋 로직 정리(권장)
confirmMutation.onSuccess / confirmStorePickupMutation.onSuccess에 동일한 리셋 코드가 반복됨.
이번 수정에서 store pickup 저장에서도 동일 리셋이 필요하므로,
- `resetShipmentForm({ keepStorePickup?: boolean })` 같은 유틸 함수로 추출해서 재사용 권장
- store pickup 저장 경로에서는 `keepStorePickup=true`로 체크 유지(업무상 연속 저장 편의)
- 리팩토링은 기능 변경 최소로, 단 “동일 코드 복붙”은 피할 것.

---

## 6) 구현 지시 (Inline shipment panel)
파일: `web/src/components/shipment/inline-shipment-panel.tsx`

`confirmShipmentMutation`에서 `if (isStorePickup)` 분기 수정
- 현재:
  - set_store_pickup → confirm_store_pickup 호출
- 변경:
  - set_store_pickup만 호출
  - confirm_store_pickup 호출 제거
- 토스트:
  - “매장출고로 저장됨. 확정은 Workbench(당일출고)에서 진행하세요.”
- 이후 invalidate/onComplete는 현재 UX에 맞게 호출(주문 worklist 반영 위해 유지 권장)

---

## 7) 최종 검증(DoD / Acceptance Criteria)
### 7.1 Shipments에서 매장출고 저장 시 (핵심)
- 동작:
  - shipment 생성/라인 저장 성공
  - `cms_shipment_header.is_store_pickup = true`
  - status는 DRAFT 유지
  - confirmed_at = NULL
  - pricing_locked_at = NULL (또는 기존 값이 있으면 변화 없음)
- 확인 방법:
  - Shipments 모달에서 header query는 is_store_pickup, pricing_locked_at, confirmed_at, status를 읽으므로 UI에서도 확인 가능
  - DB 직접 확인 가능하면 더 좋음

### 7.2 Shipments에서 일반출고(매장출고 아님) 확정 시
- 기존과 동일하게 confirm RPC 정상 호출
- status=CONFIRMED, confirmed_at 세팅 등 정상

### 7.3 Workbench에서 매장출고 확정 시
- `web/src/app/(app)/workbench/[partyId]/page.tsx` 흐름 그대로
- 여기서만 pricing_locked_at/valuation 스냅샷 확정 발생

### 7.4 코드 베이스에서 “매장출고 confirm RPC 호출 위치” 제한
변경 후 다음 조건 만족:
- `shipmentConfirmStorePickup` 호출은 WorkBench 파일에만 남아있어야 함
- 아래 명령으로 확인:
  ```bash
  grep -R "shipmentConfirmStorePickup" -n web/src
  ```
- 기대 결과:
  - `web/src/app/(app)/workbench/[partyId]/page.tsx`만 남음
  - (혹시 남아있다면, 해당 호출 경로에서 store pickup confirm 금지로 수정 필요)

---

## 8) 금지/주의사항
1) DB 함수/마이그레이션 수정은 이번 이슈의 1차 해결 범위가 아님(프론트 호출 차단으로 해결).
2) “매장출고 저장”이 confirm과 동일한 토스트/문구로 보이면 안 됨(업무 오해 방지).
3) store pickup 저장 시, 기존처럼 p_emit_inventory 등 confirm 관련 파라미터를 절대 보내지 말 것(확정 로직 유입 방지).

---

## 9) 제출물
- PR(또는 commit) 1개로 위 2개 파일 수정
- DoD 체크리스트 캡쳐/메모:
  - 매장출고 저장 시 confirmed_at/pricing_locked_at가 비어있는 상태 캡쳐
  - Workbench에서 확정 후 값이 생기는 상태 캡쳐
  - grep 결과(호출 위치 제한) 로그 첨부

끝.