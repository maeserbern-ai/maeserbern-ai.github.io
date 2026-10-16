import XCTest

final class GameScreensTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame")

    override func setUpWithError() throws {
        continueAfterFailure = false
        #if os(iOS)
        XCUIDevice.shared.orientation = .landscapeLeft
        #endif
        app.launch()
    }

    override func tearDownWithError() throws {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "accessibility-tree"
        tree.lifetime = .keepAlways
        add(tree)
        shot("final-state")
        app.terminate()
    }

    func text(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func expect(_ label: String, timeout: TimeInterval = 20) {
        XCTAssertTrue(text(label).waitForExistence(timeout: timeout), "Missing visible content: \(label)")
    }

    func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        XCTAssertGreaterThan(screenshot.image.size.width, 0)
        XCTAssertGreaterThan(screenshot.image.size.height, 0)
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "store-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    #if os(iOS)
    func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15), "Missing button: \(label)")
        XCTAssertTrue(button.isHittable, "Unreachable button: \(label)")
        button.tap()
    }

    func foodBook() {
        let button = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "It's Not Food")).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15))
        button.tap()
        expect("Game setup")
    }

    func testSoloScreensAndAnswer() {
        expect("Play")
        XCTAssertGreaterThan(app.frame.width, app.frame.height)
        let play = app.buttons["Play"]
        let ready = NSPredicate(format: "isHittable == true")
        expectation(for: ready, evaluatedWith: play)
        waitForExpectations(timeout: 20)
        Thread.sleep(forTimeInterval: 0.5)
        shot("01-title")
        tap("How to play")
        expect("Let's play")
        shot("02-instructions")
        tap("Let's play")
        expect("Pick your book")
        shot("03-books")
        foodBook()
        tap("Solo")
        shot("04-setup")
        tap("Start game")
        expect("Next ingredient")
        shot("05-round")
        tap("Next ingredient")
        tap("Menu")
        expect("Game paused")
        tap("Resume game")
        XCTAssertTrue(text("Game paused").waitForNonExistence(timeout: 5), "Pause dialog did not close")
        expect("Next ingredient")
        let answer = app.buttons.matching(NSPredicate(format: "label MATCHES %@", "^1\\s*.+")).firstMatch
        XCTAssertTrue(answer.waitForExistence(timeout: 10), "Missing first answer option")
        XCTAssertTrue(answer.isHittable)
        answer.tap()
        expect("Next round", timeout: 15)
        shot("06-result")
    }

    func testTeamOrderAndPause() {
        expect("Play")
        tap("Play")
        foodBook()
        tap("Start game")
        expect("Pick your team colors")
        tap("Shuffle the order")
        expect("Let's go")
        shot("07-team-order")
        tap("Let's go")
        expect("Next ingredient")
        tap("Menu")
        expect("Game paused")
        shot("08-pause")
        tap("Resume game")
        XCTAssertTrue(text("Game paused").waitForNonExistence(timeout: 5), "Pause dialog did not close")
        expect("Next ingredient")
    }
    #endif

    #if os(tvOS)
    func focused(_ label: String, timeout: TimeInterval = 5) {
        let target = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@ AND hasFocus == true", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: timeout), "Remote focus did not reach: \(label)")
    }

    func select() {
        XCUIRemote.shared.press(.select)
        // Focus animations complete asynchronously after a remote action.
        Thread.sleep(forTimeInterval: 0.5)
    }

    func testRemoteScreensAndPause() {
        expect("Play")
        focused("Play")
        shot("01-title")
        XCUIRemote.shared.press(.right)
        focused("How to play")
        XCUIRemote.shared.press(.left)
        focused("Play")
        XCUIRemote.shared.press(.right)
        focused("How to play")
        select()
        expect("Let's play")
        shot("02-instructions")
        select()
        expect("Pick your book")
        shot("03-books")
        select()
        expect("Game setup")
        shot("04-setup")
        // Each selection advances focus to the next setting, then Start game.
        for _ in 0..<7 { select() }
        expect("Pick your team colors")
        select()
        expect("Let's go")
        shot("05-team-order")
        select()
        expect("Next ingredient")
        shot("06-round")
        XCUIRemote.shared.press(.menu)
        expect("Game paused")
        shot("07-pause")
        select()
        expect("Next ingredient")
    }
    #endif
}
