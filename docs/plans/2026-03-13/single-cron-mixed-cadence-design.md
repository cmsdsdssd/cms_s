# Single Cron Mixed Cadence Design

## Goal

Keep one 5-minute cron while enforcing mixed cadence with scheduler SOT semantics:

- `MARKET_LINKED`: 5-minute cadence
- `GENERAL`: 2-hour cadence
- `daily full sync`: once per day, channel-wide bypass

The guarantee is bounded lag, not wall-clock exactness:

- `MARKET_LINKED`: due at 5 minutes, executed on the next cron tick
- `GENERAL`: due at 2 hours, executed on the next cron tick

Normal operating guarantee is `cadence <= actual evaluation time < cadence + 5 minutes + processing time`.

## Current Constraints

- `web/src/app/api/cron/shop-sync-v2/route.ts` always runs full `pull -> recompute -> create-run -> execute`
- `web/src/app/api/channel-prices/pull/route.ts` already supports `channel_product_ids`
- `web/src/app/api/pricing/recompute/route.ts` already supports `master_item_ids`
- `web/src/app/api/price-sync-runs-v2/route.ts` already supports `master_item_ids`
- `price_sync_auto_state_v1` stores push/pressure state, not scheduler due state

## Scheduler SOT

Add a dedicated scheduler table:

- `price_sync_master_schedule_v1`
- key: `(channel_id, master_item_id)`
- fields:
  - `effective_sync_profile`
  - `cadence_minutes`
  - `next_due_at`
  - `last_evaluated_at`
  - `last_evaluated_run_id`
  - `last_evaluated_compute_request_id`
  - `last_evaluated_reason`

This table is the only source of truth for mixed cadence due timing.

## Why Master Scope

Scheduling must be `master_item_id` scoped, not `channel_product_id` scoped.

Reasons:

- recompute already works by `master_item_ids`
- create-run already narrows by `master_item_ids`
- one master can expand to multiple product/variant rows, but scheduler cadence should still be one decision

The cron resolves due masters, then expands them into product rows only for the `pull` stage.

## Overlap Control

Add a dedicated lease table and RPCs:

- `price_sync_scheduler_lease_v1`
- `claim_price_sync_scheduler_lease_v1(...)`
- `release_price_sync_scheduler_lease_v1(...)`

The lease prevents two cron invocations from starting separate scheduling flows for the same channel at the same time.

This is separate from `RUNNING` run detection. The lease protects the scheduler tick. The existing run status still protects execute/resume behavior.

## Tick Flow

1. Cron starts
2. Acquire channel scheduler lease
3. Resolve whether this tick is inside the daily full-sync window
4. Load active channel mappings and current sync profile by master
5. Load existing scheduler rows for active masters
6. Compute due masters:
   - daily full sync -> all active masters
   - otherwise -> missing schedule row or `next_due_at <= now`
   - profile/cadence changes are normalized before due decision
7. If no due masters, release lease and return `NO_DUE_MASTERS`
8. Expand due masters into due `channel_product_ids`
9. Call scoped `pull(channel_product_ids=...)`
10. Call scoped `recompute(master_item_ids=...)`
11. Call scoped `create-run(master_item_ids=..., compute_request_id=...)`
12. Execute run until terminal or round limit
13. If terminal, finalize scheduler rows for the scoped masters
14. Release lease

## Finalization Rules

Advance scheduler due state only after a terminal evaluation result exists.

- finalize on `SUCCESS`, `PARTIAL`, `FAILED`
- finalize on `NO_PENDING_INTENTS` / zero-intent completion
- do not finalize on `pull`, `recompute`, or `create-run` failure
- do not finalize while the run is still `RUNNING`

Finalization writes:

- `last_evaluated_at = now`
- `last_evaluated_run_id = run_id`
- `last_evaluated_compute_request_id = compute_request_id`
- `last_evaluated_reason = DUE | DAILY_FULL_SYNC | MANUAL`
- `next_due_at = now + cadence`

## Profile Change Rules

- `GENERAL -> MARKET_LINKED`
  - use `last_evaluated_at + 5m`
  - if already overdue, treat as due now
- `MARKET_LINKED -> GENERAL`
  - use `last_evaluated_at + 120m`
- missing `last_evaluated_at`
  - treat as due now

## Daily Full Sync

Daily full sync bypasses normal due filtering.

- scope = all active masters in the channel
- after terminal completion, all active masters get fresh scheduler rows
- this resets drift and guarantees eventual full reconciliation

## Failure Model

- overlap cron tick -> lease blocks the second tick
- tick crash before finalize -> next due stays unchanged, so work is retried
- run still RUNNING on next tick -> resume existing run, then finalize after terminal status
- partial push failure -> finalize cadence anyway, because evaluation completed and retry pressure belongs to push/run state, not cadence SOT
- new master with no scheduler row -> immediate due
- inactive master -> ignored by active mapping scan; stale schedule row can remain harmlessly

## Operational Guarantee

- exact clock-bound scheduling is not promised
- bounded-lag scheduling is promised
- mixed cadence remains stable because due timing is explicit and persisted
- SOT is preserved because every create-run is pinned to the scoped recompute `compute_request_id`

## Files To Change

- add scheduler migration under `supabase/migrations/`
- add scheduler helpers under `web/src/lib/shop/`
- update `web/src/app/api/cron/shop-sync-v2/route.ts`
- add scheduler tests under `web/tests/`
