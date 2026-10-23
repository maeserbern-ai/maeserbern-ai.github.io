import fs from 'node:fs';
import path from 'node:path';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-metadata.json'), 'utf8'));
const { asc, all } = storeClient();
const report = { checkedAt: new Date().toISOString(), appId: APP_ID, readOnly: true, checks: [], versions: [] };
const check = (name, passed) => report.checks.push({ name, passed: Boolean(passed) });
const app = (await asc(`/v1/apps/${APP_ID}`)).data;
check('Correct bundle identifier', app.attributes.bundleId === 'io.github.maeserbern.ingredientpartygame');
const versions = await all(`/v1/apps/${APP_ID}/appStoreVersions`);
const info = (await all(`/v1/apps/${APP_ID}/appInfos`)).find(item => item.attributes.state === 'PREPARE_FOR_SUBMISSION');
if (!info) throw new Error('No editable app information; this check does not change released listings');
const infoLocale = (await all(`/v1/appInfos/${info.id}/appInfoLocalizations`)).find(item => item.attributes.locale === 'en-US');
for (const field of ['name', 'subtitle', 'privacyPolicyUrl', 'privacyPolicyText']) {
  check(`App information: ${field}`, infoLocale?.attributes[field] === metadata[field]);
}

const verifiedAssets = [
  'artifacts/native-store-images-20261016-recapture/apple-upload-verification.json',
  'artifacts/native-store-images-20261016-tvos-final/apple-upload-verification.json',
  'artifacts/native-store-images-20261019-watch/apple-upload-verification.json',
].map(file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')));

for (const [platform, expectedBuild] of [['IOS', '6'], ['TV_OS', '3']]) {
  const version = versions.find(item => item.attributes.platform === platform && item.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  check(`${platform}: editable draft`, version);
  if (!version) continue;
  const locale = (await all(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).find(item => item.attributes.locale === 'en-US');
  if (!locale) throw new Error(`Missing ${platform} en-US localization`);
  const additions = metadata.platformAdditions?.[platform] || {};
  const expectedDescription = [metadata.description, additions.description].filter(Boolean).join('\n\n');
  const expectedNotes = [metadata.reviewNotes, additions.reviewNotes].filter(Boolean).join('\n\n');
  for (const field of ['keywords', 'promotionalText', 'supportUrl', 'marketingUrl']) {
    check(`${platform}: ${field}`, locale.attributes[field] === metadata[field]);
  }
  check(`${platform}: description`, locale.attributes.description === expectedDescription && expectedDescription.length <= 4000);
  check(`${platform}: copyright`, version.attributes.copyright === metadata.copyright);
  const review = (await asc(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  check(`${platform}: review instructions`, review?.attributes.notes === expectedNotes);
  check(`${platform}: private review contact complete`, ['contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail']
    .every(field => typeof review?.attributes[field] === 'string' && review.attributes[field].trim()));
  check(`${platform}: no demo login required`, review?.attributes.demoAccountRequired === false);
  const build = (await asc(`/v1/appStoreVersions/${version.id}/build`)).data;
  if (platform === 'IOS') {
    check('IOS: known pre-scene-lifecycle builds are blocked', !['2', '4', '5'].includes(build?.attributes.version));
  }
  check(`${platform}: expected processed build ${expectedBuild}`, build?.attributes.version === expectedBuild && build.attributes.processingState === 'VALID');
  check(`${platform}: export compliance declared`, build?.attributes.usesNonExemptEncryption === false);
  const sets = await all(`/v1/appStoreVersionLocalizations/${locale.id}/appScreenshotSets`);
  const setSummary = [];
  for (const set of sets) {
    const screenshots = await all(`/v1/appScreenshotSets/${set.id}/appScreenshots`);
    const complete = screenshots.every(item => item.attributes.assetDeliveryState?.state === 'COMPLETE');
    check(`${platform}: ${set.attributes.screenshotDisplayType} uploads complete`, complete);
    setSummary.push({ display: set.attributes.screenshotDisplayType, count: screenshots.length, complete });
    const expected = verifiedAssets.flatMap(asset => asset.versionId === version.id ? asset.sets : []).find(item => item.id === set.id);
    if (expected) {
      check(`${platform}: ${set.attributes.screenshotDisplayType} image order and content`, screenshots.length === expected.screenshots.length
        && screenshots.every((item, index) => item.id === expected.screenshots[index].id
          && item.attributes.sourceFileChecksum === expected.screenshots[index].checksum));
    }
  }
  const expectedSets = verifiedAssets.flatMap(asset => asset.versionId === version.id ? asset.sets : []);
  check(`${platform}: all verified screenshot sets retained`, expectedSets.every(expected => sets.some(set => set.id === expected.id)));
  report.versions.push({ platform, state: version.attributes.appStoreState, version: version.attributes.versionString,
    selectedBuild: build?.attributes.version, processingState: build?.attributes.processingState,
    computedMinMacOS: build?.attributes.computedMinMacOsVersion,
    computedMinVisionOS: build?.attributes.computedMinVisionOsVersion, screenshotSets: setSummary });
}
report.passed = report.checks.every(item => item.passed);
report.note = 'API readback only. Native runtime QA, privacy website approval, Duo images, and compatibility checks remain separate release gates.';
fs.writeFileSync(path.join(ROOT, 'artifacts/store-final-readback.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 2;
