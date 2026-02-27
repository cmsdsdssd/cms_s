### 🔴 CRITICAL RULES (ZERO DATA LOSS)
1. **NO SUMMARIZATION:** You must NOT summarize, abbreviate, or shorten any part of the text.
2. **FULL COMPLETENESS:** You must include **EVERY** section, bullet point, rule, code snippet, and sentence from the original input. If the input is long, your response must be long. Do not truncate.
3. **STRICT FIDELITY:** Preserve all technical details, paths, filenames, variable names, and logic exactly as provided.

#####내가 보낸 대화#####
총 판매가격 기준으로 쇼핑몰 별로 view를 만들거나 다른 방법을 써서 가격관릴 하고 싶어. 우리 master item id랑 쇼핑몰에서 item id랑 연결해서 가격을 불러와서 적용할거야. 카페24 일단 자사몰로 할거야. 분석이랑 관리하기에 한 뷰에서 해도 괜찮을것 같기도 하고 너가 가장 효과적인 방범으로 제시해줘. 해당 마스터 총공임 구하는 방법이 prd형식으로 문서에 정리돼있어. 그리고 마스터 아이템의 모든 내용을 가져오되, 시세는 다른 곳에서 가져올 수도 있으니까 중량이랑 공임관련도된 내용을 가져오면 돼. 일단은 소재가격 계산하고 총공임 더해서 거기에 마진 곱하는 방식으로 구할 예정이야. 쇼핑몰 관리할 수있는 페이지를 만들어서 거기에서 관리할거야. 그거 관련해서 백엔드랑 프론트엩드 구혙계획 구체적으로 prd, erd각ㄱ각 작성해줘
#####내가 보낸 대화#####

아래 방식이 **“분석/관리(대시보드) + 실제 쇼핑몰 반영(동기화)”**까지 같이 풀기에 가장 효율적이야.

(추천) 단일 “통합 대시보드 View(또는 Materialized View)” + “가격 스냅샷 테이블” 구조
- 쇼핑몰별로 뷰를 여러 개 만들기보다, 채널(shop/mall) 컬럼을 가진 단일 뷰 1개로 통합해서 관리/분석을 한 화면에서 처리
- 가격 산식(소재 + 총공임 + 마진) 결과는 스냅샷으로 저장해서
    - 언제 어떤 시세/룰로 산출됐는지 추적 가능
    - 카페24에 실제 반영한 이력(성공/실패)도 관리 가능
- 계산 로직(총공임 SoT)이 SQL로 재구현하기 까다로운 부분(흡수공임/장식라인 등)도 백엔드 TS 로직으로 일관성 있게 유지 가능

---

## PRD: 쇼핑몰(카페24) 가격관리 대시보드 & 동기화 v1

- **문서버전:** v1.0 (2026-02-27)
- **대상 채널:** Cafe24(자사몰) 1개부터 시작 → 멀티 채널 확장 가능
- **핵심 키:** master_item_id ↔ channel_product_id(카페24 product_no) 매핑 기반

### 1) 목적 / 배경
#### 1.1 목적
- 마스터 기준으로 총 판매가격(= 소재가격 + 총공임 + 채널마진) 을 자동 산출하고,
- 카페24의 현재 판매가를 불러와 비교하고,
- 필요 시 카페24 판매가를 일괄/선택 반영할 수 있는 관리 페이지 제공.

#### 1.2 현재 Pain Point
- 시세/공임/정책이 바뀔 때 쇼핑몰 가격을 일괄 관리/검증/반영하기 어렵고
- “왜 이 가격이 나왔는지”에 대한 근거(브레이크다운)와 이력이 남지 않아 운영 리스크가 큼

#### 1.3 성공 기준 (Success Metrics)
- 카페24에 매핑된 상품 중
    - “권장가”와 “현재가”의 차이를 1페이지에서 확인
    - 선택 상품을 1회 작업으로 가격 반영
- 반영 결과(성공/실패/오류 메시지)가 로그로 남음
- 시세/정책 변경 후 재계산 시, 재계산 스냅샷이 저장되어 비교 가능

### 2) 범위 (Scope)
#### 2.1 v1 포함
- 채널(카페24) 연결 정보 저장 (OAuth 토큰/몰ID/샵번호 등)
- 마스터↔카페24 상품 매핑 관리 (수동/CSV/자동매칭)
- 가격 산출 엔진
    - 입력: 마스터 중량/소재/공임 관련 + (시세) + (채널마진)
    - 출력: 권장 판매가(최종 목표가) + 산출 근거
- 카페24 현재 판매가 조회(pull) & 비교
- 카페24 판매가 업데이트(push) + 동기화 로그
- 분석/관리용 통합 View 제공

#### 2.2 v1 제외(차후)
- 네이버/쿠팡 등 다른 채널 연동
- 옵션(variants)별 가격 동기화(필요 시 v1.5로 분리)
- 프로모션/쿠폰/할인율까지 포함한 “실 결제가” 최적화
- 완전 자동 스케줄 동기화(초기엔 수동 + 선택적 크론)

### 3) 용어 정의
- **Master Item:** 내부 기준 상품(마스터)
- **Channel:** 쇼핑몰(카페24 등)
- **Channel Product:** 쇼핑몰에 등록된 상품(카페24 product_no 기준)
- **권장가(Computed/Target Price):** 산식으로 계산된 “적용해야 할 목표 판매가”
- **현재가(Current Channel Price):** 쇼핑몰 API로 조회한 현재 판매가
- **Override Price:** 운영자가 강제로 지정하는 목표가(예외)
- **스냅샷(Snapshot):** 특정 시점의 시세/룰/산식 결과를 저장한 레코드

### 4) 가격 산식(요구사항)
사용자가 말한 방향대로: 소재가격 계산 + 총공임 더함 + 마진 곱
(필요 시 “천원 올림” 같은 라운딩을 채널 정책으로 제공)

#### 4.1 입력 데이터 (마스터에서 가져올 것)
“마스터 아이템의 모든 내용을 가져오되, 시세는 외부에서 올 수도” → v1에서는 가격산출에 필요한 필드만 강제하고 나머지는 정보표시용.

- **필수(가격산출용)**
    - master_item_id
    - material_code_default (예: GOLD_14K, GOLD_18K, SILVER_925 등)
    - weight_default_g, deduction_weight_default_g (순중량 계산)
    - 공임(판매/기준 공임):
        - labor_base_sell_default
        - labor_center_sell_default, labor_sub1_sell_default, labor_sub2_sell_default
        - center_qty_default, sub1_qty_default, sub2_qty_default
        - plating_price_sell_default
    - 스톤소스(흡수공임 제외 룰에 필요):
        - center_stone_source_default, sub1_stone_source_default, sub2_stone_source_default
- **추가(총공임 계산에 필요)**
    - cms_master_absorb_labor_item_v1 (흡수공임)
    - BOM 장식라인(Decor line) + 컴포넌트 마스터(장식용 부자재 마스터)
        - 장식라인은 LINE_KIND:DECOR 노트로 구분(기존 SoT 방식 준수)

#### 4.2 입력 데이터 (시세)
- 금/은 등 원재료 시세 (KRW/g)
    - v1: 기존 시스템의 market tick(gold, silver) 사용
    - v2: 외부 시세 Provider 연동 가능하도록 추상화(tick_source)

#### 4.3 산식 정의(v1)
- **순중량(g)**
    - `net_weight_g = weight_default_g - deduction_weight_default_g`
- **소재가격(원)**
    - `material_amount_krw = f(material_code_default, net_weight_g, tick_price_krw_per_g, factor_config)`
    - (현재 코드베이스의 material-factors 로직을 그대로 재사용하는 것을 전제)
- **총공임(원)**
    - `total_labor_sell_krw = master_labor_sell_excl_decor + decor_labor_sell`
    - `master_labor_sell_excl_decor`: 기본공임 + (센터/서브 공임×수량) + 도금 + 흡수공임(조건부 제외 포함)
    - `decor_labor_sell`: 장식라인(DECOR)들의 컴포넌트 공임 합
- **기준판매가(원)**
    - `base_total_sell_krw = material_amount_krw + total_labor_sell_krw`
- **채널마진 적용**
    - `target_price_raw = base_total_sell_krw * channel_margin_multiplier`
    - 예: 1.00(그대로), 1.08(8% 가산), 1.15(15% 가산)
- **라운딩(채널 정책)**
    - `target_price_krw = round(target_price_raw, rounding_rule)`
    - v1 기본: “천원 올림” 옵션 제공(필요 시 100원/10원 단위도 확장)
- **오버라이드**
    - `final_target_price = override_price ?? target_price_krw`

> 참고: 카페24 상품 리소스에는 price(판매가) 같은 가격 필드가 있으며, 제품 업데이트 API로 수정하는 방식이 일반적이다.

### 5) 기능 요구사항 (Functional Requirements)
#### 5.1 쇼핑몰(채널) 설정
- **화면:** [쇼핑몰 설정]
- 채널 생성/조회/비활성화
- 채널 타입: CAFE24
- 채널명: “자사몰”
- 카페24 연결(계정) 정보
    - mall_id, shop_no(기본 1)
    - OAuth 토큰 저장(Access/Refresh, 만료시간)
    - API 버전 헤더 설정값(기본 “앱 설정 버전” 또는 고정 버전)
- **Cafe24 인증/버전/레이트리밋 요구**
    - 카페24는 OAuth 2.0 기반이며 access_token 만료(2시간), refresh_token 유효(2주) 및 refresh로 토큰 갱신 시 새 토큰이 내려오는 구조를 고려
    - API 버전은 X-Cafe24-Api-Version 헤더로 고정 가능(버전 미지정 시 앱 설정 버전 동작)
    - 요청 수 제한(Leaky Bucket)과 429 대응, X-Api-Call-Limit/Usage 관련 헤더를 확인해 호출량을 제어

#### 5.2 마스터 ↔ 카페24 상품 매핑
- **화면:** [상품 매핑]
- **매핑 CRUD**
    - master_item_id 선택
    - 카페24 product_no 입력/선택
- **자동 매핑(옵션)**
    - 카페24의 product_code / custom_product_code 등에 master_item_id가 들어가 있다면 자동추천
- **CSV 업로드/다운로드**
    - (master_item_id, product_no) 형태
- **검증 규칙**
    - 동일 채널에서 product_no는 1개의 master에만 매핑(유니크)
    - 동일 채널에서 master_item_id는 1개 product_no 또는 다수(정책 선택)
    - v1 추천: 1:1을 기본, 예외 필요 시 “1 master → N products” 허용 옵션

#### 5.3 가격 대시보드(통합 뷰 기반)
- **화면:** [카페24 가격관리]
- 채널 선택(현재는 Cafe24 1개)
- **테이블 컬럼(예시)**
    - master_item_id / 상품명
    - 소재코드 / 순중량(g)
    - 시세(원/g, as_of)
    - 소재가격(원)
    - 총공임(원) + (세부: 기본/알/도금/흡수/장식)
    - 기준판매가(원)
    - 채널마진(배수/%) / 라운딩
    - 권장 목표가(final_target_price)
    - 카페24 현재 판매가(current_price)
    - 차액(원, %)
    - 마지막 조회/동기화 시간
    - 상태: OK / OUT_OF_SYNC / ERROR
- **기능**
    - 필터: 차액 > N원, 소재(GOLD/SILVER), 중량 범위, 에러만, 오버라이드만 등
    - 정렬: 차액 큰 순, 최근 업데이트 순
    - **상세 패널(행 클릭):**
        - 산출 근거(브레이크다운)
        - 관련 마스터/흡수공임/장식라인 리스트
        - 마지막 동기화 결과/오류 메시지

#### 5.4 가격 정책(마진/라운딩) 관리
- **화면:** [가격 정책]
- **채널 기본 정책**
    - margin_multiplier (기본 1.00)
    - rounding_rule (천원올림/백원올림 등)
- **정책 룰(선택)**
    - 소재별, 카테고리별, 특정 태그/라인별 다른 마진
    - 우선순위 규칙: (룰 매칭) 있으면 룰 적용, 없으면 기본값

#### 5.5 오버라이드(예외가) 관리
- 특정 상품은 권장가 대신 강제 목표가 적용
- **필드:**
    - override_price
    - reason
    - 유효기간(optional)
    - 작성자/작성일

#### 5.6 카페24 현재가 불러오기(Pull)
- 선택 상품 또는 전체에 대해 카페24에서 현재 판매가 조회
- 조회 결과는 “채널 현재가 스냅샷”으로 저장
- 실패 시(401/429/기타) 에러 로그 저장 및 UI 표시

#### 5.7 카페24 가격 반영(Push)
- 선택 상품(또는 조건 필터 후 일괄)에 대해 `final_target_price`를 카페24에 업데이트
- 실행 전 “변경 예정 리스트(Preview)” 제공
- 실행 결과(성공/실패/응답코드/메시지) 저장

### 6) 백엔드 구현 계획(구체)
현재 코드베이스가 Next.js + Supabase 패턴(/api 라우트)로 구성되어 있으니 동일 패턴 권장.

#### 6.1 모듈 구조(권장)
- **Pricing Engine (TS 라이브러리)**
    - `computeMaterialAmount(master, tick, factors)`
    - `computeTotalLaborSell(master, absorbItems, decorLines, componentMastersAbsorb)`
    - `computeTargetPrice(base_total_sell, channel_policy, overrides)`
    - ✅ 기존 Catalog에서 “총공임 SoT”로 쓰는 로직을 공용 라이브러리로 분리하고, UI/배치/동기화에서 모두 동일 함수 사용(결과 불일치 방지)
- **Channel Connector 인터페이스**
    - `pullCurrentPrices(product_nos[])`
    - `pushPrices([{product_no, price}])`
    - `ensureValidAccessToken()` (refresh 포함)
- **Cafe24 Connector**
    - OAuth 토큰 갱신: refresh_token 사용 시 access/refresh가 재발급되고 기존 refresh는 만료되는 점을 반영
    - 호출량 제어: 429 대응, X-Api-Call-Limit/Usage 헤더 기반 backoff
    - API 버전: X-Cafe24-Api-Version 헤더 적용

#### 6.2 API 엔드포인트(예시)
- `GET /api/channels` / `POST /api/channels`
- `GET /api/channels/:id/account` / `POST /api/channels/:id/account`
- `GET /api/channel-products?channel_id=...`
- `POST /api/channel-products` (매핑 upsert)
- `DELETE /api/channel-products?...`
- `POST /api/pricing/recompute`
    - channel_id, master_item_ids(optional), force_tick(optional)
    - 결과: pricing_snapshot 저장 + 최신뷰 갱신
- `POST /api/channel-prices/pull`
    - channel_id, product_nos(or master_item_ids)
    - 결과: channel_price_snapshot 저장
- `POST /api/channel-prices/push`
    - channel_id, items[{master_item_id, product_no, target_price}]
    - 결과: price_sync_job + job_items 저장

#### 6.3 배치/스케줄(선택)
- 매일 오전/시세 갱신 시:
    - tick 업데이트 → pricing_snapshot 재계산(선택)
- 매일 1회:
    - 카페24 현재가 pull(선택)
- v1은 “수동 실행 + (선택) 크론”으로 시작 권장

#### 6.4 보안/권한
- 카페24 토큰/클라이언트 시크릿은 DB에 암호화 저장(또는 서버 시크릿 + DB는 refresh_token만)
- 가격 푸시 기능은 관리자 권한만 노출
- 모든 push/pull/override 변경은 audit 로그 남김

### 7) 프론트엔드 구현 계획(구체)
#### 7.1 정보구조(IA)
- 사이드바(예시)
    - 쇼핑몰 관리
        - 채널 설정
        - 상품 매핑
        - 가격 대시보드(카페24)
        - 동기화 로그

#### 7.2 페이지별 상세
**(1) 채널 설정 페이지**
- 카페24 연결 상태(connected/disconnected)
- OAuth 연결 플로우(가능하면)
- v1 MVP: 토큰/만료시간 수동 입력도 허용(운영 편의)
- API 버전 표시/설정

**(2) 상품 매핑 페이지**
- 마스터 검색/필터 + 카페24 상품 검색
- 자동추천(가능하면)
- CSV 업/다운
- 매핑 상태(OK/중복/누락) 표시

**(3) 가격 대시보드 페이지(핵심)**
- **상단 컨트롤**
    - [현재가 불러오기] 버튼
    - [재계산] 버튼
    - [선택 반영] 버튼(푸시)
    - 마진/라운딩 정책 quick edit(채널 기본값)
- **테이블**
    - diff 큰 순 정렬/필터
    - 체크박스 선택 + Bulk push
- **상세 Drawer**
    - 소재가격 산출 근거
    - 총공임(기본/센터/서브/도금/흡수/장식) breakdown
    - 적용된 마진 룰/오버라이드 정보
    - 마지막 동기화 로그

**(4) 동기화 로그 페이지**
- job 단위 목록(수동/자동, 수행자, 성공/실패 수)
- job 상세(아이템별 결과/에러 메시지)

---

## ERD (v1)

아래는 “기존 마스터/흡수공임/BOM”은 참조(READ) 로 두고, 쇼핑몰 연동/가격관리용 테이블을 추가하는 설계야.

### 1) 핵심 엔터티
- **기존(참조)**
    - cms_master_item
    - cms_master_absorb_labor_item_v1
    - cms_v_bom_recipe_worklist_v1 / cms_v_bom_recipe_lines_enriched_v1 (decor line 조회용)
    - cms_v_market_tick_latest_by_symbol_ops_v1 (시세 조회용)
- **신규(추가)**
    - sales_channel
    - sales_channel_account
    - sales_channel_product (마스터↔쇼핑몰상품 매핑)
    - pricing_policy (+ optional rules)
    - pricing_snapshot (권장가 스냅샷)
    - pricing_override
    - channel_price_snapshot (쇼핑몰 현재가 스냅샷)
    - price_sync_job / price_sync_job_item
    - v_channel_price_dashboard (통합 View)

### 2) 테이블 정의(요약)
#### 2.1 sales_channel
- channel_id (PK)
- channel_type (enum: CAFE24, …)
- channel_name
- is_active
- created_at, updated_at

#### 2.2 sales_channel_account
- account_id (PK)
- channel_id (FK → sales_channel)
- mall_id (카페24 mallid)
- shop_no (default 1)
- client_id / client_secret (암호화 권장)
- access_token (암호화 권장)
- access_token_expires_at
- refresh_token (암호화 권장)
- refresh_token_expires_at
- api_version (예: 2025-12-01)
- status (CONNECTED/EXPIRED/ERROR)
- created_at, updated_at
> 카페24는 버전 헤더(X-Cafe24-Api-Version), 토큰 만료/갱신, 레이트리밋(429) 처리가 필요하므로 계정 테이블에 만료/버전/상태를 관리하는 게 안전하다.

#### 2.3 sales_channel_product (매핑 테이블)
- channel_product_id (PK, 내부 uuid)
- channel_id (FK)
- master_item_id (FK → cms_master_item.master_item_id)
- external_product_no (카페24 product_no)
- external_variant_code (옵션 대응 시)
- is_active
- created_at, updated_at
- **Unique:** (channel_id, external_product_no) unique

#### 2.4 pricing_policy
- policy_id (PK)
- channel_id (FK)
- policy_name
- margin_multiplier (numeric, default 1.00)
- rounding_unit (예: 1000)
- rounding_mode (CEIL/ROUND/FLOOR)
- is_active
- created_at, updated_at
- **(선택) pricing_policy_rule**
    - rule_id (PK)
    - policy_id (FK)
    - match_material_code (nullable)
    - match_category_code (nullable)
    - margin_multiplier_override
    - priority
    - is_active

#### 2.5 pricing_snapshot (권장가 산출 결과 저장)
- snapshot_id (PK)
- channel_id (FK)
- master_item_id (FK)
- tick_as_of (timestamp)
- tick_gold_krw_g / tick_silver_krw_g (또는 json)
- net_weight_g
- material_amount_krw
- total_labor_sell_krw
- base_total_sell_krw
- applied_margin_multiplier
- target_price_krw
- breakdown_json (산식 근거/세부내역)
- computed_at
- **인덱스:** (channel_id, master_item_id, computed_at desc)
- “최신 스냅샷”을 빠르게 가져오기 위한 pricing_snapshot_latest 뷰/인덱스 권장

#### 2.6 pricing_override
- override_id (PK)
- channel_id (FK)
- master_item_id (FK)
- override_price_krw
- reason
- valid_from, valid_to (nullable)
- created_by
- created_at

#### 2.7 channel_price_snapshot (카페24 현재가 저장)
- channel_price_snapshot_id (PK)
- channel_id (FK)
- external_product_no
- current_price_krw
- fetched_at
- raw_json (원본 응답 일부)

#### 2.8 price_sync_job / price_sync_job_item
- **price_sync_job**
    - job_id (PK)
    - channel_id (FK)
    - run_type (MANUAL/AUTO)
    - requested_by
    - status (RUNNING/SUCCESS/PARTIAL/FAILED)
    - started_at, finished_at
- **price_sync_job_item**
    - job_item_id (PK)
    - job_id (FK)
    - master_item_id (FK)
    - external_product_no
    - before_price_krw
    - after_price_krw
    - status (SUCCESS/FAILED/SKIPPED)
    - error_message
    - updated_at

### 3) 통합 View (관리/분석용)
- **v_channel_price_dashboard (추천)**
    - channel_id, channel_name
    - master_item_id, master_item_name
    - material_code_default, net_weight_g
    - tick_as_of, tick_price
    - material_amount_krw, total_labor_sell_krw, base_total_sell_krw
    - policy_margin_multiplier, target_price_krw
    - override_price_krw, final_target_price_krw
    - current_channel_price_krw
    - diff_krw, diff_pct
    - last_pulled_at, last_pushed_at, last_job_status

> 이 뷰를 **“한 페이지에서 관리”**의 데이터 소스로 쓰면, 쇼핑몰별 뷰를 따로 만들 필요가 거의 없어져. (채널 필터만 바꾸면 됨)

### 마지막으로: “쇼핑몰별 뷰 vs 단일 뷰” 결론
1. 단일 뷰(채널 컬럼 포함) + 스냅샷 테이블이 제일 효율적이야.
2. 분석/관리 UI는 단일 뷰 하나면 충분
3. 채널이 늘어나도 스키마/쿼리/화면을 복제하지 않음
4. “언제 어떤 값으로 계산했고, 언제 쇼핑몰에 반영했는지”까지 운영 추적이 가능

원하면, 위 PRD/ERD를 그대로 기반으로 (1) 실제 Supabase migration SQL 초안, (2) Next.js API route 파일 구조, (3) 가격 대시보드 화면 와이어프레임(컴포넌트 단위)까지 한 번에 더 구체화해서 내려줄게.

---

#####내가 보낸 대화#####
소재가격에서 factor는 쇼핑몰에 따로 적용할거야. 그래서 쇼핑몰별 facotr를 해놓고 전체 쇼핑몰로도 되게 하자. 그건 선택할 수 있게. // 그리고 쇼핑몰에서 제품별로 추가적으로 전체 가격에서 더하고 빼고도 할 수 있게 하는게 좋을 것 같아. 대신 그건 공임에서 뺄수도 있고 총가격에서 뺄수도 있고. 그래야지 우리가 대응이 가능할 것 같아서. // 그리고 나중에 상세페에지도 넣을거야. 그래서 해당 아이템에 bucket 연결하고 하는것도 필요할 수도 있으니까 그건 나중에 구현할거지만 고려만 해줘. // 이거 반영해서 다시 PRD랑 ERD고도화해서 작성해줘.
#####내가 보낸 대화#####

아래는 네가 추가로 말한 3가지를 정식 요구사항으로 반영해서 PRD/ERD를 한 단계 더 “운영 대응형”으로 고도화한 버전이야.

**(A) 소재가격 Factor를 쇼핑몰(채널)별로 적용하되,**
**Global Factor(전체 쇼핑몰 공통)**도 만들고 채널이 어떤 Factor Set을 쓸지 선택 가능하게

**(B) 쇼핑몰 상품(=매핑된 채널 상품) 단위로 가격 조정(+/-)**을 넣되,
그 조정이 공임(Labor)에 반영될지 / 총가격(Total)에 반영될지 선택 가능하게
(추가로 “마진 전/후” 단계까지도 설계에 넣어두면 나중에 대응 폭이 훨씬 넓어짐)

**(C) 향후 상세페이지에서 bucket 연결을 고려해서, v1에서는 미구현이더라도 데이터 모델 자리 확보**

---

## PRD v2: 쇼핑몰(카페24) 가격관리(권장가 산출/비교/반영) + Factor/Adjustment 확장

### 1) 목적
- 마스터 기준 산식으로 **권장 판매가(Target Price)**를 산출하고
- 카페24의 **현재 판매가(Current Price)**를 불러와 차이를 확인하고
- 선택 상품을 카페24에 일괄/선택 반영(Push) 하며
- **Factor(소재 관련) / Adjustment(상품별 +/- 조정)**까지 포함해 운영 대응력을 높인다.

### 2) 핵심 원칙(설계 철학)
1. 계산은 “정책/시세/조정/오버라이드”가 모두 기록되는 스냅샷으로 남겨야 한다
    - → 나중에 “왜 이 가격이 나왔지?”를 반드시 재현 가능해야 함
2. 운영은 “한 화면(통합 대시보드)”에서 되게 하되, 계산 구성 요소(시세/Factor/Adjustment/마진/라운딩)는 분리된 관리 UI를 제공한다
3. SoT(총공임 산식)는 기존 PRD/코드 로직을 공용 Pricing Engine으로 재사용한다
    - (SQL View로 억지로 구현하지 말고, 백엔드 계산 결과를 스냅샷화)

### 3) 범위
#### v1~v1.5(이번 설계에서 포함)
- 카페24 채널 1개(자사몰) 연결
- master_item_id ↔ 카페24 상품(product_no) 매핑
- 시세 기반 소재가격 계산
- 총공임 계산(기존 SoT/PRD 로직 준수)
- 마진/라운딩 정책 적용
- **(추가) 소재 Factor Set(글로벌/채널별) 관리 + 선택 적용**
- **(추가) 상품별 가격 Adjustment(+/-) 관리 (공임 또는 총가격 / 마진 전후)**
- Pull(현재가 조회) / Push(판매가 반영) / 로그

#### 향후 고려(이번엔 자리만)
- 상세 페이지(아이템별) + bucket 연결/표시
- 멀티 채널(스마트스토어/쿠팡 등)
- 옵션(Variant)별 가격

### 4) 가격 산식 v2(팩터/조정 포함)
전제: “시세는 외부에서 가져올 수도” → tick 소스는 추상화하되 v1은 내부 tick 사용

#### 4.1 기본 입력(마스터)
- 중량/차감중량 → 순중량
- 소재 코드(예: GOLD_14K 등)
- 총공임 관련 필드(기존 SoT)
    - 흡수공임, 장식라인(DECOR) 포함

#### 4.2 Factor Set(소재가격용) 요구사항
- Factor는 “소재가격 계산 단계”에서 적용
- Factor Set은 2종류
    - **Global Factor Set:** 모든 쇼핑몰에서 공통 사용 가능
    - **Channel Factor Set:** 특정 채널 전용(자사몰 전용 등)
- 채널은 “이번 계산/운영”에서 어떤 Factor Set을 쓸지 선택 가능
    - 기본값은 채널 정책에 저장(운영 기본 세팅)
    - 필요하면 대시보드에서 **시뮬레이션(임시 선택)**도 가능하게 설계(선택)

#### 4.3 상품별 Adjustment 요구사항
- 채널 상품(카페24 product_no에 매핑된 단위)별로 여러 개 등록 가능
- 각 Adjustment는 아래를 반드시 가진다
    - **적용 대상:** LABOR(공임) 또는 TOTAL(총가격)
    - **적용 단계:** PRE_MARGIN(마진 적용 전) 또는 POST_MARGIN(마진 적용 후)
    - **조정값:** +/- KRW (v1), 추후 %도 확장 가능(설계에는 칼럼 확보)
    - 메모/사유, 유효기간(선택), 우선순위(선택)

#### 4.4 최종 계산 플로우(권장)
1. **순중량**
    - `net_weight_g = weight_default_g - deduction_weight_default_g`
2. **소재 원가(팩터 적용 전)**
    - `material_raw_krw = f(material_code, net_weight_g, tick_price_krw_per_g)`
3. **소재 Factor 적용**
    - `material_factor_multiplier = lookup(factor_set, material_code)` (없으면 1.0)
    - `material_final_krw = material_raw_krw * material_factor_multiplier`
4. **총공임(원가/판매공임 SoT)**
    - `labor_raw_krw = compute_total_labor_sell(master + absorb + decor)`
5. **LABOR Adjustment 적용(마진 전/후 분기)**
    - `labor_pre_margin_adj_krw = sum(adj where apply_to=LABOR and stage=PRE_MARGIN)`
    - `labor_post_margin_adj_krw = sum(adj where apply_to=LABOR and stage=POST_MARGIN)`
6. **Base Total (마진 전 총가격)**
    - `base_total_pre_margin = material_final_krw + (labor_raw_krw + labor_pre_margin_adj_krw)`
    - `total_pre_margin_adj_krw = sum(adj where apply_to=TOTAL and stage=PRE_MARGIN)`
    - `base_total_pre_margin += total_pre_margin_adj_krw`
7. **마진 적용**
    - `margin_multiplier = channel_policy(or rule)`
    - `total_after_margin = base_total_pre_margin * margin_multiplier`
8. **POST_MARGIN Adjustment**
    - `post_margin_total_adj_krw = sum(adj where apply_to=TOTAL and stage=POST_MARGIN)`
    - `post_margin_labor_adj_krw = labor_post_margin_adj_krw`
    - `total_after_margin += (post_margin_total_adj_krw + post_margin_labor_adj_krw)`
9. **라운딩**
    - `target_price_krw = round(total_after_margin, rounding_rule)`
10. **오버라이드**
    - `final_target_price = override_price ?? target_price_krw`

> 운영 관점에서 “공임에서 빼거나 총가격에서 빼거나” 요구를 완벽히 만족하려면 **Adjustment가 ‘어디에 붙는지’와 ‘언제 붙는지(마진 전/후)’**를 명시해야 해. 그래야 나중에 정책 변화에도 계산이 흔들리지 않아.

### 5) 화면/기능 요구사항(업데이트)
#### 5.1 가격 대시보드(통합)
- **화면:** [카페24 가격관리] (핵심 화면)
- **기존 컬럼 + 추가 컬럼**
    - 적용 Factor Set(이름)
    - 소재 Factor Multiplier(요약값 또는 “소재별 적용 있음” 뱃지)
    - Adjustment 합계: Labor Adj 합계(전/후) / Total Adj 합계(전/후)
    - 최종 목표가(final_target_price)
    - 현재가(current_price) / diff
- **행 클릭 상세 Drawer**
    - 소재가격: raw / factor / final breakdown
    - 총공임 breakdown(기존)
    - Adjustment 리스트(활성/비활성, stage/apply_to, 금액, 메모)
    - “이 상품에 Adjustment 추가” (바로 생성)
- **액션**
    - [현재가 불러오기] / [재계산] / [선택 반영(Push)]
    - (선택) “Factor Set 시뮬레이션” 드롭다운 → 선택하면 화면에서 권장가만 즉시 바뀌고 저장은 안 함

#### 5.2 Factor 관리(신규)
- **화면:** [소재 Factor 관리]
- **Factor Set 목록**
    - Scope: GLOBAL / CHANNEL
    - 적용 대상 채널(채널 전용인 경우)
    - 활성/비활성, 변경 이력(선택)
- **Factor Set 상세**
    - 소재코드별 multiplier 편집 (예: GOLD_14K=1.02, SILVER_925=1.00 등)
- **기본값**
    - Global Default Factor Set 지정(시스템 1개)
    - 각 채널 정책에서 “사용할 Factor Set”을 선택

#### 5.3 상품별 Adjustment 관리(신규)
- **UI 방식 추천**
    - 대시보드 Drawer 안에서 “이 상품 Adjustment” CRUD (가장 자연스러움)
- **Adjustment 필드**
    - apply_to: LABOR / TOTAL
    - stage: PRE_MARGIN / POST_MARGIN
    - amount_krw: 정수(음수 허용)
    - note/reason / is_active

#### 5.4 향후 상세페이지 & Bucket(고려만)
- 상세페이지 요구가 들어오면: master_item 기반 상세 + 채널 상품 정보 + 가격 산출 근거 + bucket 연결 표시
- v2 ERD에 bucket 테이블과 매핑 테이블을 미리 추가(v1에서는 쓰지 않아도 됨)

### 6) 백엔드 구현 계획(변경점 중심)
#### 6.1 Pricing Engine v2
- **입력:** master 데이터(중량/공임 관련), tick, policy(마진/라운딩/선택 factor_set), active adjustments, override(optional)
- **출력:** 최종 목표가, breakdown JSON(원가/팩터/조정/마진/라운딩 상세), 스냅샷 저장용 필드들(합계/요약)

#### 6.2 API(추가/변경)
- **Factor Set:** `GET/POST /api/material-factor-sets`, `GET/PUT /api/material-factor-sets/:id`
- **Adjustments:** `GET/POST /api/pricing-adjustments?channel_product_id=...`, `PUT/DELETE /api/pricing-adjustments/:id`
- **Pricing recompute는 v2 산식으로 저장:** `POST /api/pricing/recompute` (factor set 선택/override 포함 가능)

---

## ERD v2(고도화)

### 1) 신규 엔터티 추가 요약
- **material_factor_set / material_factor:** 글로벌/채널별 factor 관리
- **pricing_adjustment:** 상품별 +/- 조정(공임/총가격, 마진 전후)
- **bucket / bucket_master_item:** 향후 상세페이지 대비(미사용 가능)

### 2) 테이블 정의(핵심만)
#### 2.1 Factor
- **material_factor_set**
    - factor_set_id (PK)
    - scope (enum: GLOBAL, CHANNEL)
    - channel_id (FK → sales_channel, nullable; scope=CHANNEL일 때만)
    - name, description, is_active
    - is_global_default (boolean, GLOBAL에서 1개만 true 권장)
- **material_factor**
    - factor_id (PK)
    - factor_set_id (FK → material_factor_set)
    - material_code (예: GOLD_14K 등)
    - multiplier (numeric), note
    - **Unique:** (factor_set_id, material_code)

> 정책(채널)은 특정 factor_set_id를 선택해서 쓰고, 선택하지 않으면 global_default를 사용.

#### 2.2 상품별 Adjustment
- **pricing_adjustment**
    - adjustment_id (PK)
    - channel_id (FK → sales_channel)
    - channel_product_id (FK → sales_channel_product, nullable)
    - master_item_id (FK → cms_master_item.master_item_id, nullable)
    - apply_to (enum: LABOR, TOTAL)
    - stage (enum: PRE_MARGIN, POST_MARGIN)
    - amount_type (enum: ABSOLUTE_KRW, PERCENT)
    - amount_value (numeric; 음수 허용)
    - note, valid_from, valid_to (nullable), is_active
- **제약(권장)**
    - `CHECK(channel_product_id IS NOT NULL OR master_item_id IS NOT NULL)`
    - channel_product_id가 있으면 그 row의 channel_id와 pricing_adjustment.channel_id가 일치해야 함

#### 2.3 정책/스냅샷 변경
- **pricing_policy (추가 컬럼)**
    - `material_factor_set_id` (FK → material_factor_set, nullable)
        - null이면 global_default factor_set 사용
- **pricing_snapshot (추가 컬럼 추천)**
    - 소재 관련: material_raw_krw, factor_set_id_used, material_factor_multiplier_used, material_final_krw
    - 공임/조정: labor_raw_krw, labor_pre_margin_adj_krw, labor_final_pre_margin_krw, total_pre_margin_adj_krw, post_margin_adj_krw
    - 가격: base_total_pre_margin_krw, margin_multiplier_used, total_after_margin_krw, rounded_target_price_krw, final_target_price_krw
    - `applied_adjustment_ids` (json array) ← 어떤 adjustment가 적용됐는지 추적
    - breakdown_json, computed_at

#### 2.4 Bucket(향후 대비)
- **bucket**
    - bucket_id (PK)
    - bucket_type (enum: COLLECTION, TAG_GROUP, …)
    - name, slug (unique, optional), description, is_active
- **bucket_master_item**
    - bucket_id (FK → bucket)
    - master_item_id (FK → cms_master_item)
    - sort_order (nullable)
    - **PK/Unique:** (bucket_id, master_item_id)

### 3) 통합 뷰(v2) 업데이트 포인트
`v_channel_price_dashboard`에 추가될 것
- factor_set_name / scope
- material_raw_krw, material_final_krw
- labor_raw_krw
- adjustment 합계(전/후, 공임/총가격)
- final_target_price_krw
- current_channel_price_krw
- diff, 상태

### 4) 운영 시나리오 예시(이 설계가 커버하는 것)
1. **자사몰만 소재 Factor를 1.03으로 올려야 함**
    - → Channel Factor Set 만들어서 자사몰 정책에서 선택
2. **전 쇼핑몰 공통으로 소재 Factor 변경**
    - → Global Factor Set 수정 or 새 Global Set 만들고 각 채널 정책을 그걸로 변경
3. **특정 상품만 공임에서 -5,000원 빼고 싶음**
    - → pricing_adjustment: apply_to=LABOR, stage=PRE_MARGIN, amount=-5000
4. **특정 상품 최종가에서 +9,900원(심리가격) 붙이고 싶음**
    - → pricing_adjustment: apply_to=TOTAL, stage=POST_MARGIN, amount=9900
5. **나중에 상세페이지에서 bucket으로 묶어서 운영**
    - → bucket / bucket_master_item으로 연결만 추가하면 됨