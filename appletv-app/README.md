# Ingredient Dictionary: The Party Game — Apple TV app

A native tvOS version of the web party game in `../party-game/`. tvOS has no WebView,
so this is a real React Native app (Expo SDK 54 + `react-native-tvos` 0.81) that plays
the same game with the same rules, screens, wording, scoring and colors, driven by the
Siri Remote:

- **Swipe or press the edges of the touch surface** to move the gold focus ring.
- **Click** to choose.
- **Back / Menu** goes back (on the title screen it returns to the Apple TV Home screen).
  During a round it opens the pause menu, like the web game's Back key.

It uses the same bundle ID as the iPhone app (`io.github.maeserbern.ingredientpartygame`),
so it becomes the Apple TV version of the same App Store listing (universal purchase).

## What's in here

| Path | What it is |
| --- | --- |
| `App.js` | All screens (title, how to play, books, setup, team colors, round, steal, pause, answer, final) |
| `src/logic.js` | The game rules ported from `party-game/game.js` (no React Native imports) |
| `src/data.js` | **Generated** from `party-game/puzzles.js` + `glossary.js` |
| `src/ui.js` | Colors, focusable buttons with the gold focus ring, confetti, CORRECT!/WRONG! stamp |
| `src/sound.js` | Sound effects + music through `expo-audio` |
| `src/storage.js` | Remembers sound/music choice and puzzles already played (NSUserDefaults) |
| `assets/audio/` | **Generated** WAVs: the web game's synthesized sounds and music, pre-rendered |
| `assets/covers/`, `assets/qr/` | **Generated** book covers and QR codes (SVG converted to PNG) |
| `assets/tv/` | Apple TV app icon + Top Shelf images (from the store pictures) |
| `test/logic.test.mjs` | Rule checks: `npm test` |

## Keeping it in sync with the web game

```
npm run import-data     # puzzles, glossary, covers, QR codes from ../party-game
npm run render-audio    # only if the sound recipes in game.js change (then update scripts/render-audio.mjs too)
npm test
```

`import-data` also runs automatically after `npm install`. If `../party-game` is not
there (for example on a machine with only this folder), it keeps the committed files.

The Apple TV icon and Top Shelf images are made once on Windows with
`powershell -ExecutionPolicy Bypass -File scripts/make-tv-images.ps1`
(reads `Downloads\PartyGame-StorePictures\tv-banner-1280x720.png` and `icon-512.png`).

## Building and uploading

Builds run on Expo's Mac servers (EAS), so this works from Windows:

```powershell
cd appletv-app
npm install
$env:EXPO_TV='1'; eas build -p ios --profile production --auto-submit
```

`eas.json` already sets `EXPO_TV=1` for the build, and `app.json` sets the
`@react-native-tvos/config-tv` plugin to `isTV: true`, so EAS generates an Apple TV
(tvOS) Xcode project. The build number counts up automatically (`appVersionSource: remote`).

The first time, EAS asks to create an Expo project for this folder (slug
`ingredient-party-game-tv`) and to log in to your Apple account for signing.

### App Store Connect

The iPhone app's record already exists. Before the first upload, open it in
App Store Connect and **add the tvOS platform** (App → "+" next to iOS → tvOS, or
"Add Platform"). Then the tvOS build appears under the Apple TV section of the same app.
Apple TV needs its own screenshots (1920×1080 or 3840×2160) and, if you want, a Top Shelf
image is already inside the app.

If `--auto-submit` cannot find the app, add `"ascAppId": "<the app's Apple ID number>"`
under `submit.production.ios` in `eas.json` (App Store Connect → App Information → Apple ID).

## Checking on Windows (no Apple TV needed)

```
npm test                       # game rules
npm run config                 # Expo config with EXPO_TV=1
npm run bundle                 # builds the JavaScript bundle for iOS/tvOS into dist/
```
