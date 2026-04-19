param(
  [Parameter(Mandatory = $true)]
  [string]$ExternalDatabaseUrl,
  [string]$DumpPath = "deploy/render/refereepoint_dump.sql"
)

if (!(Test-Path -LiteralPath $DumpPath)) {
  Write-Error "Dump file not found at: $DumpPath"
  exit 1
}

$url = $ExternalDatabaseUrl.Trim()
if ([string]::IsNullOrWhiteSpace($url)) {
  Write-Error "External database URL is empty."
  exit 1
}

if ($url -notmatch "sslmode=") {
  if ($url.Contains("?")) {
    $url = "$url&sslmode=require"
  } else {
    $url = "$url?sslmode=require"
  }
}

Write-Host "Importing $DumpPath into Render Postgres..."
& psql $url -v ON_ERROR_STOP=1 -f $DumpPath

if ($LASTEXITCODE -ne 0) {
  Write-Error "Import failed with exit code $LASTEXITCODE."
  exit $LASTEXITCODE
}

Write-Host "Import complete."
