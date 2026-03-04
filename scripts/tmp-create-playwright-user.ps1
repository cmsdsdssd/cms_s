$ErrorActionPreference = "Stop"

$gcloud = "C:\Users\RICH\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$service = & $gcloud run services describe cms-web --project cms-web-488112 --region asia-northeast3 --format json | ConvertFrom-Json

$envs = @{}
foreach ($e in $service.spec.template.spec.containers[0].env) {
  if ($null -ne $e.value) {
    $envs[$e.name] = [string]$e.value
  }
}

$supabaseUrl = [string]$envs["NEXT_PUBLIC_SUPABASE_URL"]
$anonKey = [string]$envs["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
$serviceRole = (& $gcloud secrets versions access latest --secret SUPABASE_SERVICE_ROLE_KEY --project cms-web-488112).Trim()

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or [string]::IsNullOrWhiteSpace($anonKey) -or [string]::IsNullOrWhiteSpace($serviceRole)) {
  throw "required supabase credentials are missing"
}

$email = "autotest+" + [Guid]::NewGuid().ToString("N").Substring(0, 12) + "@example.com"
$password = "Tmp!" + [Guid]::NewGuid().ToString("N").Substring(0, 16)

$headers = @{
  "Authorization" = "Bearer $serviceRole"
  "apikey" = $anonKey
  "Content-Type" = "application/json"
}

$body = @{ email = $email; password = $password; email_confirm = $true } | ConvertTo-Json -Compress
$created = $null
try {
  $created = Invoke-RestMethod -Method Post -Uri ($supabaseUrl.TrimEnd("/") + "/auth/v1/admin/users") -Headers $headers -Body $body
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $respBody = $reader.ReadToEnd()
    $reader.Close()
    throw "create user failed: $respBody"
  }
  throw
}
if (-not $created.id) {
  throw "failed to create temporary user"
}

$out = @{
  email = $email
  password = $password
  user_id = [string]$created.id
  supabase_url = $supabaseUrl
  anon_key = $anonKey
} | ConvertTo-Json -Compress

[System.IO.File]::WriteAllText("C:\Users\RICH\.gemini\antigravity\scratch\cms_s\tmp_playwright_auth.json", $out, [System.Text.Encoding]::UTF8)
Write-Output ("CREATED_USER_ID=" + [string]$created.id)
