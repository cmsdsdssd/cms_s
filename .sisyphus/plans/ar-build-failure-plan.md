# AR ListCard Subtitle Type Error Plan

## TL;DR

> **Quick Summary**: Fix the build failure by widening `ListCard`’s `subtitle` (and `meta`) prop types to accept React nodes, preserving existing JSX usage in `web/src/app/(app)/ar/page.tsx` without changing behavior. Lint warnings are documented only and deferred.
>
> **Deliverables**:
> - Type-safe `ListCard` props that accept JSX subtitles
> - Build passes for AR page
> - Lint warnings guidance documented (no code changes)
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - sequential
> **Critical Path**: Update `ListCard` prop typing → verify lint/build

---

## Context

### Original Request
Produce a plan to resolve build failure in `web/src/app/(app)/ar/page.tsx` (Type 'Element' is not assignable to type 'string' for `ListCard` subtitle). Decide whether to address lint warnings. Keep functionality unchanged; minimal UI-only change; no new deps; no logic/data/handler changes. Include lint/build verification.

### Interview Summary
**Key Discussions**:
- Error is caused by `ListCard` typing `subtitle` as `string` while `web/src/app/(app)/ar/page.tsx` passes JSX (`<span>`).
- Lint warnings should be deferred; provide guidance only.

**Research Findings**:
- `ListCard` props are defined in `web/src/components/ui/list-card.tsx` with `subtitle?: string; meta?: string`.
- `subtitle` usage in `web/src/app/(app)/ar/page.tsx` at ~line 509 passes JSX.
- Other usages pass strings (e.g., `web/src/components/party/PartyList.tsx`).
- `web/package.json` includes `lint` and `build` scripts (`eslint`, `next build`).

### Metis Review
**Identified Gaps (addressed)**:
- Metis agent not available in this environment; compensated with explicit guardrails and acceptance criteria.

---

## Work Objectives

### Core Objective
Resolve the type error by making `ListCard` accept React-renderable subtitles without altering runtime behavior or data/handler logic.

### Concrete Deliverables
- Update `ListCard` prop types to accept JSX for `subtitle` (and `meta` for consistency).
- Ensure `web/src/app/(app)/ar/page.tsx` builds without type errors.
- Provide lint-warning guidance (no edits).

### Definition of Done
- `next build` succeeds in `web/` without the `Type 'Element' is not assignable to type 'string'` error.
- `next lint` runs; lint warnings are noted but not fixed per scope.

### Must Have
- No behavioral change in AR page rendering; only typing change to accept existing JSX.

### Must NOT Have (Guardrails)
- No changes to data fetching, event handlers, or business logic.
- No new dependencies or lint rule changes.
- No fixes for lint warnings in this plan (guidance only).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Next.js lint/build scripts)
- **User wants tests**: Manual verification only (lint/build commands)
- **Framework**: `next build`, `eslint`

### Manual Verification (Agent-Executable)
- Run `npm run lint` in `web/` and record warnings (no remediation).
- Run `npm run build` in `web/` and confirm no type error for `ListCard` subtitle.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Update ListCard prop typing

Wave 2 (After Wave 1):
└── Task 2: Verify lint/build

Critical Path: Task 1 → Task 2
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2 | None |
| 2 | 1 | None | None |

---

## TODOs

- [ ] 1. Widen `ListCard` prop types to accept React nodes

  **What to do**:
  - Update `subtitle` type from `string` to `React.ReactNode` in `web/src/components/ui/list-card.tsx`.
  - Update `meta` type from `string` to `React.ReactNode` for consistency (existing render path already accepts renderable content).
  - Keep component rendering unchanged; still render inside `<p>` nodes.

  **Must NOT do**:
  - Do not change `web/src/app/(app)/ar/page.tsx` logic or markup.
  - Do not modify `ListCard` layout or HTML structure.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, localized type change.
  - **Skills**: `coding-standards`
    - `coding-standards`: Ensures safe typing changes with minimal risk.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI redesign required.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `web/src/components/ui/list-card.tsx` - Current prop types and render structure for `subtitle` and `meta`.
  - `web/src/app/(app)/ar/page.tsx:507` - Offending JSX usage of `subtitle` causing type error.
  - `web/src/components/party/PartyList.tsx:93` - Example usage with string subtitle (ensure compatibility remains).

  **Acceptance Criteria**:
  - Type definitions for `subtitle` and `meta` accept `React.ReactNode`.
  - No runtime behavior changes to `ListCard` render output.

- [ ] 2. Verify lint/build (record lint warnings only)

  **What to do**:
  - Run lint and build commands from `web/package.json`.
  - Confirm the previous type error is resolved.
  - Document any lint warnings (no fixes in this scope).

  **Must NOT do**:
  - Do not suppress or fix lint warnings in code.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward verification commands.
  - **Skills**: `verification-loop`
    - `verification-loop`: Emphasizes command-based validation.
  - **Skills Evaluated but Omitted**:
    - `playwright`: No UI verification required.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `web/package.json` - `lint` and `build` script definitions.

  **Acceptance Criteria**:
  - `npm run build` in `web/` completes without the `Type 'Element' is not assignable to type 'string'` error.
  - `npm run lint` in `web/` completes and warnings are noted (no changes).

---

## Lint Warnings Guidance (Deferred)

- `no-img-element`: Prefer `next/image` for optimization; only address if you choose to fix later.
- `no-unused-vars`: Remove unused variables or prefix with `_` if intentionally unused; consider ESLint config if needed later.

---

## Success Criteria

### Verification Commands
```bash
npm run lint
npm run build
```

### Final Checklist
- [ ] Build error on `ListCard` subtitle resolved.
- [ ] No functional or behavioral changes introduced.
- [ ] Lint warnings documented but not fixed.
