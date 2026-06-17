Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  throw "USERPROFILE is not set."
}

$logDir = Join-Path $env:USERPROFILE ".fusion-harness\logs"
$paths = @(
  Join-Path $logDir "runner.out.log",
  Join-Path $logDir "runner.err.log"
)
$existing = @($paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })

if ($existing.Count -eq 0) {
  Write-Host "No Fusion Runner logs found at $logDir."
  exit 0
}

Get-Content -LiteralPath $existing -Tail 80 -Wait
