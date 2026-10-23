# Ingredient Dictionary: The Party Game — getting it onto TVs

The game is a plain web app (HTML/CSS/JS). It needs no server, no accounts and no
database, so there is nothing to run or maintain once it's published.

## 1. On the web (free, works today)

Once this folder is merged into the site, the game is live at
**https://maeserbern-ai.github.io/party-game/**

Anyone can play it on a TV right away by:
- opening that link in a smart TV's web browser, or
- casting/screen-mirroring a laptop or phone (AirPlay, Chromecast, HDMI cable).

Play with a TV remote: arrows to move, the center OK button to pick, Back to pause.
On a computer, the arrow keys + Enter or a mouse work too.

**iPhone and iPad (no store needed):** open the game link in Safari, tap the Share
button → **Add to Home Screen**. It opens full screen like an app and keeps working
offline. Turn the phone sideways to play.

## 2. LG TVs (webOS) — free developer account

GitHub builds the LG app file for you: Actions → "App builds" → latest run →
**Artifacts** → `party-game-tv-packages` → the `.ipk` file.

1. Make a free account at the LG Seller Lounge (seller.lgappstv.com).
2. Upload the `.ipk` with screenshots and the description below, then submit it
   for review.
3. (Optional) Test on your own LG TV first: turn on Developer Mode on the TV and
   install the `.ipk` with LG's webOS TV tools.

## 3. Samsung TVs (Tizen) — free developer account

GitHub builds the Samsung app (`IngredientPartyGame-samsung-unsigned.wgt` in the
same `party-game-tv-packages` download). Samsung requires it to be signed with
certificates tied to your Samsung account, which only works on your computer:

1. Make a free account at Samsung Apps TV Seller Office (seller.samsungapps.com/tv).
2. Install Tizen Studio (Windows is fine) with the "TV Extensions" add-on.
3. In Tizen Studio's Certificate Manager, create a **Samsung** certificate
   (it signs you in with your Samsung account).
4. Import the `party-game` folder as a TV web project and build a signed `.wgt`
   (Project → Build Signed Package).
5. Upload the `.wgt` in Seller Office and submit it for review.

## 4. Google TV / Android TV and Amazon Fire TV

The Android app in `../android` covers Android phones, Google TV / Android TV and
Fire TV. GitHub builds it automatically; see `../android/README.md` for test
installs, the one-time upload key, and the Google Play and Amazon Appstore steps.

## 5. Apple: iPhone and iPad App Store

`../apple-app` is an Expo app, built the same way as CueReady AI. On your Windows
computer, open the `apple-app` folder and double-click **BUILD_AND_UPLOAD_IOS.cmd**.
Expo builds it in the cloud (no Mac needed) and uploads it to App Store Connect /
TestFlight. The first time, it asks for your Apple login and creates the new app,
its certificate and profile. Your other apps are not touched.
Then finish the listing in App Store Connect (screenshots, description below,
privacy URL https://maeserbern-ai.github.io/#privacy) and submit for review.

## 6. Apple TV

Today: play on Apple TV with **AirPlay** (iPhone, iPad or Mac → Screen Mirroring).
A real Apple TV app needs the game rebuilt in Apple's own tools, because Apple TV
apps can't show web pages. That's a bigger project for later.

## 7. VIZIO TVs (SmartCast) — partner approval needed

VIZIO apps are web pages that VIZIO loads from your own hosting, so there is no
file to upload. The VIZIO version is `tv/vizio/` in this folder. Once merged it is
live at **https://maeserbern-ai.github.io/party-game/tv/vizio/**. It runs the same
game files and adds VIZIO's remote and text-to-speech support:

- Back on the title screen closes the app (VIZIO's `exitApplication`); during a
  game Back still pauses, like on the other TVs.
- The Exit key closes the app, and Play/Pause pauses and resumes a round.
- When the TV's text-to-speech is on, screens and the selected button are read out.

Next steps happen with VIZIO: they reply to the partner application, register
the app (they ask for test and live URLs — both can be the link above), switch a
test TV to developer mode, send their pre-certification checklist, and review the
submission. Store art and the listing text are in `PartyGame-StoreExtras/vizio`.

## Store listing text (copy/paste)

**Name:** Ingredient Dictionary: The Party Game

**Short description:** Snack or Shampoo? Guess the product from its ingredient list.

**Full description:**
Gather the family and find out who really knows what's in their stuff. Each round
shows the start of a real-style ingredient list — candy, cleaners, shampoo, dog
treats, whipped cream and more. Pick any Ingredient Dictionary book —
It's Not Food, It's Not Beauty, It's Not Clean, It's Not for Kids or Your Home Is
Not Safe — or mix them all. Every game ends with a What Is Toilet Paper?
true-or-false finale where teams bet their points. Miss a question and the first
team to yell "STEAL!" gets a shot at half the points. Pick Easy, Medium or Hard — harder
levels start from the obscure chemicals at the bottom of the label and score more.
Stuck on an ingredient? Select it to see what it is. Red and amber highlights
show which ingredients are worth knowing about and which hide what's inside. Guess the product with as few clues as possible to
score big. Every answer comes with a "weird ingredient" fact you'll be repeating
at dinner. Optional answer timer, 1–4 teams, plays entirely with your remote. From the Ingredient
Dictionary book series by Maeser.

**Category:** Games → Trivia / Family

## Before you submit — check these

- Store rules and required screenshot sizes change; check each store's current
  checklist when you upload.
- Ingredient lists are representative of typical products, not any specific brand.
  Keep it that way (no brand names or logos) to avoid trademark problems.
- Each store asks for a privacy policy link. This game collects no data; the
  privacy section on maeserbern-ai.github.io can be updated to say so.

## Adding more puzzles

Open `puzzles.js` and copy any `{ ... }` block. Each puzzle needs: the answer, four
options (one is the answer), `kind` ("food" or "not"), the ingredient list in label
order, a spotlight fact, and which book it belongs to (`food`, `beauty`, `clean`,
`kids` or `home`). The book picker counts puzzles automatically.

## Ingredient help text

`glossary.js` holds the plain-English "what is it?" text players see when they select an
ingredient. If you add a puzzle with a new ingredient, add a line there too.
