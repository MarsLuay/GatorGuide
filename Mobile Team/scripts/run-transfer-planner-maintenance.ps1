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

$stepResults = [ordered]@{
  "Planner refresh" = "pending"
  "Playwright Chromium" = if ($SkipWindowsQa -or $SkipChromiumInstall) { "skipped" } else { "pending" }
  "Windows QA" = if ($SkipWindowsQa) { "skipped" } else { "pending" }
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
    "## Generated Outputs",
    "",
    "- Planner maintenance summary: $summaryPath",
    "- Planner log: $logPath",
    "- Planner source-gap report: $(Join-Path $tmpDir 'transfer-planner-source-gaps.md')",
    "- Planner requirement parse report: $(Join-Path $tmpDir 'transfer-planner-requirement-source-parse-report.md')",
    "- Planner diff classification report: $(Join-Path $tmpDir 'transfer-planner-requirement-diff-promotion-report.md')",
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
