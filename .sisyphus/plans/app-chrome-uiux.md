# App Chrome UI/UX Upgrade

## TL;DR

> **Quick Summary**: Refresh global app chrome for a premium SaaS tone using subtle glass depth, hairline borders, tidy spacing, refined nav states, and consistent mobile menu styling without any logic changes.
> **Deliverables**:
> - Updated global UI tokens and chrome polish in `web/src/app/globals.css`
> - Refined sticky header + main spacing in `web/src/components/layout/app-shell.tsx`
> - Premium nav states + mobile menu consistency in `web/src/components/layout/top-nav.tsx`
> - Optional minimal tweaks to `web/src/components/ui/button.tsx` and `web/src/components/ui/card.tsx` if needed for chrome consistency
> **Estimated Effort**: Short
> **Parallel Execution**: YES – 2 waves
> **Critical Path**: Task 1 → Task 2/3 → Task 4

## Context

### Original Request
Upgrade global App Chrome UI/UX only (no logic changes). Target files: `web/src/app/globals.css`, `web/src/components/layout/app-shell.tsx`, `web/src/components/layout/top-nav.tsx`; optional minimal changes to `web/src/components/ui/button.tsx` and `web/src/components/ui/card.tsx` only if necessary. Constraints: no new libraries, no route/link/label/icon changes, no API/logic/data changes, no DB/SQL, no params changes. Maintain functionality. Goal: premium SaaS tone with subtle depth/glass, hairline borders, micro-interactions; sticky header blur; tidy main spacing; active tab pill/underline; hover lift; consistent mobile menu.

### Interview Summary
**Key Discussions**:
- Manual verification only; no test framework setup.
- UI-only changes; preserve all logic, labels, routes, icons, and functionality.

### Research Findings
**Patterns to apply**:
- Glass depth: `backdrop-blur` + translucent background + subtle border.
- Hairline borders: low-opacity borders to simulate sub-pixel lines.
- Sticky header: `sticky top-0 z-50` + blur + border with supports fallback.
- Active tabs: pill or underline with short transitions.
- Hover lift: subtle translate + shadow lift.
- Mobile menu: consistent visual language with desktop nav.

## Work Objectives

### Core Objective
Deliver a premium SaaS chrome refresh for header, nav, and layout spacing using existing tokens and minimal component style adjustments.

### Concrete Deliverables
- Updated CSS tokens or utility patterns in `web/src/app/globals.css`
- Refined header and main layout spacing in `web/src/components/layout/app-shell.tsx`
- Enhanced nav active/hover states and mobile menu consistency in `web/src/components/layout/top-nav.tsx`
- Optional minimal updates in `web/src/components/ui/button.tsx` and `web/src/components/ui/card.tsx` if needed for chrome alignment

### Definition of Done
- Visual chrome changes are applied only in the specified files.
- No routes, labels, icons, or logic changed.
- Manual verification steps pass and UI feels premium, consistent, and stable across desktop + mobile.

### Must Have
- Sticky header blur with depth and hairline borders.
- Active tab pill or underline with refined states.
- Hover lift micro-interaction.
- Consistent mobile menu styling aligned with desktop nav.

### Must NOT Have (Guardrails)
- No new libraries.
- No logic/API/data/DB changes.
- No route/link/label/icon modifications.
- No parameter changes.

## Verification Strategy (Manual-Only)

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only
- **Framework**: none

### Manual Verification (Agent-Executable)

**Prereq**: `web` dev server running.
Commands:
```bash
cd web
npm run dev
```

**Desktop verification (browser or Playwright skill)**:
1. Open `http://localhost:3000/dashboard`
2. Confirm sticky header has subtle blur + hairline border + glass-like depth
3. Hover over nav items:
   - Inactive items lift subtly and show refined hover background/shadow
4. Active nav item shows pill/underline styling consistent with premium tone
5. Main content spacing feels tidy and balanced (header-to-content and section spacing)

**Mobile verification**:
1. Resize to mobile width (e.g., 375px)
2. Open menu button; verify modal menu styling consistent with desktop nav (depth, borders, active states)
3. Ensure active item styling remains clear
4. Close menu; no layout regressions

**Evidence to Capture** (if automation used):
- Screenshot: header + nav states (desktop)
- Screenshot: mobile menu open + active item
- Screenshot: hover lift on a nav item

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Update tokens/utility patterns for premium chrome
- Task 2: Refine AppShell header + spacing

Wave 2 (After Wave 1):
- Task 3: Refine TopNav nav states + mobile menu consistency
- Task 4: Optional minimal tweaks in Button/Card for chrome consistency

Critical Path: Task 1 → Task 2 → Task 3
Parallel Speedup: ~30–40%

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2, 3 | 2 |
| 2 | 1 | 3 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 3 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | visual-engineering + frontend-patterns |
| 2 | 3, 4 | visual-engineering + frontend-ui-ux |

## TODOs

- [ ] 1. Refresh global UI tokens and chrome styling basis

  **What to do**:
  - Refine CSS variables for subtle glass depth, hairline borders, and shadow hierarchy.
  - Add/adjust tokens for header glass and chrome borders if needed.
  - Keep tokens consistent with existing palette (no new colors outside current variables).

  **Must NOT do**:
  - No color system overhaul or new brand palette.
  - No new CSS frameworks or libraries.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
    - Reason: Requires nuanced UI polish and token tuning.
  - **Skills**: `frontend-ui-ux`, `coding-standards`
    - `frontend-ui-ux`: premium SaaS styling patterns and micro-interactions.
    - `coding-standards`: consistent CSS variable use and safe edits.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: not relevant to UI-only styling.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:
  - `web/src/app/globals.css`: existing tokens for background, borders, and shadows to evolve.
  - `web/src/components/ui/card.tsx`: uses `--shadow-card` and `--panel-border` tokens; keep aligned.

  **Acceptance Criteria**:
  - Tokens remain within existing palette and are used for glass depth and hairline borders.
  - No functional changes in any component.

  **Manual Verification**:
  - Visual confirmation of subtle depth and hairline borders in header and nav states after subsequent tasks.

- [ ] 2. Refine AppShell header glass, borders, and main spacing

  **What to do**:
  - Update header classes to emphasize premium glass depth (blur + translucency) and hairline border.
  - Adjust header padding and main spacing to a tighter, tidier rhythm.
  - Preserve sticky behavior and layout structure.

  **Must NOT do**:
  - No structure or logic changes to layout or components.
  - No route/link changes.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: `frontend-patterns`, `coding-standards`
  - **Skills Evaluated but Omitted**:
    - `security-review`: not needed.

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `web/src/components/layout/app-shell.tsx`: sticky header and main padding.
  - `web/src/app/globals.css`: glass/border/shadow tokens.

  **Acceptance Criteria**:
  - Header is sticky, blurred, and visually premium.
  - Main spacing is tighter and consistent without layout regressions.

  **Manual Verification**:
  - Desktop: sticky header blur + border visible, no jitter on scroll.
  - Main content spacing visually balanced.

- [ ] 3. Update TopNav active/hover states and mobile menu consistency

  **What to do**:
  - Refine active nav to premium pill or underline.
  - Add micro-interaction hover lift and subtle shadow changes.
  - Align mobile menu item styling with desktop nav (depth, borders, active states).
  - Keep labels, icons, and routes unchanged.

  **Must NOT do**:
  - No navItems changes, no labels/icons/routes changes.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: `frontend-ui-ux`, `frontend-patterns`
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: not applicable.

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1/2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `web/src/components/layout/top-nav.tsx`: active/hover classes and mobile modal.
  - `web/src/app/globals.css`: chips, borders, and shadow tokens.

  **Acceptance Criteria**:
  - Active tab styling is clear and premium (pill/underline).
  - Hover lift effect feels subtle and consistent.
  - Mobile menu matches desktop styling language.

  **Manual Verification**:
  - Hover nav items: subtle lift + shadow.
  - Active nav item: pill/underline clearly visible.
  - Mobile menu open: items mirror desktop styling.
  - Close menu and confirm no layout shifts.

- [ ] 4. Optional minimal tweaks to Button/Card for chrome consistency

  **What to do**:
  - If needed, adjust button/card shadows/borders/hover transitions to match updated chrome.
  - Keep changes minimal and additive.

  **Must NOT do**:
  - No new variants or logic changes.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: `coding-standards`, `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `tdd-workflow`: not used for manual verification.

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 3)
  - **Parallel Group**: Wave 2 (sequential within)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `web/src/components/ui/button.tsx`: baseline transitions/shadows.
  - `web/src/components/ui/card.tsx`: base border/shadow and layout.

  **Acceptance Criteria**:
  - Button/card styling aligns with chrome updates without changing behavior.

  **Manual Verification**:
  - Visual check of any affected buttons/cards in existing screens.

## Commit Strategy

- **Commit**: NO (plan only; user didn't request commit)

## Success Criteria

### Verification Commands
```bash
cd web
npm run dev
```

### Final Checklist
- [ ] Header blur + hairline border visible and consistent
- [ ] Active nav pill/underline is clear
- [ ] Hover lift micro-interaction applied
- [ ] Mobile menu styling matches desktop nav
- [ ] No label/icon/route/logic changes
- [ ] Only specified files modified
