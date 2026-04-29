param(
  [switch]$SkipDownloads,
  [switch]$SkipWindowsQa,
  [switch]$SkipChromiumInstall,
  [switch]$NoOpenSummary,
  [string]$OnlySection,
  [string]$StartSection,
  [string]$TargetPlanId,
  [switch]$ShowCacheSummary,
  [switch]$ShowLaymansDiagnosis,
  [switch]$NoPrompt,
  [switch]$RunPostChecks,
  [switch]$EditCourseLinks,
  [int]$BackExitCode = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "transfer-planner-maintenance-common.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$tmpDir = Join-Path $projectRoot ".tmp"
$logDir = Join-Path $tmpDir "planner-refresh-logs"

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logPath = Join-Path $logDir "planner-maintenance-$timestamp.log"
$summaryPath = Join-Path $tmpDir "transfer-planner-maintenance-summary.md"
$refreshLauncherPath = Join-Path $PSScriptRoot "run-transfer-planner-refresh.ps1"
$refreshPipelineScriptPath = Join-Path $projectRoot "scripts\planner\refresh-transfer-planner-sources.cjs"
$linkManagerScriptPath = Join-Path $projectRoot "scripts\planner\course-planner-link-manager.cjs"
$plannerStatusScriptPath = Join-Path $projectRoot "scripts\planner\planner-status.cjs"
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

$script:refreshTrackedStepCount = 1
$script:totalTrackedMaintenanceSteps = 1
$script:completedTrackedMaintenanceSteps = 0
$script:lastRunningOverallStepIndex = 1
$script:selectedMaintenanceMode = ""
$script:selectedMaintenanceSectionIds = @()
$script:selectedMaintenanceTargetPlanId = ""
$script:selectedMaintenanceTargetPlanTitle = ""

function Get-PostRefreshEnabledStepLabels {
  return @(
    $stepResults.GetEnumerator() |
      Where-Object { $_.Key -ne "Planner refresh" -and $_.Value -ne "skipped" } |
      ForEach-Object { [string]$_.Key }
  )
}

function Update-ExpandedMaintenancePlan {
  param([int]$RefreshTrackedStepCount)

  $script:refreshTrackedStepCount = [Math]::Max($RefreshTrackedStepCount, 0)
  $script:totalTrackedMaintenanceSteps =
    $script:refreshTrackedStepCount + @((Get-PostRefreshEnabledStepLabels)).Count
  $script:lastRunningOverallStepIndex = [Math]::Min(
    [Math]::Max($script:lastRunningOverallStepIndex, 1),
    [Math]::Max($script:totalTrackedMaintenanceSteps, 1)
  )
}

function Get-RefreshTrackedPlan {
  param(
    [switch]$SkipDownloads,
    [string]$OnlySection,
    [string]$StartSection,
    [string]$TargetPlanId
  )

  $arguments = @(
    $refreshPipelineScriptPath,
    "--print-step-plan-json"
  )
  if ($SkipDownloads) {
    $arguments += "--skip-downloads"
  }
  if ($OnlySection) {
    $arguments += @("--only-section", $OnlySection)
  }
  if ($StartSection) {
    $arguments += @("--start-section", $StartSection)
  }
  if ($TargetPlanId) {
    $arguments += @("--target-plan-id", $TargetPlanId)
  }

  $rawOutput = @(& node @arguments 2>$null)
  $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } elseif ($?) { 0 } else { 1 }
  if ($exitCode -ne 0) {
    return @{
      Count = 1
      Labels = @("Planner refresh")
      Sections = @()
      AvailableSections = @()
      SelectedSectionIds = @()
    }
  }

  $jsonText = ($rawOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  if ([string]::IsNullOrWhiteSpace($jsonText)) {
    return @{
      Count = 1
      Labels = @("Planner refresh")
    }
  }

  try {
    $plan = $jsonText | ConvertFrom-Json
    $labels = @($plan.labels | ForEach-Object { [string]$_ })
    $count = if ($plan.count) { [int]$plan.count } elseif ($labels.Count -gt 0) { $labels.Count } else { 1 }
    $sections = @(
      $plan.sections |
        ForEach-Object {
          [pscustomobject]@{
            Id = [string]$_.id
            Title = [string]$_.title
            Description = [string]$_.description
            Count = [int]$_.count
            Labels = @($_.labels | ForEach-Object { [string]$_ })
          }
        }
    )
    $availableSections = @(
      $plan.availableSections |
        ForEach-Object {
          [pscustomobject]@{
            Id = [string]$_.id
            Title = [string]$_.title
            Description = [string]$_.description
          }
        }
    )
    return @{
      Count = [Math]::Max($count, 1)
      Labels = $labels
      Sections = $sections
      AvailableSections = $availableSections
      SelectedSectionIds = @($plan.selectedSectionIds | ForEach-Object { [string]$_ })
    }
  } catch {
    return @{
      Count = 1
      Labels = @("Planner refresh")
      Sections = @()
      AvailableSections = @()
      SelectedSectionIds = @()
    }
  }
}

function Write-MaintenanceProgress {
  param(
    [int]$CurrentOverallStepIndex = 0,
    [string]$State = "running",
    [string]$Detail = "",
    [int]$CompletedOverallSteps = -1
  )
  $totalSteps = [Math]::Max($script:totalTrackedMaintenanceSteps, 1)
  if ($CompletedOverallSteps -lt 0) {
    $CompletedOverallSteps = $script:completedTrackedMaintenanceSteps
  }

  $currentIndex = if ($CurrentOverallStepIndex -gt 0) {
    [Math]::Min([Math]::Max($CurrentOverallStepIndex, 1), $totalSteps)
  } else {
    [Math]::Min([Math]::Max($CompletedOverallSteps + 1, 1), $totalSteps)
  }
  $script:lastRunningOverallStepIndex = $currentIndex

  switch ($State) {
    "running" {
      $percent = [int]([Math]::Floor((([Math]::Max($currentIndex - 1, 0)) / $totalSteps) * 100))
      $status = "Step $currentIndex of $totalSteps"
      $operation = if ($Detail) { $Detail } else { "Running transfer planner maintenance" }
    }
    "passed" {
      $completedClamped = [Math]::Min([Math]::Max($CompletedOverallSteps, 0), $totalSteps)
      $percent = [int]([Math]::Floor(($completedClamped / $totalSteps) * 100))
      $status = "Completed $completedClamped of $totalSteps steps"
      $operation = if ($Detail) { $Detail } else { "Transfer planner maintenance step passed" }
    }
    "failed" {
      $percent = [int]([Math]::Floor((([Math]::Max($currentIndex - 1, 0)) / $totalSteps) * 100))
      $status = "Failed on step $currentIndex of $totalSteps"
      $operation = if ($Detail) { $Detail } else { "Transfer planner maintenance failed" }
    }
    "completed" {
      $percent = 100
      $status = "Completed"
      $operation = if ($Detail) { $Detail } else { "All enabled maintenance steps finished." }
    }
    default {
      $completedClamped = [Math]::Min([Math]::Max($CompletedOverallSteps, 0), $totalSteps)
      $percent = [int]([Math]::Floor(($completedClamped / $totalSteps) * 100))
      $status = "Completed $completedClamped of $totalSteps steps"
      $operation = if ($Detail) { $Detail } else { "Transfer planner maintenance" }
    }
  }

  Write-Progress `
    -Activity "Transfer Planner Maintenance" `
    -Status $status `
    -CurrentOperation $operation `
    -PercentComplete $percent
}

function Update-RefreshMaintenanceProgressFromOutputLine {
  param([string]$Line)
  if ([string]::IsNullOrWhiteSpace($Line)) {
    return
  }

  if ($Line -match 'Planned tracked steps:\s*(\d+)') {
    Update-ExpandedMaintenancePlan -RefreshTrackedStepCount ([int]$matches[1])
    return
  }

  if ($Line -match '^\s*==\s+\[(\d+)\/(\d+)\]\s+(.+?)\s+==\s*$') {
    $nestedIndex = [int]$matches[1]
    $nestedCount = [int]$matches[2]
    $nestedLabel = [string]$matches[3]

    if ($nestedCount -ne $script:refreshTrackedStepCount) {
      Update-ExpandedMaintenancePlan -RefreshTrackedStepCount $nestedCount
    }

    Write-MaintenanceProgress `
      -CurrentOverallStepIndex $nestedIndex `
      -State "running" `
      -Detail "Refresh [$nestedIndex/$script:refreshTrackedStepCount]: $nestedLabel"
  }
}

function Format-CacheAge {
  param([datetime]$Timestamp)

  $age = (Get-Date) - $Timestamp
  if ($age.TotalMinutes -lt 1) {
    return "just now"
  }
  if ($age.TotalHours -lt 1) {
    return "{0}m ago" -f [Math]::Floor($age.TotalMinutes)
  }
  if ($age.TotalDays -lt 1) {
    return "{0}h {1}m ago" -f [Math]::Floor($age.TotalHours), $age.Minutes
  }
  return "{0}d {1}h ago" -f [Math]::Floor($age.TotalDays), $age.Hours
}

function Format-CacheTimestamp {
  param($Item)

  if (-not $Item) {
    return "missing"
  }

  $timestamp = if ($Item -is [System.IO.FileSystemInfo]) {
    $Item.LastWriteTime
  } else {
    [datetime]$Item
  }

  return "{0} ({1})" -f $timestamp.ToString("yyyy-MM-dd h:mm tt"), (Format-CacheAge -Timestamp $timestamp)
}

function Get-LatestExistingItem {
  param([string[]]$Paths)

  $existingItems = @(
    $Paths |
      Where-Object { $_ -and (Test-Path $_) } |
      ForEach-Object { Get-Item $_ } |
      Sort-Object LastWriteTime -Descending
  )

  if ($existingItems.Count -eq 0) {
    return $null
  }

  return ($existingItems | Select-Object -First 1)
}

function Get-ArtifactState {
  param([string[]]$Paths)

  $normalizedPaths = @($Paths | Where-Object { $_ } | Select-Object -Unique)
  $existingItems = @(
    $normalizedPaths |
      Where-Object { Test-Path $_ } |
      ForEach-Object { Get-Item $_ } |
      Sort-Object LastWriteTime -Descending
  )

  return [pscustomobject]@{
    TotalCount = $normalizedPaths.Count
    ExistingCount = $existingItems.Count
    LatestItem = if ($existingItems.Count -gt 0) { $existingItems | Select-Object -First 1 } else { $null }
    ExistingItems = $existingItems
  }
}

function Get-MaintenanceSectionCatalog {
  param([hashtable]$RefreshPlanInfo)

  $refreshSections = @()
  $availableRefreshSections = @($RefreshPlanInfo.AvailableSections)
  if ($availableRefreshSections.Count -gt 0) {
    $refreshSections = @(
      $availableRefreshSections | ForEach-Object {
        [pscustomobject]@{
          Id = [string]$_.Id
          Title = [string]$_.Title
          Description = [string]$_.Description
          Kind = "refresh"
          StepLabel = "Planner refresh"
        }
      }
    )
  } else {
    $refreshSections = @(
      [pscustomobject]@{
        Id = "grc-discovery"
        Title = "Refresh: GRC discovery and baseline"
        Description = "Discover public materials, check source-year coverage, and regenerate Green River associate tracks."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      },
      [pscustomobject]@{
        Id = "source-audit"
        Title = "Refresh: source audit and gap detection"
        Description = "Check source links, discover primary sources, and rebuild the source-gap queue."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      },
      [pscustomobject]@{
        Id = "requirement-parsing"
        Title = "Refresh: requirement parsing and fingerprints"
        Description = "Parse UW requirement sources and rebuild the source fingerprint reports."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      },
      [pscustomobject]@{
        Id = "schedule-cache"
        Title = "Refresh: annual schedule cache"
        Description = "Download or reuse the cached Green River annual schedule PDFs."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      },
      [pscustomobject]@{
        Id = "catalog-and-generation"
        Title = "Refresh: catalog ingest and generated outputs"
        Description = "Regenerate bootstrap, equivalencies, catalog ingests, metadata, availability, and docs."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      },
      [pscustomobject]@{
        Id = "verification"
        Title = "Refresh: verification suite"
        Description = "Run the owner audit, TypeScript typecheck, and transfer planner tests."
        Kind = "refresh"
        StepLabel = "Planner refresh"
      }
    )
  }

  $postSections = @(
    [pscustomobject]@{
      Id = "playwright-chromium"
      Title = "Post-refresh: install Playwright Chromium"
      Description = "Install or update the browser binary used by the Windows QA smoke suite."
      Kind = "post"
      StepLabel = "Playwright Chromium"
    },
    [pscustomobject]@{
      Id = "windows-qa"
      Title = "Post-refresh: Windows QA smoke suite"
      Description = "Run the Windows browser and interaction smoke checks."
      Kind = "post"
      StepLabel = "Windows QA"
    },
    [pscustomobject]@{
      Id = "hardening"
      Title = "Post-refresh: planner hardening checks"
      Description = "Run the planner hardening verifier against the current generated outputs."
      Kind = "post"
      StepLabel = "Planner hardening checks"
    }
  )

  if ($SkipWindowsQa) {
    $postSections = @($postSections | Where-Object { $_.Id -ne "playwright-chromium" -and $_.Id -ne "windows-qa" })
  } elseif ($SkipChromiumInstall) {
    $postSections = @($postSections | Where-Object { $_.Id -ne "playwright-chromium" })
  }

  return @($refreshSections + $postSections)
}

function Get-SectionArtifacts {
  param([string]$SectionId)

  switch ($SectionId) {
    "grc-discovery" {
      return @(
        (Join-Path $tmpDir "transfer-planner-grc-public-materials.json"),
        (Join-Path $tmpDir "transfer-planner-source-year-coverage.json"),
        (Join-Path $tmpDir "transfer-planner-grc-associate-tracks.json")
      )
    }
    "source-audit" {
      return @(
        (Join-Path $tmpDir "transfer-planner-source-link-snapshot.json"),
        (Join-Path $tmpDir "transfer-planner-primary-source-discovery.json"),
        (Join-Path $tmpDir "transfer-planner-primary-source-review-queue.json"),
        (Join-Path $tmpDir "transfer-planner-source-gaps.json")
      )
    }
    "requirement-parsing" {
      return @(
        (Join-Path $tmpDir "transfer-planner-requirement-source-parse-report.json"),
        (Join-Path $tmpDir "transfer-planner-source-fingerprints.json")
      )
    }
    "schedule-cache" {
      $materialsPath = Join-Path $tmpDir "transfer-planner-grc-public-materials.json"
      $paths = @($materialsPath)
      if (Test-Path $materialsPath) {
        try {
          $materials = Get-Content -Path $materialsPath -Raw | ConvertFrom-Json
          $paths += @(
            $materials.annualSchedules |
              ForEach-Object { [string]$_.outputPath } |
              Where-Object { $_ }
          )
        } catch {
        }
      } else {
        $paths += @(
          Get-ChildItem -Path $tmpDir -Filter "*-Annual-Schedule.pdf" -File -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName }
        )
      }
      return @($paths | Where-Object { $_ } | Select-Object -Unique)
    }
    "catalog-and-generation" {
      return @(
        (Join-Path $tmpDir "transfer-planner-equivalency-guide-parse.json"),
        (Join-Path $tmpDir "transfer-planner-grc-catalog-ingest.json"),
        (Join-Path $tmpDir "transfer-planner-uw-catalog-ingest.json"),
        (Join-Path $projectRoot "constants\green-river-major-options.generated.ts"),
        (Join-Path $projectRoot "constants\transfer-planner-source\bootstrap.generated.ts"),
        (Join-Path $projectRoot "constants\transfer-planner-source\course-metadata.generated.ts"),
        (Join-Path $projectRoot "constants\transfer-planner-source\equivalency-guide.generated.ts"),
        (Join-Path $projectRoot "constants\transfer-planner-source\grc-associate-tracks.generated.ts"),
        (Join-Path $projectRoot "constants\transfer-planner-source\grc-course-availability.generated.ts")
      )
    }
    "verification" {
      return @(
        (Join-Path $tmpDir "transfer-planner-owner-audit.json")
      )
    }
    "playwright-chromium" {
      return @(
        Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "ms-playwright") -Directory -Filter "chromium-*" -ErrorAction SilentlyContinue |
          ForEach-Object { $_.FullName }
      )
    }
    "windows-qa" {
      return @(
        $qaWebPath
      )
    }
    "hardening" {
      return @(
        (Join-Path $tmpDir "transfer-planner-hardening-report.json"),
        (Join-Path $tmpDir "transfer-planner-hardening-report.md")
      )
    }
    default {
      return @()
    }
  }
}

function Read-LatestMaintenanceSummaryMetadata {
  if (-not (Test-Path $summaryPath)) {
    return $null
  }

  $summaryLines = @(Get-Content -Path $summaryPath -ErrorAction SilentlyContinue)
  $runStarted = ($summaryLines | Where-Object { $_ -like "- Run started:*" } | Select-Object -First 1)
  $outcome = ($summaryLines | Where-Object { $_ -like "- Outcome:*" } | Select-Object -First 1)
  $failureMessages = [System.Collections.Generic.List[string]]::new()
  $failureHeaderIndex = -1

  for ($index = 0; $index -lt $summaryLines.Count; $index += 1) {
    if ([string]$summaryLines[$index] -eq "## Failure") {
      $failureHeaderIndex = $index
      break
    }
  }

  if ($failureHeaderIndex -ge 0) {
    for ($index = $failureHeaderIndex + 1; $index -lt $summaryLines.Count; $index += 1) {
      $line = [string]$summaryLines[$index]
      if ($line -like "## *") {
        break
      }
      if ($line -match '^\s*-\s+(.+?)\s*$') {
        $failureMessages.Add($matches[1])
      }
    }
  }

  $outcomeLabel = if ($outcome) { $outcome -replace '^- Outcome:\s*', '' } else { "" }
  return [pscustomobject]@{
    Path = $summaryPath
    LastWriteTime = (Get-Item $summaryPath).LastWriteTime
    RunStarted = if ($runStarted) { $runStarted -replace '^- Run started:\s*', '' } else { "" }
    Outcome = $outcomeLabel
    HadErrors = ($outcomeLabel -eq "failed") -or ($failureMessages.Count -gt 0)
    FailureMessages = @($failureMessages)
  }
}

function Show-CacheSummary {
  param([pscustomobject[]]$SectionCatalog)

  Write-Section "Cached status"

  $latestMaintenanceSummary = Read-LatestMaintenanceSummaryMetadata
  $latestMaintenanceLog = Get-LatestExistingItem -Paths @(
    Get-ChildItem -Path $logDir -Filter "planner-maintenance-*.log" -File -ErrorAction SilentlyContinue |
      ForEach-Object { $_.FullName }
  )
  $latestRefreshLog = Get-LatestExistingItem -Paths @(
    Get-ChildItem -Path $logDir -Filter "planner-refresh-*.log" -File -ErrorAction SilentlyContinue |
      ForEach-Object { $_.FullName }
  )

  if ($latestMaintenanceSummary) {
    $outcomeLabel = if ($latestMaintenanceSummary.Outcome) { $latestMaintenanceSummary.Outcome } else { "unknown" }
    Write-Host ("Last maintenance summary: {0} | outcome: {1}" -f (Format-CacheTimestamp -Item $latestMaintenanceSummary.LastWriteTime), $outcomeLabel) -ForegroundColor DarkCyan
    if ($latestMaintenanceSummary.RunStarted) {
      Write-Host ("Last maintenance run started: {0}" -f $latestMaintenanceSummary.RunStarted) -ForegroundColor DarkGray
    }
    if ($latestMaintenanceSummary.HadErrors) {
      Write-Host "Last run errors: yes" -ForegroundColor Yellow
      foreach ($failureMessage in $latestMaintenanceSummary.FailureMessages) {
        Write-Host ("  - {0}" -f $failureMessage) -ForegroundColor Yellow
      }
    } else {
      Write-Host "Last run errors: no" -ForegroundColor DarkGreen
    }
  } else {
    Write-Host "Last maintenance summary: missing" -ForegroundColor Yellow
  }

  Write-Host ("Latest maintenance log: {0}" -f (Format-CacheTimestamp -Item $latestMaintenanceLog)) -ForegroundColor DarkCyan
  Write-Host ("Latest refresh log: {0}" -f (Format-CacheTimestamp -Item $latestRefreshLog)) -ForegroundColor DarkCyan
  Write-Host ""
  Write-Host "Section cache snapshot:" -ForegroundColor Cyan

  foreach ($section in $SectionCatalog) {
    $artifactState = Get-ArtifactState -Paths (Get-SectionArtifacts -SectionId $section.Id)
    $statusLabel = if ($artifactState.TotalCount -eq 0) {
      "no dedicated cache artifacts"
    } elseif ($artifactState.ExistingCount -eq 0) {
      "missing"
    } elseif ($artifactState.ExistingCount -lt $artifactState.TotalCount) {
      "{0}/{1} artifacts present" -f $artifactState.ExistingCount, $artifactState.TotalCount
    } else {
      "{0}/{1} artifacts present" -f $artifactState.ExistingCount, $artifactState.TotalCount
    }

    Write-Host ("- [{0}] {1}" -f $section.Id, $section.Title) -ForegroundColor White
    Write-Host ("  Cache: {0}" -f $statusLabel) -ForegroundColor DarkGray
    Write-Host ("  Latest artifact: {0}" -f (Format-CacheTimestamp -Item $artifactState.LatestItem)) -ForegroundColor DarkGray
  }

  if (Test-Path $plannerStatusScriptPath) {
    Write-Host ""
    Write-Host "Current required update queue:" -ForegroundColor Cyan
    @(& node $plannerStatusScriptPath 2>$null) | ForEach-Object { Write-Host $_ }
  }

  $diagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -LogPath $logPath `
      -TargetPlanId $TargetPlanId `
      -IncludeWarnings
  )
  Write-TransferPlannerLaymansDiagnosis -Items $diagnosisItems -Header "Laymans Diagnosis"
}

function Show-LaymansDiagnosis {
  $diagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -LogPath $logPath `
      -TargetPlanId $TargetPlanId `
      -IncludeWarnings
  )

  if ($diagnosisItems.Count -eq 0) {
    Write-Section "Laymans Diagnosis"
    Write-Host "No current simple-language follow-up notes were found." -ForegroundColor DarkGreen
    return
  }

  Write-TransferPlannerLaymansDiagnosis -Items $diagnosisItems -Header "Laymans Diagnosis"
}

function Invoke-TransferPlannerNodeJsonCommand {
  param(
    [string[]]$Arguments,
    [string]$FailureContext
  )

  $rawOutput = @(& node @Arguments 2>&1)
  $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } elseif ($?) { 0 } else { 1 }
  if ($exitCode -ne 0) {
    $errorText = ($rawOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($errorText)) {
      throw "$FailureContext failed with exit code $exitCode."
    }
    throw "$FailureContext failed: $errorText"
  }

  $jsonText = ($rawOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  if ([string]::IsNullOrWhiteSpace($jsonText)) {
    return $null
  }

  try {
    return $jsonText | ConvertFrom-Json
  } catch {
    throw "$FailureContext returned invalid JSON."
  }
}

function Get-CourseLinkInventory {
  return Invoke-TransferPlannerNodeJsonCommand `
    -Arguments @($linkManagerScriptPath, "--inventory", "--format", "json") `
    -FailureContext "Course link inventory lookup"
}

function Get-CourseLinkPlanDetails {
  param([string]$PlanId)

  return Invoke-TransferPlannerNodeJsonCommand `
    -Arguments @($linkManagerScriptPath, "--show-plan", "--plan-id", $PlanId, "--format", "json") `
    -FailureContext "Course link details lookup"
}

function Invoke-CourseLinkManagerUpdate {
  param(
    [string[]]$Arguments,
    [string]$FailureContext
  )

  $commandArguments = @($linkManagerScriptPath) + @($Arguments)
  return Invoke-TransferPlannerNodeJsonCommand `
    -Arguments $commandArguments `
    -FailureContext $FailureContext
}

function Select-NavigableMenuItem {
  param(
    [object[]]$Items,
    [string]$Prompt,
    [scriptblock]$LabelSelector,
    [scriptblock]$DescriptionSelector = $null,
    [string]$BackLabel = "Back"
  )

  while ($true) {
    Write-Host ""
    Write-Host $Prompt -ForegroundColor Cyan

    if (-not $Items -or $Items.Count -eq 0) {
      Write-Host "No items are available right now." -ForegroundColor Yellow
      Write-Host ("B. {0}" -f $BackLabel) -ForegroundColor Yellow

      $rawChoice = Read-Host "Enter your choice"
      if ($rawChoice -match '^[Bb]$') {
        return @{
          Action = "back"
        }
      }

      Write-Host "Enter B to go back." -ForegroundColor Yellow
      continue
    }

    for ($index = 0; $index -lt $Items.Count; $index += 1) {
      $item = $Items[$index]
      $label = if ($LabelSelector) { & $LabelSelector $item } else { [string]$item }
      Write-Host ("{0}. {1}" -f ($index + 1), $label) -ForegroundColor White
      if ($DescriptionSelector) {
        $description = & $DescriptionSelector $item
        if (-not [string]::IsNullOrWhiteSpace([string]$description)) {
          Write-Host ("   {0}" -f $description) -ForegroundColor DarkGray
        }
      }
    }

    Write-Host ("B. {0}" -f $BackLabel) -ForegroundColor Yellow

    $rawChoice = Read-Host "Enter your choice"
    if ($rawChoice -match '^[Bb]$') {
      return @{
        Action = "back"
      }
    }

    $selectedIndex = 0
    if ([int]::TryParse($rawChoice, [ref]$selectedIndex) -and $selectedIndex -ge 1 -and $selectedIndex -le $Items.Count) {
      return @{
        Action = "select"
        Item = $Items[$selectedIndex - 1]
      }
    }

    Write-Host "Enter one of the listed numbers, or B for Back." -ForegroundColor Yellow
  }
}

function Read-CourseLinkEditorInput {
  param(
    [string]$Prompt,
    [switch]$AllowEmpty
  )

  while ($true) {
    $rawValue = Read-Host ("{0} [B=Back]" -f $Prompt)
    if ($rawValue -match '^[Bb]$') {
      return @{
        Action = "back"
      }
    }

    $value = [string]$rawValue
    if ($AllowEmpty -or -not [string]::IsNullOrWhiteSpace($value)) {
      return @{
        Action = "value"
        Value = $value.Trim()
      }
    }

    Write-Host "Enter a value, or use B to leave this step." -ForegroundColor Yellow
  }
}

function Read-CourseLinkEditorYesNo {
  param(
    [string]$Prompt,
    [bool]$Default = $true
  )

  while ($true) {
    $suffix = if ($Default) { "[Y=Yes, N=No, B=Back] (default: Yes)" } else { "[Y=Yes, N=No, B=Back] (default: No)" }
    $rawValue = Read-Host ("{0} {1}" -f $Prompt, $suffix)

    if ([string]::IsNullOrWhiteSpace($rawValue)) {
      return @{
        Action = "value"
        Value = $Default
      }
    }
    if ($rawValue -match '^[Bb]$') {
      return @{
        Action = "back"
      }
    }
    if ($rawValue -match '^[Yy]') {
      return @{
        Action = "value"
        Value = $true
      }
    }
    if ($rawValue -match '^[Nn]') {
      return @{
        Action = "value"
        Value = $false
      }
    }

    Write-Host "Enter Y, N, or B." -ForegroundColor Yellow
  }
}

function Show-CourseLinkPlanDetails {
  param([object]$PlanDetails)

  Write-Section ("Edit course links: {0}" -f $PlanDetails.title)
  Write-Host ("Institution: {0}" -f $PlanDetails.institutionLabel) -ForegroundColor DarkCyan
  if ($PlanDetails.groupLabel) {
    $groupCaption = if ($PlanDetails.groupKind -eq "program-group") {
      "Program group"
    } else {
      "Campus"
    }
    Write-Host ("{0}: {1}" -f $groupCaption, $PlanDetails.groupLabel) -ForegroundColor DarkCyan
  }
  Write-Host ("{0}: {1}" -f $PlanDetails.itemKindLabel, $PlanDetails.title) -ForegroundColor DarkCyan
  Write-Host ("Source owner id: {0}" -f $PlanDetails.planId) -ForegroundColor DarkCyan
  Write-Host ("Source-of-truth file: {0}" -f $PlanDetails.sourceOfTruthPath) -ForegroundColor DarkCyan
  Write-Host ""

  if (@($PlanDetails.primaryLinks).Count -gt 0) {
    Write-Host "Primary source link(s):" -ForegroundColor Cyan
    foreach ($link in $PlanDetails.primaryLinks) {
      Write-Host ("- {0}" -f $link.label) -ForegroundColor White
      Write-Host ("  {0}" -f $link.url) -ForegroundColor DarkGray
      Write-Host ("  Role: {0} | Parser: {1} | Confidence: {2} | Source: {3}" -f $link.role, $link.parserType, $link.confidence, $link.sourceKind) -ForegroundColor DarkGray
      if ($link.note) {
        Write-Host ("  Note: {0}" -f $link.note) -ForegroundColor DarkGray
      }
    }
  } else {
    Write-Host "Primary source link(s): none tracked right now." -ForegroundColor Yellow
  }

  Write-Host ""
  if (@($PlanDetails.alternateLinks).Count -gt 0) {
    Write-Host "Alternate / supplemental source link(s):" -ForegroundColor Cyan
    foreach ($link in $PlanDetails.alternateLinks) {
      Write-Host ("- {0}" -f $link.label) -ForegroundColor White
      Write-Host ("  {0}" -f $link.url) -ForegroundColor DarkGray
      Write-Host ("  Role: {0} | Parser: {1} | Confidence: {2} | Source: {3}" -f $link.role, $link.parserType, $link.confidence, $link.sourceKind) -ForegroundColor DarkGray
      if ($link.note) {
        Write-Host ("  Note: {0}" -f $link.note) -ForegroundColor DarkGray
      }
    }
  } else {
    Write-Host "Alternate / supplemental source link(s): none tracked right now." -ForegroundColor Yellow
  }

  if ($PlanDetails.manualOverride) {
    Write-Host ""
    Write-Host ("Manual override mode: {0}" -f $PlanDetails.manualOverride.mode) -ForegroundColor DarkCyan
    if ($PlanDetails.manualOverride.preferredPrimaryUrl) {
      Write-Host ("Manual preferred primary: {0}" -f $PlanDetails.manualOverride.preferredPrimaryUrl) -ForegroundColor DarkCyan
    }
    if (@($PlanDetails.manualOverride.removedUrls).Count -gt 0) {
      Write-Host ("Manual removed URLs: {0}" -f ((@($PlanDetails.manualOverride.removedUrls)) -join ", ")) -ForegroundColor DarkGray
    }
  }
}

function Invoke-CourseLinkValidation {
  param(
    [object]$PlanDetails,
    [string]$ChangedFile
  )

  Write-Section "Regenerate and validate course links"
  Write-Host ("Changed file/config: {0}" -f $ChangedFile) -ForegroundColor DarkCyan
  Write-Host ("Regeneration required: {0}" -f ($(if ($PlanDetails.regenerationRequired) { "yes" } else { "no" }))) -ForegroundColor DarkCyan
  Write-Host "Regeneration ran automatically: yes" -ForegroundColor DarkCyan
  Write-Host ("Validation command: {0}" -f $PlanDetails.automaticValidationCommand) -ForegroundColor DarkGray

  try {
    Invoke-LoggedCommand `
      -FilePath "powershell.exe" `
      -Arguments @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $refreshLauncherPath,
        "-SkipDownloads",
        "-OnlySection",
        "source-audit",
        "-NoOpenReports"
      ) `
      -Description ("Validate updated course links for {0}" -f $PlanDetails.planId)
    Write-Host "The course-link edit saved and the automatic refresh/validation run succeeded." -ForegroundColor Green
    return $true
  } catch {
    Write-Host "The course-link edit saved, but the automatic refresh/validation run failed." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    return $false
  }
}

function Select-CourseLinkEntry {
  param(
    [object]$PlanDetails,
    [string]$Prompt
  )

  return Select-NavigableMenuItem `
    -Items @($PlanDetails.currentLinks) `
    -Prompt $Prompt `
    -LabelSelector {
      param($Link)
      if ($Link.isPrimary) {
        return "[Primary] $($Link.label)"
      }
      return $Link.label
    } `
    -DescriptionSelector {
      param($Link)
      return "{0} | {1}" -f $Link.url, $Link.sourceKind
    }
}

function Invoke-CourseLinkAddFlow {
  param([object]$PlanDetails)

  $urlResponse = Read-CourseLinkEditorInput -Prompt "Enter the new official source URL"
  if ($urlResponse.Action -ne "value") {
    return $urlResponse
  }

  $labelResponse = Read-CourseLinkEditorInput -Prompt "Enter the link label"
  if ($labelResponse.Action -ne "value") {
    return $labelResponse
  }

  $noteResponse = Read-CourseLinkEditorInput -Prompt "Enter an optional note (blank is okay)" -AllowEmpty
  if ($noteResponse.Action -ne "value") {
    return $noteResponse
  }

  $primaryResponse = Read-CourseLinkEditorYesNo -Prompt "Make this the preferred primary source?" -Default $false
  if ($primaryResponse.Action -ne "value") {
    return $primaryResponse
  }

  $commandArguments = @(
      "--add-link",
      "--plan-id",
      $PlanDetails.planId,
      "--url",
      $urlResponse.Value,
      "--label",
      $labelResponse.Value,
      "--note",
      $noteResponse.Value
    )
  if ($primaryResponse.Value) {
    $commandArguments += "--make-primary"
  }

  $result = Invoke-CourseLinkManagerUpdate `
    -Arguments $commandArguments `
    -FailureContext "Adding a course link"

  Write-Host ("Changed file/config: {0}" -f $result.changedFile) -ForegroundColor DarkCyan
  Invoke-CourseLinkValidation -PlanDetails $PlanDetails -ChangedFile $result.changedFile | Out-Null
  return @{
    Action = "saved"
  }
}

function Invoke-CourseLinkReplaceFlow {
  param([object]$PlanDetails)

  $selectedLink = Select-CourseLinkEntry -PlanDetails $PlanDetails -Prompt "Choose the link to replace"
  if ($selectedLink.Action -ne "select") {
    return $selectedLink
  }

  $urlResponse = Read-CourseLinkEditorInput -Prompt "Enter the replacement URL"
  if ($urlResponse.Action -ne "value") {
    return $urlResponse
  }

  $labelResponse = Read-CourseLinkEditorInput -Prompt "Enter the replacement label"
  if ($labelResponse.Action -ne "value") {
    return $labelResponse
  }

  $noteResponse = Read-CourseLinkEditorInput -Prompt "Enter an optional replacement note (blank is okay)" -AllowEmpty
  if ($noteResponse.Action -ne "value") {
    return $noteResponse
  }

  $primaryResponse = Read-CourseLinkEditorYesNo -Prompt "Make the replacement the preferred primary source?" -Default $true
  if ($primaryResponse.Action -ne "value") {
    return $primaryResponse
  }

  $commandArguments = @(
      "--replace-link",
      "--plan-id",
      $PlanDetails.planId,
      "--old-url",
      $selectedLink.Item.url,
      "--url",
      $urlResponse.Value,
      "--label",
      $labelResponse.Value,
      "--note",
      $noteResponse.Value
    )
  if (-not $primaryResponse.Value) {
    $commandArguments += "--no-make-primary"
  }

  $result = Invoke-CourseLinkManagerUpdate `
    -Arguments $commandArguments `
    -FailureContext "Replacing a course link"

  Write-Host ("Changed file/config: {0}" -f $result.changedFile) -ForegroundColor DarkCyan
  Invoke-CourseLinkValidation -PlanDetails $PlanDetails -ChangedFile $result.changedFile | Out-Null
  return @{
    Action = "saved"
  }
}

function Invoke-CourseLinkRemoveFlow {
  param([object]$PlanDetails)

  $selectedLink = Select-CourseLinkEntry -PlanDetails $PlanDetails -Prompt "Choose the link to remove"
  if ($selectedLink.Action -ne "select") {
    return $selectedLink
  }

  $confirmResponse = Read-CourseLinkEditorYesNo -Prompt ("Remove {0}?" -f $selectedLink.Item.url) -Default $false
  if ($confirmResponse.Action -ne "value") {
    return $confirmResponse
  }
  if (-not $confirmResponse.Value) {
    return @{
      Action = "back"
    }
  }

  $result = Invoke-CourseLinkManagerUpdate `
    -Arguments @(
      "--remove-link",
      "--plan-id",
      $PlanDetails.planId,
      "--url",
      $selectedLink.Item.url
    ) `
    -FailureContext "Removing a course link"

  Write-Host ("Changed file/config: {0}" -f $result.changedFile) -ForegroundColor DarkCyan
  Invoke-CourseLinkValidation -PlanDetails $PlanDetails -ChangedFile $result.changedFile | Out-Null
  return @{
    Action = "saved"
  }
}

function Invoke-CourseLinkSetPrimaryFlow {
  param([object]$PlanDetails)

  $selectedLink = Select-CourseLinkEntry -PlanDetails $PlanDetails -Prompt "Choose the link to make primary"
  if ($selectedLink.Action -ne "select") {
    return $selectedLink
  }

  $result = Invoke-CourseLinkManagerUpdate `
    -Arguments @(
      "--set-primary",
      "--plan-id",
      $PlanDetails.planId,
      "--url",
      $selectedLink.Item.url
    ) `
    -FailureContext "Setting the preferred primary course link"

  Write-Host ("Changed file/config: {0}" -f $result.changedFile) -ForegroundColor DarkCyan
  Invoke-CourseLinkValidation -PlanDetails $PlanDetails -ChangedFile $result.changedFile | Out-Null
  return @{
    Action = "saved"
  }
}

function Invoke-CourseLinkUpdateCurrentLinksFlow {
  param([object]$PlanDetails)

  $currentLinks = @($PlanDetails.currentLinks)
  if ($currentLinks.Count -eq 0) {
    Write-Host "No tracked links are available for this item yet, so there is nothing to snapshot." -ForegroundColor Yellow
    return @{
      Action = "back"
    }
  }

  $itemLabel = ([string]$PlanDetails.itemKindLabel).ToLowerInvariant()
  $confirmResponse = Read-CourseLinkEditorYesNo `
    -Prompt ("Write the {0} currently tracked link(s) for this {1} into the override file and pin that set?" -f $currentLinks.Count, $itemLabel) `
    -Default $true
  if ($confirmResponse.Action -ne "value") {
    return $confirmResponse
  }
  if (-not $confirmResponse.Value) {
    return @{
      Action = "back"
    }
  }

  $result = Invoke-CourseLinkManagerUpdate `
    -Arguments @(
      "--update-current-links",
      "--plan-id",
      $PlanDetails.planId
    ) `
    -FailureContext "Updating this item with the current tracked course links"

  Write-Host ("Changed file/config: {0}" -f $result.changedFile) -ForegroundColor DarkCyan
  if ($result.linkCount) {
    Write-Host ("Pinned {0} current link(s) for this {1} into the override file." -f $result.linkCount, $itemLabel) -ForegroundColor DarkCyan
  }
  if ($result.preferredPrimaryUrl) {
    Write-Host ("Pinned preferred primary: {0}" -f $result.preferredPrimaryUrl) -ForegroundColor DarkCyan
  }
  Invoke-CourseLinkValidation -PlanDetails $PlanDetails -ChangedFile $result.changedFile | Out-Null
  return @{
    Action = "saved"
  }
}

function Invoke-CourseLinkEditorForPlan {
  param([string]$PlanId)

  while ($true) {
    $planDetails = Get-CourseLinkPlanDetails -PlanId $PlanId
    Show-CourseLinkPlanDetails -PlanDetails $planDetails
    $itemLabel = ([string]$planDetails.itemKindLabel).ToLowerInvariant()

    $actionChoice = Select-NavigableMenuItem `
      -Items @(
        [pscustomobject]@{ Id = "add"; Label = "Add a link"; Description = "Add a new source link to the real source-of-truth override file." },
        [pscustomobject]@{ Id = "replace"; Label = "Replace a link"; Description = "Swap one tracked link for another and remove the old URL if needed." },
        [pscustomobject]@{ Id = "remove"; Label = "Remove a link"; Description = "Remove a tracked link from this item if it should no longer be used." },
        [pscustomobject]@{ Id = "set-primary"; Label = "Set preferred primary link"; Description = "Choose which tracked link the source manifest should treat as the primary degree page." },
        [pscustomobject]@{ Id = "update-current-links"; Label = "Update this $itemLabel with current links"; Description = "Snapshot the currently tracked links into the override file and pin this $itemLabel to that set." }
      ) `
      -Prompt ("Choose an edit action for this {0}" -f ([string]$planDetails.itemKindLabel).ToLowerInvariant()) `
      -LabelSelector { param($Item) $Item.Label } `
      -DescriptionSelector { param($Item) $Item.Description }

    if ($actionChoice.Action -eq "back") {
      return @{
        Action = "back"
      }
    }

    $result = switch ($actionChoice.Item.Id) {
      "add" { Invoke-CourseLinkAddFlow -PlanDetails $planDetails }
      "replace" { Invoke-CourseLinkReplaceFlow -PlanDetails $planDetails }
      "remove" { Invoke-CourseLinkRemoveFlow -PlanDetails $planDetails }
      "set-primary" { Invoke-CourseLinkSetPrimaryFlow -PlanDetails $planDetails }
      "update-current-links" { Invoke-CourseLinkUpdateCurrentLinksFlow -PlanDetails $planDetails }
      default {
        @{
          Action = "back"
        }
      }
    }

    if ($result.Action -eq "back") {
      continue
    }
  }
}

function Invoke-CourseLinkEditor {
  while ($true) {
    $inventory = Get-CourseLinkInventory
    $institutionChoice = Select-NavigableMenuItem `
      -Items @($inventory.institutions) `
      -Prompt "Choose an institution" `
      -LabelSelector { param($Item) $Item.label } `
      -DescriptionSelector {
        param($Item)
        $groupItemCounts = @($Item.groups | ForEach-Object { @($_.items).Count })
        $itemCount = if ($groupItemCounts.Count -gt 0) { ($groupItemCounts | Measure-Object -Sum).Sum } else { 0 }
        "{0} {1}(s) | {2} item(s)" -f @($Item.groups).Count, $Item.groupPromptLabel, $itemCount
      } `
      -BackLabel "Back to the maintainer menu"
    if ($institutionChoice.Action -eq "back") {
      return @{
        Action = "back"
      }
    }

    while ($true) {
      $groupChoice = Select-NavigableMenuItem `
        -Items @($institutionChoice.Item.groups) `
        -Prompt ("Choose a {0} under {1}" -f $institutionChoice.Item.groupPromptLabel, $institutionChoice.Item.label) `
        -LabelSelector { param($Item) $Item.label } `
        -DescriptionSelector {
          param($Item)
          "{0} {1}(s)" -f @($Item.items).Count, $institutionChoice.Item.itemPromptLabel
        }
      if ($groupChoice.Action -eq "back") {
        break
      }

      while ($true) {
        $itemChoice = Select-NavigableMenuItem `
          -Items @($groupChoice.Item.items) `
          -Prompt ("Choose a {0} under {1} / {2}" -f $institutionChoice.Item.itemPromptLabel, $institutionChoice.Item.label, $groupChoice.Item.label) `
          -LabelSelector { param($Item) $Item.title } `
          -DescriptionSelector {
            param($Item)
            if ($Item.primarySourceUrl) {
              return "Primary source: {0}" -f $Item.primarySourceUrl
            }
            return "Source owner id: {0}" -f $Item.planId
          }
        if ($itemChoice.Action -eq "back") {
          break
        }

        $planResult = Invoke-CourseLinkEditorForPlan -PlanId $itemChoice.Item.planId
        if ($planResult.Action -eq "back") {
          continue
        }
      }
    }
  }
}

function Get-RefreshTargetInventory {
  $inventory = Get-CourseLinkInventory
  $uwInstitution = @(
    $inventory.institutions |
      Where-Object { $_.id -eq "university-of-washington" } |
      Select-Object -First 1
  )

  if ($uwInstitution.Count -eq 0) {
    return $null
  }

  $filteredGroups = @(
    $uwInstitution[0].groups |
      ForEach-Object {
        $generatedMajorItems = @(
          $_.items |
            Where-Object {
              $_.ownerType -eq "major" -and
              $_.isGeneratedPlan -eq $true
            }
        )
        if ($generatedMajorItems.Count -gt 0) {
          [pscustomobject]@{
            id = $_.id
            label = $_.label
            items = $generatedMajorItems
          }
        }
      } |
      Where-Object { $_ }
  )

  if ($filteredGroups.Count -eq 0) {
    return $null
  }

  return [pscustomobject]@{
    id = $uwInstitution[0].id
    label = $uwInstitution[0].label
    groupPromptLabel = $uwInstitution[0].groupPromptLabel
    itemPromptLabel = "major/pathway"
    groups = $filteredGroups
  }
}

function Select-TransferPlannerRefreshTargetPlan {
  while ($true) {
    $institution = Get-RefreshTargetInventory
    if (-not $institution) {
      Write-Host "No generated UW majors are available to target right now." -ForegroundColor Yellow
      return @{
        Action = "back"
      }
    }

    $institutionChoice = Select-NavigableMenuItem `
      -Items @($institution) `
      -Prompt "Choose an institution" `
      -LabelSelector { param($Item) $Item.label } `
      -DescriptionSelector {
        param($Item)
        $groupItemCounts = @($Item.groups | ForEach-Object { @($_.items).Count })
        $itemCount = if ($groupItemCounts.Count -gt 0) { ($groupItemCounts | Measure-Object -Sum).Sum } else { 0 }
        "{0} {1}(s) | {2} item(s)" -f @($Item.groups).Count, $Item.groupPromptLabel, $itemCount
      } `
      -BackLabel "Back to the maintainer menu"
    if ($institutionChoice.Action -eq "back") {
      return @{
        Action = "back"
      }
    }

    while ($true) {
      $groupChoice = Select-NavigableMenuItem `
        -Items @($institutionChoice.Item.groups) `
        -Prompt ("Choose a {0} under {1}" -f $institutionChoice.Item.groupPromptLabel, $institutionChoice.Item.label) `
        -LabelSelector { param($Item) $Item.label } `
        -DescriptionSelector {
          param($Item)
          "{0} {1}(s)" -f @($Item.items).Count, $institutionChoice.Item.itemPromptLabel
        }
      if ($groupChoice.Action -eq "back") {
        break
      }

      while ($true) {
        $itemChoice = Select-NavigableMenuItem `
          -Items @($groupChoice.Item.items) `
          -Prompt ("Choose a {0} under {1} / {2}" -f $institutionChoice.Item.itemPromptLabel, $institutionChoice.Item.label, $groupChoice.Item.label) `
          -LabelSelector { param($Item) $Item.title } `
          -DescriptionSelector {
            param($Item)
            if ($Item.primarySourceUrl) {
              return "Primary source: {0}" -f $Item.primarySourceUrl
            }
            return "Source owner id: {0}" -f $Item.planId
          }
        if ($itemChoice.Action -eq "back") {
          break
        }

        return @{
          Action = "select"
          Item = $itemChoice.Item
        }
      }
    }
  }
}

function Select-MaintenanceSection {
  param(
    [pscustomobject[]]$SectionCatalog,
    [string]$Prompt
  )

  return Select-NavigableMenuItem `
    -Items @($SectionCatalog) `
    -Prompt $Prompt `
    -LabelSelector { param($Section) "[{0}] {1}" -f $Section.Id, $Section.Title } `
    -DescriptionSelector { param($Section) $Section.Description } `
    -BackLabel "Back to the maintainer menu"
}

function Get-InteractiveMaintenanceSelection {
  param([pscustomobject[]]$SectionCatalog)

  while ($true) {
    Write-Host ""
    Write-Host "Choose a transfer planner update action:" -ForegroundColor Cyan
    Write-Host "1. Update everything"
    Write-Host "2. Update one major/pathway only"
    Write-Host "3. Update using one part of workflow only"
    Write-Host "4. Start from a section and continue through the rest"
    Write-Host "5. Show summary of last run + cached status"
    Write-Host "6. Back"

    switch (Read-Host "Enter 1-6") {
      "1" {
        return @{
          Mode = "full"
        }
      }
      "2" {
        $selectedTarget = Select-TransferPlannerRefreshTargetPlan
        if ($selectedTarget.Action -eq "back") {
          continue
        }
        return @{
          Mode = "full"
          TargetPlanId = $selectedTarget.Item.planId
          TargetPlanTitle = $selectedTarget.Item.title
        }
      }
      "3" {
        $selectedSection = Select-MaintenanceSection -SectionCatalog $SectionCatalog -Prompt "Select one section to run"
        if ($selectedSection.Action -eq "back") {
          continue
        }
        return @{
          Mode = "only"
          SectionId = $selectedSection.Item.Id
        }
      }
      "4" {
        $selectedSection = Select-MaintenanceSection -SectionCatalog $SectionCatalog -Prompt "Select the section to start from"
        if ($selectedSection.Action -eq "back") {
          continue
        }
        return @{
          Mode = "start"
          SectionId = $selectedSection.Item.Id
        }
      }
      "5" {
        Show-CacheSummary -SectionCatalog $SectionCatalog
      }
      "6" {
        return @{ 
          Mode = "back"
        }
      }
      default {
        Write-Host "Enter a number from 1 to 6." -ForegroundColor Yellow
      }
    }
  }
}

function Resolve-SelectedMaintenanceSectionIds {
  param(
    [pscustomobject[]]$SectionCatalog,
    [hashtable]$Selection
  )

  switch ($Selection.Mode) {
    "full" {
      return @($SectionCatalog | ForEach-Object { $_.Id })
    }
    "only" {
      if (-not (@($SectionCatalog.Id) -contains [string]$Selection.SectionId)) {
        throw "Unknown maintenance section: $($Selection.SectionId)"
      }
      return @([string]$Selection.SectionId)
    }
    "start" {
      $startIndex = [Array]::IndexOf(@($SectionCatalog.Id), [string]$Selection.SectionId)
      if ($startIndex -lt 0) {
        throw "Unknown maintenance start section: $($Selection.SectionId)"
      }
      return @($SectionCatalog[$startIndex..($SectionCatalog.Count - 1)] | ForEach-Object { $_.Id })
    }
    default {
      return @()
    }
  }
}

function Apply-MaintenanceSectionSelection {
  param(
    [pscustomobject[]]$SectionCatalog,
    [string[]]$SelectedSectionIds
  )

  $selectedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($sectionId in $SelectedSectionIds) {
    [void]$selectedSet.Add([string]$sectionId)
  }

  $selectedRefreshIds = @(
    $SectionCatalog |
      Where-Object { $_.Kind -eq "refresh" -and $selectedSet.Contains($_.Id) } |
      ForEach-Object { $_.Id }
  )

  $stepResults["Planner refresh"] = if ($selectedRefreshIds.Count -gt 0) { "pending" } else { "skipped" }
  if ($stepResults.Contains("Playwright Chromium")) {
    $stepResults["Playwright Chromium"] = if ($selectedSet.Contains("playwright-chromium")) { "pending" } else { "skipped" }
  }
  if ($stepResults.Contains("Windows QA")) {
    $stepResults["Windows QA"] = if ($selectedSet.Contains("windows-qa")) { "pending" } else { "skipped" }
  }
  $stepResults["Planner hardening checks"] = if ($selectedSet.Contains("hardening")) { "pending" } else { "skipped" }

  return @{
    SelectedRefreshIds = $selectedRefreshIds
    SelectedSectionIds = @($SelectedSectionIds)
  }
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
    [string]$Description,
    [scriptblock]$OnOutputLine = $null
  )

  Write-Section $Description
  $argumentText = if ($Arguments.Count -gt 0) { $Arguments -join " " } else { "" }
  Write-Host "$FilePath $argumentText" -ForegroundColor DarkGray

  & $FilePath @Arguments 2>&1 | ForEach-Object {
    $line = $_.ToString()
    $line | Tee-Object -FilePath $logPath -Append
    if ($OnOutputLine) {
      & $OnOutputLine $line
    }
  }
  $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } elseif ($?) { 0 } else { 1 }

  if ($exitCode -ne 0) {
    throw "$Description failed with exit code $exitCode. See log: $logPath"
  }
}

function Invoke-MaintenanceStep {
  param(
    [string]$StepLabel,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$Description,
    [string]$ProgressDetail = "",
    [string]$CompletedDetail = "",
    [int]$ExpandedStepCount = 1,
    [scriptblock]$OnOutputLine = $null
  )

  if ($stepResults[$StepLabel] -eq "skipped") {
    return
  }

  $detailText = if ($ProgressDetail) { $ProgressDetail } else { $Description }
  $completedDetailText = if ($CompletedDetail) { $CompletedDetail } else { $detailText }
  $runningStepIndex = [Math]::Min(
    [Math]::Max($script:completedTrackedMaintenanceSteps + 1, 1),
    [Math]::Max($script:totalTrackedMaintenanceSteps, 1)
  )
  $stepResults[$StepLabel] = "running"
  Write-MaintenanceProgress -CurrentOverallStepIndex $runningStepIndex -State "running" -Detail $detailText

  try {
    Invoke-LoggedCommand `
      -FilePath $FilePath `
      -Arguments $Arguments `
      -Description $Description `
      -OnOutputLine $OnOutputLine
    $stepResults[$StepLabel] = "passed"
    $effectiveExpandedStepCount = if ($StepLabel -eq "Planner refresh") {
      [Math]::Max($script:refreshTrackedStepCount, 1)
    } else {
      [Math]::Max($ExpandedStepCount, 1)
    }
    $script:completedTrackedMaintenanceSteps = [Math]::Min(
      $script:completedTrackedMaintenanceSteps + $effectiveExpandedStepCount,
      [Math]::Max($script:totalTrackedMaintenanceSteps, 1)
    )
    Write-MaintenanceProgress `
      -State "passed" `
      -Detail $completedDetailText `
      -CompletedOverallSteps $script:completedTrackedMaintenanceSteps
  } catch {
    $stepResults[$StepLabel] = "failed"
    Write-MaintenanceProgress `
      -CurrentOverallStepIndex $script:lastRunningOverallStepIndex `
      -State "failed" `
      -Detail $detailText
    throw
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
  $laymansDiagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -FailureMessage $FailureMessage `
      -LogPath $logPath `
      -TargetPlanId $script:selectedMaintenanceTargetPlanId `
      -IncludeWarnings
  )

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

  if ($laymansDiagnosisItems.Count -gt 0) {
    $summaryLines += Convert-TransferPlannerLaymansDiagnosisToMarkdownLines -Items $laymansDiagnosisItems
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
    "- Selection mode: $script:selectedMaintenanceMode",
    "- Selected sections: $($script:selectedMaintenanceSectionIds -join ', ')",
    "- Target plan id: $script:selectedMaintenanceTargetPlanId",
    "- Target plan title: $script:selectedMaintenanceTargetPlanTitle",
    "- Only section arg: $OnlySection",
    "- Start section arg: $StartSection",
    "- Target plan arg: $TargetPlanId",
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
  Write-Host "Live output streams below." -ForegroundColor DarkCyan

  if ($OnlySection -and $StartSection) {
    throw "Use either -OnlySection or -StartSection, not both."
  }

  Assert-Command -CommandName "powershell.exe" -FriendlyName "Windows PowerShell"
  Assert-Command -CommandName "node" -FriendlyName "Node.js"
  Assert-Command -CommandName "npm.cmd" -FriendlyName "npm"

  $refreshCatalogPlan = Get-RefreshTrackedPlan -SkipDownloads:$SkipDownloads -TargetPlanId $TargetPlanId
  $maintenanceSectionCatalog = @(Get-MaintenanceSectionCatalog -RefreshPlanInfo $refreshCatalogPlan)
  if ($maintenanceSectionCatalog.Count -eq 0) {
    throw "No maintenance sections are available for the current launcher settings."
  }

  if ($EditCourseLinks) {
    $editorResult = Invoke-CourseLinkEditor
    if ($editorResult.Action -eq "back") {
      Write-Host "Course link editor closed." -ForegroundColor Yellow
      exit $BackExitCode
    }
    exit 0
  }

  if ($ShowCacheSummary) {
    Show-CacheSummary -SectionCatalog $maintenanceSectionCatalog
    exit 0
  }

  if ($ShowLaymansDiagnosis) {
    Show-LaymansDiagnosis
    exit 0
  }

  $selection = if ($OnlySection) {
    @{
      Mode = "only"
      SectionId = $OnlySection
      TargetPlanId = $TargetPlanId
    }
  } elseif ($StartSection) {
    @{
      Mode = "start"
      SectionId = $StartSection
      TargetPlanId = $TargetPlanId
    }
  } elseif ($TargetPlanId) {
    @{
      Mode = "full"
      TargetPlanId = $TargetPlanId
    }
  } elseif (-not $NoPrompt) {
    Get-InteractiveMaintenanceSelection -SectionCatalog $maintenanceSectionCatalog
  } else {
    @{
      Mode = "full"
    }
  }

  if ($selection.Mode -eq "back") {
    Write-Host "Maintenance launcher closed without running a section." -ForegroundColor Yellow
    exit $BackExitCode
  }

  $selectedSectionIds = @(
    Resolve-SelectedMaintenanceSectionIds -SectionCatalog $maintenanceSectionCatalog -Selection $selection
  )
  if ($selectedSectionIds.Count -eq 0) {
    Write-Host "No maintenance sections were selected." -ForegroundColor Yellow
    exit 0
  }

  $script:selectedMaintenanceMode = [string]$selection.Mode
  $script:selectedMaintenanceSectionIds = @($selectedSectionIds)
  $script:selectedMaintenanceTargetPlanId = if ($selection.ContainsKey("TargetPlanId")) { [string]$selection.TargetPlanId } else { "" }
  $script:selectedMaintenanceTargetPlanTitle = if ($selection.ContainsKey("TargetPlanTitle")) { [string]$selection.TargetPlanTitle } else { "" }

  $selectedTargetPlanDetails = $null
  if ($script:selectedMaintenanceTargetPlanId) {
    $selectedTargetPlanDetails = Get-CourseLinkPlanDetails -PlanId $script:selectedMaintenanceTargetPlanId
    if (-not $script:selectedMaintenanceTargetPlanTitle) {
      $script:selectedMaintenanceTargetPlanTitle = [string]$selectedTargetPlanDetails.title
    }
    if ($script:selectedMaintenanceMode -eq "full") {
      $script:selectedMaintenanceMode = "target-plan"
    } else {
      $script:selectedMaintenanceMode = "{0} + target-plan" -f $script:selectedMaintenanceMode
    }
  }

  $selectionState = Apply-MaintenanceSectionSelection -SectionCatalog $maintenanceSectionCatalog -SelectedSectionIds $selectedSectionIds
  $selectionStartSection = if ($selection.ContainsKey("SectionId")) { [string]$selection.SectionId } else { "" }
  $selectionStartEntry = if ($selectionStartSection) {
    $maintenanceSectionCatalog | Where-Object { $_.Id -eq $selectionStartSection } | Select-Object -First 1
  } else {
    $null
  }

  $refreshOnlySectionArg = $null
  $refreshStartSectionArg = $null
  if ($selectionState.SelectedRefreshIds.Count -gt 0 -and $selectionStartEntry -and $selectionStartEntry.Kind -eq "refresh") {
    if ($selection.Mode -eq "only") {
      $refreshOnlySectionArg = $selectionStartEntry.Id
    } elseif ($selection.Mode -eq "start") {
      $refreshStartSectionArg = $selectionStartEntry.Id
    }
  }

  $refreshTrackedPlan = if ($selectionState.SelectedRefreshIds.Count -gt 0) {
    Get-RefreshTrackedPlan `
      -SkipDownloads:$SkipDownloads `
      -OnlySection $refreshOnlySectionArg `
      -StartSection $refreshStartSectionArg `
      -TargetPlanId $script:selectedMaintenanceTargetPlanId
  } else {
    @{
      Count = 0
      Labels = @()
      Sections = @()
      AvailableSections = $refreshCatalogPlan.AvailableSections
      SelectedSectionIds = @()
    }
  }

  Update-ExpandedMaintenancePlan -RefreshTrackedStepCount $refreshTrackedPlan.Count
  $postRefreshStepCount = @((Get-PostRefreshEnabledStepLabels)).Count
  Write-Host (
    "Selected maintenance sections: {0}" -f ($selectedSectionIds -join ", ")
  ) -ForegroundColor DarkCyan
  if ($script:selectedMaintenanceTargetPlanId) {
    Write-Host (
      "Selected target major/pathway: {0} ({1})" -f
      $script:selectedMaintenanceTargetPlanTitle,
      $script:selectedMaintenanceTargetPlanId
    ) -ForegroundColor DarkCyan
  }
  Write-Host (
    "Tracked maintenance steps: {0} total ({1} refresh pipeline + {2} post-refresh)." -f
    $script:totalTrackedMaintenanceSteps,
    $script:refreshTrackedStepCount,
    $postRefreshStepCount
  ) -ForegroundColor DarkCyan

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
  if ($refreshOnlySectionArg) {
    $refreshArgs += @("-OnlySection", $refreshOnlySectionArg)
  }
  if ($refreshStartSectionArg) {
    $refreshArgs += @("-StartSection", $refreshStartSectionArg)
  }
  if ($script:selectedMaintenanceTargetPlanId) {
    $refreshArgs += @("-TargetPlanId", $script:selectedMaintenanceTargetPlanId)
  }

  if ($selectionState.SelectedRefreshIds.Count -gt 0) {
    Invoke-MaintenanceStep `
      -StepLabel "Planner refresh" `
      -FilePath "powershell.exe" `
      -Arguments $refreshArgs `
      -Description "Run planner refresh and verification" `
      -ProgressDetail "Preparing planner refresh launcher and waiting for tracked refresh steps to begin" `
      -CompletedDetail "Refresh pipeline and verification finished" `
      -OnOutputLine {
        param([string]$Line)
        Update-RefreshMaintenanceProgressFromOutputLine -Line $Line
      }
  }

  if ($RunPostChecks) {
    if (-not $SkipWindowsQa) {
      if (-not $SkipChromiumInstall) {
        Invoke-MaintenanceStep `
          -StepLabel "Playwright Chromium" `
          -FilePath "npx.cmd" `
          -Arguments @("playwright", "install", "chromium") `
          -Description "Ensure Playwright Chromium is installed" `
          -ProgressDetail "Installing the browser dependency used by the Windows QA smoke suite"
      }

      Invoke-MaintenanceStep `
        -StepLabel "Windows QA" `
        -FilePath "npm.cmd" `
        -Arguments @("run", "qa:windows:ci") `
        -Description "Run Windows QA smoke suite" `
        -ProgressDetail "Running the Windows browser and QA smoke checks"
    }

    Invoke-MaintenanceStep `
      -StepLabel "Planner hardening checks" `
      -FilePath "node" `
      -Arguments @("scripts/planner/verify-transfer-planner-hardening.cjs") `
      -Description "Run planner hardening checks" `
      -ProgressDetail "Checking the planner for source-backed hardening regressions"
  } else {
    Write-Host "Post-refresh maintenance checks are disabled. Use -RunPostChecks to enable." -ForegroundColor DarkCyan
  }

  Write-Summary -Outcome "passed" -FailureMessage ""
  Write-MaintenanceProgress `
    -State "completed" `
    -Detail "All tracked maintenance steps finished." `
    -CompletedOverallSteps $script:totalTrackedMaintenanceSteps

  Write-Section "Maintenance complete"
  Write-Host "Success. Planner maintenance and QA finished cleanly." -ForegroundColor Green
  Write-Host "Summary: $summaryPath"
  Write-Host "Log: $logPath"
  $successDiagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -LogPath $logPath `
      -TargetPlanId $script:selectedMaintenanceTargetPlanId `
      -IncludeWarnings
  )
  Write-TransferPlannerLaymansDiagnosis -Items $successDiagnosisItems -Header "Laymans Diagnosis"

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
  $failureDiagnosisItems = @(
    Get-TransferPlannerLaymansDiagnosis `
      -ProjectRoot $projectRoot `
      -FailureMessage $message `
      -LogPath $logPath `
      -TargetPlanId $script:selectedMaintenanceTargetPlanId `
      -IncludeWarnings
  )
  Write-TransferPlannerLaymansDiagnosis -Items $failureDiagnosisItems -Header "Laymans Diagnosis"

  if (-not $NoOpenSummary -and (Test-Path $summaryPath)) {
    Start-Process $summaryPath | Out-Null
  }

  exit 1
}
