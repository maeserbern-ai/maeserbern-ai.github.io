import SwiftUI
import WatchKit

/// Solo game state. Scoring matches the web game: a puzzle starts with
/// `startShown` ingredients and is worth `maxPoints`; each extra ingredient
/// revealed costs one point, but a right answer is always worth at least 1.
/// A What Is Toilet Paper? true/false claim is worth `trueFalsePoints`
/// (the web game's TF_POINTS). A wrong answer scores 0 and ends the streak.
final class GameState: ObservableObject {
    enum Screen: Equatable {
        case start, clues, guess, result
    }

    static let startShown = 3
    static let maxPoints = 5
    static let trueFalsePoints = 3

    @Published private(set) var screen: Screen = .start
    @Published private(set) var puzzle: Puzzle?
    /// The puzzle's four options, shuffled for this round.
    @Published private(set) var options: [String] = []
    /// How many ingredients are visible on the label.
    @Published private(set) var shown = 0
    @Published private(set) var lastGuess: String?
    @Published private(set) var lastPoints = 0

    // Persisted between launches.
    @AppStorage("score.total") private(set) var totalScore = 0
    @AppStorage("score.streak") private(set) var streak = 0
    @AppStorage("score.bestStreak") private(set) var bestStreak = 0
    /// Puzzle keys already played, newline separated (the web game's "seen" list).
    @AppStorage("deck.seen") private var seenKeys = ""
    @AppStorage("deck.lastKey") private var lastKey = ""
    /// The book picked on the Start screen; "all" = Mix all books.
    @AppStorage("book.selected") var selectedBook = "all"

    var hasPuzzles: Bool { !GameData.pool(for: selectedBook).isEmpty }

    /// Name shown for the selected book on the Start screen.
    var selectedBookName: String {
        selectedBook == "all" ? "Mix all books" : (GameData.book(id: selectedBook)?.name ?? "Mix all books")
    }

    func selectBook(_ id: String) {
        objectWillChange.send()
        selectedBook = (id == "all" || GameData.book(id: id) != nil) ? id : "all"
    }

    var wasCorrect: Bool {
        guard let puzzle, let lastGuess else { return false }
        return lastGuess == puzzle.answer
    }

    private var startingShown: Int {
        min(Self.startShown, puzzle?.ingredients.count ?? 0)
    }

    var canRevealMore: Bool {
        guard let puzzle else { return false }
        return shown < puzzle.ingredients.count
    }

    /// Points a right answer is worth right now.
    var currentPoints: Int {
        if puzzle?.isTrueFalse == true { return Self.trueFalsePoints }
        return max(1, Self.maxPoints - (shown - startingShown))
    }

    // MARK: - Actions

    func play() {
        nextPuzzle()
    }

    func nextPuzzle() {
        guard let next = drawFromDeck() else {
            screen = .start
            return
        }
        puzzle = next
        // True/False keep their order, like the web game.
        options = next.isTrueFalse ? next.options : next.options.shuffled()
        shown = min(Self.startShown, next.ingredients.count)
        lastGuess = nil
        lastPoints = 0
        // A true/false claim has no label to read: straight to the two buttons.
        screen = next.isTrueFalse ? .guess : .clues
    }

    /// Shows the next ingredient (costs a point, never below 1).
    func revealMore() {
        guard canRevealMore else { return }
        shown += 1
    }

    func goToGuess() {
        guard puzzle != nil else { return }
        screen = .guess
    }

    func backToClues() {
        guard let puzzle, !puzzle.isTrueFalse else { return }
        screen = .clues
    }

    func guess(_ option: String) {
        guard let puzzle, screen == .guess else { return }
        lastGuess = option
        if option == puzzle.answer {
            lastPoints = currentPoints
            totalScore += lastPoints
            streak += 1
            bestStreak = max(bestStreak, streak)
            WKInterfaceDevice.current().play(.success)
        } else {
            lastPoints = 0
            streak = 0
            WKInterfaceDevice.current().play(.failure)
        }
        screen = .result
    }

    func goHome() {
        screen = .start
    }

    // MARK: - Deck

    /// No repeats, like the web game: deals a puzzle the watch has not shown yet
    /// from the selected book (or every book). Once that book runs out, only that
    /// book starts over. A fresh start never repeats the puzzle just played.
    private func drawFromDeck() -> Puzzle? {
        let pool = GameData.pool(for: selectedBook)
        guard !pool.isEmpty else { return nil }

        var seen = Set(seenKeys.split(separator: "\n").map(String.init))
            .filter { GameData.puzzlesByKey[$0] != nil }
        var fresh = pool.filter { !seen.contains($0.key) }
        if fresh.isEmpty {
            pool.forEach { seen.remove($0.key) }
            fresh = pool
        }
        if fresh.count > 1 { fresh.removeAll { $0.key == lastKey } }

        guard let next = fresh.randomElement() else { return nil }
        seen.insert(next.key)
        seenKeys = seen.sorted().joined(separator: "\n")
        lastKey = next.key
        return next
    }
}
