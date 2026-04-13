@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%Mobile Team"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "EXPO_PORT=8081"
set "EXPO_URL=http://127.0.0.1:%EXPO_PORT%"

echo Preparing Gator Guide for launch...
call :locate_or_clone_repo
if errorlevel 1 exit /b 1

call :ensure_node_toolchain
if errorlevel 1 exit /b 1

call :ensure_env_file
if errorlevel 1 exit /b 1

call :ensure_app_dependencies
if errorlevel 1 exit /b 1

echo Starting Expo...
echo The Expo page will open in your default browser when it is ready.
call :open_browser_when_expo_ready
pushd "%APP_DIR%" >nul
set "EXPO_START_PORT=%EXPO_PORT%"
call npm run start
set "EXPO_EXIT=%ERRORLEVEL%"
popd >nul

if not "%EXPO_EXIT%"=="0" (
  echo Failed to start Expo.
  echo Run `npm run start` manually from:
  echo %APP_DIR%
  exit /b 1
)

exit /b 0

:open_browser_when_expo_ready
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$deadline=(Get-Date).AddMinutes(2); while((Get-Date) -lt $deadline){ try { $client = New-Object System.Net.Sockets.TcpClient; $async = $client.BeginConnect('127.0.0.1', %EXPO_PORT%, $null, $null); if($async.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected){ $client.EndConnect($async); $client.Close(); Start-Process '%EXPO_URL%'; exit 0 } $client.Close() } catch {} Start-Sleep -Seconds 1 } exit 0" >nul 2>&1
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
