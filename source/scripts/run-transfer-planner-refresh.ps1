param(
  [switch]$SkipDownloads,
  [switch]$NoOpenReports,
  [string]$OnlySection,
  [string]$StartSection,
  [string]$TargetPlanId,
  [switch]$SkipVerify,
  [switch]$SkipAutoRepair
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "transfer-planner-maintenance-common.ps1")
. (Join-Path $PSScriptRoot "transfer-planner-tmp-layout.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$tmpLayout = Initialize-GatorGuideTmpLayout -ProjectRoot $projectRoot
$tmpDir = $tmpLayout.root
$logDir = Join-Path $tmpLayout.logs "planner-refresh-logs"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$modeLabel = if ($SkipDownloads) { "skip-downloads" } else { "full" }
$logPath = Join-Path $logDir "planner-refresh-$modeLabel-$timestamp.log"
$sourceSummaryPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-source-link-summary.md"
$primarySourceGapPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-primary-source-review-queue.md"
$sourceGapPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-source-gaps.md"
$autoRepairPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-auto-repair-plan.md"
$sourceFingerprintPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-source-fingerprints.md"
$sourceChangeClassificationPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-source-change-classification.md"
$requirementDiffReportPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-requirement-diff-promotion-report.md"
$requirementSourceParsePath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-requirement-source-parse-report.md"
$parserRecoveryPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-parser-recovery-report.md"
$ownerAuditPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-owner-audit.md"
$equivalencyGuidePath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-equivalency-guide-parse.md"
$grcCatalogPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-grc-catalog-ingest.md"
$uwCatalogPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "transfer-planner-uw-catalog-ingest.md"
$deadlineRefreshPath = Get-GatorGuideTmpPath -Layout $tmpLayout -Name "deadline-refresh-report.md"

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
  if ($TargetPlanId) {
    Write-Host "Target plan: $TargetPlanId" -ForegroundColor DarkCyan
  }

  if ($OnlySection -and $StartSection) {
    throw "Use either -OnlySection or -StartSection, not both."
  }

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
  if ($OnlySection) {
    $refreshArgs += @("--only-section", $OnlySection)
  }
  if ($StartSection) {
    $refreshArgs += @("--start-section", $StartSection)
  }
  if ($TargetPlanId) {
    $refreshArgs += @("--target-plan-id", $TargetPlanId)
  }
  if ($SkipVerify) {
    $refreshArgs += "--skip-verify"
  }
  if ($SkipAutoRepair) {
    $refreshArgs += "--skip-auto-repair"
  }

  Invoke-LoggedCommand -FilePath "node" -Arguments $refreshArgs -Description "Run planner refresh pipeline"

  Write-Section "Refresh complete"
  Write-Host "Success. The planner refresh finished cleanly." -ForegroundColor Green
  Write-Host "Log saved to: $logPath"
  $diagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -LogPath $logPath `
      -TargetPlanId $TargetPlanId `
      -IncludeWarnings
  )
  Write-TransferPlannerLaymansDiagnosis -Items $diagnosisItems -Header "Laymans Diagnosis"

  if (-not $NoOpenReports) {
    $reportPaths = @(
      @{ Label = "source summary"; Path = $sourceSummaryPath },
      @{ Label = "source-gap automation report"; Path = $sourceGapPath },
      @{ Label = "closed-loop auto-repair plan"; Path = $autoRepairPath },
      @{ Label = "source fingerprint report"; Path = $sourceFingerprintPath },
      @{ Label = "source-change classification report"; Path = $sourceChangeClassificationPath },
      @{ Label = "primary-source source-gap report"; Path = $primarySourceGapPath },
      @{ Label = "requirement source parse report"; Path = $requirementSourceParsePath },
      @{ Label = "parser auto-recovery report"; Path = $parserRecoveryPath },
      @{ Label = "requirement-diff promotion report"; Path = $requirementDiffReportPath },
      @{ Label = "owner audit report"; Path = $ownerAuditPath },
      @{ Label = "equivalency guide parse report"; Path = $equivalencyGuidePath },
      @{ Label = "GRC catalog ingest report"; Path = $grcCatalogPath },
      @{ Label = "UW catalog ingest report"; Path = $uwCatalogPath },
      @{ Label = "deadline refresh report"; Path = $deadlineRefreshPath }
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
  $failureMessage = $_.Exception.Message
  Write-Host ""
  Write-Host "Planner refresh failed." -ForegroundColor Red
  Write-Host $failureMessage -ForegroundColor Red
  Write-Host "Log saved to: $logPath" -ForegroundColor Yellow
  $diagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -FailureMessage $failureMessage `
      -LogPath $logPath `
      -TargetPlanId $TargetPlanId `
      -IncludeWarnings
  )
  Write-TransferPlannerLaymansDiagnosis -Items $diagnosisItems -Header "Laymans Diagnosis"
  exit 1
}
