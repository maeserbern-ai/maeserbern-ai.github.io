// Decodes every widget QR image (iOS asset + Android drawable) and checks it
// opens the same Amazon link the game uses for that book.
// Usage: node qa/widgets/check-widget-qr.cjs <dir containing jsqr+sharp node_modules>
const path = require('path');
const fs = require('fs');
const mods = path.resolve(process.argv[2] || 'qa/apple/node_modules');
const jsQR = require(path.join(mods, 'jsqr'));
const sharp = require(path.join(mods, 'sharp'));
const root = path.resolve(__dirname, '..', '..');
const deck = JSON.parse(fs.readFileSync(path.join(root, 'ios-widgets/PartyGameWidgets/Resources/daily.json'), 'utf8'));
(async () => {
  const results = [];
  for (const [key, book] of Object.entries(deck.books)) {
    for (const file of [
      `ios-widgets/PartyGameWidgets/Assets.xcassets/qr-${key}.imageset/qr-${key}.png`,
      `android/app/src/main/res/drawable-nodpi/widget_qr_${key}.png`,
    ]) {
      const { data, info } = await sharp(path.join(root, file)).extend({ top: 40, bottom: 40, left: 40, right: 40, background: '#ffffff' })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      const ok = !!code && code.data === book.url;
      results.push({ file, expected: book.url, decoded: code && code.data, ok });
    }
  }
  console.log(JSON.stringify(results, null, 1));
  if (results.some((r) => !r.ok)) process.exit(1);
  console.log(`All ${results.length} widget QR codes open the right Amazon book page.`);
})();
