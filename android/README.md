# Android app: phones, Google TV / Android TV, Fire TV

One app covers Android phones and tablets, Google TV / Android TV and Amazon
Fire TV. It shows the game from `../party-game` full screen, bundled inside the
app so it plays offline. Any change to the game is picked up by the next build.

## Getting the app files

GitHub builds the app automatically whenever `party-game/` or `android/` changes
(Actions tab → "Android app" → open the latest run → **Artifacts**):

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
passwords somewhere safe; you need the same key for every future update.

1. Create the key on your computer (Java's `keytool`):
   `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. In GitHub: repository → Settings → Secrets and variables → Actions → add:
   - `ANDROID_KEYSTORE_BASE64`: the key file as base64 (`base64 -w0 upload.jks`)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`
3. Re-run the "Android app" build. The store builds are now signed.

## Store listings

- **Google Play** (phones and Google TV): create the app in Play Console, upload
  `app-release.aab`, and opt in to the **Android TV** form factor. TV needs the
  1280×720 banner in `store/tv-banner-1280x720.png`, TV screenshots, and a review
  by Google's TV team.
- **Amazon Appstore** (Fire TV and Fire tablets): free developer account; upload
  `app-release.apk` and pick Fire TV devices.
- Store description, privacy note and category: see `../party-game/TV-STORES.md`.
  Privacy policy URL: https://maeserbern-ai.github.io/#privacy
