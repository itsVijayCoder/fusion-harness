Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskName = "AsthriX Fusion Runner"
$DefaultCloudUrl = "https://fusion-api.asthrix.workers.dev"
$CloudUrl = ""
$Token = ""
$KeepFiles = $false
$SkipApi = $false
$InstallDir = ""
$ShimDir = ""

function Show-Usage {
  @"
Usage: uninstall-windows.ps1 [options]

Stops the Fusion Runner scheduled task, deregisters it from the Fusion API, and
removes the local binary, config, and logs.

Options:
  --cloud-url URL   Fusion API URL. Defaults to the URL stored in the runner
                    config, or $DefaultCloudUrl
  --token TOKEN     Runner token used to authenticate the deregister call.
                    Defaults to the token stored in the runner config.
  --keep-files      Only stop the service and deregister; leave local files.
  --skip-api        Only remove local files; do not call the deregister API.
  --install-dir DIR Binary install directory. Defaults to %USERPROFILE%\.openfusion\bin.
  --shim-dir DIR    Directory for fusion-runner.cmd. Defaults to install directory.
  -h, --help        Show this help.
"@
}

function Read-NextArg {
  param(
    [string[]]$AllArgs,
    [int]$Index,
    [string]$Name
  )

  if ($Index + 1 -ge $AllArgs.Count) {
    throw "$Name requires a value."
  }

  return $AllArgs[$Index + 1]
}

for ($i = 0; $i -lt $args.Count; $i++) {
  $arg = [string]$args[$i]
  switch ($arg) {
    { $_ -in @("--cloud-url", "-CloudUrl") } {
      $CloudUrl = Read-NextArg -AllArgs $args -Index $i -Name $arg
      $i++
      continue
    }
    { $_ -in @("--token", "-Token") } {
      $Token = Read-NextArg -AllArgs $args -Index $i -Name $arg
      $i++
      continue
    }
    { $_ -in @("--keep-files", "-KeepFiles") } {
      $KeepFiles = $true
      continue
    }
    { $_ -in @("--skip-api", "-SkipApi") } {
      $SkipApi = $true
      continue
    }
    { $_ -in @("--install-dir", "-InstallDir") } {
      $InstallDir = Read-NextArg -AllArgs $args -Index $i -Name $arg
      $i++
      continue
    }
    { $_ -in @("--shim-dir", "-ShimDir") } {
      $ShimDir = Read-NextArg -AllArgs $args -Index $i -Name $arg
      $i++
      continue
    }
    { $_ -in @("-h", "--help", "/?") } {
      Show-Usage
      exit 0
    }
    default {
      Show-Usage | Write-Error
      throw "Unknown option: $arg"
    }
  }
}

$IsWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if (-not $IsWindowsHost) {
  throw "This uninstaller is for Windows."
}

if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  throw "USERPROFILE is not set."
}

$ConfigDir = Join-Path $env:USERPROFILE ".openfusion"
$LegacyConfigDir = Join-Path $env:USERPROFILE ".fusion-harness"
$LogDir = Join-Path $ConfigDir "logs"
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = if ($env:FUSION_RUNNER_INSTALL_DIR) { $env:FUSION_RUNNER_INSTALL_DIR } else { Join-Path $ConfigDir "bin" }
}
if ([string]::IsNullOrWhiteSpace($ShimDir)) {
  $ShimDir = if ($env:FUSION_RUNNER_SHIM_DIR) { $env:FUSION_RUNNER_SHIM_DIR } else { $InstallDir }
}

# 1. Stop and remove the scheduled task first so the runner cannot re-register.
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Remove-Item -LiteralPath (Join-Path $ConfigDir "runner-service.ps1") -Force -ErrorAction SilentlyContinue

# 2. Resolve runner config. Prefer .openfusion, then legacy .fusion-harness.
$ConfigPath = Join-Path $ConfigDir "config.json"
$LegacyConfigPath = Join-Path $LegacyConfigDir "config.json"
$ResolvedConfig = $null
foreach ($candidate in @($ConfigPath, $LegacyConfigPath)) {
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    $ResolvedConfig = $candidate
    break
  }
}

$RunnerId = ""
$ConfigCloudUrl = ""
$ConfigToken = ""
if ($ResolvedConfig) {
  try {
    $cfg = Get-Content -LiteralPath $ResolvedConfig -Raw | ConvertFrom-Json
    $RunnerId = [string]$cfg.runner_id
    $ConfigCloudUrl = [string]$cfg.cloud_url
    $ConfigToken = [string]$cfg.token
  } catch {
    Write-Warning "Could not parse runner config at $ResolvedConfig."
  }
}

if ([string]::IsNullOrWhiteSpace($CloudUrl)) {
  $CloudUrl = if ([string]::IsNullOrWhiteSpace($ConfigCloudUrl)) { $DefaultCloudUrl } else { $ConfigCloudUrl }
}
if ([string]::IsNullOrWhiteSpace($Token)) {
  $Token = $ConfigToken
}

# 3. Deregister the runner from the API so it stops showing up in /runners.
if (-not $SkipApi -and -not [string]::IsNullOrWhiteSpace($RunnerId)) {
  if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Warning "No runner token found in config; skipping API deregister."
  } else {
    $encodedRunnerId = [uri]::EscapeDataString($RunnerId)
    $deregisterUrl = "$($CloudUrl.TrimEnd('/'))/api/runners/$encodedRunnerId"
    Write-Host "Deregistering runner $RunnerId from $CloudUrl ..."
    try {
      $response = Invoke-WebRequest -Method Delete -Uri $deregisterUrl -Headers @{ Authorization = "Bearer $Token" } -UseBasicParsing -ErrorAction Stop
      Write-Host "Runner deregistered from the API (HTTP $($response.StatusCode))."
    } catch {
      $statusCode = $null
      if ($_.Exception.Response) { $statusCode = [int]$_.Exception.Response.StatusCode }
      if ($statusCode) {
        Write-Warning "API deregister returned HTTP $statusCode (the runner row may already be gone)."
      } else {
        Write-Warning "Could not reach the Fusion API; the runner row will need to be removed manually."
      }
    }
  }
} elseif (-not $SkipApi -and [string]::IsNullOrWhiteSpace($RunnerId)) {
  Write-Warning "No runner config found; skipping API deregister."
}

# 4. Remove local files unless --keep-files was passed.
function Remove-FromUserPath {
  param([string]$Directory)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }

  $full = (Resolve-Path -LiteralPath $Directory).Path.TrimEnd("\")
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if ([string]::IsNullOrWhiteSpace($current)) {
    return
  }

  $parts = $current -split ";" | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_) -and -not $_.TrimEnd("\").Equals($full, [StringComparison]::OrdinalIgnoreCase)
  }
  [Environment]::SetEnvironmentVariable("Path", ($parts -join ";"), "User")
}

if (-not $KeepFiles) {
  Remove-Item -LiteralPath (Join-Path $InstallDir "fusion-runner.exe") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $ShimDir "fusion-runner.cmd") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $LogDir "runner.out.log") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $LogDir "runner.err.log") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ConfigPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $LegacyConfigPath -Force -ErrorAction SilentlyContinue
  Remove-FromUserPath -Directory $ShimDir
  if (Test-Path -LiteralPath $LegacyConfigDir -PathType Container) {
    Remove-Item -LiteralPath $LegacyConfigDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Fusion Runner removed."
if (-not $KeepFiles) {
  Write-Host "Removed: scheduled task, binary, config, and logs."
} else {
  Write-Host "Kept local files per --keep-files."
}