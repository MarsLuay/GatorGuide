param(
  [switch]$SkipDownloads,
  [switch]$SkipWindowsQa,
  [switch]$SkipChromiumInstall,
  [switch]$NoOpenSummary,
  [string]$OnlySection,
  [string]$StartSection,
  [switch]$ShowCacheSummary,
  [switch]$NoPrompt
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
$refreshPipelineScriptPath = Join-Path $projectRoot "scripts\planner\refresh-transfer-planner-sources.cjs"
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
    [string]$StartSection
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

  return @(
    $Paths |
      Where-Object { $_ -and (Test-Path $_) } |
      ForEach-Object { Get-Item $_ } |
      Sort-Object LastWriteTime -Descending
  )[0]
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
    LatestItem = $existingItems[0]
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

  $summaryLines = Get-Content -Path $summaryPath -ErrorAction SilentlyContinue
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
}

function Select-MaintenanceSection {
  param(
    [pscustomobject[]]$SectionCatalog,
    [string]$Prompt
  )

  while ($true) {
    Write-Host ""
    Write-Host $Prompt -ForegroundColor Cyan
    for ($index = 0; $index -lt $SectionCatalog.Count; $index += 1) {
      $section = $SectionCatalog[$index]
      Write-Host ("{0}. [{1}] {2}" -f ($index + 1), $section.Id, $section.Title)
      Write-Host ("   {0}" -f $section.Description) -ForegroundColor DarkGray
    }

    $rawChoice = Read-Host "Enter the section number"
    $selectedIndex = 0
    if ([int]::TryParse($rawChoice, [ref]$selectedIndex) -and $selectedIndex -ge 1 -and $selectedIndex -le $SectionCatalog.Count) {
      return $SectionCatalog[$selectedIndex - 1]
    }

    Write-Host "Enter one of the listed section numbers." -ForegroundColor Yellow
  }
}

function Get-InteractiveMaintenanceSelection {
  param([pscustomobject[]]$SectionCatalog)

  while ($true) {
    Write-Host ""
    Write-Host "Choose a transfer planner maintenance action:" -ForegroundColor Cyan
    Write-Host "1. Run the full maintenance flow"
    Write-Host "2. Run one section only"
    Write-Host "3. Start from a section and continue through the rest"
    Write-Host "4. Show cached status and last run summary"
    Write-Host "5. Exit"

    switch (Read-Host "Enter 1-5") {
      "1" {
        return @{
          Mode = "full"
        }
      }
      "2" {
        $selectedSection = Select-MaintenanceSection -SectionCatalog $SectionCatalog -Prompt "Select one section to run"
        return @{
          Mode = "only"
          SectionId = $selectedSection.Id
        }
      }
      "3" {
        $selectedSection = Select-MaintenanceSection -SectionCatalog $SectionCatalog -Prompt "Select the section to start from"
        return @{
          Mode = "start"
          SectionId = $selectedSection.Id
        }
      }
      "4" {
        Show-CacheSummary -SectionCatalog $SectionCatalog
      }
      "5" {
        return @{
          Mode = "exit"
        }
      }
      default {
        Write-Host "Enter a number from 1 to 5." -ForegroundColor Yellow
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
    "- Selection mode: $script:selectedMaintenanceMode",
    "- Selected sections: $($script:selectedMaintenanceSectionIds -join ', ')",
    "- Only section arg: $OnlySection",
    "- Start section arg: $StartSection",
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
  Write-Host "Progress bar tracks refresh pipeline steps plus the remaining maintenance checks while live output streams below." -ForegroundColor DarkCyan

  if ($OnlySection -and $StartSection) {
    throw "Use either -OnlySection or -StartSection, not both."
  }

  Assert-Command -CommandName "powershell.exe" -FriendlyName "Windows PowerShell"
  Assert-Command -CommandName "node" -FriendlyName "Node.js"
  Assert-Command -CommandName "npm.cmd" -FriendlyName "npm"

  $refreshCatalogPlan = Get-RefreshTrackedPlan -SkipDownloads:$SkipDownloads
  $maintenanceSectionCatalog = @(Get-MaintenanceSectionCatalog -RefreshPlanInfo $refreshCatalogPlan)
  if ($maintenanceSectionCatalog.Count -eq 0) {
    throw "No maintenance sections are available for the current launcher settings."
  }

  if ($ShowCacheSummary) {
    Show-CacheSummary -SectionCatalog $maintenanceSectionCatalog
    exit 0
  }

  $selection = if ($OnlySection) {
    @{
      Mode = "only"
      SectionId = $OnlySection
    }
  } elseif ($StartSection) {
    @{
      Mode = "start"
      SectionId = $StartSection
    }
  } elseif (-not $NoPrompt) {
    Get-InteractiveMaintenanceSelection -SectionCatalog $maintenanceSectionCatalog
  } else {
    @{
      Mode = "full"
    }
  }

  if ($selection.Mode -eq "exit") {
    Write-Host "Maintenance launcher closed without running a section." -ForegroundColor Yellow
    exit 0
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
      -StartSection $refreshStartSectionArg
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

  Write-Summary -Outcome "passed" -FailureMessage ""
  Write-MaintenanceProgress `
    -State "completed" `
    -Detail "All tracked maintenance steps finished." `
    -CompletedOverallSteps $script:totalTrackedMaintenanceSteps
  Write-Progress -Activity "Transfer Planner Maintenance" -Completed

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
  Write-Progress -Activity "Transfer Planner Maintenance" -Completed

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
