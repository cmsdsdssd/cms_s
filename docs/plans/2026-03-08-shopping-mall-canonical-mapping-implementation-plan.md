# Shopping Mall Canonical Mapping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild shopping-mall mapping so each master has exactly one active canonical base row and canonical-only variant rows, while alias and legacy product numbers move out of active mapping responsibility.

**Architecture:** Treat `sales_channel_product` as the single source of truth for current canonical mappings only. Move alias and legacy product numbers into a separate history/reference table, then update reads, snapshots, sync state, and push flow so all active behavior keys off canonical `channel_product_id` rows.

**Tech Stack:** Next.js route handlers, Supabase Postgres migrations/views, TypeScript/JavaScript server logic, Node-based verification.

---

### Task 1: Add Canonical Alias/History Storage

**Files:**
- Create: `supabase/migrations/20260308xxxxxx_canonical_mapping_alias_history_addonly.sql`
- Modify: `supabase/migrations/20260227110000_cms_1001_shop_channel_core_addonly.sql`
- Test: `web/tests/current-product-sync-profile.test.mjs`

**Step 1: Write the failing schema expectations**
- Document that alias/history rows store previous `external_product_no`
- Document that active mapping no longer owns keepalive base rows

**Step 2: Add the new alias/history table**
- Add columns for canonical row id, canonical product no, alias product no, master, reason, and timestamps

**Step 3: Add lookup indexes**
- `channel_id + alias_external_product_no`
- `channel_id + master_item_id`
- `canonical_channel_product_id`

**Step 4: Verify migration text is internally consistent**
Run: `npm run build`
Expected: PASS

### Task 2: Enforce Canonical Active Base Rules

**Files:**
- Create: `supabase/migrations/20260308xxxxxx_canonical_mapping_active_constraints_addonly.sql`
- Modify: `supabase/migrations/20260303061000_cms_1105_auto_sync_floor_guard_v2_addonly.sql`
- Test: `web/src/app/api/channel-mapping-summary/route.ts`

**Step 1: Write the target constraints in SQL comments**
- one active base row per `channel_id + master_item_id`
- one active variant row per `channel_id + master_item_id + external_variant_code`

**Step 2: Add or replace indexes/constraints**
- partial unique index for active base rows
- partial unique index for active variant rows

**Step 3: Add integrity trigger logic if needed**
- reject active variant rows whose product number does not match the canonical base product number

**Step 4: Verify migration semantics manually**
Check:
- `web/src/app/api/channel-prices/push/route.ts`
- `web/src/app/api/pricing/recompute/route.ts`
- `web/src/app/api/channel-mapping-summary/route.ts`

### Task 3: Rebuild Active Mappings to Canonical-Only Rows

**Files:**
- Create: `supabase/migrations/20260308xxxxxx_rebuild_active_canonical_mappings_addonly.sql`
- Modify: `web/src/app/api/channel-products/route.ts`
- Modify: `web/src/app/api/channel-products/bulk/route.ts`
- Modify: `web/src/app/api/channel-products/editor/route.ts`
- Modify: `web/src/app/api/channel-products/variants/route.ts`

**Step 1: Write the canonical rebuild rules in the migration**
- choose one canonical base product number per master
- deactivate or archive non-canonical active base rows
- move old product numbers into alias/history table
- keep variant rows only under canonical product number

**Step 2: Update single-row save path**
- only write canonical active mappings
- never create compatibility base rows

**Step 3: Update bulk save path**
- canonicalize all rows before write
- reject active writes under non-canonical product numbers

**Step 4: Update editor/variant loaders**
- resolve canonical active rows only
- use alias/history only for diagnostics if needed

**Step 5: Run targeted verification**
Run: `npm run build`
Expected: PASS

### Task 4: Re-Key Snapshot and Explain Flows

**Files:**
- Modify: `supabase/migrations/20260303024500_cms_1103_snapshot_table_hardening_addonly.sql`
- Modify: `supabase/migrations/20260302124500_cms_1101_shop_dashboard_active_mapping_and_latest_tiebreak_addonly.sql`
- Modify: `web/src/app/api/channel-price-snapshot-explain/route.ts`
- Modify: `web/src/app/api/pricing/recompute/route.ts`

**Step 1: Inspect current snapshot key usage**
- confirm readers/writers are keyed by canonical `channel_product_id`

**Step 2: Remove alias-based active fallback from explain paths**
- explain APIs may show alias history, but not treat alias as competing active rows

**Step 3: Update recompute assumptions**
- recompute should operate only on canonical mappings

**Step 4: Verify latest-view semantics**
- latest views still resolve one latest row per canonical mapping

### Task 5: Re-Key Auto Sync State and Run Intent Logic

**Files:**
- Modify: `supabase/migrations/20260307014000_cms_1125_price_sync_auto_state_v1_addonly.sql`
- Modify: `web/src/app/api/price-sync-runs-v2/route.ts`
- Modify: `web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts`

**Step 1: Inspect current state identity usage**
- confirm where `channel_product_id` and logical target keys are persisted

**Step 2: Align run generation with canonical-only mappings**
- generate intents only from canonical active mappings

**Step 3: Align execution with canonical-only channel product ids**
- execution no longer compensates for alias-backed active rows

**Step 4: Preserve logical variant semantics**
- keep logical dedupe by master+variant where useful without alias competition

### Task 6: Remove Keepalive Base Logic from Push Flow

**Files:**
- Modify: `web/src/app/api/channel-prices/push/route.ts`
- Test: `web/src/app/api/channel-prices/push/route.ts`

**Step 1: Write the failing expectation as comments/tests**
- no active keepalive base row creation
- one canonical base row per master
- variants derive from canonical base only

**Step 2: Remove keepalive base generation**
- delete `keepAliveBaseRows` compatibility behavior
- replace with canonical-only resolution

**Step 3: Preserve base-anchor push semantics**
- keep base-first push ordering
- keep variant additional-amount from canonical base
- keep base failure blocking variants

**Step 4: Verify push candidate selection**
- no multiple active base rows remain in candidate choice logic

### Task 7: Simplify Dashboard and Summary Semantics

**Files:**
- Modify: `web/src/app/api/channel-mapping-summary/route.ts`
- Modify: `web/src/app/api/channel-price-dashboard/route.ts`
- Modify: `supabase/migrations/20260302124500_cms_1101_shop_dashboard_active_mapping_and_latest_tiebreak_addonly.sql`

**Step 1: Update summary semantics**
- show canonical row counts, not compatibility row counts

**Step 2: Update dashboard assumptions**
- dashboard still shows base plus variants, but only canonical active rows

**Step 3: Remove conceptual mismatch fields if obsolete**
- remove or redefine `base_row_count_raw` if it no longer serves the canonical model

### Task 8: Verification Sweep

**Files:**
- Test: `web/tests/current-product-sync-profile.test.mjs`
- Test: add canonical mapping regression tests under `web/tests/`

**Step 1: Run diagnostics**
Run: `lsp_diagnostics` on all modified TS/TSX files
Expected: zero errors

**Step 2: Run targeted tests**
Run: `node --test tests/current-product-sync-profile.test.mjs`
Expected: PASS

Add and run new tests for:
- canonical-only active base resolution
- no alias keepalive base rows in push preparation
- one active base per master
- one active variant per master+variant code

**Step 3: Run full build**
Run: `npm run build`
Expected: PASS

**Step 4: Manual verification checklist**
- create one mapped option product
- confirm one base row plus expected variant rows only
- confirm no alias base rows remain active
- confirm push resolves one canonical base and pushes variants from it
