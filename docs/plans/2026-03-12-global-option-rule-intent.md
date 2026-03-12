# Global Option Rule Intent

## Goal

Define the intended behavior of `SIZE`, `COLOR_PLATING`, and `DECOR` in auto-price and mall preview.

## Core Model

- Options are not maintained as per-product manual deltas.
- Option values are mapped to internal business meaning, then resolved from central sources of truth.
- Final additional amount is the sum of resolved option deltas for the selected variant.

## SIZE

- `SIZE` is not a generic additive rule bucket.
- `SIZE` resolves from `material_code + weight_g` using the market-linked size grid.
- Material is already known from product mapping.
- The option value contributes a mapped additional weight in `0.01g` units.
- The resolved size delta comes from `channel_option_weight_grid_v1.computed_delta_krw`.
- Runtime formula is market-linked and rounded in `100 KRW` units.
- `SIZE` does not accept fixed-delta or master-fallback compatibility paths; if the market-linked product-scoped grid is missing, resolution must fail closed.

### Example

- Product material: `18K`
- Selected size option maps to `0.08g`
- Preview/apply resolves the `18K + 0.08g` grid cell
- If the cell delta is `3500`, the size additional amount is `3500`

## COLOR_PLATING

- `COLOR_PLATING` is a central additive rule category.
- It resolves from `material_code + color_code`.
- Delta comes from the central combo/rule path, not per-product manual entry.

### Example

- Material: `18K`
- Color/plating: `[도] G`
- Central rule resolves `+1100`

## DECOR

- `DECOR` is a decoration-master-based additive rule category.
- It resolves from `decor_master_item_id` and decoration snapshots.
- Final decoration amount is base labor snapshot plus the extra delta.

### Example

- Decor: `D-100`
- Base labor snapshot: `22000`
- Extra delta: `3000`
- Final decor amount: `25000`

## Composition Example

- `SIZE`: `3500`
- `COLOR_PLATING`: `1100`
- `DECOR`: `25000`
- Total additional amount: `29600`

## BASE Price

- `BASE` here means the product base price, not an option category baseline.
- Base price is published and pushed as the base row, and option categories contribute additional amounts on top of that base.
- Final variant selling price is `base price + variant additional amount`.

## Threshold Intent

- Option additional sync threshold uses `max(1000 KRW, 1 percent)`.
- This is separate from the later product-level `MARKET_LINKED` threshold profile.
