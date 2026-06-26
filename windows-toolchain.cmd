@echo off
REM Shared Windows toolchain bootstrap for GatorGuide launchers.
REM Usage: call "%~dp0windows-toolchain.cmd" :entry_point [args...]
if "%~1"=="" exit /b 1
goto %~1

:bootstrap
call :bootstrap_windows_path
call :resolve_powershell
exit /b 0

:refresh_tool_paths
call :refresh_path
call :bootstrap_windows_path
call :add_known_tool_paths
exit /b 0

:ensure_git
call :refresh_tool_paths
call :tool_available git
if not errorlevel 1 (
  echo Git is already installed.
  exit /b 0
)
call :install_git
if errorlevel 1 exit /b 1
call :refresh_tool_paths
call :tool_available git
if errorlevel 1 (
  echo Git was installed, but this terminal cannot find it yet.
  echo Close this window and run the launcher again.
  exit /b 1
)
echo Git finished installing successfully.
exit /b 0

:ensure_node
call :refresh_tool_paths
call :tool_available node
if not errorlevel 1 (
  call :tool_available npm
  if not errorlevel 1 (
    call :tool_available npx
    if not errorlevel 1 (
      echo Node.js is already installed.
      exit /b 0
    )
  )
)
call :install_node
if errorlevel 1 exit /b 1
call :refresh_tool_paths
call :tool_available node
if errorlevel 1 (
  echo Node.js was installed, but this terminal cannot find it yet.
  echo Close this window and run the launcher again.
  exit /b 1
)
call :tool_available npm
if errorlevel 1 (
  echo npm is still unavailable after installing Node.js.
  echo Close this window and run the launcher again.
  exit /b 1
)
call :tool_available npx
if errorlevel 1 (
  echo npx is still unavailable after installing Node.js.
  echo Close this window and run the launcher again.
  exit /b 1
)
echo Node.js finished installing successfully.
exit /b 0

:run_powershell
shift
if not defined POWERSHELL_EXE call :resolve_powershell
if not defined POWERSHELL_EXE (
  echo PowerShell is required but was not found on this machine.
  exit /b 1
)
"%POWERSHELL_EXE%" %*
exit /b %ERRORLEVEL%

:install_git
echo Git was not found. Trying to install it automatically...
where winget >nul 2>nul
if not errorlevel 1 (
  echo Trying winget...
  winget install --id "Git.Git" --exact --accept-package-agreements --accept-source-agreements --silent
  if not errorlevel 1 exit /b 0
  echo winget install failed.
)
where choco >nul 2>nul
if not errorlevel 1 (
  echo Trying Chocolatey...
  choco install git -y --no-progress
  if not errorlevel 1 exit /b 0
  echo Chocolatey install failed.
)
where scoop >nul 2>nul
if not errorlevel 1 (
  echo Trying Scoop...
  scoop install git
  if not errorlevel 1 exit /b 0
  echo Scoop install failed.
)
echo Downloading Git for Windows installer from the official source...
call :run_powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $release=Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'; $asset=$release.assets | Where-Object { $_.name -match '64-bit\.exe$' -and $_.name -notmatch 'Portable' } | Select-Object -First 1; if (-not $asset) { throw 'Could not find a Git for Windows installer.' }; $installer=Join-Path $env:TEMP $asset.name; Write-Host ('Downloading ' + $asset.browser_download_url); Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer -UseBasicParsing; $proc=Start-Process -FilePath $installer -ArgumentList '/VERYSILENT','/NORESTART','/NOCANCEL','/SP-' -Wait -PassThru; if ($proc.ExitCode -ne 0) { exit 1 }"
if errorlevel 1 call :install_git_with_curl
exit /b %ERRORLEVEL%

:install_node
echo Node.js or npm was not found. Trying to install Node.js LTS automatically...
where winget >nul 2>nul
if not errorlevel 1 (
  echo Trying winget...
  winget install --id "OpenJS.NodeJS.LTS" --exact --accept-package-agreements --accept-source-agreements --silent
  if not errorlevel 1 exit /b 0
  echo winget install failed.
)
where choco >nul 2>nul
if not errorlevel 1 (
  echo Trying Chocolatey...
  choco install nodejs-lts -y --no-progress
  if not errorlevel 1 exit /b 0
  echo Chocolatey install failed.
)
where scoop >nul 2>nul
if not errorlevel 1 (
  echo Trying Scoop...
  scoop install nodejs-lts
  if not errorlevel 1 exit /b 0
  echo Scoop install failed.
)
echo Downloading Node.js LTS installer from nodejs.org...
call :install_node_direct
exit /b %ERRORLEVEL%

:install_node_direct
call :bootstrap_windows_path
set "TOOLCHAIN_DIR=%~dp0"
if "%TOOLCHAIN_DIR:~-1%"=="\" set "TOOLCHAIN_DIR=%TOOLCHAIN_DIR:~0,-1%"
if not defined POWERSHELL_EXE call :resolve_powershell
call :ensure_node_ps1_scripts

where curl >nul 2>nul
if not errorlevel 1 (
  call :resolve_node_lts_version
  if defined NODE_VERSION (
    set "NODE_MSI=%TEMP%\node-!NODE_VERSION!-x64.msi"
    echo Downloading Node.js !NODE_VERSION! with curl...
    curl -fsSL -H "User-Agent: SetupLauncher/1.0" -o "!NODE_MSI!" "https://nodejs.org/dist/!NODE_VERSION!/node-!NODE_VERSION!-x64.msi"
    if not errorlevel 1 if exist "!NODE_MSI!" (
      msiexec /i "!NODE_MSI!" /quiet /norestart
      if errorlevel 3010 exit /b 0
      if not errorlevel 1 exit /b 0
    )
  )
)

if not defined POWERSHELL_EXE (
  echo PowerShell is required to install Node.js on this machine.
  exit /b 1
)

"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "!NODE_INSTALL_PS1!"
exit /b %ERRORLEVEL%

:resolve_node_lts_version
set "NODE_VERSION="
if not defined POWERSHELL_EXE exit /b 1
if not defined NODE_RESOLVE_PS1 call :ensure_node_ps1_scripts
for /f "delims=" %%V in ('"%POWERSHELL_EXE%" -NoProfile -ExecutionPolicy Bypass -File "!NODE_RESOLVE_PS1!"') do set "NODE_VERSION=%%V"
exit /b 0

:ensure_node_ps1_scripts
if not defined NODE_SIDECAR_DIR (
  if defined LAUNCHER_DIR set "NODE_SIDECAR_DIR=!LAUNCHER_DIR!"
  if defined TOOLCHAIN_DIR set "NODE_SIDECAR_DIR=!TOOLCHAIN_DIR!"
)
if exist "!NODE_SIDECAR_DIR!\install-node-lts.ps1" if exist "!NODE_SIDECAR_DIR!\resolve-node-lts.ps1" (
  set "NODE_INSTALL_PS1=!NODE_SIDECAR_DIR!\install-node-lts.ps1"
  set "NODE_RESOLVE_PS1=!NODE_SIDECAR_DIR!\resolve-node-lts.ps1"
  exit /b 0
)
set "NODE_SCRIPT_DIR=%TEMP%\setup-launcher-node"
if not exist "!NODE_SCRIPT_DIR!" mkdir "!NODE_SCRIPT_DIR!"
set "NODE_INSTALL_PS1=!NODE_SCRIPT_DIR!\install-node-lts.ps1"
set "NODE_RESOLVE_PS1=!NODE_SCRIPT_DIR!\resolve-node-lts.ps1"
call :write_embedded_node_install_ps1 "!NODE_INSTALL_PS1!"
call :write_embedded_node_resolve_ps1 "!NODE_RESOLVE_PS1!"
exit /b 0

:write_embedded_node_install_ps1
if not defined POWERSHELL_EXE call :resolve_powershell
"%POWERSHELL_EXE%" -NoProfile -Command "$b='JEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICdTdG9wJwpbTmV0LlNlcnZpY2VQb2ludE1hbmFnZXJdOjpTZWN1cml0eVByb3RvY29sID0gW05ldC5TZWN1cml0eVByb3RvY29sVHlwZV06OlRsczEyCiR1c2VyQWdlbnQgPSAnTW96aWxsYS81LjAgKGNvbXBhdGlibGU7IFNldHVwTGF1bmNoZXIvMS4wKScKCiRlbnRyaWVzID0gQChJbnZva2UtUmVzdE1ldGhvZCAtVXJpICdodHRwczovL25vZGVqcy5vcmcvZGlzdC9pbmRleC5qc29uJyAtVXNlckFnZW50ICR1c2VyQWdlbnQpCiRsdHMgPSAkZW50cmllcyB8IFdoZXJlLU9iamVjdCB7ICRfLmx0cyAtbmUgJGZhbHNlIC1hbmQgJF8ubHRzIH0gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxCmlmICgtbm90ICRsdHMpIHsKICB0aHJvdyAnQ291bGQgbm90IHJlc29sdmUgTm9kZS5qcyBMVFMgdmVyc2lvbi4nCn0KCiR2ZXJzaW9uID0gJGx0cy52ZXJzaW9uCiRtc2lOYW1lID0gIm5vZGUtJHZlcnNpb24teDY0Lm1zaSIKJHVybCA9ICJodHRwczovL25vZGVqcy5vcmcvZGlzdC8kdmVyc2lvbi8kbXNpTmFtZSIKJGluc3RhbGxlciA9IEpvaW4tUGF0aCAkZW52OlRFTVAgJG1zaU5hbWUKCldyaXRlLUhvc3QgIkRvd25sb2FkaW5nICR1cmwiCkludm9rZS1XZWJSZXF1ZXN0IC1VcmkgJHVybCAtT3V0RmlsZSAkaW5zdGFsbGVyIC1Vc2VCYXNpY1BhcnNpbmcgLVVzZXJBZ2VudCAkdXNlckFnZW50CgokcHJvYyA9IFN0YXJ0LVByb2Nlc3MgLUZpbGVQYXRoICdtc2lleGVjLmV4ZScgLUFyZ3VtZW50TGlzdCBAKCcvaScsICRpbnN0YWxsZXIsICcvcXVpZXQnLCAnL25vcmVzdGFydCcpIC1XYWl0IC1QYXNzVGhydQppZiAoJHByb2MuRXhpdENvZGUgLW5lIDAgLWFuZCAkcHJvYy5FeGl0Q29kZSAtbmUgMzAxMCkgewogIGV4aXQgMQp9Cg=='; [IO.File]::WriteAllText('%~1', [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)))"
exit /b 0

:write_embedded_node_resolve_ps1
if not defined POWERSHELL_EXE call :resolve_powershell
"%POWERSHELL_EXE%" -NoProfile -Command "$b='JEVycm9yQWN0aW9uUHJlZmVyZW5jZSA9ICdTdG9wJwpbTmV0LlNlcnZpY2VQb2ludE1hbmFnZXJdOjpTZWN1cml0eVByb3RvY29sID0gW05ldC5TZWN1cml0eVByb3RvY29sVHlwZV06OlRsczEyCiRlbnRyaWVzID0gQChJbnZva2UtUmVzdE1ldGhvZCAtVXJpICdodHRwczovL25vZGVqcy5vcmcvZGlzdC9pbmRleC5qc29uJyAtVXNlckFnZW50ICdTZXR1cExhdW5jaGVyLzEuMCcpCiRsdHMgPSAkZW50cmllcyB8IFdoZXJlLU9iamVjdCB7ICRfLmx0cyAtbmUgJGZhbHNlIC1hbmQgJF8ubHRzIH0gfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxCmlmICgtbm90ICRsdHMpIHsKICBleGl0IDEKfQpXcml0ZS1PdXRwdXQgJGx0cy52ZXJzaW9uCg=='; [IO.File]::WriteAllText('%~1', [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)))"
exit /b 0

:add_known_tool_paths
for %%P in (
  "%ProgramFiles%\Git\cmd"
  "%ProgramFiles%\Git\bin"
  "%ProgramFiles(x86)%\Git\cmd"
  "%ProgramFiles%\nodejs"
  "%ProgramData%\chocolatey\bin"
  "%LocalAppData%\Programs\Git\cmd"
  "%LocalAppData%\Programs\Git\bin"
  "%LocalAppData%\Programs\nodejs"
  "%USERPROFILE%\scoop\shims"
  "%USERPROFILE%\scoop\apps\git\current\cmd"
  "%USERPROFILE%\scoop\apps\git\current\bin"
) do (
  if exist "%%~P" (
    set "PATH=%%~P;!PATH!"
  )
)
exit /b 0

:tool_available
set "TOOL_NAME=%~1"
where "%TOOL_NAME%" >nul 2>nul
if not errorlevel 1 exit /b 0
if /i "%TOOL_NAME%"=="git" (
  if exist "%ProgramFiles%\Git\cmd\git.exe" exit /b 0
  if exist "%ProgramFiles%\Git\bin\git.exe" exit /b 0
  if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" exit /b 0
  if exist "%LocalAppData%\Programs\Git\cmd\git.exe" exit /b 0
  if exist "%LocalAppData%\Programs\Git\bin\git.exe" exit /b 0
)
if /i "%TOOL_NAME%"=="node" (
  if exist "%ProgramFiles%\nodejs\node.exe" exit /b 0
  if exist "%LocalAppData%\Programs\nodejs\node.exe" exit /b 0
)
if /i "%TOOL_NAME%"=="npm" (
  if exist "%ProgramFiles%\nodejs\npm.cmd" exit /b 0
  if exist "%LocalAppData%\Programs\nodejs\npm.cmd" exit /b 0
)
if /i "%TOOL_NAME%"=="npx" (
  if exist "%ProgramFiles%\nodejs\npx.cmd" exit /b 0
  if exist "%LocalAppData%\Programs\nodejs\npx.cmd" exit /b 0
)
exit /b 1

:bootstrap_windows_path
if exist "%SystemRoot%\System32\" (
  set "PATH=%SystemRoot%\System32;%SystemRoot%\System32\WindowsPowerShell\v1.0;%PATH%"
)
if exist "%SystemRoot%\SysWOW64\" (
  set "PATH=%SystemRoot%\SysWOW64;%PATH%"
)
exit /b 0

:resolve_powershell
set "POWERSHELL_EXE="
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
  exit /b 0
)
if exist "%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" (
  set "POWERSHELL_EXE=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
  exit /b 0
)
where powershell >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%P in ('where powershell 2^>nul') do (
    set "POWERSHELL_EXE=%%P"
    exit /b 0
  )
)
exit /b 0

:install_git_with_curl
where curl >nul 2>nul
if errorlevel 1 (
  echo curl is required for direct downloads but was not found.
  exit /b 1
)
set "GIT_RELEASE_JSON=%TEMP%\git-release.json"
echo Resolving latest Git for Windows download with curl...
curl -fsSL -H "User-Agent: GatorGuide" "https://api.github.com/repos/git-for-windows/git/releases/latest" -o "!GIT_RELEASE_JSON!"
if errorlevel 1 exit /b 1
set "GIT_URL="
for /f "usebackq tokens=1,* delims=:" %%A in (`findstr /C:"browser_download_url" "!GIT_RELEASE_JSON!" ^| findstr /C:"64-bit.exe" ^| findstr /V /C:"Portable"`) do (
  set "GIT_URL=%%B"
)
if not defined GIT_URL exit /b 1
set "GIT_URL=!GIT_URL: =!"
set "GIT_URL=!GIT_URL:"=!"
set "GIT_URL=!GIT_URL:,=!"
set "GIT_INSTALLER=%TEMP%\Git-64-bit-installer.exe"
echo Downloading Git for Windows from !GIT_URL!
curl -fsSL -L -o "!GIT_INSTALLER!" "!GIT_URL!"
if errorlevel 1 exit /b 1
if not exist "!GIT_INSTALLER!" exit /b 1
"!GIT_INSTALLER!" /VERYSILENT /NORESTART /NOCANCEL /SP-
if errorlevel 1 exit /b 1
exit /b 0

:refresh_path
set "MACHINE_PATH="
set "USER_PATH="
for /f "usebackq tokens=2,*" %%A in (`reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| find /i "Path"`) do set "MACHINE_PATH=%%B"
for /f "usebackq tokens=2,*" %%A in (`reg query "HKCU\Environment" /v Path 2^>nul ^| find /i "Path"`) do set "USER_PATH=%%B"
if defined MACHINE_PATH set "PATH=!MACHINE_PATH!"
if defined USER_PATH (
  if defined PATH (
    set "PATH=!PATH!;!USER_PATH!"
  ) else (
    set "PATH=!USER_PATH!"
  )
)
exit /b 0
