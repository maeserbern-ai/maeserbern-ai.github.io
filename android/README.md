# Android app: phones, Google TV / Android TV, Fire TV

One app covers Android phones and tablets, Google TV / Android TV and Amazon
Fire TV. It shows the game from `../party-game` full screen, bundled inside the
app so it plays offline. Any change to the game is picked up by the next build.

## Getting the app files

GitHub builds the app automatically whenever `party-game/` or `android/` changes.
The latest files are always on the repository's **Releases** page
("Party game app files"), which never expires. Each build's own downloads are
under Actions → "App builds" → **Artifacts**:

- **party-game-test-apk**: a test version you can install on your own phone or TV.
- **party-game-store-builds**: `app-release.aab` for Google Play and
  `app-release.apk` for the Amazon Appstore. These are signed only once the upload
  key below is set up.

## Try it on your own devices

- **Android phone:** copy the test `.apk` to the phone, open it and allow
  "install unknown apps" when asked.
- **Fire TV:** install the free *Downloader* app, turn on
  Settings → My Fire TV → Developer options → Install unknown apps, then open
  the `.apk` from a link in Downloader.
- **Google TV / Android TV:** use the *Send Files to TV* app, or ADB.

## Upload key (needed once, before store uploads)

Store builds must be signed with your own private key. Keep the key file and its
password somewhere safe; you need the same key for every future update.

Add it to GitHub as ONE secret: repository → Settings → Secrets and variables →
Actions → New repository secret, named `ANDROID_UPLOAD_KEY`, with the value
`password:base64-of-the-keystore` (alias `upload`). The next build is then signed.

## Store listings

- **Google Play** (phones and Google TV): create the app in Play Console, upload
  `app-release.aab`, and opt in to the **Android TV** form factor. TV needs the
  1280×720 banner in `store/tv-banner-1280x720.png`, TV screenshots, and a review
  by Google's TV team.
- **Amazon Appstore** (Fire TV and Fire tablets): free developer account; upload
  `app-release.apk` and pick Fire TV devices.
- Store description, privacy note and category: see `../party-game/TV-STORES.md`.
  Privacy policy URL: https://maeserbern-ai.github.io/#privacy

## Meta Quest (Horizon OS)

The Quest version is the same app built with `gradle -p android -Pquest assembleRelease`
(workflow **Quest build**, `.github/workflows/quest-build.yml`). It is 64-bit only,
targets API 34 (Meta's rule for new apps), declares the Quest headsets in
`app/src/quest/AndroidManifest.xml`, opens as a 1280x720dp landscape panel and has
no home-screen widget. `QuestActivity` adds controller buttons: A/X = OK,
B/Y = Back, thumbstick = arrows; pointing + trigger or pinch works as taps.
Download `PartyGame-MetaQuest.apk` from the run's Artifacts and upload it in the
Meta Horizon Developer Dashboard as a 2D app (versionCode = 3000000 + run number).
