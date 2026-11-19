// Plain-node checks of the ported rules (src/logic.js). Run: npm test  (node --test test/)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

function rng(seed = 1) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function setup(over = {}) {
  const settings = { ...L.defaultSettings(), ...over };
  const seen = new Set();
  const game = L.newGame(settings, seen, rng(42));
  return { settings, seen, game };
}
const wrongChoice = (g) => g.options.find((o) => o !== L.correctAnswer(L.currentPuzzle(g)));

test("data imported from the web game", () => {
  assert.ok(L.PUZZLES.length > 50);
  assert.deepEqual(Object.keys(L.BOOKS).sort(), ["beauty", "clean", "food", "home", "kids", "tp"]);
  assert.equal(L.glossaryFor("Carmine (color)"), "A red color made from crushed cochineal insects.");
  assert.deepEqual(L.watchInfo("Red 40"), { level: "warn", tag: "Synthetic dye" });
  assert.deepEqual(L.watchInfo("Fragrance"), { level: "unknown", tag: "Secret scent recipe" });
  assert.equal(L.glossaryFor("Unobtainium"), "No extra details for this one.");
});

test("deck size: same turns per team + a true/false finale", () => {
  const { game } = setup({ teams: 2, rounds: 5, book: "all" });
  assert.equal(game.deck.length, 12);
  assert.ok(game.deck.slice(0, 10).every((p) => p.type !== "tf"));
  assert.ok(game.deck.slice(10).every((p) => p.type === "tf"));
  const tp = setup({ teams: 3, rounds: 8, book: "tp" }).game;
  assert.ok(tp.deck.every((p) => p.type === "tf"));
  assert.equal(L.setupTotalText({ ...L.defaultSettings(), teams: 1, rounds: 3, book: "food" }), "3 rounds + a toilet paper true-or-false finale");
});

test("scoring: base points, level bonus, reveals, rising stakes, final x2", () => {
  const { game, seen } = setup({ teams: 2, rounds: 3, book: "food", level: 1 });
  L.startRound(game, seen, rng(1));
  assert.equal(L.points(game), 5);
  L.reveal(game); L.reveal(game);
  assert.equal(L.points(game), 3);
  game.settings.level = 3;
  assert.equal(L.points(game), 5);                    // Hard +2
  game.settings.level = 1;
  game.index = 2; L.startRound(game, seen, rng(1));   // second lap: +1
  assert.equal(L.lapOf(game, 2), 1);
  assert.equal(L.points(game), 6);
  game.index = 4; L.startRound(game, seen, rng(1));   // third lap of four (finale is the 4th)
  assert.equal(L.points(game), 7);
  assert.equal(L.isFinal(game, 6), true);             // the finale lap is the final, doubled lap
  assert.equal(L.isWager(game, 6), true);
  // never below 1 point
  game.index = 0; L.startRound(game, seen, rng(1));
  game.settings.level = 1;
  const n = L.currentPuzzle(game).ingredients.length;
  for (let i = 0; i < 20; i++) L.reveal(game);
  assert.equal(game.shown, n);                         // can't reveal past the label
  assert.equal(L.points(game), Math.max(1, 5 - (n - 3)));
  game.extended = true; game.shown = n + 10;           // never below 1 point
  assert.equal(L.points(game), 1);
});

test("last lap: ingredient games double, the toilet paper book's last lap is a bet (as on the web)", () => {
  const { game, seen } = setup({ teams: 1, rounds: 3, book: "tp" });
  game.index = 2; L.startRound(game, seen);
  assert.equal(L.isFinal(game, 2), true);
  assert.equal(L.isWager(game, 2), true);
  game.index = 1; L.startRound(game, seen);
  assert.equal(L.points(game), 3 + 1);       // true/false: 3 points + lap bonus
  const solo = setup({ teams: 1, rounds: 3, book: "food" });
  solo.game.index = 2; L.startRound(solo.game, solo.seen);
  assert.equal(L.isFinal(solo.game, 2), false); // the finale (index 3) is the final lap here
  solo.game.index = 3; L.startRound(solo.game, solo.seen);
  assert.equal(L.isWager(solo.game, 3), true);
});

test("right answer scores, wrong answer with steals off scores zero", () => {
  const { game, seen } = setup({ teams: 2, steal: 0, book: "food" });
  L.startRound(game, seen, rng(3));
  const r = L.answer(game, L.correctAnswer(L.currentPuzzle(game)));
  assert.equal(r.type, "done");
  assert.equal(game.scores[game.team], 5);
  assert.equal(game.verdict.text, "Correct! +5 points");
  L.advance(game); L.startRound(game, seen, rng(3));
  const w = wrongChoice(game);
  const r2 = L.answer(game, w);
  assert.equal(r2.type, "done");
  assert.equal(r2.sfx, "wrong");
  assert.equal(game.verdict.text, `Nope — you said ${w}.`);
});

test("steal chain: half the points, a missed steal loses them, value halves again", () => {
  const { game, seen } = setup({ teams: 3, steal: 1, book: "beauty" });
  game.turnOrder = [0, 1, 2];
  L.startRound(game, seen, rng(5));
  game.scores = [0, 2, 9];
  const w1 = wrongChoice(game);
  const miss = L.answer(game, w1);
  assert.equal(miss.type, "miss");
  assert.equal(game.chain.value, 3);                 // ceil(5 / 2)
  let offer = L.offerSteal(game);
  assert.equal(offer.type, "offer");
  assert.deepEqual(offer.teams, [1, 2]);
  assert.equal(offer.sub, "First team to yell “STEAL!” gets it — worth 3 points. Miss it and lose 3.");
  L.startSteal(game, 1);
  assert.equal(L.worthText(game), "Steal: 3 points");
  const w2 = game.options.find((o) => o !== L.correctAnswer(L.currentPuzzle(game)) && !L.isStruck(game, o));
  const miss2 = L.answer(game, w2);
  assert.equal(miss2.type, "miss");
  assert.equal(game.scores[1], 0);                   // lost min(3, 2)
  assert.equal(miss2.popSub, `Team Blue said ${w2} — loses 2 points`);
  assert.equal(game.chain.value, 2);                 // ceil(3 / 2)
  offer = L.offerSteal(game);
  assert.equal(offer.kicker, "Still up for grabs!");
  assert.deepEqual(offer.teams, [2]);
  L.startSteal(game, 2);
  const hit = L.answer(game, L.correctAnswer(L.currentPuzzle(game)));
  assert.equal(hit.type, "done");
  assert.equal(game.scores[2], 11);
  assert.equal(game.verdict.text, "Team Purple steals it! +2 points");
});

test("steal chain ends with 'Nobody got it!' when every team has tried", () => {
  const { game, seen } = setup({ teams: 2, steal: 1, book: "clean" });
  L.startRound(game, seen, rng(9));
  L.answer(game, wrongChoice(game));
  L.startSteal(game, L.offerSteal(game).teams[0]);
  const w = game.options.find((o) => o !== L.correctAnswer(L.currentPuzzle(game)) && !L.isStruck(game, o));
  L.answer(game, w);
  assert.equal(L.offerSteal(game).type, "nobody");
  assert.equal(game.verdict.text, "Nobody got it!");
  // A plain "No steal" after the first miss shows the miss text instead.
  const s2 = setup({ teams: 2, steal: 1, book: "clean" });
  L.startRound(s2.game, s2.seen, rng(9));
  const w2 = wrongChoice(s2.game);
  L.answer(s2.game, w2);
  L.nobodyGotIt(s2.game);
  assert.equal(s2.game.verdict.text, `Nope — you said ${w2}.`);
});

test("timing out offers a steal with every answer still in play", () => {
  const { game, seen } = setup({ teams: 2, steal: 1, book: "kids" });
  L.startRound(game, seen, rng(2));
  const r = L.answer(game, null);
  assert.equal(r.type, "miss");
  assert.equal(r.sfx, "timeup");
  assert.equal(game.chain.removed.length, 0);
});

test("finale: bets, winning and losing (never below zero)", () => {
  assert.deepEqual(L.wagerOptions(0), [0, 3, 5, 10]);
  assert.deepEqual(L.wagerOptions(4), [0, 3, 5, 10]);
  assert.deepEqual(L.wagerOptions(30), [0, 8, 15, 30]);
  const { game, seen } = setup({ teams: 2, rounds: 3, book: "home" });
  game.index = 6; L.startRound(game, seen);
  assert.equal(L.isWager(game, 6), true);
  assert.equal(L.needsWager(game), true);
  assert.equal(L.worthText(game), "Bet first");
  game.scores[game.team] = 4;
  assert.deepEqual(L.wagerChoices(game).map((c) => c.label), ["Play it safe — bet 0", "Bet 3", "Bet 5", "Bet 10"]);
  L.placeWager(game, 10);
  assert.equal(L.worthText(game), "Bet: 10 points");
  const p = L.currentPuzzle(game);
  const wrong = p.answer ? "False" : "True";
  const r = L.answer(game, wrong);
  assert.equal(r.type, "done");                   // no steals on true/false
  assert.equal(r.lost, 4);
  assert.equal(game.scores[game.team], 0);
  assert.equal(r.sfx, "lose");
  // winning a bet
  game.index = 7; L.startRound(game, seen);
  game.scores[game.team] = 12;
  L.placeWager(game, 6);
  L.answer(game, L.correctAnswer(L.currentPuzzle(game)));
  assert.equal(game.scores[game.team], 18);
  // betting 0 and getting it right
  game.index = 6; L.startRound(game, seen);
  L.placeWager(game, 0);
  L.answer(game, L.correctAnswer(L.currentPuzzle(game)));
  assert.equal(game.verdict.text, "Correct! You bet 0, so your score stays the same.");
});

test("+15 seconds costs 1 point per lap, doubled in the final round", () => {
  const { game, seen } = setup({ teams: 2, rounds: 3, book: "food", timer: 1 });
  L.startRound(game, seen);
  assert.equal(L.canExtend(game, true), true);
  assert.equal(L.extendLabel(game), "+15 sec −1 pt");
  L.applyExtend(game);
  assert.equal(L.points(game), 4);
  assert.equal(L.canExtend(game, true), false);
  game.index = 4; L.startRound(game, seen);
  assert.equal(L.extendLabel(game), "+15 sec −3 pts");
});

test("no repeat puzzles until a book has been fully played", () => {
  const seen = new Set();
  const pool = L.mainPool("food");
  const shown = [];
  const r = rng(11);
  // Deal 3 at a time and mark them seen, like playing rounds.
  for (let k = 0; k < Math.floor(pool.length / 3); k++) {
    const hand = L.dealFresh(pool, 3, seen, r);
    hand.forEach((p) => { seen.add(L.puzzleKey(p)); shown.push(L.puzzleKey(p)); });
  }
  assert.equal(new Set(shown).size, shown.length, "a puzzle repeated before the book ran out");
  // Book nearly used up: the next deal finishes the unseen ones first, then starts over.
  const unseen = pool.filter((p) => !seen.has(L.puzzleKey(p)));
  const hand = L.dealFresh(pool, 3, seen, r);
  assert.equal(hand.length, 3);
  assert.equal(new Set(hand).size, 3);
  for (const p of unseen) assert.ok(hand.includes(p), "unseen puzzle skipped");
  assert.ok(pool.every((p) => !seen.has(L.puzzleKey(p))), "book should start over once exhausted");
  // Other books' memory is untouched.
  const kid = L.mainPool("kids")[0];
  seen.add(L.puzzleKey(kid));
  L.dealFresh(pool, pool.length + 1, seen, r);
  assert.ok(seen.has(L.puzzleKey(kid)));
});

test("startRound marks the puzzle as seen and newGame never repeats within a game", () => {
  const { game, seen } = setup({ teams: 4, rounds: 8, book: "all" });
  const keys = game.deck.map(L.puzzleKey);
  assert.equal(new Set(keys).size, keys.length);
  L.startRound(game, seen);
  assert.ok(seen.has(L.puzzleKey(game.deck[0])));
});

test("reveal order by difficulty", () => {
  assert.deepEqual(L.revealOrder(5, 1), [0, 1, 2, 3, 4]);
  assert.deepEqual(L.revealOrder(5, 3), [4, 3, 2, 1, 0]);
  assert.deepEqual(L.revealOrder(5, 2), [2, 3, 1, 4, 0]);
});

test("team colors: pick, swap out the oldest, shuffle needs every team colored", () => {
  const { game } = setup({ teams: 2 });
  assert.deepEqual(game.colors, [0, 1]);
  L.toggleColor(game, 1);
  assert.equal(L.shuffleOrder(game).ok, false);
  assert.equal(L.pickTip(game), "Pick 2 colors — one for each team. 1 of 2 picked.");
  L.toggleColor(game, 3); L.toggleColor(game, 2);
  assert.deepEqual(game.colors, [3, 2]);
  assert.equal(L.shuffleOrder(game, rng(4)).ok, true);
  assert.deepEqual(game.settings.colors, [3, 2]);
  assert.equal(L.teamName(game, 0), "Team Green");
});

test("final scores, ties and the loser's dare", () => {
  const a = setup({ teams: 3 }).game;
  a.scores = [10, 4, 4];
  let f = L.finish(a);
  assert.equal(f.winner, "Team Orange wins!");
  assert.equal(f.dareWho, "Team Blue & Team Purple's dare");
  assert.deepEqual(f.list.map((x) => x.text), ["Team Orange — 10", "Team Blue — 4", "Team Purple — 4"]);
  a.scores = [5, 5, 5];
  f = L.finish(a);
  assert.equal(f.winner, "It's a tie!");
  assert.equal(f.dareWho, "Everybody's dare");
  a.settings.dare = 0;
  assert.equal(L.finish(a).dareWho, null);
  const solo = setup({ teams: 1, rounds: 3, book: "food" }).game;
  solo.scores = [0];
  assert.equal(L.finish(solo).winner, "You scored 0 points!");
  assert.equal(L.finish(solo).dareWho, "Your dare");
  solo.scores = [L.maxPoints(solo)];
  assert.equal(L.finish(solo).dareWho, null);
  assert.equal(L.finish(solo).promoTitle, "Ingredient Dictionary: It's Not Food");
  const d = L.pickDare(L.DARES[0], rng(1));
  assert.notEqual(d, L.DARES[0]);
});

test("answer screen info: watch list groups, next button", () => {
  const { game, seen } = setup({ teams: 2, book: "kids" });
  const gummy = L.PUZZLES.find((p) => p.answer === "Gummy bears");
  game.deck[0] = gummy;
  L.startRound(game, seen);
  L.answer(game, "Gummy bears");
  const r = L.resultInfo(game);
  assert.equal(r.answer, "Gummy bears");
  assert.equal(r.spotTag, "Weird ingredient spotlight");
  const dye = r.watch.find((w) => w.tag === "Synthetic dye");
  assert.equal(dye.names, "Red 40, Yellow 5, Blue 1");
  assert.equal(r.next.text, "Up next: ");
  assert.equal(r.next.team, game.turnOrder[1]);
});
