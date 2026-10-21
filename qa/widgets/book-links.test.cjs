const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addBookLinks } = require('../../apple-app/plugins/with-book-links.cjs');

const appDelegate = `public class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
}`;

test('widget book links are opened before React Native linking', () => {
  const out = addBookLinks(appDelegate);
  const guard = out.indexOf('if BookLinkOpener.open(url) { return true }');
  assert.ok(guard > 0);
  assert.ok(guard < out.indexOf('RCTLinkingManager.application(app, open: url'));
  assert.ok(out.includes('UIApplication.shared.open(link'));
  assert.ok(out.includes('"www.amazon.com"'));
  assert.equal(addBookLinks(out), out, 'idempotent');
});

test('unknown AppDelegate shape fails loudly instead of dropping links', () => {
  assert.throws(() => addBookLinks('class AppDelegate {}'));
});
