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
        // SwiftUI Link is exposed as a Link on watchOS 27 and a Button on 26.
        let element = app.descendants(matching: .any).matching(identifier: id).firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: 15), "Missing \(id)")
        // Short, momentum-free drags toward the element: a swipe can jump right past a
        // button on the long true/false answer screen and then bounce back and forth.
        let scroll = app.scrollViews.firstMatch
        for _ in 0..<24 {
            if element.isHittable { return element }
            let view = scroll.exists ? scroll.frame : app.windows.firstMatch.frame
            let below = element.frame.midY > view.midY
            let surface = scroll.exists ? scroll : app.windows.firstMatch
            let start = surface.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.7 : 0.35))
            let end = surface.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.35 : 0.7))
            start.press(forDuration: 0.05, thenDragTo: end,
                        withVelocity: XCUIGestureVelocity(rawValue: 120), thenHoldForDuration: 0.2)
        }
        XCTFail("Cannot reach \(id)")
        return element
    }

    func capture(_ name: String) {
        Thread.sleep(forTimeInterval: 0.5)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "store-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func pickBook(_ id: String) {
        reveal("watch-book-picker").tap()
        let first = app.descendants(matching: .any).matching(identifier: "watch-pick-all").firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 10), "Book picker did not open")
        // List rows below the fold are created lazily: scroll until the row exists.
        let row = app.descendants(matching: .any).matching(identifier: "watch-pick-\(id)").firstMatch
        for _ in 0..<12 {
            if row.exists && row.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(row.exists && row.isHittable, "Missing watch-pick-\(id)")
        row.tap()
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 10))
    }

    /// Scrolls the answer screen down to the "FROM THE BOOK" card and captures its QR code.
    func captureResultBook(_ name: String) {
        let code = app.images["watch-result-qr"]
        XCTAssertTrue(code.waitForExistence(timeout: 10), "Missing book QR on the answer screen")
        // Bring the whole code into view below the clock (top ~34 pt) with short drags.
        let scroll = app.scrollViews.firstMatch
        let surface = scroll.exists ? scroll : app.windows.firstMatch
        var view = surface.frame
        func inView() -> Bool {
            code.frame.minY >= view.minY + 34 && code.frame.maxY <= view.maxY - 2
        }
        for _ in 0..<24 {
            view = surface.frame
            if inView() { break }
            // Drag by exactly the distance that centres the code under the clock
            // (very short drags are swallowed as taps, so at least 40 pt).
            let target = (view.minY + 34 + view.maxY) / 2
            var distance = code.frame.midY - target
            if abs(distance) < 40 { distance = distance < 0 ? -40 : 40 }
            let most = view.height * 0.6
            distance = min(most, max(-most, distance))
            let middle = surface.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            let start = middle.withOffset(CGVector(dx: 0, dy: distance / 2))
            let end = middle.withOffset(CGVector(dx: 0, dy: -distance / 2))
            start.press(forDuration: 0.05, thenDragTo: end,
                        withVelocity: XCUIGestureVelocity(rawValue: 150), thenHoldForDuration: 0.3)
        }
        XCTAssertTrue(inView(), "Book QR clipped on the answer screen: \(code.frame) in \(view)")
        XCTAssertGreaterThan(code.frame.width, 80)
        capture(name)
        // Back to the top of the answer screen (Next puzzle).
        for _ in 0..<4 { app.swipeDown() }
    }

    func testSoloGameAndRelaunch() {
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 20))
        capture("01-watch-title")
        reveal("watch-book-picker").tap()
        XCTAssertTrue(app.descendants(matching: .any).matching(identifier: "watch-pick-all").firstMatch.waitForExistence(timeout: 10))
        capture("01-watch-book-picker")
        reveal("watch-pick-food").tap()
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 10))
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
        captureResultBook("06-watch-result-book")
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

    func testToiletPaperTrueFalse() {
        XCTAssertTrue(app.buttons["watch-play"].waitForExistence(timeout: 20))
        pickBook("tp")
        reveal("watch-play").tap()
        XCTAssertTrue(app.buttons["watch-true"].waitForExistence(timeout: 10), "True/false claim not shown")
        XCTAssertTrue(app.buttons["watch-false"].exists)
        XCTAssertFalse(app.buttons["watch-ingredient-0"].exists)
        capture("07-watch-truefalse")
        reveal("watch-true").tap()
        XCTAssertTrue(app.buttons["watch-next"].waitForExistence(timeout: 10))
        let answer = app.staticTexts["watch-result-answer"].label
        XCTAssertTrue(answer == "True." || answer == "False.", "Unexpected answer \(answer)")
        XCTAssertTrue(app.staticTexts["THE REAL STORY"].exists)
        capture("08-watch-truefalse-result")
        captureResultBook("09-watch-truefalse-book")
        // The next claim comes from the same book and is a different one.
        reveal("watch-next").tap()
        XCTAssertTrue(app.buttons["watch-true"].waitForExistence(timeout: 10))
        reveal("watch-false").tap()
        XCTAssertTrue(app.buttons["watch-next"].waitForExistence(timeout: 10))
        reveal("watch-home").tap()
        pickBook("all")
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
            for attempt in 0..<24 {
                print("Book \(id), attempt \(attempt), frame \(entry.exists ? entry.frame.debugDescription : "absent"), top \(visibleTop), list \(list.frame)")
                if entry.exists && entry.frame.height > 0 && entry.frame.midY > visibleTop + 8 && entry.frame.midY < list.frame.maxY - 24 { break }
                let above = entry.exists && entry.frame.height > 0 && entry.frame.midY <= visibleTop + 8
                let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.45 : 0.7))
                let end = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: above ? 0.7 : 0.45))
                // Stop the drag before release so list momentum cannot skip a row.
                start.press(forDuration: 0.1, thenDragTo: end,
                            withVelocity: XCUIGestureVelocity(rawValue: 80), thenHoldForDuration: 0.3)
            }
            XCTAssertTrue(entry.exists && entry.frame.height > 0, "Book missing: \(id)")
            XCTAssertGreaterThan(entry.frame.midY, visibleTop + 8)
            XCTAssertLessThan(entry.frame.midY, list.frame.maxY - 24)
            // SwiftUI can report a recycled row's inner button as unhittable.
            // Tap the visible cell and require its exact book destination below.
            entry.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            let link = app.descendants(matching: .any).matching(identifier: "watch-book-link-\(id)").firstMatch
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
