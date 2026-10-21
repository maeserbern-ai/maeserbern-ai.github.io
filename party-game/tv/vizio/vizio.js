/* VIZIO SmartCast adapter for Ingredient Dictionary: The Party Game.
   Loads the normal game (index.html, style.css, puzzles.js, glossary.js, game.js)
   unchanged, then adds what VIZIO needs on top:
   - the VIZIO Companion Library (only present on VIZIO TVs; ignored elsewhere),
   - Back on the title screen closes the app with window.VIZIO.exitApplication(),
   - the remote's Exit key closes the app from anywhere,
   - Play/Pause opens and closes the game's pause menu during a round,
   - spoken feedback through VIZIO's text-to-speech when the TV has it switched on.
   In a normal browser it behaves exactly like the regular game. */
(function () {
  "use strict";

  // VIZIO serves its library from the TV itself.
  var VIZIO_LIB = "http://localhost:12345/scfs/cl/js/vizio-companion-lib.js";
  var GAME_SCRIPTS = ["puzzles.js", "glossary.js", "game.js"];

  var state = { libLoaded: false, tts: false, spoken: [] };
  window.vizioAdapter = state;   // handy for testing on a TV with the remote debugger

  function hasVizio() { return !!(window.VIZIO && typeof window.VIZIO === "object"); }
  function exitApp() {
    try {
      if (hasVizio() && typeof window.VIZIO.exitApplication === "function") { window.VIZIO.exitApplication(); return true; }
    } catch (e) { /* not on a VIZIO TV */ }
    return false;
  }

  /* ---------- 1. bind VIZIO events BEFORE loading the library (VIZIO's rule) ---------- */
  document.addEventListener("VIZIO_LIBRARY_DID_LOAD", function () { state.libLoaded = true; }, true);
  document.addEventListener("VIZIO_TTS_ENABLED", function () { state.tts = true; speakNow(); }, false);
  document.addEventListener("VIZIO_TTS_DISABLED", function () { state.tts = false; }, false);

  /* ---------- 2. remote keys (runs before the game's own key handler) ---------- */
  var BACK = { 8: 1, 27: 1, 166: 1, 461: 1, 10009: 1 };   // Backspace (VIZIO Back), Esc, BrowserBack, LG, Samsung
  var PLAY_PAUSE = { 19: 1, 179: 1, 415: 1, 10252: 1 };   // Pause, MediaPlayPause, Play, Samsung Play/Pause
  var $ = function (s) { return document.querySelector(s); };
  function active(id) { var el = document.getElementById(id); return !!(el && el.classList.contains("active")); }
  function modalOpen() {
    return Array.prototype.some.call(document.querySelectorAll(".modal"), function (m) { return !m.hidden; });
  }
  // Hand a key to the game as one it already understands (Esc = Back).
  function sendGameKey(keyCode, key) {
    var ev = new KeyboardEvent("keydown", { key: key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "keyCode", { get: function () { return keyCode; } });
    Object.defineProperty(ev, "which", { get: function () { return keyCode; } });
    ev.vizioForwarded = true;
    document.dispatchEvent(ev);
  }
  window.addEventListener("keydown", function (e) {
    if (e.vizioForwarded) return;
    var code = e.keyCode, key = e.key;
    var isExit = key === "Exit" || (window.VK_EXIT !== undefined && code === window.VK_EXIT);
    var isBack = BACK[code] || key === "GoBack" || key === "BrowserBack";
    var isPlayPause = PLAY_PAUSE[code] || key === "MediaPlayPause" || key === "MediaPlay" || key === "MediaPause";

    if (isExit) {
      if (exitApp()) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (isBack) {
      // On the title screen (no menu open) Back leaves the app, like on LG/Samsung.
      if (active("s-title") && !modalOpen()) {
        e.preventDefault();
        if (exitApp()) e.stopImmediatePropagation();
        return;
      }
      // Codes the game doesn't know yet get passed on as Esc.
      if (code === 166 || key === "GoBack" || key === "BrowserBack") {
        if (code !== 8 && code !== 27) { e.preventDefault(); e.stopImmediatePropagation(); sendGameKey(27, "Escape"); }
      }
      return;
    }
    if (isPlayPause) {
      e.preventDefault(); e.stopImmediatePropagation();
      // During play, Play/Pause works like the game's Menu / Back: pause and resume.
      if ((active("s-round") || active("s-result")) && (!modalOpen() || !$("#m-quit").hidden)) sendGameKey(27, "Escape");
    }
  }, true);

  /* ---------- 3. text-to-speech ---------- */
  var pending = null, lastScreen = null, lastModal = false;
  function clean(t) { return (t || "").replace(/\s+/g, " ").trim(); }
  function labelOf(el) {
    if (!el) return "";
    return clean(el.getAttribute("aria-label") || el.innerText || el.textContent || el.getAttribute("alt"));
  }
  function screenIntro() {
    var screen = document.querySelector(".screen.active");
    if (!screen) return "";
    var quit = $("#m-quit"), steal = $("#m-steal");
    var parts = [];
    if (steal && !steal.hidden) parts.push(labelOf(steal.querySelector("h3")), labelOf($("#steal-sub")));
    else if (quit && !quit.hidden) parts.push("Game paused");
    else if (screen.id === "s-round") {
      parts.push(labelOf($("#turn")));
      var st = $("#statement");
      if (st && !st.hidden) parts.push(labelOf(st));
      else {
        var shown = Array.prototype.filter.call(document.querySelectorAll("#ingredients li"), function (li) { return !li.classList.contains("hidden"); })
          .map(function (li) { return labelOf(li); });
        if (shown.length) parts.push("Ingredients: " + shown.join(", "));
      }
    } else if (screen.id === "s-result") {
      parts.push(labelOf($("#verdict")), labelOf($("#r-answer")), labelOf($("#r-spot-name")), labelOf($("#r-spot-note")));
    } else if (screen.id === "s-final") {
      parts.push(labelOf($("#winner")));
    } else {
      parts.push(labelOf(screen.querySelector("h1, h2")));
    }
    return parts.filter(Boolean).join(". ");
  }
  function speak(text) {
    text = clean(text);
    if (!text) return;
    state.spoken.push(text);
    if (state.spoken.length > 50) state.spoken.shift();
    try {
      if (state.tts && hasVizio() && window.VIZIO.Chromevox && typeof window.VIZIO.Chromevox.play === "function") window.VIZIO.Chromevox.play(text);
    } catch (e) { /* TTS is best effort */ }
  }
  // Read the new screen's heading (if the screen changed), then the focused item.
  function speakNow() {
    pending = null;
    if (!state.tts) return;
    var screen = document.querySelector(".screen.active");
    var id = screen ? screen.id : null;
    var modal = modalOpen();
    var intro = id !== lastScreen || modal !== lastModal ? screenIntro() : "";
    lastScreen = id; lastModal = modal;
    var focus = document.querySelector(".focus");
    speak([intro, labelOf(focus)].filter(Boolean).join(". "));
  }
  function queueSpeak() { if (!pending) pending = setTimeout(speakNow, 120); }
  document.addEventListener("focusin", queueSpeak);

  /* ---------- 4. load the normal game, then the VIZIO library ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  function loadVizioLibrary() {
    if (/[?&]novizio\b/.test(location.search)) return;
    var s = document.createElement("script");
    s.src = VIZIO_LIB;
    s.onerror = function () { /* not a VIZIO TV: keep playing as a web game */ };
    document.body.appendChild(s);
  }
  function showError() {
    var sp = document.getElementById("vz-splash");
    if (sp) sp.innerHTML = "<b>The Party Game</b>Couldn't load. Check the TV's internet connection and try again.";
  }

  fetch("index.html", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      // Same fonts and stylesheet as the regular game.
      Array.prototype.forEach.call(doc.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]'), function (l) {
        document.head.appendChild(document.importNode(l, true));
      });
      // Same screens (book links and QR codes included), minus the scripts.
      var stage = doc.getElementById("stage");
      document.body.insertBefore(document.importNode(stage, true), document.body.firstChild);
      return GAME_SCRIPTS.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
    })
    .then(function () {
      var sp = document.getElementById("vz-splash");
      if (sp) sp.remove();
      document.documentElement.classList.add("vizio");
      loadVizioLibrary();
    })
    .catch(showError);
})();
