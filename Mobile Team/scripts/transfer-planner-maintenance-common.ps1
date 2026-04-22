function Get-TransferPlannerLaymansDiagnosis {
  param(
    [string]$ProjectRoot,
    [string]$FailureMessage = "",
    [string]$LogPath = "",
    [string]$TargetPlanId = "",
    [switch]$IncludeWarnings
  )

  $diagnosisScriptPath = if ($ProjectRoot) {
    Join-Path $ProjectRoot "scripts\planner\transfer-planner-laymans-diagnosis.cjs"
  } else {
    Join-Path $PSScriptRoot "planner\transfer-planner-laymans-diagnosis.cjs"
  }

  $arguments = @($diagnosisScriptPath, "--format", "json")
  if ($ProjectRoot) {
    $arguments += @("--project-root", $ProjectRoot)
  }
  if ($FailureMessage) {
    $arguments += @("--failure-message", $FailureMessage)
  }
  if ($LogPath) {
    $arguments += @("--log-path", $LogPath)
  }
  if ($TargetPlanId) {
    $arguments += @("--target-plan-id", $TargetPlanId)
  }
  if ($IncludeWarnings) {
    $arguments += "--include-warnings"
  }

  try {
    $rawOutput = @(& node @arguments 2>$null)
    $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } elseif ($?) { 0 } else { 1 }
    if ($exitCode -ne 0) {
      return @()
    }

    $jsonText = ($rawOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($jsonText)) {
      return @()
    }

    return @($jsonText | ConvertFrom-Json)
  } catch {
    return @()
  }
}

function Write-TransferPlannerLaymansDiagnosis {
  param(
    [object[]]$Items,
    [string]$Header = "Laymans Diagnosis"
  )

  if (-not $Items -or $Items.Count -eq 0) {
    return
  }

  Write-Host ""
  Write-Host "== $Header ==" -ForegroundColor Cyan

  foreach ($item in $Items) {
    Write-Host ("- What went wrong: {0}" -f $item.symptom) -ForegroundColor White
    Write-Host ("  Why it matters: {0}" -f $item.whyItMatters) -ForegroundColor DarkGray
    Write-Host ("  Likely cause: {0}" -f $item.likelyCause) -ForegroundColor DarkGray
    Write-Host ("  Next action: {0}" -f $item.nextAction) -ForegroundColor Yellow
    Write-Host ("  Where to look: {0}" -f $item.whereToLook) -ForegroundColor DarkCyan
  }
}

function Convert-TransferPlannerLaymansDiagnosisToMarkdownLines {
  param([object[]]$Items)

  if (-not $Items -or $Items.Count -eq 0) {
    return @()
  }

  $lines = @(
    "## Laymans Diagnosis",
    ""
  )

  foreach ($item in $Items) {
    $lines += "- What went wrong: $($item.symptom)"
    $lines += "  Why it matters: $($item.whyItMatters)"
    $lines += "  Likely cause: $($item.likelyCause)"
    $lines += "  Next action: $($item.nextAction)"
    $lines += "  Where to look: $($item.whereToLook)"
  }

  $lines += ""
  return $lines
}
