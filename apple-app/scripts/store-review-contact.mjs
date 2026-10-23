import { APP_ID, storeClient } from './store-client.mjs';

const apply = process.argv.includes('--apply');
const { asc, all } = storeClient({ allowWrites: apply });
const sourceVersion = '4ea981e6-ecbe-4931-ba0a-156b1036d8be';
const source = (await asc(`/v1/appStoreVersions/${sourceVersion}/appStoreReviewDetail`)).data;
const fields = ['contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail'];
const contact = Object.fromEntries(fields.map(key => [key, source.attributes[key]]));
if (fields.some(key => typeof contact[key] !== 'string' || !contact[key].trim())) {
  throw new Error('The approved source is missing required contact fields');
}
const versions = await all(`/v1/apps/${APP_ID}/appStoreVersions?limit=50`);
for (const platform of ['IOS', 'TV_OS']) {
  const version = versions.find(item => item.attributes.platform === platform && item.attributes.versionString === '1.0');
  if (!version || version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    throw new Error(`${platform}: expected editable Ingredient Party Game 1.0 draft`);
  }
  const endpoint = `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`;
  const detail = (await asc(endpoint)).data;
  if (apply) {
    await asc(`/v1/appStoreReviewDetails/${detail.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: contact } },
    });
    const saved = (await asc(endpoint)).data.attributes;
    if (fields.some(key => saved[key] !== contact[key])) throw new Error(`${platform}: contact readback mismatch`);
    console.log(`${platform}: all four private App Review contact fields copied and verified; existing notes preserved.`);
  } else {
    console.log(`${platform}: approved private contact ready to copy. No write performed.`);
  }
}
