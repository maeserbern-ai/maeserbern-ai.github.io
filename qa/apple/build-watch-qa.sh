#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
test ! -d qa-reuse || { echo 'Watch-only QA must compile the current source'; exit 1; }
mkdir -p qa-output
xcrun simctl list devices available --json > qa-output/devices-available.json
git ls-tree -r HEAD watch-app | shasum -a 256 | awk '{print $1}' > qa-output/watch-source-digest.txt
node watch-app/scripts/export-data.mjs
git diff --exit-code -- watch-app/PartyGameWatch/Resources watch-app/PartyGameWatch/Assets.xcassets
cd qa/apple
npm ci --ignore-scripts --no-audit --no-fund
npm run check:books
node -e 'const fs=require("fs"); fs.writeFileSync("watch-build-project.json", JSON.stringify({name:"WatchAppQA",options:{deploymentTarget:{watchOS:"10.0"}},targets:{PartyGameWatch:{type:"application",platform:"watchOS",sources:[{path:"../../watch-app/PartyGameWatch",excludes:["Info.plist","expo-target.config.js"]}],settings:{base:{PRODUCT_BUNDLE_IDENTIFIER:"io.github.maeserbern.ingredientpartygame.watch",INFOPLIST_FILE:"../../watch-app/PartyGameWatch/Info.plist",MARKETING_VERSION:"1.0.0",CURRENT_PROJECT_VERSION:"1",SWIFT_VERSION:"5.0",ASSETCATALOG_COMPILER_APPICON_NAME:"AppIcon",CODE_SIGNING_ALLOWED:"NO"}}}},schemes:{PartyGameWatch:{build:{targets:{PartyGameWatch:"all"}}}}}))'
xcodegen generate --spec watch-build-project.json
xcodebuild build -project WatchAppQA.xcodeproj -scheme PartyGameWatch -configuration Release \
  -destination 'generic/platform=watchOS Simulator' -derivedDataPath "$RUNNER_TEMP/watch-books" \
  CODE_SIGNING_ALLOWED=NO > "$ROOT/qa-output/watch-app-build.log" 2>&1 || { tail -n 90 "$ROOT/qa-output/watch-app-build.log"; exit 1; }
APP="$RUNNER_TEMP/watch-books/Build/Products/Release-watchsimulator/PartyGameWatch.app"
test -s "$APP/Info.plist"
cd "$ROOT"
bash qa/apple/run-watch-qa.sh "$APP"
