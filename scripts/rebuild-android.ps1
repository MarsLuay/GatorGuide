# 完全重建 Android 以应用新的 google-services.json
$ErrorActionPreference = "Stop"
$env:ANDROID_HOME = "C:\Users\Ava_z\AppData\Local\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:Path"

Write-Host "1. 清理并重新生成原生工程..."
npx expo prebuild --platform android --clean

Write-Host "2. 设置 SDK 路径..."
$localProps = "android\local.properties"
"sdk.dir=C:/Users/Ava_z/AppData/Local/Android/Sdk" | Set-Content $localProps -Encoding UTF8

Write-Host "3. 构建并运行..."
npx expo run:android
