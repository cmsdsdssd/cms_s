[컨텍스트]
- 지금 Supabase(클라우드) DB에는 **public 스키마에 cms_* 테이블/뷰/함수**가 이미 생성되어 있음.
  - 테이블: public.cms_party / cms_order_line / cms_repair_line / cms_shipment_header / cms_shipment_line / cms_ar_ledger / cms_master_item 등
  - 뷰: public.cms_v_order_worklist / cms_v_repair_line_enriched_v1 / cms_v_ar_balance_by_party / cms_v_ar_position_by_party
  - RPC: public.cms_fn_upsert_party_v1 / cms_fn_upsert_order_line_v1 / cms_fn_upsert_repair_line_v1 / cms_fn_create_shipment_header_v1 /
         cms_fn_add_shipment_line_from_order_v1 / cms_fn_add_shipment_line_from_repair_v1 / cms_fn_add_shipment_line_ad_hoc_v1 /
         cms_fn_update_shipment_line_v1 / cms_fn_delete_shipment_line_v1 / cms_fn_confirm_shipment / cms_fn_record_payment / cms_fn_record_return 등
- 반대로, 웹사이트(Next.js) 코드는 아직 **ms_s 스키마/오브젝트명 기준**으로 구현돼 있음.
- 목표: 웹사이트 코드에서 **ms_s를 전부 제거**하고, **public의 cms_* 오브젝트만** 쓰도록 바꾼다.
- 제약: DB 마이그레이션/스키마 변경은 하지 말고(=ms_s 손대지 말고), **웹 코드만 수정**한다.

[작업 범위]
1) web/src 전반에 남아있는 "ms_s" 의존 제거
2) 특히 Catalog(카달로그) 페이지를 **cms_master_item 기반으로 실제 데이터 조회/표시**하도록 연결
3) 기존의 NEXT_PUBLIC_MS_* 계약(env)도 cms로 정리(가능하면 NEXT_PUBLIC_CMS_*로 교체)

[리포지토리 구조(참고)]
- web/src/lib/contracts.ts : 현재 MS_SCHEMA="ms_s" + ms_s용 view/function 계약들이 있음
- web/src/lib/supabase/* : schema("ms_s")를 전제로 동작
- web/src/app/api/master-items/route.ts : ms_s view(v_staff_master_list_v1) 조회
- web/src/app/api/master-item/route.ts : ms_s rpc(fn_admin_master_item_upsert_v1) 호출
- web/src/app/(app)/catalog/page.tsx : 현재 더미 데이터(하드코딩)로만 표시

[핵심 변경 원칙]
- “ms_s 스키마”를 쓰는 코드/문구/환경변수는 전부 제거하고, “public + cms_*” 기준으로 통일한다.
- Supabase JS에서 public은 기본 스키마이긴 하지만, 혼동 방지 위해 가능하면 **schema("public")로 명시**한다.
- RPC 호출은 함수 시그니처의 파라미터명이 p_* 이므로, 프론트에서 보내는 키를 **DB 함수 인자명(p_...)에 정확히 맞춘다.**
- DML(INSERT/UPDATE)은 RLS 때문에 클라이언트에서 막혀있을 수 있으니,
  - “등록/수정”이 필요하면 **서버 라우트(app/api)**에서 **service_role**로 처리하거나,
  - 이미 존재하는 **cms_fn_* RPC**를 사용한다.

────────────────────────────────────────────────────────
[1] contracts.ts / schema 전환 (ms_s → public)
- web/src/lib/contracts.ts
  - MS_SCHEMA 상수를 "public"로 바꾸거나, 이름 자체를 CMS_SCHEMA로 바꿔서 혼동 제거.
  - views 매핑(존재하는 것만 남기기):
    - ordersWorklist: "cms_v_order_worklist"
    - repairsList(또는 repairsEnriched): "cms_v_repair_line_enriched_v1"
    - arBalanceByParty: "cms_v_ar_balance_by_party"
    - arPositionByParty: "cms_v_ar_position_by_party"
    - masterItems: "cms_master_item"   (뷰 없으니 테이블 직접 조회)
  - functions 매핑:
    - partyUpsert        : "cms_fn_upsert_party_v1"
    - orderUpsert        : "cms_fn_upsert_order_line_v1"
    - repairUpsert       : "cms_fn_upsert_repair_line_v1"
    - shipmentCreateHdr  : "cms_fn_create_shipment_header_v1"
    - shipmentAddFromOrd : "cms_fn_add_shipment_line_from_order_v1"
    - shipmentAddFromRep : "cms_fn_add_shipment_line_from_repair_v1"
    - shipmentAddAdHoc   : "cms_fn_add_shipment_line_ad_hoc_v1"
    - shipmentUpdateLine : "cms_fn_update_shipment_line_v1"
    - shipmentDeleteLine : "cms_fn_delete_shipment_line_v1"
    - shipmentConfirm    : "cms_fn_confirm_shipment"
    - recordPayment      : "cms_fn_record_payment"
    - recordReturn       : "cms_fn_record_return"
  - ms_s 전용(shipment_ready_* 등) 계약은 cms에 동일 뷰가 없으니 삭제/대체한다.

────────────────────────────────────────────────────────
[2] supabase client/schema 사용부 정리
- web/src/lib/supabase/client.ts
  - getSchemaClient(): schema("ms_s") → schema("public")
  - 상수명도 MS_SCHEMA → CMS_SCHEMA로 바꾸고 contracts.ts와 동일하게 사용

- web/scripts/contract-tests.mjs
  - db = supabase.schema("ms_s") → supabase.schema("public")
  - 테스트 대상도 cms로 교체:
    - view select: cms_v_order_worklist 또는 cms_v_ar_balance_by_party 같은 실제 존재 뷰로 변경
    - rpc test: cms_fn_confirm_shipment은 준비 데이터 없으면 실패하니,
      우선 실행 안정성을 위해 “조회 테스트” 위주로 바꾸거나,
      MS_CONFIRM_PARAMS_JSON → CMS_* 이름으로 변경하고 문서화

────────────────────────────────────────────────────────
[3] API Route: master-items / master-item (카달로그 핵심)
A) GET /api/master-items  (카달로그 리스트 데이터)
- web/src/app/api/master-items/route.ts
  - 기존: .schema("ms_s").from("v_staff_master_list_v1")
  - 변경: .schema("public").from("cms_master_item")
    - select 예시: master_id, model_name, category_code, material_code_default, labor_band_code, memo, active, created_at, updated_at
    - 정렬: updated_at desc 또는 model_name asc
  - 응답은 카달로그 UI에서 바로 쓰기 좋은 형태(배열)로 반환

B) POST /api/master-item  (카달로그에서 “등록/수정” 가능하게 할 경우)
- web/src/app/api/master-item/route.ts
  - 기존: ms_s rpc(fn_admin_master_item_upsert_v1)
  - cms에는 master upsert rpc가 없으므로, 서버에서 service_role로 테이블 upsert로 처리:
    - 대상 테이블: public.cms_master_item
    - onConflict: "model_name" (unique constraint가 model_name에 있음)
    - 입력 바디: { model_name, category_code, material_code_default, labor_band_code, memo, active }
    - 반환: master_id
  - 만약 “등록/수정 기능”을 아직 안 쓸 거면,
    - route 자체를 비활성화(405)하거나,
    - UI에서 버튼 숨기고 GET만 사용하도록 정리

────────────────────────────────────────────────────────
[4] Catalog 페이지를 실제 cms_master_item 기반으로 연결
- web/src/app/(app)/catalog/page.tsx
  - 현재 하드코딩된 products 배열 제거
  - react-query로 /api/master-items 호출해서 리스트 렌더
    - 로딩/에러 상태 UI 추가(지금 컴포넌트 톤 유지)
  - 카드에 표시할 최소 필드:
    - model_name (제목)
    - category_code / material_code_default / labor_band_code (서브)
    - active (badge)
    - memo (있으면)
  - 필터:
    - 검색: model_name substring
    - 카테고리: category_code 드롭다운(가능하면)
  - (선택) “마스터 추가/수정” 모달:
    - POST /api/master-item 연결(위에서 만들었을 때만)

※ 카달로그에서 “도금 옵션/가격”까지 보여주고 싶으면:
- cms_plating_variant + cms_plating_price_rule 조인/조회가 필요함
- 1차는 master_item 리스트만 연결하고,
- 2차 확장으로 “도금 옵션 탭”을 추가해도 됨(이번 작업에서는 최소 연결 우선)

────────────────────────────────────────────────────────
[5] Orders/Party/Repairs 페이지 RPC 파라미터 키 교정 (p_* 맞추기)
현재 페이지들은 react-hook-form 값 그대로 mutate(values) 하고 있는데,
cms_fn_* RPC는 인자명이 p_* 이므로 onSubmit에서 파라미터 객체를 새로 만들어서 호출해야 함.

A) Party (거래처 등록)
- 사용할 RPC: public.cms_fn_upsert_party_v1
- 인자(순서/이름):
  p_party_type, p_name, p_phone, p_region, p_address, p_memo, p_party_id
- page.tsx에서 예:
  const params = {
    p_party_type: values.party_type,
    p_name: values.name,
    p_phone: values.phone ?? null,
    p_region: values.region ?? null,
    p_address: values.address ?? null,
    p_memo: values.note ?? null,
    p_party_id: null,
  };

B) Orders
- RPC: public.cms_fn_upsert_order_line_v1
- 인자:
  p_customer_party_id, p_model_name, p_suffix, p_color, p_qty, p_size, p_is_plated, p_plating_variant_id, p_memo, p_order_line_id
- params 매핑해서 호출

C) Repairs
- RPC: public.cms_fn_upsert_repair_line_v1
- 인자:
  p_customer_party_id, p_model_name, p_suffix, p_color, p_material_code, p_qty,
  p_measured_weight_g, p_is_plated, p_plating_variant_id, p_repair_fee_krw, p_received_at, p_memo, p_repair_line_id
- params 매핑해서 호출

※ “ms_s 계약의 RPC명이 필요합니다” 같은 문구는 전부 “cms_*” 기준으로 수정/삭제

────────────────────────────────────────────────────────
[6] 남은 ms_s 흔적 0개 만들기(필수)
- web/src 전체에서 다음을 검색해서 0개로:
  - "ms_s"
  - "NEXT_PUBLIC_MS_"
  - "MS_SCHEMA"
  - "v_staff_"
  - "fn_"(ms_s 전용 이름들)
- 단, 문서/주석이더라도 사용자 혼동 방지 위해 정리

────────────────────────────────────────────────────────
[완료 기준(검증)]
- 코드에 ms_s 스키마 접근이 남아있지 않다.
- Catalog 페이지가 실제 DB의 cms_master_item 리스트를 렌더한다(더미 데이터 제거).
- /api/master-items 는 public.cms_master_item에서 조회한다.
- Party/Orders/Repairs의 RPC 호출이 p_* 키로 정상 동작한다.
- 빌드가 깨지지 않는다(Next build 통과).

[주의]
- ms_s 스키마에는 신규 오브젝트 생성/변경을 절대 하지 않는다(웹 코드만 변경).
- cms_master_item “쓰기”는 클라이언트 직접 DML이 막혀 있을 수 있으니,
  반드시 서버 라우트(service_role) 또는 별도 RPC가 있을 때만 활성화.

이 지시대로 변경한 뒤,
- 수정된 파일 리스트 + 핵심 diff 요약 + (가능하면) 빌드 결과를 함께 보고해줘.
