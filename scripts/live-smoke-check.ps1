param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$DetailSlug = "inside-stream-editorial-pipeline"
)

$normalizedBase = $BaseUrl.TrimEnd("/")
$paths = @(
  "/",
  "/streams",
  "/about",
  "/streams/$DetailSlug",
  "/admin",
  "/admin/content",
  "/admin/sources",
  "/admin/imports",
  "/admin/moderation"
)

$results = @()
$hasFailure = $false

foreach ($path in $paths) {
  $url = "$normalizedBase$path"
  try {
    $response = Invoke-WebRequest -Uri $url -MaximumRedirection 3 -TimeoutSec 20 -UseBasicParsing
    $statusCode = [int]$response.StatusCode
    $ok = $statusCode -ge 200 -and $statusCode -lt 400
    if (-not $ok) {
      $hasFailure = $true
    }
    $results += [PSCustomObject]@{
      path = $path
      url = $url
      statusCode = $statusCode
      ok = $ok
      error = $null
    }
  } catch {
    $hasFailure = $true
    $results += [PSCustomObject]@{
      path = $path
      url = $url
      statusCode = $null
      ok = $false
      error = $_.Exception.Message
    }
  }
}

$payload = [PSCustomObject]@{
  baseUrl = $normalizedBase
  checkedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  success = -not $hasFailure
  results = $results
}

$payload | ConvertTo-Json -Depth 6

if ($hasFailure) {
  exit 1
}
