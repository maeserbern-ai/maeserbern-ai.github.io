#!/usr/bin/env bash
# Runs inside the Android emulator: renders the Glance widget for every size and
# state, checks the daily-puzzle/streak rules, and taps the book link + QR.
set -uo pipefail
PKG=io.github.maeserbern.ingredientpartygame
OUT=qa-output/android
mkdir -p "$OUT"
# A fresh emulator can still be on the setup "FallbackHome"; make the Pixel launcher the home app.
adb shell settings put global device_provisioned 1
adb shell settings put secure user_setup_complete 1
adb shell cmd role add-role-holder android.app.role.HOME com.google.android.apps.nexuslauncher 0 || true
adb shell input keyevent KEYCODE_HOME
sleep 8
adb shell cmd role get-role-holders android.app.role.HOME
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -r "$PKG.test/androidx.test.runner.AndroidJUnitRunner" | tee "$OUT/instrument.txt"
mkdir -p "$OUT/widget-previews"
for f in $(adb shell run-as "$PKG" ls files/widget-previews | tr -d "
"); do adb exec-out run-as "$PKG" cat "files/widget-previews/$f" > "$OUT/widget-previews/$f"; done
ls -la "$OUT" "$OUT/widget-previews" || true
cat "$OUT/widget-previews/android-booklink.txt" || true
grep -q '^OK (' "$OUT/instrument.txt"
