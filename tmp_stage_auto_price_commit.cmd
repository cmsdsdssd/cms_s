@echo off
git add -- "web/src/lib/shop/price-sync-policy.js" "web/tests/price-sync-policy.test.mjs" "supabase/migrations/20260307000500_cms_1124_auto_sync_default_rate_to_2pct_addonly.sql"
git add -- "web/src/lib/shop/price-sync-pressure-policy.js" "web/tests/price-sync-pressure-policy.test.mjs" "supabase/migrations/20260307014000_cms_1125_price_sync_auto_state_v1_addonly.sql"
git add -- "web/src/app/api/price-sync-runs-v2/route.ts" "web/src/app/(app)/settings/shopping/auto-price/page.tsx"
git add -- "web/src/app/api/price-sync-runs-v2/[run_id]/execute/route.ts" "supabase/migrations/20260307014100_cms_1106_price_sync_change_event_retention_addonly.sql" "docs/runbooks/auto-price-v2-history-retention.md"
