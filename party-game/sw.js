// Lets the game install to a phone's home screen and play offline.
// Bump VERSION whenever the game files change so players get the update.
const VERSION = "party-game-1";
const FILES = [
  "./",
  "apple-touch-icon.png",
  "covers/it-s-not-beauty.jpg",
  "covers/it-s-not-clean.jpg",
  "covers/it-s-not-food.jpg",
  "covers/it-s-not-for-kids.jpg",
  "covers/what-is-toilet-paper.jpg",
  "covers/your-home-is-not-safe.jpg",
  "game.js",
  "glossary.js",
  "icon-130.png",
  "icon-192.png",
  "icon-512.png",
  "icon-80.png",
  "icon-samsung.png",
  "index.html",
  "manifest.webmanifest",
  "puzzles.js",
  "qr-all.svg",
  "qr-beauty.svg",
  "qr-clean.svg",
  "qr-food.svg",
  "qr-home.svg",
  "qr-kids.svg",
  "qr-tp.svg",
  "style.css",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first (so updates show up), falling back to the saved copy offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
