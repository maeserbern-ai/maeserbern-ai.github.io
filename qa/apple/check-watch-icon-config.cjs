const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireApp = createRequire(path.resolve('apple-app/package.json'));
const xcode = requireApp('xcode');
const projectName = fs.readdirSync('apple-app/ios').find(name => name.endsWith('.xcodeproj'));
assert.ok(projectName, 'Expo must generate the native project');
const project = xcode.project(path.resolve('apple-app/ios', projectName, 'project.pbxproj'));
project.parseSync();
const objects = project.hash.project.objects;
const watch = Object.entries(objects.PBXNativeTarget).filter(([id, target]) =>
  !id.endsWith('_comment') && target.name?.replaceAll('"', '') === 'PartyGameWatch');
assert.equal(watch.length, 1, 'Expected one embedded Watch target');
const configurations = objects.XCConfigurationList[watch[0][1].buildConfigurationList].buildConfigurations;
const verified = configurations.map(({ value }) => {
  const configuration = objects.XCBuildConfiguration[value];
  assert.equal(configuration.buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME?.replaceAll('"', ''), 'AppIcon',
    `${configuration.name}: Watch target must compile its primary icon`);
  return configuration.name;
});
assert.ok(verified.includes('Release') && verified.includes('Debug'));
fs.writeFileSync('qa-output/watch-icon-project-check.json', JSON.stringify({ passed: true, configurations: verified }, null, 2));
console.log('Generated embedded Watch target declares AppIcon in Debug and Release.');
