# Shopping Rule-Only SOT Cutover Implementation Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Cut shopping option pricing over to the finalized Rule-only SOT contract with explicit option-entry mappings, central registries, fail-closed recompute, and no live legacy pricing-truth backflow.

Architecture: Introduce new authored-truth tables for explicit option-entry mappings and channel-scoped registries first, switch admin save paths to write only those structures, then cut recompute/storefront to read only the new authored truth and immediately remove legacy pricing-truth paths. Current mock mapping data is disposable, so the cutover uses hard replacement rather than compatibility migration.

Tech Stack: Next.js route handlers, Supabase SQL migrations/RPC, shared shop helpers in `src/lib/shop`, TanStack Query admin UI, QA scripts and build verification.

---

## Acceptance Criteria

- New explicit option-entry mapping and central registry tables exist and enforce category-valid column combinations.
- Admin mapping UI saves only explicit category keys and canonical IDs/codes required by the final contract.
- Recompute trusts saved canonical keys only and fails closed on any missing or invalid reference.
- Storefront returns only publish-derived values and blocks unresolved products immediately.
- Legacy pricing-truth paths are removed or neutralized from live read/write paths.
- QA: `npm run build`, modified-file diagnostics, route QA, and manual API/UI verification all pass.

## Batch 1 - Schema and RPC Cutover

1. Add new migrations for channel-scoped central registries and explicit option-entry mapping tables.
2. Add DB constraints for category-specific key combinations and natural uniqueness on `channel_id + external_product_no + option_name + option_value`.
3. Add append-only audit tables for mapping changes and central registry changes.
4. Add write RPCs for explicit option-entry mappings and central registries that commit save + audit append + recompute queue registration together.
5. Keep old tables untouched for now, but do not extend them further.
6. QA: verify migration SQL parses and new RPC signatures match intended payloads.

## Batch 2 - Admin UI and Save Path Cutover

1. Replace single-save and bulk-save APIs so they write only the new explicit mapping contract.
2. Replace mapping page payload model with category-specific canonical keys instead of legacy pricing knobs.
3. Remove free-text and heuristic pricing-truth behavior from mapping UI state.
4. Surface unresolved rows with blocking banner and row-level fix guidance.
5. Disable publish actions whenever unresolved rows exist.
6. QA: save explicit mappings for each category and verify persisted rows/audit inserts.

## Batch 3 - Recompute and Storefront Cutover

1. Replace canonical-row derivation so it reads only explicit mapping rows plus central registries/masters/ticks/factors.
2. Remove heuristic category inference and observed-value authored fallback from recompute inputs.
3. Replace color, size, decor, addon, other, and notice resolution with the finalized contract.
4. Fail closed if any required canonical key or referenced central record is missing/inactive.
5. Keep storefront publish-only and block immediately on latest unresolved recompute.
6. QA: run recompute and storefront APIs against mapped and intentionally broken products to verify success and fail-closed behavior.

## Batch 4 - Legacy Removal

1. Remove or neutralize legacy pricing-truth reads and writes from `sales_channel_product` save paths.
2. Remove category/value-policy authored truth usage from variants, recompute, and UI paths.
3. Remove remaining sync-rule and manual-override pricing truth paths from live code.
4. Remove legacy alias/debug compatibility routes targeted by the checklist after new paths are verified.
5. QA: search for zero live references to removed legacy pricing-truth surfaces.

## Verification Sequence

1. Run diagnostics on modified files.
2. Run `npm run build`.
3. Run route QA scripts that cover mapping save, recompute, variants, and storefront.
4. Manually exercise the admin mapping flow and relevant API endpoints with real responses observed.
