import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP_ID, storeClient } from './store-client.mjs';

const apply = process.argv.includes('--apply');
const [target, easBuildId] = process.argv.slice(2).filter(arg => arg !== '--apply');
if (!['ios', 'tvos'].includes(target) || !/^[a-f0-9-]{36}$/.test(easBuildId || '')) {
  throw new Error('Usage: node scripts/store-associate-builds.mjs <ios|tvos> <inspected EAS build id> [--apply]');
}
const inspection = JSON.parse(fs.readFileSync(path.join('artifacts', `package-${target}-${easBuildId}`, 'inspection.json'), 'utf8'));
const expectedBuild = target === 'ios' ? '6' : '3';
if (target === 'ios' && String(inspection.buildNumber) === '5') {
  throw new Error('Build 5 is blocked: iOS 27 simulator confirmed missing UIScene lifecycle. Do not select or submit it.');
}
if (inspection.buildId !== easBuildId || inspection.target !== target || String(inspection.buildNumber) !== expectedBuild
  || inspection.bundleIdentifier !== 'io.github.maeserbern.ingredientpartygame' || inspection.version !== '1.0.0') {
  throw new Error(`Expected the inspected replacement build ${expectedBuild} for this game and platform`);
}
if (target === 'ios' && (inspection.embeddedWatch?.bundleIdentifier !== 'io.github.maeserbern.ingredientpartygame.watch'
  || String(inspection.embeddedWatch.buildNumber) !== expectedBuild
  || !inspection.embeddedWatch.iconMetadataVerified
  || !inspection.embeddedWatch.privacyManifestVerified)) throw new Error('The verified embedded Watch app, icon and privacy metadata are required');
if (target === 'ios' && !inspection.sceneLifecycle?.manifestVerified) {
  throw new Error('The signed iOS package must contain the verified scene lifecycle configuration');
}
const archiveHash = crypto.createHash('sha256').update(fs.readFileSync(inspection.archive)).digest('hex');
if (archiveHash !== inspection.sha256) throw new Error('Inspected archive changed');
const oldBuilds = { IOS: '10c55f02-36aa-4d24-96df-b9136d642fdf', TV_OS: '6b0e7405-48fb-4b52-89b8-3a3052476586' };
const { asc, all } = storeClient({ allowWrites: apply });
const versions = await all(`/v1/apps/${APP_ID}/appStoreVersions?limit=200`);
const builds = await asc(`/v1/builds?filter[app]=${APP_ID}&include=preReleaseVersion&limit=200`);
const streams = new Map((builds.included || []).map(item => [item.id, item.attributes]));
const result = [];
for (const platform of [target === 'ios' ? 'IOS' : 'TV_OS']) {
  const version = versions.find(v => v.attributes.platform === platform && v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!version) throw new Error(`No editable ${platform} draft`);
  const candidates = builds.data.filter(b => streams.get(b.relationships.preReleaseVersion.data.id)?.platform === platform
    && b.attributes.version === String(inspection.buildNumber) && b.attributes.processingState === 'VALID' && !b.attributes.expired);
  if (candidates.length !== 1) throw new Error(`Expected exactly one processed replacement build ${inspection.buildNumber} for ${platform}`);
  const build = candidates[0];
  const stream = streams.get(build.relationships.preReleaseVersion.data.id);
  if (stream.version !== '1.0.0' || version.attributes.versionString !== '1.0') throw new Error('Unexpected app version');
  const endpoint = `/v1/appStoreVersions/${version.id}/relationships/build`;
  const before = await asc(endpoint);
  if (before.data && ![oldBuilds[platform], build.id].includes(before.data.id)) throw new Error('An unexpected build is selected; refusing to replace it');
  if (apply && before.data?.id !== build.id) await asc(endpoint, { method: 'PATCH', body: { data: { type: 'builds', id: build.id } } });
  const verified = await asc(endpoint);
  if (apply && verified.data?.id !== build.id) throw new Error('Build selection did not persist');
  result.push({ platform, appVersion: version.attributes.versionString, buildId: build.id, buildNumber: build.attributes.version, easBuildId,
    previousBuildId: before.data?.id, applied: apply,
    selected: verified.data?.id === build.id,
    processingState: build.attributes.processingState,
    minOS: build.attributes.minOsVersion,
    computedMinMacOS: build.attributes.computedMinMacOsVersion,
    computedMinVisionOS: build.attributes.computedMinVisionOsVersion,
    usesNonExemptEncryption: build.attributes.usesNonExemptEncryption });
}
fs.writeFileSync(`artifacts/apple-build-associations-${target}-replacement.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
