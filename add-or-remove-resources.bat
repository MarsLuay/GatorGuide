@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "REPO_DIR_NAME=GatorGuide"
set "REPO_URL=https://github.com/MarsLuay/GatorGuide.git"
set "NODE_SCRIPT=%ROOT_DIR%source\scripts\assets\add-catalog-item.cjs"
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"

call :locate_or_clone_repo
if errorlevel 1 exit /b 1

if not exist "%NODE_SCRIPT%" (
  echo Could not find "%NODE_SCRIPT%".
  exit /b 1
)

node "%NODE_SCRIPT%" %*
exit /b %ERRORLEVEL%

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
  echo Close this window and run add-or-remove-resources.bat again.
  exit /b 1
)

echo Git finished installing successfully.
exit /b 0
