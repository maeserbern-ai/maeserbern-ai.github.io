import SwiftUI

/// Screen 2: pick one of the puzzle's four options, or True/False for a
/// What Is Toilet Paper? claim.
struct GuessView: View {
    @EnvironmentObject private var game: GameState

    var body: some View {
        ScrollView {
            if let puzzle = game.puzzle, puzzle.isTrueFalse {
                trueFalse(puzzle)
            } else {
                multipleChoice
            }
        }
    }

    private var multipleChoice: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("What is it?")
                .font(.system(.title3, design: .serif, weight: .bold))
                .foregroundStyle(Theme.ink)

            ForEach(Array(game.options.enumerated()), id: \.element) { index, option in
                Button(option) {
                    game.guess(option)
                }
                .buttonStyle(PillButtonStyle(fill: Theme.button, text: Theme.ink, ringOnPress: true))
                .accessibilityIdentifier("watch-answer-\(index)")
            }

            Button {
                game.backToClues()
            } label: {
                Text("Back to clues")
                    .font(.footnote)
                    .foregroundStyle(Theme.soft)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("watch-back-to-clues")
        }
        .padding(.horizontal, 2)
    }

    private func trueFalse(_ puzzle: Puzzle) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("True or false?")
                    .font(.system(.headline, design: .serif, weight: .bold))
                    .foregroundStyle(Theme.terracotta)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 2)
                Text("\(game.currentPoints) pts")
                    .font(.system(.footnote, weight: .bold))
                    .foregroundStyle(Theme.gold)
                    .fixedSize()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("THE CLAIM")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.labelInk.opacity(0.85))
                Text(puzzle.statement ?? "")
                    .font(.system(.body, weight: .semibold))
                    .foregroundStyle(Theme.labelInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("watch-statement")
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.label))

            HStack(spacing: 6) {
                ForEach(Array(game.options.enumerated()), id: \.element) { index, option in
                    Button(option) {
                        game.guess(option)
                    }
                    .buttonStyle(PillButtonStyle(fill: index == 0 ? Theme.good : Theme.bad,
                                                 text: Theme.labelInk, ringOnPress: true))
                    .accessibilityIdentifier(index == 0 ? "watch-true" : "watch-false")
                }
            }
        }
        .padding(.horizontal, 2)
    }
}
