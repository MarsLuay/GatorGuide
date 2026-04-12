param(
  [switch]$SkipDownloads,
  [switch]$SkipWindowsQa,
  [switch]$SkipChromiumInstall,
  [switch]$NoOpenSummary
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $projectRoot ".tmp"
$logDir = Join-Path $tmpDir "planner-refresh-logs"

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logPath = Join-Path $logDir "planner-maintenance-$timestamp.log"
$summaryPath = Join-Path $tmpDir "transfer-planner-maintenance-summary.md"
$refreshLauncherPath = Join-Path $PSScriptRoot "run-transfer-planner-refresh.ps1"
$qaResultsRoot = Join-Path $projectRoot ".tools"
$qaWebPath = Join-Path $qaResultsRoot "qa-web"
$sourceGapReportPath = Join-Path $tmpDir "transfer-planner-source-gaps.json"
$requirementParseReportPath = Join-Path $tmpDir "transfer-planner-requirement-source-parse-report.json"
$requirementDiffReportPath = Join-Path $tmpDir "transfer-planner-requirement-diff-promotion-report.json"
$ownerAuditReportPath = Join-Path $tmpDir "transfer-planner-owner-audit.json"
$hardeningReportPath = Join-Path $tmpDir "transfer-planner-hardening-report.json"
$sourceYearCoverageReportPath = Join-Path $tmpDir "transfer-planner-source-year-coverage.json"

$stepResults = [ordered]@{
  "Planner refresh" = "pending"
  "Playwright Chromium" = if ($SkipWindowsQa -or $SkipChromiumInstall) { "skipped" } else { "pending" }
  "Windows QA" = if ($SkipWindowsQa) { "skipped" } else { "pending" }
  "Planner hardening checks" = "pending"
}

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

  $escapedArgumentList = if ($Arguments.Count -gt 0) {
    ($Arguments | ForEach-Object {
      $value = [string]$_
      if ($value -match '[\s"]') {
        '"' + ($value -replace '"', '\"') + '"'
      } else {
        $value
      }
    }) -join " "
  } else {
    ""
  }

  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process `
      -FilePath $FilePath `
      -ArgumentList $escapedArgumentList `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    if (Test-Path $stdoutPath) {
      Get-Content -Path $stdoutPath | Tee-Object -FilePath $logPath -Append
    }

    if (Test-Path $stderrPath) {
      Get-Content -Path $stderrPath | Tee-Object -FilePath $logPath -Append
    }

    $exitCode = $process.ExitCode
  } finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
  }

  if ($exitCode -ne 0) {
    throw "$Description failed with exit code $exitCode. See log: $logPath"
  }
}

function Write-Summary {
  param(
    [string]$Outcome,
    [string]$FailureMessage
  )

  function Read-JsonReport {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
      return $null
    }

    try {
      return Get-Content -Path $Path -Raw | ConvertFrom-Json
    } catch {
      return $null
    }
  }

  function Add-RequiredAction {
    param(
      [System.Collections.Generic.List[string]]$List,
      [string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Message)) {
      return
    }

    if (-not $List.Contains($Message)) {
      $List.Add($Message)
    }
  }

  $sourceGapReport = Read-JsonReport -Path $sourceGapReportPath
  $requirementParseReport = Read-JsonReport -Path $requirementParseReportPath
  $requirementDiffReport = Read-JsonReport -Path $requirementDiffReportPath
  $ownerAuditReport = Read-JsonReport -Path $ownerAuditReportPath
  $hardeningReport = Read-JsonReport -Path $hardeningReportPath
  $sourceYearCoverageReport = Read-JsonReport -Path $sourceYearCoverageReportPath

  $requiredActions = [System.Collections.Generic.List[string]]::new()

  if ($sourceGapReport -and $sourceGapReport.totalSourceGapOwners -gt 0) {
    Add-RequiredAction -List $requiredActions -Message "Resolve source gaps: add stronger official source discovery/parser support until hidden source-gap owners reaches 0."
  }

  if ($requirementParseReport -and $requirementParseReport.failedCount -gt 0) {
    Add-RequiredAction -List $requiredActions -Message "Fix requirement parsing failures: update source manifest links or parser adapters for owners that did not parse cleanly."
  }

  if ($requirementDiffReport -and (($requirementDiffReport.reviewCandidateCount -gt 0) -or ($requirementDiffReport.unmappedCount -gt 0))) {
    Add-RequiredAction -List $requiredActions -Message "Resolve requirement diff promotion debt: reduce review-needed/unmapped requirement diffs to 0 through parser or mapping updates."
  }

  if ($ownerAuditReport -and (($ownerAuditReport.issueCounts.error -gt 0) -or ($ownerAuditReport.issueCounts.warning -gt 0))) {
    Add-RequiredAction -List $requiredActions -Message "Address owner-audit issues: fix missing/invalid primary sources, manifest gaps, and parser fallback warnings."
  }

  if ($hardeningReport -and ($hardeningReport.outcome -ne "passed")) {
    Add-RequiredAction -List $requiredActions -Message "Clear hardening failures: fix failing checks in transfer-planner-hardening-report.md before shipping planner updates."
  }

  if ($sourceYearCoverageReport -and ($sourceYearCoverageReport.outcome -ne "ok")) {
    if ($sourceYearCoverageReport.requiredActions) {
      foreach ($action in $sourceYearCoverageReport.requiredActions) {
        Add-RequiredAction -List $requiredActions -Message ([string]$action)
      }
    } else {
      Add-RequiredAction -List $requiredActions -Message "Source year coverage needs attention: latest schedule coverage is not aligned with current/future academic year baselines."
    }
  }

  $summaryLines = @(
    "# Transfer Planner Maintenance Summary",
    "",
    "- Run started: $timestamp",
    "- Outcome: $Outcome",
    "- Project: $projectRoot",
    "- Log: $logPath",
    ""
  )

  if ($FailureMessage) {
    $summaryLines += @(
      "## Failure",
      "",
      "- $FailureMessage",
      ""
    )
  }

  $summaryLines += @(
    "## Step Results",
    ""
  )

  foreach ($entry in $stepResults.GetEnumerator()) {
    $summaryLines += "- $($entry.Key): $($entry.Value)"
  }

  $summaryLines += @(
    "",
    "## Run Flags",
    "",
    "- Skip downloads: $([string]$SkipDownloads)",
    "- Skip Windows QA: $([string]$SkipWindowsQa)",
    "- Skip Chromium install: $([string]$SkipChromiumInstall)",
    ""
  )

  $summaryLines += @(
    "## Automation Signals",
    ""
  )

  if ($sourceGapReport) {
    $summaryLines += "- Hidden source-gap owners: $($sourceGapReport.totalSourceGapOwners)"
  } else {
    $summaryLines += "- Hidden source-gap owners: unavailable (source-gap report missing)."
  }

  if ($requirementParseReport) {
    $summaryLines += "- Requirement parser failures: $($requirementParseReport.failedCount)"
  } else {
    $summaryLines += "- Requirement parser failures: unavailable (parse report missing)."
  }

  if ($requirementDiffReport) {
    $summaryLines += "- Requirement diff review-needed count: $($requirementDiffReport.reviewCandidateCount)"
    $summaryLines += "- Requirement diff unmapped count: $($requirementDiffReport.unmappedCount)"
  } else {
    $summaryLines += "- Requirement diff counts: unavailable (diff promotion report missing)."
  }

  if ($ownerAuditReport) {
    $summaryLines += "- Owner-audit errors: $($ownerAuditReport.issueCounts.error)"
    $summaryLines += "- Owner-audit warnings: $($ownerAuditReport.issueCounts.warning)"
  } else {
    $summaryLines += "- Owner-audit issue counts: unavailable (owner audit report missing)."
  }

  if ($hardeningReport) {
    $summaryLines += "- Hardening outcome: $($hardeningReport.outcome)"
  } else {
    $summaryLines += "- Hardening outcome: unavailable (hardening report missing)."
  }

  if ($sourceYearCoverageReport) {
    $summaryLines += "- Source year coverage outcome: $($sourceYearCoverageReport.outcome)"
  } else {
    $summaryLines += "- Source year coverage outcome: unavailable (source year coverage report missing)."
  }

  $summaryLines += ""

  $summaryLines += @(
    "## Required Update Queue",
    ""
  )

  if ($requiredActions.Count -eq 0) {
    $summaryLines += "- None. All monitored automation gates are clean."
  } else {
    foreach ($action in $requiredActions) {
      $summaryLines += "- $action"
    }
  }

  $summaryLines += @(
    "",
    "## Generated Outputs",
    "",
    "- Planner maintenance summary: $summaryPath",
    "- Planner log: $logPath",
    "- Green River public-material discovery: $(Join-Path $tmpDir 'transfer-planner-grc-public-materials.md')",
    "- Planner source-gap report: $(Join-Path $tmpDir 'transfer-planner-source-gaps.md')",
    "- Planner requirement parse report: $(Join-Path $tmpDir 'transfer-planner-requirement-source-parse-report.md')",
    "- Planner diff classification report: $(Join-Path $tmpDir 'transfer-planner-requirement-diff-promotion-report.md')",
    "- Planner hardening report: $(Join-Path $tmpDir 'transfer-planner-hardening-report.md')",
    "- Planner source year coverage report: $(Join-Path $tmpDir 'transfer-planner-source-year-coverage.md')",
    "- QA web export: $qaWebPath",
    "- QA output root: $qaResultsRoot",
    ""
  )

  Set-Content -Path $summaryPath -Value ($summaryLines -join [Environment]::NewLine) -Encoding UTF8
}

try {
  Write-Host "Transfer Planner Maintenance Launcher" -ForegroundColor Green
  Write-Host "Project: $projectRoot"
  Write-Host "Log: $logPath"

  Assert-Command -CommandName "powershell.exe" -FriendlyName "Windows PowerShell"
  Assert-Command -CommandName "node" -FriendlyName "Node.js"
  Assert-Command -CommandName "npm.cmd" -FriendlyName "npm"

  $refreshArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $refreshLauncherPath,
    "-NoOpenReports"
  )
  if ($SkipDownloads) {
    $refreshArgs += "-SkipDownloads"
  }

  Invoke-LoggedCommand -FilePath "powershell.exe" -Arguments $refreshArgs -Description "Run planner refresh and verification"
  $stepResults["Planner refresh"] = "passed"

  if (-not $SkipWindowsQa) {
    if (-not $SkipChromiumInstall) {
      Invoke-LoggedCommand -FilePath "npx.cmd" -Arguments @("playwright", "install", "chromium") -Description "Ensure Playwright Chromium is installed"
      $stepResults["Playwright Chromium"] = "passed"
    }

    Invoke-LoggedCommand -FilePath "npm.cmd" -Arguments @("run", "qa:windows:ci") -Description "Run Windows QA smoke suite"
    $stepResults["Windows QA"] = "passed"
  }

  Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts/planner/verify-transfer-planner-hardening.cjs") -Description "Run planner hardening checks"
  $stepResults["Planner hardening checks"] = "passed"

  Write-Summary -Outcome "passed" -FailureMessage ""

  Write-Section "Maintenance complete"
  Write-Host "Success. Planner maintenance and QA finished cleanly." -ForegroundColor Green
  Write-Host "Summary: $summaryPath"
  Write-Host "Log: $logPath"

  if (-not $NoOpenSummary -and (Test-Path $summaryPath)) {
    Start-Process $summaryPath | Out-Null
  }

  exit 0
} catch {
  $message = $_.Exception.Message
  Write-Summary -Outcome "failed" -FailureMessage $message

  Write-Host ""
  Write-Host "Planner maintenance failed." -ForegroundColor Red
  Write-Host $message -ForegroundColor Red
  Write-Host "Summary: $summaryPath" -ForegroundColor Yellow
  Write-Host "Log: $logPath" -ForegroundColor Yellow

  if (-not $NoOpenSummary -and (Test-Path $summaryPath)) {
    Start-Process $summaryPath | Out-Null
  }

  exit 1
}
