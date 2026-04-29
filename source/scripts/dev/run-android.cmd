@echo off
if "%ANDROID_HOME%"=="" set ANDROID_HOME=C:\Users\Ava_z\AppData\Local\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%
call npx expo run:android
