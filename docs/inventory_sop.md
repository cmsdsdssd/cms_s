# Inventory SOP

## Scope
- This SOP defines standard operations for inventory receipt, transfer, shipment issue, and stocktake.
- It enforces location tracking, shipment-time pricing lock, and exception monitoring.

## Location/Bin Policy
- Top-level locations are fixed: `OFFICE`, `STORE`, `OFFSITE`.
- Use bin codes for physical detail only.
  - `OFFICE`: `F3`, `B1`
  - `STORE`: `FRONT`, `BACK`
  - `OFFSITE`: `HOME_ME`, `HOME_MOM`, `HOME_SEJIN_MOM`
- `location_code` is mandatory for posted moves.
- `bin_code` is optional, but when provided it must belong to the selected location and be active.

## Process Rules

### 1) Receipt / Adjust / Manual Issue
- Use inventory quick move only for manual inventory operations (receipt, adjust, non-sales issue).
- Always select `location_code`; optionally select `bin_code`.

### 2) Transfer (physical movement)
- For `OFFICE <-> STORE <-> OFFSITE` movement, use transfer RPC (`cms_fn_transfer_inventory_v1`).
- Do not change stock location by editing rows directly.

### 3) Shipment issue (sales)
- Sales issue must be generated via shipment confirm flow.
- Shipment header must carry `source_location_code` (`source_bin_code` optional).
- Store pickup forces source location to `STORE`.
- Inventory issue from shipment confirm is idempotent and posted with shipment source location.
- Pricing snapshot and sell-value lock are handled by shipment confirm chain, not by quick inventory issue.

### 4) Stocktake
- Create stocktake session with location (and optional bin).
- Enter counted lines.
- Finalize session to produce posted ADJUST move for deltas.

## Data Integrity and Guards
- Posted inventory move with null location is blocked by DB validation.
- Location/bin validity is enforced by `cms_fn_assert_location_active_v1`.
- Legacy location codes are normalized to `OFFICE/STORE/OFFSITE`.
- Legacy posted moves with null location are backfilled and tagged in `meta.backfilled=true`.

## Health Metrics
- Inventory health summary (`cms_v_inventory_health_summary_v1`) tracks:
  - posted-null-location counts (30d/90d)
  - negative stock SKU count
  - unlinked posted line count
  - stale draft move count (24h+)
  - on-hand distribution by location (`OFFICE/STORE/OFFSITE`)
- Inventory health issues (`cms_v_inventory_health_issues_v1`) lists actionable exceptions.

## Operator Response Guide
- `POSTED_NULL_LOCATION` > 0: investigate migration gaps or bypassed RPCs immediately.
- `NEGATIVE_STOCK` > 0: verify latest issue/receipt order and correct with transfer/adjust as needed.
- `UNLINKED_POSTED` high: improve master/part linkage discipline to reduce blind spots.
- `STALE_DRAFT` high: clean up abandoned moves to avoid operational confusion.
