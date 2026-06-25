Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskName = "AsthriX Fusion Runner"
$RemoveAll = $false
$InstallDir = ""
$ShimDir = ""

function Show-Usage {
  @"
Usage: scripts\uninstall-runner-windows.ps1 [--all]

Stops and removes the Fusion Runner Windows scheduled task.

Options:
  --all             Also remove the installed binary, command shim, and logs.
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
    { $_ -in @("--all", "-All") } {
      $RemoveAll = $true
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
$LogDir = Join-Path $ConfigDir "logs"
if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = if ($env:FUSION_RUNNER_INSTALL_DIR) { $env:FUSION_RUNNER_INSTALL_DIR } else { Join-Path $ConfigDir "bin" }
}
if ([string]::IsNullOrWhiteSpace($ShimDir)) {
  $ShimDir = if ($env:FUSION_RUNNER_SHIM_DIR) { $env:FUSION_RUNNER_SHIM_DIR } else { $InstallDir }
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Remove-Item -LiteralPath (Join-Path $ConfigDir "runner-service.ps1") -Force -ErrorAction SilentlyContinue

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

if ($RemoveAll) {
  Remove-Item -LiteralPath (Join-Path $InstallDir "fusion-runner.exe") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $ShimDir "fusion-runner.cmd") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $LogDir "runner.out.log") -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $LogDir "runner.err.log") -Force -ErrorAction SilentlyContinue
  Remove-FromUserPath -Directory $ShimDir
}

Write-Host "Fusion Runner scheduled task removed."
