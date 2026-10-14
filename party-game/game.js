/* It's Not Food — game logic + TV remote navigation. No build step, no server. */
(function () {
  "use strict";

  const START_SHOWN = 3;   // ingredients visible when a round starts
  const MAX_POINTS = 5;    // points if answered with only the starting clues
  const TF_POINTS = 3;     // a true/false question
  const TEAM_NAMES = ["Team Orange", "Team Blue", "Team Purple", "Team Green"];
  const TEAM_COLORS = ["var(--team1)", "var(--team2)", "var(--team3)", "var(--team4)"];
  const TEAM_COLORS_HEX = ["#E07A55", "#6FA3D9", "#B392D6", "#6CC596"];
  // Teams are numbered 0..n-1 in a game; game.colors says which color each one picked.
  const teamName = (t) => TEAM_NAMES[game.colors[t]];
  const teamColor = (t) => TEAM_COLORS[game.colors[t]];
  const teamHex = (t) => TEAM_COLORS_HEX[game.colors[t]];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const settings = { teams: 2, rounds: 5, book: "all", dare: 1, level: 1, timer: 0, steal: 1, colors: [0, 1] };
  const STEAL_SECONDS = 10;
  const TIMER_SECONDS = { 1: 60, 2: 45, 3: 30 };   // Easy / Medium / Hard

  // Silly, safe dares for the last-place team. Nothing here involves eating or
  // touching a product — the game is about labels, not tasting.
  const DARES = [
    "Read the ingredients of the nearest product out loud in your best sports-announcer voice.",
    "Film a 15-second shampoo commercial. Hair flip required.",
    "Sell the winners a bottle of dish soap like it's a fancy wine.",
    "Say \"sodium laureth sulfate\" five times fast.",
    "Try to say \"methylisothiazolinone\" three times in a row without laughing.",
    "Do a dramatic slow-motion gasp, as if you just found Red 40 in your cereal.",
    "Compliment each winner using only ingredient names.",
    "Sing the ingredient list of any product to the tune of \"Happy Birthday.\"",
    "Act out a product from tonight's game. The winners have 30 seconds to guess it.",
    "Give a 20-second infomercial for cooking spray. Be very excited.",
    "Do 10 jumping jacks while shouting \"It's not food!\"",
    "Invent a brand-new snack and read its made-up ingredient list with a straight face.",
    "Narrate the winners' victory lap like a nature documentary.",
    "Turn a sock into a puppet and let it announce the winners.",
    "The winners pick the next show or movie. No complaining.",
    "Clean up the snacks — and read one label out loud while you do it.",
    "Talk like a toothpaste-commercial dentist until the next game starts.",
    "Strike your best \"before\" pose from a cleaning-product ad. Hold it for 10 seconds."
  ];
  let game = null;

  /* ---------- fit the 1920×1080 stage to any screen ---------- */
  const stage = $("#stage");
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- screens ---------- */
  let current = "s-title";
  function show(id, focusSel) {
    $("#m-steal").hidden = true;
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    if (id !== "s-round") { stopMusic(); stopTimer(); }
    const target = (focusSel && $(focusSel)) || focusables()[0];
    setFocus(target);
  }

  /* ---------- sound effects (synthesized with Web Audio, no files) ---------- */
  // Every effect is built from simple tones and filtered noise, so there are no
  // audio files to license or load. Sound can be muted from the title screen,
  // the in-game menu, or the M key; the choice is remembered on this device.
  let audio = null, master = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem("idpg-sound") !== "off"; } catch (e) { /* storage blocked */ }

  function audioCtx() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      // Boost everything, then run it through a limiter so loud moments
      // (fanfare + applause) get punchier without distorting.
      master = audio.createGain();
      master.gain.value = 1.9;
      const limiter = audio.createDynamicsCompressor();
      limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.2;
      master.connect(limiter).connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  // One note: frequency (or [from, to] for a slide), start offset, length.
  function tone(freq, at, dur, type = "triangle", vol = 0.3, opts = {}) {
    const a = audioCtx(), t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    if (Array.isArray(freq)) {
      o.frequency.setValueAtTime(freq[0], t);
      o.frequency.exponentialRampToValueAtTime(freq[1], t + dur);
    } else o.frequency.setValueAtTime(freq, t);
    if (opts.vibrato) {
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = opts.vibrato; lg.gain.value = 8;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lowpass) {
      const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = opts.lowpass;
      node.connect(f); node = f;
    }
    node.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // A burst of filtered noise — used for swishes, drums and applause.
  function noise(at, dur, freq, vol = 0.2, type = "bandpass", q = 1) {
    const a = audioCtx(), t = a.currentTime + at;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  const SFX = {
    move()    { tone(1200, 0, 0.03, "sine", 0.05); },
    click()   { tone([700, 500], 0, 0.06, "sine", 0.12); },
    reveal()  { tone([900, 420], 0, 0.09, "sine", 0.22); noise(0, 0.05, 2500, 0.05); },
    help()    { noise(0, 0.22, 1800, 0.18, "bandpass", 0.8); tone([500, 760], 0.02, 0.16, "sine", 0.08); },
    correct() { [1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, i * 0.07, 0.35, "triangle", 0.22); tone(f * 2, i * 0.07, 0.2, "sine", 0.05); }); },
    wrong()   { tone(150, 0, 0.28, "square", 0.16, { lowpass: 900 }); tone(110, 0.3, 0.42, "square", 0.16, { lowpass: 700 }); },
    bet()     { tone(988, 0, 0.09, "square", 0.12, { lowpass: 4000 }); tone(1319, 0.09, 0.45, "square", 0.12, { lowpass: 4000 }); noise(0.09, 0.12, 6000, 0.05, "highpass"); },
    lose()    { [392, 370, 349, 294].forEach((f, i) => tone(f, i * 0.32, i === 3 ? 0.9 : 0.3, "sawtooth", 0.14, { lowpass: 1200, vibrato: i === 3 ? 6 : 0 })); },
    drumroll(len = 1.1) { for (let t = 0; t < len; t += 0.045) noise(t, 0.06, 180, 0.12 + 0.12 * (t / len), "lowpass"); noise(len, 0.35, 120, 0.4, "lowpass"); },
    fanfare(at = 0) {
      [[523, 0], [659, 0.14], [784, 0.28]].forEach(([f, d]) => tone(f, at + d, 0.18, "sawtooth", 0.12, { lowpass: 2400 }));
      [523, 659, 784, 1047].forEach((f) => tone(f, at + 0.44, 0.9, "sawtooth", 0.09, { lowpass: 2400, attack: 0.03 }));
    },
    applause(at = 0, len = 2.2) { for (let t = 0; t < len; t += 0.012) noise(at + t + Math.random() * 0.01, 0.03, 1500 + Math.random() * 2500, 0.06 * (1 - t / len) + 0.01); },
    final()   { SFX.drumroll(0.9); SFX.fanfare(1.0); },
    win()     { SFX.fanfare(0); SFX.applause(0.4); },
    dare()    { tone([660, 520], 0, 0.18, "sine", 0.2); tone([520, 330], 0.2, 0.3, "sine", 0.2); },
    steal()   { [784, 988, 1175].forEach((f, i) => tone(f, 0.25 + i * 0.07, 0.14, "square", 0.1, { lowpass: 3000 })); },
    tick()    { tone(1760, 0, 0.06, "square", 0.08, { lowpass: 3000 }); },
    timeup()  { tone(880, 0, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.16, 0.12, "square", 0.14, { lowpass: 2500 }); tone(880, 0.32, 0.4, "square", 0.14, { lowpass: 2500 }); }
  };
  function sfx(name) {
    if (!soundOn) return;
    try { SFX[name](); } catch (e) { /* sound is optional */ }
  }
  /* ---------- game-show music (original tune, synthesized) ---------- */
  // An upbeat, swinging quiz-show groove: drums, walking bass, chord stabs and
  // a brassy lead over a I–vi–ii–V progression. Original melody written for
  // this game — not any TV show's theme.
  let musicOn = true;
  try { musicOn = localStorage.getItem("idpg-music") !== "off"; } catch (e) { /* storage blocked */ }
  const BPM = 132, BEAT = 60 / BPM, SWING = 0.62;   // offbeat eighths land 62% through the beat
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note number -> Hz
  // MIDI numbers: C4=60. Melody is 8 eighth-notes per bar (0 = rest).
  const LEAD = [
    [67, 0, 72, 0, 76, 0, 74, 72],   // C
    [76, 0, 0, 72, 69, 0, 72, 0],    // Am
    [74, 0, 77, 0, 81, 0, 79, 77],   // Dm
    [76, 0, 74, 0, 71, 0, 67, 0],    // G7
    [67, 0, 72, 0, 76, 0, 79, 0],    // C
    [81, 0, 79, 76, 72, 0, 76, 0],   // Am
    [77, 0, 76, 0, 74, 0, 77, 81],   // Dm
    [79, 0, 0, 0, 71, 0, 74, 0]      // G7
  ];
  const BASS = [[36, 40, 43, 45], [33, 36, 40, 43], [38, 41, 45, 48], [31, 35, 38, 41]];   // walking quarters
  const CHORDS = [[60, 64, 67], [57, 60, 64], [62, 65, 69], [59, 62, 65, 67]];            // C, Am, Dm, G7
  let music = null;   // { timer, step, barStart, bus }
  function startMusic(mode = "main") {
    if (music && music.mode === mode) return;
    if (music) stopMusic();
    if (!soundOn || !musicOn) return;
    try {
      const a = audioCtx();
      const bus = a.createGain();
      bus.gain.value = 0.3;
      bus.connect(master);
      const env = (node, t, vol, dur, attack = 0.005) => {
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        node.connect(g).connect(bus);
      };
      const osc = (type, f, t, dur, vol, lp) => {
        const o = a.createOscillator(); o.type = type; o.frequency.value = f;
        let n = o;
        if (lp) { const fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
        env(n, t, vol, dur); o.start(t); o.stop(t + dur + 0.03);
      };
      const noiseBuf = (() => { const len = a.sampleRate * 0.25, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; })();
      const hit = (t, type, freq, vol, dur) => {
        const src = a.createBufferSource(), f = a.createBiquadFilter();
        src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
        src.connect(f); env(f, t, vol, dur, 0.002); src.start(t); src.stop(t + dur + 0.02);
      };
      const kick = (t) => { const o = a.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(o, t, 0.9, 0.16, 0.002); o.start(t); o.stop(t + 0.2); };
      const snare = (t) => { hit(t, "bandpass", 1900, 0.45, 0.13); osc("triangle", 190, t, 0.08, 0.25); };
      const hat = (t, open) => hit(t, "highpass", 8000, open ? 0.14 : 0.09, open ? 0.12 : 0.035);
      const brass = (n, t, dur) => {   // two slightly detuned saws through a filter = cheesy TV brass
        [0, 6].forEach((cents) => { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = cents;
          const fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(900, t); fl.frequency.linearRampToValueAtTime(2600, t + 0.05);
          o.connect(fl); env(fl, t, 0.16, dur, 0.02); o.start(t); o.stop(t + dur + 0.03); });
      };
      if (mode === "suspense") { startSuspense(a, bus, osc, kick, hit, env); return; }
      music = { mode, step: 0, barStart: a.currentTime + 0.12, bus };
      music.timer = setInterval(() => {
        // schedule each bar a little ahead so timing stays tight
        while (music && music.barStart < a.currentTime + 0.4) {
          const bar = music.step % LEAD.length, chord = bar % 4, t0 = music.barStart;
          for (let beat = 0; beat < 4; beat++) {
            const on = t0 + beat * BEAT, off = on + BEAT * SWING;
            if (beat % 2 === 0) kick(on); else snare(on);
            hat(on, false); hat(off, beat === 3);
            osc("triangle", hz(BASS[chord][beat]), on, BEAT * 0.85, 0.5, 900);
            if (beat === 1 || beat === 3) CHORDS[chord].forEach((n) => osc("square", hz(n), off, 0.12, 0.05, 1800));
            [LEAD[bar][beat * 2], LEAD[bar][beat * 2 + 1]].forEach((n, k) => {
              if (n) brass(n, k ? off : on, (k ? BEAT * (1 - SWING) : BEAT * SWING) * 0.95);
            });
          }
          music.step++; music.barStart += BEAT * 4;
        }
      }, 80);
    } catch (e) { music = null; }
  }
  // Steal music: slow minor-key tension — heartbeat drum, pulsing low bass,
  // tremolo strings and a ticking clock (Am – F – Dm – E).
  function startSuspense(a, bus, osc, kick, hit, env) {
    const SB = 60 / 96;
    const ROOTS = [45, 41, 38, 40];
    const STRINGS = [[69, 72, 76], [65, 69, 72], [62, 65, 69], [64, 68, 71]];
    const tremolo = (n, t, dur) => {
      const o = a.createOscillator(), trem = a.createGain(), lfo = a.createOscillator(), depth = a.createGain(), fl = a.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.value = hz(n);
      fl.type = "lowpass"; fl.frequency.value = 1700;
      trem.gain.value = 0.5; lfo.frequency.value = 9; depth.gain.value = 0.5;
      lfo.connect(depth).connect(trem.gain);
      o.connect(fl).connect(trem); env(trem, t, 0.05, dur, 0.4);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    };
    music = { mode: "suspense", step: 0, barStart: a.currentTime + 0.1, bus };
    music.timer = setInterval(() => {
      while (music && music.barStart < a.currentTime + 0.5) {
        const c = music.step % 4, t0 = music.barStart;
        STRINGS[c].forEach((n) => tremolo(n, t0, SB * 4));
        for (let beat = 0; beat < 4; beat++) {
          const on = t0 + beat * SB;
          if (beat === 0 || beat === 2) { kick(on); kick(on + 0.2); }   // lub-dub
          hit(on, "highpass", 6000, 0.08, 0.03);                         // clock tick
          for (let e = 0; e < 2; e++) osc("triangle", hz(ROOTS[c]), on + e * SB / 2, SB * 0.4, 0.38, 500);
        }
        music.step++; music.barStart += SB * 4;
      }
    }, 80);
  }

  function stopMusic() {
    if (!music) return;
    clearInterval(music.timer);
    try {
      const t = audio.currentTime;
      music.bus.gain.setValueAtTime(music.bus.gain.value, t);
      music.bus.gain.linearRampToValueAtTime(0.0001, t + 0.25);
      const bus = music.bus; setTimeout(() => bus.disconnect(), 400);
    } catch (e) { /* ignore */ }
    music = null;
  }
  function setMusic(on) {
    musicOn = on;
    try { localStorage.setItem("idpg-music", on ? "on" : "off"); } catch (e) { /* storage blocked */ }
    $$("[data-action='music']").forEach((b) => { b.textContent = on ? "Music: On" : "Music: Off"; });
    if (!on) stopMusic();
  }

  /* ---------- answer timer ---------- */
  let timer = null;   // { left (ms), last, id }
  function startTimer(seconds) {
    stopTimer();
    if (!settings.timer || current !== "s-round") return;
    const total = (seconds || TIMER_SECONDS[settings.level]) * 1000;
    timer = { total, left: total, last: performance.now(), id: 0, lastSec: null };
    $("#clock").hidden = false; $("#timer-bar").hidden = false; $(".label-card").classList.add("timed");
    resumeTimer();
    if (game) updateExtend();
  }
  function resumeTimer() {
    if (!timer) return;
    timer.last = performance.now();
    clearInterval(timer.id);
    timer.id = setInterval(tickTimer, 100);
    tickTimer();
  }
  function pauseTimer() { if (timer) clearInterval(timer.id); }
  function stopTimer() {
    if (timer) clearInterval(timer.id);
    timer = null;
    $("#clock").hidden = true; $("#timer-bar").hidden = true; $(".label-card").classList.remove("timed");
    $("#extend").hidden = true;
  }
  function tickTimer() {
    const now = performance.now();
    timer.left -= now - timer.last; timer.last = now;
    const sec = Math.max(0, Math.ceil(timer.left / 1000));
    $("#clock-num").textContent = sec;
    $("#clock-prog").style.strokeDashoffset = (1 - Math.max(0, timer.left) / timer.total) * 326.7;
    const bar = $("#timer-bar");
    bar.style.width = Math.max(0, timer.left / timer.total * 100) + "%";
    const urgent = timer.left <= 10000;   // last 10 seconds: red bar + ticking
    bar.classList.toggle("urgent", urgent); $("#clock").classList.toggle("urgent", urgent);
    if (urgent && sec !== timer.lastSec && sec > 0) sfx("tick");
    timer.lastSec = sec;
    if (timer.left <= 0) { stopTimer(); answer(null); }
  }

  function setSound(on) {
    soundOn = on;
    try { localStorage.setItem("idpg-sound", on ? "on" : "off"); } catch (e) { /* storage blocked */ }
    $$("[data-action='sound']").forEach((b) => { b.textContent = on ? "Sound: On" : "Sound: Off"; });
    if (!on) stopMusic();
    else if (current === "s-round" && modal.hidden) startMusic(game && (game.steal || !$("#m-steal").hidden) ? "suspense" : "main");
    if (on && audio) sfx("click");
  }

  /* ---------- book picker ---------- */
  function deckFor(book) {
    return book === "all" ? PUZZLES : PUZZLES.filter((p) => p.book === book);
  }
  // Every game except the toilet paper book itself ends with a
  // What Is Toilet Paper? true-or-false finale (one question per team).
  function hasFinale(book) { return book !== "tp"; }
  function mainPool(book) {
    return hasFinale(book) ? deckFor(book).filter((p) => p.type !== "tf") : deckFor(book);
  }
  // Harder difficulty earns more: Medium +1, Hard +2 on ingredient questions.
  const LEVEL_BONUS = { 1: 0, 2: 1, 3: 2 };
  function bookLabel(book) {
    return book === "all" ? "All the books, mixed" : BOOKS[book].title;
  }
  function buildBookList() {
    const box = $("#book-list");
    Object.keys(BOOKS).forEach((key) => {
      const b = document.createElement("button");
      b.className = "book focusable";
      b.dataset.book = key;
      b.innerHTML = `<img alt="" /><b></b><small>${deckFor(key).length} ${BOOKS[key].trueFalse ? "true or false" : "puzzles"}</small>`;
      b.querySelector("img").src = BOOKS[key].cover;
      b.querySelector("img").alt = BOOKS[key].title + " cover";
      b.querySelector("b").textContent = BOOKS[key].name;
      box.appendChild(b);
    });
    const mix = document.createElement("button");
    mix.className = "book focusable";
    mix.dataset.book = "all";
    mix.innerHTML = `<div class="mix"></div><b>Mix all books</b><small>${PUZZLES.length} puzzles</small>`;
    Object.values(BOOKS).forEach((bk) => {
      const im = document.createElement("img"); im.src = bk.cover; im.alt = "";
      mix.firstChild.appendChild(im);
    });
    box.appendChild(mix);
  }
  buildBookList();

  // Every team gets the same number of turns, capped by how many puzzles the book has.
  function turnsPerTeam() {
    const pool = mainPool(settings.book);
    return Math.max(1, Math.min(settings.rounds, Math.floor(pool.length / settings.teams)));
  }
  function updateTotal() {
    const per = turnsPerTeam();
    const total = per * settings.teams;
    const finale = (hasFinale(settings.book) ? " + a toilet paper true-or-false finale" : "") +
      (settings.timer ? ` · ${TIMER_SECONDS[settings.level]} seconds per question` : "");
    $("#setup-total").textContent = (settings.teams === 1
      ? `${total} rounds`
      : `${total} rounds — ${per} for each team` + (per < settings.rounds ? " (every puzzle in this book)" : "")) + finale;
  }

  function chooseBook(book) {
    settings.book = book;
    $("#setup-book").textContent = bookLabel(book);
    updateTotal();
    show("s-setup", "#s-setup .chip.selected");
  }

  /* ---------- game flow ---------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame() {
    bits = [];   // clear any confetti still falling from the last game
    const pool = mainPool(settings.book);
    const perTeam = turnsPerTeam();
    let deck = shuffle(pool.slice()).slice(0, perTeam * settings.teams);
    if (hasFinale(settings.book)) deck = deck.concat(shuffle(deckFor("tp").slice()).slice(0, settings.teams));
    game = {
      book: settings.book,
      deck,
      index: 0,
      scores: new Array(settings.teams).fill(0),
      teams: settings.teams,
      colors: keepColors(),
      turnOrder: [...Array(settings.teams).keys()]
    };
    if (game.teams > 1) showPick(); else startRound();
  }

  // Last game's colors carry over when the team count is the same.
  function keepColors() {
    const c = settings.colors.filter((x, i, a) => a.indexOf(x) === i).slice(0, settings.teams);
    for (let i = 0; c.length < settings.teams; i++) if (!c.includes(i)) c.push(i);
    return c;
  }

  // Step 1: each team picks its color. Step 2: the TV shuffles who goes first.
  function orderScreen(kicker, title, tip, buttons) {
    $("#order-kicker").textContent = kicker;
    $("#order-title").textContent = title;
    $("#order-tip").textContent = tip;
    $("#order-buttons").innerHTML = buttons;
    $("#order-list").innerHTML = "";
  }
  function showPick(focusSel) {
    const n = game.teams, picked = game.colors;
    orderScreen("Before we start", "Pick your team colors",
      picked.length === n ? `Every team has a color. Now shuffle to see who goes first!`
        : `Pick ${n} colors — one for each team. ${picked.length} of ${n} picked.`,
      `<button class="btn primary focusable" data-action="shuffle-order">Shuffle the order</button>
       <button class="btn focusable" data-action="setup">Back</button>`);
    TEAM_NAMES.forEach((name, c) => {
      const b = document.createElement("button");
      const on = picked.includes(c);
      b.className = "order-card focusable" + (on ? " picked" : "");
      b.dataset.action = "color"; b.dataset.color = c;
      b.style.setProperty("--team", TEAM_COLORS[c]);
      b.innerHTML = `<span class="order-n">${on ? "✓ Playing" : "Not playing"}</span><b>${name}</b>`;
      $("#order-list").appendChild(b);
    });
    show("s-order", focusSel || '#s-order [data-action="shuffle-order"]');
  }
  function toggleColor(c) {
    const picked = game.colors, i = picked.indexOf(c);
    if (i >= 0) picked.splice(i, 1);
    else { picked.push(c); if (picked.length > game.teams) picked.shift(); }   // swap out the oldest pick
    sfx("move");
    showPick(`#s-order [data-color="${c}"]`);
  }
  function shuffleOrder() {
    if (game.colors.length !== game.teams) {
      sfx("wrong");
      $("#order-tip").textContent = `Pick ${game.teams} colors first — ${game.colors.length} of ${game.teams} picked.`;
      return;
    }
    settings.colors = game.colors.slice();
    let next = shuffle(game.turnOrder.slice());
    if (game.shuffled && next.join() === game.turnOrder.join()) next = next.slice(1).concat(next[0]);
    game.turnOrder = next;
    game.shuffled = true;
    orderScreen("The TV shuffled the teams", "Here's who goes first",
      "Pass the remote to whoever's turn it is — or let one person be the host.",
      `<button class="btn primary focusable" data-action="go">Let's go</button>
       <button class="btn focusable" data-action="shuffle-order">Shuffle again</button>
       <button class="btn focusable" data-action="pick-colors">Change colors</button>`);
    game.turnOrder.forEach((t, k) => {
      const d = document.createElement("div");
      d.className = "order-card";
      d.style.setProperty("--team", teamColor(t));
      d.innerHTML = `<span class="order-n">${["1st", "2nd", "3rd", "4th"][k]}</span><b>${teamName(t)}</b>`;
      $("#order-list").appendChild(d);
    });
    show("s-order", '#s-order [data-action="go"]');
    sfx("steal");
  }

  // A single book keeps every answer choice in that book's world (all beauty
  // products, all cleaners...). "Mix all books" uses the cross-category decoys.
  function choicesFor(p) {
    if (p.type === "tf") return ["True", "False"];
    if (game.book === "all") return shuffle(p.options.slice());
    const others = shuffle(deckFor(p.book).filter((q) => q.type !== "tf" && q.answer !== p.answer).map((q) => q.answer));
    return shuffle([p.answer].concat(others.slice(0, 3)));
  }

  function startRound() {
    const p = game.deck[game.index];
    const tf = p.type === "tf";
    game.shown = tf ? 0 : Math.min(START_SHOWN, p.ingredients.length);
    game.order = tf ? [] : revealOrder(p.ingredients.length);
    game.open = new Set(game.order.slice(0, game.shown));
    game.options = choicesFor(p);
    game.team = game.turnOrder[game.index % game.teams];
    $(".label-card").classList.toggle("tf", tf);
    $("#answers").classList.toggle("tf", tf);
    $(".label-head span").textContent = tf ? "TRUE OR FALSE?" : "INGREDIENTS:";
    $("#statement").hidden = !tf;
    $("#help").hidden = tf;
    $("#statement").textContent = tf ? p.statement : "";

    $(".hud").classList.toggle("crowded", game.teams >= 3);
    $("#turn").textContent = game.teams === 1 ? "Your turn" : teamName(game.team) + "'s turn";
    $("#turn").style.color = teamColor(game.team);
    $("#progress").innerHTML = `<span class="round-book"></span><br />Round ${game.index + 1} of ${game.deck.length}`;
    const finaleQ = p.type === "tf" && game.book !== "tp";
    $("#progress .round-book").textContent = finaleQ ? BOOKS.tp.name : game.book === "all" ? "All books" : BOOKS[game.book].name;
    renderScores();
    showStakes();

    const list = $("#ingredients");
    list.innerHTML = "";
    game.helped = new Set();
    game.extended = false;
    resetHelp();
    (p.ingredients || []).forEach((ing, i) => {
      const li = document.createElement("li");
      if (game.open.has(i)) li.appendChild(ingredientButton(ing, i));
      else coverIngredient(li, i);
      list.appendChild(li);
    });

    fitIngredients();
    game.wager = null;
    game.steal = null;
    game.chain = null;
    game.locked = false;
    if (isWager(game.index)) askWager(p);
    else renderAnswers(game.options.map((o) => ({ label: o, action: "answer", value: o })));

    updateWorth();
    show("s-round", "#answers .answer");
    startMusic();
    if (!isWager(game.index)) startTimer();
  }

  // Long labels shrink their text so every ingredient stays on screen.
  function fitIngredients() {
    const list = $("#ingredients");
    let size = 34;
    list.style.fontSize = size + "px";
    while (list.scrollHeight > list.clientHeight + 1 && size > 22) {
      size -= 2;
      list.style.fontSize = size + "px";
    }
  }

  function renderAnswers(items) {
    const box = $("#answers");
    box.innerHTML = "";
    items.forEach((it, i) => {
      const b = document.createElement("button");
      b.className = "answer focusable";
      b.dataset.action = it.action;
      b.dataset.choice = it.value;
      b.innerHTML = `<span class="n">${i + 1}</span><span></span>`;
      b.lastChild.textContent = it.label;
      box.appendChild(b);
    });
  }

  /* ---------- toilet paper finale: bet before you see the question ---------- */
  // A right answer wins the bet, a wrong answer loses it (scores never go
  // below zero). Teams with few points can still bet up to 10.
  function isWager(i) { return isFinal(i) && game.deck[i].type === "tf"; }
  function wagerOptions(score) {
    const base = Math.max(score, 10);
    const amounts = [0, Math.ceil(base / 4), Math.ceil(base / 2), base];
    return amounts.filter((a, i) => amounts.indexOf(a) === i);
  }
  function askWager(p) {
    const score = game.scores[game.team];
    $("#answers").classList.remove("tf");
    $("#statement").textContent = `Place your bet! You have ${score} point${score === 1 ? "" : "s"}. ` +
      "Get it right and win your bet. Get it wrong and lose it.";
    const opts = wagerOptions(score);
    renderAnswers(opts.map((a, i) => ({
      action: "wager", value: String(a),
      label: a === 0 ? "Play it safe — bet 0" : a === score ? `All in — bet ${a}` : `Bet ${a}`
    })));
  }
  function placeWager(amount) {
    const p = game.deck[game.index];
    game.wager = amount;
    sfx("bet");
    $("#answers").classList.add("tf");
    $("#statement").textContent = p.statement;
    renderAnswers(game.options.map((o) => ({ label: o, action: "answer", value: o })));
    updateWorth();
    setFocus($("#answers .answer"));
    startTimer();   // the bet isn't timed; the question is
  }

  // Rising stakes: every full lap of turns adds +1 to what a question is worth,
  // and each team's last turn counts double. Reveals and help still subtract.
  function lapOf(i) { return Math.floor(i / game.teams); }
  function laps() { return game.deck.length / game.teams; }
  function isFinal(i) { return laps() > 1 && lapOf(i) === laps() - 1; }
  function basePoints(i) {
    const p = game.deck[i];
    return (p.type === "tf" ? TF_POINTS : MAX_POINTS + LEVEL_BONUS[settings.level]) + lapOf(i);
  }
  function points() {
    const i = game.index, p = game.deck[i];
    if (isWager(i)) return game.wager || 0;
    const reveals = p.type === "tf" ? 0 : game.shown - Math.min(START_SHOWN, p.ingredients.length);
    const pts = Math.max(1, basePoints(i) - reveals - game.helped.size - (game.extended ? extendCost(i) : 0));
    return isFinal(i) ? pts * 2 : pts;
  }
  // +15 seconds costs more as the points go up: 1 point, then 2, 3... each lap
  // (and the final round doubles it, like everything else).
  const EXTEND_SECONDS = 15;
  function extendCost(i) { return 1 + lapOf(i); }
  function canExtend() {
    return settings.timer && timer && !game.extended && !game.steal && !isWager(game.index);
  }
  function updateExtend() {
    const b = $("#extend"), show = !!canExtend();
    if (!show && b === focused) setFocus($("#answers .answer"));
    b.hidden = !show;
    if (show) {
      const cost = extendCost(game.index) * (isFinal(game.index) ? 2 : 1);
      b.textContent = `+${EXTEND_SECONDS} sec −${cost} pt${cost === 1 ? "" : "s"}`;
    }
  }
  function extendTime() {
    if (!canExtend()) return;
    game.extended = true;
    timer.left += EXTEND_SECONDS * 1000;
    timer.total = Math.max(timer.total, timer.left);
    timer.lastSec = null;
    sfx("bet");
    updateWorth();
    updateExtend();
  }

  function showStakes() {
    const i = game.index, el = $("#stakes");
    el.className = "stakes";
    if (isFinal(i)) {
      el.textContent = isWager(i) ? "Place your bet" : "Final round ×2";
      el.classList.add("is-final");
      if (i % game.teams === 0) { sfx("final"); confetti(90, ["#F2C46B", "#E07A55"]); }
    } else if (lapOf(i) > 0) {
      el.textContent = `Points are up +${lapOf(i)}`;
    }
    el.hidden = !(isFinal(i) || lapOf(i) > 0);
  }

  // Which ingredients appear first. Labels list the biggest amounts first, so
  // the top of the label is the easiest clue and the bottom is the hardest.
  //   Easy:   top of the label, revealing downward
  //   Medium: middle of the label, spreading out
  //   Hard:   bottom of the label (the tiny-amount chemicals), revealing upward
  function revealOrder(n) {
    const idx = Array.from({ length: n }, (_, i) => i);
    if (settings.level === 3) return idx.reverse();
    if (settings.level === 2) {
      const mid = (n - 1) / 2;
      return idx.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a);
    }
    return idx;
  }

  /* ---------- ingredient help during a question ---------- */
  // Each visible ingredient is a button. Red = worth knowing about,
  // amber = not fully disclosed. Looking one up costs a point (once each).
  function ingredientButton(ing, i) {
    const b = document.createElement("button");
    const info = watchInfo(ing);
    b.className = "ing focusable" + (info ? " " + info.level : "");
    b.dataset.action = "help";
    b.dataset.i = i;
    b.textContent = ing;
    return b;
  }
  function resetHelp() {
    const t = $("#help-text");
    t.className = "help-text";
    const cost = isFinal(game.index) ? 2 : 1;
    t.innerHTML = `Select an ingredient to see what it is <span>(−${cost} point${cost > 1 ? "s" : ""})</span>`;
  }
  function help(i) {
    const p = game.deck[game.index];
    if (game.steal) { showHelpText(p.ingredients[i]); return; }
    const ing = p.ingredients[i];
    const first = !game.helped.has(i);
    if (first) sfx("help");
    game.helped.add(i);
    showHelpText(ing);
    $$("#ingredients .ing").forEach((b) => b.classList.toggle("looked", game.helped.has(Number(b.dataset.i))));
    updateWorth();
  }
  function showHelpText(ing) {
    const info = watchInfo(ing);
    const t = $("#help-text");
    t.className = "help-text on" + (info ? " " + info.level : "");
    t.innerHTML = "<b></b> <span class='what'></span>" + (info ? " <em></em>" : "");
    t.querySelector("b").textContent = ing + ":";
    t.querySelector(".what").textContent = glossaryFor(ing);
    if (info) t.querySelector("em").textContent = info.tag;
  }

  function updateWorth() {
    const p = game.deck[game.index];
    const pts = points();
    $("#worth").textContent = isWager(game.index)
      ? (game.wager === null ? "Bet first" : `Bet: ${pts} point${pts === 1 ? "" : "s"}`)
      : `Worth ${pts} point${pts === 1 ? "" : "s"}`;
    $("#reveal").disabled = p.type === "tf" || game.shown >= p.ingredients.length;
    updateExtend();
  }

  // A covered ingredient is a button too: selecting it uncovers that one.
  function coverIngredient(li, i) {
    li.className = "hidden focusable";
    li.dataset.action = "reveal";
    li.dataset.i = i;
    li.setAttribute("role", "button");
    li.tabIndex = -1;
    li.setAttribute("aria-label", "Covered ingredient: uncover it");
    li.innerHTML = "<span>?</span>";
  }

  // Uncover a chosen ingredient, or the next one in difficulty order.
  function reveal(pick) {
    if (game.steal) return;
    const p = game.deck[game.index];
    if (p.type === "tf" || game.shown >= p.ingredients.length) return;
    const idx = pick !== undefined && !game.open.has(pick) ? pick : game.order.find((i) => !game.open.has(i));
    game.open.add(idx);
    const li = $("#ingredients").children[idx];
    const wasFocused = focused === li;
    li.className = "new";
    delete li.dataset.action; delete li.dataset.i;
    li.removeAttribute("role"); li.removeAttribute("aria-label"); li.removeAttribute("tabindex");
    li.textContent = "";
    li.appendChild(ingredientButton(p.ingredients[idx], idx));
    if (wasFocused) setFocus(li.firstChild);
    fitIngredients();
    game.shown++;
    sfx("reveal");
    updateWorth();
    if ($("#reveal").disabled) setFocus($("#answers .answer"));
  }

  function answer(choice) {
    if (game.locked) return;
    stopMusic(); stopTimer();
    const timedOut = choice === null;
    const p = game.deck[game.index];
    const tf = p.type === "tf";
    const correct = tf ? (p.answer ? "True" : "False") : p.answer;
    const right = choice === correct;
    if (game.steal) { finishSteal(choice, right, timedOut); return; }
    if (!right && !isWager(game.index) && canSteal(p)) { firstMiss(choice, timedOut); return; }
    const wager = isWager(game.index);
    const pts = right ? points() : 0;
    const lost = wager && !right ? Math.min(game.wager, game.scores[game.team]) : 0;
    game.scores[game.team] += pts - lost;
    sfx(right ? "correct" : lost ? "lose" : timedOut ? "timeup" : "wrong");

    if (right) confetti(70, [teamHex(game.team)]);

    const v = $("#verdict");
    v.className = "verdict " + (right ? "good" : "bad");
    v.textContent = right && wager && !pts ? "Correct! You bet 0, so your score stays the same."
      : right ? `Correct! +${pts} point${pts === 1 ? "" : "s"}`
      : timedOut ? (lost ? `Time's up! You lose ${lost} point${lost === 1 ? "" : "s"}.` : "Time's up!")
      : lost ? `Nope — you said ${choice}. You lose ${lost} point${lost === 1 ? "" : "s"}.`
      : `Nope — you said ${choice}.`;
    showResult(p);
  }

  // Fills in the answer screen (answer, spotlight, watch list, book) and shows it.
  function showResult(p) {
    const tf = p.type === "tf";
    const correct = tf ? (p.answer ? "True" : "False") : p.answer;
    game.steal = null;
    game.chain = null;
    $("#r-answer").textContent = tf ? `${correct}.` : correct;

    // Explanation card.
    $("#r-spot-tag").textContent = tf ? "The real story" : "Weird ingredient spotlight";
    $("#r-spot-name").textContent = tf ? p.statement : p.spotlight.name;
    $("#r-spot-note").textContent = tf ? p.explain : p.spotlight.note;
    renderWatch(p);

    const bk = BOOKS[p.book];
    $("#r-book").href = bk.url;
    $("#r-cover").src = bk.cover;
    $("#r-cover").alt = bk.title + " cover";
    $("#r-book-title").textContent = bk.title;
    const nb = $("#next-btn"), last = game.index + 1 >= game.deck.length;
    if (last) nb.textContent = "See final scores";
    else if (game.teams === 1) nb.textContent = "Next round";
    else {
      const up = game.turnOrder[(game.index + 1) % game.teams];
      nb.innerHTML = `Up next: <span class="next-dot"></span>${teamName(up)}`;
      nb.querySelector(".next-dot").style.background = teamColor(up);
    }

    show("s-result", "#next-btn");
  }

  /* ---------- steals ---------- */
  // A miss triggers a big WRONG!, then a "Steal it?" screen. Whoever shouts
  // first gets picked on the remote (one remote can't tell who pressed it).
  // Each team gets one try per question; every steal is worth half the last
  // one, a missed steal loses that much, and the chain runs until someone
  // gets it or nobody's left. 10 seconds per steal if the timer is on.
  function canSteal(p) {
    return settings.steal && game.teams > 1 && p.type !== "tf";
  }
  function plural(n) { return `${n} point${n === 1 ? "" : "s"}`; }
  function firstMiss(choice, timedOut) {
    const p = game.deck[game.index];
    game.chain = {
      value: Math.max(1, Math.ceil(points() / 2)),
      tried: new Set([game.team]),
      removed: timedOut ? [] : [choice],
      missText: timedOut ? "Time's up!" : `Nope — you said ${choice}.`,
      steals: 0
    };
    sfx(timedOut ? "timeup" : "wrong");
    showWrong(`${teamName(game.team)} ${timedOut ? "ran out of time" : `said ${choice}`}`, () => offerSteal(p));
  }
  function showWrong(sub, then) {
    const pop = $("#wrong-pop");
    $("#wrong-sub").textContent = sub;
    pop.hidden = false;
    game.locked = true;   // no clicks or keys while WRONG! is on screen
    pop.classList.remove("go"); void pop.offsetWidth; pop.classList.add("go");
    setTimeout(() => {
      pop.hidden = true;
      game.locked = false;
      if (current === "s-round" && game.chain) then();
    }, 1600);
  }
  function offerSteal(p) {
    const ch = game.chain;
    const left = game.options.filter((o) => !ch.removed.includes(o));
    const teams = Array.from({ length: game.teams }, (_, i) => i).filter((i) => !ch.tried.has(i));
    if (!teams.length || left.length <= 1) { nobodyGotIt(p); return; }
    $("#steal-kicker").textContent = ch.steals ? "Still up for grabs!" : "Up for grabs!";
    $("#steal-sub").textContent = `First team to yell “STEAL!” gets it — worth ${plural(ch.value)}. Miss it and lose ${ch.value}.`;
    const box = $("#steal-teams");
    box.innerHTML = "";
    teams.forEach((i, k) => {
      const b = document.createElement("button");
      b.className = "btn focusable steal-team";
      b.dataset.action = "stealer"; b.dataset.team = i;
      b.style.setProperty("--team", teamColor(i));
      b.textContent = `${teamName(i)} yelled first`;
      box.appendChild(b);
    });
    const no = document.createElement("button");
    no.className = "btn focusable"; no.dataset.action = "no-steal";
    no.textContent = "No steal — show the answer";
    box.appendChild(no);
    $("#m-steal").hidden = false;
    setFocus($(".focusable", box));
    startMusic("suspense");
    sfx("steal");
  }
  function startSteal(team) {
    const ch = game.chain;
    $("#m-steal").hidden = true;
    game.steal = { team, value: ch.value };
    ch.tried.add(team); ch.steals++;
    $("#turn").textContent = teamName(team) + " — steal it!";
    $("#turn").style.color = teamColor(team);
    const st = $("#stakes");
    st.hidden = false; st.className = "stakes is-steal";
    st.textContent = `Win ${ch.value} · miss = −${ch.value}`;
    $$("#answers .answer").forEach((b) => {
      const gone = ch.removed.includes(b.dataset.choice);
      b.disabled = gone; b.classList.toggle("struck", gone);
    });
    $("#reveal").disabled = true;
    $$("#ingredients li.hidden").forEach((li) => li.classList.remove("focusable"));   // no reveals on a steal
    const t = $("#help-text");
    t.className = "help-text";
    t.textContent = "Steal round: ingredient help is free.";
    $("#worth").textContent = `Steal: ${plural(ch.value)}`;
    renderScores();
    $$("#scores .score").forEach((d, i) => d.classList.toggle("on", i === team));
    setFocus($$("#answers .answer").find((b) => !b.disabled));
    startMusic("suspense");
    startTimer(STEAL_SECONDS);
  }
  function finishSteal(choice, right, timedOut) {
    const s = game.steal, ch = game.chain, name = teamName(s.team);
    if (right) {
      game.scores[s.team] += s.value;
      sfx("correct");
      confetti(110, [teamHex(s.team)]);
      const v = $("#verdict");
      v.className = "verdict good";
      v.textContent = `${name} steals it! +${plural(s.value)}`;
      showResult(game.deck[game.index]);
      return;
    }
    const lost = Math.min(s.value, game.scores[s.team]);
    game.scores[s.team] -= lost;
    sfx(lost ? "lose" : timedOut ? "timeup" : "wrong");
    if (!timedOut) ch.removed.push(choice);
    game.steal = null;
    ch.value = Math.max(1, Math.ceil(ch.value / 2));
    renderScores();
    showWrong(`${name} ${timedOut ? "ran out of time" : `said ${choice}`}` + (lost ? ` — loses ${plural(lost)}` : ""),
      () => offerSteal(game.deck[game.index]));
  }
  function nobodyGotIt(p) {
    $("#m-steal").hidden = true;
    const v = $("#verdict");
    v.className = "verdict bad";
    v.textContent = game.chain && game.chain.steals ? "Nobody got it!" : game.chain ? game.chain.missText : "Nobody got it!";
    showResult(p);
  }

  function renderWatch(p) {
    const list = $("#watch-list");
    list.innerHTML = "";
    // Group ingredients that share a tag ("Red 40, Yellow 5, Blue 1 — Synthetic dye").
    const groups = new Map();
    (p.ingredients || []).forEach((ing) => {
      const info = watchInfo(ing);
      if (!info) return;
      const key = info.level + "|" + info.tag;
      if (!groups.has(key)) groups.set(key, { level: info.level, tag: info.tag, names: [] });
      if (!groups.get(key).names.includes(ing)) groups.get(key).names.push(ing);
    });
    groups.forEach((g) => {
      const li = document.createElement("li");
      li.className = g.level;
      li.innerHTML = "<b></b><small></small>";
      li.firstChild.textContent = g.names.join(", ");
      li.lastChild.textContent = g.tag;
      list.appendChild(li);
    });
    $("#watch").hidden = !list.children.length;
    $("#r-side").classList.toggle("solo", !list.children.length);
  }

  function next() {
    game.index++;
    if (game.index >= game.deck.length) finish(); else startRound();
  }

  function renderScores() {
    const box = $("#scores");
    box.innerHTML = "";
    if (game.teams === 1) {
      box.innerHTML = `<div class="score on" style="color:${teamColor(0)}"><i></i><span>${game.scores[0]} pts</span></div>`;
      return;
    }
    game.turnOrder.forEach((i) => {
      const s = game.scores[i];
      const d = document.createElement("div");
      d.className = "score" + (i === game.team ? " on" : "");
      d.style.color = teamColor(i);
      d.innerHTML = `<i></i><span>${s}</span>`;
      box.appendChild(d);
    });
  }

  function maxPoints() {
    // Bets don't count toward the maximum — they depend on the score so far.
    return game.deck.reduce((sum, p, i) => sum + (isWager(i) ? 0 : basePoints(i) * (isFinal(i) ? 2 : 1)), 0);
  }

  function finish() {
    const order = game.scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const top = order[0].s;
    const winners = order.filter((o) => o.s === top);
    const w = $("#winner");
    if (game.teams === 1) {
      w.textContent = `You scored ${top} point${top === 1 ? "" : "s"}!`;
      w.style.color = "";
    } else if (winners.length > 1) {
      w.textContent = "It's a tie!";
      w.style.color = "";
    } else {
      w.textContent = teamName(winners[0].i) + " wins!";
      w.style.color = teamColor(winners[0].i);
    }
    const list = $("#final-scores");
    list.innerHTML = "";
    if (game.teams > 1) {
      order.forEach((o) => {
        const li = document.createElement("li");
        li.style.color = teamColor(o.i);
        li.innerHTML = `<i></i><span>${teamName(o.i)} — ${o.s}</span>`;
        list.appendChild(li);
      });
    }
    // Loser's dare: last place (all tied for last) does it. Solo players get one
    // if they scored under half the possible points.
    const low = order[order.length - 1].s;
    const losers = order.filter((o) => o.s === low).map((o) => o.i);
    let who = null;
    if (settings.dare) {
      if (game.teams === 1) who = top < maxPoints() / 2 ? "Your dare" : null;
      else if (losers.length === game.teams) who = "Everybody's dare";
      else who = losers.map((i) => teamName(i)).join(" & ") + (losers.length > 1 ? "'s dare" : "'s dare");
    }
    game.dareWho = who;
    $("#dare").hidden = !who;
    $("#new-dare-btn").hidden = !who;
    if (who) showDare();

    // The book they picked: its cover sits in the middle of the QR code,
    // and the button links straight to that book.
    const bk = game.book === "all" ? null : BOOKS[game.book];
    const cover = $("#f-cover");
    cover.src = bk ? bk.cover : "icon-130.png";
    cover.className = "qr-cover" + (bk ? "" : " logo");
    $("#f-qr").src = bk ? bk.qr : SERIES.qr;
    $("#f-title").textContent = bk ? bk.title : "the Ingredient Dictionary books";
    $("#f-link").href = bk ? bk.url : SERIES.url;
    $("#f-link").innerHTML = bk ? `Get ${bk.name} on Amazon &rarr;` : "See all the books &rarr;";

    sfx("win");
    if (who) setTimeout(() => current === "s-final" && sfx("dare"), 2600);
    show("s-final", '#s-final [data-action="start"]');
    const winColors = game.teams === 1 || winners.length > 1 ? game.colors.map((c) => TEAM_COLORS_HEX[c]) : [teamHex(winners[0].i)];
    confetti(260, winColors.concat(["#F2C46B", "#F4F3EE"]));
    setTimeout(() => current === "s-final" && confetti(160, winColors.concat(["#F2C46B"])), 900);
  }

  function showDare() {
    const prev = $("#dare-text").textContent;
    let d;
    do { d = DARES[Math.floor(Math.random() * DARES.length)]; } while (d === prev && DARES.length > 1);
    $("#dare-who").textContent = game.dareWho;
    $("#dare-text").textContent = d;
  }

  /* ---------- confetti (no library) ---------- */
  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  let bits = [], running = false;
  const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function confetti(count, colors) {
    if (calm) return;
    for (let i = 0; i < count; i++) {
      bits.push({
        x: 960 + (Math.random() - 0.5) * 900, y: -20 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 9, vy: 4 + Math.random() * 7,
        w: 14 + Math.random() * 14, h: 8 + Math.random() * 10,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        c: colors[i % colors.length], life: 0
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.clearRect(0, 0, 1920, 1080);
    bits = bits.filter((b) => b.y < 1120 && b.life < 400);
    bits.forEach((b) => {
      b.life++; b.x += b.vx + Math.sin(b.life / 12) * 1.5; b.y += b.vy; b.vy += 0.06; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.life / 8)));
      ctx.restore();
    });
    if (bits.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, 1920, 1080); }
  }

  /* ---------- pause menu (Menu button or the remote's Back key) ---------- */
  const modal = $("#m-quit");
  let focusBeforeModal = null;
  function openQuit() {
    stopMusic(); pauseTimer();
    focusBeforeModal = focused;
    modal.hidden = false;
    setFocus($(".focusable", modal));
  }
  function closeQuit() {
    modal.hidden = true; setFocus(focusBeforeModal);
    if (current === "s-round") { startMusic(game.steal || !$("#m-steal").hidden ? "suspense" : "main"); resumeTimer(); }
  }

  /* ---------- actions ---------- */
  const LOCKABLE = new Set(["answer", "reveal", "help", "menu", "extend"]);
  const QUIET = new Set(["answer", "reveal", "help", "wager", "sound", "music"]);
  function act(el) {
    if (!el) return;
    if (game && game.locked && LOCKABLE.has(el.dataset.action)) return;
    if (!QUIET.has(el.dataset.action)) sfx("click");
    if (el.dataset.teams) { pick(el, "teams"); return; }
    if (el.dataset.rounds) { pick(el, "rounds"); return; }
    if (el.dataset.dare) { pick(el, "dare"); return; }
    if (el.dataset.level) { pick(el, "level"); return; }
    if (el.dataset.timer) { pick(el, "timer"); return; }
    if (el.dataset.steal) { pick(el, "steal"); return; }
    if (el.dataset.book) { chooseBook(el.dataset.book); return; }
    switch (el.dataset.action) {
      case "books": show("s-books", `#book-list [data-book="${settings.book}"]`); break;
      case "howto": show("s-howto"); break;
      case "title": show("s-title"); break;
      case "start": startGame(); break;
      case "go": startRound(); break;
      case "shuffle-order": shuffleOrder(); break;
      case "pick-colors": showPick(); break;
      case "color": toggleColor(Number(el.dataset.color)); break;
      case "setup": show("s-setup", '#s-setup [data-action="start"]'); break;
      case "reveal": reveal(el.dataset.i !== undefined ? Number(el.dataset.i) : undefined); break;
      case "extend": extendTime(); break;
      case "answer": answer(el.dataset.choice); break;
      case "next": next(); break;
      case "new-dare": showDare(); break;
      case "help": help(Number(el.dataset.i)); break;
      case "stealer": startSteal(Number(el.dataset.team)); break;
      case "no-steal": nobodyGotIt(game.deck[game.index]); break;
      case "wager": placeWager(Number(el.dataset.choice)); break;
      case "quit-yes": modal.hidden = true; show("s-title"); break;
      case "menu": openQuit(); break;
      case "sound": setSound(!soundOn); break;
      case "music": setMusic(!musicOn); break;
      case "change-game": modal.hidden = true; show("s-books", `#book-list [data-book="${settings.book}"]`); break;
      case "quit-no": closeQuit(); break;
    }
  }
  function pick(el, key) {
    $$(".chip", el.parentElement).forEach((c) => c.classList.toggle("selected", c === el));
    settings[key] = Number(el.dataset[key]);
    updateTotal();
    // Guide the remote: teams -> rounds -> dare -> Start.
    const nextFocus = { teams: "#s-setup [data-rounds].selected", rounds: "#s-setup [data-level].selected", level: "#s-setup [data-timer].selected", timer: "#s-setup [data-steal].selected", steal: "#s-setup [data-dare].selected", dare: '#s-setup [data-action="start"]' };
    setFocus($(nextFocus[key]));
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest(".focusable");
    if (el && !el.disabled) { setFocus(el); act(el); }
  });

  /* ---------- remote / keyboard navigation ---------- */
  let focused = null;
  function anyModal() { return $$(".modal").find((m) => !m.hidden) || null; }
  function scope() { return anyModal() || $("#" + current); }
  function focusables() {
    return $$(".focusable", scope()).filter((el) => !el.disabled && el.offsetParent !== null);
  }
  function setFocus(el) {
    if (focused) focused.classList.remove("focus");
    focused = el || null;
    if (focused) { focused.classList.add("focus"); focused.focus({ preventScroll: true }); }
  }

  // Move to the nearest focusable element in the pressed direction.
  function move(dir) {
    const items = focusables();
    if (!items.length) return;
    if (!focused || !items.includes(focused)) { setFocus(items[0]); return; }
    const a = focused.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    // Prefer elements roughly in line with the arrow; up/down may fall back to
    // anything below/above (e.g. a lone Back button), left/right never jump rows.
    const pickBest = (strict) => {
      let best = null, bestScore = Infinity;
      items.forEach((el) => {
        if (el === focused) return;
        const b = el.getBoundingClientRect();
        const bx = b.left + b.width / 2, by = b.top + b.height / 2;
        const dx = bx - ax, dy = by - ay;
        const main = { left: -dx, right: dx, up: -dy, down: dy }[dir];
        if (main <= 1) return;
        const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
        if (dir === "left" || dir === "right") {
          if (b.bottom <= a.top || b.top >= a.bottom) return;   // must share the same row
        } else if (strict && cross > main * 2) return;
        const score = main + cross * 2;
        if (score < bestScore) { bestScore = score; best = el; }
      });
      return best;
    };
    let best = pickBest(true) || (dir === "up" || dir === "down" ? pickBest(false) : null);
    // Moving down off the ingredients lands on Reveal, never straight on Menu.
    const rev = $("#reveal");
    if (dir === "down" && best && best.dataset.action === "menu" && items.includes(rev) && focused !== rev) best = rev;
    if (best) { setFocus(best); sfx("move"); }
  }

  function back() {
    if (game && game.locked) return;
    if (!modal.hidden) { closeQuit(); return; }
    if (!$("#m-steal").hidden) return;   // pick a team or "No steal"
    if (current === "s-round" || current === "s-result") { openQuit(); return; }
    if (current === "s-setup") { act({ dataset: { action: "books" } }); return; }
    if (current === "s-order") { act({ dataset: { action: "setup" } }); return; }
    if (current !== "s-title") { show("s-title"); return; }
    // On the title screen, Back exits the app on TVs that allow it.
    try {
      if (window.tizen) tizen.application.getCurrentApplication().exit();
      else if (window.webOS && webOS.platformBack) webOS.platformBack();
    } catch (e) { /* not on a TV */ }
  }

  const KEYS = {
    37: "left", 38: "up", 39: "right", 40: "down",
    13: "ok",
    8: "back", 27: "back", 461: "back", 10009: "back"   // Backspace, Esc, LG Back, Samsung Back
  };
  document.addEventListener("keydown", (e) => {
    const k = KEYS[e.keyCode];
    if (k === "left" || k === "right" || k === "up" || k === "down") { e.preventDefault(); move(k); return; }
    if (k === "ok") { e.preventDefault(); if (focused && !focused.disabled) act(focused); return; }
    if (k === "back") { e.preventDefault(); back(); return; }
    if (e.key === "m" || e.key === "M") { setSound(!soundOn); return; }
    if (!$("#m-steal").hidden && modal.hidden) {
      const n = e.keyCode >= 49 && e.keyCode <= 52 ? e.keyCode - 49 : e.keyCode >= 97 && e.keyCode <= 100 ? e.keyCode - 97 : -1;
      const b = n >= 0 && $$("#steal-teams .steal-team")[n];
      if (b) { setFocus(b); act(b); }
      return;
    }
    if (current === "s-round" && !anyModal()) {
      const n = e.keyCode >= 49 && e.keyCode <= 52 ? e.keyCode - 49 : e.keyCode >= 97 && e.keyCode <= 100 ? e.keyCode - 97 : -1;
      if (n >= 0) { const b = $$("#answers .answer")[n]; if (b) { setFocus(b); act(b); } return; }
      if (e.key === "r" || e.key === "R") { reveal(); return; }
    }
  });

  // Samsung TVs only send number keys to apps that ask for them.
  try {
    if (window.tizen && tizen.tvinputdevice) ["1", "2", "3", "4"].forEach((k) => tizen.tvinputdevice.registerKey(k));
  } catch (e) { /* not on a Samsung TV */ }

  setSound(soundOn);
  setMusic(musicOn);
  show("s-title");
})();
