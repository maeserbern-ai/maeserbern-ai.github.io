# Ingredient Dictionary The Party Game — Roku channel

A native Roku channel (BrightScript + SceneGraph) of the party game in
`../party-game/`, by Maeser. Short name where space is limited:
**Ingredient Party Game**.

It is a port of the web game's real game loop for the Roku remote:

- Title screen: Play / How to play / Sound / Music. **Back on the title screen exits the channel.**
- Pick a book (6 books) or **Mix all books**.
- Game setup: Solo or 2–4 teams, 3/5/8 rounds per team, Easy/Medium/Hard,
  answer timer, steals, loser's dare, sound, music.
- Team colors (#E07A55 orange, #6FA3D9 blue, #B392D6 purple, #6CC596 green) and a shuffled turn order.
- Rounds: the ingredient label starts with 3 ingredients showing; **Next ingredient**
  (or selecting a covered box) reveals one more and lowers the points; selecting an
  ingredient shows its glossary definition for free; red = worth knowing, amber = not fully disclosed;
  4 answer choices; rising stakes every lap; last round counts double; optional timer with a one-time +15 sec.
- CORRECT!/WRONG! stamp, steals ("___ yelled first"), true/false questions for
  *What Is Toilet Paper?*, and the toilet-paper betting finale.
- Answer screen with the **weird ingredient spotlight**, the "ingredients to know about" list and the book cover.
- Final scores with the winner, the **loser's dare** (with "New dare"), and the
  **book promo: the book's QR code with its cover in the middle and "Get <book> on Amazon →"**
  ("See all the books →" with the series QR when all books were mixed). The QR codes and
  book promotion are part of the game and must stay.
- **Back during a game opens the pause menu** (Resume, Sound, Music, Timer, Steals,
  Change game, Quit). The `*` (options) button also opens it.
- Look: background #16211C, orange #E07A55, gold #F2C46B, cream #F4F3EE,
  Fraunces headings and Inter body text, 1920×1080 (FHD) inside the TV safe area.
- Settings (sound, music) and the "already played" puzzle list are saved on the Roku
  (roRegistry), so puzzles don't repeat until a book has been fully played — same as the web game.

## Folder layout

| Path | What it is |
| --- | --- |
| `manifest` | Channel title, version 1.0.1, icons, splash, `ui_resolutions=fhd` |
| `source/main.brs` | Entry point (`Main(args)`): opens the scene, ignores deep-link args safely, exits when the title screen's Back is pressed |
| `components/MainScene.xml` | The single SceneGraph scene |
| `components/MainScene.brs` | Start-up, remote keys, actions, saved settings, sound/music, timers, confetti, pause + steal menus |
| `components/Screens.brs` | Title, how to play, book picker, setup, team colors / turn order |
| `components/Game.brs` | Game loop ported from `party-game/game.js`, round/answer/final screens |
| `components/Kit.brs` | Drawing helpers: fonts, text measuring and wrapping, rounded shapes, focus + D-pad navigation |
| `data/game.json` | Books, puzzles, glossary text and watch-list tags, dares (generated) |
| `data/metrics.json` | Character widths of the bundled fonts (generated) |
| `images/` | Covers, QR codes, rounded 9-patch shapes, channel icons, splash (generated) |
| `fonts/` | Fraunces + Inter (SIL Open Font License, see `OFL-*.txt`) |
| `sounds/` | Sound effects (WAV) and the two music loops (MP3), rendered from the web game's synth code |
| `tools/` | The generators (not part of the channel zip) |

## Regenerating the generated files

Run from the repository root whenever `party-game/` changes:

```sh
node roku-channel/tools/build-data.js          # data/game.json from puzzles.js, glossary.js, game.js (dares)
python roku-channel/tools/make-assets.py       # covers, QR PNGs, 9-patches, icons, splash, data/metrics.json (needs pillow + fonttools)
npm install --no-save node-web-audio-api       # once, anywhere; then:
node roku-channel/tools/render-audio.mjs       # sounds/*.wav + theme.mp3/suspense.mp3 (needs ffmpeg on PATH)
```

`build-data.js` runs the web game's own regex lookups (`glossaryFor`, `watchInfo`) once,
so the channel doesn't need a regex engine. It also checks that every character is in the bundled fonts.
The GitHub workflow fails if `data/game.json` is out of date.

### Fonts

Fraunces (© The Fraunces Project Authors) and Inter (© The Inter Project Authors) come
from the Google Fonts repository and are licensed under the SIL Open Font License 1.1,
which allows bundling them in an app. The files here are static instances
(Fraunces Black 144pt, Black Italic, SemiBold; Inter Medium, Bold, ExtraBold) made with
`fontTools.varLib.instancer`, subset to Latin, and given unique family names
(e.g. "Fraunces Black") so each weight loads as its own font. Neither font declares a
Reserved Font Name. The license texts are in `fonts/OFL-Fraunces.txt` and `fonts/OFL-Inter.txt`.

### Sound

Roku can't synthesize Web Audio, so `tools/render-audio.mjs` copies the web game's
`tone()`/`noise()`/`SFX` and music code and renders it offline. Sound effects play through
SceneGraph `SoundEffect` nodes (WAV, from `pkg:/sounds/`), music through an `Audio` node
looping an MP3. Sound and Music can be switched off on the title screen, in setup and in the pause menu.

## Build and check

GitHub Actions (`.github/workflows/roku-channel.yml`) runs on every push to the
`roku-channel` branch (and by hand from the Actions tab):

1. `npx bsc --project bsconfig.json` — BrighterScript compiler + `@rokucommunity/bslint` static check.
2. Rebuilds `data/game.json` and fails if it differs from the committed file.
3. Zips `manifest source components images fonts data sounds` into
   **`ingredient-party-game-roku.zip`** and uploads it as the workflow artifact.

Local check: `cd roku-channel && npm ci && npx bsc --project bsconfig.json`.

## Putting it on a Roku and submitting it to the Roku Channel Store

Roku's Channel Store takes a **signed package (`.pkg`) that you make on your own Roku in
Developer Mode** — the zip from GitHub is for sideloading/testing and is what you package.
(The developer dashboard's upload box is labeled ".pkg or .zip", but Roku's publishing guide
says to upload the package file created with the Development Application Installer, and
packaging — encrypting and signing the channel — only happens on a Roku device.)

### 1. Turn on Developer Mode (once per Roku)

1. On the Roku remote press **Home ×3, Up ×2, Right, Left, Right, Left, Right**.
2. Note the IP address it shows (e.g. `192.168.1.42`), choose **Enable installer and restart**,
   accept the developer agreement, and **set a webserver password** (user name is `rokudev`).
3. The Roku must be linked to the same Roku account you'll publish with.

### 2. Sideload and test

1. On a computer on the same Wi-Fi, open `http://<roku-ip>` in a browser and sign in as `rokudev`.
2. **Upload** `ingredient-party-game-roku.zip` and click **Install with zip**. The game opens on the TV.
3. Play a full game: book picker, 2+ teams with steals, timer on, the toilet-paper finale bet,
   final screen QR codes (scan one with a phone), Back from the title screen (should exit),
   Back during a game (pause menu), Sound/Music toggles.

### 3. Make a signing key (once per Roku, keep it forever)

1. Open a Telnet session to the Roku on port 8080 (Windows: enable "Telnet Client" in
   Windows Features, then `telnet <roku-ip> 8080`).
2. Type `genkey`. It prints a **Password** and a **DevID**. Save both somewhere safe —
   every future update must be signed with the same key (or re-keyed from a previous package + password).

### 4. Package

1. With the channel sideloaded, go to `http://<roku-ip>` → **Packager** (Utilities → Packager).
2. App name: `Ingredient Dictionary The Party Game`, version `1.0.1`, enter the genkey password,
   click **Package**, then download the `.pkg` file.

### 5. Submit

1. Developer dashboard (developer.roku.com) → **Create a new app / channel** → SDK (BrightScript).
2. Fill in the store listing from `PartyGame-StoreExtras/roku/roku-listing.txt`
   (description, category, age rating, keywords), upload the poster (540×405) and up to six
   1920×1080 screenshots from the same folder.
3. **Package upload**: upload the `.pkg`, set the minimum firmware the dashboard asks for
   (not squashfs-compressed, so no special requirement), run **Static Analysis** and
   **App Behavior Analysis** in the dashboard, fix anything they flag.
4. **Schedule Publish** (earliest is about two business days out; not Fridays/weekends), check the
   two confirmation boxes and submit. Roku reviews it against its certification criteria.

For each update: bump `build_version` (and `minor_version` as needed) in `manifest`,
sideload the new zip, package with the **same** key, and upload the new `.pkg`.

## Certification notes

- `AppLaunchComplete` beacon is signalled as soon as the title screen is drawn (launch < 15 s; the channel is ~1.6 MB with no network calls).
- Back on the home (title) screen exits; Back inside the game opens the pause menu; no screen traps the user except the steal question, which always offers "No steal — show the answer".
- Deep-link launch parameters (`contentId`, `mediaType`) and `roInput` events are accepted and ignored (there is no deep-linkable content).
- No network access, no accounts, no purchases, no video, no third-party ads.
- The final screen shows the developer's own book with a QR code and an "on Amazon" line.
  Roku's published certification criteria don't forbid this for SDK channels, but reviewers
  can ask about off-platform links; the owner wants the book promotion kept.

## What has been tested

No physical Roku was available. The channel was:

- compiled and linted with BrighterScript 0.73.7 + bslint 0.8.47 (0 errors, 0 warnings);
- run end-to-end in the **brs-engine 2.6.1 + brs-scenegraph 0.6.1** simulator in headless
  Chrome at 1920×1080: title, how to play, books, setup, team colors, shuffled order, rounds with
  reveals and glossary help, timer, WRONG!/CORRECT! stamps, steals (including chains), the
  toilet-paper bets, answer screens, final scores with the dare and the QR/Amazon promo,
  Play again, pause menu toggles, and Back-from-title exit (`EXIT_USER_NAV`).

Not tested: a real Roku (performance on low-end models, `SoundEffect`/`Audio` playback and
loop gap, font rendering, remote key repeat), Roku's dashboard Static Analysis / App Behavior Analysis.
