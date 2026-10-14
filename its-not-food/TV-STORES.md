# It's Not Food — getting it onto TVs

The game is a plain web app (HTML/CSS/JS). It needs no server, no accounts and no
database, so there is nothing to run or maintain once it's published.

## 1. On the web (free, works today)

Once this folder is merged into the site, the game is live at
**https://maeserbern-ai.github.io/its-not-food/**

Anyone can play it on a TV right away by:
- opening that link in a smart TV's web browser, or
- casting/screen-mirroring a laptop or phone (AirPlay, Chromecast, HDMI cable).

Use the arrow keys + Enter (or a TV remote). Keys 1–4 pick answers, R reveals a clue.

## 2. LG TVs (webOS) — free developer account

This folder already contains `appinfo.json`, which makes it an LG app.

1. Make a free account at the LG Seller Lounge (seller.lgappstv.com).
2. Install the webOS TV CLI ("ares" tools) on your computer.
3. From the folder that contains `its-not-food`, run:
   `ares-package its-not-food` → this creates an `.ipk` file.
4. (Optional) Test on your own LG TV: turn on Developer Mode on the TV, then
   `ares-install` the `.ipk`.
5. Upload the `.ipk` in the Seller Lounge with screenshots and a description,
   then submit it for review.

## 3. Samsung TVs (Tizen) — free developer account

This folder already contains `config.xml`, which makes it a Samsung TV app.

1. Make a free account at Samsung Apps TV Seller Office (seller.samsungapps.com/tv).
2. Install Tizen Studio with the TV extension, and create an author certificate
   (Tizen Studio walks you through it).
3. Import this folder as a TV web project and build a signed `.wgt` package.
4. (Optional) Test on your own Samsung TV in Developer Mode.
5. Upload the `.wgt` in Seller Office and submit it for review.

## 4. Google TV / Android TV and Amazon Fire TV

These stores need an Android app. The easiest route is a small "wrapper" app that
shows this web game full-screen (a WebView). You already have a Google Play
developer account, and an Amazon developer account is free. Ask Claude to build
the Android TV wrapper as the next step.

## 5. Apple TV

Apple TV apps must be built in Xcode on a Mac with your existing Apple Developer
account. tvOS has no built-in web view, so the game would need to be rebuilt in
Swift. Ask Claude for the Swift version when you're ready.

## Store listing text (copy/paste)

**Name:** It's Not Food — The Party Game

**Short description:** Snack or shampoo? Guess the product from its ingredient list.

**Full description:**
Gather the family and find out who really knows what's in their stuff. Each round
shows the start of a real-style ingredient list — candy, cleaners, shampoo, dog
treats, whipped cream and more. Guess the product with as few clues as possible to
score big. Every answer comes with a "weird ingredient" fact you'll be repeating
at dinner. 1–4 teams, plays entirely with your remote. From the Ingredient
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
order, a spotlight fact, and which book it belongs to.
