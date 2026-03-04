$ErrorActionPreference = "Stop"

$gcloud = "C:\Users\RICH\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$webDir = "C:\Users\RICH\.gemini\antigravity\scratch\cms_s\web"
$logPath = "C:\Users\RICH\.gemini\antigravity\scratch\cms_s\web\tmp-e2e-dev.log"

$serviceRole = (& $gcloud secrets versions access latest --secret SUPABASE_SERVICE_ROLE_KEY --project cms-web-488112).Trim()
if ([string]::IsNullOrWhiteSpace($serviceRole)) {
  throw "SUPABASE_SERVICE_ROLE_KEY access failed"
}

$existing = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -match "node.exe|npm.cmd") -and ($_.CommandLine -match "next dev") -and ($_.CommandLine -match "4173")
}
foreach ($p in $existing) {
  try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}

$lock = Join-Path $webDir ".next\dev\lock"
if (Test-Path $lock) {
  Remove-Item $lock -Force
}

$cmd = "set CMS_E2E_BYPASS_AUTH=1 && set SUPABASE_SERVICE_ROLE_KEY=$serviceRole && npm run dev -- --hostname 127.0.0.1 --port 4173 > `"$logPath`" 2>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $webDir -WindowStyle Hidden

Start-Sleep -Seconds 8
if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 4173 -WarningAction SilentlyContinue).TcpTestSucceeded) {
  throw "dev server did not start on 4173"
}

Write-Output "E2E_DEV_STARTED=1"
