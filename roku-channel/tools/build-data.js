#!/usr/bin/env node
/* Converts the web game's data (party-game/puzzles.js, glossary.js, game.js)
   into roku-channel/data/game.json for the Roku channel.

   The web game looks up ingredient definitions and the "worth knowing" tags
   with regular expressions at run time. BrightScript has no cheap regex
   engine for that, so this script runs the same lookups once and stores the
   answers next to every ingredient.

   Run:  node roku-channel/tools/build-data.js
   Run again whenever party-game/puzzles.js, glossary.js or the dares change. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CH = path.resolve(__dirname, "..");
const WEB = path.resolve(CH, "..", "party-game");

const ctx = {};
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(WEB, f), "utf8") +
  "\n;this.BOOKS = typeof BOOKS !== 'undefined' ? BOOKS : this.BOOKS;" +
  "this.SERIES = typeof SERIES !== 'undefined' ? SERIES : this.SERIES;" +
  "this.PUZZLES = typeof PUZZLES !== 'undefined' ? PUZZLES : this.PUZZLES;" +
  "this.watchInfo = typeof watchInfo !== 'undefined' ? watchInfo : this.watchInfo;" +
  "this.glossaryFor = typeof glossaryFor !== 'undefined' ? glossaryFor : this.glossaryFor;", ctx, { filename: f });
load("puzzles.js");
load("glossary.js");
const { BOOKS, SERIES, PUZZLES, watchInfo, glossaryFor } = ctx;

// The dares live inside game.js's closure; pull the array literal out.
const gameJs = fs.readFileSync(path.join(WEB, "game.js"), "utf8");
const dm = gameJs.match(/const DARES = (\[[\s\S]*?\]);/);
if (!dm) throw new Error("Could not find DARES in game.js");
const DARES = vm.runInNewContext(dm[1]);

const base = (p) => path.basename(p).replace(/\.svg$/, ".png");
const books = {};
const bookOrder = Object.keys(BOOKS);
bookOrder.forEach((k) => {
  const b = BOOKS[k];
  books[k] = {
    name: b.name,
    title: b.title,
    cover: "pkg:/images/covers/" + path.basename(b.cover),
    qr: "pkg:/images/qr/" + base(b.qr),
    url: b.url,
    trueFalse: !!b.trueFalse
  };
});

const puzzles = PUZZLES.map((p) => {
  if (p.type === "tf") {
    return {
      id: p.book + "|" + p.statement,   // same key the web game uses for "seen" puzzles
      book: p.book, type: "tf",
      statement: p.statement, truth: !!p.answer, explain: p.explain
    };
  }
  return {
    id: p.book + "|" + p.answer,
    book: p.book, type: "ing",
    answer: p.answer, options: p.options, kind: p.kind,
    ingredients: p.ingredients.map((name) => {
      const info = watchInfo(name);
      const o = { n: name, g: glossaryFor(name) };
      if (info) { o.lv = info.level; o.tag = info.tag; }
      return o;
    }),
    spotlight: { name: p.spotlight.name, note: p.spotlight.note }
  };
});

const out = {
  generatedFrom: "party-game/puzzles.js + glossary.js + game.js (DARES)",
  books, bookOrder,
  series: { name: SERIES.name, qr: "pkg:/images/qr/" + base(SERIES.qr), url: SERIES.url },
  puzzles,
  dares: DARES
};

// Sanity checks: every character must exist in the bundled fonts.
const metrics = JSON.parse(fs.readFileSync(path.join(CH, "data", "metrics.json"), "utf8"));
const have = new Set(metrics.medium.chars);
const missing = new Set();
const walk = (v) => {
  if (typeof v === "string") { for (const c of v) if (!have.has(c) && c !== "\n") missing.add(c); }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
walk(out);
if (missing.size) throw new Error("Characters missing from the fonts: " + [...missing].join(" "));
const ids = new Set(puzzles.map((p) => p.id));
if (ids.size !== puzzles.length) throw new Error("Duplicate puzzle ids");

fs.writeFileSync(path.join(CH, "data", "game.json"), JSON.stringify(out));
const counts = bookOrder.map((k) => `${k}:${puzzles.filter((p) => p.book === k).length}`).join(" ");
console.log(`game.json: ${puzzles.length} puzzles (${counts}), ${DARES.length} dares`);
