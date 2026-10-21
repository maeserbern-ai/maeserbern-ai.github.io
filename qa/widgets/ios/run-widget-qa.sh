#!/usr/bin/env bash
# Builds the Expo iOS app with the "Label of the Day" widget extension for the
# simulator, checks the packaged widget, proves the widget's book links open
# Amazon, and renders every widget family with the snapshot harness.
set -uo pipefail
ROOT="$PWD"
OUT="$ROOT/qa-output/ios"
mkdir -p "$OUT"
FAILED=0
fail() { echo "FAILED: $*" | tee -a "$OUT/failures.txt"; FAILED=1; }

DEV=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
d = json.load(sys.stdin)["devices"]
best = None
for rt, devs in d.items():
    if "iOS" not in rt: continue
    for x in devs:
        if not x["name"].startswith("iPhone"): continue
        score = (rt, "Pro Max" in x["name"], "Pro" in x["name"])
        if best is None or score > best[0]: best = (score, x["udid"], x["name"], rt)
print(best[1]); print(best[2] + " / " + best[3], file=sys.stderr)
' 2> "$OUT/device.txt")
cat "$OUT/device.txt"
xcrun simctl boot "$DEV" || true
xcrun simctl bootstatus "$DEV" -b
xcrun simctl status_bar "$DEV" override --time '9:41' --batteryState charged --batteryLevel 100 || true

# ---------- 1. Widget snapshots (the real widget views, every family and state) ----------
(
  set -e
  cd qa/widgets/ios
  xcodegen generate --spec project.yml
  xcodebuild -project WidgetSnapshots.xcodeproj -scheme WidgetSnapshots -configuration Debug \
    -destination "platform=iOS Simulator,id=$DEV" -derivedDataPath "$RUNNER_TEMP/snap" \
    CODE_SIGNING_ALLOWED=NO build > "$OUT/snapshot-build.log" 2>&1 || { tail -n 80 "$OUT/snapshot-build.log"; exit 1; }
  SNAP_APP=$(find "$RUNNER_TEMP/snap/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)
  xcrun simctl install "$DEV" "$SNAP_APP"
  xcrun simctl launch "$DEV" io.github.maeserbern.ingredientpartygame.widgetsnapshots
  DATA=$(xcrun simctl get_app_container "$DEV" io.github.maeserbern.ingredientpartygame.widgetsnapshots data)
  for i in $(seq 1 60); do [ -f "$DATA/Documents/widget-snapshots/DONE.txt" ] && break; sleep 2; done
  test -f "$DATA/Documents/widget-snapshots/DONE.txt"
  mkdir -p "$OUT/snapshots"
  cp "$DATA"/Documents/widget-snapshots/* "$OUT/snapshots/"
  cat "$OUT/snapshots/report.txt"
  grep -q 'uniqueIn105Days=105' "$OUT/snapshots/report.txt"
  ! grep -q ':false' "$OUT/snapshots/report.txt"
  test "$(ls "$OUT"/snapshots/*.png | wc -l)" -ge 42
) || fail "widget snapshots"

# ---------- 2. The real app with the widget extension ----------
(
  set -e
  cd apple-app
  npm ci > "$OUT/npm-ci.log" 2>&1 || { tail -n 40 "$OUT/npm-ci.log"; exit 1; }
  NODE_PATH="$PWD/node_modules" node --test "$ROOT/qa/widgets/book-links.test.cjs" "$ROOT/qa/apple/scene-lifecycle.test.cjs"
  npx expo prebuild --platform ios --no-install > "$OUT/prebuild.log" 2>&1 || { tail -n 60 "$OUT/prebuild.log"; exit 1; }
  npx pod-install ios > "$OUT/pod-install.log" 2>&1 || { tail -n 60 "$OUT/pod-install.log"; exit 1; }
  find ios -name AppDelegate.swift -not -path '*/Pods/*' -exec cp {} "$OUT/AppDelegate.swift" \;
  grep -q 'if BookLinkOpener.open(url) { return true }' "$OUT/AppDelegate.swift"
  grep -q 'GameSceneDelegate' "$OUT/AppDelegate.swift"
  WORKSPACE=$(find "$PWD/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)
  SCHEME=$(basename "$WORKSPACE" .xcworkspace)
  xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
    -destination "platform=iOS Simulator,id=$DEV" -derivedDataPath "$RUNNER_TEMP/game" \
    CODE_SIGNING_ALLOWED=NO build > "$OUT/native-build.log" 2>&1 || { grep -E 'error:' "$OUT/native-build.log" | head -40; tail -n 60 "$OUT/native-build.log"; exit 1; }
  APP=$(find "$RUNNER_TEMP/game/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' -print -quit)
  echo "$APP" > "$OUT/app-path.txt"
  APPEX="$APP/PlugIns/PartyGameWidgets.appex"
  test -d "$APPEX" || { echo 'Widget extension is not embedded'; ls -la "$APP/PlugIns" || true; exit 1; }
  test -d "$APP/Watch" || { echo 'Embedded Watch app is missing'; exit 1; }
  plutil -p "$APP/Info.plist" > "$OUT/app-Info.txt"
  plutil -p "$APPEX/Info.plist" > "$OUT/widget-Info.txt"
  grep -q 'com.apple.widgetkit-extension' "$OUT/widget-Info.txt"
  grep -q '"ingredientparty"' "$OUT/app-Info.txt"
  grep -q '"1.1.0"' "$OUT/app-Info.txt"; grep -q '"CFBundleVersion" => "7"' "$OUT/app-Info.txt"
  grep -q '"1.1.0"' "$OUT/widget-Info.txt"; grep -q '"CFBundleVersion" => "7"' "$OUT/widget-Info.txt"
  grep -q 'MinimumOSVersion" => "17.0"' "$OUT/widget-Info.txt"
  ls -la "$APPEX" > "$OUT/widget-files.txt"
  for f in daily.json Fraunces-Black.ttf Fraunces-BlackItalic.ttf Inter-Medium.ttf Inter-Bold.ttf Inter-ExtraBold.ttf Assets.car; do
    test -f "$APPEX/$f" || { echo "missing $f in widget"; exit 1; }
  done
  xcrun assetutil --info "$APPEX/Assets.car" > "$OUT/widget-assets.json"
  for k in food beauty clean kids home tp; do
    grep -q "\"cover-$k\"" "$OUT/widget-assets.json" && grep -q "\"qr-$k\"" "$OUT/widget-assets.json" || { echo "missing cover/qr $k"; exit 1; }
  done
  # Entitlements requested by the generated project (App Group for streak/answer state).
  find ios -name 'generated.entitlements' -path '*PartyGameWidgets*' -exec cat {} \; > "$OUT/widget-entitlements.plist"
  grep -q 'group.io.github.maeserbern.ingredientpartygame' "$OUT/widget-entitlements.plist"
  tar -czf "$OUT/simulator-app.tar.gz" -C "$(dirname "$APP")" "$(basename "$APP")"
) || fail "app build with widget"

# ---------- 3. Install, register the widget, and prove the book links open Amazon ----------
APP=$(cat "$OUT/app-path.txt" 2>/dev/null || true)
if [ -n "$APP" ] && [ -d "$APP" ]; then
(
  set -e
  BID=io.github.maeserbern.ingredientpartygame
  xcrun simctl install "$DEV" "$APP"
  xcrun simctl launch "$DEV" "$BID"
  sleep 8
  xcrun simctl io "$DEV" screenshot "$OUT/game-launched.png"
  xcrun simctl spawn "$DEV" pluginkit -mAvvv -p com.apple.widgetkit-extension > "$OUT/pluginkit.txt" 2>&1 || true
  cat "$OUT/pluginkit.txt"
  grep -q "$BID.widgets" "$OUT/pluginkit.txt" || echo "note: pluginkit did not list the widget (simulator listing can lag)"

  xcrun simctl spawn "$DEV" log stream --level debug --style compact \
    --predicate 'eventMessage CONTAINS "IngredientBookLink"' > "$OUT/book-link.log" 2>&1 &
  LOG_PID=$!
  sleep 3
  LINKS="$OUT/snapshots/widget-links.txt"
  test -s "$LINKS"
  # Cold start: the game is not running when the widget link arrives.
  FIRST=$(head -n 1 "$LINKS")
  xcrun simctl terminate "$DEV" "$BID" || true
  xcrun simctl terminate "$DEV" com.apple.mobilesafari || true
  sleep 2
  xcrun simctl openurl "$DEV" "$FIRST"
  sleep 12
  xcrun simctl io "$DEV" screenshot "$OUT/book-link-cold-start.png"
  # Warm: every book's link while the game is open.
  while read -r LINK; do
    xcrun simctl launch "$DEV" "$BID" > /dev/null; sleep 4
    xcrun simctl openurl "$DEV" "$LINK"; sleep 6
  done < "$LINKS"
  xcrun simctl io "$DEV" screenshot "$OUT/book-link-warm-last.png"
  sleep 2
  kill "$LOG_PID" || true
  cat "$OUT/book-link.log"
  python3 - "$LINKS" "$OUT/book-link.log" <<'PY'
import sys, urllib.parse
links = [l.strip() for l in open(sys.argv[1]) if l.strip()]
log = open(sys.argv[2]).read()
missing = []
for l in links:
    target = urllib.parse.parse_qs(urllib.parse.urlparse(l).query)["u"][0]
    if f"opened=true {target}" not in log: missing.append(target)
cold = urllib.parse.parse_qs(urllib.parse.urlparse(links[0]).query)["u"][0]
if log.count(f"opened=true {cold}") < 2: missing.append("cold start " + cold)
print("book links opened by UIApplication.open:", len(links) - len([m for m in missing if not m.startswith("cold")]), "of", len(links))
sys.exit(1 if missing else 0)
PY
) || fail "book links"
fi

exit "$FAILED"
