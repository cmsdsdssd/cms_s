# Option Price Display Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show option labels with display-only price suffixes like `1호 (+1,000원)` without mutating canonical sync keys or coupling label decoration to Cafe24 price push.

**Architecture:** Keep all internal mapping keys and persisted option values canonical and suffix-free. Add shared suffix normalization/formatting helpers, expose decorated display labels from the storefront breakdown API only, and align every suffix-stripping path to the same rule so rebuild/mapping logic stays stable.

**Tech Stack:** Next.js app routes, TypeScript, shared JS helpers in `src/lib/shop`, repo tests, Cafe24 storefront breakdown API.

---

### Task 1: Audit the storefront breakdown output shape

**Files:**
- Modify: `src/app/api/public/storefront-option-breakdown/route.ts`
- Modify: `src/lib/shop/single-sot-pricing.js`
- Test: `tests/single-sot-pricing.test.ts`

**Step 1: Read the current breakdown payload contract**

Inspect the axis/value shape returned from `buildOptionAxisFromCanonicalRows(...)` and `buildOptionAxisFromPublishedEntries(...)`.

**Step 2: Identify the smallest payload addition**

Use a new field such as `display_label` on each axis value instead of replacing the existing `label` field.

**Step 3: Keep canonical labels unchanged**

Do not alter `label`, `option_value`, `entry_key`, or any stored DB field.

**Step 4: Verify compatibility**

Confirm the public route can keep returning the old fields while adding the new field.

### Task 2: Add shared option label helpers

**Files:**
- Create: `src/lib/shop/option-labels.js`
- Modify: `src/lib/shop/single-sot-pricing.js`
- Modify: `src/lib/shop/mapping-option-details.ts`
- Modify: `src/app/api/channel-option-categories/rebuild/route.ts`
- Modify: `src/lib/shop/cafe24.ts`
- Test: `tests/option-labels.test.ts`

**Step 1: Write the failing tests**

Cover these cases:

```js
stripPriceDeltaSuffix('1호 (+1,000원)') === '1호'
stripPriceDeltaSuffix('1호 (-1,000원)') === '1호'
stripPriceDeltaSuffix('1호') === '1호'
formatOptionDisplayLabel('1호', 1000) === '1호 (+1,000원)'
formatOptionDisplayLabel('1호', -1000) === '1호 (-1,000원)'
formatOptionDisplayLabel('1호', 0) === '1호'
```

**Step 2: Implement the shared helpers**

Export one suffix stripper and one display formatter from `src/lib/shop/option-labels.js`.

**Step 3: Replace local regex drift**

Update all current stripping call sites to use the shared helper.

**Step 4: Run helper tests**

Run only the new helper test file first.

### Task 3: Expose display-only decorated labels in the public breakdown API

**Files:**
- Modify: `src/lib/shop/single-sot-pricing.js`
- Modify: `src/app/api/public/storefront-option-breakdown/route.ts`
- Test: `tests/single-sot-pricing.test.ts`

**Step 1: Write the failing tests**

Add expectations that axis value objects include:

```js
{
  label: '1호',
  delta_krw: 1000,
  delta_display: '+1,000',
  display_label: '1호 (+1,000원)'
}
```

And for zero deltas:

```js
{
  label: '기본',
  delta_krw: 0,
  display_label: '기본'
}
```

**Step 2: Implement the minimal change**

Populate `display_label` inside the normalized axis/value builders.

**Step 3: Keep route behavior read-only**

Do not add any Cafe24 writes or DB writes in `storefront-option-breakdown`.

**Step 4: Re-run targeted tests**

Verify axis-building and breakdown tests pass.

### Task 4: Verify the safeguard on rebuild and mapping paths

**Files:**
- Modify: `src/app/api/channel-option-categories/rebuild/route.ts`
- Modify: `src/lib/shop/mapping-option-details.ts`
- Test: `tests/option-labels.test.ts`

**Step 1: Add a regression for rebuild normalization**

Show that a Cafe24-facing decorated value like `백금 (+11,000원)` normalizes to `백금` in every shared helper consumer.

**Step 2: Use the shared stripper in rebuild**

Remove the route-local regex.

**Step 3: Re-check mapping key behavior**

Ensure `mappingOptionEntryKey('사이즈', '1호 (+1,000원)')` still equals `mappingOptionEntryKey('사이즈', '1호')`.

### Task 5: Full verification

**Files:**
- Test: `tests/option-labels.test.ts`
- Test: `tests/single-sot-pricing.test.ts`
- Test: any related mapping tests already covering option value normalization

**Step 1: Run targeted tests**

Run the new helper tests and the single-SOT pricing tests.

**Step 2: Run diagnostics**

Check modified TypeScript files with LSP diagnostics.

**Step 3: Run the build**

Run `npm run build` and confirm exit code 0.

**Step 4: Do not commit automatically**

Leave the working tree ready for review since git commit was not requested.
