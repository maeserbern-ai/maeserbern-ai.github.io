# Snack or Shampoo? — Apple Watch app

A solo, watch-only version of the Ingredient Dictionary party game.
SwiftUI, watchOS 10+, no iPhone companion app.

Bundle id: `io.github.maeserbern.ingredientpartygame.watch`
Version 1.0.0 (build 1).

## Layout

```
watch-app/
  project.yml                 XcodeGen spec (the .xcodeproj is generated, not committed)
  Config/Signing.xcconfig     automatic signing; DEVELOPMENT_TEAM supplied at build time
  ExportOptions.plist         app-store-connect export, destination = upload
  scripts/export-data.mjs     builds the JSON below from ../party-game/*.js
  PartyGameWatch/
    PartyGameWatchApp.swift   app entry + RootView (screen switcher)
    GameState.swift           scoring, shuffled deck, persisted score/streak
    Models.swift              Puzzle, regex rules, bundled data loader
    Theme.swift               colours + button style
    Views/                    StartView, CluesView, GuessView, ResultView
    Resources/                puzzles.json, glossary.json, watch.json (generated)
    Assets.xcassets/          single 1024x1024 watchOS app icon
```

## Updating the puzzles

The puzzle deck and glossary come from the web game. After editing
`party-game/puzzles.js` or `party-game/glossary.js`, run from the repo root:

```
node watch-app/scripts/export-data.mjs
```

and commit the regenerated JSON files. All puzzles are exported: the 4-option
ingredient labels and the 20 What Is Toilet Paper? true/false claims (played
with True/False buttons, worth 3 points like the web game's TF_POINTS).

## How CI builds it

The project is generated on a GitHub Actions macOS runner, so nothing
Xcode-specific is committed. The workflow does:

1. **Write the API key** — decode `ASC_KEY_P8_BASE64` to
   `~/private_keys/AuthKey_$ASC_KEY_ID.p8`.
2. **Generate the project** —
   ```
   brew install xcodegen
   cd watch-app && xcodegen generate
   ```
3. **Archive** (automatic signing, certificates/profiles created by Xcode via the API key):
   ```
   xcodebuild archive \
     -project PartyGameWatch.xcodeproj \
     -scheme PartyGameWatch \
     -configuration Release \
     -destination "generic/platform=watchOS" \
     -archivePath build/PartyGameWatch.xcarchive \
     -allowProvisioningUpdates \
     -authenticationKeyPath ~/private_keys/AuthKey_$ASC_KEY_ID.p8 \
     -authenticationKeyID "$ASC_KEY_ID" \
     -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
     DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
   ```
4. **Export and upload** — `ExportOptions.plist` uses method
   `app-store-connect` with `destination = upload`, so the export step uploads
   straight to App Store Connect / TestFlight:
   ```
   xcodebuild -exportArchive \
     -archivePath build/PartyGameWatch.xcarchive \
     -exportOptionsPlist ExportOptions.plist \
     -exportPath build/export \
     -allowProvisioningUpdates \
     -authenticationKeyPath ~/private_keys/AuthKey_$ASC_KEY_ID.p8 \
     -authenticationKeyID "$ASC_KEY_ID" \
     -authenticationKeyIssuerID "$ASC_ISSUER_ID"
   ```

Bump `CURRENT_PROJECT_VERSION` (build number) in `project.yml` for every
upload (or pass `CURRENT_PROJECT_VERSION=<n>` to `xcodebuild archive`);
App Store Connect rejects a repeated build number.

## App Store Connect setup (owner, one time)

This is a **separate app record** from the iPhone/iPad app. In App Store
Connect create a new app:

- Platform: **watchOS** (watch-only app)
- Bundle ID: `io.github.maeserbern.ingredientpartygame.watch`
  (register it first under Certificates, Identifiers & Profiles, or let the
  first automatic-signing archive register it)
- Name: e.g. "Snack or Shampoo?" (must be unique on the store)

The app declares `ITSAppUsesNonExemptEncryption = NO`, so no export
compliance questions per build.

## Required GitHub secrets

| Secret | What it is |
| --- | --- |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_KEY_P8_BASE64` | The `.p8` private key file, base64-encoded |
| `APPLE_TEAM_ID` | Apple Developer team ID (10 characters), passed as `DEVELOPMENT_TEAM` |

The API key needs the App Manager (or Admin) role so it can create signing
certificates/profiles and upload builds.

## Building locally on a Mac

```
cd watch-app
echo 'DEVELOPMENT_TEAM = YOURTEAMID' > Config/Local.xcconfig   # git-ignored
xcodegen generate
open PartyGameWatch.xcodeproj
```
