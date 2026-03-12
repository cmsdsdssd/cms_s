# Mall Preview Rule Alignment

## Problem

- Admin auto-price resolves `SIZE`, `COLOR_PLATING`, and `DECOR` from rule-backed sources.
- Public mall preview was still reading published 2-axis option-entry rows only.
- The old public script handled only the first two `<select>` controls.

## Root Cause

### Admin Path

- Source of truth comes from the variant-editing pipeline.
- Key outputs are:
  - `option_detail_allowlist`
  - `canonical_option_rows`
  - resolved variant option selections

### Public Path Before Fix

- Source of truth was `product_price_publish_option_entry_v1`.
- Shape assumed only:
  - first axis
  - second axis
- Browser script decorated only:
  - `select[0]`
  - `select[1]`

## Required Alignment

- Public preview must reuse the same rule-backed resolution path as admin.
- Preview axes must be built from `canonical_option_rows`.
- Variant totals must be computed by summing resolved deltas for the selected option values.
- Frontend preview must support dynamic axis count instead of a fixed two-axis model.

## Implemented Approach

- Base price remains a separate published/pushed layer; preview shows option deltas on top of that base instead of treating BASE as an option category.
- Public preview route now reuses the admin variants route for the same product scope.
- It reads:
  - `canonical_option_rows`
  - `option_detail_allowlist`
  - resolved variant option rows
- Public axis payload is built from canonical rows.
- Public variant totals are built by summing canonical row deltas across all selected option axes.
- Storefront script now:
  - reads dynamic `axis.axes`
  - decorates any number of existing option selects
  - injects preview-only fallback selects when the mall DOM provides fewer controls than the resolved axis count

## Expected Result

- `SIZE` preview dropdown reflects market-linked weight choices and deltas
- `COLOR_PLATING` preview dropdown reflects central combo choices and deltas
- `DECOR` preview dropdown reflects decoration choices and deltas
- Third-axis decor is no longer dropped by the old 2-axis public preview path
