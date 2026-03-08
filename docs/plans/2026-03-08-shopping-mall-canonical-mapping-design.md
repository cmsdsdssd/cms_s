# Shopping Mall Canonical Mapping Design

**Date:** 2026-03-08

**Goal:**
Rebuild the shopping-mall mapping foundation so each master item has exactly one active canonical base row and variant rows only under that canonical product, while alias and legacy product numbers move out of the active mapping table.

## Problem

The current model mixes several concerns inside `sales_channel_product`:

- current active base mapping
- current active variant mappings
- keepalive base rows for legacy or alias product numbers
- push anchor semantics
- snapshot identity
- auto-sync state identity

This makes one merchandised item appear as multiple rows for different reasons, some intentional and some operationally confusing.

The most confusing part is that active rows currently represent both:

- the canonical product we actually want to operate on
- compatibility rows kept alive so legacy product numbers continue to work

As a result, dashboard reads, push flow, snapshot identity, and debugging all become harder.

## Target Model

### Canonical Active Mapping Only

`sales_channel_product` becomes the table for active canonical mappings only.

Rules:

1. Per `channel_id + master_item_id`, there must be exactly one active base row where `external_variant_code = ''`.
2. Per `channel_id + master_item_id + external_variant_code`, there must be at most one active variant row for non-empty variant codes.
3. Every active variant row must belong to the same canonical `external_product_no` as the active base row for that master.
4. Legacy or alias product numbers must not remain as active mapping rows.

### Alias / History Separation

Alias and legacy product numbers move to a separate persistence layer, for example:

- `sales_channel_product_alias`
- or `sales_channel_product_history`

This layer exists for traceability and migration history only. It is not used as the primary source for dashboard, push, snapshot, or auto-sync state identity.

## Data Ownership

### `sales_channel_product`

Owns:

- canonical active base row
- canonical active variant rows
- pricing rule linkage
- current profile linkage
- current push identity

Does not own:

- alias product number history
- legacy keepalive rows
- compatibility-only rows

### Alias / History Table

Owns:

- previous product numbers
- alias product numbers
- migration lineage
- replacement timestamps and reason metadata

## Read Model Changes

The following readers should resolve only canonical active rows:

- dashboard view
- mapping summary
- editor load
- variants load
- snapshot explain
- push candidate selection
- auto-sync run generation

Historical alias data may be used only for explain/debug tooling, never as a competing active candidate.

## Push Model Changes

Push continues to require base-plus-variant semantics, but only under one canonical product number.

Rules:

1. Base push uses the single canonical base row.
2. Variant push derives additional amount from the canonical base price only.
3. If base push fails, all variants for that master remain blocked, as today.
4. `keepAliveBaseRows` behavior is removed because alias compatibility no longer lives in active mappings.

This preserves base-anchor semantics while removing ambiguous active base duplication.

## Snapshot and State Identity

The following artifacts should key off canonical `channel_product_id` only:

- `pricing_snapshot`
- latest snapshot views
- auto-sync state
- run intent generation
- push job items

This ensures one logical active identity per master base and per master variant.

## Migration Strategy

Mock data does not need to be preserved, so the migration strategy can optimize for correctness instead of compatibility.

### Migration Phases

1. Add alias/history table.
2. Add stricter canonical constraints for active mappings.
3. Backfill or rebuild active mappings so each master has one canonical base and canonical variants only.
4. Re-key snapshot/state readers and writers to canonical mappings.
5. Remove legacy keepalive active-row generation in push and mapping flows.
6. Rebuild dashboard and summary semantics around canonical-only active rows.

## Constraints to Enforce

Desired database guarantees:

- one active base row per `channel_id + master_item_id`
- one active variant row per `channel_id + master_item_id + external_variant_code` for non-empty codes
- active variant rows must share the canonical `external_product_no` of their base row
- no active alias-only base rows

Some of these may require trigger-based integrity rather than a plain index.

## Risks

- push flow currently relies on compatibility behavior around alias product numbers
- snapshot explain currently performs alias fallback behavior
- auto-sync state continuity may break if state is not deliberately re-keyed
- any hidden dependency on `external_product_no` as a primary active identity will need to be rewritten

## Success Criteria

- for every active master, there is one canonical base row and only canonical variant rows
- dashboard rows reflect only canonical active mappings
- push never needs to choose between multiple active base rows for the same master
- snapshots and auto-sync state align with canonical active mappings only
- alias or legacy product numbers remain queryable for audit/debug, but do not participate as active mapping rows
