/* Game rules, ported 1:1 from ../party-game/game.js (the web game).
   Plain JS with no React Native imports, so it runs under `node --test` too.
   The UI (App.js) owns timing (pop-ups, the answer clock, music); everything
   about points, turns, steals, bets, the finale and dares lives here. */
import { BOOKS, SERIES, PUZZLES, watchInfo, glossaryFor } from "./data.js";

export { BOOKS, SERIES, PUZZLES, watchInfo, glossaryFor };

export const START_SHOWN = 3;   // ingredients visible when a round starts
export const MAX_POINTS = 5;    // points if answered with only the starting clues
export const TF_POINTS = 3;     // a true/false question
export const TEAM_NAMES = ["Team Orange", "Team Blue", "Team Purple", "Team Green"];
export const TEAM_COLORS_HEX = ["#E07A55", "#6FA3D9", "#B392D6", "#6CC596"];
export const STEAL_SECONDS = 10;
export const TIMER_SECONDS = { 1: 60, 2: 45, 3: 30 };   // Easy / Medium / Hard
export const LEVEL_BONUS = { 1: 0, 2: 1, 3: 2 };        // Medium +1, Hard +2 on ingredient questions
export const EXTEND_SECONDS = 15;

// Silly, safe dares for the last-place team.
export const DARES = [
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

export function defaultSettings() {
  return { teams: 2, rounds: 5, book: "all", dare: 1, level: 1, timer: 0, steal: 1, colors: [0, 1] };
}

export const plural = (n) => `${n} point${n === 1 ? "" : "s"}`;
export const teamName = (game, t) => TEAM_NAMES[game.colors[t]];
export const teamHex = (game, t) => TEAM_COLORS_HEX[game.colors[t]];

/* ---------- books ---------- */
export function deckFor(book) {
  return book === "all" ? PUZZLES : PUZZLES.filter((p) => p.book === book);
}
// Every game except the toilet paper book itself ends with a true-or-false finale.
export function hasFinale(book) { return book !== "tp"; }
export function mainPool(book) {
  return hasFinale(book) ? deckFor(book).filter((p) => p.type !== "tf") : deckFor(book);
}
export function bookLabel(book) {
  return book === "all" ? "All the books, mixed" : BOOKS[book].title;
}
// Every team gets the same number of turns, capped by how many puzzles the book has.
export function turnsPerTeam(settings) {
  const pool = mainPool(settings.book);
  return Math.max(1, Math.min(settings.rounds, Math.floor(pool.length / settings.teams)));
}
export function setupTotalText(settings) {
  const per = turnsPerTeam(settings);
  const total = per * settings.teams;
  const finale = (hasFinale(settings.book) ? " + a toilet paper true-or-false finale" : "") +
    (settings.timer ? ` · ${TIMER_SECONDS[settings.level]} seconds per question` : "");
  return (settings.teams === 1
    ? `${total} rounds`
    : `${total} rounds — ${per} for each team` + (per < settings.rounds ? " (every puzzle in this book)" : "")) + finale;
}

/* ---------- dealing ---------- */
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// No repeats: the device remembers which puzzles it has shown and deals unseen
// ones first. Once a book runs out, that book starts over.
export const puzzleKey = (p) => p.book + "|" + (p.statement || p.answer);
export function dealFresh(pool, n, seen, rng = Math.random) {
  let hand = shuffle(pool.filter((p) => !seen.has(puzzleKey(p))), rng).slice(0, n);
  if (hand.length < n) {
    pool.forEach((p) => seen.delete(puzzleKey(p)));
    hand = shuffle(hand.concat(shuffle(pool.filter((p) => !hand.includes(p)), rng).slice(0, n - hand.length)), rng);
  }
  return hand;
}

// Last game's colors carry over when the team count is the same.
export function keepColors(settings) {
  const c = settings.colors.filter((x, i, a) => a.indexOf(x) === i).slice(0, settings.teams);
  for (let i = 0; c.length < settings.teams; i++) if (!c.includes(i)) c.push(i);
  return c;
}

export function newGame(settings, seen, rng = Math.random) {
  const pool = mainPool(settings.book);
  const perTeam = turnsPerTeam(settings);
  let deck = dealFresh(pool, perTeam * settings.teams, seen, rng);
  if (hasFinale(settings.book)) deck = deck.concat(dealFresh(deckFor("tp"), settings.teams, seen, rng));
  return {
    settings,
    book: settings.book,
    deck,
    index: 0,
    scores: new Array(settings.teams).fill(0),
    teams: settings.teams,
    colors: keepColors(settings),
    turnOrder: [...Array(settings.teams).keys()],
    shuffled: false
  };
}

/* ---------- team colors + turn order ---------- */
export function toggleColor(game, c) {
  const picked = game.colors, i = picked.indexOf(c);
  if (i >= 0) picked.splice(i, 1);
  else { picked.push(c); if (picked.length > game.teams) picked.shift(); }   // swap out the oldest pick
}
export function pickTip(game) {
  const n = game.teams, picked = game.colors;
  return picked.length === n ? "Every team has a color. Now shuffle to see who goes first!"
    : `Pick ${n} colors — one for each team. ${picked.length} of ${n} picked.`;
}
// Returns false (and a tip) if not every team has a color yet.
export function shuffleOrder(game, rng = Math.random) {
  if (game.colors.length !== game.teams) {
    return { ok: false, tip: `Pick ${game.teams} colors first — ${game.colors.length} of ${game.teams} picked.` };
  }
  game.settings.colors = game.colors.slice();
  let next = shuffle(game.turnOrder.slice(), rng);
  if (game.shuffled && next.join() === game.turnOrder.join()) next = next.slice(1).concat(next[0]);
  game.turnOrder = next;
  game.shuffled = true;
  return { ok: true };
}

/* ---------- rounds ---------- */
// A single book keeps every answer choice in that book's world; "Mix all books"
// uses the cross-category decoys.
export function choicesFor(game, p, rng = Math.random) {
  if (p.type === "tf") return ["True", "False"];
  if (game.book === "all") return shuffle(p.options.slice(), rng);
  const others = shuffle(deckFor(p.book).filter((q) => q.type !== "tf" && q.answer !== p.answer).map((q) => q.answer), rng);
  return shuffle([p.answer].concat(others.slice(0, 3)), rng);
}

// Which ingredients appear first. Easy: top of the label down. Medium: middle out.
// Hard: bottom of the label (the tiny-amount chemicals) upward.
export function revealOrder(n, level) {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (level === 3) return idx.reverse();
  if (level === 2) {
    const mid = (n - 1) / 2;
    return idx.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a);
  }
  return idx;
}

export const currentPuzzle = (game) => game.deck[game.index];

export function startRound(game, seen, rng = Math.random) {
  const p = game.deck[game.index];
  seen.add(puzzleKey(p));
  const tf = p.type === "tf";
  game.shown = tf ? 0 : Math.min(START_SHOWN, p.ingredients.length);
  game.order = tf ? [] : revealOrder(p.ingredients.length, game.settings.level);
  game.open = new Set(game.order.slice(0, game.shown));
  game.options = choicesFor(game, p, rng);
  game.team = game.turnOrder[game.index % game.teams];
  game.helped = new Set();
  game.extended = false;
  game.wager = null;
  game.steal = null;
  game.chain = null;
  game.locked = false;
  game.verdict = null;
  return p;
}

/* ---------- rising stakes ---------- */
// Every full lap of turns adds +1 to what a question is worth, and each team's
// last turn counts double. Reveals and the +15 sec still subtract.
export function lapOf(game, i) { return Math.floor(i / game.teams); }
export function laps(game) { return game.deck.length / game.teams; }
export function isFinal(game, i) { return laps(game) > 1 && lapOf(game, i) === laps(game) - 1; }
export function isWager(game, i) { return isFinal(game, i) && game.deck[i].type === "tf"; }
export function basePoints(game, i) {
  const p = game.deck[i];
  return (p.type === "tf" ? TF_POINTS : MAX_POINTS + LEVEL_BONUS[game.settings.level]) + lapOf(game, i);
}
export function extendCost(game, i) { return 1 + lapOf(game, i); }
export function points(game) {
  const i = game.index, p = game.deck[i];
  if (isWager(game, i)) return game.wager || 0;
  const reveals = p.type === "tf" ? 0 : game.shown - Math.min(START_SHOWN, p.ingredients.length);
  const pts = Math.max(1, basePoints(game, i) - reveals - (game.extended ? extendCost(game, i) : 0));
  return isFinal(game, i) ? pts * 2 : pts;
}
export function worthText(game) {
  const pts = points(game);
  if (game.steal) return `Steal: ${plural(game.steal.value)}`;
  return isWager(game, game.index)
    ? (game.wager === null ? "Bet first" : `Bet: ${pts} point${pts === 1 ? "" : "s"}`)
    : `Worth ${pts} point${pts === 1 ? "" : "s"}`;
}
// Banner next to whose turn it is: null, or { text, kind: "final" | "up" | "steal" }
export function stakes(game) {
  const i = game.index;
  if (game.steal) return { text: `Win ${game.steal.value} · miss = −${game.steal.value}`, kind: "steal" };
  if (isFinal(game, i)) return { text: isWager(game, i) ? "Place your bet" : "Final round ×2", kind: "final" };
  if (lapOf(game, i) > 0) return { text: `Points are up +${lapOf(game, i)}`, kind: "up" };
  return null;
}
// The final lap starts with a drumroll + confetti (only for the first team of that lap).
export function isFinalLapStart(game) { return isFinal(game, game.index) && game.index % game.teams === 0; }

export function maxPoints(game) {
  // Bets don't count toward the maximum — they depend on the score so far.
  return game.deck.reduce((sum, p, i) => sum + (isWager(game, i) ? 0 : basePoints(game, i) * (isFinal(game, i) ? 2 : 1)), 0);
}

/* ---------- +15 seconds ---------- */
export function canExtend(game, timerRunning) {
  return !!(game.settings.timer && timerRunning && !game.extended && !game.steal && !isWager(game, game.index));
}
export function extendLabel(game) {
  const cost = extendCost(game, game.index) * (isFinal(game, game.index) ? 2 : 1);
  return `+${EXTEND_SECONDS} sec −${cost} pt${cost === 1 ? "" : "s"}`;
}
export function applyExtend(game) { game.extended = true; }

/* ---------- toilet paper finale: bet before you see the question ---------- */
// A right answer wins the bet, a wrong answer loses it (scores never go below
// zero). Teams with few points can still bet up to 10.
export function wagerOptions(score) {
  const base = Math.max(score, 10);
  const amounts = [0, Math.ceil(base / 4), Math.ceil(base / 2), base];
  return amounts.filter((a, i) => amounts.indexOf(a) === i);
}
export function wagerChoices(game) {
  const score = game.scores[game.team];
  return wagerOptions(score).map((a) => ({
    value: a,
    label: a === 0 ? "Play it safe — bet 0" : a === score ? `All in — bet ${a}` : `Bet ${a}`
  }));
}
export function wagerPrompt(game) {
  const score = game.scores[game.team];
  return `Place your bet! You have ${score} point${score === 1 ? "" : "s"}. ` +
    "Get it right and win your bet. Get it wrong and lose it.";
}
export function placeWager(game, amount) { game.wager = amount; }
export const needsWager = (game) => isWager(game, game.index) && game.wager === null;

/* ---------- reveals + help ---------- */
// Uncover a chosen ingredient, or the next one in difficulty order. Returns its index or -1.
export function reveal(game, pick) {
  if (game.steal) return -1;
  const p = game.deck[game.index];
  if (p.type === "tf" || game.shown >= p.ingredients.length) return -1;
  const idx = pick !== undefined && pick !== null && !game.open.has(pick) ? pick : game.order.find((i) => !game.open.has(i));
  game.open.add(idx);
  game.shown++;
  return idx;
}
export function canReveal(game) {
  const p = game.deck[game.index];
  return !game.steal && p.type !== "tf" && game.shown < p.ingredients.length;
}
// Looking an ingredient up is free. Returns { first, ingredient, what, info }.
export function help(game, i) {
  const p = game.deck[game.index];
  const ing = p.ingredients[i];
  const first = !game.steal && !game.helped.has(i);
  if (!game.steal) game.helped.add(i);
  return { first, ingredient: ing, what: glossaryFor(ing), info: watchInfo(ing) };
}

/* ---------- answering ---------- */
export const correctAnswer = (p) => (p.type === "tf" ? (p.answer ? "True" : "False") : p.answer);
export function canSteal(game, p) {
  return !!(game.settings.steal && game.teams > 1 && p.type !== "tf");
}

// choice === null means the clock ran out.
// Returns one of:
//   { type: "miss", sfx, popSub }                   -> show WRONG!, then call offerSteal()
//   { type: "done", sfx, right, pop, verdict, confetti } -> show the pop, then the answer screen
export function answer(game, choice) {
  const timedOut = choice === null;
  const p = game.deck[game.index];
  const right = choice === correctAnswer(p);
  if (game.steal) return finishSteal(game, choice, right, timedOut);
  const wager = isWager(game, game.index);
  if (!right && !wager && canSteal(game, p)) return firstMiss(game, choice, timedOut);
  const pts = right ? points(game) : 0;
  const lost = wager && !right ? Math.min(game.wager, game.scores[game.team]) : 0;
  game.scores[game.team] += pts - lost;
  const text = right && wager && !pts ? "Correct! You bet 0, so your score stays the same."
    : right ? `Correct! +${pts} point${pts === 1 ? "" : "s"}`
    : timedOut ? (lost ? `Time's up! You lose ${lost} point${lost === 1 ? "" : "s"}.` : "Time's up!")
    : lost ? `Nope — you said ${choice}. You lose ${lost} point${lost === 1 ? "" : "s"}.`
    : `Nope — you said ${choice}.`;
  game.verdict = { good: right, text };
  const who = game.teams === 1 ? "You" : teamName(game, game.team);
  const sub = right ? (pts ? `${who} +${plural(pts)}` : `${who} kept their points`)
    : timedOut ? `${who} ran out of time` + (lost ? ` — loses ${plural(lost)}` : "")
    : `${who} said ${choice}` + (lost ? ` — loses ${plural(lost)}` : "");
  return {
    type: "done", right, points: pts, lost,
    sfx: right ? "correct" : lost ? "lose" : timedOut ? "timeup" : "wrong",
    pop: { good: right, sub },
    confetti: right ? { count: 70, colors: [teamHex(game, game.team)] } : null
  };
}

/* ---------- steals ---------- */
// A miss triggers WRONG!, then "Steal it?". Each team gets one try per question;
// every steal is worth half the last one, a missed steal loses that much, and the
// chain runs until someone gets it or nobody's left.
function firstMiss(game, choice, timedOut) {
  game.chain = {
    value: Math.max(1, Math.ceil(points(game) / 2)),
    tried: new Set([game.team]),
    removed: timedOut ? [] : [choice],
    missText: timedOut ? "Time's up!" : `Nope — you said ${choice}.`,
    steals: 0
  };
  return {
    type: "miss",
    sfx: timedOut ? "timeup" : "wrong",
    popSub: `${teamName(game, game.team)} ${timedOut ? "ran out of time" : `said ${choice}`}`
  };
}
// Returns { type: "offer", kicker, sub, teams: [team indexes] } or { type: "nobody" }.
export function offerSteal(game) {
  const ch = game.chain;
  const left = game.options.filter((o) => !ch.removed.includes(o));
  const teams = Array.from({ length: game.teams }, (_, i) => i).filter((i) => !ch.tried.has(i));
  if (!teams.length || left.length <= 1) return nobodyGotIt(game);
  return {
    type: "offer",
    kicker: ch.steals ? "Still up for grabs!" : "Up for grabs!",
    sub: `First team to yell “STEAL!” gets it — worth ${plural(ch.value)}. Miss it and lose ${ch.value}.`,
    teams
  };
}
export function startSteal(game, team) {
  const ch = game.chain;
  game.steal = { team, value: ch.value };
  ch.tried.add(team); ch.steals++;
}
export const isStruck = (game, choice) => !!(game.chain && game.chain.removed.includes(choice));
function finishSteal(game, choice, right, timedOut) {
  const s = game.steal, ch = game.chain, name = teamName(game, s.team);
  if (right) {
    game.scores[s.team] += s.value;
    game.verdict = { good: true, text: `${name} steals it! +${plural(s.value)}` };
    return {
      type: "done", right: true, points: s.value, lost: 0, sfx: "correct",
      pop: { good: true, sub: `${name} steals it! +${plural(s.value)}` },
      confetti: { count: 110, colors: [teamHex(game, s.team)] }
    };
  }
  const lost = Math.min(s.value, game.scores[s.team]);
  game.scores[s.team] -= lost;
  if (!timedOut) ch.removed.push(choice);
  game.steal = null;
  ch.value = Math.max(1, Math.ceil(ch.value / 2));
  return {
    type: "miss",
    sfx: lost ? "lose" : timedOut ? "timeup" : "wrong",
    popSub: `${name} ${timedOut ? "ran out of time" : `said ${choice}`}` + (lost ? ` — loses ${plural(lost)}` : "")
  };
}
export function nobodyGotIt(game) {
  game.verdict = {
    good: false,
    text: game.chain && game.chain.steals ? "Nobody got it!" : game.chain ? game.chain.missText : "Nobody got it!"
  };
  return { type: "nobody" };
}

/* ---------- answer screen ---------- */
export function resultInfo(game) {
  const p = game.deck[game.index];
  const tf = p.type === "tf";
  const correct = correctAnswer(p);
  // Group ingredients that share a tag ("Red 40, Yellow 5, Blue 1 — Synthetic dye").
  const groups = new Map();
  (p.ingredients || []).forEach((ing) => {
    const info = watchInfo(ing);
    if (!info) return;
    const key = info.level + "|" + info.tag;
    if (!groups.has(key)) groups.set(key, { level: info.level, tag: info.tag, names: [] });
    if (!groups.get(key).names.includes(ing)) groups.get(key).names.push(ing);
  });
  const last = game.index + 1 >= game.deck.length;
  const up = last || game.teams === 1 ? null : game.turnOrder[(game.index + 1) % game.teams];
  return {
    puzzle: p,
    verdict: game.verdict || { good: false, text: "" },
    answer: tf ? `${correct}.` : correct,
    spotTag: tf ? "The real story" : "Weird ingredient spotlight",
    spotName: tf ? p.statement : p.spotlight.name,
    spotNote: tf ? p.explain : p.spotlight.note,
    watch: [...groups.values()].map((g) => ({ level: g.level, tag: g.tag, names: g.names.join(", ") })),
    book: p.book,
    bookTitle: BOOKS[p.book].title,
    next: last ? { text: "See final scores" } : game.teams === 1 ? { text: "Next round" }
      : { text: "Up next: ", team: up, teamName: teamName(game, up), color: teamHex(game, up) }
  };
}
// After the answer screen: true if the game is over.
export function advance(game) {
  game.index++;
  return game.index >= game.deck.length;
}

/* ---------- final scores + dare ---------- */
export function finish(game) {
  const order = game.scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const top = order[0].s;
  const winners = order.filter((o) => o.s === top);
  let winner, winnerColor = null;
  if (game.teams === 1) winner = `You scored ${top} point${top === 1 ? "" : "s"}!`;
  else if (winners.length > 1) winner = "It's a tie!";
  else { winner = teamName(game, winners[0].i) + " wins!"; winnerColor = teamHex(game, winners[0].i); }
  const list = game.teams > 1 ? order.map((o) => ({ team: o.i, color: teamHex(game, o.i), text: `${teamName(game, o.i)} — ${o.s}` })) : [];
  // Loser's dare: last place (all tied for last) does it. Solo players get one
  // if they scored under half the possible points.
  const low = order[order.length - 1].s;
  const losers = order.filter((o) => o.s === low).map((o) => o.i);
  let dareWho = null;
  if (game.settings.dare) {
    if (game.teams === 1) dareWho = top < maxPoints(game) / 2 ? "Your dare" : null;
    else if (losers.length === game.teams) dareWho = "Everybody's dare";
    else dareWho = losers.map((i) => teamName(game, i)).join(" & ") + "'s dare";
  }
  const bk = game.book === "all" ? null : BOOKS[game.book];
  const winColors = game.teams === 1 || winners.length > 1 ? game.colors.map((c) => TEAM_COLORS_HEX[c]) : [teamHex(game, winners[0].i)];
  return {
    winner, winnerColor, list, dareWho,
    promoBook: bk ? game.book : null,
    promoTitle: bk ? bk.title : "the Ingredient Dictionary books",
    promoLink: bk ? `Get ${bk.name} on Amazon` : "See all the books",
    winColors
  };
}
export function pickDare(prev, rng = Math.random) {
  let d;
  do { d = DARES[Math.floor(rng() * DARES.length)]; } while (d === prev && DARES.length > 1);
  return d;
}
