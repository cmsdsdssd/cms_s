# Single Cron Mixed Cadence Checklist

## Documents

- [x] Write mixed cadence design doc
- [x] Write implementation checklist

## Database

- [x] Add `price_sync_master_schedule_v1`
- [x] Add indexes for `(channel_id, next_due_at)` and `(channel_id, effective_sync_profile, next_due_at)`
- [x] Add `price_sync_scheduler_lease_v1`
- [x] Add `claim_price_sync_scheduler_lease_v1(...)`
- [x] Add `release_price_sync_scheduler_lease_v1(...)`
- [x] Add updated-at triggers if available

## App Helpers

- [x] Add cadence policy helper for profile -> cadence
- [x] Add scheduler helper for due computation
- [x] Add scheduler helper for finalization row generation

## Cron Route

- [x] Acquire channel lease before scheduling work
- [x] Release lease in `finally`
- [x] Load active mappings and derive master profiles
- [x] Load schedule rows and compute due masters
- [x] Skip tick cleanly when no due masters exist
- [x] Call scoped `pull(channel_product_ids=...)`
- [x] Call scoped `recompute(master_item_ids=...)`
- [x] Call scoped `create-run(master_item_ids=..., scope_master_item_ids=..., scheduler_reason=...)`
- [x] Finalize schedule after terminal run completion
- [x] Finalize resumed overlapping runs when they become terminal

## Validation

- [x] Test cadence helper defaults
- [x] Test due calculation for missing schedule rows
- [x] Test due calculation for unchanged rows
- [x] Test profile change from GENERAL -> MARKET_LINKED
- [x] Test profile change from MARKET_LINKED -> GENERAL
- [x] Test daily full sync forcing all masters due
- [x] Run targeted tests
- [x] Run diagnostics on modified files
- [x] Run build
