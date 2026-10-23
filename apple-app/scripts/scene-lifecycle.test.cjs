const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrateAppDelegate, sceneManifest } = require('../plugins/with-scene-lifecycle.cjs');

const original = `import Expo
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  func launch() {
    bindReactNativeFactory(factory)
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

test('launch waits for a connected window scene and preserves Expo initialization', () => {
  const result = migrateAppDelegate(original);
  assert.ok(!result.includes('UIScreen.main.bounds'));
  assert.ok(result.includes('UIWindow(windowScene: scene)'));
  assert.ok(result.includes('bindReactNativeFactory(factory)'));
  assert.ok(result.includes('return super.application(application, didFinishLaunchingWithOptions: launchOptions)'));
  assert.equal((result.match(/startReactNative\(/g) || []).length, 1);
  assert.equal(migrateAppDelegate(result), result);
});
test('scene forwards active, background, URL and universal-link events', () => {
  const result = migrateAppDelegate(original);
  for (const event of ['applicationDidBecomeActive', 'applicationWillResignActive',
    'applicationWillEnterForeground', 'applicationDidEnterBackground', 'openURLContexts', 'continue userActivity']) {
    assert.ok(result.includes(event), event);
  }
});
test('scene manifest preserves unrelated configuration and disallows multiple game windows', () => {
  const result = sceneManifest({ CFBundleIdentifier: 'test', UIRequiresFullScreen: true });
  assert.equal(result.CFBundleIdentifier, 'test');
  assert.equal(result.UIRequiresFullScreen, true);
  assert.equal(result.UIApplicationSceneManifest.UIApplicationSupportsMultipleScenes, false);
  assert.equal(result.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
    .UISceneDelegateClassName, '$(PRODUCT_MODULE_NAME).GameSceneDelegate');
  assert.deepEqual(sceneManifest(result), result);
});
test('unexpected templates and existing scene declarations fail closed', () => {
  assert.throws(() => migrateAppDelegate('other delegate'), /needs review/);
  assert.throws(() => sceneManifest({ UIApplicationSceneManifest: { existing: true } }), /not be overwritten/);
});
