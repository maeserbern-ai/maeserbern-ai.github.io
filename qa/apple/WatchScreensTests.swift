import XCTest

final class WatchScreensTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame.watch")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }

    func reveal(_ id: String) -> XCUIElement {
        let button = app.buttons[id]
        XCTAssertTrue(button.waitForExistence(timeout: 15), "Missing \(id)")
        for _ in 0..<10 {
            if button.isHittable { return button }
            app.swipeUp()
        }
        XCTFail("Cannot reach \(id)")
        return button
    }

    func capture(_ name: String) {
        Thread.sleep(forTimeInterval: 0.5)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "store-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testSoloGameAndRelaunch() {
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 20))
        capture("01-watch-title")
        reveal("watch-play").tap()
        XCTAssertTrue(app.buttons["watch-ingredient-0"].waitForExistence(timeout: 10))
        capture("02-watch-ingredients")
        if app.buttons["watch-more"].isEnabled {
            reveal("watch-more").tap()
        }
        reveal("watch-guess").tap()
        XCTAssertTrue(app.staticTexts["What is it?"].waitForExistence(timeout: 10))
        capture("03-watch-answers")
        reveal("watch-answer-0").tap()
        XCTAssertTrue(app.buttons["watch-next"].waitForExistence(timeout: 10))
        capture("04-watch-result")
        reveal("watch-next").tap()
        reveal("watch-guess").tap()
        reveal("watch-answer-0").tap()
        reveal("watch-home").tap()
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 10))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 20))
        reveal("watch-play").tap()
        XCTAssertTrue(app.buttons["watch-ingredient-0"].waitForExistence(timeout: 10))
    }

    func testAllBookDestinationsAndCodes() {
        for id in ["food", "beauty", "clean", "kids", "home", "tp", "all"] {
            app.terminate()
            app.launch()
            reveal("watch-books").tap()
            let entry = app.buttons["watch-book-\(id)"]
            for _ in 0..<12 {
                if entry.exists && entry.isHittable { break }
                app.swipeUp()
            }
            XCTAssertTrue(entry.exists && entry.isHittable, "Book missing: \(id)")
            entry.tap()
            let link = app.buttons["watch-book-link-\(id)"]
            XCTAssertTrue(link.waitForExistence(timeout: 10), "Missing book link: \(id)")
            reveal("watch-book-qr-\(id)").tap()
            let code = app.images["watch-book-code-\(id)"]
            XCTAssertTrue(code.waitForExistence(timeout: 10), "Missing QR code: \(id)")
            XCTAssertGreaterThan(code.frame.width, 80)
            XCTAssertGreaterThan(code.frame.height, 80)
            XCTAssertTrue(app.frame.contains(code.frame), "QR code clipped: \(id)")
            capture("05-watch-book-\(id)")
        }
    }
}
