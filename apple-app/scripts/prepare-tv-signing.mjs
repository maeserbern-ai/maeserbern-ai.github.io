import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import forge from 'node-forge';
import plist from '@expo/plist';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const apply = process.argv.includes('--apply');
const { asc, all } = storeClient({ allowWrites: apply });
const iosCredentials = JSON.parse(fs.readFileSync(path.join(ROOT, 'credentials.json'), 'utf8')).ios;
const credentials = iosCredentials.IngredientPartyGame || iosCredentials;
const bytes = fs.readFileSync(path.join(ROOT, credentials.distributionCertificate.path));
const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bytes.toString('binary')), credentials.distributionCertificate.password);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const localHashes = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
  .filter(b => b.cert).map(b => hash(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(b.cert)).getBytes(), 'binary')));
const certs = await all('/v1/certificates?limit=200');
const certificate = certs.find(c => c.attributes.certificateContent && localHashes.includes(hash(Buffer.from(c.attributes.certificateContent, 'base64'))));
if (!certificate) throw new Error('Existing local distribution certificate not found in Apple account');
const bundles = await all('/v1/bundleIds?filter[identifier]=io.github.maeserbern.ingredientpartygame');
if (bundles.length !== 1) throw new Error('Expected exactly one existing game app identifier');
const bundle = bundles[0];
const profiles = await all(`/v1/bundleIds/${bundle.id}/profiles?limit=200`);
let profile = profiles.find(p => p.attributes.profileType === 'TVOS_APP_STORE' && p.attributes.profileState === 'ACTIVE' && new Date(p.attributes.expirationDate) > new Date());
if (!profile && !apply) {
  console.log('Ready to create a TVOS_APP_STORE profile for the existing game identifier and distribution certificate. No changes made.');
  process.exit(0);
}
if (!profile) {
  profile = (await asc('/v1/profiles', { method: 'POST', body: { data: {
    type: 'profiles', attributes: { name: 'Ingredient Party Game tvOS App Store', profileType: 'TVOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: certificate.id }] },
    },
  } } })).data;
}
const profileBytes = Buffer.from(profile.attributes.profileContent, 'base64');
const raw = profileBytes.toString('utf8');
const parsed = (plist.default || plist).parse(raw.slice(raw.indexOf('<?xml'), raw.indexOf('</plist>') + 8));
if (parsed.Entitlements['application-identifier'] !== 'LX23QQML6M.io.github.maeserbern.ingredientpartygame') throw new Error('Wrong TV app profile');
if (!parsed.DeveloperCertificates.some(c => localHashes.includes(hash(Buffer.from(c))))) throw new Error('TV profile certificate mismatch');
if (!parsed.Platform.includes('tvOS')) throw new Error('Not a tvOS provisioning profile');
if (apply) {
  const tvRoot = path.resolve(ROOT, '../appletv-app');
  fs.mkdirSync(path.join(tvRoot, 'certs'), { recursive: true });
  fs.writeFileSync(path.join(tvRoot, 'certs/profile.mobileprovision'), profileBytes);
  fs.writeFileSync(path.join(tvRoot, 'certs/dist.p12'), bytes);
  fs.writeFileSync(path.join(tvRoot, 'credentials.json'), JSON.stringify({ ios: {
    provisioningProfilePath: 'certs/profile.mobileprovision',
    distributionCertificate: { path: 'certs/dist.p12', password: credentials.distributionCertificate.password },
  } }, null, 2) + '\n');
  const iosSubmit = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8')).submit.production.ios;
  if (String(iosSubmit.ascAppId) !== APP_ID) throw new Error('Wrong submission destination');
  fs.copyFileSync(path.join(ROOT, iosSubmit.ascApiKeyPath), path.join(tvRoot, 'certs/asc_api_key.p8'));
  const easPath = path.join(tvRoot, 'eas.json');
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  eas.cli.appVersionSource = 'local';
  eas.build.production.credentialsSource = 'local';
  eas.build.production.ios.image = 'latest';
  eas.submit.production.ios = { ...iosSubmit, ascApiKeyPath: './certs/asc_api_key.p8' };
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
}
console.log(`Verified tvOS profile ${profile.id}; existing certificate reused. ${apply ? 'Local signing prepared.' : 'No local changes.'}`);
