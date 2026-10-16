const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const jsQR = require('jsqr');

const root = path.resolve(__dirname, '../..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'party-game/puzzles.js'), 'utf8') + '\nthis.catalog = {...BOOKS, all: SERIES};', context);
const watch = JSON.parse(fs.readFileSync(path.join(root, 'watch-app/PartyGameWatch/Resources/books.json'), 'utf8'));
assert.equal(watch.length, Object.keys(context.catalog).length);

async function decode(file) {
  const {data, info} = await sharp(file, {density: 288}).flatten({background: '#ffffff'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert(result, `QR code could not be decoded: ${file}`);
  return result.data;
}

(async () => {
  for (const book of watch) {
    const expected = context.catalog[book.id];
    assert(expected, `Unknown book ${book.id}`);
    assert.equal(book.name, expected.name);
    assert.equal(book.url, expected.url);
    const tvCode = path.join(root, 'appletv-app/assets/qr', expected.qr.replace(/\.svg$/, '.png'));
    const watchCode = path.join(root, 'watch-app/PartyGameWatch/Assets.xcassets', `${book.qrAsset}.imageset`, path.basename(tvCode));
    assert.equal(await decode(tvCode), expected.url, `TV destination mismatch: ${book.id}`);
    assert.equal(await decode(watchCode), expected.url, `Watch destination mismatch: ${book.id}`);
    assert.equal(await decode(path.join(root, 'party-game', expected.qr)), expected.url, `iOS/web destination mismatch: ${book.id}`);
    assert.deepEqual(fs.readFileSync(watchCode), fs.readFileSync(tvCode));
    if (book.coverAsset) {
      const original = path.join(root, 'party-game', expected.cover);
      const copied = path.join(root, 'watch-app/PartyGameWatch/Assets.xcassets', `${book.coverAsset}.imageset`, path.basename(original));
      assert.deepEqual(fs.readFileSync(copied), fs.readFileSync(original));
    }
    console.log(`PASS ${book.id}: title, URL, QR destinations and unchanged artwork`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
