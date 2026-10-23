// Exports the web party game's puzzle deck, glossary and book links to JSON
// assets for the Wear OS (Galaxy Watch) app. Port of the Apple Watch exporter.
// Usage (from the repository root):  node wear-app/scripts/export-data.mjs
// Reads party-game/puzzles.js and glossary.js (plain browser scripts that
// declare top-level consts) by evaluating them in a node vm context.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const gameDir = resolve(appDir, "..", "party-game");
const assetsDir = join(appDir, "app", "src", "main", "assets");
const dataDir = join(assetsDir, "data");
const coversDir = join(assetsDir, "covers");

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

// True/false (toilet paper) puzzles play on their own two-button screen.
const isTrueFalse = (p) => p.type === "tf" || p.book === "tp" || (BOOKS[p.book] && BOOKS[p.book].trueFalse);
const usable = [];
let exportedTF = 0, skippedBad = 0;
for (const p of PUZZLES) {
  if (isTrueFalse(p)) {
    const ok = typeof p.statement === "string" && p.statement && typeof p.answer === "boolean" &&
      typeof p.explain === "string" && p.explain && BOOKS[p.book];
    if (!ok) { skippedBad++; console.warn("Skipping malformed true/false puzzle:", p.statement); continue; }
    exportedTF++;
    usable.push({
      type: "tf",
      statement: p.statement,
      truth: p.answer,
      explain: p.explain,
      book: p.book,
      bookName: BOOKS[p.book].name
    });
    continue;
  }
  const ok = typeof p.answer === "string" && Array.isArray(p.options) && p.options.length === 4 &&
    p.options.includes(p.answer) && Array.isArray(p.ingredients) && p.ingredients.length > 0 &&
    p.spotlight && p.spotlight.name && p.spotlight.note && BOOKS[p.book];
  if (!ok) { skippedBad++; console.warn("Skipping malformed puzzle:", p.answer); continue; }
  usable.push({
    type: "pick",
    answer: p.answer,
    options: p.options.slice(),
    kind: p.kind,
    book: p.book,
    bookName: BOOKS[p.book].name,
    ingredients: p.ingredients.slice(),
    spotlight: { name: p.spotlight.name, note: p.spotlight.note }
  });
}

const rules = (list) => (list || []).map(([re, text]) => ({ pattern: re.source, flags: re.flags, text }));

// The QR codes are SVGs made of 1x1 squares ("Mx,yH..."); turn them into rows of 0/1.
function qrModules(svgFile) {
  const svg = readFileSync(join(gameDir, svgFile), "utf8");
  const box = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!box) throw new Error(`No viewBox in ${svgFile}`);
  const size = Number(box[1]);
  const grid = Array.from({ length: size }, () => Array(size).fill("0"));
  let count = 0;
  for (const m of svg.matchAll(/M(\d+),(\d+)H(\d+)V(\d+)H\d+z/g)) {
    const x0 = Number(m[1]), y0 = Number(m[2]), x1 = Number(m[3]), y1 = Number(m[4]);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y][x] = "1";
    count++;
  }
  if (count < 50) throw new Error(`Could not read QR squares in ${svgFile}`);
  return grid.map((row) => row.join(""));
}

mkdirSync(dataDir, { recursive: true });
mkdirSync(coversDir, { recursive: true });

// Reuse the web game's book destinations and artwork; do not maintain a second catalog.
const catalog = [...Object.entries(BOOKS), ["all", SERIES]].map(([id, book]) => {
  const url = new URL(book.url);
  if (url.protocol !== "https:" || !["www.amazon.com", "maeserbern-ai.github.io"].includes(url.hostname)) {
    throw new Error(`Unexpected book destination: ${id}`);
  }
  let cover = null;
  if (book.cover) {
    cover = "covers/" + book.cover.split(/[\\/]/).pop();
    copyFileSync(join(gameDir, book.cover), join(assetsDir, cover));
  }
  return { id, name: book.name, url: book.url, amazon: url.hostname === "www.amazon.com", cover, qr: qrModules(book.qr) };
});

const write = (name, value) => writeFileSync(join(dataDir, name), JSON.stringify(value, null, 1) + "\n");
write("puzzles.json", usable);
write("glossary.json", rules(GLOSSARY));
write("watch.json", { warn: rules(WATCH), undisclosed: rules(UNDISCLOSED) });
write("books.json", catalog);

console.log(`puzzles in source: ${PUZZLES.length}`);
console.log(`exported puzzles:  ${usable.length}`);
console.log(`  of which true/false: ${exportedTF}`);
console.log(`skipped malformed: ${skippedBad}`);
console.log(`glossary rules:    ${GLOSSARY.length}`);
console.log(`watch rules:       ${(WATCH || []).length} warn, ${(UNDISCLOSED || []).length} undisclosed`);
console.log(`book destinations: ${catalog.length}`);
if (usable.length === 0) throw new Error("No puzzles exported");
