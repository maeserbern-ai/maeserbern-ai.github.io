// Exports the web party game's puzzle deck and glossary to JSON for the watch app.
// Usage (from anywhere):  node watch-app/scripts/export-data.mjs
// Reads ../party-game/puzzles.js and glossary.js (plain browser scripts that
// declare top-level consts) by evaluating them in a node vm context.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const gameDir = resolve(appDir, "..", "party-game");
const outDir = join(appDir, "PartyGameWatch", "Resources");

function load(file, names) {
  const src = readFileSync(join(gameDir, file), "utf8");
  // Top-level const/let are not properties of the context object, so append
  // an explicit export statement that copies them onto globalThis.
  const tail = "\n;globalThis.__out = {" + names.map((n) => `${n}: typeof ${n} === "undefined" ? undefined : ${n}`).join(", ") + "};";
  const ctx = vm.createContext({});
  vm.runInContext(src + tail, ctx, { filename: file });
  return ctx.__out;
}

const { BOOKS, SERIES, PUZZLES, WATCH, UNDISCLOSED } = load("puzzles.js", ["BOOKS", "SERIES", "PUZZLES", "WATCH", "UNDISCLOSED"]);
const { GLOSSARY } = load("glossary.js", ["GLOSSARY"]);

const isTrueFalse = (p) => p.type === "tf" || (BOOKS[p.book] && BOOKS[p.book].trueFalse);
// Same key the web game uses for its no-repeat list (game.js puzzleKey).
const puzzleKey = (p) => p.book + "|" + (p.statement || p.answer);
const usable = [];
let trueFalse = 0, skippedBad = 0;
for (const p of PUZZLES) {
  const bookName = BOOKS[p.book] ? BOOKS[p.book].name : "";
  if (isTrueFalse(p)) {
    // What Is Toilet Paper? plays as true/false: a claim, two buttons, the real story.
    const ok = typeof p.statement === "string" && p.statement && typeof p.answer === "boolean" &&
      typeof p.explain === "string" && p.explain;
    if (!ok) { skippedBad++; console.warn("Skipping malformed true/false:", p.statement); continue; }
    trueFalse++;
    usable.push({
      key: puzzleKey(p),
      type: "tf",
      answer: p.answer ? "True" : "False",
      options: ["True", "False"],
      book: p.book,
      bookName,
      ingredients: [],
      statement: p.statement,
      explain: p.explain
    });
    continue;
  }
  const ok = typeof p.answer === "string" && Array.isArray(p.options) && p.options.length === 4 &&
    p.options.includes(p.answer) && Array.isArray(p.ingredients) && p.ingredients.length > 0 &&
    p.spotlight && p.spotlight.name && p.spotlight.note;
  if (!ok) { skippedBad++; console.warn("Skipping malformed puzzle:", p.answer); continue; }
  usable.push({
    key: puzzleKey(p),
    type: "mc",
    answer: p.answer,
    options: p.options.slice(),
    kind: p.kind,
    book: p.book,
    bookName,
    ingredients: p.ingredients.slice(),
    spotlight: { name: p.spotlight.name, note: p.spotlight.note }
  });
}
if (new Set(usable.map((p) => p.key)).size !== usable.length) throw new Error("Duplicate puzzle keys");

const rules = (list) => (list || []).map(([re, text]) => ({ pattern: re.source, flags: re.flags, text }));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "puzzles.json"), JSON.stringify(usable, null, 2) + "\n");
writeFileSync(join(outDir, "glossary.json"), JSON.stringify(rules(GLOSSARY), null, 2) + "\n");
writeFileSync(join(outDir, "watch.json"), JSON.stringify({ warn: rules(WATCH), undisclosed: rules(UNDISCLOSED) }, null, 2) + "\n");

// Reuse the existing book destinations and artwork; do not maintain a second catalog.
const catalog = [...Object.entries(BOOKS), ["all", SERIES]].map(([id, book]) => {
  const url = new URL(book.url);
  if (url.protocol !== "https:" || !["www.amazon.com", "maeserbern-ai.github.io"].includes(url.hostname)) {
    throw new Error(`Unexpected book destination: ${id}`);
  }
  const assets = join(appDir, "PartyGameWatch", "Assets.xcassets");
  function copyAsset(name, source) {
    const dir = join(assets, `${name}.imageset`);
    mkdirSync(dir, { recursive: true });
    const filename = source.split(/[\\/]/).pop();
    copyFileSync(source, join(dir, filename));
    writeFileSync(join(dir, "Contents.json"), JSON.stringify({ images: [{ idiom: "universal", filename }], info: { author: "xcode", version: 1 } }, null, 2) + "\n");
    return name;
  }
  const coverAsset = book.cover ? copyAsset(`book-${id}`, join(gameDir, book.cover)) : null;
  const qrAsset = copyAsset(`qr-${id}`, join(appDir, "..", "appletv-app", "assets", "qr", book.qr.replace(/\.svg$/, ".png")));
  return { id, name: book.name, url: book.url, coverAsset, qrAsset };
});
writeFileSync(join(outDir, "books.json"), JSON.stringify(catalog, null, 2) + "\n");

console.log(`puzzles in source: ${PUZZLES.length}`);
console.log(`exported puzzles:  ${usable.length}`);
console.log(`true/false (tp):    ${trueFalse}`);
console.log(`skipped malformed: ${skippedBad}`);
console.log(`glossary rules:    ${GLOSSARY.length}`);
console.log(`watch rules:       ${(WATCH || []).length} warn, ${(UNDISCLOSED || []).length} undisclosed`);
console.log(`book destinations: ${catalog.length}`);
