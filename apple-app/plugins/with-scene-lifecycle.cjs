const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const marker = '// Ingredient Party Game scene lifecycle';
const legacyWindow = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\s+factory\.startReactNative\(\s+withModuleName: "main",\s+in: window,\s+launchOptions: launchOptions\)\s+#endif/;

function migrateAppDelegate(source) {
  if (source.includes(marker)) return source;
  if (!legacyWindow.test(source) || !source.includes('  var window: UIWindow?')) {
    throw new Error('Unexpected Expo AppDelegate; scene migration needs review');
  }
  return source
    .replace('  var window: UIWindow?', `  var window: UIWindow?
  private var sceneLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func connectGameScene(_ scene: UIWindowScene) -> UIWindow {
    // Keep one React instance and retain the game when UIKit reconnects a scene.
    if let window = window {
      window.windowScene = scene
      window.makeKeyAndVisible()
      return window
    }
    let window = UIWindow(windowScene: scene)
    self.window = window
    reactNativeFactory?.startReactNative(
      withModuleName: "main", in: window, launchOptions: sceneLaunchOptions)
    return window
  }`)
    .replace(legacyWindow, '    sceneLaunchOptions = launchOptions')
    + `
${marker}
class GameSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private var appDelegate: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate = appDelegate else { return }
    window = appDelegate.connectGameScene(windowScene)
    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    for activity in connectionOptions.userActivities { self.scene(scene, continue: activity) }
  }

  // Expo 54 subscribers still receive app-delegate lifecycle callbacks.
  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }
  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }
  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }
  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      if let source = context.options.sourceApplication { options[.sourceApplication] = source }
      if let annotation = context.options.annotation { options[.annotation] = annotation }
      _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
    }
  }
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;
}

function sceneManifest(plist) {
  const existing = plist.UIApplicationSceneManifest;
  if (existing && JSON.stringify(existing) !== JSON.stringify(manifest)) {
    throw new Error('Existing scene configuration must not be overwritten');
  }
  return { ...plist, UIApplicationSceneManifest: manifest };
}
const manifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [{
      UISceneConfigurationName: 'Game',
      UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).GameSceneDelegate',
    }],
  },
};

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, mod => {
    mod.modResults = sceneManifest(mod.modResults);
    return mod;
  });
  return withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('Expected Swift AppDelegate');
    mod.modResults.contents = migrateAppDelegate(mod.modResults.contents);
    return mod;
  });
};
module.exports.migrateAppDelegate = migrateAppDelegate;
module.exports.sceneManifest = sceneManifest;
