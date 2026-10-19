#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-output/android
collect_evidence() {
  adb pull /sdcard/Download/ingredient-device-qa qa-output/android/ || true
  adb logcat -d -t 2500 > qa-output/android/logcat.txt || true
}
trap collect_evidence EXIT
# Tests run in their own process and can target the exact signed release artifact.
if [ -n "${QA_SIGNED_APK:-}" ]; then
  test -s "$QA_SIGNED_APK"
  BUILD_TOOLS=$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)
  "$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$QA_SIGNED_APK" > qa-output/android/signed-apk-verification.txt
  grep -q 'd482ae6536232484988d1dc69ae85b973306765d15dfcf9c84be4f91701f6544' qa-output/android/signed-apk-verification.txt
  "$BUILD_TOOLS/aapt" dump badging "$QA_SIGNED_APK" > qa-output/android/signed-apk-manifest.txt
  grep -q "package: name='io.github.maeserbern.ingredientpartygame' versionCode='$QA_VERSION_CODE'" qa-output/android/signed-apk-manifest.txt
  sha256sum "$QA_SIGNED_APK" > qa-output/android/signed-apk-sha256.txt
  adb install "$QA_SIGNED_APK"
  gradle -p android -PdeviceQa --no-daemon :deviceqa:connectedDebugAndroidTest
else
  gradle -p android -PdeviceQa --no-daemon :app:installQa :deviceqa:connectedDebugAndroidTest
fi
