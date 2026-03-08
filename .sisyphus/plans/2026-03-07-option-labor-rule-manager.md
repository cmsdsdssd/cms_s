# Option Labor Rule Manager

## Goal

Replace the current R1-R4 option rule manager with a category-specific labor-rule manager.

- `MATERIAL`: classification only, no direct price delta
- `SIZE`: master material + additional weight (`0.01g` to `100.00g`)
- `COLOR_PLATING`: plating enabled or disabled + color
- `DECOR`: decoration master item + total labor cost including absorb + additive amount
- `OTHER`: manual additive amount

## Main Decisions

1. Keep `channel_option_category_v2` for classification in auto-price.
2. Add a new dedicated table for option labor rules instead of reusing legacy R1-R4 tables.
3. Replace the rules page UI with a 5-category manager.
4. Update recompute to use the new labor-rule table and keep snapshot bucket outputs.
5. Leave legacy R1-R4 tables in place but stop using them in the new rules page and recompute path.

## Implementation

### Schema

Create `channel_option_labor_rule_v1` with category-specific classifier columns and additive fields.

Required fields:

- `rule_id`
- `channel_id`
- `master_item_id`
- `external_product_no`
- `category_key`
- `scope_material_code`
- `plating_enabled`
- `color_code`
- `decoration_master_id`
- `decoration_model_name`
- `additional_weight_g`
- `base_labor_cost_krw`
- `additive_delta_krw`
- `is_active`
- audit columns

### Backend

Add `web/src/lib/shop/option-labor-rules.ts` for:

- row types
- weight dropdown generation
- decoration total labor including absorb
- per-category matching
- bucket delta resolution

Add routes:

- `GET/POST /api/option-labor-rules`
- `GET /api/option-labor-rule-pools`

Update `web/src/app/api/pricing/recompute/route.ts` to:

- read the new table
- stop consuming legacy R1-R4 option deltas
- resolve bucket deltas as material zero, size matched additive, color matched additive, decor base plus additive, other additive
- preserve snapshot compatibility and state fallback

### UI

Replace `web/src/app/(app)/settings/shopping/rules/page.tsx` with sections for:

- material
- size
- color
- decor
- other

### Copy Updates

Remove R1-R4 references from:

- `web/src/app/(app)/settings/shopping/workflow/page.tsx`
- `web/src/app/(app)/settings/shopping/page.tsx`
- `web/src/app/(app)/settings/shopping/rules/page.tsx`

## Verification

- test size matching by material and weight
- test color matching by plating flag and color
- test decor delta as base labor plus additive
- test material always resolves to zero delta
- run typecheck and build
