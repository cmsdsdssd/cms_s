@echo off
cd /d web
node --test tests/price-sync-policy.test.mjs tests/price-sync-pressure-policy.test.mjs > ..\tmp_verify_tests.txt 2>&1
if errorlevel 1 exit /b 1
npm run build > ..\tmp_verify_build.txt 2>&1
if errorlevel 1 exit /b 1
