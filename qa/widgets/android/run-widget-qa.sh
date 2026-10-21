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
adb exec-out run-as "$PKG" tar -c -C files widget-previews > "$OUT/previews.tar" || true
tar -xf "$OUT/previews.tar" -C "$OUT" || true
adb pull /sdcard/Download/android-booklink-row.png "$OUT/" || true
adb pull /sdcard/Download/android-booklink-qr.png "$OUT/" || true
ls -la "$OUT" "$OUT/widget-previews" || true
cat "$OUT/widget-previews/android-booklink.txt" || true
grep -q '^OK (' "$OUT/instrument.txt"
