param(
  [ValidateSet("Debug", "Release")]
  [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$profile = $Configuration.ToLowerInvariant()
$tauriArgs = @("tauri", "android", "build", "--apk", "--target", "aarch64", "--ci")

if ($Configuration -eq "Debug") {
  $tauriArgs += "--debug"
}

Push-Location $projectRoot
try {
  $tauriCommand = "npx.cmd $($tauriArgs -join ' ') 2>&1"
  & cmd.exe /d /c $tauriCommand | Tee-Object -Variable capturedOutput
  $tauriExitCode = $LASTEXITCODE

  if ($tauriExitCode -eq 0) {
    exit 0
  }

  $outputText = $capturedOutput -join "`n"
  if ($outputText -notmatch "Creation symbolic link is not allowed") {
    throw "Tauri Android build failed before packaging the native library."
  }

  Write-Host "Windows symlink creation is disabled. Packaging the compiled library with Gradle..."

  $sourceLibrary = Join-Path $projectRoot "src-tauri\target\aarch64-linux-android\$profile\libposv2_subscriptions_lib.so"
  $jniDirectory = Join-Path $projectRoot "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"

  if (-not (Test-Path -LiteralPath $sourceLibrary)) {
    throw "The compiled Android library was not found at $sourceLibrary"
  }

  New-Item -ItemType Directory -Path $jniDirectory -Force | Out-Null
  Copy-Item -LiteralPath $sourceLibrary -Destination (Join-Path $jniDirectory "libposv2_subscriptions_lib.so") -Force

  $gradleRoot = Join-Path $projectRoot "src-tauri\gen\android"
  $gradleTask = "assembleArm64$Configuration"
  $rustTask = "rustBuildArm64$Configuration"

  Push-Location $gradleRoot
  try {
    & .\gradlew.bat $gradleTask -x $rustTask
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle Android packaging failed."
    }
  }
  finally {
    Pop-Location
  }

  $apkDirectory = Join-Path $gradleRoot "app\build\outputs\apk\arm64\$profile"
  $apk = Get-ChildItem -LiteralPath $apkDirectory -Filter "*.apk" | Select-Object -First 1
  if (-not $apk) {
    throw "Android packaging completed but no APK was found."
  }

  Write-Host "APK created: $($apk.FullName)"
}
finally {
  Pop-Location
}
