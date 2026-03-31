@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "NODE_SCRIPT=%ROOT_DIR%Mobile Team\scripts\add-catalog-item.cjs"

if not exist "%NODE_SCRIPT%" (
  echo Could not find "%NODE_SCRIPT%".
  exit /b 1
)

node "%NODE_SCRIPT%" %*
exit /b %ERRORLEVEL%
