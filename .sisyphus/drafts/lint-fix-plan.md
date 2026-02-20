# Draft: Lint Fixes + Build Verification

## Requirements (confirmed)
- Analyze existing lint errors from a previous run; do not rerun lint to discover new ones.
- Fix lint errors automatically without changing functionality.
- Scope includes scripts/*.js and various app/api/hook files.
- Must avoid logic/behavior changes; use minimal safe edits only.
- Allowed fixes: remove unused imports/vars, refine types if no behavior change, convert require to import in scripts if equivalent.
- Constraints: no new libraries.
- Verification: rerun lint and `npm run build`.

## Lint Output (provided)
- scripts/check_bucket.js: require() imports forbidden (lines 2,3,4)
- scripts/debug_storage.js: require() imports forbidden (lines 2,3,4,5) + unused fs
- scripts/find_image.js: require() imports forbidden (lines 2,3,4)
- src/app/(app)/ar/page.tsx: unused partyOptions
- src/app/(app)/bom/page.tsx: no-explicit-any (lines 75, 248, 270, 280, 380)
- src/app/(app)/catalog/page.tsx: unused Badge
- src/app/(app)/inventory/page.tsx: unused Textarea, MoveRow, getKstNow; no-explicit-any (276, 451, 723); img warning
- src/app/(app)/market/page.tsx: no-explicit-any (line 44)
- src/app/(app)/orders/page.tsx: unused Select/Textarea/platingColors; no-explicit-any (288, 297, 344, 652, 659); img warning
- src/app/(app)/orders_main/page.tsx: unused CONTRACTS
- src/app/(app)/parts/page.tsx: no-explicit-any (484, 489, 495)
- src/app/(app)/purchase_cost_worklist/page.tsx: no-explicit-any (464)
- src/app/(app)/shipments/page.tsx: no-explicit-any (283, 288, 413, 461, 475, 707, 970); img warning
- src/app/(app)/shipments_main/page.tsx: unused totalsByShipment
- src/app/(app)/shipping/page.tsx: unused Select, handleSearchFocus
- src/app/api/market-ticks/route.ts: no-explicit-any (14,34,35,113,135,136,139,140,142)
- src/app/api/order-upsert/route.ts: no-explicit-any (28-30)
- src/app/api/receipt-file/route.ts: no-explicit-any (39)
- src/app/api/receipt-preview/route.ts: no-explicit-any (82,86,96)
- src/app/api/receipt-upload/route.ts: no-explicit-any (102)
- src/app/api/receipts/route.ts: no-explicit-any (54)
- src/hooks/use-rpc-mutation.ts: no-explicit-any (19), unused eslint-disable directive
- src/lib/supabase/read.ts: no-explicit-any (31)

## Repo Notes
- Lint config: `web/eslint.config.mjs` (Next core-web-vitals + TypeScript defaults; no overrides).

## Technical Decisions
- Test infra appears absent in web package (only scripts: dev/build/start/lint).
- Verification likely via `npm run lint` + `npm run build` in `web/`.

## Research Findings
- ESLint guidance: replace `any` with specific types, `unknown`, or generics; prefer ES `import` over `require`; remove unused vars or prefix with `_` when required.
- Explore agent failed (no repo patterns gathered).

## Open Questions
- None.

## Scope Boundaries
- INCLUDE: only lint fixes in reported files; minimal edits.
- EXCLUDE: behavior changes, new dependencies, refactors beyond lint fixes.
