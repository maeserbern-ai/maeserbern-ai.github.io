#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
mkdir -p qa-output/watch-icon-compiled
cd apple-app
npm ci
npx expo prebuild --platform ios --no-install
cd "$ROOT"
node qa/apple/check-watch-icon-config.cjs
xcrun actool watch-app/PartyGameWatch/Assets.xcassets \
  --compile qa-output/watch-icon-compiled --output-format human-readable-text \
  --notices --warnings --output-partial-info-plist qa-output/watch-icon-info.plist \
  --app-icon AppIcon --compress-pngs --development-region en \
  --target-device watch --minimum-deployment-target 10.0 --platform watchos \
  --bundle-identifier io.github.maeserbern.ingredientpartygame.watch \
  > qa-output/watch-icon-compilation.log 2>&1
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconName' qa-output/watch-icon-info.plist)" = AppIcon
test -s qa-output/watch-icon-compiled/Assets.car
/usr/libexec/PlistBuddy -c Print qa-output/watch-icon-info.plist
echo 'Watch icon configuration and device asset compilation passed.'
