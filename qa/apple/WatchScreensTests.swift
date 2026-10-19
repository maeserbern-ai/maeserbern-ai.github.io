import XCTest

final class WatchScreensTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame.watch")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }

    override func tearDownWithError() throws {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "watch-accessibility-tree"
        tree.lifetime = .keepAlways
        add(tree)
        capture("watch-final-state")
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
        for (id, title) in [("food", "It's Not Food"), ("beauty", "It's Not Beauty"),
                            ("clean", "It's Not Clean"), ("kids", "It's Not for Kids"),
                            ("home", "Your Home Is Not Safe"), ("tp", "What Is Toilet Paper?"),
                            ("all", "All the books")] {
            app.terminate()
            app.launch()
            reveal("watch-books").tap()
            let list = app.collectionViews.firstMatch
            XCTAssertTrue(list.waitForExistence(timeout: 10))
            let entry = list.cells.matching(NSPredicate(format: "label == %@", title)).firstMatch
            let visibleTop = app.navigationBars.firstMatch.frame.maxY
            for _ in 0..<24 {
                if entry.exists && entry.frame.height > 0 && entry.frame.midY > visibleTop + 8 && entry.frame.midY < list.frame.maxY - 24 { break }
                let above = entry.exists && entry.frame.height > 0 && entry.frame.midY <= visibleTop + 8
                let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.45 : 0.7))
                let end = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.7 : 0.45))
                start.press(forDuration: 0.2, thenDragTo: end)
            }
            XCTAssertTrue(entry.exists && entry.frame.height > 0, "Book missing: \(id)")
            XCTAssertGreaterThan(entry.frame.midY, visibleTop + 8)
            XCTAssertLessThan(entry.frame.midY, list.frame.maxY - 24)
            // SwiftUI can report a recycled row's inner button as unhittable.
            // Tap the visible cell and require its exact book destination below.
            entry.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            let link = app.buttons["watch-book-link-\(id)"]
            XCTAssertTrue(link.waitForExistence(timeout: 10), "Missing book link: \(id)")
            _ = reveal("watch-book-link-\(id)")
            capture("05-watch-book-detail-\(id)")
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
