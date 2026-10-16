const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sharp = require('sharp');

const [sourceArg, outputArg, platform] = process.argv.slice(2);
assert.ok(sourceArg && outputArg && ['ios', 'tvos'].includes(platform), 'Usage: node export-native-screenshots.cjs SOURCE OUTPUT ios|tvos');
const source = path.resolve(sourceArg);
const output = path.resolve(outputArg);
assert.ok(!fs.existsSync(output), 'Use a new output folder; existing images will not be overwritten');
const devices = platform === 'ios'
  ? [['iphone', 2868, 1320], ['ipad', 2752, 2064]]
  : [['apple-tv', 1920, 1080]];
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

async function main() {
  for (const [tag] of devices) {
    const log = fs.readFileSync(path.join(source, `${tag}-test.log`), 'utf8');
    assert.match(log, /\*\* TEST(?: EXECUTE)? SUCCEEDED \*\*/, `${tag}: native test success is required`);
  }
  fs.mkdirSync(output, { recursive: true });
  const manifest = [];
  const sections = [];
  for (const [tag, width, height] of devices) {
    const imageDir = path.join(source, `${tag}-images`);
    const results = JSON.parse(fs.readFileSync(path.join(imageDir, 'manifest.json'), 'utf8'));
    const shots = results.flatMap(test => test.attachments)
      .filter(shot => /^store-\d\d-.*\.png$/.test(shot.suggestedHumanReadableName))
      .sort((a, b) => a.suggestedHumanReadableName.localeCompare(b.suggestedHumanReadableName));
    assert.ok(shots.length >= 3 && shots.length <= 10, `${tag}: unexpected screenshot count`);
    const folder = `${tag}-${width}x${height}`;
    fs.mkdirSync(path.join(output, folder));
    const rows = [];
    for (const shot of shots) {
      assert.equal(shot.isAssociatedWithFailure, false);
      const original = path.join(imageDir, shot.exportedFileName);
      const fileName = shot.suggestedHumanReadableName.split('_')[0].replace(/^store-/, '') + '.png';
      const destination = path.join(output, folder, fileName);
      const meta = await sharp(original).metadata();
      assert.deepEqual(meta.autoOrient, { width, height }, `${tag}/${fileName}: unexpected native size`);
      assert.equal((await sharp(original).stats()).isOpaque, true, 'Store image must be opaque');
      // Flatten the simulator's orientation tag only. No resizing or resampling.
      const expectedPixels = await sharp(original).autoOrient().removeAlpha().raw().toBuffer();
      await sharp(original).autoOrient().removeAlpha().png().toFile(destination);
      const actualPixels = await sharp(destination).raw().toBuffer();
      assert.equal(hash(actualPixels), hash(expectedPixels), `${fileName}: pixels changed during export`);
      const exported = await sharp(destination).metadata();
      assert.equal(exported.width, width);
      assert.equal(exported.height, height);
      assert.equal(exported.hasAlpha, false);
      manifest.push({ device: shot.deviceName, file: `${folder}/${fileName}`, width, height, source: original, sourceSha256: hash(fs.readFileSync(original)), pixelSha256: hash(actualPixels), resized: false, cropped: false });
      rows.push(`<figure><a href="${escape(pathToFileURL(destination).href)}"><img src="${escape(pathToFileURL(destination).href)}" alt="${escape(fileName)}"></a><figcaption>${escape(fileName)}</figcaption></figure>`);
    }
    sections.push(`<section><h2>${escape(tag)}: ${width} x ${height}</h2><div class="grid">${rows.join('')}</div></section>`);
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(output, 'preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingredient Party Game native captures</title><style>body{font:16px system-ui;margin:24px;background:#f6f7f8;color:#17211c}h1{font-size:24px}h2{font-size:18px;margin-top:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{padding-top:8px;font-size:14px}</style><h1>Ingredient Party Game: native simulator captures</h1>${sections.join('')}</html>`);
  console.log(JSON.stringify({ output, count: manifest.length, pixelPreservationVerified: true }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
