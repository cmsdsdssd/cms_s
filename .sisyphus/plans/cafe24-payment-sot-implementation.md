# Cafe24 Payment SOT Implementation Plan

## Goal
Implement a production-safe payment SOT pipeline for Cafe24 in this repo using webhook + polling hybrid ingestion, append-only observations, deterministic SOT materialization, and reconciliation gating.

## Scope
- Add Supabase migration for payment SOT tables/functions.
- Add Cafe24 admin read helpers (orders/paymenttimeline/refunds/logs).
- Add webhook ingestion endpoint.
- Add cron sync endpoint for polling and SOT recomputation.
- Verify type/lint/build.

## Out of Scope
- Admin UI pages for queue operations.
- Automatic remediation of reconciliation queue items.

## Existing References
- OAuth/account plumbing: `web/src/lib/shop/cafe24.ts`, `web/src/lib/shop/cafe24-oauth.ts`, `web/src/app/api/shop-oauth/cafe24/callback/route.ts`
- Current price sync orchestration: `web/src/app/api/cron/shop-sync-v2/route.ts`
- Existing webhook style: `web/src/app/api/fax-webhook/apiplex/route.ts`
- Existing SOT queue pattern: `supabase/migrations/20260222101000_cms_0719_ar_sot_resolution_queue_addonly.sql`
- Existing SOT release gate pattern: `supabase/migrations/20260222105000_cms_0723_ar_sot_monitoring_and_release_gate_addonly.sql`

## Design Invariants
1. Webhook is trigger only, not payment truth.
2. Payment truth comes from Cafe24 payment timeline observations.
3. All external payloads are append-only with content hash.
4. Idempotency keys are unique and deterministic.
5. Compensation/payment decisions read only `reconciliation_status='GREEN'` SOT rows.

## Work Breakdown

### 1) Migration: payment SOT schema + SQL functions
- File: new migration under `supabase/migrations/`
- Add tables:
  - `shop_webhook_inbox`
  - `shop_poll_run`
  - `shop_poll_cursor`
  - `shop_order_observation`
  - `shop_paymenttimeline_item_observation`
  - `shop_order_payment_sot`
  - `shop_payment_sot_resolution_queue`
- Add functions:
  - `shop_fn_upsert_poll_cursor_v1`
  - `shop_fn_record_payment_observations_v1`
  - `shop_fn_recompute_order_payment_sot_v1`

  - `shop_fn_try_start_poll_run_v1`

Schema details (must implement exactly):
- `shop_webhook_inbox`
  - columns: `inbox_id uuid`, `channel_id uuid`, `mall_id text`, `shop_no int`, `event_no text`, `event_type text`, `order_id text`, `idempotency_key text`, `payload_hash text`, `headers_json jsonb`, `raw_json jsonb`, `received_at timestamptz`, `created_at timestamptz`
  - unique: `unique(idempotency_key)`, `unique(channel_id, payload_hash)`
  - idempotency formula: `CAFE24:WEBHOOK:{channel_id}:{event_type}:{event_no}:{order_id-or-none}:{payload_hash}`
- `shop_poll_run`
  - columns: `poll_run_id uuid`, `channel_id uuid`, `status text(PENDING|RUNNING|SUCCESS|FAILED)`, `cursor_from_ts timestamptz`, `cursor_to_ts timestamptz`, `orders_seen int`, `orders_processed int`, `errors_count int`, `started_at`, `finished_at`, `detail jsonb`
  - index: `(channel_id, started_at desc)`
- `shop_poll_cursor`
  - columns: `channel_id uuid pk`, `last_seen_updated_at timestamptz`, `last_seen_order_id text`, `updated_at timestamptz`
- `shop_order_observation`
  - columns: `observation_id uuid`, `channel_id uuid`, `order_id text`, `order_status text`, `payment_status text`, `order_updated_at timestamptz`, `payload_hash text`, `raw_json jsonb`, `observed_at timestamptz`
  - unique: `unique(channel_id, order_id, payload_hash)`
- `shop_paymenttimeline_item_observation`
  - columns: `timeline_observation_id uuid`, `channel_id uuid`, `order_id text`, `payment_no text`, `payment_settle_type text`, `payment_method text`, `currency text`, `amount_krw numeric`, `paid_at timestamptz`, `payload_hash text`, `raw_json jsonb`, `observed_at timestamptz`
  - unique: `unique(channel_id, order_id, payment_no, payload_hash)`
- `shop_order_payment_sot`
  - columns: `channel_id uuid`, `order_id text`, `gross_paid_krw numeric`, `refund_total_krw numeric`, `net_paid_krw numeric`, `currency text`, `payment_status text`, `reconciliation_status text`, `reconciliation_details jsonb`, `as_of_observed_at timestamptz`, `computed_at timestamptz`
  - primary key: `(channel_id, order_id)`
  - index: `(channel_id, reconciliation_status, computed_at desc)`
- `shop_payment_sot_resolution_queue`
  - columns: `queue_id uuid`, `channel_id uuid`, `order_id text`, `issue_type text`, `issue_key text`, `status text(OPEN|RESOLVED|IGNORED)`, `priority text`, `detail jsonb`, `created_at timestamptz`, `resolved_at timestamptz`
  - unique: `unique(issue_key)`

Required grants/security alignment:
- Follow pattern in `supabase/migrations/20260227116000_cms_1007_shop_security_grants_addonly.sql`.
- Keep direct table writes via service role from API routes; expose only needed RPCs to authenticated roles.

Acceptance:
- Unique constraints enforce dedupe.
- Function computes net paid from O/R/P and writes SOT + queue entries.

### 2) Cafe24 helper functions
- File: `web/src/lib/shop/cafe24.ts`
- Add read APIs:
  - `cafe24ListOrders`
  - `cafe24GetOrder`
  - `cafe24GetOrderPaymentTimeline`
  - `cafe24ListRefunds`
  - `cafe24ListWebhookLogs`
- Reuse token validation and admin headers.

Acceptance:
- All helpers return typed `{ ok, status, ... }` result shape consistent with existing helpers.

### 3) Webhook inbox route
- File: `web/src/app/api/webhooks/cafe24/orders/route.ts`
- Implement:
  - secret verification via header/query/body token (`CAFE24_WEBHOOK_SECRET`)
  - raw payload hashing
  - extract stable routing keys (`mall_id`, `shop_no`, `event_no`, `order_id`)
  - insert into `shop_webhook_inbox` with deterministic idempotency key
  - always return 200 on duplicate
  - do not recompute SOT directly; only enqueue evidence

Acceptance:
- Duplicate deliveries do not create duplicate rows.

### 4) Polling cron route
- File: `web/src/app/api/cron/cafe24-order-payment-sync/route.ts`
- Implement:
  - cron secret guard (`CAFE24_PAYMENT_SYNC_CRON_SECRET`)
  - default disabled guard (`CAFE24_PAYMENT_SYNC_ENABLED=true` required)
  - explicit `channel_id` required (no global all-channel sweep)
  - channel/account load + token refresh
  - cursor with overlap window (`overlap_minutes` default 15)
  - call Cafe24 orders list, fetch per-order detail/timeline
  - persist observations via RPC
  - recompute SOT per order via RPC
  - update poll run/cursor
  - advisory lock / single-run guard per channel

Race safety + transaction requirement:
- Per-order observation persistence and SOT recompute must run in one transaction boundary (inside RPC chain).
- Concurrent sync attempts for same channel must be rejected/serialized by `shop_fn_try_start_poll_run_v1` and/or advisory lock.

GREEN definition (must gate downstream):
- `reconciliation_status='GREEN'` iff all true:
  - payment timeline loaded for order in current sync cycle
  - all timeline items are single currency KRW
  - `net_paid_krw = sum(O,R) - sum(P)` and `net_paid_krw >= 0`
  - no parse/normalization errors in timeline items
- otherwise set `RED` and enqueue `shop_payment_sot_resolution_queue` issue.

Acceptance:
- Re-run is idempotent and safe.
- Returns processed counts and error summary.

### 5) Verification
- Run `lsp_diagnostics` on modified TS files.
- Run `npm run lint` and `npm run build` in `web/`.

Acceptance:
- No TypeScript errors in changed files.
- Build succeeds, or pre-existing unrelated failures documented.
