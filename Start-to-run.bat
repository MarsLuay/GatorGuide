@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "TOOLCHAIN_HELPER=%ROOT_DIR%windows-toolchain.cmd"
set "APP_DIR=%ROOT_DIR%source"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "EXPO_PORT=8081"
set "EXPO_URL=http://127.0.0.1:%EXPO_PORT%"

echo Preparing Gator Guide for launch...
call :call_toolchain :bootstrap
if errorlevel 1 exit /b 1
call :choose_startup_mode
if errorlevel 1 exit /b 1

call :locate_or_clone_repo
if errorlevel 1 exit /b 1

call :ensure_node_toolchain
if errorlevel 1 exit /b 1

call :ensure_env_file
if errorlevel 1 exit /b 1

call :ensure_app_dependencies
if errorlevel 1 exit /b 1

call :sync_expo_packages
if errorlevel 1 exit /b 1

echo Starting Expo...
echo The Expo page will open in your default browser when it is ready.
call :open_browser_when_expo_ready
pushd "%APP_DIR%" >nul
set "EXPO_START_PORT=%EXPO_PORT%"
call npm run start
set "EXPO_EXIT=%ERRORLEVEL%"
popd >nul
call :organize_tmp

if not "%EXPO_EXIT%"=="0" (
  echo Failed to start Expo.
  echo Run `npm run start` manually from:
  echo %APP_DIR%
  exit /b 1
)

exit /b 0

:choose_startup_mode
set "NORMALIZED_STARTUP_MODE=%GATORGUIDE_STARTUP_MODE%"
if /I "%NORMALIZED_STARTUP_MODE%"=="1" set "NORMALIZED_STARTUP_MODE=normal"
if /I "%NORMALIZED_STARTUP_MODE%"=="run" set "NORMALIZED_STARTUP_MODE=normal"
if /I "%NORMALIZED_STARTUP_MODE%"=="2" set "NORMALIZED_STARTUP_MODE=demo"

if /I "%NORMALIZED_STARTUP_MODE%"=="normal" goto startup_normal
if /I "%NORMALIZED_STARTUP_MODE%"=="demo" goto startup_demo

echo.
echo Choose startup mode:
echo   1. Run normally
echo   2. Demo mode
echo.
choice /C 12 /N /M "Enter 1 or 2: "
if errorlevel 2 goto startup_demo
if errorlevel 1 goto startup_normal

echo Could not read startup mode.
exit /b 1

:startup_demo
set "GATORGUIDE_STARTUP_MODE=demo"
set "GATORGUIDE_DEMO_MODE=1"
set "EXPO_PUBLIC_GATORGUIDE_DEMO_MODE=1"
echo Demo mode selected. Human-reviewed Course Planner demo data will load on demand.
exit /b 0

:startup_normal
set "GATORGUIDE_STARTUP_MODE=normal"
set "GATORGUIDE_DEMO_MODE="
set "EXPO_PUBLIC_GATORGUIDE_DEMO_MODE="
echo Normal startup selected.
exit /b 0

:open_browser_when_expo_ready
call :call_toolchain :run_powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$deadline=(Get-Date).AddMinutes(2); while((Get-Date) -lt $deadline){ try { $client = New-Object System.Net.Sockets.TcpClient; $async = $client.BeginConnect('127.0.0.1', %EXPO_PORT%, $null, $null); if($async.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected){ $client.EndConnect($async); $client.Close(); Start-Process '%EXPO_URL%'; exit 0 } $client.Close() } catch {} Start-Sleep -Seconds 1 } exit 0" >nul 2>&1
exit /b 0

:locate_or_clone_repo
if exist "%APP_DIR%\package.json" (
  echo Found Gator Guide in "%ROOT_DIR%".
  exit /b 0
)

set "CLONE_ROOT=%ROOT_DIR%%REPO_DIR_NAME%"
if exist "%CLONE_ROOT%\source\package.json" (
  set "ROOT_DIR=%CLONE_ROOT%\"
  set "APP_DIR=%ROOT_DIR%source"
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
set "APP_DIR=%ROOT_DIR%source"
if not exist "%APP_DIR%\package.json" (
  echo The repo finished cloning, but "%APP_DIR%\package.json" is still missing.
  exit /b 1
)

echo Repo cloned successfully.
exit /b 0

:ensure_git
call :call_toolchain :ensure_git
exit /b %ERRORLEVEL%

:ensure_node_toolchain
call :call_toolchain :ensure_node
exit /b %ERRORLEVEL%

:call_toolchain
if not exist "%TOOLCHAIN_HELPER%" (
  echo windows-toolchain.cmd was not found next to this launcher.
  echo Download it from the latest GatorGuide release or clone the full repo.
  exit /b 1
)
call "%TOOLCHAIN_HELPER%" %*
exit /b %ERRORLEVEL%

:ensure_env_file
if exist "%APP_DIR%\.env" (
  echo Existing .env found. Skipping env setup.
  exit /b 0
)

if not exist "%APP_DIR%\.env.example" (
  exit /b 0
)

copy /y "%APP_DIR%\.env.example" "%APP_DIR%\.env" >nul
if errorlevel 1 (
  echo Could not create "%APP_DIR%\.env".
  exit /b 1
)

echo Created source\.env from .env.example.
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

:sync_expo_packages
echo Checking Expo package compatibility...
pushd "%APP_DIR%" >nul
call npx expo install --check >nul 2>&1
set "EXPO_CHECK_EXIT=!ERRORLEVEL!"
if "!EXPO_CHECK_EXIT!"=="0" (
  popd >nul
  echo Expo packages are already compatible with this SDK.
  exit /b 0
)

echo Updating Expo-managed packages for this SDK...
call npx expo install --fix --npm
set "EXPO_FIX_EXIT=!ERRORLEVEL!"
popd >nul

if not "!EXPO_FIX_EXIT!"=="0" (
  echo Expo package update failed.
  echo Run `npx expo install --fix --npm` manually from:
  echo %APP_DIR%
  exit /b 1
)

echo Expo packages updated successfully.
exit /b 0

:organize_tmp
if exist "%APP_DIR%\scripts\organize-tmp-artifacts.cjs" (
  node "%APP_DIR%\scripts\organize-tmp-artifacts.cjs" --quiet >nul 2>&1
)
exit /b 0
