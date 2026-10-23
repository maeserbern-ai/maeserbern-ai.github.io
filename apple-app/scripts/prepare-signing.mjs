import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import plist from '@expo/plist';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(os.homedir(), 'home-survival-kit');
const profilePath = path.join(os.homedir(), 'Downloads', 'Ingredient_Party_Game_App_Store.mobileprovision');
const profileBytes = fs.readFileSync(profilePath);
const raw = profileBytes.toString('utf8');
const profile = (plist.default || plist).parse(raw.slice(raw.indexOf('<?xml'), raw.indexOf('</plist>') + 8));
if (profile.Entitlements['application-identifier'] !== 'LX23QQML6M.io.github.maeserbern.ingredientpartygame') throw new Error('Wrong signing profile');
if (new Date(profile.ExpirationDate) <= new Date() || profile.Entitlements['get-task-allow']) throw new Error('Profile expired or not distribution');
const credentials = JSON.parse(fs.readFileSync(path.join(source, 'credentials.json'), 'utf8'));
const submit = JSON.parse(fs.readFileSync(path.join(source, 'eas.json'), 'utf8')).submit.production.ios;
const certificate = credentials.ios.distributionCertificate;
const certDirectory = path.join(root, 'ios', 'certs');
fs.mkdirSync(certDirectory, { recursive: true });
for (const name of ['credentials.json', 'ios/certs/']) {
  if (!fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes(name)) throw new Error(`Missing secret ignore: ${name}`);
}
fs.copyFileSync(path.resolve(source, certificate.path), path.join(certDirectory, 'dist.p12'));
fs.copyFileSync(path.resolve(source, submit.ascApiKeyPath), path.join(certDirectory, 'asc_api_key.p8'));
fs.writeFileSync(path.join(certDirectory, 'profile.mobileprovision'), profileBytes);
fs.writeFileSync(path.join(root, 'credentials.json'), JSON.stringify({ ios: {
  provisioningProfilePath: 'ios/certs/profile.mobileprovision',
  distributionCertificate: { path: 'ios/certs/dist.p12', password: certificate.password }
}}, null, 2) + '\n');
const easPath = path.join(root, 'eas.json');
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
eas.build.production.credentialsSource = 'local';
eas.build.production.ios.image = 'latest';
eas.submit.production.ios = {
  ascAppId: '6823244099',
  ascApiKeyPath: './ios/certs/asc_api_key.p8',
  ascApiKeyId: submit.ascApiKeyId,
  ascApiKeyIssuerId: submit.ascApiKeyIssuerId
};
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
console.log('Prepared game-only signing with the existing distribution certificate and game provisioning profile.');
