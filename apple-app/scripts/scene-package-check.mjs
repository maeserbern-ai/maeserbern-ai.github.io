export function verifySceneLifecycle(info, target) {
  const sdkMajor = Number(String(info.DTSDKName ?? '').match(/(?:iphoneos|appletvos)(\d+)/)?.[1]);
  const required = target === 'ios' && sdkMajor >= 27;
  const configurations = info.UIApplicationSceneManifest?.UISceneConfigurations;
  const applicationScenes = configurations?.UIWindowSceneSessionRoleApplication;
  const delegate = Array.isArray(applicationScenes)
    ? applicationScenes.find(scene => typeof scene.UISceneDelegateClassName === 'string'
      && scene.UISceneDelegateClassName.endsWith('.GameSceneDelegate'))?.UISceneDelegateClassName
    : undefined;
  if (required && !delegate) {
    throw new Error('iOS 27 launch blocked: signed game must include its GameSceneDelegate scene lifecycle configuration');
  }
  return { sdkMajor: Number.isFinite(sdkMajor) ? sdkMajor : null, required, delegate: delegate ?? null,
    manifestVerified: Boolean(delegate), runtimeVerified: false };
}
