/* It's Not Food — game logic + TV remote navigation. No build step, no server. */
(function () {
  "use strict";

  const START_SHOWN = 3;   // ingredients visible when a round starts
  const MAX_POINTS = 5;    // points if answered with only the starting clues
  const TEAM_NAMES = ["Team Orange", "Team Blue", "Team Purple", "Team Green"];
  const TEAM_COLORS = ["var(--team1)", "var(--team2)", "var(--team3)", "var(--team4)"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const settings = { teams: 2, rounds: 5, book: "all" };
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
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    const target = (focusSel && $(focusSel)) || focusables()[0];
    setFocus(target);
  }

  /* ---------- tiny sound effects (Web Audio, no files) ---------- */
  let audio = null;
  function beep(freqs, dur = 0.12) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = audio.currentTime + i * dur;
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audio.destination);
        o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) { /* sound is optional */ }
  }

  /* ---------- book picker ---------- */
  function deckFor(book) {
    return book === "all" ? PUZZLES : PUZZLES.filter((p) => p.book === book);
  }
  function bookLabel(book) {
    return book === "all" ? "All the books, mixed" : BOOKS[book].title;
  }
  function buildBookList() {
    const box = $("#book-list");
    Object.keys(BOOKS).forEach((key) => {
      const b = document.createElement("button");
      b.className = "book focusable";
      b.dataset.book = key;
      b.innerHTML = `<img alt="" /><b></b><small>${deckFor(key).length} puzzles</small>`;
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
    mix.firstChild.insertAdjacentHTML("beforeend", "<span>+</span>");
    box.appendChild(mix);
  }
  buildBookList();

  function chooseBook(book) {
    settings.book = book;
    $("#setup-book").textContent = bookLabel(book);
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
    // Every team gets the same number of turns, capped by how many puzzles the book has.
    const pool = deckFor(settings.book);
    const perTeam = Math.max(1, Math.min(settings.rounds, Math.floor(pool.length / settings.teams)));
    game = {
      book: settings.book,
      deck: shuffle(pool.slice()).slice(0, perTeam * settings.teams),
      index: 0,
      scores: new Array(settings.teams).fill(0),
      teams: settings.teams
    };
    startRound();
  }

  function startRound() {
    const p = game.deck[game.index];
    game.shown = Math.min(START_SHOWN, p.ingredients.length);
    game.options = shuffle(p.options.slice());
    game.team = game.index % game.teams;

    $("#turn").textContent = game.teams === 1 ? "Your turn" : TEAM_NAMES[game.team] + "'s turn";
    $("#turn").style.color = TEAM_COLORS[game.team];
    $("#progress").innerHTML = `<span class="round-book"></span><br />Round ${game.index + 1} of ${game.deck.length}`;
    $("#progress .round-book").textContent = game.book === "all" ? "All books" : BOOKS[game.book].name;
    renderScores();

    const list = $("#ingredients");
    list.innerHTML = "";
    p.ingredients.forEach((ing, i) => {
      const li = document.createElement("li");
      li.textContent = ing;
      if (i >= game.shown) { li.className = "hidden"; li.setAttribute("aria-hidden", "true"); }
      list.appendChild(li);
    });

    const box = $("#answers");
    box.innerHTML = "";
    game.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "answer focusable";
      b.dataset.action = "answer";
      b.dataset.choice = opt;
      b.innerHTML = `<span class="n">${i + 1}</span><span></span>`;
      b.lastChild.textContent = opt;
      box.appendChild(b);
    });

    updateWorth();
    show("s-round", "#answers .answer");
  }

  function points() {
    return Math.max(1, MAX_POINTS - (game.shown - Math.min(START_SHOWN, game.deck[game.index].ingredients.length)));
  }

  function updateWorth() {
    const p = game.deck[game.index];
    const pts = points();
    $("#worth").textContent = `Worth ${pts} point${pts === 1 ? "" : "s"}`;
    $("#reveal").disabled = game.shown >= p.ingredients.length;
  }

  function reveal() {
    const p = game.deck[game.index];
    if (game.shown >= p.ingredients.length) return;
    const li = $("#ingredients").children[game.shown];
    li.className = "new";
    li.removeAttribute("aria-hidden");
    game.shown++;
    beep([520]);
    updateWorth();
    if ($("#reveal").disabled) setFocus($("#answers .answer"));
  }

  function answer(choice) {
    const p = game.deck[game.index];
    const right = choice === p.answer;
    const pts = right ? points() : 0;
    game.scores[game.team] += pts;
    beep(right ? [660, 880] : [300, 200], 0.16);

    const v = $("#verdict");
    v.className = "verdict " + (right ? "good" : "bad");
    v.textContent = right ? `Correct! +${pts} point${pts === 1 ? "" : "s"}` : `Nope — you said ${choice}.`;
    $("#r-answer").textContent = p.answer;
    const k = $("#r-kind");
    k.className = "r-kind " + p.kind;
    k.textContent = p.kind === "food" ? "It's food" : "It's not food";
    $("#r-spot-name").textContent = p.spotlight.name;
    $("#r-spot-note").textContent = p.spotlight.note;
    const bk = BOOKS[p.book];
    $("#r-book").href = bk.url;
    $("#r-cover").src = bk.cover;
    $("#r-cover").alt = bk.title + " cover";
    $("#r-book-title").textContent = bk.title;
    $("#next-btn").textContent = game.index + 1 >= game.deck.length ? "See final scores" : "Next round";
    show("s-result");
  }

  function next() {
    game.index++;
    if (game.index >= game.deck.length) finish(); else startRound();
  }

  function renderScores() {
    const box = $("#scores");
    box.innerHTML = "";
    if (game.teams === 1) {
      box.innerHTML = `<div class="score on" style="color:${TEAM_COLORS[0]}"><i></i><span>${game.scores[0]} pts</span></div>`;
      return;
    }
    game.scores.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "score" + (i === game.team ? " on" : "");
      d.style.color = TEAM_COLORS[i];
      d.innerHTML = `<i></i><span>${s}</span>`;
      box.appendChild(d);
    });
  }

  function finish() {
    const order = game.scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const top = order[0].s;
    const winners = order.filter((o) => o.s === top);
    const w = $("#winner");
    if (game.teams === 1) {
      const max = game.deck.length * MAX_POINTS;
      w.textContent = `${top} of ${max} points!`;
      w.style.color = "";
    } else if (winners.length > 1) {
      w.textContent = "It's a tie!";
      w.style.color = "";
    } else {
      w.textContent = TEAM_NAMES[winners[0].i] + " wins!";
      w.style.color = TEAM_COLORS[winners[0].i];
    }
    const list = $("#final-scores");
    list.innerHTML = "";
    if (game.teams > 1) {
      order.forEach((o) => {
        const li = document.createElement("li");
        li.style.color = TEAM_COLORS[o.i];
        li.innerHTML = `<i></i><span>${TEAM_NAMES[o.i]} — ${o.s}</span>`;
        list.appendChild(li);
      });
    }
    const bk = game.book === "all" ? null : BOOKS[game.book];
    const cover = $("#f-cover");
    cover.hidden = !bk;
    if (bk) { cover.src = bk.cover; cover.alt = bk.title + " cover"; }
    $("#f-qr").src = bk ? bk.qr : SERIES.qr;
    $("#f-title").textContent = bk ? bk.title : "the Ingredient Dictionary books";
    $("#f-link").href = bk ? bk.url : SERIES.url;
    $("#f-link").innerHTML = bk ? "Get the book &rarr;" : "See all the books &rarr;";
    beep([523, 659, 784, 1047], 0.13);
    show("s-final");
  }

  /* ---------- quit confirm ---------- */
  const modal = $("#m-quit");
  let focusBeforeModal = null;
  function openQuit() {
    focusBeforeModal = focused;
    modal.hidden = false;
    setFocus($(".focusable", modal));
  }
  function closeQuit() { modal.hidden = true; setFocus(focusBeforeModal); }

  /* ---------- actions ---------- */
  function act(el) {
    if (!el) return;
    if (el.dataset.teams) { pick(el, "teams"); return; }
    if (el.dataset.rounds) { pick(el, "rounds"); return; }
    if (el.dataset.book) { chooseBook(el.dataset.book); return; }
    switch (el.dataset.action) {
      case "books": show("s-books", `#book-list [data-book="${settings.book}"]`); break;
      case "howto": show("s-howto"); break;
      case "title": show("s-title"); break;
      case "start": startGame(); break;
      case "reveal": reveal(); break;
      case "answer": answer(el.dataset.choice); break;
      case "next": next(); break;
      case "quit-yes": modal.hidden = true; show("s-title"); break;
      case "quit-no": closeQuit(); break;
    }
  }
  function pick(el, key) {
    $$(".chip", el.parentElement).forEach((c) => c.classList.toggle("selected", c === el));
    settings[key] = Number(el.dataset[key]);
    // Guide the remote: teams -> rounds -> Start.
    setFocus(key === "teams" ? $("#s-setup [data-rounds].selected") : $('#s-setup [data-action="start"]'));
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest(".focusable");
    if (el && !el.disabled) { setFocus(el); act(el); }
  });

  /* ---------- remote / keyboard navigation ---------- */
  let focused = null;
  function scope() { return modal.hidden ? $("#" + current) : modal; }
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
    const best = pickBest(true) || (dir === "up" || dir === "down" ? pickBest(false) : null);
    if (best) setFocus(best);
  }

  function back() {
    if (!modal.hidden) { closeQuit(); return; }
    if (current === "s-round" || current === "s-result") { openQuit(); return; }
    if (current === "s-setup") { act({ dataset: { action: "books" } }); return; }
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
    if (current === "s-round" && modal.hidden) {
      const n = e.keyCode >= 49 && e.keyCode <= 52 ? e.keyCode - 49 : e.keyCode >= 97 && e.keyCode <= 100 ? e.keyCode - 97 : -1;
      if (n >= 0) { const b = $$("#answers .answer")[n]; if (b) { setFocus(b); act(b); } return; }
      if (e.key === "r" || e.key === "R") { reveal(); return; }
    }
  });

  // Samsung TVs only send number keys to apps that ask for them.
  try {
    if (window.tizen && tizen.tvinputdevice) ["1", "2", "3", "4"].forEach((k) => tizen.tvinputdevice.registerKey(k));
  } catch (e) { /* not on a Samsung TV */ }

  show("s-title");
})();
