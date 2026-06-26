$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$userAgent = 'Mozilla/5.0 (compatible; SetupLauncher/1.0)'

$entries = @(Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UserAgent $userAgent)
$lts = $entries | Where-Object { $_.lts -ne $false -and $_.lts } | Select-Object -First 1
if (-not $lts) {
  throw 'Could not resolve Node.js LTS version.'
}

$version = $lts.version
$msiName = "node-$version-x64.msi"
$url = "https://nodejs.org/dist/$version/$msiName"
$installer = Join-Path $env:TEMP $msiName

Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing -UserAgent $userAgent

$proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $installer, '/quiet', '/norestart') -Wait -PassThru
if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
  exit 1
}
