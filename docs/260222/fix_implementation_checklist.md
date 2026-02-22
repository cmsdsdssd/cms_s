# 260222 Critical Fix Implementation Checklist

## Scope
- Enforce PO-order_line 1:1 integrity.
- Prevent `mark_sent` state rollback.
- Sync `order_line` to `SHIPPED` during shipment confirm chain.
- Freeze receipt `line_items` after linkage/confirmation.
- Force standard confirm path (`cms_fn_confirm_shipment_v3_cost_v1`) by tightening direct base confirm execution.

## Task 1: PO-order_line 1:1 Integrity
- [ ] Detect duplicate `cms_factory_po_line.order_line_id` rows and deterministic keep-rule.
- [ ] Backfill `cms_order_line.factory_po_id` from surviving PO line when null/mismatch.
- [ ] Delete duplicate PO-line rows safely.
- [ ] Add unique index on `cms_factory_po_line(order_line_id)`.
- [ ] Add verification query comments for post-migration checks.

## Task 2: `cms_fn_factory_po_mark_sent` Rollback Guard
- [ ] Patch function to update only `ORDER_PENDING` rows to `SENT_TO_VENDOR`.
- [ ] Ensure `READY_TO_SHIP`/`WAITING_INBOUND`/`SHIPPED` rows are never downgraded.
- [ ] Keep existing return shape and audit logging intact.

## Task 3: Confirm Chain Order Sync
- [ ] Patch `cms_fn_confirm_shipment_v3_cost_v1` to set linked `cms_order_line.status='SHIPPED'`.
- [ ] Set `cms_order_line.shipped_at` from shipment `confirmed_at` (fallback `now()`).
- [ ] Restrict updates to non-terminal states only.
- [ ] Preserve AR create/sync/verify/lock ordering and inventory emit flow.

## Task 4: Receipt Snapshot Mutation Freeze
- [ ] Patch `cms_fn_upsert_receipt_pricing_snapshot_v2`.
- [ ] If `p_line_items` is provided and receipt already linked/confirmed, block with explicit exception.
- [ ] Keep null-safe merge behavior (`line_items` unchanged on null input).
- [ ] Add clear error message for operational guidance.

## Task 5: Direct Base Confirm Hardening
- [ ] Revoke direct execute on `public.cms_fn_confirm_shipment(uuid,uuid,text)` from `anon`.
- [ ] Revoke direct execute on `public.cms_fn_confirm_shipment(uuid,uuid,text)` from `authenticated`.
- [ ] Revoke direct execute on `public.cms_fn_confirm_shipment(uuid,uuid,text)` from `service_role`.
- [ ] Keep execute grants on `cms_fn_confirm_shipment_v3_cost_v1` unchanged.

## Task 6: Verification
- [ ] Grep verification: unique index exists, patched conditions exist, revoke statements present.
- [ ] Run web project typecheck (`npm run typecheck` if available; fallback `npm run build`).
- [ ] Report any pre-existing failures separately from migration changes.
