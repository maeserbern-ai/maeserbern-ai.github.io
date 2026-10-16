#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
mkdir -p qa-output
xcrun simctl list devices available --json > qa-output/devices-available.json
node qa/apple/select-devices.mjs qa-output/devices-available.json "$QA_PLATFORM" > qa-output/devices.tsv
cat qa-output/devices.tsv
if [ "$QA_PLATFORM" = "tvos" ]; then
  APP_DIR=appletv-app
  XCODE_PLATFORM=tvOS
  SDK=appletvsimulator
  export EXPO_TV=1
else
  APP_DIR=apple-app
  XCODE_PLATFORM=iOS
  SDK=iphonesimulator
fi
# The native TV port never imports the web stylesheet.
source_tree() {
  git -C "$1" ls-tree -r HEAD "$APP_DIR" party-game | awk -F '\t' -v platform="$QA_PLATFORM" 'platform != "tvos" || $2 != "party-game/style.css"'
}
source_tree . | shasum -a 256 | awk '{print $1}' > qa-output/source-digest.txt
if [ "$QA_PLATFORM" = "tvos" ] && [ "${QA_FOCUS_PROBE:-false}" = "true" ]; then
  test ! -f qa-reuse/simulator-app.tar.gz || { echo 'Diagnostic build cannot reuse another app'; exit 1; }
  node qa/apple/install-tv-focus-probe.mjs
fi
if [ -f qa-reuse/simulator-app.tar.gz ]; then
  test ! -f qa-reuse/DIAGNOSTIC-BUILD-NOT-FOR-RELEASE.txt || { echo 'Refusing diagnostic app reuse'; exit 1; }
  source_tree qa-reuse-source | shasum -a 256 | awk '{print $1}' > qa-reuse/source-digest.txt
  cmp qa-output/source-digest.txt qa-reuse/source-digest.txt || { echo 'Refusing a compiled app from different game source'; exit 1; }
  mkdir -p "$RUNNER_TEMP/reused-$QA_PLATFORM"
  tar -xzf qa-reuse/simulator-app.tar.gz -C "$RUNNER_TEMP/reused-$QA_PLATFORM"
  APP=$(find "$RUNNER_TEMP/reused-$QA_PLATFORM" -maxdepth 1 -name '*.app' -print -quit)
  cp qa-reuse/simulator-app.tar.gz qa-output/
else
cd "$APP_DIR"
npm ci
node "$ROOT/qa/apple/check-native-dependencies.mjs"
if [ "$QA_PLATFORM" = "ios" ]; then npm run bundle-game; fi
npx expo prebuild --platform ios --no-install
npx pod-install ios
ruby -ryaml -e 'pods = YAML.load_file("ios/Podfile.lock").fetch("PODS").flat_map { |p| p.is_a?(Hash) ? p.keys : [p] }; abort "ExpoAsset native pod is missing" unless pods.any? { |p| p.start_with?("ExpoAsset (") }'
WORKSPACE=$(find "$PWD/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
DERIVED="$RUNNER_TEMP/game-$QA_PLATFORM"
FIRST_ID=$(awk 'NR==1 {print $2}' "$ROOT/qa-output/devices.tsv")
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination "platform=$XCODE_PLATFORM Simulator,id=$FIRST_ID" \
  -derivedDataPath "$DERIVED" CODE_SIGNING_ALLOWED=NO build \
  > "$ROOT/qa-output/native-build.log" 2>&1 || { tail -n 100 "$ROOT/qa-output/native-build.log"; exit 1; }
APP=$(find "$DERIVED/Build/Products/Release-$SDK" -maxdepth 1 -name '*.app' -print -quit)
test -n "$APP"
/usr/libexec/PlistBuddy -c Print "$APP/Info.plist" > "$ROOT/qa-output/built-app-info.txt"
EXECUTABLE=$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$APP/Info.plist")
tar -czf "$ROOT/qa-output/simulator-app.tar.gz" -C "$(dirname "$APP")" "$(basename "$APP")"
find "$PWD/ios" -name AppDelegate.swift -not -path '*/Pods/*' -exec cp {} "$ROOT/qa-output/AppDelegate.swift" \;
fi
test -n "$APP"
EXECUTABLE=$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$APP/Info.plist")
/usr/libexec/PlistBuddy -c Print "$APP/Info.plist" > "$ROOT/qa-output/built-app-info.txt"
test -s "$APP/main.jsbundle"
cd "$ROOT/qa/apple"
node -e 'const fs=require("fs"); const platform=process.env.QA_PLATFORM==="tvos"?"tvOS":"iOS"; fs.writeFileSync("project.json", JSON.stringify({name:"GameQA",options:{deploymentTarget:{[platform]:"15.1"}},targets:{GameQA:{type:"bundle.ui-testing",platform,sources:["GameScreensTests.swift"],settings:{base:{PRODUCT_BUNDLE_IDENTIFIER:"io.github.maeserbern.ingredientpartygame.uitests",GENERATE_INFOPLIST_FILE:"YES",SWIFT_VERSION:"5.0",CODE_SIGNING_ALLOWED:"NO"}}}},schemes:{GameQA:{build:{targets:{GameQA:"all"}},test:{targets:["GameQA"]}}}}))'
xcodegen generate --spec project.json
FIRST_ID=$(awk 'NR==1 {print $2}' "$ROOT/qa-output/devices.tsv")
xcodebuild build-for-testing -project GameQA.xcodeproj -scheme GameQA -configuration Debug \
  -destination "platform=$XCODE_PLATFORM Simulator,id=$FIRST_ID" \
  -derivedDataPath "$RUNNER_TEMP/qa-$QA_PLATFORM" CODE_SIGNING_ALLOWED=NO \
  > "$ROOT/qa-output/test-runner-build.log" 2>&1 || { tail -n 80 "$ROOT/qa-output/test-runner-build.log"; exit 1; }
TEST_RUNNER=$(find "$RUNNER_TEMP/qa-$QA_PLATFORM/Build/Products/Debug-$SDK" -maxdepth 1 -name '*-Runner.app' -print -quit)
test -n "$TEST_RUNNER"
RUNNER_ID=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$TEST_RUNNER/Info.plist")
FAILED=0
while IFS=$'\t' read -r TAG DEVICE NAME; do
  echo "Testing $NAME ($DEVICE)"
  xcrun simctl boot "$DEVICE" || true
  xcrun simctl bootstatus "$DEVICE" -b
  xcrun simctl status_bar "$DEVICE" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100 || true
  xcrun simctl install "$DEVICE" "$APP"
  # Let the simulator register the UI runner before Xcode asks FrontBoard to launch it.
  xcrun simctl install "$DEVICE" "$TEST_RUNNER"
  xcrun simctl get_app_container "$DEVICE" "$RUNNER_ID" app
  sleep 3
  xcrun simctl spawn "$DEVICE" log stream --level debug --style compact \
    --predicate "process == '$EXECUTABLE' OR eventMessage CONTAINS[c] 'io.github.maeserbern.ingredientpartygame'" \
    > "$ROOT/qa-output/$TAG-runtime.log" 2>&1 &
  LOG_PID=$!
  xcrun simctl launch --terminate-running-process "$DEVICE" io.github.maeserbern.ingredientpartygame \
    > "$ROOT/qa-output/$TAG-manual-launch.txt" 2>&1 || true
  sleep 5
  xcrun simctl io "$DEVICE" screenshot "$ROOT/qa-output/$TAG-before-xctest.png" || true
  set +e
  xcodebuild test-without-building -project GameQA.xcodeproj -scheme GameQA -configuration Debug \
    -destination "platform=$XCODE_PLATFORM Simulator,id=$DEVICE" \
    -parallel-testing-enabled NO \
    -resultBundlePath "$ROOT/qa-output/$TAG.xcresult" \
    -derivedDataPath "$RUNNER_TEMP/qa-$QA_PLATFORM" \
    CODE_SIGNING_ALLOWED=NO > "$ROOT/qa-output/$TAG-test.log" 2>&1
  RESULT=$?
  set -e
  tail -n 70 "$ROOT/qa-output/$TAG-test.log"
  xcrun xcresulttool export attachments --path "$ROOT/qa-output/$TAG.xcresult" --output-path "$ROOT/qa-output/$TAG-images" || true
  xcrun xcresulttool export diagnostics --path "$ROOT/qa-output/$TAG.xcresult" --output-path "$ROOT/qa-output/$TAG-diagnostics" || true
  kill "$LOG_PID" || true
  xcrun simctl shutdown "$DEVICE" || true
  if [ "$RESULT" -ne 0 ]; then FAILED=1; fi
done < "$ROOT/qa-output/devices.tsv"
exit "$FAILED"
