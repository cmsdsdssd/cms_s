# PR2 (NO CONFLICT): Master is_unit_pricing toggle + RULE rounding unit settings + keep only AMOUNT_ONLY override

## Non-negotiable rules
- NO DB migrations, NO SQL. Backend already deployed (0362).
- NO direct updates/inserts to tables from client:
  - Do NOT use supabase.from('cms_master_item').update(...)
  - Do NOT use supabase.from('cms_market_tick_config').update(...)
  - Do NOT insert/update shipment lines directly
- Confirm must keep using: public.cms_fn_confirm_shipment_v3_cost_v1
- Do NOT reintroduce UNIT pricing_mode or unit policy UI.
- Scope is ONLY:
  1) Settings: configure rule_rounding_unit_krw (global)
  2) Master: is_unit_pricing checkbox toggle (per master)
  3) Shipments UI: leave only "총액 덮어쓰기(AMOUNT_ONLY)" override + show operator hint about rounding when applicable

## Backend contract (already exists)
- Toggle master flag:
  - public.cms_fn_set_master_item_unit_pricing_v1(p_master_id uuid, p_is_unit_pricing boolean, p_actor_person_id uuid, p_session_id uuid, p_memo text)
- Set global rounding unit:
  - public.cms_fn_set_rule_rounding_unit_v1(p_rounding_unit_krw integer, p_actor_person_id uuid, p_session_id uuid, p_memo text)
- Confirm endpoint:
  - public.cms_fn_confirm_shipment_v3_cost_v1(...)

### What backend does at confirm time (do NOT reimplement in FE)
- For shipment lines:
  - pricing_mode='RULE'
  - master.is_unit_pricing=true
  - manual_total_amount_krw is NULL (i.e., NOT AMOUNT_ONLY override)
  -> total_amount_sell_krw is rounded UP by rule_rounding_unit_krw (e.g. 5000)
  -> delta is absorbed into labor sell components
  -> AR/미수 uses the rounded totals

---

# Part A — Contracts & RPC wrapper (small, safe)
## A1) contracts.ts
- Add these contracts (or ensure they exist):
  - setMasterUnitPricing = "cms_fn_set_master_item_unit_pricing_v1"
  - setRuleRoundingUnit = "cms_fn_set_rule_rounding_unit_v1"
  - shipmentConfirmV3Cost = "cms_fn_confirm_shipment_v3_cost_v1"
- Ensure there is no leftover UNIT-related contracts usage.

## A2) Add minimal typed wrappers (optional but preferred)
- Create small helpers in a central rpc helper file:
  - setMasterUnitPricing(masterId, checked, memo?)
  - setRuleRoundingUnit(unit, memo?)
- Use existing supabase rpc call method used elsewhere in the repo.

---

# Part B — Settings UI: RULE rounding unit
Target file: web/src/app/(app)/settings/page.tsx (or the existing settings screen)

## B1) Read current config
- Read cms_market_tick_config where config_key='DEFAULT' and display:
  - rule_rounding_unit_krw (integer)
- Reads can use supabase.from(...).select(...) — READ ONLY is fine.

## B2) UI
- Section title: "RULE 올림 단위 (확정 시 적용)"
- Control: select with values:
  - 0 (미적용), 1000, 5000, 10000, 50000
- Helper text (must show):
  - "확정 시점에만 적용됩니다."
  - "대상: RULE + (마스터 단가제 체크) + 총액 덮어쓰기 아님"

## B3) Save
- Save button calls:
  - cms_fn_set_rule_rounding_unit_v1(p_rounding_unit_krw, actor?, session?, memo)
- After success:
  - toast "저장 완료"
  - refetch config

## B4) Validation
- Ensure unit is integer >= 0
- Disable save when unchanged

---

# Part C — Master UI: is_unit_pricing toggle (per master)
Goal: anywhere the user edits/creates master item, show a checkbox and persist via RPC.

## C1) Find master pages/components
- Search usages of cms_master_item in the frontend:
  - Find master list/detail pages and the form component.
- Update master fetch selects to include:
  - is_unit_pricing

## C2) UI
- Checkbox label: "단가제 (확정 시 RULE 올림 적용)"
- Tooltip / helper:
  - "체크된 모델은 확정 시 RULE 계산 판매가가 설정된 올림 단위로 자동 올림됩니다."
  - "총액 덮어쓰기는 제외됩니다."

## C3) Persist
- On toggle:
  - call cms_fn_set_master_item_unit_pricing_v1(master_id, checked, actor?, session?, memo?)
- Do NOT do direct table updates.
- After success:
  - refetch master record or update local state from returned value

## C4) Edge cases
- If master_id not yet created / new master draft:
  - Hide toggle until master is saved and master_id exists
  - Or keep disabled with tooltip "저장 후 설정 가능"

---

# Part D — Shipments UI: keep only total override (AMOUNT_ONLY) and show hint
Targets:
- web/src/components/shipment/inline-shipment-panel.tsx
- web/src/app/(app)/shipments/page.tsx

## D1) Ensure UNIT/pricing_mode dropdown is NOT present
- Do not add pricing_mode dropdown back.
- Do not add unit_price fields.

## D2) Total override UX (AMOUNT_ONLY)
- Keep (or implement) only:
  - Toggle: "총액 덮어쓰기"
  - Input: manual_total_amount_krw (KRW)
- Behavior:
  - ON:
    - save via existing shipment line update RPC (the repo’s existing method) setting:
      - pricing_mode = 'AMOUNT_ONLY'
      - manual_total_amount_krw = input value
  - OFF:
    - set pricing_mode back to 'RULE'
    - manual_total_amount_krw = null
- Do NOT change any other fields except what is required for override.
- Always refetch the line after saving.

> IMPORTANT: Use the existing RPC already used to update shipment lines (cms_fn_shipment_update_line_v1 or whatever the repo uses now).
> Do NOT invent a new RPC and do NOT touch backend.

## D3) Operator hint about rounding (read-only)
- When a line is selected, show a small info block:
  - If line.master_id exists:
    - fetch cms_master_item(master_id) read-only to get is_unit_pricing
  - fetch rule_rounding_unit_krw from config (can reuse settings fetch cache)
- Display:
  - If is_unit_pricing=true and rule_rounding_unit_krw>0:
    - "이 모델은 확정 시 RULE 판매가가 {unit}원 단위로 올림됩니다."
  - Else:
    - hide or show "올림 미적용"
- This is only informational; do not compute or override totals on FE.

---

# Part E — Verification checklist (must run and report)
## E1) Ensure UNIT does not exist in UI code paths
- rg checks must return 0 relevant results:
  - rg -n "cms_fn_update_shipment_line_pricing_v1|cms_fn_set_unit_pricing_policy_v1|unit_pricing_min_margin_rate|unit_pricing_rounding_unit_krw" web/src
  - rg -n "\\bUNIT\\b|unit_price_krw|unit_price_includes_plating|plating_amount_sell_krw|pricing_mode dropdown" web/src/components/shipment web/src/app/(app)/shipments web/src/app/(app)/settings

## E2) Confirm endpoint unchanged
- rg -n "cms_fn_confirm_shipment_v3_cost_v1" web/src
- Ensure confirm buttons call this endpoint

## E3) Manual smoke flows
1) Settings: set rule_rounding_unit_krw = 5000
2) Master: toggle is_unit_pricing=true for a test model
3) Create/prepare a shipment with that model (RULE line)
4) Confirm shipment via cms_fn_confirm_shipment_v3_cost_v1
   - Expect: confirm succeeds and AR created (backend handles rounding)
5) Same line: enable total override (AMOUNT_ONLY) with 43,000
   - Confirm again on another test shipment
   - Expect: rounding NOT applied (manual total remains)

## Done = merge gate
- Settings has RULE rounding unit control saved via RPC
- Master has is_unit_pricing checkbox saved via RPC
- Shipments screens only have AMOUNT_ONLY override (no pricing_mode dropdown)
- No UNIT/policy code remains
- Confirm uses v3_cost endpoint
