import XCTest

/// Delivers each widget book link (ingredientparty://book?u=<Amazon link>, the exact URL
/// the widget's book row and QR code use) to the installed game the way a widget tap
/// does, and checks that Safari comes up with the Amazon page. The game logs
/// "IngredientBookLink opened=true <url>" when UIApplication.open succeeds.
final class BookLinkUITests: XCTestCase {
    func testWidgetBookLinksOpenAmazon() throws {
        let links = (ProcessInfo.processInfo.environment["BOOK_LINKS"] ?? "")
            .split(separator: " ").map(String.init).filter { !$0.isEmpty }
        XCTAssertEqual(links.count, 6, "one link per book")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        let game = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame")
        for (i, link) in links.enumerated() {
            safari.terminate()
            if i == 0 {
                game.terminate() // cold start: the game is not running
            } else {
                game.activate()
                sleep(3)
            }
            XCUIDevice.shared.system.open(try XCTUnwrap(URL(string: link)))
            // A URL sent from outside (here: the test) asks first; a widget tap does not.
            let open = springboard.buttons["Open"]
            if open.waitForExistence(timeout: 6) { open.tap() }
            // Safari's address bar must show amazon.com (its run-state flag can lag on a cold start).
            _ = safari.wait(for: .runningForeground, timeout: 20)
            let amazon = safari.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS[c] 'amazon.com' OR value CONTAINS[c] 'amazon.com'"))
                .firstMatch
            XCTAssertTrue(amazon.waitForExistence(timeout: 30), "Safari shows amazon.com for \(link)")
            sleep(4)
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            shot.name = "book-link-\(i)\(i == 0 ? "-cold-start" : "")"
            shot.lifetime = .keepAlways
            add(shot)
        }
    }
}
