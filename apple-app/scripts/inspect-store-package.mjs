import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import bplist from 'bplist-parser';
import plist from '@expo/plist';
import { verifySceneLifecycle } from './scene-package-check.mjs';

const [metadataFile, target] = process.argv.slice(2);
if (!metadataFile || !['ios', 'tvos'].includes(target)) {
  throw new Error('Usage: node scripts/inspect-store-package.mjs <EAS build JSON> <ios|tvos>');
}
const build = JSON.parse(fs.readFileSync(metadataFile, 'utf8').replace(/^\uFEFF/, ''));
if (build.status !== 'FINISHED') throw new Error(`Build is ${build.status}, not finished`);
const source = new URL(build.artifacts.applicationArchiveUrl ?? build.artifacts.buildUrl);
if (source.protocol !== 'https:') throw new Error('Expected HTTPS artifact URL');
const outDir = path.resolve('artifacts', `package-${target}-${build.id}`);
fs.mkdirSync(outDir, { recursive: true });
const archive = path.join(outDir, 'game.ipa');
if (!fs.existsSync(archive)) {
  const response = await fetch(source, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Artifact download returned ${response.status}`);
  const temporary = `${archive}.partial`;
  fs.writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(temporary, archive);
}
const entries = execFileSync('tar.exe', ['-tf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split(/\r?\n/);
const infoPaths = entries.filter(name => /^Payload\/[^/]+\.app\/Info\.plist$/.test(name));
if (infoPaths.length !== 1) throw new Error('Expected exactly one main app Info.plist');
const appPath = path.posix.dirname(infoPaths[0]);
const readEntry = name => execFileSync('tar.exe', ['-xOf', archive, name], { maxBuffer: 16 * 1024 * 1024 });
const parsePlist = bytes => bytes.subarray(0, 6).toString() === 'bplist'
  ? bplist.parseBuffer(bytes)[0]
  : (plist.default || plist).parse(bytes.toString('utf8'));
const info = parsePlist(readEntry(infoPaths[0]));
const sceneLifecycle = verifySceneLifecycle(info, target);
const profileText = readEntry(`${appPath}/embedded.mobileprovision`).toString('utf8');
const start = profileText.indexOf('<?xml');
const end = profileText.indexOf('</plist>', start);
if (start < 0 || end < 0) throw new Error('Missing embedded provisioning XML');
const profile = (plist.default || plist).parse(profileText.slice(start, end + 8));
const expectedBundle = 'io.github.maeserbern.ingredientpartygame';
const expectedPlatform = target === 'ios' ? 'iPhoneOS' : 'AppleTVOS';
const expectedFamilies = target === 'ios' ? [1, 2] : [3];
if (info.CFBundleIdentifier !== expectedBundle) throw new Error('Incorrect game bundle identifier');
if (String(info.CFBundleVersion) !== String(build.appBuildVersion)) throw new Error('Build number differs from EAS');
if (info.CFBundleShortVersionString !== build.appVersion) throw new Error('App version differs from EAS');
if (!info.CFBundleSupportedPlatforms?.includes(expectedPlatform)) throw new Error(`Package is not ${target}`);
if (JSON.stringify([...info.UIDeviceFamily].sort()) !== JSON.stringify(expectedFamilies)) throw new Error('Unexpected device families');
if (profile.Entitlements['application-identifier'] !== `LX23QQML6M.${expectedBundle}`) throw new Error('Wrong signing identity');
if (profile.Entitlements['get-task-allow']) throw new Error('Debug entitlement is present');
if (new Date(profile.ExpirationDate) <= new Date()) throw new Error('Embedded signing profile has expired');
let watch = null;
if (target === 'ios' && Number(build.appBuildVersion) >= 4) {
  const watchPaths = entries.filter(name => name.startsWith(`${appPath}/Watch/`) && /\/Watch\/[^/]+\.app\/Info\.plist$/.test(name));
  if (watchPaths.length !== 1) throw new Error('Expected exactly one embedded Watch app');
  const watchPath = path.posix.dirname(watchPaths[0]);
  const watchInfo = parsePlist(readEntry(watchPaths[0]));
  const watchProfileText = readEntry(`${watchPath}/embedded.mobileprovision`).toString('utf8');
  const watchProfileStart = watchProfileText.indexOf('<?xml');
  const watchProfileEnd = watchProfileText.indexOf('</plist>', watchProfileStart);
  if (watchProfileStart < 0 || watchProfileEnd < 0) throw new Error('Missing Watch provisioning profile');
  const watchProfile = (plist.default || plist).parse(watchProfileText.slice(watchProfileStart, watchProfileEnd + 8));
  if (watchInfo.CFBundleIdentifier !== `${expectedBundle}.watch`
    || watchInfo.WKCompanionAppBundleIdentifier !== expectedBundle
    || !watchInfo.WKApplication || !watchInfo.WKRunsIndependentlyOfCompanionApp
    || watchInfo.WKWatchOnly
    || !watchInfo.CFBundleSupportedPlatforms?.includes('WatchOS')
    || JSON.stringify(watchInfo.UIDeviceFamily) !== '[4]'
    || String(watchInfo.CFBundleVersion) !== String(info.CFBundleVersion)
    || watchInfo.CFBundleShortVersionString !== info.CFBundleShortVersionString) {
    throw new Error('Embedded Watch identity, companion, platform, or version mismatch');
  }
  if (watchProfile.Entitlements['application-identifier'] !== `LX23QQML6M.${expectedBundle}.watch`
    || watchProfile.Entitlements['get-task-allow']
    || new Date(watchProfile.ExpirationDate) <= new Date()) throw new Error('Invalid Watch signing profile');
  const puzzles = JSON.parse(readEntry(`${watchPath}/puzzles.json`).toString('utf8'));
  if (!Array.isArray(puzzles) || puzzles.length !== 85) throw new Error('Expected the complete 85-puzzle solo Watch deck');
  const books = JSON.parse(readEntry(`${watchPath}/books.json`).toString('utf8'));
  if (!Array.isArray(books) || books.length !== 7 || new Set(books.map(book => book.id)).size !== 7
    || books.some(book => !book.name || !book.qrAsset || !/^https:\/\/(www\.amazon\.com|maeserbern-ai\.github\.io)\//.test(book.url))) {
    throw new Error('Expected all seven approved Watch book destinations');
  }
  const testedBooks = JSON.parse(fs.readFileSync(path.resolve('../watch-app/PartyGameWatch/Resources/books.json'), 'utf8'));
  if (JSON.stringify(books) !== JSON.stringify(testedBooks)) {
    throw new Error('Signed Watch book catalog differs from the tested release source');
  }
  if (!entries.includes(`${watchPath}/${watchInfo.CFBundleExecutable}`)
    || !entries.includes(`${watchPath}/Assets.car`)) throw new Error('Watch executable or compiled assets missing');
  const watchPrimaryIcon = watchInfo.CFBundleIcons?.CFBundlePrimaryIcon;
  const watchIconName = watchPrimaryIcon?.CFBundleIconName ?? watchInfo.CFBundleIconName;
  const watchIconFiles = watchPrimaryIcon?.CFBundleIconFiles ?? watchInfo.CFBundleIconFiles ?? [];
  if (watchIconName !== 'AppIcon' || !Array.isArray(watchIconFiles)) {
    throw new Error('Watch app is missing its compiled AppIcon metadata; Apple rejects this package (90391/90713)');
  }
  for (const icon of watchIconFiles) {
    if (!entries.some(entry => entry.startsWith(`${watchPath}/${icon}`) && entry.endsWith('.png'))) {
      throw new Error(`Watch icon file declared but not packaged: ${icon}`);
    }
  }
  const watchPrivacy = parsePlist(readEntry(`${watchPath}/PrivacyInfo.xcprivacy`));
  const watchLocalStorage = watchPrivacy.NSPrivacyAccessedAPITypes?.find(api =>
    api.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults');
  if (watchPrivacy.NSPrivacyTracking !== false || watchPrivacy.NSPrivacyCollectedDataTypes?.length !== 0
    || !watchLocalStorage?.NSPrivacyAccessedAPITypeReasons?.includes('CA92.1')) {
    throw new Error('Watch privacy manifest does not match no-tracking, on-device score storage');
  }
  watch = { bundleIdentifier: watchInfo.CFBundleIdentifier, companionBundleIdentifier: watchInfo.WKCompanionAppBundleIdentifier,
    version: watchInfo.CFBundleShortVersionString, buildNumber: watchInfo.CFBundleVersion,
    independent: watchInfo.WKRunsIndependentlyOfCompanionApp, supportedPlatforms: watchInfo.CFBundleSupportedPlatforms,
    minimumOS: watchInfo.MinimumOSVersion, puzzleCount: puzzles.length, bookDestinationCount: books.length,
    embeddedProfileExpires: watchProfile.ExpirationDate, privacyManifestVerified: true,
    iconName: watchIconName, iconFiles: watchIconFiles, iconMetadataVerified: true };
}
const report = {
  checkedAt: new Date().toISOString(),
  buildId: build.id,
  target,
  archive,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
  bundleIdentifier: info.CFBundleIdentifier,
  version: info.CFBundleShortVersionString,
  buildNumber: info.CFBundleVersion,
  supportedPlatforms: info.CFBundleSupportedPlatforms,
  deviceFamilies: info.UIDeviceFamily,
  minimumOS: info.MinimumOSVersion,
  sdk: info.DTSDKName,
  xcode: info.DTXcode,
  sceneLifecycle,
  supportedOrientations: info.UISupportedInterfaceOrientations,
  requiresFullScreen: info.UIRequiresFullScreen,
  usageDescriptions: Object.fromEntries(Object.entries(info).filter(([key]) => key.endsWith('UsageDescription'))),
  embeddedProfileExpires: profile.ExpirationDate,
  embeddedProfilePlatform: profile.Platform,
  embeddedWatch: watch,
  nativeRuntimeTested: false,
  codeSignatureCryptographicallyVerified: false
};
fs.writeFileSync(path.join(outDir, 'inspection.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
