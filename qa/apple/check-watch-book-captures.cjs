const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const jsQR = require('jsqr');

const root = path.resolve(__dirname, '../..');
const source = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Usage: node check-watch-book-captures.cjs QA_OUTPUT');
const books = JSON.parse(fs.readFileSync(path.join(root, 'watch-app/PartyGameWatch/Resources/books.json'), 'utf8'));

(async () => {
  const results = [];
  for (const [tag, width, height] of [['watch-small', 324, 394], ['watch-large', 422, 514]]) {
    const log = fs.readFileSync(path.join(source, `${tag}-test.log`), 'utf8');
    assert.match(log, /\*\* TEST(?: EXECUTE)? SUCCEEDED \*\*/, `${tag}: native test success is required`);
    const folder = path.join(source, `${tag}-images`);
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
    const captures = manifest.flatMap(test => test.attachments);
    for (const book of books) {
      const matches = captures.filter(shot => shot.suggestedHumanReadableName.startsWith(`store-05-watch-book-${book.id}_`));
      assert.equal(matches.length, 1, `${tag}: missing or duplicate capture for ${book.id}`);
      const shot = matches[0];
      assert.equal(shot.isAssociatedWithFailure, false);
      const {data, info} = await sharp(path.join(folder, shot.exportedFileName)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      assert.deepEqual([info.width, info.height], [width, height], `${tag}: unexpected native capture size`);
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      assert.ok(code, `${tag}: on-screen QR cannot be decoded for ${book.id}`);
      assert.equal(code.data, book.url, `${tag}: incorrect QR destination for ${book.id}`);
      results.push({device: tag, book: book.id, url: code.data, image: shot.exportedFileName, nativeSize: [width, height]});
      console.log(`PASS ${tag}/${book.id}: native screenshot QR decodes to correct book`);
    }
  }
  fs.writeFileSync(path.join(source, 'book-qr-capture-verification.json'), JSON.stringify({passed: true, count: results.length, results}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
