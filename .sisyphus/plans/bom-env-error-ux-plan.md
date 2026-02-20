# BOM env error handling + UX adjustments plan

## TL;DR

> **Quick Summary**: Update BOM API env error payloads and align BOM UI to show explicit env/config guardrails, MASTER-first UX, VOID confirm modal, and layout tweaks without adding deps or changing RPC/DB behavior.
>
> **Deliverables**:
> - Updated API error payloads for missing Supabase env
> - BOM UI env error card + canWrite guardrails + MASTER-first UX + VOID confirm modal
> - ActionBar CTA + layout adjustments + placeholder card
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3/4/5

---

## Context

### Original Request
Produce a parallel task graph and detailed TODOs to implement BOM UI/API env error handling and UX adjustments per user spec, with verification steps and test plan. Constraints: no RPC/DB changes, no deps, preserve RPC behavior, MASTER-first UX, canWrite guardrails, confirm modal for void, layout adjustments. Targets: `web/src/app/(app)/bom/page.tsx`, `web/src/app/api/master-items/route.ts`, `web/src/app/api/part-items/route.ts`.

### Interview Summary
**Key Decisions (user-provided copy + UX)**:
- API env error payload (status 500):
  - `error`: "Supabase server env missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL"
  - `hint`: "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in server env (.env.local on dev)."
- UI env error card:
  - Title: "환경변수 설정 필요"
  - Body: "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL이 없어 검색이 동작하지 않습니다. 서버 환경변수(.env.local) 설정 후 다시 시도하세요."
  - Code line: "Missing: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL"
- canWrite guardrails:
  - Disable write buttons with tooltip text: "쓰기 기능 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 미설정 또는 CONTRACTS.functions RPC 미설정"
  - Toast once per page load on write attempt when `canWrite=false`: "쓰기 비활성: NEXT_PUBLIC_CMS_ACTOR_ID 또는 RPC 설정을 확인하세요."
  - Top banner when `NEXT_PUBLIC_CMS_ACTOR_ID` missing: "환경 경고: NEXT_PUBLIC_CMS_ACTOR_ID 미설정으로 생성/추가/VOID가 차단됩니다."
- MASTER-first UX:
  - `componentType` default: "MASTER"; PART moved to compact "Advanced: PART" toggle/segmented switch near search
  - MASTER list badges: show `category_code` and `part_kind` if present (neutral badges)
  - Selected component preview: show `unit_default` + `spec_text` in compact row below SearchSelect
  - ActionBar CTA: primary button "레시피 저장" emphasized when product selected; keep recipe form
- VOID confirm modal:
  - Title: "구성품 VOID"
  - Body: "이 구성품 라인을 VOID 처리합니다. 되돌릴 수 없으며 감사/분석 로그로 유지됩니다."
  - Buttons: "취소" (secondary), "VOID 처리" (danger)
- Layout: keep SplitLayout; left = product + recipe worklist; right = recipe detail + component lines + optional "구성품 재고 요약" placeholder card

**Constraints**:
- No new dependencies, no RPC behavior changes, no DB changes.

---

## Work Objectives

### Core Objective
Ensure BOM API routes return explicit env error payloads and the BOM UI presents clear env/config guardrails, MASTER-first workflows, and safe VOID confirmation while preserving existing RPC flows.

### Concrete Deliverables
- API payload updates in `web/src/app/api/master-items/route.ts` and `web/src/app/api/part-items/route.ts`
- BOM UI updates in `web/src/app/(app)/bom/page.tsx`
- Use existing UI components (`Modal`, `ActionBar`, `Badge`, `Button`, `SplitLayout`) without adding deps

### Definition of Done
- API routes return the exact `error` and `hint` fields for missing Supabase env.
- BOM UI shows env error card when API reports missing env.
- `canWrite=false` disables write CTAs, shows banner and one-time toast on attempted write.
- MASTER-first UX and VOID confirm modal reflect user-provided copy.

### Must NOT Have (Guardrails)
- No new dependencies.
- No changes to RPC function behavior or DB schema.
- No server-side auth logic changes.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no test scripts in `web/package.json`).
- **User wants tests**: NO (manual/agent-executable verification only).
- **Framework**: none.

### Automated Verification (Agent-Executable)

**API (curl)**
```bash
# Precondition: run dev server with missing env vars
NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npm run dev --prefix web

curl -s http://localhost:3000/api/master-items | jq
curl -s http://localhost:3000/api/part-items | jq

# Assert: HTTP status 500
# Assert JSON fields:
# error == "Supabase server env missing: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL"
# hint == "Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in server env (.env.local on dev)."
```

**UI (Playwright skill)**
```
1. Start dev server with missing env vars as above.
2. Navigate to: http://localhost:3000/bom
3. Type a query in "모델명 검색" to trigger API call.
4. Assert env error card appears with:
   - Title: "환경변수 설정 필요"
   - Body text and code line matching spec.
5. Assert "환경 경고: NEXT_PUBLIC_CMS_ACTOR_ID 미설정으로 생성/추가/VOID가 차단됩니다." banner appears when ACTOR env missing.
6. Click "레시피 저장" and "구성품 추가" with canWrite=false.
7. Assert toast appears once per page load with the exact copy.
8. Switch component type to PART via Advanced toggle; assert MASTER is default.
9. Click "제거(VOID)" on a line; confirm modal appears with exact title/body/buttons.
10. Screenshot: .sisyphus/evidence/bom-env-ux.png
```

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
├── Task 1: Update API env error payloads (independent)

Wave 2 (After Wave 1):
├── Task 2: BOM UI env error card + fetchJson env error detection
├── Task 3: canWrite guardrails (banner, tooltip, one-time toast)
├── Task 4: MASTER-first UX adjustments + selected component preview + badges
├── Task 5: ActionBar CTA + layout adjustments + placeholder card
└── Task 6: VOID confirm modal using existing Modal component

Critical Path: Task 1 → Task 2 → Task 3/4/5/6

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2 | None |
| 2 | 1 | 3,4,5,6 | 3,4,5,6 (same file; coordinate merges) |
| 3 | 2 | 5,6 | 4,5,6 (same file; coordinate merges) |
| 4 | 2 | 5 | 3,5,6 (same file; coordinate merges) |
| 5 | 2 | None | 3,4,6 (same file; coordinate merges) |
| 6 | 2 | None | 3,4,5 (same file; coordinate merges) |

---

## TODOs

> Note: Tasks 2–6 touch the same file (`web/src/app/(app)/bom/page.tsx`); if parallelized, agents must coordinate to avoid conflicts.

- [ ] 1. Update API env error payloads in master/part routes

  **What to do**:
  - Update env missing responses to include both `error` and `hint` fields with exact copy.
  - Ensure HTTP status remains 500 and does not alter query behavior.

  **Must NOT do**:
  - Do not alter RPC behavior or DB queries.
  - Do not add new dependencies.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, scoped updates in two server route files.
  - **Skills**: [`backend-patterns`, `coding-standards`]
    - `backend-patterns`: Ensure error payload conventions in route handlers.
    - `coding-standards`: Keep response shape consistent and minimal.
  - **Skills Evaluated but Omitted**:
    - `security-review`: No auth/sensitive logic changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `web/src/app/api/master-items/route.ts:8` - Env guard via `getSupabaseAdmin()`; update error payload here.
  - `web/src/app/api/part-items/route.ts:8` - Same env guard pattern in part API.

  **Acceptance Criteria**:
  - [ ] `GET /api/master-items` with missing env returns status 500 with `error` and `hint` fields matching exact copy.
  - [ ] `GET /api/part-items` with missing env returns status 500 with `error` and `hint` fields matching exact copy.

- [ ] 2. Add BOM UI env error card + env error detection

  **What to do**:
  - Extend `fetchJson()` handling to detect env error payload (match `error` string or include `hint`) and surface a structured env error state.
  - Render a dedicated env error card in BOM UI with the provided title/body/code line.
  - Ensure card only appears when env error occurs; keep existing toast handling for other errors.

  **Must NOT do**:
  - Do not change API endpoints or RPC usage.
  - Do not add dependencies.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI state additions and conditional render.
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: React state + conditional UI patterns.
    - `coding-standards`: Keep error handling clean and minimal.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No new design system; uses existing components.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3–6, but coordinate due to same file)
  - **Parallel Group**: Wave 2
  - **Blocks**: 3,4,5,6
  - **Blocked By**: Task 1

  **References**:
  - `web/src/app/(app)/bom/page.tsx:71` - `fetchJson()` error handling location.
  - `web/src/app/(app)/bom/page.tsx:83` - main page component; insert env error UI state.

  **Acceptance Criteria**:
  - [ ] Triggering a search when API returns env error shows the env error card with exact title/body/code line.
  - [ ] Non-env API errors continue to surface via existing toast behavior.

- [ ] 3. Implement canWrite guardrails (banner, disabled CTAs, one-time toast)

  **What to do**:
  - When `NEXT_PUBLIC_CMS_ACTOR_ID` missing, show top banner with specified copy.
  - Disable write buttons (recipe save, add line, void) when `canWrite=false`.
  - Add tooltip text via `title` attribute (or existing tooltip if found) with exact copy.
  - Ensure toast shows only once per page load when user attempts a write action and `canWrite=false`.

  **Must NOT do**:
  - Do not change RPC calls or payloads.
  - Do not add dependencies for tooltip.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: UI state + copy changes; minimal refactor.
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: State/UX guardrails.
    - `coding-standards`: Keep toast/disable logic consistent.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No new layout design.

  **Parallelization**:
  - **Can Run In Parallel**: YES (coordinate with Tasks 2,4,5,6)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `web/src/app/(app)/bom/page.tsx:29` - `canWrite` computation.
  - `web/src/app/(app)/bom/page.tsx:235` - write handlers where to gate and toast.

  **Acceptance Criteria**:
  - [ ] Banner appears when `NEXT_PUBLIC_CMS_ACTOR_ID` missing with exact copy.
  - [ ] Write CTAs are disabled with tooltip text when `canWrite=false`.
  - [ ] On first write attempt with `canWrite=false`, toast shows once per page load.

- [ ] 4. MASTER-first UX: default MASTER, advanced PART toggle, badges, selected preview

  **What to do**:
  - Default `componentType` to "MASTER" and move PART selection into compact "Advanced: PART" toggle near search.
  - For MASTER component options, include neutral badges for `category_code` and `part_kind` if provided.
  - Add selected component preview row showing `unit_default` and `spec_text` when available.

  **Must NOT do**:
  - Do not alter API data shape beyond existing fields.
  - Do not add new dependencies.

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: UX arrangement and small visual presentation adjustments.
  - **Skills**: [`frontend-patterns`, `frontend-ui-ux`]
    - `frontend-patterns`: UI state and component composition.
    - `frontend-ui-ux`: Adjust layout for MASTER-first flow.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: No server changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES (coordinate with Tasks 2,3,5,6)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `web/src/app/(app)/bom/page.tsx:92` - `componentType` state and select UI.
  - `web/src/app/(app)/bom/page.tsx:169` - component search query and options mapping.
  - `web/src/app/(app)/bom/page.tsx:93` - component selection state for preview.

  **Acceptance Criteria**:
  - [ ] MASTER is the default component type on load.
  - [ ] PART selection is available via compact "Advanced: PART" toggle/segment.
  - [ ] MASTER options show badges for available `category_code`/`part_kind`.
  - [ ] Selected component preview shows `unit_default` + `spec_text` when present.

- [ ] 5. ActionBar CTA + layout adjustments + placeholder card

  **What to do**:
  - Add ActionBar primary CTA "레시피 저장" (emphasized when product selected) and wire to `handleCreateRecipe`.
  - Keep recipe form but relocate/duplicate CTA in ActionBar.
  - Maintain SplitLayout: left = product + recipe worklist; right = recipe detail + component lines + placeholder "구성품 재고 요약" card.

  **Must NOT do**:
  - Do not remove existing recipe form inputs.
  - Do not add dependencies.

  **Recommended Agent Profile**:
  - **Category**: `artistry`
    - Reason: Layout/CTA emphasis changes.
  - **Skills**: [`frontend-patterns`, `frontend-ui-ux`]
    - `frontend-patterns`: ActionBar actions usage.
    - `frontend-ui-ux`: CTA emphasis and layout balance.
  - **Skills Evaluated but Omitted**:
    - `backend-patterns`: No server changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES (coordinate with Tasks 2,3,4,6)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `web/src/components/layout/action-bar.tsx:3` - ActionBar `actions` prop for CTA.
  - `web/src/app/(app)/bom/page.tsx:285` - existing ActionBar usage.

  **Acceptance Criteria**:
  - [ ] ActionBar shows primary "레시피 저장" CTA and triggers recipe save.
  - [ ] Layout preserves SplitLayout with new placeholder card.

- [ ] 6. Add VOID confirm modal using existing Modal component

  **What to do**:
  - Add state to open a confirm modal before calling `handleVoidLine`.
  - Use `Modal` component with provided title/body and buttons.
  - Ensure confirm executes VOID mutation; cancel closes modal.

  **Must NOT do**:
  - Do not alter RPC call payloads.
  - Do not add dependencies.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward modal wiring.
  - **Skills**: [`frontend-patterns`, `coding-standards`]
    - `frontend-patterns`: modal state + confirm flow.
    - `coding-standards`: keep modal props consistent.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: uses existing modal component.

  **Parallelization**:
  - **Can Run In Parallel**: YES (coordinate with Tasks 2–5)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `web/src/components/ui/modal.tsx:13` - Modal component API.
  - `web/src/app/(app)/shipments/page.tsx:889` - Modal usage pattern in app.
  - `web/src/app/(app)/bom/page.tsx:273` - `handleVoidLine` entry point for modal.

  **Acceptance Criteria**:
  - [ ] Clicking "제거(VOID)" opens confirm modal with exact title/body/button copy.
  - [ ] Confirm triggers VOID mutation; cancel closes modal without changes.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(bom): align api env error payloads` | `web/src/app/api/master-items/route.ts`, `web/src/app/api/part-items/route.ts` | curl checks |
| 2-6 | `feat(bom): env guardrails and master-first ux` | `web/src/app/(app)/bom/page.tsx` | Playwright checks |

---

## Success Criteria

- [ ] API env error payload matches exact copy in both routes.
- [ ] BOM UI displays env error card and canWrite guardrails per spec.
- [ ] MASTER-first UX and VOID confirm modal behave per spec.
- [ ] No dependencies added; no RPC/DB behavior changes.
