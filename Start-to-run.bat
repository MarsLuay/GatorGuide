@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%Mobile Team"
set "SERVER_PORT=8081"
set "SERVER_URL=http://127.0.0.1:%SERVER_PORT%"
set "SERVER_WINDOW_TITLE=Gator Guide Server"

if not exist "%APP_DIR%\package.json" (
  echo Could not find the Expo app in "%APP_DIR%".
  exit /b 1
)

echo Preparing Gator Guide for launch...
call :ensure_node_toolchain
if errorlevel 1 exit /b 1

call :ensure_env_file
if errorlevel 1 exit /b 1

call :ensure_app_dependencies
if errorlevel 1 exit /b 1

echo Starting Expo with tunnel mode...
start "%SERVER_WINDOW_TITLE%" cmd /k "cd /d ""%APP_DIR%"" && call npx expo start --tunnel --port %SERVER_PORT%"
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
start "" "%SERVER_URL%" >nul 2>&1
if errorlevel 1 (
  echo The browser did not open automatically.
  echo Open this URL manually: %SERVER_URL%
  exit /b 0
)

echo Your default browser should open in a moment.
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
  echo App dependencies are already installed.
  exit /b 0
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
