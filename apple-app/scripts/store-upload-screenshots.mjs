import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const apply = process.argv.includes('--apply');
const tv = process.argv.includes('--tvos');
const watch = process.argv.includes('--watch');
if (tv && watch) throw new Error('Select only one screenshot platform');
const { asc, all } = storeClient({ allowWrites: apply });
const folder = path.join(ROOT, watch ? 'artifacts/native-store-images-20261019-watch' : tv ? 'artifacts/native-store-images-20261016-tvos-final' : 'artifacts/native-store-images-20261016-recapture');
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
const visual = JSON.parse(fs.readFileSync(path.join(folder, 'visual-review.json')));
if (!visual.imageQaPassed || manifest.length !== (watch ? 5 : tv ? 10 : 16)) throw new Error('Screenshots are not approved');
const versionId = tv ? '620eb160-cc2e-4d9b-9a79-3eadfbb22a98' : '90577eef-0438-4b13-82a8-acf57c336d39';
const versions = await all(`/v1/apps/${APP_ID}/appStoreVersions`);
const version = versions.find(v => v.id === versionId);
if (!version || version.attributes.platform !== (tv ? 'TV_OS' : 'IOS') || version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
  throw new Error('Expected editable Ingredient Party Game draft for the selected platform');
}
const locales = await all(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
const locale = locales.find(l => l.attributes.locale === 'en-US');
if (!locale) throw new Error('Missing English localization');
const targets = tv ? [
  { folder: 'apple-tv-1920x1080', display: 'APP_APPLE_TV', width: 1920, height: 1080 }
] : watch ? [
  { folder: 'watch-large-422x514', display: 'APP_WATCH_ULTRA', width: 422, height: 514 }
] : [
  { folder: 'iphone-2868x1320', display: 'APP_IPHONE_67', width: 2868, height: 1320 },
  { folder: 'ipad-2752x2064', display: 'APP_IPAD_PRO_3GEN_129', width: 2752, height: 2064 }
];
const digest = (algorithm, data) => crypto.createHash(algorithm).update(data).digest('hex');
for (const target of targets) {
  target.files = manifest.filter(m => m.file.startsWith(`${target.folder}/`)).sort((a, b) => a.file.localeCompare(b.file));
  if (target.files.length !== (watch ? 5 : tv ? 10 : 8)) throw new Error('Unexpected screenshot count for this size');
  for (const file of target.files) {
    file.bytes = fs.readFileSync(path.join(folder, file.file));
    file.md5 = digest('md5', file.bytes);
    const image = sharp(file.bytes);
    const meta = await image.metadata();
    const pixels = await image.ensureAlpha().raw().toBuffer();
    // The export manifest hashes RGB pixels, without an alpha channel.
    const rgb = await sharp(file.bytes).removeAlpha().raw().toBuffer();
    if (meta.width !== target.width || meta.height !== target.height || meta.hasAlpha ||
        (digest('sha256', rgb) !== file.pixelSha256 && digest('sha256', pixels) !== file.pixelSha256)) {
      throw new Error(`Image changed after QA: ${file.file}`);
    }
  }
}
const report = { at: new Date().toISOString(), appId: APP_ID, versionId, applied: apply, submitted: false, sets: [] };
for (const target of targets) {
  const sets = await all(`/v1/appStoreVersionLocalizations/${locale.id}/appScreenshotSets`);
  let set = sets.find(s => s.attributes.screenshotDisplayType === target.display);
  if (!set && apply) {
    set = (await asc('/v1/appScreenshotSets', { method: 'POST', body: { data: {
      type: 'appScreenshotSets', attributes: { screenshotDisplayType: target.display },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locale.id } } }
    } } })).data;
  }
  const existing = set ? await all(`/v1/appScreenshotSets/${set.id}/appScreenshots`) : [];
  const wanted = target.files.map(f => path.basename(f.file));
  if (existing.some(s => !wanted.includes(s.attributes.fileName))) throw new Error('Unexpected screenshots; refusing to replace them');
  const ids = [];
  for (const file of target.files) {
    const fileName = path.basename(file.file);
    let screenshot = existing.find(s => s.attributes.fileName === fileName);
    if (!apply) { console.log(JSON.stringify({ planned: file.file, state: screenshot?.attributes.assetDeliveryState?.state || 'NEW' })); continue; }
    if (screenshot && screenshot.attributes.sourceFileChecksum && screenshot.attributes.sourceFileChecksum !== file.md5) {
      throw new Error(`Existing screenshot differs: ${fileName}`);
    }
    if (!screenshot) {
      screenshot = (await asc('/v1/appScreenshots', { method: 'POST', body: { data: {
        type: 'appScreenshots', attributes: { fileName, fileSize: file.bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } }
      } } })).data;
    }
    if (screenshot.attributes.assetDeliveryState.state === 'AWAITING_UPLOAD') {
      for (const operation of screenshot.attributes.uploadOperations) {
        const url = new URL(operation.url);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.apple.com') || operation.method !== 'PUT') {
          throw new Error('Unexpected Apple upload destination');
        }
        const result = await fetch(url, { method: operation.method,
          headers: Object.fromEntries(operation.requestHeaders.map(h => [h.name, h.value])),
          body: file.bytes.subarray(operation.offset, operation.offset + operation.length),
          signal: AbortSignal.timeout(60000) });
        if (!result.ok) throw new Error(`Screenshot upload failed: ${result.status}`);
      }
      screenshot = (await asc(`/v1/appScreenshots/${screenshot.id}`, { method: 'PATCH', body: { data: {
        type: 'appScreenshots', id: screenshot.id, attributes: { uploaded: true, sourceFileChecksum: file.md5 }
      } } })).data;
    }
    let tries = 0;
    while (screenshot.attributes.assetDeliveryState.state !== 'COMPLETE') {
      if (screenshot.attributes.assetDeliveryState.state === 'FAILED' || tries++ >= 30) {
        throw new Error(`Screenshot not ready: ${file.file}: ${JSON.stringify(screenshot.attributes.assetDeliveryState)}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      screenshot = (await asc(`/v1/appScreenshots/${screenshot.id}`)).data;
    }
    ids.push(screenshot.id);
    console.log(JSON.stringify({ file: file.file, state: 'COMPLETE', checksum: screenshot.attributes.sourceFileChecksum }));
  }
  if (apply) {
    await asc(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { method: 'PATCH', body: {
      data: ids.map(id => ({ type: 'appScreenshots', id }))
    } });
    const check = await all(`/v1/appScreenshotSets/${set.id}/appScreenshots`);
    if (JSON.stringify(check.map(s => s.id)) !== JSON.stringify(ids)) throw new Error('Screenshot order differs after save');
    report.sets.push({ id: set.id, display: target.display, screenshots: check.map(s => ({ id: s.id, fileName: s.attributes.fileName,
      checksum: s.attributes.sourceFileChecksum, state: s.attributes.assetDeliveryState.state, image: s.attributes.imageAsset && {
        width: s.attributes.imageAsset.width, height: s.attributes.imageAsset.height } })) });
  }
}
if (apply) fs.writeFileSync(path.join(folder, 'apple-upload-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ applied: apply, verifiedSets: report.sets.length, submitted: false }));
