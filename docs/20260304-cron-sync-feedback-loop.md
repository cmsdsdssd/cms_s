# Cron Sync Feedback Loop (Until 100% Reflection)

## Goal
- Cron path must converge to deterministic `SUCCESS/FAILED` without heuristic policy blockers and without silent skips.

## Attempt Log Rules
- Each attempt is exactly 3 lines: `Executed` / `Result` / `Next`.
- Keep every line self-contained so this file alone explains current state.

## Attempt 001
- Executed: Removed heuristic policy-fail branches in `web/src/app/api/channel-prices/push/route.ts` and unified verify mismatch to `VERIFY_MISMATCH` based on observed API verify only.
- Result: Option-type inference failures (`BASE_PRICE_IMMUTABLE_*`, `VARIANT_ADDITIONAL_IMMUTABLE_OPTION_TYPE_C`) are no longer emitted by push path; failure semantics now reflect transport/verify outcomes.
- Next: Run full verification (`lsp`, tests, build) then execute real cron run and capture whether latest run reaches target (`failed=0`, `skipped=0`).

## Attempt 002
- Executed: Added one extra retry-on-verify-mismatch in push path (re-push + re-verify) and ran `recompute -> create_run -> execute` by invoking route handlers with `.env.local` on channel `9d7c22c7-8cf5-46e7-950b-59eced8b316e`.
- Result: Deterministic run succeeded (`run_id=df450d9c-a27a-4a76-a91a-ebb78cd64f1e`, `status=SUCCESS`, `success=16`, `failed=0`, `skipped=0`), plus regression tests/build passed.
- Next: Keep Oracle plan as guardrail, monitor new runs for regressions, and only add durable backoff queue (`next_retry_at`) if real traffic shows recurring `VERIFY_PENDING`/429 patterns.

## Attempt 003
- Executed: Re-ran loop to test repeatability; first call hit interval gate (`skipped=INTERVAL_NOT_ELAPSED`), then forced fresh run with `interval_minutes=1` and executed immediately.
- Result: Fresh run also succeeded (`run_id=db8bc197-6803-473a-88a2-e625a42ec008`, `status=SUCCESS`, `success=16`, `failed=0`, `skipped=0`) confirming stable cron path after code changes.
- Next: Keep this file as rolling ledger for production-like retries; if any new fail appears, append next attempt with exact error_code and remediation in the same 3-line format.

## Attempt 004
- Executed: User-reported count mismatch (`19 -> 16`) was traced to run-creation exclusion; changed logic to keep base intents but pre-mark them `SKIPPED(BASE_PRICE_DEFERRED_TO_VARIANTS)` and added dedicated cron run log page.
- Result: Verified full cycle now reports `total_count=19` with deterministic execution (`status=SUCCESS`, `success=16`, `failed=0`, `skipped=3`, `run_id=56911fbc-64c2-4c72-a2d0-25d01c63cceb`) and new UI at `/settings/shopping/cron-runs`.
- Next: Use cron-runs page as primary transparency view; if skipped rises beyond deferred-base rows, append next attempt with exact reason breakdown and code fix.

## Attempt 005
- Executed: Removed base defer path and run-level SKIPPED pre-marking, then forced base+variant full push in one run using Product API semantics (`product price` + `variant additional_amount`) from `web/docs/Cafe24/ProductAPI.md`.
- Result: Real verification run reached full convergence with no skip (`run_id=8b5adcf8-3465-422e-960b-d27f8c397b29`, `total=19`, `success=19`, `failed=0`, `skipped=0`).
- Next: Keep this mode as default; if any future mismatch appears, record exact `error_code` and apply ordered base-first retry in the next numbered attempt.

## Attempt 006
- Executed: Hardened v2 pipeline for scale by adding execute batching/chunked push, push route chunked `.in` queries + chunked job-item insert, create-run chunked snapshot/map/floor queries + chunked intent/task insert, and stale-running overlap guard.
- Result: Verification cycle succeeded with batching (`run_id=723a2b80-552a-457f-9f37-8bb82299bea9`, round1 `status=SUCCESS`, `success=19`, `failed=0`, `skipped=0`) and full build/tests passed.
- Next: Tune env knobs (`SHOP_SYNC_EXECUTE_INTENT_BATCH_SIZE`, `SHOP_SYNC_PUSH_CHUNK_SIZE`, `SHOP_SYNC_EXECUTE_MAX_ROUNDS`, `SHOP_SYNC_RUNNING_STALE_MINUTES`) per production traffic and append next attempt with 429/failure reason metrics.

## Attempt 007
- Executed: Ran end-to-end cron route smoke (`pull -> recompute -> create run -> execute rounds`) through `web/src/app/api/cron/shop-sync-v2/route.ts` using local secret override for test invocation.
- Result: Full chain succeeded (`run_id=e4c809e8-10be-43aa-81d4-602b390752f0`, `total=19`, `success=19`, `failed=0`, `skipped=0`, `processed_pending_batch=19`, chunk params returned in response).
- Next: Validate same behavior under larger pending batches (intent > 300) and record observed rounds/latency/429 counts in next attempt.

## Attempt 008
- Executed: Hid unused dashboard entry points from shopping navigation/home/action links and switched cross-links to `auto-price`/`workflow`/`cron-runs`; applied scaling env knobs in `.env.local` + `.env.example`.
- Result: Operator path is now focused on active pages only (`channels`, `mappings`, `factors`, `rules`, `auto-price`, `sync-jobs`, `cron-runs`, `workflow`) with chunking env values explicitly configured.
- Next: Monitor production cron rounds for 429 spikes and increase/decrease `intent_batch_size` and `push_chunk_size` based on observed latency/error rates.

## Attempt 009
- Executed: Fixed pinned snapshot projection in `web/src/app/api/channel-prices/push/route.ts` to resolve targets by logical key (`master_item_id + external_variant_code`) when `channel_product_id` remaps after active/inactive variant swap.
- Result: Cron smoke recovered from `PUSH_RESULT_FILTERED_OR_MISSING` to full success (`run_id=2766215d-3566-4593-88ca-86e53a514498`, `total=19`, `success=19`, `failed=0`, `skipped=0`) with clean task error distribution (`NONE=19`).
- Next: Run repeated interval-1 cron smokes for the same channel to confirm zero recurrence under remap churn and track any new non-`NONE` task errors by run.

## Attempt 010
- Executed: Added cron tick persistence in `web/src/app/api/cron/shop-sync-v2/route.ts` so skipped interval/overlap invocations are logged as `CANCELLED` runs with `error_message=CRON_TICK:*`, and updated interval gating to ignore those tick rows.
- Result: Sync log visibility now includes scheduler heartbeat ticks (not only execute runs), while real run cadence is preserved by filtering tick rows in both cron route and run-creation route.
- Next: Verify in UI that every scheduler hit appears with `크론 체크:*` note and confirm real execute runs still trigger at configured interval boundaries.

## Attempt 011
- Executed: Ran skip-path smoke (`interval_minutes=60`) and queried `price_sync_run_v2` to validate persisted tick rows plus latest run ordering after the patch.
- Result: Tick row is now persisted and visible (`status=CANCELLED`, `error_message=CRON_TICK:INTERVAL_NOT_ELAPSED`, `run_id=5a9ef5e0-dd3f-4eff-97d2-336dcbf92fc9`) between real execution runs.
- Next: Confirm scheduler endpoint is `/api/cron/shop-sync-v2` in production and monitor that tick rows continue to appear at each scheduler invocation.

## Attempt 012
- Executed: Investigated `run_id=f1dcbdbe-7881-406a-9c55-8d49b2351fee` full failure and patched `web/src/app/api/channel-prices/push/route.ts` to stop selecting non-existent `pricing_snapshot.external_variant_code`; logical variant key is now derived via `sales_channel_product` join.
- Result: Root-cause confirmed (`last_error=column pricing_snapshot.external_variant_code does not exist`, 19건) and fixed; re-smoke succeeded (`run_id=348d54cd-e95d-4a9d-ab49-141400f192de`, `success=19`, `failed=0`, `skipped=0`).
- Next: Keep schema-compatible projection rule (snapshot minimal columns + mapping join) and alert immediately when any run emits SQL-column errors in `price_sync_push_task_v2.last_error`.


## Attempt 013
- Executed: Screenshot case를 실데이터로 대조해 `channel_option_current_state_v1`는 `external_product_no=13`에 저장/VERIFY_FAILED가 누적되고, 활성 매핑은 `sales_channel_product.external_product_no=P000000N`인 분리 상태를 확인한 뒤 `editor POST`에 canonical product 해석(활성 alias 우선) + 상태저장/실반영 대상 통일 로직을 추가했습니다.
- Result: `web/src/app/api/channel-products/editor/route.ts`가 요청 product_no가 비활성 alias여도 활성 product_no로 정규화해 반영하고, `web/src/app/api/channel-prices/push/route.ts`는 product+variant override를 우선 사용하도록 유지되어 alias flattening 위험을 줄였으며, `npm run build`/`npm run test:shipments-regression` 통과로 코드 안정성 확인했습니다.
- Next: 다음 cron 실행에서 해당 master(4551f046-607f-4bf0-85db-9eafab542cd0)의 job_item target/after와 storefront additional(0 고정 해소 여부)를 같은 창에서 재검증하고, 필요 시 `channel_option_current_state_v1` 조회 정렬에 `state_id` tie-break를 추가합니다.


## Attempt 014
- Executed: 17:40 run/job/item을 실데이터로 대조해 `run_id=072bffcf-d971-4d25-87d1-183d6efae1a2`, `job_id=a99e0fd6-067f-4aa3-af00-5d4bd2aeb10c`에서 N/O variant가 모두 base target(2,159,000 / 27,000)으로 평탄화됨을 재확인했고, `channel_option_current_state_v1` 저장값이 활성 product_no(`P...`)가 아닌 비활성 alias(`12/13/14`)에 남아있는 분리를 확인했습니다.
- Result: `channel_option_current_state_v1`를 활성 매핑 키(`P000000M/N/O + variant`)로 16건 canonical upsert해 저장 SoT를 복구했고, 코드에는 `shop-sync-v2` 5분 강제 interval/관측값, `push` variant verify(가격+additional), state 조회 tie-break를 반영했으며 build+회귀테스트 통과했습니다.
- Next: 운영 인스턴스에서 5분 interval이 실제 적용되도록 배포/환경 반영 후 다음 run에서 M/N/O variant `target_price_krw`가 base와 분리되는지, storefront additional이 0 고정 해소되는지 즉시 검증합니다.


## Attempt 015
- Executed: Cloud Scheduler `shop-sync-10m`를 `*/5` + `interval_minutes=5`로 수정하고, Cloud Run 최신 리비전에 서버용 `SUPABASE_URL` fallback(`src/lib/shop/admin.ts`)과 5분 정책 env를 반영한 뒤 `force_full_sync=true`로 즉시 실행했습니다.
- Result: `job_id=06905723-4a8b-471c-9377-ebbce27492e5`에서 N/O variant target이 base와 분리되어 평탄화가 해소됨(`P000000N000B=2,128,000`, `P000000O000D=40,000` 등), `flatten_count_n_o=0` 확인; 실패 2건은 M의 `PRODUCT_ENDPOINT_NOT_FOUND`로 별도 이슈입니다.
- Next: 5분 스케줄 연속 실행에서 N/O가 계속 비평탄 유지되는지 모니터링하고, M의 `PRODUCT_ENDPOINT_NOT_FOUND`(P000000M000C/D) 매핑/엔드포인트 이슈를 분리 조치합니다.


## Attempt 016
- Executed: 운영 배포에서 `Supabase server env missing` 재발 원인을 `NEXT_PUBLIC_SUPABASE_URL` 빌드/런타임 분리 문제로 확정하고, 서버 클라이언트가 `SUPABASE_URL`을 우선 사용하도록 수정(`web/src/lib/shop/admin.ts`) 후 Cloud Run를 build-env/runtime-env/secrets 포함으로 재배포했습니다.
- Result: cron API 500 해소(`POST /api/cron/shop-sync-v2` 200), 로그인 경로 정상(`GET /login` 200), Scheduler 5분+force_full_sync 연속 실행에서 최신 잡(`2b44a3f8-280f-48cf-aa7e-6e588814af8a`) 기준 N/O 평탄화 0건 확인.
- Next: M의 잔여 실패(`PRODUCT_ENDPOINT_NOT_FOUND` for P000000M000C/D)를 별도 트랙으로 분리해 매핑/엔드포인트 호환 처리 후 전체 19/0/0 안정화.
