# Master Card Schema Summary (Working Snapshot)

## Status
- Current runtime error: `Could not find the table 'ms_s.cms_master_item' in the schema cache`
- This means the table/view name in the UI is wrong or not exposed via PostgREST.

## Known Functions (from DB list provided)
Schema: `ms_s`

- `fn_admin_master_item_upsert_v1`
  - args:
    - `p_master_item_id uuid`
    - `p_ref_key text`
    - `p_category text`
    - `p_model_no text`
    - `p_suffix text`
    - `p_status text`
    - `p_factory_code text`
    - `p_name text`
    - `p_model_name text`
    - `p_primary_image_url text`
    - `p_base_labor_default numeric`
    - `p_actor_type text`
    - `p_actor_id uuid`
    - `p_correlation_id uuid`
    - `p_idempotency_key text`

- `fn_admin_fix_order_line_master_item_id_v1`
- `fn_ticket_create_master_match_v1`
- `fn_ticket_resolve_master_match_v1`

## Read Source (Confirmed)
- UI should read from: `ms_s.v_staff_master_list_v1`

## Required Queries (Supabase SQL Editor)
Run these and paste results back so UI can be fixed:

### 1) Find master-related views/tables in `ms_s`
```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'ms_s'
  and table_name ilike '%master%'
order by 1,2;
```
Result
| table_schema | table_name                 |
| ------------ | -------------------------- |
| ms_s         | master_item                |
| ms_s         | ticket_master_match        |
| ms_s         | v_admin_master_detail_live |
| ms_s         | v_admin_master_detail_v1   |
| ms_s         | v_admin_master_list_live   |
| ms_s         | v_admin_master_list_v1     |
| ms_s         | v_staff_master_detail_live |
| ms_s         | v_staff_master_detail_v1   |
| ms_s         | v_staff_master_list_live   |
| ms_s         | v_staff_master_list_v1     |

### 2) Find master-related views
```sql
select table_schema, table_name
from information_schema.views
where table_schema = 'ms_s'
  and table_name ilike '%master%'
order by 1,2;
```
Result
| table_schema | table_name                 |
| ------------ | -------------------------- |
| ms_s         | v_admin_master_detail_live |
| ms_s         | v_admin_master_detail_v1   |
| ms_s         | v_admin_master_list_live   |
| ms_s         | v_admin_master_list_v1     |
| ms_s         | v_staff_master_detail_live |
| ms_s         | v_staff_master_detail_v1   |
| ms_s         | v_staff_master_list_live   |
| ms_s         | v_staff_master_list_v1     |

### 3) Optional: list columns for the chosen master view/table
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'ms_s'
  and table_name = '<FILL_FROM_QUERY_1_OR_2>'
order by ordinal_position;
```
Result
| column_name        | data_type                |
| ------------------ | ------------------------ |
| id                 | uuid                     |
| ref_key            | text                     |
| factory_code       | text                     |
| model_no           | text                     |
| suffix             | text                     |
| category           | text                     |
| status             | text                     |
| primary_image_url  | text                     |
| name               | text                     |
| base_labor_default | numeric                  |
| created_at         | timestamp with time zone |
| updated_at         | timestamp with time zone |
| model_name         | text                     |
| aliases_json       | jsonb                    |

## Current UI Expectations
The UI needs a read source that provides:
- `master_item_id` or `master_id`
- `model_name`
- `created_at`
- `material_code_default` (not available in list view)
- `weight_default_g` (not available in list view)
- stone default counts (not available in list view)
- labor totals (not available in list view)

List data comes from `v_staff_master_list_v1`; missing fields should be shown as placeholders or loaded from detail view if needed.
