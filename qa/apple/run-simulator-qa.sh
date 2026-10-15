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
cd "$APP_DIR"
npm ci
if [ "$QA_PLATFORM" = "ios" ]; then npm run bundle-game; fi
npx expo prebuild --platform ios --no-install
npx pod-install ios
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
cd "$ROOT/qa/apple"
node -e 'const fs=require("fs"); const platform=process.env.QA_PLATFORM==="tvos"?"tvOS":"iOS"; fs.writeFileSync("project.json", JSON.stringify({name:"GameQA",options:{deploymentTarget:{[platform]:"15.1"}},targets:{GameQA:{type:"bundle.ui-testing",platform,sources:["GameScreensTests.swift"],settings:{base:{PRODUCT_BUNDLE_IDENTIFIER:"io.github.maeserbern.ingredientpartygame.uitests",GENERATE_INFOPLIST_FILE:"YES",SWIFT_VERSION:"5.0",CODE_SIGNING_ALLOWED:"NO"}}}},schemes:{GameQA:{build:{targets:{GameQA:"all"}},test:{targets:["GameQA"]}}}}))'
xcodegen generate --spec project.json
FAILED=0
while IFS=$'\t' read -r TAG DEVICE NAME; do
  echo "Testing $NAME ($DEVICE)"
  xcrun simctl boot "$DEVICE" || true
  xcrun simctl bootstatus "$DEVICE" -b
  xcrun simctl status_bar "$DEVICE" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100 || true
  xcrun simctl install "$DEVICE" "$APP"
  set +e
  xcodebuild test -project GameQA.xcodeproj -scheme GameQA -configuration Debug \
    -destination "platform=$XCODE_PLATFORM Simulator,id=$DEVICE" \
    -resultBundlePath "$ROOT/qa-output/$TAG.xcresult" \
    -derivedDataPath "$RUNNER_TEMP/qa-$QA_PLATFORM" \
    CODE_SIGNING_ALLOWED=NO > "$ROOT/qa-output/$TAG-test.log" 2>&1
  RESULT=$?
  set -e
  tail -n 70 "$ROOT/qa-output/$TAG-test.log"
  xcrun xcresulttool export attachments --path "$ROOT/qa-output/$TAG.xcresult" --output-path "$ROOT/qa-output/$TAG-images" || true
  xcrun simctl shutdown "$DEVICE" || true
  if [ "$RESULT" -ne 0 ]; then FAILED=1; fi
done < "$ROOT/qa-output/devices.tsv"
exit "$FAILED"
