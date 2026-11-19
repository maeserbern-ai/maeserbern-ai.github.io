import SwiftUI

/// Screen 3: right or wrong, the answer, and the weird-ingredient fact.
struct ResultView: View {
    @EnvironmentObject private var game: GameState

    var body: some View {
        if let puzzle = game.puzzle {
            ScrollView {
                VStack(spacing: 8) {
                    Text(game.wasCorrect ? "Correct! +\(game.lastPoints)" : "Not quite  +0")
                        .font(.system(.headline, weight: .bold))
                        .foregroundStyle(game.wasCorrect ? Theme.good : Theme.bad)

                    Text(puzzle.answer)
                        .font(.system(.title3, design: .serif, weight: .bold))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    if !game.wasCorrect, let guess = game.lastGuess {
                        Text("You said \(guess)")
                            .font(.footnote)
                            .foregroundStyle(Theme.soft)
                            .multilineTextAlignment(.center)
                    }

                    spotlightCard(puzzle.spotlight)

                    Button("Next puzzle") {
                        game.nextPuzzle()
                    }
                    .buttonStyle(PillButtonStyle(fill: Theme.terracotta, text: Theme.labelInk))

                    Text("Total \(game.totalScore)  ·  Streak \(game.streak)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.gold)

                    Button {
                        game.goHome()
                    } label: {
                        Text("Home")
                            .font(.footnote)
                            .foregroundStyle(Theme.soft)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 2)
            }
        }
    }

    private func spotlightCard(_ spotlight: Puzzle.Spotlight) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("WEIRD INGREDIENT")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.gold)
            Text(spotlight.name)
                .font(.system(.headline, design: .serif, weight: .bold))
                .foregroundStyle(Theme.terracotta)
                .fixedSize(horizontal: false, vertical: true)
            Text(spotlight.note)
                .font(.footnote)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.card))
    }
}
