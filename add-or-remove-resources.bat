@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "NODE_SCRIPT=%ROOT_DIR%Mobile Team\scripts\assets\add-catalog-item.cjs"
set "PATH=%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\Git\cmd;%LocalAppData%\Programs\Git\cmd;%PATH%"

if not exist "%NODE_SCRIPT%" (
  echo Could not find "%NODE_SCRIPT%".
  exit /b 1
)

node "%NODE_SCRIPT%" %*
exit /b %ERRORLEVEL%
