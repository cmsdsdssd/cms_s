# [CODING AGENT PROMPT] U+웹팩스 “인쇄 전송(uplus_print)” 연동 + 수동 전송완료처리로 상태 확정

### 0) 핵심 목표
* 기존 orders_main > 공장발주(FactoryOrderWizard) 흐름에 새 Fax Provider: `uplus_print` 를 추가한다.
* `uplus_print`는 서버 API로 팩스를 보내는 게 아니라, 사용자가 인쇄(Printer: “U+Webfax”) 를 통해 U+ 간편팩스 클라이언트에서 전송한다.
* 따라서 `uplus_print`의 경우 팩스 전송 후 사용자가 “전송완료처리” 버튼을 눌렀을 때에만 아래 상태가 되도록 한다.
    * `cms_factory_po.status = 'SENT_TO_VENDOR'`
    * `cms_order_line.status = 'SENT_TO_VENDOR'`
* 전송완료처리 시 `cms_fn_factory_po_mark_sent(p_po_id, p_fax_result, p_actor_person_id)` RPC만 사용한다. (직접 update 금지)

### 1) 반드시 지켜야 하는 UX/업무 규칙
* **uplus_print는 공장별로 “개별 인쇄”가 필수**
    * 현재 `handlePrint()`는 선택된 공장들을 한 번에 합쳐서 인쇄하는데, U+ 간편팩스는 전송 대상(수신번호)이 1개 전송 작업에 1개인 경우가 일반적이라, 여러 공장을 한 번에 합쳐 인쇄하면 수신번호가 섞여 사고 난다.
    * 따라서 `uplus_print` 그룹은 그룹 카드별 “U+ 인쇄전송” 버튼으로 해당 공장 1개만 프린트하게 만들어라.
* **“상태 확정”은 오직 전송완료처리에서만**
    * `uplus_print` 그룹은 인쇄 버튼을 눌러도 상태 변경 금지.
    * 사용자가 U+ 팩스 전송창에서 전송을 끝낸 뒤, 우리 화면에서 전송완료처리를 누를 때만 `mark_sent` RPC 호출.
* **U+ 보낸팩스함 조회 링크 제공**
    * confirm 단계(또는 그룹 카드)에 `https://webfax.uplus.co.kr/fax/sent` 를 새 탭으로 여는 링크 버튼 제공.
* **발주서 제목 식별 강화**
    * 우리 발주서 제목이 현재 `발주서 - ${group.prefix}` 형태인데, PO 생성 후에는 제목에 `po_id` 앞 8자리까지 포함해서 검색/대조가 쉽게 해라.
    * 예: `발주서 - RS - 3f2a9c10` (U+ 보낸팩스함에서 제목 검색으로 쉽게 찾게)
* **sendFaxId(=U+ 발송ID) 입력은 “옵션”**
    * 사용자가 U+ 보낸팩스함에서 해당 건의 `faxId(sendFaxId)`를 확인할 수 있으니, 우리 UI에서 `sendFaxId(숫자)` 입력칸을 제공하되 필수는 아님.
    * 입력되면 `cms_fn_factory_po_mark_sent`의 `p_fax_result.provider_message_id`로 저장.

### 2) 수정/추가해야 할 파일 (정확한 경로)
#### (A) Provider enum/타입 확장
* **web/src/components/factory-order/factory-order-wizard.tsx**
    * `FAX_PROVIDERS`에 `uplus_print` 추가
    * `type FaxProvider`에 포함
    * `isFaxProvider()`가 `uplus_print` 통과하도록
* **web/src/app/(app)/settings/page.tsx**
    * `FAX_PROVIDERS`에 `uplus_print` 추가
    * `FaxConfigRow['fax_provider']` 유니언에도 `uplus_print` 추가
    * UI select 옵션에: `U+ Webfax (인쇄 전송)` 같은 label로 추가
    * `uplus_print` 선택 시 사용자 안내 문구 표시:
        * “PC에 U+ 간편팩스 2.0 설치 + 프린터 목록에 ‘U+Webfax’가 있어야 함”
        * “발주서 화면에서 인쇄 → 프린터 ‘U+Webfax’ 선택 → U+ 팩스창에서 수신번호/제목 확인 후 전송”
* **web/src/app/api/fax-send/route.ts (안전장치)**
    * provider 유니언에 `uplus_print` 추가하되, 만약 `uplus_print`로 `/api/fax-send`가 호출되면 400으로: “uplus_print는 인쇄 전송 방식이므로 /api/fax-send 사용 금지” 라고 응답.

### 3) FactoryOrderWizard 동작 변경 상세 (가장 중요)
#### 3.1 상태/데이터 구조 확장
* `FaxSendGroupResult`를 확장해서, `uplus_print`의 “수동확정 대기”를 표현해라.
* 예시:
```typescript
type FaxSendGroupResult = {
  group: FactoryGroup;
  poId: string;
  success: boolean;                 // true면 이미 SENT_TO_VENDOR 확정
  pendingManualConfirm?: boolean;   // uplus_print에서만 true
  providerMessageId?: string | null; // 사용자가 입력한 sendFaxId
  warning?: string;
};
```
* 그리고 컴포넌트 state에 `uplus_print` pending 결과들을 관리할 수 있게 한다.

#### 3.2 PO 생성과 “전송”을 분리
현재 `handleSendFax()`는 `PO 생성 → /api/fax-send → 실패시 cancel` 까지 한 번에 한다. 이를 다음 정책으로 바꿔라:
1. **provider가 uplus_print인 그룹**
    * PO는 생성한다 (`cms_fn_factory_po_create_from_order_lines`)
    * `/api/fax-send` 호출 절대 금지
    * 결과는: `pendingManualConfirm: true`, `success: false` (아직 확정 아님)
    * UI에서: “U+ 인쇄전송” 버튼을 눌러 해당 그룹만 print, 전송 후 “전송완료처리” 버튼으로 `mark_sent` 실행
2. **그 외 provider(mock/apiplex/…) 그룹**
    * 기존대로: PO 생성 → `/api/fax-send` 호출
    * 성공하면 이미 `mark_sent`가 서버에서 처리되므로 `success: true`
    * 실패하면 cancel 시도 및 `success: false`

#### 3.3 인쇄 HTML 개선 (PO 생성 후 제목/식별자 강화)
* `generateFaxHtmlForGroup(group)`를 다음처럼 확장:
    * optional param으로 `poId?: string`를 받는다.
    * `<title>` 및 본문 헤더에 `발주서 - ${group.prefix} - ${poId.slice(0,8)}`, `PO ID: ${poId}` 를 표시한다.
* `uplus_print` 인쇄/프리뷰는 반드시 `poId` 포함된 버전으로 출력한다.
* 즉, `uplus_print` 그룹은 “PO 생성 전”에는 인쇄 버튼 비활성 or “먼저 발주 생성” 안내.

#### 3.4 Preview step UI 변경
* 현재 Preview step 상단에 “인쇄(전체)” 버튼이 있는데, `uplus_print` 선택이 포함되어 있으면 전체 인쇄 버튼을 숨기거나 경고 문구: “U+ 인쇄전송은 공장별로 따로 인쇄해야 합니다.”
* 각 공장 카드 오른쪽에 버튼을 추가:
    * (uplus_print) U+ 인쇄전송
    * (공통) JPG 다운로드는 유지 가능
* **U+ 인쇄전송 버튼 동작:**
    * `window.open()`으로 해당 공장 1개 HTML만 쓰고 `print()` 실행
    * 사용자가 프린터 선택에서 “U+Webfax” 선택하도록 안내 toast도 띄움

#### 3.5 Confirm step UI 변경 (전송완료처리 추가)
* Confirm step에서 결과 리스트를 출력할 때:
    * `success: true` → 기존처럼 “완료”
    * `pendingManualConfirm: true(=uplus_print)` → 아래 UI 제공:
        1. **U+ 보낸팩스함 열기 버튼 (새 탭)**
            * URL: `https://webfax.uplus.co.kr/fax/sent`
            * 안내 텍스트: “제목에서 ‘발주서 - {prefix} - {poId8}’로 검색하면 빠릅니다.”
        2. **(옵션) sendFaxId 입력칸**
            * placeholder: “예: 342656346”
            * 숫자만 입력 유도
            * 저장은 state에만 먼저 반영
        3. **전송완료처리 버튼**
            * 클릭 시 confirm dialog 한번 띄워라: “U+에서 실제 전송을 완료했습니까? 완료처리하면 주문 상태가 SENT_TO_VENDOR로 확정됩니다.”
            * 확인 시 RPC 호출:
```typescript
await callRpc(CONTRACTS.functions.factoryPoMarkSent, {
  p_po_id: poId,
  p_fax_result: {
    provider: "uplus_print",
    success: true,
    provider_message_id: sendFaxId || null,
    payload_url: null,
    request: {
      vendor_prefix: group.prefix,
      vendor_name: group.vendorName,
      fax_number: group.faxNumber ?? null,
      mode: "print"
    },
    response: {
      confirmed_by_user: true,
      confirmed_at: new Date().toISOString(),
      uplus_sent_url: "[https://webfax.uplus.co.kr/fax/sent](https://webfax.uplus.co.kr/fax/sent)",
      sendFaxId: sendFaxId || null
    }
  },
  p_actor_person_id: process.env.NEXT_PUBLIC_CMS_ACTOR_ID ?? null
});
```
* 성공하면:
    * 해당 result를 `success: true`, `pendingManualConfirm: false`로 갱신
    * `queryClient.invalidateQueries({ queryKey: ["cms","orders"] })`
    * toast.success

* (선택) **발주취소 버튼**
    * `uplus_print` pending 상태에서 “아직 전송 안 했는데 잘못 만들었다”를 대비
    * `cms_fn_factory_po_cancel` 호출해서 롤백 가능하게

### 4) n8n(슬랙/이메일) 연동은 “앱 수정 최소”로 제안
* 앱 안에 Slack/Email 직접 구현하지 말고, n8n에서 DB를 폴링하는 방식으로 처리하라(가장 안정적).
* **n8n 워크플로우 A: 팩스 전송/완료 알림**
    * 트리거: Cron (매 1~2분)
    * Supabase Query: `cms_fax_log`에서 `created_at > last_run_time AND success = true`
    * 필요한 정보 join: `cms_factory_po(vendor_prefix, vendor_party_id, fax_number, fax_provider_message_id)`, `cms_party(vendor name)`
    * Slack 메시지 + 이메일 발송: “[발주서 전송완료] {vendor_prefix} {vendor_name} / PO {po_id8} / provider {provider} / fax {fax_number} / sendFaxId {provider_message_id}”
    * last_run_time 저장
* **(옵션) n8n 워크플로우 B: U+ 보낸팩스함 자동 확인**
    * 현실적으로 U+ 사이트 로그인/2FA 때문에 자동화가 깨질 확률이 높다.
    * 최소 구현은 “sendFaxId를 사용자가 입력하도록 유도 + 수동검증 링크 제공”이 우선. 자동화는 필요 시 별도 PoC로.

### 5) 완료 기준(머지 전 체크리스트)
* settings에서 vendor fax provider를 `uplus_print`로 저장 가능
* orders_main > 공장발주:
    * `uplus_print` 공장을 선택하면 Preview에서 공장별 U+ 인쇄전송 버튼이 보임
    * PO 생성 전에는 인쇄 못 하게 하거나 “먼저 발주 생성” 안내가 뜸
    * 인쇄 → 프린터에서 “U+Webfax” 선택 시 U+ 전송창 뜨고, 제목에 `poId8`이 포함됨
* Confirm에서 전송완료처리 누르면
    * 해당 PO와 주문라인 status가 `SENT_TO_VENDOR`로 변경됨 (RPC `mark_sent`로)
* 기존 apiplex/mock 등 자동 전송 플로우는 깨지지 않음