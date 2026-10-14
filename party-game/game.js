/* It's Not Food — game logic + TV remote navigation. No build step, no server. */
(function () {
  "use strict";

  const START_SHOWN = 3;   // ingredients visible when a round starts
  const MAX_POINTS = 5;    // points if answered with only the starting clues
  const TF_POINTS = 3;     // a true/false question
  const TEAM_NAMES = ["Team Orange", "Team Blue", "Team Purple", "Team Green"];
  const TEAM_COLORS = ["var(--team1)", "var(--team2)", "var(--team3)", "var(--team4)"];
  const TEAM_COLORS_HEX = ["#E07A55", "#6FA3D9", "#B392D6", "#6CC596"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const settings = { teams: 2, rounds: 5, book: "all", dare: 1 };

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
    const pool = deckFor(settings.book);
    return Math.max(1, Math.min(settings.rounds, Math.floor(pool.length / settings.teams)));
  }
  function updateTotal() {
    const per = turnsPerTeam();
    const total = per * settings.teams;
    $("#setup-total").textContent = settings.teams === 1
      ? `${total} rounds`
      : `${total} rounds total — ${per} for each team` + (per < settings.rounds ? " (that's every puzzle in this book)" : "");
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
    const pool = deckFor(settings.book);
    const perTeam = turnsPerTeam();
    game = {
      book: settings.book,
      deck: shuffle(pool.slice()).slice(0, perTeam * settings.teams),
      index: 0,
      scores: new Array(settings.teams).fill(0),
      teams: settings.teams
    };
    startRound();
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
    game.options = choicesFor(p);
    game.team = game.index % game.teams;
    $(".label-card").classList.toggle("tf", tf);
    $("#answers").classList.toggle("tf", tf);
    $(".label-head span").textContent = tf ? "TRUE OR FALSE?" : "INGREDIENTS:";
    $("#statement").hidden = !tf;
    $("#help").hidden = tf;
    $("#statement").textContent = tf ? p.statement : "";

    $("#turn").textContent = game.teams === 1 ? "Your turn" : TEAM_NAMES[game.team] + "'s turn";
    $("#turn").style.color = TEAM_COLORS[game.team];
    $("#progress").innerHTML = `<span class="round-book"></span><br />Round ${game.index + 1} of ${game.deck.length}`;
    $("#progress .round-book").textContent = game.book === "all" ? "All books" : BOOKS[game.book].name;
    renderScores();
    showStakes();

    const list = $("#ingredients");
    list.innerHTML = "";
    game.helped = new Set();
    resetHelp();
    (p.ingredients || []).forEach((ing, i) => {
      const li = document.createElement("li");
      if (i < game.shown) li.appendChild(ingredientButton(ing, i));
      else { li.className = "hidden"; li.textContent = ing; li.setAttribute("aria-hidden", "true"); }
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

  // Rising stakes: every full lap of turns adds +1 to what a question is worth,
  // and each team's last turn counts double. Reveals and help still subtract.
  function lapOf(i) { return Math.floor(i / game.teams); }
  function laps() { return game.deck.length / game.teams; }
  function isFinal(i) { return laps() > 1 && lapOf(i) === laps() - 1; }
  function basePoints(i) {
    return (game.deck[i].type === "tf" ? TF_POINTS : MAX_POINTS) + lapOf(i);
  }
  function points() {
    const i = game.index, p = game.deck[i];
    const reveals = p.type === "tf" ? 0 : game.shown - Math.min(START_SHOWN, p.ingredients.length);
    const pts = Math.max(1, basePoints(i) - reveals - game.helped.size);
    return isFinal(i) ? pts * 2 : pts;
  }
  function showStakes() {
    const i = game.index, el = $("#stakes");
    el.className = "stakes";
    if (isFinal(i)) {
      el.textContent = "Final round ×2";
      el.classList.add("is-final");
      if (i % game.teams === 0) { beep([523, 784, 1047], 0.12); confetti(90, ["#F2C46B", "#E07A55"]); }
    } else if (lapOf(i) > 0) {
      el.textContent = `Points are up +${lapOf(i)}`;
    }
    el.hidden = !(isFinal(i) || lapOf(i) > 0);
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
    t.innerHTML = `Tap an ingredient to see what it is <span>(−${cost} point${cost > 1 ? "s" : ""})</span>`;
  }
  function help(i) {
    const p = game.deck[game.index];
    const ing = p.ingredients[i];
    const first = !game.helped.has(i);
    if (first && points() > 1) beep([440]);
    game.helped.add(i);
    const info = watchInfo(ing);
    const t = $("#help-text");
    t.className = "help-text on" + (info ? " " + info.level : "");
    t.innerHTML = "<b></b> <span class='what'></span>" + (info ? " <em></em>" : "");
    t.querySelector("b").textContent = ing + ":";
    t.querySelector(".what").textContent = glossaryFor(ing);
    if (info) t.querySelector("em").textContent = info.tag;
    $$("#ingredients .ing").forEach((b) => b.classList.toggle("looked", game.helped.has(Number(b.dataset.i))));
    updateWorth();
  }

  function updateWorth() {
    const p = game.deck[game.index];
    const pts = points();
    $("#worth").textContent = `Worth ${pts} point${pts === 1 ? "" : "s"}`;
    $("#reveal").disabled = p.type === "tf" || game.shown >= p.ingredients.length;
  }

  function reveal() {
    const p = game.deck[game.index];
    if (p.type === "tf" || game.shown >= p.ingredients.length) return;
    const li = $("#ingredients").children[game.shown];
    li.className = "new";
    li.removeAttribute("aria-hidden");
    li.textContent = "";
    li.appendChild(ingredientButton(p.ingredients[game.shown], game.shown));
    game.shown++;
    beep([520]);
    updateWorth();
    if ($("#reveal").disabled) setFocus($("#answers .answer"));
  }

  function answer(choice) {
    const p = game.deck[game.index];
    const tf = p.type === "tf";
    const correct = tf ? (p.answer ? "True" : "False") : p.answer;
    const right = choice === correct;
    const pts = right ? points() : 0;
    game.scores[game.team] += pts;
    beep(right ? [660, 880] : [300, 200], 0.16);
    if (right) confetti(70, [TEAM_COLORS_HEX[game.team]]);

    const v = $("#verdict");
    v.className = "verdict " + (right ? "good" : "bad");
    v.textContent = right ? `Correct! +${pts} point${pts === 1 ? "" : "s"}` : `Nope — you said ${choice}.`;
    $("#r-answer").textContent = tf ? `${correct}.` : correct;
    const k = $("#r-kind");
    k.hidden = tf;
    if (!tf) {
      k.className = "r-kind " + p.kind;
      k.textContent = p.kind === "food" ? "It's food" : "It's not food";
    }

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
    $("#next-btn").textContent = game.index + 1 >= game.deck.length ? "See final scores" : "Next round";

    show("s-result", "#next-btn");
  }

  function renderWatch(p) {
    const list = $("#watch-list");
    list.innerHTML = "";
    const seen = new Set();
    (p.ingredients || []).forEach((ing) => {
      const info = watchInfo(ing);
      if (!info || seen.has(ing)) return;
      seen.add(ing);
      const li = document.createElement("li");
      li.className = info.level;
      li.innerHTML = "<b></b><small></small>";
      li.firstChild.textContent = ing;
      li.lastChild.textContent = info.tag;
      list.appendChild(li);
    });
    $("#watch").hidden = !list.children.length;
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

  function maxPoints() {
    return game.deck.reduce((sum, p, i) => sum + basePoints(i) * (isFinal(i) ? 2 : 1), 0);
  }

  function finish() {
    const order = game.scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const top = order[0].s;
    const winners = order.filter((o) => o.s === top);
    const w = $("#winner");
    if (game.teams === 1) {
      const max = maxPoints();
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
    // Loser's dare: last place (all tied for last) does it. Solo players get one
    // if they scored under half the possible points.
    const low = order[order.length - 1].s;
    const losers = order.filter((o) => o.s === low).map((o) => o.i);
    let who = null;
    if (settings.dare) {
      if (game.teams === 1) who = top < maxPoints() / 2 ? "Your dare" : null;
      else if (losers.length === game.teams) who = "Everybody's dare";
      else who = losers.map((i) => TEAM_NAMES[i]).join(" & ") + (losers.length > 1 ? "'s dare" : "'s dare");
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

    beep([523, 659, 784, 1047], 0.13);
    show("s-final");
    const winColors = game.teams === 1 || winners.length > 1 ? TEAM_COLORS_HEX : [TEAM_COLORS_HEX[winners[0].i]];
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
    if (el.dataset.dare) { pick(el, "dare"); return; }
    if (el.dataset.book) { chooseBook(el.dataset.book); return; }
    switch (el.dataset.action) {
      case "books": show("s-books", `#book-list [data-book="${settings.book}"]`); break;
      case "howto": show("s-howto"); break;
      case "title": show("s-title"); break;
      case "start": startGame(); break;
      case "reveal": reveal(); break;
      case "answer": answer(el.dataset.choice); break;
      case "next": next(); break;
      case "new-dare": showDare(); break;
      case "help": help(Number(el.dataset.i)); break;
      case "quit-yes": modal.hidden = true; show("s-title"); break;
      case "quit-no": closeQuit(); break;
    }
  }
  function pick(el, key) {
    $$(".chip", el.parentElement).forEach((c) => c.classList.toggle("selected", c === el));
    settings[key] = Number(el.dataset[key]);
    updateTotal();
    // Guide the remote: teams -> rounds -> dare -> Start.
    const nextFocus = { teams: "#s-setup [data-rounds].selected", rounds: "#s-setup [data-dare].selected", dare: '#s-setup [data-action="start"]' };
    setFocus($(nextFocus[key]));
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
