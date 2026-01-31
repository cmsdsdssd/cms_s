# Supabase RPC Error Plan: column l.ref_line_id does not exist

## TL;DR

> **Quick Summary**: Verify the live RPC function definition and schema in the remote DB, compare with repo migrations, and apply the minimal-risk fix (replace stale function or validate required schema change) with a rollback plan and manual verification.
>
> **Deliverables**:
> - Evidence bundle: logs/SQL showing the failing RPC statement and remote function definition
> - Root-cause analysis: mismatch source and affected objects
> - Minimal-risk fix proposal with rollback steps
> - Manual verification checklist for RPC + UI flow
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Evidence collection → Remote function inspection → Fix selection → Verification

---

## Context

### Original Request
Investigate and plan a fix for Supabase RPC error `column l.ref_line_id does not exist` when confirming shipment, with manual verification and no unvalidated schema changes.

### Interview Summary
**Key Discussions**:
- Repo has two definitions of `cms_fn_confirm_shipment_v3_cost_v1` that do **not** reference `ref_line_id`.
- `cms_shipment_line` schema has **no** `ref_line_id` column.
- Likely root cause: remote DB function drift vs repo migrations.
- Verification strategy: manual-only.

**Research Findings**:
- SQLSTATE 42703 is undefined_column; common causes include stale function definitions, alias/CTE mismatches, and schema drift.

### Metis Review
Metis agent unavailable in this environment; performed self-review with explicit guardrails in this plan.

---

## Work Objectives

### Core Objective
Identify why the remote RPC references `l.ref_line_id` and apply the lowest-risk correction that restores successful shipment confirmation without unvalidated schema changes.

### Concrete Deliverables
- Root-cause report with the exact SQL fragment or function definition referencing `l.ref_line_id`
- Fix selection record (stale function replacement vs validated schema change)
- Manual verification checklist for SQL and UI/RPC behavior

### Definition of Done
- RPC call to `cms_fn_confirm_shipment_v3_cost_v1` succeeds (HTTP 2xx) for a known shipment in the target environment
- SQL execution of the function in the DB no longer raises 42703
- Client flow no longer throws `column l.ref_line_id does not exist`

### Must Have
- Validation of the live remote function definition before proposing changes
- Explicit rollback plan for any DB function change

### Must NOT Have (Guardrails)
- No schema changes without validating the remote DB and confirming business need
- No “guess” fixes that diverge from repo migrations without evidence

---

## Verification Strategy (Manual-Only)

### Test Decision
- **Infrastructure exists**: Unknown / not required
- **User wants tests**: Manual-only
- **Framework**: None

### Manual Verification Procedures
- Collect PostgREST/API logs for the failing request and capture the SQL statement (if available)
- Execute the function directly in the SQL editor with real parameters
- Re-run the UI flow (select receipt → confirm shipment) and observe the RPC response

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
├── Task 1: Evidence capture (logs + exact SQL)
└── Task 2: Inspect remote DB function + schema

Wave 2 (After Wave 1):
├── Task 3: Compare remote vs repo definitions + root-cause analysis
└── Task 4: Fix selection + rollback plan + verification checklist

Critical Path: Task 1 → Task 2 → Task 3 → Task 4

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 3 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | delegate_task(category="quick", load_skills=["backend-patterns", "security-review"], run_in_background=true) |
| 2 | 3, 4 | delegate_task(category="unspecified-high", load_skills=["backend-patterns"], run_in_background=true) |

---

## TODOs

- [ ] 1. Capture failing RPC evidence (logs + SQL)

  **What to do**:
  - Identify the failing request in logs (Supabase Log Explorer) and capture the `pgrst_statement` or SQL fragment
  - Record request parameters and correlation IDs if available
  - Confirm which environment is affected (dev/stage/prod)

  **Must NOT do**:
  - Do not change any DB objects while collecting evidence

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Log inspection and metadata capture are lightweight and time-sensitive
  - **Skills**: `backend-patterns`, `security-review`
    - `backend-patterns`: familiar with PostgREST/Supabase logging patterns
    - `security-review`: ensures no sensitive data mishandling when exporting logs
  - **Skills Evaluated but Omitted**:
    - `clickhouse-io`: not relevant to Supabase/Postgres

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `fetch.ts` - client fetch wrapper that logs RPC errors (stack trace reference)
  - `use-rpc-mutation.ts` - RPC client hook where error surfaced
  - `page.tsx` - confirm shipment UI entry point
  - Supabase Logs docs: https://supabase.com/docs/guides/platform/logs

  **Why Each Reference Matters**:
  - Client files help map the exact RPC call, parameters, and error handling
  - Supabase logs show the exact SQL sent to Postgres, revealing the source of `l.ref_line_id`

  **Acceptance Criteria**:
  - Manual: Log entry found with SQL or error details referencing `l.ref_line_id`
  - Manual: RPC request parameters captured for a failing example

- [ ] 2. Inspect remote DB function and schema (no changes)

  **What to do**:
  - Retrieve live function definition for `cms_fn_confirm_shipment_v3_cost_v1` via SQL (`pg_get_functiondef`)
  - Identify exact query segment referencing `l.ref_line_id`
  - Verify remote table schema for `cms_shipment_line`
  - Identify dependent objects or views used by the function

  **Must NOT do**:
  - No schema changes; inspection only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused DB inspection with read-only queries
  - **Skills**: `backend-patterns`, `security-review`
    - `backend-patterns`: Postgres system catalog queries
    - `security-review`: safe handling of privileged DB access
  - **Skills Evaluated but Omitted**:
    - `frontend-patterns`: not relevant to DB inspection

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `supabase/migrations/20260129225200_cms_0242_receipt_cost_rpcs.sql#L331` - repo function definition baseline
  - `supabase/migrations/20260201001000_cms_0262_realign_confirm_shipment_chain.sql#L739` - repo function definition baseline
  - `supabase/migrations/20260127124309_cms_0002_tables.sql#L245` - repo schema for `cms_shipment_line`
  - Postgres catalog docs: https://www.postgresql.org/docs/current/functions-info.html

  **Why Each Reference Matters**:
  - Repo baselines provide the intended function and schema state
  - Catalog queries show actual live function and schema definitions

  **Acceptance Criteria**:
  - Manual: Live function definition extracted and stored
  - Manual: Confirmation whether `cms_shipment_line` has `ref_line_id` in remote DB

- [ ] 3. Root-cause analysis: remote vs repo mismatch

  **What to do**:
  - Diff the live function definition against repo migrations
  - Trace where `l.ref_line_id` appears (alias/table context)
  - Determine whether error comes from a view/CTE/join alias vs base table
  - Produce a concise root-cause statement (e.g., “remote function is stale and references dropped column”)

  **Must NOT do**:
  - Do not propose schema changes unless confirmed necessary

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires judgment across DB, migrations, and query structure
  - **Skills**: `backend-patterns`
    - `backend-patterns`: SQL diffing and function analysis
  - **Skills Evaluated but Omitted**:
    - `security-review`: not central to diff analysis

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1, Task 2

  **References**:
  - Same repo migration files as Task 2
  - Function definition captured in Task 2

  **Acceptance Criteria**:
  - Manual: Documented mismatch location and specific SQL fragment
  - Manual: Root-cause statement tied to evidence

- [ ] 4. Minimal-risk fix strategy + rollback + verification checklist

  **What to do**:
  - Select fix approach:
    - **Preferred**: Replace remote function with repo definition (if stale)
    - **Only if validated**: Introduce schema change to add `ref_line_id` or update upstream view/CTE
  - Draft rollback plan (capture current function definition, restore if needed)
  - Create manual verification checklist for SQL and UI flow

  **Must NOT do**:
  - No schema changes without validation and explicit approval

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires risk assessment and change control
  - **Skills**: `backend-patterns`
    - `backend-patterns`: safe database change strategy
  - **Skills Evaluated but Omitted**:
    - `security-review`: not central unless privileged data changes

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - Captured live function definition and repo migrations
  - Supabase functions docs: https://supabase.com/docs/guides/database/functions

  **Acceptance Criteria**:
  - Manual: Fix approach selected and justified with evidence
  - Manual: Rollback steps documented
  - Manual: Verification checklist ready for execution

---

## Commit Strategy

- No commits in planning phase. Executor to decide if DB migration or SQL patch requires repo changes.

---

## Success Criteria

### Verification Commands (Manual)
- SQL Editor: `SELECT * FROM cms_fn_confirm_shipment_v3_cost_v1(<known_params>);` returns without 42703
- API: POST to `cms_fn_confirm_shipment_v3_cost_v1` returns 2xx with expected payload
- UI Flow: selecting receipt and confirming shipment completes without error toast/stack trace

### Final Checklist
- [ ] Evidence captured for failing SQL and parameters
- [ ] Live function definition confirmed
- [ ] Root cause documented with mismatch location
- [ ] Minimal-risk fix chosen with rollback
- [ ] Manual verification checklist executed
