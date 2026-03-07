# Auto-Price v2 History Retention Runbook

## Goal

- Keep `price_sync_run_v2` as long-lived run summary history.
- Keep only meaningful outcomes in `price_sync_change_event`.
- Treat `price_sync_intent_v2`, `price_sync_push_task_v2`, and `price_sync_job_item` as short-lived operational logs.

Migration:

- `supabase/migrations/20260307014000_cms_1106_price_sync_change_event_retention_addonly.sql`

## Retention Policy

- `price_sync_run_v2`: `730 days`
- `price_sync_change_event`: `730 days`
- `price_sync_job`: `90 days`
- `price_sync_intent_v2`: `30 days`
- `price_sync_push_task_v2`: `30 days`
- `price_sync_job_item`: `30 days`

Principles:

- Long-term analytics should use `price_sync_run_v2` + `price_sync_change_event`.
- Short-term debugging should use `price_sync_intent_v2` + `price_sync_push_task_v2` + `price_sync_job_item`.

## What Goes Into change_event

- `PRICE_CHANGED`: successful push with actual price change
- `FORCE_SYNC_APPLIED`: successful push from force-full-sync run
- `PUSH_FAILED`: request failure, job item failure, filtered/missing push result

Not stored long-term:

- successful no-op rows
- full 5-minute candidate list snapshots
- raw operational detail forever

## Apply Sequence

1. Apply migration.
2. Deploy app code with dual-write in `web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts`.
3. Smoke test with one recent run.
4. Register periodic cleanup.

## Post-Apply Checks

```sql
select tablename
from pg_tables
where schemaname = 'public'
    and tablename = 'price_sync_change_event';

select indexname
from pg_indexes
where schemaname = 'public'
    and tablename in ('price_sync_change_event', 'price_sync_intent_v2', 'price_sync_push_task_v2')
order by tablename, indexname;

select proname
from pg_proc
where proname = 'cleanup_price_sync_history_v1';
```

## Runtime Queries

```sql
select run_id, status, trigger_type, total_count, success_count, failed_count, skipped_count, started_at, finished_at
from price_sync_run_v2
where channel_id = :channel_id
order by started_at desc
limit 10;

select created_at, event_type, channel_product_id, before_price_krw, target_price_krw, after_price_krw, reason_code
from price_sync_change_event
where channel_id = :channel_id
order by created_at desc
limit 50;

select created_at, event_type, before_price_krw, target_price_krw, after_price_krw, diff_krw, reason_code, reason_detail
from price_sync_change_event
where channel_product_id = :channel_product_id
order by created_at desc
limit 50;
```

## Cleanup Invocation

```sql
select public.cleanup_price_sync_history_v1();
```

Recommended:

- Run once per day during off-peak hours.
- For the first week, store the returned JSON counts externally.

## Watchouts

- If old run detail pages read directly from `price_sync_job_item`, drill-down will disappear after TTL.
- Long-term drill-down should move to `price_sync_change_event`.
- `reason_detail` is auxiliary JSON only. If a field becomes a frequent filter, promote it to a first-class column.