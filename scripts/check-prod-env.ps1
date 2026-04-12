$required = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ORKPOD_AUTH_STRATEGY",
  "ORKPOD_COMMUNITY_WRITE_MODE",
  "ADMIN_ALLOWED_EMAILS",
  "ADMIN_ALLOWED_USER_IDS"
)

$missing = @()
foreach ($name in $required) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $name
  }
}

$report = [PSCustomObject]@{
  checkedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  requiredCount = $required.Count
  missingCount = $missing.Count
  missing = $missing
}

$report | ConvertTo-Json -Depth 4

if ($missing.Count -gt 0) {
  exit 1
}
