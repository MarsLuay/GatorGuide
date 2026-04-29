@echo off
setlocal EnableExtensions

call "%~dp0..\..\Course-Planner-Updater.bat" %*
exit /b %ERRORLEVEL%
