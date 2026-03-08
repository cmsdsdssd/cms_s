@echo off
set STASHED=0
git stash push --keep-index -m "temp staged auto-price verify" > tmp_stash_verify.txt 2>&1
findstr /C:"No local changes to save" tmp_stash_verify.txt >nul
if errorlevel 1 set STASHED=1
cd /d web
node --test tests/price-sync-policy.test.mjs tests/price-sync-pressure-policy.test.mjs > ..\tmp_verify_staged_tests.txt 2>&1
if errorlevel 1 goto :restore
npm run build > ..\tmp_verify_staged_build.txt 2>&1
:restore
cd /d ..
if "%STASHED%"=="1" git stash pop > tmp_stash_pop.txt 2>&1
exit /b %errorlevel%
