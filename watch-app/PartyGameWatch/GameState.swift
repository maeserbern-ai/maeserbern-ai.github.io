import SwiftUI
import WatchKit

/// Solo game state. Scoring matches the web game: a puzzle starts with
/// `startShown` ingredients and is worth `maxPoints`; each extra ingredient
/// revealed costs one point, but a right answer is always worth at least 1.
final class GameState: ObservableObject {
    enum Screen: Equatable {
        case start, clues, guess, result
    }

    static let startShown = 3
    static let maxPoints = 5

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
    /// Answers still to be played in the current shuffled deck, newline separated.
    @AppStorage("deck.remaining") private var deckRemaining = ""
    @AppStorage("deck.lastAnswer") private var lastAnswer = ""

    var hasPuzzles: Bool { !GameData.puzzles.isEmpty }

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
        max(1, Self.maxPoints - (shown - startingShown))
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
        options = next.options.shuffled()
        shown = min(Self.startShown, next.ingredients.count)
        lastGuess = nil
        lastPoints = 0
        screen = .clues
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
        guard puzzle != nil else { return }
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

    /// Draws from a persisted shuffled deck so no puzzle repeats until every
    /// puzzle has been played. A fresh shuffle never starts with the puzzle
    /// that ended the previous deck.
    private func drawFromDeck() -> Puzzle? {
        guard !GameData.puzzles.isEmpty else { return nil }

        var remaining = deckRemaining
            .split(separator: "\n")
            .map(String.init)
            .filter { GameData.puzzlesByAnswer[$0] != nil }

        if remaining.isEmpty {
            remaining = GameData.puzzles.map(\.answer).shuffled()
            if remaining.count > 1, remaining.first == lastAnswer {
                remaining.swapAt(0, remaining.count - 1)
            }
        }

        let answer = remaining.removeFirst()
        deckRemaining = remaining.joined(separator: "\n")
        lastAnswer = answer
        return GameData.puzzlesByAnswer[answer]
    }
}
