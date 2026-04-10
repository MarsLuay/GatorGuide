param(
  [switch]$SkipDownloads,
  [switch]$NoOpenReports
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $projectRoot ".tmp"
$logDir = Join-Path $tmpDir "planner-refresh-logs"

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$modeLabel = if ($SkipDownloads) { "skip-downloads" } else { "full" }
$logPath = Join-Path $logDir "planner-refresh-$modeLabel-$timestamp.log"
$sourceSummaryPath = Join-Path $tmpDir "transfer-planner-source-link-summary.md"
$primarySourceGapPath = Join-Path $tmpDir "transfer-planner-primary-source-review-queue.md"
$sourceGapPath = Join-Path $tmpDir "transfer-planner-source-gaps.md"
$sourceFingerprintPath = Join-Path $tmpDir "transfer-planner-source-fingerprints.md"
$requirementDiffReportPath = Join-Path $tmpDir "transfer-planner-requirement-diff-promotion-report.md"
$requirementSourceParsePath = Join-Path $tmpDir "transfer-planner-requirement-source-parse-report.md"
$ownerAuditPath = Join-Path $tmpDir "transfer-planner-owner-audit.md"
$equivalencyGuidePath = Join-Path $tmpDir "transfer-planner-equivalency-guide-parse.md"
$grcCatalogPath = Join-Path $tmpDir "transfer-planner-grc-catalog-ingest.md"
$uwCatalogPath = Join-Path $tmpDir "transfer-planner-uw-catalog-ingest.md"

function Write-Section {
  param([string]$Message)

  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Assert-Command {
  param(
    [string]$CommandName,
    [string]$FriendlyName
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "$FriendlyName is not installed or not on PATH. Install it first, then run this launcher again."
  }
}

function Invoke-LoggedCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description
  )

  Write-Section $Description
  $argumentText = if ($Arguments.Count -gt 0) { $Arguments -join " " } else { "" }
  Write-Host "$FilePath $argumentText" -ForegroundColor DarkGray

  & $FilePath @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "$Description failed with exit code $exitCode. See log: $logPath"
  }
}

function Test-InstallNeeded {
  $requiredPaths = @(
    (Join-Path $projectRoot "node_modules"),
    (Join-Path $projectRoot "node_modules\@babel\core"),
    (Join-Path $projectRoot "node_modules\typescript"),
    (Join-Path $projectRoot "node_modules\.bin\tsc.cmd")
  )

  foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path $requiredPath)) {
      return $true
    }
  }

  return $false
}

function Invoke-RepoHealthWithSelfHeal {
  param([bool]$AlreadyInstalled)

  try {
    Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("run", "health:repo") -Description "Run repo health check"
    return
  } catch {
    if ($AlreadyInstalled) {
      throw
    }

    Write-Section "Repair dependencies"
    Write-Host "Repo health check failed. Trying npm install once to repair missing or corrupted dependencies..." -ForegroundColor Yellow
    Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("install") -Description "Repair project dependencies"
    Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("run", "health:repo") -Description "Re-run repo health check"
  }
}

try {
  Write-Host "Transfer Planner Refresh Launcher" -ForegroundColor Green
  Write-Host "Project: $projectRoot"
  Write-Host "Log: $logPath"

  Assert-Command -CommandName "node" -FriendlyName "Node.js"
  Assert-Command -CommandName "npm.cmd" -FriendlyName "npm"

  $installedDependencies = $false
  if (Test-InstallNeeded) {
    Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("install") -Description "Install project dependencies"
    $installedDependencies = $true
  }

  Invoke-RepoHealthWithSelfHeal -AlreadyInstalled:$installedDependencies

  $refreshArgs = @("scripts/planner/refresh-transfer-planner-sources.cjs")
  if ($SkipDownloads) {
    $refreshArgs += "--skip-downloads"
  }

  Invoke-LoggedCommand -FilePath "node" -Arguments $refreshArgs -Description "Run planner refresh pipeline"

  Write-Section "Refresh complete"
  Write-Host "Success. The planner refresh finished cleanly." -ForegroundColor Green
  Write-Host "Log saved to: $logPath"

  if (-not $NoOpenReports) {
    $reportPaths = @(
      @{ Label = "source summary"; Path = $sourceSummaryPath },
      @{ Label = "source-gap automation report"; Path = $sourceGapPath },
      @{ Label = "source fingerprint report"; Path = $sourceFingerprintPath },
      @{ Label = "primary-source source-gap report"; Path = $primarySourceGapPath },
      @{ Label = "requirement source parse report"; Path = $requirementSourceParsePath },
      @{ Label = "requirement-diff promotion report"; Path = $requirementDiffReportPath },
      @{ Label = "owner audit report"; Path = $ownerAuditPath },
      @{ Label = "equivalency guide parse report"; Path = $equivalencyGuidePath },
      @{ Label = "GRC catalog ingest report"; Path = $grcCatalogPath },
      @{ Label = "UW catalog ingest report"; Path = $uwCatalogPath }
    )

    foreach ($report in $reportPaths) {
      if (Test-Path $report.Path) {
        Write-Host "Opening $($report.Label)..."
        Start-Process $report.Path | Out-Null
      }
    }
  }

  exit 0
} catch {
  Write-Host ""
  Write-Host "Planner refresh failed." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Log saved to: $logPath" -ForegroundColor Yellow
  exit 1
}
