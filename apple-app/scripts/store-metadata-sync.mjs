import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const apply = process.argv.includes('--apply');
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-metadata.json'), 'utf8'));
for (const [field, limit] of Object.entries({ name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000, reviewNotes: 4000 })) {
  assert.ok(m[field].length <= limit, `${field} exceeds ${limit}`);
  console.log(`${field}: ${m[field].length}/${limit}`);
}
const { asc } = storeClient({ allowWrites: apply });
const app = (await asc(`/v1/apps/${APP_ID}`)).data;
assert.equal(app.attributes.bundleId, 'io.github.maeserbern.ingredientpartygame');
const versions = (await asc(`/v1/apps/${APP_ID}/appStoreVersions`)).data;
const info = (await asc(`/v1/apps/${APP_ID}/appInfos`)).data.find(x => x.attributes.state === 'PREPARE_FOR_SUBMISSION');
assert.ok(info, 'No editable app information');
const infoLocale = (await asc(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find(x => x.attributes.locale === 'en-US');
const operations = [{ type: 'appInfoLocalizations', id: infoLocale.id, attributes: {
  name: m.name, subtitle: m.subtitle, privacyPolicyUrl: m.privacyPolicyUrl,
  privacyPolicyText: m.privacyPolicyText
}}, { type: 'appInfos', id: info.id, relationships: {
  primaryCategory: { data: { type: 'appCategories', id: 'GAMES' } },
  primarySubcategoryOne: { data: { type: 'appCategories', id: 'GAMES_TRIVIA' } },
  primarySubcategoryTwo: { data: { type: 'appCategories', id: 'GAMES_FAMILY' } }
}}];
const backup = { app, info, infoLocale, versions, locales: [] };
for (const platform of ['IOS', 'TV_OS']) {
  const additions = m.platformAdditions?.[platform] || {};
  const description = [m.description, additions.description].filter(Boolean).join('\n\n');
  const reviewNotes = [m.reviewNotes, additions.reviewNotes].filter(Boolean).join('\n\n');
  assert.ok(description.length <= 4000, `${platform} description exceeds 4000`);
  assert.ok(reviewNotes.length <= 4000, `${platform} review notes exceed 4000`);
  const version = versions.find(x => x.attributes.platform === platform && x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  assert.ok(version, `No editable ${platform} version`);
  const locale = (await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find(x => x.attributes.locale === 'en-US');
  backup.locales.push(locale);
  const review = (await asc(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  backup[`${platform}Review`] = review;
  const attributes = { demoAccountRequired: false, notes: reviewNotes };
  if (review && Object.entries(attributes).every(([key, value]) => review.attributes[key] === value)) {
    console.log(`${platform} review instructions already match`);
  } else if (review) {
    operations.push({ type: 'appStoreReviewDetails', id: review.id, attributes });
  } else {
    operations.push({ type: 'appStoreReviewDetails', attributes, relationships: {
      appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } }
    }});
  }
  operations.push({ type: 'appStoreVersionLocalizations', id: locale.id, attributes: {
    description, keywords: m.keywords, promotionalText: m.promotionalText,
    supportUrl: m.supportUrl, marketingUrl: m.marketingUrl
  }}, { type: 'appStoreVersions', id: version.id, attributes: { copyright: m.copyright } });
}
if (!apply) {
  console.log(`Validated ${operations.length} draft-only metadata updates. Nothing saved to Apple.`);
  process.exit(0);
}
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', `metadata-before-${Date.now()}.json`), JSON.stringify(backup, null, 2));
for (const data of operations) {
  const result = await asc(`/v1/${data.type}${data.id ? `/${data.id}` : ''}`, { method: data.id ? 'PATCH' : 'POST', body: { data } });
  const id = data.id || result.data.id;
  const saved = (await asc(`/v1/${data.type}/${id}`)).data;
  for (const [field, value] of Object.entries(data.attributes || {})) assert.equal(saved.attributes[field], value, `Readback mismatch: ${field}`);
  for (const [field, value] of Object.entries(data.relationships || {})) {
    if (data.type === 'appStoreReviewDetails' && field === 'appStoreVersion') {
      const parent = await asc(`/v1/appStoreVersions/${value.data.id}/appStoreReviewDetail`);
      assert.equal(parent.data.id, id, 'Review details linked to the wrong version');
      continue;
    }
    const related = await asc(`/v1/${data.type}/${id}/relationships/${field}`);
    assert.equal(related.data.id, value.data.id, `Readback mismatch: ${field}`);
  }
  console.log(`Saved and verified ${data.type}/${id}`);
}
console.log('iOS and tvOS draft text saved. No build or version submitted for review.');
