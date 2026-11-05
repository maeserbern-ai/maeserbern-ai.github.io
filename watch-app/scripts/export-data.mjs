// Exports the web party game's puzzle deck and glossary to JSON for the watch app.
// Usage (from anywhere):  node watch-app/scripts/export-data.mjs
// Reads ../party-game/puzzles.js and glossary.js (plain browser scripts that
// declare top-level consts) by evaluating them in a node vm context.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const { BOOKS, PUZZLES, WATCH, UNDISCLOSED } = load("puzzles.js", ["BOOKS", "PUZZLES", "WATCH", "UNDISCLOSED"]);
const { GLOSSARY } = load("glossary.js", ["GLOSSARY"]);

const isTrueFalse = (p) => p.type === "tf" || p.book === "tp" || (BOOKS[p.book] && BOOKS[p.book].trueFalse);
const usable = [];
let skippedTP = 0, skippedBad = 0;
for (const p of PUZZLES) {
  if (isTrueFalse(p)) { skippedTP++; continue; }
  const ok = typeof p.answer === "string" && Array.isArray(p.options) && p.options.length === 4 &&
    p.options.includes(p.answer) && Array.isArray(p.ingredients) && p.ingredients.length > 0 &&
    p.spotlight && p.spotlight.name && p.spotlight.note;
  if (!ok) { skippedBad++; console.warn("Skipping malformed puzzle:", p.answer); continue; }
  usable.push({
    answer: p.answer,
    options: p.options.slice(),
    kind: p.kind,
    book: p.book,
    bookName: BOOKS[p.book] ? BOOKS[p.book].name : "",
    ingredients: p.ingredients.slice(),
    spotlight: { name: p.spotlight.name, note: p.spotlight.note }
  });
}

const rules = (list) => (list || []).map(([re, text]) => ({ pattern: re.source, flags: re.flags, text }));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "puzzles.json"), JSON.stringify(usable, null, 2) + "\n");
writeFileSync(join(outDir, "glossary.json"), JSON.stringify(rules(GLOSSARY), null, 2) + "\n");
writeFileSync(join(outDir, "watch.json"), JSON.stringify({ warn: rules(WATCH), undisclosed: rules(UNDISCLOSED) }, null, 2) + "\n");

console.log(`puzzles in source: ${PUZZLES.length}`);
console.log(`exported puzzles:  ${usable.length}`);
console.log(`skipped tp/true-false: ${skippedTP}`);
console.log(`skipped malformed: ${skippedBad}`);
console.log(`glossary rules:    ${GLOSSARY.length}`);
console.log(`watch rules:       ${(WATCH || []).length} warn, ${(UNDISCLOSED || []).length} undisclosed`);
