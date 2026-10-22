#!/usr/bin/env bash
# Runs inside the Android emulator: renders the Glance widget for every size and
# state, checks the daily-puzzle/streak rules, and taps the book link + QR.
set -uo pipefail
PKG=io.github.maeserbern.ingredientpartygame
OUT=qa-output/android
mkdir -p "$OUT"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -r "$PKG.test/androidx.test.runner.AndroidJUnitRunner" | tee "$OUT/instrument.txt"
mkdir -p "$OUT/widget-previews"
for f in $(adb shell run-as "$PKG" ls files/widget-previews | tr -d ""); do adb exec-out run-as "$PKG" cat "files/widget-previews/$f" > "$OUT/widget-previews/$f"; done
ls -la "$OUT" "$OUT/widget-previews" || true
cat "$OUT/widget-previews/android-booklink.txt" || true
grep -q '^OK (' "$OUT/instrument.txt"
