$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$entries = @(Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UserAgent 'SetupLauncher/1.0')
$lts = $entries | Where-Object { $_.lts -ne $false -and $_.lts } | Select-Object -First 1
if (-not $lts) {
  exit 1
}
Write-Output $lts.version
