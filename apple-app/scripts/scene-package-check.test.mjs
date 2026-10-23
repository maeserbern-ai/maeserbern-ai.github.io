import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySceneLifecycle } from './scene-package-check.mjs';

const configured = {
  DTSDKName: 'iphoneos27.1',
  UIApplicationSceneManifest: { UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [{ UISceneDelegateClassName: 'IngredientPartyGame.GameSceneDelegate' }],
  } },
};
test('iOS 27 package without scene lifecycle is rejected', () => {
  assert.throws(() => verifySceneLifecycle({ DTSDKName: 'iphoneos27.1' }, 'ios'), /iOS 27 launch blocked/);
});
test('configured delegate passes manifest check, not runtime QA', () => {
  assert.deepEqual(verifySceneLifecycle(configured, 'ios'), {
    sdkMajor: 27, required: true, delegate: 'IngredientPartyGame.GameSceneDelegate',
    manifestVerified: true, runtimeVerified: false,
  });
});
test('empty scene manifest cannot masquerade as compatibility', () => {
  assert.throws(() => verifySceneLifecycle({ ...configured, UIApplicationSceneManifest: {} }, 'ios'), /launch blocked/);
});
test('legacy SDK and SwiftUI tvOS are not subject to the Expo delegate rule', () => {
  assert.equal(verifySceneLifecycle({ DTSDKName: 'iphoneos26.2' }, 'ios').required, false);
  assert.equal(verifySceneLifecycle({ DTSDKName: 'appletvos27.1' }, 'tvos').required, false);
});
