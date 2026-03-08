@echo off
git reset HEAD -- "docs/runbooks/auto-price-v2-history-retention.md" "supabase/migrations/20260307000500_cms_1124_auto_sync_default_rate_to_2pct_addonly.sql" "supabase/migrations/20260307014000_cms_1125_price_sync_auto_state_v1_addonly.sql" "supabase/migrations/20260307014100_cms_1106_price_sync_change_event_retention_addonly.sql" "web/src/app/(app)/settings/shopping/auto-price/page.tsx" "web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts" "web/src/app/api/price-sync-runs-v2/route.ts" "web/src/lib/shop/price-sync-policy.js" "web/src/lib/shop/price-sync-pressure-policy.js" "web/tests/price-sync-policy.test.mjs" "web/tests/price-sync-pressure-policy.test.mjs" > tmp_commit_reset.txt 2>&1
git add -- "web/src/lib/shop/price-sync-policy.js" "web/tests/price-sync-policy.test.mjs" "supabase/migrations/20260307000500_cms_1124_auto_sync_default_rate_to_2pct_addonly.sql"
git commit -m "price sync policy" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>" > tmp_commit_1.txt 2>&1 || exit /b 1
git add -- "web/src/lib/shop/price-sync-pressure-policy.js" "web/tests/price-sync-pressure-policy.test.mjs" "supabase/migrations/20260307014000_cms_1125_price_sync_auto_state_v1_addonly.sql"
git commit -m "pressure policy" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>" > tmp_commit_2.txt 2>&1 || exit /b 1
git add -- "web/src/app/api/price-sync-runs-v2/route.ts" "web/src/app/(app)/settings/shopping/auto-price/page.tsx"
git commit -m "auto-price pressure ui" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>" > tmp_commit_3.txt 2>&1 || exit /b 1
git add -- "web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts" "supabase/migrations/20260307014100_cms_1106_price_sync_change_event_retention_addonly.sql" "docs/runbooks/auto-price-v2-history-retention.md"
git commit -m "price sync history retention" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>" > tmp_commit_4.txt 2>&1 || exit /b 1
git status --short --branch > tmp_post_commit_status.txt 2>&1
git log -4 --oneline > tmp_post_commit_log.txt 2>&1
