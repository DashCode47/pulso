// iOS 27 asserts at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) unless the app
// adopts the UIScene life cycle. Expo ships ExpoAppSceneDelegate for this, but the
// SDK 57 prebuild template doesn't wire it up yet, so we do it here:
//  - declare the scene manifest in Info.plist pointing at EXExpoAppSceneDelegate
//  - make AppDelegate an ExpoReactNativeFactoryProvider and stop it from creating
//    the window / starting React Native (the scene delegate does that now).
// Remove this plugin once the Expo template adopts scenes itself.
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

const START_RN_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/;

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return cfg;

    const classDecl = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(classDecl) || !START_RN_BLOCK.test(src)) {
      throw new Error(
        'withSceneLifecycle: AppDelegate template changed; update the plugin (or drop it if Expo now adopts scenes).'
      );
    }
    src = src.replace(classDecl, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(
      START_RN_BLOCK,
      '// The window and React Native are started by ExpoAppSceneDelegate (see plugins/withSceneLifecycle.js).\n\n    '
    );
    cfg.modResults.contents = src;
    return cfg;
  });

module.exports = (config) => withSceneAppDelegate(withSceneManifest(config));
