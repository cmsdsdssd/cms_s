# Shopping Rule-Only SOT Final Contract

Goal: Replace the mixed shopping option system with a strict Rule-only source-of-truth model that is stable to operate, fail-closed on invalid state, and free from legacy pricing backflow.

Date: 2026-03-14
Status: Governing contract for the next implementation cutover.

Works with:
- `web/docs/plans/2026-03-14/shopping-rule-only-sot-execution-checklist.md`

---

## 1. Core Operating Principles

### 1.1 Fail Closed

If any option entry cannot be fully explained by Rule-only authored inputs, the product is unresolved.

- unresolved row -> unresolved product
- unresolved product -> recompute fail
- recompute fail -> publish blocked immediately
- publish blocked -> storefront blocked immediately

Forbidden:
- partial publish
- unresolved row treated as 0
- fallback to stale publish values
- fallback to live/current/admin reconstructed values

### 1.2 Authored Truth Only Flows Forward

Only authored truth may generate canonical rows.

Authored truth:
- option-entry mappings
- material registry
- size shared grid
- color combo catalog
- color bucket registry
- decor master and decor rules
- addon master
- other reason code registry
- notice code registry
- master item material context
- material factor and tick context

Derived truth:
- canonical rows
- publish rows
- storefront rows
- live verification state

Forbidden:
- live state -> authored truth backflow
- publish rows -> authored truth backflow
- variant residual decomposition -> authored truth
- heuristic text parsing during recompute after mapping is saved

### 1.3 Explicit Mapping Only

Option category and option keys must be explicitly stored.

Forbidden:
- category inference by option name as final truth
- category inference by option text as final truth
- using observed product values to fill authored allowlists

### 1.4 Automatic Propagation

When a central authored value changes, affected products automatically re-enter recompute.

- central change saved
- audit log appended
- affected products enqueued
- successful products republished immediately
- failed products blocked individually

---

## 2. Final Category Model

Final category set:
- `MATERIAL`
- `SIZE`
- `COLOR_PLATING`
- `DECOR`
- `ADDON`
- `OTHER`
- `NOTICE`

### 2.1 MATERIAL

Meaning:
- classification only
- never a direct option price delta

Rule:
- `resolved_delta_krw = 0`
- material pricing context always comes from `cms_master_item` master material
- material codes are valid only if registered in the channel material registry

Stored key:
- `material_registry_code`

Example:
- `[소재::14K] -> MATERIAL + material_registry_code=14`
- row delta = `0`
- downstream pricing still uses master material context

### 2.2 SIZE

Meaning:
- explicit weight mapping into a shared channel-wide size grid

Rule:
- final size delta comes only from shared grid lookup
- lookup key = `master material + weight_g`
- grid scope is channel-wide, not per product

Stored key:
- `weight_g`

Example:
- `14 + 0.01g = 1000`
- any product mapped to `weight_g=0.01` with master material `14` must resolve to `1000`
- if the shared grid cell becomes `2000`, all affected products become `2000`

### 2.3 COLOR_PLATING

Meaning:
- explicit combo identity plus explicit price bucket identity

Rule:
- final color delta comes from the mapped color bucket
- combo code identifies what the color/plating choice is
- bucket identifies which central price group it belongs to

Stored keys:
- `combo_code`
- `color_bucket_id`

Example:
- `[색상::[도] P] -> combo_code=P + color_bucket_id=bucket_5000`
- `bucket_5000` has `base_cost_krw=5000`, `sell_delta_krw=9000`
- final color delta = `9000`

### 2.4 DECOR

Meaning:
- repeatable decor option tied to a decor master

Rule:
- price truth comes only from decor master plus central decor rule
- same decor master must resolve to the same final price everywhere
- new decor must be registered first as decor master

Stored key:
- `decor_master_id`

Example:
- `[장식::붕어장식] -> decor_master_id=decor_fish_01`
- recompute reads current decor rule for `decor_fish_01`

### 2.5 ADDON

Meaning:
- repeatable sellable add-ons such as gift box, ribbon, shopping bag

Why it exists:
- repeated sellable add-ons must not be hidden inside `OTHER` or `NOTICE`

Rule:
- final addon delta = `base_amount_krw + extra_delta_krw`
- both values come from addon master data

Stored key:
- `addon_master_id`

Example:
- `[부가옵션::곰돌이 선물상자] -> addon_master_id=addon_giftbox_bear`
- addon master has `base_amount_krw=3000`, `extra_delta_krw=1000`
- final addon delta = `4000`

### 2.6 OTHER

Meaning:
- narrow exception valve only
- not a general-purpose pricing category

Rule:
- requires explicit `other_reason_code`
- requires explicit `explicit_delta_krw`
- repeated sellable options must not stay in `OTHER`

Stored keys:
- `other_reason_code`
- `explicit_delta_krw`

Example:
- `[기타::특수요청] -> other_reason_code=GIFT_SPECIAL + explicit_delta_krw=3000`

### 2.7 NOTICE

Meaning:
- non-price informational option

Rule:
- `resolved_delta_krw = 0`
- backed by explicit `notice_code`

Stored key:
- `notice_code`

Example:
- `[안내::주문제작 상품] -> notice_code=MADE_TO_ORDER`
- final delta = `0`

---

## 3. Shared Mapping Storage Contract

### 3.1 One Row Per Option Entry

Authored mapping grain is one row per `option_name + option_value`.

Examples:
- `[색상::[도] P]` = one row
- `[색상::[도] W]` = one row
- `[사이즈::0.01g]` = one row

Forbidden:
- one row per entire axis
- one row per variant combination
- one product JSON blob as pricing truth

### 3.2 Shared Mapping Natural Key

Unique key:
- `channel_id + external_product_no + option_name + option_value`

### 3.3 Shared Required Columns

Required columns:
- `channel_id`
- `external_product_no`
- `option_name`
- `option_value`
- `category_key`
- `is_active`
- `created_at`
- `updated_at`

### 3.4 Category-Specific Stored Keys

- `MATERIAL -> material_registry_code`
- `SIZE -> weight_g`
- `COLOR_PLATING -> combo_code + color_bucket_id`
- `DECOR -> decor_master_id`
- `ADDON -> addon_master_id`
- `OTHER -> other_reason_code + explicit_delta_krw`
- `NOTICE -> notice_code`

### 3.5 DB-Level Check Constraints

The shared mapping table must enforce category-valid column combinations in the database.

Examples:
- `category=SIZE` -> `weight_g` required, unrelated category columns must be `NULL`
- `category=COLOR_PLATING` -> `combo_code` and `color_bucket_id` required, unrelated category columns must be `NULL`

### 3.6 Mapping Deletion Policy

- current-state table uses soft delete
- row becomes `is_active=false`
- `updated_at` changes
- no physical deletion required for normal operator flow

---

## 4. Central Registry and Master Tables

All central tables are channel-scoped.

### 4.1 Shared Meta Convention

Every central table aligns on:
- `id` or `code`
- `label` or `name`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

### 4.2 Material Registry

Required domain fields:
- `material_type`
- `tick_source`
- `factor_ref`

### 4.3 Color Bucket Registry

Required domain fields:
- `base_cost_krw`
- `sell_delta_krw`

### 4.4 Addon Master

Required domain fields:
- `base_amount_krw`
- `extra_delta_krw`

### 4.5 Notice Code Registry

Required domain fields:
- `display_text`
- `description`

### 4.6 Other Reason Code Registry

Required domain fields:
- `display_text`
- `description`

---

## 5. Recompute and Publish Contract

### 5.1 Recompute Trust Rule

Once a mapping row is explicitly saved, recompute trusts saved canonical keys only.

Forbidden:
- re-classifying category by text after save
- re-guessing IDs from labels after save

### 5.2 Missing or Invalid References

If a required key is missing or points to an inactive/missing central record, the row is unresolved.

Examples:
- `color_bucket_id` missing
- `addon_master_id` inactive
- `notice_code` missing

Result:
- row unresolved
- product unresolved
- recompute fails
- publish blocked

### 5.3 Product-Level Failure Rule

If one row fails, the whole product fails.

Forbidden:
- hide bad option only
- publish healthy subset only
- sell unaffected variants onl
