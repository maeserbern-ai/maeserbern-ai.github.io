#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-output/android
collect_evidence() {
  adb pull /sdcard/Android/data/io.github.maeserbern.ingredientpartygame.deviceqa/files/screens qa-output/android/ || true
  adb logcat -d -t 2500 > qa-output/android/logcat.txt || true
}
trap collect_evidence EXIT
# Tests run in their own process so R8 can optimize the game exactly as in release.
gradle -p android -PdeviceQa --no-daemon :app:installQa :deviceqa:connectedDebugAndroidTest
