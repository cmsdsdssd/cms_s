# Master Card Schema Summary (Working Snapshot)

## Status
- Current runtime error: `Could not find the table 'cms_master_item' in the schema cache`
- Resolution: use `public.cms_master_item` (table) for read, and server-side upsert for write.

## Known Functions (from DB list provided)
Schema: `public` (cms_*)

No cms_* master upsert RPC found. Use server-side upsert into `public.cms_master_item`.

## Read Source (Confirmed)
- UI should read from: `public.cms_master_item`

## Required Queries (Supabase SQL Editor)
Run these and paste results back so UI can be fixed:

### 1) Find master-related tables in `public`
```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name ilike '%master%'
order by 1,2;
```
Result
| table_schema | table_name                 |
| ------------ | -------------------------- |
| public       | cms_master_item            |

### 2) Find master-related views
```sql
select table_schema, table_name
from information_schema.views
where table_schema = 'public'
  and table_name ilike '%master%'
order by 1,2;
```
Result
| table_schema | table_name |
| ------------ | ---------- |
| (none)       | (none)     |

### 3) Optional: list columns for the chosen master view/table
```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
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
- `material_code_default`
- `weight_default_g`
- stone default counts
- labor totals

List data comes from `public.cms_master_item`.
