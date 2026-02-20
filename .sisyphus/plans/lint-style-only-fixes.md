# Lint Style-Only Fixes (web/)

## TL;DR

> **Quick Summary**: Fix only style-related ESLint issues in `web/` by addressing `react/no-unescaped-entities` and `prefer-const`, with zero functional impact. Capture lint output, apply constrained fixes, and re-run `npm run lint` for verification.
>
> **Deliverables**:
> - Style-only lint fixes limited to `react/no-unescaped-entities` and `prefer-const` in `web/`.
> - Updated lint output showing these issues resolved while all out-of-scope warnings/errors remain.
>
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential
> **Critical Path**: Capture lint output → Apply style-only fixes → Re-run lint

---

## Context

### Original Request
Analyze `npm run lint` errors and auto-fix style-related errors only, without functional changes. Provide a plan with steps, classification, safe fix strategy, task graph, and verification plan.

### Interview Summary
**Key Discussions**:
- Scope limited to `web/` only; do not touch root `scripts/*`.
- Allowed fixes: `react/no-unescaped-entities`, `prefer-const` only.
- Explicitly skip: `next/no-img-element`, `no-require-imports`, `no-unused-vars` (warnings), and all logic-related hook/any/purity rules.
- Verification is lint-only after fixes.

**Research Findings**:
- Lint command defined in `web/package.json` as `eslint`.
- ESLint config in `web/eslint.config.mjs` extends Next.js core-web-vitals and typescript presets.

### Metis Review
**Identified Gaps (addressed)**:
- Guardrails clarified to avoid route handlers/scripts and avoid non-allowed rule fixes.
- Acceptance criteria tightened to ensure only targeted rules change and lint re-run validates outcomes.

---

## Work Objectives

### Core Objective
Resolve only the style-related ESLint errors (`react/no-unescaped-entities`, `prefer-const`) within `web/`, without any functional changes, and verify via `npm run lint`.

### Concrete Deliverables
- Code changes in `web/src/**` limited to resolving `react/no-unescaped-entities` and `prefer-const`.
- Lint output showing those specific rule violations eliminated.

### Definition of Done
- [ ] `npm run lint` executed in `web/` completes with no `react/no-unescaped-entities` or `prefer-const` findings.
- [ ] No edits made in root `scripts/*` or any file outside `web/`.
- [ ] No changes to lint config files (`web/eslint.config.mjs`, `web/package.json`).

### Must Have
- Fix only the allowed rules.
- Zero functional changes (no logic or behavior changes).

### Must NOT Have (Guardrails)
- Do not fix or alter any of these rules: `next/no-img-element`, `no-require-imports`, `no-unused-vars`, `no-explicit-any`, hooks/purity/incompatible-library, or any other non-allowed rule.
- Do not touch `scripts/*` or any root-level files.
- Do not modify ESLint configuration.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (ESLint)
- **User wants tests**: Manual verification via lint-only
- **Framework**: ESLint via `npm run lint`

### Automated Verification Only

Run lint from the `web/` directory:

```bash
npm run lint
```

**Expected**:
- `react/no-unescaped-entities` and `prefer-const` findings are absent.
- Warnings/errors for skipped rules may still appear (expected).

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
├── Task 1: Capture lint output and classify violations
└── Task 2: Apply style-only fixes

Wave 2 (After Wave 1):
└── Task 3: Verification (lint-only)

Critical Path: Task 1 → Task 2 → Task 3

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 3 | None |
| 3 | 2 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | delegate_task(category="quick", load_skills=["coding-standards"], run_in_background=true) |
| 2 | 2 | delegate_task(category="quick", load_skills=["coding-standards"], run_in_background=true) |
| 3 | 3 | delegate_task(category="quick", load_skills=[], run_in_background=false) |

---

## TODOs

- [ ] 1. Capture lint output and classify violations

  **What to do**:
  - Run `npm run lint` in `web/` and capture full output.
  - Classify findings into: allowed (`react/no-unescaped-entities`, `prefer-const`) vs skipped (all others).
  - Map allowed findings to specific files/locations for targeted fixes.

  **Must NOT do**:
  - Do not attempt any fixes yet.
  - Do not edit files outside `web/`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple command execution and classification.
  - **Skills**: `coding-standards`
    - `coding-standards`: Ensures lint output is interpreted consistently.
  - **Skills Evaluated but Omitted**:
    - `tdd-workflow`: Not applicable for lint-only verification.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (Sequential)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:
  - `web/package.json` - Defines `npm run lint` script to execute.
  - `web/eslint.config.mjs` - Confirms ESLint config sources and default ignores.
  - Lint summary provided by user - Source list of known rule violations to cross-check.

  **Acceptance Criteria**:
  - [ ] `npm run lint` output captured and archived in notes.
  - [ ] Findings tagged as allowed vs skipped based on rule list.

- [ ] 2. Apply style-only fixes for allowed rules

  **What to do**:
  - For `react/no-unescaped-entities`, replace unescaped characters with JSX-safe entities (e.g., `&apos;`, `&quot;`, `&amp;`) in content-only text.
  - For `prefer-const`, convert `let` to `const` only where the variable is never reassigned.
  - Restrict edits to `web/src/**` and only to the files identified in Task 1.

  **Must NOT do**:
  - Do not change logic, control flow, or data handling.
  - Do not fix or silence other lint rules.
  - Do not touch `web/src/app/api/**` unless the rule violation is in scope and change is trivially non-functional.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, targeted edits with high attention to guardrails.
  - **Skills**: `coding-standards`
    - `coding-standards`: Enforces style-only changes without logic edits.
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: Unneeded for lint-only fixes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (Sequential)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - Lint output from Task 1 - Primary source for exact file paths and lines.
  - `web/eslint.config.mjs` - Confirms rule sources and expected behavior.
  - Files from lint summary:
    - `web/src/app/(app)/market/page.tsx` - `prefer-const` error.
    - `web/src/components/party/PartyList.tsx` - `react/no-unescaped-entities` errors.

  **Acceptance Criteria**:
  - [ ] All `react/no-unescaped-entities` findings resolved in targeted files.
  - [ ] All `prefer-const` findings resolved in targeted files.
  - [ ] No other rule changes introduced.

- [ ] 3. Verify lint-only

  **What to do**:
  - Run `npm run lint` in `web/`.
  - Confirm only skipped rules remain in output, if any.

  **Must NOT do**:
  - Do not run build or tests beyond lint (unless explicitly requested).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single verification command.
  - **Skills**: (none required)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (Sequential)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `web/package.json` - Confirms lint command.

  **Acceptance Criteria**:
  - [ ] `npm run lint` completes with no `react/no-unescaped-entities` or `prefer-const` messages.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 3 | `chore(lint): fix style-only lint rules` | `web/src/**` | `npm run lint` |

---

## Success Criteria

### Verification Commands

```bash
cd web
npm run lint
```

### Final Checklist
- [ ] Only `react/no-unescaped-entities` and `prefer-const` are fixed.
- [ ] No changes outside `web/`.
- [ ] Lint-only verification complete.
