@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "TOOLCHAIN_HELPER=%ROOT_DIR%windows-toolchain.cmd"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "NODE_SCRIPT=%ROOT_DIR%source\scripts\assets\add-catalog-item.cjs"

call :call_toolchain :bootstrap
if errorlevel 1 exit /b 1

call :locate_or_clone_repo
if errorlevel 1 exit /b 1

if not exist "%NODE_SCRIPT%" (
  echo Could not find "%NODE_SCRIPT%".
  exit /b 1
)

node "%NODE_SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"
if exist "%ROOT_DIR%source\scripts\organize-tmp-artifacts.cjs" node "%ROOT_DIR%source\scripts\organize-tmp-artifacts.cjs" --quiet >nul 2>&1
exit /b %EXIT_CODE%

:locate_or_clone_repo
if exist "%NODE_SCRIPT%" (
  exit /b 0
)

set "CLONE_ROOT=%ROOT_DIR%%REPO_DIR_NAME%"
if exist "%CLONE_ROOT%\source\scripts\assets\add-catalog-item.cjs" (
  set "ROOT_DIR=%CLONE_ROOT%\"
  set "NODE_SCRIPT=%ROOT_DIR%source\scripts\assets\add-catalog-item.cjs"
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
set "NODE_SCRIPT=%ROOT_DIR%source\scripts\assets\add-catalog-item.cjs"
if not exist "%NODE_SCRIPT%" (
  echo The repo finished cloning, but "%NODE_SCRIPT%" is still missing.
  exit /b 1
)

echo Repo cloned successfully.
exit /b 0

:ensure_git
call :call_toolchain :ensure_git
exit /b %ERRORLEVEL%

:call_toolchain
if not exist "%TOOLCHAIN_HELPER%" (
  echo windows-toolchain.cmd was not found next to this launcher.
  echo Download it from the latest GatorGuide release or clone the full repo.
  exit /b 1
)
call "%TOOLCHAIN_HELPER%" %*
exit /b %ERRORLEVEL%
