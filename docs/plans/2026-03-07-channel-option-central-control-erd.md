# ERD Delta: Channel Option Central Control

- Document version: v1.0
- Date: 2026-03-07
- Status: Approved for implementation
- Relation type: additive; preserve legacy compatibility during rollout

---

## Current Limitation Summary

Current `channel_option_category_v2` is too flat for the approved business model.

- It stores `option_name`, `option_value`, `category_key`, `sync_delta_krw`.
- It cannot represent channel-scoped central rule entries with additive overlap, decor snapshots, or `other` reason tracking.
- It should not remain the sole source of truth for the new model.

## Proposed Tables

### 1. `channel_option_rule_catalog`

Purpose: channel-scoped rule group header per business category.

Suggested columns:

- `catalog_id uuid primary key`
- `channel_id text not null`
- `category_key text not null` -- `MATERIAL|SIZE|COLOR|DECOR|OTHER`
- `catalog_name text not null`
- `description text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by text null`
- `updated_by text null`

Suggested constraints:

- check `category_key` allowed set
- index `(channel_id, category_key, is_active)`

### 2. `channel_option_rule_entry`

Purpose: concrete additive rule entries.

Suggested common columns:

- `rule_entry_id uuid primary key`
- `catalog_id uuid not null references channel_option_rule_catalog(catalog_id)`
- `channel_id text not null`
- `rule_type text not null` -- `SIZE|COLOR|DECOR|OTHER`
- `priority integer not null default 100`
- `delta_mode text not null default 'ADDITIVE'`
- `delta_krw integer not null`
- `is_active boolean not null default true`
- `valid_from timestamptz null`
- `valid_to timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by text null`
- `updated_by text null`

Suggested specific columns by rule type:

- size
  - `material_code text null`
  - `weight_min_g numeric(10,2) null`
  - `weight_max_g numeric(10,2) null`
- color
  - `material_code text null`
  - `color_code text null`
- decor
  - `decor_master_item_id uuid null`
  - `decor_model_name_snapshot text null`
  - `decor_material_code_snapshot text null`
  - `decor_weight_g_snapshot numeric(10,2) null`
  - `decor_total_labor_cost_snapshot integer null`
  - `default_component_only boolean null`
- other
  - `reason_template text null`

Suggested constraints:

- check `delta_mode = 'ADDITIVE'`
- check `delta_krw between 100 and 1000000` for `COLOR|DECOR|OTHER`
- check `delta_krw % 100 = 0` for `COLOR|DECOR|OTHER`
- check weight min/max validity for size rows
- index `(channel_id, rule_type, is_active)`
- index `(channel_id, material_code, rule_type)`

### 3. `channel_product_option_mapping_v2`

Purpose: persisted product-option-row mapping into the approved business categories.

Suggested columns:

- `mapping_id uuid primary key`
- `channel_id text not null`
- `master_item_id uuid not null`
- `external_product_no text not null`
- `option_name text not null`
- `option_value text not null`
- `entry_key text not null`
- `business_category text not null` -- `MATERIAL|SIZE|COLOR|DECOR|OTHER`
- `material_code_resolved text null`
- `material_label_resolved text null`
- `size_weight_g_selected numeric(10,2) null`
- `color_code_selected text null`
- `color_label_selected text null`
- `decor_master_item_id_selected uuid null`
- `decor_model_name_selected text null`
- `decor_material_code_snapshot text null`
- `decor_weight_g_snapshot numeric(10,2) null`
- `decor_total_labor_cost_snapshot integer null`
- `other_delta_krw integer null`
- `other_reason text null`
- `source_rule_entry_id uuid null references channel_option_rule_entry(rule_entry_id)`
- `resolved_delta_krw integer not null default 0`
- `legacy_status text not null default 'VALID'` -- `VALID|LEGACY_OUT_OF_RANGE|RULE_INACTIVE|UNRESOLVED`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by text null`
- `updated_by text null`

Suggested constraints:

- unique `(channel_id, master_item_id, external_product_no, option_name, option_value)`
- check allowed `business_category`
- check allowed `legacy_status`
- check `other_reason` required when `business_category = 'OTHER'`

### 4. `channel_product_option_mapping_log`

Purpose: immutable audit trail for mapping changes and warnings.

Suggested columns:

- `log_id uuid primary key`
- `mapping_id uuid not null references channel_product_option_mapping_v2(mapping_id)`
- `channel_id text not null`
- `change_type text not null` -- `CREATE|UPDATE|DELETE|LEGACY_WARNING|RULE_RECOMPUTE|OTHER_REASON_CHANGE`
- `before_json jsonb null`
- `after_json jsonb null`
- `reason text null`
- `actor text null`
- `created_at timestamptz not null default now()`

Suggested indexes:

- `(mapping_id, created_at desc)`
- `(channel_id, created_at desc)`

### 5. `channel_option_rule_entry_log`

Purpose: immutable audit trail for central rule entry changes.

Suggested columns:

- `rule_log_id uuid primary key`
- `rule_entry_id uuid not null references channel_option_rule_entry(rule_entry_id)`
- `channel_id text not null`
- `change_type text not null` -- `CREATE|UPDATE|DEACTIVATE|REACTIVATE`
- `before_json jsonb null`
- `after_json jsonb null`
- `actor text null`
- `created_at timestamptz not null default now()`

### 6. `channel_option_recompute_job`

Purpose: track bulk recompute triggered by central rule changes.

Suggested columns:

- `job_id uuid primary key`
- `channel_id text not null`
- `trigger_rule_entry_id uuid null references channel_option_rule_entry(rule_entry_id)`
- `status text not null` -- `QUEUED|RUNNING|COMPLETED|FAILED`
- `affected_mapping_count integer not null default 0`
- `affected_variant_count integer not null default 0`
- `error_text text null`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `created_by text null`

## Relationship Summary

- one `channel_option_rule_catalog` has many `channel_option_rule_entry`
- one `channel_option_rule_entry` can be referenced by many `channel_product_option_mapping_v2`
- one `channel_product_option_mapping_v2` has many `channel_product_option_mapping_log`
- one `channel_option_rule_entry` has many `channel_option_rule_entry_log`
- one `channel_option_recompute_job` can reference one triggering rule and many affected mappings or variants through runtime processing

## Legacy Compatibility Strategy

### Keep during migration

- `channel_option_category_v2`
- current `channel_option_labor_rule_v1`
- current variant mapping tables and APIs

### Transitional behavior

1. read legacy rows to prefill new mapping UI where possible
2. write new mapping truth into `channel_product_option_mapping_v2`
3. compute `resolved_delta_krw` from new rule entries
4. continue exposing legacy compatibility data until `auto-price` and push paths are fully switched

## Query Use Cases

### Allowed size options for product row

- input: `channel_id`, resolved material code
- query: active `channel_option_rule_entry` where `rule_type = 'SIZE'` and `material_code = ?`
- output: normalized weight values expanded from ranges

### Allowed color options for product row

- input: `channel_id`, resolved material code
- query: active `channel_option_rule_entry` where `rule_type = 'COLOR'` and `material_code = ?`
- output: distinct color list with resolved additive delta

### Allowed decor options for product row

- input: `channel_id`, product master item id, include-all flag
- query: default set from BOM component masters first, optionally all masters

### Recompute mapping resolved delta

- input: one mapping row
- use `business_category` to resolve its delta
- if matching rule missing or inactive, preserve value and set `legacy_status`

## Suggested API Surface Delta

- `GET /api/channel-option-rule-catalogs`
- `POST /api/channel-option-rule-catalogs`
- `GET /api/channel-option-rule-entries`
- `POST /api/channel-option-rule-entries`
- `GET /api/channel-product-option-mappings-v2`
- `POST /api/channel-product-option-mappings-v2`
- `GET /api/channel-product-option-mapping-logs`
- `POST /api/channel-option-recompute-jobs`

## Key Migration Note

Do not overload `channel_option_category_v2` into the new source of truth. That table may remain as legacy classification support during rollout, but the approved business model requires a dedicated rule and mapping schema.


## Oracle Review Delta

- Keep execution-aligned category values compatible with current runtime where needed, especially `COLOR_PLATING` compatibility on legacy bridges.
- Add a many-to-many resolution trace table, for example `channel_product_option_mapping_resolution`, because additive overlap means one mapping may resolve from multiple rule entries.
- Extend mapping rows with `version` and `warning_codes jsonb` instead of relying only on one enum field.
- Backfill migration from both `channel_option_category_v2` and `channel_option_labor_rule_v1`.
- Keep snapshot and recompute outputs stable while editor and push paths migrate.
