# Price Single SoT Publish Blueprint

## Purpose

- Remove legacy/mock-data dependence for new products and lock pricing to a single source of truth.
- Make computed values, admin display values, push payloads, and storefront display values all show the same numbers.
- Use live Cafe24 values only for verification, never as a pricing source.
- Keep every product in a `base 1 + option entry N` structure.

## Problem Definition

The current system can read the same "option price" from different paths.

- recompute/current-state reads internal calculated values and state.
- storefront breakdown reads live Cafe24 `variant.additional_amount`.
- some paths decompose full variant combinations back into first-axis and second-axis deltas.
- canonical product_no / alias / resolved product_no can cause the same product to be tracked under different identifiers.

Because of this, deleting legacy data alone is not enough. The real fix is forcing all read/write paths to use the same publish tables.

## Core Principles

1. Calculate pricing once.
2. Save publish-target numbers in dedicated publish tables.
3. Push reads only publish tables.
4. Storefront and admin UI also read only publish tables.
5. Live Cafe24 is verification-only.
6. `variant total` is always derived from `base + selected option deltas`.
7. New-product flow does not allow alias/canonical remapping.

## Target Data Model

### 1) Base publish table

Table: `product_price_publish_base_v1`

- PK: `channel_id`, `master_item_id`, `external_product_no`
- Columns:
  - `published_base_price_krw`
  - `currency`
  - `publish_version`
  - `computed_at`
  - `pricing_algo_version`
  - `status` (`DRAFT`, `READY`, `PUSHED`, `SYNCED`, `VERIFY_FAILED`)

Rules:

- Exactly one row per product.
- This is the only source of truth for base price.

### 2) Option entry publish table

Table: `product_price_publish_option_entry_v1`

- PK: `channel_id`, `master_item_id`, `external_product_no`, `option_axis_index`, `option_name`, `option_value`
- Columns:
  - `published_delta_krw`
  - `display_order`
  - `is_active`
  - `publish_version`
  - `computed_at`

Rules:

- Exactly one row per option value.
- This is the only source of truth for option upcharge.
- Do not keep separate raw delta / display delta / storefront delta values for the same meaning.

### 3) Derived variant publish table

Table: `product_price_publish_variant_v1`

- PK: `channel_id`, `master_item_id`, `external_product_no`, `external_variant_code`
- Columns:
  - `selected_option_entry_keys_json`
  - `variant_exception_delta_krw`
  - `published_additional_amount_krw`
  - `published_total_price_krw`
  - `publish_version`

Rules:

- This is derived from option entries, not a manually authored truth table.
- Only this formula is allowed:

```text
published_additional_amount_krw
= sum(selected option entry deltas)
+ variant_exception_delta_krw

published_total_price_krw
= published_base_price_krw
+ published_additional_amount_krw
```

### 4) Live verification table

Table: `product_price_live_state_v1`

- PK: `channel_id`, `master_item_id`, `external_product_no`, `external_variant_code`
- Columns:
  - `live_base_price_krw`
  - `live_additional_amount_krw`
  - `live_total_price_krw`
  - `verified_at`
  - `sync_status`
  - `last_error_code`
  - `last_error_message`

Rules:

- Verification only.
- Never overrides publish truth.
- UI uses it only for "live status".

## Example

Product structure:

- product: `14K/18K ring`
- `external_product_no`: exactly one value
- base price: `2,713,000`

Option entry truth:

- axis 1 `14K/18K`
  - `14K` -> `0`
  - `18K` -> `0`
- axis 2 `color`
  - `rose gold (P)` -> `199,600`
  - `yellow gold (Y)` -> `554,500`
  - `white gold (W)` -> `1,110,800`

The human-readable truth count for this product is always 7 values:

- base 1
- option entries 6

Variants may be 6 combinations, but truth is still 7 rows.

Derived examples:

- `14K + rose gold (P)`
  - additional: `199,600`
  - total: `2,912,600`
- `14K + yellow gold (Y)`
  - additional: `554,500`
  - total: `3,267,500`
- `18K + white gold (W)`
  - additional: `1,110,800`
  - total: `3,823,800`

If any screen shows another "option price" for this product, the design is broken.

## Calculation Spec

### Step 1. Recompute

`pricing/recompute` no longer uses live Cafe24 or current-state as the final publish source.

Inputs:

- cost / market / labor / guardrail
- option rule inputs
- product structure

Outputs:

- `product_price_publish_base_v1`
- `product_price_publish_option_entry_v1`
- `product_price_publish_variant_v1`

Forbidden:

- using live Cafe24 `additional_amount` as publish truth
- using current-state `last_pushed_*` as a pricing input
- feeding storefront reverse-engineered deltas back into publish truth

### Step 2. Push

`channel-prices/push` reads only publish tables.

- base push = `published_base_price_krw`
- variant push = `published_additional_amount_krw`

Forbidden:

- re-thresholding or re-skipping already-approved intents in the push phase
- recomputing variant delta from mixed live base and internal target base
- storing a success log using a different delta basis than the actual push payload

### Step 3. Verify

Immediately after push, read back live Cafe24 values.

- read live product base price
- read live variant additional amount
- store results in `product_price_live_state_v1`

Verification rules:

```text
live_base_price_krw == published_base_price_krw
live_additional_amount_krw == published_additional_amount_krw
live_total_price_krw == published_total_price_krw
```

On mismatch:

- keep publish truth unchanged
- set `sync_status = VERIFY_FAILED`
- show an operator warning
- queue auto-retry or manual retry

## API Spec

### `POST /api/pricing/recompute`

Example response:

```json
{
  "ok": true,
  "publish_version": 12,
  "base": {
    "external_product_no": "13",
    "published_base_price_krw": 2713000
  },
  "option_entries": [
    { "option_axis_index": 1, "option_name": "14K/18K", "option_value": "14K", "published_delta_krw": 0 },
    { "option_axis_index": 1, "option_name": "14K/18K", "option_value": "18K", "published_delta_krw": 0 },
    { "option_axis_index": 2, "option_name": "color", "option_value": "rose gold (P)", "published_delta_krw": 199600 }
  ]
}
```

### `POST /api/channel-prices/push`

Behavior:

- lock a publish version
- push base
- push variants
- verify live values
- log results against the same version

Example response:

```json
{
  "ok": true,
  "publish_version": 12,
  "pushed": 7,
  "verified": 7,
  "failed": 0
}
```

### `GET /api/public/storefront-option-breakdown`

Required change:

- do not reverse-engineer first-axis/second-axis deltas from live variant combinations
- return publish option entry deltas directly
- expose live state only as status metadata if needed

Example response:

```json
{
  "ok": true,
  "product_no": "13",
  "base_price_krw": 2713000,
  "axis": {
    "first": {
      "name": "14K/18K",
      "values": [
        { "label": "14K", "delta_krw": 0 },
        { "label": "18K", "delta_krw": 0 }
      ]
    },
    "second": {
      "name": "color",
      "values": [
        { "label": "rose gold (P)", "delta_krw": 199600 },
        { "label": "yellow gold (Y)", "delta_krw": 554500 },
        { "label": "white gold (W)", "delta_krw": 1110800 }
      ]
    }
  },
  "sync_status": "SYNCED"
}
```

## UI Spec

Admin UI shows only two groups of numbers.

### 1) Publish Truth

- published base price
- published option deltas
- published variant totals

### 2) Live Verification

- live base price
- live option deltas
- sync status

Do not show these side-by-side as if they were the same concept:

- `raw delta`
- `resolved delta`
- `sync delta`
- `final target additional`
- `storefront delta`

## New Product Rules

The new-product path must enforce:

1. exactly one `external_product_no`
2. no canonical/alias remap
3. one active base row per product
4. option entry row count exactly matches actual selectable option values
5. derived variant row count exactly matches actual Cafe24 variants
6. product stays `DRAFT` until first publish
7. produ
