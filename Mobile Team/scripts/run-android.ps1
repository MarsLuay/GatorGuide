if (-not $env:ANDROID_HOME) {
    $env:ANDROID_HOME = "C:\Users\Ava_z\AppData\Local\Android\Sdk"
}
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:Path"
npx expo run:android
