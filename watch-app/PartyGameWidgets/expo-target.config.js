// "Label of the Day" WidgetKit extension (iPhone, iPad, StandBy, Lock Screen and
// Apple HomeView, which shows the iPhone's widgets). Linked into the Expo app by
// @bacons/apple-targets; see apple-app/app.json.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'PartyGameWidgets',
  displayName: 'Label of the Day',
  bundleIdentifier: '.widgets',
  // Interactive widgets (App Intents buttons) need iOS 17.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  colors: {
    $widgetBackground: '#16211C',
    $accent: '#E07A55',
  },
  // Streak and today's answer are shared by every widget instance.
  entitlements: {
    'com.apple.security.application-groups': ['group.io.github.maeserbern.ingredientpartygame'],
  },
};
