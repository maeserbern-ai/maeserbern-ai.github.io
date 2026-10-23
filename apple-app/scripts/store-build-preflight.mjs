import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import forge from 'node-forge';
import plist from '@expo/plist';
import { APP_ID, ROOT, storeClient } from './store-client.mjs';

const { asc, all } = storeClient();
const iosCredentials = JSON.parse(fs.readFileSync(path.join(ROOT, 'credentials.json'), 'utf8')).ios;
const targets = iosCredentials.IngredientPartyGame
  ? [
      ['IngredientPartyGame', 'io.github.maeserbern.ingredientpartygame'],
      ['PartyGameWatch', 'io.github.maeserbern.ingredientpartygame.watch']
    ]
  : [[null, 'io.github.maeserbern.ingredientpartygame']];
for (const [target, bundleId] of targets) {
  const credentials = target ? iosCredentials[target] : iosCredentials;
  if (!credentials) throw new Error(`Missing credentials for ${target}`);
  const profileBytes = fs.readFileSync(path.join(ROOT, credentials.provisioningProfilePath));
  const rawProfile = profileBytes.toString('utf8');
  const profile = (plist.default || plist).parse(rawProfile.slice(rawProfile.indexOf('<?xml'), rawProfile.indexOf('</plist>') + 8));
  const p12Bytes = fs.readFileSync(path.join(ROOT, credentials.distributionCertificate.path));
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Bytes.toString('binary')), credentials.distributionCertificate.password);
  const certs = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag].map(bag => bag.cert).filter(Boolean);
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const now = new Date();
  const certHashes = certs.filter(cert => cert.validity.notBefore <= now && cert.validity.notAfter > now)
    .map(cert => hash(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary')));
  if (!profile.DeveloperCertificates.some(cert => certHashes.includes(hash(Buffer.from(cert))))) {
    throw new Error('No valid distribution certificate matches the provisioning profile');
  }
  if (profile.Entitlements['application-identifier'] !== `LX23QQML6M.${bundleId}`) throw new Error(`Wrong identity for ${target || 'main app'}`);
  if (new Date(profile.ExpirationDate) <= now) throw new Error('Profile expired');
  if (profile.Entitlements['get-task-allow'] || profile.ProvisionedDevices || profile.ProvisionsAllDevices) throw new Error('Expected App Store distribution profile');
  console.log(`Signing certificate, App Store profile and identity verified: ${bundleId}`);
}
const app = (await asc(`/v1/apps/${APP_ID}`)).data;
if (app.attributes.bundleId !== 'io.github.maeserbern.ingredientpartygame') throw new Error('Wrong destination');
const builds = await all(`/v1/builds?filter[app]=${APP_ID}&limit=200`);
console.log('Apple uploaded builds:', JSON.stringify(builds.map(b => ({ id: b.id, version: b.attributes.version, processingState: b.attributes.processingState, expired: b.attributes.expired }))));
const bundles = await all('/v1/bundleIds?filter[identifier]=io.github.maeserbern.ingredientpartygame');
for (const bundle of bundles) {
  const profiles = await all(`/v1/bundleIds/${bundle.id}/profiles?limit=200`);
  console.log('Game signing profiles:', JSON.stringify(profiles.map(p => ({ id: p.id, name: p.attributes.name, type: p.attributes.profileType, state: p.attributes.profileState, expires: p.attributes.expirationDate }))));
}
