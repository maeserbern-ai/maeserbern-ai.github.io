const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const jsQR = require('jsqr');

async function main() {
  const directory = path.resolve(process.argv[2]);
  const books = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../watch-app/PartyGameWatch/Resources/books.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
  const attachments = manifest.flatMap(entry => entry.attachments);
  const checked = [];
  for (const book of books) {
    const image = attachments.find(entry =>
      entry.suggestedHumanReadableName.startsWith(`store-05-watch-book-${book.id}_`));
    assert(image, `Missing actual Watch QR screenshot: ${book.id}`);
    const { data, info } = await sharp(path.join(directory, image.exportedFileName))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert(code, `QR cannot be decoded from Watch screenshot: ${book.id}`);
    assert.equal(code.data, book.url, `Wrong book destination: ${book.id}`);
    checked.push({ book: book.id, destination: code.data, screenshot: image.exportedFileName });
  }
  console.log(JSON.stringify({ deviceScreenshots: directory, passed: checked.length, checked }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
