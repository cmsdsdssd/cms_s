# Split Base/Option Sync Checklist

## Development Order
1. Policy semantics
2. Run creation split
3. Run detail exposure
4. UI wording/types
5. Verification

## Files
- `src/lib/shop/price-sync-policy.js`
  - Change option defaults to `2000 / 2%`
  - Change option helper semantics from `OR` to `MAX(flat, rate)`
- `src/app/api/price-sync-runs-v2/route.ts`
  - Read current option additional from latest pulled Cafe24 variant payloads
  - Split AUTO gating: base rows use total-price threshold/pressure, variant rows use additional-only threshold
  - Persist option decision details and counters in `decision_context_json` and `request_payload.summary`
- `src/app/api/price-sync-runs-v2/[run_id]/route.ts`
  - Expose option decision context fields in run detail API
- `src/lib/shop/price-sync-run-summary.js`
  - Add option-threshold no-intent reason support
- `src/lib/shop/cafe24.ts`
  - Export helper to parse variant additional amount from saved Cafe24 payloads
- `tests/price-sync-policy.test.mjs`
  - Update option threshold expectations
- `tests/price-sync-run-summary.test.mjs`
  - Update no-intent reason expectations

## Notes
- Base policy stays `GENERAL = 5000 / 2%`, `MARKET_LINKED = 500 / 0.5%`
- Option policy is evaluated on `additionalAmount` only
- Base pressure/floor/override remain base-only
- Current option additional is derived from pulled Cafe24 variant payloads already stored in `channel_price_snapshot.raw_json`
