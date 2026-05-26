function Initialize-GatorGuideTmpLayout {
  param([Parameter(Mandatory = $true)][string]$ProjectRoot)

  $root = Join-Path $ProjectRoot ".tmp"
  $layout = [ordered]@{
    root = $root
    reports = Join-Path $root "reports"
    snapshots = Join-Path $root "snapshots"
    error_logs = Join-Path $root "error_logs"
    logs = Join-Path $root "logs"
    exports = Join-Path $root "exports"
    cache = Join-Path $root "cache"
    downloads = Join-Path $root "downloads"
    screenshots = Join-Path $root "screenshots"
    scratch = Join-Path $root "scratch"
    qa = Join-Path $root "qa"
    builds = Join-Path $root "builds"
  }

  foreach ($path in $layout.Values) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }

  return $layout
}

function Get-GatorGuideTmpCategory {
  param([Parameter(Mandatory = $true)][string]$Name)

  $normalized = ([string]$Name).Replace("\", "/").Split("/")[0].ToLowerInvariant()
  $extension = [System.IO.Path]::GetExtension($normalized)

  if (@("reports", "snapshots", "error_logs", "logs", "exports", "cache", "downloads", "screenshots", "scratch", "qa", "builds") -contains $normalized) {
    return $normalized
  }

  if ($normalized.Contains("error") -or $normalized.EndsWith(".err") -or $normalized.EndsWith(".err.log")) {
    return "error_logs"
  }
  if ($normalized.Contains("log") -or $normalized.EndsWith(".out") -or $normalized.EndsWith(".out.log")) {
    return "logs"
  }
  if ($normalized.Contains("screenshot") -or $normalized.Contains("screen-shot") -or @(".png", ".jpg", ".jpeg", ".webp", ".gif") -contains $extension) {
    return "screenshots"
  }
  if ($normalized.Contains("snapshot")) {
    return "snapshots"
  }
  if ($normalized.Contains("download") -or $normalized.Contains("annual-schedule") -or @(".pdf", ".docx", ".zip") -contains $extension) {
    return "downloads"
  }
  if ($normalized.Contains("export") -or $normalized.Contains("fact-check") -or @(".csv", ".xlsx") -contains $extension) {
    return "exports"
  }
  if ($normalized.Contains("cache")) {
    return "cache"
  }
  if ($normalized.Contains("qa")) {
    return "qa"
  }
  if ($normalized.Contains("build") -or $normalized.Contains("dist") -or $normalized.Contains("bundle")) {
    return "builds"
  }
  if ($normalized.Contains("report") -or $normalized.Contains("audit") -or $normalized.Contains("summary") -or $normalized.Contains("diagnosis") -or $normalized.Contains("status") -or $normalized.Contains("validation") -or $normalized.Contains("coverage") -or $normalized.Contains("planner") -or $normalized.Contains("deadline") -or $normalized.Contains("catalog") -or @(".json", ".md", ".html", ".txt") -contains $extension) {
    return "reports"
  }

  return "scratch"
}

function Get-GatorGuideTmpPath {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Layout,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $category = Get-GatorGuideTmpCategory -Name $Name
  return Join-Path $Layout[$category] $Name
}

function Resolve-GatorGuideTmpPath {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Layout,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $categorizedPath = Get-GatorGuideTmpPath -Layout $Layout -Name $Name
  if (Test-Path $categorizedPath) {
    return $categorizedPath
  }

  $legacyPath = Join-Path $Layout.root $Name
  if (Test-Path $legacyPath) {
    return $legacyPath
  }

  return $categorizedPath
}
