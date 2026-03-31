@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%Mobile Team"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "SERVER_PORT=8081"
set "SERVER_URL=http://127.0.0.1:%SERVER_PORT%"
set "SERVER_WINDOW_TITLE=Gator Guide Server"

echo Preparing Gator Guide for launch...
call :locate_or_clone_repo
if errorlevel 1 exit /b 1

call :ensure_node_toolchain
if errorlevel 1 exit /b 1

call :ensure_env_file
if errorlevel 1 exit /b 1

call :ensure_app_dependencies
if errorlevel 1 exit /b 1

echo Starting Expo with tunnel^>lan^>offline fallback...
start "%SERVER_WINDOW_TITLE%" cmd /k "cd /d ""%APP_DIR%"" && set EXPO_START_PORT=%SERVER_PORT% && call npm run start"
if errorlevel 1 (
  echo Failed to start the Expo server window.
  exit /b 1
)

echo Waiting for the server to come online...
call :wait_for_server "%SERVER_PORT%" 120
if errorlevel 1 (
  echo The server did not finish launching within 120 seconds.
  echo Check the "%SERVER_WINDOW_TITLE%" window for details.
  exit /b 1
)

echo Server is live at %SERVER_URL%
echo Warming up the Expo web preview before opening your browser...
call :wait_for_browser_preview "%SERVER_URL%" 180
if errorlevel 1 (
  echo The web preview did not finish warming in time. Opening the browser anyway...
) else (
  echo Web preview is ready.
)

start "" "%SERVER_URL%" >nul 2>&1
if errorlevel 1 (
  echo The browser did not open automatically.
  echo Open this URL manually: %SERVER_URL%
  exit /b 0
)

echo Your default browser should open in a moment.
exit /b 0

:locate_or_clone_repo
if exist "%APP_DIR%\package.json" (
  echo Found Gator Guide in "%ROOT_DIR%".
  exit /b 0
)

set "CLONE_ROOT=%ROOT_DIR%%REPO_DIR_NAME%"
if exist "%CLONE_ROOT%\Mobile Team\package.json" (
  set "ROOT_DIR=%CLONE_ROOT%\"
  set "APP_DIR=%ROOT_DIR%Mobile Team"
  echo Found Gator Guide in "%ROOT_DIR%".
  exit /b 0
)

echo Gator Guide was not found next to this launcher.
call :ensure_git
if errorlevel 1 exit /b 1

echo Cloning Gator Guide into "%CLONE_ROOT%"...
git clone "%REPO_URL%" "%CLONE_ROOT%"
if errorlevel 1 (
  echo Could not clone the repo from %REPO_URL%.
  exit /b 1
)

set "ROOT_DIR=%CLONE_ROOT%\"
set "APP_DIR=%ROOT_DIR%Mobile Team"
if not exist "%APP_DIR%\package.json" (
  echo The repo finished cloning, but "%APP_DIR%\package.json" is still missing.
  exit /b 1
)

echo Repo cloned successfully.
exit /b 0

:ensure_git
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
where git >nul 2>&1
if not errorlevel 1 (
  echo Git is already installed.
  exit /b 0
)

where winget >nul 2>&1
if errorlevel 1 (
  echo Git is missing and winget is not available on this PC.
  echo Install Git from https://git-scm.com/downloads and run this file again.
  exit /b 1
)

echo Git was not found. Installing Git with winget...
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Git installation failed.
  exit /b 1
)

set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"
where git >nul 2>&1
if errorlevel 1 (
  echo Git was installed, but this terminal cannot find it yet.
  echo Close this window and run Start-to-run.bat again.
  exit /b 1
)

echo Git finished installing successfully.
exit /b 0

:ensure_node_toolchain
set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 goto install_node
where npm >nul 2>&1
if errorlevel 1 goto install_node
where npx >nul 2>&1
if errorlevel 1 goto install_node
echo Node.js is already installed.
exit /b 0

:install_node
where winget >nul 2>&1
if errorlevel 1 (
  echo Node.js is missing and winget is not available on this PC.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  exit /b 1
)

echo Node.js was not found. Installing Node.js LTS with winget...
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo Node.js installation failed.
  exit /b 1
)

set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was installed, but this terminal cannot find it yet.
  echo Close this window and run Start-to-run.bat again.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm is still unavailable after installing Node.js.
  echo Close this window and run Start-to-run.bat again.
  exit /b 1
)

where npx >nul 2>&1
if errorlevel 1 (
  echo npx is still unavailable after installing Node.js.
  echo Close this window and run Start-to-run.bat again.
  exit /b 1
)

echo Node.js finished installing successfully.
exit /b 0

:ensure_env_file
if exist "%APP_DIR%\.env" (
  echo Existing .env found. Skipping env setup.
  exit /b 0
)

if not exist "%APP_DIR%\env.example" (
  exit /b 0
)

copy /y "%APP_DIR%\env.example" "%APP_DIR%\.env" >nul
if errorlevel 1 (
  echo Could not create "%APP_DIR%\.env".
  exit /b 1
)

echo Created Mobile Team\.env from env.example.
exit /b 0

:ensure_app_dependencies
if exist "%APP_DIR%\node_modules" (
  echo Checking app dependencies...
  pushd "%APP_DIR%" >nul
  call npm ls --depth=0 >nul 2>&1
  set "NPM_LS_EXIT=!ERRORLEVEL!"
  popd >nul

  if "!NPM_LS_EXIT!"=="0" (
    echo App dependencies are already installed.
    exit /b 0
  )

  echo App dependencies are incomplete. Reinstalling...
)

echo Installing app dependencies. This may take a few minutes...
pushd "%APP_DIR%" >nul
call npm ci
set "NPM_EXIT=!ERRORLEVEL!"
if not "!NPM_EXIT!"=="0" (
  echo npm ci failed, trying npm install instead...
  call npm install
  set "NPM_EXIT=!ERRORLEVEL!"
)
popd >nul

if not "!NPM_EXIT!"=="0" (
  echo Installing app dependencies failed.
  exit /b 1
)

echo App dependencies installed successfully.
exit /b 0

:wait_for_server
set "WAIT_PORT=%~1"
set "MAX_WAIT_SECONDS=%~2"
if "%MAX_WAIT_SECONDS%"=="" set "MAX_WAIT_SECONDS=120"

for /l %%I in (1,1,%MAX_WAIT_SECONDS%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$client = New-Object Net.Sockets.TcpClient; try { $iar = $client.BeginConnect('127.0.0.1', %WAIT_PORT%, $null, $null); if (-not $iar.AsyncWaitHandle.WaitOne(1000, $false)) { exit 1 }; $client.EndConnect($iar); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
  if not errorlevel 1 exit /b 0
  >nul timeout /t 1 /nobreak
)

exit /b 1

:wait_for_browser_preview
set "PREVIEW_URL=%~1"
set "PREVIEW_WAIT_SECONDS=%~2"
if "%PREVIEW_WAIT_SECONDS%"=="" set "PREVIEW_WAIT_SECONDS=180"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = '%PREVIEW_URL%';" ^
  "$timeoutSeconds = [int]'%PREVIEW_WAIT_SECONDS%';" ^
  "$deadline = (Get-Date).AddSeconds($timeoutSeconds);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  try {" ^
  "    $rootResponse = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 120;" ^
  "    if ($rootResponse.StatusCode -lt 200 -or $rootResponse.StatusCode -ge 400) { throw 'Root page did not return a success status.' }" ^
  "    $rootContent = [string]$rootResponse.Content;" ^
  "    $bundleMatch = [regex]::Match($rootContent, '<script src=""([^""]*entry\.bundle[^""]*)""');" ^
  "    if (-not $bundleMatch.Success) { exit 0 }" ^
  "    $bundlePath = $bundleMatch.Groups[1].Value;" ^
  "    if ([string]::IsNullOrWhiteSpace($bundlePath)) { exit 0 }" ^
  "    if ($bundlePath -match '^(https?:)?//') {" ^
  "      if ($bundlePath.StartsWith('//')) { $bundleUrl = 'http:' + $bundlePath } else { $bundleUrl = $bundlePath }" ^
  "    } else {" ^
  "      $bundleUrl = ([System.Uri]::new([System.Uri]$url, $bundlePath)).AbsoluteUri" ^
  "    }" ^
  "    $bundleResponse = Invoke-WebRequest -UseBasicParsing -Uri $bundleUrl -TimeoutSec 120;" ^
  "    if ($bundleResponse.StatusCode -ge 200 -and $bundleResponse.StatusCode -lt 400 -and ([string]$bundleResponse.Content).Length -ge 1024) { exit 0 }" ^
  "  } catch {" ^
  "    Start-Sleep -Seconds 2" ^
  "  }" ^
  "}" ^
  "exit 1" >nul 2>&1

exit /b %ERRORLEVEL%
