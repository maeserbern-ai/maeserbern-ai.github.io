// Book links from the "Label of the Day" widget.
//
// WidgetKit never opens a widget's Link in Safari directly: the system launches the
// containing app and passes it the URL. The widget therefore sends
// ingredientparty://book?u=<Amazon link>, and this plugin makes the app open that
// Amazon (or maeserbern-ai.github.io) link at once in Safari / the Amazon app, natively,
// so it also works on a cold start before the game's JavaScript has loaded.
const { withAppDelegate } = require('expo/config-plugins');

const marker = '// Ingredient Party Game book links';
const linkingReturn =
  '    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)';

const opener = `
${marker}
enum BookLinkOpener {
  static let allowedHosts: Set<String> = ["www.amazon.com", "amazon.com", "maeserbern-ai.github.io"]

  /// ingredientparty://book?u=<https link> (from the widget) or a direct https book link.
  static func target(for url: URL) -> URL? {
    var candidate: URL?
    if url.scheme?.lowercased() == "ingredientparty", url.host?.lowercased() == "book" {
      let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?.first(where: { $0.name == "u" })?.value
      candidate = value.flatMap { URL(string: $0) }
    } else if url.scheme?.lowercased() == "https" {
      candidate = url
    }
    guard let link = candidate, link.scheme?.lowercased() == "https",
          let host = link.host?.lowercased(), allowedHosts.contains(host) else { return nil }
    return link
  }

  static func open(_ url: URL) -> Bool {
    guard let link = target(for: url) else { return false }
    NSLog("IngredientBookLink request %@", link.absoluteString)
    // Let the scene finish connecting, then hand the link to Safari / the Amazon app.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
      UIApplication.shared.open(link, options: [:]) { opened in
        NSLog("IngredientBookLink opened=%@ %@", opened ? "true" : "false", link.absoluteString)
      }
    }
    return true
  }
}
`;

function addBookLinks(source) {
  if (source.includes(marker)) return source;
  if (!source.includes(linkingReturn)) {
    throw new Error('Unexpected Expo AppDelegate; book link handling needs review');
  }
  return source.replace(linkingReturn, `    if BookLinkOpener.open(url) { return true }\n${linkingReturn}`) + opener;
}

module.exports = function withBookLinks(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') throw new Error('Expected Swift AppDelegate');
    mod.modResults.contents = addBookLinks(mod.modResults.contents);
    return mod;
  });
};
module.exports.addBookLinks = addBookLinks;
