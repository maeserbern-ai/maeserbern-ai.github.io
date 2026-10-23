import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const appRequire = createRequire(path.resolve('package.json'));
const expoPackage = appRequire.resolve('expo/package.json');
const expoRequire = createRequire(expoPackage);
const audioRequire = createRequire(appRequire.resolve('expo-audio/package.json'));
const expected = JSON.parse(fs.readFileSync(path.join(path.dirname(expoPackage), 'bundledNativeModules.json'), 'utf8'));
const semver = appRequire('semver');

// Audio's permissive peer dependency must not introduce another SDK's native modules.
for (const name of ['expo-asset', 'expo-constants']) {
  const paths = [appRequire, expoRequire, audioRequire].map(require => require.resolve(`${name}/package.json`));
  assert.equal(new Set(paths).size, 1, `${name} resolves to multiple installed copies`);
  const installed = JSON.parse(fs.readFileSync(paths[0], 'utf8')).version;
  assert(semver.satisfies(installed, expected[name]), `${name} ${installed} is incompatible with ${expected[name]}`);
  console.log(`${name}: ${installed}; one SDK-compatible copy`);
}
