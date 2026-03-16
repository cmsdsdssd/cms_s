# Shopping Gallery Preview Drawer SOT Design

Goal: Rebuild the old shopping auto-price operator UX as a new Rule-only SOT surface without using any legacy pricing views, current-state tables, category/value-policy authoring, or old sales_channel_product option pricing fields.

Date: 2026-03-14
Status: Implementation design for replacing the deprecated auto-price UX.

---

## 1. Product Goal

The old operator experience had three strong properties:
- photo-first gallery cards
- click a card to open a shopping-preview-like detail view
- click detail edit to edit option mappings in a left drawer

That UX is gone. It was not moved elsewhere. The current `settings/shopping/mappings` page keeps only the table editor and the old `auto-price` page is a deprecation stub.

The new goal is to restore that UX on top of the new Rule-only SOT.

This means:
- keep the existing shopping settings shell layout
- keep the left settings navigator exactly as it works today
- use the right content area for the new gallery + preview + left drawer editing flow
- never read legacy pricing truth
- never write legacy pricing truth

---

## 2. Layout Contract

### 2.1 Outer Layout

Do not invent a new shell.

Use the current settings layout exactly as-is:
- left: existing shopping/settings navigation
- right: page content for the selected shopping section

The replacement UX should live inside:
- `settings/shopping/mappings`

So the user still enters from the same shopping settings tree, but the content area becomes visual instead of table-first.

### 2.2 Right Content Structure

The right content area should have 3 layers:

1. top toolbar
   - channel selector
   - master/product filters
   - search
   - initial recompute button
   - refresh button

2. main split content
   - left/center: product gallery grid
   - right: selected product preview panel

3. overlay editing surface
   - left-side drawer for explicit option-entry editing

### 2.3 Gallery Grid

Each card should show:
- product image
- model name
- master item id
- external product no
- published base price
- published min-max price range if variants exist
- status badge
  - ok
  - unresolved
  - unpublished
- small mapping status summary

### 2.4 Preview Panel

When a card is clicked, the preview panel shows:
- product image and basic identity
- master material
- published base price
- option rows with published deltas
- variant rows with final prices
- current explicit mapping summary
- unresolved warnings if any
- CTA: `상세수정`
- CTA: `최초 계산`
- CTA: `새로고침`

### 2.5 Left Drawer

The drawer opens from the left edge of the content area, not as a full-page route.

It contains:
- product identity header
- option entry list
- category badge per row
- allowlist-driven controls only
- save button
- recompute button
- close button

No free text except where the final SOT explicitly allows it:
- `OTHER.reason_code`
- `OTHER.explicit_delta_krw`

---

## 3. Data Source Contract

### 3.1 Allowed Truth Sources

The new UX may read only from these sources:

Authored truth:
- `sales_channel_product` for identity/linkage only
- `channel_product_option_entry_mapping_v1`
- `channel_option_material_registry_v1`
- `channel_option_color_bucket_v1`
- `channel_option_addon_master_v1`
- `channel_option_notice_code_v1`
- `channel_option_other_reason_code_v1`
- `channel_color_combo_catalog_v1`
- shared size grid source
- current unified rule core or temporary `channel_option_labor_rule_v1` until replaced
- `cms_master_item`
- factor/tick sources

Derived truth:
- `product_price_publish_base_v1`
- `product_price_publish_option_entry_v1`
- `product_price_publish_variant_v1`
- `product_price_live_state_v1`

### 3.2 Forbidden Truth Sources

The new UX must not use:
- `v_price_composition_flat_v2`
- `channel_option_current_state_v1`
- `channel_option_category_v2`
- `channel_option_value_policy`
- `channel_option_value_policy_log`
- `sales_channel_product.option_material_code`
- `sales_channel_product.option_color_code`
- `sales_channel_product.option_decoration_code`
- `sales_channel_product.option_size_value`
- old sync-rule tables
- old labor-rule preview/debug routes as runtime truth

---

## 4. Route / API Design

### 4.1 Keep Existing Route

Do not create a new settings route.

Use:
- `GET /settings/shopping/mappings`

Replace its content implementation.

### 4.2 New Gallery API

Create:
- `GET /api/channel-products/gallery`

Input:
- `channel_id`
- optional search/filter params

Output per card:
- `channel_product_id`
- `master_item_id`
- `model_name`
- `external_product_no`
- `thumbnail_url`
- `published_base_price_krw`
- `published_min_price_krw`
- `published_max_price_krw`
- `variant_count`
- `mapping_count`
- `has_unresolved`
- `publish_status`
- `updated_at`

Sources:
- `sales_channel_product`
- `cms_master_item`
- publish tables
- explicit mapping table

### 4.3 New Detail API

Create:
- `GET /api/channel-products/gallery-detail`

Input:
- `channel_id`
- `master_item_id`
- `external_product_no`

Output:
- identity block
- image block
- master material
- explicit mapping rows
- allowed values
- published base price
- published option deltas
- published variants
- unresolved warnings

Sources:
- explicit mapping tables
- central registries
- shared size grid
- publish tables
- `cms_master_item`

### 4.4 Existing Save APIs To Keep Using

Keep using:
- `POST /api/channel-products`
- `POST /api/channel-products/bulk`
  - identity only
- `POST /api/channel-option-entry-mappings`
  - explicit option-entry mappings
- `GET/POST /api/channel-option-central-registries`
  - allowlists and auto-generated bucket source
- `POST /api/pricing/recompute`

### 4.5 Existing APIs To Avoid

Do not call from the new UX:
- deprecated `auto-price` APIs
- deprecated rule/debug/dashboard APIs
- any 410 tombstoned route

---

## 5. Component Design

### 5.1 Page Container

File:
- `web/src/app/(app)/settings/shopping/mappings/page.tsx`

New responsibility:
- orchestrates gallery list query
- manages selected product state
- manages preview panel state
- manages left drawer open/close state
- triggers refresh/recompute/save

### 5.2 New Components

Create:
- `web/src/components/shopping/mapping-gallery.tsx`
- `web/src/components/shopping/mapping-gallery-card.tsx`
- `web/src/components/shopping/mapping-preview-panel.tsx`
- `web/src/components/shopping/mapping-edit-drawer.tsx`

Optional supporting components:
- `web/src/components/shopping/mapping-status-badge.tsx`
- `web/src/components/shopping/published-price-summary.tsx`
- `web/src/components/shopping/option-entry-editor-row.tsx`

### 5.3 Interaction Model

Gallery:
- click card -> loads detail panel on the right

Preview panel:
- click `상세수정` -> opens left drawer
- click `최초 계산` -> POST recompute
- click `새로고침` -> refetch detail

Drawer:
- edit rows with allowlist controls
- click save -> save explicit mapping rows
- after save -> refetch detail + optionally trigger recompute

---

## 6. Drawer Editing Contract

### 6.1 Material
- select from material registry
- display only
- delta always 0

### 6.2 Size
- select from shared channel-wide size grid for the resolved master material
- display weight and published/available delta

### 6.3 Color Plating
- select combo code
- select color bucket
- display resulting bucket delta

### 6.4 Decor
- select decor master

### 6.5 Addon
- select addon master

### 6.6 Other
- select reason code
- enter explicit delta

### 6.7 Notice
- select notice code

### 6.8 Save Behavior
- save identity if needed
- save explicit mapping rows
- refresh detail
- recompute only when user explicitly triggers or when workflow requires it

---

## 7. Published Price Display Rules

### 7.1 Base Price
Always display from:
- `product_price_publish_base_v1`

### 7.2 Option Delta
Always display from:
- `product_price_publish_option_entry_v1`

### 7.3 Variant Final Price
Always display from:
- `product_price_publish_variant_v1`

### 7.4 Unresolved State
If unresolved:
- show warning badge
- show unresolved reason list
- block publish-oriented actions
- do not synthesize fake fallback prices
