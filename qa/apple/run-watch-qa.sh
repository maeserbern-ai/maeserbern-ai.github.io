#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
if [ -d "$1/Watch" ]; then
  WATCH_APP=$(find "$1/Watch" -maxdepth 1 -name '*.app' -print -quit)
else
  WATCH_APP="$1"
fi
test -n "$WATCH_APP"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconName' "$WATCH_APP/Info.plist")" = AppIcon
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$WATCH_APP/Info.plist")" = io.github.maeserbern.ingredientpartygame.watch
test "$(/usr/libexec/PlistBuddy -c 'Print WKCompanionAppBundleIdentifier' "$WATCH_APP/Info.plist")" = io.github.maeserbern.ingredientpartygame
test "$(/usr/libexec/PlistBuddy -c 'Print WKRunsIndependentlyOfCompanionApp' "$WATCH_APP/Info.plist")" = true
test -s "$WATCH_APP/puzzles.json"
/usr/libexec/PlistBuddy -c Print "$WATCH_APP/Info.plist" > qa-output/embedded-watch-info.txt
node -e 'const fs=require("fs"); const runtime=".watchOS-"+(process.env.QA_WATCH_RUNTIME||"26-2"); const size=process.env.QA_WATCH_SIZE||"both"; if(!["both","small","large"].includes(size))throw Error("Unknown Watch size"); const all=Object.entries(JSON.parse(fs.readFileSync("qa-output/devices-available.json")).devices).filter(([k])=>k.endsWith(runtime)).flatMap(([,v])=>v).filter(d=>d.isAvailable); const pick=[[/SE.*40mm/,"watch-small"],[/Ultra.*49mm/,"watch-large"]].filter(([,tag])=>size==="both"||tag==="watch-"+size).map(([re,tag])=>{const d=all.find(d=>re.test(d.name)); if(!d)throw Error("Missing "+tag);return [tag,d.udid,d.name].join("\t")}); fs.writeFileSync("qa-output/watch-devices.tsv",pick.join("\n")+"\n")'
FIRST_ID=$(awk 'NR==1 {print $2}' qa-output/watch-devices.tsv)
cd qa/apple
node -e 'const fs=require("fs");fs.writeFileSync("watch-project.json",JSON.stringify({name:"WatchQA",options:{deploymentTarget:{watchOS:"10.0"}},targets:{WatchQA:{type:"bundle.ui-testing",platform:"watchOS",sources:["WatchScreensTests.swift"],settings:{base:{PRODUCT_BUNDLE_IDENTIFIER:"io.github.maeserbern.ingredientpartygame.watch.uitests",GENERATE_INFOPLIST_FILE:"YES",SWIFT_VERSION:"5.0",CODE_SIGNING_ALLOWED:"NO"}}}},schemes:{WatchQA:{build:{targets:{WatchQA:"all"}},test:{targets:["WatchQA"]}}}}))'
xcodegen generate --spec watch-project.json
xcodebuild build-for-testing -project WatchQA.xcodeproj -scheme WatchQA -configuration Debug \
  -destination "platform=watchOS Simulator,id=$FIRST_ID" -derivedDataPath "$RUNNER_TEMP/qa-watch" \
  CODE_SIGNING_ALLOWED=NO > "$ROOT/qa-output/watch-test-runner-build.log" 2>&1 || { tail -n 80 "$ROOT/qa-output/watch-test-runner-build.log"; exit 1; }
FAILED=0
while IFS=$'\t' read -r TAG DEVICE NAME; do
  xcrun simctl boot "$DEVICE" || true
  xcrun simctl bootstatus "$DEVICE" -b
  xcrun simctl install "$DEVICE" "$WATCH_APP"
  set +e
  xcodebuild test-without-building -project WatchQA.xcodeproj -scheme WatchQA -configuration Debug \
    -destination "platform=watchOS Simulator,id=$DEVICE" -parallel-testing-enabled NO \
    -collect-test-diagnostics never \
    -resultBundlePath "$ROOT/qa-output/$TAG.xcresult" -derivedDataPath "$RUNNER_TEMP/qa-watch" \
    CODE_SIGNING_ALLOWED=NO > "$ROOT/qa-output/$TAG-test.log" 2>&1
  RESULT=$?
  set -e
  tail -n 60 "$ROOT/qa-output/$TAG-test.log"
  xcrun xcresulttool export attachments --path "$ROOT/qa-output/$TAG.xcresult" --output-path "$ROOT/qa-output/$TAG-images" || true
  xcrun simctl shutdown "$DEVICE" || true
  if [ "$RESULT" -ne 0 ]; then FAILED=1; fi
done < "$ROOT/qa-output/watch-devices.tsv"
exit "$FAILED"
