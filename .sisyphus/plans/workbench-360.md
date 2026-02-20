## Plan: Workbench Customer 360 PRD

### Goals
- Implement Workbench Overview and Activity per docs/260206/workbenchPRD.md.
- Preserve existing orders/shipments/payments/store pickup flows.
- Keep read-only DB queries; use RPC for writes only.
- Add performance controls (date filters, limit, load more).

### Files to Add/Change
- web/src/app/(app)/workbench/[partyId]/page.tsx
- web/src/app/(app)/workbench/[partyId]/_components/workbench-overview.tsx (new)
- web/src/app/(app)/workbench/[partyId]/_components/workbench-activity.tsx (new)
- web/src/app/(app)/workbench/[partyId]/_components/workbench-returns-tab.tsx (new)
- web/src/app/(app)/workbench/[partyId]/_components/workbench-repairs-tab.tsx (new)
- web/src/app/(app)/workbench/[partyId]/_components/party-info-card.tsx (new; extract from page.tsx)
- web/src/components/timeline/timeline-view.tsx
- web/src/components/party/global-party-selector.tsx

### Steps
1) Refactor PartyInfoCard
   - Use CONTRACTS.views.arPositionByParty for receivable/credit/gold/silver/last_activity.
   - Fetch open invoice count via CONTRACTS.views.arBalanceByParty if needed.
   - Show cash and material outstanding separately.
   - Verify arPositionByParty fields exist: receivable_krw, credit_krw, labor/material cash outstanding, gold/silver outstanding, last_activity_at.

2) Add Overview tab component
   - Smart buttons: receivable/credit, gold/silver, open invoice count, ready-to-ship count, store pickup pending, returns (30d), repairs in progress.
   - Returns smart button must show count + amount sum (30d).
   - Work queue (2-column grid): ready-to-ship orders (InlineShipmentPanel), AR outstanding (arInvoicePosition), store pickup pending, recent returns, repairs (optional).
   - Recent activity mini feed (30d) with type chips.

3) Add Activity feed component
   - Build combined list of orders/shipments/payments/returns/repairs with required fields.
   - Filters: time range (7/30/90/all), type chips (multi-select), search text.
   - Use limit + load more; avoid new Date() fallback for shipment dates.
   - Show type icon + label badge.
   - Remove all `|| new Date()` / `?? new Date()` fallbacks in workbench views; use confirmed_at/created_at/ship_date per PRD.

4) Add Returns and Repairs tabs
   - Returns: cms_return_line with cms_shipment_line join; filter by party via shipment_header.customer_party_id.
   - Repairs: CONTRACTS.views.repairLineEnriched filtered by party_id and status.
   - Add limit + load more for returns/repairs tabs (Top N + expand).

5) Update Workbench page
   - ViewType: overview/activity/orders/shipments/returns/payments/repairs/store_pickup.
   - Default view to overview; treat timeline as alias for activity.
   - Preserve existing tabs for orders/shipments/payments/store_pickup.
   - Preserve store-pickup confirm/print flow from web/src/app/(app)/workbench/[partyId]/page.tsx:515-599.

6) Update TimelineView
   - Add optional prop to show type label badge for activity feed.
   - If using TimelineFilter, extend to include repairs and multi-select; otherwise build dedicated filter UI for Activity.

7) Update GlobalPartySelector
   - Enrich search results with balance and last_activity (arPositionByParty), merge by party_id.
   - Display in dropdown results.

### Verification
- Run lsp_diagnostics on modified files.
- Run lint/build/typecheck if available (web: npm run lint, npm run build, npx tsc --noEmit).
- Run tests if any; document if not configured.
- Manual QA: PRD section 10 (A/B/C/D/E scenarios) and verify shipment date ordering no longer mixed.

### Acceptance Criteria Mapping
- Default view = overview; smart buttons visible.
- Activity shows all types with icons/labels and filters.
- PartyInfoCard shows cash receivable/credit and gold/silver outstanding.
- Existing flows (InlineShipmentPanel, store pickup confirm/print, AR link) preserved.
