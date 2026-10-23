import fs from 'node:fs';
import path from 'node:path';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const { asc } = storeClient();
const endpoints = [
  `/v1/apps/${APP_ID}`,
  `/v1/apps/${APP_ID}/appStoreVersions`,
  `/v1/apps/${APP_ID}/appInfos`,
  `/v1/builds?filter[app]=${APP_ID}`,
  '/v1/appStoreVersions/90577eef-0438-4b13-82a8-acf57c336d39/appStoreVersionLocalizations',
  '/v1/appStoreVersions/620eb160-cc2e-4d9b-9a79-3eadfbb22a98/appStoreVersionLocalizations',
  '/v1/appInfos/cd577f54-361e-4ed9-ac3f-1d2eb3240fb5/appInfoLocalizations',
  '/v1/appInfos/cd577f54-361e-4ed9-ac3f-1d2eb3240fb5/ageRatingDeclaration',
  '/v1/appCategories?limit=200',
  `/v1/apps/${APP_ID}/appPriceSchedule`,
  `/v1/apps/${APP_ID}/appAvailabilityV2`
];
const report = { at: new Date().toISOString(), appId: APP_ID, results: {} };
for (const endpoint of endpoints) {
  try {
    const result = await asc(endpoint);
    report.results[endpoint] = result;
    console.log(JSON.stringify({ endpoint, data: result.data }));
  } catch (error) {
    report.results[endpoint] = { error: error.message };
    console.log(JSON.stringify({ endpoint, error: error.message }));
  }
}
fs.mkdirSync(path.join(ROOT, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', `store-audit-${Date.now()}.json`), JSON.stringify(report, null, 2));
