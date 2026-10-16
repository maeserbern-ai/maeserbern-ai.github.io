import XCTest

final class GameScreensTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame")

    override func setUpWithError() throws {
        continueAfterFailure = false
        #if os(iOS)
        XCUIDevice.shared.orientation = .landscapeLeft
        #elseif os(tvOS)
        app.launchArguments = ["-UIFocusLoggingEnabled", "YES"]
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
        Thread.sleep(forTimeInterval: 0.5)
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
        Thread.sleep(forTimeInterval: 3)
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
        Thread.sleep(forTimeInterval: 2)
        shot("06-result")
        tap("Next round")
        expect("Next ingredient")
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

    func focusedId(_ id: String, timeout: TimeInterval = 8) {
        let target = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == %@ AND hasFocus == true", id)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: timeout), "Remote focus did not reach control: \(id)")
    }

    func testSoloCompleteGameAndReplay() {
        expect("Play")
        focusedId("title-play")
        select()
        focusedId("book-all")
        select()
        focusedId("teams-2")
        XCUIRemote.shared.press(.left, forDuration: 0.2)
        focusedId("teams-1")
        select()
        focusedId("rounds-5")
        XCUIRemote.shared.press(.left, forDuration: 0.2)
        focusedId("rounds-3")
        select()
        for id in ["level-1", "timer-0", "steal-1", "dare-1", "setup-start"] {
            focusedId(id)
            select()
        }
        for round in 1...4 {
            expect("Round \(round) of 4")
            focusedId("answer-0")
            // Move in both directions, including the confetti-filled final lap.
            XCUIRemote.shared.press(.down, forDuration: 0.2)
            focusedId("answer-1")
            XCUIRemote.shared.press(.up, forDuration: 0.2)
            focusedId("answer-0")
            if round == 4 {
                select() // The finale first asks for a wager of game points.
                focusedId("answer-0")
                expect("True")
                shot("09-finale")
            }
            select()
            focusedId("next", timeout: 15)
            if round == 1 { shot("08-result") }
            select()
        }
        expect("Game over")
        focusedId("final-start")
        XCUIRemote.shared.press(.right, forDuration: 0.2)
        focusedId("final-books")
        XCUIRemote.shared.press(.left, forDuration: 0.2)
        focusedId("final-start")
        shot("10-final-scores")
        select()
        expect("Round 1 of 4")
        focusedId("answer-0")
        XCUIRemote.shared.press(.menu)
        expect("Game paused")
        focusedId("quit-no")
        for _ in 0..<6 {
            let quit = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'quit-yes' AND hasFocus == true")).firstMatch
            if quit.exists { break }
            XCUIRemote.shared.press(.down, forDuration: 0.2)
        }
        focusedId("quit-yes")
        select()
        expect("Play")
        focusedId("title-play")
    }

    func testRemoteScreensAndPause() {
        expect("Play")
        focused("Play")
        shot("01-title")
        XCUIRemote.shared.press(.right, forDuration: 0.2)
        focused("How to play")
        XCUIRemote.shared.press(.left, forDuration: 0.2)
        focused("Play")
        XCUIRemote.shared.press(.right, forDuration: 0.2)
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
        focused("Resume game")
        select()
        XCTAssertTrue(text("Game paused").waitForNonExistence(timeout: 5), "Pause dialog did not close")
        expect("Next ingredient")
    }
    #endif
}

#if os(tvOS)
final class TVRemoteControlTests: XCTestCase {
    func testFocusIsolationProbes() throws {
        let app = XCUIApplication(bundleIdentifier: "io.github.maeserbern.ingredientpartygame")
        var results: [String] = []
        for mode in ["basic", "events", "game-buttons", "overlay", "audio"] {
            app.launchArguments = ["-IPGQAProbe", mode, "-UIFocusLoggingEnabled", "YES"]
            app.launch()
            let title = app.staticTexts["Probe: \(mode)"]
            if !title.waitForExistence(timeout: 15) {
                app.terminate()
                if mode == "basic" { throw XCTSkip("Diagnostic probe is not included in this build") }
                XCTFail("Missing probe: \(mode)")
                continue
            }
            Thread.sleep(forTimeInterval: 1)
            let focused = app.descendants(matching: .any)
                .matching(NSPredicate(format: "hasFocus == true")).firstMatch
            let initial = focused.exists ? focused.label : "none"
            XCUIRemote.shared.press(.right, forDuration: 0.2)
            Thread.sleep(forTimeInterval: 1)
            let after = focused.exists ? focused.label : "none"
            results.append("\(mode): \(initial) -> \(after)")
            XCTAssertEqual(initial, "First", "Unexpected initial focus in \(mode)")
            XCTAssertEqual(after, "Second", "Right arrow blocked in \(mode)")
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "probe-\(mode)-tree"
            tree.lifetime = .keepAlways
            add(tree)
            let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            image.name = "probe-\(mode)-screen"
            image.lifetime = .keepAlways
            add(image)
            app.terminate()
        }
        let report = XCTAttachment(string: results.joined(separator: "\n"))
        report.name = "focus-probe-results"
        report.lifetime = .keepAlways
        add(report)
        print("FOCUS_PROBE_RESULTS\n" + results.joined(separator: "\n"))
        // Both the controls and the real game's remote navigation must pass.
    }

    func testSystemSettingsRemoteInput() {
        let settings = XCUIApplication(bundleIdentifier: "com.apple.TVSettings")
        settings.launch()
        defer { settings.terminate() }
        let focused = settings.descendants(matching: .any)
            .matching(NSPredicate(format: "hasFocus == true")).firstMatch
        XCTAssertTrue(focused.waitForExistence(timeout: 15))
        let initial = focused.label
        XCTAssertFalse(initial.isEmpty)
        XCUIRemote.shared.press(.down, forDuration: 0.2)
        let moved = NSPredicate { _, _ in focused.exists && focused.label != initial }
        expectation(for: moved, evaluatedWith: settings)
        waitForExpectations(timeout: 10)
        let evidence = XCTAttachment(string: "Initial focus: \(initial)\nAfter down: \(focused.label)\n\(settings.debugDescription)")
        evidence.name = "system-remote-control"
        evidence.lifetime = .keepAlways
        add(evidence)
    }
}
#endif
