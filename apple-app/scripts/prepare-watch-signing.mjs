import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import forge from 'node-forge';
import plist from '@expo/plist';
import { ROOT, storeClient } from './store-client.mjs';

const apply = process.argv.includes('--apply');
const { asc, all } = storeClient({ allowWrites: apply });
const file = path.join(ROOT, 'credentials.json');
const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
const main = existing.ios.provisioningProfilePath ? existing.ios : existing.ios.IngredientPartyGame;
if (!main) throw new Error('Existing Ingredient Party Game signing credentials are missing');
const certBytes = fs.readFileSync(path.resolve(ROOT, main.distributionCertificate.path));
const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(certBytes.toString('binary')), main.distributionCertificate.password);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const certHashes = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
  .filter(bag => bag.cert).map(bag => hash(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes(), 'binary')));
const certificates = await all('/v1/certificates?limit=200');
const certificate = certificates.find(c => c.attributes.certificateContent && certHashes.includes(hash(Buffer.from(c.attributes.certificateContent, 'base64'))));
if (!certificate || new Date(certificate.attributes.expirationDate) <= new Date()) throw new Error('No matching active distribution certificate');
const identifier = 'io.github.maeserbern.ingredientpartygame.watch';
const matches = await all(`/v1/bundleIds?filter[identifier]=${identifier}`);
if (matches.length > 1) throw new Error('Ambiguous Watch identifier');
let bundle = matches[0];
if (!bundle && apply) {
  bundle = (await asc('/v1/bundleIds', { method: 'POST', body: { data: {
    type: 'bundleIds', attributes: { identifier, name: 'Ingredient Party Game Watch', platform: 'IOS' }
  } } })).data;
}
if (!bundle) {
  console.log(JSON.stringify({ apply: false, plan: 'Register the game-only Watch identifier and create its profile with the existing distribution certificate. No new certificate or capability.' }));
  process.exit(0);
}
const profiles = await all(`/v1/bundleIds/${bundle.id}/profiles?limit=200`);
let profile;
for (const candidate of profiles) {
  if (candidate.attributes.profileType !== 'IOS_APP_STORE' || candidate.attributes.profileState !== 'ACTIVE' || new Date(candidate.attributes.expirationDate) <= new Date()) continue;
  const certs = await all(`/v1/profiles/${candidate.id}/certificates`);
  if (certs.some(c => c.id === certificate.id)) { profile = candidate; break; }
}
if (!profile && apply) {
  profile = (await asc('/v1/profiles', { method: 'POST', body: { data: {
    type: 'profiles', attributes: { name: 'Ingredient Party Game Watch App Store', profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: certificate.id }] }
    }
  } } })).data;
}
if (!profile) { console.log('Watch identifier exists; an App Store profile is still needed. No changes made.'); process.exit(0); }
const bytes = Buffer.from(profile.attributes.profileContent, 'base64');
const text = bytes.toString('utf8');
const parsed = (plist.default || plist).parse(text.slice(text.indexOf('<?xml'), text.indexOf('</plist>') + 8));
if (parsed.Entitlements['application-identifier'] !== `LX23QQML6M.${identifier}` || parsed.Entitlements['get-task-allow']) throw new Error('Incorrect Watch distribution identity');
// Apple issues watchOS distribution profiles using the iOS App Store profile type.
if (profile.attributes.profileType !== 'IOS_APP_STORE' || !parsed.Platform.includes('iOS') || !parsed.DeveloperCertificates.some(c => certHashes.includes(hash(Buffer.from(c))))) throw new Error('Watch platform or certificate mismatch');
if (apply) {
  const backup = path.join(ROOT, 'ios/certs/credentials-before-watch.json');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  fs.writeFileSync(path.join(ROOT, 'ios/certs/watch-profile.mobileprovision'), bytes);
  fs.writeFileSync(file, JSON.stringify({ ...existing, ios: {
    ...(existing.ios.provisioningProfilePath ? {} : existing.ios),
    IngredientPartyGame: main,
    PartyGameWatch: { provisioningProfilePath: 'ios/certs/watch-profile.mobileprovision', distributionCertificate: main.distributionCertificate }
  } }, null, 2) + '\n');
}
console.log(JSON.stringify({ apply, identifier, bundleId: bundle.id, profileId: profile.id, platform: parsed.Platform, existingCertificateReused: true, newStoreListing: false }));
