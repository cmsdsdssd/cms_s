# Lint Fixes + Build Verification Plan

## TL;DR

> **Quick Summary**: Address the provided lint errors with minimal, behavior-preserving edits (type refinements, unused removals, require→import, img→next/image), then verify via lint and build.
> 
> **Deliverables**:
> - Lint-cleaned files listed in the provided output
> - Successful `npm run lint` and `npm run build` in `web/`
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 2 → Task 5 → Task 6

---

## Context

### Original Request
Analyze existing lint errors, fix them automatically without changing functionality, then rerun `npm run build`. Scope includes scripts/*.js and listed app/api/hook files. No new libraries. Minimal safe edits only.

### Interview Summary
**Key Discussions**:
- Use the provided lint output as authoritative scope.
- Fixes limited to unused removal, `any` refinement, `require`→`import`, and `img`→`next/image`.
- Preserve behavior; no logic changes or new dependencies.
- Verification: run `npm run lint` and `npm run build` under `web/`.
- Preference confirmed: replace `img` with `next/image` for lint warnings.

**Research Findings**:
- `any` → specific types/`unknown`/generics; `require` → ESM `import`; unused vars removed or `_`-prefixed if function signature required.

### Metis Review
**Identified Gaps (addressed)**:
- Metis tool unavailable due to environment restriction; applied conservative guardrails and defaults.

---

## Work Objectives

### Core Objective
Resolve only the specified lint errors with safe, behavior-preserving edits and confirm build passes.

### Concrete Deliverables
- Updated lint-affected files as listed in the provided lint output.
- Lint and build commands succeed from `web/`.

### Definition of Done
- [ ] `npm run lint` in `web/` completes with zero errors.
- [ ] `npm run build` in `web/` completes successfully.

### Must Have
- Only minimal edits needed to satisfy lint rules.

### Must NOT Have (Guardrails)
- No functional/behavior changes (no data flow or logic change).
- No new dependencies or config overrides.
- No refactors beyond lint fixes.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no test scripts/config detected in `web/package.json`).
- **User wants tests**: Manual-only verification.
- **Framework**: none.

### Automated Verification (Agent-Executable)

```bash
# Run from web/
npm run lint

npm run build
```

Expected: both commands exit 0 with no lint errors and successful build output.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: scripts require→import + unused fs
- Task 2: unused imports/vars cleanup (pages/hooks)

Wave 2 (After Wave 1):
- Task 3: `any` refinements in app pages
- Task 4: `any` refinements in API routes + lib
- Task 5: replace `img` with `next/image`
- Task 6: final verification (lint + build)

Critical Path: Task 2 → Task 5 → Task 6

---

## TODOs

- [ ] 1. Convert `require()` to ES `import` in scripts and remove unused `fs`

  **What to do**:
  - Replace `require()` calls with equivalent `import` statements in:
    - `scripts/check_bucket.js` (lines 2-4)
    - `scripts/debug_storage.js` (lines 2-5)
    - `scripts/find_image.js` (lines 2-4)
  - Remove unused `fs` import in `scripts/debug_storage.js`.
  - Keep runtime behavior intact; ensure import names match previous usage.

  **Must NOT do**:
  - Do not change script logic or I/O behavior.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, mechanical edits.
  - **Skills**: `coding-standards`
    - `coding-standards`: Ensure minimal, style-consistent edits.
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: Not relevant to scripts.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `scripts/check_bucket.js:2-4` - `require()` imports to convert.
  - `scripts/debug_storage.js:2-5` - `require()` imports and unused `fs`.
  - `scripts/find_image.js:2-4` - `require()` imports to convert.

  **Acceptance Criteria**:
  - [ ] No `@typescript-eslint/no-require-imports` errors for these scripts.
  - [ ] No unused import errors in `scripts/debug_storage.js`.

- [ ] 2. Remove unused imports/vars in app pages/hooks

  **What to do**:
  - Remove unused imports/variables reported by lint:
    - `src/app/(app)/ar/page.tsx`: `partyOptions`
    - `src/app/(app)/catalog/page.tsx`: `Badge`
    - `src/app/(app)/inventory/page.tsx`: `Textarea`, `MoveRow`, `getKstNow`
    - `src/app/(app)/orders/page.tsx`: `Select`, `Textarea`, `platingColors`
    - `src/app/(app)/orders_main/page.tsx`: `CONTRACTS`
    - `src/app/(app)/shipments_main/page.tsx`: `totalsByShipment`
    - `src/app/(app)/shipping/page.tsx`: `Select`, `handleSearchFocus`
    - `src/hooks/use-rpc-mutation.ts`: remove unused eslint-disable directive

  **Must NOT do**:
  - Do not remove anything used at runtime (double-check references).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical cleanup.
  - **Skills**: `coding-standards`
    - `coding-standards`: Preserve minimal diff and conventions.
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: Not necessary.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5, Task 6
  - **Blocked By**: None

  **References**:
  - `src/app/(app)/ar/page.tsx` - unused `partyOptions`.
  - `src/app/(app)/catalog/page.tsx` - unused `Badge`.
  - `src/app/(app)/inventory/page.tsx` - unused `Textarea`, `MoveRow`, `getKstNow`.
  - `src/app/(app)/orders/page.tsx` - unused `Select`, `Textarea`, `platingColors`.
  - `src/app/(app)/orders_main/page.tsx` - unused `CONTRACTS`.
  - `src/app/(app)/shipments_main/page.tsx` - unused `totalsByShipment`.
  - `src/app/(app)/shipping/page.tsx` - unused `Select`, `handleSearchFocus`.
  - `src/hooks/use-rpc-mutation.ts` - unused eslint-disable directive near line 19.

  **Acceptance Criteria**:
  - [ ] No unused-var lint errors in the listed files.

- [ ] 3. Replace `any` types in app pages with specific/`unknown` types

  **What to do**:
  - Replace `any` occurrences with the narrowest safe types:
    - `src/app/(app)/bom/page.tsx`: lines 75, 248, 270, 280, 380
    - `src/app/(app)/inventory/page.tsx`: lines 276, 451, 723
    - `src/app/(app)/market/page.tsx`: line 44
    - `src/app/(app)/orders/page.tsx`: lines 288, 297, 344, 652, 659
    - `src/app/(app)/parts/page.tsx`: lines 484, 489, 495
    - `src/app/(app)/purchase_cost_worklist/page.tsx`: line 464
    - `src/app/(app)/shipments/page.tsx`: lines 283, 288, 413, 461, 475, 707, 970
  - Prefer existing local types/interfaces; otherwise use `unknown` + type guards or narrow `Record<string, unknown>`.

  **Must NOT do**:
  - Do not alter runtime control flow or data transformations.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Type inference requires careful context reading.
  - **Skills**: `coding-standards`
    - `coding-standards`: Safe typing choices and minimal diffs.
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: Not necessary for type-only changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:
  - `src/app/(app)/bom/page.tsx:75,248,270,280,380` - `any` occurrences to refine.
  - `src/app/(app)/inventory/page.tsx:276,451,723` - `any` occurrences to refine.
  - `src/app/(app)/market/page.tsx:44` - `any` occurrence to refine.
  - `src/app/(app)/orders/page.tsx:288,297,344,652,659` - `any` occurrences to refine.
  - `src/app/(app)/parts/page.tsx:484,489,495` - `any` occurrences to refine.
  - `src/app/(app)/purchase_cost_worklist/page.tsx:464` - `any` occurrence to refine.
  - `src/app/(app)/shipments/page.tsx:283,288,413,461,475,707,970` - `any` occurrences to refine.

  **Acceptance Criteria**:
  - [ ] No `no-explicit-any` lint errors in listed app pages.

- [ ] 4. Replace `any` types in API routes and lib/hook

  **What to do**:
  - Replace `any` in API routes with narrow DTO/shape types or `unknown` + validation:
    - `src/app/api/market-ticks/route.ts`: lines 14, 34, 35, 113, 135, 136, 139, 140, 142
    - `src/app/api/order-upsert/route.ts`: lines 28-30
    - `src/app/api/receipt-file/route.ts`: line 39
    - `src/app/api/receipt-preview/route.ts`: lines 82, 86, 96
    - `src/app/api/receipt-upload/route.ts`: line 102
    - `src/app/api/receipts/route.ts`: line 54
  - Replace `any` in `src/hooks/use-rpc-mutation.ts:19` and `src/lib/supabase/read.ts:31`.

  **Must NOT do**:
  - Do not change request/response payload logic.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: API typing requires careful shape inference.
  - **Skills**: `coding-standards`
    - `coding-standards`: Ensure safe typing without behavior change.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: Not necessary for type-only fixes.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:
  - `src/app/api/market-ticks/route.ts:14,34,35,113,135,136,139,140,142` - `any` occurrences.
  - `src/app/api/order-upsert/route.ts:28-30` - `any` occurrences.
  - `src/app/api/receipt-file/route.ts:39` - `any` occurrence.
  - `src/app/api/receipt-preview/route.ts:82,86,96` - `any` occurrences.
  - `src/app/api/receipt-upload/route.ts:102` - `any` occurrence.
  - `src/app/api/receipts/route.ts:54` - `any` occurrence.
  - `src/hooks/use-rpc-mutation.ts:19` - `any` occurrence + unused eslint-disable cleanup in Task 2.
  - `src/lib/supabase/read.ts:31` - `any` occurrence.

  **Acceptance Criteria**:
  - [ ] No `no-explicit-any` lint errors in listed API/lib/hook files.

- [ ] 5. Replace `img` with `next/image` where lint warns

  **What to do**:
  - Replace `img` elements flagged by lint in:
    - `src/app/(app)/inventory/page.tsx`
    - `src/app/(app)/orders/page.tsx`
    - `src/app/(app)/shipments/page.tsx`
  - Import `Image` from `next/image` and preserve `src`, `alt`, sizing, and className.
  - Use explicit `width`/`height` or `fill` with container sizing to avoid layout changes.

  **Must NOT do**:
  - Do not change displayed image dimensions or layout behavior.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI sizing/layout sensitivity.
  - **Skills**: `frontend-patterns`
    - `frontend-patterns`: Safe `next/image` usage with minimal UI change.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed for a non-design change.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:
  - `src/app/(app)/inventory/page.tsx` - lint warning for `img` usage.
  - `src/app/(app)/orders/page.tsx` - lint warning for `img` usage.
  - `src/app/(app)/shipments/page.tsx` - lint warning for `img` usage.

  **Acceptance Criteria**:
  - [ ] No `next/no-img-element` lint errors in these files.

- [ ] 6. Verify lint and build

  **What to do**:
  - Run lint and build from `web/`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Command execution and verification only.
  - **Skills**: `verification-loop`
    - `verification-loop`: Ensure outputs are captured and validated.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Tasks 1-5

  **Acceptance Criteria**:
  - [ ] `npm run lint` succeeds in `web/`.
  - [ ] `npm run build` succeeds in `web/`.

---

## Commit Strategy

| After Task | Message | Files | Verification |
| --- | --- | --- | --- |
| 6 | `chore(lint): fix lint errors without behavior change` | all touched files | `npm run lint && npm run build` |

---

## Success Criteria

### Verification Commands
```bash
cd web
npm run lint
npm run build
```

### Final Checklist
- [ ] All specified lint errors resolved.
- [ ] No new lint errors introduced.
- [ ] Build completes successfully.
